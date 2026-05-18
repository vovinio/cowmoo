---
name: notify
description: Announce cowmoo/design/ file changes via for-planner issue when active tasks may consume them. Closes tracked inbox items the work resolves.
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Glob, Agent, Write
---

# Notify

Announce changes UXUI made to `cowmoo/design/` files so the planner can update any active task PRDs that reference them. Also resolve any tracked `for-uxui` inbox items the work addressed.

Use after `/publish` when `cowmoo/design/` files were part of the commit.

UXUI's only downstream consumer is the planner — `/notify` always targets the planner, no argument needed.

---

## Step 1: Identify UXUI File Changes

Review the current session's conversation. Were `cowmoo/design/` files (`cowmoo/design/OVERVIEW.md`, `cowmoo/design/journeys.md`, `cowmoo/design/roles.md`, `cowmoo/design/screen-index.md`, `cowmoo/design/domains/*.md`) committed by `/publish`?

Also identify the most recent commit that touched `cowmoo/design/` and capture its hash for Step 2:
```bash
git -C "$PROJECT_DIR" log --name-only -1 --pretty='format:%H%n%n' -- cowmoo/design/
```

The first line of output is the publish commit hash — call it `PUBLISH_SHA`. Remaining lines are the changed paths.

- **No cowmoo/design/ changes** — skip to Step 5 (inbox check).
- **cowmoo/design/ changed** — note which files and what changed. Proceed to Step 2.

---

## Step 2: Scan for Affected Active Work

Check whether the planner has any active tasks that reference the changed `cowmoo/design/` files. This scopes notifications to actual consumers.

```bash
gh issue list --label "todo" --state open --json number,title,body --limit 50
gh issue list --label "in-progress" --state open --json number,title,body --limit 20
```

For each open task, check whether its PRD body references any of the changed `cowmoo/design/` file paths or screen names. **When `cowmoo/design/roles.md` is among the changed files, also diff the file to identify which specific role entries were modified.** Use the `PUBLISH_SHA` captured in Step 1 — not `HEAD` — because intermediate commits (a bundle-fetch commit, a manual hotfix, another agent committing in the same project) may have landed between `/publish` and `/notify`, so HEAD is not guaranteed to be the publish commit:

```bash
git -C "$PROJECT_DIR" diff "${PUBLISH_SHA}^" "$PUBLISH_SHA" -- cowmoo/design/roles.md
```

If `PUBLISH_SHA` is the very first commit in the repo, `${PUBLISH_SHA}^` does not resolve. In that case, skip the role-diff and treat all roles in `cowmoo/design/roles.md` as added — by the same "added roles have no in-flight consumers" rule, no role-based notification is needed.

**For each role name appearing in the diff as modified or removed (added roles have no in-flight consumers and can be ignored), match PRDs whose body mentions that role name anywhere. Removals matter as much as in-place edits — `/review` can delete unused-by-domain-files roles that an in-flight PRD still references, and the planner needs to know. Role names are unique hyphenated tokens (`primary-action`, `destructive-action`, `text-muted`, `space-tight` — see `.claude/rules/ui-vocabulary.md`), so substring matching on the name is safe.** Collect the matching task numbers.

- **No matching tasks and no tracked inbox items** — report "Nothing to notify about." and stop.
- **Matching tasks exist OR tracked inbox items exist** — proceed.

Changes to files no current task references don't need a notification. `/publish` committed the files — they'll be read fresh next time a new story is drafted from the updated state.

---

## Step 3: Compose Message

Your message should include:
- Which `cowmoo/design/` file(s) changed
- What was added, modified, or removed
- The commit hash
- Which active tasks may be affected (list the task numbers from Step 2)

Write naturally — facts about what changed and what may be impacted, not instructions for what the recipient should do.

Present the composed message to the user for approval.

---

## Step 4: Create GitHub Issue

After user approval:

The `issue-create` command reads its issue body and title from a JSON handoff file you write first. The title carries the `[UXUI] ` identity prefix. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use):

```json
[
  { "op": "CREATE_FOR_PLANNER", "title": "[UXUI] UI updated: <concise summary>", "label": "for-planner", "body": "<composed message>" }
]
```

Then run the command directly:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

