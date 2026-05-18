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
| `for-planner` | Outgoing. Two paths: (1) `/notify planner` creates a fresh issue announcing spec changes; (2) `/catchup` resolves a planner-originated `for-pm` (title `[Planner] ...`) by relabeling it `for-planner` (a transfer relabel) — planner's `/catchup` picks up PM's answer comment as an inbox item. |
| `for-uxui` | Outgoing. Two paths: (1) `/notify uxui` creates a fresh issue announcing spec changes that may affect UI definitions; (2) `/catchup` resolves a UXUI-originated `for-pm` (title `[UXUI] ...`) by relabeling it `for-uxui` (a transfer relabel) — UXUI's `/catchup` picks up PM's answer comment as an inbox item. No `design-request` type — fresh-domain UI kickoff happens by launching UXUI. |

## Board columns

Each label maps to a Projects v2 board column. The `issue-create` / `issue-transition` subcommands keep each card's Status column in sync with its label automatically — every create / relabel / close is mirrored to the board, and you never set the column by hand. A card a human drags into the PM column is reconciled back to the `for-pm` label by `/catchup`.
