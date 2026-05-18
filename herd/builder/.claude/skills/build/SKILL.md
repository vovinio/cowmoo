---
name: build
description: Implement the current task using TDD — RED (write failing tests) → GREEN (implement), with opportunistic refactor when warranted. Run after /start.
user-invocable: true
disable-model-invocation: false
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, Bash
---

# Build

Implement the current task using Test-Driven Development. Follow the PRD, existing patterns, and the RED → GREEN cycle (with an opportunistic polish pass when warranted).

---

## Prerequisite

Spawn `@task-check`.

If no in-progress task: "No active task. Run `/start` first." Stop.

---

## Throughout this skill: Track Deviations

Deviations get logged *as they happen* — during RED, GREEN, or polish — not batched at the end. Append to `$PROJECT_DIR/cowmoo/agent-files/builder/deviations.md` the moment you diverge from the PRD:

```markdown
## [Short description]
**PRD said:** [what the PRD specified]
**Actual:** [what was implemented instead]
**Reason:** [why the deviation was necessary]
**Blocks publish?** yes | no — [one-line justification: yes if the planner needs to see this before the work ships; no if it's within acceptable latitude]
```

Common situations:
- Test Requirements were vague and you had to interpret them → usually "no"
- You discovered a missing edge case during RED that wasn't in the PRD → note it; if it changed the contract, "yes"
- A test revealed the data shape was wrong in the PRD → usually "yes" — the planner needs to know
- You picked a different concrete pattern (library, approach) that reaches the same outcome → usually "no" if the outcome is identical, "yes" if the choice has long-term implications

The "blocks publish?" answer is the one `/publish` consults. When uncertain, err toward "yes" — a return pass is cheaper than shipping something the planner didn't agree to.

---

## Step 1: Classify the Task

Read `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md` — the cached PRD from `/start`.

Find the **Test Requirements** section. Classify the task:

| Classification | When | Action |
|----------------|------|--------|
| **TDD task** | Test Requirements lists concrete behaviors | Follow the RED → GREEN cycle below; polish opportunistically in Step 5 if code came out messy |
| **No-test task** | Test Requirements says "None — no testable behavior" with justification matching pure config, scaffolding, static assets, or CSS-only | Skip to Step 5 (implement directly), note the skip in deviations if the justification feels wrong |
| **Broken PRD** | Test Requirements is missing, empty, vague ("add tests"), or says "None" for work that clearly has logic/behavior | Stop. This is a PRD issue — discuss with the user. If the planner needs to rewrite, `/return`. |

---

## Step 2: Discover the Test Framework (TDD tasks only)

Before writing any test, know how tests run in this project.

BUILD-NOTES.md, techstack.md, and codebase.md are your primary answer — you already loaded them in `/start`. If they don't cover test framework, test command, test location, or test naming convention for this project, figure it out from the project itself: manifests, existing test files, CI config, whatever tells you how tests actually run. You have Read/Glob/Grep/Bash — use them.

**If no test framework is in place and no way to run tests exists:** stop. This is a setup gap, not something to silently work around. Discuss with the user. If a framework-setup task needs to come first, `/return` to the planner.

**Record what you learned in BUILD-NOTES.md if you had to dig** — `@build-verify` reads BUILD-NOTES first on every review, so capturing the discovered test command here makes every future run fast. This is the single most valuable thing to record in BUILD-NOTES.

---

## Step 3: RED — Write Failing Tests

**Goal:** Encode the PRD's Test Requirements as failing tests. The tests come from the spec, not from code you haven't written.

For each behavior in the Test Requirements section:
1. Write a test that asserts exactly the described behavior
2. Test names describe behavior, not methods ("rejects expired tokens" not "test_validate_3")
3. One behavior per test where practical — don't batch unrelated assertions
4. Mock external services you don't own; never mock modules you're about to write
5. Every Acceptance Criterion **Truth** should map to at least one test

**Self-verify** each test file — write, re-read, confirm nothing was corrupted.

**Run the tests.** Use the test command from Step 2.

**They MUST fail.** If any test passes before the implementation exists:
- The test is not actually testing the intended behavior — rewrite it
- Or the test is testing code that already exists (wrong scope) — check PRD boundaries
- Never accept "the test passed by accident" and move on

