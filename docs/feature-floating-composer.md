# Feature plan — floating composer (and floating today pill)

## Goal

Make the chat composer feel like it's always there. Today it sits at the bottom of a flex column: when the message list is short, the composer is mid-screen with empty space below the last message; when the list grows, the scroll area shrinks to fit. We want the composer to **float at the bottom of the chat surface, overlaid on top of the scrolling history** — the way ChatGPT and Claude.ai do it. Messages scroll behind it.

For symmetry and polish, the desktop today-pill header (today only `hidden md:flex h-14` containing a single pill) gets the same treatment: it floats at the top of the chat surface with a mirrored fade. The result is an edge-to-edge chat surface with two intentional floating chrome elements top and bottom.

## Scope (in)

- Composer is visually pinned to the bottom of the chat surface, layered above the message list.
- Desktop today pill floats at the top of the chat surface in a mirrored treatment (gradient fade + opaque pill chip).
- Message list scrolls underneath both, edge-to-edge; the last message can be scrolled fully into view above the composer's top edge.
- Gradient fade above the composer (from `transparent` to `background`) so messages don't visually clip — the composer card itself is opaque. Mirrored gradient fade below the floating top pill.
- The bottom-padding the message list reserves for the composer is **measured** from the live composer DOM via `ResizeObserver` and exposed as a CSS var, so a multi-line textarea never hides the last message. Same approach for the top pill if its height ever varies (probably constant; can use a literal then).
- Auto-scroll-to-bottom on new messages still works and lands the latest message just above the composer.
- "Scroll to bottom" floating pill appears above the composer when the user has scrolled away from the bottom (threshold ~120px). Click → smooth-scroll to bottom; disappears when at-bottom.
- Empty state ("today summary" / "all days complete") is **vertically centered** in the visible area above the composer — treated as a deliberate "welcome to today" moment, not the top of an otherwise-empty scroll area.
- Behaves correctly on desktop and mobile (respects `safe-area-inset-bottom`; works when the on-screen keyboard appears).

## Scope (out)

- No composer expansion animations beyond what `field-sizing-content` already gives us.
- No model picker, attachment menu, or other composer-internal UI changes.
- No change to keyboard handling (Enter / Shift+Enter), submit logic, or streaming behavior.
- No changes to the mobile header (`MobileHeader` — the sticky bar with hamburger + plans). That stays sticky and opaque; only the *desktop* today-pill header changes.
- No changes to the sidebar layout.

## Current state

- `src/components/chat/chat-surface.tsx` lays out three children in a flex column:
  1. Desktop `<header>` with the today pill (`hidden md:flex h-14 border-b`).
  2. `<div ref={scrollRef} className="flex-1 overflow-y-auto">` — the message list.
  3. `<Composer />` — at the bottom, in normal flow.
- `src/components/chat/composer.tsx` already centers a `max-w-[720px]` rounded card and includes `pb-[max(1rem,env(safe-area-inset-bottom))]` for iOS safe area.
- Auto-scroll: `useEffect` on `messages` sets `scrollTop = scrollHeight`. Works today because nothing overlaps the bottom of the scroll area.
- Mobile header (`src/components/layout/mobile-header.tsx`) is `sticky top-0` with backdrop blur — out of scope, stays as-is.

## Approach

### Layout

Switch from a 3-row flex column to a **single scroll container with absolutely-positioned chrome top and bottom**:

```
<div class="relative flex-1 min-h-0">                            <!-- chat surface -->
  <div ref={scrollRef} class="absolute inset-0 overflow-y-auto">
    <div
      class="mx-auto max-w-[720px] px-6"
      style="padding-top: var(--top-chrome-h); padding-bottom: var(--composer-h);"
    >
      … messages …
    </div>
  </div>

  <!-- top floating pill (desktop only) -->
  <div class="hidden md:block pointer-events-none absolute top-0 inset-x-0">
    <div class="h-16 bg-gradient-to-b from-background to-transparent" />   <!-- fade -->
    <div class="absolute top-0 inset-x-0 flex h-14 items-center px-6 pointer-events-auto">
      <TodayPill ... />
    </div>
  </div>

  <!-- bottom floating composer -->
  <div class="pointer-events-none absolute bottom-0 inset-x-0">
    <div class="h-12 bg-gradient-to-t from-background to-transparent" />   <!-- fade -->
    <div class="pointer-events-auto bg-background">
      <Composer ref={composerRef} ... />
    </div>
  </div>

  <!-- scroll-to-bottom pill (conditional) -->
  { showScrollPill && <ScrollToBottomPill onClick={scrollToBottom} /> }
</div>
```

