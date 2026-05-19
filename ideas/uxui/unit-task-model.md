# Phase B — Delta-Based Design Tasks

**Status:** design draft, for review. Not yet built.

Combines two UXUI proposals plus the brownfield clarification into one Phase B
redesign:

- `screen-coupling-check-before-task-split.md` — the *unit* axis (§7).
- `check-existing-design-before-design-tasks.md` — the *mode* axis + existing-
  design detection (§3–§6).

It realigns the corrections mechanism shipped earlier this session (§9).

---

## 1. The core idea

UXUI Phase B today only knows how to **commission new designs** — every
`/design-draft` task is a from-scratch `## Claude Design Prompt` for one screen.
But a project usually *starts with an imported design* — often a whole-project
Claude Design export covering many screens — and then the specs advance past it.
Most Phase B work is **reconciling that drift**, not designing from zero.

The redesign gives a design task **two independent properties**:

- **Mode** — `new` or `revise`.
  - **`new`** — the screen exists in no prior design. From-scratch prompt.
  - **`revise`** — a design already exists. The task references it and carries a
    **changeset** — *what to change, and the spec reason* — never a rebuild.
- **Unit** — one screen, or several **coupled** screens, designed in one Claude
  Design project and returned as one bundle.

In an ongoing project most work is `revise`; `new` is the first pass and the
genuinely-new-screen case.

---

## 2. The deeper point: not every drift is a designer task

A spec-vs-design contradiction has **three** resolutions, and `/design-start`
must triage each one explicitly:

| Drift | Resolution | Output |
|---|---|---|
| The screen exists in no design | design it | a **`new`** design task |
| The design is stale, the spec is right | change the design | a **`revise`** change-task to the designer |
| The design is fine, the design *def* (`cowmoo/design/**`) is stale | fix the def | **UXUI edits `cowmoo/design/**` itself** via the Phase A `/define` loop — **no designer task** |

The current flow can only ever produce the first. It cannot reuse an existing
design, and it cannot recognise that the right fix is sometimes a def-edit with
no designer involved at all. Triaging drift into these three buckets is the
heart of the redesign.

---

## 3. Why `revise` is a distinct mode

A from-scratch `## Claude Design Prompt` for an already-designed screen makes
Claude Design **regenerate** it — discarding the existing layout, the designer's
iterations, the approved visual character. The proposal's user feedback is
explicit: *"not reinventing the wheel and telling exactly how to build something
from scratch."*

Claude Design natively supports the alternative — a project is persistent and
re-openable; iteration is chat messages + inline comments on the existing
canvas. A `revise` task is **"open existing project X, apply this changeset."**

---

## 4. Detecting an existing design — scan bundle contents, do not trust `meta.json`

`/design-start` must classify each candidate screen as **has an existing design**
vs **net-new**. The detection rule:

- **Scan `cowmoo/design/bundles/*/project/` for actual screen/component files.**
  A bundle's real coverage is its `project/` folder contents.
- **`meta.json` is not authoritative on coverage.** Its `screen` field names the
  *ticket*, not the bundle's scope. Observed: `bundles/2/` is labelled
  "ticket 2 / login" but `project/` holds the whole project — `App.jsx`,
  `HomeTab.jsx`, `RsvpScreen.jsx`, `RsvpPartyWidget.jsx`, the Schedule/Guests/
  Profile tabs, every Backoffice screen, desktop + mobile. A bundle filed under
  one ticket is often a whole-project export.
- `**Bundle:**` lines in domain files remain a *secondary* per-screen signal
  (what `/approve-design` recorded), but the bundle-contents scan is primary
  because it catches whole-project imports that were never approved per screen.

`/design-start` Step 1 builds a "what's already designed" map from this scan; the
batch proposal states the **mode verdict per screen** so the user approves a
batch that already knows which screens are change-tasks, which are net-new, and
which are def-edits (§2).

---

## 5. The change-task body — a changeset, not a brief

A `revise` task body (new template variant — see §8):

