---
name: catchup
description: Read and handle incoming for-planner messages — spec updates, deviations, blocks, UI updates. Quick-fix or prepare context for planning.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Glob, Bash, AskUserQuestion
---

# Catch Up

Read incoming messages, handle what you can, and prepare context for the rest.

---

## Step 1: Load Messages

### 1a. Detect board card-moves (board → label)

A human can route an issue to the planner by dragging its card into the "Planner" column. Detect those drags first and re-sync the label, so `@plan-reader` sees them:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" board-drags "Planner" for-planner
```

This prints one `<number><TAB><current-labels>` line per card a human dragged into the "Planner" column (cards there not already labelled `for-planner`) — or `Board: no board` (then skip this sub-step). For each, spawn `@plan-ops` **RELABEL** — remove its current status label (taken from the `board-drags` line), add `for-planner`. Do this before spawning `@plan-reader` below so the dragged cards appear in the message list.

### 1b. Load the inbox

Spawn `@plan-reader` with operation **GET_MESSAGES** — get all for-planner issues with full context, categorized by message type.

**Verify the output before trusting it.** `@plan-reader` runs with `maxTurns: 30` and can fail partway (gh timeout, auth hiccup, opus turn truncation) and return empty or error-shaped prose. A silent failure looks identical to "no messages." Apply a presence + shape check, modeled on `/start` Step 2:

- The output must contain the `## Messages` heading. On a project with no for-planner items the body will say so, but the heading itself is always present.

If the output is empty, an error message, or missing the `## Messages` heading: stop, report that `@plan-reader` failed, and ask the user whether to re-spawn it or proceed knowingly without the inbox. Do not continue to Step 2 with unverified data.

If the output contains the heading and the body says no messages — "No messages. Run `/start` to continue planning." Stop.

---

## Step 2: Present Messages

Show all messages with categories:

```
## Inbox — [N] Messages

1. #NN — [title] → **spec update**
   [one-line summary]

2. #NN — [title] → **deviation report**
   [one-line summary]
```

**Render the message-selection choice via `AskUserQuestion`** with `multiSelect: true`. Each option is one inbox message (`#N — title → <message-type> (from <origin>)`); the user picks the messages to handle in this pass. Recommended option first with `(Recommended)` suffix — pick the highest-priority item (blocked-task RETURNs and deviation reports before spec/UI updates, since they often gate downstream PRDs; within each kind, oldest first). Each option's `description` carries the one-line summary. Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

If the inbox has only 1 message, skip the picker and prose-confirm: "Handle #N — <title>?" — a 1-option picker is degenerate.

---

## Step 3: Handle Each Message

For each message the user picks, handle by type:

### Spec update
1. Read the updated spec files referenced in the message
2. Check: does this affect only the next story, or existing planned stories too?
3. If existing `todo` tasks are affected → update their PRDs via `@plan-ops` **UPDATE_TASK**
4. **If `in-progress` tasks are affected** → assess impact. Don't update the PRD silently under a working builder. Post a comment on the `in-progress` task summarizing what changed, then let the builder decide whether to continue or `/return` for a PRD rewrite.
5. If product facts changed → note for knowledge.md update (will be captured in next `/draft`)
6. Respond: spawn `@plan-ops` **POST_COMMENT** on the issue — "**[Planner]** Acknowledged. [summary of impact]."
7. Close the issue via `@plan-ops` **CLOSE_ISSUE**

### Deviation report
1. Read the full Record — what was planned vs what was built
2. **Check for conflicting deviations** — scan other recent deviation reports (in this inbox or recently resolved) that touch the same entity, field, or module. If deviations conflict, resolve the conflict *before* approving either. Otherwise you end up with downstream PRDs pulled in contradictory directions.
3. **Render the accept/reject choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix — base the recommendation on your scan of downstream impact (accept when minor or an improvement, reject when the deviation breaks downstream PRDs). Each option's `description` states the consequence in planning terms ("propagate the deviation to N downstream tasks" vs "send back with changes needed; task returns to `todo`"). Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.
4. If accepted and downstream tasks are affected:
   - Identify `todo` tasks that reference old paths/names/shapes
   - For each: update PRD via `@plan-ops` **UPDATE_TASK**
5. Execute user's decision via `@plan-ops`:
   - **Accept:** `POST_COMMENT` with "**[Planner]** Deviation accepted. [reason]", then `CLOSE_ISSUE`
   - **Reject:** `POST_COMMENT` with "**[Planner]** Changes needed: [what to fix]", then `RELABEL` to `todo`

