---
name: start
description: Initialize new project or resume existing project
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Read, Glob, Bash
---

# Start

Initialize or resume the product specification project.

## Step 1: Check Project State

Run `node tools/dev-tools.cjs check-files` and read all four lines (`working-notes:`, `backlog:`, `product:`, `domain-specs:`). Each reports a state: `not found`, `exists (empty)`, `exists (has content)`, or a numeric count for `domain-specs:`.

- `working-notes: not found` → go to **NOT INITIALIZED** below
- `working-notes: exists (empty)` AND `domain-specs: 0` → go to **GREENFIELD** below (fresh project with no content yet)
- anything else → go to **EXISTING PROJECT** below

---

## If File Exists → EXISTING PROJECT

### Step 2: Load Session-Start Context

Read the following files **fully** — no partial reads, no sampling. These are what you need to PROPOSE a session focus:

1. `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` — discussion capture, open decisions, review findings routed for later thought, design reasoning.
2. `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md` — deferred items with their full context and deferral reasoning. You need this so you don't re-propose something already-deferred and so you can surface backlog items the user might want to revisit.
3. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — product overview, glossary, roles, key behaviors, key constraints. The foundation for any cross-domain reasoning.

Use Glob to **list** the files in `$PROJECT_DIR/cowmoo/specs/domains/` (names only — you'll read the relevant domain(s) after the user picks a focus, per Rule 3 "One domain at a time" in CLAUDE.md). Loading every domain upfront would fight that rule and bloat context with files the session won't touch.

Read each loaded file in a single Read call (no offset/limit). If a file is unusually large, that's a signal worth raising to the user — not a reason to read partially.

### Step 3: Assess Working Notes Condition

Now that you've read WORKING-NOTES.md in full, classify what you see — without spawning a sub-agent. You have full context, so you can do this inline.

A bullet (`- ` line) is an **item** only if it represents a currently-open decision, question, or topic in discussion. Bullets are NOT items when they appear in:
- Sections whose header contains `DIGESTED`, `Archive`, `applied`, `progress`, `log`, `Source`, or similar history/metadata wording — these describe completed or referential work.
- Lists of captured user quotes, examples, or sub-options under a finding's "Options" list (those are part of a single finding, not separate items).
- Past-tense logs ("2026-05-09 #N — Topic X → file.md" are digest log entries, not items).

Count three buckets:
- **Items tagged `[ready]`** (anywhere in the file) — confirmed and waiting for `/digest`
- **Items tagged `[future]`** (anywhere) — these should already be in BACKLOG.md; if any remain in WORKING-NOTES, `/digest` is overdue
- **Truly open items** (untagged, in active-discussion sections only) — what's currently being thought through

Also note: raw bullet total vs active-item total. If the file has 50+ more raw bullets than active items, it has accumulated archive/log/digested-section content that should be cleaned by `/tidy` (or by re-running `/digest` if items are tagged but un-processed, or by manual pruning if it's audit-log accumulation).

### Step 4: Propose Session Focus

Combine what you read across all four sources to present:

```
Project loaded.

**Notes:** [N] ready, [N] future, [N] open  
  (and if the raw bullet total is notably larger than active items: "**Raw bullets:** N total — [N - active] are archive / log / digested-section content; consider `/tidy`")
**Backlog:** [N] deferred items
**Domains:** [N] domain files — [list domain names inline]

**Suggested focus:** [the most important open area, with reasoning — drawn from notes + backlog + domains]

[CLOSING — depends on how many candidates the suggested focus surfaces:]
- **0 candidates** — nothing in notes, backlog, or domain specs is open. Don't ask open-endedly. Render `AskUserQuestion` seeded from what you DID read in PRODUCT.md: 2–3 concrete starting points (a glossary term that lacks a domain, a role whose workflows aren't yet captured, a product area implied by the overview) plus a free-text fallback option. Recommended option first with `(Recommended)` suffix; each option's `description` names the consequence (which file gets created, what's affected — not a label repeat). Example seeds:
  - "Define `<glossary-term>` as first domain" — *creates `domains/<term>.md`; already named in PRODUCT.md glossary*
  - "Capture workflows for role `<R>`" — *defines features for an already-named role; touches existing domains if any*
  - "Describe a different area" — *free-text fallback when none of the above fit*
- **1 candidate** — prose: "Want to dig into [topic]?" or similar single-recommendation confirmation. Exception: if that one focus is itself a multi-unit effort, see the fan-out note below — go straight to a starting-unit picker instead.
- **2–4 candidates** — `AskUserQuestion` picker. Recommended candidate first with `(Recommended)` suffix; each option's `description` carries the tradeoff (what each candidate touches, what's affected). Per CLAUDE.md's picker rule and the `/start focus` example called out there.
- **5+ candidates** — render the lineup as a brief table, then use `AskUserQuestion` to pick the next batch (top 2–4) or ask for an unlisted direction. Never end with bare prose like "walk through in order, or jump to a specific one, or do you have a different topic?" — that's a 3-option fork that the picker is for.
```

Don't ask "what would you like to do?" generically — propose something specific based on what you see, AND render any 2–4-option fork through `AskUserQuestion` rather than prose, even when the user could in principle answer with free text. The picker enforces specificity at the response site, where it matters.

**A focus that fans out is itself a fork.** The cases above count *focus candidates* — but one picked focus can be a multi-unit effort: a single review finding spanning many domain files, a cross-domain pass worked one domain at a time per Rule 3. Choosing the *starting* unit is a second fork and gets the same treatment as the cases above — 2–4 units → picker; 5+ units → a brief gap-ranked table then a picker of the top 2–4 plus a free-text fallback. When there is exactly one focus candidate AND it fans out this way, don't prose-confirm the focus and then ask about the unit separately — go straight to the starting-unit picker, where choosing a unit confirms the focus. Never close with bare prose like "start with groups.md, or pick a different domain": that two-option fork is exactly what the picker is for.

### Step 5: Load the Picked Domain + Scan for Related Content

Once the user picks a focus (or brings their own topic) — and, if that focus fans out, a starting unit via the picker per Step 4's fan-out note — Read the relevant domain file(s) from `$PROJECT_DIR/cowmoo/specs/domains/` **fully**. Typically one domain per session per Rule 3; if the focus genuinely spans two adjacent domains, load both. Do NOT load domains unrelated to the picked focus.

Then scan what you've loaded (PRODUCT.md + the picked domain(s) + BACKLOG.md, all already in context) for references to the session topic. Flag any existing spec content that might be affected by the upcoming discussion — entity fields, feature rules, glossary entries, etc.

```
**Related spec content:**
- [domain.md] — [entity/feature] references [topic] at line [N]
- [PRODUCT.md] — glossary entry for [term] may need attention
- [BACKLOG.md] — deferred item "[name]" relates to this topic — review or pull forward?
```

This gives the user (and you) a head start — no mid-conversation surprises when you discover existing spec content that contradicts or needs updating.

---

## If Empty → GREENFIELD

The project is initialized but no product content exists yet — no working-notes items and no domain specs. There's nothing to assess and nothing to read in full beyond confirming the state.

Present this greeting:

```
Fresh project detected — ready to start capturing product thinking.

To begin, just describe your product idea. I'll ask questions, flag edge cases, and capture decisions as we go. When you're ready to save what we've covered, run /draft.

Alternatives:
- **Existing docs?** Run `/import <folder>` to walk through them together.
- **No clear idea yet?** Describe the problem you're solving and who has it — we'll work forward from there.
```

Wait for the user. Do not read any further files — there is nothing to read.

---

## If File Missing → NOT INITIALIZED

Tell the user: "Project not initialized — required PM files are missing (e.g., `cowmoo/specs/PRODUCT.md`, `cowmoo/agent-files/pm/WORKING-NOTES.md`). Initialize the project before continuing."

Stop.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Project state checked (existing, greenfield, or not initialized)
- [ ] For existing: WORKING-NOTES.md + BACKLOG.md + PRODUCT.md Read **in full** at Step 2 (no offset/limit on any read); domains/ listed by name only
- [ ] For existing: working-notes assessed inline — ready / future / open counts plus raw-vs-active gap when notable
- [ ] For existing: session focus proposed with specific reasoning, rendered through picker when 2–4+ candidates; a fan-out focus closes with a starting-unit picker, not prose
- [ ] For existing: after focus picked, the relevant domain file(s) loaded fully at Step 5 (typically one per session per Rule 3)
- [ ] For greenfield: greeting shown with /draft and /import options; no file reads beyond state check
- [ ] For not initialized: user told which required files are missing
- [ ] User has full context to start working — main agent holds the ground truth, not a sub-agent's summary
