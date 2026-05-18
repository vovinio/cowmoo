---
name: process-inbox
description: Present the pending UXUI inbox and route each item — uxui:review bundles to /review-bundle, no-bundle review tasks to /resolve-review, for-uxui messages to /process-message.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, AskUserQuestion, Skill
---

# Process Inbox

Present the pending UXUI inbox and route each item the user picks to its resolution skill. Invoked by `/catchup` once it has found work.

**Inbox data.** `/catchup` already ran `board-reconcile`, `review-scan`, and the `for-uxui` query — those results are in this conversation, already classified bundle vs no-bundle. Use them; do not re-scan. Only if you were invoked **directly** (the user typed `/process-inbox`) and no scan is in context, run it yourself first:

```bash
gh issue list --label "for-uxui" --state open --json number,title,body,labels --limit 20
node "$AGENT_DIR/tools/dev-tools.cjs" review-scan
```

---

## Step 1: Present the inbox

Show all items, grouped by kind and — for review tasks — by classification:

```
## Inbox — [N] Items

**Bundle submissions (uxui:review)** — dispatched to /review-bundle:
1. #<number> — <title>

**No-bundle review tasks (uxui:review)** — dispatched to /resolve-review:
2. #<number> — <title>
   <one-line read of the latest comment>

**Agent messages (for-uxui)** — dispatched to /process-message:
3. #<number> — <title> → **<type>**
   <one-line summary>
4. ...
```

Omit a group when it has no members. Review tasks take priority — they block the design pipeline.

**Render the inbox-selection choice via `AskUserQuestion`** with `multiSelect: true`, per CLAUDE.md item 3's picker rule. Each option is one inbox item (`#N — title → <bundle submission | no-bundle review task | agent message: type> (from <origin>)`); the user picks the items to handle in this pass. Recommend the highest-priority item by this order — bundle submissions, then no-bundle review tasks, then `for-uxui` agent messages; within each kind, oldest first.

If the inbox has only 1 item, **render a confirmation picker via `AskUserQuestion`**: `Handle #N — <title>` `(Recommended)` (description: the one-line summary of the item and where it routes) / `Skip for now` (description: leave it in the inbox — re-run /catchup later to revisit).

---

## Step 2: Route the picked items

For each item the user picked, process in priority order: `uxui:review` review tasks first (they block the design pipeline), then `for-uxui` messages. Route by kind:

- **Bundle submission** (`uxui:review`, `hasShareUrl: true`) → **invoke `/review-bundle <number>`**. It fetches the bundle, evaluates it via `@design-evaluator`, triages, and on approval hands off to `/approve-design`.
- **No-bundle review task** (`uxui:review`, `hasShareUrl: false`) → **invoke `/resolve-review <number>`**. It treats the comments and resolves the task — close as no-longer-needed, send back to `uxui:todo`, or fix a UI definition.
- **Agent message** (`for-uxui`) → **invoke `/process-message <number>`**. It reads the message and routes it (spec update / UI gap / UI question).

All three resolution skills are model-invocable — dispatch by invoking them, **one item at a time** (let each finish before the next). If the user would rather run them separately, hand them the list of `/<skill> <n>` commands.

---

## Step 3: Report

```
## Inbox Processed

- [N] bundle submissions → /review-bundle
  - #<number>: <title>
- [N] no-bundle review tasks → /resolve-review
  - #<number>: <title>
- [N] agent messages → /process-message
  - #<number>: <title>
```

After the report, close with an `AskUserQuestion` hand-off picker — never end on a prose "Next:" line. Build the options from context: `Run /catchup again` `(Recommended)` (description: revisit the inbox — offer when items were left unpicked this pass) / `Done for now` (description: stop here; anything not picked stays in the inbox for next time). When every item was handled this pass, lead with `Done for now` `(Recommended)` instead and offer `Run /catchup again` as the verify-it's-empty option.

---

## Rules

- **One at a time** — dispatch and let each resolution skill finish before the next.
- **Route, never resolve.** This skill presents and dispatches; the resolution skills do the work. Never fetch a bundle, treat comments, or close an issue here.
- **User decides what to handle** — present the inbox, let the user pick; never process an item the user didn't choose.
- **Deduplicate if both labels coexist** — an issue carrying both `for-uxui` AND `uxui:review` is an upstream-flow bug. Route it as a review task (prioritize `uxui:review`) and flag it to the user.
