---
description: GitHub identity and label definitions. Always loaded.
---

# PM GitHub Workflow

## Identity

Always prefix GitHub comments with `**[PM]**` and issue titles with `[PM]`.

## Labels

| Label | What it means |
|-------|---------------|
| `for-pm` | Incoming — a spec question or clarification request from planner (title prefix `[Planner]`) or UXUI (title prefix `[UXUI]`). The title prefix routes the answer back. |
| `for-planner` | Outgoing. Two paths: (1) `/notify planner` creates a fresh issue announcing spec changes; (2) `/catchup` resolves a planner-originated `for-pm` (title `[Planner] ...`) by relabeling it `for-planner` via `@pm-ops RESOLVE_ISSUE` action `transfer` target `planner` — planner's `/catchup` picks up PM's answer comment as an inbox item. |
| `for-uxui` | Outgoing. Two paths: (1) `/notify uxui` creates a fresh issue announcing spec changes that may affect UI definitions; (2) `/catchup` resolves a UXUI-originated `for-pm` (title `[UXUI] ...`) by relabeling it `for-uxui` via `@pm-ops RESOLVE_ISSUE` action `transfer` target `uxui` — UXUI's `/catchup` picks up PM's answer comment as an inbox item. No `design-request` type — fresh-domain UI kickoff happens by launching UXUI. |

## Board columns

Each label maps to a Projects v2 board column. The herd keeps each card's Status column in sync with its issue label automatically — every create / relabel / close runs `dev-tools.cjs board-status`, and a human dragging a card to another column is read back as a label change on the next `/catchup` (or `/start`). You never set the column by hand.

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
