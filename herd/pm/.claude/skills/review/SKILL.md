---
name: review
description: Verify spec integrity — terminology, references, scope, completeness, structure, product risk. Run after /digest to verify before shipping.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Grep
---

# Review

Verify spec integrity after digest. Run all six checks in parallel, collect findings, present a unified report, discuss with user, and apply agreed fixes.

Like the builder's `/review` verifies code against acceptance criteria, this verifies specs against templates, glossary, references, and structural integrity.

---

## Step 1: Load Context

Read all spec files so you have full product context for understanding agent findings, deduplicating, and applying fixes:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`

---

## Step 2: Run All Checks and Collect Results

Launch all six checks in a single response using six parallel Agent tool calls. Each agent already has its full instructions — keep the prompt brief:

- @check-terms → `subagent_type: "check-terms"`, prompt: `"Run terminology check on all spec files."`
- @check-refs → `subagent_type: "check-refs"`, prompt: `"Run reference integrity check on all spec files."`
- @check-scope → `subagent_type: "check-scope"`, prompt: `"Run scope boundary check on all spec files."`
- @check-completeness → `subagent_type: "check-completeness"`, prompt: `"Run completeness check on all spec files."`
- @check-structure → `subagent_type: "check-structure"`, prompt: `"Run structural integrity check on all spec files."`
- @check-risk → `subagent_type: "check-risk"`, prompt: `"Run product risk check on all spec files."`

All six must be in the same response so they run in parallel.

**Before consolidating**, verify each agent returned a usable findings report. Each agent runs with `maxTurns: 50` and can truncate or error out on projects with many domain files. Presence/non-empty check only — don't deeply parse:

- Each result is non-empty and contains the agent's expected heading: `## Terminology Check`, `## Reference Check`, `## Scope Check`, `## Completeness Check`, `## Structure Check`, `## Risk Check`.
- No result is an error message, a refusal, or unstructured prose with no findings section.

If any agent returned an error, empty output, or unrecognizable format: stop, name which agent failed, and ask the user whether to re-spawn that agent or proceed knowingly without its coverage. A silent missing report would look identical to "no issues found" — always surface the gap.

Once all six reports are verified present and usable, read the results, deduplicate overlapping findings, and proceed to the report. Re-launching a successfully-completed agent would duplicate work.

---

## Step 3: Classify and Present Unified Report

After deduplicating, classify every non-auto-fix finding by effort:

- **Auto-fix** — capitalization, known-pattern replacements. Apply with one confirmation.
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

**Expanding agent findings.** The sub-agents are specialized scanners — they return accurate but terse labels. Your job as coordinator is to expand each finding with the full product context needed for decision-making. Don't pass agent output through verbatim. For every quick fix and structural item, present:

1. **What the spec says** — quote the actual text from the file(s)
2. **What's wrong** — explain the conflict, gap, or inconsistency in plain language
3. **Options** — 2-3 concrete choices with trade-offs
4. **Recommendation** — which option and why

**This is mandatory, not aspirational.** Every quick fix and structural item must have concrete options and a recommendation. If you can't propose a solution, explain why and what information is needed. Never present a finding as just "this is wrong" — always include "here's how to fix it."

For contradiction-type findings (two specs say different things), quote both sides so the user sees the conflict directly.

---

## Step 4: Discuss with User

Ask: **"I found [N] auto-fix items, [N] quick fixes, and [N] structural items. Want me to apply the auto-fixes first, then we'll go through quick fixes inline? Structural items I'll add to working notes for a dedicated session."**

Handle each tier differently:

1. **Auto-fixes** — apply with one confirmation
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

## Step 6: Track Unresolved Items

**This step is mandatory and automatic.** When the user stops engaging with fixes (says "save", "done", "later", moves on, or finishes all quick fixes without addressing structural items), immediately write all unresolved items to working notes. Do not ask permission, do not wait to be reminded.

Route unresolved items to `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` under `## Gaps Found by Review`:

- **Structural items** — route to working notes by default. If the user chose to fix one inline during Step 4-5, it's resolved and doesn't need tracking. But any structural item that wasn't fully resolved goes to working notes.
- **Quick fix leftovers** — any quick fix the user didn't resolve this session.

**Read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` first.** Check for existing entries from prior review runs:
- **New finding** — append a new entry.
- **Existing entry that's thin or outdated** — rewrite it with the full context from this run.
- **Existing entry that's already rich and current** — leave it. Add a note if this run found new details.

**Quality bar — same as the report.** Each working notes entry must include:

1. **What's wrong** — the actual problem with concrete examples (specific files, fields, quoted text)
2. **Why it matters** — who it affects, what breaks or is confusing
3. **Recommendation** — a clear pick with reasoning
4. **Options** — 2-3 alternatives with trade-offs

---

## Step 7: Outcome

**All clean or all fixes applied:** "Review passed. Run `/publish` to save, then `/notify` to announce changes to planner or UXUI."

**Unresolved items remain:** "Review complete with [N] items routed to working notes. The shipped specs are consistent — structural improvements captured for a future session. Run `/publish` to save, then `/notify` to announce changes to planner or UXUI."

---

## Completion Checklist

Before finishing, confirm:

- [ ] All six check agents ran in parallel
- [ ] Findings deduplicated across agents
- [ ] Classified by effort (auto-fix / quick fix / structural)
- [ ] Each finding expanded with product context, options, recommendation
- [ ] Auto-fixes applied (with user confirmation)
- [ ] Quick fixes discussed and resolved inline
- [ ] Structural items routed to working notes
- [ ] Every edit self-verified (write → re-read → verify)
- [ ] Told user to run `/publish`

---

## Rules

- **Parallel execution** — always run all six agents simultaneously, never sequentially
- **One run only per successful agent** — re-launch only agents whose output was empty/malformed. Don't re-launch a successfully-completed agent.
- **Deduplicate** — same issue found by multiple checks should appear once in the report
- **Classify by effort** — auto-fix, quick fix, structural. Handle each tier differently.
- **Expand findings** — don't pass agent output verbatim. Add product context, quotes, options, and recommendations.
- **Definitive resolutions** — every finding must be fixed, made explicit, or routed to working notes.
- **Self-verify every edit** — the write → re-read → verify loop is mandatory
- **Don't skip the discussion** — present findings and wait for user decisions
- **Route structural items** — always go to working notes, even if user doesn't explicitly defer
- **Track leftovers** — unresolved items go to WORKING-NOTES.md, never silently dropped
- **Enrich stale entries** — if an item already exists from a prior run but is thin, rewrite with full context
