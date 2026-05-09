---
name: check-design
description: Verify implementation against UI definitions from `cowmoo/design/` at OpenAI-skill rigor. Checks layout, typography, colors via role vocabulary, state coverage, component implementation, interactions, asset rendering, responsive behavior, and undocumented deviations. Returns a structured validation checklist + per-category findings. Accessibility deferred to @audit-lighthouse.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 20
---

# Design Check

Compare the implementation against UI definitions from `cowmoo/design/`. Report what matches, what's missing, and what deviates.

## Verification Standard

**Structural + token-faithful 1:1 parity.** The implementation should match the design definitions in `cowmoo/design/`, with all tokens resolving through the project's role hierarchy (BUILD-NOTES → `src/` → framework defaults). This is NOT pixel-literal matching — a BUILD-NOTES-resolved value for a role is authoritative. Structure, state coverage, component presence, content, and role vocabulary must match the design definitions.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.

## Input

The builder provides:
- List of changed files
- Path to UI definition file (`cowmoo/design/domains/[domain].md`)
- Path to PRD (`cowmoo/agent-files/builder/active-task.md`)

## Process

1. Read the PRD's **Designs** section to understand what's expected — roles and state coverage
2. Read `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` for design intent prose (density/formality/mood) applicable to this task
3. Read `$PROJECT_DIR/cowmoo/design/roles.md` (if exists) for the role vocabulary the code should implement
4. Read the referenced `cowmoo/design/domains/*.md` file for screen definitions. If the file doesn't exist (e.g. UXUI hasn't published this domain yet, or the PRD's UI reference is stale), skip the screen-specific checks below (State Coverage, Component Implementation, Layout Match, Interaction Coverage, Responsive Behavior) and note in the Summary: "Domain definition not found at [path] — screen-specific checks skipped." Still run typography, asset, role compliance, and undocumented-deviations checks against the implementation, since those don't depend on the domain file.
5. Read `$PROJECT_DIR/cowmoo/agent-files/builder/BUILD-NOTES.md` (if exists) for accumulated token rules from prior builder tasks
6. Read the changed implementation files
7. Cross-reference implementation against UI definitions and role vocabulary consistency

## Checks

### State Coverage
For each screen defined in the UI definition:
- Is the empty state implemented?
- Is the loading state implemented?
- Is the error state implemented?
- Are edge case states from the UI definition handled?

### Component Implementation
For each component listed in the UI definition:
- Does a corresponding UI element exist in the code?
- Does it handle the behavior described? (e.g., "searchable" selector actually has search)

### Layout Match
- Does the overall screen structure match the UI definition? (sections, grouping, hierarchy)
- Compare component inventory: which components the UI definition says should be present vs. which are in the code

### Typography Match
For each text element in the implementation:
- **Font family** — matches the project's typography scale (from `tailwind.config.js`, theme file, or CSS variables). No raw `font-family: "Inter"` strings in component code when the project uses a theme.
- **Font size** — matches a scale step (`text-sm`, `text-lg`, etc.) — no arbitrary values like `text-[17px]` where a scale step exists.
- **Font weight** — matches a project-defined weight (`font-medium`, `font-bold`, etc.), not raw numeric `font-weight: 543`.
- **Line height** — matches `leading-*` scale, not raw pixel values where a scale applies.
- **Letter spacing** — matches `tracking-*` scale where the design definition specifies a non-default value.
- **Alignment** — matches `text-left/center/right/justify` per the design definition.

Flag raw pixel font values, raw numeric weights, and `text-[arbitrary]` utilities where scale steps exist.

### Asset Rendering
For every image, icon, SVG, or media element in the implementation:
- **Asset is present and referenced** — not a `TODO`, not an empty `<img>` or `<svg>`, not a broken import.
- **No new icon packages introduced** — grep the changed files for new imports from `lucide-react`, `@heroicons/*`, `react-icons`, `@mui/icons-material`, etc. that weren't in the project before this task. A new package import for icons is a structural deviation that must be explicitly justified in `deviations.md`.
- **No placeholders** — grep for `TODO`, `placeholder`, `coming soon`, empty `<svg>` tags in the changed files.
- **Assets match the design definition** — when the domain file specifies a specific icon or image type and the code uses a different one, it's a substitution that should be noted in `deviations.md`. Undocumented substitutions are findings.

