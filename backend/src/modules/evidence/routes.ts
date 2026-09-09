import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import {
  evidenceListQuerySchema,
  createEvidenceClaimSchema,
} from "../../lib/validation.js";
import { NotFoundError } from "../../lib/errors.js";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";

export async function evidenceRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── List evidence claims ────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const query = validate(evidenceListQuerySchema, request.query as any);
    const cursor = query.cursor ?? undefined;
    const stance = query.stance ?? undefined;
    const limit = query.limit ?? 20;

    const where: { workspaceId: string; stance?: string } = { workspaceId: wsId };
    if (stance) where.stance = stance;

    const findArgs: Parameters<typeof prisma.evidenceClaim.findMany>[0] = {
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
    }

    const claims = await prisma.evidenceClaim.findMany(findArgs);

    const hasMore = claims.length > limit;
    const items = hasMore ? claims.slice(0, limit) : claims;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Fetch paper titles for display (cross-track)
    const paperIds = [...new Set(items.map((c) => c.paperId))];
    let paperMap: Record<string, { title: string }> = {};
    if (paperIds.length > 0) {
      try {
        const papersRes = await fetch(
          `http://localhost:${process.env.PORT ?? 3001}/internal/papers/bulk-lookup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
            },
            body: JSON.stringify({ ids: paperIds }),
            signal: AbortSignal.timeout(1000),
          },
        );
        if (papersRes.ok) {
          const papersData = (await papersRes.json()) as { items: { id: string; title: string }[] };
          paperMap = Object.fromEntries(
            papersData.items.map((p: { id: string; title: string }) => [p.id, { title: p.title }]),
          );
        }
      } catch {
        // Internal service not available or timed out — fail gracefully
      }
    }

    const itemsWithPaper = items.map((claim) => ({
      ...claim,
      paperTitle: paperMap[claim.paperId]?.title ?? null,
    }));

    return reply.send({ items: itemsWithPaper, nextCursor });
  });

  // ── Get distinct questions with per-stance counts ───────────────
  app.get("/questions", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    const claims = await prisma.evidenceClaim.findMany({
      where: { workspaceId: wsId },
      select: { question: true, stance: true },
    });

    // Aggregate by question
    const questionMap = new Map<string, { supports: number; contradicts: number; mixed: number; total: number }>();
    for (const claim of claims) {
      const entry = questionMap.get(claim.question) ?? { supports: 0, contradicts: 0, mixed: 0, total: 0 };
      entry.total++;
      if (claim.stance === "supports") entry.supports++;
      else if (claim.stance === "contradicts") entry.contradicts++;
      else if (claim.stance === "mixed") entry.mixed++;
      questionMap.set(claim.question, entry);
    }

    const questions = Array.from(questionMap.entries()).map(([question, counts]) => ({
      question,
      ...counts,
    }));

    return reply.send({ items: questions });
  });

  // ── Create evidence claim ───────────────────────────────────────
  app.post("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const data = validate(createEvidenceClaimSchema, request.body);

    const claim = await prisma.evidenceClaim.create({
      data: {
        workspaceId: wsId,
        ...data,
      },
    });

    return reply.status(201).send(claim);
  });

  // ── Delete evidence claim ───────────────────────────────────────
  app.delete("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const existing = await prisma.evidenceClaim.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!existing) {
      throw new NotFoundError("Evidence claim not found");
    }

    await prisma.evidenceClaim.delete({ where: { id } });

    return reply.status(204).send();
  });
}