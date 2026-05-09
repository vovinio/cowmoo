---
name: contracts
description: Semantic contract checks — op parameters match invocations, handlers have producers, state files have complete lifecycles, channel traces work end-to-end. Model-invokable after /patterns passes (propose, then run on user approval).
user-invocable: true
disable-model-invocation: false
---

# Contracts

Checks the class of bug that looks fine at the terminology level but is functionally broken. A skill spawns an ops operation with the wrong parameters; a `/catchup` handler exists but nothing sends that category of message; a state file has readers but no writer; a channel trace has a broken link.

Run after `/check` passes. This skill assumes mechanical integrity (files exist, cross-references resolve). Contract checks reason about SEMANTIC fit — what the sender intends versus what the receiver accepts.

---

## Prerequisite

Read:

1. `docs/COMMUNICATION.md` — the authoritative list of cross-agent channels. Channel traces are discovered from this file, not hardcoded in this skill.
2. Each agent's CLAUDE.md "Files You Write" table (if present) — discovers the state files the lifecycle check traces.

---

## Section 1 — Op parameter contracts

Every `@<agent>-ops OPERATION` invocation in a skill must pass only parameters the operation declares in its `**Input from <agent>:**` line.

### Discovery

```bash
# Invocations across all skills
grep -rnE '@[a-z-]+-ops[^)]* [A-Z][A-Z_]{2,}' herd/*/.claude/skills/*/SKILL.md

# Operations and their Input declarations
grep -rnE '^### [A-Z_]+$' herd/*/.claude/agents/*-ops.md
grep -rnE '\*\*Input from [A-Za-z]+:\*\*' herd/*/.claude/agents/*-ops.md
```

### Checks

- **A — Missing operation.** Every invocation's operation name must exist as a `### OP_NAME` header in the referenced ops agent file. Missing = CRITICAL.
- **B — Extra parameter.** Every parameter the invocation passes must appear in the op's Input line. An invocation passing `action: close` to an op whose Input line is `issue number, resolution summary` is a bug.
- **C — Unused operation (advisory).** Ops defined in an ops agent but never invoked by any skill. Might be dead code; might be recently added.

---

## Section 2 — Handler–producer pairing

Every message category a `/catchup` (or reader sub-agent) handles must have at least one producer sending that category. And vice versa: every category a sender's compose skill produces must have a handler on the receiver side.

### Discovery

```bash
# Categories handled in each /catchup
grep -rnE '^### ' herd/*/.claude/skills/catchup/SKILL.md

# Categories sent by each compose skill
grep -rnE '^### `for-' herd/*/.claude/skills/notify/SKILL.md herd/*/.claude/skills/ask/SKILL.md

