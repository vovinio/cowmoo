---
name: audit-agent
description: Deep per-agent audit. Fully reads every file for one herd agent, then runs 6 substantive checks — hidden assumptions, rule-vs-rule coherence, liveness, end-to-end flows, cross-boundary consumption, and honest review (including scope drift). Catches semantic and logical issues the structural pipeline (check/patterns/contracts/coherence) is blind to.
user-invocable: true
disable-model-invocation: true
argument-hint: <pm | uxui | planner | builder>
---

# Audit Agent — Deep Per-Agent Review

Runs a deep audit on a single herd agent. Fully reads every file for that agent, then walks 6 substantive steps (Steps 2–7): hidden assumptions, rule contradictions, dead components (liveness), end-to-end flow fragility, cross-boundary consumption mismatches, and honest review (where scope drift is surfaced).

**This is not a quick check.** It expects complete reads, not sampling. Budget for a long single run. Use it after significant work on one agent, or when something feels off about an agent's behavior, or on a scheduled cadence — not before every commit.

**Scan and triage — never fix directly.** The skill detects findings, verifies them, then walks the user through each one interactively to collect a decision. It never edits agent code itself — fixes the user approves are applied afterward by the curator as a normal herd edit (and run through the structural pipeline).

## Relationship to the structural pipeline

- `/check`, `/patterns`, `/contracts`, `/coherence` — check structural integrity across all 4 agents. Fast. Cover syntax and cross-references, canonical pattern shape, semantic contracts, runtime coherence. Passing all four means "structurally intact" — not "correct."
- `/audit-agent <name>` — focused on one agent. Slow. Covers the class of issue the structural pipeline is blind to: semantic correctness of operations, logical consistency between rules, unstated assumptions, fragility under edge cases, scope/mandate drift, honest quality review.

Run the structural pipeline on every significant change. Run `/audit-agent` less often, but go deep when you do.

---

## Argument

`<agent>` — one of `pm`, `uxui`, `planner`, `builder`. Required. The skill targets a single herd agent and reads only its files.

---

## Step 1 — Full comprehension

**Goal:** before any checks, build a complete mental model of what the agent does, how its pieces fit together, and what it's responsible for.

Read every file, fully. Not partial reads. Not sampling. Not "I'll grep for what I need." The whole point of this skill is that deep context catches what shallow checks miss.

For the target agent, read in this order:

1. `.claude/audit-decisions/<agent>.md` — **read this FIRST.** Entries here are findings prior audits evaluated and decided were NOT bugs. Load them before building your mental model so you don't re-raise them in Steps 2-7.
2. `herd/<agent>/CLAUDE.md` — philosophy, scope, workflow, roster.
3. `herd/<agent>/.claude/output-styles/*.md` (if present) — tone/writing behavior reinforcing CLAUDE.md.
4. `herd/<agent>/.claude/rules/*.md` — every always-loaded rule.
5. `herd/<agent>/.claude/skills/*/SKILL.md` — every skill body. Also read `references/*.md` for each skill that has them.
6. `herd/<agent>/.claude/agents/*.md` — every sub-agent body.
7. `herd/<agent>/tools/dev-tools.cjs` — CLI extras.
8. `herd/<agent>/tools/statusline.sh` — display logic.
9. `herd/<agent>/.claude/settings.json` — permissions, hooks, env.

If `audit-decisions/<agent>.md` does not exist, proceed without it (first audit of this agent) — but expect to add entries there as findings get resolved as "not a bug" during review.

After reading, before running any check, write a 10-line mental model **as a working note** — it grounds Steps 2–7 but is never shown to the user; the Step 9 walkthrough delivers only the findings:

- **Agent's mandate** (1 line) — what problem does it solve for the user?
- **Core flow** (1 line) — happy path from session start to done.
- **Input surfaces** (2 lines) — what inputs arrive, from which channels, in what shape.
- **Output surfaces** (2 lines) — what outputs leave, to which destinations, in what shape.
- **Key invariants** (2 lines) — things that must always be true (e.g., "tests written before implementation" for builder).
- **Known tradeoffs** (2 lines) — deliberate design choices with costs (e.g., "120s test timeout accepts that slow suites don't fit").

