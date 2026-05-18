---
description: GitHub Issues workflow — identity and labels. Always loaded.
---

# UXUI GitHub Workflow

## Identity

Always prefix GitHub comments with `**[UXUI]**` and issue titles with `[UXUI]`.

## Labels

| Label | Meaning | Who sets it |
|-------|---------|-------------|
| `uxui:todo` | Design task ready for a human designer to pick up. Created via `/design-publish`, or as a copy-corrections batch via `/dispatch-corrections`. Returned here by `/review-bundle`'s reject path or `/resolve-review`'s send-back. | `/design-publish` + `/dispatch-corrections` (create), `/review-bundle` reject + `/resolve-review` send-back (return) |
| `uxui:review` | Card sits in the "UX: Review" board column — a task awaiting resolution. Usually a designer's Claude Design submission (a posted share URL); may also be a human card-move with other intent (cancelled, a question, mid-work notes). `/catchup` scans and classifies it (bundle vs no-bundle); `/process-inbox` dispatches it to `/review-bundle` or `/resolve-review`. | UXUI `/catchup` — syncs the label to **any** card moved into the "UX: Review" column, unconditionally (a direct `uxui:review` label-flip is still honored as a fallback) |
| `uxui:done` | Design task approved via `/approve-design`. Bundle attached to the relevant domain file. Issue is closed. Counts toward "what's been designed." A no-bundle task resolved as no-longer-needed is closed *without* this label — it was not designed. | `/approve-design` — replaces `uxui:review`, closes the issue |
| `for-uxui` | Incoming message from another agent (PM, planner) — spec update, UI gap, UI question, or PM answer to your `/ask pm` escalation (relabeled by PM from `for-pm` → `for-uxui`) | The sender's skill when creating the issue, OR PM's `/catchup` (a transfer relabel) when answering a UXUI-originated `for-pm` |
| `for-pm` | Outgoing message TO PM — a blocking spec gap or question found during UI work, or a batched set of non-blocking copy corrections | UXUI via `/ask pm` (blocking escalation) or `/dispatch-corrections` (batched non-blocking corrections) |
| `for-planner` | Outgoing message — cowmoo/design/ changes announcement, response to a `for-uxui` message, or a batched set of non-blocking notes | UXUI via `/notify planner`, `/ask planner`, or `/dispatch-corrections` |

**Designer-side convention (not agent-managed):** `uxui:in-progress` may be set by the human designer when picking up a `uxui:todo` task. UXUI does not act on this label; it appears in statusline counts only.

**No label combinations.** Each issue carries exactly one UXUI-owned label at a time. An issue with multiple UXUI-owned labels (e.g., `uxui:todo` + `uxui:in-progress`, `uxui:todo` + `uxui:review`, or `uxui:review` + `uxui:done`) is a bug in the flow — the statusline counts each label independently and will double-count.

**Lifecycle:** `uxui:todo` (open) → designer optionally flips to `uxui:in-progress` — *replacing* `uxui:todo`, not adding alongside (open) → the card moves to the "UX: Review" board column (a designer submitting with a share URL, or a human card-move); UXUI's `/catchup` detects the move, sets `uxui:review` (open), and classifies the card → **bundle path**: `/review-bundle` → on approve `/approve-design`'s APPROVE_DESIGN flips to `uxui:done` and closes, on reject REJECT_DESIGN flips back to `uxui:todo` (open); **no-bundle path**: `/resolve-review` → RESOLVE_ISSUE closes without `uxui:done`, or a send-back relabels to `uxui:todo` (open).

## Resolving a `uxui:review` card

`uxui:review` is **transient** — it means "a card in 'UX: Review' awaiting UXUI's resolution." A resolution skill (`/review-bundle`, `/resolve-review`) ends the card's time in `uxui:review` by answering one question and applying the matching row below.

**The pivot — who must act next?** By this point the agent has read the card, its comments, and (for a bundle) the evaluation. From that, decide who the card waits on once this resolution lands. The answer fixes the destination and the `issue-transition` handoff — the handoff fields are a deterministic template per row; only `issue` and the prose `comment` vary.

| Who acts next | Typical trigger | Destination | `issue-transition` handoff fields | Side-action |
|---|---|---|---|---|
| **The designer** | A rejected bundle to redo; an expired / timed-out share URL to re-share; mid-work notes to address | `uxui:todo` (→ "UX: Todo") | `removeLabel: "uxui:review"`, `addLabel: "uxui:todo"`, `comment` | — |
| **Nobody — design approved** | The user approved a reviewed bundle | closed + `uxui:done` | `removeLabel: "uxui:review"`, `addLabel: "uxui:done"`, `close: true`, `comment` | the approval transaction runs first (`/approve-design`) |
| **Nobody — no design produced** | The screen is no longer needed — superseded, redirected, dropped, cancelled | closed, **no** `uxui:done` | `removeLabel: "uxui:review"`, `close: true`, `comment` | commit any `cowmoo/design/` edits first |
| **PM** | The comments contest the task's *spec premise* — a question only PM can answer | closed, **no** `uxui:done` | `removeLabel: "uxui:review"`, `close: true`, `comment` (cross-links the escalation) | escalate via `/ask pm` — the loop closes through the `for-pm` issue |
| **UXUI — but blocked** | A `bundle-fetch` infrastructure failure (extraction / git / meta-write) — the skill cannot finish and will be re-run | **stays `uxui:review`** | *(no `issue-transition` call)* | surface the error; the card correctly remains for re-run |

**The dev tool is general — one engine, not five operations.** `issue-transition` applies whatever combination of `comment` / `removeLabel` / `addLabel` / `close` the handoff entry carries; it does **not** branch on the `op` string (that string is only the report-line label — `RETURN_TO_TODO`, `RESOLVE_ISSUE`, `APPROVE_DESIGN`, … pick whichever names the row). Every row above is the same command with different fields.

**A `uxui:review` card with no row matched is not yet resolved.** If a situation fits no row exactly, do not leave it in `uxui:review` — answer "who acts next?", take the closest row, build the handoff. The only row whose destination *is* `uxui:review` is the last one (blocked, will re-run). A card stranded in `uxui:review` after a completed resolution decision is a bug: `/catchup`'s `review-scan` re-surfaces every open `uxui:review` card each session, so the strand becomes recurring noise — and, for a PM-owned question, risks a duplicate escalation.

**Worked examples.**
- *Expired share URL* — `bundle-fetch` reports `url-unreachable`. The designer must re-share → **designer acts next**. Relabel `uxui:review → uxui:todo` with a re-share request.
- *Screen no longer needed* — a designer's comment says an existing screen will be reused as a redirect; nothing to design, no spec question → **no design produced**. Close, no `uxui:done`.
- *Comment contests the spec* — a designer says the screen shouldn't exist, but the spec mandates it; only PM can rule → **PM acts next**. Close (no `uxui:done`) and `/ask pm`.

**A deferrable copy delta is not a reject.** A copy-grade finding from bundle review — microcopy, a label, wording drift — is logged to `PENDING-CORRECTIONS.md` (see `.claude/rules/corrections.md`) and the bundle still takes the **design approved** row; it does *not* send the card back to the designer. Only a *blocking* finding (a missing state, a layout/role change) triggers the designer-acts-next row. `/dispatch-corrections` later ships the logged copy deltas as one batched `uxui:todo`.

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
