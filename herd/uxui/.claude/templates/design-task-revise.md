# Design Task Template — `revise` mode

Body structure for a **`revise`-mode** `uxui:todo` issue: a **change-task**
against a screen (or coupled unit of screens) that **already has a design**.

A `revise` task does NOT re-specify the screen from scratch. It points the
designer at the existing Claude Design project and gives a **change request** —
the specific edits to make, each paired with its spec reason. Reuse and modify;
do not rebuild. (To design a screen that has no existing design, use
`design-task.md`.)

`/design-draft` (from `/design-start`'s drift triage) and `/dispatch-corrections`
both compose this body. `/design-publish` — via `issue-create` — creates the issue.

The body has the same two-section shape as `design-task.md`:
1. **Instructions** — short, scannable bullets for the human designer: the
   task's mode/domain/screens, the existing design to open, how to submit.
2. **Claude Design Prompt** — a copy-pasteable **change request**, copied
   verbatim into `claude.ai/design` *after the designer has opened the existing
   project*. It is prose, not a table — the designer pastes it as one block,
   the same way a `new` task's prompt is pasted.

---

## Template

```markdown
## Instructions

**Mode:** revise
**Domain:** [domain]
**Screens:** [screen]               ← comma-separated for a multi-screen unit
**Existing design:** [cowmoo/design/bundles/<ticket>/ path] · [share URL from that bundle's meta.json]

Work this task in the **existing** Claude Design project — do not start a new
one, do not redesign from scratch. First open the project at the share URL
above. Then paste the **Claude Design Prompt** below into Claude Design and
iterate with the user until satisfied. Apply only the changes it lists; keep
everything else as it is.

**Pay attention to:**
- [bullet — e.g. "the countdown layout otherwise stays exactly as designed"]
- [bullet — e.g. "the new banner zone must use the existing surface roles"]

**Acceptance:**
- [ ] Every numbered change applied; nothing else changed
- [ ] The changes match the spec rationale given

**Made a product call?** If you decided something different from this change
request — a layout, state, copy, or interaction you judge better — that is
expected, not a problem. Note what you changed and why in your submission
comment so UXUI can capture it for spec alignment.

**When done:**
1. In Claude Design, click **Share with Claude Code** to get a share URL
2. Comment on this issue with the URL
3. Relabel from `uxui:todo` → `uxui:review`

---

## Claude Design Prompt

Copy everything from here to the end of the issue body, verbatim, into Claude
Design — after you have opened the existing project at the share URL above.

---

# Change request — [unit label]

## Why these changes

[One orienting line — what this batch of changes accomplishes and why now.]

## Changes

[Numbered, detailed prose paragraphs — NOT a table. Group by screen with an
`### <Screen Name>` sub-heading when the unit covers several screens; number
the changes per screen. Each paragraph states the current state concretely,
then the desired state concretely, in enough detail that the designer can act
without re-reading the spec. Each change ends with its spec rationale on its
own line.]

### [Screen Name]   ·   file(s): [e.g. App.jsx, HomeTab.jsx]

**1.** [Current: what the existing design shows. Desired: what it should show
instead — concrete, specific prose.]
*Spec: [the spec section / rule that requires this change.]*

**2.** [Current → desired, prose.]
*Spec: [spec section / rule.]*

[Repeat the `### <Screen>` block per screen in the unit.]

## Add (new screens / regions)

[Any genuinely new screen or region to add inside the existing project, each
with its spec reference. Omit this section if the change request adds nothing
new. A coupled new screen is built inside the existing project — never a
separate `new` task.]

## What NOT to change

[Name the parts of the existing design that must stay as they are — the layout,
flows, and screens this change request does not touch. This is the guard that
keeps a `revise` from drifting into a rebuild.]

## Output expectation

Keep the existing project's framework and viewport(s). Apply only the numbered
changes above; everything named in "What NOT to change" stays exactly as
designed.
```

---

## Rules

- **Reuse, don't rebuild.** A `revise` body is a change request against an
  existing design. It must NOT carry a full from-scratch layout / components /
  all-states brief — that re-invites a rebuild and discards the existing design.
  The `## What NOT to change` section is the guard.
- **Copy-pasteable prose, not a table.** The `## Claude Design Prompt` block is
  pasted verbatim into Claude Design as one artifact — the designer's workflow
  is copy-and-paste, not read-a-spec. Each change is a detailed prose paragraph,
  never a table cell.
- **Point at the existing design.** The `**Existing design:**` line (bundle path
  + share URL) and the per-screen `file(s):` are mandatory — the designer must
  be able to open the right project and the right files.
- **Every change cites the spec.** A numbered change with no `*Spec: …*`
  rationale is not reviewable — `@design-evaluator` checks the returned bundle
  against the rationale. State the reason for each change.
- **A coupled new screen is a change-request entry, not a separate task.** When
  a genuinely new screen is coupled into an existing design, add it under
  `## Add` — it is built inside the existing project, not as a separate `new`
  task.
- **Self-contained.** Each change states the current and desired state
  concretely; do not write "see the spec" — name the change.
- **Instructions stay short.** Bullets only.
