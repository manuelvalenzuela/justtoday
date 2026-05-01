# Feature plan — explain what justtoday is (pre-login + post-login)

## Goal

A new visitor — typically a friend following a shared link — should understand what justtoday is within a few seconds of landing on the sign-in page. After they sign in, an unobtrusive "About" entry-point in the sidebar should let them (or a friend looking over their shoulder) read a slightly longer description without leaving the chat.

Two surfaces, one shared voice:

1. **Pre-login (sign-in page)** — a short rotating intro paragraph above the Google button. Friendly, compressed, alive.
2. **Post-login (sidebar About)** — a small "About" trigger near the sidebar footer that opens a longer, calmer description. More explicit than the rotating phrases, still minimalist.

Both should feel like the same product talking — no marketing copy, no feature bullets, no screenshots.

## Scope (in)

### Pre-login (sign-in page)
- Sign-in page (`src/app/(auth)/signin/page.tsx`) gets a small intro paragraph between the tagline and the Google button.
- Copy is short (one or two sentences) and conveys: it's a study tracker, you talk to it like a chat, it gives you one day at a time.
- **The intro copy rotates**: a small pool of variants cycles every few seconds with a soft fade transition, so a returning visitor sees a different framing each time. Feels alive without being noisy.
- Visual treatment matches the existing minimalist aesthetic — muted text, narrow column, generous spacing. No icons, no decorative elements.
- Works on mobile and desktop without horizontal cramping.
- Respects `prefers-reduced-motion`: if the user has reduced motion enabled, the rotation either stops on the first variant or swaps without a fade.

### Post-login (sidebar About)
- An "About" entry point lives in the sidebar footer area, available on every authenticated page.
- It opens a calm, slightly longer description of justtoday — what it is, how the day-by-day rhythm works, and that you talk to it. ~1 short paragraph (3–5 sentences).
- Same voice and minimalism as the rotating intro — no bullet lists, no headings inside the body, no marketing language. Just words.
- Does not navigate away from the current chat (modal/popover, not a route change).

## Scope (out)

- No marketing landing page, hero section, or pre-signin route gymnastics. The sign-in page itself remains the entry point.
- No screenshots, illustrations, or animated mascots.
- No feature list, pricing, or testimonials.
- No dedicated `/about` route — the About content is reachable only from the sidebar trigger.
- No copy changes inside the chat experience (chat surface, plan list, etc.) beyond the new About entry point.
- No i18n / multi-language. English only, matching the rest of the app.

## Current state

`src/app/(auth)/signin/page.tsx` renders:
- `<h1>justtoday</h1>` (centered, 2xl semibold)
- `<p>Study one day at a time.</p>` (centered, sm muted)
- `<Button>Continue with Google</Button>` (full-width inside a `max-w-sm` column)

The whole thing is vertically centered in `min-h-dvh`. There is nothing else on the page.

## Approach

Insert a new paragraph **between the tagline and the Google button** (chosen position), inside the same `max-w-sm` column. Keep typography conservative: small, muted, slightly looser line-height than the tagline so it reads as body copy rather than a second tagline. Maintain the centered-column layout so nothing about the visual rhythm changes — just one more block of text.

### Rotating copy

A client component holds an array of intro variants and cycles through them on a timer. Implementation sketch:

- New tiny client component `src/components/auth/rotating-intro.tsx` (the sign-in page itself can stay mostly server-rendered; only this paragraph needs to be client-side).
- `useState` for the active index, `useEffect` with `setInterval` to advance it. Cleanup on unmount.
- Transition: cross-fade via Tailwind `transition-opacity duration-500`. Two-phase update (fade out → swap text → fade in) using a brief `setTimeout` chain, or a key-based remount with a CSS animation. Pick whichever ends up cleaner during implementation.
- Reserve vertical space so the column doesn't jump when copy length differs between variants. Either set a `min-height` on the paragraph or pad to the tallest variant. Confirm visually with Playwright MCP.
- `prefers-reduced-motion`: detect via `window.matchMedia("(prefers-reduced-motion: reduce)")`. If reduced, render the first variant statically and skip the interval entirely (don't just kill the fade — kill the rotation, since motion *is* the point of the feature).
- Pause rotation while the page is hidden (`document.visibilityState`) so the timer doesn't burn cycles in a background tab.

Variants pool (5 total, voice from variant (a) — friendly, factual, day-by-day; mixed lengths):

1. "justtoday helps you stick to a study plan by giving you one day at a time. Tell it what you're learning and it adapts as you go."
2. "A chat-based study tracker that breaks your goal into days. Check in each day, talk through what you covered, and the plan adjusts."
3. "Pick something to learn — Spanish, English, anything. justtoday turns it into a day-by-day plan and keeps the conversation in your language."
4. "Study plans that move at your pace. Tell it how today went — it shapes tomorrow around that."
5. "One day at a time, in a conversation. justtoday keeps your study plan honest and adapts when life gets in the way."

Variant #1 always renders first (deterministic). After 4s, the rotation advances through #2 → #3 → #4 → #5 → back to #1, with a soft cross-fade between each.

### Post-login About (sidebar)

A small "About" affordance in the sidebar footer opens a dialog with a calmer, more explicit description of justtoday. Implementation sketch:

- Trigger placement: in the sidebar footer area near the user/account block — see open question below for exact spot.
- Trigger style: a tiny text link / ghost button (e.g. "About"), not a flashy CTA. It should disappear into the chrome until you look for it.
- Dialog content: one paragraph (~3–5 sentences) that names the category, explains the day-by-day mechanic, and acknowledges that life shifts. No headings inside, no bullets. Same voice as the rotating intro but more explicit and less compressed.
- Dialog uses shadcn `Dialog` component (already in the project). Accessible by default (focus trap, escape to close, backdrop click).
- Mobile: the same trigger appears in the mobile nav drawer (`SidebarContent` is shared between desktop sidebar and `MobileNav`), so we get the mobile case for free.

About copy (final):

> justtoday is a study tracker built around one simple idea: you only need to think about today. Tell it what you're learning, and it turns the goal into a day-by-day plan you can actually follow. Each day you check in, talk through what you covered, and the plan adjusts to how things are really going. Whatever language you start in — Spanish, English, anything — is the language it'll keep speaking. When life shifts, the plan shifts with you.

Copy direction (chosen): friendly, factual description anchored on the day-by-day rhythm and adaptive nature.

> "justtoday helps you stick to a study plan by giving you one day at a time. Tell it what you're learning and it adapts as you go."

This direction:
- names the category ("study plan") so the visitor doesn't have to guess
- implies the day-by-day rhythm directly
- hints at the conversational/adaptive mechanic ("tell it", "adapts as you go")
- reads like a sentence a friend would say, not a product page

## Files likely touched

- `src/app/(auth)/signin/page.tsx` — drop the static `<p>` in favor of the rotating client component; possibly tighten spacing.
- New `src/components/auth/rotating-intro.tsx` — client component that owns the variant array, the interval, the fade transition, and the reduced-motion guard.
- `src/components/layout/sidebar.tsx` — add a small "About" trigger in the footer area (above or alongside the user/account block). Wires up to the dialog.
- New `src/components/layout/about-popover.tsx` — client component that wraps the "About" text trigger and the popover content. Used by `SidebarContent` so it works on both desktop sidebar and mobile drawer.

## Open questions (refinement loop)

1. ~~Copy direction~~ — chosen: variant (a) voice, anchor on day-by-day rhythm.
2. ~~Position~~ — chosen: between tagline and Google button.
3. ~~Pool size~~ — chosen: **5 variants**.
4. ~~Rotation interval~~ — chosen: **6s** (initially 4s; bumped after live testing — 4s felt rushed).
5. ~~Length per variant~~ — chosen: **mixed** (one or two sentences). Reserve column height to the tallest variant so swaps don't jump.
6. ~~Keep the existing tagline?~~ — chosen: **drop it**. The wordmark is the stable anchor; a fixed tagline plus a rotating paragraph competes for hierarchy. Wordmark + rotating intro = two layers, calmer composition. The "one day at a time" idea survives inside the rotating pool.
7. ~~Initial variant~~ — chosen: **deterministic** (always start with variant #1). Predictable first impression for shared links / screenshots; rotation kicks in after the first interval.
8. ~~Anything else pre-login?~~ — chosen: **nothing extra**. Wordmark + rotating intro + Google button. Done.

### Post-login About — open

9. ~~Trigger placement~~ — chosen: **(a)** own row above the user/account block, with a separator. Reason: "About" is product-meta, not user-action and not user-identity; it deserves its own semantic slice. The separator earns its keep marking the category boundary. Keep the trigger lightweight (text-only link, tight padding) so the footer doesn't get bulky.
10. ~~Trigger affordance~~ — chosen: **text-only "About"**. Muted (`text-muted-foreground`), hover to `text-foreground`, small (`text-xs`/`text-sm`), tight padding. Reasons: "About" is universal nav-vocabulary so no icon is needed to disambiguate; an icon would either add noise (third icon in the footer) or be redundant; text-in-its-own-row also creates visual differentiation from the icon-only action row below, reinforcing the categorical separator.
11. ~~About copy~~ — chosen: final version above (added a sentence noting that the conversation language follows the user's input — Spanish stays Spanish, English stays English).
12. ~~Dialog vs popover~~ — chosen: **Popover** (anchored to the sidebar trigger). Reasons: About is *information*, not action; a dim backdrop is disproportionate for a one-paragraph read; popover preserves the chat behind it (no interruption); the corner-of-screen trigger gives the popover plenty of room to extend up/right; and shadcn `Popover` is already installed, while `Dialog` is not — aesthetic and pragmatic choices align.

Implementation notes for the popover: width ~320px, opaque background (matches sidebar surface), comfortable padding (~p-5), body copy in `text-sm text-muted-foreground` with relaxed line-height. Side="top", align="start" so it grows up from the sidebar footer trigger. On mobile drawer, Radix collision detection handles edge cases.

## Acceptance criteria

- A visitor who has never seen the app can read the sign-in page in under 10 seconds and answer "what is this?" in their own words.
- Visual rhythm of the page is preserved — still feels minimalist, not crowded.
- Rotating paragraph: variants swap with a soft cross-fade at a calm cadence; the column does not jump in height as variants change.
- Reduced-motion users see a static intro (rotation disabled), not a janky no-fade swap.
- Mobile (narrow viewport): paragraph wraps cleanly inside the column with no horizontal scroll.
- No regression to the Google sign-in flow.
- The sidebar's About trigger is reachable on every authenticated page (desktop sidebar + mobile drawer) without competing visually with the plans list or user account block.
- Opening the About dialog/popover does not navigate away from the chat or change scroll position.
