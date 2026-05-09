---
name: patterns
description: Verify every pattern in docs/PATTERN-CATALOG.md holds across the herd. Discovers instances via each pattern's Find recipe, checks canonical shape, respects declared asymmetries. Model-invokable after /check passes (propose, then run on user approval).
user-invocable: true
disable-model-invocation: false
---

# Patterns Check

For every pattern in `docs/PATTERN-CATALOG.md`, find current instances in the herd and verify each one matches the canonical shape. Report violations; respect declared asymmetries; do not fix.

This skill is principle-based: it reads the catalog as the source of truth and applies each pattern's definition to the instances it discovers. There are no hardcoded tables of parallel pairs, ops agents, rule-reading sub-agents, or expected counts. If a new instance of a pattern appears in the repo, this skill finds and checks it automatically. If a pattern is added to or removed from the catalog, this skill's coverage updates without any edits to the skill body.

---

## Prerequisite

Read these files in order. They are the inputs to every check below.

1. `docs/PATTERN-CATALOG.md` — every pattern, each with Purpose / Canonical shape / Reference implementation / Find instances / Declared exceptions.
2. `.claude/asymmetries/pm.md`, `.claude/asymmetries/uxui.md`, `.claude/asymmetries/planner.md`, `.claude/asymmetries/builder.md` — per-agent deliberate deviations from the canonical shape. An asymmetry rewrites what canonical means for that one agent; never ignore them.

If `docs/PATTERN-CATALOG.md` doesn't exist, stop and report: "No pattern catalog found. This skill requires the catalog as its source of truth."

---

## Process

### Step 1 — Enumerate patterns

Walk `docs/PATTERN-CATALOG.md` and extract, for each pattern:

- Its number and name (e.g., "6. Ops Agent").
- Its Canonical shape (the bulleted invariants).
- Its Find instances recipe (the shell command or glob pattern).
- Its Declared exceptions pointer (which asymmetry files might rewrite the shape for specific agents).

Build an in-memory list of patterns. Don't hardcode anything — reread the catalog each run so a fresh pattern added an hour ago is covered immediately.

### Step 2 — For each pattern, discover instances

For each pattern in the list:

1. Run the Find instances recipe exactly as given. Record the set of matching files or components.
2. Note each instance's owning agent (the `herd/<agent>/` prefix).
3. If the pattern has an Exceptions pointer and the owning agent has a matching entry in `.claude/asymmetries/<agent>.md`, load that entry's "Curator implication" — that is the canonical shape for this instance.
4. If the instance set is empty and the pattern declares it should have instances (e.g., "every herd agent has an ops sub-agent"), flag the absence as a finding.

### Step 3 — For each instance, check canonical shape

For each discovered instance:

1. Read the relevant file(s) — the instance itself, and any files it must Read (Prerequisite rule files, referenced templates).
2. Walk each bullet under the pattern's Canonical shape. Confirm the instance satisfies it. Record concrete deviations with file path and line number.
3. If a declared asymmetry rewrites the shape for this instance's agent, apply the rewritten shape instead of the default — do NOT flag the instance for diverging from the default if the asymmetry explicitly permits the divergence.
4. An asymmetry doesn't exempt the instance from all checks; it only changes the specific invariants the asymmetry addresses. All other canonical-shape bullets still apply.

### Step 4 — Cross-pattern discovery

After all patterns are checked, scan the repo for candidates of patterns we may have missed:

- **Potential parallel pairs**: name pairs sharing a prefix of ≥5 chars where **BOTH names carry a tool suffix** (e.g., `recon-chrome`/`recon-playwright`, `foo-fast`/`foo-thorough`). If a pair exists that isn't covered by Pattern 10, flag as ADVISORY: "Possible parallel pair `<A>` / `<B>`; consider adding to PATTERN-CATALOG.md or confirming it's single-purpose."

  **Not a parallel pair: base + suffix.** When one name has no suffix and the other has a `-quick`/`-fast`/`-deep`/`-light`/etc. suffix (e.g., `auditor` + `auditor-quick`), the unsuffixed base is the canonical/comprehensive version and the suffixed sibling is a specialization or fallback — typically a **conditional escalation cascade** where one's output gates the other's invocation, not a parallel pair where both run together. Pattern 10 does not apply. Read both files to confirm: if they're spawned sequentially with one's output feeding the next's gate, log briefly and move on. Only flag as ADVISORY if the relationship looks ambiguous — e.g., neither file documents the gating, or both are spawned together from the same orchestrator.
