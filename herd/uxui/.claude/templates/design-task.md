# Design Task Template — `new` mode

Body structure for a **`new`-mode** `uxui:todo` issue: a from-scratch design
task. One issue per design **unit** — one screen, or several **coupled** screens
designed together in one Claude Design project.

To revise a screen that **already has a design**, use `design-task-revise.md`
instead — never hand a from-scratch brief for a screen that already exists.

The body has two sections:
1. **Instructions** — short, scannable bullets for the human designer: the
   task's mode/domain/screens, what to do with the prompt, how to submit.
2. **Claude Design Prompt** — long, dense, fully self-contained; copied verbatim
   into `claude.ai/design`. Claude Design has no access to project files —
   every piece of context it needs is inlined. For a multi-screen unit the
   per-screen block repeats; the shared sections (Product context, Visual
   direction, Output) are written once.

`/design-draft` composes this body and stores it as the `body` field of a task
object in `design-draft.json`. `/design-publish` — via `issue-create` — creates
the GitHub issue.

---

## Template

```markdown
## Instructions

**Mode:** new
**Domain:** [domain]
**Screens:** [screen]      ← comma-separated for a multi-screen unit

Work this task by pasting the **Claude Design Prompt** below into
[claude.ai/design](https://claude.ai/design) and iterating with the user until
satisfied. For a multi-screen unit, design every screen in **one** Claude Design
project so shared chrome stays consistent.

**Pay attention to:**
- [bullet specific to this unit — e.g. "the empty state copy must match the spec's onboarding tone"]
- [bullet — e.g. "submit button uses the primary-action role; cancel uses text-muted"]

**Acceptance:**
- [ ] All required states represented visually (see Required States in the prompt)
- [ ] Copy matches the voice samples in the prompt
- [ ] CTA targets and interactions match the spec

**Made a product call?** If you decided something different from this brief — a layout, state, copy, or interaction you judge better — that is expected, not a problem. Note what you changed and why in your submission comment so UXUI can capture it for spec alignment.

**When done:**
1. In Claude Design, click **Share with Claude Code** to get a share URL
2. Comment on this issue with the URL
3. Relabel from `uxui:todo` → `uxui:review`

---

## Claude Design Prompt

Copy everything from here to the end of the issue body, verbatim, into Claude Design.

---

# Product context

[Shared once for the whole unit.]

**Tone:** [inline tone words from OVERVIEW design intent — e.g. "dense utilitarian, warm neutrals, scannable for fast review"]

**References:** [inline reference products from OVERVIEW — e.g. "Linear for density, Stripe for clarity"]

**Anti-references:** [inline what we don't want — e.g. "not stark, not playful, not corporate-finance"]

**Voice samples:**
- [example sentence in the product's voice]
- [example sentence]

---

[Per-screen block — repeat once per screen in the unit. A single-screen unit
has exactly one block.]

# Screen: [Screen Name]

[One-sentence purpose statement.]

## Business context

[Inline the relevant entities, business rules, validations, and terminology from
the spec — directly, not as a reference. What this screen represents in the product.]

## Screen definition

**Purpose:** [what the user accomplishes here]
**Entry points:** [where they arrive from]
**Screen type:** [List / Detail / Form / Dashboard / Settings]

**Layout:**
[High-level structure — major sections, hierarchy, grouping. Inlined from the domain UI def.]

**Components:**
- [Component]: [behavior, data, interactions]

**Copy:**
- [Specific strings expected — labels, button text, helper copy. Inline literal text.]

## Required states (show all visually)

[Only the states that apply to THIS screen, with their meaning inlined. From the canonical state vocabulary.]

- **[state]:** [what it means here, what the user sees]

## Role meanings (semantic purpose only — Claude Design picks the visual values)

[Only the roles this screen uses, each with its semantic purpose inlined.]

- `[role-name]`: [what it's for on this screen]

## Interactions

- **[Action]:** [trigger] → [behavior] → [next state or screen]

[End of per-screen block.]

---

# Visual direction already established

[Shared once. If this unit is screen 2+ in the domain or product, inline a short
description of visual decisions from prior approved bundles — palette character,
typography character, spacing density. If this is the first screen of the
product, write "None yet — this unit establishes initial direction."]

[Optional: a recent prior bundle's share URL as a reference. Share URLs may expire.]

# Output expectation

[Shared once.] Framework-agnostic HTML/CSS prototype. Show each screen at the
primary viewport for this product (per OVERVIEW Design Intent — e.g. desktop
1440px for a data-dense SaaS tool, mobile 390px for a consumer mobile-first app).
Note secondary viewports the spec requires.
```

---

## Rules

- **Self-contained.** The Prompt section references no project files — every
  piece of context Claude Design needs is inlined. "See cowmoo/specs/auth.md" is
  wrong; paste the relevant content.
- **One task per unit.** A unit is one screen, or several coupled screens. A
  multi-screen unit repeats the per-screen block; never split a coupled unit
  into separate tasks (it forces N Claude Design projects that must agree on
  shared chrome).
- **`new` mode only.** This template is for screens with no existing design. A
  screen that already has a design is a `revise` task — `design-task-revise.md`.
- **Roles by name only.** Never inline raw values (no hex, no pixels). The
  Prompt names roles; Claude Design proposes concrete values.
- **Voice samples, not voice description.** Two sample sentences in the
  product's voice, not "friendly but professional."
- **Visual direction is incremental.** The first unit establishes direction;
  later units reference what was approved before.
- **Instructions stay short.** Bullets only — the human scans them.
