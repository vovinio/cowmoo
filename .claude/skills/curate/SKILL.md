---
name: curate
description: Review agent improvement proposals from all deployed projects. Groups similar proposals, designs concrete options with pros/cons, recommends the best approach, and applies changes on approval.
user-invocable: true
disable-model-invocation: true
---

# Curate Agent Proposals

Read proposals from all deployed projects, group them, design options, and present for review.

## Process

### 1. Collect proposals

Read `projects.md` (in the cowmoo repo root) to get the list of registered projects. For each project path listed, scan `cowmoo/agent-files/pm/proposals/`, `cowmoo/agent-files/uxui/proposals/`, `cowmoo/agent-files/planner/proposals/`, and `cowmoo/agent-files/builder/proposals/` for proposal files.

**Collect only pending proposals.** A proposal that carries a `## Status:` line was already resolved by a prior `/curate` run (Step 5 appends it) — skip it. A pending proposal has no `## Status:` line. `./moo proposals` applies the identical filter, so its count and this scan agree.

Tip: run `./moo proposals` from the terminal first to see a quick summary.

If no projects are registered or no pending proposals found, report that and stop.

### 2. Group proposals

Cluster proposals that target the same file or address the same issue. Note signal strength:
- Same proposal from 3+ projects = strong signal (likely universal)
- Same proposal from 1 project = could be project-specific
- Proposals targeting the same file = related, review together

### 3. For each group, design options

Read the target file(s) to understand current state. Create 2-3 concrete options:

```
━━━ Proposal 1/N ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"[Description]"
Signal: N projects
Target: herd/<agent>/.claude/skills/<skill>/SKILL.md

Option A (recommended): [description]
  + [pro]
  - [con]

Option B: [description]
  + [pro]
  - [con]

Option C: Project-only
  + No shared change (committed to project's cowmoo/agent-files/<agent>/.claude/rules/ — team-shared)
  - Same issue will recur in other projects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Render the choice as an `AskUserQuestion` picker — `Apply A` `(Recommended)`, `Apply B`, `Apply C (project-only)`, and `Skip this proposal`. To refine an option before applying, the user picks "Other" and describes the change (the **Edit** path in Step 4). One picker per proposal group; wait for the selection before presenting the next group.

### 4. On user choice

- **Apply [option]**: Make the actual edit to the target file. Show the diff.
- **Edit**: User refines the proposed change. Then apply.
- **Skip**: Mark the proposal `skipped` — Step 5 records it as a `## Status: skipped` line.
- **Project only**: Write the change to the project's `cowmoo/agent-files/<agent>/.claude/rules/`. These rules are tracked in git (team-shared across the project's contributors), not per-user.

### 5. Clean up

After processing each proposal, append a `## Status:` line to the proposal file recording how it was resolved — `## Status: applied`, `## Status: project-only`, or `## Status: skipped` — optionally followed by a one-line reason. Proposal files use `##`-header metadata (`## From:`, `## Target:`, `## Urgency:`), not YAML frontmatter, so the resolution is a `## Status:` line, not a frontmatter key.

This line is the resolved-marker that Step 1 and `./moo proposals` filter on: a proposal carrying a `## Status:` line is no longer counted as pending. The file stays in `proposals/` as the durable decision record — `@proposal-writer`'s duplicate check still sees it, so a resolved idea is not re-proposed by an agent.

**Stale targets:** if a proposal's `Target:` field points to a file / skill / sub-agent / op that no longer exists in `herd/`, flag it explicitly in the group's options. Discover staleness by checking the filesystem, not by consulting a hardcoded list:

- For file / skill / rule targets: does the path exist?
- For sub-agent targets (`@<name>`): does `herd/<agent>/.claude/agents/<name>.md` exist?
- For op / command targets: does the named `dev-tools.cjs` subcommand exist as a dispatcher `case` in some agent's `dev-tools.cjs`?

When a target is stale, the user picks: remap to the current successor (if a natural one exists — show the user the relevant area of the current codebase and let them decide), mark as skipped with reason "target removed", or apply the change to the project-level override only. Do not hardcode historical renames here — proposals are typically recent; genuinely ancient proposals will surface as "target removed" and the user can triage them.

### 6. Summary

```
Curation complete:
  Applied: N proposals (shared)
  Project-only: N proposals
  Skipped: N proposals
  Remaining: N proposals (pending)
```

After the summary, render an `AskUserQuestion` hand-off picker. When shared herd changes were applied this session: `Run /check` `(Recommended)` — start the verification pipeline on the applied edits — / `Stop here`. When only project-only changes or skips happened: `Done`.

## Rules

- Present ONE group at a time — wait for user response before the next
- Always show the actual text change, not just a description
- Always include a "project only" option
- Read the target file before designing options