- **Potential new role patterns**: sub-agent name prefixes with 3+ instances across agents (e.g., `check-*`, `recon-*`). If the prefix isn't mentioned in any existing pattern, flag as ADVISORY: "Sub-agent prefix `<X>` has N instances across agents; consider whether this is a pattern worth cataloging."
- **Broken discovery recipes**: if a pattern's Find instances recipe returns zero results when it should have several (based on pattern 1's "applies to every herd agent" claim), the recipe may be stale. Flag as ADVISORY.

These three discoveries keep the catalog honest over time — the skill surfaces emerging patterns instead of freezing the set.

### Step 5 — Asymmetry staleness check

For each entry in each `.claude/asymmetries/<agent>.md`:

- The entry has a **Revisit if** clause. Briefly check whether the revisit condition has been met (e.g., UXUI's "two of the four surfaces collapse into one" → look at the current UXUI ops sub-agent count and see whether it has dropped from four).
- If the revisit condition is satisfied, flag as ADVISORY: "Asymmetry `<name>` in `.claude/asymmetries/<agent>.md` may be outdated — its Revisit-if condition appears to hold. Reconsider whether the divergence is still intentional."

This keeps the asymmetry files from becoming permanent exceptions that outlive their justification.

---

## Finding Format

Every actionable finding uses the canonical four-part shape — see `.claude/templates/finding-format.md`.

---

## Verification phase

Run the canonical verification phase. Read `.claude/templates/verification-phase.md` and follow its procedure with:

- **Source skill name:** `/patterns`
- **Severity ordering hint:** critical = canonical shape violations (missing required structure, broken pattern contracts, unregistered components); advisory = novel pattern candidates, stale asymmetry entries, discovery-recipe weakness.

---

## Report

```
## Pattern Check Results

For each pattern in the catalog:
### Pattern <N>: <name> — [PASS / <M> instances, <K> findings]
- <optional one-line note per instance if something notable>

### Cross-pattern discovery
- Novel pattern candidates: <list or "none">
- Stale asymmetry entries: <list or "none">
- Discovery-recipe gaps: <list or "none">

### Verification
- Findings raised: N
- Verified this session (capped at 10): M
- Confirmed — fix good: X
- Confirmed — fix needs revision: Y
- Dismissed: Z
- Deferred to next run: N - M (if > 0)

### Confirmed Findings (ready for fix)
<confirmed findings with any verifier-revised fixes inline>

### Dismissed Findings (logged for transparency)
<dismissed findings with verifier's concrete reason>
```

**Next:** If clean, continue with `/contracts` (next skill in the pipeline). If confirmed findings need fixing, fix them and re-run `/patterns` before continuing. If the only findings are advisory (novel pattern candidates, stale asymmetries), consider whether the catalog or asymmetry files need updating rather than the herd.

---

## Rules

- **The catalog is the source of truth.** This skill never encodes per-instance knowledge that duplicates the catalog — no hardcoded lists, no expected counts, no self-test snapshots. If a check can't be stated in terms of "for each instance of pattern X, verify Y", it belongs in a different skill (`/audit-agent` for semantic judgment, `/check` for mechanical syntax).
- **Asymmetries are declared, not inferred.** An instance that diverges from canonical shape WITHOUT a matching entry in `.claude/asymmetries/<agent>.md` is a violation, not an asymmetry. The curator's response is to either (a) flag and fix the instance, or (b) explicitly accept the divergence by adding an asymmetry entry. Both are human decisions; this skill only surfaces them.
- **No Self-Test section.** Tying findings to a pinned snapshot of the repo is what created the catalog-drift problem in the first place. This skill's correctness is the canonical shape's correctness, not a fixed set of expected-good outputs.
- **Cross-pattern discovery is advisory.** When the skill finds a novel pattern candidate, it never autonomously adds it to the catalog — it flags it and lets the curator decide. Curating the catalog is an intentional act.
