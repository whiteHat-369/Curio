import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import {
  noteListQuerySchema,
  createNoteSchema,
  updateNoteSchema,
  bulkGroupNotesSchema,
  addNoteTagSchema,
  renameTagSchema,
} from "../../lib/validation.js";
import { NotFoundError } from "../../lib/errors.js";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";

export async function noteRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── List notes ──────────────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const query = validate(noteListQuerySchema, request.query as any);
    const cursor = query.cursor ?? undefined;
    const limit = query.limit ?? 20;
    const q = query.q ?? undefined;
    const groupBy = query.groupBy ?? undefined;

    const where: any = { workspaceId: wsId, deletedAt: null };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ];
    }

    const findArgs: Parameters<typeof prisma.note.findMany>[0] = {
      where,
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
    }

    const notes = await prisma.note.findMany(findArgs);

    const hasMore = notes.length > limit;
    const items = hasMore ? notes.slice(0, limit) : notes;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Group by group if requested
    if (groupBy === "group") {
      const grouped: Record<string, typeof items> = {};
      for (const note of items) {
        const key = note.group ?? "__ungrouped__";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(note);
      }
      return reply.send({ groups: grouped, nextCursor });
    }

    return reply.send({ items, nextCursor });
  });

  // ── Create note ─────────────────────────────────────────────────
  app.post("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const data = validate(createNoteSchema, request.body);

    const note = await prisma.note.create({
      data: {
        workspaceId: wsId,
        title: data.title,
        body: data.body ?? "",
        group: data.group ?? null,
        tags: data.tags,
        paperIds: data.paperIds,
      },
    });

    return reply.status(201).send(note);
  });

  // ── Update note ─────────────────────────────────────────────────
  app.patch("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };
    const data = validate(updateNoteSchema, request.body);

    const existing = await prisma.note.findFirst({
      where: { id, workspaceId: wsId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const note = await prisma.note.update({
      where: { id },
      data,
    });

    return reply.send(note);
  });

  // ── Soft-delete note ────────────────────────────────────────────
  app.delete("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const existing = await prisma.note.findFirst({
      where: { id, workspaceId: wsId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.status(204).send();
  });

  // ── Restore note (undo delete) ──────────────────────────────────
  app.post("/:id/restore", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const existing = await prisma.note.findFirst({
      where: { id, workspaceId: wsId, deletedAt: { not: null } },
    });
    if (!existing) {
      throw new NotFoundError("Note not found or not deleted");
    }

    const note = await prisma.note.update({
      where: { id },
      data: { deletedAt: null },
    });

    return reply.send(note);
  });

  // ── Bulk group notes ────────────────────────────────────────────
  app.post("/bulk/group", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const { ids, group } = validate(bulkGroupNotesSchema, request.body);

    await prisma.note.updateMany({
      where: { id: { in: ids }, workspaceId: wsId, deletedAt: null },
      data: { group },
    });

    return reply.status(204).send();
  });

  // ── Add tag to note ─────────────────────────────────────────────
  app.post("/:id/tags", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };
    const { tag } = validate(addNoteTagSchema, request.body);

    const existing = await prisma.note.findFirst({
      where: { id, workspaceId: wsId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    const newTags = existing.tags.includes(tag) ? existing.tags : [...existing.tags, tag];
    await prisma.note.update({ where: { id }, data: { tags: newTags } });

    return reply.status(204).send();
  });

  // ── Remove tag from note ────────────────────────────────────────
  app.delete("/:id/tags/:tag", async (request, reply) => {
    const { wsId, id, tag } = request.params as { wsId: string; id: string; tag: string };

    const existing = await prisma.note.findFirst({
      where: { id, workspaceId: wsId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundError("Note not found");
    }

    await prisma.note.update({
      where: { id },
      data: { tags: existing.tags.filter((t) => t !== tag) },
    });

    return reply.status(204).send();
  });

  // ── Rename tag across all notes in workspace ────────────────────
  app.patch("/tags/:tag", async (request, reply) => {
    const { wsId, tag } = request.params as { wsId: string; tag: string };
    const { tag: newTag } = validate(renameTagSchema, request.body);

    const notes = await prisma.note.findMany({
      where: { workspaceId: wsId, deletedAt: null, tags: { has: tag } },
    });

    if (notes.length > 0) {
      await prisma.$transaction(
        notes.map((note) =>
          prisma.note.update({
            where: { id: note.id },
            data: {
              tags: [
                ...note.tags.filter((t) => t !== tag),
                newTag,
              ],
            },
          }),
        ),
      );
    }

    return reply.status(204).send();
  });
}