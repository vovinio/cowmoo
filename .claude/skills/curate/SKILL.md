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

**Every file in `proposals/` is a pending proposal.** `/curate` *deletes* a proposal once it is resolved (Step 5), so the directory holds only unresolved work — there is no status marker to filter on. `./moo proposals` counts the same set.

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
- **Skip**: The proposal is rejected — nothing is changed.
- **Project only**: Write the change to the project's `cowmoo/agent-files/<agent>/.claude/rules/`. These rules are tracked in git (team-shared across the project's contributors), not per-user.

Whichever choice — apply, project-only, or skip — Step 5 then **deletes** the proposal file. Every resolution consumes the proposal.

### 5. Clean up

Once a proposal is resolved — applied, project-only, or skipped — **delete the proposal file** (`rm` it from the project's `proposals/` directory). `proposals/` is a queue of *unresolved* work, not an archive.

Why delete rather than archive:
- **Applied** — the commit is the durable record; it names what changed and why. The proposal file was consumed scaffolding. If an agent later re-proposes the same thing, that re-surfacing is *signal* — the applied fix did not hold — not noise to suppress.
- **Skipped** — a rejected proposal leaves no file. If an agent notices the same gap again and re-proposes it, the curator re-triages it (a recurring re-proposal is the agent saying the gap is real). `@proposal-writer`'s duplicate check still prevents two *pending* proposals of the same thing.
- **Project-only** — the change landed in the project's `.claude/rules/`; that is the record.

**Stale targets:** if a proposal's `Target:` field points to a file / skill / sub-agent / op that no longer exists in `herd/`, flag it explicitly in the group's options. Discover staleness by checking the filesystem, not by consulting a hardcoded list:

- For file / skill / rule targets: does the path exist?
- For sub-agent targets (`@<name>`): does `herd/<agent>/.claude/agents/<name>.md` exist?
- For op / command targets: does the named `dev-tools.cjs` subcommand exist as a dispatcher `case` in some agent's `dev-tools.cjs`?

When a target is stale, the user picks: remap to the current successor (if a natural one exists — show the user the relevant area of the current codebase and let them decide), skip it (resolved as a skip — the file is deleted like any resolution), or apply the change to the project-level override only. Do not hardcode historical renames here — proposals are typically recent; genuinely ancient proposals will surface as "target removed" and the user can triage them.

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
- Resolved proposals are deleted, not archived — `proposals/` is a queue of unresolved work. Apply, project-only, and skip all delete the file.
