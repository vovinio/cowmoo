---
name: contracts
description: Semantic contract checks — op parameters match invocations, reader classifiers cover catchup handlers, state files have complete lifecycles, channel traces work end-to-end. Model-invokable after /patterns passes (propose, then run on user approval).
user-invocable: true
disable-model-invocation: false
---

# Contracts

Checks the class of bug that looks fine at the terminology level but is functionally broken. A skill writes a handoff entry missing a field its subcommand needs; a reader sub-agent classifies messages into fewer categories than `/catchup` can handle; a state file has readers but no writer; a channel trace has a broken link.

Run after `/check` passes. This skill assumes mechanical integrity (files exist, cross-references resolve). Contract checks reason about SEMANTIC fit — what the sender intends versus what the receiver accepts.

---

## Prerequisite

Read:

1. `docs/COMMUNICATION.md` — the authoritative list of cross-agent channels. Channel traces are discovered from this file, not hardcoded in this skill.
2. Each agent's CLAUDE.md "Files You Write" table (if present) — discovers the state files the lifecycle check traces.

---

## Section 1 — Handoff-entry contracts

Every git / GitHub write is a `dev-tools.cjs` subcommand a skill invokes directly (Pattern 6 — Delegated Write Operation). For a body-carrying op a skill first writes a JSON **handoff entry** to `cowmoo/agent-files/<agent>/.op-handoff.json`. The contract: each handoff entry carries the fields its subcommand requires, and the invoking skill runs the subcommand that entry's `op` belongs to. This section checks those inline `.op-handoff.json` entries. UXUI's split `/design-draft` → `/design-publish` flow is out of scope here — `/design-draft` composes and validates `design-draft.json` itself via `@design-task-checker`, so that handoff's field-contract is enforced there, not by this section.

### Discovery

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# Skill invocations of the body-carrying write subcommands (commit/push take
# inline args, no handoff entry — Checks A/B below do not apply to them)
rg -n --hidden 'dev-tools\.cjs"[[:space:]]+(issue-create|issue-edit-body|issue-transition|journal-update)' herd/*/.claude/skills/*/SKILL.md
# Handoff entries the skills compose (JSON objects carrying an "op" field)
rg -n --hidden '"op"[[:space:]]*:' herd/*/.claude/skills/*/SKILL.md
```

### Required fields per subcommand

| Subcommand | Handoff entry must carry |
|---|---|
| `issue-create` | `op`, `title`, `label`, `body` (optional `parent` — a story issue # — for the sub-issue link) |
| `issue-edit-body` | `op`, `issue`, `body` |
| `issue-transition` | `op`, `issue`, and at least one of `comment` / `removeLabel` / `addLabel` / `close` |
| `journal-update` | `op`, `ticket`, `domain`, `screen`, `date`, `summary` (UXUI only) |
| `commit` / `push` | no handoff file — inline args (`commit` takes a scope/mode + message; `push` takes none) |

### Checks

- **A — Missing required field.** A handoff entry a skill composes is missing a field its subcommand requires (e.g. an `issue-create` entry with no `label`, an `issue-transition` entry with only an `issue` and nothing to do). CRITICAL.
- **B — Subcommand mismatch.** The skill writes an entry whose `op` belongs to one subcommand but invokes a different one — creates route to `issue-create`, comment/relabel/close to `issue-transition`, body rewrites to `issue-edit-body`. CRITICAL.
- **C — Unreached subcommand (advisory).** A `dev-tools.cjs` subcommand defined for an agent but invoked by no skill. Might be dead, might be recently added. (`/check` Step 6 covers this mechanically.)

---

## Section 2 — Reader-classifier coverage

A `/catchup` that loads its inbox through a reader sub-agent (planner's `@plan-reader`, PM's `@inbox-reader`) depends on that reader classifying every arriving message into a category `/catchup` has a handler for. If the reader's category vocabulary is narrower than the handler set, a message in an unlisted category gets misclassified — or dropped — before `/catchup` ever triages it.

Producer→receiver channel pairing is *not* checked here — Section 5's channel trace covers it end-to-end on the `for-<target>` label axis. Section 2 checks only the reader→`/catchup` seam inside a single agent.

One thing neither section checks mechanically: an *orphan handler* — a `/catchup` `### category` handler that no message ever lands in. `/catchup` handlers are category-keyed (`Spec update`, `UI gap`, …) while channels and labels are `for-<target>`-keyed, so the two can't be paired by string match. A dead handler is left to `/audit-agent`'s judgement pass, which reads the skill in context. This is a deliberate scope boundary, not an oversight.

