---
name: publish
description: Commit cowmoo/design/ files to git. Run after /review or anytime to save progress.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Agent, Write, Edit
---

# Publish

Persist and commit UXUI file changes to git.

---

## Step 1: Scan for Unpersisted State

Review the current conversation for anything not yet written to files:

- Design intent, navigation, journeys, roles, or screen definitions discussed but not yet in cowmoo/design/ files
- Working notes from discussions not yet captured via /draft

If `/draft` was already run and nothing new was discussed since — skip to Step 2.

Otherwise, append unpersisted content to `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md`.

---

## Step 2: Present Changes

Based on what was done this session, present to the user:
- cowmoo/design/ files changed (new or updated)
- Working files changed
- Summary of what was added or modified

Suggest a commit message:
- UI definition changes: `design(<domain>): <description>`
- Working notes only: `checkpoint(uxui): <description>`

Wait for explicit approval before proceeding.

---

## Step 3: Commit

Spawn `@uxui-git-ops` with operation **COMMIT** and the approved message.

Wait for confirmation that commit was verified.

**If the op reports `COMMIT: Nothing to commit.`** — there were no staged UXUI-territory changes. Report this plainly to the user:

```
Nothing to commit — cowmoo/design/ and cowmoo/agent-files/uxui/ are clean.
If you expected changes, re-check Step 1 (conversation scan) or verify edits landed.
```

Do NOT produce the Step 4 "Committed" report in this case. Stop.

---

## Step 4: Report

```
## Committed

**Commit:** <commit hash> — <message>
**Next session:** [what to pick up — next domain, open questions, next action]
```

---

## Completion Checklist

Before finishing, confirm:

- [ ] Conversation scanned for unpersisted state
- [ ] Working notes updated if needed
- [ ] Changes reviewed and approved by user
- [ ] Committed via @uxui-git-ops (verified)
- [ ] Report presented with next steps

---

## Rules

- **Write first, commit second** — all file updates before the commit.
- **Don't skip the "next session" note** — most important part for resuming later.
- **Idempotent** — running commit twice should not duplicate content or create empty commits.
