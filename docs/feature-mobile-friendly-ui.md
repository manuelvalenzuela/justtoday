# Feature plan — mobile-friendly UI

## Goal

Make justtoday usable on a phone. The desktop layout (fixed left sidebar + chat column) breaks down at narrow widths because `Sidebar` is hidden under `md:` and there is no replacement: plan switching, sign-out, theme toggle, and "New plan" become unreachable. Beyond the sidebar, the chat itself needs the standard mobile chat behaviour — composer pinned to the bottom of the visual viewport, scroll body filling the rest, and safe-area padding so the iOS home indicator and notch don't eat content.

This is a UX fix, not a redesign. Match the polish bar in `core-spec.md` §6: nothing in the mobile view should feel different in tone or density from the desktop view.

## Scope (in)

- Mobile-only navigation surface (drawer or sheet) that exposes everything the sidebar exposes today: plan list, "New plan", user identity, theme toggle, sign-out.
- Header bar on mobile with a hamburger trigger and the active plan title (replaces the desktop sidebar's role at the top).
- Chat layout: composer fixed at the bottom of the visual viewport, scroll area fills the rest, no double-scroll, keyboard-aware (composer rises with the on-screen keyboard, not buried under it).
- Safe-area insets for iOS (`env(safe-area-inset-bottom)` etc.) on the composer and any bottom-anchored UI.
- Sign-in page (`/signin`) sanity check at narrow widths — not a redesign, just confirm it doesn't break.
- Plan-import page (`/plans/new`) sanity check at narrow widths.

## Scope (out)

- No changes to desktop layout beyond the breakpoint switch.
- No PWA, no install prompt, no offline mode (separate concern).
- No gesture navigation, swipe-to-open drawer, etc. A tap-to-open drawer is enough.
- No touch-specific micro-interactions beyond what shadcn/ui already does.

## Current state (so the implementer knows where to look)

- Shell: `src/components/layout/app-shell.tsx` — wraps `Sidebar` + `<main>` in a `flex h-dvh`.
- Sidebar: `src/components/layout/sidebar.tsx` — currently `hidden md:flex`. Below `md` it disappears entirely, leaving no nav.
- Chat surface: `src/components/chat/chat-surface.tsx` — uses `flex h-full flex-col`; the scroll region is `flex-1 overflow-y-auto`. Composer is rendered inside the same flex column (not fixed). On mobile this works as long as `h-dvh` is honoured by the browser and the keyboard does not change the layout — both of which are flaky on iOS Safari today.
- Composer: `src/components/chat/composer.tsx` — `px-4 pb-4 pt-2`, no safe-area padding.

## Approach

1. **Add a mobile drawer.** Use shadcn/ui's `Sheet` (Radix-based — already in our component pool). Trigger lives in a new compact mobile header. The sheet body renders the same content as the desktop sidebar. The cleanest path is to extract the sidebar's *contents* into a presentational component (e.g., `SidebarContent`) and render it both inside the desktop `<aside>` and inside the mobile `<Sheet>`. No duplication of plan-list / sign-out / theme-toggle markup.
2. **Add a mobile header.** Below `md`, render a top bar with: hamburger button (opens the sheet), active plan title, optional kebab/avatar. Above `md`, render nothing — the desktop sidebar already covers identity. This means `ChatSurface`'s existing header should *only* render on `md:` upwards, or the new mobile header should subsume it. Pick one and keep header height consistent with what the chat scroll area expects.
3. **Composer pinning.** Use `position: sticky; bottom: 0` on the composer wrapper inside the chat column, `min-h-dvh` on the column container, and rely on the scroll region growing to fill. Avoid `position: fixed` — it competes with the iOS keyboard. Confirm `h-dvh` (dynamic viewport height) handles the visual viewport correctly; if not, fall back to `100svh`/`100dvh` and consider a small `visualViewport` listener. We don't need one if `h-dvh` works — try it first.
4. **Safe-area insets.** Add `pb-[max(1rem,env(safe-area-inset-bottom))]` (or equivalent Tailwind arbitrary value) to the composer wrapper. Top of the mobile header gets `pt-[env(safe-area-inset-top)]` similarly.
5. **Active-plan switch UX on mobile.** When the user picks a plan from the drawer, the drawer should close on its own after the form action submits. Easiest path: a small client wrapper around the plan list that closes the sheet on submit.

## Files likely touched

- `src/components/layout/app-shell.tsx` — wire desktop aside vs mobile header.
- `src/components/layout/sidebar.tsx` — split into `Sidebar` (desktop wrapper) and `SidebarContent` (the inner panels).
- `src/components/layout/mobile-header.tsx` *(new)* — top bar with hamburger + active plan title.
- `src/components/layout/mobile-nav.tsx` *(new)* — `Sheet` containing `SidebarContent`.
- `src/components/chat/chat-surface.tsx` — drop the inner header on mobile, ensure composer pinning works in the new layout.
- `src/components/chat/composer.tsx` — safe-area padding.
- `src/app/(app)/layout.tsx` — pass active plan title through to the mobile header (it's the only place that knows it cheaply).
- `src/components/ui/sheet.tsx` *(new shadcn add — `npx shadcn@latest add sheet`)*.

## Acceptance criteria

- At ≤ 640px: hamburger opens a drawer that lists all plans, "New plan", user identity, theme toggle, sign-out. Tapping a plan switches to it and closes the drawer.
- Composer stays anchored at the bottom of the visual viewport on iOS Safari and Chrome Android, with the keyboard open and closed.
- The chat scroll area is the only scroll surface — no whole-page scroll.
- Safe-area padding visible on devices with a home indicator (iPhone with notch).
- Desktop layout (≥ 768px) is unchanged.
- Verified end-to-end with Playwright MCP at iPhone-15-Pro and Pixel-8 viewports — both light and dark.

## Risks / things to get right

- iOS Safari's `100vh` vs `100dvh` lie. Use `dvh`. Test with the keyboard up.
- Drawer + form action: server actions navigate; make sure the sheet closes *before* nav so it doesn't feel stuck open mid-transition.
- Don't double-render identity (avatar/email) on screens where both the desktop sidebar *and* the mobile header exist during breakpoint transitions. Pick one per breakpoint cleanly.
