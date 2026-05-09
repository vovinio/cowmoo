---
name: import
description: Import existing specs or docs from a folder — understand, walk through with user, populate working notes
user-invocable: true
argument-hint: [folder path]
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob
---

# Import

Import existing documentation into the project. Everything lands in working notes — formalization happens later via `/digest`.

**Source folder:** $ARGUMENTS

---

## Step 1: Ensure Project Exists

Check if `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` exists.

- **If missing** — create the project structure:
  1. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` with content: `# Product`
  2. `$PROJECT_DIR/cowmoo/specs/domains/.gitkeep` (empty, ensures directory exists)
  3. `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` with content: `# Working Notes`
  4. `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md` with content: `# Backlog\n\nDeferred items — from rough ideas to fully specified features. Each item notes why it was deferred and where it came from.`
  5. `$PROJECT_DIR/cowmoo/agent-files/pm/RESEARCH.md` with content: `# Research\n\nAccumulated research findings from @research agent sessions.`
- **If exists** — read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` and `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` to understand current state. The import will append to existing notes.

---

## Step 2: Read Source Material

1. Find all `.md` files recursively in the source folder
2. Read every file completely
3. Build a mental map:
   - What does each file cover?
   - How do files relate to each other (shared entities, cross-references)?
   - What are the major domains/areas?
   - What depends on what?
   - Where are there gaps, contradictions, or vague sections?

---

## Step 3: Present Understanding

Share with the user before going deeper:

```
## Import Overview

**Product:** [One-sentence summary of what this product appears to be]

**Domains identified:**
- [Domain A] — covered by [files], [brief scope]
- [Domain B] — covered by [files], [brief scope]

**Core concepts:** [Key entities and relationships that span multiple files]

**Observations:**
- [Contradictions between files]
- [Gaps — things referenced but never defined]
- [Vague sections that need clarification]

**Suggested walk-through order:**
1. [Topic] — foundational, other things depend on it
2. [Topic] — builds on #1
3. ...

Ready to walk through?
```

---

## Step 4: Guided Walk-Through

Walk through by **topic**, not by file. Group related content from multiple files together.

For each topic:

1. **Summarize** your combined understanding from the relevant source files
2. **Flag problems** — contradictions, gaps, vague language, things that don't make sense
3. **Classify items:**
   - Clearly defined and confirmed → tag `[ready]`
   - Explicitly out of scope or deferred → tag `[future]`
   - Needs discussion or has gaps → leave untagged
4. **Ask specific questions** — resolve contradictions, fill gaps, clarify vague sections. One or two questions at a time.
5. **Wait for user answers** before moving on
6. **Append confirmed understanding** to `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` after each topic

Agent leads — propose the next topic based on dependencies (foundational topics first).

---

## Step 5: Report

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
