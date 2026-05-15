---
name: draft
description: Extract all decisions, open questions, edge cases, and terminology from the current discussion and append to working notes
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Bash
---

# Draft

Extract everything discussed in this session and save it to working notes.

---

## Steps

### 0. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Review Conversation

Go through the current conversation and extract:

- **Decisions made** — things that were confirmed or agreed on
- **New information** — details, clarifications, examples the user provided
- **Open questions** — things still unresolved or needing more thought
- **Cross-domain observations** — items that affect a domain other than the current focus
- **Future ideas** — items explicitly deferred or marked as out of current scope (tag as `[future]`)
- **Edge cases discovered** — scenarios discussed that need handling
- **Terminology** — new terms defined or existing terms clarified
- **Design reasoning** — the "why" behind decisions, especially when alternatives were considered and rejected

---

### 2. Read Current Working Notes

Read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` to understand what's already captured — avoid duplicating existing content.

---

### 3. Cross-Check

Before writing, verify completeness and consistency:

- **Superseded decisions:** If a decision from earlier in the session was replaced by a later one, mark the earlier decision as superseded with a reference to the new one. Don't leave contradictory decisions sitting side by side.
- **Spec ripple effects:** Scan spec files that are touched by these decisions for existing content that would need updating as a consequence. Flag these as cross-references for digest.
- **Design reasoning:** For every "we considered X but chose Y" moment, capture the reasoning. These are easy to forget but critical for future sessions — they prevent re-litigating settled decisions.

---

### 4. Write to Working Notes

Append extracted content to `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`:

**Start with a session summary** — a brief narrative (2-4 sentences) of what was discussed and where things left off. This helps the next session pick up where you left off.

```markdown
---

## Session — [domain or topic focus]

**Where we left off:** [Brief narrative of the session — what was discussed, what direction things were heading, what's next]
```

**Then append the extracted items:**

- Write clearly for future reference — refine raw conversation into structured understanding
- Preserve the user's context and reasoning, not just conclusions
- Maintain the user's terminology exactly
- Mark confirmed decisions distinctly from open questions
- Tag confirmed items ready for digest: `[ready]`
- Tag deferred items: `[future]`
- Leave open/in-discussion items untagged

**Do not reorganize existing content** — only append new content from this session.

---

### 5. Verify

Re-read `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` to verify the new content was appended correctly and existing content was not modified.

---

### 6. Report

Emit a tight stamp — counts of what was saved plus forward-pointing gaps. The captured items are already in WORKING-NOTES.md; don't echo them back as a structured-prose block.

```
Saved → WORKING-NOTES.md
[N] decisions · [N] open · [N] future

Gaps this session:
  • <Entity/Feature>: missing <workflow | validations | edge cases | ...>
  • <Entity/Feature>: missing <...>

Next: continue this domain, or /digest when ready
```

The "Gaps" section flags forward-pointing items based on what a complete spec needs (workflow, validations, edge cases, permissions, acceptance criteria for features; relationships, fields, rules, states for entities). One line per gap, ≤3 gaps surfaced — the highest-priority ones. This section is report-only — do not write it to working notes.

**Misunderstanding check.** If a wrong interpretation of the session could produce the same counts (e.g., 8 decisions could be 8 *wrong* decisions), add a single named-decision line above the gaps so the user can verify intent in one glance:

```
Key call: <topic> → <X> (not <Y>)
```

Use this only when a load-bearing decision in the session would be invisible from counts alone. Otherwise the stamp is enough.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Conversation reviewed for all extractable content
- [ ] Current working notes read to avoid duplication
- [ ] Cross-check done (superseded decisions, spec ripple effects, design reasoning)
- [ ] New content appended to working notes with session summary
- [ ] Working notes re-read to verify correct append
- [ ] Report presented to user

---

## Rules

- **Auto-capture** — write directly, no confirmation step.
- **Preserve user's context** — the notes should reflect what the user said and why, not just distilled bullet points.
- **Don't reorganize existing notes** — append only. The one exception: when a session resolves an item from an earlier section (e.g., an open question or scope gap), strike it through and add a brief reference to the decision that resolved it.
- **Capture the final state** — when a concept evolves during discussion, capture the final version as the primary decision. Note the evolution briefly but don't give equal weight to intermediate states that were superseded.
