# Feature plan — persist the current day's conversation

## Goal

Let a user start the day's chat on their laptop and pick it up on their phone (or vice versa). Today the chat lives only in `useChat`'s in-memory state on the client — refresh the tab and it's gone, switch devices and it's gone. The fix: persist the *active* day's transcript server-side, hydrate it on page load, and append to it as messages stream.

The product rule from `core-spec.md` §3.2 stays: study-mode messages are working memory, not history. So we keep **exactly one transcript per plan** — the in-progress day. When `closeOutDay` fires, the transcript is wiped (we do *not* keep historical day chats).

## Scope (in)

- Persist messages of the active (pending) day for each plan.
- Hydrate `ChatSurface` from the persisted transcript on initial render, so reload / cross-device shows the same conversation.
- Append the full updated transcript after each completed turn.
- Clear the transcript when the day is closed out (via `closeOutDay`) or when day numbers shift in a way that orphans rows.
- One transcript per `(plan, dayNumber)` — the latest pending day. When the day rolls forward, the previous transcript is dropped.

## Scope (out)

- No history of past days' chats. Per `core-spec.md` §3.2 they're explicitly ephemeral; we keep that.
- No cross-plan transcript view, no search, no export.
- No live multi-device sync. Pure last-write-wins: if two devices have the same plan open, whichever one sends a message last clobbers the other's in-flight turns. The user can manually refresh to see the freshest state. We do *not* refetch on `visibilitychange`.
- No persistence of partial / aborted turns. If the assistant stream is interrupted, neither the user prompt nor the (incomplete) assistant turn is persisted — we only write in `onFinish`.
- No pagination. A day's transcript is small enough to fetch in one go.
- No rich content beyond what `UIMessage` already carries (text + tool parts).

## Current state

- Chat surface: `src/components/chat/chat-surface.tsx` — `useChat({...})` with no `messages`/`initialMessages`. State lives in client memory.
- Streaming endpoint: `src/app/api/chat/route.ts` — receives the full `messages` array on each request, calls `streamText`, returns a stream. Nothing is persisted.
- DB models: `prisma/schema.prisma` — `User`, `Plan`, `Day`. No conversation table.
- Day rollover: `closeOutDay` in `src/server/plans.ts` flips status to `completed` and stamps `completedAt`. `adjustUpcomingDays` deletes pending rows and re-creates the upcoming sequence.

## Approach

### Data model

Single JSON blob keyed by `(planId, dayNumber)`:

```prisma
model DayConversation {
  id        String   @id @default(cuid())
  planId    String
  dayNumber Int
  messages  Json     // UIMessage[] serialised as JSON
  updatedAt DateTime @updatedAt

  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, dayNumber])
  @@index([planId])
}
```

We store the AI SDK's `UIMessage[]` shape verbatim (including `parts`, tool-call parts with their `state`/`input`/`output`, etc.). Rationale: trivial to write/read, no per-row migration cost when the SDK shape evolves, and we don't need per-message queries. The shape is opaque to the DB; all interpretation lives in code. Document this coupling in a comment on the model.

### Server endpoints

Hydration is handled by the page server-component — no separate `GET` endpoint. The page loads the active plan's pending-day transcript and forwards it into `ChatSurface` as a prop.

