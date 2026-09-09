import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validate,
  paginationSchema,
  signupSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  createEvidenceClaimSchema,
  createNoteSchema,
  refreshTokenSchema,
} from "./validation.js";
import { BadRequestError } from "./errors.js";

describe("validation utility", () => {
  it("should successfully validate valid data against a schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int(),
    });

    const validData = { name: "Alice", age: 30 };
    const result = validate(schema, validData);
    expect(result).toEqual(validData);
  });

  it("should throw a BadRequestError when validation fails", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().int(),
    });

    const invalidData = { name: "Alice", age: "thirty" };

    expect(() => validate(schema, invalidData)).toThrow(BadRequestError);
    try {
      validate(schema, invalidData);
    } catch (error: any) {
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Validation failed");
      expect(error.details).toBeDefined();
      expect(error.details.fieldErrors).toHaveProperty("age");
    }
  });

  describe("shared schemas", () => {
    it("should validate and coerce values in paginationSchema", () => {
      const data = { limit: "25", cursor: "some-uuid" };
      const result = validate(paginationSchema, data);
      expect(result.limit).toBe(25); // Coerced to number
      expect(result.cursor).toBe("some-uuid");
    });

    it("should set default values for paginationSchema", () => {
      const result = validate(paginationSchema, {});
      expect(result.limit).toBe(20);
      expect(result.cursor).toBeUndefined();
    });

    it("should fail validation for paginationSchema with out-of-bound limit", () => {
      expect(() => validate(paginationSchema, { limit: 0 })).toThrow(BadRequestError);
      expect(() => validate(paginationSchema, { limit: 101 })).toThrow(BadRequestError);
    });
  });

  describe("auth schemas", () => {
    it("should validate a correct signup request", () => {
      const validSignup = {
        email: "test@example.com",
        password: "securepassword123",
        name: "John Doe",
      };
      const result = validate(signupSchema, validSignup);
      expect(result).toEqual(validSignup);
    });

    it("should fail signup validation with invalid email format", () => {
      const invalidSignup = {
        email: "not-an-email",
        password: "securepassword123",
        name: "John Doe",
      };
      expect(() => validate(signupSchema, invalidSignup)).toThrow(BadRequestError);
    });

    it("should fail signup validation with short password", () => {
      const invalidSignup = {
        email: "test@example.com",
        password: "short",
        name: "John Doe",
      };
      expect(() => validate(signupSchema, invalidSignup)).toThrow(BadRequestError);
    });

    it("should validate refreshTokenSchema correctly", () => {
      expect(validate(refreshTokenSchema, { refreshToken: "valid-token-string" })).toEqual({
        refreshToken: "valid-token-string",
      });
      expect(() => validate(refreshTokenSchema, { refreshToken: "" })).toThrow(BadRequestError);
      expect(() => validate(refreshTokenSchema, {})).toThrow(BadRequestError);
    });
  });

  describe("workspace schemas", () => {
    it("should validate a valid workspace creation", () => {
      const result = validate(createWorkspaceSchema, {
        name: "Quantum Computing Lab",
        question: "What are the latest qubit benchmarks?",
      });
      expect(result.name).toBe("Quantum Computing Lab");
      expect(result.question).toBe("What are the latest qubit benchmarks?");
    });

    it("should enforce the 50-character limit on workspace names", () => {
      const over50 = "A".repeat(51);
      expect(() =>
        validate(createWorkspaceSchema, { name: over50 }),
      ).toThrow(BadRequestError);

      const exactly50 = "A".repeat(50);
      const result = validate(createWorkspaceSchema, { name: exactly50 });
      expect(result.name).toBe(exactly50);
    });

    it("should fail if workspace name is empty or only whitespace", () => {
      expect(() => validate(createWorkspaceSchema, { name: "   " })).toThrow(BadRequestError);
      expect(() => validate(createWorkspaceSchema, { name: "" })).toThrow(BadRequestError);
    });

    it("should validate updateWorkspaceSchema", () => {
      const result = validate(updateWorkspaceSchema, { name: "Updated Name" });
      expect(result.name).toBe("Updated Name");
      expect(() => validate(updateWorkspaceSchema, { name: "   " })).toThrow(BadRequestError);
    });
  });

  describe("evidence claim schemas", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("should validate valid evidence claims with union stances", () => {
      const stances = ["supports", "contradicts", "mixed"] as const;
      for (const stance of stances) {
        const result = validate(createEvidenceClaimSchema, {
          paperId: validUuid,
          question: "Does transformer scale linearly?",
          stance,
          summary: "Summary text",
          paragraph: "Detailed paragraph snippet from paper",
          confidence: 0.95,
        });
        expect(result.stance).toBe(stance);
        expect(result.confidence).toBe(0.95);
      }
    });

    it("should reject invalid stance types", () => {
      expect(() =>
        validate(createEvidenceClaimSchema, {
          paperId: validUuid,
          question: "Test question",
          stance: "neutral", // Not in union enum
          summary: "Summary text",
          paragraph: "Paragraph text",
        }),
      ).toThrow(BadRequestError);
    });
  });

  describe("note schemas", () => {
    const validUuid1 = "123e4567-e89b-12d3-a456-426614174000";
    const validUuid2 = "987e6543-e21b-12d3-a456-426614174000";

    it("should validate createNoteSchema with tags and paperIds", () => {
      const result = validate(createNoteSchema, {
        title: "Meeting Notes",
        body: "Discussed research progress",
        group: "Sprint 1",
        tags: ["ai", "benchmark", "nlp"],
        paperIds: [validUuid1, validUuid2],
      });
      expect(result.title).toBe("Meeting Notes");
      expect(result.tags).toEqual(["ai", "benchmark", "nlp"]);
      expect(result.paperIds).toHaveLength(2);
    });

    it("should reject invalid paperId UUIDs in note schema", () => {
      expect(() =>
        validate(createNoteSchema, {
          title: "Invalid Note",
          tags: ["test"],
          paperIds: ["not-a-valid-uuid"],
        }),
      ).toThrow(BadRequestError);
    });
  });
});
