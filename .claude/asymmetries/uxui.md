# UXUI Deliberate Asymmetries

## Four ops sub-agents instead of one

**Pattern.** Pattern 6 — Ops Agent.

**Divergence.** UXUI has four separate ops sub-agents (`@uxui-gh-ops`, `@uxui-git-ops`, `@uxui-bundle-ops`, `@uxui-journal-ops`) instead of the single ops sub-agent that PM, planner, and builder use.

**Why.** UXUI's write surface splits naturally into four unrelated domains:
- `@uxui-gh-ops` — GitHub issues, labels, comments, design-task creation. Touches `gh`, has the `github-workflow.md` Prerequisite Read.
- `@uxui-git-ops` — git commits only (`COMMIT`, `COMMIT_ROLES`, `ATTACH_DESIGN` that stages and commits the domain file plus the journal). No GitHub, no labels; does not need the Prerequisite Read.
- `@uxui-bundle-ops` — fetches a Claude Design share URL into `cowmoo/design/bundles/<ticket>/` via `node tools/dev-tools.cjs bundle-fetch`. Pure bundle extraction; commits the bundle internally as part of the fetch script; no GitHub, no labels.
- `@uxui-journal-ops` — writes/replaces the visual-journal entry for an approved bundle AND posts a summary comment on the GitHub issue. Does not commit (that's `@uxui-git-ops ATTACH_DESIGN`'s job). Touches `gh` for the comment, so it carries the `github-workflow.md` Prerequisite Read.

A single ops agent would conflate four distinct concerns and force every operation to load the GitHub Prerequisite even when the work doesn't touch GitHub.

**Curator implication.** When verifying Pattern 6 (Ops Agent) on UXUI:
- Treat the four agents as one logical ops surface when comparing UXUI against the single-ops-agent norm.
- Verify each individual sub-agent follows the canonical ops-agent shape for its scope — verify-each-step, explicit paths, `git -C "$PROJECT_DIR"` where git is used, etc.
- `@uxui-gh-ops` and `@uxui-journal-ops` (both touch `gh`) MUST have the `## Prerequisite` Read of `github-workflow.md`. `@uxui-git-ops` and `@uxui-bundle-ops` MUST NOT carry the Prerequisite block — they don't apply its content.
- Pattern 14 (GitHub GraphQL Patterns) applies only to `@uxui-gh-ops` — the project-board-linkage half is relevant to its CREATE_FOR_PM / CREATE_FOR_PLANNER / CREATE_DESIGN_TASK ops. The sub-issue-linkage half is not used by UXUI. The other three ops agents don't create issues.

**Revisit if.** Two of the four surfaces collapse into one (e.g., if the bundle workflow and the journal workflow become a single concern), or if the split creates consistent cross-agent confusion that a merged version would not.
