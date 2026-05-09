# Design System Skill — Deferred

This is the preserved content of `herd/uxui/.claude/skills/design-system/SKILL.md` and `herd/uxui/.claude/templates/design-system.md`, removed from the active UXUI flow.

## Why it was removed

LLMs are weak at speculative aesthetic decisions. Picking hex values, radius, spacing scales, and doctrine without rendered UI to react to produces noise — the "generic AI aesthetic" problem the skill itself warns about. The machinery forces UXUI to make the decisions it's worst at, with the thinnest grounding.

The replacement model (current direction):
- **UXUI owns vocabulary** — roles (`primary-action`, `destructive`, `muted-text`) in `cowmoo/design/roles.md`
- **UXUI captures intent** — density/formality/mood as prose in `cowmoo/design/OVERVIEW.md` Design Intent section
- **Claude Design output is visual truth** when a designer has produced an approved bundle (Phase B handoff)
- **`src/` is code truth** after first build
- **`cowmoo/agent-files/builder/BUILD-NOTES.md` accumulates** concrete token rules as builder establishes them through iteration with the user
- **Each layer owns its concerns** — no separate design-system file to duplicate or drift from reality

Domain files reference roles by name (same as before); builder implements them using approved design bundles, existing code, or framework defaults. Consistency emerges from real builds, not speculation.

## How to restore

If a future product genuinely needs upfront design-system decisions (e.g., brand constraints from day one, multiple parallel builders needing token alignment before any screens exist):

1. Restore `herd/uxui/.claude/skills/design-system/SKILL.md` from the "Skill content" section below
2. Restore `herd/uxui/.claude/templates/design-system.md` from the "Template content" section below
3. Update `herd/uxui/CLAUDE.md` to list `/design-system` in Available Skills
4. Re-add design-system coverage checks to `herd/uxui/.claude/agents/check-coverage.md`
5. Update `herd/uxui/.claude/skills/define/SKILL.md` to write design-system.md before domain files
6. Re-add `cowmoo/design/design-system.md` reads to planner and builder
7. Decide: should it still run as setup-first, or mid-flow after product understanding?

Consider: even if restored, the setup-first timing was wrong. Mid-flow (after specs + discussion + draft screens) gives the skill grounded input. The content below still uses setup-first wording; update if restored.

## Related ideas

- `ideas/uxui/design-system-skill.md` — earlier iteration notes (not the skill content)
- `ideas/uxui/design-system-tooling-research.md` — preserved research on the tooling ecosystem (shadcn, DTCG, etc.)

---

## Skill content (original `SKILL.md`)

