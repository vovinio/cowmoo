---
name: scaffold-subagent
description: Generate a new sub-agent file for a herd agent with canonical frontmatter, Prerequisite block, and role-appropriate skeleton. Enforces pattern compliance at creation time.
user-invocable: true
disable-model-invocation: true
argument-hint: [agent] [sub-agent-name]
---

# Scaffold a Sub-Agent

Generate a new sub-agent that matches the canonical shape from `docs/PATTERN-CATALOG.md`. Scaffolding at creation time keeps the audit burden low — pattern compliance becomes a starting condition rather than something the curator has to enforce after the fact.

Use when adding a new sub-agent to any herd agent. For changes to an existing sub-agent, edit the file directly.

---

## Prerequisite

Read `docs/PATTERN-CATALOG.md` — at minimum Pattern 7 (Sub-Agent Read Pattern), Pattern 6 (Ops Agent), Pattern 8 (Proposal Writer), and Pattern 9 (Check Agent with Verifier). The skeleton you generate depends on which role category the user picks.

Read `.claude/asymmetries/<owning-agent>.md` — if the owning agent has declared asymmetries that affect sub-agent conventions (e.g., builder's exclusive use of the check-with-verifier pattern requiring a new `@check-*` sub-agent to feed into `@check-verify`), the scaffolding must respect them.

---

## Step 1 — Determine owning agent and name

If both arguments were provided (e.g., `/scaffold-subagent builder check-accessibility`), use them and skip the questions.

Otherwise, ask the user:

- **Owning agent** — `pm`, `uxui`, `planner`, or `builder`. (Curator-level sub-agents are rare; if the user asks for one, confirm it's not a herd agent first.)
- **Sub-agent name** — kebab-case, no leading `@`. Must not already exist.

Verify `herd/<agent>/.claude/agents/<name>.md` does not exist. If it does, stop and tell the user to either pick a different name or edit the existing file.

---

## Step 2 — Identify role category

Ask the user which role this sub-agent plays. The choice drives the template shape. Use `AskUserQuestion` with these options (recommended first):

| Option | When to pick | Pattern instantiated |
|---|---|---|
| **ops-gh** — ops agent touching GitHub | Creates/edits/closes issues, posts comments, changes labels | Pattern 6 + 14 + 15 |
| **ops-git** — ops agent touching git only | Stages and commits files; never touches GitHub | Pattern 6 (no Prerequisite) |
| **ops-other** — ops agent for a specialized write (bundle fetch, file attach, journal update) | Any scoped write that isn't pure git or pure GitHub | Pattern 6 (scoped variant) |
| **check** — read-only check agent running a gate check | `/review` parallel check agent; may apply a rule/template file (code-domain) or read project content directly (prose-domain) | Pattern 9 (+ Pattern 7 if a rule file is applied) |
| **check-verify** — verifier for a check-agent family | Takes findings from parallel check agents, re-examines in fresh context | Pattern 9 (verifier half) |
| **reader** — read-only data extractor | Reads files/GitHub, returns structured data, no judgment | Minimal (no Prerequisite unless reading rules) |
| **executor** — runs a specific command or tool | Wraps a concrete operation (test runner, Lighthouse, screenshot) | Minimal |
| **other** — doesn't fit the catalog | Novel role; the scaffold produces a minimal skeleton and flags it as a candidate for a new pattern | None — may evolve into one |

---

## Step 3 — Gather frontmatter details

Ask:

1. **One-line description** — what this sub-agent does. This goes into frontmatter `description:` and is what the parent agent sees when deciding whether to spawn. Be precise enough that the description alone distinguishes this sub-agent from siblings.
2. **Tools** — defaults by role:
   - `ops-gh`, `ops-git`, `ops-other`, `executor` → `Bash`
   - `check` → `Read, Glob, Grep`
   - `check-verify` → `Read, Glob, Grep` (plus `Bash` if it runs extra commands)
   - `reader` → depends on source: `Bash` for gh/CLI; `Read, Glob, Grep` for file reads
   - `other` → ask explicitly
3. **Model** — defaults by role:
   - `ops-*` → `sonnet`
   - `check` → `sonnet`
   - `check-verify` → `opus` (verification is judgment-heavy)
   - `reader`, `executor` → `sonnet`, or `haiku` if the work is mechanical
   - `other` → ask
4. **maxTurns** — default `20`; some executors need less (10), some ops with many operations need more (30).

---

## Step 4 — Prerequisite content (role-dependent)

Ask only if the role calls for it.

- **ops-gh** → Prerequisite reads `.claude/rules/github-workflow.md` for identity prefix + label definitions. No question — this is mandatory.
- **ops-git** → no Prerequisite. Confirm the sub-agent doesn't post comments or change labels (if it does, it's actually ops-gh).
- **ops-other** → ask whether the scoped write touches GitHub. Add Prerequisite only if yes.
- **check** → ask whether this agent applies a rule file or a shared template. If it does, Prerequisite Reads that file (Pattern 7). If the check works entirely against project content — comparing spec sections, validating a draft against a template the calling skill passes in, scanning code against the PRD — no Prerequisite is needed (Pattern 9 content-adjacent variant). Confirm with the user before omitting.
- **check-verify** → typically no Prerequisite unless it applies a specific rule itself; most verifiers re-derive judgment from the finding + source files.
- **reader**, **executor**, **other** → no Prerequisite unless the user names a specific rule.

---

## Step 5 — Role-specific details

**For ops-gh / ops-git / ops-other:**
- Ask the user to list the operation names (UPPER_SNAKE_CASE). Minimum one. Each becomes a `### <OP>` section with `**Input from <agent>:**`, Pre-check, Execute, Verify, Report subsections.
- For ops-gh specifically, ask which operations create issues — any issue-creating op (`CREATE_STORY`, `CREATE_TASK`, `CREATE_FOR_*`, `CREATE_DESIGN_TASK`, `CREATE_ISSUE`) needs Pattern 14's project-board linkage in its post-create step. Ask whether any create nested issues (story ↔ task) — those also need Pattern 14's sub-issue linkage (planner's `@plan-ops CREATE_TASK` is the reference).

**For check:**
- Ask which parallel family this belongs to (`/review`, `/define`, `/digest`, etc.). Look at the owning agent's CLAUDE.md "Available Agents" to see existing siblings and mirror the shape.
- Ask which severity categories the check produces — typically CRITICAL / HIGH / MEDIUM / LOW or CRITICAL / ADVISORY.

**For check-verify:**
- Ask which check family feeds into this verifier. The verifier's body should describe how to read each finding with fresh context and classify CONFIRMED / DISMISSED / REVISED.

**For reader / executor / other:**
- Ask for a short list of the input parameters the parent agent will pass and the output shape the parent expects back.

---

## Step 6 — Generate the file

Write to `herd/<owning-agent>/.claude/agents/<name>.md` with this skeleton (substitute `[PLACEHOLDERS]` with user input):

```markdown
---
name: [name]
description: [one-line description from Step 3]
tools: [tools]
model: [model]
maxTurns: [maxTurns]
---

# [Title-case name]

[One paragraph: what this sub-agent does and when the parent spawns it. Written for the LLM that's about to run it, not for a reader.]

## Environment

- `$PROJECT_DIR` — absolute path to the project root.
[- `$GH_REPO` — GitHub repo identifier (owner/repo). — include only if tools include Bash with gh]

## Prerequisite
[OMIT THIS SECTION if no Prerequisite per Step 4]

Read `.claude/rules/[rule-file].md` — [what the rule provides, in one line].
[Repeat the line for each rule this agent applies.]

## Process
[FOR check, reader, executor, other]

1. [First step — placeholder describing what to do first]
2. [Second step — placeholder]
3. [Report — describe the output shape expected by the parent agent]

## Operations
[FOR ops-gh, ops-git, ops-other — omit "## Process" section in that case]

The [owning agent] tells you which operation(s) to perform and provides the necessary context. Execute them in order. **Verify each step before proceeding to the next.**

---

### [OP_NAME]

[One-line description.]

**Input from [owning-agent]:** [parameter names]

**Pre-check:**
```bash
[check whether the operation is a no-op]
```

**Execute:**
```bash
[the actual command(s), using git -C "$PROJECT_DIR" for git]
```

**Verify:**
```bash
[command(s) that confirm the effect landed]
```

**Report:** `[OP_NAME]: ✓ <short summary>`

[Repeat ### OP_NAME section for each operation listed in Step 5.]

---

## Rules

[Role-specific invariants:]
[- ops: explicit paths only; git -C "$PROJECT_DIR" always; heredoc for bodies; identity prefix from github-workflow.md (if ops-gh).]
[- check: return findings, do not fix. Severity categories: [list from Step 5].]
[- check-verify: classify each finding CONFIRMED / DISMISSED / REVISED with concrete reasons.]
[- reader/executor: do not mutate state.]
```

Leave placeholders (`[...]`, `PLACEHOLDER`) intact where the user must fill in work-specific content — these are the parts scaffolding cannot generate. The user edits the file after this skill finishes.

---

## Step 7 — Register in CLAUDE.md

Add a stub line to the owning agent's CLAUDE.md "Available Agents" section. Find the existing section (grep for `^## Available Agents` in `herd/<agent>/CLAUDE.md`), then insert a line of the form:

```markdown
- `@[name]` — [description from Step 3].
```

Alphabetical order within the section is preferred but not required — match the existing file's ordering convention.

---

## Step 8 — Confirm and show next steps

Report:

```
Scaffolded herd/<agent>/.claude/agents/<name>.md

Next steps:
1. Edit the file to fill in work-specific content at the [PLACEHOLDER] markers.
2. [If ops] Implement each ### <OP> section's Execute and Verify blocks.
3. [If check] Write the actual check logic in the Process section.
4. [If the sub-agent reads a new rule file] Verify the rule file exists at .claude/rules/<rule>.md.
5. Run `/check` to verify the generated file's syntax and cross-references, then `/patterns` to confirm it matches the canonical shape for its role.
```

---

## Rules

- **Don't invent work-specific content.** The scaffold produces canonical structure only. The parts requiring judgment (which files to read, what logic to apply, what errors to catch) are left as placeholders for the user.
- **Never overwrite an existing file.** If the target exists, stop and report — don't silently replace.
- **Respect declared asymmetries.** Read `.claude/asymmetries/<agent>.md` before generating. If the asymmetry changes what's canonical for this agent (e.g., builder's `@check-*` agents must feed into `@check-verify`), follow the asymmetry.
- **When role is `other`, flag it.** The final Confirm message should say: "Role `other` suggests this sub-agent may not fit an existing pattern. If it becomes a recurring shape across agents, propose adding it to PATTERN-CATALOG.md via `/propose` (at curator level: add directly)."
- **One sub-agent per invocation.** Don't batch — each sub-agent deserves its own decision pass.
