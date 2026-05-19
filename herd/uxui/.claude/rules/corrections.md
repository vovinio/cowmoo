---
description: Deferred-corrections doctrine — the blocking-vs-deferrable test and the PENDING-CORRECTIONS.md queue. Always loaded.
---

# Deferred Corrections

When UXUI work surfaces something for another agent — the human designer, PM, or planner — that is **not blocking**, collect it in `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` instead of firing an immediate cross-agent round-trip. `/dispatch-corrections` later ships the collected items as one consolidated issue per target.

This rule is the disposition itself: it applies in **every** UXUI workflow — bundle review, coverage review, UI definition, discussion — not only where a skill names it explicitly.

## Blocking vs deferrable

For any delta UXUI cannot fix in its own `cowmoo/design/` territory, ask:

> **Does the product still function correctly if this ships unfixed — just with imperfect words — or is it actually wrong, broken, or incomplete?**

- **Deferrable** — the screen or spec *works*; only the wording is off. → collect in `PENDING-CORRECTIONS.md`.
- **Blocking** — it changes what a screen *does*, or a builder cannot build the right product without it. → escalate now via `/ask`.

**Default for pure wording on a functioning screen: deferrable.** Over-escalating — treating every nit as blocking — is the failure this rule exists to prevent; it is just as wrong as letting a real blocker sit in the queue. Do not inflate a copy fix into a blocker.

### Deferrable — collect
- Microcopy: button labels, headings, helper text, confirmation lines, empty-state prose, error-message wording.
- A label rename that does not change information architecture.
- Copy that drifted from a spec update but still maps to the same element.

### Blocking — escalate now
- Missing or wrong screen states (Empty / Loading / Error / Partial; form states).
- Layout, navigation, or flow changes.
- Role or token changes — anything affecting `cowmoo/design/roles.md`.
- A spec contradiction, or any delta that changes *what a screen does*, not just what it says.

Never queue *and* escalate the same delta — a blocking item goes to `/ask` now, a deferrable item is collected. The queue is not a way to dodge a hard conversation.

## Targets

Each entry is routed to the agent who owns the fix:

- **designer** — copy that lives in an existing Claude Design bundle's design. The bundle is the concrete reference a builder works from, so stale copy there is eventually re-rendered. A `For: designer` entry names its screen as `<domain> / <screen>` — the screen must already have a design (a `**Bundle:**` line in `cowmoo/design/domains/<domain>.md`). `/dispatch-corrections` ships these as a `revise` change-task against the existing design: the copy deltas become the changeset, never a from-scratch rebuild.
- **PM** — user-facing text owned by the specs (`cowmoo/specs/**`): wording, terminology, a copy mismatch UXUI noticed against a spec.
- **planner** — a small non-blocking note about a task PRD's framing. The thinnest case — most planner-bound findings about task *scope* are blocking, and those go to `/ask planner`.

## `PENDING-CORRECTIONS.md`

At `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` (UXUI scratch). Created on first append. One section per target, one entry per delta:

```markdown
# Pending Corrections

Non-blocking copy-grade deltas collected for batched dispatch — see
`.claude/rules/corrections.md`. `/dispatch-corrections` ships one
consolidated issue per target.

## For: designer

- [ ] **<domain> / <screen>** — `<current copy>` → `<corrected copy>`
  - Source: <bundle #N review / coverage check / spec update> · Date: YYYY-MM-DD
  - Why: <one line — what makes the current copy wrong>

## For: PM

- [ ] **<spec section / screen>** — `<current text>` → `<suggested text>`
  - Source: … · Date: YYYY-MM-DD
  - Why: …

## For: planner

- [ ] **<task / story>** — <observation>
  - Source: … · Date: YYYY-MM-DD
  - Why: …
```

**Lifecycle.** Appended by any UXUI skill or session that surfaces a deferrable delta — most often `/review-bundle` triage, but general design work too. Read and shipped by `/dispatch-corrections`: the `For: PM` and `For: planner` sections each ship as one consolidated message issue, and the `For: designer` section ships as a `revise` change-task per existing design (the copy deltas become its changeset). It then marks each dispatched entry `- [x]` and adds a `Dispatched: #<issue> (YYYY-MM-DD)` line. Checked entries stay as an audit trail; prune them periodically. The statusline counts unchecked entries.
