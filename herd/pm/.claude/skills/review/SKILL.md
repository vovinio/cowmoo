---
name: review
description: Verify spec integrity — terminology, references, scope, completeness, structure, product risk. Run after /digest. Light single-pass review by default; /review full runs the deep six-agent audit.
user-invocable: true
disable-model-invocation: false
argument-hint: [full]
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion
---

# Review

Verify spec integrity after digest — terminology, references, scope, completeness, structure, and product risk. Collect findings, present a unified report, discuss with the user, and apply agreed fixes.

Like the builder's `/review` verifies code against acceptance criteria, this verifies specs against templates, glossary, references, and structural integrity.

---

## Modes

`/review` runs in one of two modes — same six concerns, same report, same discussion and fix flow (Steps 3–7). Only the scan in Step 2 differs.

- **Light** (default — bare `/review`) — one `@check-light` sub-agent reads the spec corpus once and does a single combined scan-depth pass over all six concerns. Fast and cheap. Good enough for everyday changes — a label rename, a rule tweak, a new feature in an existing domain.
- **Full** (`/review full`) — the six dedicated check agents (`@check-terms`, `@check-refs`, `@check-scope`, `@check-completeness`, `@check-structure`, `@check-risk`) run in parallel, each doing an exhaustive audit of its concern. Slower and more thorough. Run it periodically, after large structural changes (a new domain, an entity reorganization), or when a light review flags something it couldn't settle.

Both modes are state-based — they review the spec files as they are now, not a diff of what changed. The argument selects the mode: `full` → full mode; anything else, including no argument → light mode.

---

## Step 0: Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

## Step 1: Load Context

Read all spec files so you have full product context for understanding agent findings, deduplicating, and applying fixes:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`

---

## Step 2: Run Checks and Collect Results

The mode (see `## Modes`) decides what to spawn. Either way, the result is a set of findings under the six headings `## Terminology Check`, `## Reference Check`, `## Scope Check`, `## Completeness Check`, `## Structure Check`, `## Risk Check`.

**Light mode** — spawn one `@check-light` agent. It already has its full instructions — keep the prompt brief:

- @check-light → `subagent_type: "check-light"`, prompt: `"Run the light combined review on all spec files."`

It returns a single report containing all six headings.

**Full mode** — launch all six checks in a single response using six parallel Agent tool calls. Each agent already has its full instructions — keep the prompt brief:

- @check-terms → `subagent_type: "check-terms"`, prompt: `"Run terminology check on all spec files."`
- @check-refs → `subagent_type: "check-refs"`, prompt: `"Run reference integrity check on all spec files."`
- @check-scope → `subagent_type: "check-scope"`, prompt: `"Run scope boundary check on all spec files."`
- @check-completeness → `subagent_type: "check-completeness"`, prompt: `"Run completeness check on all spec files."`
- @check-structure → `subagent_type: "check-structure"`, prompt: `"Run structural integrity check on all spec files."`
- @check-risk → `subagent_type: "check-risk"`, prompt: `"Run product risk check on all spec files."`

All six must be in the same response so they run in parallel.

**Before consolidating**, verify the check returned a usable findings report. Agents run with `maxTurns: 50` and can truncate or error out on projects with many domain files. Presence/non-empty check only — don't deeply parse:

- **Light mode** — the single `@check-light` result is non-empty and contains all six headings (`## Terminology Check` … `## Risk Check`).
- **Full mode** — each of the six results is non-empty and contains its agent's expected heading.
- No result is an error message, a refusal, or unstructured prose with no findings section.

If a check returned an error, empty output, or unrecognizable format: stop, name which check failed, and ask the user whether to re-spawn it or proceed knowingly without its coverage. A silent missing report would look identical to "no issues found" — always surface the gap.

Once the report(s) are verified present and usable, read the results, deduplicate overlapping findings, and proceed to the report. Re-launching a successfully-completed agent would duplicate work.

