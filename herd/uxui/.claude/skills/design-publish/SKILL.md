---
name: design-publish
description: Publish the design draft to GitHub as N uxui:todo tasks. Pure ship — preview, confirm, create.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Bash, Agent
---

# Design Publish

Take the draft prepared by `/design-draft` and create the actual GitHub issues — N independent `uxui:todo` tasks (one per screen in the batch).

This skill is the commit step. By the time you type `/design-publish`, the draft is composed AND validated. This skill just previews and ships.

---

## Step 1: Prerequisite

Read `$PROJECT_DIR/cowmoo/agent-files/uxui/design-draft.md`. If it doesn't exist:

```
No design draft found. Run /design-draft first to compose tasks
(after /design-start agrees on the batch).
```

Stop.

---

## Step 2: Preview

Parse the draft. Show the user what will be created:

```
## Ready to publish

**Batch:** <coherence reason from draft's Batch context>

**Tasks (N):**
1. [UXUI] <domain>: <screen 1>
2. [UXUI] <domain>: <screen 2>
...

This will create N independent `uxui:todo` tasks on GitHub.

Confirm to proceed.
```

Do not proceed without explicit user confirmation.

### Pre-check: duplicate titles

Before asking for the final confirmation, check whether any draft titles already exist as open `uxui:todo` issues. This catches two cases: the user declined draft clearing on a prior run and is re-publishing, OR a previously-published task was rejected by `/review-bundle` and flipped back to `uxui:todo` with the same title.

```bash
gh issue list --label "uxui:todo" --state open --json number,title --limit 100
```

Exact-match each draft title against the returned titles. If any collide, surface them BEFORE proceeding:

```
## Title collision — open uxui:todo issues already exist with these titles:
- #<N> — <title>
...

These are likely previously-published tasks (possibly rejected back to uxui:todo). Publishing from the draft would duplicate them. Options:
(a) These are the same tasks, still in flight — I should NOT re-publish. Cancel this /design-publish; if you want to revise, /review-bundle the existing issue or edit it directly on GitHub.
(b) These are stale and should be replaced — close/delete issues <#N> ... on GitHub, then re-run /design-publish.
(c) Proceed anyway — creates duplicates. (not recommended)

What would you like to do?
```

Default to (a). Only proceed past this check on explicit user confirmation of (b) (after collisions cleared) or (c). Titles follow `[UXUI] <domain>: <screen>` by construction, so exact strcmp is correct — no substring matching needed.

If no collisions, flow silently into Step 3.

---

## Step 3: Create each task

For each task in the draft, spawn `@uxui-gh-ops`:

```
@uxui-gh-ops CREATE_DESIGN_TASK
  title=[UXUI] <domain>: <screen>
  body=<full task body from draft>
```

Execute sequentially. **Track which tasks have been created** — this matters if we hit a mid-batch failure. Keep a running list of (title, issue#) pairs.

If a task creation fails:
- Report which task failed and why
- Note already-created tasks (they don't get rolled back — designer can still pick them up)
- Stop creating further tasks
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

The human designer can now pick up any uxui:todo task. When they submit
(uxui:review label), run /catchup or /review-bundle <issue> to evaluate.
```

Then clear the draft automatically — the GitHub issues are now the source of truth; the draft has served its purpose:

```bash
node tools/dev-tools.cjs design-draft clear
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

**Recovery options:**
(a) Leave the already-created tasks, manually remove the completed tasks from design-draft.md, then re-run `/design-publish` to create the remaining ones.
(b) Close the already-created tasks on GitHub (they're unused), then re-run `/design-publish` after fixing whatever caused the failure — recreates all N tasks fresh.

The skill does NOT automatically roll back created tasks. Your choice.
```

Wait for user to pick a path before continuing. Do NOT auto-clear the draft in this state.

---

## Completion Checklist

- [ ] Draft loaded
- [ ] User previewed the publish plan
- [ ] Duplicate-title pre-check run; collisions surfaced + resolved (or none found)
- [ ] User explicitly confirmed
- [ ] All tasks created via `@uxui-gh-ops CREATE_DESIGN_TASK`
- [ ] Result verified
- [ ] User informed of created issue numbers
- [ ] Draft auto-cleared (full-success path) OR left in place for recovery (partial-failure path)

---

## Rules

- **Pure publication, no validation.** Validation already happened in `/design-draft`. If you suspect issues here, the right move is to ask the user to re-run `/design-draft` with corrections — don't validate inline.
- **Preview before commit.** Always show the user what will be created before any `@uxui-gh-ops` writes.
- **Stop on first failure.** If task #2 of 5 fails, don't create tasks #3, #4, #5. Report what was created and what wasn't.
- **Auto-clear the draft on full success; keep it on partial failure.** After all N tasks ship, the GitHub issues are canonical — the draft has no further role. Keeping it around is what used to cause duplicate-issue bugs on re-runs. On partial failure, the draft is the recovery surface and stays untouched.
- **Pre-check for title collisions before creating.** Open `uxui:todo` issues with the same title as a draft task indicate the user is about to duplicate (either re-running a stale draft or stomping a rejected-back task). Default to cancel, never close in-flight work.
- **One batch per publish.** The draft is single-batch by construction.
