---
name: process-message
description: Process one for-uxui agent message — a spec update, UI gap, or UI question from PM or planner. Read it, route it, resolve or track it.
argument-hint: <issue-number>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
---

# Process Message

Handle one `for-uxui` agent message — an incoming issue from PM or planner. Invoked by `/process-inbox` (one invocation per message), or directly: `/process-message <issue>`.

---

## Step 1: Read and route the message

Read the issue body to understand what's being communicated. Route based on the sender and content.

**Two flavors of `for-uxui`:**
- **Fresh issue** — the sender created a new `for-uxui` issue (e.g., PM's `/notify uxui` announcing spec changes; planner's `/ask uxui` reporting a UI definition problem). Title prefix shows the sender (`[PM]`, `[Planner]`).
- **Relabeled answer** — PM resolved a UXUI-originated `for-pm` by relabeling it `for-uxui` (PM's `/catchup` resolved it with a `transfer` relabel to `uxui`). The issue body is the original UXUI question; PM's answer is in the most recent comment. The title still has UXUI's `[UXUI]` prefix from the original `/ask pm`.

The three handlers below cover both flavors. Relabeled answers most often map to **Spec update** (PM's answer clarifies a spec) or **UI question** (PM's answer is the clarification you asked for, no further work needed). Read the latest comment thread before picking a handler.

### Spec update

Specs were updated. Read the message to understand what changed:

1. Read the relevant cowmoo/design/ domain file
2. Read the updated spec files referenced in the message
3. Assess impact: do existing UI definitions need updating? **You own this diagnosis** — the change is reported as fact, you decide whether UI needs updating.
4. **Small fix** (quick update, no cross-screen impact) → discuss the changes with the user, then **render a confirmation picker via `AskUserQuestion`** before writing: `Apply the update` `(Recommended)` (description: the concrete cowmoo/design/ edit to be made) / `Adjust the change` (description: revise before writing — leads to a free-text follow-up, then re-present) / `Cancel` (description: leave the UI definition unchanged). On `Apply`, update cowmoo/design/ files, self-verify, then close the issue via the `issue-transition` RESOLVE_ISSUE command (see "Resolving via RESOLVE_ISSUE" below). On `Adjust`, ask what to change, revise, re-present the picker.
5. **Extended work** (multi-screen redesign, spans sessions) → track the issue for later resolution and transition to discussion mode:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
   ```
   Do NOT close the issue. The user will run `/draft` → `/define` → `/publish` → `/notify planner` in normal flow; `/notify` will see the tracked issue and close it.

### UI gap

A task needs a UI state or definition that isn't in `cowmoo/design/` files.

1. Read the message — which screen, which state or definition is missing
2. **Diagnose:** is this a real gap (missed during extraction) or a misunderstanding (the task scope was wrong, or the screen doesn't need that state)?
3. **Real gap** → **render a confirmation picker via `AskUserQuestion`** before writing: `Add the missing <state | definition>` `(Recommended)` (description: the concrete addition to `cowmoo/design/domains/<domain>.md`) / `Adjust the change` (description: revise before writing — leads to a free-text follow-up, then re-present) / `Cancel` (description: leave the UI definition unchanged). On `Apply`, add the missing state/definition to `cowmoo/design/domains/*.md`, self-verify, then either:
   - Quick update (one screen, one state) → run `/publish`, then close the issue via the `issue-transition` RESOLVE_ISSUE command (see "Resolving via RESOLVE_ISSUE" below).
   - Extended update (multi-screen, spans sessions) → track the issue for later:
     ```bash
     node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
     ```
     Do NOT close. `/notify planner` later closes it after `/publish`.
4. **Misunderstanding** (task scope is wrong) → UXUI's response requires planner action, not a cowmoo/design/ file change. Track the issue for later:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
   ```
   The user will run `/ask planner` to send a response with the finding. `/ask` will see the tracked issue and close it as part of sending the response.

### UI question

Clarification about an existing UI definition.

1. Read the question
2. Answer inline — reference the cowmoo/design/ file and explain
3. If the question reveals a documentation gap in cowmoo/design/, fix it
4. Close the issue via the `issue-transition` RESOLVE_ISSUE command with the answer (see "Resolving via RESOLVE_ISSUE" below)

---

## Resolving via RESOLVE_ISSUE

The `issue-transition` command reads its parameters from a JSON handoff file. To close a `for-uxui` issue: compose the resolution summary, prefix it with the `**[UXUI]** ` identity marker, **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use), then run the command at `--index 0`:

```json
[
  { "op": "RESOLVE_ISSUE", "issue": <number>, "comment": "**[UXUI]** Resolved: <summary>", "close": true }
]
```

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

The command runs comment → close in order, verifies each step with one retry, and syncs the board. RESOLVE_ISSUE always closes the issue. Read the command's stdout and key on the `✓` / `✗` marker (`RESOLVE_ISSUE #<n>: ✓ …` / `✗ <reason>`). Do NOT retry on `✗` — the command already retried internally.

---

## Step 2: Report

```
## Message processed — #<issue>

- <resolution> — closed
  OR
- <summary> — tracked for extended work; will be closed by `/notify` or `/ask` after the response ships
```

After the report, close with an `AskUserQuestion` hand-off picker — never end on a prose "Next:" line. Build the options from what this message resolved:
- If cowmoo/design/ files changed → `Run /publish` `(Recommended)` (description: commit and push the cowmoo/design/ changes) / `Run /notify planner` (description: announce the changes and close tracked items) / `Done for now`.
- If a UI gap was diagnosed as task-scope-wrong → `Run /ask planner` `(Recommended)` (description: send the response and close the tracked item) / `Done for now`.
- If the message was answered inline with no file change → `Done for now` `(Recommended)` (description: nothing further — the issue is closed) and any other live continuation.

Omit options that don't apply this run.

---

## Rules

- **Close through the `issue-transition` command** — never close issues with hand-rolled `gh` calls.
- **Spec updates may cascade** — a spec change might affect multiple screens. Check all related UI definitions.
- **Conflicting messages** — when this catchup pass handles multiple `for-uxui` issues touching the same domain, reconcile your updates with the ones already handled this pass (they are in the conversation above). Contradictory UI updates are the failure mode.
- **UI work reveals a spec gap** — don't guess at missing business logic. Track the issue and route to `/ask pm` with specific questions.
- **You own the diagnosis** — a message reports a change or a gap as fact; you decide whether and how UI definitions must change.
