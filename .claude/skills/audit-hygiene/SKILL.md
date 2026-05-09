---
name: audit-hygiene
description: Scan CLAUDE.md files and skills for instruction noise — automated mechanisms described to the LLM, duplicate skill instructions, mentions of unknown agents, informational lines with no action.
user-invocable: true
disable-model-invocation: true
---

# Audit — Instruction Hygiene

Scan all CLAUDE.md files and skills across all four agents. Find instructions that violate these principles:

## Principles

1. **Don't document what's automated.** If a hook or dev-tools.cjs handles something without LLM involvement, don't describe it in CLAUDE.md or skills.

2. **Don't mention agents the LLM doesn't interact with.** If the PM never talks to the builder, don't mention the builder in PM's CLAUDE.md.

3. **Don't duplicate skill instructions in CLAUDE.md.** Skills load on demand. Put procedure details in skills, put always-needed context in CLAUDE.md.

4. **Every instruction should require LLM action.** For each line in CLAUDE.md: does the LLM need to DO something because of this line? If "no" — it probably doesn't belong.

5. **Hook output is the instruction.** If a hook fires and tells the LLM what to do, CLAUDE.md doesn't need to pre-explain what the hook will say.

6. **Keep shared patterns consistent across agents.** When the same concept appears in multiple agents, the wording should match unless the agent's role requires a difference.

## What to check

Read ALL files in:
- `herd/pm/CLAUDE.md` and all skills in `herd/pm/.claude/skills/`
- `herd/uxui/CLAUDE.md` and all skills in `herd/uxui/.claude/skills/`
- `herd/planner/CLAUDE.md` and all skills in `herd/planner/.claude/skills/`
- `herd/builder/CLAUDE.md` and all skills in `herd/builder/.claude/skills/`

For each file, flag:
- Lines describing automated mechanisms the LLM doesn't control
- References to agents the LLM never interacts with
- Procedure details that duplicate what a skill already says
- Informational lines that don't lead to any LLM action
- Pre-explanations of hook behavior that the hook output already covers

## Output format

For each finding:
- **File**: path and line
- **Text**: quote the problematic line(s)
- **Principle**: which principle (1-6) it violates
- **Why it's noise**: what the LLM would do differently without this line
- **Suggestion**: remove, move to skill, or rewrite

## Rules
- Scan only — do NOT fix anything
- Be aggressive — flag anything questionable. The user will decide what to keep.
- Don't flag role descriptions, core principles, or workflow overviews — those provide essential framing.
