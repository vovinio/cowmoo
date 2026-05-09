# Idea: Parallel Task Execution via Git Worktrees

## Status: Future exploration

Captured from analysis of [ccpm](https://github.com/automazeio/ccpm) (April 2026). Not implementing now — prerequisites needed first.

## Concept

When a story has multiple independent tasks (no dependency between them), the builder could orchestrate parallel sub-agents working in git worktrees instead of executing tasks sequentially.

### How ccpm does it

1. Analyze task for independent work streams (which files, what conflicts)
2. Create git worktree: `../epic-<name>/` on branch `epic/<name>`
3. Launch parallel sub-agents (max 5) via Claude Code's Agent tool
4. Each agent scoped to specific files, commits with `Issue #<N>: <description>`
5. Agents coordinate through git — no direct communication
6. Track progress in local files per stream

### What this would look like in cowmoo

A new `/parallel` skill on the builder that:
- Reads all `todo` tasks in the current story
- Checks Dependencies fields to find independent tasks
- Creates worktrees per task
- Spawns sub-agents scoped to each task's PRD
- Each sub-agent runs the /build flow autonomously
- Main builder monitors progress and merges results

### Why not now

- Builder is designed as a focused executor, not an orchestrator
- Single-task mode gives the user visibility and control over each task
- Parallel agents would need autonomous review, which conflicts with user-guided /review
- Quality per task may decrease without user interaction
- Need structured dependencies (implemented) and story progress tracking working well first

### Prerequisites (done)

- Structured Dependencies field in task PRDs
- Story-level progress in @plan-check
- Builder /start checking dependency status via @task-reader

### Open questions

- Should this be a builder skill or a separate "foreman" agent?
- How does /review work for parallel tasks — batch review or per-task?
- How to handle merge conflicts between parallel worktrees?
- Does the user want this level of automation, or is the sequential approach preferred?
