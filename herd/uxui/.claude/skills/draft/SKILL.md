---
name: draft
description: Capture UI discussion decisions — screen layouts, interaction patterns, state definitions — to working notes
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Bash
---

# Draft

Extract UI decisions from the current discussion and save to working notes.

---

## Steps

### 0. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Review Conversation

Go through the current conversation and extract:

- **Design intent signals** — density/formality/mood decisions or observations about the product's character (feeds OVERVIEW.md Design Intent)
- **Navigation decisions** — top-level shape, primary/secondary nav, entry points (feeds OVERVIEW.md Navigation)
- **User journeys** — end-to-end arcs that span multiple screens or domains (feeds journeys.md)
- **Role vocabulary** — new role names that emerged during discussion (primary-action, destructive, tight-spacing, etc. — feeds roles.md)
- **Screen definitions** — layout decisions, component choices, information hierarchy (feeds domains/*.md)
- **State definitions** — states applicable to each screen per `.claude/rules/ui-vocabulary.md` (data states for data-fetching screens, form states for forms)
- **Interaction patterns** — how users interact (inline editing, modals, wizards, etc.)
- **Flow decisions** — screen-to-screen navigation inside a domain
- **Open questions** — UI decisions still unresolved
- **Design reasoning** — WHY a particular layout or pattern was chosen over alternatives

Tag extracted items with their target file when useful (e.g., `[overview-intent]`, `[roles]`, `[journey: onboarding]`, `[domain: orders]`). `/define` uses these tags to route content to the right file.

**If nothing extracted** — the conversation has no UI content yet. Report "Nothing to capture — continue discussion first." and stop. Do not write an empty session to working notes.

---

### 2. Read Current Working Notes

Read `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md` to understand what's already captured — avoid duplicating existing content.

---

### 3. Write to Working Notes

Append extracted content to `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md`:

**Start with a session summary:**

```markdown
---

## Session — [domain or screen focus]

**Where we left off:** [Brief narrative — what was discussed, what direction things were heading]
```

**Then append the extracted items:**

- Write clearly for future reference
- Maintain the user's terminology exactly
- Mark confirmed decisions: `[ready]`
- Tag deferred items: `[future]`
- Leave open/in-discussion items untagged
- Capture design reasoning — "we chose X over Y because Z"

**Do not reorganize existing content** — only append new content from this session.

---

### 4. Verify

Re-read `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md` to verify the new content was appended correctly.

---

### 5. Report

Tell the user what was captured:

```
## Captured

### Design Intent / Navigation (OVERVIEW)
- [intent or nav decision]

### Journeys
- [end-to-end arc that emerged]

### Roles
- [new role added to vocabulary]

### Screen Definitions (domain: [name])
- [screen]: [what was decided]

### Interaction Patterns
- [pattern]: [what was decided]

### Open Questions
- [what's unresolved]

### Not Yet Covered
- [Screen/State]: missing [specific states, interactions, or flows]
```

---

## Rules

- **Auto-capture** — write directly, no confirmation step.
- **Preserve design reasoning** — every "we considered X but chose Y because Z" must be captured.
- **Don't reorganize existing notes** — append only.
- **Capture the final state** — when a design evolves during discussion, capture the final version as primary.
