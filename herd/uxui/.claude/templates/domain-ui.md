# Domain UI Definition Template

Structure for domain files in `cowmoo/design/domains/`. Each file defines screens, flows, and interactions for one product area. Companion to the matching `cowmoo/specs/domains/` file (business truth) and `cowmoo/design/roles.md` (role vocabulary). Screen definitions reference roles from `cowmoo/design/roles.md` by name — they never invent new raw visual values.

---

## Template

```markdown
# [Domain Name] — UI Definition

Companion to cowmoo/specs/domains/[domain].md. Defines screens, flows, and
interactions for the [domain] domain.

Role references point to `cowmoo/design/roles.md`. Concrete values are resolved
downstream (src/ after build, framework defaults).

---

## Navigation

- Where this domain lives in the app navigation
- Sub-navigation within the domain
- Breadcrumb path

---

## Screens

### [Screen Name]

**Purpose:** [What the user accomplishes on this screen — one sentence]
**Entry points:** [How the user arrives — which screens link here]
**Screen type:** [List / Detail / Form / Dashboard / Settings]

**Layout:**
[High-level description of the screen structure — major sections,
information grouping, visual hierarchy. NOT pixel-level design.]

**Components:**
[Key interactive components on this screen and their behavior.
Describe what they DO, not what library to use.]

- [Component]: [what it shows, how it behaves, what data it uses]

**Roles Used:** (reference `cowmoo/design/roles.md`)
- Interaction: [e.g. `primary-action` for Save button, `destructive-action` for Delete]
- Text: [e.g. `text-body` for content, `text-muted` for helper text, `text-heading` for section title]
- Spacing: [e.g. `space-tight` between list items, `space-loose` between sections]
- Surface: [e.g. `surface-raised` for card, `surface-base` for page canvas]
- Status: [e.g. `status-error` for validation, `status-success` for confirmation]

If a role you need doesn't exist in `cowmoo/design/roles.md`, add it there first, then reference it here.

**States:** (declare only the vocabularies that apply to this screen — see `.claude/rules/ui-vocabulary.md`)

*Data states* (for data-fetching screens — lists, tables, detail views, dashboards):
- **Empty:** [what the user sees when there's no data — message, CTA]
- **Loading:** [how loading is communicated]
- **Populated:** [normal state with data — what's visible, how it's organized]
- **Error:** [what happens on failure — message, recovery path]
- **Partial:** [if some data loaded and some failed — what's shown, retry path]

*Form states* (for screens with forms — settings, create/edit, onboarding):
- **Idle:** [initial state before any input]
- **Dirty:** [at least one field changed — affects navigation guards]
- **Submitting:** [request in flight — button disabled, form non-interactive]
- **Success:** [submit succeeded — redirect, confirmation, or cleared form]
- **Error:** [submit failed — field-level inline, form-level summary]

*Edge cases from spec:*
- **[Edge case from spec]:** [specific scenario and how it manifests on screen]

**Interactions:**
[What the user can DO on this screen and what happens for each action]

- [Action]: [trigger] → [what user sees] → [where they end up]

**Bundle:** [Attached post-approval by `/approve-design`. Format: `cowmoo/design/bundles/<ticket>/` (approved YYYY-MM-DD, ticket #N). Absent until a Claude Design submission is approved for this screen. Multiple lines if the screen has been re-designed.]

**Spec divergence:** [Present only when the design embodies a deliberate product decision that runs ahead of the current spec — see `.claude/rules/corrections.md`. Format: `<what the design does that the spec does not yet> — pending PM alignment (logged YYYY-MM-DD)`. Absent on screens that match the spec. Removed once PM adopts the divergence into the spec.]

---

## Flows

### [Flow Name]

[End-to-end user journey that stays inside this domain. Cross-domain
arcs belong in `cowmoo/design/journeys.md`, not here.]

1. [Starting point] — [what triggers the flow]
2. [Screen/action] — [what the user does]
3. [System response] — [what happens, what the user sees]
4. [Decision point] — [if X → path A, if Y → path B]
5. [Completion] — [where the user ends up, what changed]

---

## Cross-Domain UI Connections

[Where this domain's screens reference entities or data from other domains]

- [Screen] uses [Entity/Data] from [Other Domain] — [how it appears on screen]
```

---

## Rules

- **One file per domain** (matching cowmoo/specs/domains/ structure as default, with flexibility for cross-cutting files like dashboard, settings, onboarding)
- **Screens before flows** — flows reference screens, so screens must be defined first
- **States declared per vocabulary** — every screen must declare the states applicable to it per `.claude/rules/ui-vocabulary.md`: data states (empty/loading/error/populated/partial) for data-fetching screens, form states (idle/dirty/submitting/success/error) for forms. Screens without data fetching aren't required to declare data states.
- **Edge cases from specs** — every edge case in the matching spec file must have a corresponding state
- **Layout describes structure, not pixels** — "two-column: form left, summary right" not "left column 400px"
- **Components describe behavior, not implementation** — "searchable client selector that supports 500+ entries" not "use react-select"
- **Reference roles from `cowmoo/design/roles.md`** — every visual concept (color, text, spacing, surface, status) referenced on a screen must use a named role from `cowmoo/design/roles.md`. If a role doesn't exist yet, add it to `roles.md` first, then reference it here. Never invent raw values in domain files.
- **No raw values.** No hex codes, no pixel numbers, no `rgb()/rgba()`, no specific font sizes or weights. Concrete values are resolved downstream (src/, framework defaults, BUILD-NOTES.md).
- **Cross-domain arcs belong in `cowmoo/design/journeys.md`** — domain flows stay within a single domain. When a user journey crosses domains, move it to journeys.
- **Screens listed here must appear in `cowmoo/design/screen-index.md`** — every screen defined in a domain file has an entry in the master screen index. `/define` handles this sync.
- **Bundle: lines are post-approval only** — never write a `**Bundle:**` line speculatively. Only `/approve-design` writes them, after a designer's submission has been reviewed and approved.
- **Spec divergence: lines flag design ahead of spec** — when a screen embodies a deliberate designer (or UXUI UI-level) decision that runs ahead of the current spec, mark it with a `**Spec divergence:**` line so builder and planner know the design is the current truth there. `/approve-design` and `/resolve-review` add them; `/process-message` clears one when PM's spec update adopts the divergence. See `.claude/rules/corrections.md`.
