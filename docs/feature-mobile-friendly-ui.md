# Feature plan — mobile-friendly UI

## Goal

Make justtoday usable on a phone. The desktop layout (fixed left sidebar + chat column) breaks down at narrow widths because `Sidebar` is `hidden md:flex` with no replacement: plan switching, "New plan", user identity, theme toggle, and sign-out are unreachable. Beyond the sidebar, the chat itself needs the standard mobile chat behaviour — composer pinned to the bottom of the visual viewport, scroll body filling the rest, safe-area padding so the iOS home indicator and notch don't eat content.

This is a UX fix, not a redesign. Match the polish bar in `core-spec.md` §6: nothing in the mobile view should feel different in tone or density from the desktop view.

## Scope (in)

- Mobile-only navigation surface (left-anchored sheet) that exposes everything the sidebar exposes today: plan list, "New plan", user identity, theme toggle, sign-out.
- Single-strip mobile header: hamburger on the left + the existing `<TodayPill>` (or plan title when `today` is null). One row. Replaces the desktop sidebar's role at the top of the viewport.
- Chat layout: composer sticky at the bottom of the visual viewport, scroll area fills the rest, no double-scroll, keyboard-aware.
- Safe-area insets for iOS (`env(safe-area-inset-bottom)` etc.) on the composer and any bottom-anchored UI.
- `/signin` and `/plans/new` sanity check at 390px — fix anything visibly broken; no redesign.

## Scope (out)

- No changes to desktop layout (`md:` and up) beyond the breakpoint switch.
- No PWA, install prompt, or offline mode.
- No swipe-to-open / gesture navigation. Tap-to-open drawer is enough.
- No touch-specific micro-interactions beyond what shadcn/ui gives us by default.
- No "switching..." spinner during plan switch — fast switches don't need it.
- No iOS `visualViewport` JS listener pre-built. `dvh` + `position: sticky` first; only fall back if testing reveals composer drift.

## Current state

- Shell: `src/components/layout/app-shell.tsx` wraps `Sidebar` + `<main>` in a `flex h-dvh`.
- Sidebar: `src/components/layout/sidebar.tsx` — `hidden md:flex`. Below `md:` it disappears entirely, leaving no nav.
- Chat surface: `src/components/chat/chat-surface.tsx` — `flex h-full flex-col`; scroll region is `flex-1 overflow-y-auto`. Composer is rendered inside the same flex column (not fixed). Header (`h-14`, `border-b`) currently holds `<TodayPill>` (or `<h2>{planTitle}</h2>` when today is null).
- Composer: `src/components/chat/composer.tsx` — `px-4 pb-4 pt-2`, no safe-area padding.

## Approach

### 1. Split the sidebar

Extract `Sidebar`'s contents into a presentational `SidebarContent` component (plan list, "New plan", identity, theme toggle, sign-out — all the inner panels, no shell chrome). `Sidebar` becomes the desktop wrapper that mounts `SidebarContent` inside its `<aside>`. The mobile sheet mounts the same `SidebarContent`. No duplicated markup.

### 2. Mobile header — single strip

Below `md:`, render a top bar with:

- **Left:** hamburger (`lucide` `PanelLeft`, ghost button) that opens the sheet.
- **Center/left of remaining space:** `<TodayPill>` when `today` is non-null; plain `<h2>{planTitle}</h2>` otherwise.
- **Right:** nothing. Empty space, breathing room.

Height: `h-14` (matches desktop chat header — keeps scroll math consistent across breakpoints).

The chat surface's existing inner header is hidden on mobile (`hidden md:flex`). The mobile header is the only header on phone widths. On desktop, the mobile header is hidden and the chat surface's inner header carries the pill as it does today.

This means the page-level pill content needs to render in two places at different breakpoints: inside `ChatSurface`'s header on desktop, inside `MobileHeader` on mobile. Composition pattern: `MobileHeader` accepts `children` and the page (`src/app/(app)/page.tsx`) passes the same `<TodayPill ... />` instance into it. `ChatSurface` keeps rendering its own copy in its inner header, hidden on mobile. The pill is cheap and stateless — duplication is fine.

For routes other than `/` (e.g., `/plans/new`), `MobileHeader` is rendered with a route-specific title (or empty children + the page renders its own heading inside the content area). Goal is just: hamburger always reachable.

### 3. Mobile drawer (`Sheet`)

