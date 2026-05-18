---
name: draft
description: Capture UI discussion decisions — screen layouts, interaction patterns, state definitions — to working notes
user-invocable: true
disable-model-invocation: false
allowed-tools: Write, Edit, Read, Glob, Bash, AskUserQuestion
---

# Draft

Extract UI decisions from the current discussion and save to working notes.

---

## Steps

### 0. Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Review Conversation

Go through the current conversation and extract:

- **Design intent signals** — density/formality/mood decisions or observations about the product's character (feeds OVERVIEW.md Design Intent)
- **Navigation decisions** — top-level shape, primary/secondary nav, entry points (feeds OVERVIEW.md Navigation)
- **User journeys** — end-to-end arcs that span multiple screens or domains (feeds journeys.md)
- **Role vocabulary** — new role names that emerged during discussion (primary-action, destructive-action, space-tight, etc. — feeds roles.md)
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

Emit a tight stamp — counts of what was saved plus forward-pointing gaps. The captured items are already in WORKING-NOTES.md; don't echo them back as a structured-prose block.

```
Saved → WORKING-NOTES.md
[N] decisions · [N] open · [N] future
Touched: <OVERVIEW · journeys · roles · domain:<name> · patterns> (omit categories with 0 captures)

Gaps this session:
  • <Screen/State>: missing <states | interactions | flows | empty/error/loading copy | ...>
  • <Screen/State>: missing <...>
```

After the stamp, close with an `AskUserQuestion` hand-off picker — never end on a prose "Next:" line. Build the options from context: `Continue discussing this domain` `(Recommended)` (description: more screens/states/flows to capture for `<domain>`) / `Run /define` (description: formalize the captured [ready] items into cowmoo/design/ files — offer when this session produced [ready] decisions) / `Done for now` (description: stop here; working notes are saved). Omit `/define` if nothing is [ready] yet.

The "Gaps" section flags forward-pointing items based on what a complete UI definition needs (declared states per `ui-vocabulary.md`, interactions, role references, empty/error/loading copy). One line per gap, ≤3 gaps surfaced. This section is report-only — do not write it to working notes.

**Misunderstanding check.** If a wrong interpretation of the session could produce the same counts (8 decisions could be 8 *wrong* decisions about which screens, which states, which roles), add a single named-decision line above the gaps so the user can verify intent in one glance:

```
Key call: <topic> → <X> (not <Y>)   e.g.  Empty state: dedicated illustration (not skeleton placeholder)
```

Use only when a load-bearing decision would be invisible from counts alone.

---

## Rules

- **Auto-capture** — write directly, no confirmation step.
- **Preserve design reasoning** — every "we considered X but chose Y because Z" must be captured.
- **Don't reorganize existing notes** — append only.
- **Capture the final state** — when a design evolves during discussion, capture the final version as primary.
