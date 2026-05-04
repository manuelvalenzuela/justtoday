# Feature plan — plan refinement

## Goal

Today the new-plan flow is one shot: paste/upload text → LLM emits a structured plan → user edits day cards → save. The user has no way to **reframe their intent** after seeing the proposal, no signal about **how long** the plan should be when they didn't say, and no path to **co-author** the plan with the LLM when their input is too thin to produce a good first draft.

This feature adds three related capabilities to the new-plan flow:

1. **Reframing the original input** from the preview screen — tweak text (or replace the source file) and re-run the conversion without losing context.
2. **Surfacing plan length** (number of days) explicitly, with the LLM proposing one when the user didn't specify, and treated as an editable target.
3. **A "let's define it together" path** — a focused refinement chat that produces a better-shaped plan when the user's raw input isn't enough on its own.

## Scope (in)

- Preview screen shows the **original input as an inline editable textarea** at the top, plus a persistent **Upload .md file** action that replaces its contents.
- Edits to the original input require an explicit **Re-run conversion** button to re-stream a fresh draft. No auto-trigger on typing.
- Plan length (`days`) shown as a first-class numeric field next to the title on the preview, with a **Re-shape** action that re-streams the plan at the new target length. Treated as an independent target — diverges visibly from the card count when the user manually adds/removes cards.
- New entry point on the input phase: a second button **Let's define it together** alongside Convert (equal visual weight; both presented as neutral choices).
- Refinement chat phase scoped to plan-shaping. Soft cap of **3 user turns**, after which the LLM stops asking new questions and the **Generate plan** action is emphasized. Generate plan is available from the first turn.
- The refinement conversation is **persisted** alongside the plan and surfaced after save (e.g. "View refinement conversation" affordance from the preview / plan view — exact placement to finalize during implementation).
- After Generate plan, the LLM produces a **summary of the conversation** that becomes both the input to the structured-output step and the value stored on `plans.original_markdown`.
- Confirm dialog before any regeneration (Re-run conversion, Re-shape) when the local draft has been edited, to prevent silent loss of edits.

## Scope (out)

- No changes to the day-card editor itself (goal, topics, reorder, add/remove). That UI stays as-is.
- No threshold-based modes for the original-input editor — single inline editable mode regardless of size.
- No persistence of partial state between phases beyond what already exists (textarea content survives back-navigation).
- No multi-turn revision *after* save — that's plan adaptation (already specced).
- No model picker, no "regenerate with a different style," no templates.
- No feature flag — ships directly to `/plans/new`.

## Current state

- `src/components/plans/new-plan-flow.tsx` is a two-phase client component: `input` → `preview`.
  - Input phase: textarea + Upload button that reads a file into the textarea. Single **Convert** button.
  - Convert calls `useObject({ api: "/api/plans/parse" })` which streams a structured `{ title, days[] }`.
  - Preview phase: title + day cards, all editable; Save calls `savePlanAction(input, draft)`.
- The verbatim input is preserved end-to-end — `savePlanAction` receives `input` and stores it on `plans.original_markdown` (per `core-spec.md` §2.3).
- Day count is implicit (`draft.days.length`); no "how many days" field anywhere in the UI or the LLM prompt.
- Back from preview clears the draft and returns to input; the textarea content is preserved.

## Approach

### Phase machine

`input` → (`refine` →)? `preview`. The `refine` phase is optional and only entered via the new button.

### 1. Reframe original input from preview

On the preview screen, render the original input as a collapsible block at the **top**, above the title field.

- The block contains an **inline editable textarea** with the original input. No size threshold — same UI regardless of length; the textarea scrolls internally if the content is long.
- A persistent **Upload .md file** button (visible whenever the block is expanded) replaces the textarea contents with the contents of an uploaded file. Always available, regardless of current size.
- A **Re-run conversion** button below the textarea triggers a fresh stream from `/api/plans/parse` with the edited input (and the current `days` target). Replaces the current draft.
- **Collapsed by default** after a successful first parse, to keep the day cards visually dominant. **Expanded automatically** if the user just edited the input (so they can see what they sent).
- No auto-trigger on typing — re-runs always require an explicit button click.

