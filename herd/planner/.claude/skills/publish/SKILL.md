---
name: publish
description: Preview and ship all pending changes — commit files, push to remote, create GitHub issues if draft exists. The single command for persisting work.
user-invocable: true
disable-model-invocation: false
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

The `commit` and `push` subcommands of `dev-tools.cjs` own these procedures end to end (merge-state guard, pathspec-restricted staging, index-lock retry, hash-pinned content-verify for commit; origin pre-check, idempotent `push -u origin HEAD`, `[ahead N]` verify for push). Run them yourself with the `Bash` tool — they take their arguments inline, NOT via the handoff file. Each prints exactly one report; read its `✓`/`✗`/`Nothing to commit`/`skipped` marker and exit code.

Run COMMIT — describe what changed in the message. The subcommand stages only planner territory (`cowmoo/agent-files/planner/`, `cowmoo/stack/`); that captures the knowledge.md append. draft.md was untracked, so its deletion is disk-only and not represented in the commit:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit "$(cat <<'EOF'
<message>
EOF
)"
```

Read the COMMIT report.

**If the report begins with `COMMIT: ✗`** — the subcommand either refused to run (mid-merge/rebase/cherry-pick state) or failed during verification (foreign content in the commit). Surface the report verbatim to the user and **stop the publish flow** — do NOT proceed to PUSH or issue creation. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**If the report shows `COMMIT: Nothing to commit.`** — there were no planner-territory changes. Surface that and skip PUSH (nothing to push) and issue creation.

**On `COMMIT: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface that line to the user so they know it stayed staged.

Then run PUSH to publish the commit to the remote before any GitHub issues are created — the issues should reference a pushed state:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" push
```

If the project has no `origin` remote, PUSH reports `PUSH: skipped` and the flow continues. If PUSH fails (`PUSH: ✗ <reason>` — network, auth, conflict), surface the error and continue with issue creation — the commit is intact locally and the user can re-push manually. Do NOT abort the rest of the publish flow.

### 6. Create GitHub issues

If draft content was published (draft.md has been deleted in Step 4 and was untracked, so work from the conversation's draft content — do not attempt to re-read draft.md from disk):

Ops are delegated through a JSON handoff file: the skill composes each op's title/body, writes the op array to `$PROJECT_DIR/cowmoo/agent-files/planner/.op-handoff.json` with the `Write` tool, then runs the `issue-create` subcommand of `dev-tools.cjs` itself with the `Bash` tool, passing `--from` the handoff file and the `--index` of each entry. The handoff file is a single reused path — each rewrite overwrites it. The subcommand prints exactly one report line per run; read its `✓`/`✗` marker. The skill owns the identity prefix: story titles are wrapped as `[Planner] Story: <name>` and task titles as `[Planner] Task: <name>` in the handoff entry — `dev-tools.cjs` does not add the prefix.

**Story + tasks is a two-phase flow.** A `CREATE_TASK` entry must carry a `parent` field set to its story's issue number, which is only known after the story is created. So the story and its tasks cannot go in one handoff — the handoff is written twice, with an `issue-create` run between:

**6a. Create the story.** Write the handoff file with a single-element array:

```json
[
  { "op": "CREATE_STORY", "title": "[Planner] Story: <name>", "label": "story", "body": "<story description, what it delivers, dependencies>" }
]
```

Use the raw story name from the draft for `<name>` (e.g., `Auth` — no `Story:` or ordinal prefix). Run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/planner/.op-handoff.json --index 0
```

The report is `CREATE_STORY: ✓ #<n> — <title>. Label: story. Board: <column>.` on success, or `CREATE_STORY: ✗ <reason>` on failure. **If it reports `✗`, stop** — do not proceed to 6b (no story means no parent for the tasks); surface the report and see the Partial-failure recovery section. On `✓`, read the story issue number from the `#<n>` in the report — that number feeds 6b.

**6b. Create the tasks.** Overwrite the handoff file with one `CREATE_TASK` entry per task, in order (first created = first picked by builder), each `parent` set to the story number from 6a:

