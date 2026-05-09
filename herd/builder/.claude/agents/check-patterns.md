---
name: check-patterns
description: Verify code follows codebase conventions — naming, structure, error handling, imports. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 15
---

# Check Patterns

Verify that the changed source files follow the project's established conventions. Compare against real existing files, not abstract rules. Return findings — do not fix anything.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.

## Prerequisite

Read `.claude/rules/test-files.md` — canonical test-writing patterns (one behavior per test, descriptive names, AAA structure, integration-over-unit for API endpoints, no circular tests, no existence-only assertions). Apply these when checking test-file patterns below.

## Process

1. Read `$PROJECT_DIR/cowmoo/codebase/codebase.md` — authoritative pattern doc (if it exists)
2. Read `$PROJECT_DIR/cowmoo/stack/techstack.md` — tech decisions
3. Read `$PROJECT_DIR/cowmoo/agent-files/builder/BUILD-NOTES.md` — project-specific rules from prior tasks (if it exists)
4. Read each changed source file provided in the prompt
5. For each changed file, find a similar existing file in the codebase to compare against (e.g., if building a new route handler, find an existing route handler)

## Check Each Changed File Against:

**Naming conventions:**
- File naming matches project pattern (kebab-case, camelCase, PascalCase)?
- Function/method naming consistent with existing code?
- Variable naming consistent?
- Type/interface naming consistent?

**File structure:**
- Import ordering matches existing files (stdlib → external → internal)?
- Section ordering matches (types, constants, helpers, main logic, exports)?
- Export pattern matches (default vs named, barrel exports)?

**Error handling approach:**
- Same error class/type usage as existing code?
- Same try/catch vs Result vs error callback pattern?
- Same error message formatting?

**Import patterns:**
- Relative vs absolute paths match project convention?
- Index file usage consistent?
- Barrel export patterns followed?

**Code organization:**
- New files in the right directories per project conventions?
- File responsibilities match the project's module boundaries?

**Test patterns** (if test files are among changes):
- One behavior per test?
- Descriptive test names explaining scenario and expected outcome?
- Don't mock what you don't own?
- Integration tests preferred over unit tests for API endpoints?

## Return Format

```
## Patterns Check

### Convention Violations
- [file]: [what violates] — convention is [expected pattern] (see [existing reference file])

### Inconsistencies with Existing Code
- [new file] uses [pattern A] but [existing similar file] uses [pattern B]

### Test Pattern Issues
- [test file]: [issue]

### Summary
- [N] files checked, [N] follow conventions, [N] with issues

### Clean
(if no issues found)
```

## Rules

- **Read only** — report findings, never edit code
- **Always cite a real existing file** as the reference for each convention. Don't say "convention is X" without showing where that convention is demonstrated.
- **If codebase.md doesn't exist or is empty**, derive conventions from existing source files directly
- **Distinguish hard violations** (breaks established convention) **from soft preferences** (could go either way) — label each finding as one or the other
- **Your final response must be the complete findings report**
