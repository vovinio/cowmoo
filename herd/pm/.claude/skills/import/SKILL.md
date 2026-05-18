---
name: import
description: Import existing specs or docs from a folder — understand, walk through with user, populate working notes
user-invocable: true
argument-hint: [folder path]
disable-model-invocation: false
allowed-tools: Write, Edit, Read, Glob
---

# Import

Import existing documentation into the project. Everything lands in working notes — formalization happens later via `/digest`.

**Source folder:** $ARGUMENTS

---

## Step 1: Validate Argument

If `$ARGUMENTS` is empty, or the folder it names does not exist:

```
/import needs a path to a folder of existing docs.
Example: /import ./old-specs
```

Stop.

---

## Step 2: Ensure Project Exists

Check if `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` exists.

- **If missing** — create the project structure. Use the Write tool with the exact content shown for each file (newlines as written — no escape shorthand). This is the canonical initial PM file structure — `/import` and `/import-design` both create it, and the content below must be byte-identical between them:

  1. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`:
     ```
     # Product

     Product overview, glossary, roles, target users, and key behaviors. Written via `/digest`.
     ```
  2. `$PROJECT_DIR/cowmoo/specs/domains/.gitkeep` — empty file (ensures the directory exists)
  3. `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`:
     ```
     # Working Notes

     Product discussion capture, decisions, and edge cases discovered during conversation.
     ```
  4. `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`:
     ```
     # Backlog

     Deferred items — from rough ideas to fully specified features. Each item notes why it was deferred and where it came from.
     ```
  5. `$PROJECT_DIR/cowmoo/agent-files/pm/RESEARCH.md`:
     ```
     # Research

     Accumulated research findings from `@research` agent sessions.
     ```
- **If exists** — read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` and `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` to understand current state. The import will append to existing notes.

---

## Step 3: Read Source Material

1. Find all `.md` files recursively in the source folder
2. If no `.md` files are found, tell the user the folder contains no markdown docs to import and stop.
3. Read every file completely
4. Build a mental map:
   - What does each file cover?
   - How do files relate to each other (shared entities, cross-references)?
   - What are the major domains/areas?
   - What depends on what?
   - Where are there gaps, contradictions, or vague sections?

---

## Step 4: Present Understanding

Share a scannable overview before the walk-through. One line per domain, named concepts, and ambiguities. Don't preview the full walk-through order — name only the first topic (dependency-rooted) so the user can confirm or redirect. The full walk-through unfolds topic by topic in Step 5.

```
## Import Overview

Product: <one-sentence summary>

Domains ([N]):
  • <Domain A>: <brief scope> — <which file(s)>
  • <Domain B>: <brief scope> — <which file(s)>

Core concepts: <key entities/relationships spanning files, one line>

Ambiguities ([N]):
  • <contradiction | gap | vague>: <specific item>

Starting with: <first topic> — foundational, others depend on it.
Different starting point?
```

**Misunderstanding check.** If the domains and ambiguities lines could equally describe a *different* product the user didn't actually have in mind, add a one-line `Key call:` naming the most product-defining decision you read (e.g., `Key call: <product> = self-serve, not assisted onboarding`). Otherwise the overview is enough.

---

## Step 5: Guided Walk-Through

Walk through by **topic**, not by file. Group related content from multiple files together.

For each topic:

1. **Summarize** your combined understanding from the relevant source files
2. **Flag problems** — contradictions, gaps, vague language, things that don't make sense
3. **Classify items:**
   - Clearly defined and confirmed → tag `[ready]`
   - Explicitly out of scope or deferred → tag `[future]`
   - Needs discussion or has gaps → leave untagged
4. **Ask specific questions** — resolve contradictions, fill gaps, clarify vague sections. One or two questions at a time. **For contradiction resolution (imported doc disagrees with existing spec — typically keep current / adopt imported / merge specific fields), render the choice via `AskUserQuestion`, not as a prose `(a)/(b)/(c)` list.** Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff. Per CLAUDE.md's picker rule (the `/import contradictions` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.
5. **Wait for user answers** before moving on
6. **Append confirmed understanding** to `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` after each topic

Agent leads — propose the next topic based on dependencies (foundational topics first).

---

## Step 6: Report

After walking through all topics:

```
## Import Complete

**Captured to working notes:**
- [N] items tagged [ready] — can be formalized in next /digest
- [N] items tagged [future] — will move to backlog during /digest
- [N] untagged items — need more discussion

**Contradictions resolved:** [N]
**Gaps identified:** [N] (captured as open questions)

**Next steps:**
- Run /tidy to organize the imported notes
- Then /digest in a dedicated session to formalize ready items
```

---

## Rules

- **Walk through by topic, not by file** — group related content from different source files together
- **Don't assume** — when source files contradict, ask. When something is vague, ask. Don't pick a side silently.
- **Preserve source context** — note which source file(s) each piece of information came from, so the user can verify
- **Use the tagging system** — tag confirmed items `[ready]` and deferred items `[future]`. Leave everything else untagged (implicitly open).
- **Don't filter too aggressively** — capture everything that might be relevant. When in doubt, leave it untagged rather than skipping it.
- **Respect scope** — if source material includes UI layouts or technical architecture, note their existence but don't import them (out of scope for this agent). Mention to the user what was skipped and why.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Source material fully read and understood
- [ ] Overview presented to user with observations
- [ ] Topics walked through in dependency order
- [ ] Each topic: items classified, questions asked, understanding appended to notes
- [ ] Report presented with item counts and next steps
