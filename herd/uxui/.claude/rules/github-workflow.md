---
description: GitHub Issues workflow — identity and labels. Always loaded.
---

# UXUI GitHub Workflow

## Identity

Always prefix GitHub comments with `**[UXUI]**` and issue titles with `[UXUI]`.

## Labels

| Label | Meaning | Who sets it |
|-------|---------|-------------|
| `uxui:todo` | Design task ready for a human designer to pick up. Created via `/design-publish`. Returned here via `/review-bundle` reject path. | `@uxui-gh-ops CREATE_DESIGN_TASK` (create), `@uxui-gh-ops REJECT_DESIGN` (return) |
| `uxui:review` | Designer finished a task and submitted a Claude Design export — UXUI needs to review via `/review-bundle` | Designer (when submitting) |
| `uxui:done` | Design task approved by `/review-bundle`. Bundle attached to the relevant domain file. Issue is closed. Counts toward "what's been designed." | `@uxui-gh-ops APPROVE_DESIGN` (on approve, replaces `uxui:review` and closes the issue) |
| `for-uxui` | Incoming message from another agent (PM, planner) — spec update, UI gap, UI question, or PM answer to your `/ask pm` escalation (relabeled by PM from `for-pm` → `for-uxui`) | Sender's ops agent when creating the issue, OR PM's `@pm-ops RESOLVE_ISSUE` action `transfer` target `uxui` when answering a UXUI-originated `for-pm` |
| `for-pm` | Outgoing message TO PM — spec gap, question, or issue found during UI work | UXUI via `/ask pm` → `@uxui-gh-ops CREATE_FOR_PM` |
| `for-planner` | Outgoing message — cowmoo/design/ changes announcement or response to a `for-uxui` message | UXUI via `/notify planner` or `/ask planner` → `@uxui-gh-ops CREATE_FOR_PLANNER` |

**Designer-side convention (not agent-managed):** `uxui:in-progress` may be set by the human designer when picking up a `uxui:todo` task. UXUI does not act on this label; it appears in statusline counts only.

**No label combinations.** Each issue carries exactly one UXUI-owned label at a time. An issue with multiple UXUI-owned labels (e.g., `uxui:todo` + `uxui:in-progress`, `uxui:todo` + `uxui:review`, or `uxui:review` + `uxui:done`) is a bug in the flow — the statusline counts each label independently and will double-count.

**Lifecycle:** `uxui:todo` (open) → designer optionally flips to `uxui:in-progress` — *replacing* `uxui:todo`, not adding alongside (open) → designer flips to `uxui:review` (open) → APPROVE_DESIGN flips to `uxui:done` and closes, OR REJECT_DESIGN flips back to `uxui:todo` (open).
