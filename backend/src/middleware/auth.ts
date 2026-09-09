import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../lib/errors.js";

export interface AuthUser {
  userId: string;
  email: string;
}

const JWT_SECRET = () => process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const JWT_ISSUER = () => process.env.JWT_ISSUER ?? "curio-api";

export function verifyToken(req: FastifyRequest): AuthUser {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]?.trim()) {
    throw new UnauthorizedError("Invalid authorization header format. Expected 'Bearer <token>'");
  }

  const token = match[1].trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET(), {
      issuer: JWT_ISSUER(),
    }) as jwt.JwtPayload;

    if (!payload.sub || typeof payload.sub !== "string" || !payload.email || typeof payload.email !== "string") {
      throw new UnauthorizedError("Invalid token payload");
    }

    return {
      userId: payload.sub,
      email: payload.email,
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token expired");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token signature or payload");
    }
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("Authentication failed");
  }
}

// Fastify hook wrapper
export async function authHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = verifyToken(request);
  (request as any).user = user;
}

// Extract user from request (set by authHook)
export function getUser(request: FastifyRequest): AuthUser {
  const user = (request as any).user as AuthUser | undefined;
  if (!user) {
    throw new UnauthorizedError("Not authenticated");
  }
  return user;
}