- Scroll container fills the surface; chrome overlays its edges.
- Outer chrome wrappers are `pointer-events-none` so the gradient strip doesn't block clicks above the actual pill / composer; the inner pill / composer reverts to `pointer-events-auto`.
- When there's no `today` (e.g. all days complete), the desktop top wrapper is omitted — the plan title is small enough that we just don't render top chrome in that case (or render it without the fade; finalize during implementation).

### Composer & top-chrome height — measured

A `ResizeObserver` on the composer's outer wrapper writes its `offsetHeight` into a CSS custom property `--composer-h` on the chat surface root. The message list's `padding-bottom` consumes that var. Same observer pattern can apply to the top chrome if needed; in practice the today pill is fixed-height, so a literal value (`--top-chrome-h: 3.5rem`) is fine. Keep both as CSS vars so we can adjust without rewriting layout.

Why measured for the composer: the textarea uses `field-sizing-content` and grows up to `max-h-48`. A hard-coded reservation either wastes space at min height or hides the last message at max height. Measuring is one ref + ~10 lines.

### Visual treatment

Gradient fade + opaque chip/composer (the ChatGPT/Claude.ai look):

- **Bottom**: a short (~3rem) `bg-gradient-to-t from-background to-transparent` sits *above* the composer card. Below the fade, the composer wrapper has `bg-background` (solid) so the composer card itself never has translucent text behind it. Messages fade out as they pass under the gradient strip.
- **Top (desktop only)**: mirrored — a `bg-gradient-to-b from-background to-transparent` sits *below* the pill. Above the fade, the pill region has `bg-background`.

No backdrop blur; solid background under the chip and composer. Cheap, consistent across devices.

### Auto-scroll

The existing `useEffect` on `messages` sets `scrollTop = scrollHeight` on the scroll container. With the message list now padded to `--composer-h` at the bottom, scrolling to the bottom naturally lands the last message above the composer. Verify visually with Playwright MCP after wiring up.

### Scroll-to-bottom pill

Track `isNearBottom` in a ref + state by attaching a `scroll` listener to the scroll container. Threshold: distance from bottom ≤ 120px. When the user has scrolled up past that:

- Render a small pill (icon-only, `ChevronDown`) absolutely positioned a few px above the composer, centered horizontally.
- On click: smooth-scroll the container to its `scrollHeight`.
- Auto-hide when `isNearBottom` becomes true.
- Skip rendering during the very first render (when there are no messages) and during empty states.
- Important: do **not** auto-scroll on new messages while the user is scrolled up. The user is intentionally reading history; sliding them to the bottom on every streamed token would be hostile. Restrict the auto-scroll effect to fire only when `isNearBottom` was true at the time the new turn started — and surface the scroll-to-bottom pill if the user wandered up mid-stream.

### Empty state

When `messages.length === 0`, the `<TodaySummary>` (or "all days complete" copy) is rendered inside a wrapper that fills the visible area between top-chrome and composer and **vertically centers** its content. Concretely: a flex column with `min-height: calc(100% - var(--composer-h) - var(--top-chrome-h))` and `justify-center` so the card sits in the optical middle of the visible area, not at the top of a sea of empty space.

Once messages exist, this branch is gone and the layout reverts to the normal scroll behavior.

### Mobile / safe area

