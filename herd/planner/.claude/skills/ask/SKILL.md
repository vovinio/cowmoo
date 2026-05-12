---
name: ask
description: Create a for-pm (spec issues) or for-uxui (UI definition issues) GitHub issue. Usage: /ask pm or /ask uxui.
user-invocable: true
disable-model-invocation: true
argument-hint: <pm | uxui>
allowed-tools: Agent, Read, Glob, Bash, AskUserQuestion
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

The target determines which label and which `@plan-ops` operation to use.

---

## Step 2: Check Context

```bash
node tools/dev-tools.cjs inbox list
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

Preview the message. List questions clearly:

```
## Message preview

<describe what was observed and its context>

**Questions:**
- <specific question 1>
- <specific question 2>

Send this? (adjust / approve)
```

### `for-uxui` message

Your message should include:
- Which `cowmoo/design/` file is affected
- What was observed — fact, not diagnosis. Don't prescribe a fix — report what was observed.
- Specific questions (if clarification needed)
- Which task or story is affected

Preview the message:

```
## Message preview

<describe what was observed>

Send this? (adjust / approve)
```

**Wait for user approval** (both targets).

---

## Step 4: Create GitHub Issue

### `for-pm`

Spawn `@plan-ops` with **CREATE_FOR_PM**:
- Title: `[Planner] <summary>`
- Body: the composed message

### `for-uxui`

Spawn `@plan-ops` with **CREATE_FOR_UXUI**:
- Title: `[Planner] <summary>`
- Body: the composed message

### In both cases

If the current session is responding to one or more inbox-tracked issues (check `inbox list` from Step 2), present each to the user:

- "Tracked issue #N: [title]. Is this escalation addressing it?"
- For each confirmed:
  1. Spawn `@plan-ops` with **POST_COMMENT** on the tracked issue, linking to the new escalation (e.g., "**[Planner]** Escalated to #<new-number> — <PM|UXUI> will respond as a new `for-planner` issue when resolved.").
  2. Spawn `@plan-ops` with **CLOSE_ISSUE** on the tracked issue — the escalation issue now owns the lifecycle; the eventual answer arrives as a new `for-planner` message.
  3. Remove the tracked issue from the inbox:
     ```bash
     node tools/dev-tools.cjs inbox remove <tracked-number>
     ```
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
- [ ] Inbox context checked (`node tools/dev-tools.cjs inbox list`)
- [ ] Message includes necessary content for the target
- [ ] Observations are factual, not prescriptive
- [ ] User approved the message
- [ ] GitHub issue created via @plan-ops (CREATE_FOR_PM or CREATE_FOR_UXUI)
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
