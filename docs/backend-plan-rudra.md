# Backend Implementation Plan — Track B (Rudra)

Mirrors the existing frontend split in `docs/work_distribution.md`: this
track owns **Dashboard, AI Chat, Research Health's AI layer, Citations,
Papers/Datasets ("Paper Library"), and Settings**. It is designed to be
built **independently of Track A (Hinal)** — the only coupling is exposing a
couple of read-only internal endpoints so Track A can show paper stats,
agreed upfront via a shared schema file so neither side blocks on the other.

See `docs/backend-plan-hinal.md` for the other track. The **"Shared
conventions"** section below is identical in both files — agree it on Day 0,
then work independently.

## Scope (equal-weight with Track A)

| Domain | Why it's here |
|---|---|
| Dashboard | Rudra's existing frontend scope |
| AI Chat | "Complete Ai chat" |
| Research Health (AI layer) | "Complete Health score" — this track owns the LLM Gateway, so any future AI-enhanced suggestions live here (Track A's v1 health endpoint is rule-based and doesn't need this) |
| Citations | "Complete Citations" |
| Papers & Datasets | "Complete Paper Library" (now split into Papers + Datasets in the current UI) |
| Settings | incl. BYOK API key storage |

Out of scope for this track (owned by Hinal): Auth, Workspaces, Evidence Map,
Overview (the CRUD/stats parts), Notes. This track builds the **LLM Gateway**
and owns it — Hinal's rule-based health endpoint doesn't depend on it.

---

## Shared conventions (agree Day 0, applies to both tracks)

- **Stack**: Node.js 20+, TypeScript, Fastify (or Express — pick one, both
  tracks use the same), Prisma ORM, PostgreSQL.
- **Auth token**: this track never issues tokens — it only verifies the JWTs
  Track A issues. Copy/share the `verifyToken(req)` middleware; get the JWT
  secret/JWKS URL from Track A on Day 0 and stub it locally if not ready.
- **Error envelope**: `{ "error": { "code": string, "message": string, "details"?: unknown } }`,
  HTTP status matches the error class (400/401/403/404/409/500).
- **Pagination**: cursor-based, `?cursor=<id>&limit=20`, response includes
  `nextCursor: string | null`.
- **IDs**: UUID v7 for every primary key.
- **Timestamps**: `createdAt`/`updatedAt`, `timestamptz`, set by the DB.
- **Base path**: `/api/v1/...`.
- **Schema file**: one `schema.prisma`, each track adds only the models it
  owns in its own PR. Cross-track foreign keys (e.g. `EvidenceClaim.paperId`
  on Track A's side pointing at this track's `Paper`) are plain columns, no
  Prisma `@relation` — enforced in application code, not the DB. This keeps
  schema PRs from blocking each other.
- **File storage**: S3-compatible object storage (S3 / R2 / MinIO for local
  dev) for PDFs and dataset files. Store the object key on the row, generate
  signed URLs for download, never proxy file bytes through the API server.

---

## Data model owned by this track

```prisma
model Paper {
  id           String   @id @default(uuid())
  workspaceId  String   // -> Workspace.id (Track A table, no FK constraint)
  title        String
  authors      String[]
  year         Int
  venue        String
  status       String   // "unread" | "reading" | "read"
  tags         String[]
  group        String?
  abstract     String
  methodology  String
  dataset      String
  results      String
  limitations  String
  keywords     String[]
  fileKey      String?  // object storage key for the uploaded PDF
  pinned       Boolean  @default(false)
  deletedAt    DateTime? // soft delete, undo window like Notes
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Dataset {
  id           String   @id @default(uuid())
  workspaceId  String   // -> Workspace.id
  name         String
  fileKey      String   // object storage key
  fileType     String   // csv | json | parquet | xlsx
  previewJson  Json?    // cached sample rows/columns for the Preview dialog
  createdAt    DateTime @default(now())
}

model Conversation {
  id           String   @id @default(uuid())
  workspaceId  String
  title        String
  group        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model ChatMessage {
  id             String   @id @default(uuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String
  external       Boolean  @default(false)
  sources        Json?    // [{ paperId, paragraph, confidence }]
  followups      String[]
  attachmentKeys String[] // object storage keys
  createdAt      DateTime @default(now())
}

model PaperSummary {
  paperId      String   @id // -> Paper.id, one summary per paper
  intro        String
  methodology  String
  result       String
  limitations  String
  generatedAt  DateTime @default(now())
}

model Annotation {
  id        String   @id @default(uuid())
  paperId   String
  text      String
  createdAt DateTime @default(now())
}

model ApiKey {
  id        String   @id @default(uuid())
  userId    String   // -> User.id (Track A table, no FK constraint)
  scope     String   // "model:openai" | "model:gemini" | "model:grok" | "db:<datasetId>"
  ciphertext String  // encrypted at rest (see Settings section)
  createdAt DateTime @default(now())
}
```

---

## API endpoints

### Papers (`/api/v1/workspaces/:wsId/papers`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list, filters `?year=&status=&tag=&q=`, `?sort=added\|year\|author` |
| POST | `/upload` | multipart PDF upload → stores in object storage, creates row |
| GET | `/:id` | detail |
| PATCH | `/:id` | rename, status cycle, group, pin |
| DELETE | `/:id` | soft-delete, 30s undo window (mirrors frontend) |
| POST | `/:id/restore` | undo |
| POST | `/bulk/delete` \| `/bulk/tag` \| `/bulk/group` | `{ ids: string[], ... }` |
| POST | `/:id/tags` / DELETE `/:id/tags/:tag` | |
| GET | `/:id/citation?format=APA\|IEEE\|BibTeX` | deterministic formatting, no AI |
| POST | `/:id/citation/ai-generate` | calls the LLM Gateway, gated on the user having a `model:*` ApiKey configured |
| POST | `/:id/summary/generate` | calls LLM Gateway, writes `PaperSummary` |
| GET | `/:id/summary` | |
| GET/POST/DELETE | `/:id/annotations` | plain CRUD |

