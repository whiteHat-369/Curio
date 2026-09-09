import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import { citationExportQuerySchema, aiGenerateCitationSchema } from "../../lib/validation.js";
import { NotFoundError } from "../../lib/errors.js";
import type { Paper } from "@prisma/client";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";
import {
  formatCitationAPA,
  formatCitationIEEE,
  formatCitationBibTeX,
} from "../../lib/citations.js";

export async function citationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── Export citations ───────────────────────────────────────────
  app.get("/export", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const query = validate(citationExportQuerySchema, request.query as any);
    const { format, ids } = query;

    let papers: Paper[];
    if (ids) {
      const idList = ids.split(",").map((s) => s.trim());
      papers = await prisma.paper.findMany({
        where: { id: { in: idList }, workspaceId: wsId, deletedAt: null },
      });
    } else {
      papers = await prisma.paper.findMany({
        where: { workspaceId: wsId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
    }

    const citations = papers.map((paper) => {
      switch (format) {
        case "IEEE":
          return formatCitationIEEE(paper);
        case "BibTeX":
          return formatCitationBibTeX(paper);
        case "APA":
        default:
          return formatCitationAPA(paper);
      }
    });

    const separator = format === "BibTeX" ? "\n\n" : "\n";
    return reply.send({
      citations: citations.join(separator),
      format,
      count: citations.length,
    });
  });

  // ── AI-generate citations (bulk) ───────────────────────────────
  app.post("/ai-generate", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const { ids } = validate(aiGenerateCitationSchema, request.body);

    const papers = await prisma.paper.findMany({
      where: { id: { in: ids }, workspaceId: wsId, deletedAt: null },
    });
    if (papers.length !== ids.length) {
      throw new NotFoundError("Some papers not found");
    }

    // Stub: In Phase 3 this calls the LLM Gateway for smarter formatting
    const citations = papers.map((paper) => ({
      paperId: paper.id,
      citation: formatCitationAPA(paper),
      format: "APA" as const,
    }));

    return reply.send({ citations, aiGenerated: false });
  });
}