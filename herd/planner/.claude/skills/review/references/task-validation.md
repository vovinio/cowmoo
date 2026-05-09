# Task Validation Checklist

Run this checklist against every task PRD (GitHub Issue body) before leaving it in `todo` state. A task that fails validation will produce poor results — fix it before moving on.

For critical stories, spawn a validation subagent with fresh context to review the tasks. It catches things you missed because you were invested in writing them.

## Validation Dimensions

### Completeness
- Does this cover the full spec section it references?
- Are all fields from the data model included?
- Are all states handled? (loading, error, empty, success, partial)
- Are all user flows covered? (happy path, error paths, edge cases)
- If there's a form: are all validation rules specified?

### Specificity
- Acceptance criteria are testable (not "page works correctly")
- Data shapes have exact field names, types, and constraints
- UI descriptions specify layout, not just "display a list"
- Error messages are written out, not "show appropriate error"
- Acceptance criteria have clear pass/fail conditions, not vague "works correctly"

### Feasibility
- Can this be built with our tech stack?
- Are all dependencies actually available? (libraries, APIs, services)
- Is the task achievable in a single session?
- Are there unknowns that should have been researched first?

### Scope
- Is this one task or should it be split?
- Does it cross domain boundaries unnecessarily?
- Could this be completed without scope creep?
- Is there gold-plating that should be deferred?

### Dependencies
- Are all listed dependencies actually completed (or will be by build time)?
- Are there implicit dependencies not listed? (shared components, utilities, API endpoints)
- Would changing the order break anything?

### Edge Cases
- Listed with specific expected behavior, not just "handle errors"
- Include boundary conditions (empty input, max length, concurrent access)
- Include permission edge cases (what if user lacks access?)
- Include data edge cases (what if referenced record is deleted?)

### Reference Accuracy (for subsequent planning only)
- Do file paths reference files that actually exist in the project code (anything outside `cowmoo/`)?
- Do field names match the actual data model as built (check completed Records and code)?
- Do component/function references match actual exports?
- If this task follows a task with structural deviations, have assumptions been updated?
- Skip this dimension for first-time planning (no code exists yet).

### Self-Contained
- Could this be implemented without asking questions?
- Could this be implemented without reading the specs?
- Are file paths specified (which files to create or modify)?
- Are naming conventions clear from context or explicitly stated?

### Plan Purity
- Does the PRD contain fenced code blocks with implementation code?
- Does it dictate specific function signatures, variable names, or internal implementation?
- Does it specify HOW to build rather than WHAT to build?
- PRDs define deliverables, data shapes, behavior, and acceptance criteria — not code.
  The reader gets fresh context and makes implementation decisions.
  If the reader receives code to copy-paste, they become a typist with no judgment,
  and your potentially stale understanding gets baked into production code.

## Common Failures

| Symptom | Fix |
|---------|-----|
| Task says "implement the feature" | Rewrite with exact deliverables, fields, behaviors |
| No acceptance criteria | Add specific, testable criteria |
| Acceptance criteria say "works correctly" | Replace with testable conditions |
| Edge cases say "handle errors gracefully" | Specify each error scenario and expected behavior |
| Missing data shape | Add field names, types, constraints from spec |
| Task is too large (touches 5+ files) | Split into interface definition + implementation + wiring |
| Dependencies unclear | List exact GitHub issue numbers, not vague "after backend is done" |
| PRD references file/field that was renamed | Check completed Record comments for deviations, verify against the project code |
| Task follows structural deviation without updates | Read the Record comment, update assumptions and references |
| PRD contains code blocks | Remove code. Describe the behavior and data shape instead. Implementation details are decided during build. |
