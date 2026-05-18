---
name: check-completeness
description: Verify specs follow templates — all required sections present, correct formats, no vague language. Also checks content-level completeness: state transition coverage, failure paths in workflows, and permission clarity. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 50
---

# Check Completeness

Verify that domain files, entities, features, and the product overview all follow their templates. Return findings back to the coordinator. Your final response must be the complete findings report — never end with just "Done".

---

## Step 1: Load Full Context

Read all spec files:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`

Read all templates:
- `.claude/templates/product.md`
- `.claude/templates/domain.md`
- `.claude/templates/entity.md`
- `.claude/templates/feature.md`

---

## Step 2: Identify All Spec Items

From domain files, identify every:
- **Domain file** — the file itself (header, description, section structure)
- **Entity** — sections that define a business object (fields, relationships, rules)
- **Feature** — sections that define user actions (workflow, validations, permissions)

From PRODUCT.md, identify:
- Product overview sections (problem statement, target users, overview, glossary, roles, product areas, how it works, key behaviors, key constraints)

---

## Step 3: Check Against Templates

For each spec item, verify it against every section its type's template defines — the four templates read in Step 1 (`product.md`, `domain.md`, `entity.md`, `feature.md`) are the authority. Do not rely on a hardcoded section list; check against the template files as loaded. Flag:

- **(a)** template-required sections entirely missing
- **(b)** sections present but empty or placeholder-only
- **(c)** required subsections absent

The domain template additionally encodes structural rules beyond section presence — section ordering (Entities before Features), kebab-case file naming matching the domain name, business-oriented domain naming, and no entity defined in multiple domain files. Verify these against the domain template too.

**Scope-aware gap detection.** When a template section is missing from a spec file, check whether the section maps to content that's out of scope for this project (per CLAUDE.md) before flagging it:
- Key Constraints is only expected when the user has explicitly stated product-level constraints (performance, scale, data retention, etc.). If the section is missing and no constraints appear anywhere in the specs, don't flag it. But if constraints are mentioned elsewhere in the specs without being captured in Key Constraints, flag the gap.
- If a template section's content is already covered elsewhere in the specs (e.g., constraints captured as entity fields or feature rules), note where it lives instead of flagging it as missing
- Still flag the gap if the section covers business-level product constraints that are in scope but genuinely missing

---

## Step 4: Check Quality

Beyond structure, check content quality:

**Vague language** — flag any spec that uses:
- "appropriate", "relevant", "as needed", "etc.", "and so on"
- "handle appropriately", "display relevant information"
- "TBD", "to be determined", "[needs content]", or any bracketed placeholder

**Generic content** — flag specs that only state the obvious:
- CRUD operations without specific business rules
- Standard validations without specific constraints or messages

**Incomplete items** — flag sections that exist but are too thin:
- Features with workflow but no edge cases
- Entities with fields but no rules
- Validations without error messages

**State coverage** — for every entity that defines states:
- Every state must have at least one transition in (how does it enter this state?) — case 1 only (case-2 derived states are computed, not transitioned)
- Every state must have at least one transition out (what happens next?) — case 1 only; terminal states are exempt
- Flag states that are mentioned but never appear in any feature workflow — applies to both case 1 and case 2

**Failure paths** — for every feature that defines a workflow:
- Each step where something can go wrong should define what happens on failure (error message, where the user ends up, what gets rolled back)
- Flag workflows where all steps only describe the happy path

**Permission clarity** — for every feature that mentions roles:
- Permissions should state who CAN'T do it, not just who can — unless the feature is available to all roles
- Flag features where permissions say "Admin can do X" but don't clarify whether other roles are blocked or simply not mentioned

---

## Step 5: Check Acceptance Criteria Coverage

For each feature, compare:
- Validations with **non-obvious behavior** (confirmations, side effects, cascading changes) should have a matching acceptance criterion: `Given [invalid input], When [action], Then [error message shown]`. Standard validation errors (required field, format, range) are covered by the Validations section and do NOT need individual AC lines — per the feature template's AC convention; do not flag them.
- Key edge cases should have matching acceptance criteria
- Permission denied scenarios should have acceptance criteria

Flag features where non-obvious-behavior validations, key edge cases, or permission-denied scenarios exist but have no corresponding acceptance criteria.

---

## Step 6: Report

Return your findings in this format:

```
## Completeness Check

### Domain Structure Issues
- [file]: missing domain description
- [file]: Features section appears before Entities section
- [file]: domain name is technical, not business-oriented

### Missing Sections
- [file] > [Entity/Feature Name]: missing [section] — required by template
- [file] > [Entity/Feature Name]: missing [section] — required by template

### Vague Language
- [file] > [Entity/Feature Name] > [section]: "[the vague text]"
  Suggested rewrite: "[specific alternative]"

### Too Thin
- [file] > [Feature Name]: has workflow but no edge cases
- [file] > [Entity Name]: has fields but no rules

### Template Format Issues
- [file] > [Feature Name]: user story doesn't follow "As a [role]..." format
- [file] > [Entity Name]: fields use SQL types instead of plain language

### Product Overview Gaps
- PRODUCT.md: missing [section] — [why it matters for product spec, or "skipped — maps to out-of-scope content"]

### State Coverage Gaps
- [file] > [Entity Name]: state "[state]" has no defined entry transition
- [file] > [Entity Name]: state "[state]" has no defined exit transition and is not marked terminal
- [file] > [Entity Name]: state "[state]" is defined but never referenced in any feature workflow

### Failure Path Gaps
- [file] > [Feature Name]: workflow step [N] "[step]" has no failure handling
- [file] > [Feature Name]: workflow is happy-path only — no failure branches defined

### Permission Gaps
- [file] > [Feature Name]: permissions say "[role] can [action]" but don't clarify access for other roles ([list roles])

### Acceptance Criteria Gaps
- [file] > [Feature Name]: non-obvious validation "[rule]" has no matching AC
- [file] > [Feature Name]: edge case "[scenario]" has no matching AC
- [file] > [Feature Name]: permission denied scenario has no matching AC

### Complete
- [N] entities checked, [N] fully complete
- [N] features checked, [N] fully complete

### Clean
(if no issues found)
```

---

## Rules

- **Templates are authoritative** — if the template requires a section, it's required. N/A with reasoning is acceptable, missing is not.
- **Be specific about what's wrong** — don't just say "incomplete", say which section is missing and what the template expects
- **Suggest rewrites for vague language** — show the vague text and a concrete alternative
- **Respect explicit acknowledgments** — if a section is marked N/A with reasoning, or a spec contains a note explaining why something is structured a certain way, accept it. Don't flag intentional patterns that the spec already addresses.
