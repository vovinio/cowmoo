---
name: dispatch-corrections
description: Flush the PENDING-CORRECTIONS.md queue — ship the deferred non-blocking corrections for one target. PM / planner get one consolidated message issue; the designer gets one design task per affected screen.
argument-hint: <designer | pm | planner>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, Edit, Write, AskUserQuestion
---

# Dispatch Corrections

Ship the deferred corrections UXUI has been collecting. Non-blocking copy-grade deltas and design-led spec divergences accumulate in `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` (see `.claude/rules/corrections.md`); this skill flushes the unchecked entries for one target so N tiny round-trips become one batched dispatch. Dispatching the `For: PM` queue is the **spec-alignment** pass — it hands PM every divergence to adopt into the specs.

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

Collect every unchecked entry for the chosen target into ONE issue. Write it observationally: facts about what is wrong or what was decided, not instructions (the recipient owns the fix).

For **PM**, the `For: PM` queue has two kinds — group the body accordingly:
- **Spec divergences** — each: the screen, what the design now does vs. what the spec says, and the product rationale. PM adopts these into the specs at alignment.
- **Copy corrections** — each: location, the `current → corrected` delta, and the why.

Omit a group with no entries. For **planner**, the body is a plain list of each note — task/story, observation, why.

| Target | `op` | Label | Title |
|---|---|---|---|
| pm | `CREATE_FOR_PM` | `for-pm` | `[UXUI] Spec alignment — <N> item(s)` |
| planner | `CREATE_FOR_PLANNER` | `for-planner` | `[UXUI] Notes — <N> item(s)` |

The title carries the `[UXUI] ` identity prefix. Present the composed issue — title + full body — as a preview, then go to Step 4.

### designer — `revise` change-task(s) against the existing design

Each `For: designer` entry is a copy correction to a screen that **already has a design** — keyed `<domain> / <screen>` (see `.claude/rules/corrections.md`). A correction is a change against the existing design, so the dispatch composes a **`revise` task** (`.claude/templates/design-task-revise.md`) — never a from-scratch brief. The queued copy deltas *are* the changes.

1. **Find each screen's existing design.** For every unchecked `For: designer` entry, read the screen's `### <screen>` section in `cowmoo/design/domains/<domain>.md` and take the most recent `**Bundle:**` line — it points at `cowmoo/design/bundles/<ticket>/`, whose `meta.json` carries the Claude Design share URL. If a screen has no `**Bundle:**` line on record, surface it and **skip** — a correction presupposes an existing design; that screen needs a `new` task through `/design-start` instead. Note skips in the Step 7 report.

2. **Group into `revise` tasks.** Group the entries by the existing design (the bundle) they belong to — corrections to screens sharing one Claude Design project go in **one** `revise` task. Typically this is a single task: a project's screens usually live in one imported design.

3. **Duplicate-title guard.** Run `gh issue list --label "uxui:todo" --state open --json number,title --limit 100`. If an open `uxui:todo` already covers these screens, surface it and skip — fold the correction into the existing task by hand, or dispatch later. Don't create a duplicate.

4. **Compose one `revise` body per group**, following `design-task-revise.md`: Instructions (`**Mode:** revise`, `**Domain:**`, `**Screens:**`, `**Existing design:**` = the bundle path + share URL from step 1), then a `## Claude Design Prompt` change-request block — `# Change request`, `## Why these changes`, and one numbered prose change per queue entry grouped under a per-screen `### <Screen>` heading: each change states the current copy and the corrected copy, and ends with a `*Spec: …*` line carrying the entry's "Why". Close with `## What NOT to change` and `## Output expectation`. A change request, not a from-scratch brief.

5. **Title** each task `[UXUI] <domain>: <unit-label>` — a short label naming the corrected screen(s).

---

## Step 4: HARD GATE — confirm before creating

Render the confirmation gate as an `AskUserQuestion` picker — `Dispatch` `(Recommended)` (create the issue(s)) / `Edit` (refine — names what to change, opens a free-text follow-up, then re-present this picker) / `Cancel` (stop; the queue is left untouched). Do not proceed without an explicit `Dispatch` selection.

For the **designer** target, the preview lists each `revise` task — title + a change summary (screens covered, number of changes), not full bodies (the full bodies live in your context and land in the handoff file). For **PM / planner**, the preview is the single composed issue.

---

## Step 5: Create the issue(s)

