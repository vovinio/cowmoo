---
name: check-coverage
description: Verify UI definitions cover all spec entities, features, flows, states, and edge cases. Returns findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 15
---

# Coverage Check

Verify that UI definitions in `cowmoo/design/` fully cover the product specifications in `cowmoo/specs/`. Report what's covered, what's missing, what's partially covered, and whether the UXUI file set is internally consistent.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.

## Prerequisite

Read `.claude/rules/ui-vocabulary.md` — canonical state vocabulary (data component states, form states, control states) + role-naming convention. Apply these when checking State Coverage below.

## Process

1. Read all files in `$PROJECT_DIR/cowmoo/specs/domains/` — extract every entity, feature, workflow, edge case, and state
2. Read `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` (if exists) — extract design intent + navigation
3. Read `$PROJECT_DIR/cowmoo/design/journeys.md` (if exists) — extract end-to-end arcs
4. Read `$PROJECT_DIR/cowmoo/design/roles.md` (if exists) — extract defined roles
5. Read `$PROJECT_DIR/cowmoo/design/screen-index.md` (if exists) — extract listed screens
6. Read all files in `$PROJECT_DIR/cowmoo/design/domains/` — extract every screen, flow, state, interaction, and role reference
7. Cross-reference: for each spec item, is there a corresponding UI definition? For each role reference in a domain file, does the role exist in roles.md? For each screen in a domain file, does it appear in screen-index.md?

## Checks

### Entity Coverage
For each entity in specs:
- Is there at least one screen that shows this entity? (list view, detail view, or embedded in another screen)
- Are create/edit forms defined with all the entity's fields?
- Are the entity's states reflected in the UI? (status indicators, badges, filtered views)

### Feature Coverage
For each feature in specs:
- Is there a screen definition for this feature?
- Does the screen cover the feature's workflow steps?
- Are all validation rules reflected in form states?
- Are all edge cases listed in the screen's states section?

### Flow Coverage
For each workflow in specs:
- Is there a corresponding flow in the UI definitions (either a per-domain flow in `cowmoo/design/domains/*.md` or a cross-domain journey in `cowmoo/design/journeys.md`)?
- Does the flow cover all decision points from the spec?
- Does the flow show error/failure paths, not just the happy path?

### State Coverage
For each screen definition in cowmoo/design/domains/:
- Per `.claude/rules/ui-vocabulary.md`: does the screen declare the states applicable to it?
  - Data-fetching screens (list, table, detail, dashboard): data states — empty, loading, error, populated, partial
  - Forms: form states — idle, dirty, submitting, success, error
  - Screens without data fetching aren't required to declare data states; screens without forms aren't required to declare form states
- For each edge case in the matching spec feature: is there a corresponding state?

### Cross-Domain Coverage
For each cross-domain reference in specs:
- Is the reference reflected in the UI definitions? (e.g., client selector in billing references user management)

### OVERVIEW Coverage
Check the state of `cowmoo/design/OVERVIEW.md`:
- Does the file exist?
- Is the Design Intent section populated with concrete prose describing density, formality, mood, and rationale tied to the product (not just placeholder text like "[1-2 paragraphs]")?
- Is the Navigation Structure section populated with top-level shape (type, main sections, sub-nav pattern)?
- Are the Pointers to sibling files present?

### Role Vocabulary Integrity
Check `cowmoo/design/roles.md` and role references in domain files:
- Does `roles.md` exist?
- For every role name referenced in a domain file's "Roles Used" section or inline in screen descriptions, does that role exist in `roles.md`?
- Unmatched references (referenced but not defined) are errors — domain files must only use roles that exist.
- Unused roles (defined but never referenced) are warnings — may be intentional reserves or cruft to prune.

### Screen Index Integrity
Check `cowmoo/design/screen-index.md` and domain files:
- Does `screen-index.md` exist?
- For every screen defined in a domain file, does it have an entry in `screen-index.md`?
- For every entry in `screen-index.md`, does a matching screen exist in a domain file?
- Drift between domain files and screen-index is a finding.

### Raw Value Violations
Grep all files in `$PROJECT_DIR/cowmoo/design/` (OVERVIEW, journeys, roles, screen-index, domains) for:
- Raw hex colors: `#[0-9a-fA-F]{3,8}`
- Pixel values: `\d+px`
- RGB/RGBA calls: `rgb\(|rgba\(`
- Arbitrary font weights: `font-weight:\s*\d+`

Any matches are violations — concrete values do not belong in cowmoo/design/ files. Fix by replacing with a role name from `roles.md` (add the role first if it doesn't exist).

## Output

```
## Coverage Report

### Fully Covered
- [Entity/Feature]: covered by [uxui file → screen name]

### Partially Covered
- [Entity/Feature]: [what's defined] — Missing: [what's not defined]

### Not Covered
- [Entity/Feature]: no UI definition found

### Orphaned UI
- [Screen/Flow in cowmoo/design/] has no matching spec (may be valid for cross-cutting screens)

### State Gaps
- [Screen Name]: missing states: [list]

### OVERVIEW
- OVERVIEW.md: [exists / missing]
- Design Intent: [populated / missing / thin]
- Navigation Structure: [populated / missing]
- Pointers: [present / missing]

### Role Vocabulary
- roles.md: [exists / missing]
- Roles defined: [N]
- Unmatched references (error): [domain file → role name] — role not defined in roles.md
- Unused roles (warning): [role name] — defined but not referenced by any domain file

### Screen Index
- screen-index.md: [exists / missing]
- Screens in domain files not in index: [N] — [list]
- Screens in index not in domain files: [N] — [list]

### Raw Value Violations
- [file:line] — [quoted raw value] — should reference a role name instead

## Summary
- Entities: [N]/[N] covered
- Features: [N]/[N] covered
- Flows: [N]/[N] covered
- Screens with complete states: [N]/[N]
- OVERVIEW: [complete / partial / missing]
- Role integrity: [N matched / N unmatched]
- Screen-index sync: [in sync / drifted]
- Raw value violations: [N found]
```

## Rules

- **Report findings only** — do not modify any files
- **Be specific** — name the exact entity, feature, or edge case that's missing, with file references
- **Cross-cutting screens are not orphans** — a dashboard or settings screen may not map to a single spec domain. Note it but don't flag as an error.
- **State completeness matters** — a screen with layout but no empty/error states is partially covered
- **Read all files** — don't assume from file names. Read the content to verify.
- **OVERVIEW missing is not automatically an error on a brand-new project** — a fresh project may not have OVERVIEW.md yet. Report "missing" and let the coordinator decide. But Design Intent being placeholder text on an otherwise established project IS a finding.
