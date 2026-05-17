---
name: catchup
description: Triage pending for-pm issues from GitHub — quick-resolve or transition into a working session.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Glob, Bash, Edit, Write
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

This prints one `<number><TAB><current-labels>` line per card a human dragged into the "PM" column (cards there not already labelled `for-pm`) — or `Board: no board` (then skip this sub-step). For each, spawn `@pm-ops` **RELABEL** — remove its current label (taken from the `board-drags` line), add `for-pm`. Do this before spawning `@inbox-reader` below.

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

**Render the issue-selection choice via `AskUserQuestion`** with `multiSelect: true`. Each option is one issue (`#N — title → category (from origin)`); the user picks the issues to handle in this pass. Recommended option first with `(Recommended)` suffix — pick the highest-priority issue (quick questions before spec-change-needed, oldest first within a category) as the recommendation; each option's `description` carries the one-line summary. Per CLAUDE.md's picker rule (the `/catchup triage` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

If the inbox has only 1 issue, skip the picker and prose-confirm: "Handle #N — <title>?" — a 1-option picker is degenerate.

---

## Step 3: Process Each Issue

Process each picked issue in order — handle by category, fully resolving each before moving to the next (per the "One at a time" rule below). The category determines how PM handles the issue; the **origin** (from `@inbox-reader`'s output in Step 1) determines where the answer routes back when resolving — see the routing rule below.

### Routing rule (applies to every inline resolution)

When spawning `@pm-ops RESOLVE_ISSUE`, pick the action and target from origin:

- origin `planner` → action **transfer**, transfer-target **planner** (relabels `for-pm` → `for-planner` so planner's `/catchup` picks up the answer)
- origin `uxui` → action **transfer**, transfer-target **uxui** (relabels `for-pm` → `for-uxui` so UXUI's `/catchup` picks up the answer)
- origin `unknown` → action **close** (human-filed; no automated round-trip)

### Quick Question
1. Read the full issue context from @inbox-reader's response
2. Present your understanding of the question
3. Propose an answer — with specifics, not vague responses
4. Discuss with user until resolved
5. On confirmation: spawn `@pm-ops` with operation **RESOLVE_ISSUE** — issue number, resolution summary, action and transfer-target per the **Routing rule** above.

### Spec Change Needed
1. Read the full issue context
2. Present the problem — what's being flagged, which specs are affected
3. Assess scope:
   - **Small fix** (typo in spec, missing edge case, clarification) — resolve inline. Read the relevant spec file, discuss the change with user, apply the fix, self-verify. Then spawn `@pm-ops` with **RESOLVE_ISSUE** — action and transfer-target per the **Routing rule** above.
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

If all issues were quick-resolved without needing a discussion session:

```
## Inbox Processed

- [N] issues resolved
  - #<number>: <resolution summary> — <closed | transferred>
- Spec files changed: <list, or "none">

<If spec files were changed:>
**Next:** Run /publish to save changes, then /notify to announce downstream.
```

---

## Completion Checklist

Before finishing, confirm:

- [ ] All issues presented to user with categories
- [ ] Each processed issue: discussed, resolved, confirmed by user
- [ ] Quick resolutions: @pm-ops executed RESOLVE_ISSUE (verified)
- [ ] Spec changes (if any): self-verified after edit
- [ ] Issues needing work: transitioned to discussion mode, issue left open
- [ ] Report presented (or discussion session started)

---

## Rules

- **Triage, don't force** — if an issue needs discussion, transition. Don't try to resolve complex spec problems inline.
- **User decides** — present your recommendation, let the user confirm or adjust
- **One at a time** — process each issue fully before moving to the next
- **Quick resolve = comment + close/transfer** — always through @pm-ops with verification
- **Needs work = discussion session** — stop catchup, start discussion, let /notify close the loop
- **Always prefix comments** with `**[PM]**` (handled by @pm-ops)
- **Conflicting for-pm issues** — if two planner questions touch the same domain, resolve them together before responding separately. Handling them in isolation risks contradictory spec answers.
- **For-pm issue references a spec you just changed** — check if the question is already answered by the change. If so, respond with the update rather than re-discussing.
- **Inbox issue requires extended discussion** — the issue number is tracked in `.inbox-context` (see Step 4). Complete the discussion, then use `/notify` to announce the spec update and resolve tracked issues.
