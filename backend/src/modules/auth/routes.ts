import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  onboardingSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from "../../lib/validation.js";
import { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } from "../../lib/errors.js";

const JWT_SECRET = () => process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_ISSUER = () => process.env.JWT_ISSUER ?? "curio-api";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;
const scryptAsync = promisify(crypto.scrypt);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("scrypt$")) {
    return crypto.createHash("sha256").update(password).digest("hex") === stored;
  }
  const [, salt, expectedHex] = stored.split("$");
  const actual = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function generateAccessToken(user: { id: string; email: string }): string {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET(),
    { issuer: JWT_ISSUER(), expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

async function generateRefreshToken(userId: string): Promise<string> {
  // Prune expired tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });

  const raw = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return raw;
}

async function rotateRefreshToken(rawToken: string): Promise<{ userId: string; newRefreshToken: string }> {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { id: stored.id } });
    throw new UnauthorizedError("Refresh token expired");
  }

  // Atomically delete the old token and generate a new one
  const newRaw = crypto.randomBytes(64).toString("hex");
  const newTokenHash = hashToken(newRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: stored.id } }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: newTokenHash,
        expiresAt,
      },
    }),
  ]);

  return { userId: stored.userId, newRefreshToken: newRaw };
}

async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

// ── Email dispatch stub (integrate with SendGrid/SES/Resend in production) ──
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`[EMAIL] To: ${to}, Subject: ${subject}, Body: ${body}`);
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── Signup ──────────────────────────────────────────────────────
  app.post("/signup", async (request, reply) => {
    const { email, password, name } = validate(signupSchema, request.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    // Create email verification token (24 hours expiry)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendEmail(
      email,
      "Verify your email",
      `Your verification token: ${rawToken}`,
    );

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  });

  // ── Login ───────────────────────────────────────────────────────
  app.post("/login", async (request, reply) => {
    const { email, password } = validate(loginSchema, request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Upgrade legacy password hashes to scrypt if needed
    if (!user.passwordHash.startsWith("scrypt$")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user.id);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        field: user.field,
        affiliation: user.affiliation,
        onboardedAt: user.onboardedAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      accessToken,
      refreshToken,
    });
  });

  // ── Logout ──────────────────────────────────────────────────────
  app.post("/logout", async (request, reply) => {
    const refreshHeader = request.headers["x-refresh-token"] as string | undefined;
    if (refreshHeader) {
      await revokeRefreshToken(refreshHeader);
    }
    return reply.status(204).send();
  });

  // ── Refresh token ───────────────────────────────────────────────
  app.post("/refresh", async (request, reply) => {
    const { refreshToken: rawToken } = validate(refreshTokenSchema, request.body);

    const { userId, newRefreshToken } = await rotateRefreshToken(rawToken);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    const accessToken = generateAccessToken(user);

    return reply.send({
      accessToken,
      refreshToken: newRefreshToken,
    });
  });

  // ── Forgot password ─────────────────────────────────────────────
  app.post("/forgot-password", async (request, reply) => {
    const { email } = validate(forgotPasswordSchema, request.body);

    // Always return 200 to prevent email enumeration attacks
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      await sendEmail(email, "Reset your password", `Your reset token: ${rawToken}`);
    }

    return reply.send({ message: "If the email exists, a reset link has been sent" });
  });

  // ── Reset password ──────────────────────────────────────────────
  app.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = validate(resetPasswordSchema, request.body);
    const tokenHash = hashToken(token);

    const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return reply.send({ message: "Password reset successfully" });
  });

  // ── Verify email ────────────────────────────────────────────────
  app.post("/verify-email", async (request, reply) => {
    const { token } = validate(verifyEmailSchema, request.body);
    const tokenHash = hashToken(token);

    const stored = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new BadRequestError("Invalid or expired verification token");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.delete({ where: { id: stored.id } }),
    ]);

    return reply.send({ message: "Email verified successfully" });
  });

  // ── Resend verification email ───────────────────────────────────
  app.post("/resend-verification", async (request, reply) => {
    const { email } = validate(resendVerificationSchema, request.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      // Invalidate existing tokens
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await sendEmail(email, "Verify your email", `Your verification token: ${rawToken}`);
    }

    return reply.send({ message: "If the email exists, a verification email has been sent" });
  });

  // ── Onboarding ──────────────────────────────────────────────────
  app.post("/onboarding", { preHandler: [authHook] }, async (request, reply) => {
    const user = getUser(request);
    const { field, affiliation } = validate(onboardingSchema, request.body);

    await prisma.user.update({
      where: { id: user.userId },
      data: { field, affiliation, onboardedAt: new Date() },
    });

    return reply.send({ message: "Onboarding completed" });
  });

  // ── Get current user ────────────────────────────────────────────
  app.get("/me", { preHandler: [authHook] }, async (request, reply) => {
    const authUser = getUser(request);
    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) throw new NotFoundError("User not found");

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      field: user.field,
      affiliation: user.affiliation,
      emailVerifiedAt: user.emailVerifiedAt,
      onboardedAt: user.onboardedAt,
      createdAt: user.createdAt,
    });
  });

  // ── Update current user ─────────────────────────────────────────
  app.patch("/me", { preHandler: [authHook] }, async (request, reply) => {
    const authUser = getUser(request);
    const data = validate(updateProfileSchema, request.body);

    const user = await prisma.user.update({
      where: { id: authUser.userId },
      data,
    });

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      field: user.field,
      affiliation: user.affiliation,
    });
  });

  // ── Change password ─────────────────────────────────────────────
  app.post("/me/password", { preHandler: [authHook] }, async (request, reply) => {
    const authUser = getUser(request);
    const { currentPassword, newPassword } = validate(changePasswordSchema, request.body);

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) throw new NotFoundError("User not found");

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // Invalidate all other sessions; keep the caller logged in with a fresh token
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    const refreshToken = await generateRefreshToken(user.id);
    const accessToken = generateAccessToken(user);

    return reply.send({ message: "Password updated", accessToken, refreshToken });
  });

  // ── Delete account (password-confirmed, cascades all user data) ──
  app.delete("/me", { preHandler: [authHook] }, async (request, reply) => {
    const authUser = getUser(request);
    const { password } = validate(deleteAccountSchema, request.body);

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user) throw new NotFoundError("User not found");

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Password is incorrect");
    }

    const workspaces = await prisma.workspace.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });
    const wsIds = workspaces.map((w) => w.id);

    const conversations = wsIds.length > 0
      ? await prisma.conversation.findMany({
          where: { workspaceId: { in: wsIds } },
          select: { id: true },
        })
      : [];
    const convIds = conversations.map((c) => c.id);

    await prisma.$transaction([
      // Chat (messages cascade from conversations, but delete explicitly for safety)
      ...(convIds.length > 0
        ? [
            prisma.chatMessage.deleteMany({ where: { conversationId: { in: convIds } } }),
            prisma.conversation.deleteMany({ where: { id: { in: convIds } } }),
          ]
        : []),
      // Papers (summaries + annotations cascade from papers)
      ...(wsIds.length > 0
        ? [
            prisma.annotation.deleteMany({ where: { paper: { workspaceId: { in: wsIds } } } }),
            prisma.paperSummary.deleteMany({ where: { paper: { workspaceId: { in: wsIds } } } }),
            prisma.paper.deleteMany({ where: { workspaceId: { in: wsIds } } }),
            prisma.dataset.deleteMany({ where: { workspaceId: { in: wsIds } } }),
            prisma.evidenceClaim.deleteMany({ where: { workspaceId: { in: wsIds } } }),
            prisma.note.deleteMany({ where: { workspaceId: { in: wsIds } } }),
            prisma.workspace.deleteMany({ where: { id: { in: wsIds } } }),
          ]
        : []),
      // Account-scoped records
      prisma.apiKey.deleteMany({ where: { userId: user.id } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    return reply.status(204).send();
  });
}