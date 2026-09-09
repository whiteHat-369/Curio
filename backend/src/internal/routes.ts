import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { validate } from "../lib/validation.js";
import { internalPapersBulkLookupSchema } from "../lib/validation.js";
import { UnauthorizedError } from "../lib/errors.js";

/**
 * Internal (service-to-service) endpoints.
 * Protected via internal service header token authentication.
 */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request) => {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    const provided = request.headers["x-internal-service-token"];
    if (!expected || provided !== expected) {
      throw new UnauthorizedError("Invalid internal service credentials");
    }
  });

  // Handler for paper bulk lookup
  const handleBulkLookup = async (request: any, reply: any) => {
    const { ids } = validate(internalPapersBulkLookupSchema, request.body);

    const papers = await prisma.paper.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        authors: true,
        year: true,
        venue: true,
        status: true,
        tags: true,
        group: true,
        pinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send({ items: papers });
  };

  // Support both /papers and /papers/bulk-lookup endpoints
  app.post("/papers", handleBulkLookup);
  app.post("/papers/bulk-lookup", handleBulkLookup);

  // ── Get paper stats for a workspace ────────────────────────────
  app.get("/workspaces/:wsId/paper-stats", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    const [total, read] = await Promise.all([
      prisma.paper.count({
        where: { workspaceId: wsId, deletedAt: null },
      }),
      prisma.paper.count({
        where: { workspaceId: wsId, deletedAt: null, status: "read" },
      }),
    ]);

    return reply.send({ total, read });
  });

  // ── Get recent papers for a workspace ──────────────────────────
  app.get("/workspaces/:wsId/recent-papers", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit ?? "5", 10);

    const papers = await prisma.paper.findMany({
      where: { workspaceId: wsId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 20),
      select: {
        id: true,
        title: true,
        authors: true,
        year: true,
        status: true,
        tags: true,
        createdAt: true,
      },
    });

    return reply.send({ items: papers });
  });

  // ── Purge workspace data ───────────────────────────────────────
  app.post("/workspaces/:wsId/purged", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    // Delete in order to respect FK constraints
    await prisma.$transaction([
      prisma.chatMessage.deleteMany({
        where: { conversation: { workspaceId: wsId } },
      }),
      prisma.conversation.deleteMany({ where: { workspaceId: wsId } }),
      prisma.dataset.deleteMany({ where: { workspaceId: wsId } }),
      prisma.annotation.deleteMany({
        where: { paper: { workspaceId: wsId } },
      }),
      prisma.paperSummary.deleteMany({
        where: { paper: { workspaceId: wsId } },
      }),
      prisma.paper.deleteMany({ where: { workspaceId: wsId } }),
    ]);

    return reply.status(204).send();
  });
}