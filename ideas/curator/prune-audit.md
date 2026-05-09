# Curator: "What Can I Stop Doing?" Periodic Audit

## Problem

Cowmoo was built and iterated over time. Instructions were added to address problems as they were discovered. But some of those instructions guard against model limitations that may no longer exist with newer models. Without a pruning mechanism, the system only grows — and the intelligence article proved that unnecessary instructions actively degrade performance by consuming the model's attention budget.

Examples of instructions that MAY be candidates (the audit would test, not assume):

- "Self-verify all writes — write the file, re-read it, verify nothing was dropped or corrupted" (all 4 agents) — Does the current Opus model still corrupt files during writes?
- "Stubs are failures" (review skill) — Does the model still produce stubs with proper instructions?
- "All four must be in the same response so they run in parallel" (review skill) — Does the model still need explicit parallelization instructions?
- Various rules about semantic HTML, naming conventions — Does the model already follow these naturally?

The key distinction: instructions encoding PROJECT-SPECIFIC knowledge (git -C, label conventions, file ownership) should stay. Instructions guarding against GENERAL MODEL LIMITATIONS may be removable.

## Research Basis

The "Harnessing Claude's Intelligence" article's central thesis: as models improve, harness complexity should decrease. Specific evidence:

- A team built context resets for "context anxiety" (premature wrap-up); a later model release made the resets dead weight.
- The harness design team removed sprint decomposition when a stronger Opus arrived — the better model "plans more carefully, sustains agentic tasks for longer."
- The article explicitly states: "unnecessary structure can bottleneck Claude's performance."
- On BrowseComp, removing unnecessary context management infrastructure **improved** accuracy.

## Solution

### New skill: `/.claude/skills/prune/SKILL.md`

A curator skill that:

1. Reads all agent files (CLAUDE.md, skills, agents, rules) across herd/pm/, herd/uxui/, herd/planner/, herd/builder/
2. Categorizes each instruction as:
   - **Business logic** — encodes project-specific knowledge (keep)
   - **Model guard** — guards against a model limitation (test)
3. For each "model guard" instruction:
   - What behavior does this prevent?
   - How would you detect if the model did the wrong thing without it?
   - Is there a low-risk way to test? (remove from a copy, run a scenario, check output)
4. Presents findings: which instructions still necessary (with evidence), which safely removable
5. For removable instructions: remove and run the curator pipeline (`/check` → `/patterns` → `/contracts` → `/coherence`) to confirm nothing structural broke.

### When to run

- After every major model update (new Opus/Sonnet release)
- When adding new instructions (check for overlap with existing)
- Quarterly as general maintenance

### Rules

- Test, don't assume. "It probably still needs this" is not evidence.
- Conservative bias: uncertain → keep. Only remove with evidence it's unnecessary.
- Document removals in commit messages for potential restoration.

## Trade-offs

- Requires careful testing — can't just remove instructions blindly
- Time investment per audit run (but saves context budget permanently)
- Risk of removing something that's still needed. Mitigated by conservative bias and git history
- Prevents the system from accumulating dead weight — the only mechanism that actively shrinks instructions
