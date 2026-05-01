# Feature plan — day detail visibility

## Goal

When the user opens the app, "today" is shown as a one-line greeting (`Day N: <goal>`). For plans like the user's coding-interview prep — where Day 1's goal is *"Reactivar C#, Dictionary y el formato de entrevista."* with five concrete topic lines underneath — that single line isn't enough to start studying. The user wants the day's goal *and* its topics visible without typing into chat, both in the empty state and at any later moment in the conversation.

The DB already holds the right content (the LLM produces it during plan import, and adaptation keeps it fresh). This feature is purely about surfacing it in the UI.

## Scope (in)

- **Empty state** on `/`: shows the day's goal and the full topics list, **expanded by default** — no extra tap required to read it.
- **Mid-conversation access**: a compact pill in the chat header (`Day N · <goal>` with a small chevron) that opens a popover containing the same structured goal + topics block. The pill **replaces** the current plain plan-title header.
- The pill truncates the goal with `…` if it doesn't fit; the popover always shows the full goal.
- The popover/empty-state block render the topics as a tight bullet list.

## Scope (out)

- No recap of yesterday in this surface — that stays as a chat response when the user asks for it.
- No history view of past days' recaps / feedback. (Existing data, but a separate feature.)
- No editing of day details from this surface — `days.goal` and `days.topics` are owned by the plan-import flow and the LLM adaptation tool.
- No upcoming-days preview. Today only.
- No progress tracking / per-topic checkboxes.
- No in-header plan switcher on desktop — the sidebar already covers that. On mobile, the existing hamburger drawer (planned in `feature-mobile-friendly-ui.md`) handles plan switching; this feature does not duplicate it.

## Current state

- DB: `prisma/schema.prisma` already has everything needed. `Day.goal` is a non-null string; `Day.topics` is `String[]`. No migration required. Verified against the live DB — Day 1 of "Primeros 30 días de entrevistas técnicas" has a clean goal + 5 specific imperative topics, exactly the shape this feature renders.
- Page: `src/app/(app)/page.tsx` flattens the day into a string before passing it down:
  ```ts
  const greeting = nextDay
    ? `Day ${nextDay.dayNumber}: ${nextDay.goal}`
    : "All days complete. Add a new plan to keep going.";
  ```
  and passes it through `<ChatSurface greeting={greeting} />`. Topics never reach the client.
- Chat surface: `src/components/chat/chat-surface.tsx` renders the `greeting` as a centered single line in the empty state and shows nothing else day-related. Header is just `<h2>{planTitle}</h2>`.

## Approach

### 1. Pass structured day data to the client

Stop flattening the day at the page level. `ChatSurface` accepts:

```ts
type TodayProps = {
  dayNumber: number;
  goal: string;
  topics: string[];
} | null;
```

When `today` is `null` (no pending day, e.g. all days complete), the surface falls back to the existing "All days complete" message and does **not** render the pill.

### 2. `<TodaySummary />` — shared block

A small presentational component used in two places:

- Empty state of the chat surface (rendered inline at the top of the column).
- Body of the popover triggered by the header pill.

Layout:

- Eyebrow: `Day N` in small uppercase tracked text, muted.
- Goal: medium-weight foreground line, slightly larger than body copy.
- Topics: tight bulleted list, body-size, comfortable line-height.
- No card, no border — just whitespace, matching the polish bar in `core-spec.md` §6.

If `topics` is empty, render only eyebrow + goal — no empty bullet list.

### 3. Empty state placement

The current empty-state copy is centered (`pt-12 text-center`). A bulleted list inside a centered block reads awkwardly. Switch to a left-aligned block within the existing `max-w-[720px]` chat column, with generous top padding so it sits roughly in the same vertical region. Goal: feels like the natural first "message" of the day, just without a bubble.

### 4. Header pill + popover

Replaces the plain `<h2>{planTitle}</h2>` in `ChatSurface`'s header.

- Trigger: a button styled as a subtle pill — `Day N · <goal>` with a small `chevron-down` icon (lucide, `size-3`, muted). The goal text uses `truncate` so long goals collapse with `…`. Tooltip-style hover state, no heavy border — keeps the header light.
- Content: `<TodaySummary />` (full goal, full topics).
- Component: shadcn/ui `Popover` (Radix-based). Run `npx shadcn@latest add popover` if not present.
- Dismiss: click outside, Escape, or click the pill again — standard popover behaviour.
- When `today` is `null`, render nothing in the header (or revert to the plan title — pick whichever reads cleaner; recommend nothing, since this case is rare and the sidebar already shows the plan).

### 5. Mobile considerations

The popover sits in the chat header. With ~6–8 lines of content (goal + 5 topic bullets is the realistic max for this user's data) a popover fits on phone widths without overlapping the composer. Default to popover on all viewports. Only swap for a `Sheet` if testing reveals the popover gets clipped on small screens — judgment call during implementation, not a hard requirement.

The hamburger drawer for plan switching is owned by `feature-mobile-friendly-ui.md`; this feature assumes that lands first or in parallel and does not add a separate menu surface.

## Files likely touched

- `src/app/(app)/page.tsx` — pass `today: { dayNumber, goal, topics } | null` instead of `greeting: string`.
- `src/components/chat/chat-surface.tsx` — accept `today` prop, render `<TodaySummary>` in empty state, replace header `<h2>` with the pill + popover.
- `src/components/chat/today-summary.tsx` *(new)* — eyebrow + goal + topic bullets.
- `src/components/chat/today-pill.tsx` *(new)* — header pill button wired to a popover containing `<TodaySummary>`.
- `src/components/ui/popover.tsx` *(new shadcn add — `npx shadcn@latest add popover`)*.

## Acceptance criteria

- Opening `/` on a plan with a pending day shows, in the empty state: `Day N` eyebrow, the full goal, and the topics as a bullet list — no tap required.
- Verified specifically against Day 1 of "Primeros 30 días de entrevistas técnicas": goal *"Reactivar C#, Dictionary y el formato de entrevista."* renders cleanly, all five topics are visible.
- After sending a first message, the empty-state block is gone but a pill `Day N · <goal>` (with chevron) appears in the chat header. Tapping it reveals the same goal + topics block in a popover. Tapping outside or pressing Escape dismisses it.
- Long goals truncate with `…` in the pill; the popover always shows the full goal.
- The pill replaces the plan title in the chat header. Plan switching remains available via the desktop sidebar and (separately) the mobile hamburger drawer.
- When all days are complete, no pill is rendered and the existing "All days complete" copy still shows.
- No new DB calls beyond what `getActivePlan` already returns — `days[]` already carries `goal` and `topics`.
- Verified end-to-end with Playwright MCP using the live coding-interview plan, light + dark, desktop + mobile viewports.

## Notes / nuance

- The system prompt (`src/lib/system-prompt.ts`) already names today's topics for the model. This feature does not change that — we are duplicating that visibility into the UI for the *user*, not changing what the LLM sees.
- Keep the surface read-only. No edit, no expand-all, no recap pre-show, no per-topic checkboxes. The bar is "I can see what I'm supposed to study without typing"; anything beyond that is scope creep.
- Visual restraint: no card backgrounds, no heavy borders. The block should feel like part of the chat column, not a widget bolted onto it.
