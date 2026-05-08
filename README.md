# justtoday

A chat-based study tracker that walks you through a learning plan **one day at a time**.

You paste a plan (a markdown outline, a ChatGPT export, or just a few sentences about what you want to learn). The app turns it into a day-by-day sequence, then each day it:

1. Tells you what to study today and recaps what you did yesterday.
2. Acts as a tutor while you work through the topic.
3. Asks for free-text feedback at the end of the day.
4. Adapts the rest of the plan to your pace — inserts catch-up days, splits or reorders upcoming days, etc.

It is built for a single user style of use (one person, multiple plans in parallel — e.g. "Spanish" and "Machine Learning") and aims to feel as polished as ChatGPT or Claude. No dashboards, no charts, no progress gamification — just a chat column and a plan list.

> **Status:** personal project, v1. Built end-to-end; deployed to Azure App Service. Not a maintained product — published as a reference for anyone curious about the architecture.

## How it works

The whole experience is one chat surface. The app infers the mode from context:

- **Check-in** — "what should I study today?" → 2-line recap of yesterday + today's goal.
- **Study mode** — free-form Q&A about today's topic. Streamed token-by-token. Messages are ephemeral; they live in working memory during the session and are summarized into the day record at close-out.
- **Close-out** — user signals "done". The model writes the day's recap + verbatim feedback via a tool call (`closeOutDay`), then optionally calls `adjustUpcomingDays` to adapt the remaining plan. Past days are immutable.

Plans are imported once via the LLM (free-form text → `{ title, days: [{ goal, topics }] }`), shown in an editable preview, and saved. The verbatim original input is kept on the plan record so you can always return to what you started with. Days in the database are the source of truth from then on; adaptations rewrite future-day rows.

For the full product spec, see [`docs/core-spec.md`](./docs/core-spec.md). For the phased build history (commits, decisions, what was learned), see [`docs/ops-build-phases.md`](./docs/ops-build-phases.md).

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (base-ui), `react-markdown` |
| Auth | Auth.js v5 with Google provider, Prisma adapter, database sessions |
| Database | PostgreSQL via Prisma 6 |
| AI | Vercel AI SDK v6 + Azure AI Foundry (default deployment: GPT-5.4) |
| Hosting | Azure App Service B1 (Linux, Node 22), GitHub Actions deploy |

## Project structure

```
src/
  app/
    (app)/              authenticated routes — chat surface, plans/new
    (auth)/signin/      sign-in page
    api/
      auth/             Auth.js handlers
      chat/             streaming chat endpoint (tool calls live here)
      plans/parse/      LLM plan parser (free-form text → structured)
      plans/refine/     "let's define it together" refinement chat
  components/           UI: chat surface, composer, sidebar, plan flow
  lib/                  ai client, auth config, system prompt, Prisma client
  server/               server-only data access (plans, conversations)
prisma/
  schema.prisma         User, Plan, Day, DayConversation, refinement chat
  migrations/
docs/                   product spec + per-feature plans + build phases
infra/provision.sh      idempotent Azure App Service provisioning
.github/workflows/      deploy workflow (zip → App Service)
```

## Local development

### Prerequisites

- Node.js 22+
- A PostgreSQL database (local Postgres works fine; the production deploy uses Azure Database for PostgreSQL Flexible Server)
- Google OAuth credentials (Google Cloud Console → APIs & Services → Credentials)
- An Azure AI Foundry endpoint + key with a chat deployment, **or** another AI SDK provider (the chat client in [`src/lib/ai.ts`](./src/lib/ai.ts) is a thin wrapper — swap `@ai-sdk/azure` for `@ai-sdk/openai` if you'd rather use OpenAI / Ollama / etc.)

### Setup

```bash
# 1. Install
npm install

# 2. Configure env — copy and fill in
cp .env.example .env.local

# 3. Apply schema to your database
npx prisma migrate dev

# 4. Run
npm run dev
```

Then open <http://localhost:3000>. You will be redirected to `/signin` for Google OAuth.

For local OAuth to work, register `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console.

### Environment variables

See [`.env.example`](./.env.example) for the canonical list. Briefly:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `AUTH_SECRET` | Auth.js session token signing key (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client credentials |
| `AZURE_AI_ENDPOINT` / `AZURE_AI_API_KEY` | Azure AI Foundry / Azure OpenAI access |
| `AZURE_AI_DEPLOYMENT` | Deployment name in Foundry (not the underlying model name) |
| `AZURE_AI_API_VERSION` | Use `preview` for the Azure Responses API (required for GPT-5.4+) |

In production (Azure App Service), set `AUTH_URL` to the deployed origin and `AUTH_TRUST_HOST=true`.

## Deployment

The production deploy uses GitHub Actions ([`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)) to build a Next.js standalone bundle and ship it to Azure App Service via publish profile. Migrations run as part of the workflow (`prisma migrate deploy`).

Provisioning the App Service is a one-time `bash infra/provision.sh` (idempotent). See `docs/ops-build-phases.md` Phase 9 for the full deploy story, including the gotcha around App Service basic publishing credentials being disabled by default on B1 plans.

## License

MIT — see [LICENSE](./LICENSE).

---

Built by Manuel Valenzuela.
