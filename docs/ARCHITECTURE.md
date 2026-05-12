# Architecture

Design decisions and rationale for the cowmoo agent system. Read this to understand WHY things are the way they are before changing them.

## Four-Agent Model

- **PM** — Defines product specs through conversation. Writes to `cowmoo/specs/`.
- **UXUI** — Translates specs into UI definitions. Defines UI directly from specs. Writes to `cowmoo/design/` — `cowmoo/design/OVERVIEW.md` (slim: design intent prose + navigation + pointers), `cowmoo/design/journeys.md` (end-to-end user arcs), `cowmoo/design/roles.md` (role vocabulary that domain files reference), `cowmoo/design/screen-index.md` (master screen list), and `cowmoo/design/domains/*.md` (per-domain screens referencing roles by name). Concrete visual values (hex codes, pixel sizes) are NOT captured in design files — they're resolved downstream by `cowmoo/agent-files/builder/BUILD-NOTES.md` as builder establishes rules, by existing `src/` patterns, or by framework defaults.
- **Planner** — Plans work, creates stories/tasks as GitHub Issues. Reads specs + design files for full context. Writes to `cowmoo/stack/`, `cowmoo/agent-files/planner/`.
- **Builder** — Implements tasks from PRDs. Reads `cowmoo/design/` files for UI definitions and role vocabulary. Maintains `cowmoo/codebase/codebase.md` via `/map-codebase` (previously a planner skill; now owned by builder since builder is the only agent that touches code). Writes project code (anything outside `cowmoo/`).

Pipeline: PM → specs → UXUI → UI definitions → Planner → tasks → Builder → code

Each agent runs in its own terminal from the cowmoo repo, accessing project files via `--add-dir`.

## Why --add-dir, Not Symlinks or Copies

The original architecture (coding-agent) copied agent files into each project and used symlinks. Problems:
- Changes required re-running setup.sh on every project
- 15+ symlinks per agent broke on clone (paths not portable)
- `.git` symlink caused "beyond a symbolic link" errors

**The fix:** Agents stay in the cowmoo repo. `moo <agent>` launches Claude from `cowmoo/herd/<agent>/` with `--add-dir $PROJECT_DIR` and `--add-dir $PROJECT_DIR/cowmoo/agent-files/<agent>/`. Changes to agents take effect immediately for all projects.

## Why git -C "$PROJECT_DIR"

Agents run from the cowmoo repo, not from within the project. All git commands must target the project explicitly:

```bash
git -C "$PROJECT_DIR" status
git -C "$PROJECT_DIR" add path/to/file
git -C "$PROJECT_DIR" commit -m "feat: ..."
git -C "$PROJECT_DIR" push -u origin HEAD
```

The `PROJECT_DIR` environment variable is set by the `moo` CLI.

**Defense in depth.** Two layers prevent bare `git` from writing to the wrong repo:

1. **`Bash(git *)` allow pattern** in every agent's `settings.json` — auto-approves all `git` commands so the hook can handle them cleanly. A tighter pattern like `Bash(git -C "$PROJECT_DIR" *)` would trigger a user prompt on bare git instead of the hook's clear error message. Worse, if the user approves the prompt, bare git runs against the cowmoo repo.

2. **`git-check` hook** (PreToolUse Bash matcher) — blocks bare `git` with an actionable error that names the correct form. Splits commands on chain operators and newlines, checks each segment. Also catches subshells (`$(git ...)`, `` `git ...` ``). Identical implementation across all four agents.

The allow pattern without the hook would silently let bare git run. The hook without the allow pattern would create a permission-prompt path where users could approve the wrong command. Together they form a loud, consistent gate.

## Why Statusline for Info, Hooks for Enforcement

The statusline is always visible — use it for anything the user should see at a glance (task counts, uncommitted files, workflow state, API limits). Hooks, by contrast, should enforce rules or track state, not print informational messages.

The reason is how the LLM reads hook output. Hooks that print plain text surface that text to the LLM, which may interpret it as an instruction and act on it unnecessarily. A hook that says "you are now in step 3 of the workflow" pollutes the LLM's context with state it didn't ask for; over multiple turns this drifts into second-guessing the user. The statusline renders to the user, not to the LLM, so informational content belongs there.

Specific consequences:

