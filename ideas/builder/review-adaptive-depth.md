# Builder: Adaptive Review Depth

## Problem

Builder's `/review` always spawns exactly 4 check agents regardless of change size. A 3-line bug fix in one file gets the same review as a 500-line feature across 12 files.

For small changes, the finding rate is near zero but the cost is 4 agent calls. For large changes, 4 agents may not provide sufficient depth.

## Research Basis

Anthropic's Code Review article: "Review depth scales with PR complexity — large or complex changes get more agents and deeper reads; trivial changes get lightweight passes."

Their data: large PRs (1,000+ lines) received findings 84% of the time (avg 7.5 issues). Small PRs (under 50 lines) received findings 31% of the time (avg 0.5 issues). Scaling review to complexity is not an optimization — it's matching effort to risk.

## Solution

### Modify `herd/builder/.claude/skills/review/SKILL.md`

After prerequisites (where @git-status returns changed files), add scope classification before spawning agents:

```markdown
## Assess Change Scope

From @git-status output, determine file count, approximate line count, and file types.

| Scope | Criteria | Agents to spawn |
|-------|----------|-----------------|
| **Light** | <= 3 files AND <= 30 lines AND no new files | @check-criteria + @check-security |
| **Standard** | Everything else | All 4 check agents (current behavior) |
| **Deep** | >= 8 files OR >= 300 lines OR new architectural patterns | All check agents + @check-tests |

Report: "Change scope: [Light/Standard/Deep] — [N] files, ~[N] lines. Running [agent list]."
```

The rest of the skill stays the same — findings are still deduplicated, classified, and presented identically regardless of tier.

## Trade-offs

- Light reviews use 2 agents instead of 4, halving cost for trivial changes
- Deep reviews add @check-tests for extra coverage on large changes
- Small risk: a light review might miss something a full review would catch. Mitigated by always running @check-criteria (the most important check) and @check-security (safety net)
- Proportional review builds user trust — they see the system calibrating effort to risk
