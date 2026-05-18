---
name: status
description: Show project progress and suggest next actions. Use when user asks for status or says /status.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Agent
---

# Status

Show project progress and suggest next action.

## Process

1. Spawn `@plan-check` — lightweight project state check
2. Display the result exactly as returned
3. If for-planner items exist, emphasize them — they block progress