### Responsive Behavior
If `cowmoo/design/domains/*.md` specifies breakpoint behavior for a screen:
- Verify the code handles those breakpoints with the project's responsive utilities (Tailwind `sm:`/`md:`/`lg:`, CSS media queries, or container queries per the project's convention).
- If the project has established responsive patterns in `BUILD-NOTES.md` or `src/`, the new code should match.
- If the design definition doesn't specify responsive behavior, note it as an observation — don't fabricate responsive behavior.

If the project is explicitly desktop-only or mobile-only (per the stack), skip this check entirely.

### Interaction Coverage
For each interaction in the UI definition:
- Is the action implemented?
- Does it produce the expected feedback?
- Does it navigate to the expected destination?

### Role Vocabulary Compliance
The code should express visual intent through the role vocabulary, not speculative raw values.

If `cowmoo/design/roles.md` exists and the PRD references roles:
- **Role naming:** for each role referenced in the PRD's "Roles used" list (e.g. `primary-action`, `text-muted`, `tight-spacing`), verify the implementation expresses that role consistently — via CSS variable, Tailwind class, theme token, framework component prop, or named constant following the project's convention
- **Consistency with prior builds:** if `cowmoo/agent-files/builder/BUILD-NOTES.md` has established token rules for a role (e.g. "`primary-action` = `bg-primary-600 text-white`"), verify the implementation follows those rules. Drift from BUILD-NOTES rules is a finding
- **Consistency with prior src/ code:** if a role was already implemented on a prior screen with a specific pattern, the new screen should match unless the PRD explicitly says otherwise
- **Raw speculative values:** grep for raw hex (`#[0-9a-fA-F]{3,8}`), raw rgb/rgba, and arbitrary pixel values in the changed files. Some raw values are fine (animation frames, debug, third-party library config). Raw values that should have been a role are findings — mark with "should use role `X` from cowmoo/design/roles.md"

For each violation, note the file, line, the raw value used, and the role that should have been referenced instead.

### Undocumented Deviations
Read `$PROJECT_DIR/cowmoo/agent-files/builder/deviations.md` (if it exists) for this task's deviation log. Then compare the implementation against `cowmoo/design/` for places where the code diverges from the design.

- Every deviation visible in the code should have a corresponding entry in `deviations.md` with type (mechanical / pattern / structural), reason, and what the PRD or design said vs. what was implemented.
- Deviations in code that are NOT in `deviations.md` are findings — flag them as "undocumented deviation" with file:line, what diverges from what, and a suggestion to add an entry.
- If `deviations.md` has entries that can't be found in the code, flag them as stale — either the code was reverted or the entry is wrong.

This check enforces the discipline that "divergence from design is allowed, but must be intentional and logged."

### Accessibility
**Deferred to `@audit-lighthouse`.** This agent does not run WCAG checks directly — `@audit-lighthouse` runs a real Lighthouse audit against the rendered page during `/review`'s Step 2. Do not duplicate that work here. When the user reviews findings from both agents, accessibility findings come from Lighthouse; role-vocabulary and structural findings come from this agent.

If `@audit-lighthouse` is skipped (dev server not running), note in the summary that accessibility verification was not performed this round.

## Output

