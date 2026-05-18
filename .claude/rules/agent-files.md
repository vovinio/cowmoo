---
paths: ["herd/**"]
---

Before editing any agent file, read these reference docs if you haven't already this session:

1. `docs/ARCHITECTURE.md` — design decisions and rationale. Understand WHY before changing WHAT.
2. `docs/PATTERN-CATALOG.md` — the named structural patterns every herd instance must satisfy (currently 23, grouped into herd-level, role, cross-agent, skill-authoring, and curator-skill sections). Each pattern has a Canonical Shape checklist and a Find Instances recipe.
3. `.claude/asymmetries/<agent>.md` — per-agent deliberate divergences from the catalog. Any edit that creates a divergence without an entry here is a violation; any edit that removes a divergence should clear the entry.

## Core principles (reminders)

These are the invariants the herd architecture depends on. Every edit below must respect them — violating any of these is an architectural regression.

1. **Five surfaces, distinct roles.** CLAUDE.md (philosophy/inventory/scope) — output-style (tone/writing behavior, the one intentional overlap with CLAUDE.md) — rules (short, always-needed canonical content) — skills (step-by-step procedures) — sub-agents (delegated focused work). Each surface owns one content type. Procedure steps don't belong in CLAUDE.md. Rules don't restate CLAUDE.md philosophy.
2. **A rule earns its place** only if (a) short + always-needed canonical content (identity prefixes, state vocabulary, per-domain gotchas) OR (b) content a sub-agent must apply verbatim. Anything else belongs inline in the skill that uses it.
3. **Rules are always-loaded — no `paths:` frontmatter.** `paths:` fires only on Read (not Write/Edit/Grep) and sub-agents don't inherit path-scoped rules. The silent failures make it unsafe. The only legitimate `paths:` rule is this file (`agent-files.md`) at curator root.
4. **Sub-agents don't inherit main-agent context.** Sub-agents see only their own body + declared tools + files they explicitly Read. When a sub-agent must apply canonical rule content, it Reads the rule file in a dedicated `## Prerequisite` section at the top of its body — before `## Process` / `## Operations`. See `docs/PATTERN-CATALOG.md` Pattern 7 (Sub-Agent Read Pattern).
5. **Herd agents are standalone (de-curation).** Herd files (anything under `herd/`) must NOT reference curator docs (`docs/ARCHITECTURE.md`, `docs/COMMUNICATION.md`, `docs/PATTERN-CATALOG.md`), curator skills (`/check`, `/patterns`, `/contracts`, `/coherence`, `/rename-sweep`, `/scaffold-*`, `/audit-agent`, `/audit-hygiene`, `/curate`, `/pressure-test`), curator CLI (`moo init`, `moo proposals`, opt-in MCP setup commands), the `.claude/asymmetries/` path, the `.claude/audit-decisions/` path, `herd/<agent>/` path prefixes, `ideas/*`, or `projects.md`. The end user launching `moo <agent>` against their project has no access to any of that.
6. **Agent isolation — don't DRY across agents.** Resist extracting shared judgment guidance ("Intellectual Honesty", "How You Work") into a common file. Per-agent framing is the feature. Shared infrastructure (hooks, git-check, dev-tools layout) is fine; shared judgment is not.
7. **Skills are lazy-loaded.** Skills enter context only when invoked. Don't consolidate skills to reduce count — only consolidate when duplication actively hurts usability.

## When adding or modifying

- **CLI commands in dev-tools.cjs** — follow existing execSync patterns, sanitize user text, use `PROJECT_DIR` env var. Keep core functions (`healthCheck`, `hookSessionStart`, `gitCheck`, `workflowCheck`, `nextStep`) parallel across all 4 agents.
- **Hooks in settings.json** — POSIX ERE only (no `\s`, `\d`, `\w`; use `[[:space:]]`, `[[:digit:]]`, `[[:alnum:]_]`). Verify JSON escaping. Test regex with sample input.
- **CLAUDE.md** — verify referenced commands exist in that agent's dev-tools.cjs; verify referenced skills exist in `.claude/skills/`; verify referenced sub-agents exist in `.claude/agents/`.
- **Skills** — verify referenced commands match actual CLI signatures. Every `dev-tools.cjs` subcommand a skill invokes must be a real dispatcher `case` in that agent's `dev-tools.cjs`.
- **Rules** — justify the content under principle 2 above. If you find yourself adding a rule that says things CLAUDE.md already says, or that only one skill uses, it's probably skill content, not rule content.
- **Sub-agents** — if the sub-agent applies canonical rule content, add a `## Prerequisite` step that Reads the rule file. Never assume the sub-agent inherits rules from the main agent.
- **README files** — when adding or removing a skill or sub-agent under `herd/<agent>/`, also update the GitHub-facing root `README.md` `## Commands Reference` (the per-agent command tables) in the same turn — and, for any agent that has its own `herd/<agent>/README.md`, that file's Commands Reference and Agents tables too. The README is user-facing and presents itself as canonical (no "see CLAUDE.md for full list" caveat); drift creates real user impact. CLAUDE.md is curator-facing inventory; the READMEs are the end user's reference — they're not interchangeable. `/check` Step 4c enforces this bidirectionally — a skill added without a README row is a flagged finding.

After editing, run the state-based check pipeline: `/check` → `/patterns` → `/contracts` → `/coherence`. Each skill reports and does not fix. Fix findings between skills. All four are discovery-based and read from `docs/PATTERN-CATALOG.md` + `.claude/asymmetries/` as their source of truth — no hardcoded inventories.