```json
[
  { "op": "CREATE_TASK", "title": "[Planner] Task: <name>", "label": "todo", "body": "<full PRD>", "parent": <story-number> },
  { "op": "CREATE_TASK", "title": "[Planner] Task: <name>", "label": "todo", "body": "<full PRD>", "parent": <story-number> }
]
```

**Derive each task title from the draft heading by stripping the ordinal:** `### Task 1: User model` becomes the `[Planner] Task: User model` form in the entry. GitHub issue numbers supersede ordinals, so the `N:` prefix is dropped. The same stripped name (without the `[Planner]` prefix) is used for Dependencies references and the Step 7 mapping key.

Run `issue-create` once per task, in order — `--index 0`, then `--index 1`, … `--index N-1`:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/planner/.op-handoff.json --index 0
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/planner/.op-handoff.json --index 1
```

Each run reports `CREATE_TASK: ✓ #<n> — <title>. Label: todo. Linked to story #<story>. Board: <column>.` or a `CREATE_TASK: ✗ <reason>` line. Check each report before running the next index. **If a run reports `✗`, stop** — do not run the remaining indices, and do not re-run the failed one (the subcommand already retried internally; a re-run risks a duplicate issue). Record which `#<number>` lines succeeded, surface the failure, and see the Partial-failure recovery section.

### 7. Cross-reference dependencies

If any created task has a **Dependencies** field referencing other tasks by name:

1. Build a mapping from the step 6 results: `task name → issue number`. The key is the **raw task name as it appeared in the draft** (without the `[Planner]` prefix the skill wrapped into the handoff entry).
2. For each task with dependencies, scan the Dependencies field for `Task: <name>` references. Match the name exactly (case-insensitive, whitespace-trimmed) against the mapping keys. Replace a matched reference so the line reads `Task: #<number> <name> — <what it provides>`.
3. Write the handoff file with one `UPDATE_TASK` entry per task that needs cross-references — `{ "op": "UPDATE_TASK", "issue": <n>, "body": "<PRD with resolved references>" }` — then run `issue-edit-body` once per entry, in order: `node "$AGENT_DIR/tools/dev-tools.cjs" issue-edit-body --from cowmoo/agent-files/planner/.op-handoff.json --index 0`, then `--index 1`, … `--index N-1`. Each run reports `UPDATE_TASK #<n>: ✓ body updated and verified.` or `UPDATE_TASK #<n>: ✗ <reason>`. Check each report before the next; on `✗`, stop and surface the failure.

Example: If Task 2 has `Dependencies: Task: Database schema — provides the user table`, and "Database schema" was created as #45, update the body so it reads `Dependencies: Task: #45 Database schema — provides the user table`.

If a referenced name has no match in the mapping, leave the line as-is and flag it in the step 9 report — the Dependencies name likely drifted from the actual task title during `/review`.

Skip this step if no tasks have dependencies or all dependencies are "None".

