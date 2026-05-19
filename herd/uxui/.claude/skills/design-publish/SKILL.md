---
name: design-publish
description: Publish the design draft to GitHub as N uxui:todo tasks. Pure ship — preview, confirm, create.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, AskUserQuestion
---

# Design Publish

Take the draft prepared by `/design-draft` and create the actual GitHub issues — one `uxui:todo` task per design unit in the batch (a unit is one screen, or several coupled screens; each task is `new` or `revise` mode — `/design-draft` set that).

This skill is the commit step. By the time you type `/design-publish`, the draft is composed AND validated. This skill just previews and ships.

---

## Step 1: Prerequisite

Read `$PROJECT_DIR/cowmoo/agent-files/uxui/design-draft.json`. If it doesn't exist:

```
No design draft found. Run /design-draft first to compose tasks
(after /design-start agrees on the batch).
```

Stop.

Parse it as JSON. If it exists but does not parse, or has an empty `tasks` array:

```
Design draft is malformed — re-run /design-draft to recompose it.
```

Stop.

---

## Step 2: Preview

From the parsed draft (Step 1), show the user what will be created — `batch.why` as the batch line, each `tasks[].title` as a numbered entry:

```
## Ready to publish

**Batch:** <batch.why from the draft>

**Tasks (N):**
1. <tasks[0].title>
2. <tasks[1].title>
...

This will create N independent `uxui:todo` tasks on GitHub.
```

Then render the confirmation gate as an `AskUserQuestion` picker — `Publish` (Recommended — create the N `uxui:todo` tasks on GitHub) / `Cancel` (stop without creating anything; the draft is left in place). Do not proceed without an explicit `Publish` selection.

### Pre-check: duplicate titles

Before asking for the final confirmation, check whether any draft titles already exist as open `uxui:todo` issues. This catches two cases: the user declined draft clearing on a prior run and is re-publishing, OR a previously-published task was rejected by `/review-bundle` and flipped back to `uxui:todo` with the same title.

```bash
gh issue list --label "uxui:todo" --state open --json number,title --limit 100
```

Exact-match each `tasks[].title` from the draft against the returned titles. If any collide, surface them BEFORE proceeding:

```
## Title collision — open uxui:todo issues already exist with these titles:
- #<N> — <title>
...

These are likely previously-published tasks (possibly rejected back to uxui:todo). Publishing from the draft would duplicate them.
```

**Render the collision-resolution choice via `AskUserQuestion`** (single-select) per CLAUDE.md item 3's picker rule. Default to **Cancel this publish** since closing in-flight work without confirmation risks losing designer iteration:

- **Cancel this publish** (Recommended) — these are likely the same tasks still in flight. To revise, edit the existing issue directly on GitHub.
- **Replace as stale** — close or delete the colliding issues on GitHub, then re-run `/design-publish`. Use when the collisions are dead artifacts from a prior run that should be replaced.
- **Proceed anyway (duplicates)** — creates duplicate `uxui:todo` issues. Not recommended; only useful for unusual recovery cases where the duplicate is intentional.

Only proceed past this check on explicit user confirmation of "Replace as stale" (after collisions cleared) or "Proceed anyway". Titles follow `[UXUI] <domain>: <screen>` by construction, so exact strcmp is correct — no substring matching needed.

If no collisions, flow silently into Step 3.

---

## Step 3: Create each task

Run the `issue-create` command **once per task index**, against `design-draft.json` — the task body is read from the file via stdin and never passes through the prompt or a shell. N is the length of the `tasks` array from Step 1; pass the absolute draft path. For `i` in `0 .. N-1`:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from $PROJECT_DIR/cowmoo/agent-files/uxui/design-draft.json --index <i>
```

Run them in index order: run → read the one-line stdout → check the `✓` / `✗` marker → on `✓` proceed to the next index; on the first `✗` **stop** and do not run further indices. Each `CREATE_DESIGN_TASK: ✓ #<n> — <title>. …` is a created task; the first `CREATE_DESIGN_TASK: ✗ …` line marks a mid-batch failure. Do NOT retry a `✗` — the command already retried internally; a second run would risk a duplicate issue.

