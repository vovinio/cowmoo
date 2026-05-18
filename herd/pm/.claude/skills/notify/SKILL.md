---
name: notify
description: Announce spec changes via for-planner or for-uxui issue, and resolve tracked inbox issues. Run after /publish when specs changed.
user-invocable: true
disable-model-invocation: false
argument-hint: <planner | uxui>
allowed-tools: Bash, Read, Glob, Agent, Write, AskUserQuestion
---

# Notify

Announce spec changes to downstream agents that consume specs, and resolve any tracked inbox issues the work addresses.

Use after `/publish` when spec files were part of the commit.

---

## Step 1: Determine Target

Parse the argument:
- `planner` — target label: `for-planner`.
- `uxui` — target label: `for-uxui`.
- no argument — infer from session context and propose.

**If no argument is provided**, scan the session and propose:

1. Were spec files committed this session? If `/publish` ran in this session, use what it committed. If not, run `node "$AGENT_DIR/tools/dev-tools.cjs" last-spec-commit` — it prints `specs: <hash> <files>` for the most recent commit touching `cowmoo/specs/`, or `specs: none`. If neither the session nor `last-spec-commit` shows a spec commit, there's nothing to announce — skip to Step 5 (inbox check).
2. Use Glob once to list `$PROJECT_DIR/cowmoo/design/domains/*.md`. If any changed spec domain has a matching design-domain filename in that list, `for-uxui` is a candidate.
3. Specs feed downstream work — `for-planner` is almost always a candidate.
4. Propose the target fork to the user — `planner`, `uxui`, `both`, or `none`. **Render this choice via `AskUserQuestion`** per CLAUDE.md item 3's picker rule — it's a 4-option fork with real tradeoffs (who consumes the spec change). For `uxui` and `both`, the option's `description` includes whether `$PROJECT_DIR/cowmoo/design/domains/<domain>.md` exists for the changed domain so the user knows if UXUI has matching content to update.
5. Accept the user's choice: `planner`, `uxui`, `both`, or `none`.

If the user picks `both`, run the notify flow twice — once per target — sequentially.

If the user picks `none`, they are declining to notify — skip to Step 5 (inbox check). Tracked inbox issues, if any, still get processed; no issue is created.

The target determines which label and which `dev-tools.cjs` op to use.

---

## Step 2: Check for Spec Changes