### 2. Plan length (days) as an editable target

On the preview, next to the title field, render a small numeric input labeled **Length** with a "days" suffix.

- The LLM `/api/plans/parse` prompt accepts an optional `days` target. When present, the model **must** produce a plan of exactly that length. When absent, it proposes one — inferring a sensible length from intent ("learn the basics of X" → small, "structured month-long course" → ~30) — and surfaces it in the preview.
- A **Re-shape** button next to the field triggers a re-stream with the new target length. Distinct from manual add/remove on day cards.
- The days target is **independent** of the card count. When they diverge (because the user added or removed cards manually), the field renders inline drift indication, e.g. `7 days (actual: 8)`. The user can resolve by editing the field and clicking Re-shape, or by adjusting cards, or ignore and save as-is.
- The days field never auto-updates from card count and the card count never auto-updates from the field. Mutations are explicit on both sides.

### 3. "Let's define it together" — refinement chat path

Two buttons on the input phase, **equal visual weight**, presented as a neutral choice between two paths:

- **Convert** → existing structured-output path (unchanged).
- **Let's define it together** → enters the `refine` phase.

The `Let's define it together` button is **disabled until the textarea has content** (with a hint in the placeholder: "describe briefly what you want to learn"). The chat does not start from a blank slate; it always has the user's initial input as seed context.

#### Chat UI

- Same chat aesthetic as the main app (reuse `Message` and `Composer` components), centered max-w-720px.
- The original input is fed as the **first user turn** so the LLM has context.
- LLM system prompt scoped narrowly to plan-shaping: ask 1–2 targeted questions per turn (length, prior knowledge, emphasis, format), do not produce the plan until asked, do not drift into general chat.
- Persistent footer with two actions:
  - **Generate plan** (primary) — always available from turn 1.
  - **Back** — returns to the input phase with the original textarea contents intact.

#### Convergence — soft cap of 3 user turns

Starting target: **3 user turns**. After the third user turn:

- The LLM stops asking new clarifying questions (system prompt instructs it to wrap up — e.g. "we have enough; ready to generate when you are").
- The **Generate plan** button is visually emphasized in the footer.
- The user can keep chatting if they want; the cap is soft, not enforced.

3 is a starting point, not load-bearing — easy to tune after seeing real usage.

#### Generate plan handoff

When the user clicks **Generate plan**:

1. The LLM produces a **summary** of the conversation — what the user wants, length, emphasis, constraints — as a clean text artifact.
2. That summary is sent to `/api/plans/parse` as the input (no transcript, no raw original input).
3. The user lands in the preview phase with the streamed structured plan, exactly as they would via the direct path.
4. On save, the **summary** is what gets persisted on `plans.original_markdown`. The user's raw initial input is not preserved — the refined summary is the canonical artifact going forward.

This is a deliberate change from current core-spec behavior, which stores verbatim input. Update `core-spec.md` §2.3 when this lands.

#### Persisting the conversation

The full refinement conversation is persisted alongside the plan, in a new table (`plan_refinement_chats` or similar — schema during implementation). Surfaced from the preview / plan view via a "View refinement conversation" affordance so the user can revisit why certain decisions were made.

This is an additive persistence mechanism — does not change the contract that `plans.original_markdown` holds the canonical input.

### Loss prevention on regeneration

Both **Re-run conversion** and **Re-shape** discard the current draft and re-stream from the LLM. If the user has edited the draft locally (changed a goal, added a topic, reordered, etc.), trigger a **confirm dialog** before regenerating:

> "This will replace the current plan, including your edits. Continue?"

Detect "has local edits" by comparing the current draft against the last LLM-produced version. Track a "dirty since last stream" flag.

## Files likely touched

