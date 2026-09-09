import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { assertWorkspaceOwner, getWorkspaceWithOwnerCheck } from "../../lib/workspace-access.js";

export async function overviewRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── Get overview ────────────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    const workspace = await getWorkspaceWithOwnerCheck(wsId, user.userId);

    // Fetch paper stats directly from DB
    const [paperCount, readCount, recentPapers] = await Promise.all([
      prisma.paper.count({
        where: { workspaceId: wsId, deletedAt: null },
      }),
      prisma.paper.count({
        where: { workspaceId: wsId, deletedAt: null, status: "read" },
      }),
      prisma.paper.findMany({
        where: { workspaceId: wsId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          authors: true,
          year: true,
          status: true,
        },
      }),
    ]);

    return reply.send({
      question: workspace.question,
      stats: {
        paperCount,
        readCount,
        progress: paperCount > 0 ? Math.round((readCount / paperCount) * 100) : 0,
      },
      recentPapers,
    });
  });

  // ── Get Research Health ─────────────────────────────────────────
  app.get("/health", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    const currentYear = new Date().getFullYear();

    const [paperCount, readCount, recentPaperCount, evidenceCount, notesCount, datasetCount] =
      await Promise.all([
        prisma.paper.count({
          where: { workspaceId: wsId, deletedAt: null },
        }),
        prisma.paper.count({
          where: { workspaceId: wsId, deletedAt: null, status: "read" },
        }),
        prisma.paper.count({
          where: { workspaceId: wsId, deletedAt: null, year: { gte: currentYear - 3 } },
        }),
        prisma.evidenceClaim.count({
          where: { workspaceId: wsId },
        }),
        prisma.note.count({
          where: { workspaceId: wsId, deletedAt: null },
        }),
        prisma.dataset.count({
          where: { workspaceId: wsId },
        }),
      ]);

    const coveragePercent = paperCount > 0 ? Math.round((readCount / paperCount) * 100) : 0;
    const recencyPercent = paperCount > 0 ? Math.round((recentPaperCount / paperCount) * 100) : 0;

    // Compute rule-based suggestions
    const suggestions: string[] = [];

    if (paperCount === 0) {
      suggestions.push("No papers added yet. Start by uploading papers to build your workspace library.");
    } else {
      if (coveragePercent < 50) {
        suggestions.push(`Only ${coveragePercent}% of papers have been read. Consider reviewing unread papers to improve coverage.`);
      } else if (coveragePercent >= 80) {
        suggestions.push(`Great coverage! ${coveragePercent}% of papers in this workspace have been read.`);
      }

      if (recencyPercent < 40) {
        suggestions.push(`Only ${recencyPercent}% of papers are from the last 3 years. Consider adding recent publications to anchor current findings.`);
      } else {
        suggestions.push(`Strong temporal recency: ${recencyPercent}% of papers were published within the last 3 years.`);
      }

      if (evidenceCount === 0) {
        suggestions.push("No evidence claims extracted yet. Use AI chat or Evidence Map to synthesize key claims.");
      }

      if (notesCount === 0) {
        suggestions.push("No research notes created yet. Add notes to organize your insights.");
      }
    }

    if (suggestions.length === 0) {
      suggestions.push("Your research workspace is active and well-balanced!");
    }

    return reply.send({
      paperCount,
      readCount,
      coveragePercent,
      recencyPercent,
      evidenceCount,
      notesCount,
      datasetCount,
      suggestions,
    });
  });
}