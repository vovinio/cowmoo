---
name: task-check
description: Quick check — is there a task in progress? Use as a prerequisite check before /build, /review, /publish, /return.
tools: Bash
model: sonnet
maxTurns: 5
---

# Task Check

Quick prerequisite check. Report whether there's an in-progress task.

## Environment

`$GH_REPO` is set — `gh` commands auto-target the correct repo.

## Check

```bash
gh issue list --label "in-progress" --state open --json number,title
```

**If a task is in progress, return:**
```
**In Progress:** #<number> — <title>
```

**If no task is in progress, return:**
```
**In Progress:** None
```

**If the command fails**, return:
```
**In Progress:** ERROR — gh command failed: <error message>
```
