---
name: publish
description: Commit cowmoo/design/ files locally and push to the remote. Run after /review or anytime to save progress. If the project has no origin remote, the push step skips cleanly and the commit completes locally.
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

## Step 3: Commit and Push

Spawn `@uxui-git-ops` with operation **COMMIT** and the approved message. Wait for the COMMIT report.

**If the report begins with `COMMIT: ✗`** — the operation either refused to run (mid-merge/rebase/cherry-pick state) or failed during verification (foreign content in the commit). Surface the report verbatim to the user and **stop the publish flow** — do NOT proceed to PUSH or produce the Step 4 "Committed" report. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**If the op reports `COMMIT: Nothing to commit.`** — there were no staged UXUI-territory changes. Report this plainly to the user:

```
Nothing to commit — cowmoo/design/ and cowmoo/agent-files/uxui/ are clean.
If you expected changes, re-check Step 1 (conversation scan) or verify edits landed.
```

Do NOT produce the Step 4 "Committed" report in this case. Stop.

**On `COMMIT: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface that line to the user so they know it stayed staged.

Spawn `@uxui-git-ops` with operation **PUSH** to publish the commit to the remote. Wait for the PUSH report.

If the project has no `origin` remote, PUSH reports `skipped` and the publish completes locally — that's expected on a fresh project that hasn't been linked to GitHub yet.

If PUSH fails (network, auth, conflict), surface the error to the user. The local commit is intact; the user can run `git push` manually or re-run `/publish` once the issue is resolved.

---

## Step 4: Report

```
## Committed

**Commit:** <commit hash> — <message>
**Push:** <PUSH report from Step 3>
**Next session:** [what to pick up — next domain, open questions, next action]
```

---

## Completion Checklist

Before finishing, confirm:

- [ ] Conversation scanned for unpersisted state
- [ ] Working notes updated if needed
- [ ] Changes reviewed and approved by user
- [ ] Committed via @uxui-git-ops (verified)
- [ ] Pushed via @uxui-git-ops PUSH (or `PUSH: skipped` reported when no remote configured)
- [ ] Report presented with next steps

---

## Rules

- **Write first, commit second** — all file updates before the commit.
- **Don't skip the "next session" note** — most important part for resuming later.
- **Idempotent** — running commit twice should not duplicate content or create empty commits.
