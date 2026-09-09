import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
  paginationSchema,
} from "../../lib/validation.js";
import { NotFoundError, BadRequestError } from "../../lib/errors.js";
import { llmGateway } from "../llm-gateway/gateway.js";
import { uploadFile } from "../../lib/s3.js";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── List conversations ─────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    const conversations = await prisma.conversation.findMany({
      where: { workspaceId: wsId },
      orderBy: { updatedAt: "desc" },
    });

    // Group by group
    const grouped: Record<string, typeof conversations> = {};
    const ungrouped: typeof conversations = [];
    for (const conv of conversations) {
      if (conv.group) {
        if (!grouped[conv.group]) grouped[conv.group] = [];
        grouped[conv.group].push(conv);
      } else {
        ungrouped.push(conv);
      }
    }

    return reply.send({ grouped, ungrouped });
  });

  // ── Create conversation ────────────────────────────────────────
  app.post("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };
    const data = validate(createConversationSchema, request.body);

    const conversation = await prisma.conversation.create({
      data: {
        workspaceId: wsId,
        title: data.title ?? "New conversation",
        group: data.group ?? null,
      },
    });

    return reply.status(201).send(conversation);
  });

  // ── Update conversation ────────────────────────────────────────
  app.patch("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };
    const data = validate(updateConversationSchema, request.body);

    const existing = await prisma.conversation.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!existing) {
      throw new NotFoundError("Conversation not found");
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data,
    });

    return reply.send(conversation);
  });

  // ── Delete conversation ────────────────────────────────────────
  app.delete("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const existing = await prisma.conversation.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!existing) {
      throw new NotFoundError("Conversation not found");
    }

    await prisma.conversation.delete({ where: { id } });

    return reply.status(204).send();
  });

  // ── List messages (paginated) ──────────────────────────────────
  app.get("/:id/messages", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };
    const query = validate(paginationSchema, request.query as any);
    const { cursor, limit } = query;
    const pageSize = limit ?? 20;

    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    const findArgs: Parameters<typeof prisma.chatMessage.findMany>[0] = {
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
    }

    const messages = await prisma.chatMessage.findMany(findArgs);

    const hasMore = messages.length > pageSize;
    const items = hasMore ? messages.slice(0, pageSize) : messages;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return reply.send({ items, nextCursor });
  });

  // ── Send message ───────────────────────────────────────────────
  app.post("/:id/messages", async (request, reply) => {
    const user = getUser(request);
    const { wsId, id } = request.params as { wsId: string; id: string };
    const data = validate(sendMessageSchema, request.body);

    const conversation = await prisma.conversation.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        conversationId: id,
        role: "user",
        content: data.content,
        external: data.includeExternal,
        attachmentKeys: data.attachments ?? [],
      },
    });

    // Fetch workspace papers and context for grounded answers
    const [workspace, papers, recentMessages] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: wsId } }),
      prisma.paper.findMany({
        where: { workspaceId: wsId, deletedAt: null },
        take: 20,
        select: { id: true, title: true, authors: true, year: true, venue: true, abstract: true },
      }),
      prisma.chatMessage.findMany({
        where: { conversationId: id, id: { not: userMessage.id } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const paperSummaries = papers
      .map(
        (p) =>
          `- Title: "${p.title}" (${p.year ?? "n.d."}, ${p.venue ?? "Publication"})\n  Authors: ${p.authors.join(", ") || "Unknown"}${
            p.abstract ? `\n  Abstract: ${p.abstract.slice(0, 300)}...` : ""
          }`,
      )
      .join("\n\n");

    const systemPrompt = [
      `You are Curio AI, an intelligent, rigorous academic research assistant.`,
      `Workspace Name: "${workspace?.name ?? "Research Workspace"}"`,
      `Workspace Focus / Question: "${workspace?.question ?? "Academic Literature Review"}"`,
      papers.length > 0
        ? `Here are papers currently saved in this workspace:\n${paperSummaries}`
        : `Currently, no papers are saved in this workspace. Answer based on broad scientific literature.`,
      `Provide well-reasoned, concise, evidence-based answers. Cite relevant papers by title and author when applicable. Format your answers clearly using markdown.`,
    ].join("\n\n");

    // Reconstruct chronological message history
    const orderedHistory = recentMessages.reverse().map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

    const messagesToSend = [
      { role: "system" as const, content: systemPrompt },
      ...orderedHistory,
      { role: "user" as const, content: data.content },
    ];

    // Call LLM Gateway (defaults to Gemini if not specified)
    const result = await llmGateway.complete({
      userId: user.userId,
      provider: (data.model as "openai" | "gemini" | "grok") ?? "gemini",
      messages: messagesToSend,
      stream: false,
    });

    // Extract text response
    let content = "";
    if (typeof result === "string") {
      content = result;
    } else {
      for await (const chunk of result) {
        content += chunk;
      }
    }

    // Save assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: content || "I was unable to generate a response. Please check your model configuration.",
        sources: [],
        followups: [],
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return reply.status(201).send({
      userMessage,
      assistantMessage,
    });
  });

  // ── Upload message attachments ─────────────────────────────────
  app.post("/:id/messages/:msgId/attachments", async (request, reply) => {
    const { wsId, id, msgId } = request.params as {
      wsId: string;
      id: string;
      msgId: string;
    };

    const message = await prisma.chatMessage.findFirst({
      where: { id: msgId, conversationId: id, conversation: { workspaceId: wsId } },
    });
    if (!message) {
      throw new NotFoundError("Message not found");
    }

    const file = await request.file();
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    const attachmentKey = `chat/${wsId}/${msgId}/${file.filename}`;
    await uploadFile(attachmentKey, file.file, file.mimetype);

    await prisma.chatMessage.update({
      where: { id: msgId },
      data: {
        attachmentKeys: [...message.attachmentKeys, attachmentKey],
      },
    });

    return reply.status(201).send({ attachmentKey });
  });
}