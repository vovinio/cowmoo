# UI Overview Template

Structure for `cowmoo/design/OVERVIEW.md`. This file is the product's UX orientation document — design intent, top-level navigation, and pointers to the sibling files where journeys, roles, and screens live. Read-once scannable.

OVERVIEW stays slim. If a section grows past ~40-50 lines, it should split into its own sibling file — see `journeys.md`, `roles.md`, `screen-index.md` for the existing splits.

Companion files UXUI maintains alongside OVERVIEW:
- `cowmoo/design/journeys.md` — end-to-end user arcs
- `cowmoo/design/roles.md` — role vocabulary domain files reference
- `cowmoo/design/screen-index.md` — master screen list with pointers to domain files
- `cowmoo/design/domains/*.md` — per-domain screens, flows, states

---

## Template

```markdown
# UI Overview

Product-level UX orientation. Companion to `cowmoo/specs/PRODUCT.md`, `cowmoo/design/journeys.md`, `cowmoo/design/roles.md`, `cowmoo/design/screen-index.md`, and `cowmoo/design/domains/*.md`.

---

## Design Intent

[1-2 paragraphs describing the character of the product's UX — density, formality, mood, and WHY tied to users and product type. This shapes every subsequent UX decision without prescribing specific token values.]

Example:
> Serious professional tool for legal compliance teams. Dense information hierarchy, warm neutrals, rounded corners. Users scan tables fast and need to trust what they see — the product should feel reliable and approachable, not stark or playful.

Example:
> Consumer onboarding experience for first-time users. Generous whitespace, playful motion, warm welcoming palette. The product must feel inviting and reduce friction at every step — discover don't instruct.

---

## Navigation Structure

[How users move through the app at the top level. High-level shape only — leave per-screen navigation to domain files.]

- **Type:** [sidebar + content / top-nav + content / bottom-tab + stack / etc.]
- **Main sections:** [list top-level navigation entries]
- **Sub-navigation pattern:** [how sections expand — drawer / tabs / accordion / none]
- **Breadcrumb behavior:** [present on all pages / detail pages only / none]
- **Entry points:** [where users typically land — landing page / dashboard / last-visited]

---

## Pointers

Read these sibling files for the rest of the UX picture:

- **`cowmoo/design/journeys.md`** — end-to-end user arcs (onboarding, daily-use loop, admin configuration, etc.)
- **`cowmoo/design/roles.md`** — role vocabulary that domain files reference (primary-action, destructive-action, text-muted, space-tight, etc.)
- **`cowmoo/design/screen-index.md`** — master list of every screen organized by domain
- **`cowmoo/design/domains/*.md`** — per-domain screens, flows, states, interactions

Domain files reference roles from `cowmoo/design/roles.md` by name. Never raw hex values, never raw pixel values.
```

---

## Rules

- **Stays slim.** OVERVIEW is orientation. Reader gets oriented in under a minute. If any section grows past ~40-50 lines, split it into its own sibling file.
- **Design Intent is prose, not prescription.** Describes the character/mood/density/feel grounded in the product, not specific token values. Values live elsewhere (src/ after build, BUILD-NOTES.md for builder rules).
- **Navigation is high-level only.** Per-screen navigation lives in domain files.
- **Pointers are maintained.** When a new sibling file is added (e.g. splitting Global Patterns into `patterns.md` later), update the Pointers section.
- **No role definitions here.** Roles live in `roles.md`. OVERVIEW doesn't duplicate them.
- **No screen lists here.** Screens live in `screen-index.md`. OVERVIEW doesn't duplicate them.
- **Created early, updated as product understanding grows.** Design Intent may start thin and get refined as discussion deepens. Navigation may not exist until several domains are drafted.
