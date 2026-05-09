---
name: review
description: Verify implementation using 4 parallel check agents, then verify acceptance criteria with evidence. Run after /build.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, Bash
---

# Review

Verify the implementation by running 4 specialized check agents in parallel, then verifying acceptance criteria with evidence. Catches problems that would surface in production or cause the planner to reject the work.

---

## Prerequisites

Spawn `@task-check`.

If no in-progress task: "No active task. Run `/start` first." Stop.

Spawn `@git-status` with operation **STATUS**.

If no code changes: "No code changes found. Run `/build` first." Stop.

Spawn `@build-verify`. It returns one of four states: **PASS**, **FAIL**, **NO_TESTS**, **ERROR**.

**PASS:** tests ran and all passed. Continue.

**FAIL:** tests ran and some failed. "Tests failing on your code. Fix before review." Show the structured failure list (if parsed) plus the raw output. Stop.

**NO_TESTS:** no test command was detected. Read the PRD's **Test Requirements** section from `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`:
- If Test Requirements says "None — no testable behavior": NO_TESTS is legitimate — continue.
- If Test Requirements lists actual behaviors: this is a problem. The builder wrote tests (or should have), but they can't be executed. Either the test framework isn't discoverable (add to BUILD-NOTES.md) or `/build` skipped TDD. Stop and surface this to the user before running check agents — it's a TDD violation or an infrastructure gap.

**ERROR:** the runner crashed before tests could complete — missing module, broken config, wrong package manager, etc. This is infrastructure, not code quality. Show the error output and ask the user to fix the runner before proceeding. Stop.

Extract the list of changed files from `@git-status` output.

---

## Step 1: Spawn Check Agents

Launch all 4 agents **in parallel in a single response**:

| Agent | Prompt |
|-------|--------|
| `@check-criteria` | "Check these changed files against PRD: [file list]. PRD at `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`." |
| `@check-patterns` | "Check these changed files for codebase convention compliance: [file list]." |
| `@check-edge-cases` | "Check these changed files for edge case handling: [file list]." |
| `@check-security` | "Security scan these changed files: [file list]." |

If the PRD has a **Designs** section with design references, add a 5th agent. Read the PRD's Designs section to identify which domain file(s) this task touches, and substitute the file name (e.g., `invoices`, `dashboard`) for `[domain]` in the prompt. If multiple domains are touched, spawn `@check-design` once per domain in parallel.

| `@check-design` | "Check implementation against UI definitions for: [file list]. UI def at `$PROJECT_DIR/cowmoo/design/domains/[domain].md`. PRD at `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`." |

All agents must be in the same response so they run in parallel. When they complete, each agent's findings are returned directly in the tool result — you already have all findings. Do NOT re-launch any agent. Read the returned results, deduplicate overlapping findings, and proceed.

Test execution happens in the Prerequisites step (via `@build-verify`), before these parallel checks run. If tests failed there, this step is never reached — the user fixes tests first, then re-runs `/review`.

---

## Step 1b: Security Escalation (automatic)

Read `@check-security`'s output. If it reports any **CRITICAL** finding:

1. **Spawn `@auditor-quick`** to scan the broader codebase — a CRITICAL pattern in the changed files may exist elsewhere and deserves a sweep.

   | Agent | Prompt |
   |-------|--------|
   | `@auditor-quick` | "Fast security surface scan across the project. The per-task `@check-security` just surfaced CRITICAL finding(s): [paste them here]. Look for the same patterns elsewhere and any other obvious vulnerabilities." |

2. **If `@auditor-quick` surfaces cross-cutting patterns** (multiple files exhibit the same issue, or it flags other CRITICAL findings): **spawn `@auditor`** for the full OWASP deep pass.

   | Agent | Prompt |
   |-------|--------|
   | `@auditor` | "OWASP Top 10 security audit. Context: per-task `@check-security` flagged CRITICAL, and `@auditor-quick` confirmed cross-cutting patterns. Scope: full project tree. Findings from both earlier scans: [paste here]." |

