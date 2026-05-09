# Finding Format (Canonical Shape)

Every curator finding uses the same four-part format so the user can triage uniformly regardless of which skill surfaced it. See Pattern 22 in `docs/PATTERN-CATALOG.md` for the rationale.

## Actionable finding

```
**[One-line headline — what's wrong]**

One short paragraph: what the problem is and why it matters, in plain language.

**Impact check:** Actually verify — don't just assert. Grep the repo for everything that references the thing being fixed: callers, other files, documentation, related skills. Report concrete findings (files, line numbers, affected elements). Confirm the fix is safe, or enumerate the coordinated edits needed to stay consistent.

**Fix:** One sentence on what to do. If multiple coordinated edits are needed, list them.
```

## Informational / PASS entry

For findings that are informational (expected state, PASS, no action needed), skip Impact check and Fix — just say what's there and that it's correct.

## Severity conventions

- **Critical** — structural bugs, broken contracts, broken hooks, broken cross-references, missing registrations, write collisions. Fix before shipping.
- **Advisory** — template asymmetry, stylistic drift, rigidity concerns, usability friction. Queued for later.

The severity ordering hint each calling skill passes to the verification phase defines what counts as critical in that skill's domain.
