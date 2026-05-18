---
name: ask
description: Send a for-pm (spec gaps) or for-planner (response to a for-uxui message) issue. Closes tracked inbox items when the response ships.
user-invocable: true
disable-model-invocation: true
argument-hint: <pm | planner>
allowed-tools: Bash, Read, Glob, Agent, AskUserQuestion, Write
---

# Ask

Request action from another agent whose domain owns something UXUI can't fix:

- **PM** — for spec gaps, clarification questions, or contradictions found during design work (`for-pm` label)
- **Planner** — when UXUI processes a `for-uxui` message from the planner and the finding requires planner action (e.g., the task scope is wrong, not a real UI gap) (`for-planner` label)

Use when UXUI has a problem that can't be resolved without input from another agent, or when UXUI needs to respond to an incoming `for-uxui` message with a finding the planner must act on.

---

## Step 1: Determine Target

Parse the argument: `pm` or `planner`.

If no argument is provided, scan the session and propose:
- **Spec gap / spec question / spec issue** (what's missing from specs, business logic unclear) → PM.
- **Response to a tracked for-uxui inbox item** (planner asked about a ui-gap / ui-question and UXUI's finding requires planner action) → planner.

Check `node "$AGENT_DIR/tools/dev-tools.cjs" inbox list` — if there's an active tracked `for-uxui` item from the planner and the current session diagnosed it as "not a real gap / task scope wrong", `planner` is the natural target.

**Render the target choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix — pick PM when the discussion concerns a spec gap, contradiction, or business-logic question; pick planner when the session diagnosed a tracked `for-uxui` item and the response requires planner action. Each option's `description` carries the consequence ("creates a `for-pm` issue addressed to PM" vs "creates a `for-planner` issue responding to the tracked `for-uxui` item"). Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

The target determines which label and which handoff `op` to use.

---

## Step 2: Check Context

Check `$PROJECT_DIR/cowmoo/agent-files/uxui/.inbox-context` (via `node "$AGENT_DIR/tools/dev-tools.cjs" inbox list`) — we may be responding to an incoming message that led to this escalation. Note which tracked issue(s), if any, this ask will resolve.

---

## Step 3: Compose Message

### `for-pm` message

Your message should include:
- Which spec domain is affected
- What's wrong or missing, in product terms — not UI terms
- Specific questions that need answers
- What UI work is affected (which screens or flows are blocked)

Preview the message as a structured stamp — fielded, not free-prose. The fielded preview IS the body content; it gets posted to the GH issue verbatim (minus the chat-only `→ Send…` approval line and the `## Message preview` heading). Chat shows it for verification, not as a re-draft surface:

```
## Message preview → for-pm

Spec domain: <name>
Affected: <which screens or flows are blocked>
Observation: <one-line fact, product terms>
Context: <2–3 lines of background — omit if observation is self-explanatory>
Questions:
  - <specific question 1>
  - <specific question 2>

→ Send, or name a field to adjust?
```

### `for-planner` message

Respond to a `for-uxui` message when your finding requires action from the `for-planner` inbox (most commonly: the task scope was wrong).

Your message should include:
- The original `for-uxui` issue number being responded to
- What was observed when diagnosing the original message — fact, not prescription
- Which task or story is affected

Preview the message as a structured stamp. The fielded preview IS the body content; it gets posted to the GH issue verbatim:

```
## Message preview → for-planner

Responding to: #<original for-uxui issue number>
Affected: <task or story>
Observation: <one-line fact — what was found while diagnosing>
Context: <2–3 lines — omit if observation is self-explanatory>

→ Send, or name a field to adjust?
```

**Wait for user approval** (both targets). On "name a field to adjust", edit only that field and re-present the changed preview — don't re-show unchanged fields.

---

## Step 4: Create GitHub Issue

The `issue-create` command reads its issue body and title from a JSON handoff file you write first. Compose the entry, **Write** it as a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use), then run the command at `--index 0`.

### `for-pm`

Write the handoff array — the title carries the `[UXUI] ` identity prefix; the body is the composed message from Step 3 (the fielded preview verbatim, minus the chat-only `→ Send…` line and `## Message preview` heading):

```json
[
  { "op": "CREATE_FOR_PM", "title": "[UXUI] <summary>", "label": "for-pm", "body": "<composed message>" }
]
```

### `for-planner`

Write the handoff array — same shape, `for-planner` label:

```json
[
  { "op": "CREATE_FOR_PLANNER", "title": "[UXUI] <summary>", "label": "for-planner", "body": "<composed message>" }
]
```

### Run the command (both targets)

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

It owns the JSON-handoff parse, body-via-stdin create, title/label verify with one retry, and the non-blocking board sync. Read its one-line stdout — key on the `✓` / `✗` marker:

- `CREATE_FOR_PM: ✓ #<n> — …` / `CREATE_FOR_PLANNER: ✓ #<n> — …` — issue created and verified.
- `… ✗ <reason>` — create or verify failed. If a `#<number>` appears, the issue exists — do NOT re-run.

Do NOT retry on `✗` — the command already retried internally; a second run would risk a duplicate issue.

---

## Step 5: Resolve Tracked Inbox Items

If the current session is in response to a tracked `for-uxui` issue (check `node "$AGENT_DIR/tools/dev-tools.cjs" inbox list`), present each tracked item to the user:

- "Tracked issue #N: [title]. Did this `/ask` address it?"
- If yes → **Write** the handoff array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (overwriting Step 4's handoff — it's already been consumed), then run the `issue-transition` command at `--index 0`. Compose the resolution summary (a short note pointing at the new `for-planner` or `for-pm` issue) with the `**[UXUI]** ` identity prefix. RESOLVE_ISSUE always closes the issue:
  ```json
  [
    { "op": "RESOLVE_ISSUE", "issue": <number>, "comment": "**[UXUI]** Resolved: <summary>", "close": true }
  ]
  ```
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
  ```
  The command runs comment → close in order, verifies each step with one retry, and syncs the board. Read its stdout — `RESOLVE_ISSUE #<n>: ✓ …` means done; `RESOLVE_ISSUE #<n>: ✗ <reason>` means a step failed. Do NOT retry on `✗`.
- After resolving, remove from tracking: `node "$AGENT_DIR/tools/dev-tools.cjs" inbox remove <number>`.
- If no → leave tracked for future.

---

## Step 6: Report

```
## Sent

**Issue:** #NN — [title]
**Type:** [type]
**Inbox resolved:** <list of closed tracked items, or "none">
```

---

## Completion Checklist

- [ ] Target determined (pm or planner)
- [ ] Inbox context checked (`.inbox-context`)
- [ ] Message includes necessary content for the target
- [ ] Observations are factual, not prescriptive
- [ ] User approved the message
- [ ] GitHub issue created via `issue-create` (`CREATE_FOR_PM` or `CREATE_FOR_PLANNER`) — verified
- [ ] Tracked inbox items resolved if applicable — verified
- [ ] Report presented

---

## Rules

- **Observational, not prescriptive** — PROBLEM and OBSERVED state what was observed, not what the recipient should do.
- **Product terms, not UI terms** (PM target) — describe what's wrong in specs, not what's hard to design.
- **Don't diagnose across boundaries** (`for-planner` target) — if your finding is "task scope is wrong", report the observation. Let the planner decide whether to rewrite the PRD, split the task, or something else.
- **Be specific** — "the payment spec doesn't define refund workflow" not "the spec needs more detail"; "screen Invoice Detail has no loading state but PRD acceptance criteria require one" not "there's a UI gap".
- **Ask specific questions** — "can partial refunds happen? who initiates them?" not "clarify refunds".
- **User approves before sending** — the message represents UXUI's understanding; user should validate.
- **One target per invocation** — if both PM and planner need messages, run `/ask` twice with different targets.
