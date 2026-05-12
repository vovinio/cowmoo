---
name: define
description: Formalize working notes into cowmoo/design/ files — OVERVIEW, journeys, roles, screen-index, domains. Like PM's /digest but for UI.
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Bash, AskUserQuestion
---

# Define

Formalize confirmed UI decisions from working notes into structured `cowmoo/design/` files. Move design intent, journeys, roles, screens, and flows from notes into the committed output.

After define completes, run `/review` to verify coverage, then `/publish` to commit and push.

---

## Steps

### 0. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Read Current State

Read all files to understand what exists:
- `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md`
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` (if exists) — current design intent + navigation
- `$PROJECT_DIR/cowmoo/design/journeys.md` (if exists) — existing user arcs
- `$PROJECT_DIR/cowmoo/design/roles.md` (if exists) — existing role vocabulary
- `$PROJECT_DIR/cowmoo/design/screen-index.md` (if exists) — existing screen list
- All files in `$PROJECT_DIR/cowmoo/design/domains/` (if any exist)
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — for product context (navigation sections, roles)
- Relevant `$PROJECT_DIR/cowmoo/specs/domains/*.md` — for cross-referencing

---

### 2. Identify What's Ready

From working notes, separate items:

**Ready for cowmoo/design/ files** — confirmed design intent, navigation decisions, new roles, journey arcs, screen definitions, finalized state lists, confirmed flows. Tagged `[ready]`.

**Not ready** — open questions, partially discussed screens, alternatives still being considered. Stay in working notes.

**If nothing is ready** — report "Nothing ready to define. Continue discussion or tag items [ready]." and stop.

---

### 3. Write Files in Order

**Write order matters:** roles must exist before domain files reference them; screen-index must be updated to include screens being defined; OVERVIEW and journeys are independent and can be updated anytime ready content exists.

Read the templates before writing:
- `.claude/templates/overview.md`
- `.claude/templates/journeys.md`
- `.claude/templates/roles.md`
- `.claude/templates/screen-index.md`
- `.claude/templates/domain-ui.md`

Process the files in this order:

#### 3a. Update `cowmoo/design/OVERVIEW.md` (if ready content exists for Design Intent or Navigation)

If working notes contain design intent signals (density/formality/mood/rationale) or navigation decisions:

1. **Read** the current OVERVIEW.md (or note it doesn't exist)
2. **Update or create:**
   - Design Intent section: 1-2 paragraphs of prose grounded in product understanding. No token values, no hex codes
   - Navigation Structure section: top-level shape, main sections, sub-navigation pattern
   - Pointers section: links to journeys.md, roles.md, screen-index.md, domains/
3. **Write** the complete updated file following `.claude/templates/overview.md`
4. **Re-read** immediately after writing
5. **Verify** Design Intent and Navigation read well, no raw values leaked in

Skip if this run has no intent or navigation ready items.

#### 3b. Update `cowmoo/design/roles.md` (if new roles emerged)

Roles must be added here **before** any domain file references them.

1. **Read** the current roles.md (or note it doesn't exist)
2. **Add** new roles from working notes to the appropriate category (Interaction, Text, Spacing, Surface, Status, or Product-Specific)
3. **Preserve** existing roles — never silently rename or remove
4. **Write** the complete updated file following `.claude/templates/roles.md`
5. **Re-read** immediately after writing
6. **Verify** new roles are present with concrete descriptions (not aspirational or abstract)

Skip if this run has no new roles.

#### 3c. Update `cowmoo/design/journeys.md` (if end-to-end arcs emerged)

Journeys are cross-domain user arcs. Per-feature flows inside one domain stay in domain files.

1. **Read** the current journeys.md (or note it doesn't exist)
2. **Add or update** journey arcs from working notes
3. **Write** the complete updated file following `.claude/templates/journeys.md`
4. **Re-read** immediately after writing
5. **Verify** each journey spans multiple screens or domains (if it stays in one domain, it's a flow, not a journey — move to domain file instead)

Skip if this run has no journey-level content.

#### 3d. Update `cowmoo/design/domains/[domain].md` (for each ready screen)

**One domain at a time.** When 2+ domains have `[ready]` items, **render the domain-selection choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix — pick the domain with the most ready items as the recommendation, since processing it produces the largest delta in this run. Each option's `description` lists the count and a brief summary of what's ready ("4 ready items: 3 screens, 1 flow"). Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

When only 1 domain has ready items, skip the picker and prose-confirm: "Process `<domain>` (the only domain with ready items)?" — a 1-option picker is degenerate.

For each ready item, structure it per the domain-ui template:

**Screens:** Purpose, entry points, screen type, layout, components (with behavior), applicable states per `.claude/rules/ui-vocabulary.md` (data / form states as relevant, plus spec edge cases), interactions, roles used (references to roles.md)

**Flows:** Per-feature step-by-step journeys that stay inside this domain

**Cross-domain connections:** Where screens reference data from other domains

1. **Read** the target domain file (or note it doesn't exist)
2. **Write** the complete updated file following `.claude/templates/domain-ui.md`
3. **Re-read** immediately after writing
4. **Verify:**
   - Every role referenced in this file exists in `cowmoo/design/roles.md`
   - No raw hex/rgb/pixel values anywhere in the file
   - Applicable states are defined per `.claude/rules/ui-vocabulary.md` — data states for data-fetching screens, form states for forms
   - Spec edge cases have corresponding states

If a role is referenced that doesn't exist in roles.md, go back to step 3b and add it first.

#### 3e. Update `cowmoo/design/screen-index.md` (after domain files are written)

1. **Read** the current screen-index.md (or note it doesn't exist)
2. **Add** new screens from the domain files written in step 3d to the appropriate domain section with 1-line descriptions and cross-references
3. **Write** the complete updated file following `.claude/templates/screen-index.md`
4. **Re-read** immediately after writing
5. **Verify** every screen now defined in domain files appears in the index

#### 3f. Clean Processed Items from Working Notes

Remove items successfully written to `cowmoo/design/` files. Keep untagged and open items. Remove session headers that have no remaining items.

---

### 4. Report

```
## Define Complete

### UI Files Updated
- [File]: [what was added/changed]

### Remaining in Working Notes
- [N] untagged items (still in discussion)

**Next:** Run /review to verify spec coverage, then /publish to commit and push.
```

---

## Completion Checklist

Before finishing, confirm:

- [ ] All [ready] items for target scope transformed to UI definition format
- [ ] OVERVIEW.md created or updated (if Design Intent or Navigation ready) and self-verified
- [ ] roles.md created or updated (if new roles) and self-verified — new roles added before domain files reference them
- [ ] journeys.md created or updated (if cross-domain arcs ready) and self-verified
- [ ] Domain file(s) written and self-verified — all role references exist in roles.md, no raw visual values
- [ ] screen-index.md updated with new screens and self-verified
- [ ] Processed items cleaned from working notes
- [ ] Report presented with next steps (/review → /publish)

---

## Rules

- **Self-verify every edit** — write → re-read → verify. Catches dropped content.
- **Roles before domains** — if a domain file needs a role that doesn't exist in `roles.md`, add it to `roles.md` first, never in the reverse order. Domain files must only reference roles that already exist.
- **States declared per vocabulary** — every screen must declare the states applicable to it per `.claude/rules/ui-vocabulary.md`: data states for data-fetching screens, form states for forms. No implicit states.
- **One domain at a time when writing domain files** — complete the full cycle (roles → domain file → screen-index) before moving to the next domain.
- **Cross-reference specs** — while defining, verify screen states cover spec edge cases.
- **Journeys are cross-domain only** — single-domain flows stay in domain files. If a working notes "journey" stays in one domain, it's a flow.
- **Flexible organization** — if the UI structure doesn't map 1:1 to spec domains (cross-cutting screens like dashboard, settings), create appropriate files. Update screen-index.md to reflect.
