---
name: publish
description: Publish PM files — commit specs, working notes, and proposals locally, then push to the remote. Run after /review or anytime to save progress. If the project has no origin remote, the push step skips cleanly and the commit completes locally.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Agent, Write, Edit
---

# Publish

Persist and commit PM file changes to git. This handles both spec commits (after /review) and working-notes-only commits (saving progress between sessions).

---

## Step 1: Capture Unpersisted Conversation

If `/draft` was already run this session and nothing new was discussed since — skip to Step 2.

Otherwise, the conversation has content that hasn't been written to working notes yet. Run the `/draft` procedure now to capture it — decisions, open questions, edge cases, terminology, future ideas, design reasoning, and the cross-check for superseded decisions and spec ripple effects. `/draft` is the single source of truth for conversation extraction; do not reimplement it here.

After `/draft` completes (or is skipped), continue to Step 2.

---

## Step 2: Present Changes

Based on what was done this session (what files you wrote or edited), present to the user:
- Spec files changed (if any)
- Working files changed (if any)
- Summary of what was added, modified, or removed

Suggest a commit message using conventional format:
- Spec changes: `spec(<domain>): <description>`
- Working notes only: `checkpoint(pm): <description>`

Wait for explicit approval before proceeding.

---

## Step 3: Commit and Push

Spawn `@pm-ops` with operation **COMMIT** and the approved message. Wait for confirmation that the commit was verified.

Then spawn `@pm-ops` with operation **PUSH** to publish the commit to the remote. Wait for the PUSH report.

If the project has no `origin` remote, PUSH reports `skipped` and the publish completes locally — that's expected on a fresh project that hasn't been linked to GitHub yet.

If PUSH fails (network, auth, conflict), surface the error to the user. The local commit is intact; the user can run `git push` manually or re-run `/publish` once the issue is resolved.

---

## Step 4: Report

```
## Committed

**Commit:** <commit hash> — <message>
**Push:** <PUSH report from Step 3>
**Next session:** [what to pick up — domain focus, open questions, next action]
```

If spec files were committed, decide whether to suggest `/notify` based on project lifecycle. Run:

```bash
node tools/dev-tools.cjs downstream-engaged
```

The helper checks two file-artifact signals — both are paths PM is denied from writing, so any content there is proof the downstream agent itself has run: `cowmoo/stack/techstack.md` has content (planner ran `/tech-stack`) or `cowmoo/design/domains/` has files (UXUI has written domains). Exit 0 = engaged, exit 1 = greenfield.

GitHub labels (`for-planner`, `for-uxui`) are deliberately NOT used as signals — those labels can be created entirely by PM itself via `/notify` or `/catchup`, so their presence is not proof that the downstream agent ever ran.

- **If exit 0 (engaged)** — suggest: `"Specs changed — run /notify to announce to planner and/or UXUI (inference will propose targets)."`
- **If exit 1 (greenfield)** — skip the suggestion. Downstream agents haven't been launched on this project yet; the user is still in PM-only formalization. The `/notify` prompt would land as noise.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Conversation captured via `/draft` (or confirmed already current)
- [ ] Changes reviewed and approved by user
- [ ] Code committed via @pm-ops (verified)
- [ ] Pushed via @pm-ops (or `PUSH: skipped` reported when no remote configured)
- [ ] Report presented with next steps

---

## Edge Cases

- **No changes** — nothing to commit. Don't create an empty commit.
- **Commit fails** — report the failure to user.
- **Specs changed AND `downstream-engaged` exits 0** — suggest `/notify` after committing.
- **Specs changed but `downstream-engaged` exits 1 (greenfield project)** — skip the `/notify` suggestion entirely. The user is still in PM-only formalization; downstream agents haven't been engaged yet.
- **Only working notes changed** — no `/notify` suggestion needed.

---

## Rules

- **Write first, commit second** — all file updates before the commit.
- **Don't reorganize** — when appending to working notes, add at the bottom. Don't restructure existing content.
- **Don't skip the "next session" note** — this is the most important part for resuming later.
- **Idempotent** — running commit twice in a row should not duplicate content or create empty commits.
