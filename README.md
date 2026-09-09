# Curio

Evidence-first research intelligence for graduate researchers. Curio turns a
paper corpus into an evidence map — every AI-surfaced claim traces back to a
specific paper and paragraph, with a visible confidence score.

This repository is a **frontend prototype**: a fully interactive, static-data
UI meant to validate product flow and design. There is no backend, no real
authentication, and no real AI/model calls — see [Scope & limitations](#scope--limitations).

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, SSR) |
| Routing | [TanStack Router](https://tanstack.com/router) — file-based routes in `src/routes/` |
| State | [Zustand](https://github.com/pmndrs/zustand) — single store in `src/lib/store.ts`, in-memory only |
| Data fetching | [TanStack Query](https://tanstack.com/query) (wired, not yet used against a real API) |
| Styling | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) primitives (Radix UI underneath) in `src/components/ui/` |
| Icons | [lucide-react](https://lucide.dev) |
| Forms/validation | react-hook-form + zod (available, not yet wired into any form) |
| Toasts | [sonner](https://sonner.emilkowal.ski) |
| Build/dev server | Vite 8, deployable via [Nitro](https://nitro.build) (Cloudflare Workers preset by default) |
| Fonts | Space Grotesk (display), Plus Jakarta Sans (UI), Inter (body) |
| Lint/format | ESLint 9 + typescript-eslint + Prettier |

Package manager: npm. Node/TypeScript strict mode throughout.

## Getting started

```bash
npm install
npm run dev       # http://localhost:8080
npm run build     # production build via Nitro
npm run preview   # preview the production build
npm run lint       # eslint .
npm run format     # prettier --write .
```

## Project structure

```
src/
  routes/            # file-based routes (TanStack Router)
    __root.tsx        # HTML shell, error/not-found boundaries, global accent bootstrap
    _app.tsx           # authenticated app shell: sidebar + topbar + <Outlet/>
    _app.dashboard.tsx
    _app.workspaces.tsx
    _app.settings.tsx
    _app.workspace.$name.*.tsx   # per-workspace pages (see Features below)
    index.tsx, login.tsx, signup.tsx, forgot-password.tsx,
    onboarding.tsx, verify-email.tsx   # marketing/auth pages, not backed by real auth
  components/         # app-specific components (sidebar, topbar, tag editor, etc.)
    ui/                # shadcn/ui primitives (button, dialog, table, select, ...)
  lib/
    store.ts           # Zustand store — all app state and mutating actions
    mock-data.ts       # seed papers/workspaces/notes/evidence/chat data + types
    theme.ts           # dark/light theme + accent-color system
    utils.ts, error-*.ts, ...
  styles.css           # Tailwind v4 theme tokens (design system: colors, radius, fonts)
```

## Feature list

### Workspaces
- Create a workspace with a name (≤50 chars) and research question; instant "+"
  quick-create from the sidebar or the Workspaces page.
- Rename, delete (with confirm) from a `⋮` menu on each workspace card and in
  the sidebar's collapsible workspace switcher (shows up to 5 recent).
- Workspace **Overview**: research question, paper/read/progress stats, quick
  links to every section, recent papers, and a **Research health** panel
  (Coverage/Recency gauges + actionable AI suggestions that deep-link into
  Papers/Evidence Map).

### Papers
- Grid view of a workspace's papers: search, filter by year/status/tag, sort,
  bulk select → bulk tag/export/delete (with undo toast).
- Per-paper: rename, group, delete, open; reading-status cycle
  (unread/reading/read); pin; tag editor (capped display + "+N more").
- Manual PDF upload only — no external search/import (removed by design; see
  Datasets below for offline sources).

### Datasets
- Upload-only dataset management (CSV/JSON/Parquet/XLSX) — no external
  platform integrations (Kaggle and generic "database" sources were removed).
- Rename, delete, and **Preview** (mock sample-table dialog) per dataset.

### Evidence Map
- Claims grouped by research question, columned by stance
  (Supports/Contradicts/Mixed), each claim showing a confidence bar,
  source paragraph (expandable), and a link back to the source paper.
- Filter chips with live counts; empty states for "no evidence yet" vs.
  "no claims match this filter".

### AI Chat
- Per-workspace chat with a model selector (OpenAI/Gemini/Grok — UI only, no
  real inference) and an "include external literature" toggle.
- Conversation history panel: search, grouping/folders, new chat, new group,
  rename/delete via `⋮`.
- Answers cite sources with confidence bars and offer follow-up-question
  chips that update dynamically per response; file attachments on messages.

### Citations
- Per-paper citation formatting (APA/IEEE/BibTeX).
- Multi-select papers → bulk **Generate with AI** (mock, simulated latency)
  and **Export selected/all**; per-citation Copy + Regenerate once generated.

### Notes
- Per-workspace notes with a history panel (search, grouping, new note/new
  group), multi-section editor (title + markdown body), tags (create/remove),
  group badge, and paper-citation badges.
- Notes do **not** auto-open on navigating to the page — an explicit
  "pick a note" empty state is shown first.

### Paper detail
- Metadata header (venue/year/authors/keywords), status/pin/tags.
- **AI Summary** (mock): generates a structured Intro / Proposed methodology /
  Result / Limitations summary from the paper's own fields.
- **View & annotate**: a document-styled read view of the paper's
  abstract/methodology/dataset/results/limitations, plus a free-form
  annotations list (add/delete) stored per paper.
- Sidebar: linked evidence claims with a jump-back to the Evidence Map.

### Settings
- **Profile** (name/email/mobile/field/affiliation — mock save).
- **Appearance**: light/dark theme, accent color (6 curated presets applied
  app-wide via CSS variables), reduce-motion toggle.
- **AI & chat**: default model, default "include external literature",
  response style.
- **API keys**: bring-your-own-key rows for AI models (OpenAI/Gemini/Grok) and
  for every dataset added — gates the Papers/Datasets import flows until a key
  is set (still entirely client-side/mock; nothing is actually transmitted).
- **Workspace defaults**: default citation format, workspace name length note.
- **Notifications**: digest/alerts toggles, delivery channel (email/mobile),
  digest frequency.
- **Security** (mock password change, 2FA toggle), **Data & privacy** (mock
  export/clear), **Danger zone** (mock account deletion).

### Navigation & shell
- Collapsible sidebar grouped into *Current Workspace* → *Data Collection*
  (Papers, Datasets) → *Research* (Evidence Map, Citations) → *Workspace*
  (AI Chat, Notes); active-item icons pick up the accent color.
- Global `⌘K` command palette (search workspaces/papers, jump to a paper,
  create a workspace).
- Topbar breadcrumb derived from the current route (workspace name → section
  → paper title where applicable).
- Root-level error boundary ("Something went wrong") with **Try again** and
  **Go home**, where "home" resolves to the current workspace's Overview
  (falls back to `/dashboard` outside a workspace).

## Scope & limitations

This is a **prototype for evaluating UX and product scope**, not a
production system:

- **No backend.** All data (papers, workspaces, notes, evidence, chat,
  datasets, annotations, API keys) lives in a single in-memory Zustand store,
  seeded from `src/lib/mock-data.ts`. A full page reload resets everything.
- **No real authentication.** Login/signup/forgot-password/onboarding pages
  exist and are styled, but don't call any auth service; "Sign out" just
  navigates to `/`.
- **No real AI.** Chat responses, AI paper summaries, AI-generated citations,
  and research-health suggestions are deterministic mock content or canned
  strings with a simulated delay — no LLM is called.
- **No real external integrations.** There is no live Kaggle/arXiv/PubMed/etc.
  connection; "API keys" are stored client-side and only gate mock UI flows.
- **No persistence layer.** Nothing survives a reload; there is no database
  migration story to speak of.

## Design system

Theme tokens live in `src/styles.css` as CSS custom properties (light + dark
variants), consumed via Tailwind v4's `@theme`. The accent color is applied by
injecting a `<style>` tag that overrides `--primary`/`--ring`/
`--sidebar-primary`/`--sidebar-ring` for both `:root` and `.dark`, so switching
the accent in Settings updates the whole app instantly without a reload.
