---
name: review
description: Validate draft PRDs using 5 parallel check agents before publishing. Run after /draft and user approval.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Review

Validate every task PRD in `draft.md` by running 5 specialized check agents in parallel. Catches problems that would cause the builder to fail or return the task.

---

## Prerequisite

Check that `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` exists.

If missing: "No draft found. Run `/draft` first."

---

## Step 1: Spawn Check Agents

Launch all 5 agents **in parallel**, each reading `draft.md` plus their specific context:

| Agent | Checks | Also reads |
|-------|--------|------------|
| `@check-completeness` | PRD covers full spec — all fields, states, flows, validations | cowmoo/specs/, templates/task-prd.md |
| `@check-dependencies` | Dependency ordering correct, labels right, no circular deps | GitHub stories/tasks, Records |
| `@check-feasibility` | Session-sized, tech-compatible, single deliverable | techstack.md, codebase.md |
| `@check-scope` | No cross-domain creep, WHAT not HOW, no code blocks | cowmoo/specs/PRODUCT.md |
| `@check-references` | File paths and field names match reality | codebase.md, techstack.md, GitHub Records |

Each agent returns a structured findings report.

---

## Step 2: Consolidate Findings

**Before consolidating**, verify each of the 5 agents returned a usable findings report. Each agent runs with `maxTurns: 15` and can truncate or error out on large drafts. Presence/non-empty check only — don't deeply parse:

- Each result is non-empty and contains the agent's expected heading (e.g., `## Completeness Check`, `## Dependencies Check`, `## Feasibility Check`, `## Scope Check`, `## References Check`).
- No result is an error message, a refusal, or unstructured prose with no findings section.

If any agent returned an error, empty output, or unrecognizable format: stop, name which agent failed, and ask the user whether to re-spawn that agent or proceed knowingly without its coverage. A silent missing report would look identical to "no issues found" — always surface the gap.

Once all 5 reports are verified present and usable, collect all findings. Then:

**Deduplicate** — multiple agents may flag the same issue from different angles. Merge these into a single finding.

**Classify** each finding:

| Classification | Definition | Action |
|---|---|---|
| **Auto-fix** | Clear fix, no judgment needed (wrong path format, missing N/A section) | Fix and show user |
| **Quick fix** | Needs brief discussion (vague language, thin section) | Propose fix, discuss with user |
| **Structural** | Needs rethinking (scope wrong, task should split, dependency issue) | Discuss, may need `/start` |

---

## Step 3: Present Findings

For each finding, expand with product context.

**Auto-fixes** are reported as a prose list — single action, no fork.

**Quick fixes and Structural findings** with 2-3 real resolutions are forks — render each via the `AskUserQuestion` tool (per CLAUDE.md "How You Work"). The recommended option goes first with `(Recommended)`; the tradeoff lives in each option's `description` in product-specific terms; include a "leave as-is" or "specify other" escape option. Do NOT collapse forks into prose `Alternatives: ...` lines.

Example output (the prose preface stays in chat; each fork below the preface fires as a separate AskUserQuestion):

~~~
## Review Findings

### Auto-fixes (will apply)
1. Task 1: Added "None — no testable behavior" to Test Requirements (env config, no logic)
2. Task 2: Fixed file path from /src/service/ to /src/services/

### Quick fixes (each rendered as an AskUserQuestion picker)
3. Task 1, Edge Cases: "handle errors gracefully" is too vague.
   → Picker: question "How should this be tightened?"
     - "Use suggested wording: retry 2x with exponential backoff, then user-facing 'Payment failed. Please try again.'" (Recommended) — concrete, matches Stripe API behavior
     - "Specify different wording" — keeps your phrasing, you supply it
     - "Leave as-is" — accept the vague version

4. Task 2, Data Shape: Missing `refunded_at` field that spec mentions.
   → Picker: question "Add refunded_at to this task's data shape?"
     - "Add as optional date field" (Recommended) — matches spec, low cost now
     - "Skip — not needed for this task" — defer to a later refund-handling task
     - "Make required" — only if spec says refunds are guaranteed at create time

### Structural (each rendered as an AskUserQuestion picker)
5. Task 3 is doing checkout + webhook handling — these are independent.
   → Picker: question "Split Task 3?"
     - "Split into Task 3a (checkout) and Task 3b (webhooks)" (Recommended) — independent deliverables, each session-sized
     - "Keep combined" — accept larger scope if you want them shipped together
     - "Reshape differently" — discuss alternative split

Your call on each.
~~~

---

## Step 4: Apply Fixes

1. Apply auto-fixes to `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md`
2. For quick fixes — apply user's chosen option
3. For structural issues — apply user's decision (may require significant draft rewrite)

**Self-verify** after each round of edits: re-read draft.md to confirm changes landed correctly.

---

## Step 5: Re-verify (if needed)

If structural changes were made (task splits, scope changes), re-run the affected check agents to verify the fixes didn't introduce new issues.

For auto-fixes and quick fixes, a re-run is not needed.

---

## Step 6: Outcome

**All pass:** "Review passed. Run `/publish` to create GitHub Issues."

**Issues found and fixed:** Show what was changed. "Fixed N issues. Run `/publish` to create GitHub Issues."

**Unfixable issues** (spec gaps, unknown dependencies): Flag to user — these need `/ask pm` or more discussion in `/start`.

---

## Completion Checklist

Before finishing, confirm:

- [ ] draft.md exists and was read
- [ ] All 5 check agents spawned in parallel
- [ ] Findings collected, deduplicated, classified
- [ ] Findings presented with context and alternatives
- [ ] Quick-fix and structural forks rendered via AskUserQuestion (not prose Alternatives lines)
- [ ] User confirmed each non-auto-fix
- [ ] Fixes applied and self-verified
- [ ] Re-verification done (if structural changes)
- [ ] Told user to run `/publish`

---

## Gotchas

- **"Looks good to me" is not validation.** The check agents do the work — read their findings carefully.
- **Subsequent stories are harder.** References to prior work must be verified against what was ACTUALLY built (Records), not what was PLANNED.
- **Splitting is better than shipping bloated tasks.** If the feasibility agent suggests splitting, do it.
- **Don't modify draft.md during review without user confirmation** — present findings first.

## References

- `references/task-validation.md` — quality checklist (reference material for understanding the dimensions)