**They must fail for the right reason.** A syntax error isn't a RED. The test must fail because the behavior is not yet implemented — not because the code doesn't compile or imports are broken. If it's failing for the wrong reason, fix the test infrastructure first, then confirm it fails for the right reason.

Before proceeding, show the user:
- Which tests you wrote (file paths)
- The failure output proving RED
- Confirm "RED phase complete — ready for GREEN"

---

## Step 4: GREEN — Minimum Code to Pass

**Goal:** Make the failing tests pass with the minimum implementation.

Follow the PRD and the approach discussed during `/start`. Match existing patterns from BUILD-NOTES.md, the stack, and codebase.md.

**Visual references.** If the task involves UI work, understand the design before coding. Read `cowmoo/design/OVERVIEW.md`, `cowmoo/design/roles.md`, and the referenced `cowmoo/design/domains/*.md` file for the role vocabulary, layout, states, and the "Roles Used" list.

Then follow this hierarchy for visual decisions (in order of priority):

1. **`cowmoo/agent-files/builder/BUILD-NOTES.md`** — accumulated token rules from prior tasks. If a role has an established concrete implementation (e.g. `primary-action` = `bg-primary-600 text-white`), reuse it exactly. Consistency across screens is built through this file.
2. **Existing `src/` patterns** — for anything not captured in BUILD-NOTES but previously implemented, match prior code. Read comparable screens or components to mirror their approach.
3. **Framework defaults** — when nothing else applies (first frontend task of a project, or a genuinely new role), fall back to framework defaults (shadcn defaults, Tailwind defaults, Material defaults, whichever the project uses).

Use role names from `cowmoo/design/roles.md` as the abstract vocabulary — your implementation resolves them to concrete values via the hierarchy above.

**When you establish a new token rule** (e.g., first time implementing `primary-action` in this project, user approves a specific color choice after iteration), capture it in `cowmoo/agent-files/builder/BUILD-NOTES.md` so subsequent tasks reuse the same values. This is how consistency emerges across the product without UXUI pre-deciding values.

Never use raw hex colors, pixel values, or arbitrary font sizes where a role applies. If you find yourself typing `#0066FF`, stop and check: is there a role this should be? Look in `cowmoo/design/roles.md`. If yes, use the role (via whatever mechanism the project uses: CSS variable, Tailwind class, theme token). If the role doesn't exist, the PRD has a gap — discuss with the user before proceeding.

If you need additional specs or code files during implementation — read them directly. You're not limited to what `/start` loaded.

Write the minimum code needed to pass the tests. Resist the temptation to add features beyond the tests — those go in REFACTOR or a future task.

**Run the tests.** They MUST pass.

