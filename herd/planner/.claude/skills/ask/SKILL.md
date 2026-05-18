---
name: ask
description: Create a for-pm (spec issues) or for-uxui (UI definition issues) GitHub issue. Usage: /ask pm or /ask uxui.
user-invocable: true
disable-model-invocation: false
argument-hint: <pm | uxui>
allowed-tools: Agent, Read, Write, Glob, Bash, AskUserQuestion
---

# Ask

Create a structured outgoing request to another agent whose domain owns something the planner can't fix. The planner can ask:
- **PM** — for spec gaps, spec questions, and spec contradictions (`for-pm` label)
- **UXUI** — for UI definition issues: missing UI states, UI questions (`for-uxui` label)

Use when the planner finds a problem that can't be resolved without input from another agent.

---

## Step 1: Determine Target

Parse the argument: `pm` or `uxui`.

If no argument is provided, **render the target choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix — pick PM when the discussion concerns a spec gap, contradiction, or business-logic question; pick UXUI when the discussion concerns a UI definition issue (missing screen state, question about a `cowmoo/design/` file). Each option's `description` carries the consequence ("creates a `for-pm` issue addressed to PM" vs "creates a `for-uxui` issue addressed to UXUI"). Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

The target determines which label and which `dev-tools.cjs` op to run.

---

## Step 2: Check Context

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" inbox list
```

If tracked issues exist, we may be responding to an incoming message (e.g., a builder RETURN) that led to this escalation. Note which tracked issue(s) this ask will resolve — they get cleared in Step 4 after the escalation is created.

---

## Step 3: Compose Message

### `for-pm` message

Your message should include:
- Which spec domain is affected
- What was observed, in product terms (not PRD terms) — fact, not diagnosis
- Specific questions that need answers
- What story or task is affected (so the recipient can assess urgency)

Preview the message as a structured stamp — fielded, not free-prose. The fielded preview IS the body content; it gets posted to the GH issue verbatim (minus the chat-only `→ Send…` approval line and the `## Message preview` heading). Chat shows it for verification, not as a re-draft surface:

```
## Message preview → for-pm

Spec domain: <name>
Affected: <story/task>
Observation: <one-line fact, product terms>
Context: <2–3 lines of background — omit if observation is self-explanatory>
Questions:
  - <specific question 1>
  - <specific question 2>

→ Send, or name a field to adjust?
```

### `for-uxui` message

Your message should include:
- Which `cowmoo/design/` file is affected
- What was observed — fact, not diagnosis. Don't prescribe a fix — report what was observed.
- Specific questions (if clarification needed)
- Which task or story is affected

Preview the message as a structured stamp. The fielded preview IS the body content; it gets posted to the GH issue verbatim (minus the chat-only `→ Send…` approval line and the `## Message preview` heading):

```
## Message preview → for-uxui

Design file: <path>
Affected: <story/task>
Observation: <one-line fact>
Context: <2–3 lines — omit if observation is self-explanatory>
Questions (if any):
  - <specific question 1>

→ Send, or name a field to adjust?
```

**Wait for user approval** (both targets). On "name a field to adjust", edit only that field and re-present the changed preview — don't re-show unchanged fields.

---

## Step 4: Create GitHub Issue

Ops are delegated through a JSON handoff file: the skill composes the title/body, writes the handoff array to `$PROJECT_DIR/cowmoo/agent-files/planner/.op-handoff.json` with the `Write` tool, then runs the matching `dev-tools.cjs` subcommand itself with the `Bash` tool, passing `--from` the handoff file and the `--index` of the entry. The handoff file is a single reused path — each run overwrites it. The subcommand prints exactly one report line; read its `✓`/`✗` marker and exit code to know what happened.

### `for-pm`

Write the handoff file with a single-element array:

```json
[
  { "op": "CREATE_FOR_PM", "title": "[Planner] <summary>", "label": "for-pm", "body": "<composed message>" }
]
```

Then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/planner/.op-handoff.json --index 0
```

A `CREATE_FOR_PM: ✓ #<n> — <title>. Label: for-pm. Board: <column>.` line means the issue was created, verified, and board-synced. A `CREATE_FOR_PM: ✗ <reason>` line means create or verify failed — if a `#<number>` appears, the issue exists, do NOT recreate it.