- **No `Stop` hook.** `Stop` fires after every agent turn and is too noisy for informational output. Uncommitted file counts and workflow state live in the statusline instead.
- **`workflow-check` hook tracks but does not warn.** It calls `markStep()` to record the active skill; it does NOT print prerequisite warnings or gap messages. Each skill checks its own prerequisites. The statusline shows the next suggested step.
- **`git-check` and `territory-check` hooks emit block decisions, not prose.** When they fire, they return `{"decision":"block","reason":"..."}` JSON — an actionable error the user sees once. Silent pass on clean operations.

If a hook truly must surface information to the LLM (e.g., a new `PostToolUse` pattern-check advising on herd-file edits), it does so with a narrow, actionable message the LLM can respond to — never a stream of status prose.

## Why Agent-Specific Tooling

Each agent has its own `tools/dev-tools.cjs` with:
- `healthCheck()` — verify PROJECT_DIR, gh CLI, relevant directories
- `hookSessionStart()` — check GitHub Issues for relevant labels, orient the session
- `gitCheck()` — block bare git commands (identical across agents)
- Workflow step tracking — `markStep()`, `readStep()`, `getNextSkill()`, `nextStep()`

They are NOT shared copies. The agents have different needs (builder checks `in-progress` tasks, PM checks `for-pm` issues, etc.).

## Why GitHub Issues for Coordination

Agents in separate terminals can't share context directly. GitHub Issues provide:
- **Task PRDs** as issue bodies (planner writes, builder reads)
- **State signaling** via labels (`todo`, `in-progress`, `for-planner`, `for-uxui`, etc.)
- **Records** as comments on completed tasks (builder writes, planner reads)
- **Cross-agent messages** via labeled issues (`for-planner`, `for-pm`, `for-uxui`)

The `GH_REPO` environment variable (set by `moo`) tells `gh` which repo to target.

For the principle that governs how agents communicate across these channels — report observations, don't diagnose or prescribe fixes across agent boundaries — see `docs/COMMUNICATION.md`. The full channel matrix (sender skill → ops operation → label → receiver handler → response op) also lives in `docs/COMMUNICATION.md`. Label transition commands are in each agent's `.claude/rules/github-workflow.md`.

## Label-Based Ownership

Instead of Linear's state machine, cowmoo uses GitHub labels for ownership: `story`, `todo`, `in-progress`, `for-planner`, `for-pm`, `for-uxui`. Transitions are label swaps (`--remove-label` + `--add-label`). Done = closed issue. Each agent's `github-workflow` rule has the full label table and transition commands.

## Why Five Surfaces with Distinct Roles

Each herd agent has five surfaces — CLAUDE.md, output-style, rules, skills, sub-agents — and each owns a distinct content type. This matters because the LLM doesn't "know" what it's supposed to do: it knows what's in its context. If we collapse surfaces, content ends up either missing when needed or duplicated in ways that drift.

- **CLAUDE.md** sets philosophy, inventory, and scope. Always loaded. Describes WHO the agent is and WHAT it can do — not step-by-step HOW.
- **Output-style** reinforces conversation behavior (tone, extraction habits, formatting). Always loaded when the style is active. Deliberately overlaps CLAUDE.md's behavioral instructions — the style shapes how the LLM writes every response, which is different from CLAUDE.md's role of defining rules. This is the one principled exception to non-duplication.
- **Rules** are short, always-needed canonical content: identity prefixes, label tables, state vocabulary, per-domain gotcha lists the LLM needs to reach for mid-work. Always loaded (`paths:` is abandoned, see below).
- **Skills** are step-by-step procedures. Lazy-loaded, so the main agent's always-loaded context stays small regardless of skill count.
- **Sub-agents** are delegated focused work with isolated context (see "Sub-Agent Isolation and the Read Pattern").

**Non-overlap principle:** content lives in exactly one place per surface role. Procedure steps belong in skills, not in CLAUDE.md. Rule content doesn't restate CLAUDE.md philosophy. If a rule would duplicate something a skill already says, it's skill content, not rule content.

**A rule earns its place** only when it's short AND always-needed (like identity prefixes, state vocabulary that the main agent and multiple sub-agents must share) OR when it's canonical content a sub-agent must apply verbatim. Anything else belongs inline in the skill that uses it.

## Why Skills Are Lazy-Loaded

Skills only enter the model's context when the user invokes them (`/skill-name`) or the main agent auto-invokes one via the Skill tool. The always-loaded context is CLAUDE.md + active output-style + rules + whatever the current skill adds. Skill directories sitting on disk don't consume context.