# Reader sub-agents that classify messages
grep -rnE '\*\*[a-z-]+\*\* — ' herd/*/.claude/agents/*-reader.md
```

### Checks

- **A — Orphan handler.** `/catchup` handles a category but no producer sends it. Dead code.
- **B — Silent drop.** A compose skill produces a category but no receiver handles it. Messages arrive and vanish.
- **C — Reader classifier gap.** A reader sub-agent's category list (e.g., in `plan-reader.md`) doesn't cover all the categories the receiver's `/catchup` handles. Arrivals get misclassified.

---

## Section 3 — State-file lifecycle

Every persistent state file should have a complete write → read → remove chain. Reader without writer = dead read. Writer without reader = unused state. Tracking file without remover = state leak.

### Discovery

State files are NOT hardcoded in this skill. They are discovered from the owning agent's CLAUDE.md "Files You Write" table and from dev-tools.cjs references.

```bash
# Files each agent writes (from CLAUDE.md tables)
for agent in pm uxui planner builder; do
  awk '/^## Files You Write/,/^## /' "herd/$agent/CLAUDE.md"
done

# File paths referenced in dev-tools.cjs
grep -rnoE "'[^']*\.(md|json|context)'" herd/*/tools/dev-tools.cjs
```

For each discovered file, classify each reference:

- **Writer** — `writeFileSync`, `appendFileSync`, `mkdirSync`, shell `>` / `>>`, CLI subcommands that write (`inbox add`), skill instructions to "create" or "write to".
- **Reader** — `readFileSync`, `existsSync` as a check, `inbox list`, instructions to "read" or "check".
- **Remover** — `unlinkSync`, `rm`, `inbox remove`, `inbox clear`, instructions to "delete".

### Checks

Distinguish three file kinds:

- **Tracking files** (multi-entry, transient): `.inbox-context`, `draft.md`, `deviations.md`, `active-task.md`, `techstack-notes.md`, `design-draft.md`. The file accumulates work that completes and is cleaned up. Expect writer + reader + remover.
- **Marker files** (single-value, overwrite-in-place): `.workflow-step`. A fresh write replaces old content; no explicit remover needed. Expect writer + reader only.
- **Writer-owned lifecycle files** (multi-entry, self-managed): `RESEARCH.md`, `BUILD-NOTES.md`, `knowledge.md`, `VISUAL-JOURNAL.md`. No explicit remover because the writer handles entry lifecycle directly. Sub-behaviors:
  - *Append-only* — writer only ever adds (`RESEARCH.md`).
  - *Dedup-append* — writer skips entries that exactly match an existing line (`knowledge.md`).
  - *Merge-and-prune* — writer combines overlapping entries and deletes superseded ones (`BUILD-NOTES.md`).
  - *Keyed upsert* — writer replaces the entry matching a key in place (`VISUAL-JOURNAL.md`, keyed by ticket number).
  
  Expect writer + reader; no remover check.

Classify each discovered file from two sources: the owning agent's CLAUDE.md "Files You Write" table (lifecycle column describes the intent), and the actual write / read / remove call sites in `dev-tools.cjs` and skill bodies:

- Explicit remove operation in the codebase (`unlinkSync`, `rm`, `inbox remove`, `inbox clear`, `clear-draft`, etc.) → tracking.
- Writer always overwrites the entire file with a single scalar → marker.
- Writer appends / upserts / merges with no corresponding remove call, and the CLAUDE.md lifecycle says persists-across-sessions → writer-owned lifecycle.

Findings:

- **A — Dead read** (any file with readers but no writer): CRITICAL.
- **B — Unused state** (any file with writer but no reader): ADVISORY.
- **C — State leak** (tracking file with writer + reader but no remover): CRITICAL. Marker files and writer-owned-lifecycle files are exempt from this check — their lifecycle is self-managed or single-value by construction.

---

## Section 4 — Semantic argument-name check

Skill argument values must name real agents AND must not name the skill's own owning agent.

### Discovery

```bash
grep -rnE '^argument-hint: ' herd/*/.claude/skills/*/SKILL.md
```

Parse each value set (e.g., `<pm | uxui>` → `{pm, uxui}`).

### Checks

- **A — Unknown value.** Every argument value that looks like an agent name must match one of `{pm, uxui, planner, builder}`. Non-agent args (`<issue-number>`, `<folder>`, `<url>`) are fine as long as they're clearly not agent names.
- **B — Self-reference.** A skill at `herd/<X>/.claude/skills/<skill>/SKILL.md` MUST NOT have `<X>` as an argument value. An agent cannot send a message to itself.
- **C — Sibling divergence (advisory).** Skills sharing a name across agents (`/notify`, `/ask`, `/catchup`) should have similar arg shapes unless the difference is intentional. Surprising divergences deserve a comment in the skill explaining why.

---

## Section 5 — Channel trace (end-to-end)

For each channel documented in `docs/COMMUNICATION.md`, verify every link exists. Two chain shapes:

**Agent-to-agent channel** (standard — Pattern 13 canonical shape):

```
Sender skill file exists →
  it spawns the expected ops operation →
    the operation exists in the ops agent file →
      the operation creates an issue with the expected label →
        the receiver's /catchup reads that label →
          the handler for the category exists →
            the handler references a response op →
              the response op exists
