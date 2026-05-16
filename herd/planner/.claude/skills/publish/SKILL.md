---
name: publish
description: Preview and ship all pending changes — commit files, push to remote, create GitHub issues if draft exists. The single command for persisting work.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Bash
---

# Publish

Preview all pending changes, get user confirmation, then execute. This is the ONLY command that commits or creates GitHub issues.

---

## Steps

### 1. Check what needs publishing

- Check if `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` exists
- Check tracked inbox issues: `node "$AGENT_DIR/tools/dev-tools.cjs" inbox list`
- Review what was done this session (files written, decisions made)

If nothing was done this session, no draft.md, and no tracked inbox issues — "Nothing to publish." Stop.

### 2. Preview

Present everything that will happen based on session context:

```
## Publish Preview

### Files changed this session
[list files you wrote or modified]

### GitHub Issues to Create
[if draft.md exists:]
Story: "[Name]" (story label)
  Task 1: "[Name]" [todo]
  Task 2: "[Name]" [todo]
  Task 3: "[Name]" [todo]
[if no draft:]
No stories or tasks to create.

### Tracked inbox issues to review
[if inbox list returned items:]
#NN [title] — will ask per-issue if resolved (Step 7)
#NN [title] — will ask per-issue if resolved (Step 7)
[if inbox empty:]
None tracked.

Confirm? (adjust / approve)
```

If draft.md exists and `/review` hasn't been run in this conversation, warn: "/review hasn't been run. Run it first, or confirm you want to skip."

Wait for user approval.

### 3. Apply draft updates

If draft.md exists and has an Updates section:
- Read current `$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md`. For each entry in the draft's Updates section, append only if that entry is not already present (exact-line match) — this keeps the append idempotent so a retry after a Step 6 failure doesn't duplicate entries. Re-read to verify.

### 4. Clean up draft.md

If draft.md exists — delete it via `node "$AGENT_DIR/tools/dev-tools.cjs" clear-draft` (allowed through the `Bash(node tools/*)` allow-list; plain `rm` is not permitted). draft.md is untracked in git, so this is disk-only cleanup — it removes the "Draft: exists from previous session" indicator from the next session's statusline and hooks. The next step's commit captures only the knowledge.md append.

### 5. Commit and Push

Spawn `@plan-ops` with **COMMIT** operation:
- Stage: `cowmoo/agent-files/planner/`, `cowmoo/stack/` (captures the knowledge.md append; draft.md was untracked, so its deletion is disk-only and not represented in the commit)
- Message: describe what changed

Wait for the COMMIT report.

**If the report begins with `COMMIT: ✗`** — the operation either refused to run (mid-merge/rebase/cherry-pick state) or failed during verification (foreign content in the commit). Surface the report verbatim to the user and **stop the publish flow** — do NOT proceed to PUSH or issue creation. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**If the report shows `COMMIT: Nothing to commit.`** — there were no planner-territory changes. Surface that and skip PUSH (nothing to push) and issue creation.

**On `COMMIT: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface that line to the user so they know it stayed staged.

Then spawn `@plan-ops` with **PUSH** to publish the commit to the remote before any GitHub issues are created — the issues should reference a pushed state.

If the project has no `origin` remote, PUSH reports `skipped` and the flow continues. If PUSH fails (network, auth, conflict), surface the error and continue with issue creation — the commit is intact locally and the user can re-push manually. Do NOT abort the rest of the publish flow.

### 6. Create GitHub issues

If draft content was published (draft.md has been deleted in Step 4 and was untracked, so work from the conversation's draft content — do not attempt to re-read draft.md from disk):

Spawn `@plan-ops` with **CREATE_STORY**:
- Story name: the raw name from the draft (e.g., `Auth` — no `Story:` or `[Planner]` prefix; plan-ops wraps to `[Planner] Story: Auth`)
- Body: story description, what it delivers, dependencies
- Label: `story`

Then for each task in order (first created = first picked by builder):
Spawn `@plan-ops` with **CREATE_TASK**:
- Title: the full task title including `Task: ` prefix (e.g., `Task: User model` — plan-ops ensures the `[Planner]` prefix). **Derive the title from the draft heading by stripping the ordinal:** `### Task 1: User model` becomes `Task: User model`. GitHub issue numbers supersede ordinals, so the `N:` prefix is dropped. The same stripped form is used for Dependencies references and the Step 7 mapping key.
- Body: full PRD from draft
- Label: `todo`
- Parent: story issue number

### 7. Cross-reference dependencies

If any created task has a **Dependencies** field referencing other tasks by name:

