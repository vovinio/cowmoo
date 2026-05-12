---
name: ideate
description: Research-informed product ideation — identify gaps, automation opportunities, and new capabilities based on current specs and industry context
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Agent
---

# Ideate

You know this product deeply. Now think beyond what's specified — what's missing, what's manual that shouldn't be, what's possible now that nobody in this space is doing well. Ground ideas in the actual specs and real industry context, not generic innovation.

## What to do

1. Read all files: `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`, all files in `$PROJECT_DIR/cowmoo/specs/domains/`, `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`, and `$PROJECT_DIR/cowmoo/agent-files/pm/RESEARCH.md`
2. Use @research to study the competitive landscape — what do competitors offer, what do users in this space complain about, what patterns are emerging
3. Analyze gaps across three categories (see below)
4. Present ideas with substance — one at a time or in small groups, discuss with the user
5. Ideas the user approves go to `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` — tagged `[ready]` or `[future]` based on user's call. **Render the scope-tagging decision via `AskUserQuestion`, not as a prose "ready or future?" prompt** — it's a 2-option fork with real tradeoffs (current scope vs. backlog) per idea. Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff (e.g., "blocks current work" vs "captured but deferred"). When tagging multiple ideas at once, use `multiSelect: true` with one question per idea. Per CLAUDE.md's picker rule (the `/ideate scope tagging` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

## Three categories

**Parity gaps** — things competitors or the industry standard offers that this product doesn't. Table stakes that are missing. Not every gap needs closing, but the user should know they exist.

**Automation opportunities** — manual workflows in the current specs that could be reduced or eliminated. Look for: "operator manually...", "user must check...", "compare numbers by hand...", reconciliation steps, repetitive configuration. Every manual step is a candidate.

**New capabilities** — things that are possible now (especially with AI and automation) that nobody in this space is doing well yet. Not "add AI" — specific capabilities tied to specific pain points in this product.

## For each idea

- **What it does** — specific, not vague
- **Who it helps and how** — what changes in their workflow
- **Where it fits** — which existing entities, features, or domains it connects to
- **Why it matters** — evidence from research, reasoning from the specs, or informed observation about the industry. Not all ideas need a citation — reading between the lines is valid when the reasoning is clear.
- **What makes it hard** — why doesn't it exist already? What's the trade-off?

## Guidelines

- **Specific to this product** — every idea must connect to actual entities, features, or workflows in the specs. No generic "platforms should have dashboards" proposals.
- **Ground ideas in evidence or reasoning** — "I think this would be cool" is weak. "Your specs show 3 places where operators compare numbers by hand — this is a consolidation opportunity" is strong. Research-backed is best, informed observation is fine, pure opinion is not.
- **Depth over volume** — 5-10 well-reasoned ideas beat 30 shallow ones. Go deep on why each matters.
- **Don't just say "add AI"** — if proposing AI capabilities, explain what the AI actually does, what inputs it uses, what output the user sees, and where it fits in the existing workflow.
- **Distinguish parity from innovation** — "competitors have this" and "nobody has this" are different conversations with different urgency.
- **User decides scope** — don't assume everything is future. Some ideas might be "we need this now." User tags each: `[ready]` for current scope, `[future]` for backlog.
- **Use @research throughout** — not just upfront. When an idea needs industry context, competitive data, or validation, research it on the spot.

---

## Completion Checklist

Before finishing, confirm:

- [ ] All spec files and working notes read
- [ ] Competitive landscape researched via @research
- [ ] Ideas analyzed across three categories (parity, automation, new capabilities)
- [ ] Each idea presented with: what, who, where, why, hard parts
- [ ] User-approved ideas written to working notes with tags
