---
name: catchup
description: Triage pending for-pm issues from GitHub — quick-resolve or transition into a working session.
user-invocable: true
disable-model-invocation: false
allowed-tools: Agent, Read, Glob, Bash, Edit, Write, AskUserQuestion
---

# Catch Up

Triage pending for-pm GitHub issues. Quick questions get resolved here. Issues that need spec work transition into a discussion session.

---

## Step 1: Load Inbox

### 1a. Detect board card-moves (board → label)

A human can route an issue to PM by dragging its card into the "PM" column. Detect those drags first and re-sync the label, so `@inbox-reader` sees them:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" board-drags "PM" for-pm
```

This prints one `<number><TAB><current-labels>` line per card a human dragged into the "PM" column (cards there not already labelled `for-pm`) — or `Board: no board` (then skip this sub-step).

For each dragged card, build a RELABEL op entry. Collect all of them into one array and write it to the handoff file:

```json
[
  { "op": "RELABEL", "issue": <n>, "removeLabel": ["<routing-label>", ...], "addLabel": "for-pm" }
]
```

The `board-drags` line's second field is a comma-separated list of the card's current labels. Build `removeLabel` as a JSON array of the **column-routing labels** in that list — the labels that map to a board column (`story`, `todo`, `in-progress`, `for-planner`, `for-uxui`, and any `uxui:*` label) — and leave any non-routing labels (priority, type, etc.) untouched. `issue-transition` accepts `removeLabel` as a string or an array and skips any label not actually on the issue; if the line carries only one routing label, the array has one element. Write this array to `cowmoo/agent-files/pm/.op-handoff.json` with the Write tool, then run one `issue-transition` command per entry, in index order:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/pm/.op-handoff.json --index <i>
```

Run `--index 0` first, read its stdout, then `--index 1`, and so on through `--index N-1`. Each prints one report — `RELABEL #<n>: ✓ ...` (exit 0) or `RELABEL #<n>: ✗ <reason>` (exit 1). **If one reports `✗`, stop — do not run the remaining indices** — and surface which RELABEL failed; the dragged cards past that point stay out of sync until the next `/catchup`. Do this whole sub-step before spawning `@inbox-reader` below.

### 1b. Load the inbox

Spawn `@inbox-reader` with operation **GET_INBOX**.

If inbox is empty — report "No for-pm issues." and stop.

---

## Step 2: Present All Issues

Show the full inbox with category and origin:

```
## Inbox — [N] Issues

1. #<number> — <title> → **<quick question | spec change needed>** (from <planner | uxui | unknown>)
   <one-line summary>

2. #<number> — <title> → **<category>** (from <origin>)
   <one-line summary>
```

**Render the issue-selection choice via `AskUserQuestion`** with `multiSelect: true`, per CLAUDE.md item 3's picker rule. Each option is one issue (`#N — title → category (from origin)`); the user picks the issues to handle in this pass. Recommend the highest-priority issue (quick questions before spec-change-needed, oldest first within a category); each option's `description` carries the one-line summary.

If the inbox has only 1 issue, still render a confirmation picker — `Handle #N — <title>` (Recommended) / `Skip for now` — so the user selects rather than typing.

---

## Step 3: Process Each Issue