The existing `POST /api/chat` route writes the persisted transcript in its `onFinish` hook (whichever the AI SDK v6 install exposes — `result.toUIMessageStreamResponse({ onFinish })` or `streamText`'s own `onFinish`). The hook receives the full final `UIMessage[]` for the turn (incoming history + new assistant message + any tool parts) and we upsert it into `DayConversation` for the active `(planId, dayNumber)`.

Persist happens *only* in `onFinish` — partial / aborted streams write nothing.

### Client wiring

- `ChatSurface` accepts `initialMessages?: UIMessage[]` and passes it to `useChat({ messages: initialMessages, ... })`.
- The page (`src/app/(app)/page.tsx`) loads the transcript server-side and forwards it.
- ChatSurface keying stays `${plan.id}:${nextDay.dayNumber}` so the surface remounts (and re-hydrates from the new prop) when the active day changes.
- The existing "today summary" empty-state is gated on `messages.length === 0`, so it naturally disappears once the user has chatted in the day.

### Tool-call rehydration

`UIMessage.parts` carries `tool-*` parts with a `state` field (e.g. `output-available`). We persist these as-is. On hydration, the client must guarantee they are *not* re-executed — closing out the day twice on every reload would be catastrophic.

Approach: rely on the part's `state` field. Tool parts that arrive via `initialMessages` already carry a terminal state (`output-available`), and `useChat` should treat them as resolved. Verify this against the v6 install; if `useChat` re-attempts execution for any state, add a thin pre-render guard in `ChatSurface` that maps incoming tool parts into a state the SDK considers terminal before passing them to `useChat`.

We deliberately do **not** strip tool parts on persist — keeping them lets the chat pane render the same tool-call indicators (e.g. "Day closed", adapted-days summary) after a reload.

### Day rollover / clearing

- Inside `completeDay()` (server), in the same transaction: delete the matching `DayConversation` row for `(planId, dayNumber)`. The next pending day starts with an empty transcript naturally.
- Inside `adjustUpcomingDays()`: pending day rows can be wiped and recreated, and their day numbers may shift. Cleanup deletes only `DayConversation` rows whose `dayNumber` does **not** correspond to the *current* pending day after adaptation. Concretely: compute the post-adaptation pending day number for the plan, then delete every `DayConversation` for that plan where `dayNumber` is neither already-completed nor equal to the current pending day. The current day's transcript is preserved across mid-day adaptations.
- All cleanup runs inside the same transaction as the `Day` mutations.

### Edge cases

- **First message of the day** — no row exists yet; `onFinish` upserts and creates it.
- **Streaming aborted mid-turn** — `onFinish` doesn't fire; nothing is persisted, including the user prompt. On reload the user sees the last successfully-completed state.
- **Tool call turns** — persisted as-is; rehydration relies on the `state` field to mark them resolved. See "Tool-call rehydration" above.
- **Two devices open at once** — pure last-write-wins. Whichever device finishes a turn most recently persists its full transcript and overwrites whatever was there. The other device shows stale state until manually refreshed.
- **Mid-day plan adaptation that doesn't shift the current day number** — current day's transcript is preserved (see cleanup rule).
- **Auth** — every transcript read/write scopes by `userId` via the plan ownership join. Don't trust `planId` from the client without verifying ownership.

## Files likely touched

- `prisma/schema.prisma` — add `DayConversation`.
- `prisma/migrations/<new>` — generated.
- `src/server/conversations.ts` *(new)* — `getActiveTranscript(userId)`, `saveTranscript(userId, planId, dayNumber, messages)`, `clearTranscript(planId, dayNumber)`, `clearOrphanedTranscripts(planId, currentDayNumber)` (called inside existing transactions in `plans.ts`).
- `src/server/plans.ts` — `completeDay` and `adjustUpcomingDays` clear transcripts within their existing transactions, following the rules above.
- `src/app/api/chat/route.ts` — persist final `UIMessage[]` in `onFinish` after the stream completes.
- `src/app/(app)/page.tsx` — pre-load transcript for the active plan's pending day and pass to `ChatSurface`.
- `src/components/chat/chat-surface.tsx` — accept `initialMessages` prop and pass to `useChat`; if needed, normalize incoming tool-part state before passing.

## Acceptance criteria

- Send a few messages on laptop, close the tab, reopen on phone → same messages visible, day greeting gone (because there are messages now).
- Same flow but reverse: phone → laptop.
- Close out the day → transcript disappears; the next day starts empty on both devices.
- Mid-day plan adaptation (`adjustUpcomingDays` without `closeOutDay`) preserves the current day's transcript.
- Plan adaptation that bumps the day number does not leave orphaned transcripts.
- Tool-call parts (`tool-closeOutDay`, `tool-adjustUpcomingDays`) survive a reload without being re-executed and still render their visual indicators.
- Aborting a stream mid-turn results in nothing persisted; the prior completed state is what reloads.
- No regressions to the existing streaming UX — first token still arrives in ~1s.

## Risks / things to get right

- The AI SDK's `UIMessage` shape may change between versions; storing it as opaque JSON tightly couples us to the current shape. Documented in a comment on the model — migrating a single JSON column is cheap.
- Tool re-execution on hydration is the riskiest unknown. Verify behavior in v6 before shipping; if `useChat` does try to re-execute, the normalization shim in `ChatSurface` is the mitigation.
- Partial-stream cancellation: confirm we don't persist half a turn. Tested by aborting mid-stream and reloading.
- Last-write-wins is a deliberate choice; if multi-device users hit it often, revisit with a refetch-on-focus or version-token strategy.
- Latency on persist: do it after the response stream closes (in `onFinish`), not blocking the user.
