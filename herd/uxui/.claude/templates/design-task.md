# Design Task Template

Body structure for `uxui:todo` issues created via `/design-publish`. One issue per screen.

The body has two sections:
1. **Instructions** — short, scannable bullets for the human designer. Tells them what to do with the prompt and how to submit results.
2. **Claude Design Prompt** — long, dense, fully self-contained. The human copies this verbatim into `claude.ai/design`. Claude Design has no access to project files — every piece of context it needs must be inlined here.

The skill `/design-draft` writes this body inline (main agent, full conversation context). The skill `/design-publish` (via `@uxui-gh-ops CREATE_DESIGN_TASK`) creates the GitHub issue.

---

## Template

```markdown
## Instructions

Work this task by pasting the **Claude Design Prompt** below into [claude.ai/design](https://claude.ai/design) and iterating with the user until satisfied.

**Pay attention to:**
- [bullet specific to this screen — e.g. "the empty state copy must match the spec's onboarding tone"]
- [bullet — e.g. "submit button uses the primary-action role; cancel uses muted-text"]
- [bullet — e.g. "form validation runs on blur, not on submit"]

**Acceptance:**
- [ ] All required states represented visually (see Required States in the prompt)
- [ ] Copy matches the voice samples in the prompt
- [ ] CTA targets and interactions match the spec

**When done:**
1. In Claude Design, click **Share with Claude Code** to get a share URL
2. Comment on this issue with the URL
3. Relabel from `uxui:todo` → `uxui:review`

> Optional: if continuing from a prior screen's Claude Design session, you can skip the **Product Context** section below — Claude Design already has it from the earlier conversation. Paste only the Screen sections.

---

## Claude Design Prompt

Copy everything from here to the end of the issue body, verbatim, into Claude Design.

---

# [Screen Name]

[One-sentence purpose statement.]

## Product context

**Tone:** [inline tone words from OVERVIEW design intent — e.g. "dense utilitarian, warm neutrals, scannable for fast review"]

**References:** [inline reference products from OVERVIEW — e.g. "Linear for density, Stripe for clarity"]

**Anti-references:** [inline what we don't want — e.g. "not stark, not playful, not corporate-finance"]

**Voice samples:**
- [example sentence in the product's voice]
- [example sentence]

## Business context

[Inline the relevant entities, business rules, validations, and terminology from the spec — directly, not as a reference. Anything Claude Design needs to know about WHAT this screen represents in the product.]

## Screen definition

**Purpose:** [what the user accomplishes here]
**Entry points:** [where they arrive from]
**Screen type:** [List / Detail / Form / Dashboard / Settings]

**Layout:**
[High-level structure — major sections, hierarchy, grouping. Inlined from the domain UI def.]

**Components:**
- [Component]: [behavior, data, interactions]
- [Component]: ...

**Copy:**
- [Specific strings expected — labels, button text, helper copy. Inline literal text.]

## Required states (show all visually)

[Only the states that apply to THIS screen, with their meaning inlined. From the canonical state vocabulary.]

- **[state]:** [what it means here, what the user sees]
- **[state]:** ...

## Role meanings (semantic purpose only — Claude Design picks the visual values)

[Only the roles this screen uses, each with its semantic purpose inlined. Claude Design picks concrete tokens; we just declare the meaning.]

- `[role-name]`: [what it's for on this screen]
- `[role-name]`: ...

## Interactions

- **[Action]:** [trigger] → [behavior] → [next state or screen]
- **[Action]:** ...

## Visual direction already established

[If this is screen 2+ in the domain or product, inline a short description of visual decisions from prior approved bundles — palette character, typography character, spacing density. If this is the first screen of the product, write "None yet — this screen establishes initial direction."]

[Optional: include a recent prior bundle's share URL as a reference. Note that share URLs may have expired.]

## Output expectation

Framework-agnostic HTML/CSS prototype. Show the screen at the primary viewport for this product (per OVERVIEW Design Intent — e.g. desktop 1440px for a data-dense SaaS tool, mobile 390px for a consumer mobile-first app). Note secondary viewports the spec requires (mobile responsive, tablet, etc.).
```

---

## Rules

- **Self-contained.** The Prompt section must reference no project files — every piece of context Claude Design needs is inlined. "See cowmoo/specs/auth.md" is wrong; the relevant content from that spec must be pasted in.
- **One screen per task.** Multi-screen prompts make iteration scope unclear. If a batch covers 3 screens, that's 3 independent `uxui:todo` tasks.
- **Roles by name only.** Never inline raw values (no hex codes, no pixel sizes). The Prompt names roles; Claude Design proposes concrete values.
- **Voice samples, not voice description.** "Friendly but professional" is vague. Two sample sentences in the product's voice are concrete.
- **Visual direction is incremental.** First screen establishes direction. Subsequent screens reference what was approved before — keeps cross-screen alignment.
- **Instructions stay short.** The human scans them; they don't read a wall of prose. Bullet points only.