The rest of the steps reference this model. If you can't write it confidently, go back and re-read — don't fake depth.

---

## Step 2 — Hidden-assumption audit

**Goal:** surface unstated assumptions baked into operations, skills, and rules. The ones that break when they meet a project that violates them.

For each `dev-tools.cjs` write subcommand the agent defines, each skill, and each rule, ask:

*Note:* write operations are `dev-tools.cjs` subcommands — `commit`, `push`, `issue-create`, `issue-transition` for every agent, plus planner's `issue-edit-body` and uxui's `journal-update`. Enumerate them from the dispatcher `case` labels, not from sub-agent `### OP` sections (there are no ops sub-agents).

1. What languages/frameworks/project layouts does this assume?
2. What project state does it assume (non-empty, has tests, has CI, has a specific directory layout)?
3. What external tool availability does it assume (`gh`, specific MCP, auth)?
4. What user environment does it assume (macOS, bash, specific shell extensions)?

A good hidden-assumption finding names the assumption **and the concrete state where it breaks**.

**Reference case (historical — already fixed):** An earlier version of the builder's `commit` `code` scope staged only `"$SOURCE_DIR/"` (a single configurable code subdir). Assumption: tests live under `$SOURCE_DIR` (JS co-location pattern). Broke on Python (`tests/` at repo root), Rust (integration `tests/`), Go (many layouts). For a TDD-first agent, "commit writes only the `src/` part of the test cycle" was a real bug. Current design stages by exclusion (`git add . ':(exclude)cowmoo'`), which captures the full product tree regardless of layout. Audit this class of failure mode — single-path assumptions that don't survive language-convention variance.

**Check each of these loci:**

- `dev-tools.cjs` write subcommands — especially any that stage, commit, or filter paths
- Skill prerequisites — "the project must have X"
- Rule applicability — "always do X" assumes X is applicable everywhere
- dev-tools.cjs helper functions — hardcoded ports, paths, or patterns
- Session-start hooks — what if the label doesn't exist yet?

**Report each finding as:**

```
**[Unstated assumption — one line]**

What the assumption is. Where it lives (file:line). What concrete project state breaks it. Whether the breakage is silent (wrong behavior) or loud (error).

Fix: broaden the op, make the assumption explicit, or document the scope.
```

---

## Step 3 — Rule-vs-rule logical coherence

**Goal:** find contradictions between rules, or between a rule and a check-agent criterion, that only surface in specific states.

For each pair of rules (and each rule + check-agent criterion pair), walk these concrete states and ask whether they agree:

- **Greenfield** — first task of this type ever, no prior conventions established
- **First-of-X** — first time introducing a new kind of thing (first frontend page, first API endpoint, first test framework)
- **Non-default project** — non-JS language, monorepo, custom test runner
- **State after intentional deviation** — user explicitly approved something a rule flags
- **Conflicting rules in the same domain** — two rules about the same concern (e.g., two rules about icons, two about error handling)

**Reference case:** `frontend.md:13` says "Use the project's icon set (Heroicons, Lucide, etc)." `@check-design` (via `check-design.md:77`) flags "No new icon packages introduced — grep the changed files for new imports from `lucide-react`, `@heroicons/*`..." On the first frontend task, there IS no existing icon set, so introducing one always trips the finding. The escape valve (log as deviation in `deviations.md`) works but friction is real. Worth an explicit first-import exemption or a BUILD-NOTES-driven sanctioned-set rule.

**Report each finding as:**

```
**[Contradiction — one line naming the two rules]**

Rule A says X (file:line). Rule B says Y (file:line). In state S, A and B disagree — following A violates B and vice versa. Describe the state concretely.

Fix: reconcile the rules, or add an explicit exemption in one for the state where they collide.
```

---

## Step 4 — Liveness

**Goal:** registered components (skills, sub-agents, rules, operations, subcommands) are actually wired to something upstream and useful downstream.

This overlaps with `/contracts` Section 6 (Sub-agent Liveness) but goes deeper — check all components, not just sub-agents, and reason about whether their use justifies their presence.

