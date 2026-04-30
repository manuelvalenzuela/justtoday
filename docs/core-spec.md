# justtoday — core spec (v1)

A chat-based web app that walks a user through a study plan **one day at a time**. Users load a markdown plan, the app shows what to do today plus a recap of yesterday, runs a study-mode Q&A session, then takes free-text end-of-day feedback and adapts the remaining plan.

The guiding principle is *small and lightweight*. Anything not in this document is out of scope for v1.

---

## 1. Users & auth

- Multi-user. Each user has their own plans and history.
- Login via **Google** (Auth.js / NextAuth). No email/password, no other social providers in v1.
- Users are persisted in Postgres.

## 2. Plans

### 2.1 Input

The user pastes (or uploads) **arbitrary text** describing their plan — a structured markdown outline, a ChatGPT export, a list of topics, or just a few sentences. The LLM converts that input into the canonical day-by-day shape: `{ title, days: [{ dayNumber, goal, topics[] }] }`. The user then sees that shape in an **editable preview** (title, day cards with goal + topics, add/remove/reorder days, add/remove topics) and confirms by saving. The verbatim original input is stored on the plan record so the user can always return to it.

There is no required input format — markdown with `## Day N` / `**Goal:**` works fine but is not special-cased.

### 2.2 Multiple plans

- A user can have multiple plans (e.g. "Spanish" and "Machine Learning") running in parallel.
- One plan is **active** at a time; the user can switch.

### 2.3 Input is import-only; the database is the source of truth

- The free-form input is parsed once via the LLM, the user edits the preview, and from then on the rows in the `days` table are the canonical state.
- The **verbatim original input** is stored on the plan record so the user can always compare to what they started with.
- Adaptations modify rows in `days` directly. There is no "current plan" textual field — if the UI ever needs to show the current plan as text, it's rendered on-the-fly from `days`.
- Why this split: users can author plans wherever they like (Notion, Obsidian, ChatGPT output) and own a portable file outside the app, while the app avoids the pain of round-tripping edits through any specific input format.

## 3. Daily flows

The whole experience is a chat. The app determines the mode from context.

### 3.1 Check-in

When the user asks "what should I study today?" (or similar), the app responds with:

- **Yesterday recap** — 2–3 lines: objectives vs. what was accomplished.
- **Today** — 2 lines: the plan and the goal.

If there is no previous day (first day of plan), only "Today" is shown.

### 3.2 Study mode

- Triggered when the user starts the day's session ("let's start", "I'm ready", etc.).
- Free-form Q&A about the day's topic, powered by the LLM.
- Stays in this mode until the user signals they're done ("done", "finish day", etc.).
- Study-mode messages are **ephemeral** — kept in working memory during the session, summarized into the day record at close-out, then discarded.

### 3.3 Close-out

- The user provides free-text feedback. Can be as minimal as `done`, or a longer reflection.
- The LLM combines the feedback with the session summary, writes the day record (objectives, accomplishments, learnings), and runs plan adaptation.
- The day is marked complete and becomes immutable history.

## 4. Plan adaptation

Adaptation runs at the end of each day, after close-out feedback.

- **Default scope: moderate.** The LLM may insert catch-up/review days, reorder, split, or merge upcoming days based on the user's pace.
- **Aggressive scope** (rewriting larger sections, dropping topics it judges unnecessary) requires the LLM to **propose the change in chat and get explicit user confirmation** before applying it.
- **Past days are immutable.** Only future days can change.
- The original plan is always preserved separately so the user can compare.

## 5. Data model (sketch)

Minimum viable tables:

- `users` — id, google identifier, email, display name.
- `plans` — id, user_id, title, original_markdown (immutable verbatim input), active flag, created_at.
- `days` — id, plan_id, day_number, status (pending / completed), goal, topics, recap, feedback, completed_at. **This table is the source of truth for the current plan;** adaptations write here.

Refine during implementation; this is a sketch, not a contract.

## 6. UX & UI

The app must **feel as polished as ChatGPT or Claude**. "Lightweight" refers to scope, not visual quality.

- **Layout:** centered chat column, max-width ~720px, generous whitespace. Left sidebar to switch between plans, collapsible on mobile.
- **Streaming:** LLM responses stream token-by-token; never block on full completion before showing text.
- **Markdown rendering** for LLM output (recap, plan display, study-mode answers).
- **Light/dark mode**, subtle message fade-in, minimal motion.
- **No dashboards, no charts, no visual noise.** If a UI element wouldn't look at home in ChatGPT, it doesn't belong here.

UI tooling:

| Concern | Choice |
|---|---|
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix-based, copy-paste, no lock-in) |
| Chat streaming | Vercel AI SDK (`useChat`) |
| Markdown | `react-markdown` |

## 7. Tech stack

| Layer | Choice |
|---|---|
| App | Next.js + TypeScript |
| Auth | Auth.js (NextAuth) with Google provider |
| Database | Azure Database for PostgreSQL Flexible Server (Burstable B1ms) |
| Hosting | Azure App Service B1 |
| AI | Azure AI Foundry — default model **Claude Opus 4.7**, configurable via env var |

## 8. Deployment

- Single Next.js deploy to Azure App Service via GitHub Actions zip deploy.
- Postgres provisioned as a separate Azure resource; connection string in App Service config.
- Azure AI Foundry endpoint + key + model name in App Service config.
- Expected monthly cost: ~$35–50, comfortably within the user's $150/month Azure credits.

## 9. Out of scope for v1

These are explicitly **not** in v1. They may become future feature plans (separate docs in this folder).

- Persisting study-mode chat history beyond the day's session.
- Plan editing UI (manual edits to the markdown beyond uploading a new version).
- Sharing plans between users.
- Mobile-specific UI.
- Notifications / reminders.
- Analytics / progress dashboards.
- Export of history.
- Multiple authentication providers.
