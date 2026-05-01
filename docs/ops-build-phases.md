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
- Anthropic Claude models are not available on Foundry in any region this user can pick from, so v1 runs on Azure OpenAI's GPT-5.4 family instead of Claude Opus 4.7. The env contract still abstracts the deployment (`AZURE_AI_DEPLOYMENT`) so we can swap later without code changes.
- Started on **GPT-5.4 Pro** for stronger tool-call reasoning, then switched to plain **GPT-5.4** post-P9 — Pro's pre-stream thinking added 20–60s of dead time to every chat turn, which broke the "polished as ChatGPT" feel from `core-spec.md` §6. Non-Pro streams the first token within ~1s. The Pro deployment was deleted from Foundry.
- The Foundry endpoint is the `cognitiveservices.azure.com` shape — `@ai-sdk/azure` connects via `baseURL: "${endpoint}/openai"` so the SDK's `/v1{path}` suffix lands on the right route.
- `AZURE_AI_API_VERSION` is **`preview`**, not a dated string. The Azure Responses API used by the GPT-5.4 family only supports the rolling `preview` channel right now (`2024-04-01-preview` returns `BadRequest: API version not supported`).
- Assistant bubbles render through `react-markdown` + `remark-gfm` with `@tailwindcss/typography` for prose styling. Streaming works as expected — token-by-token arrival, composer disabled mid-stream.
- Plan adaptation tool calls land in P8; for now the system prompt explicitly says "plan adjustments are handled by a separate step, not by you".

**Open decisions resolved:**
- Streaming endpoint: route handler at `app/api/chat/route.ts` (over server actions), per the v6 SDK's expected `useChat` transport shape.

## Phase 7 — Daily flows

**Status:** done

**Delivers:** The three flows from `core-spec.md` §3 work end-to-end against a real plan. Check-in and study mode are pure prompt behaviour driven by `buildSystemPrompt` (which describes the rhythm and the active day). Close-out is wired through a single AI SDK tool call: `closeOutDay({ recap, feedback })` defined in `src/app/api/chat/route.ts`, registered only when the active plan still has a pending day. The tool's `execute` calls `completeDay()` in `src/server/plans.ts`, which transactionally sets `status=completed`, stores the model-synthesised `recap` and the user's verbatim `feedback`, and stamps `completedAt`. `streamText` runs with `stopWhen: stepCountIs(3)` so the model can call the tool, receive the result, and emit a brief acknowledgement in the same response. `ChatSurface` watches `useChat`'s `onFinish` for a `tool-closeOutDay` part with `state === "output-available"` and calls `router.refresh()`; the page key is now `${plan.id}:${nextDay.dayNumber}` so the chat surface remounts when the active day advances — discarding the day's working-memory transcript per `core-spec.md` §3.2.

**Notes:**
- Verified end-to-end via Playwright with a seeded smoke user: check-in streamed today's goal/plan, "done — practiced..." triggered `closeOutDay`, the DB row went from `status=pending` to `completed` with a synthesised recap + verbatim feedback + `completedAt`, and the UI rolled forward to "Day 2: Order food in a café" with an empty chat.
- The system prompt (`src/lib/system-prompt.ts`) gates tool use explicitly: "Do NOT call any tool" during check-in/study, and "call `closeOutDay` exactly once" at user signal — `recap` in third person, `feedback` verbatim. Without that gating the model tended to either skip the tool or call it during check-in.
- Plan adaptation tool calls land in P8; `closeOutDay` deliberately does not touch `days` rows beyond marking today complete.

## Phase 8 — Plan adaptation

**Status:** done

**Delivers:** A second AI SDK tool, `adjustUpcomingDays({ summary, days })`, registered alongside `closeOutDay` in `src/app/api/chat/route.ts` whenever the active plan has any pending days. Its `execute` calls `adjustUpcomingDays()` in `src/server/plans.ts`, which transactionally deletes all `pending` Day rows for the plan and recreates them from the model's payload. The server validates that incoming `dayNumber`s are contiguous and start at `maxCompleted + 1`, so completed days are immutable and `originalMarkdown` is never touched. `streamText` now runs with `stopWhen: stepCountIs(5)` so the model can call `closeOutDay`, then `adjustUpcomingDays`, then emit a brief acknowledgement in the same response. `buildSystemPrompt` describes the moderate-vs-aggressive split per `core-spec.md` §4: moderate adjustments (insert catch-up days, reorder, split, merge) are applied directly; aggressive scope (drop topics, rewrite larger sections) must first be proposed in plain chat and only applied after explicit user confirmation in a follow-up turn. The system prompt also lists upcoming days so the model has the full picture before adapting. `ChatSurface`'s `onFinish` triggers `router.refresh()` for either tool's `output-available` part.

