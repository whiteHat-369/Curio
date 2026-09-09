# Backend Implementation Plan — Track A (Hinal)

Mirrors the existing frontend split in `docs/work_distribution.md`: this
track owns **Auth, Workspaces, Evidence Map, Overview, and Notes**. It is
designed to be built **independently of Track B (Rudra)** — the only
coupling is read-only references to a couple of tables Track B owns (Papers),
agreed upfront via a shared schema file so neither side blocks on the other.

See `docs/backend-plan-rudra.md` for the other track. The **"Shared
conventions"** section below is identical in both files — agree it on Day 0,
then work independently.

## Scope (equal-weight with Track B)

| Domain | Why it's here |
|---|---|
| Auth & Account | Sign in / sign up / forgot password / onboarding / verify email is Hinal's existing frontend scope |
| Workspaces | "Complete Workspace" — CRUD, switcher, progress |
| Evidence Map | "Complete Evidence Map" — claims, stance, confidence |
| Overview | "Complete Overview" — workspace summary + Research Health |
| Notes | "Complete Notes" — CRUD, tags, grouping |

Out of scope for this track (owned by Rudra): Papers, Datasets, AI Chat,
Citations, Settings, API keys. Where this track needs to *read* one of those
resources (e.g. Evidence claims reference a paper), see
[Cross-track dependencies](#cross-track-dependencies).

---

## Shared conventions (agree Day 0, applies to both tracks)

- **Stack**: Node.js 20+, TypeScript, Fastify (or Express — pick one, both
  tracks use the same), Prisma ORM, PostgreSQL. Matches the frontend's TS
  ecosystem so DTO types can be shared via a small `packages/shared-types`
  workspace package if you go monorepo, or duplicated manually if not.
- **Auth token**: JWT access token (short-lived, 15 min) + refresh token
  (httpOnly cookie, 30 days). `Authorization: Bearer <token>` on every
  authenticated request. Track A owns issuing/refreshing tokens; Track B's
  routes just verify them with a shared `verifyToken(req)` middleware
  (a ~20-line function, copy it into both services or publish as a tiny
  shared package — don't block on this, stub a local copy on Day 0 and sync
  later if you converge on a shared package).
- **Error envelope**: `{ "error": { "code": string, "message": string, "details"?: unknown } }`,
  HTTP status matches the error class (400 validation, 401 auth, 403 forbidden,
  404 not found, 409 conflict, 500 unexpected).
- **Pagination**: cursor-based, `?cursor=<id>&limit=20`, response includes
  `nextCursor: string | null`.
- **IDs**: UUID v7 (time-sortable) for every primary key.
- **Timestamps**: `createdAt`/`updatedAt`, `timestamptz`, set by the DB.
- **Base path**: `/api/v1/...`.
- **Schema file**: one `schema.prisma`, each track adds only the models it
  owns in its own PR; never edit the other track's models. Foreign keys
  across tracks (e.g. `Note.paperId -> Paper.id`) are declared as plain
  columns without a Prisma `@relation` if that would require touching the
  other track's model file — enforce the relationship in application code
  instead. This is the one deliberate looseness that keeps the two tracks
  from blocking each other on schema PRs.

---

## Data model owned by this track

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  passwordHash      String
  name              String?
  mobile            String?
  field             String?
  affiliation       String?
  emailVerifiedAt   DateTime?
  onboardedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
}

model Workspace {
  id          String   @id @default(uuid())
  ownerId     String   // -> User.id
  name        String   // max 50 chars, enforced in app layer
  question    String
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
  // progress is computed, not stored (see Workspaces API)
}

model EvidenceClaim {
  id          String   @id @default(uuid())
  workspaceId String   // -> Workspace.id
  paperId     String   // -> Paper.id (Track B table, no FK constraint — see below)
  question    String
  stance      String   // "supports" | "contradicts" | "mixed"
  summary     String
  paragraph   String
  confidence  Float
  createdAt   DateTime @default(now())
}