If `@check-security` has no CRITICAL findings, skip this step entirely — it's auto-gated on severity.

Merge findings from `@auditor-quick` and `@auditor` (if they ran) into the consolidated findings list along with the Step 1 results. No separate report — the user sees one unified list in Step 5.

---

## Step 2: Browser Verification (frontend tasks only)

**Gate:** Only proceed if `@build-verify` returned **PASS** (or **NO_TESTS** with legitimate "None — no testable behavior" in the PRD). If `@build-verify` returned FAIL / ERROR, Prerequisites stopped the review before this point and you aren't here.

**Detection:** This is a frontend task if the PRD's Designs / Screens / UI section is present. For backend-only tasks the section won't exist — skip Step 2. If the classification is ambiguous (e.g. the task is labeled as touching UI but no section exists), spawn the browser agents anyway; they self-SKIP when no dev server is detected.

**If frontend task**, spawn both agents (they are independent — run in parallel):

| Agent | Prompt |
|-------|--------|
| `@ui-verify` | "Verify the UI flow for this task. PRD at `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`. Changed files: [file list]." |
| `@audit-lighthouse` | "Run Lighthouse audit on the pages this task touches. Routes from PRD: [route list from acceptance criteria]." |

Both report SKIP if the dev server is not running — review continues with code-only findings.

**If NOT a frontend task**, skip this step entirely.

---

## Step 3: Verify Findings (eliminate false positives)

Before presenting anything to the user, re-verify every finding from Steps 1 and 2 in full context. This is the phase that makes multi-agent review trustworthy — detection agents cast wide nets and accept false positives, and without verification those false positives train the user to skim the review output.

**Skip conditions** — for small reviews, verification would cost more than it saves. Skip Step 3 entirely only when ALL of these are true:
- Fewer than 3 total findings across all check agents
- No findings from `@check-design`
- No findings flagged as structural by any agent

Otherwise, proceed.

**Spawn `@check-verify`** with the following inputs, passed in the prompt:

| Input | What to pass |
|---|---|
| Findings | Full verbatim output from each of the parallel check agents from Step 1, plus any browser findings from Step 2 |
| Changed files | From `@git-status` — the file list you already have |
| PRD path | `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md` |
| Deviations path | `$PROJECT_DIR/cowmoo/agent-files/builder/deviations.md` (note if absent) |

Example prompt shape:

```
Verify these findings. Changed files: [file list]. PRD: $PROJECT_DIR/cowmoo/agent-files/builder/active-task.md. Deviations: $PROJECT_DIR/cowmoo/agent-files/builder/deviations.md (or "does not exist"). Findings below — each block is one check agent's complete output:

=== @check-criteria ===
[verbatim output]

=== @check-patterns ===
[verbatim output]

... etc.
```