Identify the spec changes to announce. (If Step 1's no-argument path already ran `last-spec-commit`, reuse that result instead of re-running it.)

- **`/publish` ran in this session** — use the spec files it committed; you saw the `COMMIT: ✓ <hash>` report.
- **`/notify` is running in a separate session from `/publish`** — there is no in-context commit report. Run `node "$AGENT_DIR/tools/dev-tools.cjs" last-spec-commit`:
  - `specs: <hash> <file>,<file>,...` — the most recent commit touching `cowmoo/specs/`; treat those files as the spec change to announce and note the hash. This commit comes from git history, not this session — it may be one already announced in an earlier `/notify`. Surface the hash and changed files to the user so the Step 3 approval is an informed check, not a rubber stamp.
  - `specs: none` — no commit in history touched `cowmoo/specs/`.

- **No spec changes** (no in-session `/publish`, and `last-spec-commit` reported `none`) — skip to Step 5 (inbox check).
- **Specs changed** — note which files and what changed. Proceed to Step 3.

---

## Step 3: Compose Message

### `for-planner` message

Your message should include:
- Which spec domain changed
- What was added, modified, or removed
- Which files changed and the commit hash
- What may affect active planning — facts, not instructions

### `for-uxui` message

Same content, but frame the impact around what may need updating in UI definitions.

Include enough context that the recipient understands the impact without reading the specs themselves.

Present the composed message, then render an `AskUserQuestion` approval picker — `Send` `(Recommended)` / `Edit the message` / `Cancel`. Each option's `description` carries the consequence: `Send` creates the GitHub issue (Step 4); `Edit the message` lets the user revise before sending; `Cancel` skips notification (proceed to Step 5 inbox check, no issue created). On `Edit the message`, ask in free text what to change, revise the message, and re-present the picker.

---

## Step 4: Create GitHub Issue

After user approval, write the handoff file then run the `issue-create` command. The title gets the `[PM] ` prefix composed in by this skill.

### Target: `planner`

Use the Write tool to write this one-element array to `cowmoo/agent-files/pm/.op-handoff.json`:

```json
[
  { "op": "CREATE_FOR_PLANNER", "title": "[PM] Specs updated: <concise summary>", "label": "for-planner", "body": "<message composed in Step 3>" }
]
```

Then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/pm/.op-handoff.json --index 0
```

### Target: `uxui`

Use the Write tool to write this one-element array to `cowmoo/agent-files/pm/.op-handoff.json`:

```json
[
  { "op": "CREATE_FOR_UXUI", "title": "[PM] Specs updated: <concise summary>", "label": "for-uxui", "body": "<message composed in Step 3>" }
]
```

Then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/pm/.op-handoff.json --index 0
```

The `issue-create` command owns the JSON-handoff parse, body-via-stdin create, title/label verify with one retry, and the non-blocking board sync. Read its stdout — it prints exactly one report and sets the exit code:

| Output | Exit | Meaning |
|---|---|---|
| `CREATE_FOR_PLANNER: ✓ #<n> — ...` / `CREATE_FOR_UXUI: ✓ #<n> — ...` | 0 | Issue created, verified, board synced. |
| `CREATE_FOR_*: ✗ <reason>` | 1 | Create or verify failed. If a `#<number>` appears, the issue exists — do NOT recreate it. |

The `✓` / `✗` marker and `#<number>` drive the report in Step 6.

---

## Step 5: Check Tracked Inbox Issues

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox list
```

If no tracked issues — skip to report.

If tracked issues exist, the `inbox list` output is `<number>\t<title>` per line. For each line:

1. For each tracked issue, render an `AskUserQuestion` picker — one per issue — naming it (`Tracked issue #<number>: <title>`): `Resolved` `(Recommended)` / `Not resolved`. Each option's `description` carries the consequence: `Resolved` closes the issue and removes it from tracking; `Not resolved` leaves it tracked for a future `/notify`.
2. If the user picks `Resolved`, resolve the issue with action **close**. The skill composes the resolution comment — prefixed `**[PM]** ` — and writes a one-element handoff array to `cowmoo/agent-files/pm/.op-handoff.json` with the Write tool:

   ```json
   [
     { "op": "RESOLVE_ISSUE", "issue": <n>, "comment": "**[PM]** Resolved: <summary>", "close": true }
   ]
   ```

   Then run:

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/pm/.op-handoff.json --index 0
   ```

   The `issue-transition` command runs comment → close in order, verifies each step with one retry, and syncs the board. Read its stdout — `RESOLVE_ISSUE #<n>: ✓ ...` (exit 0) means resolved; `RESOLVE_ISSUE #<n>: ✗ <reason>` (exit 1) means a step failed (the report names what already succeeded so a retry doesn't double-post). The handoff file is overwritten per resolution — issues are processed one at a time, so each is a fresh single-entry array. Compose the `<summary>` per the two cases:
   - **If a fresh announcement was created in Step 4** (target was `planner`, `uxui`, or `both`, AND Step 2 found spec changes) → the summary includes a link to the announcement (e.g., `Resolved by spec update — see #<announcement-number>`). The new announcement is the canonical answer the originator receives via their `/catchup`; the original `for-pm` just gets a closing comment for traceability.
   - **If no announcement was created** (Step 1 target was `none`, OR Step 2 found no spec changes) → a plain resolution comment. The originator will see the closed issue with PM's comment but no fresh inbox notification — flag this trade-off to the user.
3. After resolving, remove from tracking:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" inbox remove <number>
   ```
4. If the user picks `Not resolved` → leave the issue tracked for a future `/notify`.

---

## Step 6: Report

```
## Notified

**Target:** <planner | uxui | both>
**Issue:** <#NN — title, or "skipped — no spec changes">
**Inbox resolved:** <list of resolved issues, or "none tracked">
**Inbox remaining:** <list of still-tracked issues, or "none">
```

If nothing happened (no spec changes and no tracked issues): "Nothing to notify about."

After the report, render an `AskUserQuestion` hand-off picker of concrete next actions, recommended first and `Done for now` last. Build the options from session state — e.g. `/notify <other target>` if only one of planner/uxui was notified and the other is a live candidate, `/notify` again if tracked inbox issues remain unresolved, `/catchup` to check for new inbox items, `/start` to begin or resume discussion, and `Done for now` last.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Target determined (explicit arg or inference)
- [ ] Spec changes checked against last commit
- [ ] Message includes necessary content
- [ ] Impact description is observational (facts, not instructions)
- [ ] User approved the message before sending
- [ ] Target notified via `dev-tools.cjs issue-create` (CREATE_FOR_PLANNER or CREATE_FOR_UXUI, verified)
- [ ] Tracked inbox issues presented to user
- [ ] Resolved issues closed or transferred via `dev-tools.cjs issue-transition` (RESOLVE_ISSUE, verified)
- [ ] Resolved issues removed from tracking
- [ ] Report presented

---

## Edge Cases

- **No spec changes AND no tracked issues** — nothing to do. Report and stop.
- **Spec changes but no tracked issues** — notify target only.
- **No spec changes but tracked issues exist** — skip notification, process inbox only.
- **Notification fails** — report the failure. Still proceed to inbox check.
- **Tracked issue only partially addressed** — don't resolve it.
- **Fresh project, no cowmoo/design/domains/ files** — the inference in Step 1 won't propose UXUI. `/notify uxui` explicitly still creates an issue if the user forces it, but warn that no cowmoo/design/ files exist for UXUI to cross-reference.

---

## Rules

- **One target per invocation** — if both planner and UXUI need messages, run `/notify` twice with different targets (or accept the "both" offer in Step 1).
- **Check what was committed** — prefer this session's `/publish`; when `/notify` runs in a separate session, fall back to `dev-tools.cjs last-spec-commit` for the most recent `cowmoo/specs/` commit.
- **Always resolve through `dev-tools.cjs issue-transition`** — never close or transfer issues with hand-rolled `gh` calls.
- **Observational, not prescriptive** — the impact description states facts about what changed, not instructions for what the recipient should do.
- **User decides** — present your recommendation; the user confirms or redirects through the picker, never an assumed yes.
- **Inbox resolution belongs here** — `/catchup` tracks items; `/notify` closes them when the work that addresses them ships.
