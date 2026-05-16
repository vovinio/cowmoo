---
name: plan-check
description: Quick project state check — what files exist, what's in GitHub. Use as a lightweight status check.
tools: Bash
model: sonnet
maxTurns: 10
---

# Plan Check

Quick project state check. Report what exists — files and GitHub issues.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.
- `$GH_REPO` is set — `gh` commands auto-target the correct repo.

## Check

### 1. Check files

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" check-files
```

Then check planner-specific files (`check-files` already reports codebase.md state):
```bash
# knowledge.md — check existence, emptiness, and entry count
if [ -f "$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md" ]; then
  if [ -s "$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md" ]; then
    ENTRIES=$(grep -c '^## ' "$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md" 2>/dev/null || echo 0)
    echo "knowledge.md: exists ($ENTRIES entries)"
  else
    echo "knowledge.md: empty"
  fi
else
  echo "knowledge.md: missing"
fi

# draft.md — presence indicates interrupted session
if [ -f "$PROJECT_DIR/cowmoo/agent-files/planner/draft.md" ]; then
  echo "draft.md: exists (interrupted session)"
else
  echo "draft.md: not present"
fi

# inbox — tracked for-planner issues from prior /catchup sessions
INBOX_FILE="$PROJECT_DIR/cowmoo/agent-files/planner/.inbox-context"
if [ -f "$INBOX_FILE" ] && [ -s "$INBOX_FILE" ]; then
  INBOX_COUNT=$(grep -c '.' "$INBOX_FILE" 2>/dev/null || echo 0)
  echo "inbox: $INBOX_COUNT tracked issue(s)"
  while IFS=$'\t' read -r NUM TITLE; do
    [ -n "$NUM" ] && echo "  #$NUM $TITLE"
  done < "$INBOX_FILE"
else
  echo "inbox: empty"
fi
```

### 2. Query GitHub

```bash
gh issue list --label "for-planner" --state open --json number,title
gh issue list --label "story" --state all --json number,title,state
```

If stories exist, get sub-issues for each:
```bash
STORY_ID=$(gh issue view <number> --json id --jq .id) \
  && gh api graphql -f query="{ node(id: \"$STORY_ID\") { ... on Issue { title state subIssues(first: 50) { nodes { number title state labels(first:10) { nodes { name } } } } } } }" --jq '.data.node'
```

### 3. Return

**Return format:**
```
## Files
- techstack.md: <status from check-files>
- techstack-notes.md: <status from check-files>
- codebase.md: <exists | empty or missing>
- knowledge.md: <exists | missing | empty> (<N> entries if exists and non-empty)
- draft.md: <exists (interrupted session) | not present>
- inbox: <empty | N tracked issue(s)> (followed by list if non-empty)

## For-Planner
- #<n> <title>
<or "None">

## Stories & Tasks
Stories: <N> total (<X> done, <Y> active, <Z> planned)
Tasks:   <N> total (<X> done, <Y> in-progress, <Z> ready)

#<n> Story Name: [done|active|planned] (X/Y tasks done)
  - #<n> task-name: done
  - #<n> task-name: in-progress  <-- CURRENT
  - #<n> task-name: for-planner  <-- NEEDS REVIEW
  - #<n> task-name: todo
```

Omit Stories & Tasks section if no stories exist.

## Rules

- **Report facts, don't interpret.** Just say what exists and what doesn't. The skill decides what it means.
- **If a `gh` command fails**, report what failed. Still return file check results.
