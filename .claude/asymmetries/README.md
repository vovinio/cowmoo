# Deliberate Asymmetries

This directory records cases where an agent intentionally diverges from a canonical pattern in `docs/PATTERN-CATALOG.md`. Curator audit skills read these files before flagging symmetry findings.

## Purpose

Two pieces of knowledge need to coexist without duplicating:

1. **The canonical pattern** lives in `docs/PATTERN-CATALOG.md`. It describes the shape every instance follows by default.
2. **The exceptions** live here, one file per agent. Each entry names the pattern it diverges from, explains the reason, and describes what the curator should check instead.

Keeping these separate means curator skills don't accumulate special-case clauses, and every exception has exactly one home.

## File format

One file per agent: `pm.md`, `uxui.md`, `planner.md`, `builder.md`. If an agent has no declared asymmetries, the file exists with just the header — an empty file communicates "no exceptions" explicitly.

Each asymmetry entry has five parts:

```markdown
## <One-line name of the divergence>

**Pattern.** The pattern this diverges from, by number and name (e.g., "Pattern 6 — Ops Agent").

**Divergence.** What this agent does differently.

**Why.** The reason this divergence is intentional. An asymmetry without a reason is a bug.

**Curator implication.** What the curator should check in place of (or in addition to) the canonical shape. Guides audit skills reading this file at scan time.

**Revisit if.** Conditions under which this entry should be reconsidered. An asymmetry that "no longer makes sense" means either the divergent agent should converge or the catalog should absorb the pattern.
```

## When to add an entry

Add an entry when:
- A curator audit flags an instance as divergent AND
- You decide the divergence is correct (not a bug) AND
- You want future audits to respect it rather than re-flag.

Do NOT add entries for:
- Transient state or work-in-progress (that's audit-decisions).
- Instance-level variation within a pattern (e.g., per-agent content differences that the pattern already permits).
- Bugs you haven't fixed yet.

## When to remove an entry

Remove an entry when:
- The divergent agent converges to the canonical shape.
- The catalog absorbs the pattern variant, making the divergence canonical rather than exceptional.
- The underlying reason no longer applies (stated in "Revisit if").