- Component: shadcn/ui `Sheet`. Run `npx shadcn@latest add sheet`. Confirm Base UI vs. Radix wrapper — match what `popover.tsx` already does (Base UI). If `Sheet` isn't available in the Base UI shadcn preset, build a thin wrapper directly on `@base-ui/react/dialog` (same pattern we used for `popover.tsx`).
- Side: **left** (muscle memory matches desktop sidebar position).
- Width: `w-[min(320px,80vw)]`.
- Backdrop: standard scrim, click-outside-to-dismiss, Escape-to-dismiss.
- Body: `<SidebarContent />`, full-height, scrollable inside the sheet if it overflows.
- Auto-close on plan switch: when the user submits the plan-switch form action, the sheet starts closing immediately and navigation fires in parallel. By the time the new content paints, the close animation is done. Implement via a small client wrapper that calls the sheet's `onOpenChange(false)` from the form's `onSubmit` before letting the action proceed.

### 4. Composer pinning + safe-area

- Composer wrapper: `position: sticky; bottom: 0` inside the chat column.
- Chat column container: keeps `h-full` (parent is `h-dvh`); scroll region grows to fill.
- Bottom padding: `pb-[max(1rem,env(safe-area-inset-bottom))]` on the composer wrapper.
- Top padding on the mobile header: `pt-[env(safe-area-inset-top)]` so the notch doesn't sit on the hamburger.

`dvh` (dynamic viewport height) is the source of truth for shell height. Don't add a `visualViewport` listener until Playwright testing on iPhone-15-Pro proves the composer drifts when the keyboard is up.

### 5. Breakpoint

Switch nav at `md:` (768px). Fixes the prior `≤640px` vs. "below md" ambiguity. The 641–767px range now has the mobile header (instead of nothing).

## Files likely touched

- `src/components/layout/app-shell.tsx` — render desktop `<aside>` (`hidden md:flex`) and mobile header (`md:hidden`).
- `src/components/layout/sidebar.tsx` — split into `Sidebar` (desktop wrapper) and `SidebarContent` (inner panels).
- `src/components/layout/mobile-header.tsx` *(new)* — `h-14`, `md:hidden`, hamburger button + children slot for the pill/title.
- `src/components/layout/mobile-nav.tsx` *(new)* — `Sheet` wrapper containing `<SidebarContent />`, with the auto-close-on-submit wrapper.
- `src/components/chat/chat-surface.tsx` — hide its inner header on mobile (`hidden md:flex`), keep desktop behaviour intact.
- `src/components/chat/composer.tsx` — `position: sticky bottom-0` + safe-area padding.
- `src/app/(app)/page.tsx` and/or `src/app/(app)/layout.tsx` — render `<MobileHeader>` with the pill (home) or plan title (other routes). Pick the level that gives the cleanest data flow without over-engineering.
- `src/components/ui/sheet.tsx` *(new)* — shadcn add, or thin Base UI wrapper if shadcn doesn't supply a Base UI variant.

## Acceptance criteria

- At `< md` (≤767px): a hamburger button on the left of the top bar opens a left-anchored sheet that lists all plans, "New plan", user identity, theme toggle, and sign-out. Tapping a plan switches to it; the sheet closes during/before the route transition (no stuck-open feel).
- The mobile top bar shows the `<TodayPill>` when there's a pending day, or the plan title when `today` is null. One row, `h-14`. Nothing on the right.
- Composer stays anchored at the bottom of the visual viewport on iOS Safari and Chrome Android, both with the keyboard open and closed.
- The chat scroll area is the only scroll surface — no whole-page scroll.
- Safe-area padding visible on devices with a home indicator (iPhone with notch); the hamburger sits below the notch.
- Desktop layout (`≥ md`) is unchanged: sidebar visible, chat-surface inner header carries the pill as it does today.
- `/signin` and `/plans/new` render cleanly at 390px — no horizontal overflow, no clipped controls.
- Verified end-to-end with Playwright MCP at iPhone-15-Pro and Pixel-8 viewports — light and dark, with the keyboard simulated up where applicable.

## Risks / things to get right

- iOS Safari's `100vh` vs. `100dvh` lie. Use `dvh`. Test with the keyboard up.
- Drawer auto-close: ensure the close animation starts *before* the route transition fires so the sheet doesn't appear to hang open mid-navigation.
- Don't double-render the pill at the breakpoint boundary. `hidden md:flex` on the chat-surface inner header and `md:hidden` on `MobileHeader` must be exact opposites, no `lg:` mismatches.
- Don't double-render identity (avatar/email) — desktop sidebar shows it; on mobile only the drawer shows it. Never both visible at once.
- The shadcn `Sheet` may not exist in the Base UI preset. If `npx shadcn@latest add sheet` doesn't drop a Base UI variant, build the wrapper on `@base-ui/react/dialog` to match `popover.tsx`'s pattern instead of pulling in Radix.
