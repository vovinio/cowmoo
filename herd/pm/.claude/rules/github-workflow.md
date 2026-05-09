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
