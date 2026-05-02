# Bug — assistant messages disappear when rehydrating the chat on another device

## Symptom

Open a plan on phone, send a message, get a streamed response, see both messages in the chat. Open the same plan on a laptop (or refresh the same tab) — only the user's message shows. The assistant's response is gone. After several turns, the desktop view shows every user message but only the **first** assistant response; everything after is missing.

The user's messages are never lost. Only assistant responses past the first one disappear on rehydrate.

## Root cause

Two pieces interact to produce the bug:

### 1. Persisted assistant messages are saved with `id = ""`

`src/app/api/chat/route.ts:130` calls `result.toUIMessageStreamResponse({ originalMessages, onFinish })` **without** `generateMessageId`.

In the AI SDK v6 (`ai@6.x`):

- `node_modules/ai/dist/index.js` — `getResponseUIMessageId` returns `undefined` when `responseMessageId` (i.e. `generateMessageId`) is not provided and the last original message is a user message (which is always the case for us).
- `handleUIMessageStreamFinish` then initializes the streaming state with `messageId: messageId != null ? messageId : ""`.
- The "start" chunk handler only overwrites `state.message.id` when `chunk.messageId != null` — and since nothing assigned it, the assistant message stays at `id = ""`.
- `onFinish` receives `messages: [...originalMessages, state.message]`, so what we persist via `saveTranscript` is `[user(real_id), assistant(id="")]`.

Every assistant turn we've ever saved has `id = ""`. The user messages are fine because `useChat` generates real client-side ids before sending.

### 2. Our render-side dedupe drops messages that share an id

`src/components/chat/chat-surface.tsx:102-109` filters out any message whose id we've already seen:

```ts
const renderedMessages = useMemo(() => {
  const seen = new Set<string>();
  return messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}, [messages]);
```

This was added in commit `2fe9061` to silence a "Encountered two children with the same key" React warning. The warning was a real signal — that very signal was assistant messages all colliding on `id = ""` — but we treated the symptom (warning) instead of the cause (empty ids).

After multiple turns, the persisted transcript looks like:

```
[ user1(id_real), assistant1(id=""), user2(id_real), assistant2(id=""), ... ]
```

On the live phone session, only one assistant message exists at a time (id=""), so the dedupe is a no-op and everything renders. On a different device (or after refresh), `getActiveTranscript` rehydrates the full transcript and the dedupe walks it:

1. `user1` — id real, kept, `""` not in `seen`.
2. `assistant1` — id `""`, kept, adds `""` to `seen`.
3. `user2` — id real, kept.
4. `assistant2` — id `""`, **already in `seen`** → dropped.
5. ...every subsequent assistant message dropped the same way.

That's why mobile shows everything, desktop drops the responses.

## Proposed fix

Three coordinated changes:

### 1. Generate real ids for assistant responses (`src/app/api/chat/route.ts`)

Pass `generateMessageId: generateId` (re-exported from `"ai"`) to `toUIMessageStreamResponse`. From this point on, every persisted assistant message has a unique id.

### 2. Backfill empty ids when rehydrating (`src/server/conversations.ts`)

`getActiveTranscript` already ran for production transcripts that have `id = ""` baked in. On read, walk `messages` and assign a fresh id to anything missing one before handing them to the client. The next save (when the user sends another message) will write back the fixed ids, so this is a one-touch repair — not a permanent runtime cost.

We don't need a separate DB migration: the read-time fixup plus the next legitimate save together heal the row organically. Users with no transcript or with already-clean transcripts pay nothing.

### 3. Remove the render-side dedupe (`src/components/chat/chat-surface.tsx`)

Once ids are unique end-to-end, the dedupe is dead code that hides legitimate state. Drop the `useMemo` and render `messages` directly. Keep the `useMemo` import out unless something else needs it.

## Files touched

- `src/app/api/chat/route.ts` — import `generateId` from `"ai"`, pass `generateMessageId: generateId` to `toUIMessageStreamResponse`.
- `src/server/conversations.ts` — import `generateId`, fixup empty ids in `getActiveTranscript` before returning.
- `src/components/chat/chat-surface.tsx` — drop the dedupe `useMemo`; rename `renderedMessages` back to using `messages` directly.

## Acceptance criteria

- Send a message on phone, refresh on desktop: both the user message and the assistant response render.
- Send several turns, refresh: every user/assistant pair renders, in order.
- No "Encountered two children with the same key" warning in the console after the fix is deployed.
- A pre-existing transcript (saved before the fix) with `id = ""` assistant messages renders correctly on first load and gets healed automatically the next time the user sends a message.

## Out of scope

- A standalone DB migration to backfill ids. The read-time fixup is enough; a migration would be more code for the same outcome.
- Any change to how `useChat` generates client-side ids — those have always been fine.
