# Picker discipline — herd-wide sweep for action-site forks

## The problem

The curator's `CLAUDE.md` mandates that 2-4-option forks with real tradeoffs be rendered via `AskUserQuestion` (a native UI picker) instead of prose `(a)/(b)/(c)` lists. The rule lives in three places:

- Curator `CLAUDE.md` "Rendering Choices" section.
- Each herd agent's `CLAUDE.md` (PM, UXUI, planner, builder all carry a per-agent version).
- Each herd agent's output-style file (mirrors the CLAUDE.md rule for in-response reinforcement).
- Pattern 19 in `docs/PATTERN-CATALOG.md` (HARD-GATE-scoped narrow form of the rule).

But action-site enforcement is uneven. The `/audit-agent pm` run in 2026-05-12 surfaced one concrete case: `/catchup` Step 2 prose-asked "Which issue should we start with?" with no picker instruction, while CLAUDE.md's own examples list `/catchup triage` as a `multiSelect: true` picker moment. Every *other* CLAUDE.md-cited picker example (`/start focus`, `/digest gap-filling`, `/notify target selection`, `/import contradictions`, `/compare per-finding routing`, `/ideate scope tagging`, `/tidy ambiguity questions`, `/review finding resolution`) had a matching action-site instruction in its skill body; only `/catchup` was missing it. That gap was fixed in the same session.

The same pattern almost certainly exists in other herd agents. The picker rule is herd-wide; the action-site reinforcement is per-skill; nothing systematically verifies the two are in sync.

User-side impact: when the action site falls back to free-text prose, the user types ambiguous answers ("the first two", "skip 22", "all of them") that the agent has to parse. The picker gives the user checkboxes/radio buttons, eliminates parsing error, and visually shows the recommended option.

## What to do

Walk every herd agent (PM, UXUI, planner, builder). For every skill, find every "ask the user" moment and classify it against the criteria below. For each moment that should be a picker but isn't, propose the action-site instruction to add.

### Criteria — picker vs prose

A question goes through `AskUserQuestion` if and only if **all three** of these hold:

1. **2-4 discrete options** (or per-item: a list of 2-4-each picker-eligible items).
2. **Each option has a real tradeoff** the user should weigh — not just synonyms.
3. **One option is genuinely recommended** so the picker can show `(Recommended)` first.

A question stays in prose when **any** of these hold:

- **Yes/no confirmation** ("Confirm before proceeding?", "Apply this fix?").
- **Single-recommendation proposal** ("I suggest X because Y — confirm or adjust?").
- **Unbounded text input** ("Describe your product", "What error message should we show?").
- **5+ candidates with no clear shortlist** (use a table + picker for the top batch, not a picker over everything).
- **1 candidate** (a 1-option picker is degenerate — see `/catchup` Step 2 N=1 fallback for the pattern).

### Per-skill walk

For each skill in each herd agent, identify every action-site question. For each:

1. Quote the existing prose ask (file + line).
2. Apply the criteria above to classify: picker / prose / N=1-degenerate / unbounded-text.
3. If picker but currently prose: propose the action-site instruction matching the canonical phrasing other skills use. The canonical closing line is verbatim across all PM picker sites: *"Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker."* Match this.
4. If prose but currently picker (over-pickering): propose the reverse.

## Expected strong priors

- **PM** — already largely correct after the 2026-05-12 audit. One known fix went in (`/catchup`). Expect at most 1-2 additional gaps in less-traveled skills (`/copywrite`, `/migrate`, `/import-design` walkthrough forks).
- **UXUI** — moderate exposure. UXUI has its own `/catchup`, its own design-decision forks during `/define`, and the bundle-fetch flow. Expect 2-4 gaps.
- **Planner** — moderate exposure. PRD-shaping and task-breakdown decisions naturally branch into 2-4 paths. Expect 2-4 gaps.
- **Builder** — lower exposure. Most builder action-site questions are technical yes/no ("apply this fix?", "tests pass — commit?") which correctly stay prose. Some plausible picker moments around fix-strategy forks during `/review`. Expect 0-2 gaps.

