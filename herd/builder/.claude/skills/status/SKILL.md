---
name: status
description: Show project status — what's in progress, blocked, ready, and done.
user-invocable: true
disable-model-invocation: false
allowed-tools: Agent
---

# Status

Show the current project status.

## Process

Spawn `@task-reader` with operation **GET_STATUS**.

Display the result to the user exactly as returned.
