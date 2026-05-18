---
name: publish
description: Preview and publish completed work — commit code, push to remote, post Record, close task. The single command for persisting build work.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Glob, Agent, Bash
---

# Publish

Preview all pending changes, get user confirmation, then execute. This is the ONLY command that commits code.

---

## Prerequisites

1. Spawn `@task-check`. If no in-progress task → "No active task." Stop.
2. Spawn `@git-status`. If no code changes → "Nothing to publish." Stop.

---

## Step 1: Gather Information

- Read `$PROJECT_DIR/cowmoo/agent-files/builder/deviations.md` if it exists
- Get changed files from `@git-status`
- Read the task PRD from `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`

---

## Step 2: Check If Deviations Block Publish

Read every entry in `deviations.md`. Each entry declares its own `**Blocks publish?**` flag (set during `/build` when the deviation is logged).

- **Any entry with `Blocks publish? yes`** — stop `/publish`. "Deviation requires planner review before shipping. Run `/return` to send the task back to the planner." Do not proceed to preview.
- **All entries say `Blocks publish? no`** — proceed. The reasons go in the Record and stay logged in `deviations.md`.

If the flag is missing or ambiguous on any entry, treat it as blocks=yes (err on the safe side — returning is cheaper than shipping unreviewed).

---

## Step 3: Preview

Draft the commit message in conventional-commits format from the task title and PRD scope:
- `feat(area): <description>` — new user-facing behavior
- `fix(area): <description>` — bug fixes
- `refactor(area): <description>` — internal restructure, no behavior change
- `docs(area): <description>` — doc-only changes

Then show the user everything that will happen:

```
Publishing Task #NN: [task title]

Files to commit:
  [path] (new | modified | deleted)
  ...

Commit message:
  [feat(area): description | fix(area): description | ...]

Record to post:
─────────────────
**[Builder]** RECORD

**Files:**
- `path/to/file` — what it does
- ...

**Tests:**
- Framework: [e.g., vitest, pytest, go test] (or "None — no testable behavior" with reason)
- Test files: [paths to test files written or modified in this task]
- Coverage: [N test behaviors from PRD — all covered | list of gaps]
- Result: [N passed | failures if any]

**Deviations:** None | list with reasons

**Notes:** [observations for the planner]
─────────────────

BUILD-NOTES.md updates:
- [new entries, if any]

Proceed?
```

Wait for user confirmation. User can adjust before confirming.

---

## Step 4: Execute (after user confirms)

**First, write the handoff file.** Compose the Record comment with the `**[Builder]** ` identity prefix, then write `$PROJECT_DIR/cowmoo/agent-files/builder/.op-handoff.json` (Write tool) — a two-element JSON array, index 0 = POST_COMMENT (the Record), index 1 = COMPLETE:

```json
[
  { "op": "POST_COMMENT", "issue": <NN>, "comment": "**[Builder]** <Record text from Step 3>" },
  { "op": "COMPLETE", "issue": <NN>, "removeLabel": "in-progress", "close": true }
]
```

The handoff file is a single reused path, overwritten on each use. The identity prefix is the skill's job — compose `**[Builder]** ` into the `comment` field; the `issue-transition` command does not add it.

Then run each command yourself (Bash), in order. **After every command, read its one-line stdout: a `✓` marker means success, a `✗` marker means failure. Stop on `✗` (except PUSH — see below) and report which step failed. Do NOT retry a `✗` — each command already retried internally; a second attempt risks a duplicate (e.g. a double-posted comment).**

1. **Commit code** — run with the commit message from Step 3:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" commit code "$(cat <<'EOF'
   <commit message from Step 3>
   EOF
   )"
   ```
   Output is one of: `COMMIT: ✓ <hash> <subject>...` (committed — a following `Note:` line means pre-existing foreign staged content was left in the index, surface it), `COMMIT: Nothing to commit.`, or `COMMIT: ✗ <reason>`.
2. **Push** — `node "$AGENT_DIR/tools/dev-tools.cjs" push`. Output: `PUSH: ✓ to origin/<branch>`, `PUSH: skipped — no git remote 'origin' configured.`, or `PUSH: ✗ <reason>`. PUSH runs between COMMIT and POST_COMMENT so the code is on the remote before the Record references it and before the issue closes.
3. **Post Record** — `node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/builder/.op-handoff.json --index 0`. Output: `POST_COMMENT #<n>: ✓ commented. Verified.` or `POST_COMMENT #<n>: ✗ <reason>`.
4. **Complete task** — `node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/builder/.op-handoff.json --index 1`. Output: `COMPLETE #<n>: ✓ <steps>. Verified. Board: Done.` or `COMPLETE #<n>: ✗ <reason>`.
5. **Update BUILD-NOTES.md** — if this task revealed project-specific rules (patterns to follow, traps to avoid, conventions that differ from defaults), add them as directives. Merge with existing entries on the same topic. Delete entries this task proved wrong.
6. **Clean up** — `node "$AGENT_DIR/tools/dev-tools.cjs" task-cleanup` — removes the per-task scratch (`active-task.md`, `deviations.md`); the task is complete. Output: `TASK-CLEANUP: ✓ ...`. The deletions are staged and committed by step 7.
7. **Commit working files** — `node "$AGENT_DIR/tools/dev-tools.cjs" commit working "<docs(builder): description>"` (only if BUILD-NOTES or other working files changed; uses the heredoc form from step 1 for the message). Same `✓` / `Nothing to commit` / `✗` outputs as step 1.
8. **Push working files** — `node "$AGENT_DIR/tools/dev-tools.cjs" push` (no-op if step 7 produced no commit; otherwise pushes the working-files commit). Same skip/failure semantics as the code push in step 2.

**If a COMMIT step (step 1 or step 7) reports `COMMIT: ✗`** — the command refused to run (mid-merge/rebase/cherry-pick state) or failed verification (foreign content in the commit — for scope=code this means another agent's territory leaked in; for scope=working this means content outside `cowmoo/agent-files/builder/` landed). Surface the report verbatim and **stop the publish flow** — do NOT proceed to PUSH, POST_COMMENT, COMPLETE, or any subsequent step. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**On `COMMIT: ✓` with a `Note:` line about pre-existing foreign staged content** — surface that line to the user so they know it stayed staged.

**If any other step fails:** Report which step failed and list the remaining commands still needed. Do not skip failed steps or proceed as if they succeeded. **PUSH failure is non-fatal** — the local commit is correct; surface the error and continue with the next step. On a re-run, the handoff file is rewritten from scratch — no stale entries carry over.

**If the working-files commit (step 7) fails:** the task is already complete on GitHub (closed at step 4) and the code is committed and pushed — so re-running `/publish` will not resume steps 7–8 (it stops at the prerequisites: no in-progress task, nothing to publish). Surface the failure, then give the user the exact commands to finish manually once they resolve the cause:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit working "<docs(builder): description>"
node "$AGENT_DIR/tools/dev-tools.cjs" push
```

The working files (BUILD-NOTES.md, proposals) stay uncommitted in the working tree until then — nothing is lost.

---

## Step 5: Report

"Task #NN published. [Next todo task summary if available, or 'No more tasks.']"

---

## Rules

- **Deviations that require planner review block publishing** — use `/return` instead.
- **User approves everything** — never commit without explicit confirmation.
- **Record is complete** — every changed file, every deviation, all notes.
- **BUILD-NOTES.md captures project-specific rules** — directives for future sessions, not a journal of what happened.
- **This is the ONLY skill that commits** — other skills write files, /publish persists them.
