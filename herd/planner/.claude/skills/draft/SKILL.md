---
name: draft
description: Compile the current conversation into draft.md — PRDs for the next story plus file update notes. Run after /start discussion, can run multiple times.
user-invocable: true
disable-model-invocation: false
allowed-tools: Write, Read, Glob, AskUserQuestion
---

# Draft

Compile the planning discussion into a structured draft file. This captures the story, task PRDs, and any file updates discovered during planning.

Can run multiple times — each run rewrites `draft.md` from the full conversation.

---

## Prerequisite

If no story has been discussed in this session: "No story discussed yet. Run `/start` first."

---

## Step 1: Read Template

Read `.claude/templates/task-prd.md` for the PRD structure.

---

## Step 2: Extract from Conversation

Review the entire conversation and extract:

**Story definition:**
- Story name and one-line description
- What user-visible value it delivers
- What it produces for downstream stories
- What it consumes from upstream stories

**Task PRDs (for each task in the story):**
Using the template structure, write each PRD with:
- What to Build — precise, reference spec sections
- Designs — for UI-touching tasks, reference the relevant `$PROJECT_DIR/cowmoo/design/domains/*.md` file's screen definition in the PRD's Designs section (domain file → screen name). Backend-only tasks mark UI as `None — backend only`.
- Data Shape — exact field names, types, constraints
- Behavior — all states (loading, error, empty, success)
- Edge Cases — specific scenarios with expected behavior
- Acceptance Criteria — Truths, Artifacts, Key Links
- Verification Hints — high-level suggestions
- Test Requirements — concrete behaviors the builder must test. The builder follows TDD and writes tests from this section before implementing (RED → GREEN → REFACTOR). Every Acceptance Criterion Truth should map to a test behavior. Only skip with "None — no testable behavior" for pure config, scaffolding, or static asset tasks — with a one-line justification.

**File updates discovered during planning:**
- knowledge.md additions — product constraints and cross-domain facts that affect PRD writing. Each entry should be a fact that, if a future session didn't know it, would result in a worse PRD. Planning rationale belongs here only if it constrains future decisions (not as a record of discussion).

---

## Step 3: Write draft.md

Write everything to `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md`:

```markdown
# Draft

## Updates

### knowledge.md
- [fact 1]
- [fact 2]

## Story: [Name]

[One-line description. What user-visible value it delivers.]

Produces: [what downstream stories can consume]
Consumes: [what this story needs from upstream]

---

### Task 1: [Name]

**What to Build**
...

**Data Shape**
...

**Behavior**
...

**Edge Cases**
...

**Acceptance Criteria**
...

**Verification Hints**
...

**Test Requirements**
...

---

### Task 2: [Name]
...
```

**Task ordering:** interface-first (define contracts before internals), vertical slices over horizontal layers. First task created = first picked by builder.

**Task dependencies:** For each task, populate the **Dependencies** field. List which prior tasks in this story must be complete first and what they provide. "None" for the first task or any task that can start independently. Dependencies drive builder task selection — the builder checks if dependency tasks are closed before starting.

**Task sizing:** each task completable in a single session. If a task needs 8+ criteria, 5+ files, or 10+ reads — split it.

---

## Step 4: Self-Verify

Re-read `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` immediately after writing. Verify:
- [ ] All tasks from discussion are present
- [ ] No content was silently dropped
- [ ] PRD format matches template
- [ ] Updates section captures all file changes discussed
- [ ] No vague language ("appropriate", "relevant", "etc.")
- [ ] No code blocks or implementation details in PRDs
- [ ] Every task has a Dependencies field (explicit "None" or listed tasks)
- [ ] Every task has a Test Requirements field — behaviors listed concretely, or explicit "None — no testable behavior" with justification

If any item fails verification: re-extract the dropped content from the conversation and rewrite draft.md. Do not present a draft that failed self-verify — this is the gate that prevents silent data loss reaching the user.

---

## Step 5: HARD GATE

Present the draft to the user:

"Draft compiled with [N] tasks for Story: [Name]. Here's the summary:
- Task 1: [name] — [one-line]
- Task 2: [name] — [one-line]
- ...

Review the full draft. Approve, or let's discuss adjustments."

**Do not proceed to /review until the user explicitly approves.**

If the user wants changes → discuss, then run `/draft` again to rewrite.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Template read
- [ ] All conversation content extracted
- [ ] draft.md written with Updates + Story + Task PRDs
- [ ] Self-verified (re-read after write)
- [ ] Draft presented to user at HARD GATE
- [ ] User approved (or adjusting for another /draft run)

---

## Rules

- **Rewrite, don't append** — each /draft run produces a complete new draft.md from the full conversation
- **Self-verify every write** — write → re-read → verify. Catches silent data loss.
- **No code in PRDs** — describe WHAT, not HOW. No fenced code blocks, no function signatures.
- **Be precise** — exact field names, validation rules, error messages. Not "handle errors gracefully."
- **Updates section is optional** — only include if planning revealed new facts or patterns worth persisting
