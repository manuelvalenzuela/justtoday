# justtoday — docs

Specs and plans for the justtoday study-tracker app live here.

## Convention

- **`core-spec.md`** is the foundational spec for the v1 app. It captures everything needed to build the initial version.
- **Each new feature gets its own document** (e.g., `feature-persist-sessions.md`, `feature-export-history.md`). Treat the core spec as stable; new ideas land as separate plan docs and are merged in only when implemented.
- Use a kebab-case filename prefixed with `feature-` for feature plans, `decision-` for ADR-style records, and `ops-` for operational notes.

## Index

- [core-spec.md](./core-spec.md) — v1 product and technical spec.
- [ops-build-phases.md](./ops-build-phases.md) — phased build plan and current status.
- [feature-mobile-friendly-ui.md](./feature-mobile-friendly-ui.md) — mobile drawer, pinned composer, safe-area insets.
- [feature-persist-current-day-conversation.md](./feature-persist-current-day-conversation.md) — store the active day's chat so it survives reloads and device switches.
- [feature-day-detail-view.md](./feature-day-detail-view.md) — surface today's goal + topics in the empty state and a header pill.
- [feature-plan-refinement.md](./feature-plan-refinement.md) — reframe original input from preview, surface plan length, and add a "let's define it together" refinement chat (draft).
