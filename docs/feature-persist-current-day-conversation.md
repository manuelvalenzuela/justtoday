# Feature plan — persist the current day's conversation

## Goal

Let a user start the day's chat on their laptop and pick it up on their phone (or vice versa). Today the chat lives only in `useChat`'s in-memory state on the client — refresh the tab and it's gone, switch devices and it's gone. The fix: persist the *active* day's transcript server-side, hydrate it on page load, and append to it as messages stream.

The product rule from `core-spec.md` §3.2 stays: study-mode messages are working memory, not history. So we keep **exactly one transcript per plan** — the in-progress day. When `closeOutDay` fires, the transcript is wiped (we do *not* keep historical day chats).

## Scope (in)

- Persist messages of the active (pending) day for each plan.
- Hydrate `ChatSurface` from the persisted transcript on mount, so the page reload / cross-device case shows the same conversation.
- Append each user turn and each assistant turn to the store as the chat happens.
- Clear the transcript when the day is closed out (via `closeOutDay`) or when the active day otherwise advances (e.g. plan adaptation that bumps the day number).
- One transcript per `(plan, dayNumber)` — the latest pending day. When the day rolls forward, the previous transcript is dropped.

## Scope (out)

- No history of past days' chats. Per `core-spec.md` §3.2 they're explicitly ephemeral; we keep that.
- No cross-plan transcript view, no search, no export.
- No live multi-device sync (two tabs open at once, real-time mirroring). On reload the freshest transcript wins; if both tabs send simultaneously the last write wins. Acceptable for v1 — we are solving "switch devices", not "collaborate with myself".
- No pagination. A day's transcript is small enough to fetch in one go.
- No rich content beyond what `UIMessage` already carries (text + tool parts). We keep the existing shape.

## Current state

- Chat surface: `src/components/chat/chat-surface.tsx` — `useChat({...})` with no `initialMessages`. State lives in client memory.
- Streaming endpoint: `src/app/api/chat/route.ts` — receives the full `messages` array on each request, calls `streamText`, returns a stream. Nothing is persisted.
- DB models: `prisma/schema.prisma` — `User`, `Plan`, `Day`. No conversation table.
- Day rollover: `closeOutDay` in `src/server/plans.ts` flips status to `completed` and stamps `completedAt`. `adjustUpcomingDays` deletes pending rows and re-creates the upcoming sequence. Both should leave the transcript empty for the *new* pending day.

## Approach

### Data model

Two reasonable shapes; recommend the simpler one for v1:

**Option A (recommended) — single JSON blob keyed by `(planId, dayNumber)`.**
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
Pros: trivial to write/read, matches the AI SDK's `UIMessage[]` shape exactly, no per-row migration cost when SDK message shape evolves. Cons: no per-message queries — but we don't need any.

**Option B — one row per message.** Cleaner relational model but it buys nothing here and forces us to reason about ordering, partial appends, and serialisation of tool parts. Skip unless we hit a concrete reason later.

Go with Option A.

### Server endpoints

- `GET /api/chat/transcript` — returns `{ messages: UIMessage[] }` for the *current pending day* of the user's active plan, or `{ messages: [] }` if none. Auth-gated. Used by `ChatSurface` on mount (or, simpler, the page server-component pre-fetches it and passes it in).
- The existing `POST /api/chat` route already receives the full `messages` history each turn. After `streamText` finishes, persist the full updated transcript — simplest path is `result.toUIMessageStreamResponse({ onFinish: async ({ messages: finalMessages }) => persist(...) })` (the AI SDK exposes this hook on the response builder; if it doesn't in our v6 install, use `streamText`'s own `onFinish` and pass the resulting messages back). Persist as `messages = [...incoming, ...assistantMessagesEmittedThisTurn]`.

### Client wiring

- `ChatSurface` accepts an `initialMessages?: UIMessage[]` prop. Pass it into `useChat({ messages: initialMessages, ... })`.
- The page (`src/app/(app)/page.tsx`) loads the transcript server-side and forwards it. Keying stays `${plan.id}:${nextDay.dayNumber}` so the surface remounts (and re-hydrates from the new prop) when the active day changes.

### Day rollover / clearing

- Inside `completeDay()` (server), in the same transaction: delete the matching `DayConversation` row for `(planId, dayNumber)`. The next pending day starts with an empty transcript naturally.
- Inside `adjustUpcomingDays()`: pending days are wiped and recreated, but their day numbers may shift. Conservative move: delete *all* `DayConversation` rows for `(planId, dayNumber > maxCompleted)` in the same transaction. The user's mid-day chat for the *current* pending day is lost if a plan adaptation reshuffles it — but in practice adaptation runs only at close-out, where the transcript was just deleted anyway. So the pure-pending case is rare and acceptable.

### Edge cases

- **First message of the day** — no row exists yet; persist creates it.
- **Streaming aborted mid-turn** — `onFinish` doesn't fire; we only ever persist completed turns, never partial assistant text. Acceptable: the user's prompt is also not persisted in that case, but on reload the full last-completed state shows up.
- **Tool call turns** — `UIMessage.parts` carries `tool-*` parts. We serialise the lot as JSON; the SDK rehydrates them on the client. Confirm `useChat` accepts already-resolved tool parts on `initialMessages` without trying to re-execute. If it does try to re-execute, we strip tool parts before persisting and rely on the natural conversation text. Test this explicitly.
- **Auth** — every transcript read/write must scope by `userId` via the plan ownership join. Don't trust `planId` from the client without verifying ownership.

## Files likely touched

- `prisma/schema.prisma` — add `DayConversation`.
- `prisma/migrations/<new>` — generated.
- `src/server/conversations.ts` *(new)* — `getActiveTranscript(userId)`, `saveTranscript(userId, planId, dayNumber, messages)`, `clearTranscript(planId, dayNumber)` (called inside existing transactions in `plans.ts`).
- `src/server/plans.ts` — `completeDay` and `adjustUpcomingDays` clear transcripts within their existing transactions.
- `src/app/api/chat/route.ts` — persist final messages after `streamText` completes.
- `src/app/(app)/page.tsx` — pre-load transcript and pass to `ChatSurface`.
- `src/components/chat/chat-surface.tsx` — accept `initialMessages` prop and pass to `useChat`.

## Acceptance criteria

- Send a few messages on laptop, close the tab, reopen on phone → same messages visible, day greeting still gone (because there are messages now).
- Same flow but reverse: phone → laptop.
- Close out the day → transcript disappears; the next day starts empty on both devices.
- A plan adaptation that shifts day numbers does not leave orphaned transcripts.
- Tool-call parts (`tool-closeOutDay`, `tool-adjustUpcomingDays`) survive a reload without being re-executed.
- No regressions to the existing streaming UX — first token still arrives in ~1s.

## Risks / things to get right

- The AI SDK's `UIMessage` shape may change between versions; storing it as opaque JSON tightly couples us to the current shape. Document this in a comment on the model and accept the cost — migrating a single JSON column is cheap.
- Partial-stream cancellation: confirm we don't persist half a turn. Tested by aborting mid-stream and reloading.
- Latency on persist: do it after the response stream closes, not blocking the user. `onFinish` is the right hook.