### 8. Resolve tracked inbox issues

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox list
```

For each tracked issue, ask the user: "Tracked issue #N: [title]. Has this been resolved by the work published in this session?"

- If yes → write a two-element handoff array `[ POST_COMMENT, CLOSE_ISSUE ]` on that issue — `{ "op": "POST_COMMENT", "issue": <n>, "comment": "**[Planner]** <resolution summary>" }` then `{ "op": "CLOSE_ISSUE", "issue": <n>, "close": true }` (the skill composes the `**[Planner]** ` comment prefix; `CLOSE_ISSUE` omits `comment` since the separate `POST_COMMENT` op carries it). Both ops use the `issue-transition` subcommand — run them in order: `node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/planner/.op-handoff.json --index 0`, then the same with `--index 1` (two-op pattern matches `/catchup`'s deviation-report and spec-update resolutions). Check the index-0 report first; if it reports `✗`, stop and surface the failure — do NOT run index 1. Only on `✓` proceed. Handle one tracked issue at a time — each gets its own handoff overwrite + two-op run. After both `✓` reports, remove from the inbox:
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
- [ ] Files committed via the `commit` subcommand (captures the knowledge.md append; draft.md deletion is disk-only)
- [ ] Commit pushed via the `push` subcommand (or `PUSH: skipped` reported when no remote configured) — pushed BEFORE issue creation so issues reference a pushed state
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

If a `dev-tools.cjs` run reports `✗` mid-publish, **do not re-run `/publish` blindly** — the right recovery depends on which step failed:

- **Failure during Step 4 (clear-draft unlink) or between Step 4 and Step 5 commit** — draft.md was deleted from disk. It was untracked, so `git restore` cannot recover it. knowledge.md changes are uncommitted. Recovery:
  - If the current conversation is still alive: re-run `/draft` — it rewrites draft.md from the conversation. Then re-run `/publish`. Step 1 will see `draft.md` again and proceed normally.
  - If the session was lost: the draft content is gone from disk. `git -C "$PROJECT_DIR" status` will show the uncommitted knowledge.md change — decide whether to commit it standalone or revert (`git -C "$PROJECT_DIR" restore cowmoo/agent-files/planner/knowledge.md`) and re-do the planning cycle with a fresh `/start` → `/draft`.

- **Failure AFTER the Step 5 commit, during GitHub issue creation** — the commit already captured the knowledge.md append. draft.md was untracked, so it is NOT in git history — the draft content lives only in the current conversation. Step 6 is a **two-phase flow** (6a: a single `CREATE_STORY` run; 6b: one `issue-create` run per task), so where it failed determines recovery. The handoff file at `cowmoo/agent-files/planner/.op-handoff.json` is a single reused path that each rewrite overwrites — so after a failure it holds only the *last* handoff written, not a full record of what was attempted; reconstruct what happened from the `issue-create` reports, not from the handoff file. Do NOT re-run `/publish` — it will skip Step 1 (no draft on disk) but the real risk is duplicate GitHub issues. Instead:
  1. Read the `issue-create` report(s) carefully — note which issues were created (`#<number>` lines): whether the story (6a) was created, and which tasks (6b) succeeded before the failure.
  2. **If 6a (`CREATE_STORY`) failed** — no story exists. Ask the user whether to retry: re-write the single-element `CREATE_STORY` handoff and run `issue-create --index 0` again, then proceed to 6b once the story number is known.
  3. **If 6a succeeded but a 6b `CREATE_TASK` run failed partway** (e.g. the `--index 2` run failed after indices 0–1 reported `✓`) — the story and the early tasks exist. Ask the user: "Delete the partially-created GitHub issues manually (via `gh issue delete`), OR continue by re-writing the handoff with only the remaining `CREATE_TASK` entries — each `parent` set to the already-created story number — and running `issue-create` for each?"
  4. If continuing: re-write the handoff array with just the missing task entries (indices renumbered 0..M-1, each `parent` = the story number from 6a) from the current conversation's draft content, then run `issue-create` once per entry, in order, checking each report. If the session is no longer alive and the conversation is gone, the draft content is unrecoverable — manually delete the partially-created issues and re-do the planning cycle from `/start`.

- **Failure during Step 7 (the `issue-edit-body` cross-reference loop)** — `issue-edit-body` is a full-body replacement, so it is idempotent: re-running an entry that already succeeded rewrites it to the same body, no harm. Recovery: re-write the handoff with just the unresolved `UPDATE_TASK` entries (indices renumbered 0..M-1) and re-run, or re-run the whole step — both are safe. If the session is lost, the story and all tasks still exist and function; the only gap is unresolved raw dependency names left in some task bodies, which a later `/publish` Step 7 pass (or a manual edit) can patch.

- **Failure during Step 8 (the `issue-transition` inbox-resolution loop)** — each tracked issue runs a two-op pair: `--index 0` (`POST_COMMENT`, **not** idempotent — a re-run posts a duplicate comment) then `--index 1` (`CLOSE_ISSUE`, idempotent). If `--index 0` succeeded but `--index 1` failed, re-run **only** `--index 1`. If `--index 0` itself failed, the whole pair can be retried. Never blindly re-run Step 8 for an issue whose comment already posted — that double-posts. Issues are processed one at a time and each is `inbox remove`d on success, so a failure affects only the current issue; already-resolved issues earlier in the loop won't recur.
