---
name: notify
description: Announce spec changes via for-planner or for-uxui issue, and resolve tracked inbox issues. Run after /publish when specs changed.
user-invocable: true
disable-model-invocation: true
argument-hint: <planner | uxui>
allowed-tools: Bash, Read, Glob, Agent
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

1. Were spec files committed this session? If no, there's nothing to announce — skip to Step 5 (inbox check).
2. Use Glob once to list `$PROJECT_DIR/cowmoo/design/domains/*.md`. If any changed spec domain has a matching design-domain filename in that list, `for-uxui` is a candidate.
3. Specs feed downstream work — `for-planner` is almost always a candidate.
4. Propose the target fork to the user — `planner`, `uxui`, `both`, or `none`. **Render this choice via `AskUserQuestion`, not as a prose `(a)/(b)/(c)/(d)` list** — it's a 4-option fork with real tradeoffs (who consumes the spec change). Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff — for `uxui` and `both`, include whether `$PROJECT_DIR/cowmoo/design/domains/<domain>.md` exists for the changed domain so the user knows if UXUI has matching content to update. Per CLAUDE.md's picker rule (the `/notify target selection` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.
5. Accept the user's choice: `planner`, `uxui`, `both`, or `none`.

If the user picks `both`, run the notify flow twice — once per target — sequentially.

If the user picks `none`, they are declining to notify — skip to Step 5 (inbox check). Tracked inbox issues, if any, still get processed; no issue is created.

The target determines which label and which `@pm-ops` operation to use.

---

## Step 2: Check for Spec Changes

Review the current session's conversation. Were spec files (`cowmoo/specs/`) committed by `/publish`?

- **No spec changes** — skip to Step 5 (inbox check).
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

Present the composed message to the user for approval.

---

## Step 4: Create GitHub Issue

After user approval:

### Target: `planner`

Spawn `@pm-ops` with **CREATE_FOR_PLANNER**:
- Title: `[PM] Specs updated: <concise summary>`
- Body: the message composed in Step 3

### Target: `uxui`

Spawn `@pm-ops` with **CREATE_FOR_UXUI**:
- Title: `[PM] Specs updated: <concise summary>`
- Body: the message composed in Step 3

Wait for confirmation that the issue was created and verified.

---

## Step 5: Check Tracked Inbox Issues

```bash
node tools/dev-tools.cjs inbox list
```

If no tracked issues — skip to report.

If tracked issues exist, the `inbox list` output is `<number>\t<title>` per line. For each line:

1. Present to user: "Tracked issue #<number>: <title>. Has this been resolved by the recent spec work?"
2. If user confirms:
   - **If a fresh announcement was created in Step 4** (target was `planner`, `uxui`, or `both`, AND Step 2 found spec changes) → spawn `@pm-ops` with operation **RESOLVE_ISSUE** — issue number, resolution summary that includes a link to the announcement (e.g., `Resolved by spec update — see #<announcement-number>`), action **close**. The new announcement is the canonical answer the originator receives via their `/catchup`; the original `for-pm` just gets a closing comment for traceability.
   - **If no announcement was created** (Step 1 target was `none`, OR Step 2 found no spec changes) → resolve with action **close** and a plain resolution comment. The originator will see the closed issue with PM's comment but no fresh inbox notification — flag this trade-off to the user.
3. After resolving, remove from tracking:
   ```bash
   node tools/dev-tools.cjs inbox remove <number>
   ```
4. If user declines → leave the issue tracked for a future `/notify`.

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

---

## Completion Checklist

Before finishing, confirm:

- [ ] Target determined (explicit arg or inference)
- [ ] Spec changes checked against last commit
- [ ] Message includes necessary content
- [ ] Impact description is observational (facts, not instructions)
- [ ] User approved the message before sending
- [ ] Target notified via `@pm-ops CREATE_FOR_PLANNER` or `CREATE_FOR_UXUI` (verified)
- [ ] Tracked inbox issues presented to user
- [ ] Resolved issues closed or transferred via `@pm-ops RESOLVE_ISSUE` (verified)
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
- **Check session context** — review what was committed this session (you were there when `/publish` ran).
- **Always resolve through `@pm-ops`** — never close or transfer issues directly.
- **Observational, not prescriptive** — the impact description states facts about what changed, not instructions for what the recipient should do.
- **User decides** — present your recommendation, let the user confirm or adjust.
- **Inbox resolution belongs here** — `/catchup` tracks items; `/notify` closes them when the work that addresses them ships.
