# Pattern Catalog

Canonical patterns for the herd agent system. This is the spine: curator audit skills read these definitions; scaffolding skills generate new components from them; new contributors read them to understand the shape of existing components.

## How to use this file

Every pattern has five fields:

- **Purpose** — why the pattern exists (the invariant it enforces).
- **Canonical shape** — what every instance MUST have. The actual check content.
- **Reference implementation** — one file to read to see the shape in situ. Not a comprehensive list.
- **Find instances** — a shell recipe (`find` / `rg`) to enumerate all current instances in the repo. Discovery-based; no hand-maintained list. Recipes avoid bare `herd/*/…` shell globs — an unmatched glob aborts under zsh — letting `find`/`rg` do the path matching internally instead.
- **Declared exceptions** — pointer to `.claude/asymmetries/<agent>.md` if an agent deliberately diverges. Each exception lives exactly once, owned by the agent, not reduplicated across skills.

What this file does NOT contain:

- Counts ("PM has 19 skills"). Discovered from disk.
- Name rosters ("the agents that touch GitHub are …"). Discovered from the Find instances recipe.
- Per-agent configuration matrices that duplicate settings.json / dev-tools.cjs / frontmatter. Those files are the authoritative source.
- Historical fences ("don't reintroduce the 8 deleted rules"). Time-bounded content belongs in commit history or audit-decisions, not in live documentation.

## How to evolve this file

Add a pattern when:

1. We have two or more instances of the same structural shape in the repo,
2. Future additions must match, and
3. A check or scaffold would benefit from naming the shape explicitly.

Retire a pattern when the instances converge to one (pattern has no second-instance to align against) or diverge so much that a single canonical shape no longer captures the truth.

Deliberate asymmetries are NOT exceptions to a pattern failing — they are a signal that the pattern is either too strict or that the deviating instance is doing something the pattern doesn't yet describe. Revisit the catalog when an asymmetry persists.

---

## Principles for curator skills

These principles apply to how the curator itself is designed, not to what the curator checks. They belong here because the curator reads this file anyway, and the alternative (burying them in CLAUDE.md or scattering them across skills) is how drift gets started.

### State-based, not change-based

**Curator checks operate on the current state of the repo, not on diffs. Git is incidental.**

Every structural wrongness the curator detects — broken reference, missing Prerequisite, op parameter mismatch, channel link gap, rule without place — is a property of the repo *as it is now*. A misplaced Prerequisite has been wrong from the moment it was written, regardless of whether that was 10 seconds ago or six months ago. A broken cross-reference stays broken until fixed, independent of whether it was created by a rename, a deletion, or a typo.

Consequences:

1. **No skill reaches for `git diff`, `git log`, or `git status` as the primary input for what to check.** If a skill wants to narrow scope, it takes an explicit argument from the user.
2. **No skill needs commits to have happened.** The curator works at any commit cadence, including long stretches of uncommitted work — which is common in curator sessions.
3. **Discovery recipes read the filesystem.** `ls`, `rg`, `grep`, `find`. Git is consulted only when a skill is specifically about commits themselves (which no current curator skill is).
4. **`/rename-sweep` is the one user-driven utility that crosses this line.** It does not read git either; the user provides the rename list explicitly.

This principle does NOT apply to herd agents whose work is intrinsically diff-based. Builder's `/review` checks the files a task changed — the diff IS the unit of work, and a commit lands at the task boundary via `/publish`. In that case, `git diff` is sampling the actual review target, not faking a change filter on top of state. PM, UXUI, and planner reviews are state-based like the curator's — they review spec / design / PRD files as they are, not as they changed.

When in doubt, ask: *is the work being reviewed a commit?* If yes, git is legitimate. If no, the check is state-based.

---

## Herd-Level Patterns

Patterns that constrain the structure of each herd agent.

### 1. Agent Layout

**Purpose.** Every herd agent has the same top-level shape, so tooling, permissions, and the `moo` launcher can operate on any of them uniformly.

**Canonical shape.** `herd/<agent>/` contains:
- `CLAUDE.md` — philosophy, scope, inventory, always loaded.
- `.claude/settings.json` — permissions, hooks, env.
- `.claude/skills/<name>/SKILL.md` — one directory per skill, lazy-loaded. A skill directory may also hold a `references/` subdirectory (`references/<topic>.md`) that the skill Reads on demand — checklists, question prompts, flag tables, deeper technical background. References stay colocated with the skill that uses them rather than living as a separate global resource.
- `.claude/agents/<name>.md` — one file per sub-agent, spawned on demand.
- `.claude/rules/<name>.md` — optional, always-loaded canonical content.
- `.claude/output-styles/<name>.md` — optional, reinforces CLAUDE.md behavior when active.
- `.claude/templates/<name>.md` — optional, content scaffolds a skill reads and fills in (entity / feature / task-PRD templates, etc.).
- `tools/dev-tools.cjs` — CLI tooling invoked by hooks, skills, and the statusline.
- `tools/statusline.sh` — status line renderer.

**Reference implementation.** `herd/pm/`

**Find instances.** `find herd -mindepth 1 -maxdepth 1 -type d`

**Declared exceptions.** None expected — every herd agent follows this shape.

---

### 2. dev-tools.cjs Shape

**Purpose.** Each agent's `dev-tools.cjs` owns its own hook and CLI plumbing, but the core functions are parallel across agents so hooks and statuslines compose the same way everywhere.

**Canonical shape.**