**For each component:**

1. **Sub-agents in `CLAUDE.md` "Available Agents"** — is `@<name>` spawned by at least one skill, sub-agent, or main-agent flow? If not, is it clearly labeled user-invokable?
2. **Skills in `CLAUDE.md` "Available Skills"** — is the skill referenced by any workflow, or purely user-invoked? Either is fine, but the description should match.
3. **Rules in `.claude/rules/`** — is each rule Read explicitly by at least one sub-agent (for canonical-content rules), or always-loaded for the main agent (for agent-behavior rules)? An always-loaded rule that nothing applies is dead weight.
4. **dev-tools.cjs subcommands** — is each `case '<x>':` invoked by at least one skill, sub-agent, hook, or statusline? (Sub-agent files are a valid caller location — see `/check` Step 6. Overlaps with `/contracts` Section 1 Check C but repeat it here in the context of the full model.)

**Liveness pattern to look for:** a sub-agent named in CLAUDE.md "Available Agents" but absent from every skill body, sub-agent body, and Process section. Either fix by wiring it into a workflow or relabel the CLAUDE.md entry as user-invokable. (Historical example: `@auditor` and `@auditor-quick` once fit this shape; they're now auto-invoked from `/review` Step 1b — verified before raising similar findings.)

**Report format same as `/contracts` Section 6 (Sub-agent Liveness), extended to cover all component types (sub-agents, skills, rules, dev-tools subcommands).**

---

## Step 5 — End-to-end flow walkthrough

**Goal:** for each core skill, walk the happy path AND enumerate failure branches. The happy path usually works; the edge cases reveal fragility.

**For each core skill** (the ones in `SEQUENCE` / `SEQUENCES` in `dev-tools.cjs`):

1. **Happy path** — user invokes, skill reads prerequisites, spawns sub-agents, calls ops, writes outputs, returns. Confirm every named component exists.
2. **Failure branches** — enumerate ways the path can fail or take unexpected turns. For each:
   - What does the skill do? (explicit handling / silent drop / error / hang)
   - Is the handling documented or implicit?
   - Does the user get a clear next action or a dead end?

**Edge states to consider per skill** (walk each one, not just the obvious):

- Missing prerequisite (no PRD, no spec, no task, empty inbox)
- State file corrupt (JSON parse fails, wrong schema)
- Sub-agent returns unexpected shape (timeout, parse error, partial output)
- Op fails (network, auth, label mismatch, verification fails)
- Two concurrent invocations (what if two sessions race?)
- Skill invoked out of workflow order
- User interrupts mid-skill

**Reference pattern:** a skill that says "If no task found, stop" is PASS. A skill that assumes a task exists and blows up on null is a finding.

**Report per skill:**

```
### Skill: /<name>

**Happy path:** <one line>
**Handled edge cases:** [list]
**Unhandled edge cases:** [list with severity]
```

---

## Step 6 — Cross-boundary consumption

**Goal:** for every input this agent consumes (from another agent, from the user, from external tools), verify the producer's shape matches the consumer's expectation.

This agent is a *consumer* of:

- GitHub issues on `for-<agent>` label — produced by other agents' ops
- Task PRDs (if builder/planner) — produced by planner's `/publish`
- `cowmoo/design/` files (if builder/planner) — produced by UXUI's `/publish`
- `cowmoo/specs/` files (if planner/uxui/builder) — produced by PM's `/publish`

**For each consumption point:**

1. What does the consumer expect? (Read the consuming skill/sub-agent carefully.)
2. What does the producer actually produce? (Read the producing skill/sub-agent carefully.)
3. Do they match — field names, format, content, encoding, edge cases?
4. What happens if the producer's output is missing, malformed, or unexpectedly structured?

**Reference case:** builder's `@check-design` consumes `cowmoo/design/OVERVIEW.md`, `cowmoo/design/roles.md`, and `cowmoo/design/domains/*.md`. The agent expects role-name references (never raw values) and state documentation per screen. UXUI's `/define` produces exactly that shape — but only when `ui-vocabulary.md` has been applied. If a UXUI task skipped the vocabulary step, domain files may have raw values and `@check-design` fails silently.

**Report per consumption point:**

```
### Consuming: <source>

- **Expected shape:** <describe>
- **Actual shape:** <describe>
- **Match:** <PASS / MISMATCH — where>
- **Robustness:** <what the consumer does on malformed input>
```

---

## Step 7 — Honest review

**Goal:** deliberately step outside the structured checks and ask what's genuinely wrong or weak that nobody's noticed.

The previous steps mostly surface specific, testable issues. This step is for the unstructured kind — operations that are too rigid, missing features that the mandate implies, scope drift, fragile flows, stale assumptions, things that work but feel wrong.

**Questions to hold honestly:**

1. **Does the agent fully deliver on its stated mandate?** Read CLAUDE.md's opening. Is there a gap between what it claims to do and what its skills actually cover?
2. **Are there operations the agent should have but doesn't?** (E.g., if builder claims "RED-GREEN-REFACTOR" but has no explicit refactor step, that's a gap.)
3. **Are there operations the agent has but shouldn't?** (Scope creep — features that expanded beyond the original mandate.)
4. **Is any flow fragile in a way that will hurt real users?** Flaky sub-agents, tight timeouts, assumptions about network/MCP availability.
5. **Is any rule overgeneralized?** ("Always do X" where "X" only makes sense in some contexts.)
6. **Is any rule undergeneralized?** ("When you see X, do Y" where the principle should apply more broadly.)
7. **Are there clear usability problems?** Commands that are hard to remember, arguments that are easy to mis-type, error messages that don't say what to do next.
8. **Is any documentation stale or inconsistent with behavior?** CLAUDE.md describes flow A, but skills implement flow B.