### Blocked task
1. Read the RETURN comment — the observational report with Issue/Tried/Needed fields
2. **Diagnose within your scope.** The message is observational; you decide what it means and how to resolve it. Classify the issue into one of three categories:
   - **PRD clarity issue** → The PRD itself is ambiguous, contradictory, incomplete, or assumes preconditions that don't hold in the project (e.g., missing test framework, missing build tooling, missing dev dependency). Two remediations depending on shape:
     - **Rewrite the PRD in place** when the fix lives inside the same task — clarify wording, fix a contradiction, or fold a small bit of setup into the task. Use `@plan-ops` **UPDATE_TASK**, then `POST_COMMENT` with "**[Planner]** Changes needed: [what changed in PRD]", then `RELABEL` to `todo`.
     - **Add a prerequisite task** when the missing scaffolding is substantial enough to deserve its own task (installing and configuring a test framework, adding a CI pipeline, setting up a dev-tooling dependency). This needs planning work, not a quick fix — track via `node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"` and tell the user "Needs `/start` to plan the prerequisite task before this one can proceed."
   - **Spec issue** → The underlying spec is missing, wrong, or contradictory. "This needs PM. Run `/ask pm` to escalate." Track the issue so `/ask pm` sees it and clears it when the escalation is created:
     ```bash
     node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
     ```
   - **UI definition issue** → The `cowmoo/design/` file is missing a screen or a state that the builder's observation revealed. "This needs UXUI. Run `/ask uxui` to escalate." Track the issue so `/ask uxui` sees it and clears it when the escalation is created:
     ```bash
     node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
     ```

**Examples of routing:**
- RETURN says "PRD requires loading state but no loading screen in cowmoo/design/domains/billing.md" → UI definition issue → `/ask uxui`
- RETURN says "spec for Order lists 3 statuses but PRD says 4" → Spec issue → `/ask pm`
- RETURN says "PRD says field X, acceptance criterion says field Y" → PRD clarity issue → rewrite PRD in place
- RETURN says "Cannot start — no test framework in project; PRD assumes vitest is set up but package.json shows none" → PRD clarity issue (preconditions don't hold) → if installing vitest is small enough to fold into this PRD, use UPDATE_TASK; if it's a real setup task, track for `/start` to add a prereq

**Don't diagnose across boundaries yourself.** If you escalate via `/ask`, state what was observed (fact) — don't tell the recipient what to do. They own the remediation.

### UI definition update
Changes were committed to `cowmoo/design/` files that active task PRDs may consume.
1. Read the message — which design files changed, which tasks may be affected
2. Check: do any open `todo` or `in-progress` tasks reference the changed design files or screens?
3. If yes → update affected PRDs via `@plan-ops` **UPDATE_TASK** (refresh design references, screen states)
4. Respond and close the issue via `@plan-ops` **POST_COMMENT** + **CLOSE_ISSUE**

### UI response
A `for-uxui` message was processed and the response requires action (e.g., "not a real gap — task scope was wrong").
1. Read the message — what was found and which `for-uxui` issue triggered it
2. **Diagnose within your scope.** The message is observational; you decide what it means. Typical cases:
   - **Task scope was wrong** → rewrite the affected task PRD via `@plan-ops` **UPDATE_TASK**, relabel to `todo`
   - **The gap was confirmed as fake** → the triggering task can proceed as-is, update the PRD to remove the design dependency or clarify the state
3. Respond and close the issue via `@plan-ops` **POST_COMMENT** + **CLOSE_ISSUE**

### Other
The message didn't fit the five named categories — e.g., a builder out-of-scope notice, an answer to a prior `for-pm` escalation relabeled as `for-planner`, or a manually-created `for-planner` issue. Never guess the category and run a wrong handler — the silent-close handlers (spec update, UI update, UI response) would lose real work.
1. Read the full body and comments aloud to the user: "This message doesn't match the standard message types. Here's what it says: [...]"
2. **Render the routing choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix; each option's `description` carries the consequence in planning terms. Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker. Typical options:
   - **Identify as a named type** — re-route to the matching handler (Spec update / Deviation report / Blocked task / UI definition update / UI response). Pick the type after asking the user.
   - **Track for later planning** — substantial item that needs `/start` work. Adds to the inbox via `node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"`.
   - **Close as noise** — no action needed. `@plan-ops` **POST_COMMENT** + **CLOSE_ISSUE** with the user's wording.
3. Never auto-close or silently acknowledge an `other` message — the user confirms the resolution.

---

## Step 4: Track Complex Items

If a message can't be quick-fixed and needs planning work:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
```

This is read by `/publish` (to resolve tracked issues when shipping) and `/ask` (to link related messages and clear the entry after escalation). Full context (type, summary) lives in conversation — only `number\ttitle` persists across sessions.

---

## Step 5: Report

```
## Caught Up

**Resolved:**
- #NN — [summary] — closed
- #NN — [summary] — PRD updated, relabeled to todo

**Tracked for planning:**
- #NN — [summary] — needs /start to address

**Next:** [suggested action based on what remains]
```

---

## Completion Checklist

- [ ] All for-planner items loaded
- [ ] Each message presented with category and recommendation
- [ ] User confirmed each resolution
- [ ] Quick fixes executed (comments, closes, PRD updates)
- [ ] Complex items tracked via `node "$AGENT_DIR/tools/dev-tools.cjs" inbox add`
- [ ] Report presented with next action

---

## Rules

- **User decides** — present recommendation, let user confirm
- **One at a time** — process each message fully before moving to the next
- **Propagate changes** — when accepting a deviation, trace the impact to downstream PRDs
- **Don't rewrite from scratch on first rejection** — clarify and adjust. 3rd rejection = fundamental rewrite.
- **Quick-fix vs planning** — small PRD updates are quick-fixes. New story scope or strategy changes need `/start`.
- **Task closed directly (no `for-planner` label)** — clean completion, won't appear in this inbox. When `/start` or `@plan-reader` surfaces directly-closed tasks, read their Record comments and propagate any deviations to downstream PRDs.
