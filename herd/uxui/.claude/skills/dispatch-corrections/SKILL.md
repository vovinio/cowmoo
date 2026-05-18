---
name: dispatch-corrections
description: Flush the PENDING-CORRECTIONS.md queue — ship the deferred non-blocking corrections for one target. PM / planner get one consolidated message issue; the designer gets one design task per affected screen.
argument-hint: <designer | pm | planner>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, Edit, Write, AskUserQuestion
---

# Dispatch Corrections

Ship the deferred corrections UXUI has been collecting. Non-blocking copy-grade deltas accumulate in `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` (see `.claude/rules/corrections.md`); this skill flushes the unchecked entries for one target so N tiny round-trips become one batched dispatch.

Dispatch shape differs by target:

- **PM / planner** — one consolidated `for-pm` / `for-planner` message issue carrying every queued delta. The recipient reads it as prose.
- **designer** — one `uxui:todo` design task **per affected screen**, each a properly-shaped brief, so the designer's re-rendered bundle flows through `/review-bundle` → `@design-evaluator` → `/approve-design` exactly like any design task.

**One target per invocation** — like `/ask`. To dispatch more than one, run it again.

---

## Step 1: Load the queue

Read `$PROJECT_DIR/cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md`.

- File missing, or no unchecked `- [ ]` entries in any section:
  ```
  No pending corrections to dispatch.
  ```
  Stop.
- Otherwise, note the unchecked entries per section (`For: designer`, `For: PM`, `For: planner`).

---

## Step 2: Determine the target

Parse the argument: `designer`, `pm`, or `planner`.

If no argument, propose from which sections carry unchecked entries. **Render the target choice via `AskUserQuestion`** — one option per section that has entries (`Dispatch <target> — N correction(s)`), recommending the fullest. If only one section has entries, the picker is still the confirmation gate: `Dispatch <target> — N correction(s)` `(Recommended)` / `Cancel`.

A target whose section has no unchecked entries cannot be dispatched — say so and stop.

---

## Step 3: Compose the dispatch

### PM / planner — one consolidated issue

Collect every unchecked entry for the chosen target into ONE issue. The body lists each entry — location, the `current → corrected` delta, and the why — as a plain list. Write it observationally: facts about what is wrong, not instructions (the recipient owns the fix).

| Target | `op` | Label | Title |
|---|---|---|---|
| pm | `CREATE_FOR_PM` | `for-pm` | `[UXUI] Copy corrections — <N> item(s)` |
| planner | `CREATE_FOR_PLANNER` | `for-planner` | `[UXUI] Notes — <N> item(s)` |

The title carries the `[UXUI] ` identity prefix. Present the composed issue — title + full body — as a preview, then go to Step 4.

### designer — one design task per screen

Each `For: designer` entry is a copy correction to an **already-approved screen**, and names its screen as `<domain> / <screen>` (see `.claude/rules/corrections.md`). The designer fixes copy by re-rendering the screen in Claude Design and submitting a new bundle — which re-enters the bundle-review pipeline. That pipeline is built around single-screen, properly-shaped design tasks, so the dispatch produces one such task per screen, not one batch issue.

1. **Group** the unchecked `For: designer` entries by their `<domain> / <screen>`. Each distinct screen becomes one `uxui:todo` task carrying all of that screen's queued copy deltas.

2. **Verify each screen has a definition.** For every `<domain> / <screen>`, confirm a `### <screen>` heading exists in `cowmoo/design/domains/<domain>.md`. If a queued screen has no definition (renamed, dropped, or a typo in the entry), surface it to the user and **skip that screen** — do not compose a task for an undefined screen, and leave its queue entries unchecked. Note the skip in the Step 7 report.

3. **Duplicate-title guard.** Run `gh issue list --label "uxui:todo" --state open --json number,title --limit 100`. If an open `uxui:todo` already exists with the same `[UXUI] <domain>: <screen>` title, that screen is already in the designer's queue — surface it and skip that screen's correction task (fold the correction into the existing task by hand, or dispatch later). Don't create a duplicate.

4. **Compose one task body per remaining screen.** Read `.claude/templates/design-task.md` once for the structure, then for each screen read `cowmoo/design/OVERVIEW.md`, `cowmoo/design/roles.md`, the screen's `cowmoo/design/domains/<domain>.md` definition, and the relevant `cowmoo/specs/domains/<domain>.md` rules. Compose the body following the template — `Instructions` + a fully self-contained `## Claude Design Prompt` (inline everything; no `cowmoo/...` file pointers; roles by name, never raw values). Two corrections-specific points:
   - The screen's **corrected** copy is what gets inlined (the `## Screen definition` / copy content carries the corrected wording — not the stale wording the bundle currently shows).
   - Add an Instructions "Pay attention to" bullet stating this is a **copy-correction re-render of an already-approved screen**, and naming which copy changed (`<current>` → `<corrected>`), so the designer re-renders rather than redesigns.

5. **Title** each task `[UXUI] <domain>: <screen>` — this exact shape is what `/review-bundle` parses to recover the domain and screen.

---

## Step 4: HARD GATE — confirm before creating

Render the confirmation gate as an `AskUserQuestion` picker — `Dispatch` `(Recommended)` (create the issue(s)) / `Edit` (refine — names what to change, opens a free-text follow-up, then re-present this picker) / `Cancel` (stop; the queue is left untouched). Do not proceed without an explicit `Dispatch` selection.

For the **designer** target, the preview lists each per-screen task — title + a few named decisions per task (which copy changed, states, roles), not full bodies (the full bodies live in your context and land in the handoff file). For **PM / planner**, the preview is the single composed issue.