- Composer wrapper still respects `pb-[max(1rem,env(safe-area-inset-bottom))]` (already does today).
- iOS Safari resizes the visual viewport when the keyboard opens; because the composer is `position: absolute` inside the chat surface (not `fixed` to the viewport), it follows the resized viewport. Verify on a real device (Playwright MCP, or use `--no-headed` won't reproduce keyboard — accept that this is a manual real-device check item; flag in acceptance criteria).
- The desktop floating top pill is `hidden md:block` — on mobile the existing `MobileHeader` (sticky, opaque, blur) is the chrome. No interaction.

### Desktop sidebar coexistence

The chat surface is one column inside a flex layout that also contains the sidebar. The composer overlay and floating top pill are scoped to the chat surface (via `position: absolute` within a `relative` parent), so they do **not** float over the sidebar. Confirm during implementation by inspecting the layout root.

## Files likely touched

- `src/components/chat/chat-surface.tsx` — primary structural change. Switch to relative container + absolute scroll area + absolute top-chrome (desktop) + absolute composer wrapper. Wire `ResizeObserver` → `--composer-h`. Add scroll listener for `isNearBottom`. Render scroll-to-bottom pill.
- `src/components/chat/composer.tsx` — likely no logic changes; possibly tweak outer padding/background since it's now a layered element rather than a flex child.
- `src/components/chat/today-pill.tsx` — likely no changes; just relocated in the tree.
- New small component: `src/components/chat/scroll-to-bottom-pill.tsx` — icon button, fixed-positioned by parent, with the `ChevronDown` from `lucide-react`.
- Possibly `src/app/(app)/page.tsx` — confirm the chat surface's parent has `min-h-0` / `100dvh` plumbing intact so the floating chrome positions correctly.

## Acceptance criteria

- On desktop, with a long conversation: scroll up; composer stays pinned at the bottom of the chat column, today pill stays pinned at the top, messages scroll behind both with the gradient fade visible (messages dissolving into the background as they pass under the fade strips).
- Scrolling to the bottom of the message list places the last message fully visible *above* the composer's top edge, not clipped — including when the textarea is expanded to multiple lines.
- On a fresh day (empty state), the today-summary card renders **vertically centered** in the area between top pill and composer.
- On mobile (real device, not just devtools): composer respects the safe area; opening the keyboard pushes the composer up with the visual viewport without visual jumps; sending a message scrolls the list correctly. Mobile header (the existing sticky one) is unchanged.
- Sidebar layout is unaffected.
- Streaming UX unchanged: tokens still arrive smoothly.
- During a stream, if the user scrolls up to read prior context, the surface does **not** force-scroll them to the bottom on every new token. The scroll-to-bottom pill appears so they can return when ready.
- Scroll-to-bottom pill appears when scrolled up >120px from the bottom and disappears at-bottom; clicking it smooth-scrolls to the latest message.
- No regression to keyboard shortcuts (Enter sends, Shift+Enter newlines).

## Risks / things to get right

- **ResizeObserver wiring**: forgetting to disconnect on unmount leaks observers across remounts (and `ChatSurface` remounts on every day change because of the `key` prop). Use a ref + cleanup in the effect.
- **iOS keyboard / visual viewport**: `position: absolute` inside a flex child that uses `min-h-0` — verify on a real iPhone before declaring done. If issues, may need `100dvh` adjustments up the tree.
- **Auto-scroll vs. user reading**: easy to write a regression where streaming tokens drag the viewport. The "only auto-scroll if near bottom" rule is the safety net — verify with a deliberate test: send a message, scroll up mid-stream, confirm viewport doesn't jump.
- **Sidebar bleed-through**: an `absolute` element pinned to the wrong ancestor could float over the sidebar. Pin to the chat surface's `relative` wrapper specifically and verify.
- **Empty state composition**: vertical centering needs to account for both `--top-chrome-h` and `--composer-h` so the card lands optically centered in the visible band. Manual visual check (Playwright MCP).
- **Today pill desktop fade**: when there's no `today` (all days complete), the existing fallback renders a small `<h2>` with the plan title. Decide whether to render it floating with the fade, or omit the top chrome entirely. Default: omit; the centered "all days complete" empty state is enough.
