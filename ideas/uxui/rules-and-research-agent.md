# UXUI: Rules Files + @research Agent

> **Status (2026-04-16):** Part A (8 path-scoped rule files) was implemented, then **reverted** during a later cleanup. Path-scoped rules fire only on Read (not Write/Edit/Grep), and sub-agents don't inherit them, making the mechanism unreliable. UXUI now has a single always-loaded `ui-vocabulary.md` covering canonical state vocabulary + role-naming convention. Sub-agents that need the content (`@check-coverage`) Read `ui-vocabulary.md` explicitly. Part B (`@research` sub-agent) was implemented and remains. Do NOT re-implement Part A as described below.

## Problem

When the UXUI agent defines UI without a designer, outputs feel like random LLM guesses — padding, text sizes, interaction patterns filled in without grounding. The templates already say "no pixels, no prescriptions," so the issue isn't the template. It's that the LLM has no opinionated defaults to reach for when it has to produce concrete output.

UXUI also has no research capability. PM and planner both have `@research` agents that can pull industry patterns, accessibility standards, and competitor approaches. UXUI is the agent that most needs this grounding, and it's the only one without it.

## Solution

### A. Auto-loaded rules files

Add `herd/uxui/.claude/rules/*.md` files with `paths:` frontmatter, same pattern as builder's `frontend.md`, `database.md`, `security-on-api.md`.

Candidate rules files:
- `accessibility.md` — WCAG baseline: focus indicators, contrast ratios, keyboard nav, ARIA roles, semantic HTML, skip links
- `forms.md` — label placement, inline validation, error message patterns, disabled state during submit, Enter-key submit, required field indicators
- `lists-and-tables.md` — empty states, loading patterns, pagination vs infinite scroll vs virtualization thresholds, sorting/filtering conventions, bulk actions
- `states.md` — required states per component type (empty, loading, populated, error, partial, optimistic), transitions between them, what each should communicate
- `interaction.md` — hover/focus/active/disabled conventions, feedback timing (instant vs debounced vs async), destructive action confirmations, toast vs modal vs inline
- `navigation.md` — breadcrumb patterns, back behavior, section switching, URL structure conventions, nested nav depth limits
- `responsive.md` — breakpoint conventions, mobile-first vs desktop-first, touch target sizes, what collapses at what breakpoint
- `density.md` — matching density to use case (admin dense, marketing airy, dashboard mixed), never applying one density everywhere

Each file should be short — opinionated defaults the LLM reaches for, not exhaustive documentation. (Note: `paths:` rule scoping was abandoned in cowmoo because path-scoped rules fire only on Read and don't propagate to sub-agents — see `docs/ARCHITECTURE.md`. Any rules added under this idea would be always-loaded today.)

### B. Add `@research` agent to UXUI

Mirror the PM/planner `@research` pattern. Lives at `herd/uxui/.claude/agents/research.md`, tools: WebFetch, WebSearch, Read, Write. Writes findings to `cowmoo/agent-files/uxui/research/<topic>.md`.

What UXUI would research:
- Industry conventions for specific interaction patterns ("how do SaaS products handle bulk archive?")
- Accessibility standards for specific components ("what are the WCAG requirements for date pickers?")
- Comparable product UI patterns ("how do PM tools handle sub-task drag-drop?")
- Design system references ("what spacing scales do Material, Carbon, Polaris use?")

Used during `/brief`, `/define`, and the future `/design-system` skill.

### C. Update existing skills to use them

- `/brief` — read research before composing briefs, cite industry patterns in the Context & Inspiration section
- `/define` — reference rules files when describing component behavior; research ambiguous patterns instead of guessing
- `/review` — `@check-coverage` should verify spec edge cases are covered, but a new check could verify rules compliance (every list has empty state, every form has validation, every interactive element has focus indicator). This is optional — may be better as lint than a separate check agent.

## When to Run

Both are ongoing — rules load automatically, research runs on demand during any UXUI skill.

## Trade-offs

- Rules files add auto-loaded context to every UXUI session. Each file should stay under ~40 lines to keep the cost proportional to the value.
- `@research` adds another agent to maintain, but the pattern is well-established (copy from PM with adjusted tools and output path).
- Risk of rules being too prescriptive and conflicting with project-specific needs. Mitigated by making them opinionated defaults, not hard constraints — the agent can deviate when justified.
- Nothing forces the agent to actually use the rules. This is already true for builder's rules files; it's a soft nudge, not enforcement.
- Research findings can accumulate in `cowmoo/agent-files/uxui/research/` indefinitely. No cleanup mechanism today — same as PM and planner research folders.

## Order

Rules files first (cheap, high leverage, no new agent). `@research` second. This keeps each change small and reversible.