- **Instructions** — open the *existing* Claude Design project (share URL from
  the bundle's `meta.json`), edit the named file(s); submit URL → comment →
  relabel. Plus the `**Mode:** revise`, `**Domain:**`, `**Screens:**`,
  `**Existing design:**` lines (§7).
- **Changeset** — a table, one row per change: **current state → desired state →
  spec rationale**. It names *only* what moves. It does NOT carry a from-scratch
  layout / components / all-states brief — that would re-invite the rebuild.

Worked example (the real rewritten issue #12): open the existing project, edit
`App.jsx` + `HomeTab.jsx`, apply:

| Current | Desired | Spec says |
|---|---|---|
| Countdown shows a Seconds card | Remove the Seconds card | spec forbids a seconds unit |
| Nav tab labelled "RSVP" | "My RSVP" | spec terminology |
| No banner zone | Add the banner zone | spec calls for it |
| "Google maps" text link | "Open in Maps" button | spec specifies a button |

`new` tasks keep today's `design-task.md` from-scratch shape.

---

## 6. `@design-evaluator` reads `project/*` — not `project/*.html`

`@design-evaluator` currently reads `<bundle-path>/project/*.html`. Claude Design
exports **React (`.jsx`/`.tsx`) for component UIs**, not only HTML — the
vovinoy bundle's `project/` is `.jsx`. The current glob would miss a `.jsx`
bundle entirely. The evaluator must read whatever design files `project/` holds
(`*.html`, `*.jsx`, `*.tsx`, `*.css`, …). Small but real — fix it as part of
this work.

---

## 7. Coupling, and the task contract

**Coupling (the unit axis).** UXUI couples screens into one unit when separate
Claude Design projects would be wasteful — one renders inside another, shared
load-bearing chrome, a tight flow needing joint consistency. Don't force it.
The judgment is made in `/design-start`, reconfirmed in `/design-draft`. A
`revise` unit is natural: a whole-project import bundle *is already* one project,
and its changes are made together in it.

**The contract.** A task's mode/domain/screens/existing-design must be
recoverable from the **GitHub issue** (the only post-publish artifact):

- Title `[UXUI] <domain>: <unit-label>` — `<unit-label>` is the screen name for a
  one-screen unit, or a short cluster label for a multi-screen unit.
- Instructions carries `**Mode:**`, `**Domain:**`, `**Screens:**`, and for
  `revise` `**Existing design:**` (bundle path + share URL).
- `/review-bundle` Step 2 reads `**Mode:**` / `**Domain:**` / `**Screens:**`
  from the body (not the title) and passes them to `@design-evaluator`.
  `**Existing design:**` is a **designer-facing** instruction — it tells the
  human which Claude Design project to open; no agent-side skill reads it.
  `@design-evaluator` evaluates a `revise` submission against the *changeset*
  (the `current` column already states the prior state), so it never needs the
  prior bundle.
- A unit is single-domain (open question §12).

---

## 8. Per-surface changes

### Creation side

| Surface | Change |
|---|---|
| `/design-start` | Step 1 scans `bundles/*/project/` → "what's designed" map. Step 3 triages drift three ways (§2), proposes **units** each with a **mode**, states the per-screen verdict. Def-edit items (§2 row 3) route to the `/draft`→`/define` Phase A loop — not a designer task. |
| `/design-draft` | Composes per unit, per mode: `new` → from-scratch body; `revise` → changeset body (§5) against the existing design. `design-draft.json` entries gain `mode`, `domain`, `screens[]`, and (revise) the existing-design reference. |
| `templates/design-task.md` | Keep the `new` shape; add a **change-task variant** — share URL + target file(s) + changeset table, explicitly *not* a full from-scratch brief. (Two templates or one — open question §12.) |
| `@design-task-checker` | Accept both shapes. For a change-task, "self-contained" = share URL + file(s) + changeset present and every change has a rationale — NOT every state re-specified. A change-task must not be false-rejected for "missing states." |
| `/design-publish` | Largely unchanged — ships the composed unit tasks. |

### Review / approve side

| Surface | Change |
|---|---|
| `/review-bundle` | Step 2 reads `**Mode:**`/`**Domain:**`/`**Screens:**` from the body. Step 4 passes `mode` + `screens[]` to `@design-evaluator`. |
| `@design-evaluator` | Input `screen` → `screens[]` + `mode`; reads `project/*` not `*.html` (§6). For `revise`, evaluates the returned bundle against current specs + domain def + the requested changeset. |
| `/approve-design` | Attaches a `**Bundle:**` line per covered screen, one Edit (§10). For a `revise` of an already-bundled screen the new line appends below the prior. One journal entry per unit. |

### dev-tools.cjs

`review-resume-state` (multi-line tolerant), `journal-update` (`screen` → unit
label). `bundle-fetch`, `commit attach-design` unchanged.

### Corrections mechanism — see §9.

### CLAUDE.md / docs

`herd/uxui/CLAUDE.md` Phase B narrative + Scope table; sweep `docs/` for
"one screen per task" / from-scratch-only phrasing.

---

## 9. How the corrections mechanism folds in

A copy correction **is** a `revise` change-task with copy-only changeset rows.

- **Survives unchanged** — the `PENDING-CORRECTIONS.md` queue + the
  blocking/deferrable classification. They govern *when* a delta dispatches, not
  the task shape.
- **Realigns** — `/dispatch-corrections`' designer dispatch composes a
  **`revise` change-task** (existing project + changeset), not the from-scratch
  `design-task.md` body the `/audit-agent` fix built. This unifies it with
  `/design-draft`.

`/design-draft` and `/dispatch-corrections` both emit `revise` tasks;
`/design-draft` also emits `new`. The corrections queue is one feeder.

---

## 10. The fiddly bits

**Atomic multi-bundle attach** — `/approve-design` writes all N `**Bundle:**`
lines in one Edit → one commit → resume stays binary.

**Resume / journal** — `review-resume-state` reports presence + porcelain
(unchanged contract); one VISUAL-JOURNAL entry per unit.

---

## 11. What this supersedes

- The earlier narrow "unit-task model" draft — folded in as §7.
- The `/audit-agent uxui` per-screen `/dispatch-corrections` fix — its
  per-screen from-scratch composition is replaced by `revise` change-tasks. A
  correct local repair for the pipeline as it was; this is the architecture fix.
- The from-scratch-composition half of the shipped corrections mechanism — the
  queue + classification stay (§9).

---

## 12. Decisions

The open questions, resolved:

1. **Def-edit hand-off** — `/design-start` *flags* a def-stale drift for the
   Phase A `/draft`→`/define` loop; it does not write def files itself.
2. **Whole-project import → units** — a whole-project import is the `revise`
   *source*; tasks are still cut by the coupling judgment, leaning toward
   **coarser units (coherent areas)** since parallelism is unavailable within
   one shared project. UXUI's judgment, not a fixed rule.
3. **Cross-domain units** — not allowed; a unit is single-domain. Screens in
   different domains that seem coupled signal a Phase A domain-split problem.
4. **Mixed-mode units** — mode is per-unit. A *new* screen coupled into an
   existing design is a **changeset row** in the `revise` task ("add screen Y"),
   not a separate `new` task. A `new`-mode task is only for a screen with no
   existing design and not coupled into one.
5. **Templates** — two: `design-task.md` (`new`) + `design-task-revise.md`
   (`revise`).

---

## 13. Build order

1. Resolve §12 open questions.
2. `templates/` — the `new` shape + the change-task variant.
3. `@design-task-checker` — accept both; no false "missing states" reject.
4. `/design-start` — bundle-contents scan, three-way drift triage, mode + unit.
5. `/design-draft` → `/design-publish` — compose per mode, ship.
6. `/review-bundle` → `@design-evaluator` (incl. `project/*` glob fix) → `/approve-design`.
7. `dev-tools.cjs` — `review-resume-state`, `journal-update`.
8. `/dispatch-corrections` + `corrections.md` — realign to `revise` tasks.
9. `herd/uxui/CLAUDE.md` + docs sweep.
10. Verify: `/check → /patterns → /contracts → /coherence`, then `/audit-agent uxui`.