**Notes:**
- Smoke-tested via Playwright with a 4-day Spanish plan: closed out Day 1 with feedback that signalled struggle ("teens still really shaky, need more drilling"). The model called `closeOutDay`, then `adjustUpcomingDays` with a new 4-day sequence — inserted "Day 2: Stabilize numbers 1–20" as a catch-up day, with the original days 2–4 pushed back to days 3–5. `originalMarkdown` unchanged in the DB; UI rolled forward to the new Day 2 with empty chat.
- Tool registration uses two `tool()` calls into separate `?: undefined` locals and spreads them into the final `tools` object — typing a single `Record<string, ReturnType<typeof tool>>` collapses the input schemas to `never` and breaks `execute` typing.
- Aggressive-scope confirmation is enforced **only via the system prompt**, not by a server-side gate. The tool itself accepts any contiguous future-day sequence; the model is instructed to delay the call until the user says yes. This keeps the v1 wire simple and matches `core-spec.md` §4 ("requires the LLM to propose the change in chat and get explicit user confirmation").
- The end-to-end response (close-out + adapt + ack) was ~7 minutes wall-clock on GPT-5.4 Pro because of the double tool call. Resolved post-P9 by switching the default deployment to non-Pro GPT-5.4 (see Phase 6 notes); close-out + adapt + ack now completes in seconds.

## Phase 9 — Deploy

**Status:** done

**Delivers:** App Service B1 Linux (`justtoday-app-c67df7`) provisioned in `rg-justtoday/westus3`, co-located with the existing Postgres Flexible Server for low DB latency. Runtime is `NODE:22-lts` with `node server.js` as the startup command, served from Next.js's `output: 'standalone'` bundle. App Service config carries `DATABASE_URL`, `AUTH_SECRET` (fresh prod-only value), `AUTH_URL`, `AUTH_TRUST_HOST=true`, `AUTH_GOOGLE_ID/SECRET`, and the `AZURE_AI_*` quartet. The 37 App Service outbound IPs are added to the Postgres firewall as `appservice-N` rules. `infra/provision.sh` is idempotent — re-running won't duplicate resources.

GitHub Actions workflow (`.github/workflows/deploy.yml`): on push to `main`, install deps, `prisma generate`, `next build`, `prisma migrate deploy`, assemble the standalone bundle (`.next/standalone/` plus `.next/static` and optional `public/`), zip, and deploy via `azure/webapps-deploy@v3` using a publish profile secret. Required GitHub config: variable `AZURE_WEBAPP_NAME`, secrets `AZURE_WEBAPP_PUBLISH_PROFILE` and `DATABASE_URL`.

First production deploy verified: `/` redirects 307 → `/signin`; `/signin` returns 200 with the "Continue with Google" button.

**Notes:**
- App Service basic publishing creds default to **disabled** on new B1 sites — `azure/webapps-deploy@v3` rejects the profile with "Publish profile is invalid for app-name and slot-name provided" until SCM basic auth is re-enabled. Fix: `az resource update ... basicPublishingCredentialsPolicies/scm --set properties.allow=true`, then re-export the publish profile and update the GitHub secret. OIDC federated identity is the more secure long-term option.
- The standalone copy step has to be tolerant of a missing `public/` — the repo doesn't ship one.
- Production Google OAuth redirect URI registered: `https://justtoday-app-c67df7.azurewebsites.net/api/auth/callback/google` (alongside the localhost URI from P3).
- Same Postgres database serves dev and prod for v1; this matches the spec's single-server scope. If/when that changes, dev gets its own DB and the App Service config keeps the prod connection string.