If they fail:
- The implementation is wrong, not the test. Read the failure output, fix the code, run again.
- Three failed attempts at the same fix means the approach is wrong — rethink.
- Never delete a failing test to make the suite pass. If the test itself is wrong (doesn't match the PRD), discuss with the user and fix the test — then rerun with the fix to confirm RED, then implement to reach GREEN.

Before proceeding, show the user:
- Test output confirming all new tests pass
- Confirm "GREEN phase complete — ready for Polish"

---

## Step 5: Polish (optional, TDD tasks)

**Goal:** Improve structure if the GREEN code came out messy. Skip otherwise.

This step is deliberately optional — most GREEN code from a focused test suite is already clean. Only spend time here when you notice something genuinely worth fixing:

- Duplication introduced during GREEN
- Unclear naming
- Poor separation of concerns
- Inconsistency with existing codebase patterns

If you make changes, **run the tests after each one.** They MUST still pass.

If nothing stands out, say "GREEN code is clean, no polish needed" and you're done with the cycle. Forced refactoring on already-clean code is churn, not improvement.

---

## Step 5 (alt): Implement Directly — No-Test Tasks

For tasks classified in Step 1 as "No-test task" (pure config, scaffolding, static assets, CSS-only changes):

- Implement according to the PRD and agreed approach
- No tests to write, no RED/GREEN cycle
- Still match existing patterns, still self-verify writes
- Note in deviations if anything surprised you (see "Track Deviations" above)

---

## When You Hit Issues During Implementation

Quick decision matrix for problems that come up mid-flow:

| Situation | Action |
|-----------|--------|
| Bug in code you just wrote, typo, missing import, lint error | Auto-fix — just do it |
| Missing validation the spec implies, error handling, obvious edge case | Add it, note as deviation (see "Track Deviations" above) |
| Dependency issue blocking you, config problem | Fix it, note as deviation |
| Can't proceed — PRD issue, structural problem, spec contradiction | Stop, discuss with user, `/return` if unresolvable |

---

## Can't Proceed

If you hit a wall — PRD issue, structural problem, dependency missing, tests that can't be made to pass within the PRD's constraints:

Stop and explain to the user. If unresolvable, user runs `/return`.

---

## Out-of-Scope Issues

Problems you notice but shouldn't fix (different domain, not in this task) — don't break your coding flow:

1. Compose the issue title (`[Builder] [description]`) and a body with details and context.
2. **Confirm before posting.** Show the user a one-line preview — the composed title and the `for-planner` label — and ask: "Post this out-of-scope issue, or skip?" A `for-planner` issue is externally visible (it posts a `[Builder]` comment and moves a board card), so it never goes out silently. On **skip**, just mention the observation in conversation (per the "No scope creep" rule below) and continue the task — do not write the handoff or run the create.
3. On confirmation, write the handoff file `$PROJECT_DIR/cowmoo/agent-files/builder/.op-handoff.json` (Write tool) — a one-element JSON array with the CREATE_ISSUE entry:
   ```json
   [
     { "op": "CREATE_ISSUE", "title": "[Builder] <description>", "label": "for-planner", "body": "<body>" }
   ]
   ```
4. Run the create command (Bash) — it reads the CREATE_ISSUE entry from the handoff file:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/builder/.op-handoff.json --index 0
   ```
   The command prints exactly one line: `CREATE_ISSUE: ✓ #<n> — <title>. Label: <label>. Board: <column>.` on success, or `CREATE_ISSUE: ✗ <reason>` on failure (if a `#<number>` appears in a `✗` report, the issue exists — do NOT recreate it). Do not retry on `✗` — the command already retried internally.

The handoff file is a single reused path, overwritten on each use. Continue working on the current task.

---

## Done

"Implementation complete. Run `/review` to verify."

---

## Rules

- **TDD is the default** — RED → GREEN, with polish (Step 5) when warranted. The tests come from the PRD's Test Requirements, not from the code you write. Circular tests that validate bugs are the default LLM failure mode — you will not fall into it.
  Common rationalizations — all wrong:
  - "I'll write the implementation first, it's faster" → Test-after creates tests shaped by the code, not the spec. Bugs pass. Write the test first.
  - "The test passes already, no need to rewrite" → Then the test is testing nothing. Make it specific enough to fail before implementation.
  - "I'll skip RED for this one, it's simple" → Simple tasks are where untested bugs hide longest. Follow the protocol.
- **Follow the PRD** — it defines what to build. Disagree? Discuss, then `/return` if needed. Don't silently deviate.
  Common rationalizations — all wrong:
  - "The PRD didn't mention this but it's obvious" → If it's not in the PRD, it's not in scope. Track as deviation if you must add it.
  - "This is better than what the PRD says" → Discuss first. Don't silently "improve."
  - "The PRD is wrong here" → Discuss with user. If fundamental, `/return`.
- **Follow existing patterns** — match the codebase's style, not your preferences.
- **Track deviations immediately** — don't wait until /publish to remember what changed.
- **Stop when stuck** — three failed attempts at the same approach means the approach is wrong. Discuss with user.
- **Never delete a failing test to make the suite pass** — fix the code, or fix the test if it's wrong (then confirm it fails for the right reason before re-implementing).
- **No scope creep** — spot something outside this task's scope? Mention it in conversation. Don't implement it.
  Common rationalizations — all wrong:
  - "It's a one-line fix" → Still not your task. Mention it, move on.
  - "It'll break without this" → That's a dependency. Track as deviation, don't expand scope.
  - "I'm already in this file" → Proximity is not permission.