1. Build a mapping from the step 6 results: `task name → issue number`. The key is the **raw task name as it appeared in the draft** (without any `[Planner]` prefix plan-ops prepended).
2. For each task with dependencies, scan the Dependencies field for `Task: <name>` references. Match the name exactly (case-insensitive, whitespace-trimmed) against the mapping keys. Replace a matched reference so the line reads `Task: #<number> <name> — <what it provides>`.
3. Spawn `@plan-ops` with **UPDATE_TASK** for each task that needs cross-references.

Example: If Task 2 has `Dependencies: Task: Database schema — provides the user table`, and "Database schema" was created as #45, update the body so it reads `Dependencies: Task: #45 Database schema — provides the user table`.

If a referenced name has no match in the mapping, leave the line as-is and flag it in the step 9 report — the Dependencies name likely drifted from the actual task title during `/review`.

Skip this step if no tasks have dependencies or all dependencies are "None".

### 8. Resolve tracked inbox issues

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox list
```

For each tracked issue, ask the user: "Tracked issue #N: [title]. Has this been resolved by the work published in this session?"

- If yes → spawn `@plan-ops` with **POST_COMMENT** on that issue with the resolution summary, then `@plan-ops` with **CLOSE_ISSUE** (two-op pattern matches `/catchup`'s deviation-report and spec-update resolutions). Then remove from the inbox:
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" inbox remove <number>
  ```
- If no → leave it tracked for a future session.

Do NOT auto-close tracked issues — the user confirms each one. An escalated issue (already processed by `/ask`) will not appear here because `/ask` removes it from the inbox at escalation time.

### 9. Report

```
## Published

[if issues created:]
**Story:** #NN — [Name]
**Tasks:** #NN [todo], #NN [todo], #NN [todo]

**Committed:** [hash]
**Inbox resolved:** [#NN, #NN, or "none"]
**Inbox remaining:** [#NN, or "none"]
[if any dependency names didn't match:]
**Unmatched dependencies:** Task "[name]" in #NN — left as-is, likely renamed during /review
```

---

## Completion Checklist

- [ ] Pending changes identified
- [ ] Preview shown, user approved
- [ ] Draft updates applied to knowledge.md (if any)
- [ ] draft.md deleted (if existed)
- [ ] Files committed (captures the knowledge.md append; draft.md deletion is disk-only)
- [ ] Commit pushed via @plan-ops PUSH (or `PUSH: skipped` reported when no remote configured) — pushed BEFORE issue creation so issues reference a pushed state
- [ ] GitHub issues created and added to project board (if draft existed)
- [ ] Task dependencies cross-referenced with issue numbers (if any)
- [ ] Tracked inbox issues resolved per user confirmation (each removed via `inbox remove`)

---

## Rules

- **Preview before executing** — user sees everything before any write
- **Order matters** — files → commit → story → tasks (least reversible last)
- **Self-verify file writes** — write → re-read → verify
- **Task creation order = priority order** — first created = first picked by builder
- **User confirms each inbox resolution** — never auto-close tracked issues; ask per-issue in Step 8
- **This is the ONLY skill that commits** — other skills write files, /publish persists them

## Partial-failure recovery

If `@plan-ops` reports a failure mid-publish, **do not re-run `/publish` blindly** — the right recovery depends on which step failed:

- **Failure during Step 4 (clear-draft unlink) or between Step 4 and Step 5 commit** — draft.md was deleted from disk. It was untracked, so `git restore` cannot recover it. knowledge.md changes are uncommitted. Recovery:
  - If the current conversation is still alive: re-run `/draft` — it rewrites draft.md from the conversation. Then re-run `/publish`. Step 1 will see `draft.md` again and proceed normally.
  - If the session was lost: the draft content is gone from disk. `git -C "$PROJECT_DIR" status` will show the uncommitted knowledge.md change — decide whether to commit it standalone or revert (`git -C "$PROJECT_DIR" restore cowmoo/agent-files/planner/knowledge.md`) and re-do the planning cycle with a fresh `/start` → `/draft`.

- **Failure AFTER the Step 5 commit, during GitHub issue creation** (e.g., CREATE_TASK #3 fails after CREATE_STORY and CREATE_TASK #1, #2 succeeded) — the commit already captured the knowledge.md append. draft.md was untracked, so it is NOT in git history — the draft content lives only in the current conversation. Do NOT re-run `/publish` — it will skip Step 1 (no draft on disk) but the real risk is duplicate GitHub issues. Instead:
  1. Read the plan-ops report carefully — note which issues were created (`#<number>` lines).
  2. Ask the user: "Delete the partially-created GitHub issues manually (via `gh issue delete`), OR continue from where it failed by running the missing CREATE_TASK operations directly via `@plan-ops`?"
  3. If continuing: pass the remaining task PRDs from the current conversation directly to `@plan-ops` CREATE_TASK. If the session is no longer alive and the conversation is gone, the draft content is unrecoverable — manually delete the partially-created issues and re-do the planning cycle from `/start`.
