import { describe, it, expect } from "vitest";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ApiKeyMissingError,
  errorEnvelope,
} from "./errors.js";

describe("error classes and envelope formatting", () => {
  it("should create BadRequestError with code BAD_REQUEST and 400 status", () => {
    const err = new BadRequestError("Invalid input parameters", { field: "name" });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input parameters");
    expect(err.details).toEqual({ field: "name" });

    const envelope = errorEnvelope(err);
    expect(envelope).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid input parameters",
        details: { field: "name" },
      },
    });
  });

  it("should create UnauthorizedError with 401 status", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");

    const envelope = errorEnvelope(err);
    expect(envelope).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Token expired",
      },
    });
  });

  it("should create ForbiddenError with 403 status", () => {
    const err = new ForbiddenError("You do not have access to this workspace");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");

    const envelope = errorEnvelope(err);
    expect(envelope).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this workspace",
      },
    });
  });

  it("should create NotFoundError with 404 status", () => {
    const err = new NotFoundError("Workspace not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");

    const envelope = errorEnvelope(err);
    expect(envelope).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Workspace not found",
      },
    });
  });

  it("should create ConflictError with 409 status", () => {
    const err = new ConflictError("Email already registered");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");

    const envelope = errorEnvelope(err);
    expect(envelope).toEqual({
      error: {
        code: "CONFLICT",
        message: "Email already registered",
      },
    });
  });

  it("should create ApiKeyMissingError with 402 status", () => {
    const err = new ApiKeyMissingError("openai");
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe("API_KEY_MISSING");
    expect(err.message).toContain("openai");
  });

  it("should correctly envelope custom error objects without details", () => {
    const envelope = errorEnvelope({
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    });
    expect(envelope).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
      },
    });
  });
});
