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

Spawn `@pm-ops` with operation **COMMIT** and the approved message. Wait for the COMMIT report.

**If the report begins with `COMMIT: ✗`** — the operation either refused to run (mid-merge/rebase/cherry-pick state) or failed during verification (foreign content in the commit). Surface the report verbatim to the user and **stop the publish flow** — do NOT proceed to PUSH. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**If the report shows `COMMIT: Nothing to commit.`** — there were no PM-territory changes. Report this plainly and skip PUSH (nothing was created to push).

**On `COMMIT: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface that line to the user so they know it stayed staged.

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
node "$AGENT_DIR/tools/dev-tools.cjs" downstream-engaged
```

The helper checks two file-artifact signals — both are paths PM is denied from writing, so any content there is proof the downstream agent itself has run: `cowmoo/stack/techstack.md` has content (planner ran `/tech-stack`) or `cowmoo/design/domains/` has files (UXUI has written domains). Exit 0 = engaged, exit 1 = greenfield.

GitHub labels (`for-planner`, `for-uxui`) are deliberately NOT used as signals — those labels can be created entirely by PM itself via `/notify` or `/catchup`, so their presence is not proof that the downstream agent ever ran.

- **If exit 0 (engaged)** — suggest: `"Specs changed — run /notify to announce to planner and/or UXUI (inference will propose targets)."`
- **If exit 1 (greenfield)** — `/notify` would land as noise (no downstream agent has run). Check one more thing before deciding: Glob `$PROJECT_DIR/cowmoo/specs/domains/*.md`.
  - **Spec domain files exist** — the project has formalized specs but no design work has started. Suggest: `"Specs are taking shape and no design work has started yet — when you're ready, launch the UXUI agent (\`moo uxui\`) to begin UI definitions."`
  - **No spec domain files yet** — skip the suggestion entirely. The user is still in PM-only formalization with nothing for UXUI to consume.

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
- **Commit refuses (`COMMIT: ✗ repo is mid-merge/rebase/cherry-pick`)** — repo is in a transitional state. Surface the message verbatim; stop the publish flow. User finishes the underlying operation manually, then re-runs `/publish`.
- **Commit verify fails (`COMMIT: ✗ commit contains paths outside territory`)** — the commit was created locally but contains non-PM paths. Surface the message verbatim including the recovery command; stop the publish flow. Do NOT push the tainted commit.
- **Commit succeeds with foreign staged content** — report includes a `Note:` line; surface it so the user knows pre-existing staged paths remained in the index.
- **Commit fails (any other reason)** — report the failure to user; stop the publish flow.
- **Specs changed AND `downstream-engaged` exits 0** — suggest `/notify` after committing.
- **Specs changed, `downstream-engaged` exits 1, and `cowmoo/specs/domains/*.md` is non-empty** — skip the `/notify` suggestion; instead suggest launching the UXUI agent (`moo uxui`) for a first design pass.
- **Specs changed, `downstream-engaged` exits 1, and no spec domain files exist yet** — skip both suggestions. PM-only formalization; nothing for UXUI to consume.
- **Only working notes changed** — no `/notify` or UXUI suggestion needed.

---

## Rules

- **Write first, commit second** — all file updates before the commit.
- **Don't reorganize** — when appending to working notes, add at the bottom. Don't restructure existing content.
- **Don't skip the "next session" note** — this is the most important part for resuming later.
- **Idempotent** — running commit twice in a row should not duplicate content or create empty commits.