These are priors, not predictions. Walk every agent regardless.

## Where to look

```bash
# All "ask the user" / "discuss with user" / "wait for user" cues across the herd
rg -i "ask the user|ask.*:.*\"|discuss with user|wait for|propose.*confirm|confirm or adjust" herd/

# Specifically: prose questions ending in "?"
rg "^.*\?$" herd/*/.claude/skills/*/SKILL.md

# Cross-reference: every place CLAUDE.md lists picker examples
rg "AskUserQuestion|picker" herd/*/CLAUDE.md herd/*/.claude/output-styles/*.md
```

Then read each hit in context to classify against the criteria above.

## Context to read first

- Curator `CLAUDE.md` "Rendering Choices" section — the general rule.
- Each herd agent's `CLAUDE.md` picker section — the per-agent examples (these are illustrative; the full enforcement is per-skill).
- `docs/PATTERN-CATALOG.md` Pattern 19 — HARD-GATE-scoped narrow form of the rule.
- `herd/pm/.claude/skills/catchup/SKILL.md` Step 2 (post-2026-05-12 fix) — the reference shape: picker block + N=1 fallback + canonical closing line.
- `herd/pm/.claude/skills/start/SKILL.md` Step 4 — reference for count-based branching (1 / 2-4 / 5+ candidates) when the option count varies at runtime.

## Deliverable

A report, per herd agent, listing:

- Each action-site question (file + line + quoted prose).
- Classification (picker / prose / N=1-degenerate / unbounded).
- For picker-but-currently-prose: proposed action-site instruction matching the canonical phrasing.
- For over-pickering: proposed revert to prose.

**Report first, do not apply changes until the user approves the classification.** Picker-vs-prose calls are judgment-heavy — the user should sanity-check before edits ship. Once the user approves a batch of fixes, apply them per-agent and run the curator pipeline (`/check → /patterns → /contracts → /coherence`) on the changed agent.

If the CLAUDE.md "picker examples" list in each herd agent is out of sync with the actual skill instructions (as `/catchup triage` was for PM), reconcile that too — either update the CLAUDE.md example to match the skill, or update the skill to match the example. Don't leave a CLAUDE.md/skill drift.

## Anti-scope

- **Do not invent new questions.** Only audit existing action-site asks. If a skill *should* ask something it doesn't, that's a separate concern.
- **Do not turn yes/no into pickers.** A 2-option picker for yes/no is over-engineering; prose is correct.
- **Do not chain into a herd-wide refactor.** This is a discipline sweep, not a redesign. Per-skill edits, no architectural changes.
- **Do not touch the PM `/catchup` fix** — it shipped on 2026-05-12 and is the reference shape.
- **Do not extract a shared "picker rule" file across agents.** Per CLAUDE.md "Agent isolation — don't DRY across agents", picker phrasing in each agent stays per-agent even if substantively identical.

## Known context

- The picker rule fired in PM via three layers: curator CLAUDE.md → per-agent CLAUDE.md → output-style. Sub-agents do NOT inherit any of these, so any picker enforcement in a sub-agent body has to be inline. (No sub-agent currently uses pickers; they hand back to the main agent which renders the choice.)
- `AskUserQuestion` is a native Claude Code tool that renders a checkbox/radio UI in the chat. Multi-select is one option (`multiSelect: true`); single-select is the default. Free-text "Other" is always shown.
- Per-finding `multiSelect: true` use was confirmed for `/catchup` in 2026-05-12 — non-exclusive issue selection. Most picker moments are single-select (pick one path); multi-select is correct only when the items are independent (multiple inbox issues, multiple ideas to tag).
- The canonical phrasing across PM skills is stable and worth matching verbatim in other agents: *"Render the <choice> via `AskUserQuestion`, not as a prose `(a)/(b)/(c)` list. Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff. Per CLAUDE.md's picker rule (the `<example name>` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker."*