---

## Step 5: Create the issue(s)

The `issue-create` command reads its body and title from a JSON handoff file. **Write** the handoff array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use).

**PM / planner** — a one-element array:

```json
[
  { "op": "<op from Step 3>", "title": "[UXUI] <title>", "label": "<label from Step 3>", "body": "<composed body>" }
]
```

**designer** — an N-element array, one entry per screen:

```json
[
  { "op": "CREATE_DESIGN_TASK", "title": "[UXUI] <domain>: <screen 1>", "label": "uxui:todo", "body": "<composed task body>" },
  { "op": "CREATE_DESIGN_TASK", "title": "[UXUI] <domain>: <screen 2>", "label": "uxui:todo", "body": "<composed task body>" }
]
```

Run `issue-create` once per entry index:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/uxui/.op-handoff.json --index <i>
```

Run indices in order — run → read the one-line stdout → check the `✓` / `✗` marker → on `✓` proceed to the next index; on the first `✗` **stop** and do not run further indices. `… ✓ #<n> — …` means created and verified; `… ✗ <reason>` means create or verify failed (if a `#<number>` appears, the issue exists — do NOT re-run that index). Do NOT retry a `✗` — the command already retried internally; a second run risks a duplicate issue.

---

## Step 6: Check off the dispatched entries

For each entry that was successfully dispatched (`✓`), Edit `PENDING-CORRECTIONS.md` — change `- [ ]` to `- [x]` and append a sub-line:

```
  - Dispatched: #<issue> (YYYY-MM-DD)
```

For the **designer** target, check off all of a screen's queued entries when that screen's task was created. If Step 5 stopped mid-batch, check off **only** the screens whose tasks were created — the rest stay `- [ ]` for a later run.

Checked entries stay in the file as the audit trail — never delete them. Re-read the file after the Edit to confirm every dispatched entry is now `- [x]`.

---

## Step 7: Report

```
## Dispatched — <target>

**Issue(s):** <#n — title> (one line per issue created)
**Corrections shipped:** <N> (now checked off in PENDING-CORRECTIONS.md)
**Skipped screens:** <screen — reason: no definition / duplicate title> (designer only, if any)
**Still queued:** <counts for the other sections, or "none">
```

Then render an `AskUserQuestion` hand-off picker — `Dispatch <other target>` when another section still has unchecked entries, `Run /catchup` to process other pending items, `Done for now` last. Recommended option first.

---

## Partial-failure recovery

Two side-effecting steps — `issue-create` (Step 5) and the check-off Edit (Step 6).

- **`issue-create` failed (`✗`, no issue number)** — nothing was dispatched for that index; the queue is untouched for it. For PM / planner that means nothing shipped — fix the cause and re-run. For the designer, earlier indices may have created tasks; check those off (Step 6), leave the failed and not-yet-run screens unchecked, fix the cause, and re-run — only the still-unchecked screens dispatch again.
- **`issue-create` succeeded but the check-off Edit failed** — the issue(s) exist, but the entries still read `- [ ]`. **Re-running `/dispatch-corrections` now would dispatch them again as duplicate issues.** Surface the created issue number(s) to the user and stop. The user marks the dispatched entries `- [x]` (with the `Dispatched: #<n>` line) by hand before any re-run — the check-off is the only thing that tells a later run those entries are already shipped.

---

## Completion Checklist

- [ ] Queue loaded; unchecked entries found (empty → reported and stopped)
- [ ] Target chosen (argument or picker)
- [ ] PM / planner: one consolidated issue composed, observational — OR designer: entries grouped by screen, each screen verified to have a definition, one task body composed per screen following `design-task.md`
- [ ] HARD GATE — user confirmed via picker
- [ ] Issue(s) created via `issue-create`, each verified `✓`
- [ ] Dispatched entries checked off in `PENDING-CORRECTIONS.md`
- [ ] Report + hand-off picker presented

---

## Rules

- **One target per invocation.** Designer, PM, or planner — one run. Run again for another.
- **PM / planner ship one consolidated issue; the designer fans out one task per screen.** The "never one issue per delta" principle still holds — PM / planner batch every delta into one message, and a designer task batches all of one screen's deltas — but the designer dispatch is deliberately one issue *per screen*, because each must be a single-screen design task the review pipeline can process.
- **Designer tasks are properly-shaped design tasks.** Title `[UXUI] <domain>: <screen>`; body the canonical `Instructions` + self-contained `## Claude Design Prompt` from `.claude/templates/design-task.md`, with the corrected copy inlined. A bare delta list is not enough — `/review-bundle` parses the title and `@design-evaluator` compares the submitted bundle against the Prompt section.
- **Never dispatch a task for an undefined screen.** A queued `<domain> / <screen>` with no `### <screen>` heading in its domain file is skipped and surfaced — composing a brief for it would hand Claude Design an empty screen.
- **Preview before creating** — the HARD GATE is mandatory; never create an issue without an explicit `Dispatch`.
- **Observational, not prescriptive** — for PM and planner, state what is wrong, not what they should do (the recipient owns the fix).
- **Check off, never delete** — a dispatched entry becomes `- [x]` with a `Dispatched:` line; the file doubles as an audit trail.
- **Don't dispatch an empty section** — a target with no unchecked entries has nothing to ship.
- **Blocking findings never go here** — `/dispatch-corrections` ships only what was deferred per `.claude/rules/corrections.md`; a blocking escalation goes to `/ask` (PM / planner) or a bundle return (designer) immediately.