- `src/components/plans/new-plan-flow.tsx` — phase machine gains `refine`; input phase gains the second button; preview gains the original-input block, days field, drift indicator, and confirm-before-regenerate logic.
- New: `src/components/plans/refine-chat.tsx` — the refinement chat surface. Reuses `Message` and `Composer`.
- `src/app/api/plans/parse/route.ts` (or wherever the streaming endpoint lives — confirm path during implementation) — accept optional `days` parameter; update system prompt to honor it and infer-when-missing.
- New: `src/app/api/plans/refine/route.ts` — streaming chat endpoint for the refinement phase. Returns plain assistant turns; not structured.
- New: `src/app/api/plans/refine/summarize/route.ts` (or similar) — produces the conversation summary at Generate plan time. Could also be inlined into the parse route as a pre-step.
- `src/app/(app)/plans/new/actions.ts` — `savePlanAction` may grow to accept the refinement conversation payload for persistence.
- `src/lib/plan-schema.ts` — possibly add `days` to the structured output schema (or keep as `days.length`; decide during implementation).
- New table for refinement conversations — migration to add.
- `docs/core-spec.md` — amend §2.3 to describe the refinement-summary behavior for `original_markdown`.

## Acceptance criteria

- The input phase shows two buttons of equal visual weight: **Convert** and **Let's define it together**. The latter is disabled until the textarea has content; the placeholder hints to write a brief description first.
- The preview shows the original input as a collapsible block at the top, with an inline editable textarea and a persistent **Upload .md file** action. Block is collapsed by default after first parse, expanded if just edited.
- The preview shows a **Length** field next to the title, populated by the LLM's proposal when not explicit in the input. Editing it and clicking **Re-shape** re-streams the plan at the new length.
- When the days target and the actual card count diverge, the field shows the drift inline (e.g. `7 days (actual: 8)`). No auto-syncing in either direction.
- Re-run conversion and Re-shape both prompt for confirmation if the draft has been locally edited. Without local edits, no confirm.
- Clicking **Let's define it together** opens a chat scoped to plan-shaping. The user's input from the textarea seeds the conversation as the first turn. After 3 user turns the LLM stops asking new questions and Generate plan is emphasized; the user can keep chatting if they want.
- Clicking **Generate plan** produces a conversation summary, sends it to the parse endpoint, and lands the user in the preview with a streamed plan — same UI as the direct path.
- Saving the plan after refinement persists the **summary** as `original_markdown` and stores the full conversation in the refinement-chat table. The conversation is accessible later from the plan/preview.
- **Back** from the refinement chat returns to the input phase with the original textarea content intact.
- No regression to the direct Convert path: existing one-shot users see no change in their flow except the addition of the second button alongside Convert.

## Risks / things to get right

- **Loss of user edits on regenerate**: the confirm dialog is the safety net. Make sure "has local edits" detection is robust (don't false-positive on streaming-completion equality, don't false-negative on whitespace-only changes).
- **Days target vs card count drift**: the inline drift indicator must be visible enough to notice but not alarming. A small muted suffix is the bar.
- **Refinement chat scope creep**: the system prompt has to keep the LLM on rails. "Ask 1–2 targeted questions per turn, do not produce the plan until asked, do not drift into general chat." Validate empirically — if the model wanders, tighten the prompt before tuning the cap.
- **Cost**: refinement adds two extra LLM round-trips before the structured-output call (the chat itself + the summarization). Acceptable for a one-time onboarding action; flag if it grows.
- **Verbatim original is lost on the refinement path**: this is a deliberate spec change from §2.3. Document in core-spec when this ships. If the trade-off proves wrong in practice, adding a `original_input_raw` column later is cheap.
- **Persistence of refinement chats**: new table, new query path, and a UI affordance to surface it later. Keep the schema minimal (`id`, `plan_id`, `turns` JSON, `created_at`) — don't over-design.
- **Soft cap of 3 turns**: a starting point. Watch real usage. If the model is converging faster, drop to 2; if users want more space, raise to 4–5.
- **Mobile**: the refinement chat reuses Message/Composer so it inherits mobile behavior. The preview-screen original-input textarea needs to play nicely with the existing mobile layout — verify with Playwright MCP.
