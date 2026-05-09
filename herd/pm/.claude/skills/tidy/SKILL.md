---
name: tidy
description: Organize and clean working notes — group related items, tag confirmed decisions as [ready], remove superseded content, prepare notes for /digest
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Bash
---

# Tidy

Organize working notes for clarity. Run between sessions or before a /digest session.

---

## Steps

### 0. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Read and Assess

Read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` to understand what needs organizing.

**Assess whether tidy is needed:**
- If notes are from a single session and already well-structured → tell the user "Notes are already organized. No tidy needed." and stop.
- If notes have minimal content (one topic, a few decisions) → light tidy only — fix tags and formatting, don't restructure.
- If notes span multiple sessions with overlapping topics, superseded decisions, or scattered related items → full tidy needed.

---

### 2. Catalog Substance (before any changes)

**Output the catalog explicitly to the user** — do not rely on memory. List:

```
## Substance Catalog

### Design Reasoning ([N] items)
1. [topic]: [considered X, chose Y, because Z]
2. ...

### Edge Cases & Error Messages ([N] items)
- [list specific ones]

### Field Lists ([N] lists)
- [entity/feature]: [field count]

### Key Numbers
- [thresholds, defaults, limits]

### Cross-Domain Impacts ([N] items)
- [which spec files need what changes]

### Future Scope ([N] items)
- [deferred items with reasoning]

### Open Questions ([N] items)
- [unresolved items]
```

**This is a confirmation checkpoint — stop and wait for user confirmation before proceeding.** The user may spot substance the catalog missed — a decision they remember making, context they provided, reasoning that wasn't captured with an explicit "because." Do not begin reorganizing until the user confirms the catalog is complete.

---

### 3. Organize Content

Reorganize WORKING-NOTES.md:

- **Group related items by topic** — items about the same entity, feature, or concept should be adjacent, not scattered across session boundaries
- **Separate confirmed decisions from open questions** — make it clear what's settled vs. what needs more discussion
- **Preserve user's context** — don't strip reasoning or examples when reorganizing
- **Tag items clearly:**
  - `[ready]` — confirmed and ready for digest into specs
  - `[future]` — deferred, will move to BACKLOG.md during digest
  - Leave open/in-discussion items untagged

**Target structure per topic:**

```markdown
## [Topic Name]

[Brief description of what this is]

### [Entity/Feature details]
[Fields, workflows, validations, edge cases, empty states, permissions]

### Design Reasoning
- **[Decision]:** [What was considered, what was chosen, why]

### Open Questions (if any)
- [Unresolved items for this topic]
```

Tags go on individual items (e.g., `- [item] [ready]`), not on the topic header — see the "Tag items clearly" list above.

This structure ensures reasoning has a dedicated, visible home in every topic — not buried inline where it can be lost during merging.

---

### 4. Clean Up

- Remove stale scaffolding — session headers, "where we left off" summaries, strikethrough markers, resolved-question annotations, duplicate cross-references. These are navigation aids for the chronological format that become noise in the topic-organized format.
- Merge items that say the same thing in different ways — combine into one richer entry
- Keep open questions even if they seem old — they're open for a reason
- **Do NOT remove:** decisions, reasoning, edge cases, validations, error messages, empty state text, field lists, defaults, thresholds, or any user-provided context. These are substance — reorganize them, never delete them.

---

### 5. Verify Nothing Lost

**This step is mandatory and must complete before presenting the report.**

Cross-reference the tidied version against the confirmed catalog from Step 2. Go item by item:

- **Design reasoning:** Check each numbered item from the catalog. Is it in the tidied version? If the count is lower, find what's missing and restore it.
- **Edge cases and error messages:** Spot-check that specific edge case text and error message strings survived verbatim.
- **Field lists:** Verify lists (entity fields, filter dimensions, column names) have the same number of items — nothing quietly dropped during consolidation.
- **Key numbers:** Verify thresholds, defaults, limits match the original.
- **Cross-domain impacts:** Verify all spec-file update items are present — nothing lost during deduplication across sessions.
- **Future scope:** Verify all deferred items with their deferral reasoning survived.
- **Open questions:** Verify all unresolved items are still visible.

If anything is missing, fix it before proceeding to the report. Do not report "tidy complete" with missing substance.

---

### 6. Report

```
## Tidy Complete

### Organized
- [what was reorganized and how]

### Ready for Digest
- [items tagged as ready]

### Still Open
- [untagged items still in discussion]

### Removed (Scaffolding Only)
- [items removed and why — object now if any should be kept]

### Preserved (verified against catalog)
- [N] / [N] design reasoning items across [N] topics
- [N] edge cases / error messages
- [N] cross-domain impacts

### Future Scope (pending)
- [items tagged [future] that will move to backlog during digest]
```

---

## Rules

- **Only modify WORKING-NOTES.md** — never touch spec files or BACKLOG.md
- **Only remove scaffolding, never substance** — session headers, "where we left off" summaries, strikethrough markers, resolved-question annotations, and duplicate cross-references are scaffolding (safe to remove). Decisions, reasoning, edge cases, validations, error messages, and user context are substance (never remove, only reorganize).
- **Design reasoning is sacred** — every "why" behind a decision must survive the tidy. If the original says "we considered X but chose Y because Z," all three parts (X, Y, and Z) must appear in the tidied version. These are the most valuable items in the notes — they prevent future sessions from re-debating settled questions.
- **Don't delete open questions** — if something is unresolved, keep it visible
- **Don't make decisions** — organizing is not deciding. If two items contradict, flag the contradiction, don't resolve it
- **Preserve context** — when merging similar items, keep the richer version. When in doubt, keep more rather than less.
- **Prefer incremental edits over full rewrites** — for large files, use the Edit tool to move and consolidate sections rather than the Write tool for a complete rewrite. Full rewrites risk dropping content that incremental moves preserve. Only use Write for a full rewrite when the file is small or the reorganization is so extensive that incremental edits would be impractical.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Substance catalog presented to user and confirmed
- [ ] Content reorganized by topic with clear tagging
- [ ] Stale scaffolding removed (session headers, old "where we left off" notes)
- [ ] Verification against catalog complete — nothing lost
- [ ] Report presented with preserved substance counts
