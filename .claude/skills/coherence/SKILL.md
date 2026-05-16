---
name: coherence
description: Runtime-coherence checks — tool availability vs configured mode, environment assumptions, rule-command alignment, execution order sanity. Model-invokable after /contracts passes (propose, then run on user approval).
user-invocable: true
disable-model-invocation: false
---

# Coherence

Catches the class of bug where everything is internally consistent but functionally wrong at runtime: an agent declares an MCP tool its configured mode doesn't provide, a skill assumes a headless browser when it needs visual reasoning, rule text references the wrong tool's commands, or numbered steps depend on each other's output in reverse order.

Run after `/check`, `/patterns`, and `/contracts` pass. The other three verify structural and semantic integrity; this one verifies the system actually works at runtime.

---

## Section 1 — Tool availability vs configured mode

Every MCP tool an agent declares (in sub-agent `tools:` frontmatter, skill `allowed-tools:`, or agent body) must be provided by a configured MCP server.

### Discovery

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# MCP servers configured at project level (gitignored; may be absent)
for f in herd/*/.mcp.json; do [ -f "$f" ] && echo "$f:"; [ -f "$f" ] && jq -r '.mcpServers | keys[]' "$f" 2>/dev/null; done

# Allow-rules in settings.json (permissive declarations regardless of server state)
grep -h "mcp__" herd/*/.claude/settings.json | sort -u

# Tool references in sub-agent and skill files
rg -o "mcp__[a-z-]+__[a-z_]+" herd/*/.claude/agents/*.md herd/*/.claude/skills/*/SKILL.md | sort -u
```

### Checks

- **A — Referenced MCP server absent.** Sub-agent declares `mcp__<server>__*` tools but no project-level `.mcp.json` provides that server. If the agent has a runtime guard (grep for "SKIP", "not available", "not enabled", "requires `moo") → ADVISORY. If no guard → CRITICAL.
- **B — Unknown server.** A server name appears in agent/skill files that isn't in any `.mcp.json` or the CLI-enabled opt-in set. ADVISORY: "Unknown MCP server `<name>`. Is this a new server we need to account for, or stale reference?"
- **C — Skill body references a tool by bare name** (e.g., a backticked `lighthouse_audit` without the full `mcp__...` prefix). Cross-reference against the agent's declared tool prefix set.

Note: user-level MCP config (`~/.claude/.mcp.json`) and plugin MCPs can't be verified from the project. When project-level config is missing but settings.json allows the tool, report ADVISORY, not CRITICAL.

---

## Section 2 — Environment assumption coherence

Skills and agents that assume environment state (headless/headed browser, auth file present, dev server running) must either verify the assumption or have a fallback path.

### Discovery

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
rg -n "(--headless|--headed|--persistent|state-load|state-save|\.auth/|detect-dev-servers|localhost:[0-9]+|--chrome)" \
   herd/*/.claude/agents/*.md herd/*/.claude/skills/*/SKILL.md
```

### Checks

- **A — Headless + visual reasoning.** An agent uses `--headless` AND its instructions ask the LLM to visually analyze a screenshot (look at colors, assess layout, etc.). This is different from saving screenshots to disk for evidence — the latter is fine headless. Detection: `--headless` AND prose like "Look at the screenshot to determine…", "Read the screenshot to assess…".
- **B — Auth without fallback.** A skill references `state-load` or `.auth/` without an "if not found" path.
- **C — Dev server without detection.** A hardcoded `localhost:NNNN` outside a code block / example, without a preceding `detect-dev-servers` call.
- **D — Unknown CLI flag.** A `playwright-cli` command uses a flag not in the canonical flag set. Specifically: `--filePath` is a common mistake — the real flag is `--filename`. Flag `--filePath` as CRITICAL.

---

## Section 3 — Rule-command alignment

When instruction text mentions a specific command or tool, the syntax must match the browser/CLI tool the agent actually uses — not a different one's.

### Discovery

For each agent with browser capability, identify which tool family its declared tools belong to:

- Contains `playwright-cli` or `Bash(playwright-cli *)` → Playwright CLI
- Contains `mcp__claude-in-chrome__*` → Claude in Chrome (built-in)
- Contains `mcp__chrome-devtools__*` → Chrome DevTools MCP

### Checks

- **A — Browser command mismatch.** An agent on Playwright CLI whose instructions reference Chrome-in-Chrome tools (`read_page`, `computer`, `navigate`, `javascript_tool`, `find`), or vice versa. CRITICAL.
- **B — dev-tools.cjs subcommand mismatch.** Every `node tools/dev-tools.cjs <sub>` in a skill or agent file references a subcommand that exists in that agent's `dev-tools.cjs`. This is the reverse of `/check` Step 6 — that one checks "does every case have a caller?"; this one checks "does every call have a case?".

---

## Section 4 — Execution order sanity

Skills with numbered steps must respect their dependencies. A step that references output from a later step, a gate that fires after what it's supposed to gate, a subagent spawned out of order — all bugs.

Semi-automated: this section requires the LLM to read each skill's prose and reason about data flow. Pattern-matching alone can't detect it.

### Process

1. Find skills with numbered steps:
   ```bash
   setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
   grep -rnE '^## (Step|Phase) [0-9]' herd/*/.claude/skills/*/SKILL.md
   ```
2. For each, build a mental model: what each step needs as input, what it produces as output.
3. Check:
   - **A — Forward dependency.** Step N references output from Step M where M > N. CRITICAL.
   - **B — Gate violation.** A gate clause ("Only proceed if X returned PASS", "must PASS before") appears AFTER the steps it gates, or references an output from a later step.
   - **C — Sequential subagent spawns with mis-ordered I/O.** Skill spawns two sub-agents in sequence; the first's output is supposed to feed the second, but the second is spawned without the first's output being in scope.
   - **D — Parallel subagents writing same file.** Skill spawns two sub-agents in parallel, both write to the same output path. Race condition.

This section is judgment-heavy. Take time; don't pattern-match.

---

## Finding Format

Every actionable finding uses the canonical four-part shape — see `.claude/templates/finding-format.md`.

---

## Verification phase

Run the canonical verification phase. Read `.claude/templates/verification-phase.md` and follow its procedure with:

- **Source skill name:** `/coherence`
- **Severity ordering hint:** critical = runtime failures with no guard (missing MCP server, auth without fallback, `--filePath`), broken CLI flag, forward dependencies, parallel write collision; advisory = documented workarounds, unknown server, sibling divergence.

---

## Report

```
## Coherence Results

### Section 1: Tool Availability — [PASS / N findings]
### Section 2: Environment Assumptions — [PASS / N findings]
### Section 3: Rule-Command Alignment — [PASS / N findings]
### Section 4: Execution Order — [PASS / N findings]

### Verification
<standard block from the verification template>
```

**Next:** If clean, the four structural skills (`/check`, `/patterns`, `/contracts`, `/coherence`) have all passed. Consider running `/audit-agent <name>` for a per-agent deep review when an agent has had substantial changes.

---

## Rules

- **Tool-tool mismatches are always critical.** A Playwright-CLI agent being told to use Chrome-in-Chrome tools will fail at runtime, no ambiguity.
- **Section 4 is the one place in the curator where pattern-matching isn't enough.** The LLM has to read each skill and reason about data flow. Budget for it.
- **No Self-Test section.** Correctness is the pattern catalog's correctness, not a pinned snapshot.
