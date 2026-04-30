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

**Status:** done

**Delivers:** Auth.js v5 (`next-auth@beta`) wired with the Google provider and the Prisma adapter; database session strategy. `Account`, `Session`, and `VerificationToken` models added to `prisma/schema.prisma` (migration `20260428144750_add_auth`). `/signin` lives in an `(auth)` route group and renders a single "Continue with Google" button; the rest of the app lives under an `(app)` route group whose layout calls `auth()` and `redirect("/signin")` for unauthenticated requests. The sidebar footer now shows the user's avatar, name, email, theme toggle, and a sign-out button (server action calling `signOut`).

**Notes:**
- Env contract is now `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — see `.env.example`.
- `next.config.ts` now allows remote images from `lh3.googleusercontent.com` so Google profile photos render through `next/image`.
- Smoke-tested: `GET /` returns a 307 redirect to `/signin`; `/signin` returns 200 with the expected markers. Full Google OAuth round-trip is browser-only and is the user's job to verify the first time.
- Authorized redirect URI registered in Google Cloud Console: `http://localhost:3000/api/auth/callback/google`. Production URI gets added in P9.

## Phase 4 — Plan import

**Status:** done

**Delivers:** `src/lib/markdown.ts` parses the plan format from `core-spec.md` §2.1 into `{ title, days: [{ dayNumber, goal, topics }] }` with `PlanParseError` on malformed input. `src/server/plans.ts` exposes `createPlan(userId, markdown)` (transactionally inserts a `Plan` and its `Day` rows) and `listPlansForUser(userId)`. The `/plans/new` route renders an import form (paste-or-upload + textarea) wired to a server action; on success it `revalidatePath` and redirects to `/`. The sidebar pre-fetches plans in `(app)/layout.tsx` and shows them with a "New plan" link in the header. Auth.js now exposes `session.user.id` via a session callback plus a `next-auth.d.ts` module augmentation.

**Notes:**
- Smoke-tested end-to-end via Playwright MCP: pasted a 3-day Spanish plan, hit Create, landed on `/` with the plan in the sidebar, verified `Plan` + 3 `Day` rows in the DB. Cleaned up the synthetic user afterwards.
- The Azure Postgres firewall rule had to be updated to the current dev IP — server-side IP allowlists drift any time the dev machine moves networks.
- Plan items in the sidebar are plain rows for now; switching/linking happens in P5 alongside the chat shell.
- shadcn's base-nova `Button` does not support `asChild`; for `<Link>`-as-button use `buttonVariants()` to apply the styles.

## Phase 5 — Chat shell

**Status:** done

**Delivers:** Main column is now a chat surface. `ChatSurface` (client) holds local `{ id, role, content }[]` state — streaming-ready shape that lines up with the Vercel AI SDK's `Message` type. `Composer` is a centered, rounded auto-grow textarea with a circular Send button (Enter to send, Shift+Enter for newline). User messages render as right-aligned subtle bubbles; assistant messages render as plain left-aligned text — Claude-style. Empty state shows the active day's `Day N: <goal>` as a centered greeting. Header above the chat shows the active plan title. Sidebar plan items are now form buttons hitting `setActivePlanAction`; the active plan is visually highlighted. `createPlan` deactivates other plans on insert so there's always exactly one active. Switching plans remounts the chat surface (`key={plan.id}`) so messages don't bleed across plans.

**Notes:**
- No LLM call yet — sending appends a stub `(LLM responses arrive in Phase 6.)` assistant message. P6 swaps the stub for a streamed Vercel AI SDK call.
- Smoke-tested via Playwright with two seeded plans: send → bubble appears, switch plans → header + highlight update, chat resets to the new plan's day greeting. Verified light + dark.
- `Composer` is a `forwardRef` exposing `focus()` so P6 can pull focus back after a send.

## Phase 6 — AI wiring

**Status:** done

**Delivers:** Vercel AI SDK v6 (`ai`, `@ai-sdk/azure`, `@ai-sdk/react`) installed. `src/lib/ai.ts` lazily builds an Azure OpenAI provider from `AZURE_AI_ENDPOINT` + `AZURE_AI_API_KEY` + `AZURE_AI_DEPLOYMENT` + `AZURE_AI_API_VERSION` (lazy so builds don't need the key). `src/app/api/chat/route.ts` is the streaming endpoint: authenticates via Auth.js, fetches the active plan, builds the system prompt, converts UIMessages to model messages, and returns `result.toUIMessageStreamResponse()`. `ChatSurface` swapped from local state to `useChat` (`@ai-sdk/react`) over a `DefaultChatTransport` pointed at `/api/chat`; composer is disabled while `status` is `submitted`/`streaming` and surfaces transport errors inline. `src/lib/system-prompt.ts` builds the persona — short/warm tone, daily rhythm (check-in / study / close-out), today's day + goal + topics, and a hint about the most recent completed day.

**Notes:**
- Anthropic Claude models are not available on Foundry in any region this user can pick from, so the v1 default model is **GPT-5.4 Pro** instead of Claude Opus 4.7. The env contract still abstracts the deployment so we can swap later without code changes.
- The Foundry endpoint is the `cognitiveservices.azure.com` shape — `@ai-sdk/azure` connects via `baseURL: "${endpoint}/openai"` so the SDK's `/v1{path}` suffix lands on the right route.
- `AZURE_AI_API_VERSION` is **`preview`**, not a dated string. GPT-5.4 Pro is served via the Azure Responses API, which only the rolling `preview` channel supports right now (`2024-04-01-preview` returns `BadRequest: API version not supported`).
- Assistant bubbles render through `react-markdown` + `remark-gfm` with `@tailwindcss/typography` for prose styling. Streaming works as expected — token-by-token arrival, composer disabled mid-stream.
- Plan adaptation tool calls land in P8; for now the system prompt explicitly says "plan adjustments are handled by a separate step, not by you".

**Open decisions resolved:**
- Streaming endpoint: route handler at `app/api/chat/route.ts` (over server actions), per the v6 SDK's expected `useChat` transport shape.

## Phase 7 — Daily flows

**Status:** pending

**Delivers:** The three flows from `core-spec.md` §3 work end-to-end against a real plan: check-in (yesterday recap + today's goal & plan), study mode (free-form Q&A until the user signals done), and close-out (free-text feedback that writes the day record and marks the day complete). Mode switching is driven by the model's tool calls or context, not hard-coded UI states.

## Phase 8 — Plan adaptation

**Status:** pending

**Delivers:** At close-out, the LLM proposes plan adjustments to the **future** days only. Default is the *moderate* scope (insert catch-up days, reorder, split, merge). The *aggressive* scope (drop topics, full rewrite) is gated behind an explicit confirmation step in chat per `core-spec.md` §4. `original_markdown` stays untouched; only `days` rows are updated.

## Phase 9 — Deploy

**Status:** pending

**Delivers:** App Service B1 provisioned and configured. Postgres Flexible Server (Burstable B1ms) provisioned. Connection string, Auth.js secrets, Google OAuth credentials, and Azure AI Foundry endpoint/key/model wired through App Service config. GitHub Actions workflow runs `npm run build` and zip-deploys to App Service on merges to `main`. First production deploy verified.