### Datasets (`/api/v1/workspaces/:wsId/datasets`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list |
| POST | `/upload` | multipart upload, parse first N rows for `previewJson` (CSV/JSON straightforward; Parquet/XLSX via a parsing lib — budget extra time here, see Phase 2) |
| PATCH | `/:id` | rename |
| DELETE | `/:id` | |
| GET | `/:id/preview` | returns cached `previewJson` |

### AI Chat (`/api/v1/workspaces/:wsId/conversations`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list, grouped by `group` |
| POST | `/` | create (optionally with an initial `group`) |
| PATCH | `/:id` | rename / re-group |
| DELETE | `/:id` | |
| GET | `/:id/messages` | paginated |
| POST | `/:id/messages` | `{ content, model, includeExternal, attachments? }` → calls LLM Gateway, returns assistant message with `sources`/`followups`; **stream via SSE** (`text/event-stream`) so the UI can render tokens incrementally |
| POST | `/:id/messages/:msgId/attachments` | multipart upload |

### LLM Gateway (internal module, not directly exposed to the frontend)
A single internal interface both this track's routes and Track A's future
AI-enhanced health suggestions can call:

```ts
interface LlmGateway {
  complete(input: {
    userId: string;           // to resolve which BYOK ApiKey to use
    provider: "openai" | "gemini" | "grok";
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    stream?: boolean;
  }): Promise<AsyncIterable<string> | string>;
}
```
Responsibilities: resolve the user's stored `ApiKey` for the requested
provider, decrypt it, call the provider's SDK, normalize errors (missing key
→ `402`-style "configure a key" error the frontend already handles), log
token usage. Implement provider adapters behind this one interface so adding
a fourth provider doesn't touch call sites.

### Citations (`/api/v1/workspaces/:wsId/citations`)
| Method | Path | Notes |
|---|---|---|
| GET | `/export?format=&ids=` | bulk formatted citation text, `ids` optional (all papers if omitted) — mirrors frontend's "Export selected/all" |
| POST | `/ai-generate` | `{ ids: string[] }` bulk AI-generate, gated on API key like the per-paper route above |

### Settings (`/api/v1/settings`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api-keys` | list configured scopes (never returns the plaintext key, just `{ scope, configured: true, createdAt }`) |
| PUT | `/api-keys/:scope` | `{ value }` → encrypt (AES-256-GCM, key from env `API_KEY_ENCRYPTION_KEY`) and store |
| DELETE | `/api-keys/:scope` | |
| GET/PATCH | `/preferences` | defaultModel, defaultIncludeExternal, defaultCiteFormat, reduceMotion, accent — small JSON blob per user, no need for a dedicated table if you'd rather store it as a `preferences Json` column on `User` (owned by Track A's table — coordinate a single migration together since this is the one field genuinely shared; simplest fix: Track A adds the column, this track just reads/writes it via the internal user-service, not a direct DB write from this service) |

### Internal (service-to-service, not public)
| Method | Path | Notes |
|---|---|---|
| GET | `/internal/papers?ids=a,b,c` | for Track A's Workspace progress / Overview stats / Evidence claim display |
| GET | `/internal/workspaces/:wsId/paper-stats` | `{ total, read }` — same purpose, precomputed |
| POST | `/internal/workspaces/:wsId/purged` | Track A calls this after deleting a workspace; this track deletes its Papers/Datasets/Conversations/Annotations for that workspace |

---

## Cross-track dependencies

1. **Reading/writing the shared `User.preferences` field**: see the Settings
   note above — this is the one place a genuinely shared column makes sense.
   Agree the JSON shape on Day 0 and don't revisit it independently.
2. **Verifying Track A's JWTs**: get the secret/JWKS URL on Day 0.
3. **Workspace-deletion cleanup**: implement
   `POST /internal/workspaces/:wsId/purged` early (Phase 1) so Track A isn't
   blocked when they wire workspace deletion.

If Track A's paper-stats consumer isn't ready, that's their problem, not
yours — ship your `/internal/papers` endpoint and move on.

---

## Phased delivery

**Phase 1 — Papers + object storage (week 1–2)**
Paper CRUD, PDF upload/storage, tags/status/group/pin, soft-delete+undo,
bulk ops. Ship `/internal/papers` and `/internal/workspaces/:wsId/purged`
early so Track A can integrate against real data instead of stubs.

**Phase 2 — Datasets + Citations (week 2–3)**
Dataset upload + preview parsing (budget extra time for Parquet/XLSX
parsing — CSV/JSON are trivial, the other two need a real library and more
testing). Deterministic citation formatting endpoint.

**Phase 3 — LLM Gateway + AI Chat (week 3–5)**
Provider adapters (OpenAI/Gemini/Grok), BYOK key storage/encryption,
Conversation + streaming message endpoints, AI paper summary, AI citation
generation. This is the highest-risk phase — start the Gateway interface
early even if provider adapters land later, so Chat's message endpoint has
something to call against (mock provider first).

**Phase 4 — Settings + hardening (week 5+)**
API key CRUD, preferences endpoint, rate limiting on LLM-calling routes
(these cost real money per call — protect against abuse), integration tests,
retry/backoff + circuit breaker per provider adapter.

## Definition of done (per endpoint)

- Zod-validated request/response schema.
- Auth middleware applied; ownership check on every workspace-scoped route.
- LLM-calling routes: explicit "no API key configured" error path tested,
  not just the happy path.
- Integration test covering the happy path + at least one error case.
- Matches the shared error envelope.
