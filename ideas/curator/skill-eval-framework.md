# Curator: Skill Eval Framework

## Problem

Cowmoo has `/check` (syntax + cross-references), `/patterns` / `/contracts` / `/coherence` (structural checks against the pattern catalog), and `/audit-agent` (deep per-agent substantive review). But none of these test whether skills actually produce correct behavior in action — they verify structure and semantic contracts, not runtime output.

If you change the `/review` skill instructions, how do you know it still works? Currently: launch the builder, run /review on a real project, manually observe. There's no automated test that verifies "given these changed files and this PRD, /review should spawn its check agents in parallel, deduplicate findings, and present a classified report."

With dozens of skills across 4 agents (PM, UXUI, planner, builder), manual testing is the bottleneck for confident iteration. A skill instruction change that subtly breaks a gate or skips an agent call hides until a user hits it in production.

## Research Basis

The "Improving Skill Creator" article shipped evals for Claude skills:
- Test prompts with expected behaviors — pass/fail verification
- Benchmarks tracking pass rate, time, and tokens across versions
- Comparator agents doing blind A/B testing of skill versions
- Multi-agent isolation eliminating cross-contamination between tests

Key findings:
- Testing improved 5 out of 6 skills tested
- Cross-contamination between eval runs (context bleed) produces unreliable results — must isolate
- Blind comparison prevents bias in judging versions

## Solution

### New skill: `/.claude/skills/test/SKILL.md`

A curator skill that:

1. Selects agent and skill to test (user specifies, or test all core skills)
2. For each skill, defines the scenario:
   - What state exists (files, GitHub issues, labels)
   - What the user says (the invocation)
   - What should happen (agents spawned, files written, blocking gates)
3. Launches the agent with the scenario in isolated context
4. Checks expected behavior against actual behavior
5. Reports pass/fail with specifics

### Starting scenarios (core workflow skills only)

**Builder:**
- `/start` with no tasks → should say "No tasks" and stop
- `/start` with in-progress task → should detect and resume
- `/build` without /start → should block: "No active task"
- `/review` with no changes → should block: "No code changes"
- `/publish` with structural deviations → should block and suggest /return

**Planner:**
- `/draft` without discussion → should block: "No story discussed"
- `/draft` output → should match template structure (all PRD sections present)
- `/publish` without draft → should block

**UXUI:**
- `/define` without specs → should block: "No specs to read"
- `/design-publish` without draft → should block
- `/review-bundle` against missing bundle → should block with clear error

**PM:**
- `/digest` → should move [ready] items to specs, [future] to BACKLOG
- `/draft` → should not duplicate existing working notes entries

### When to run

- After modifying any skill file
- After modifying any agent file referenced by skills
- Before running the curator pipeline (verify behavior before checking structural consistency)

### Rules

- Test behavior, not wording — the skill may phrase things differently
- Test in isolation — each scenario gets fresh context, no bleed
- Start with blocking/gating behavior (easiest to verify: binary pass/fail)
- Add output quality tests later as the framework matures

## Trade-offs

- Largest effort of all recommendations — new skill, scenario definitions, test infrastructure
- Highest long-term maintenance value — catches regressions automatically
- Scenarios need updating when skills change (maintenance cost)
- Starting with just gate/block tests keeps initial scope manageable
- Could evolve into CI-like workflow: edit skill → run /test → confident deployment
