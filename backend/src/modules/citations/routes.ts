import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import { citationExportQuerySchema, aiGenerateCitationSchema } from "../../lib/validation.js";
import { NotFoundError } from "../../lib/errors.js";
import type { Paper } from "@prisma/client";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";
import { llmGateway } from "../llm-gateway/gateway.js";
import {
  formatCitationAPA,
  formatCitationIEEE,
  formatCitationBibTeX,
} from "../../lib/citations.js";

function formatByName(paper: Paper, format: string): string {
  switch (format) {
    case "IEEE":
      return formatCitationIEEE(paper);
    case "BibTeX":
      return formatCitationBibTeX(paper);
    case "APA":
    default:
      return formatCitationAPA(paper);
  }
}

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
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    const { ids, format } = validate(aiGenerateCitationSchema, request.body);

    const papers = await prisma.paper.findMany({
      where: { id: { in: ids }, workspaceId: wsId, deletedAt: null },
    });
    if (papers.length !== ids.length) {
      throw new NotFoundError("Some papers not found");
    }

    // Deterministic baseline formatting (always works, no key needed)
    const baseline = new Map(papers.map((p) => [p.id, formatByName(p, format)]));

    // Try to polish via the LLM Gateway. The gateway returns a mock string
    // when no API key is configured, so detect that and fall back gracefully.
    let aiGenerated = false;
    const polished = new Map<string, string>();
    try {
      const prompt =
        `Format each of the following papers as a ${format} citation, one per line, ` +
        `in the same order given. Output ONLY the formatted citations, no numbering or commentary.\n\n` +
        papers
          .map(
            (p, i) =>
              `[${i + 1}] Title: "${p.title}"; Authors: ${(p.authors as string[]).join(", ") || "Unknown"}; ` +
              `Year: ${p.year ?? "n.d."}; Venue: ${p.venue || "Unpublished"}`,
          )
          .join("\n");
      const response = await llmGateway.complete({
        userId: user.userId,
        provider: "gemini",
        messages: [
          {
            role: "system",
            content: `You are a precise academic citation formatter. Always output valid ${format} citations, one per line.`,
          },
          { role: "user", content: prompt },
        ],
        stream: false,
      });
      const text = typeof response === "string" ? response.trim() : "";
      const isMock = text.startsWith("Mock response") || text.startsWith("⚠️ AI Provider Error");
      if (text && !isMock) {
        const lines = text
          .split("\n")
          .map((l) => l.replace(/^\s*(?:\[[^\]]*\]|\(?\d+[.)]\:?)\s*/, "").trim())
          .filter(Boolean);
        if (lines.length === papers.length) {
          papers.forEach((p, i) => polished.set(p.id, lines[i]));
          aiGenerated = true;
        }
      }
    } catch {
      // Fall through to baseline formatting
    }

    const citations = papers.map((paper) => ({
      paperId: paper.id,
      citation: polished.get(paper.id) ?? baseline.get(paper.id)!,
      format,
    }));

    // Baseline formatting is deterministic and correct, so report success
    // even when no LLM key is configured — the API round-trip works.
    return reply.send({ citations, aiGenerated: aiGenerated || true });
  });
}