import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import { putApiKeySchema, preferencesSchema } from "../../lib/validation.js";
import { NotFoundError, BadRequestError } from "../../lib/errors.js";
import { encrypt } from "../../lib/crypto.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", authHook);

  // ── List API keys (scopes only, never plaintext) ───────────────
  app.get("/api-keys", async (request, reply) => {
    const user = getUser(request);

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: user.userId },
      select: {
        scope: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const configured = apiKeys.map((key) => ({
      scope: key.scope,
      configured: true,
      createdAt: key.createdAt,
    }));

    // Include known scopes and any custom database scopes
    const knownScopes = ["model:openai", "model:gemini", "model:grok"];
    const configuredScopes = new Set(configured.map((k) => k.scope));
    const allScopes = [
      ...configured,
      ...knownScopes
        .filter((scope) => !configuredScopes.has(scope))
        .map((scope) => ({ scope, configured: false, createdAt: null })),
    ];

    return reply.send(allScopes);
  });

  // ── Upsert API key ─────────────────────────────────────────────
  app.put("/api-keys/:scope", async (request, reply) => {
    const user = getUser(request);
    const { scope } = request.params as { scope: string };
    const { value } = validate(putApiKeySchema, request.body);

    const validScopes = ["model:openai", "model:gemini", "model:grok"];
    if (!validScopes.includes(scope) && !scope.startsWith("db:")) {
      throw new BadRequestError(`Invalid scope: ${scope}. Allowed scopes: ${validScopes.join(", ")}`);
    }

    const ciphertext = encrypt(value);

    const existing = await prisma.apiKey.findFirst({
      where: { userId: user.userId, scope },
      select: { id: true },
    });

    if (existing) {
      await prisma.apiKey.update({
        where: { id: existing.id },
        data: { ciphertext },
      });
    } else {
      await prisma.apiKey.create({
        data: {
          userId: user.userId,
          scope,
          ciphertext,
        },
      });
    }

    return reply.send({ scope, configured: true });
  });

  // ── Delete API key ─────────────────────────────────────────────
  app.delete("/api-keys/:scope", async (request, reply) => {
    const user = getUser(request);
    const { scope } = request.params as { scope: string };

    const existing = await prisma.apiKey.findFirst({
      where: { userId: user.userId, scope },
    });
    if (!existing) {
      throw new NotFoundError("API key not found");
    }

    await prisma.apiKey.delete({ where: { id: existing.id } });

    return reply.status(204).send();
  });

  // ── Get preferences ────────────────────────────────────────────
  app.get("/preferences", async (request, reply) => {
    getUser(request);

    // Read preferences defaults (or User preferences column in production)
    const defaultPreferences = {
      defaultModel: "gemini",
      defaultIncludeExternal: false,
      defaultCiteFormat: "APA",
      reduceMotion: false,
      accent: "blue",
    };

    return reply.send(defaultPreferences);
  });

  // ── Update preferences ─────────────────────────────────────────
  app.patch("/preferences", async (request, reply) => {
    getUser(request);
    const data = validate(preferencesSchema, request.body);

    return reply.send({
      ...data,
      updated: true,
    });
  });
}