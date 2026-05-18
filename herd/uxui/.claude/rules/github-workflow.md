---
description: GitHub Issues workflow — identity and labels. Always loaded.
---

# UXUI GitHub Workflow

## Identity

Always prefix GitHub comments with `**[UXUI]**` and issue titles with `[UXUI]`.

## Labels

| Label | Meaning | Who sets it |
|-------|---------|-------------|
| `uxui:todo` | Design task ready for a human designer to pick up. Created via `/design-publish`. Returned here by `/review-bundle`'s reject path or `/resolve-review`'s send-back. | `/design-publish` (create), `/review-bundle` reject + `/resolve-review` send-back (return) |
| `uxui:review` | Card sits in the "UX: Review" board column — a task awaiting resolution. Usually a designer's Claude Design submission (a posted share URL); may also be a human card-move with other intent (cancelled, a question, mid-work notes). `/catchup` scans and classifies it (bundle vs no-bundle); `/process-inbox` dispatches it to `/review-bundle` or `/resolve-review`. | UXUI `/catchup` — syncs the label to **any** card moved into the "UX: Review" column, unconditionally (a direct `uxui:review` label-flip is still honored as a fallback) |
| `uxui:done` | Design task approved via `/approve-design`. Bundle attached to the relevant domain file. Issue is closed. Counts toward "what's been designed." A no-bundle task resolved as no-longer-needed is closed *without* this label — it was not designed. | `/approve-design` — replaces `uxui:review`, closes the issue |
| `for-uxui` | Incoming message from another agent (PM, planner) — spec update, UI gap, UI question, or PM answer to your `/ask pm` escalation (relabeled by PM from `for-pm` → `for-uxui`) | The sender's skill when creating the issue, OR PM's `/catchup` (a transfer relabel) when answering a UXUI-originated `for-pm` |
| `for-pm` | Outgoing message TO PM — spec gap, question, or issue found during UI work | UXUI via `/ask pm` |
| `for-planner` | Outgoing message — cowmoo/design/ changes announcement or response to a `for-uxui` message | UXUI via `/notify planner` or `/ask planner` |

**Designer-side convention (not agent-managed):** `uxui:in-progress` may be set by the human designer when picking up a `uxui:todo` task. UXUI does not act on this label; it appears in statusline counts only.

**No label combinations.** Each issue carries exactly one UXUI-owned label at a time. An issue with multiple UXUI-owned labels (e.g., `uxui:todo` + `uxui:in-progress`, `uxui:todo` + `uxui:review`, or `uxui:review` + `uxui:done`) is a bug in the flow — the statusline counts each label independently and will double-count.

**Lifecycle:** `uxui:todo` (open) → designer optionally flips to `uxui:in-progress` — *replacing* `uxui:todo`, not adding alongside (open) → the card moves to the "UX: Review" board column (a designer submitting with a share URL, or a human card-move); UXUI's `/catchup` detects the move, sets `uxui:review` (open), and classifies the card → **bundle path**: `/review-bundle` → on approve `/approve-design`'s APPROVE_DESIGN flips to `uxui:done` and closes, on reject REJECT_DESIGN flips back to `uxui:todo` (open); **no-bundle path**: `/resolve-review` → RESOLVE_ISSUE closes without `uxui:done`, or a send-back relabels to `uxui:todo` (open).

## Board columns

Each label maps to a Projects v2 board column. The herd keeps each card's Status column in sync with its issue label automatically — every create / relabel / close is mirrored to the board by the `issue-create` / `issue-transition` subcommands, and a human dragging a card to another column is read back as a label change on the next `/catchup`. You never set the column by hand. The designer's "UX: Review" card-drag (above) is the one place a human card-move drives the workflow.

| Label / event | Column |
|---|---|
| `story` | Stories |
| `todo` | Todo |
| `in-progress` | In Progress |
| `for-planner` | Planner |
| `for-pm` | PM |
| `for-uxui` | UXUI |
| `uxui:todo` | UX: Todo |
| `uxui:in-progress` | UX: In Progress |
| `uxui:review` | UX: Review |
| `uxui:done` / closed issue | Done |