This step requires **judgment**, not pattern matching. Take the time. The previous 6 steps built the context for this one — use it.

**Report:**

```
### Honest Review

**Mandate gaps:**
- [finding: what the mandate claims vs what's covered]

**Scope drift:**
- [finding: operations that don't serve the stated mandate]

**Fragility concerns:**
- [finding: flow X breaks under plausible condition Y]

**Rule generalization:**
- [findings: over/undergeneralized rules]

**Usability problems:**
- [findings: friction points in normal use]

**Stale documentation:**
- [findings: where prose and behavior diverge]
```

---

## Finding Format

Detection steps produce findings in the canonical finding shape — see `.claude/templates/finding-format.md`. Step 9 delivers them interactively: the canonical `Problem` is shown as-is, and the canonical `Fix` becomes the `Options` block plus the choices in the per-finding picker.

---

## Dismissal discipline

Steps 2–7 don't only produce findings — they also silently *discard* candidates the detector considers and decides aren't real. Those discards never reach Step 8: `@audit-verify` only sees findings that are raised, so a candidate dropped during detection bypasses verification entirely. That makes a mid-detection dismissal the one judgment call with no safety net — and the failure mode it invites is anchoring on the audited file's own rationale ("the skill says this trade-off is deliberate, so it's fine").

Two rules for Steps 2–7:

1. **A dismissal must rest on grounds independent of the audited file's own rationale.** The strongest form is a concrete trace against the actual files — a specific unreachable state, an enforced precondition, a case split you checked is exhaustive. For a judgment-grade Step 7 candidate where no such trace is possible, the dismissal must still be a conclusion you reasoned to yourself — and it is invalid the moment its basis is the audited file describing itself as intentional. The file is the thing under audit; its rationale prose is a claim, not evidence. When a candidate's only defense is the file's self-description, raise it as a finding and let `@audit-verify` judge it in fresh context.
2. **Record what you discard.** In the Step 1–7 working notes, keep a one-line-per-candidate list of what you considered and dismissed, with the grounds that justified each. A dismissal you can't see is a dismissal you can't check. This list is a working note — it is not shown to the user; the Step 9 walkthrough still delivers only confirmed findings.

When in doubt, raise it. Verification absorbs a false positive cheaply; it cannot recover a false negative it never received.

---

## Step 8 — Verification phase

Run the canonical verification phase. Read `.claude/templates/verification-phase.md` and follow its procedure with:

- **Source skill name:** `/audit-agent`
- **Severity ordering hint:** critical = operational correctness or semantic contradiction the user will hit in practice; advisory = rigidity, documentation drift, stylistic inconsistency, or quality-improvement that isn't a bug.

Without this phase, roughly half of advisory findings from the detection steps above are false positives or have weak fix proposals. The per-finding fresh-context verification is what makes this skill's output trustworthy.

---

## Step 9 — Triage walkthrough

Step 8 hands you the confirmed findings. **Do not dump them as one block** — a wall of fully-specified problems plus their fix decisions is exactly the overload this step exists to remove. Walk the user through them instead.

The Step 1 mental model and the Step 2–7 detection blocks are internal working notes — they never appear in the output. The user sees only this walkthrough.

### 9a — Summarize, then pick how to proceed

Print one line: `Found <N> issues — <C> critical, <A> advisory.`

If there are **zero** confirmed findings, say so, note any dismissed or deferred findings in one line each, and stop — no walkthrough.

If there is exactly **one** confirmed finding, skip the mode picker — go straight to 9b for that finding.

Otherwise present an `AskUserQuestion` picker — *"How do you want to work through these?"*:

- **Walk through one at a time** *(recommended)* — each issue explained on its own; you decide per issue. → 9b
- **Critical first** — triage only the `<C>` critical issue(s) interactively now; advisories are listed at the end, untriaged. → 9b (critical findings only). *Omit this option when `<C>` is 0.*
- **Apply all recommended fixes** — no walkthrough; the recommended fix for every issue is queued. → skip to 9c, every finding's decision = its recommended fix.
- **Just print the report** — the full findings as one static block (format below), no walkthrough; the user triages manually. → print and stop.

Static-report format for the last option:

```
## Agent Audit: <agent>

Found <N> issues — <C> critical, <A> advisory.
Checked: hidden assumptions, rule-vs-rule coherence, liveness, end-to-end flows,
cross-boundary consumption, honest review.

<each confirmed issue, numbered, in the finding format — critical first>

### Noticed outside this agent       ← only if the audit surfaced an issue elsewhere
### Filtered out (not real — no action)   ← only if findings were dismissed
### Deferred to next run             ← only if the 10-finding cap left findings unverified
```

### 9b — Walk each finding

Take the findings in scope **critical first**. For each, print a tight block, then ask exactly one picker:

```
### Issue <i> of <total> — <headline>   ·   <critical | advisory>

**Problem.** 2–4 plain sentences: what is broken and what the user or agent
actually experiences. No file-line walls here — keep one orienting `file:line`
at most.

**Why it matters.** One line: what breaks, how often, who is affected.

**Options.** The fix path(s), recommended first, each with its one-line tradeoff.
```

Then an `AskUserQuestion` picker — **one question, this finding only; never batch findings into a multi-question call**:

- **header:** `Issue <i>/<total>`
- **question:** `<headline> — what do you want to do?`
- **options:**
  - One option per fix path. A single-fix finding gets one option labelled `Apply the fix`; a genuine fork gets one option per variant, the recommended variant first with `(recommended)` in the label. Each option's `description` carries the concrete edit and its tradeoff.
  - `Skip — revisit next audit` — finding left untouched; it resurfaces on the next `/audit-agent` run.
  - `Not a real bug — stop raising it` — appends an entry to `.claude/audit-decisions/<agent>.md` so future audits skip it.
  - The free-text "Other" slot (always present) covers "let's discuss this one first" and custom instructions.
  - A finding with 3 fix variants fills the four explicit slots with the three variants + `Skip`; `Not a real bug` then lives in "Other". Keep the common ≤2-variant case to the four options above.

The audit-decisions append in 9c is keyed on the **meaning** of the decision, not which slot it came from: an "Other"-slot answer to the effect of "this isn't a real bug" is treated identically to the explicit `Not a real bug` option, append included.

Record the decision, then move to the next finding. Do not re-explain finished findings.

### 9c — Triage summary

After the last finding (or immediately, for "Apply all recommended fixes"), print a compact recap:

```
## Triage summary — <agent>

**Will apply (<n>):**
- Issue <i> — <headline> — <chosen fix, one line>

**Skipped — resurface next audit (<n>):**       ← only if any
- Issue <i> — <headline>

**Dismissed — added to audit-decisions (<n>):**  ← only if any
- Issue <i> — <headline>

**Not triaged — advisories left for a later run (<n>):**  ← only after "Critical first"
- <headline>

**Deferred — not verified this run, 10-finding cap (<n>):**  ← only if any
- <headline>

**Noticed outside this agent (<n>):**            ← only if any
- <one-line description + file:line>
```

For each `Not a real bug` decision, append the entry to `.claude/audit-decisions/<agent>.md` now (title, verdict, one-line why, ≤3 lines) — see the audit-decisions rules below.

### 9d — Hand off the fixes

The skill stops here — it never edits agent code itself. After the triage summary, render an `AskUserQuestion` hand-off picker built from what triage produced:

- **"Will apply" is non-empty** — `Apply the triaged fixes now` `(Recommended)` (the curator applies them as a herd edit, then the `/check` pipeline's own hand-off pickers carry verification — every fix lands under `herd/**`) / `Stop — apply the fixes later`. Add `Re-run /audit-agent <agent>` as an option when skipped or deferred findings remain.
- **"Will apply" is empty** — nothing to apply; offer `Re-run /audit-agent <agent>` (when skipped/deferred findings remain) / `Done`, or simply close if nothing is outstanding.

---

## Rules

- **Scan and triage — do NOT modify agent code or config.** The skill detects, verifies, and walks the user through findings to collect decisions; it never applies fixes. Approved fixes are applied afterward by the curator as a normal herd edit. The one file the skill itself writes is `.claude/audit-decisions/<agent>.md` — append entries there when the user dismisses a finding as "not a bug" (see the "Add to audit-decisions" rule below). That file is the audit system's memory, not agent code.
- **One picker per finding.** Step 9b asks about exactly one finding per `AskUserQuestion` call — never batch findings into a multi-question call. Batching recreates the all-at-once overload the walkthrough exists to remove.
- **Full reads, not sampling.** The whole skill hinges on deep context. Partial reads defeat the purpose.
- **One agent at a time.** Do not audit multiple agents in one run. Focus is the point.
- **Judgment required.** Steps 3 and 7 cannot be automated. The LLM reasons; the user decides.
- **Don't change for the sake of changing.** Every finding must justify its fix cost. A rigid rule that's never been a problem in practice is not urgent. A flaw that actively causes user harm is urgent.
- **Respect audit-decisions.** Anything listed in `.claude/audit-decisions/<agent>.md` is already evaluated. Don't re-raise these findings. If you disagree with a prior decision, name the specific entry and say why you think it should be reconsidered — don't simply relist it as a bug.
- **Add to audit-decisions when resolving a finding as "not a bug."** After the curator evaluates a finding and decides it's intentional, append an entry to `.claude/audit-decisions/<agent>.md` (title, verdict, one-line why, ≤3 lines total) so future audits skip it.
- **Verification phase is mandatory, not optional.** Steps 2-7 are detection and may produce false positives; Step 8 filters them. Never present Steps 2-7 findings to the user without running them through `@audit-verify` first.
- **Dismissal discipline — under-detection has no safety net.** A candidate the detector discards during Steps 2-7 never reaches `@audit-verify`, so a mid-detection dismissal is unverified by construction. Discard a candidate only on grounds independent of the audited file's own rationale — never because the file calls the behavior intentional. When unsure, raise it. See the "Dismissal discipline" section.
- **Verifier-dismissed findings are NOT audit-decisions.** A dismissal from `@audit-verify` is a one-shot "not real this cycle," not a durable "this is intentional forever." Only append to `.claude/audit-decisions/<agent>.md` when the user explicitly triages a finding as intentional.
- **This skill catches things the global pipeline can't.** Passing the global pipeline does NOT mean this skill has nothing to find. Conversely, finding nothing here does NOT mean the agent is done — a future deeper read may still surface issues.