**`Needs full review` notes (light mode).** `@check-light` may mark a concern with a `Needs full review:` line when a light pass couldn't settle it. These are not findings to fix — collect them and carry them to Step 7's hand-off picker so the user can choose to escalate to `/review full`.

---

## Step 3: Classify and Present Unified Report

After deduplicating, classify every non-auto-fix finding by effort:

- **Auto-fix** — capitalization, known-pattern replacements. Applied as a batch once the user picks the apply path in Step 4's picker.
- **Quick fix** — term renames, reference rewording, adding a missing line. Discuss and apply inline.
- **Structural** — entity reorganization, missing features, cross-domain splits, new spec sections. Too big for inline fixes — route to working notes for a dedicated session.

The rule: can it be fixed by editing a word or line in place? → Quick fix. Does it require adding new sections, moving content between files, or redesigning structure? → Structural.

Present a single merged report:

```
# Review Results

## Auto-Fix ([N] items)
[Grouped by file. Each item: what's wrong, what the fix is.]

## Quick Fixes ([N] items)
[Grouped by check type. Each item with enough context to decide inline.]

### Terminology
- ...

### References
- ...

### Scope
- ...

### Completeness
- ...

### Structure
- ...

### Risk
- ...

## Structural ([N] items)
[Each item with full context. These go to working notes, not inline fixes.]

## Clean Areas
[Summary of what passed — how many terms consistent, how many refs valid, etc.]
```

**Expanding agent findings.** The check sub-agent(s) are scanners — they return accurate but terse labels. Your job as coordinator is to expand each finding with the full product context needed for decision-making. Don't pass agent output through verbatim. For every quick fix and structural item, present:

1. **What the spec says** — quote the actual text from the file(s)
2. **What's wrong** — explain the conflict, gap, or inconsistency in plain language
3. **Options** — 2-3 concrete choices with trade-offs
4. **Recommendation** — which option and why

**This is mandatory, not aspirational.** Every quick fix and structural item must have concrete options and a recommendation. If you can't propose a solution, explain why and what information is needed. Never present a finding as just "this is wrong" — always include "here's how to fix it."

**Render the per-finding resolution choice via `AskUserQuestion`** per CLAUDE.md item 3's picker rule — each legitimate fix path (e.g., remove / simplify / document / keep) is an option.

For contradiction-type findings (two specs say different things), quote both sides so the user sees the conflict directly.

