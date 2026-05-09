---
name: propose
description: Propose a change to the shared agent system. Auto-triggered when the agent notices something worth improving, or user-invoked with /propose [idea].
user-invocable: true
disable-model-invocation: false
argument-hint: [idea]
---

# Propose Agent System Change

When you notice something that would improve the agent system — a missing instruction, a better approach, a gap in a skill, a rule that should exist — spawn a background agent to write the proposal and continue your current work.

## When to Propose

- Instructions that are wrong, outdated, or contradictory
- A pattern that should be a rule but isn't
- A skill missing a step you had to figure out
- CLAUDE.md doesn't cover a situation you encountered
- A tool or hook doesn't handle a case it should
- The user asks you to propose something

## Process

Spawn `@proposal-writer` **in the background** with:
- The idea/observation (from $ARGUMENTS or from what you noticed)
- Context: what happened that revealed the gap

Then **immediately continue** with your current work. Do not wait for the agent to finish.

## Rules

- Do NOT modify shared agent files directly — only propose via the background agent
- Do NOT ask the user about the proposal — just spawn the agent and move on
- Do NOT wait for the background agent to complete
