# Task PRD Template

Each task PRD is a complete implementation brief. The reader has zero context beyond this PRD and `cowmoo/stack/techstack.md`.

---

## Structure

```markdown
### [Task Name]

**What to Build**
Precise description of what this task delivers. Reference spec sections by name.
Include the spec domain, entity, or feature this implements.

**Designs**
Spec: [spec domain file → feature name]
UI: [cowmoo/design/ domain file → screen name, or "None — no UI definitions"]

If UI definition exists, include design context:
- Design intent: [relevant prose from cowmoo/design/OVERVIEW.md Design Intent — density/formality/mood applicable to this task]
- Layout: [from design definition]
- Components: [from design definition]
- Roles used: [specific role names from cowmoo/design/roles.md — e.g. `primary-action`, `text-muted`, `tight-spacing`, `surface-raised`]
- States to implement: [from design definition]
- States not covered in design: [handle per existing patterns in src/ or framework defaults]

If no UI definitions exist: "None — backend only" or "None — follow existing frontend patterns"

**Data Shape**
Exact field names, types (plain language), and constraints.
This is specification — not code. No SQL types, no TypeScript interfaces.

| Field | Type | Constraints |
|-------|------|-------------|
| name | text | required, max 100 chars |
| status | one of: draft, published, archived | default: draft |

**Behavior**
All states the user or system can encounter:
- **Loading** — what the user sees while data loads
- **Empty** — what happens when there's no data yet
- **Success** — the normal happy path
- **Error** — what happens on failure, with specific error messages

**Edge Cases**
Specific scenarios with expected behavior:
- What if [scenario]? → [what user sees/experiences]
- What if [boundary condition]? → [expected behavior]

**Acceptance Criteria**
Mechanically verifiable. Three categories:

- **Truths** — observable behaviors
  - Given [state], When [action], Then [result]
- **Artifacts** — files with real implementation
  - [file path]: [what it contains]
- **Key Links** — wiring between artifacts
  - [artifact A] → [artifact B]: [how they connect]

**Dependencies**
Which prior tasks in this story must be complete before this one can start.
- Task: [task name] — [what it provides that this task needs]
Or "None" if this task can start immediately.

**Verification Hints**
High-level suggestions for how to verify this works. Not exact commands.

**Test Requirements**
Describe the behaviors the builder must test — what, not how. The builder follows TDD and will write tests from these requirements before implementing (RED → GREEN → REFACTOR), so each item must translate cleanly into a failing test.

List concrete behaviors and their expected outcomes:
- Given [state], When [action], Then [observable result]
- [edge case]: [expected behavior]
- [error path]: [expected error surface]

For tasks with no testable behavior (pure config, scaffolding, static assets, CSS-only changes), write: "None — no testable behavior" followed by a one-line justification (e.g., "environment config, no logic"). The reviewer verifies the skip was appropriate.

Never use vague language like "test the happy path", "add unit tests", or "ensure it works" — name the specific behaviors. Vague test requirements make tests that validate nothing.
```

---

## Rules

- **Be precise** — exact field names, exact validation rules, exact error messages
- **No code** — no fenced code blocks, no function signatures, no variable names. Describe WHAT, not HOW.
  Common rationalizations — all wrong:
  - "It's just a type name, not implementation" → Type names constrain implementation. Use plain language.
  - "The builder needs this hint" → If the builder needs it, it belongs in codebase.md, not the PRD.
  - "It's pseudocode, not real code" → Pseudocode is code with plausible deniability. Describe the WHAT.
- **Session-sized** — if a task needs 8+ acceptance criteria, 5+ files, or 10+ file reads — split it
- **Self-contained** — implementable without asking questions. File paths specified. Naming conventions from codebase.md when it exists, otherwise from framework defaults in techstack.md.
- **Reference reality** — if codebase.md exists, cite its patterns and file paths; otherwise cite framework conventions from techstack.md. Field names from completed Records.
