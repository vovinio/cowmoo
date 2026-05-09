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

Tip: run `./moo proposals` from the terminal first to see a quick summary.

If no projects are registered or no proposals found, report that and stop.

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

→ Apply A | Apply B | Apply C | Edit | Skip
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. On user choice

- **Apply [option]**: Make the actual edit to the target file. Show the diff.
- **Edit**: User refines the proposed change. Then apply.
- **Skip**: Mark the proposal as `status: skipped`.
- **Project only**: Write the change to the project's `cowmoo/agent-files/<agent>/.claude/rules/`. These rules are tracked in git (team-shared across the project's contributors), not per-user.

### 5. Clean up

After processing each proposal, update the proposal file's frontmatter with its status.

**Stale targets:** if a proposal's `Target:` field points to a file / skill / sub-agent / op that no longer exists in `herd/`, flag it explicitly in the group's options. Discover staleness by checking the filesystem, not by consulting a hardcoded list:

- For file / skill / rule targets: does the path exist?
- For sub-agent targets (`@<name>`): does `herd/<agent>/.claude/agents/<name>.md` exist?
- For op targets (`OP_NAME`): does the op appear as a `### OP_NAME` header in any ops agent file?

When a target is stale, the user picks: remap to the current successor (if a natural one exists — show the user the relevant area of the current codebase and let them decide), mark as skipped with reason "target removed", or apply the change to the project-level override only. Do not hardcode historical renames here — proposals are typically recent; genuinely ancient proposals will surface as "target removed" and the user can triage them.

### 6. Summary

```
Curation complete:
  Applied: N proposals (shared)
  Project-only: N proposals
  Skipped: N proposals
  Remaining: N proposals (pending)
```

## Rules

- Present ONE group at a time — wait for user response before the next
- Always show the actual text change, not just a description
- Always include a "project only" option
- Read the target file before designing options
