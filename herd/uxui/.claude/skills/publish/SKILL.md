---
name: publish
description: Commit cowmoo/design/ files locally and push to the remote. Run after /review or anytime to save progress. If the project has no origin remote, the push step skips cleanly and the commit completes locally.
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Glob, Agent, Write, Edit, AskUserQuestion
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

Render the approval as an `AskUserQuestion` picker over the change set + suggested message: `Commit & push` `(Recommended)` (description: commit the listed cowmoo/design/ + working files with the suggested message and push to the remote) / `Edit the message` (description: revise the commit message — leads to a free-text follow-up asking for the new message, then re-present) / `Cancel` (description: stop without committing — nothing is written to git). On `Edit the message`, ask for the new message, then proceed to Step 3 with it. On `Cancel`, stop. Do not proceed to Step 3 without a picked approval.

---

## Step 3: Commit and Push

Run the `commit general` command with the approved message — `commit` mode `general` owns the whole procedure (merge-state guard, pathspec-restricted staging, index-lock retry, hash-pinned content-verify). Use a single-quoted heredoc so the message never gets mangled by the shell:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit general "$(cat <<'EOF'
<approved message>
EOF
)"
```

Read the command's one-line stdout (it may emit a trailing `Note:` line):

**If the report begins with `COMMIT: ✗`** — the command either refused to run (mid-merge/rebase/cherry-pick state) or failed during verification (foreign content in the commit). Surface the report verbatim to the user and **stop the publish flow** — do NOT run PUSH or produce the Step 4 "Committed" report. The user resolves the underlying state (finish the merge, investigate the foreign content with the recovery command in the report) then re-runs `/publish`.

**If the report reads `COMMIT: Nothing to commit.`** — there were no staged UXUI-territory changes. Report this plainly to the user:

```
Nothing to commit — cowmoo/design/ and cowmoo/agent-files/uxui/ are clean.
If you expected changes, re-check Step 1 (conversation scan) or verify edits landed.
```

Do NOT produce the Step 4 "Committed" report in this case. Stop.

**On `COMMIT: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface that line to the user so they know it stayed staged.

Run the `push` command to publish the commit to the remote — it owns the origin pre-check, the idempotent `push -u origin HEAD`, the extended network timeout, and the `[ahead N]` verify:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" push
```

Read its one-line stdout. If the project has no `origin` remote, `push` reports `PUSH: skipped — no git remote 'origin' configured.` and the publish completes locally — that's expected on a fresh project that hasn't been linked to GitHub yet.

If `push` reports `PUSH: ✗ <reason>` (network, auth, conflict), surface the error to the user. The local commit is intact; the user can run `git -C "$PROJECT_DIR" push` manually or re-run `/publish` once the issue is resolved.

---

## Step 4: Report

```
## Committed

**Commit:** <commit hash> — <message>
**Push:** <PUSH report from Step 3>
**Next session:** [what to pick up — next domain, open questions, next action]
```

Keep the `**Next session:**` line in the report stamp — it is the resume note. Then close with an `AskUserQuestion` hand-off picker — never end the skill on the prose stamp alone. Build the options from what was just committed and what remains: e.g. `Continue to <next domain>` `(Recommended)` (description: start UI definitions for the next undefined domain) / `Run /review` (description: coverage check — offer when cowmoo/design/ changed and review hasn't run this session) / `Run /notify planner` (description: announce the committed cowmoo/design/ changes to planner) / `Done for now` (description: stop here; work is committed and pushed). Omit options that don't apply this run.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Conversation scanned for unpersisted state
- [ ] Working notes updated if needed
- [ ] Changes reviewed and approved by user
- [ ] Committed via the `commit general` command (verified)
- [ ] Pushed via the `push` command (or `PUSH: skipped` reported when no remote configured)
- [ ] Report presented with next steps

---

## Rules

- **Write first, commit second** — all file updates before the commit.
- **Don't skip the "next session" note** — most important part for resuming later.
- **Idempotent** — running commit twice should not duplicate content or create empty commits.