A herd agent with 20 skills is not more expensive than one with 5. Don't consolidate skills just to lower the count — only consolidate when the duplication or naming overlap actively hurts usability or maintenance.

## Why Agent Isolation Over DRY

The four agents each have their own CLAUDE.md, rules, and skills with significant structural similarity. It's tempting to extract shared sections — "Intellectual Honesty", "How You Work", workflow checklists — into a common file and have each agent reference it. Don't.

Per-agent framing is the feature. PM's "intellectual honesty" speaks to spec conflicts and UX implications; builder's speaks to failed tests and three-attempt retries; planner's speaks to scope creep and story ordering. The wording differs because the context differs. Shared phrasing would dilute the cue the LLM most needs — "you're the X agent, not the Y agent."

Shared *infrastructure* (hooks, dev-tools.cjs layout, git-check, workflow tracking, COMMIT scoping) is fine and expected to be parallel. Shared *judgment guidance* is not.

## Why Always-Loaded Rules Only

Claude Code supports `paths:` frontmatter on `.claude/rules/*.md` files to scope them to specific file globs. The mechanism has two hard limits:

1. Path-scoped rules fire only on **Read** — not Write, not Edit, not Grep (known Claude Code issue).
2. Sub-agents don't inherit the main agent's path-scoped rules; their context is isolated.

Consequence: for any content that an agent needs during Write-heavy or Grep-heavy flows, or that a sub-agent must apply, path-scoping silently fails. All herd rules are therefore **always-loaded** (no `paths:` frontmatter). Content that shouldn't always-load lives inline in the skill that uses it or is Read explicitly by the sub-agent that applies it.

The only `paths:`-scoped rule in the repo is `.claude/rules/agent-files.md` at the curator root, scoped to `herd/**` for curator editing sessions. Herd rules themselves are always-loaded.

## Sub-Agent Isolation and the Read Pattern

Sub-agents (`herd/<agent>/.claude/agents/*.md` and curator-only `.claude/agents/*.md`) do not inherit the main agent's CLAUDE.md, output-style, or always-loaded rules. Their context is: their body + their tools + files they explicitly Read. The curator owns two of its own sub-agents under the same isolation rule: `audit-verify` (per-finding fresh-context filter, spawned by every detection skill — see Pattern 23) and `change-sweep` (canonical-content **removal or rename** verification, spawned by the main agent before reporting a removal change as done — see CLAUDE.md "Removing or Renaming Canonical Content"). Both run read-only and decide independently from what they read. Two other verification flavors use a fresh-context general-purpose Agent invocation rather than a dedicated sub-agent: **canonical-content additions** (new patterns, new sub-agents, new procedure sections), and **behavioral-change sister-implementation discovery** (after a logic/regex/hook/settings edit, find parallel implementations of the same algorithm elsewhere — e.g., a regex counter in `dev-tools.cjs` mirrored by an awk counter in `statusline.sh`). Both use general-purpose invocations because the verification work is open-ended and benefits from a flexible prompt rather than the baked-in search-term-and-classify heuristics that make sense for removals. All three verification flavors are mapped in CLAUDE.md "Verification Is Part of the Change".

For every sub-agent that semantically applies canonical content (identity prefix, state vocabulary, API security rules, test-writing rules), the pattern is: `Read .claude/rules/<rule-file>.md` as the first step of its Process. For sub-agents that run mechanical commands with baked-in arguments (readers, executors, external-tool runners), the Read is unnecessary — the rule usage is already encoded in the commands.

Each herd agent owns one or more ops sub-agents that follow Pattern 6's canonical shape. Count is per-agent: planner (`@plan-ops`) and builder (`@task-ops`) each have one; PM splits into two (`@pm-ops` for GitHub/git, `@pm-bundle-ops` for transient Claude Designer share-URL fetch); UXUI splits into four (`@uxui-gh-ops`, `@uxui-git-ops`, `@uxui-bundle-ops`, `@uxui-journal-ops`). The split mirrors what the agent's write surface looks like — bundle fetches that never touch GitHub do not need the GitHub Prerequisite Read loaded into every operation. Ops sub-agents that touch `gh`/labels (`@pm-ops`, `@plan-ops`, `@task-ops`, `@uxui-gh-ops`, `@uxui-journal-ops`) carry `Read .claude/rules/github-workflow.md` as a Prerequisite; pure-git or pure-fetch ops sub-agents (`@pm-bundle-ops`, `@uxui-git-ops`, `@uxui-bundle-ops`) omit it. Builder's `@check-criteria`, `@check-patterns`, `@check-edge-cases`, `@check-security` all Read their relevant rule files. UXUI's `@check-coverage`, `@design-task-checker`, and `@design-evaluator` Read `.claude/rules/ui-vocabulary.md`.

