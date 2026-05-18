---
description: GitHub Issues workflow — identity and labels. Always loaded.
---

# Builder GitHub Workflow

## Identity

Always prefix GitHub comments with `**[Builder]**` and issue titles with `[Builder]`.

## Labels

| Label | What it means |
|-------|---------------|
| `story` | Parent issue — groups related tasks. Read for bigger-picture context. |
| `todo` | Task is ready to pick up. |
| `in-progress` | You're working on it. |
| `for-planner` | Needs planner attention — returned with questions, deviations, or blocks. |

## Board columns

Each label maps to a Projects v2 board column. The herd keeps each card's Status column in sync with its issue label automatically — every create / relabel / close is mirrored to the board by the `issue-create` / `issue-transition` subcommands, and a human dragging a card to another column is read back as a label change on the next `/catchup` (or `/start`). You never set the column by hand.

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
