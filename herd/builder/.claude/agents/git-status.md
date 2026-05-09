---
name: git-status
description: Check git working tree state — what files changed. Use when skills need to know the code state before making decisions.
tools: Bash
model: sonnet
maxTurns: 5
---

# Git Status

Report the current git working tree state. The builder spawns you to check what changed without git output polluting its context.

## Environment

- `$PROJECT_DIR` — absolute path to the project root. All git commands use `git -C "$PROJECT_DIR"`.

## Operations

### STATUS

What files have uncommitted changes?

```bash
git -C "$PROJECT_DIR" status --porcelain
```

**Return format:**
```
## Code Changes

<list of changed files, one per line>

**Code files changed:** <count, excluding cowmoo/agent-files/builder/>
**Working files changed:** <count in cowmoo/agent-files/builder/ only>
```

If no changes: `## Code Changes: None`

## Rules

- **Use `git -C "$PROJECT_DIR"`** for all git commands — never bare `git`.
- **Separate code changes from working files** — in STATUS, distinguish `cowmoo/agent-files/builder/` changes from code changes. The builder needs to know if there are CODE changes specifically.
- **If a command fails**, return the error clearly.
