import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  recentWorkspacesQuerySchema,
} from "../../lib/validation.js";
import { getWorkspaceWithOwnerCheck } from "../../lib/workspace-access.js";

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook("onRequest", authHook);

  // ── List workspaces ─────────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const user = getUser(request);

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: user.userId },
      orderBy: { updatedAt: "desc" },
    });

    const wsIds = workspaces.map((w) => w.id);

    // Compute paper stats in a single database aggregation query (eliminates N+1 bottleneck)
    const paperStats =
      wsIds.length > 0
        ? await prisma.paper.groupBy({
            by: ["workspaceId", "status"],
            where: { workspaceId: { in: wsIds }, deletedAt: null },
            _count: { _all: true },
          })
        : [];

    const statsMap = new Map<string, { total: number; read: number }>();
    for (const stat of paperStats) {
      const current = statsMap.get(stat.workspaceId) ?? { total: 0, read: 0 };
      current.total += stat._count._all;
      if (stat.status === "read") {
        current.read += stat._count._all;
      }
      statsMap.set(stat.workspaceId, current);
    }

    const items = workspaces.map((ws) => {
      const stats = statsMap.get(ws.id) ?? { total: 0, read: 0 };
      const progress = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

      return {
        id: ws.id,
        name: ws.name,
        question: ws.question,
        progress,
        paperCount: stats.total,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      };
    });

    return reply.send({ items });
  });

  // ── Recent workspaces (MUST be defined before /:id) ─────────────
  app.get("/recent", async (request, reply) => {
    const user = getUser(request);
    const { limit } = validate(recentWorkspacesQuerySchema, request.query as any);

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: user.userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return reply.send({ items: workspaces });
  });

  // ── Create workspace ────────────────────────────────────────────
  app.post("/", async (request, reply) => {
    const user = getUser(request);
    const { name, question } = validate(createWorkspaceSchema, request.body);

    const workspace = await prisma.workspace.create({
      data: {
        ownerId: user.userId,
        name,
        question,
      },
    });

    return reply.status(201).send(workspace);
  });

  // ── Get workspace detail ────────────────────────────────────────
  app.get("/:id", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const workspace = await getWorkspaceWithOwnerCheck(id, user.userId);

    return reply.send(workspace);
  });

  // ── Update workspace ────────────────────────────────────────────
  app.patch("/:id", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const data = validate(updateWorkspaceSchema, request.body);

    await getWorkspaceWithOwnerCheck(id, user.userId);

    const workspace = await prisma.workspace.update({
      where: { id },
      data,
    });

    return reply.send(workspace);
  });

  // ── Delete workspace ────────────────────────────────────────────
  app.delete("/:id", async (request, reply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    await getWorkspaceWithOwnerCheck(id, user.userId);

    // Delete this track's owned data
    await prisma.$transaction([
      prisma.evidenceClaim.deleteMany({ where: { workspaceId: id } }),
      prisma.note.deleteMany({ where: { workspaceId: id } }),
      prisma.workspace.delete({ where: { id } }),
    ]);

    // Notify Track B to clean up its data (Papers, Datasets, Conversations, etc.)
    try {
      await fetch(
        `http://localhost:${process.env.PORT ?? 3001}/internal/workspaces/${id}/purged`,
        {
          method: "POST",
          headers: { "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "" },
          signal: AbortSignal.timeout(2000),
        },
      );
    } catch {
      // Track B not available or timed out — cleanup will happen eventually
    }

    return reply.status(204).send();
  });
}