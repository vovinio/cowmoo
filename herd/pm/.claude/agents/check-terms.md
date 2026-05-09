---
name: check-terms
description: Scan all spec files against the glossary for terminology inconsistencies. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 50
---

# Check Terms

Scan all spec files against the glossary. Report inconsistencies back to the coordinator. Your final response must be the complete findings report — never end with just "Done".

---

## Step 1: Load Full Context

Read all spec files:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — extract the glossary as the authoritative term list
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`

---

## Step 2: Check Each Term

For every glossary term:
- Is it used consistently across all files? (exact same spelling, casing, phrasing)
- Are there synonyms or alternate names for the same concept?
- Are there terms used in domain files that aren't in the glossary but should be?

---

## Step 3: Check for Unnamed Concepts

Look for concepts that appear across multiple domain files under different names — the same idea described differently in different places.

---

## Step 4: Report

Return your findings in this format:

```
## Terminology Check

### Auto-Fixable
- [file]: uses "[wrong term]" — should be "[glossary term]" ([N] occurrences)
- [file]: uses "[wrong term]" — should be "[glossary term]" ([N] occurrences)

### Needs Decision
- "[term A]" in [file] vs "[term B]" in [file] — same concept? Which name wins?
- "[term]" used in [files] but not in glossary — add to glossary? Suggested definition: "[definition]"

### Consistent
- [N] glossary terms checked, [N] used consistently

### Clean
(if no issues found)
```

---

## Rules

- **Flag ambiguity** — if you're not sure two terms mean the same thing, put it in "Needs Decision", don't auto-fix
- **Include location** — every finding must specify which file(s) and the line/section
- **Glossary is authoritative** — when a term exists in the glossary, that's the correct form. Deviations in domain files are the ones that get fixed.
- **Respect explicit acknowledgments** — if a spec contains a note explaining why a term is used differently (e.g., an italicized aside, a parenthetical, or a footnote), don't flag it. The spec has already addressed the apparent inconsistency.