## Herd Agents Are Standalone (De-Curation)

Herd agents must not reference curator-level paths. An end user launching `moo <agent>` against their project has no access to curator docs, curator skills, or curator CLI. Every mention of `docs/*` (except what the curator writes), `ideas/*`, curator slash-commands (`/check`, `/patterns`, `/contracts`, `/coherence`, `/rename-sweep`, `/scaffold-*`, `/audit-agent`, `/audit-hygiene`, `/curate`, `/pressure-test`), `moo init` / `moo proposals` / opt-in MCP setup commands, `.claude/asymmetries/` paths, `.claude/audit-decisions/` paths, or `herd/<agent>/` paths inside a herd file is a bug — it shows the user broken links or asks them to run commands they don't have.

The curator (this repo's root brain + `docs/` + `.claude/skills/` + `.claude/agents/` + `.claude/asymmetries/` + `.claude/audit-decisions/` + `.claude/rules/agent-files.md` + `.claude/templates/` + `tools/`) is the only place these references are legitimate.

## Two Config Layers

1. **Role config** — `cowmoo/herd/<agent>/` — agent's CLAUDE.md, skills, rules, settings
2. **Agent×Project config** — `project/cowmoo/agent-files/<agent>/.claude/` — per-agent project rules (via `--add-dir`), tracked in git and team-shared

The previous project-wide `project/.claude/` layer has been removed — there is no longer a per-project "all agents see this" rules dir. Cross-agent shared rules live in the curator's herd files; per-project overrides live inside each agent's own `cowmoo/agent-files/<agent>/.claude/`.

## Isolation Model

| What | Mechanism |
|------|-----------|
| UXUI can't write specs | settings.json deny: `Edit(**/cowmoo/specs/**)`, `Write(**/cowmoo/specs/**)` |
| Builder can't write specs | settings.json deny: `Edit(**/cowmoo/specs/**)`, `Write(**/cowmoo/specs/**)` |
| Builder can't change tech stack | settings.json deny: `Edit(**/cowmoo/stack/**)`, `Write(**/cowmoo/stack/**)` |
| Agents can't write other agents' files | settings.json deny: `Edit(**/cowmoo/agent-files/{other}/**)`, `Write(**/cowmoo/agent-files/{other}/**)` |
| PM / UXUI / planner can't write project code | `territory-check` hook (PreToolUse Edit\|Write) — hard-blocks writes outside the agent's scope via `TERRITORY` allow-list in `dev-tools.cjs`. Builder uses `FORBIDDEN` deny-list instead (see `.claude/asymmetries/builder.md`). |
| Builder commits and pushes only its own files | @task-ops scopes: code (outside `cowmoo/`), `cowmoo/agent-files/builder/` (includes `proposals/` and `codebase/`). `PUSH` op publishes the commit to the remote (skips cleanly if no `origin`) |
| UXUI commits and pushes only its own files | `@uxui-git-ops` scopes: `cowmoo/design/`, `cowmoo/agent-files/uxui/` (includes `proposals/`). `@uxui-bundle-ops` script scopes: `cowmoo/design/bundles/<ticket>/`. `PUSH` op publishes commits to the remote (skips cleanly if no `origin`) |
| Each agent has own skills/tools | Own `.claude/` and `tools/` directories |

## What We Dropped

Compared to the original coding-agent system:
- **No read counter, message counter, sync markers, or caching files** — simplified
- **No build state machine in code** — ops agents handle `gh` commands, skills delegate
- **No setup.sh deployment** — agents stay in cowmoo, accessed via `--add-dir`
- **No Linear CLI** — replaced by `gh` CLI (GitHub Issues)
- **No counter.sh, track-spec-change.sh** — skill instructions handle these concerns
- **Minimal hooks** — four per agent: `git-check` (PreToolUse Bash), `territory-check` (PreToolUse Edit|Write), `workflow-check` (PreToolUse Skill, marks step only — no warnings), `session-start`. No Stop hook — statusline handles persistent info.
