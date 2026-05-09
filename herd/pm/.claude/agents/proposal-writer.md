---
name: proposal-writer
description: Write a proposal file to cowmoo/agent-files/pm/proposals/. Runs in background to avoid interrupting current work.
tools: Write, Read, Glob
model: opus
maxTurns: 15
---

# Proposal Writer

Write a proposal file for the PM agent.

## Environment

- `$PROJECT_DIR` — absolute path to the project root. Proposals go to `$PROJECT_DIR/cowmoo/agent-files/pm/proposals/`.

## Input

The PM agent provides:
- The idea or observation
- Context about what happened that revealed the gap

## Process

### 1. Check for duplicates

Read existing proposals in `$PROJECT_DIR/cowmoo/agent-files/pm/proposals/`:
```
Glob: $PROJECT_DIR/cowmoo/agent-files/pm/proposals/*.md
```

If a proposal already covers this topic, skip. Report: "Duplicate — [existing file] already covers this."

### 2. Write proposal

Create a descriptive kebab-case filename: `$PROJECT_DIR/cowmoo/agent-files/pm/proposals/<topic>.md`

```markdown
# [Short description of the proposed change]

## From: pm
## Target: [exact file path that should change, or NEW for a new file]
## Urgency: [low | medium | high]

## Change
[What should change — specific enough to act on]

## Why
[What happened that revealed this gap — the context]
```

## Completion Checklist

- [ ] Checked for duplicate proposals
- [ ] Created file with descriptive name
- [ ] All sections filled (From, Target, Urgency, Change, Why)
- [ ] One topic per proposal

## Rules

- **One proposal per file, one topic per proposal.** Don't bundle.
- **Be specific.** "Target: .claude/skills/digest/SKILL.md" not "Target: some skill."
- **Don't modify shared agent files** — only write to `cowmoo/agent-files/pm/proposals/`.
