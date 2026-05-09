# Herd-side audit — state-based vs change-based checks

## The problem

The curator was just refactored to make every audit/review skill **state-based**, not **change-based**. Reason: we don't commit frequently in curator sessions, so git-diff-based routing was unreliable. Deeper realization: the structural wrongness these skills detect is a property of the repo *as it is now*, not of a change. A misplaced Prerequisite in a sub-agent is wrong whether it was written 10 seconds ago or six months ago. Git as "what to check" was solving a problem we don't have.

We applied this fix to the curator. **We did NOT audit the herd agents** (PM, UXUI, planner, builder) for the same distortion. Each herd agent has skills and sub-agents that read `git diff` / `git log` / `git status`. Some of those reads are legitimate (builder's task reviews — a task IS a diff, and builder commits at task boundaries via `/publish`). Others are likely faking a change filter on top of work that's fundamentally about whether files are in a correct state.

## What to do

Walk each herd agent. Classify every git usage in its skills and sub-agents into one of three buckets:

- **Legitimate** — the work being reviewed IS a commit-sized change. Keep.
- **State-masquerade** — the skill reads git diff to decide scope, but the actual check is "are these files in the correct shape" (spec completeness, PRD consistency, design coverage). Replace with direct state reads.
- **Ambiguous** — flag for discussion.

For each state-masquerade case, propose a state-based replacement.

## Expected strong priors

- **Builder** — mostly legitimate. `/review`, `@check-criteria`, `@check-patterns`, `@check-edge-cases`, `@check-security` all scope to "files this task changed" and that's the actual work unit. Expect few changes.
- **PM, UXUI, planner** — mostly state-masquerade. Their reviews are about whether spec / design / PRD files satisfy rules, which has nothing to do with a diff. Expect more changes here.

## Where to look

```bash
rg "git (diff|log|status)" herd/
```

Then read each hit in context to classify.

## Context to read first

- `docs/PATTERN-CATALOG.md` — the "State-based, not change-based" principle section explains the reasoning and the legitimate exception (builder's task reviews).
- `CLAUDE.md` — how the curator's pipeline now works.
- `.claude/skills/check/` and `.claude/skills/rename-sweep/` — examples of the state-based replacement on the curator side. `/check` Step 4 covers "broken reference" without git; `/rename-sweep` handles user-initiated renames via explicit input.

## Deliverable

A report, per herd agent, listing:
- Each git usage (file path + line).
- Classification (Legitimate / State-masquerade / Ambiguous).
- For state-masquerade: proposed state-based replacement.

**Report first, do not apply changes until the user approves the classification.** Herd agents are user-facing; unlike the curator, their changes affect deployed projects. Classifications can be wrong — have the user sanity-check before editing.

## Anti-scope

- Do not redesign herd agents structurally. The question is narrow: for each git usage, is it legit?
- Do not touch builder's task-based review flow unless you find a specific state-masquerade in it.
- Do not delete anything. Only propose.
- Do not commit or deploy.

## Known context

- Every herd agent has a `tools/dev-tools.cjs` with a `gitCheck()` hook function that blocks bare `git` at runtime. That function is infrastructure, not a check — leave alone.
- `@<agent>-ops` sub-agents use `git -C "$PROJECT_DIR"` for state-modifying commits. That's write-side, not review-side — leave alone.
- The focus is read-side git usage in review/check skills and check sub-agents.