```

**External-human channel** (declared exception in Pattern 13 — the Designer → UXUI row is the current instance):

```
Label exists in the receiver's github-workflow.md label table →
  the receiver's /catchup (or dispatched skill) handles that label →
    any response ops named in the Recipient column exist in the receiver's ops agent(s)
```

The sender-side steps are skipped because no sender skill exists on the curator side of an external-human handoff.

### Discovery

Channels are discovered from `docs/COMMUNICATION.md`'s Communication Channels table — NOT hardcoded in this skill. If a new channel is added to the doc, the trace covers it automatically.

```bash
# Extract the Communication Channels table rows
sed -n '/^## Communication Channels/,/^## /p' docs/COMMUNICATION.md | grep '^| '
```

For each row: parse the From / Label / Sender / Recipient columns.

- If the Sender cell names a skill (contains `/<name>`) or an ops reference (contains `@<agent>-ops`), walk the **agent-to-agent** chain above.
- If the Sender cell names an external-human actor (contains "Human" or "external" — the Designer → UXUI row is the canonical case), walk the **external-human** chain above.

### Finding

A broken link at any step = the channel is half-wired. Report the step where the trace breaks:

```
Channel: <From> → <To>
  FAIL at step <N>: <what was expected> / <what was found>
```

---

## Section 6 — Sub-agent liveness

Every sub-agent listed in an agent's CLAUDE.md "Available Agents" must be spawned from somewhere (skill body, other sub-agent, or main agent flow) OR must be explicitly marked user-invokable. Sub-agents that exist but are never called rot quietly.

### Discovery

```bash
# Declared sub-agents
rg "^- \`@[a-z-]+\`" herd/*/CLAUDE.md

# Spawn references
rg "@[a-z-]+\b" herd/*/.claude/skills/ herd/*/.claude/agents/ herd/*/CLAUDE.md
```

### Checks

- **A — Zero invocations.** Sub-agent declared but never spawned and not marked user-invokable. CRITICAL if the CLAUDE.md description implies automated use; ADVISORY if it's ambiguous.
- **B — User-invokable but unmarked.** Not spawned automatically AND the description doesn't say "user-invokable". Advisory — tighten the description.
- **C — Dangling spawn.** `@<name>` referenced but no corresponding agent file exists. CRITICAL (also caught by `/check` Step 4 — included here for the inverted direction).

---

## Finding Format

Every actionable finding uses the canonical four-part shape — see `.claude/templates/finding-format.md`.

---

## Verification phase

Run the canonical verification phase. Read `.claude/templates/verification-phase.md` and follow its procedure with:

- **Source skill name:** `/contracts`
- **Severity ordering hint:** critical = missing op, dead read, orphan handler, broken channel trace, self-reference argument; advisory = unused ops, sibling divergences, user-invokable-but-unmarked.

---

## Report

```
## Contracts Results

### Section 1: Op Parameter Contracts — [PASS / N findings]
### Section 2: Handler-Producer Pairing — [PASS / N findings]
### Section 3: State-File Lifecycle — [PASS / N findings]
### Section 4: Semantic Argument Names — [PASS / N findings]
### Section 5: Channel Traces — [X of Y channels PASS, Z FAIL]
### Section 6: Sub-Agent Liveness — [PASS / N findings]

### Verification
<standard block from the verification template>
```

**Next:** If clean, continue with `/coherence`. If confirmed findings need fixing, fix and re-run.

---

## Rules

- **Channels come from the doc, not the skill.** If a new channel is added, update `docs/COMMUNICATION.md` — this skill discovers it automatically.
- **State files come from CLAUDE.md tables and dev-tools.cjs, not hardcoded lists.** Adding a new tracked file means updating the owning CLAUDE.md's "Files You Write" table; this skill finds it.
- **No Self-Test section.** Correctness is the catalog's correctness, not a pinned snapshot.