Required functions (every agent):
- `healthCheck()` — verify PROJECT_DIR, `gh` CLI, relevant directories.
- `hookSessionStart()` — session-start orientation (GitHub Issues check for relevant labels, file state).
- `gitCheck()` — PreToolUse Bash hook, blocks bare `git`.
- `workflowCheck()` — PreToolUse Skill hook, calls `markStep()` only (no warnings).
- `nextStep()` — reads `.workflow-step` marker for the statusline.
- `territoryCheck()` — PreToolUse Edit|Write hook, blocks writes outside the agent's scope.
- `commitOp()` — the canonical pathspec-restricted commit (merge-state guard, index-lock retry, hash-pinned content-verify), exposed as the `commit` subcommand and invoked directly by the agent's `/publish` skill. Each agent supplies its own territory profile(s) as data; the `commitOp` body plus its support helpers (`git`, `indexMutate`, `inMergeState`) are parallel across agents. See Pattern 6 for the commit operation's canonical shape.
- `pushOp()` — the canonical remote push (origin pre-check, idempotent `push -u origin HEAD`, extended network timeout, `[ahead N]` verify), exposed as the `push` subcommand and invoked directly by the skills that publish. Agent-independent — no territory profile; the `pushOp` body is verbatim-identical across all four agents.
- **Board-sync helpers** — `LABEL_TO_COLUMN` (the label/event → board-column map), `resolveProjectId`, `boardSyncCore` (ensure the issue is a board item + set its Status column; pure — returns a `Board: …` string, no console, no exit), and `boardDragsCore` / `boardDragsOp` (the `board-drags <column> <expected-label>` query — the read-sync's drag detector). The board mirrors issue labels: these keep the Projects v2 Status field in sync via `addProjectV2ItemById` + `updateProjectV2ItemFieldValue`. The whole block is agent-independent and verbatim-identical across all four agents. Non-blocking — every board op exits 0; a board miss never fails the calling operation. See Pattern 14.
- **Issue-operation subcommands** — `gh` (a no-shell `gh` runner mirroring `git`), `loadHandoffEntry`, `ghReason`, `issueCreate` (`issue-create`), and `issueTransition` (`issue-transition`) — agent-independent and verbatim-identical across all four agents. They perform every GitHub issue create / comment / relabel / close. `issueEditBody` (`issue-edit-body`, the issue-body rewrite) is **planner-only** — planner's `UPDATE_TASK` is the sole body-edit operation, so the subcommand lives only in `herd/planner/tools/dev-tools.cjs`. Each reads a JSON handoff file authored by a skill — usually the caller, or the compose skill in a split compose/ship flow (see Pattern 6) — and pipes bodies to `gh` via stdin (`--body-file -`), so no body transits a shell. `issueCreate` / `issueTransition` call `boardSyncCore`; `issueCreate` also owns sub-issue linkage. See Pattern 6 and Pattern 14.
- Territory constant — `TERRITORY` (allow-list) or `FORBIDDEN` (deny-list) declared near top of file. Choice is per-agent: allow-list for narrow-scope agents (PM, UXUI, planner) and deny-list for broad-scope agents (builder).

Required conventions:
- All git commands use `git -C "${PROJECT_DIR}"` — never bare `git`.
- `run()` wraps `execSync` with 10–15s timeout and returns `null` on failure.
- `PROJECT_DIR` is read from `process.env.PROJECT_DIR`.

Optional (agent-specific): `checkFiles`, `inbox` subcommand, `detectDevServers`, `bundleFetch`, and anything else an agent's workflow needs.

**Reference implementation.** `herd/pm/tools/dev-tools.cjs` (for TERRITORY-style allow-list) and `herd/builder/tools/dev-tools.cjs` (for FORBIDDEN-style deny-list).

**Find instances.** `find herd -path '*/tools/dev-tools.cjs'`

**Declared exceptions.** Builder's use of `FORBIDDEN` instead of `TERRITORY` is deliberate (its territory is defined by exclusion — everything outside `cowmoo/` is code). See `.claude/asymmetries/builder.md`.

---

### 3. Statusline Layout

**Purpose.** Statuslines are the always-visible information surface. A uniform line structure across agents lets users move between agents without relearning where anything is.

**Canonical shape.** Four lines:

- Line 1 — context window, API limits, model, `project@branch`.
- Line 2 — agent-specific counts (tasks, inbox, freshness indicators).
- Line 3 — `/last ✓ → /next` workflow arrow, uncommitted file counts per agent-scoped directory.
- Line 4 — warnings (only rendered when something is wrong; otherwise hidden).

Required behavior:
- Reads `.workflow-step` (written by `workflowCheck()`) to compute line 3.
- Has a `known` list of skills (union of `SEQUENCE` / `SEQUENCES` + `UNTRACKED` + `ANYTIME` from `dev-tools.cjs`); warns on disk skills not in the list.
- Line 4 must stay empty under normal operation.

**Reference implementation.** `herd/pm/tools/statusline.sh`

**Find instances.** `find herd -path '*/tools/statusline.sh'`

**Declared exceptions.** Agent-specific content on line 2 differs by design (PM shows `for-pm` counts; planner shows task counts; etc.). This is instance variation, not a pattern exception.

---

### 4. Settings.json Shape

**Purpose.** Every agent's `.claude/settings.json` has the same permission/hook/env structure, so runtime enforcement is parallel and isolation is declarative.

**Canonical shape.**

- `permissions.allow` — tool allow-list including at minimum: `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash(git *)`, `Bash(gh *)`, `Bash(node "$AGENT_DIR/tools/*)` — the open-quote-then-glob form matches each agent's `settings.json` verbatim (Claude Code permission globs are prefix matches; the unbalanced `"` is intentional) — or `Bash(node *)` for builder.
- `permissions.deny` — denies `.env*` files and every other agent's scoped directories. Each agent denies what it cannot write.
- `hooks` — see Pattern 5 (Hook Shape).
- `env.CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` — set to `"1"` so `CLAUDE.md` is read from `--add-dir` paths.
- `outputStyle` — references a file that exists in `.claude/output-styles/` (if used).

Required invariants:
- No tighter `Bash(git -C ...)` pattern — broad `Bash(git *)` lets the `git-check` hook produce a clean error on bare git.
- Every other agent's `cowmoo/agent-files/<other>/` appears in `deny`.
- The agent's own shared write surface (`cowmoo/specs/` for PM, `cowmoo/design/` for UXUI, `cowmoo/stack/` for planner, outside `cowmoo/` for builder) is NOT in `deny`.

**Reference implementation.** `herd/pm/.claude/settings.json`

**Find instances.** `find herd -path '*/.claude/settings.json'`

**Declared exceptions.** Per-agent additional allows (WebSearch/WebFetch for PM/UXUI/planner; build tools for builder; `Bash(open *)` for PM) are instance variation, not pattern exceptions — captured in the agent's own settings.json.

---

### 5. Hook Shape

**Purpose.** Every agent runs the same four hooks for the same reasons, so runtime behavior (git safety, territory enforcement, workflow tracking, session orientation) is uniform.

**Canonical shape.** Four hooks:

- `SessionStart` → `node "$AGENT_DIR/tools/dev-tools.cjs" hook session-start` — health checks and orientation.
- `PreToolUse` (Bash matcher) → `node "$AGENT_DIR/tools/dev-tools.cjs" git-check` — blocks bare `git`.
- `PreToolUse` (Skill matcher) → `node "$AGENT_DIR/tools/dev-tools.cjs" workflow-check <skill>` — marks workflow step.
- `PreToolUse` (Edit|Write matcher) → `node "$AGENT_DIR/tools/dev-tools.cjs" territory-check` — hard-blocks writes outside the agent's territory.

Required conventions:
- No `Stop` hook — persistent info lives in the statusline, not hook output.
- Hook output that reaches the LLM is either a block decision (JSON `{"decision":"block","reason":"..."}`) or suppressed. Informational text belongs in the statusline.
- Complex logic lives in `dev-tools.cjs`, not inline JSON. Use POSIX ERE only in inline regexes (`[[:space:]]`, `[[:digit:]]` — never `\s`, `\d`, `\w`).

**Reference implementation.** The `hooks` block in `herd/pm/.claude/settings.json`.

**Find instances.** `find herd -path '*/.claude/settings.json' -exec jq .hooks {} +`

**Declared exceptions.** None — all four hooks appear in all four agents.

---

## Role Patterns

Patterns that constrain how specific sub-agent and skill roles are written.

### 6. Delegated Write Operation

**Purpose.** Every git / GitHub write the herd performs is a `dev-tools.cjs` subcommand, invoked directly by the skill that needs it. The subcommand owns the whole procedure — pre-checks, the write, verification with retry, board sync — so each write is tested in one place and a skill cannot hand-roll a fragile `gh` / `git` call. There is no write-ops sub-agent: pure command-delegation does not earn one.

**The sub-agent principle.** A sub-agent earns its place only by doing real reasoning in an isolated context — a checker that reads code and returns findings, a researcher, a verifier. "Run this command and report the result" is not reasoning; it is delegation, and delegation is inlined into the skill. Read-and-analyze sub-agents (`@check-*`, `@research`, `@*-reader`, `@design-evaluator`, `@auditor`, `@build-verify`, `@ui-verify`) keep their place — they reason. Write operations do not get one.

**Canonical shape.**

A write operation is a `dev-tools.cjs` subcommand — `commit`, `push`, `issue-create`, `issue-edit-body`, `issue-transition`, `journal-update`, `bundle-fetch` (see Pattern 2 for the subcommand functions; `bundle-fetch` qualifies because it commits the captured bundle internally — a pure-read fetch like `design-fetch` is not a write operation and is not listed here). The skill that performs the write:

- For a **body-carrying** operation (issue text, comment, PRD), writes a JSON **handoff file** to `cowmoo/agent-files/<agent>/.op-handoff.json` — a single reused path, a JSON array of op objects — with its Write tool, then runs `node "$AGENT_DIR/tools/dev-tools.cjs" <subcommand> --from <handoff> --index <i>`. The body travels file → `JSON.parse` → `gh` stdin (`--body-file -`) and never transits a shell — backticks / `$()` / quotes / a literal `EOF` line are inert text. Usually the skill that authors the handoff file is also the one that invokes the subcommand. When a compose/validate skill and a ship skill are split — UXUI's `/design-draft` authors and validates the draft, `/design-publish` ships it — the compose skill owns the `Write`, the ship skill owns only the `Bash` invocation, and the handoff file is a skill-specific draft (`design-draft.json`) rather than `.op-handoff.json`. `loadHandoffEntry` accepts both a JSON op-array and an object with a `.tasks` array for this case.
- For `commit` / `push`, runs the subcommand with inline args (no handoff file).
- Reads the subcommand's one-line report (`✓` / `✗` / `skipped` / `Nothing to commit`) plus exit code, and reacts.
- For a **multi-operation sequence**, runs the subcommands in order, stopping on the first `✗`. The skill body documents the sequence and the stop-on-failure rule.

Required conventions:
- Every git / GitHub write is a `dev-tools.cjs` subcommand — no skill hand-rolls `gh` or `git`. The subcommand owns pre-checks, the write, verification with retry, and board sync. If a procedure needs to change, change `dev-tools.cjs`.
- A skill that **authors** a body-carrying handoff file declares `Bash` and `Write` in its `allowed-tools`. A skill that only **invokes** a subcommand `--from` a handoff file authored by a separate compose skill declares `Bash` alone.
- The identity prefix (Pattern 15) on a title or comment is composed by the skill into the handoff entry.
- The `gh project list` + `gh project item-add` CLI pattern is forbidden; an inline `gh issue create/comment/edit`, `addProjectV2ItemById`, `updateProjectV2ItemFieldValue`, or `addSubIssue` anywhere in a herd file is a violation — those belong in `dev-tools.cjs`. See Pattern 14.

**Reference implementation.** The `commit` / `issue-create` / `issue-transition` subcommands in `herd/pm/tools/dev-tools.cjs`; `herd/pm/.claude/skills/notify/SKILL.md` for the skill-side handoff-write + invoke shape.

**Find instances.** `rg --hidden 'dev-tools\.cjs\S* (commit|push|issue-create|issue-edit-body|issue-transition|journal-update|bundle-fetch)' -g '**/.claude/skills/**' herd/` — every skill that performs a write.

**Declared exceptions.** None.

---

### 7. Sub-Agent Read Pattern

**Purpose.** Sub-agents do not inherit the main agent's CLAUDE.md, output-style, or always-loaded rules. When a sub-agent must apply canonical rule content, the rule file is Read in a dedicated section so the convention is uniform and greppable.

**Canonical shape.**

- A `## Prerequisite` section at the top of the body, after `## Environment` and before `## Process` or `## Operations`.
- The rule file is Read inside Prerequisite, e.g., "Read `.claude/rules/github-workflow.md` — canonical identity prefix and label definitions."
- The Read never appears as Process Step 1; it is context-loading, not work.
- Sub-agents that only run mechanical commands with baked-in arguments (readers, executors) don't need a Prerequisite — their rule usage is encoded in the commands themselves.

**Optional `skills:` frontmatter.** When a sub-agent repeatedly invokes a skill whose command vocabulary is non-trivial (e.g., Playwright CLI, Chrome DevTools MCP wrappers), it can declare `skills: [<skill-name>]` in its frontmatter to preload that skill's body into its context on every spawn — avoiding the need for the parent skill to re-pass the skill body in the prompt. Current uses: PM's `@recon-scout-pw`, `@recon-entities-pw`, `@recon-ops-pw`, and builder's `@ui-verify` all preload `playwright-cli`. This is orthogonal to `## Prerequisite` — `skills:` provides a standing command reference, while Prerequisite Reads a specific rule file as canonical content a sub-agent must apply verbatim.

**Reference implementation.** `herd/builder/.claude/agents/check-security.md`

**Find instances.** `rg -l --hidden "rules/[a-z-]+\.md" -g '**/.claude/agents/**' herd/` — any sub-agent referencing a rule file MUST apply this pattern.

**Declared exceptions.** None. This pattern is mandatory for every sub-agent that references a rule file.

---

### 8. Proposal Writer

**Purpose.** Every herd agent can surface improvement proposals via `/propose` without disturbing the main workflow. The sub-agent is identical in shape across agents; only the target path and agent name differ.

**Canonical shape.**

- Frontmatter: `tools: Write, Read, Glob`, `model: opus`, `maxTurns: 15`.
- `## Environment` names `$PROJECT_DIR` and `cowmoo/agent-files/<agent>/proposals/`.
- `## Process` → 1. Check for duplicates (Glob existing proposals). 2. Write proposal using the canonical frontmatter template (`# <title>` / `## From: <agent>` / `## Target:` / `## Urgency:` / `## Change` / `## Why`).
- `## Completion Checklist` — duplicate-check ran, file created, all fields filled.
- `## Rules` — one proposal per file, specific target path, writes only within `cowmoo/agent-files/<agent>/proposals/`.

**Reference implementation.** `herd/pm/.claude/agents/proposal-writer.md`

**Find instances.** `find herd -path '*/.claude/agents/proposal-writer.md'`

**Declared exceptions.** None. The four instances should differ only in the hard-coded agent name and target path.

---

### 9. Check Agent with Verifier

**Purpose.** Read-only check agents run gate checks during `/review` and similar skills. Their findings are either presented to the user directly (simple variant) or filtered through a verifier sub-agent that re-reads each finding in fresh context to eliminate false positives (full variant). The full variant is reserved for code-domain checks where false-positive rates are high; prose-domain checks use the simple variant because the user can eyeball findings directly.

**Canonical shape.**

Check agent:
- Frontmatter: `tools: Read, Glob, Grep` (read-only; Bash allowed only when the check legitimately shells out — e.g., running `gh issue view` or grep), `model: sonnet` (haiku for trivial state, opus if the check needs deeper reasoning and there is no verifier to filter output), `maxTurns` tunable by scope: ~10–15 for narrow checks against a single file or one sub-component; ~20–30 when the check reads a full design domain, a draft, or the whole change set; ~40–50 when the check must read every spec/domain file to cross-reference content (PM's `/review` agents).
- `## Prerequisite` — **required only when the check applies canonical content from a rule file** (`.claude/rules/<file>.md`). Per Pattern 7, any sub-agent that Reads a rule file must declare it here. Template Reads (`.claude/templates/<file>.md`) are authorial-choice: either loaded in Prerequisite alongside a rule (as UXUI's `@design-task-checker` does) or read inline in Process where the template structure is first needed (as PM's `@check-completeness` and planner's `@check-completeness` do). Check agents that work entirely against project content (comparing spec sections against each other, scanning code against the PRD) need no Prerequisite at all — their rule-free nature is inherent to the work, not a shortcut.
- `## Process` — short fixed sequence ending in classified findings grouped by severity or category.
- Returns findings; does not fix.

Verifier agent (optional):
- Frontmatter: `model: opus` (complex reasoning), declares tools needed to re-examine files.
- Consumes the check agents' findings, re-reads source context, classifies each as CONFIRMED or DISMISSED with a concrete reason.
- Surfaces contradictions between check agents separately rather than silently picking a side.

Spawning convention:
- Check agents run in parallel (single message, N `Agent` calls).
- Verifier (when present) runs after detection, once, with all findings in a single prompt.

**Reference implementation.** `herd/builder/.claude/agents/check-security.md` + `herd/builder/.claude/agents/check-verify.md`

**Find instances.** `find herd -path '*/.claude/agents/check-*.md'`

**Declared exceptions.** Only builder currently runs the full pattern end-to-end (parallel check agents + `@check-verify` opus verifier) — see `.claude/asymmetries/builder.md`. PM, UXUI, and planner use the detection-only half of the pattern: one or more parallel check agents whose findings are presented directly to the user. Verifier absence is an intentional choice — prose-domain checks (PM specs, planner PRDs, UXUI coverage) have lower false-positive rates than code-domain checks, and the user can eyeball findings directly.

Prerequisite usage within the detection-only variant is mixed and correct per the canonical-shape clause: PM's check agents (`@check-light`, `@check-terms`, `@check-refs`, `@check-scope`, `@check-completeness`, `@check-structure`, `@check-risk`) and planner's (`@check-completeness`, `@check-dependencies`, `@check-feasibility`, `@check-scope`, `@check-references`) read project content (specs, drafts, stack) directly without a Prerequisite Read, because they apply no rule file. UXUI's `@check-coverage` does have a Prerequisite reading `.claude/rules/ui-vocabulary.md` — it applies canonical state vocabulary. Both shapes are Pattern 9-compliant.

---

### 10. Parallel Implementation

**Purpose.** When two tool-backed variants implement the same concept (e.g., Chrome vs. Playwright recon), their output structures must be symmetric so comparison is possible and the user's mental model is unified.

**Canonical shape.**

- Names share a root and differ only by a tool suffix (e.g., `recon-chrome` / `recon-playwright`).
- Output paths use the same parent structure with the tool suffix as the only differentiator (`competitive/<name>/chrome/` vs. `competitive/<name>/playwright/`).
- Output file sets match exactly — same filenames, same business content sections. Tool-specific metadata (e.g., `**Tool:** Playwright CLI`) is the only legitimate difference.
- Workflow phases (`## Phase N:`, `## Step N:`) match in count, names, and purpose.
- Neither variant depends on the other; each is independently deletable.

**Reference implementation.** `herd/pm/.claude/skills/recon-chrome/SKILL.md` + `herd/pm/.claude/skills/recon-playwright/SKILL.md`

**Find instances.** Detect name pairs that share a long common prefix (5+ chars) and differ only by a short suffix. Known tool suffixes: `-chrome`, `-pw`, `-playwright`, `-devtools`, `-mcp`. Also detect novel suffix pairs for review.

**Declared exceptions.** When a pair exists but is intentionally asymmetric (e.g., one variant covers strictly more cases than the other), declare it in the sender agent's `.claude/asymmetries/<agent>.md`.

---

### 11. Workflow Step Tracking

**Purpose.** Each agent has an ordered skill sequence. Tracking the current step enables the statusline to show the next suggested action and lets the workflow-check hook enforce ordering when needed.

**Canonical shape.**

- `dev-tools.cjs` exports a `SEQUENCE` array (or `SEQUENCES` object with named variants for agents with multiple flows) plus `UNTRACKED` and `ANYTIME` sets.
- Every skill directory on disk belongs to exactly one of: `SEQUENCE` member, `UNTRACKED`, or `ANYTIME`.
- The `workflow-check` hook calls `markStep()` only — no warnings, no gap detection.
- `nextStep()` outputs `last:X|next:Y|flow:Z` for the statusline.
- The statusline's `known` list is the union of `SEQUENCE` + `UNTRACKED` + `ANYTIME` and must match exactly.

**Set semantics.** The three sets behave identically in `workflowCheck()` (both UNTRACKED and ANYTIME short-circuit without calling `markStep()`), but the intent differs:

- **SEQUENCE / SEQUENCES** — ordered core skills of the agent's main flow. Invoking one advances the step marker. Each skill has a fixed position.
- **UNTRACKED** — utility and tool skills outside the agent's workflow entirely (e.g., `/status`, `/propose`, installed tool skills like `playwright-cli`, long-running utilities like `/map-codebase`). Invoking one does not advance the marker.
- **ANYTIME** — workflow-aware skills that can interrupt the SEQUENCE at any step (e.g., builder's `/return`). Semantically part of the agent's flow but with no fixed position in it. Invoking one does not advance the marker. The distinction from UNTRACKED is meaning, not behavior — ANYTIME means "this is a legitimate flow-branching step that intentionally lives outside the linear progression."

The statusline and `known`-list check don't care which bucket a skill is in — only that it's in exactly one of them.

**Reference implementation.** `workflowCheck()`, `nextStep()`, and the `SEQUENCE` declaration near the top of `herd/pm/tools/dev-tools.cjs`.

**Find instances.** Each agent has exactly one implementation; compare across `herd/*/tools/dev-tools.cjs`.

**Declared exceptions.** Planner exports `SEQUENCES = { setup, core }` (two flows) instead of a single `SEQUENCE`. See `.claude/asymmetries/planner.md`.

---

### 12. Inbox Tracker

**Purpose.** When an incoming cross-agent message needs extended work spanning sessions, tracking the issue lets the eventual response skill resolve it cleanly. The tracker has a complete populator → reader → remover lifecycle within each owning agent.

**Canonical shape.**

- State file: `cowmoo/agent-files/<agent>/.inbox-context`, tab-separated `<number>\t<title>` per line.
- `dev-tools.cjs` exposes an `inbox` subcommand with `add`, `list`, `remove` operations.
- `/catchup` calls `inbox add` when transitioning an incoming issue into a working session (populator).
- `/notify`, `/ask`, or `/publish` calls `inbox list` to surface tracked issues, then `inbox remove <number>` on resolution (reader + remover).
- The statusline reads the tracker to show a visible count when > 0.

**Reference implementation.** `inbox*` functions in `herd/pm/tools/dev-tools.cjs`.

**Find instances.** `rg --hidden 'dev-tools\.cjs[^ ]* inbox' -g '**/.claude/skills/**' herd/` — `[^ ]*` skips the closing quote of the anchored `"$AGENT_DIR/tools/dev-tools.cjs"` path.

**Declared exceptions.** Builder does not have an inbox tracker — its communication is task-comment-based (builder ↔ planner via task comments), not cross-agent labeled issues. See `.claude/asymmetries/builder.md`. UXUI's inbox-tracker populator is `/process-message` (not `/catchup`) — UXUI's inbox handling is split across `/catchup` → `/process-inbox` → `/process-message`. See `.claude/asymmetries/uxui.md`.

---

## Cross-Agent Patterns

Patterns that govern communication and shared protocols across agents.

### 13. Message Channel

**Purpose.** Cross-agent messages are labeled GitHub issues. The full chain (sender skill → `issue-create` → label → receiver handler → response write) must exist end-to-end for every documented channel.

**Canonical shape.**

- Sender skill: `/notify` (announcements) or `/ask` (blocked requests). Takes target as argument.
- Sender handoff entry: the skill writes `op: CREATE_FOR_<TARGET>` with the matching `for-<target>` label and invokes the `issue-create` subcommand.
- Label: `for-<target>` (`for-pm`, `for-uxui`, `for-planner`).
- Receiver: `/catchup` reads issues with the label, routes by content category to the appropriate handler.
- Response: the receiver's handler composes a handoff entry (`POST_COMMENT`, `RESOLVE_ISSUE`, or `RELABEL`) and runs the `issue-transition` subcommand.
- Content is observational, not prescriptive (see `docs/COMMUNICATION.md`).

Adding a new channel requires: a sender skill (it composes the handoff entry and invokes `issue-create`), the `for-<target>` label, a receiver handler in `/catchup`, label-table updates in both agents' `github-workflow.md` rules, and a row in `docs/COMMUNICATION.md` Channels table.

**Reference implementation.** The Channels table in `docs/COMMUNICATION.md`.

**Find instances.** `docs/COMMUNICATION.md` is authoritative. Contract checks enumerate channels from there rather than hard-coding them in the skill.

**Declared exceptions.** Builder ↔ PM, Builder ↔ UXUI, and Curator ↔ any project agent have no direct channels by design. Documented in `docs/COMMUNICATION.md` "Agents that never talk to each other directly". Additionally, the Designer → UXUI channel is an external-human handoff — no sender skill, `uxui:review` label (not `for-<target>`); UXUI's `/catchup` reconciles and scans, `/process-inbox` classifies and dispatches to `/review-bundle` (bundle) or `/resolve-review` (no-bundle), with the approve / reject / resolution responses sent by those skills (bundle approval via `/approve-design`). UXUI also splits the standard receiver side: a `for-uxui` channel's category handler lives in `/process-message`, reached via `/catchup` → `/process-inbox` — so a UXUI channel trace follows that dispatch chain rather than a single `/catchup`. See `.claude/asymmetries/uxui.md`; `docs/COMMUNICATION.md` "the one external-human handoff" note; `/contracts` Section 5 walks a reduced chain (label + receiver handler + response writes) for the external-human shape.

---

### 14. GitHub GraphQL Patterns

**Purpose.** Two distinct GitHub concerns must use the GraphQL API rather than the default `gh` CLI subcommands: (a) syncing an issue onto the project board and into the correct Status column, and (b) linking a task issue as a sub-issue of a parent story. The older `gh project list` + `gh project item-add` pattern silently picks the owner's first project (wrong for owners with multiple repos/boards), `gh` has no CLI verb for the board Status field at all, and `gh issue edit` has no way to establish parent-child relationships between issues.

**Canonical shape — Board Status sync.**

The board is a mirror of issue labels: labels are the source of truth, the Projects v2 **Status** field (the board columns) is kept in sync. Every operation that creates an issue, changes its label, or closes it also syncs the board.

The sync is owned by `dev-tools.cjs` — never inline bash in a skill body. `LABEL_TO_COLUMN` is the single label/event → column map, verbatim-identical across all four agents. The pure procedure `boardSyncCore(issueNumber, column)` honors `$GH_PROJECT_ID` (explicit override) or else queries the repo's first linked `projectsV2`, ensures the issue is a board item (`addProjectV2ItemById` — idempotent), looks up the Status single-select field, and sets it (`updateProjectV2ItemFieldValue`, retried once); it RETURNS one of `Board: <column>`, `Board: no board`, `Board: no such column "<x>"`, or `Board: failed`.

Every operation that creates / relabels / closes an issue is delegated to the `issue-create` or `issue-transition` subcommand (see Pattern 6), and that subcommand calls `boardSyncCore` as its final step — splicing the `Board: …` segment into the same one-line report. There is no separate board-sync step, and no standalone `board-status` subcommand — `boardSyncCore` is reached only through `issueCreate` / `issueTransition`.

The **read** direction — `boardDragsCore` / the `board-drags <column> <expected-label>` subcommand — lets `/catchup` and `/start` detect a human card-drag (a card in the column whose label doesn't match) and re-sync the label via a `RELABEL` op (delegated to `issue-transition`, which mirrors the corrected label straight back onto the board). **Ordering invariant:** a reading skill processes this board→label re-sync *before* any label→board write in the same run, or it would overwrite the human's drag.

Non-blocking everywhere: a board miss never fails the operation. The `gh project list` + `gh project item-add` CLI pattern is still forbidden — it silently picks the owner's first project.

**Canonical shape — Sub-issue linkage.**

Used by planner's `CREATE_TASK` to attach a newly-created task issue to its parent story issue. No other agent currently creates nested issue structures.

The linkage is owned by the `issue-create` subcommand, not inline bash. When the handoff entry carries a `parent` field (a story issue #), `issueCreate` — after its own create-and-verify — resolves the story and task node ids (`gh issue view --json id`) and runs the `addSubIssue` GraphQL mutation, then folds `Linked to story #<n>.` into its one-line report. If the create succeeded but the link failed, the subcommand reports `✗` with the task number named — the issue exists and can be linked to the story manually; it is not recreated on retry.

An `addSubIssue` mutation in any skill body or any `.claude/agents/*.md` file is a violation — the mutation belongs in `issueCreate`.

**Reference implementation.**
- Board Status sync: `LABEL_TO_COLUMN` / `boardSyncCore` / `boardDragsCore` in `herd/pm/tools/dev-tools.cjs`; `issueCreate` and `issueTransition` (same file) are the callers that splice the `Board: …` segment into their report.
- Sub-issue linkage: the `parent` branch of `issueCreate` in `herd/pm/tools/dev-tools.cjs`.

**Find instances.**
- Board Status sync: `rg --hidden "boardSyncCore" -g '**/tools/dev-tools.cjs' herd/` — `issueCreate` and `issueTransition` call it, and every create / relabel / close write is delegated to one of those subcommands. The standalone `board-status` subcommand was removed — `rg --hidden "board-status" herd/` should return nothing (a hit is stale). `gh project list` / `gh project item-add` is a violation, and an `addProjectV2ItemById` or `updateProjectV2ItemFieldValue` mutation anywhere outside `boardSyncCore` is a violation.
- Sub-issue: `rg --hidden "addSubIssue" -g '**/tools/dev-tools.cjs' herd/` — only `issueCreate`. An `addSubIssue` mutation in any `.claude/agents/*.md` file is a violation.

**Declared exceptions.** Board sync and sub-issue linkage are both internal to `dev-tools.cjs` — `boardSyncCore` (reached by `issueCreate` / `issueTransition`) and `issueCreate`'s `parent` handling — so there are no per-agent instances to exempt there. On the read direction: UXUI's `/catchup` reconciles human card-drags with the `board-reconcile` subcommand (all UXUI status columns aligned in one pass, with un-alignable drags flagged) rather than per-column `board-drags`; `board-drags` itself remains the cross-agent primitive (still used by PM / planner / builder). Builder uses `board-drags` in `/start` as a task-selection hint only — unlike PM / planner it does NOT RELABEL on detection; the board→label re-sync is deferred to the user-gated CLAIM op. See `.claude/asymmetries/uxui.md` and `.claude/asymmetries/builder.md`.

---

### 15. GitHub Identity Prefix

**Purpose.** Every GitHub comment and issue title from an agent is prefixed with the agent's identity so reviewers can tell which agent produced which content.

**Canonical shape.**

- Comments: `**[<Agent>]** <content>` (bold markdown prefix).
- Titles: `[<Agent>] <title>` (plain prefix).
- Agent labels: `[PM]`, `[UXUI]`, `[Planner]`, `[Builder]`. The curator is never a GitHub actor.
- The canonical prefix lives in each agent's `.claude/rules/github-workflow.md` (an always-loaded rule) and is the source of truth. The skill composes the prefix into the title / comment it hands to the write subcommand.

**Reference implementation.** `## Identity` section in `herd/pm/.claude/rules/github-workflow.md`.

**Find instances.** `rg --hidden "^## Identity" -g '**/.claude/rules/github-workflow.md' herd/`

**Declared exceptions.** None. Every agent uses an identity prefix.

---

## Skill Authoring Patterns

Patterns that govern how skills and rules are written.

### 16. Skill Frontmatter

**Purpose.** Frontmatter is the LLM's first cue for when a skill applies. Precise frontmatter reduces mis-invocation; permissive frontmatter creates noise.

**Canonical shape** (applies to skills **authored for this repo**):

Required keys:
- `name: <slug>` — matches directory name.
- `description: <one-line>` — precise enough that an LLM deciding whether to pick this skill over a neighbor can tell from the description alone. Avoid vague multi-purpose descriptions.
- `user-invocable: true` — always explicit.
- `disable-model-invocation: <bool>` — always explicit. **Herd skills:** `false` (model-invokable) for every skill except the session-entry `start` skills, which stay `true` — starting a session is a deliberate user act, not something the agent should trigger mid-conversation. In normal use the agent proposes a skill ("run `/review` next?") and the user approves; model-invocation still routes each call through Claude Code's permission flow, so "invocable" is not "autonomous." Ship skills (`/publish`, `/notify`, `/design-publish`) are model-invokable too — each carries its own internal HARD GATE (Pattern 19), so the agent can only *start* the skill; the preview-and-confirm gate inside still blocks the destructive step. **Curator skills:** `true` (user-only) except the structural-pipeline skills (`/check`, `/patterns`, `/contracts`, `/coherence`), which are `false` so the curator can propose them after a herd edit session without the user retyping each command. The curator's heavyweight meta-ops (`/audit-agent`, `/audit-hygiene`, `/curate`, `/pressure-test`, `/rename-sweep`, `/scaffold-subagent`) stay `true`.

Optional:
- `argument-hint: <form>` — when the skill takes an argument, describe the accepted form. Use agent names verbatim (`<pm | uxui | planner | builder>`) when the argument names an agent.
- `allowed-tools: <space- or comma-separated list>` — declares the tools this skill may invoke (e.g., `Read, Write, Glob, Agent, Bash`). Per-skill tool scoping is a defense-in-depth layer: the skill cannot invoke tools outside its declared list even if the main agent's permissions are broader. All authored herd skills use this key alongside the required four. It is never a substitute for the required keys — it's an addition.

**Installed third-party skills detection.** Skills installed by external tools (e.g., Microsoft's `playwright-cli install --skills claude`) ship with only `name:`, `description:`, and `allowed-tools:` — they omit `user-invocable:` and `disable-model-invocation:`. Patching them in place would be overwritten on the next installer run. Detection marker: presence of `allowed-tools:` **without** `user-invocable:` and without `disable-model-invocation:` signals an installed third-party skill and Pattern 16 does not apply. Authored skills are recognized by having either of those two required keys — the presence of `allowed-tools` is orthogonal.

**Reference implementation.** `herd/builder/.claude/skills/review/SKILL.md` frontmatter (typical model-invokable skill); `herd/builder/.claude/skills/start/SKILL.md` for the `start`-skill `disable-model-invocation: true` case.

**Find instances.** `rg -A1 --hidden "^---$" -g '**/.claude/skills/*/SKILL.md' herd/ | head -30` — every skill's frontmatter.

**Declared exceptions.** Installed third-party skills (e.g., `playwright-cli` installed via its own CLI) use upstream frontmatter conventions and are not checked against the required-keys list. Detected by presence of `allowed-tools:` **combined with absence of `user-invocable:` and `disable-model-invocation:`**. Authored skills that additionally use `allowed-tools:` for defense-in-depth still fall under the canonical shape and are checked normally.

---

### 17. Rule Earns Place

**Purpose.** Rule files are always-loaded into the main agent's context. Each rule consumes context budget on every turn whether or not it's used, so each one must be justified.

**Canonical shape.**

A rule file is justified when exactly one of:
- **Short + always-needed canonical content.** The LLM must reach for this mid-work, everywhere it does that kind of work (identity prefixes, state vocabulary, per-domain gotcha lists).
- **Canonical content a sub-agent must apply verbatim.** Multiple sub-agents Read the same rule file (Pattern 7).

Required conventions:
- No `paths:` frontmatter in any herd rule. Path-scoped rules fire only on Read (not Write/Edit/Grep) and are not inherited by sub-agents. The silent failures make the mechanism unsafe in the exact flows rules matter in.
- Rule content does not duplicate CLAUDE.md philosophy or skill procedure. If a rule restates either, it's misplaced content.

If a rule would only be useful inside one specific skill, it's skill content — inline in the skill body or under `skills/<name>/references/`.

**Reference implementation.** `herd/builder/.claude/rules/github-workflow.md` (short + always-needed + Read by multiple sub-agents — earns its place on both criteria).

**Find instances.** `find herd -path '*/.claude/rules/*.md'`

**Declared exceptions.** The only `paths:`-scoped rule in the repo is `.claude/rules/agent-files.md` at the curator root, scoped to `herd/**` for curator editing sessions. Herd rules themselves are always unconstrained.

---

### 18. Partial-Failure Recovery

**Purpose.** Skills that run composite operations (multiple GitHub writes, file edits + commits, multi-agent spawns) can fail partway through. Without explicit recovery guidance, the user hits a half-finished state with no way to know whether a retry is safe or will duplicate work. Every such skill must document how to recover from each failure point so a retry doesn't produce duplicate state, silent drops, or orphan artifacts.

**Canonical shape.**

Applies to any skill whose body invokes N > 1 side-effecting operations in sequence (`dev-tools.cjs` write subcommands, file writes that must pair with commits, sub-agent spawns that mutate state).

- Each side-effecting step is numbered and named in the skill body.
- After the happy-path steps, a dedicated "Partial-failure recovery" section (or per-step recovery notes) walks each failure point and documents:
  - What the preceding operations left behind (files written, commits made, issues created, labels changed).
  - Whether re-running the skill is safe (idempotent) or dangerous (would duplicate state).
  - Concrete recovery options the user can take — almost always a fork between "continue from where it failed" and "roll back and restart."
- Failure modes that require user decision (not automatic) are surfaced explicitly; the skill stops and waits for user input rather than silently retrying or proceeding.

**Reference implementation.**
- `herd/uxui/.claude/skills/design-publish/SKILL.md` Step 5 "Partial-failure recovery" (mid-batch issue creation failure).
- `herd/uxui/.claude/skills/approve-design/SKILL.md` Step 2 partial-run detection (`review-resume-state`) + Step 7 partial-commit recovery (ATTACH_DESIGN succeeded but APPROVE_DESIGN failed — re-invoke `/approve-design`).
- `herd/planner/.claude/skills/publish/SKILL.md` "Partial-failure recovery" section (clear-draft / commit / GitHub issue creation failure modes).
- `herd/builder/.claude/skills/publish/SKILL.md` Step 4 "If any step fails" guidance.

**Find instances.** Any skill whose body invokes ≥ 2 side-effecting `dev-tools.cjs` subcommands, spawns ≥ 2 sub-agents with side effects, or writes files AND creates issues. `rg -l --hidden "partial.failure|recovery|roll back" -g '**/.claude/skills/*/SKILL.md' herd/` surfaces the explicitly-documented ones; inspect the rest to confirm they don't need recovery guidance.

**Declared exceptions.** Skills with a single side-effecting operation (e.g., `/notify` creates one issue, `/draft` writes one file) don't need a recovery section — a retry is either idempotent or the user sees the failure immediately and knows what to do. The pattern applies when N > 1.

---

### 19. Hard Gate

**Purpose.** Skills that either (a) execute a destructive, hard-to-reverse, or externally-visible operation (committing, creating GitHub issues, closing tasks, posting comments) or (b) produce substantive synthesized output that feeds directly into such an operation (draft files consumed by a publish skill, task bodies consumed by an issue-creation skill) must present a preview and wait for explicit user confirmation before the step that matters. The preview is the "hard gate" — no work advances until the user reacts. Silent progression past side-effecting (or synthesis-feeding) operations is a recurring failure mode this pattern prevents.

**Canonical shape.**

- A "Preview" or "HARD GATE" step appears after the skill has assembled everything needed to execute, but before any side effect occurs.
- The preview shows the user concretely what will happen: which files will be committed, which issues will be created (with titles), which labels will be changed, which commit message. No abstraction — the actual text and data.
- The skill waits for explicit user confirmation. "Silence is consent" is not allowed — the skill must not advance until the user actively approves or adjusts.
- The skill handles the fork: approve → execute; adjust → discuss then re-preview; reject → stop cleanly.
- How the confirmation is rendered is per-agent. PM and UXUI render every HARD-GATE confirmation as an `AskUserQuestion` picker — including a plain approve/cancel — per their `CLAUDE.md` item 3 interaction doctrine. Planner and builder use `AskUserQuestion` when the preview offers 2–4 genuine alternatives (e.g. `/notify planner` vs `uxui` vs `both`, approve-as-is vs approve-with-role-additions) and free-text prompting otherwise.

**Reference implementation.**
- `herd/uxui/.claude/skills/design-draft/SKILL.md` Step 8 "HARD GATE" (before `/design-publish` ships N tasks to GitHub).
- `herd/uxui/.claude/skills/design-publish/SKILL.md` Step 2 "Preview" (duplicate-title pre-check + explicit confirmation before `/design-publish` creates the design tasks).
- `herd/planner/.claude/skills/draft/SKILL.md` Step 5 "HARD GATE" (before `/review` consumes the draft).
- `herd/builder/.claude/skills/publish/SKILL.md` Step 3 "Preview" (before code commit + Record post + task close).

**Find instances.** `rg -l --hidden "HARD GATE|before executing|Preview before|Wait for.*confirmation|user confirms|user approv" -g '**/.claude/skills/*/SKILL.md' herd/` surfaces most instances. The pattern also applies to any skill whose body commits to git or creates a GitHub issue — the preview step must precede the side effect.

**Declared exceptions.** Quick-capture drafts that just extract conversation and save to scratch files (PM's `/draft`, UXUI's `/draft`, `/tidy`) don't need a hard gate — the user can inspect the saved file before the next skill runs. Compile-and-synthesize drafts that produce substantive output the user needs to validate (planner's `/draft` compiling PRDs, UXUI's `/design-draft` composing task bodies) DO use the pattern — they gate on the synthesis step before it feeds downstream phases that will commit or ship. The distinguishing question is whether a user would want to review the output before advancing, not only whether this skill itself commits or creates issues.

---

### 20. Bounded Validation Loop

**Purpose.** Skills that use a sub-agent validator (checker, reviewer, linter) and then apply fixes can easily fall into unbounded "validate → fix → re-validate → fix → …" loops that add cost without signal. Every such skill must cap validation iterations with an explicit exit condition and trust the human in the loop over another agent cycle.

**Canonical shape.**

- Initial validation pass: spawn the validator sub-agent(s), collect findings.
- User triages findings; fixes are applied.
- **Bounded re-validation**: spawn the validator again to catch regressions the inline fixes may have introduced. The skill explicitly justifies this pass — the human is already approving each fix, so a mechanical recheck catches things they skim past (missing role references, raw hex codes, broken cross-references, test regressions).
- **Explicit hard cap** on the total number of validator runs, stated numerically in the skill body. Typical values: 2 total (initial + one regression check — UXUI `/design-draft`) or 3 total (initial + up to 2 re-verification rounds — builder `/review`). The cap number is tuned to the validator's false-positive profile: simple validators converge in one regression; complex validators with multiple fix-triggering findings sometimes need two.
- If the final cap is hit and findings remain, surface them to the user and **stop**. Do not spawn the validator again automatically.
- The stop rationale is stated in the skill body: additional automatic cycles add noise, not signal. The correct next step after the cap is human triage (discuss, adjust, re-run from scratch) — not another agent cycle.

An unbounded loop is always a violation. A cap without an explicit stop-rationale is a weak instance of the pattern — the rationale is what stops the LLM from re-opening the loop on its own judgment.

**Reference implementation.**
- `herd/uxui/.claude/skills/design-draft/SKILL.md` Step 7 triage — "Validation runs twice max" with explicit stop-condition prose.
- `herd/builder/.claude/skills/review/SKILL.md` Step 8 "Re-verify (if needed)" — cap at 2 re-verification rounds with explicit triggers (structural change, 5+ quick fixes across 3+ files, scope expansion). Also runs cheaper `@build-verify` first before LLM re-runs.

**Find instances.** `rg -l --hidden "cap at|max.*round|once more|re-verif|re-spawn|regression check" -g '**/.claude/skills/*/SKILL.md' herd/` surfaces skills with explicit iteration control. Any skill that spawns a validator sub-agent after fixes (worded as "re-check", "re-verify", or "regression check") must declare the cap.

**Declared exceptions.** The pattern applies only to iterative feedback loops (validator → fix → re-validator → fix → …) that could run indefinitely without discipline. Two shapes are NOT iterative loops and don't need the pattern:

- **Single-pass skills** run the validator once, apply fixes, and exit without re-checking. Example: PM's `/review` applies fixes and exits to `/publish` without re-spawning the check agents. The user's decision to advance is the stop condition.
- **Single conditional re-run skills** do one extra validator pass only under a narrow structural trigger. Example: planner's `/review` Step 5 re-runs the affected check agents only if structural changes were applied in Step 4 — structurally capped at one re-run by the skill's prose; no explicit numeric cap needed because there's no loop.

The pattern applies when the skill could otherwise re-validate iteratively without a structural stop.

---

## Curator-Skill Patterns

Patterns that govern how the curator's own skills are written.

### 21. Detection Skill Structure

**Purpose.** Curator detection skills share a uniform shape so the curator's audit surface is predictable and individual checks stay small and composable.

**Canonical shape.**

**Required for every detection skill:**
- Skill body contains a `## Verification phase` section — placed after the substantive checks, before the `## Report` / `## Rules` tail — that references the shared stanza (Pattern 23) rather than inlining it. (`/audit-agent` realizes it as `## Step 8 — Verification phase`; see the partial-conformance note under Declared exceptions.) The verifier filter is non-negotiable — this is what makes detection findings trustworthy.
- No Self-Test section. No hardcoded inventory. No "known-good state" snapshot. No historical "don't reintroduce" fences. Inventory is discovered at runtime.

**Body structure (two acceptable variants):**

- **Multi-section variant** — used by skills that check multiple independent invariants. The body decomposes into numbered Sections (`## Section N — XYZ`), each containing an `### Discovery` subsection (grep/glob recipe to enumerate instances) and an `### Checks` subsection (per-check items naming what to verify and what failure looks like). The section's opening sentence states the invariant. `/contracts` and `/coherence` use this variant.

- **Single-iteration variant** — used by skills that check one cross-cutting concern across many instances. The body is a numbered Step sequence (`## Step N — XYZ`) describing one big "for each instance" loop. Discovery, Check, and Violation collapse into the iteration prose rather than splitting into subsections. `/patterns` is the reference implementation of this variant; `/check` is a hybrid where each Step is a small independent invariant with inline shell snippets.

**Reference implementation.** `.claude/skills/patterns/SKILL.md` (single-iteration variant); `.claude/skills/contracts/SKILL.md` (multi-section variant).

**Find instances.** `ls .claude/skills/` — curator skills.

**Declared exceptions.** Skills that do orthogonal work fall outside this pattern in different ways:

- **No verification phase, no detection shape:** `/pressure-test` (runs scenarios via sub-agent, not a structural check), `/curate` (workflow skill that designs options for proposals), `/rename-sweep` (user-driven rename utility), `/scaffold-subagent` (generator).
- **Detection-like work but exempt from verification filter:** `/audit-hygiene` is an editorial noise scanner whose findings are judgment-heavy — verification would add cost without signal.
- **Partial conformance:** `/audit-agent` uses the verification phase tail (Step 8 invokes the canonical procedure) but its narrative body doesn't decompose into the multi-section or single-iteration variants — Steps 2–7 are six distinct substantive checks plus Step 1 (full comprehension) plus Step 8 (verification). It also replaces the static `## Report` tail with `## Step 9 — Triage walkthrough`: confirmed findings are delivered to the user one at a time via `AskUserQuestion` pickers (problem + fix options + apply/skip/dismiss decision) rather than as a single block. It's a narrative variant treated as a detection skill in CLAUDE.md, audit-verify, and the verification template.

---

### 22. Finding Format

**Purpose.** Every curator finding the user sees uses the same shape so the user can triage uniformly regardless of which skill surfaced it — and so the real issue is in front of the user fast, not buried under PASS lists or verification accounting.

**Canonical shape.**

```
**[Headline — what's wrong, in plain words]**  ·  [critical | advisory]

**Problem.** Plain-language paragraph: what's broken and what the user/agent
experiences because of it. file:line cited.

**Fix.** One obvious fix stated directly, OR — for a genuine fork — 2–3 options,
the recommended one first and marked `(recommended)`, each with a one-line reason.
```

Impact verification (grep callers, confirm coordinated edits are safe) happens *while producing* the finding but is not a rendered section. Skills that pass a check emit a single coverage line ("Checked: X, Y, Z"), never a list of PASS entries; the raised/verified/confirmed/dismissed counts are internal to the verification phase and stay out of the user-facing report.

**Reference implementation.** `.claude/templates/finding-format.md`.

**Find instances.** Every detection skill references the template rather than inlining it.

**Declared exceptions.** None — every curator finding uses this shape.

---

### 23. Verification Phase

**Purpose.** Detection casts a wide net; verification filters out false positives and weak fix proposals so surviving findings are trustworthy. Per-finding fresh context via `@audit-verify` is what makes this work. The phase catches *over-detection* only — a real issue the detector dismissed mid-pass never reaches the verifier, so guarding against *under-detection* is the calling skill's detection-phase responsibility (see `/audit-agent`'s "Dismissal discipline" section).

**Canonical shape.**

1. **Collect findings** — extract each actionable finding (skip PASS/informational). Capture headline, full body, cited paths, proposed fix, source section.
2. **Prioritize and cap at 10** — critical first, advisory after. Take top 10; log the rest as deferred.
3. **Spawn `@audit-verify` in parallel** — single message with N parallel `Agent` calls (N ≤ 10). Each invocation receives only its own finding; verifier reads files fresh and decides independently.
4. **Consolidate verdicts** — CONFIRMED (fix good) passes through; CONFIRMED (fix needs revision) passes through with verifier's revised fix; DISMISSED logged with concrete reason but not acted on.

Do not re-verify revised fixes. Dismissals from `@audit-verify` are session-scoped ("not real this cycle") — they do NOT populate `.claude/audit-decisions/<agent>.md`. Only explicit curator triage decisions belong there.

If no actionable findings were extracted, skip verification entirely and report zero findings.

**Reference implementation.** `.claude/templates/verification-phase.md`.

**Find instances.** Every detection skill references this template; no detection skill inlines the content.

**Declared exceptions.** None — the verification phase shape is fixed.