**Read the return**: `@check-verify` produces a Confirmed list, a Dismissed list, and a Contradictions list (see `@check-verify`'s output format).

**Use only the Confirmed list** for Step 4 (Consolidate). Dismissed findings are gone — do NOT present them to the user. Contradictions are surfaced separately at the top of the Step 5 report, not mixed in with the confirmed findings.

**Do not re-run detection agents** based on the verification result. If `@check-verify` dismisses a finding as false-positive, trust it. The only time to re-run a detection agent is if the verifier explicitly requests it (rare).

---

## Step 4: Consolidate Findings

Collect the **confirmed** findings from Step 3 — these are the findings that survived verification. Contradictions are surfaced at the top of the Step 5 report separately. Then:

**Deduplicate** — multiple agents may flag the same issue from different angles (e.g., check-criteria flags "missing error handling for login failure" and check-edge-cases flags "login route has no error path" — these are the same finding). Merge into a single finding.

**Classify** each finding:

| Classification | Definition | Action |
|---|---|---|
| **Auto-fix** | Clear fix, no judgment needed (missing import, wrong naming convention, missing timestamp column) | Fix and show user |
| **Quick fix** | Needs brief discussion (missing UI state, thin error handling, missing validation) | Propose fix, discuss with user |
| **Structural** | Needs rethinking (missing entire feature, wrong architecture approach, critical security issue) | Discuss, may need re-implementation |

---

## Step 5: Present Findings

Present a single merged report. For each quick fix and structural item, expand with context:

1. **What the code does** — quote the relevant code or describe the current behavior
2. **What's wrong** — the specific issue
3. **Alternatives** — 2-3 concrete choices with real tradeoffs
4. **Recommendation** — which alternative goes first and why

```
## Review Findings

### Contradictions (review by hand — agents disagree)
- @check-patterns said: file follows naming convention X at src/routes/auth.ts:42
- @check-edge-cases said: file missed convention X at src/routes/auth.ts:42
- Note: resolve with user — agents disagree about whether the convention is followed

### Auto-fixes (will apply)
1. src/routes/auth.ts: Function `loginUser` doesn't follow naming convention — renaming to `handleLogin` (per codebase.md)
2. src/db/migrations/003.sql: Missing `updated_at` column on `orders` table

### Quick fixes
3. src/components/OrderList.tsx: Only handles success state — missing loading, error, empty states
   Alternatives: add all 5 states per frontend rules, or add loading + error only (empty not applicable here).

4. src/routes/auth.ts: Login error says "User not found" — must be generic per security rules
   Alternatives: "Invalid credentials" for both cases, or "Login failed".

### Structural
5. PRD criterion "Given invalid email, When submitting, Then show inline validation" — no client-side validation at all
   Alternatives: add client-side validation, or keep server-side only and flag as deviation.

### Security
6. [CRITICAL findings, merged from @check-security, @auditor-quick, and @auditor where they ran — the security escalation in Step 1b ran automatically on CRITICAL]

Your call on each.
```

**This is mandatory, not aspirational.** Every quick fix and structural item must have concrete alternatives and a recommendation.

---

## Step 6: Apply Fixes

1. **Auto-fixes** — apply with one confirmation
2. **Quick fixes** — apply user's chosen option
3. **Structural** — apply user's decision (may require significant code changes)

**Self-verify** after each round of edits:
1. Read the target file
2. Make the edit
3. Re-read the file immediately
4. Verify the edit is correct and didn't corrupt adjacent content
5. Fix if anything is wrong

---

## Step 7: Verify Acceptance Criteria

After all fixes are applied, verify each PRD acceptance criterion with evidence. Read the PRD from `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`.

- **Truths** — run the command, check the behavior, show the output
- **Artifacts** — confirm files exist with real implementation (not stubs), check exports
- **Key Links** — grep for imports/references between artifacts

If a criterion fails: fix and re-verify. Don't proceed with failures.

If a criterion can't be verified yet (e.g. needs a running server): note it explicitly — don't silently skip.

---

## Step 8: Re-verify (if needed)

Re-run after fixes. Fixes can introduce new problems — the original review couldn't have predicted issues that only exist in the post-fix code, and static analysis has no way to catch regressions without a fresh pass. `@build-verify` re-runs broadly (cheap, catches stale-test regressions a single rename or tweak can introduce); the LLM check agents stay gated (expensive, only re-run when fixes plausibly changed the static picture).

**`@build-verify` re-run trigger (broader, runs first):**
- Any fix (auto-fix, quick fix, or structural) modified code that could affect program behavior — anything other than doc/comment-only changes.

A single rename auto-fix can break a test the rename didn't touch (e.g., a stale test in another file imports the old name); only a fresh test run catches that. If `@build-verify` returns FAIL, stop and surface the regression before paying for the LLM re-run wave.

**LLM check-agent re-verification triggers:**
- Any structural change was applied in Step 6 (always)
- 5 or more quick-fixes were applied across 3+ distinct files (fixes often touch each other's code)
- Fixes touched files that weren't in the original `@git-status` change set (scope expansion)

**Skip LLM re-verification** for simple reviews: fewer than 3 auto-fixes, no quick fixes, no structural changes. `@build-verify` may still re-run on its broader trigger; the LLM agents do not.

**Cap at 2 re-verification rounds.** If the second round still produces new findings, present them to the user rather than continuing the loop — quality has plateaued and expensive loops are the failure mode to avoid. After 2 rounds, either the approach is wrong (discuss with user, possibly `/return`) or the remaining findings are edge cases the user should decide on.

**Re-run the same agents that flagged the original issues.** Don't spawn agents that had no findings in the first round — there's nothing for them to re-verify. Re-running `@check-verify` after the re-run wave is optional; skip unless the re-run produces findings the user questions.

**Re-verification of browser checks (`@ui-verify`, `@audit-lighthouse`):** only re-run if the fixes touched UI code. Backend-only fixes don't need a browser re-check.

---

## Step 9: Outcome

**All pass:** "Review passed. Run `/publish` to record and complete."

**Issues found and fixed:** Show what was changed. "Fixed N issues. Review passed. Run `/publish`."

**Can't be verified:** Note explicitly, present to user for decision.

**Critical security findings:** surfaced as part of Step 5 with full depth from `@auditor-quick` / `@auditor` when Step 1b's escalation ran. No separate user action needed — the findings are already in the consolidated report.

---

## Completion Checklist

Before finishing, confirm:

- [ ] In-progress task verified
- [ ] Code changes verified
- [ ] `@build-verify` ran — PASS or NO_TESTS (with legitimate justification); FAIL/ERROR would have stopped Prerequisites
- [ ] All 4 check agents spawned in parallel (+ `@check-design` if PRD has Designs)
- [ ] Browser verification ran (frontend) or skipped (backend)
- [ ] `@check-verify` ran (or was skipped per Step 3 skip conditions)
- [ ] Findings collected from verified list, deduplicated, classified
- [ ] Dismissed findings NOT presented to user
- [ ] Contradictions (if any) surfaced separately
- [ ] Findings presented with context, alternatives, recommendations
- [ ] User confirmed each non-auto-fix
- [ ] Fixes applied and self-verified
- [ ] Acceptance criteria verified with evidence
- [ ] Re-verification done — `@build-verify` re-run if any code was modified by fixes; LLM check agents re-run only on the structural / 5+-quick-fix / scope-expansion triggers
- [ ] Told user to run `/publish`

---

## Rules

- **Parallel execution for detection** — always run the parallel check agents simultaneously (Step 1), never sequentially. Browser agents in Step 2 also run in parallel to each other. Verification (Step 3) runs sequentially after detection.
- **One run only per agent per phase** — each agent returns its complete report in the tool result. Re-launching would duplicate work. Re-verification in Step 8 is a deliberate second pass after fixes, not a re-launch for missed data.
- **Verify before presenting** — `@check-verify` (Step 3) filters false positives before findings reach the user. Dismissed findings never reach Step 4. Skip verification only per the explicit skip conditions in Step 3.
- **Deduplicate after verification** — same issue confirmed by multiple checks should appear once in the report. Dedup happens in Step 4 on the verified list.
- **Classify by effort** — auto-fix, quick fix, structural. Handle each tier differently.
- **Expand findings** — don't pass agent output verbatim. Add code context, options, and recommendations.
- **Self-verify every edit** — the write → re-read → verify loop is mandatory
- **Evidence required** — "I tested earlier" or "this is trivial" is not evidence. Re-run after your last edit.
- **Don't confuse "code looks right" with "it works"** — read actual command/test output, not just the source code.
- **Stubs are failures** — a file with `TODO` or placeholder logic fails the Artifacts check even if it exists.