**Heavy-report companion (HTML).** A full six-check report is a wall of text in the terminal. When the report is **heavy** — as a guide, **8 or more quick-fix and structural findings combined, or 3 or more structural items** (auto-fixes are one-liners and don't count toward heaviness) — deliver it as an HTML companion instead of inline:

1. Assemble the entire `# Review Results` content above — all three tiers, every finding expanded with quoted spec text, what's wrong, options, and recommendation, plus Clean Areas — as a single **self-contained** HTML file: inline `<style>`, no external assets, no build step.
2. Render it for legibility: the three effort tiers as color-coded sections (auto-fix / quick-fix / structural — a risk map), findings grouped by check with anchor links between checks, quoted spec text in monospace. **Number every finding** (1, 2, 3, …) so Step 4's pickers can name them.
3. Write it to `/tmp/pm-review-<timestamp>.html` and open it with `open /tmp/pm-review-<timestamp>.html`.
4. In the terminal, show only a compressed stamp — not the full report:

   `Review: <N> auto-fix · <N> quick · <N> structural → /tmp/pm-review-<timestamp>.html`

   Then proceed to Step 4. The per-finding `AskUserQuestion` pickers run in the terminal as normal, each naming its finding number from the HTML.

When the report is **light** (below that bar — a handful of findings, mostly auto-fix and quick-fix), present `# Review Results` inline in the terminal as written above — no HTML.

If the HTML write or `open` fails, fall back to presenting the full report inline in the terminal. The companion is a convenience; never block the skill on it.

---

## Step 4: Discuss with User

State the tally as prose — *"I found [N] auto-fix items, [N] quick fixes, and [N] structural items."* — then render an `AskUserQuestion` picker for how to proceed (the user selects, never types). Options: `Apply auto-fixes, then quick fixes inline` (Recommended) — *applies the auto-fixes as a batch, then walks quick fixes one at a time; structural items route to working notes*; `Quick fixes only — skip auto-fixes` — *leaves the auto-fixes for later, goes straight to quick-fix discussion*; `Review findings first` — *the user inspects the report before deciding; re-present this gate after*.

Handle each tier differently:

1. **Auto-fixes** — once the user picks the apply path, apply them as a batch (the picker IS the confirmation; no separate prose yes/no)
2. **Quick fixes** — discuss and apply inline, one at a time
3. **Structural items** — present with full context, recommend adding to working notes, let user override if they want to fix now

**Definitive resolutions only.** Every finding must result in one of:
- **Fix** — edit the spec to resolve the inconsistency
- **Make explicit** — if the pattern is intentional, add a note to the spec explaining why (so future review runs won't re-flag it)
- **Route to working notes** — if it needs deeper work, capture it with full context

"Ignore" or "leave it as-is" is never a valid resolution. If something looks wrong but is intentional, the spec should say so. Future readers and future review runs shouldn't have to guess.

**Deferral findings.** When a finding involves deferral language in an active spec (flagged by check-scope), the fix is always two-part: (1) rewrite the spec line as a clean product decision stating what the product *does*, and (2) if there's an uncaptured deferred concept, add it to BACKLOG.md with proper context and deferral reasoning.

---

## Step 5: Apply Agreed Fixes

For each fix the user approves:

1. **Read** the target file
2. **Make** the edit
3. **Re-read** the file immediately
4. **Verify** the edit is correct and didn't corrupt adjacent content
5. **Fix** if anything is wrong

---

## Step 6: Reconcile Working Notes

**This step is mandatory and runs even when all findings were resolved this session.** It has two parts: (a) add new unresolved findings; (b) clean up routings the user resolved inline during this run.

Read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` first. Find any existing review-routing sections (e.g., `## Gaps Found by Review`, `## Gaps Found in /review (<date>)`).

**For this run's findings that the user resolved inline during Step 4–5:**

If the resolved finding had a corresponding entry already sitting in WORKING-NOTES.md (from a prior run that you noticed during the routing-read in this step), remove that entry now. The spec is fixed; the routing is no longer needed. This is the only **auto-cleanup** of cross-run entries — it's safe because the user explicitly resolved the finding in this session.

**For prior-run entries this run did NOT flag again (cross-run staleness):**

Do NOT auto-remove these. LLM-driven check agents have variance; a finding disappearing from this run doesn't prove it was resolved — it might have just been under-detected this time. Removing it silently would be data loss.

Instead, surface the "candidate stale routings" at the end of Step 6 — state the situation as prose, then render an `AskUserQuestion` picker for the user to select which to remove:

```
**Candidate stale routings** (in WORKING-NOTES.md from prior runs, not flagged in this run):
- [entry title from working-notes]
- [entry title from working-notes]

These may be resolved (in which case removing them is correct) or may be issues this run's check agents missed (in which case removing would lose them).
```

Render an `AskUserQuestion` picker with `multiSelect: true` — one option per candidate entry (`description`: why it might be stale vs. why it might be a missed finding). The user selects the entries to remove from WORKING-NOTES.md; unselected entries stay. Apply removals only for the selected entries — don't act unilaterally.

**For this run's unresolved findings:**

- **Structural items** — route to working notes by default. If the user chose to fix one inline during Step 4–5, it's resolved and doesn't need tracking.
- **Quick fix leftovers** — any quick fix the user didn't resolve this session.

Write them to a single section: `## Gaps Found in /review (<date>)`. Do NOT create new dated sections every run — overwrite or merge into one current "Gaps Found in /review" section. A `## Gaps Found in /review #3`, `## Gaps Found in /review #4` pattern means review-routing is acting as audit log, not staging. One section, current state only.

**Quality bar — same as the report.** Each working notes entry must include:

1. **What's wrong** — the actual problem with concrete examples (specific files, fields, quoted text)
2. **Why it matters** — who it affects, what breaks or is confusing
3. **Recommendation** — a clear pick with reasoning
4. **Options** — 2-3 alternatives with trade-offs

**No "Resolved Review Items (Archive)" section in WORKING-NOTES.md.** Resolved items are removed entirely (with user confirmation for cross-run cleanups). Git history of the spec changes is the durable record of what was resolved and why; the commit message on `/publish` captures the decision.

---

## Step 7: Outcome

State the outcome as a prose stamp:

- **All clean or all fixes applied:** "Review passed."
- **Unresolved items remain:** "Review complete with [N] items routed to working notes. The shipped specs are consistent — structural improvements captured for a future session."

Then render an `AskUserQuestion` hand-off picker of concrete next actions — never close on a prose "Run /publish" line. Build the options from context: `/publish` first with `(Recommended)` — *commits the reviewed specs and pushes to the remote*; other live continuations (e.g. continue discussing a structural item routed to working notes); and `Done for now` last. Each option's `description` names what it leads to.

**If this was a light review and `@check-light` returned any `Needs full review` notes** (Step 2), add a `/review full` option to the picker — *re-runs the review with the six dedicated agents for the concerns the light pass couldn't settle* — placed above `Done for now`. If the light review came back with no such notes, don't offer it: a clean light review is a sufficient gate for everyday changes.

Do NOT include `/notify` as an option here. `/publish` Step 4 owns that decision — it runs the `downstream-engaged` check and only suggests `/notify` when planner or UXUI has actually run. Offering it from `/review` would fire unconditionally, landing as noise on greenfield projects where no downstream agent exists yet.

---

## Completion Checklist

Before finishing, confirm:

- [ ] The check ran — `@check-light` (light mode) or all six check agents in parallel (full mode)
- [ ] Findings deduplicated across agents
- [ ] Classified by effort (auto-fix / quick fix / structural)
- [ ] Each finding expanded with product context, options, recommendation
- [ ] Heavy report delivered as an HTML companion in `/tmp/` and opened; light report shown inline
- [ ] Auto-fixes applied (with user confirmation)
- [ ] Quick fixes discussed and resolved inline
- [ ] Structural items routed to working notes
- [ ] Every edit self-verified (write → re-read → verify)
- [ ] Hand-off picker presented with `/publish` as the recommended next action

---

## Rules

- **Mode selects the scan** — light mode spawns one `@check-light`; full mode runs all six agents simultaneously in one response, never sequentially. Steps 3–7 are identical for both.
- **One run only per successful agent** — re-launch only a check whose output was empty/malformed. Don't re-launch a successfully-completed agent.
- **Deduplicate** — same issue found by multiple checks should appear once in the report
- **Classify by effort** — auto-fix, quick fix, structural. Handle each tier differently.
- **Expand findings** — don't pass agent output verbatim. Add product context, quotes, options, and recommendations.
- **Definitive resolutions** — every finding must be fixed, made explicit, or routed to working notes.
- **Self-verify every edit** — the write → re-read → verify loop is mandatory
- **Don't skip the discussion** — present findings and wait for user decisions
- **Route structural items** — always go to working notes, even if user doesn't explicitly defer
- **Track leftovers** — unresolved items go to WORKING-NOTES.md, never silently dropped
- **Auto-clean only inline-resolved** — Step 6 auto-removes routings the user resolved inline this session (safe, explicit). Cross-run staleness (entries this run didn't flag again) is surfaced as a confirm list, never auto-removed — check-agent variance makes silent removal a data-loss risk.
- **One "Gaps Found in /review" section** — current state only. Never accumulate dated sections per run (no `#1`, `#2`, `#3`, `#4` — that's audit-log behavior in the wrong file)
- **No "Archive" section in WORKING-NOTES.md** — resolved items are removed entirely (auto when inline-resolved, with user approval for cross-run); git history is the durable record
