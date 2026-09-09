import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "./lib/prisma.js";
import { AppError, errorEnvelope } from "./lib/errors.js";
import { paperRoutes } from "./modules/papers/routes.js";
import { datasetRoutes } from "./modules/datasets/routes.js";
import { conversationRoutes } from "./modules/chat/routes.js";
import { citationRoutes } from "./modules/citations/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { workspaceRoutes } from "./modules/workspaces/routes.js";
import { evidenceRoutes } from "./modules/evidence/routes.js";
import { overviewRoutes } from "./modules/overview/routes.js";
import { noteRoutes } from "./modules/notes/routes.js";
import { internalRoutes } from "./internal/routes.js";
import { startCleanupWorker } from "./lib/cleanup-worker.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ────────────────────────────────────────────────────
  const allowedOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : true;

  await app.register(cors, {
    origin: allowedOrigin,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ── Global error handler ───────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as { validation?: unknown; statusCode?: number; code?: string; message?: string };
    
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(errorEnvelope(error));
    }

    // Fastify schema validation errors
    if (fastifyError.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: fastifyError.validation,
        },
      });
    }

    // Rate limit errors
    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      });
    }

    // Multipart or Payload Too Large (413)
    if (fastifyError.statusCode === 413 || fastifyError.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({
        error: {
          code: "FILE_TOO_LARGE",
          message: "Uploaded file exceeds maximum allowed size of 50MB",
        },
      });
    }

    // Other standard Fastify 4xx client errors
    if (fastifyError.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? "BAD_REQUEST",
          message: fastifyError.message || "Bad request",
        },
      });
    }

    // Server-side unexpected errors (500)
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });

  // ── Standard 404 handler ────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // ── Health & Readiness check ───────────────────────────────────
  app.get("/health", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.status(200).send({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return reply.status(503).send({
        status: "degraded",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── Public API routes ──────────────────────────────────────────
  await app.register(
    async (publicApi) => {
      // Track A — Auth
      await publicApi.register(authRoutes, { prefix: "/auth" });

      // Track A — Workspaces
      await publicApi.register(workspaceRoutes, { prefix: "/workspaces" });

      // Track A — Workspace-scoped: Evidence Map
      await publicApi.register(evidenceRoutes, { prefix: "/workspaces/:wsId/evidence" });

      // Track A — Workspace-scoped: Overview / Research Health
      await publicApi.register(overviewRoutes, { prefix: "/workspaces/:wsId/overview" });

      // Track A — Workspace-scoped: Notes
      await publicApi.register(noteRoutes, { prefix: "/workspaces/:wsId/notes" });

      // Track B — Papers, Datasets, Chat, Citations, Settings
      await publicApi.register(paperRoutes, { prefix: "/workspaces/:wsId/papers" });
      await publicApi.register(datasetRoutes, { prefix: "/workspaces/:wsId/datasets" });
      await publicApi.register(conversationRoutes, { prefix: "/workspaces/:wsId/conversations" });
      await publicApi.register(citationRoutes, { prefix: "/workspaces/:wsId/citations" });
      await publicApi.register(settingsRoutes, { prefix: "/settings" });
    },
    { prefix: "/api/v1" },
  );

  // ── Internal (service-to-service) routes ───────────────────────
  await app.register(internalRoutes, { prefix: "/internal" });

  return app;
}

async function start() {
  const app = await buildApp();

  // Start background workers
  startCleanupWorker();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   API:    http://${HOST}:${PORT}/api/v1`);
    
    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
      try {
        await app.close();
        await prisma.$disconnect();
        console.log("✅ Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("❌ Error during graceful shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };