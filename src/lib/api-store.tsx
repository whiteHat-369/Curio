/**
 * API-powered store — connects the frontend to the backend server.
 * Each page imports from here instead of `./store.ts` to get live data.
 */

import { createStore, useStore } from "zustand";
import { createContext, useContext, useRef } from "react";
import type { ReactNode } from "react";
import {
  papersApi,
  datasetsApi,
  conversationsApi,
  citationsApi,
  settingsApi,
  authApi,
  workspacesApi,
  evidenceApi,
  notesApi,
  clearTokens,
} from "./api-client";
import type {
  PaperDTO,
  DatasetDTO,
  ConversationDTO,
  ChatMessageDTO,
  ApiKeyInfo,
  WorkspaceDTO,
  EvidenceClaimDTO,
  NoteDTO,
} from "./api-client";

// ── Types ───────────────────────────────────────────────────────

export interface PaperWithMeta extends PaperDTO {
  addedAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  question: string;
  paperIds: string[];
  progress: number;
  updatedAt: string;
}

export interface EvidenceClaim {
  id: string;
  paperId: string;
  question: string;
  stance: "supports" | "contradicts" | "mixed";
  summary: string;
  paragraph: string;
  confidence: number;
  why?: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  paperIds: string[];
  updatedAt: string;
  group?: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { paperId: string; paragraph: string; confidence: number }[];
  followups?: string[];
  external?: boolean;
}

export interface PaperSummary {
  intro: string;
  methodology: string;
  result: string;
  limitations: string;
}

export interface Annotation {
  id: string;
  text: string;
  createdAt: string;
}

export interface ImportDatabase {
  id: string;
  name: string;
  fileName?: string;
  previewJson?: Record<string, unknown> | null;
}

export interface UploadingPaper {
  id: string;
  title: string;
  progress: number;
}

// ── Store ────────────────────────────────────────────────────────

interface ApiStore {
  // Auth
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;
  userMobile: string | null;
  userField: string | null;
  userAffiliation: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (data: Partial<{ name: string; mobile: string; field: string; affiliation: string }>) => Promise<void>;
  fetchPreferences: () => Promise<void>;

  // Workspaces
  workspaces: Workspace[];
  setWorkspaces: (ws: Workspace[]) => void;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, question: string) => Promise<string>;
  renameWorkspace: (wsId: string, newName: string) => void;
  deleteWorkspace: (wsId: string) => void;
  recomputeProgress: (wsId: string) => void;

  // Papers
  papers: PaperWithMeta[];
  loadingPapers: boolean;
  fetchPapers: (wsId: string) => Promise<void>;
  cyclePaperStatus: (paperId: string) => void;
  togglePin: (paperId: string) => void;
  addTag: (paperId: string, tag: string) => void;
  removeTag: (paperId: string, tag: string) => void;
  bulkAddTag: (paperIds: string[], tag: string) => void;
  deletePapers: (wsId: string, paperIds: string[]) => void;
  restoreTrashedPapers: (paperIds: string[]) => void;
  renamePaper: (paperId: string, newTitle: string) => void;
  groupPaper: (paperId: string, groupName: string) => void;
  startUpload: (wsId: string, filename: string | File, realFile?: File) => Promise<boolean>;
  uploading: Record<string, UploadingPaper[]>;

  // AI summaries
  summaries: Record<string, PaperSummary>;
  generateSummary: (paperId: string) => void;

  // Annotations
  annotations: Record<string, Annotation[]>;
  fetchAnnotations: (wsId: string, paperId: string) => Promise<void>;
  addAnnotation: (paperId: string, text: string) => void;
  removeAnnotation: (paperId: string, id: string) => void;

  // Datasets
  databases: ImportDatabase[];
  fetchDatasets: (wsId: string) => Promise<void>;
  uploadDataset: (wsId: string, file: File) => Promise<void>;
  addDatabase: (name: string, fileName?: string) => void;
  renameDatabase: (dbId: string, newName: string) => void;
  deleteDatabase: (dbId: string) => void;

  // Evidence
  evidence: Record<string, EvidenceClaim[]>;
  fetchEvidence: (wsId: string) => Promise<void>;
  setEvidence: (wsId: string, claims: EvidenceClaim[]) => void;

  // Notes
  notes: Record<string, Note[]>;
  fetchNotes: (wsId: string) => Promise<void>;
  createNote: (wsId: string) => string;
  updateNote: (wsId: string, note: Note) => void;
  deleteNote: (wsId: string, noteId: string) => void;
  restoreNote: (wsId: string, noteId: string) => void;
  groupNotes: (wsId: string, noteIds: string[], groupName: string) => void;
  addNoteTag: (wsId: string, noteId: string, tag: string) => void;
  removeNoteTag: (wsId: string, noteId: string, tag: string) => void;
  renameTag: (oldTag: string, newTag: string) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Preferences
  defaultModel: string;
  setDefaultModel: (model: string) => void;
  defaultIncludeExternal: boolean;
  setDefaultIncludeExternal: (v: boolean) => void;
  defaultCiteFormat: "APA" | "IEEE" | "BibTeX";
  setDefaultCiteFormat: (v: "APA" | "IEEE" | "BibTeX") => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;

  // API Keys
  apiKeys: Record<string, string>;
  setApiKey: (key: string, value: string) => Promise<void>;
  removeApiKey: (key: string) => Promise<void>;
  fetchApiKeys: () => Promise<void>;

  // Pinned
  pinned: string[];
}

export const createApiStore = () => {
  let fetchPapersController: AbortController | null = null;
  let fetchMeController: AbortController | null = null;
  let fetchWorkspacesController: AbortController | null = null;

  return createStore<ApiStore>((set, get) => ({
    // ── Auth ──────────────────────────────────────────────────────
    isAuthenticated: false,
    userEmail: null,
    userName: null,
    userMobile: null,
    userField: null,
    userAffiliation: null,

    login: async (email, password) => {
      const data = await authApi.login(email, password);
      set({
        isAuthenticated: true,
        userEmail: data.user.email,
        userName: data.user.name ?? email.split("@")[0],
        userMobile: data.user.mobile ?? null,
        userField: data.user.field ?? null,
        userAffiliation: data.user.affiliation ?? null,
      });
      get().fetchApiKeys();
      get().fetchPreferences();
    },

    signup: async (email, password, name) => {
      const data = await authApi.signup(email, password, name);
      set({
        isAuthenticated: true,
        userEmail: data.user.email,
        userName: data.user.name ?? name,
        userMobile: data.user.mobile ?? null,
        userField: data.user.field ?? null,
        userAffiliation: data.user.affiliation ?? null,
      });
      get().fetchApiKeys();
      get().fetchPreferences();
    },

    logout: () => {
      try {
        authApi.logout();
      } catch {}
      set({
        isAuthenticated: false,
        userEmail: null,
        userName: null,
        userMobile: null,
        userField: null,
        userAffiliation: null,
      });
    },

    fetchMe: async () => {
      if (fetchMeController) fetchMeController.abort();
      fetchMeController = new AbortController();
      const signal = fetchMeController.signal;
      try {
        const user = await authApi.me({ signal });
        set({
          isAuthenticated: true,
          userEmail: user.email,
          userName: user.name ?? user.email.split("@")[0],
          userMobile: user.mobile ?? null,
          userField: user.field ?? null,
          userAffiliation: user.affiliation ?? null,
        });
        get().fetchApiKeys();
        get().fetchPreferences();
      } catch (err: any) {
        if (err.name === "AbortError") return;
        clearTokens();
        set({
          isAuthenticated: false,
          userEmail: null,
          userName: null,
          userMobile: null,
          userField: null,
          userAffiliation: null,
        });
      }
    },

    updateProfile: async (data) => {
      const updated = await authApi.updateProfile(data);
      if (updated) {
        set({
          userName: updated.name ?? get().userName,
          userMobile: updated.mobile ?? get().userMobile,
          userField: updated.field ?? get().userField,
          userAffiliation: updated.affiliation ?? get().userAffiliation,
        });
      }
    },

    // ── Workspaces ────────────────────────────────────────────────
    workspaces: [],

    setWorkspaces: (workspaces) => set({ workspaces }),

    fetchWorkspaces: async () => {
      if (fetchWorkspacesController) fetchWorkspacesController.abort();
      fetchWorkspacesController = new AbortController();
      const signal = fetchWorkspacesController.signal;
      try {
        const data = await workspacesApi.list({ signal });
        if (signal.aborted || signal !== fetchWorkspacesController?.signal) return;
        if (data?.items) {
          const wsItems: Workspace[] = data.items.map((w) => ({
            id: w.id,
            name: w.name,
            question: w.question,
            paperIds: [],
            progress: w.progress ?? 0,
            updatedAt: new Date(w.updatedAt).toLocaleDateString(),
          }));
          set({ workspaces: wsItems });
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    },

    createWorkspace: async (name, question) => {
      const data = await workspacesApi.create({ name, question });
      const newId = data.id;
      const ws: Workspace = {
        id: newId,
        name: name.trim() || "Untitled workspace",
        question: question.trim() || "—",
        paperIds: [],
        progress: 0,
        updatedAt: "just now",
      };
      set((s) => ({
        workspaces: [ws, ...s.workspaces],
        evidence: { ...s.evidence, [newId]: [] },
        notes: { ...s.notes, [newId]: [] },
      }));
      return newId;
    },

    renameWorkspace: (wsId, newName) => {
      const trimmed = newName.trim().slice(0, 50);
      if (!trimmed) return;
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === wsId ? { ...w, name: trimmed } : w)),
      }));
      workspacesApi.update(wsId, { name: trimmed }).catch(() => {});
    },

    deleteWorkspace: (wsId) => {
      set((s) => {
        const { [wsId]: _evidence, ...evidence } = s.evidence;
        const { [wsId]: _notes, ...notes } = s.notes;
        return { workspaces: s.workspaces.filter((w) => w.id !== wsId), evidence, notes };
      });
      workspacesApi.delete(wsId).catch(() => {});
    },

    recomputeProgress: (wsId) => {
      const s = get();
      const ws = s.workspaces.find((w) => w.id === wsId);
      if (!ws) return;
      const wsPapers = s.papers.filter((p) => ws.paperIds.includes(p.id));
      const total = wsPapers.length;
      const readish = wsPapers.reduce(
        (a, p) => a + (p.status === "read" ? 1 : p.status === "reading" ? 0.5 : 0),
        0,
      );
      const progress = total === 0 ? 0 : Math.round((readish / total) * 100);
      set((s2) => ({
        workspaces: s2.workspaces.map((w) => (w.id === wsId ? { ...w, progress } : w)),
      }));
    },

    // ── Papers ────────────────────────────────────────────────────
    papers: [],
    loadingPapers: false,

    fetchPapers: async (wsId) => {
      if (fetchPapersController) fetchPapersController.abort();
      fetchPapersController = new AbortController();
      const signal = fetchPapersController.signal;

      set({ loadingPapers: true });
      try {
        const data = await papersApi.list(wsId, undefined, { signal });
        if (signal.aborted || signal !== fetchPapersController?.signal) return;
        if (data?.items) {
          const papersWithMeta: PaperWithMeta[] = data.items.map((p, i) => ({
            ...p,
            addedAt: Date.now() - (100 - i) * 1000 * 60 * 60,
          }));
          set((s) => {
            // Merge: keep papers from other workspaces, replace this one's.
            const other = s.papers.filter((p) => p.workspaceId !== wsId);
            const merged = [...papersWithMeta, ...other];
            const workspaces = s.workspaces.map((w) =>
              w.id === wsId ? { ...w, paperIds: papersWithMeta.map((p) => p.id) } : w,
            );
            return { papers: merged, workspaces, loadingPapers: false };
          });
          get().recomputeProgress(wsId);
          return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
      set({ loadingPapers: false });
    },

    cyclePaperStatus: (paperId) => {
      const order: Array<"unread" | "reading" | "read"> = ["unread", "reading", "read"];
      let wsId = "";
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId) {
            wsId = p.workspaceId;
            const nextStatus = order[(order.indexOf(p.status) + 1) % order.length];
            if (wsId) {
              papersApi.update(wsId, paperId, { status: nextStatus }).catch(() => {});
            }
            return { ...p, status: nextStatus };
          }
          return p;
        }),
      }));
      const wsList = get().workspaces.filter((w) => w.paperIds.includes(paperId));
      wsList.forEach((w) => get().recomputeProgress(w.id));
    },

    togglePin: (paperId) =>
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId) {
            const nextPinned = !p.pinned;
            if (p.workspaceId) {
              papersApi.update(p.workspaceId, paperId, { pinned: nextPinned }).catch(() => {});
            }
            return { ...p, pinned: nextPinned };
          }
          return p;
        }),
        pinned: s.pinned.includes(paperId)
          ? s.pinned.filter((id) => id !== paperId)
          : [...s.pinned, paperId],
      })),

    addTag: (paperId, tag) => {
      const t = tag.trim().toLowerCase();
      if (!t) return;
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId && !p.tags.includes(t)) {
            if (p.workspaceId) {
              papersApi.addTag(p.workspaceId, paperId, t).catch(() => {});
            }
            return { ...p, tags: [...p.tags, t] };
          }
          return p;
        }),
      }));
    },

    removeTag: (paperId, tag) =>
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId) {
            if (p.workspaceId) {
              papersApi.removeTag(p.workspaceId, paperId, tag).catch(() => {});
            }
            return { ...p, tags: p.tags.filter((x) => x !== tag) };
          }
          return p;
        }),
      })),

    bulkAddTag: (paperIds, tag) => {
      const t = tag.trim().toLowerCase();
      if (!t) return;
      set((s) => ({
        papers: s.papers.map((p) =>
          paperIds.includes(p.id) && !p.tags.includes(t) ? { ...p, tags: [...p.tags, t] } : p,
        ),
      }));
    },

    deletePapers: (wsId, paperIds) => {
      set((s) => ({
        papers: s.papers.filter((p) => !paperIds.includes(p.id)),
        workspaces: s.workspaces.map((w) =>
          w.id === wsId ? { ...w, paperIds: w.paperIds.filter((id) => !paperIds.includes(id)) } : w,
        ),
      }));
      get().recomputeProgress(wsId);
      papersApi.bulkDelete(wsId, paperIds).catch(() => {});
    },

    restoreTrashedPapers: (paperIds) => {
      set((s) => ({
        workspaces: s.workspaces.map((w) => ({
          ...w,
          paperIds: [...w.paperIds, ...paperIds.filter((id) => !w.paperIds.includes(id))],
        })),
      }));
      const wsIds = new Set(get().workspaces.map((w) => w.id));
      wsIds.forEach((id) => get().recomputeProgress(id));
    },

    renamePaper: (paperId, newTitle) => {
      const title = newTitle.trim();
      if (!title) return;
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId) {
            if (p.workspaceId) {
              papersApi.update(p.workspaceId, paperId, { title }).catch(() => {});
            }
            return { ...p, title };
          }
          return p;
        }),
      }));
    },

    groupPaper: (paperId, groupName) => {
      const group = groupName.trim();
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.id === paperId) {
            if (p.workspaceId) {
              papersApi.update(p.workspaceId, paperId, { group: group || null }).catch(() => {});
            }
            return { ...p, group: group || null };
          }
          return p;
        }),
      }));
    },

    uploading: {},

    startUpload: (wsId, fileOrName, realFile?) => {
      // Supports startUpload(wsId, filename) legacy + startUpload(wsId, filename, File)
      const filename = typeof fileOrName === "string" ? fileOrName : (fileOrName as File).name;
      const file: File | undefined =
        realFile ?? (typeof fileOrName === "object" ? (fileOrName as File) : undefined);
      if (file) {
        // Real backend upload — persists the paper + extracts PDF content.
        const id = "u_" + Math.random().toString(36).slice(2, 8);
        const title = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
        set((s) => ({
          uploading: {
            ...s.uploading,
            [wsId]: [...(s.uploading[wsId] ?? []), { id, title, progress: 10 }],
          },
        }));
        return papersApi
          .upload(wsId, file)
          .then((created) => {
            set((s) => ({
              uploading: {
                ...s.uploading,
                [wsId]: (s.uploading[wsId] ?? []).filter((x) => x.id !== id),
              },
            }));
            if (created) {
              const paper: PaperWithMeta = { ...created, addedAt: Date.now() };
              set((s) => ({
                papers: [paper, ...s.papers],
                workspaces: s.workspaces.map((w) =>
                  w.id === wsId && !w.paperIds.includes(paper.id)
                    ? { ...w, paperIds: [paper.id, ...w.paperIds] }
                    : w,
                ),
              }));
              get().recomputeProgress(wsId);
            } else {
              get().fetchPapers(wsId);
            }
            return true;
          })
          .catch(() => {
            set((s) => ({
              uploading: {
                ...s.uploading,
                [wsId]: (s.uploading[wsId] ?? []).filter((x) => x.id !== id),
              },
            }));
            // Refresh from server in case the paper was saved despite the error.
            get().fetchPapers(wsId);
            return false;
          });
      }
      const id = "u_" + Math.random().toString(36).slice(2, 8);
      const title = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      set((s) => ({
        uploading: {
          ...s.uploading,
          [wsId]: [...(s.uploading[wsId] ?? []), { id, title, progress: 0 }],
        },
      }));
      const interval = window.setInterval(() => {
        const list = get().uploading[wsId] ?? [];
        const u = list.find((x) => x.id === id);
        if (!u) {
          window.clearInterval(interval);
          return;
        }
        const next = Math.min(100, u.progress + 18 + Math.random() * 12);
        set((s) => ({
          uploading: {
            ...s.uploading,
            [wsId]: (s.uploading[wsId] ?? []).map((x) =>
              x.id === id ? { ...x, progress: next } : x,
            ),
          },
        }));
        if (next >= 100) {
          window.clearInterval(interval);
          window.setTimeout(() => {
            const paperId = "p_" + Math.random().toString(36).slice(2, 8);
            const newPaper: PaperWithMeta = {
              id: paperId,
              title,
              authors: ["Uploaded by you"],
              year: new Date().getFullYear(),
              venue: "Uploaded PDF",
              status: "unread",
              tags: [],
              group: null,
              abstract: "Uploaded PDF. Curio will extract structured metadata shortly.",
              methodology: "",
              dataset: "",
              results: "",
              limitations: "",
              keywords: [],
              fileKey: null,
              pinned: false,
              deletedAt: null,
              workspaceId: wsId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              addedAt: Date.now(),
            };
            set((s) => ({
              papers: [newPaper, ...s.papers],
              workspaces: s.workspaces.map((w) =>
                w.id === wsId ? { ...w, paperIds: [paperId, ...w.paperIds] } : w,
              ),
              uploading: {
                ...s.uploading,
                [wsId]: (s.uploading[wsId] ?? []).filter((x) => x.id !== id),
              },
            }));
            get().recomputeProgress(wsId);
          }, 300);
        }
      }, 220);
      return Promise.resolve(true);
    },

    // ── Summaries ─────────────────────────────────────────────────
    summaries: {},
    generateSummary: (paperId) => {
      const paper = get().papers.find((p) => p.id === paperId);
      if (!paper) return;
      if (paper.workspaceId) {
        papersApi
          .generateSummary(paper.workspaceId, paperId)
          .then((res) => {
            if (res) {
              set((s) => ({
                summaries: {
                  ...s.summaries,
                  [paperId]: {
                    intro: res.intro,
                    methodology: res.methodology,
                    result: res.result,
                    limitations: res.limitations,
                  },
                },
              }));
            }
          })
          .catch(() => {
            const fallback: PaperSummary = {
              intro: `${paper.title} (${paper.authors[0] ?? "the authors"} et al., ${paper.year}) ${paper.abstract}`,
              methodology: paper.methodology || "Methodology analysis.",
              result: paper.results || "Research results.",
              limitations: paper.limitations || "Research limitations.",
            };
            set((s) => ({ summaries: { ...s.summaries, [paperId]: fallback } }));
          });
      } else {
        const summary: PaperSummary = {
          intro: `${paper.title} (${paper.authors[0] ?? "the authors"} et al., ${paper.year}) ${paper.abstract}`,
          methodology: paper.methodology,
          result: paper.results,
          limitations: paper.limitations,
        };
        set((s) => ({ summaries: { ...s.summaries, [paperId]: summary } }));
      }
    },

    // ── Annotations ───────────────────────────────────────────────
    annotations: {},
    fetchAnnotations: async (wsId, paperId) => {
      try {
        const items = await papersApi.listAnnotations(wsId, paperId);
        if (Array.isArray(items)) {
          set((s) => ({
            annotations: {
              ...s.annotations,
              [paperId]: items.map((a) => ({ id: a.id, text: a.text, createdAt: a.createdAt })),
            },
          }));
        }
      } catch {}
    },
    addAnnotation: (paperId, text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const paper = get().papers.find((p) => p.id === paperId);
      const note: Annotation = {
        id: "an_" + Math.random().toString(36).slice(2, 8),
        text: trimmed,
        createdAt: "just now",
      };
      set((s) => ({
        annotations: { ...s.annotations, [paperId]: [note, ...(s.annotations[paperId] ?? [])] },
      }));
      if (paper?.workspaceId) {
        papersApi.addAnnotation(paper.workspaceId, paperId, trimmed)
          .then((created) => {
            if (created) {
              set((s) => ({
                annotations: {
                  ...s.annotations,
                  [paperId]: (s.annotations[paperId] ?? []).map((a) =>
                    a.id === note.id ? { id: created.id, text: created.text, createdAt: created.createdAt } : a,
                  ),
                },
              }));
            }
          })
          .catch(() => {});
      }
    },
    removeAnnotation: (paperId, id) => {
      const paper = get().papers.find((p) => p.id === paperId);
      set((s) => ({
        annotations: {
          ...s.annotations,
          [paperId]: (s.annotations[paperId] ?? []).filter((a) => a.id !== id),
        },
      }));
      if (paper?.workspaceId && !id.startsWith("an_")) {
        papersApi.deleteAnnotation(paper.workspaceId, paperId, id).catch(() => {});
      }
    },

    // ── Datasets ──────────────────────────────────────────────────
    databases: [],
    fetchDatasets: async (wsId) => {
      try {
        const items = await datasetsApi.list(wsId);
        if (Array.isArray(items)) {
          const mapped: ImportDatabase[] = items.map((d) => ({
            id: d.id,
            name: d.name,
            fileName: d.fileKey,
            previewJson: d.previewJson,
          }));
          set((s) => {
            const ids = new Set(mapped.map((d) => d.id));
            const others = s.databases.filter((d) => !ids.has(d.id));
            return { databases: [...mapped, ...others] };
          });
        }
      } catch {}
    },
    uploadDataset: async (wsId, file) => {
      const uploaded = await datasetsApi.upload(wsId, file);
      if (uploaded) {
        set((s) => ({
          databases: [
            {
              id: uploaded.id,
              name: uploaded.name,
              fileName: uploaded.fileKey,
              previewJson: uploaded.previewJson,
            },
            ...s.databases,
          ],
        }));
      } else {
        await get().fetchDatasets(wsId);
      }
    },
    addDatabase: (name, fileName) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = "db_" + Math.random().toString(36).slice(2, 8);
      set((s) => ({ databases: [...s.databases, { id, name: trimmed, fileName }] }));
    },
    renameDatabase: (dbId, newName) => {
      const name = newName.trim();
      if (!name) return;
      set((s) => ({
        databases: s.databases.map((d) => (d.id === dbId ? { ...d, name } : d)),
      }));
    },
    deleteDatabase: (dbId) => {
      const db = get().databases.find((d) => d.id === dbId);
      set((s) => ({ databases: s.databases.filter((d) => d.id !== dbId) }));
      // Best-effort backend delete across workspaces that own it
      const wsIds = new Set(get().workspaces.map((w) => w.id));
      wsIds.forEach((wsId) => {
        datasetsApi.delete(wsId, dbId).catch(() => {});
      });
      void db;
    },

    // ── Evidence ──────────────────────────────────────────────────
    evidence: {},

    fetchEvidence: async (wsId) => {
      try {
        const data = await evidenceApi.list(wsId, { limit: 100 });
        if (data?.items) {
          const claims: EvidenceClaim[] = data.items.map((c) => ({
            id: c.id,
            paperId: c.paperId,
            question: c.question,
            stance: c.stance,
            summary: c.summary,
            paragraph: c.paragraph,
            confidence: c.confidence,
          }));
          set((s) => ({ evidence: { ...s.evidence, [wsId]: claims } }));
        }
      } catch {
        // leave existing (possibly synthesised) claims untouched
      }
    },

    setEvidence: (wsId, claims) =>
      set((s) => ({ evidence: { ...s.evidence, [wsId]: claims } })),

    // ── Notes ─────────────────────────────────────────────────────
    notes: {},
    fetchNotes: async (wsId) => {
      try {
        const data = await notesApi.list(wsId, { limit: 100 });
        const items = data?.items ?? [];
        if (Array.isArray(items)) {
          set((s) => ({
            notes: {
              ...s.notes,
              [wsId]: items.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                paperIds: n.paperIds,
                updatedAt: new Date(n.updatedAt).toLocaleDateString(),
                group: n.group ?? undefined,
                tags: n.tags,
              })),
            },
          }));
        }
      } catch {}
    },
    createNote: (wsId) => {
      const id = "n_" + Math.random().toString(36).slice(2, 8);
      const note: Note = { id, title: "Untitled note", body: "", paperIds: [], updatedAt: "just now" };
      set((s) => ({ notes: { ...s.notes, [wsId]: [note, ...(s.notes[wsId] ?? [])] } }));
      notesApi.create(wsId, { title: note.title, body: note.body, tags: [], paperIds: [] }).catch(() => {});
      return id;
    },
    updateNote: (wsId, note) => {
      set((s) => ({
        notes: {
          ...s.notes,
          [wsId]: (s.notes[wsId] ?? []).map((n) => (n.id === note.id ? { ...note, updatedAt: "just now" } : n)),
        },
      }));
      notesApi.update(wsId, note.id, {
        title: note.title,
        body: note.body,
        group: note.group,
        tags: note.tags,
        paperIds: note.paperIds,
      }).catch(() => {});
    },
    deleteNote: (wsId, noteId) => {
      set((s) => ({
        notes: { ...s.notes, [wsId]: (s.notes[wsId] ?? []).filter((n) => n.id !== noteId) },
      }));
      notesApi.delete(wsId, noteId).catch(() => {});
    },
    restoreNote: (wsId, noteId) => {
      notesApi.restore(wsId, noteId).then((restored) => {
        if (restored) {
          const noteObj: Note = {
            id: restored.id,
            title: restored.title,
            body: restored.body,
            paperIds: restored.paperIds,
            updatedAt: "just now",
            group: restored.group ?? undefined,
            tags: restored.tags,
          };
          set((s) => ({ notes: { ...s.notes, [wsId]: [noteObj, ...(s.notes[wsId] ?? [])] } }));
        }
      }).catch(() => {});
    },
    groupNotes: (wsId, noteIds, groupName) => {
      const group = groupName.trim();
      set((s) => ({
        notes: {
          ...s.notes,
          [wsId]: (s.notes[wsId] ?? []).map((n) =>
            noteIds.includes(n.id) ? { ...n, group: group || undefined } : n,
          ),
        },
      }));
      notesApi.bulkGroup(wsId, noteIds, group || null).catch(() => {});
    },
    addNoteTag: (wsId, noteId, tag) => {
      const t = tag.trim().toLowerCase();
      if (!t) return;
      set((s) => ({
        notes: {
          ...s.notes,
          [wsId]: (s.notes[wsId] ?? []).map((n) =>
            n.id === noteId && !(n.tags ?? []).includes(t)
              ? { ...n, tags: [...(n.tags ?? []), t] }
              : n,
          ),
        },
      }));
      notesApi.addTag(wsId, noteId, t).catch(() => {});
    },
    removeNoteTag: (wsId, noteId, tag) => {
      set((s) => ({
        notes: {
          ...s.notes,
          [wsId]: (s.notes[wsId] ?? []).map((n) =>
            n.id === noteId ? { ...n, tags: (n.tags ?? []).filter((x) => x !== tag) } : n,
          ),
        },
      }));
      notesApi.removeTag(wsId, noteId, tag).catch(() => {});
    },
    renameTag: (oldTag, newTag) => {
      const oldT = oldTag.trim().toLowerCase();
      const newT = newTag.trim().toLowerCase();
      if (!oldT || !newT || oldT === newT) return;
      set((s) => ({
        papers: s.papers.map((p) => {
          if (p.tags.includes(oldT)) {
            const filtered = p.tags.filter((t) => t !== oldT);
            return filtered.includes(newT) ? { ...p, tags: filtered } : { ...p, tags: [...filtered, newT] };
          }
          return p;
        }),
      }));
    },

    // ── Search ────────────────────────────────────────────────────
    searchOpen: false,
    setSearchOpen: (open) => set({ searchOpen: open }),

    // ── Preferences ───────────────────────────────────────────────
    defaultModel: "gemini",
    setDefaultModel: (model) => {
      set({ defaultModel: model });
      settingsApi.updatePreferences({ defaultModel: model }).catch(() => {});
    },
    defaultIncludeExternal: false,
    setDefaultIncludeExternal: (v) => {
      set({ defaultIncludeExternal: v });
      settingsApi.updatePreferences({ defaultIncludeExternal: v }).catch(() => {});
    },
    defaultCiteFormat: "APA",
    setDefaultCiteFormat: (v) => {
      set({ defaultCiteFormat: v });
      settingsApi.updatePreferences({ defaultCiteFormat: v }).catch(() => {});
    },
    reduceMotion: false,
    setReduceMotion: (v) => {
      set({ reduceMotion: v });
      settingsApi.updatePreferences({ reduceMotion: v }).catch(() => {});
    },

    fetchPreferences: async () => {
      try {
        const prefs = await settingsApi.getPreferences();
        if (prefs) {
          set({
            defaultModel: (prefs.defaultModel as string) || "gemini",
            defaultIncludeExternal: Boolean(prefs.defaultIncludeExternal),
            defaultCiteFormat: (prefs.defaultCiteFormat as "APA" | "IEEE" | "BibTeX") || "APA",
            reduceMotion: Boolean(prefs.reduceMotion),
          });
        }
      } catch {}
    },

    // ── API Keys ──────────────────────────────────────────────────
    apiKeys: {},
    fetchApiKeys: async () => {
      try {
        const keys = await settingsApi.listApiKeys();
        if (Array.isArray(keys)) {
          const map: Record<string, string> = {};
          for (const k of keys) {
            if (k.configured) {
              map[k.scope] = "configured";
            }
          }
          set({ apiKeys: map });
        }
      } catch {}
    },
    setApiKey: async (key, value) => {
      set((s) => ({ apiKeys: { ...s.apiKeys, [key]: "configured" } }));
      try {
        await settingsApi.upsertApiKey(key, value);
        await get().fetchApiKeys();
      } catch (e) {
        set((s) => {
          const { [key]: _removed, ...rest } = s.apiKeys;
          return { apiKeys: rest };
        });
        console.error("Failed to save API key", e);
        throw e;
      }
    },
    removeApiKey: async (key) => {
      set((s) => {
        const { [key]: _removed, ...rest } = s.apiKeys;
        return { apiKeys: rest };
      });
      try {
        await settingsApi.deleteApiKey(key);
        await get().fetchApiKeys();
      } catch (e) {
        console.error("Failed to delete API key", e);
        set((s) => ({ apiKeys: { ...s.apiKeys, [key]: "configured" } }));
        throw e;
      }
    },

    pinned: [],
  }));
};

// ── React Context & Provider for TanStack Start (SSR Safety) ──
export type StoreType = ReturnType<typeof createApiStore>;
export const StoreContext = createContext<StoreType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<StoreType>(null);
  if (!storeRef.current) {
    storeRef.current = createApiStore();
  }
  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
}

export const useApiStore = <T,>(selector: (state: ApiStore) => T): T => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useApiStore must be used within StoreProvider");
  }
  return useStore(store, selector);
};

export function useApiStoreApi(): StoreType {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useApiStoreApi must be used within StoreProvider");
  }
  return store;
}

// ── Selectors ────────────────────────────────────────────────────
export const usePaper = (id: string) => useApiStore((s) => s.papers.find((p) => p.id === id));
export const useWorkspace = (id: string) => useApiStore((s) => s.workspaces.find((w) => w.id === id));