model Note {
  id          String   @id @default(uuid())
  workspaceId String   // -> Workspace.id
  title       String
  body        String
  group       String?
  tags        String[]
  paperIds    String[] // -> Paper.id[] (Track B table, no FK constraint)
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
}
```

> `paperId`/`paperIds` intentionally have no DB-level foreign key to Track
> B's `Paper` table — cross-schema FKs would force both tracks to migrate in
> lockstep. Validate existence via an internal call instead (see below).

---

## API endpoints

### Auth (`/api/v1/auth`)
| Method | Path | Notes |
|---|---|---|
| POST | `/signup` | email, password, name → creates User, sends verification email |
| POST | `/login` | email, password → access + refresh token |
| POST | `/logout` | revokes refresh token |
| POST | `/refresh` | rotates refresh token, issues new access token |
| POST | `/forgot-password` | email → sends reset link (always 200, don't leak existence) |
| POST | `/reset-password` | token, newPassword |
| POST | `/verify-email` | token → sets `emailVerifiedAt` |
| POST | `/resend-verification` | re-sends verification email |
| POST | `/onboarding` | sets `field`, `affiliation`, marks `onboardedAt` |
| GET | `/me` | current user profile |
| PATCH | `/me` | update name/mobile/field/affiliation |

### Workspaces (`/api/v1/workspaces`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list, includes computed `progress` (read papers / total papers via internal call to Track B) and `paperCount` |
| POST | `/` | create — validate name ≤ 50 chars |
| GET | `/:id` | detail |
| PATCH | `/:id` | rename / update question |
| DELETE | `/:id` | cascade-deletes this track's EvidenceClaims + Notes for the workspace; also fires an internal event so Track B can clean up its Papers/Datasets/Chat for the same workspace (see dependencies) |
| GET | `/recent?limit=5` | for the sidebar switcher |

### Evidence Map (`/api/v1/workspaces/:wsId/evidence`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list claims, `?stance=supports\|contradicts\|mixed` filter |
| GET | `/questions` | distinct questions with per-stance counts |
| POST | `/` | create a claim (manual or pipeline-triggered — see Phase 3) |
| DELETE | `/:id` | |

### Overview / Research Health (`/api/v1/workspaces/:wsId/overview`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | question, stats (paper count/read count — calls Track B for paper stats), recent papers (calls Track B) |
| GET | `/health` | coverage %, recency %, suggestions (see below) |

Suggestions are simple rule-based text for v1 (e.g. "N papers added in the
last 30 days" / "no papers tagged 'survey'") — no AI required here; Track B's
AI Chat/Summary infra is a separate concern. Keep this deterministic so it
doesn't depend on Track B's LLM Gateway.

### Notes (`/api/v1/workspaces/:wsId/notes`)
| Method | Path | Notes |
|---|---|---|
| GET | `/` | list, `?q=` search title/body, grouped by `group` client-side or via `?groupBy=group` |
| POST | `/` | create |
| PATCH | `/:id` | update title/body/group |
| DELETE | `/:id` | soft-delete with a 30s undo window (mirror frontend's optimistic-undo UX: keep the row, add `deletedAt`, hard-delete via a cron after undo window expires) |
| POST | `/:id/restore` | undo delete |
| POST | `/bulk/group` | `{ ids: string[], group: string }` |
| POST | `/:id/tags` | add tag |
| DELETE | `/:id/tags/:tag` | remove tag |
| PATCH | `/tags/:tag` | rename tag across all notes in workspace |

---

## Cross-track dependencies

Keep this list short on purpose — anything longer means the split is wrong.

1. **Reading Track B's Paper data**: Workspace progress, Overview stats/recent
   papers, and Evidence claims all need paper title/authors/year/status.
   Don't join across schemas — call Track B's internal read endpoint:
   `GET /internal/papers?ids=a,b,c` (Track B exposes this, see their doc).
   Cache the response for a few seconds if it's hot (Overview page).
2. **Workspace deletion cleanup**: when a Workspace is deleted, emit an
   internal event (simplest: an HTTP call to
   `POST /internal/workspaces/:id/purged` on Track B's service, or a
   Postgres `LISTEN/NOTIFY` if same DB) so Track B deletes its Papers/
   Datasets/Chats/AI-summaries for that workspace. Don't do this via a
   shared transaction — the two services are independently deployable.
3. **Auth verification**: Track B verifies the same JWTs this track issues.
   Agree the JWT secret/JWKS endpoint on Day 0; nothing else needed.

If Track B's internal endpoint isn't ready yet, stub it locally (return
`[]`/zeroes) and keep building — don't block.

---

## Phased delivery

**Phase 1 — Auth + Workspaces (week 1–2)**
Signup/login/forgot-password/verify-email/onboarding, JWT issuance,
Workspace CRUD with the 50-char validation, `/me` profile. This unblocks
every other authenticated route on both tracks — prioritize it first.

**Phase 2 — Notes + Evidence Map (week 2–3)**
Full Notes CRUD incl. soft-delete/undo, tags, grouping. Evidence claim CRUD
and the stance-filtered list/count endpoints.

**Phase 3 — Overview & Research Health (week 3–4)**
Wire the internal cross-track paper-stats call; ship the rule-based health
suggestions. Add the `/recent` workspace-switcher endpoint.

**Phase 4 — Hardening (week 4+)**
Rate limiting on auth endpoints, request validation via zod, integration
tests per endpoint, load test Workspace list (N+1 avoidance on progress
calc), soft-delete cleanup cron.

## Definition of done (per endpoint)

- Zod-validated request/response schema.
- Auth middleware applied; ownership check (`workspace.ownerId === userId`)
  on every workspace-scoped route.
- Integration test covering the happy path + at least one error case.
- Matches the shared error envelope.