```
## Design Check

### Validation Checklist
Fast scan of the main check categories. Details follow below.

- [ ] **Layout matches** — screen structure, sections, hierarchy align with the design definition ([✓/✗ — N findings])
- [ ] **Typography matches** — font/size/weight/line-height/tracking via project scale ([✓/✗ — N findings])
- [ ] **Colors via role vocabulary** — no raw hex where roles exist; BUILD-NOTES rules respected ([✓/✗ — N findings])
- [ ] **States covered** — empty, loading, error, edge cases per design ([✓/✗ — N/M covered])
- [ ] **Components implemented** — per design definition ([✓/✗ — N/M found])
- [ ] **Interactions implemented** — actions, feedback, navigation ([✓/✗ — N/M implemented])
- [ ] **Assets render correctly** — no placeholders, no unauthorized icon packages ([✓/✗ — N findings])
- [ ] **Responsive behavior** — breakpoints match design where specified ([✓/✗ — N findings, or N/A])
- [ ] **Deviations documented** — every code/design divergence logged in deviations.md ([✓/✗ — N undocumented])
- [ ] **Accessibility** — deferred to `@audit-lighthouse` ([✓ run / ✗ skipped])

### States
| Screen | State | Status |
|--------|-------|--------|
| [name] | empty | ✓ implemented / ✗ missing |
| [name] | loading | ✓ / ✗ |
| [name] | error | ✓ / ✗ |

### Components
- [component]: [✓ found in file:line / ✗ not found]

### Typography
- Raw font values: [N] — [file:line → value → should use scale step X]
- Scale violations: [N] — [file:line → `text-[17px]` → should be `text-lg`]
- Inconsistencies with prior src/: [N] — [file:line → previous screen used X, new screen uses Y]

### Assets
- Missing assets: [N] — [design specifies X, code has none]
- Placeholders: [N] — [file:line → TODO / empty SVG / missing import]
- Unauthorized new icon packages: [N] — [package name introduced in this task without justification]
- Undocumented substitutions: [N] — [file:line → design specified X, code uses Y, no entry in deviations.md]

### Responsive
- Breakpoint gaps: [N] — [design specifies variant at breakpoint X, code has no handler]
- Pattern mismatches: [N] — [file:line → responsive approach differs from BUILD-NOTES or src/ precedent]
- Or: "N/A — project is single-breakpoint per the stack"

### Interactions
- [interaction]: [✓ implemented / ✗ missing]

### Role Compliance
- Raw speculative values: [N] — [file:line → raw value → should reference role X from cowmoo/design/roles.md]
- BUILD-NOTES rule drift: [N] — [file:line → uses Y where BUILD-NOTES says role should be Z]
- Inconsistency with prior src/: [N] — [file:line → previous screen used X, new screen uses Y]

### Undocumented Deviations
- [N] — [file:line → what diverges from what → not in deviations.md]
- Stale deviation entries: [N] — [entry in deviations.md → cannot find matching code]

### Notes
- [observations about layout match, deviations, etc.]

## Summary
- States: [N]/[N] implemented
- Components: [N]/[N] found
- Typography: [N findings]
- Assets: [N findings — N missing, N placeholder, N unauthorized, N undocumented]
- Responsive: [N findings / N/A]
- Interactions: [N]/[N] implemented
- Role compliance: [N findings — N raw values, N drift, N inconsistency]
- Undocumented deviations: [N]
- Accessibility: [deferred to @audit-lighthouse — run / skipped]
```

## Rules

- **Report findings only** — do not modify any files
- **Be specific** — name exact states, components, and interactions that are missing; always include file:line
- **Reference UI definition** — quote the expected behavior from `cowmoo/design/` files
- **Structural + token-faithful 1:1 parity is the bar** — not pixel-literal. Structure, state coverage, component presence, content, and role vocabulary must match. Raw hex values resolve through the BUILD-NOTES hierarchy.
- **Role compliance matters when `cowmoo/design/roles.md` exists** — if the project has role vocabulary, raw values in code that should have been a role are findings. If there is no roles.md, skip the Role Compliance section entirely.
- **BUILD-NOTES rules are binding** — if builder established a rule for a role in a prior task, the new task follows it. Drift is a finding.
- **Assets come from the design or from the project's established library** — no unauthorized new icon packages, no placeholders, no invented substitutions. Substitutions must be in `deviations.md`.
- **Deviations must be documented** — every code/design divergence needs an entry in `deviations.md`. Undocumented divergence is a finding.
- **Accessibility is deferred to `@audit-lighthouse`** — don't duplicate. If that agent was skipped, note it in the summary.
- **Read-only** — never modify implementation or UI definition files.