It owns the JSON-handoff parse, body-via-stdin create, title/label verify with one retry, and the non-blocking board sync. Read the command's one-line stdout — key on the `✓` / `✗` marker:

- `CREATE_FOR_PLANNER: ✓ #<n> — <title>. …` — issue created and verified.
- `CREATE_FOR_PLANNER: ✗ <reason>` — create or verify failed. If a `#<number>` appears, the issue exists — do NOT re-run.

Do NOT retry on `✗` — the command already retried internally; a second run would risk a duplicate issue.

---

## Step 5: Resolve Tracked Inbox Issues

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox list
```

If no tracked issues — skip to report.

If tracked issues exist, present each to the user:
- "Tracked issue #N: [title]. Has this been resolved by the recent cowmoo/design/ work?"
- If user confirms → **Write** the handoff array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (overwriting Step 4's handoff — it's already been consumed), then run the `issue-transition` command directly. Compose the resolution summary (reference the new `for-planner` issue number) with the `**[UXUI]** ` identity prefix. RESOLVE_ISSUE always closes the issue:
  ```json
  [
    { "op": "RESOLVE_ISSUE", "issue": <number>, "comment": "**[UXUI]** Resolved: <summary>", "close": true }
  ]
  ```
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
  ```
  The command runs comment → close in order, verifies each step with one retry, and syncs the board. Read its one-line stdout — `RESOLVE_ISSUE #<n>: ✓ …` means done; `RESOLVE_ISSUE #<n>: ✗ <reason>` means a step failed. Do NOT retry on `✗`. Process tracked issues one at a time — re-Write the handoff and re-run for each, since the file is overwritten per use.
- After resolving, remove from tracking:
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" inbox remove <number>
  ```
- If user declines → leave the issue tracked for future

---

## Step 6: Report

```
## Notified

**Target:** planner
**Issue:** <#NN — title, or "skipped — no matching tasks">
**Affected tasks:** <list from Step 2, or "none">
**Inbox resolved:** <list of resolved issues, or "none tracked">
**Inbox remaining:** <list of still-tracked issues, or "none">
```

If nothing happened (no cowmoo/design/ changes, no matching tasks, no tracked issues): "Nothing to notify about."

---

## Completion Checklist

Before finishing, confirm:

- [ ] `cowmoo/design/` changes checked against last commit
- [ ] Planner's open tasks scanned for references to changed files
- [ ] Matching tasks listed in the impact description
- [ ] Message includes necessary content
- [ ] Impact description is observational (facts, not instructions)
- [ ] User approved the message before sending
- [ ] Planner notified via `issue-create` (verified)
- [ ] Tracked inbox issues presented to user
- [ ] Resolved issues closed via `issue-transition` RESOLVE_ISSUE (verified)
- [ ] Resolved issues removed from tracking
- [ ] Report presented

---

## Edge Cases

- **No cowmoo/design/ changes AND no tracked issues** — nothing to do. Stop.
- **cowmoo/design/ changes but no matching tasks and no tracked issues** — "Nothing to notify about." Stop (don't create a for-planner issue that goes into a void).
- **Tracked issues but no cowmoo/design/ changes** — process inbox only, no notification.
- **Fresh project, no tasks** — Step 2 finds nothing. Stop unless tracked inbox items exist.
- **Notification fails** — report the failure. Still proceed to inbox check.

---

## Rules

- **Scope to actual consumers** — only notify the planner when active tasks reference the changed files. Fresh-domain updates with no downstream tasks don't need a notification; the planner reads cowmoo/design/ fresh when drafting.
- **roles.md matches by role name, not path.** PRDs don't contain the string `cowmoo/design/roles.md` — they cite roles by name (`primary-action`, `text-muted`). When roles.md changes, diff the commit to extract role names that were modified or removed and match any PRD that mentions them. Added roles have no in-flight consumers and can be skipped; modifications and removals both need notification.
- **Observational, not prescriptive** — the impact description states facts about what changed, not instructions for what the recipient should do.
- **User decides** — present your recommendation, let the user confirm or adjust.
- **Inbox resolution belongs here** — `/catchup` tracks items; `/notify` closes them when the cowmoo/design/ work that addresses them ships.
- **Always resolve through the `issue-transition` command** — never close or transfer issues with hand-rolled `gh` calls.
