---
description: Deferred-corrections & spec-alignment doctrine — the three dispositions and the PENDING-CORRECTIONS.md queue. Always loaded.
---

# Deferred Corrections & Spec Alignment

When UXUI work surfaces something another agent owns — the human designer, PM, or planner — UXUI does not always fire an immediate cross-agent round-trip. Most deltas are **collected** in `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` and shipped in a batch by `/dispatch-corrections`. This rule decides what is collected, what is escalated now, and — for the design-led case — what UXUI simply flows with.

This rule is the disposition itself: it applies in **every** UXUI workflow — bundle review, coverage review, UI definition, discussion — not only where a skill names it explicitly.

## Design-led iteration

Specs are the **starting point**, not a cage. During design the human designer (working in Claude Design) makes real product decisions — copy, layout, interaction, and product calls — and those decisions can run ahead of the current spec. UXUI **flows with a sound designer decision** rather than blocking on it: the design moves forward, the divergence is recorded, and the accumulated divergences are reconciled with PM in a batch at an alignment milestone — not one PM round-trip per change.

UXUI itself has the same latitude at the **UI level** — a small UI-level call that extends the spec is a divergence to record, not a blocker. UXUI does **not** have that latitude for **business logic**: a genuine business-rule unknown ("the spec never says what a failed payment does") is not a decision UXUI gets to make — it escalates (disposition 3 below).

## Three dispositions

For any delta UXUI cannot fully resolve inside its own `cowmoo/design/` territory, classify it:

### 1. Deferrable copy — collect

The screen *works*; only the wording is off. Microcopy, button labels, headings, helper text, empty-state prose, error-message wording; a label rename that does not change information architecture; copy that drifted from a spec update but still maps to the same element.

→ collect in `PENDING-CORRECTIONS.md` — `For: designer` if the copy lives in a bundle's design, `For: PM` if it is spec-owned text.

### 2. Designer-led spec divergence — flow, mark, log

A **deliberate, sound** product/UX decision the design now embodies that runs ahead of — or differs from — the current spec. The product *works*; it is simply ahead of the spec. Originated by the human designer, or a UI-level call by UXUI.

→ accept it; update the affected `cowmoo/design/` file(s) to match the decision; add a `**Spec divergence:**` marker to the screen (see below); log a spec-divergence entry to `PENDING-CORRECTIONS.md` `For: PM`. Do **not** block, do **not** reject the bundle.

### 3. Blocking — escalate now

A delta that **breaks the product**: a divergence that breaks other screens or flows, contradicts a hard business rule, or cannot coexist with the rest of the product; OR a genuine business-logic gap UXUI cannot decide.

→ escalate now via `/ask` — `/ask pm` for a spec or business-logic question, `/ask planner` for a wrong task scope. Rare — most design-led change is disposition 2.

### Decision vs. omission

Disposition 2 is for a *deliberate* decision. A designer **omission or error** — a missing required state, a broken interaction, a dropped element the brief required — is not a divergence; it is a **gap**, and a gap is a blocking finding (a bundle return), not something to flow with. Flow with what the designer *chose*; never flow with what they *missed*.

**Default for a sound designer decision: disposition 2.** Forcing every designer product call through an immediate PM round-trip is the failure this rule prevents — it kills design velocity. Equally: never inflate a copy nit into a divergence, or a divergence into a blocker. Reserve disposition 3 for what genuinely breaks the product. Never queue *and* escalate the same delta — a blocking item goes to `/ask` now, a deferrable item or a divergence is collected.

## The `**Spec divergence:**` marker

When a screen's design embodies a spec divergence (disposition 2), the screen's section in `cowmoo/design/domains/<domain>.md` carries a one-line marker — so a downstream agent reading `cowmoo/design/` knows the design, not the stale spec, is the current truth here:

```
**Spec divergence:** <what the design does that the spec does not yet> — pending PM alignment (logged YYYY-MM-DD)
```

It is removed once PM adopts the divergence into the spec. Normally `/process-message`'s spec-update handler clears the matching marker when it processes PM's adopting spec update. If PM adopts a divergence without sending a `for-uxui` notice, the marker is instead cleared the next time UXUI notices the spec has caught up — `/review` (coverage check) and `/define` clear a stale marker when the spec and design have converged.

## Targets

Each `PENDING-CORRECTIONS.md` entry is routed to the agent who owns the fix:

- **designer** — copy that lives in an existing Claude Design bundle's design. The bundle is the concrete reference a builder works from, so stale copy there is eventually re-rendered. A `For: designer` entry names its screen as `<domain> / <screen>` — the screen must already have a design (a `**Bundle:**` line in `cowmoo/design/domains/<domain>.md`). `/dispatch-corrections` ships these as a `revise` change-task against the existing design: the copy deltas become the change request, never a from-scratch rebuild.
- **PM** — two kinds: user-facing **copy** owned by the specs (`cowmoo/specs/**`) — wording, terminology, a copy mismatch UXUI noticed against a spec — and every **spec divergence** (disposition 2), which PM adopts into the specs at alignment.
- **planner** — a small non-blocking note about a task PRD's framing. The thinnest case — most planner-bound findings about task *scope* are blocking, and those go to `/ask planner`.

## `PENDING-CORRECTIONS.md`

At `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` (UXUI scratch). Created on first append. One section per target; the `For: PM` section is split into spec divergences and copy corrections. One entry per delta:

```markdown
# Pending Corrections

Non-blocking copy-grade deltas and design-led spec divergences collected for
batched dispatch — see `.claude/rules/corrections.md`. `/dispatch-corrections`
ships one consolidated issue per target.

## For: designer

- [ ] **<domain> / <screen>** — `<current copy>` → `<corrected copy>`
  - Source: <bundle #N review / coverage check / spec update> · Date: YYYY-MM-DD
  - Why: <one line — what makes the current copy wrong>

## For: PM

### Spec divergences — design ran ahead of spec; adopt into the specs

- [ ] **<domain> / <screen>** — design now: <what the design does> · spec <section>: <what the spec says, or "silent">
  - Decided by: <designer | uxui> · Source: <bundle #N review / coverage check / design discussion> · Date: YYYY-MM-DD
  - Why: <product rationale — why this is the right call>
  - Design updated: <cowmoo/design/ file(s) now reflecting this; marker added>

### Copy corrections — spec-owned wording

- [ ] **<spec section / screen>** — `<current text>` → `<suggested text>`
  - Source: … · Date: YYYY-MM-DD
  - Why: …

## For: planner

- [ ] **<task / story>** — <observation>
  - Source: … · Date: YYYY-MM-DD
  - Why: …
```

**Lifecycle.** Appended by any UXUI skill or session that surfaces a deferrable delta or a spec divergence — most often `/review-bundle` triage, but coverage review (`/review`) and UI-definition work (`/define`) too. Read and shipped by `/dispatch-corrections`: the `For: PM` and `For: planner` sections each ship as one consolidated message issue, and the `For: designer` section ships as a `revise` change-task per existing design (the copy deltas become its change request). It then marks each dispatched entry `- [x]` and adds a `Dispatched: #<issue> (YYYY-MM-DD)` line. Checked entries stay as an audit trail; prune them periodically. The statusline counts unchecked entries.

**Alignment milestone.** Spec divergences accumulate as the design phase advances. When a meaningful chunk of screens has reached `uxui:done`, dispatch the `For: PM` queue with `/dispatch-corrections pm` — the spec-alignment pass that hands PM every divergence to adopt. It is a judgment call, not automatic; `/approve-design` prompts for it when divergences are queued.
