---
description: Canonical state vocabulary and role-naming convention for UXUI work. Always loaded.
---

# UI Vocabulary

Canonical state vocabulary and role-naming convention for UXUI work. Every screen defined in a domain file MUST use this vocabulary.

## Data component states

For every list, table, detail view, or dashboard widget that fetches data:

- **Empty** — no data exists. Tell the user what's missing and how to add it.
- **Loading** — data is being fetched. Reserve layout space.
- **Error** — fetch failed. Show what happened, offer retry and escalation.
- **Populated** — data loaded. The default working state.
- **Partial** — some data loaded, some failed. Show what succeeded, mark what didn't, offer retry for the rest.

## Form states

For every form:

- **Idle** — ready for input, no field touched or all fields clean.
- **Dirty** — at least one field changed from initial value. Affects navigation guards.
- **Submitting** — request in flight. Submit button disabled, form non-interactive.
- **Success** — submit succeeded. Explicit next state — redirect, confirmation, or cleared form.
- **Error** — submit failed. Field-level errors inline; form-level errors summarized.

## Button and interactive control states

For every button, link, and interactive control:

- **Default** — resting state.
- **Hover** — pointer over element.
- **Focus** — keyboard focus. Distinct from hover.
- **Active** — click/tap in progress.
- **Disabled** — not currently actionable, visually muted.
- **Loading** — async action in progress. Indicator inside the control, non-clickable.

## Role-naming convention

Domain files reference roles from `cowmoo/design/roles.md` by name — never raw values.

- `primary-action`, `destructive`, `muted-text`, `tight-spacing` — role names
- `bg-primary-600`, `#F59E0B`, `8px`, `font-weight: 600` — raw values (never in cowmoo/design/ files)

Concrete values are resolved downstream: `src/` after build, `cowmoo/agent-files/builder/BUILD-NOTES.md` for builder rules, framework defaults otherwise.

## Document every state

Every screen in a domain file MUST declare the states that apply to it. If a state isn't listed for a screen, it isn't defined. Be explicit — no implicit states.
