/**
 * API Client — connects the frontend to the backend server at http://localhost:3001
 * All requests go through this module. It handles auth tokens, error envelopes,
 * and provides typed response helpers.
 */

// ── Config ──────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3001/api/v1";
const INTERNAL_BASE = (import.meta.env.VITE_INTERNAL_BASE as string) || "http://localhost:3001/internal";

const ACCESS_TOKEN_KEY = "curio_access_token";
const REFRESH_TOKEN_KEY = "curio_refresh_token";

let authToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

// ── Token management ─────────────────────────────────────────────

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {}
}

export function setRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {}
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  try {
    const stored = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) {
      authToken = stored;
      return stored;
    }
  } catch {}
  return null;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearTokens() {
  authToken = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export async function refreshTokens(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        return null;
      }
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setAuthToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      return data.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ── Fetch wrapper ────────────────────────────────────────────────

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    public error: ApiError,
  ) {
    super(error.message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: { isInternal?: boolean; rawResponse?: boolean; signal?: AbortSignal; retryAuth?: boolean },
): Promise<T> {
  const base = options?.isInternal ? INTERNAL_BASE : API_BASE;
  const url = `${base}${path}`;

  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: options?.signal,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (options?.rawResponse) {
    return response as unknown as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Handle 401 token expiry retry (except for auth credentials routes)
  if (
    response.status === 401 &&
    options?.retryAuth !== false &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/signup") &&
    !path.startsWith("/auth/refresh")
  ) {
    const newToken = await refreshTokens();
    if (newToken) {
      return request<T>(method, path, body, { ...options, retryAuth: false });
    }
  }

  const data = await response.json();

  if (!response.ok) {
    const err = data as { error?: ApiError };
    throw new ApiRequestError(
      response.status,
      err.error ?? { code: "UNKNOWN", message: "An unknown error occurred" },
    );
  }

  return data as T;
}

// ── Upload helper (multipart) ────────────────────────────────────

async function uploadFile<T>(
  method: string,
  path: string,
  file: File,
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const err = data as { error?: ApiError };
    throw new ApiRequestError(
      response.status,
      err.error ?? { code: "UNKNOWN", message: "Upload failed" },
    );
  }

  return data as T;
}

// ── Workspaces API ───────────────────────────────────────────────

export interface WorkspaceDTO {
  id: string;
  name: string;
  question: string;
  progress?: number;
  paperCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const workspacesApi = {
  list: (options?: { signal?: AbortSignal }) =>
    request<{ items: WorkspaceDTO[] }>("GET", "/workspaces", undefined, options),

  recent: (limit = 5, options?: { signal?: AbortSignal }) =>
    request<{ items: WorkspaceDTO[] }>("GET", `/workspaces/recent?limit=${limit}`, undefined, options),

  get: (id: string, options?: { signal?: AbortSignal }) =>
    request<WorkspaceDTO>("GET", `/workspaces/${id}`, undefined, options),

  create: (data: { name: string; question?: string }) =>
    request<WorkspaceDTO>("POST", "/workspaces", data),

  update: (id: string, data: { name?: string; question?: string }) =>
    request<WorkspaceDTO>("PATCH", `/workspaces/${id}`, data),

  delete: (id: string) =>
    request<void>("DELETE", `/workspaces/${id}`),
};

// ── Evidence API ─────────────────────────────────────────────────

export interface EvidenceClaimDTO {
  id: string;
  workspaceId: string;
  paperId: string;
  paperTitle?: string | null;
  question: string;
  stance: "supports" | "contradicts" | "mixed";
  summary: string;
  paragraph: string;
  confidence: number;
  createdAt: string;
}

export interface QuestionCountsDTO {
  question: string;
  supports: number;
  contradicts: number;
  mixed: number;
  total: number;
}

export const evidenceApi = {
  list: (wsId: string, params?: { stance?: string; cursor?: string; limit?: number }, options?: { signal?: AbortSignal }) => {
    const query = new URLSearchParams();
    if (params?.stance) query.set("stance", params.stance);
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<{ items: EvidenceClaimDTO[]; nextCursor: string | null }>(
      "GET", `/workspaces/${wsId}/evidence${qs ? `?${qs}` : ""}`, undefined, options,
    );
  },

  getQuestions: (wsId: string, options?: { signal?: AbortSignal }) =>
    request<{ items: QuestionCountsDTO[] }>("GET", `/workspaces/${wsId}/evidence/questions`, undefined, options),

  create: (wsId: string, data: { paperId: string; question: string; stance: string; summary: string; paragraph: string; confidence?: number }) =>
    request<EvidenceClaimDTO>("POST", `/workspaces/${wsId}/evidence`, data),

  delete: (wsId: string, id: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/evidence/${id}`),
};

// ── Notes API ────────────────────────────────────────────────────

export interface NoteDTO {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  group?: string | null;
  tags: string[];
  paperIds: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const notesApi = {
  list: (wsId: string, params?: { q?: string; groupBy?: string; cursor?: string; limit?: number }, options?: { signal?: AbortSignal }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.groupBy) query.set("groupBy", params.groupBy);
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<{ items?: NoteDTO[]; groups?: Record<string, NoteDTO[]>; nextCursor: string | null }>(
      "GET", `/workspaces/${wsId}/notes${qs ? `?${qs}` : ""}`, undefined, options,
    );
  },

  create: (wsId: string, data: { title: string; body?: string; group?: string | null; tags?: string[]; paperIds?: string[] }) =>
    request<NoteDTO>("POST", `/workspaces/${wsId}/notes`, data),

  update: (wsId: string, id: string, data: { title?: string; body?: string; group?: string | null; tags?: string[]; paperIds?: string[] }) =>
    request<NoteDTO>("PATCH", `/workspaces/${wsId}/notes/${id}`, data),

  delete: (wsId: string, id: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/notes/${id}`),

  restore: (wsId: string, id: string) =>
    request<NoteDTO>("POST", `/workspaces/${wsId}/notes/${id}/restore`),

  bulkGroup: (wsId: string, ids: string[], group: string | null) =>
    request<void>("POST", `/workspaces/${wsId}/notes/bulk/group`, { ids, group }),

  addTag: (wsId: string, id: string, tag: string) =>
    request<void>("POST", `/workspaces/${wsId}/notes/${id}/tags`, { tag }),

  removeTag: (wsId: string, id: string, tag: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/notes/${id}/tags/${tag}`),

  renameTag: (wsId: string, tag: string, newTag: string) =>
    request<void>("PATCH", `/workspaces/${wsId}/notes/tags/${tag}`, { tag: newTag }),
};

// ── Overview API ─────────────────────────────────────────────────

export interface OverviewDTO {
  question: string;
  stats: {
    paperCount: number;
    readCount: number;
    progress: number;
  };
  recentPapers: Array<{
    id: string;
    title: string;
    authors: string[];
    year: number;
    status: string;
  }>;
}

export interface ResearchHealthDTO {
  paperCount: number;
  readCount: number;
  coveragePercent: number;
  recencyPercent: number;
  evidenceCount: number;
  notesCount: number;
  datasetCount: number;
  suggestions: string[];
}

export const overviewApi = {
  getOverview: (wsId: string, options?: { signal?: AbortSignal }) =>
    request<OverviewDTO>("GET", `/workspaces/${wsId}/overview`, undefined, options),

  getHealth: (wsId: string, options?: { signal?: AbortSignal }) =>
    request<ResearchHealthDTO>("GET", `/workspaces/${wsId}/overview/health`, undefined, options),
};

// ── Papers API ───────────────────────────────────────────────────

export interface PaperDTO {
  id: string;
  workspaceId: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  status: "unread" | "reading" | "read";
  tags: string[];
  group: string | null;
  abstract: string;
  methodology: string;
  dataset: string;
  results: string;
  limitations: string;
  keywords: string[];
  fileKey: string | null;
  pinned: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string | null;
  summary?: PaperSummaryDTO | null;
}

export interface PaperSummaryDTO {
  paperId: string;
  intro: string;
  methodology: string;
  result: string;
  limitations: string;
  generatedAt: string;
}

export interface AnnotationDTO {
  id: string;
  paperId: string;
  text: string;
  createdAt: string;
}

export const papersApi = {
  list: (wsId: string, params?: { year?: number | string; status?: string; tag?: string; q?: string; sort?: string; cursor?: string; limit?: number }, options?: { signal?: AbortSignal }) => {
    const query = new URLSearchParams();
    if (params?.year !== undefined) query.set("year", String(params.year));
    if (params?.status) query.set("status", params.status);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.q) query.set("q", params.q);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<{ items: PaperDTO[]; nextCursor: string | null }>(
      "GET", `/workspaces/${wsId}/papers${qs ? `?${qs}` : ""}`,
      undefined,
      options,
    );
  },

  upload: (wsId: string, file: File) =>
    uploadFile<PaperDTO>("POST", `/workspaces/${wsId}/papers/upload`, file),

  get: (wsId: string, id: string) =>
    request<PaperDTO>("GET", `/workspaces/${wsId}/papers/${id}`),

  update: (wsId: string, id: string, data: Record<string, unknown>) =>
    request<PaperDTO>("PATCH", `/workspaces/${wsId}/papers/${id}`, data),

  delete: (wsId: string, id: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/papers/${id}`),

  restore: (wsId: string, id: string) =>
    request<PaperDTO>("POST", `/workspaces/${wsId}/papers/${id}/restore`),

  bulkDelete: (wsId: string, ids: string[]) =>
    request<void>("POST", `/workspaces/${wsId}/papers/bulk/delete`, { ids }),

  bulkTag: (wsId: string, ids: string[], tags: string[]) =>
    request<void>("POST", `/workspaces/${wsId}/papers/bulk/tag`, { ids, tags }),

  bulkGroup: (wsId: string, ids: string[], group: string | null) =>
    request<void>("POST", `/workspaces/${wsId}/papers/bulk/group`, { ids, group }),

  addTag: (wsId: string, id: string, tag: string) =>
    request<void>("POST", `/workspaces/${wsId}/papers/${id}/tags`, { tag }),

  removeTag: (wsId: string, id: string, tag: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/papers/${id}/tags/${tag}`),

  citation: (wsId: string, id: string, format?: string) => {
    const qs = format ? `?format=${format}` : "";
    return request<{ citation: string; format: string }>("GET", `/workspaces/${wsId}/papers/${id}/citation${qs}`);
  },

  aiCitation: (wsId: string, id: string) =>
    request<{ citation: string; format: string; aiGenerated: boolean }>(
      "POST", `/workspaces/${wsId}/papers/${id}/citation/ai-generate`,
    ),

  generateSummary: (wsId: string, id: string) =>
    request<PaperSummaryDTO>("POST", `/workspaces/${wsId}/papers/${id}/summary/generate`),

  getSummary: (wsId: string, id: string) =>
    request<PaperSummaryDTO>("GET", `/workspaces/${wsId}/papers/${id}/summary`),

  listAnnotations: (wsId: string, id: string) =>
    request<AnnotationDTO[]>("GET", `/workspaces/${wsId}/papers/${id}/annotations`),

  addAnnotation: (wsId: string, id: string, text: string) =>
    request<AnnotationDTO>("POST", `/workspaces/${wsId}/papers/${id}/annotations`, { text }),

  deleteAnnotation: (wsId: string, paperId: string, annotationId: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/papers/${paperId}/annotations/${annotationId}`),
};

// ── Datasets API ─────────────────────────────────────────────────

export interface DatasetDTO {
  id: string;
  workspaceId: string;
  name: string;
  fileKey: string;
  fileType: string;
  previewJson: Record<string, unknown> | null;
  createdAt: string;
}

export const datasetsApi = {
  list: (wsId: string) =>
    request<DatasetDTO[]>("GET", `/workspaces/${wsId}/datasets`),

  upload: (wsId: string, file: File) =>
    uploadFile<DatasetDTO>("POST", `/workspaces/${wsId}/datasets/upload`, file),

  update: (wsId: string, id: string, data: { name?: string }) =>
    request<DatasetDTO>("PATCH", `/workspaces/${wsId}/datasets/${id}`, data),

  delete: (wsId: string, id: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/datasets/${id}`),

  preview: (wsId: string, id: string) =>
    request<Record<string, unknown>>("GET", `/workspaces/${wsId}/datasets/${id}/preview`),
};

// ── Chat / Conversations API ─────────────────────────────────────

export interface ConversationDTO {
  id: string;
  workspaceId: string;
  title: string;
  group: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  external: boolean;
  sources: Array<{ paperId: string; paragraph: string; confidence: number }> | null;
  followups: string[];
  attachmentKeys: string[];
  createdAt: string;
}

export const conversationsApi = {
  list: (wsId: string) =>
    request<{ grouped: Record<string, ConversationDTO[]>; ungrouped: ConversationDTO[] }>(
      "GET", `/workspaces/${wsId}/conversations`,
    ),

  create: (wsId: string, data: { title?: string; group?: string | null }) =>
    request<ConversationDTO>("POST", `/workspaces/${wsId}/conversations`, data),

  update: (wsId: string, id: string, data: { title?: string; group?: string | null }) =>
    request<ConversationDTO>("PATCH", `/workspaces/${wsId}/conversations/${id}`, data),

  delete: (wsId: string, id: string) =>
    request<void>("DELETE", `/workspaces/${wsId}/conversations/${id}`),

  listMessages: (wsId: string, convId: string, params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<{ items: ChatMessageDTO[]; nextCursor: string | null }>(
      "GET", `/workspaces/${wsId}/conversations/${convId}/messages${qs ? `?${qs}` : ""}`,
    );
  },

  sendMessage: (wsId: string, convId: string, data: { content: string; model?: string; includeExternal?: boolean; attachments?: string[] }) =>
    request<{ userMessage: ChatMessageDTO; assistantMessage: ChatMessageDTO }>(
      "POST", `/workspaces/${wsId}/conversations/${convId}/messages`, data,
    ),

  uploadAttachment: (wsId: string, convId: string, msgId: string, file: File) =>
    uploadFile<{ attachmentKey: string }>(
      "POST", `/workspaces/${wsId}/conversations/${convId}/messages/${msgId}/attachments`, file,
    ),
};

// ── Citations API ────────────────────────────────────────────────

export const citationsApi = {
  export: (wsId: string, params?: { format?: string; ids?: string }) => {
    const query = new URLSearchParams();
    if (params?.format) query.set("format", params.format);
    if (params?.ids) query.set("ids", params.ids);
    const qs = query.toString();
    return request<{ citations: string; format: string; count: number }>(
      "GET", `/workspaces/${wsId}/citations/export${qs ? `?${qs}` : ""}`,
    );
  },

  aiGenerate: (wsId: string, ids: string[], format?: string) =>
    request<{ citations: Array<{ paperId: string; citation: string; format: string }>; aiGenerated: boolean }>(
      "POST", `/workspaces/${wsId}/citations/ai-generate`, { ids, format: format ?? "APA" },
    ),
};

// ── Settings API ─────────────────────────────────────────────────

export interface ApiKeyInfo {
  scope: string;
  configured: boolean;
  createdAt: string | null;
}

export const settingsApi = {
  listApiKeys: () =>
    request<ApiKeyInfo[]>("GET", "/settings/api-keys"),

  upsertApiKey: (scope: string, value: string) =>
    request<{ scope: string; configured: boolean }>(
      "PUT",
      `/settings/api-keys/${encodeURIComponent(scope)}`,
      { value },
    ),

  deleteApiKey: (scope: string) =>
    request<void>("DELETE", `/settings/api-keys/${encodeURIComponent(scope)}`),

  getPreferences: () =>
    request<Record<string, unknown>>("GET", "/settings/preferences"),

  updatePreferences: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("PATCH", "/settings/preferences", data),
};

// ── Auth API ─────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  mobile?: string | null;
  field?: string | null;
  affiliation?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: UserDTO;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const data = await request<AuthResponse>("POST", "/auth/login", { email, password });
    setAuthToken(data.accessToken);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return data;
  },

  signup: async (email: string, password: string, name: string) => {
    const data = await request<AuthResponse>("POST", "/auth/signup", { email, password, name });
    setAuthToken(data.accessToken);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return data;
  },

  logout: () => {
    const refresh = getRefreshToken();
    const token = getAuthToken();
    if (refresh || token) {
      const headers: Record<string, string> = {};
      if (refresh) headers["x-refresh-token"] = refresh;
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers,
      }).catch(() => {});
    }
    clearTokens();
  },

  me: (options?: { signal?: AbortSignal }) =>
    request<UserDTO>("GET", "/auth/me", undefined, options),

  updateProfile: (data: Partial<{ name: string; mobile: string; field: string; affiliation: string }>) =>
    request<UserDTO>("PATCH", "/auth/me", data),

  changePassword: async (currentPassword: string, newPassword: string) => {
    const data = await request<{ message: string; accessToken: string; refreshToken: string }>(
      "POST",
      "/auth/me/password",
      { currentPassword, newPassword },
    );
    // Sessions were rotated server-side — adopt the fresh tokens.
    setAuthToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  },

  deleteAccount: (password: string) =>
    request<void>("DELETE", "/auth/me", { password }),
};

// ── Error helper ─────────────────────────────────────────────────

export { ApiRequestError };
export type { ApiError };