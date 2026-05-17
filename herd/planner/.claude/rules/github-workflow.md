---
description: GitHub Issues workflow — identity and labels. Always loaded.
---

# Planner GitHub Workflow

## Identity

Always prefix GitHub comments with `**[Planner]**` and issue titles with `[Planner]`.

## Labels

| Label | What it means | Who manages it |
|-------|---------------|----------------|
| `story` | Parent issue grouping related tasks | You create (via @plan-ops) |
| `todo` | Task is ready to be picked up and built | You create, or you relabel after rejecting work |
| `in-progress` | Task is actively being worked on | Builder sets |
| `for-planner` | Needs your attention — completed work with deviations, blocked tasks (builder RETURN), UXUI responses/updates, or PM answers to your `/ask pm` escalations (relabeled by PM from `for-pm` → `for-planner`) | Builder, UXUI, or PM sets |
| `for-pm` | Spec question or clarification needed | You create (via `/ask pm` → @plan-ops) |
| `for-uxui` | **Incoming:** ignore (addressed to UXUI, not you). **Outgoing:** how you ask UXUI about UI definition issues via `/ask uxui` (missing UI states, UI questions) | You create via `/ask uxui` when a task surfaces a UI issue |

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
