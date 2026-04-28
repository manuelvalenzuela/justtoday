# Build phases (v1)

The v1 build is broken into nine phases. Each phase is a coherent slice that ends with a working, type-checked, dev-server-verified state and a single commit. We complete one phase before starting the next.

This doc is the source of truth for phase scope and status. Update the status line and the **Notes** of a phase as it lands; do not retroactively rewrite the deliverables.

## Status legend

- `pending` — not started.
- `in progress` — currently being built.
- `done` — merged on `main`.

---

## Phase 1 — Project skeleton

**Status:** done (commit `83f303a`)

**Delivers:** Next.js 16 + TypeScript + Tailwind v4 + ESLint scaffolded with App Router, `src/` layout, and the `@/*` alias. shadcn/ui initialized with the base-nova preset (neutral base color, base-ui primitives, Lucide icons, Geist font). `next-themes` wired through a `ThemeProvider` for system / light / dark. A minimal app shell renders: left sidebar with a "Plans" placeholder and theme toggle, plus a centered main column with a "Today" placeholder.

**Notes:** shadcn 4.5+ defaults to `@base-ui/react` instead of Radix — same team as Radix, no functional difference for us. Verified via `npm run build` and a dev-server smoke test (HTTP 200, all markers present in the rendered HTML).

## Phase 2 — Database & schema

**Status:** done

**Delivers:** Prisma 6 installed (`prisma` dev + `@prisma/client` runtime). `prisma/schema.prisma` defines `User`, `Plan`, and `Day` models with cuid IDs (Auth.js-compatible), a `DayStatus` enum, and the indexes/uniques required by `core-spec.md` §5. `src/lib/db/index.ts` exports a typed Prisma client using the standard Next.js singleton pattern. `.env.example` documents the `DATABASE_URL` shape for both local and Azure connections. Initial migration (`prisma/migrations/20260428143529_init`) generated and applied against the live Azure DB.

**Live infrastructure:**
- Resource group: `rg-justtoday` in West US 3 (West US 2 is offer-restricted for Visual Studio Enterprise subscriptions; tried that first).
- Postgres Flexible Server: Burstable B1ms, version 16, 32 GB. Hostname captured in local `.env`, secrets in password manager.
- App database: `justtoday` (alongside the default `postgres` DB).
- Firewall: Azure services + the dev machine's public IP. Production App Service IP gets added in P9.

**Notes:**
- Initially installed Prisma 7, hit its new `prisma.config.ts` + adapter requirement (`url = env(...)` no longer allowed inline), and downgraded to Prisma 6 to keep config simple. Worth revisiting Prisma 7 later but not in v1.
- One-time `Microsoft.DBforPostgreSQL` resource provider registration was required on the subscription before the first server create.

## Phase 3 — Auth

**Status:** pending

**Delivers:** Auth.js (NextAuth) configured with the Google provider. Session storage via the Prisma adapter. A simple `/signin` page in an `(auth)` route group. The `(app)` route group is gated so unauthenticated users redirect to signin. App shell shows the current user's avatar and a sign-out action.

## Phase 4 — Plan import

**Status:** pending

**Delivers:** `src/lib/markdown.ts` parses the plan format from `core-spec.md` §2.1 into structured days. A "New plan" screen accepts a paste or file upload, validates, persists `original_markdown` on the plan and one row per day. Newly imported plans appear in the sidebar.

## Phase 5 — Chat shell

**Status:** pending

**Delivers:** The main column becomes a chat surface — message list with streaming-ready bubbles, composer at the bottom, basic message styling. Sidebar lists real plans from the DB and lets the user switch the active plan. No LLM yet; chat is purely local state at this point.

## Phase 6 — AI wiring

**Status:** pending

**Delivers:** Vercel AI SDK installed and pointed at Azure AI Foundry. Default model is `claude-opus-4-7`, configurable via env var per `core-spec.md` §7. The chat surface streams responses from the model. System prompt establishes the app's persona and the day-by-day rhythm.

**Open decisions:**
- Streaming endpoint shape — App Router route handler (`app/api/chat/route.ts`) vs a server action. Both are supported by the Vercel AI SDK; route handler is the more conventional choice for streaming.

## Phase 7 — Daily flows

**Status:** pending

**Delivers:** The three flows from `core-spec.md` §3 work end-to-end against a real plan: check-in (yesterday recap + today's goal & plan), study mode (free-form Q&A until the user signals done), and close-out (free-text feedback that writes the day record and marks the day complete). Mode switching is driven by the model's tool calls or context, not hard-coded UI states.

## Phase 8 — Plan adaptation

**Status:** pending

**Delivers:** At close-out, the LLM proposes plan adjustments to the **future** days only. Default is the *moderate* scope (insert catch-up days, reorder, split, merge). The *aggressive* scope (drop topics, full rewrite) is gated behind an explicit confirmation step in chat per `core-spec.md` §4. `original_markdown` stays untouched; only `days` rows are updated.

## Phase 9 — Deploy

**Status:** pending

**Delivers:** App Service B1 provisioned and configured. Postgres Flexible Server (Burstable B1ms) provisioned. Connection string, Auth.js secrets, Google OAuth credentials, and Azure AI Foundry endpoint/key/model wired through App Service config. GitHub Actions workflow runs `npm run build` and zip-deploys to App Service on merges to `main`. First production deploy verified.
