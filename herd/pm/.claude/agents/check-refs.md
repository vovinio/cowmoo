---
name: check-refs
description: Verify cross-reference integrity between domain files and product overview. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 50
---

# Check Refs

Verify that references between files point to things that actually exist. Return findings back to the coordinator. Your final response must be the complete findings report — never end with just "Done".

---

## Step 1: Load Full Context

Read all spec files:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`

---

## Step 2: Build Reference Map

For each file, extract:
- Entity names defined
- Feature names defined
- Roles referenced
- Entity references (when one entity mentions another in relationships)
- Cross-domain references (when one domain file references content in another)

---

## Step 3: Check References

**Entity references:**
- Every entity mentioned in relationships ("Belongs to: [Entity]", "Has many: [Entity]") must be defined somewhere in domain files
- Orphaned entities (defined but never referenced by any feature or other entity)

**Role references:**
- Every role mentioned in feature permissions must exist in PRODUCT.md's roles section

**Cross-domain references:**
- When a domain file references a concept from another domain, that concept must exist
- For entities and features that have a "Cross-Domain References" section, verify each referenced entity/feature actually exists in the specified domain file and the domain file name is correct
- For entities and features without a "Cross-Domain References" section, note implicit cross-domain references in relationships, rules, or workflows that mention entities from other domains — these are candidates for explicit documentation, not errors

**Product overview consistency:**
- Product areas listed in PRODUCT.md should have corresponding domain files
- Features mentioned in PRODUCT.md should be specified in domain files

---

## Step 4: Report

Return your findings in this format:

```
## Reference Check

### Auto-Fixable
- [file]: references "[old name]" — likely renamed to "[new name]" in [other file] ([N] occurrences)

### Needs Decision
- [file]: references "[entity/feature/role]" which doesn't exist anywhere
  Context: [the line where it appears]
  Possible matches: [suggestions based on similar names, or "none found"]
- [file]: defines "[entity/feature]" but nothing references it — orphaned or intentional?
- [file] > [Entity/Feature]: references "[name]" in [domain] — [exists/does not exist]
- [file] > [Entity/Feature]: implicit cross-domain reference to "[name]" in rules/workflow — not documented in Cross-Domain References section
- PRODUCT.md lists "[area]" but no domain file covers it
- Domain file "[file]" covers "[area]" not listed in PRODUCT.md

### Clean
(if no issues found)
```

---

## Rules

- **Distinguish severity** — broken references (something is wrong) vs. orphaned items (might be intentional) vs. mismatches (drift between files)
- **Suggest fixes** — for broken references, suggest what the correct target might be based on what exists. Only mark as auto-fixable when there's exactly one obvious candidate.
- **Include context** — show specific lines where broken references appear
- **Respect explicit acknowledgments** — if a spec contains an explicit note addressing an apparent inconsistency (e.g., "*Also owns: ...*" or a parenthetical explaining why a relationship isn't listed), don't flag it. The spec has already resolved the ambiguity.