```markdown
---
name: design-system
description: Establish the visual token system and design doctrine for this project. Run once at project start. Resumes if partial, or proposes targeted amendments if complete. Use when starting a new project or when user says /design-system.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, WebFetch, WebSearch
---

# Design System

Guide the user through establishing the visual foundation of the product — tokens (color, typography, spacing, radius, elevation, motion, breakpoints) and doctrine (principles, constraints, anti-patterns). This is a high-impact, once-per-project decision. Take time to understand the product before proposing anything.

`design-system.md` is the single source of truth. Every domain file references tokens from this file by name. Get this wrong and every screen drifts.

---

## Important: Avoid Defaults Bias

LLMs are biased toward a specific aesthetic: Inter or Space Grotesk, gray-on-white with a single blue or purple accent, 8px spacing, generic rounded corners. **This is not a neutral default — it's the aesthetic that says "an LLM made this."** Every product deserves an aesthetic that fits it, not the one that bubbles up from training data.

**Font bias to actively reject:**
1. Inter, Space Grotesk, Geist as automatic defaults — choose something that matches the product's character
2. Matching sans-serif for both display and body — contrast between display and body is what gives a design personality
3. Google Fonts "safest" picks (Roboto, Open Sans, Source Sans) — these are font-of-last-resort, not first-resort

**Color bias to actively reject:**
1. Gray-on-white + one saturated accent — the default SaaS look
2. Purple → blue gradients on white backgrounds — the generic AI aesthetic
3. Slate 900 / slate 500 / slate 50 with nothing else — lifeless

**Spacing bias to actively reject:**
1. 8px base grid applied to everything regardless of product type — admin tools deserve 4px, marketing deserves more
2. Symmetric padding everywhere — asymmetry creates hierarchy

**Ask the user to commit to an aesthetic direction before proposing tokens.** The direction shapes every subsequent choice. Options to seed discussion:

- **Refined minimal** — neutral palette, restrained type, plenty of whitespace, single accent. Think Linear, Vercel.
- **Editorial** — serif display + sans body, generous whitespace, strong hierarchy, accent through weight not color. Think Medium, The Verge.
- **Brutal / raw** — monospace or slab, high contrast, aggressive layout, no ornament. Think Arc, Figma's marketing pages.
- **Playful** — rounded forms, warm palette, generous motion, illustration-first. Think Notion, Linear onboarding.
- **Utilitarian dense** — tight grid, small type, system font, information-first. Think Bloomberg Terminal, admin dashboards.
- **Luxury** — large type, extreme whitespace, slow motion, restrained palette with one unexpected accent. Think fashion e-commerce, premium SaaS.

These are seeds, not a menu. The user may want something not on this list. The goal is a committed direction, not matching one of these exactly.

---

## Session Detection

Before starting, check working files:

| State | Action |
|-------|--------|
| `cowmoo/agent-files/uxui/design-system-notes.md` exists, no `cowmoo/design/design-system.md` | Resume the conversation. Read the notes, summarize where we left off, continue from there. |
| Both `cowmoo/agent-files/uxui/design-system-notes.md` AND `cowmoo/design/design-system.md` exist | Finalization was interrupted. Read `cowmoo/design/design-system.md` — if it looks complete, delete `cowmoo/agent-files/uxui/design-system-notes.md` and confirm with user. If incomplete, resume from the notes. |
| `cowmoo/design/design-system.md` exists, no `cowmoo/agent-files/uxui/design-system-notes.md` | Design system already defined. Show the current system and ask if they want to amend. Amendments update the existing file — add/change specific sections without restarting the whole process. For small additions discovered while defining screens, suggest `/draft` → `/define` which already handles incremental token and doctrine updates. |
| Neither exists | Fresh start. Begin at step 1. |

---

## Process (Fresh Start)

### 1. Read all specs

Read every spec file to understand the product:
- `cowmoo/specs/PRODUCT.md` (product overview, roles, glossary, how it works)
- All files in `specs/domains/` (entities, features, workflows per business area)

Look for signals that shape the design: target user type, industry, tone of voice in descriptions, density of information, user journey complexity, touch vs desktop usage.

### 2. Write product aesthetic summary

Create `cowmoo/agent-files/uxui/design-system-notes.md` with an aesthetic-lens product summary. Not a technical summary — a summary of what the design needs to *feel* like:

- **Product type** — admin tool / marketing site / consumer app / dashboard / editor / mixed
- **User posture** — concentrated work (admin, editor) vs casual scan (marketing, content) vs mixed
- **Density stance** — should this feel dense or airy, and why (tied to product type)
- **Tone signals from specs** — is the product playful, serious, editorial, utilitarian, luxurious
- **Primary device** — mobile-first, desktop-first, or equal priority
- **Accessibility baseline** — WCAG AA as default; note any stricter requirements from specs (healthcare, gov, education)
- **Brand constraints** — any existing assets, colors, fonts from specs that must be respected

This grounds every subsequent decision. Every proposal you make should reference this summary.

### 3. Research comparable systems (optional but recommended)

If you have access to `@research`, spawn it with a targeted question — not a broad one:

> "For a [product type] targeting [user type], how do 2-3 comparable design systems (e.g., Material, Carbon, Polaris, Radix, shadcn) handle [specific thing: typography scale / spacing base / color role structure]?"

Research findings go to `cowmoo/agent-files/uxui/RESEARCH.md`. Skim the results and pull the 2-3 most relevant examples into the notes. Don't copy a system wholesale — use the research to ground your opinionated proposal.

Skip this step if `@research` is unavailable or if the product type is so distinctive that comparables are misleading.

### 4. Commit to an aesthetic direction

Before proposing any tokens, propose 2-3 aesthetic directions tied to the product summary. Describe each concretely — not "clean and modern" but:

- "**Editorial serif + generous whitespace + restrained color.** Display type in a classic serif (Tiempos, Publico, New York), body in a humanist sans (Söhne, Graphik). Near-full-page hero images. One saturated accent, used sparingly. Feels like a magazine, not a product."
- "**Utilitarian sans + dense 4px grid + single accent.** System-adjacent sans (IBM Plex, Inter Display), small type scale (14/12/11), tight line-height, 4px base grid, one saturated accent for action buttons, everything else neutral. Feels like a professional tool."
- "**Playful rounded + warm palette + generous motion.** Rounded display (Sharp Grotesk, Circular), generous body line-height, warm off-white background, multi-color palette, enthusiastic transitions. Feels welcoming."

These are concrete proposals, each grounded in the product summary. The user picks one or redirects. Capture the chosen direction to notes as "Direction: [name] — [reason]".

### 5. Propose section by section

One section at a time, not 10 questions upfront. For each, propose a concrete starting point grounded in the chosen direction. The user approves or redirects. Capture each decision to notes as it's confirmed.

Order:
1. **Foundations** — base spacing unit, grid, theme stance (light/dark/both)
2. **Color** — palette with semantic roles (primary, text, text-muted, background, surface, border, plus optional accent/success/warning/error). Provide actual values, not placeholders.
3. **Typography** — font families (display/body/mono), type scale with role per size. Propose specific fonts, not "a clean sans". Cite the chosen direction for each font choice.
4. **Spacing scale** — multiples of the base unit with usage descriptions.
5. **Radius, elevation, motion** — small scales with intentional steps. No "just add another shadow" — each step has a job.
6. **Breakpoints** — primary device and responsive stance.
7. **Doctrine** — principles, constraints, anti-patterns (see step 6).

After each section is confirmed, write the decision into `cowmoo/agent-files/uxui/design-system-notes.md` as you go. Notes should be readable by a future session.

### 6. Doctrine — the hard part

Doctrine is 2-3 principles, 2-3 constraints, 2-3 anti-patterns. Each must be specific and actionable. "Be accessible" is not a principle — "WCAG AA contrast minimum on all text against both background tokens" is a constraint. "Clean design" is not a principle — "Clarity over density — prefer whitespace and hierarchy over packing more information on-screen" is.

**Anti-patterns must include an explicit rejection of LLM-default aesthetics** if the chosen direction is anything other than what an LLM would generate by default. Examples:

- "No Inter-on-white with a purple accent — that's the generic AI aesthetic we're avoiding."
- "No symmetric 8px grid applied to every surface — admin panels use 4px, marketing uses 8px, and we commit to that difference."
- "No gradient backgrounds on hero surfaces — we chose an editorial direction; solid backgrounds with strong type carry the weight."

Push back if the user proposes generic principles ("make it clean", "use best practices"). Specifically ask: "What does that mean in practice on the invoice list screen?" Unanswerable = too vague.

### 7. Finalize

When all sections are confirmed and doctrine is concrete:

1. Read `.claude/templates/design-system.md` to understand the target file structure
2. Write `cowmoo/design/design-system.md` using that structure, with every decision from notes filled in
3. **Self-verify:** re-read the file immediately. Every token from notes must be present. Every doctrine entry must be concrete (grep for words like "appropriate", "relevant", "good" — these signal aspirational, not concrete). Every required color role must exist: `primary`, `text`, `text-muted`, `background`, `surface`, `border`.
4. Delete `cowmoo/agent-files/uxui/design-system-notes.md` — session detection next time should correctly hit "already defined"
5. Report what was written, then suggest:
   - `/publish` to commit
   - `/start` to begin defining screens (which will now reference these tokens)

---

## Amendments Branch (file exists, no notes)

When `cowmoo/design/design-system.md` exists and is complete:

1. Read the current file
2. Show a summary: "Current system: [direction], [N colors], [N type sizes], [N spacing steps], doctrine with [N principles, N constraints, N anti-patterns]"
3. Present the amendment shapes to the user:
   - **Add a token** (new color role, new type size, new spacing step) — targeted edit, read → edit → re-read → verify
   - **Change a token value** (tweak the primary color, adjust body size) — warn about cascade impact before editing, edit, re-read, verify. Remind the user that `@check-design` on builder will catch any code still using the old value.
   - **Add or revise doctrine** (new constraint, new anti-pattern) — read → edit → re-read → verify
   - **Substantial overhaul** (new direction entirely) — this is a major change. Offer to start fresh (delete and re-run Process), not patch section by section.

Small additions discovered while defining a screen are better handled through `/draft` → `/define`, which already merges token and doctrine decisions from working notes into `design-system.md`. Redirect the user if the amendment is incremental.

---

## Resume Branch (notes exist, no file)

When `cowmoo/agent-files/uxui/design-system-notes.md` exists but `cowmoo/design/design-system.md` doesn't:

1. Read the notes
2. Summarize where the last session stopped: "Last session captured [sections], stopped at [section]. Do you want to continue from there, or rethink [specific decision]?"
3. Continue the section-by-section process from step 5 of the fresh-start process, skipping confirmed sections

---

## Conversation Style

- **Propose and recommend, don't interrogate.** Lead with a concrete proposal grounded in the product summary. The user reacts to options, not open-ended questions.
- **Push back when the user's choice conflicts with the product type.** A luxury marketing site shouldn't use Inter. An admin dashboard shouldn't use a 12-column 48px gutter grid. Say so with reasoning. If the user insists after hearing the reasoning, accept and capture.
- **Don't be sycophantic.** "Great choice!" is only valid when it genuinely is. "That's unusual for this product type because X, but if the reason is Y, it can work" is honest.
- **Don't hedge.** If you have an opinion, state it. "I'd go with a serif display because editorial direction + luxury product + scan-first user posture" is more useful than "Either serif or sans would work".
- **Stay concrete.** Every proposal includes a specific font, a specific color value, a specific spacing number. No "something like..." or "approximately...".

---

## Rules

- **Single-shot setup skill.** `/design-system` establishes the foundation. Incremental tweaks during screen work go through `/draft` → `/define`.
- **Never write placeholders.** If you don't have a value for a token, keep discussing until you do. "TBD" or "..." in the final file is a bug.
- **Every token must have a usage statement.** Not just a name and value — where it applies and where it shouldn't.
- **Doctrine is specific or it's cruft.** If an entry could apply to any product, it's not doctrine for this one.
- **Self-verify every write.** Write → re-read → verify each token and doctrine entry. Catches dropped content.
- **Respect manual edits.** If the user has been editing `design-system.md` by hand, the amendments branch reads the current state, not a stale cache.

---

## References

- `.claude/templates/design-system.md` — final output structure and field definitions
- `herd/uxui/.claude/rules/ui-vocabulary.md` — canonical state vocabulary and role-naming convention (the 8 path-scoped pattern rules originally proposed — accessibility, forms, density, etc. — were reverted during cleanup; all are now absorbed into `ui-vocabulary.md` or deleted as base-model knowledge)
```

