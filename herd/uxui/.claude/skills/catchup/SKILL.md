---
name: catchup
description: Walk through pending UXUI inbox — `for-uxui` agent messages (handled inline) and `uxui:review` designer submissions (dispatched to `/review-bundle`).
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Glob, Bash, Edit, Write, AskUserQuestion
---

# Catch Up

Process all pending UXUI inbox items in one sweep. Two kinds:
- **Agent messages** (`for-uxui`) — spec updates, UI gaps, UI questions. Handled inline by this skill.
- **Designer submissions** (`uxui:review`) — Claude Design bundles awaiting review. ALWAYS dispatched to `/review-bundle` — never handled inline here.

You pick what to handle next.

---

## Step 1: Load Inbox

### 1a. Detect designer card-moves (board → label)

A designer submits a finished task by posting the Claude Design share URL as an issue comment **and dragging the card from "UX: Todo" to "UX: Review"** on the project board. Detect those drags first and re-sync the label, so the card-moved submission shows up in the query below (and the statuslines stay correct):

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" board-drags "UX: Review" uxui:review
```

This prints one `<number><TAB><current-labels>` line per card sitting in "UX: Review" that is **not** yet labelled `uxui:review` — designer card-moves the herd hasn't picked up — or `Board: no board` (then skip this sub-step). For each, confirm it's a genuine submission — a posted share-URL comment — with a `--jq`-filtered read (the filter keeps the comment bodies out of context; you get only `true` / `false`):

```bash
gh issue view <number> --json comments --jq '[.comments[].body] | map(test("https?://")) | any'
```

- **`true`** → a genuine submission (the card-move is the designer's submission ritual; it replaces the old `uxui:review` label-flip). Spawn `@uxui-gh-ops RELABEL` — remove the card's current `uxui:*` label (taken from the `board-drags` line), add `uxui:review`.
- **`false`** → not a submission (designer mid-work, or a stray drag). Leave it; do not act.

### 1b. Query the inbox

Query both kinds in parallel:

```bash
gh issue list --label "for-uxui" --state open --json number,title,body,labels --limit 20
gh issue list --label "uxui:review" --state open --json number,title,body,labels --limit 20
```

If both lists are empty, report "Inbox empty — nothing to catch up on." and stop.

---

## Step 2: Present Inbox

Show all items, grouped by kind:

```
## Inbox — [N] Items

**Designer submissions (uxui:review)** — dispatched to /review-bundle:
1. #<number> — <title>

**Agent messages (for-uxui)** — handled inline:
2. #<number> — <title> → **<type>**
   <one-line summary>
3. ...
```

Designer submissions take priority — they block the design pipeline.

**Render the inbox-selection choice via `AskUserQuestion`** with `multiSelect: true`. Each option is one inbox item (`#N — title → <designer submission | agent message: type> (from <origin>)`); the user picks the items to handle in this pass. Recommended option first with `(Recommended)` suffix — pick the highest-priority item (any `uxui:review` designer submission before `for-uxui` agent messages, since submissions block the design pipeline; within each kind, oldest first) as the recommendation. Each option's `description` carries the one-line summary. Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

If the inbox has only 1 item, skip the picker and prose-confirm: "Handle #N — <title>?" — a 1-option picker is degenerate.

---

## Step 3: Route the picked items

For each item the user picked, process in priority order: `uxui:review` items first (designer submissions block the design pipeline, per Step 2), then `for-uxui` items. Check each item's label and route:

- If `uxui:review` → **dispatch to `/review-bundle <number>`**. Tell the user: "Dispatching #<number> to `/review-bundle`. Run that skill now to evaluate the bundle." Do NOT attempt to fetch, evaluate, or comment inline. The `/review-bundle` skill handles fetch + evaluate + approve/reject end-to-end. When multiple `uxui:review` items were picked, produce a list of `/review-bundle <number>` commands the user runs separately.
- If `for-uxui` → process inline using the routing below (Spec update / UI gap / UI question), one at a time.

---

## Step 4: Process Agent Messages (for-uxui only)

