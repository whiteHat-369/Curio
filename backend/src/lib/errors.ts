export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", details?: unknown) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class ApiKeyMissingError extends AppError {
  constructor(provider: string) {
    super(402, "API_KEY_MISSING", `No API key configured for ${provider}. Please add one in Settings.`);
  }
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorEnvelope(error: AppError | { code: string; message: string; details?: unknown }): ErrorEnvelope {
  const code = error.code || "INTERNAL_ERROR";
  const message = error.message || "An unexpected error occurred";
  return {
    error: {
      code,
      message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
}