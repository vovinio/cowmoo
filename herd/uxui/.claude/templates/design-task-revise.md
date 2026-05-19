# Design Task Template — `revise` mode

Body structure for a **`revise`-mode** `uxui:todo` issue: a **change-task**
against a screen (or coupled unit of screens) that **already has a design**.

A `revise` task does NOT re-specify the screen from scratch. It points the
designer at the existing Claude Design project and gives a **changeset** — the
specific edits to make, each paired with the spec reason. Reuse and modify; do
not rebuild. (To design a screen that has no existing design, use
`design-task.md`.)

`/design-draft` (from `/design-start`'s drift triage) and `/dispatch-corrections`
both compose this body. `/design-publish` — via `issue-create` — creates the issue.

The body has two sections:
1. **Instructions** — the task's mode/domain/screens, the existing design to
   open, how to submit.
2. **Changeset** — one table per screen: current state → desired state → the
   spec rationale. No from-scratch layout/components/all-states brief.

---

## Template

```markdown
## Instructions

**Mode:** revise
**Domain:** [domain]
**Screens:** [screen]               ← comma-separated for a multi-screen unit
**Existing design:** [cowmoo/design/bundles/<ticket>/ path] · [share URL from that bundle's meta.json]

Work this task in the **existing** Claude Design project — do not start a new
one, do not redesign from scratch. Open the project at the share URL above (or
your existing project for this area), then apply only the changeset below. Each
change names its spec reason; keep everything else as it is.

**Pay attention to:**
- [bullet — e.g. "the countdown layout otherwise stays exactly as designed"]
- [bullet — e.g. "the new banner zone must use the existing surface roles"]

**Acceptance:**
- [ ] Every changeset row applied; nothing else changed
- [ ] The changes match the spec rationale given

**When done:**
1. In Claude Design, click **Share with Claude Code** to get a share URL
2. Comment on this issue with the URL
3. Relabel from `uxui:todo` → `uxui:review`

---

## Changeset

[One table per screen in the unit. Each row is one change. The "Why (spec)"
column cites the spec section/rule that requires the change — that is what makes
the change reviewable.]

### Screen: [Screen Name]   ·   file(s): [e.g. App.jsx, HomeTab.jsx]

| Current | Desired | Why (spec) |
|---|---|---|
| [what the existing design shows] | [what it should show] | [spec section / rule] |
| ... | ... | ... |

**Add (new screens / regions coupled into this design):**
- [a new screen or region that should be added to the existing project, with its spec reference — for a `new` screen coupled into this existing design]
```

---

## Rules

- **Reuse, don't rebuild.** A `revise` body is a changeset against an existing
  design. It must NOT carry a full from-scratch layout / components / all-states
  brief — that re-invites a rebuild and discards the existing design.
- **Point at the existing design.** The `**Existing design:**` line (bundle path
  + share URL) and the per-screen `file(s):` are mandatory — the designer must
  be able to open the right project and the right files.
- **Every change cites the spec.** A changeset row with no spec rationale is not
  reviewable — `@design-evaluator` checks the returned bundle against the
  rationale. State the reason for each row.
- **A coupled new screen is a changeset entry, not a separate task.** When a
  genuinely new screen is coupled into an existing design, add it under "Add"
  — it is built inside the existing project, not as a separate `new` task.
- **Self-contained changeset.** Each row states the current and desired state
  concretely; do not write "see the spec" — name the change.
- **Instructions stay short.** Bullets only.