---

## Template content (original `design-system.md`)

```markdown
# Design System Template

Structure for `cowmoo/design/design-system.md`. This is the single source of truth for visual tokens (colors, typography, spacing, radius, elevation, motion, breakpoints) and design doctrine (principles, constraints, anti-patterns). One file per project.

Companion to `cowmoo/design/OVERVIEW.md` (structural navigation, global behavioral patterns) and `cowmoo/design/domains/*.md` (per-domain screen definitions).

---

## Template

\```markdown
# Design System

Visual tokens and doctrine for [product name]. Single source of truth — domain files and screens reference these tokens by name.

Companion to `cowmoo/design/OVERVIEW.md` and `cowmoo/design/domains/*.md`.

---

## Foundations

**Base spacing unit:** [e.g. 4px — all spacing derives from this]
**Grid:** [grid system — e.g. 12-column desktop, fluid mobile]
**Theme stance:** [light-only / dark-only / both — and which is default]

---

## Color System

### Color Tokens

| Token | Value | Role | Usage | Don't |
|-------|-------|------|-------|-------|
| `color-primary` | #0066FF | primary | Primary CTAs, active states, key brand moments | Body text, large backgrounds |
| `color-accent` | ... | accent | Secondary emphasis, highlights | Destructive actions |
| `color-text` | ... | text | Default body text and headings | On dark backgrounds without contrast check |
| `color-text-muted` | ... | text-muted | Secondary text, timestamps, metadata | Primary calls-to-action |
| `color-background` | ... | background | Page background | Raised surfaces |
| `color-surface` | ... | surface | Cards, modals, elevated panels | Page background |
| `color-border` | ... | border | Dividers, input borders | Emphasis |
| `color-success` | ... | success | Positive state feedback | Informational content |
| `color-warning` | ... | warning | Cautionary state feedback | Primary actions |
| `color-error` | ... | error | Error state, destructive actions | Decorative emphasis |

Required roles: `primary`, `text`, `text-muted`, `background`, `surface`, `border`.
Optional roles: `accent`, `success`, `warning`, `error`, any product-specific additions.

[Full original template follows — color roles in context, typography scale, spacing scale, radius, elevation, motion, breakpoints, doctrine with principles/constraints/anti-patterns]
\```

[Original template continues with Field Definitions, Rules, and Checklist sections — see git history for full content before removal]
```

Note: the full template has been preserved via git history at the point of removal. To recover verbatim, `git log -- herd/uxui/.claude/templates/design-system.md` and `git show <commit>:herd/uxui/.claude/templates/design-system.md`.
