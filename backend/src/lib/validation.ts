import { z } from "zod";
import { BadRequestError } from "./errors.js";

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestError("Validation failed", result.error.flatten());
  }
  return result.data;
}

// ── Shared schemas ──────────────────────────────────────────────

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const workspaceIdSchema = z.object({
  wsId: z.string().uuid(),
});

export const paperIdSchema = z.object({
  id: z.string().uuid(),
});

export const datasetIdSchema = z.object({
  id: z.string().uuid(),
});

export const conversationIdSchema = z.object({
  id: z.string().uuid(),
});

export const messageIdSchema = z.object({
  id: z.string().uuid(),
  msgId: z.string().uuid(),
});

export const createAnnotationSchema = z.object({
  text: z.string().trim().min(1, "Text is required"),
});

// ── Paper schemas ───────────────────────────────────────────────

export const paperStatusEnum = z.enum(["unread", "reading", "read"]);

export const paperSortEnum = z.enum(["added", "year", "author"]);

export const paperListQuerySchema = paginationSchema.extend({
  year: z.coerce.number().int().optional(),
  status: paperStatusEnum.optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  sort: paperSortEnum.optional().default("added"),
});

export const createPaperSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim()).default([]),
  year: z.number().int().min(1900).max(2100).default(new Date().getFullYear()),
  venue: z.string().default(""),
  status: paperStatusEnum.default("unread"),
  tags: z.array(z.string().trim().max(100)).default([]),
  group: z.string().max(100).nullable().optional(),
  abstract: z.string().default(""),
  methodology: z.string().default(""),
  dataset: z.string().default(""),
  results: z.string().default(""),
  limitations: z.string().default(""),
  keywords: z.array(z.string().trim()).default([]),
});

export const updatePaperSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  authors: z.array(z.string().trim()).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  venue: z.string().optional(),
  status: paperStatusEnum.optional(),
  tags: z.array(z.string().trim().max(100)).optional(),
  group: z.string().max(100).nullable().optional(),
  abstract: z.string().optional(),
  methodology: z.string().optional(),
  dataset: z.string().optional(),
  results: z.string().optional(),
  limitations: z.string().optional(),
  keywords: z.array(z.string().trim()).optional(),
  pinned: z.boolean().optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const bulkTagSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  tags: z.array(z.string().trim().min(1)).min(1),
});

export const bulkGroupSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  group: z.string().max(100).nullable(),
});

export const addTagSchema = z.object({
  tag: z.string().trim().min(1).max(100),
});

export const citationFormatEnum = z.enum(["APA", "IEEE", "BibTeX"]);

// ── Dataset schemas ─────────────────────────────────────────────

export const updateDatasetSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
});

// ── Conversation schemas ────────────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(500).default("New conversation"),
  group: z.string().max(100).nullable().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  group: z.string().max(100).nullable().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message content cannot be empty"),
  model: z.enum(["openai", "gemini", "grok"]).default("gemini"),
  includeExternal: z.boolean().default(false),
  attachments: z.array(z.string()).optional(),
});

// ── Citation schemas ────────────────────────────────────────────

export const citationExportQuerySchema = z.object({
  format: citationFormatEnum.default("APA"),
  ids: z.string().optional(), // comma-separated UUIDs
});

export const aiGenerateCitationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  format: citationFormatEnum.optional().default("APA"),
});

// ── Settings schemas ────────────────────────────────────

export const putApiKeySchema = z.object({
  value: z.string().trim().min(1, "API key value cannot be empty"),
});

export const preferencesSchema = z.object({
  defaultModel: z.enum(["openai", "gemini", "grok"]).optional(),
  defaultIncludeExternal: z.boolean().optional(),
  defaultCiteFormat: citationFormatEnum.optional(),
  reduceMotion: z.boolean().optional(),
  accent: z.string().optional(),
});

// ── Auth schemas ────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

export const onboardingSchema = z.object({
  field: z.string().trim().min(1).max(200),
  affiliation: z.string().trim().min(1).max(200),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  mobile: z.string().trim().max(20).optional(),
  field: z.string().trim().max(200).optional(),
  affiliation: z.string().trim().max(200).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account"),
});

// ── Workspace schemas ───────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(50, "Workspace name cannot exceed 50 characters"),
  question: z.string().max(1000).default(""),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name cannot be empty").max(50, "Workspace name cannot exceed 50 characters").optional(),
  question: z.string().max(1000).optional(),
});

export const recentWorkspacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

// ── Evidence Claim schemas ──────────────────────────────────────

export const stanceEnum = z.enum(["supports", "contradicts", "mixed"]);

export const evidenceListQuerySchema = paginationSchema.extend({
  stance: stanceEnum.optional(),
});

export const createEvidenceClaimSchema = z.object({
  paperId: z.string().uuid("Invalid paper UUID"),
  question: z.string().trim().min(1, "Question is required").max(1000),
  stance: stanceEnum,
  summary: z.string().trim().min(1, "Summary is required").max(5000),
  paragraph: z.string().trim().min(1, "Paragraph is required").max(10000),
  confidence: z.number().min(0).max(1).default(0),
});

// ── Note schemas ────────────────────────────────────────────────

export const noteListQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  groupBy: z.enum(["group"]).optional(),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Note title is required").max(500),
  body: z.string().default(""),
  group: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().max(100)).default([]),
  paperIds: z.array(z.string().uuid()).default([]),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  body: z.string().optional(),
  group: z.string().trim().max(100).nullable().optional(),
  tags: z.array(z.string().trim().max(100)).optional(),
  paperIds: z.array(z.string().uuid()).optional(),
});

export const bulkGroupNotesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  group: z.string().trim().max(100).nullable(),
});

export const addNoteTagSchema = z.object({
  tag: z.string().trim().min(1).max(100),
});

export const renameTagSchema = z.object({
  tag: z.string().trim().min(1).max(100),
});

// ── Internal schemas ────────────────────────────────────────────

export const internalPapersBulkLookupSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});