For each `for-uxui` message the user wants to handle, read the issue body to understand what's being communicated. Route based on the sender and content.

**Two flavors of `for-uxui`:**
- **Fresh issue** — sender created a new `for-uxui` issue (e.g., PM's `/notify uxui` announcing spec changes; planner's `/ask uxui` reporting a UI definition problem). Title prefix shows the sender (`[PM]`, `[Planner]`).
- **Relabeled answer** — PM resolved a UXUI-originated `for-pm` by relabeling it `for-uxui` (PM's `/catchup` `@pm-ops RESOLVE_ISSUE` action `transfer` target `uxui`). The issue body is the original UXUI question; PM's answer is in the most recent comment. The title still has UXUI's `[UXUI]` prefix from the original `/ask pm`.

The three handlers below cover both flavors. Relabeled answers most often map to **Spec update** (PM's answer clarifies a spec) or **UI question** (PM's answer is the clarification you asked for, no further work needed). Read the latest comment thread before picking a handler.

Route based on sender and content:

### Spec update

Specs were updated. Read the message to understand what changed:

1. Read the relevant cowmoo/design/ domain file
2. Read the updated spec files referenced in the message
3. Assess impact: do existing UI definitions need updating? **You own this diagnosis** — the change is reported as fact, you decide whether UI needs updating.
4. **Small fix** (quick update, no cross-screen impact) → discuss changes with user, update cowmoo/design/ files, self-verify, then close the issue via `@uxui-gh-ops RESOLVE_ISSUE`.
5. **Extended work** (multi-screen redesign, spans sessions) → track the issue for later resolution and transition to discussion mode:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" inbox add <number> "<title>"
   ```
   Do NOT close the issue. The user will run `/draft` → `/define` → `/publish` → `/notify planner` in normal flow; `/notify` will see the tracked issue and close it.

### UI gap

A task needs a UI state or definition that isn't in `cowmoo/design/` files.

1. Read the message — which screen, which state or definition is missing
2. **Diagnose:** is this a real gap (missed during extraction) or a misunderstanding (the task scope was wrong, or the screen doesn't need that state)?
3. **Real gap** → add the missing state/definition to `cowmoo/design/domains/*.md`, self-verify, then either:
   - Quick update (one screen, one state) → run `/publish`, then close the issue via `@uxui-gh-ops RESOLVE_ISSUE`.
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
4. Close the issue via @uxui-gh-ops RESOLVE_ISSUE with the answer

---

## Step 5: Report

```
## Inbox Processed

- [N] designer submissions dispatched to /review-bundle
  - #<number>: <title>
- [N] agent messages resolved
  - #<number>: <resolution> — closed
- [N] agent messages tracked for extended work
  - #<number>: <summary> — will be closed by `/notify` or `/ask` after response ships

<If uxui:review items present:>
**Next:** Run /review-bundle <number> for each dispatched item.
<If cowmoo/design/ files changed:>
**Next:** Run /publish to commit and push changes, then /notify planner to announce and close tracked items.
<If a ui-gap was diagnosed as task-scope-wrong:>
**Next:** Run /ask planner to send the response and close the tracked item.
```

---

## Rules

- **One at a time** — process each item fully before moving to the next.
- **uxui:review always dispatches** — never review a bundle inline. `/review-bundle` is the only path; this skill only routes.
- **User decides** — present your recommendation, let the user confirm.
- **Close through @uxui-gh-ops** — never close issues directly.
- **Spec updates may cascade** — a spec change might affect multiple screens. Check all related UI definitions.
- **Conflicting for-uxui issues** — when multiple messages touch the same domain, process them together in one pass. Handling them in isolation risks contradictory UI updates.
- **UI work reveals a spec gap** — don't guess at missing business logic. Track the issue and route to `/ask pm` with specific questions.
- **Deduplicate if both labels somehow coexist** — an issue with both `for-uxui` AND `uxui:review` is a bug in the upstream flow. Process it as a designer submission (prioritize `uxui:review`) and flag it to the user.
