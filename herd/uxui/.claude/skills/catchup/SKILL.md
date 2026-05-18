---
name: catchup
description: Lean UXUI inbox gate — reconcile the board, scan for pending uxui:review tasks and for-uxui messages, report counts; hand off to /process-inbox when there is work.
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash, Read, Skill
---

# Catch Up

The lean gate for the UXUI inbox. It does the cheap, always-safe work — reconcile the board, scan for pending items, report what is waiting — and nothing else. If the inbox is empty you are done, having loaded only this short skill. If there is work, it hands off to `/process-inbox`, which presents and routes.

Two kinds of inbox item:
- **Review tasks** (`uxui:review`) — cards in the "UX: Review" board column.
- **Agent messages** (`for-uxui`) — spec updates, UI gaps, UI questions from PM or planner.

---

## Step 1: Reconcile the board

A human dragging a card on the project board is the authority on its status — the label follows the column. Reconcile any drift first, before anything reads labels:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" board-reconcile
```

Read every line of its output:

- `RECONCILE: aligned #<n> <old> → <new> ("<column>")` — a drag was mechanically aligned; the label now matches the board. No action needed.
- `RECONCILE: flag #<n> …` — a drag that **cannot** be aligned mechanically: a card dragged into "Done" (that needs a real approval, not a relabel), a cross-domain drag, or a card carrying multiple UXUI labels. **Surface every flag line to the user** — these are likely mistakes or need a deliberate skill. Never act on a flag automatically.
- `RECONCILE: ok` — nothing drifted. `RECONCILE: no board` — no project board; continue.

## Step 2: Scan the inbox

Query both kinds — `for-uxui` messages, and a structured scan of every `uxui:review` task:

```bash
gh issue list --label "for-uxui" --state open --json number,title,body,labels --limit 20
node "$AGENT_DIR/tools/dev-tools.cjs" review-scan
```

`review-scan` returns a JSON array — one object per open `uxui:review` issue: `{number, title, labels, hasShareUrl, shareUrl, comments}`. `comments` is the card's full comment thread; `hasShareUrl` reflects a Claude Design URL anywhere in it. One call; it saves a per-issue `gh issue view` for every card. Classify each card: `hasShareUrl: true` → **bundle**, `hasShareUrl: false` → **no-bundle** (a card moved to "UX: Review" with comments that are not a submission).

## Step 3: Report and gate

Report what is waiting:

```
## Inbox — <N> review task(s) · <M> message(s)
  Review tasks: <X> bundle, <Y> no-bundle
  Messages: <M> for-uxui
<any RECONCILE: flag lines from Step 1>
```

- **If N + M == 0** — report "Inbox empty — nothing to catch up on." (still surface any reconcile flags). Stop. You are done.
- **If there is work** — invoke **`/process-inbox`** to present the inbox in full and route each item. `/process-inbox` runs in this same conversation, so the `review-scan` JSON, the `for-uxui` list, and the bundle/no-bundle classifications above are already in its context — it does not re-scan.

---

## Rules

- **`board-reconcile` runs first, always.** The board is the human's intent; labels are reconciled to it before anything else reads them.
- **Reconcile flags are surfaced, never auto-actioned.** A flagged drag is a human decision — show it, let the user choose.
- **This skill gates; it never routes or resolves.** Presenting the inbox and dispatching items is `/process-inbox`'s job — keep this skill lean so an empty check stays cheap.
