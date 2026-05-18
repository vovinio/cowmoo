# Planner Deliberate Asymmetries

## Two workflow sequences instead of one

**Pattern.** Pattern 11 — Workflow Step Tracking.

**Divergence.** Planner's `dev-tools.cjs` exports `SEQUENCES = { setup, core }` — two named workflow flows — instead of the single `SEQUENCE` array that PM, UXUI, and builder use.

**Why.** Planner has two genuinely different workflows depending on project state:
- `setup` — first-time-per-project flow that includes `/tech-stack` before story drafting. Runs once per project.
- `core` — the ongoing flow of story/task drafting that repeats across every planning session.

A single flat sequence would force every session through the setup-only steps or force ambiguous ordering ("run tech-stack unless already done"). The two-flow split is cleaner — the active flow is detected at runtime by checking whether `cowmoo/stack/techstack.md` exists.

**Curator implication.** When verifying Pattern 11 on planner:
- The `known` list in `statusline.sh` must be the union of BOTH `SEQUENCES.setup` AND `SEQUENCES.core`, plus `UNTRACKED` and `ANYTIME`.
- Every skill directory on disk must appear in at least one of: `SEQUENCES.setup`, `SEQUENCES.core`, `UNTRACKED`, `ANYTIME`.
- `detectFlow()` (or equivalent) reads project state to pick the active flow for the current session — verify this helper exists and its detection logic matches the actual setup/core distinction.
- `nextStep()` output still uses the canonical `last:X|next:Y|flow:Z` shape — planner emits `flow:setup` / `flow:core` where the other three agents emit a constant `flow:ongoing`, keeping the output structurally identical across the herd. No statusline currently parses the `flow:` segment (all four `sed` only `last:`/`next:`); it is emitted for shape-consistency, not for display.

**Revisit if.** None — the two-flow split is intentional and permanent. The original Revisit-if trigger ("setup collapses to a single `/tech-stack` invocation") materialized in 2026-05; on review, the split was kept rather than collapsed. The single-flow-with-skip alternative — explicitly considered in the **Why** above — was rejected on the grounds that it forces ambiguous ordering ("run `/tech-stack` unless already done") and loses the meaningful state distinction that `detectFlow()` conveys (techstack-missing vs. techstack-present-but-no-stories vs. techstack-present-with-stories). The two-flow shape is how planner is, not a transitional choice.
