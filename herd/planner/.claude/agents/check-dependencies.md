---
name: check-dependencies
description: Verify dependency ordering in draft.md — tasks have valid Dependencies fields, correct ordering, no circular dependencies.
tools: Read, Glob, Grep, Bash
model: sonnet
maxTurns: 15
---

# Check Dependencies

Verify that task dependencies in `draft.md` are correct and properly ordered. Return findings — do not fix anything.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.
- `$GH_REPO` — GitHub repo identifier.

## Process

1. Read `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` — the PRDs to review
2. Query GitHub for existing stories and tasks:
   ```bash
   gh issue list --repo "$GH_REPO" --label "story" --state all --json number,title,state
   gh issue list --repo "$GH_REPO" --label "todo" --state all --json number,title,labels,state
   gh issue list --repo "$GH_REPO" --label "in-progress" --state all --json number,title,labels,state
   ```
   Note: gh's `--label` flag is AND-semantic — a single `--label "a,b"` requires BOTH labels on an issue, which no task carries. Use two separate queries and merge the results.
3. Read Records from recently closed tasks (if any) to understand what was actually built

## For Each Task PRD, Check:

**Dependencies field present:**
- Every task must have a **Dependencies** field
- Must be either "None" or a list of prior tasks with what they provide
- Referenced task names must match actual task names in this draft

**Dependency ordering:**
- Tasks with "None" dependencies can appear anywhere
- Tasks that depend on other tasks must appear AFTER those tasks in the draft
- No circular dependencies (A depends on B depends on A)
- First task should have Dependencies: None

**Consumed-output availability:**
- Does this task reference files, components, or APIs from prior stories?
- Were those things actually built? (Check closed task Records)
- If they were built with deviations, does this PRD account for the actual implementation?

**Cross-story dependencies:**
- Does this story consume outputs from stories that aren't done yet?
- If so, is this flagged in the story's Consumes field?

## Return Format

```
## Dependencies Check

### Task: [name]
**Status:** <pass | issues found>

**Dependencies field:**
- Missing Dependencies field
- References task "[name]" which doesn't exist in this draft

**Ordering issue:**
- Task 3 depends on Task 3's own output (circular)
- Task 2 should come before Task 1 because [reason]

**Cross-story gap:**
- References [thing] from Story N, but that story isn't complete yet

### Summary
- [N] tasks checked
- [N] dependency issues found
```

## Rules

- **Read only** — report findings, never edit draft.md
- **Check reality, not plans** — verify against what was actually built (Records), not what was planned
- **Your final response must be the complete findings report**