The `issue-create` command reads its body and title from a JSON handoff file. **Write** the handoff array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use).

**PM / planner** — a one-element array:

```json
[
  { "op": "<op from Step 3>", "title": "[UXUI] <title>", "label": "<label from Step 3>", "body": "<composed body>" }
]
```

**designer** — an array with one entry per `revise` task (usually one):

```json
[
  { "op": "CREATE_DESIGN_TASK", "title": "[UXUI] <domain>: <unit-label>", "label": "uxui:todo", "body": "<composed revise body>" }
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

For the **designer** target, when a `revise` task is created, check off every queue entry it covered. If Step 5 stopped mid-batch, check off **only** the entries of `revise` tasks that were created — the rest stay `- [ ]` for a later run.

Checked entries stay in the file as the audit trail — never delete them. Re-read the file after the Edit to confirm every dispatched entry is now `- [x]`.

---

## Step 7: Report

```
## Dispatched — <target>

**Issue(s):** <#n — title> (one line per issue created)
**Corrections shipped:** <N> (now checked off in PENDING-CORRECTIONS.md)
**Skipped screens:** <screen — reason: no existing design on record / duplicate> (designer only, if any)
**Still queued:** <counts for the other sections, or "none">
```

Then render an `AskUserQuestion` hand-off picker — `Dispatch <other target>` when another section still has unchecked entries, `Run /catchup` to process other pending items, `Done for now` last. Recommended option first.

---

## Partial-failure recovery

Two side-effecting steps — `issue-create` (Step 5) and the check-off Edit (Step 6).

- **`issue-create` failed (`✗`, no issue number)** — nothing was dispatched for that index; the queue is untouched for it. For PM / planner that means nothing shipped — fix the cause and re-run. For the designer, earlier indices may have created `revise` tasks; check those off (Step 6), leave the failed and not-yet-run tasks' entries unchecked, fix the cause, and re-run — only the still-unchecked corrections dispatch again.
- **`issue-create` succeeded but the check-off Edit failed** — the issue(s) exist, but the entries still read `- [ ]`. **Re-running `/dispatch-corrections` now would dispatch them again as duplicate issues.** Surface the created issue number(s) to the user and stop. The user marks the dispatched entries `- [x]` (with the `Dispatched: #<n>` line) by hand before any re-run — the check-off is the only thing that tells a later run those entries are already shipped.

---

## Completion Checklist

- [ ] Queue loaded; unchecked entries found (empty → reported and stopped)
- [ ] Target chosen (argument or picker)
- [ ] PM / planner: one consolidated issue composed, observational — OR designer: entries grouped by existing design, one `revise` change-task composed per group following `design-task-revise.md`
- [ ] HARD GATE — user confirmed via picker
- [ ] Issue(s) created via `issue-create`, each verified `✓`
- [ ] Dispatched entries checked off in `PENDING-CORRECTIONS.md`
- [ ] Report + hand-off picker presented

---

## Rules

- **One target per invocation.** Designer, PM, or planner — one run. Run again for another.
- **PM / planner ship one consolidated issue; the designer ships `revise` change-task(s).** Every delta is batched — PM / planner into one message, the designer's corrections into one `revise` task per existing design (its copy deltas become the change request's numbered changes). Never one issue per delta.
- **A designer correction is a `revise` task, not a rebuild.** The body follows `.claude/templates/design-task-revise.md` — its `## Claude Design Prompt` block is a *change request* (numbered prose changes against the existing design), never a from-scratch product/screen brief. Composing a from-scratch brief would tell the designer to rebuild an already-approved screen.
- **Never dispatch a correction for a screen with no existing design.** A queued `<domain> / <screen>` whose domain-file section carries no `**Bundle:**` line has no existing design to revise — skip it and surface it; that screen needs a `new` task via `/design-start`.
- **Preview before creating** — the HARD GATE is mandatory; never create an issue without an explicit `Dispatch`.
- **Observational, not prescriptive** — for PM and planner, state what is wrong, not what they should do (the recipient owns the fix).
- **Check off, never delete** — a dispatched entry becomes `- [x]` with a `Dispatched:` line; the file doubles as an audit trail.
- **Don't dispatch an empty section** — a target with no unchecked entries has nothing to ship.
- **Blocking findings never go here** — `/dispatch-corrections` ships only what was deferred per `.claude/rules/corrections.md`; a blocking escalation goes to `/ask` (PM / planner) or a bundle return (designer) immediately.