If a task creation fails (`✗`):
- Report which task (index + title) failed and why, from the `✗` line
- Note already-created tasks (they don't get rolled back — designer can still pick them up)
- Stop creating further tasks on the first failure — do not run the remaining indices
- Surface to user with explicit **partial-failure recovery guidance** (see Step 5)

---

## Step 4: Verify the result

```bash
gh issue list --label "uxui:todo" --state open --json number,title --limit 20
```

Confirm all expected tasks appear with `uxui:todo` label.

---

## Step 5: Report and auto-clear draft

**Only run this step if Step 3 completed all N tasks successfully.** If Step 3 stopped mid-batch, skip to "Partial-failure recovery" below — do NOT auto-clear in that case.

Report to the user:

```
## Published

**Tasks created (N):**
- #<task-1-number> — [UXUI] <domain>: <screen 1>
- #<task-2-number> — [UXUI] <domain>: <screen 2>
...

The human designer can now pick up any uxui:todo task.
```

Then render an `AskUserQuestion` hand-off picker for the next action — `Run /catchup` (Recommended — reconcile the board, scan, and route any pending items; this is also where a designer's submitted card gets picked up once it reaches "UX: Review") first, any other live continuation (e.g. `Run /design-start` to plan the next batch), and `Done for now` last. Build the option set from where the conversation stands.

Then clear the draft automatically — the GitHub issues are now the source of truth; the draft has served its purpose:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" design-draft clear
```

Rationale: the draft is a pre-publish scratch per `CLAUDE.md` scope table; after a full publish, re-running `/design-draft` rebuilds from the live conversation if the user wants another batch. Keeping the draft on disk post-publish is what used to cause silent duplicate-issue creation on re-runs.

If the user wants a reference to what was just shipped, point them at the created issue numbers above — that's canonical.

### Partial-failure recovery

If Step 3 stopped mid-batch (e.g., 2 of 5 tasks created before a failure), show the user:

```
## Partial publish — recovery needed

**Created tasks (N of M):**
- #<task-1-number> — [UXUI] <domain>: <screen 1>
- #<task-2-number> — [UXUI] <domain>: <screen 2>

**Not created:**
- [UXUI] <domain>: <screen 3>
- [UXUI] <domain>: <screen 4>
- [UXUI] <domain>: <screen 5>

The skill does NOT automatically roll back created tasks.
```

Then render the recovery choice as an `AskUserQuestion` picker (single-select):

- **Create the remaining tasks** (Recommended) — leave the already-created tasks, edit `design-draft.json` to remove them from the `tasks` array, then re-run `/design-publish` to create only the not-created ones.
- **Recreate all fresh** — close the already-created tasks on GitHub (they're unused), then re-run `/design-publish` after fixing whatever caused the failure — recreates all N tasks.

Wait for the user to pick a path before continuing. Do NOT auto-clear the draft in this state.

---

## Completion Checklist

- [ ] Draft loaded
- [ ] User previewed the publish plan
- [ ] Duplicate-title pre-check run; collisions surfaced + resolved (or none found)
- [ ] User explicitly confirmed
- [ ] All tasks created via `issue-create` (`CREATE_DESIGN_TASK` per index)
- [ ] Result verified
- [ ] User informed of created issue numbers
- [ ] Draft auto-cleared (full-success path) OR left in place for recovery (partial-failure path)

---

## Rules

- **Pure publication, no validation.** Validation already happened in `/design-draft`. If you suspect issues here, the right move is to ask the user to re-run `/design-draft` with corrections — don't validate inline.
- **Preview before commit.** Always show the user what will be created before any `issue-create` run.
- **Stop on first failure.** If task #2 of 5 fails, don't create tasks #3, #4, #5. Report what was created and what wasn't.
- **Auto-clear the draft on full success; keep it on partial failure.** After all N tasks ship, the GitHub issues are canonical — the draft has no further role. Keeping it around is what used to cause duplicate-issue bugs on re-runs. On partial failure, the draft is the recovery surface and stays untouched.
- **Pre-check for title collisions before creating.** Open `uxui:todo` issues with the same title as a draft task indicate the user is about to duplicate (either re-running a stale draft or stomping a rejected-back task). Default to cancel, never close in-flight work.
- **One batch per publish.** The draft is single-batch by construction.
- **Single-user tool — no concurrent publishes.** Do not run two `/design-publish` invocations against the same draft at once: each would create all N issues. The duplicate-title pre-check only catches issues from a *completed* prior run, not an in-flight one.
