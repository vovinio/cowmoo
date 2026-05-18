# Finding Format (Canonical Shape)

Every curator finding the user sees uses the same shape, so triage is uniform no matter which skill surfaced it. The shape exists to put the *real issue* in front of the user fast — not bury it under PASS lists or internal accounting. See Pattern 22 in `docs/PATTERN-CATALOG.md` for the rationale.

## Actionable finding

```
**[Headline — what's wrong, in plain words]**  ·  [critical | advisory]

**Problem.** One short paragraph, plain language: what is broken, and what the user
or agent actually experiences because of it. The reader should grasp the real-world
consequence without knowing the codebase — no internal jargon, no verification
accounting. Cite the file:line so the fix is locatable.

**Fix.** What to do about it:
- **One obvious fix** → state it directly, in a sentence or two.
- **A genuine fork** (2–3 alternatives with real tradeoffs) → list them, the
  recommended option first and marked `(recommended)`, each with a one-line reason
  or tradeoff so the user can choose. Don't manufacture alternatives where only one
  sane fix exists, and don't present a flat list with no recommendation.
```

## Verify the finding before you write it

Don't assert impact — check it. Grep the repo for everything that references the thing being fixed (callers, sibling files, docs, related skills) and confirm the fix is safe, or enumerate the coordinated edits needed to stay consistent. This verification happens *while producing* the finding: it shapes the Problem text and the Fix, but it is not rendered as its own section in the report.

## Severity

- **Critical** — structural bugs, broken contracts, broken hooks, broken cross-references, missing registrations, write collisions. Fix before shipping.
- **Advisory** — template asymmetry, stylistic drift, rigidity concerns, usability friction. Queued for later.

Each finding's headline carries its severity tag. The severity ordering hint the calling skill passes to the verification phase defines what counts as critical in that skill's domain.

## No PASS lists

A skill that passes a check does **not** emit a finding (or a line) per passing check. A single coverage line — "Checked: X, Y, Z" — replaces a list of `PASS` entries. PASS lists are exactly the "explanations of what's already fine" that bury the issues the user actually has to act on. Informational state (expected, no action needed) is reported the same way: folded into the one coverage line, not itemized.