Process each picked issue in order — handle by category, fully resolving each before moving to the next (per the "One at a time" rule below). The category determines how PM handles the issue; the **origin** (from `@inbox-reader`'s output in Step 1) determines where the answer routes back when resolving — see the routing rule below.

### Routing rule (applies to every inline resolution)

When resolving an issue via a `RESOLVE_ISSUE` op, pick the action and target from origin:

- origin `planner` → action **transfer**, transfer-target **planner** (relabels `for-pm` → `for-planner` so planner's `/catchup` picks up the answer)
- origin `uxui` → action **transfer**, transfer-target **uxui** (relabels `for-pm` → `for-uxui` so UXUI's `/catchup` picks up the answer)
- origin `unknown` → action **close** (human-filed; no automated round-trip)

### Invoking RESOLVE_ISSUE (handoff mechanics)

The skill composes the resolution comment and writes the handoff file. For each issue being resolved, build a RESOLVE_ISSUE entry with the comment prefixed `**[PM]** `:

- **close** (origin `unknown`): `{ "op": "RESOLVE_ISSUE", "issue": <n>, "comment": "**[PM]** Resolved: <summary>", "close": true }`
- **transfer** (origin `planner`/`uxui`): `{ "op": "RESOLVE_ISSUE", "issue": <n>, "comment": "**[PM]** Resolved: <summary>", "removeLabel": "for-pm", "addLabel": "for-<planner|uxui>" }`

Write the entry (or entries) as a JSON array to `cowmoo/agent-files/pm/.op-handoff.json` with the Write tool, then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/pm/.op-handoff.json --index <i>
```

The `issue-transition` command runs comment → relabel/close in order, verifies each step with one retry, and syncs the board. Read its stdout — `RESOLVE_ISSUE #<n>: ✓ ...` (exit 0) means resolved; `RESOLVE_ISSUE #<n>: ✗ <reason>` (exit 1) means a step failed (the report names what already succeeded so a retry doesn't double-post). Because issues are processed one at a time (see the "One at a time" rule), each resolution is normally a single-entry array at `--index 0` — the file is overwritten per resolution.

### Quick Question
1. Read the full issue context from @inbox-reader's response
2. Present your understanding of the question
3. Propose an answer — with specifics, not vague responses
4. Discuss with user until the answer is settled
5. Render an `AskUserQuestion` confirmation gate before writing — the user selects, never types "yes". Three options: `Resolve & route` (Recommended) — *posts the resolution comment and closes or transfers the issue per the Routing rule*; `Edit the answer` — *the user revises the resolution wording; ask what to change, then re-present this gate*; `Cancel` — *leaves the issue untouched*.
6. On `Resolve & route`: write the handoff file and run the **RESOLVE_ISSUE** op per the **Invoking RESOLVE_ISSUE** mechanics above — issue number, resolution summary, action and transfer-target per the **Routing rule** above. On `Edit the answer`, take the revision and re-present the gate. On `Cancel`, leave the issue and move to the next picked issue.

### Spec Change Needed
1. Read the full issue context
2. Present the problem — what's being flagged, which specs are affected
3. Assess scope:
   - **Small fix** (typo in spec, missing edge case, clarification) — resolve inline. Read the relevant spec file, discuss the change with user, apply the fix, self-verify. Then write the handoff file and run the **RESOLVE_ISSUE** op per the **Invoking RESOLVE_ISSUE** mechanics above — action and transfer-target per the **Routing rule** above.
   - **Needs discussion** — "This needs a deeper discussion session. I'll load the context so we can work on it." Transition to discussion mode (see below). The eventual answer ships via `/notify`, which closes the original tracked issue with a link to the new announcement.

---

## Step 4: Transition to Discussion (when needed)

When an issue needs real spec work:

1. Tell the user: "Issue #N needs spec work. Transitioning to a discussion session about [topic]."
2. Track the issue for later resolution:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
   ```
3. Read the relevant spec files and working notes for context
4. The conversation continues as a normal discussion about that topic
5. The user will run `/draft` → `/digest` → `/review` → `/publish` → `/notify` as normal
6. `/notify` will check tracked inbox issues and offer to resolve this one

**Do not close or transfer the issue** — it stays open until `/notify` resolves it after the spec work is committed.

Stop the catchup process here. Remaining inbox issues can be processed in a future `/catchup` run.

---

## Step 5: Report (when all issues resolved in triage)

If all issues were quick-resolved without needing a discussion session, state the outcome as a prose stamp:

```
## Inbox Processed

- [N] issues resolved
  - #<number>: <resolution summary> — <closed | transferred>
- Spec files changed: <list, or "none">
```

Then render an `AskUserQuestion` hand-off picker of concrete next actions — never close on a prose "Next:" line. Build the options from context: if spec files were changed, lead with `/publish` `(Recommended)` — *saves the spec changes and pushes to the remote* — followed by other live continuations (e.g. `/notify` to announce downstream once published); if no spec files changed, offer the live continuations directly. Always end with `Done for now` last. Each option's `description` names what it leads to.

---

## Completion Checklist

Before finishing, confirm:

- [ ] All issues presented to user with categories
- [ ] Each processed issue: discussed, resolved, confirmed by user
- [ ] Quick resolutions: RESOLVE_ISSUE run via `dev-tools.cjs issue-transition` (verified)
- [ ] Spec changes (if any): self-verified after edit
- [ ] Issues needing work: transitioned to discussion mode, issue left open
- [ ] Report presented (or discussion session started)

---

## Rules

- **Triage, don't force** — if an issue needs discussion, transition. Don't try to resolve complex spec problems inline.
- **User decides** — present your recommendation; the user confirms or redirects through the picker, never an assumed yes
- **One at a time** — process each issue fully before moving to the next
- **Quick resolve = comment + close/transfer** — always through `dev-tools.cjs issue-transition` with verification
- **Needs work = discussion session** — stop catchup, start discussion, let /notify close the loop
- **Always prefix comments** with `**[PM]** ` — the skill composes the prefix into the handoff entry's `comment`
- **Conflicting for-pm issues** — if two planner questions touch the same domain, resolve them together before responding separately. Handling them in isolation risks contradictory spec answers.
- **For-pm issue references a spec you just changed** — check if the question is already answered by the change. If so, respond with the update rather than re-discussing.
- **Inbox issue requires extended discussion** — the issue number is tracked in `.inbox-context` (see Step 4). Complete the discussion, then use `/notify` to announce the spec update and resolve tracked issues.