### Discovery

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# Handler headers in each /catchup. Keep only the message-category handlers
# — discard procedural sub-headers (the `1a`/`1b` inbox-loading steps,
# `Routing rule`, `Invoking RESOLVE_ISSUE`, and similar mechanics explainers).
grep -rnE '^### ' herd/*/.claude/skills/catchup/SKILL.md

# Category vocabulary each reader sub-agent classifies messages into.
# Catches both lowercase-hyphenated tokens (plan-reader: `**spec-updated** — …`)
# and prose-case labels (inbox-reader: `**Quick question** — …`). The same
# pattern also matches `## Rules` bullets (`**Flag blockers prominently** — …`)
# — keep only the lines in the reader's classification step, discard the rest.
# `task-reader.md` is matched by the *-reader.md glob, but builder has no
# `/catchup` — it has no reader→/catchup seam, so ignore it here.
grep -rnE '\*\*[A-Za-z][A-Za-z -]*\*\* — ' herd/*/.claude/agents/*-reader.md
```

### Check

- **Reader classifier gap.** A reader sub-agent's category list (e.g., in `plan-reader.md`) doesn't cover every message-category handler the owning agent's `/catchup` has. Messages in an uncovered category get misclassified or silently dropped before triage. CRITICAL.

An agent whose `/catchup` loads the inbox directly (`gh issue list`, no reader sub-agent — UXUI is the current instance) has no reader→`/catchup` seam; it has nothing to check in this section.

---

## Section 3 — State-file lifecycle

Every persistent state file should have a complete write → read → remove chain. Reader without writer = dead read. Writer without reader = unused state. Tracking file without remover = state leak.

### Discovery

State files are NOT hardcoded in this skill. They are discovered from the owning agent's CLAUDE.md "Files You Write" table and from dev-tools.cjs references.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# Files each agent writes (from CLAUDE.md tables)
for agent in pm uxui planner builder; do
  awk '/^## /{f=0} /^## Files You Write/{f=1} f' "herd/$agent/CLAUDE.md"
done

# File paths referenced in dev-tools.cjs
grep -rnoE "'[^']*\.(md|json|context)'" herd/*/tools/dev-tools.cjs
```

For each discovered file, classify each reference:

- **Writer** — `writeFileSync`, `appendFileSync`, `mkdirSync`, shell `>` / `>>`, CLI subcommands that write (`inbox add`), skill instructions to "create" or "write to".
- **Reader** — `readFileSync`, `existsSync` as a check, `inbox list`, instructions to "read" or "check".
- **Remover** — `unlinkSync`, `rm`, `inbox remove`, instructions to "delete".

### Checks

Distinguish three file kinds:

- **Tracking files** (multi-entry, transient): `.inbox-context`, `draft.md`, `deviations.md`, `active-task.md`, `techstack-notes.md`, `design-draft.json`. The file accumulates work that completes and is cleaned up. Expect writer + reader + remover.
- **Marker files** (single-value, overwrite-in-place): `.workflow-step`. A fresh write replaces old content; no explicit remover needed. Expect writer + reader only.
- **Writer-owned lifecycle files** (multi-entry, self-managed): `RESEARCH.md`, `BUILD-NOTES.md`, `knowledge.md`, `VISUAL-JOURNAL.md`. No explicit remover because the writer handles entry lifecycle directly. Sub-behaviors:
  - *Append-only* — writer only ever adds (`RESEARCH.md`).
  - *Dedup-append* — writer skips entries that exactly match an existing line (`knowledge.md`).
  - *Merge-and-prune* — writer combines overlapping entries and deletes superseded ones (`BUILD-NOTES.md`).
  - *Keyed upsert* — writer replaces the entry matching a key in place (`VISUAL-JOURNAL.md`, keyed by ticket number).
  
  Expect writer + reader; no remover check.

Classify each discovered file from two sources: the owning agent's CLAUDE.md "Files You Write" table (lifecycle column describes the intent), and the actual write / read / remove call sites in `dev-tools.cjs` and skill bodies:

- Explicit remove operation in the codebase (`unlinkSync`, `rm`, `inbox remove`, `clear-draft`, etc.) → tracking.
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
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
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
  it composes the handoff entry and invokes `issue-create` (a fresh issue) or
    `issue-transition` (a transfer relabel of an existing issue) →
      the handoff entry carries the expected `for-<target>` label →
        the issue ends up with that label (created fresh, or relabeled) →
          the receiver's /catchup reads that label →
            the handler for the category exists →
              the handler performs its response write (a `dev-tools.cjs` invocation)
```

**External-human channel** (declared exception in Pattern 13 — the Designer → UXUI row is the current instance):

```
Label exists in the receiver's github-workflow.md label table →
  the receiver's /catchup (or dispatched skill) handles that label →
    any response writes the handler performs are real `dev-tools.cjs` subcommand invocations
```

The sender-side steps are skipped because no sender skill exists on the curator side of an external-human handoff.

### Discovery

Channels are discovered from `docs/COMMUNICATION.md`'s Communication Channels table — NOT hardcoded in this skill. If a new channel is added to the doc, the trace covers it automatically.

```bash
# Extract the Communication Channels table rows
sed -n '/^## Communication Channels/,/^## /p' docs/COMMUNICATION.md | grep '^| '
```

For each row: parse the From / Label / Sender / Recipient columns.

- If the Sender cell names a skill (contains `/<name>`), walk the **agent-to-agent** chain above.
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
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
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
- **Severity ordering hint:** critical = missing handoff field, subcommand mismatch, dead read, reader classifier gap, broken channel trace, self-reference argument; advisory = unreached subcommand, sibling divergences, user-invokable-but-unmarked.

---

## Report

```
## Contracts Results

### Section 1: Handoff-Entry Contracts — [PASS / N findings]
### Section 2: Reader-Classifier Coverage — [PASS / N findings]
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
