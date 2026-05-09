# UXUI: /design-system Skill + cowmoo/design/design-system.md

## Problem

Every screen the UXUI agent defines makes independent choices about spacing, typography, color roles, and component states. Even with templates saying "no pixels," the LLM fills concrete values when forced to produce output — and those values drift across screens because there's no shared reference. The builder then implements against inconsistent guidance, and the final product looks stitched together.

No ground truth exists for "what does this product look like" beyond per-screen descriptions. Each definition re-invents decisions that should be made once.

## Solution

### New skill: `herd/uxui/.claude/skills/design-system/SKILL.md`

Runs once at project start, same lifecycle as planner's `/tech-stack`. Establishes the visual foundation before any screen definitions exist.

Process:
1. Read `cowmoo/specs/PRODUCT.md` for product context (target users, domain, tone)
2. Use `@research` (if implemented) to pull 2-3 comparable product design systems for reference
3. Propose a starting system with opinionated defaults grounded in research, not generic
4. Discuss with user one section at a time — not a 10-question upfront dump
5. Write to `cowmoo/design/design-system.md` with self-verification

Key difference from techstack: the design system is visual, not technical. The user should be able to *see* what each choice means. Where possible, the skill should describe choices in terms the user can picture ("compact admin density with 4px base grid," "neutral gray scale for backgrounds with one vibrant brand color").

### Output file: `cowmoo/design/design-system.md`

Semantic tokens, not raw values scattered across screens:

```markdown
# Design System

## Color
### Semantic Roles
- `primary` — main brand color, used for primary actions, active states, links
- `neutral-*` — grayscale ramp (50, 100, 200, 300, 400, 500, 600, 700, 800, 900)
- `success`, `warning`, `danger`, `info` — status colors
- `surface-*` — background layers (base, raised, overlay)

### Actual Values
[hex codes or named tokens — decided during the skill]

## Typography
### Scale
- `display` — page titles, hero text
- `heading-1` through `heading-4` — section hierarchy
- `body-lg`, `body`, `body-sm` — content
- `caption`, `overline` — metadata

### Values
[font family, sizes, weights, line heights per level]

## Spacing
### Scale
Base unit: 4px (or 8px — density-dependent)
Steps: 1, 2, 3, 4, 6, 8, 12, 16, 24 (multiples of base)

## Radius
`none`, `sm`, `md`, `lg`, `full` — with actual values

## Shadow
`none`, `sm`, `md`, `lg` — elevation hierarchy

## Motion
- Durations: fast (100ms), normal (200ms), slow (300ms)
- Easing: standard, accelerate, decelerate

## Component States
- Default, hover, focus, active, disabled, loading, error, success
- Each state's visual treatment (what changes)

## Breakpoints
- mobile, tablet, desktop, wide — with pixel values

## Density
Selected density: [compact | comfortable | spacious] — with reasoning tied to product type

## Accessibility Baseline
- Minimum contrast ratios
- Focus indicator requirements
- Minimum touch target size
```

### Integration points

- `cowmoo/design/domains/*.md` — every component reference uses tokens (`spacing-4`, `body-lg`, `primary`) not pixel values
- `design-brief.md` template — add a "Design System" section that includes or links to the design-system.md
- Planner's task PRDs — when Designs section references uxui/, also reference the design system file so builder sees it
- Builder — reads `cowmoo/design/design-system.md` during `/build` when implementing UI, uses the tokens as CSS variables or framework theme values
- Builder check — `@check-design` should verify implementation uses the tokens, not hardcoded values

### Session detection

Same pattern as `/tech-stack`:

| State | Action |
|-------|--------|
| `cowmoo/design/design-system.md` missing | Fresh start — run the skill |
| Exists with complete content | Already defined. Show current system, offer amendments |
| Exists but thin/partial | Resume the conversation from where it stopped |

### Workflow integration

Add to UXUI setup sequence:
```
/design-system → /start → discuss → /draft → /define → /review → /publish
```

`/start` should detect missing design system and suggest running it first, similar to how planner's `/start` detects missing techstack.

Update `herd/uxui/tools/dev-tools.cjs`:
- Add `design-system` to SEQUENCE (setup flow) or UNTRACKED
- Update statusline `known` list
- `hookSessionStart` checks for missing design-system.md and notes it

## Trade-offs

- Adds a required setup step users must engage with before real UI work. Mitigated by opinionated defaults — the skill should be able to propose a complete system the user just approves, not force them to answer 20 questions.
- Design systems tend to drift from actual implementation if not enforced. The builder `@check-design` suggestion above closes that loop, but it's new work.
- Opinionated defaults may not fit every product (e.g., marketing site vs admin dashboard need different densities). The skill should detect product type from specs and propose accordingly.
- Changes late in the project are expensive — changing `primary` color cascades everywhere. Acceptable cost; the alternative (no system) is worse.
- The file is a permanent artifact the user can edit manually. Agent should respect manual edits the same way `/tech-stack` respects edits to `techstack.md`.

## Dependencies

- Benefits significantly from `@research` being available (see `rules-and-research-agent.md`) — without research, the "grounded in real systems" promise becomes "LLM picks from training data."
- Rules files (same idea doc) complement this — design system handles values, rules handle patterns. Both together fix the randomness problem.

## Order

After rules files + `@research` are in place. Design system builds on both: rules for pattern grounding, research for value grounding.
