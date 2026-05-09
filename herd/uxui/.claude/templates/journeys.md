# User Journeys Template

Structure for `cowmoo/design/journeys.md`. End-to-end user arcs that span multiple screens and domains — the big-picture progressions that tell the story of the product's UX.

Companion to `cowmoo/design/OVERVIEW.md` (design intent + navigation), `cowmoo/design/domains/*.md` (per-feature flows within a single domain), and `cowmoo/specs/` (business truth).

---

## What belongs here vs. in domain files

**Journeys (this file):** cross-cutting arcs that move users across domains or define the bigger picture of the product experience.
- Example: "New user onboarding" — touches signup (auth domain) → profile (user domain) → first action (whichever domain) → habit loop
- Example: "Daily-use loop" — what a returning user does on any given day, moving through dashboard → core feature → completion
- Example: "Admin configuration" — first-time setup flow touching settings, roles, billing, permissions

**Domain flows (`cowmoo/design/domains/*.md`):** per-feature step-by-step flows inside one domain.
- Example: "Edit profile" (stays in user domain)
- Example: "Complete checkout" (stays in billing domain)

When a flow crosses domain boundaries, it's a journey. When it stays inside one, it's a domain flow.

---

## Template

```markdown
# User Journeys

End-to-end user arcs for [product name]. These are the big-picture progressions that cross domain boundaries. Per-feature flows inside a single domain live in `cowmoo/design/domains/*.md`.

Companion to `cowmoo/design/OVERVIEW.md`, `cowmoo/design/roles.md`, `cowmoo/design/screen-index.md`, and `cowmoo/design/domains/*.md`.

---

## [Journey Name — e.g. New User Onboarding]

**Persona:** [who is going through this arc — e.g. first-time self-serve signup]
**Starting state:** [where the user begins — e.g. landed on marketing page, clicked "Get Started"]
**End state:** [where the user ends up — e.g. created first record, understands core loop]
**Spans domains:** [list of domains this arc touches]

**Arc:**

1. **[Step name]** — [which screen(s), what the user does, what the system responds with]
   - Screen(s): [cross-reference to screen-index or domain files]
   - User action: [what they do]
   - Outcome: [what they see next]
2. **[Step name]** — [...]
3. **[Decision point]** — [if X path, if Y path]
4. **[Completion]** — [where they land, what changed]

**Key moments:**
- [Moment where drop-off risk is highest — what design choice mitigates it]
- [Moment where user commits — what makes the commitment clear]

**Open questions:** [anything about this arc that's still unresolved]

---

## [Next Journey Name]

[...]

---

## [Another Journey]

[...]
```

---

## Rules

- **Cross-cutting only.** Single-domain flows belong in `cowmoo/design/domains/*.md`, not here.
- **2-5 journeys per product** typically. More than that suggests a journey is too narrow (move to domain flow) or the product has genuinely complex cross-cutting arcs (keep them but verify each is genuinely cross-domain).
- **Arcs reference domain files, not duplicate them.** A journey step says "sends user to domain/orders.md's order-creation flow", not "here's the order-creation flow again".
- **Key moments matter.** For each journey, call out where the user is most likely to drop off or get confused, and what design choice addresses it. This is valuable context for planner and builder.
- **Narrative is OK.** Journeys are the most prose-heavy UXUI file. Reader walks through a user's experience, not scans a reference table.
- **Grows over time.** May start with one or two journeys (onboarding, daily loop) and add more as the product picture develops.