### `for-uxui`

Write the handoff file with a single-element array:

```json
[
  { "op": "CREATE_FOR_UXUI", "title": "[Planner] <summary>", "label": "for-uxui", "body": "<composed message>" }
]
```

Then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-create --from cowmoo/agent-files/planner/.op-handoff.json --index 0
```

A `CREATE_FOR_UXUI: ✓ #<n> — <title>. Label: for-uxui. Board: <column>.` line means the issue was created, verified, and board-synced. A `CREATE_FOR_UXUI: ✗ <reason>` line means create or verify failed — if a `#<number>` appears, the issue exists, do NOT recreate it.

The skill owns the identity prefix — the title MUST start with `[Planner] `; the `issue-create` command uses it verbatim.

### In both cases

If the current session is responding to one or more inbox-tracked issues (check `inbox list` from Step 2), present each to the user:

- "Tracked issue #N: [title]. Is this escalation addressing it?"
- For each confirmed: this is a two-op sequence — `POST_COMMENT` then `CLOSE_ISSUE` on the tracked issue. Overwrite the handoff file with a two-element array:
  ```json
  [
    { "op": "POST_COMMENT", "issue": <tracked-number>, "comment": "**[Planner]** Escalated to #<new-number> — <PM|UXUI> will respond as a new `for-planner` issue when resolved." },
    { "op": "CLOSE_ISSUE", "issue": <tracked-number>, "close": true }
  ]
  ```
  Then run the two ops in sequence — both are `issue-transition` ops:
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/planner/.op-handoff.json --index 0
  node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/planner/.op-handoff.json --index 1
  ```
  Run index 0 first; if its report starts with `✗`, stop and report the failure — do NOT run index 1. Only on `✓` proceed to index 1. The skill composes the `**[Planner]** ` comment prefix into the handoff entry — `dev-tools.cjs` does not add it. The `CLOSE_ISSUE` entry omits `comment` (the comment is posted by the separate `POST_COMMENT` op). After both reports come back `✓`, remove the tracked issue from the inbox:
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" inbox remove <tracked-number>
  ```
  Handle one tracked issue at a time — each gets its own handoff overwrite + the two-op run.
- For each declined: leave it tracked and open for a future `/publish` or `/ask`.

Each confirmed tracked issue is closed at escalation time — the escalation issue (`for-pm` or `for-uxui`) owns the next step, and the eventual answer returns as a new `for-planner` message that `/catchup` will process. Closing here keeps `gh issue list --label "for-planner" --state open` clean across sessions, preventing escalated-but-unresolved blockers from re-surfacing as ghost "blocked" items on every `/catchup`.

---

## Step 5: Report

```
## Sent

**Issue:** #NN — [title]
**Type:** [type]
**Inbox resolved:** [#NN, #NN, or "none tracked"]
**Inbox remaining:** [#NN, or "none"]
```

---

## Completion Checklist

- [ ] Target determined (pm or uxui)
- [ ] Inbox context checked (`node "$AGENT_DIR/tools/dev-tools.cjs" inbox list`)
- [ ] Message includes necessary content for the target
- [ ] Observations are factual, not prescriptive
- [ ] User approved the message
- [ ] GitHub issue created via `issue-create` (CREATE_FOR_PM or CREATE_FOR_UXUI)
- [ ] Tracked issues presented; each confirmed one linked, closed, and removed from inbox (if any)

---

## Rules

- **Observational, not prescriptive** — PROBLEM states what was observed, not what the recipient should do.
- **Talk about the PROBLEM, not the PRD** — recipients of `for-pm` messages care about specs; recipients of `for-uxui` messages care about UI definitions — neither cares about task implementation details.
- **Be specific** — "the payment spec doesn't define refund workflow" not "the spec needs more detail"; "cowmoo/design/domains/billing.md for Invoice Detail screen is missing the loading state" not "there's a problem with a screen definition"
- **Ask specific questions** — "can partial refunds happen? who initiates them?" not "clarify refunds"
- **User approves before sending** — the message represents the planner's understanding; user should validate
- **One target per invocation** — if both PM and UXUI need messages, run `/ask` twice with different targets
- **Don't diagnose across boundaries** — report the observation to the target and let them decide the fix.
