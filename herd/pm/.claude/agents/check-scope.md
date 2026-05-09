---
name: check-scope
description: Verify scope boundary integrity between active specs and backlog. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 50
---

# Check Scope

Verify that active specs don't reference deferred features, and deferred items aren't lingering in active specs. Return findings back to the coordinator. Your final response must be the complete findings report — never end with just "Done".

---

## Step 1: Load Full Context

Read all spec files:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`

Also read:
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md` — extract all deferred feature names, entity names, and concepts
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` — check for `[future]` tagged items that haven't been moved to backlog yet

---

## Step 2: Check for Scope Leaks

**Backlog items in active specs:**
- Do any domain files reference features, entities, or concepts that only exist in the backlog?
- Are there `[future]` tags still sitting in active spec files?

**Deferral language in active specs:**
- Scan all domain files and PRODUCT.md for language that implies deferral or incompleteness:
  - "is deferred", "deferred to", "deferred until"
  - "future", "in the future", "future phase", "future version"
  - "not yet", "not yet implemented", "not yet supported"
  - "when X ships", "once X is built", "after X launches"
  - "V2", "phase 2", "next version", "next release"
  - "later", "eventually", "someday", "down the road"
  - "TODO", "TBD", "to be determined", "to be decided"
  - "placeholder", "temporary", "for now"
- For each match, flag it with two questions:
  a. Does this imply a deferred concept that should be captured in BACKLOG.md?
  b. Does the spec line need rewriting as a clean, definitive product decision?
- Note: false positives are fine — you only report, the coordinator decides. Flag liberally.

**Active items missing from specs:**
- Does PRODUCT.md list features or areas that have no corresponding domain file or section?

**Backlog items that should be active:**
- Are there items in the backlog that are actually referenced and needed by active features? (Deferred by mistake, or a dependency was missed.)

**Notes content already in specs (Rule 1 — notes and specs never overlap):**
- For each `[ready]` item in WORKING-NOTES.md, check whether the same decision, rule, field definition, validation, or error message already exists verbatim (or near-verbatim — same semantic claim, same numbers, same entity) in a spec file.
- Flag only duplication of **concrete artifacts** (rules, field lists, error messages, thresholds, state transitions, workflow steps). Do NOT flag a `[ready]` item merely because it extends or refines content for an entity/feature already in specs — that's expected digest input.
- Report format: ``WORKING-NOTES.md: `[ready]` item on [topic] restates [rule/field/message] already in [spec file] section [X] — remove from notes if duplicate, or identify new information to add.``

---

## Step 3: Report

Return your findings in this format:

```
## Scope Check

### Auto-Fixable
- [domain file]: contains "[future]" marker on "[item]" — move to BACKLOG.md
  Context: [the line]

### Needs Decision
- [domain file]: references "[feature/entity]" which is in BACKLOG.md — remove reference, or bring item back to active scope?
  Context: [the line or section where it appears]
- [domain file] line [N]: "[the text]" — deferral language in active spec
  Implied deferred concept: [what appears to be deferred]
  Suggested rewrite: "[spec line as a clean product decision]"
  Backlog item needed? [yes/no and what it would say]
- Backlog item "[item]" is referenced by active feature "[feature]" in [file] — dependency issue
- PRODUCT.md lists "[area/feature]" but no domain file covers it — create domain file, or remove from PRODUCT.md?
- WORKING-NOTES.md: `[ready]` item on "[topic]" restates [rule/field/message] already in [spec file] section [X] — remove from notes if duplicate, or identify the new information to add.

### Clean
(if no issues found)
```

---

## Rules

- **Don't judge priority** — report what's inconsistent, let the coordinator/user decide what to fix
- **Include context** — show the specific lines/sections where issues appear
- **Respect explicit acknowledgments** — if a spec line explains a decision definitively (e.g., "Dashboard shows the most impactful items only" rather than "full management is deferred"), that's a clean decision, not deferral language. Only flag language that reads as open/incomplete.
