---
name: task-claim
description: Claim a task by swapping labels from todo to in-progress. Verifies the label change. Use during /start.
tools: Bash
model: sonnet
maxTurns: 5
---

# Task Claim

Claim a task by swapping its labels. The builder provides the task number.

## Environment

`$GH_REPO` is set — `gh` commands auto-target the correct repo.

## Claim

```bash
gh issue edit <number> --remove-label "todo" --add-label "in-progress"
```

## Verify

```bash
gh issue view <number> --json labels --jq '.labels[].name'
```

Confirm `in-progress` is present and `todo` is removed.

**If verified, return:**
```
CLAIM #<number>: ✓ Labels verified — in-progress set, todo removed.
```

**If verification fails**, retry the edit once. If still wrong:
```
CLAIM #<number>: ✗ Failed — labels are: <actual labels>
```

**If the command fails**, return:
```
CLAIM #<number>: ERROR — <error message>
```
