---
name: check-references
description: Verify PRD references match reality — file paths exist, field names match what was built, component exports are real. Return findings to coordinator.
tools: Read, Glob, Grep, Bash
model: sonnet
maxTurns: 15
---

# Check References

Verify that file paths, field names, and interfaces referenced in PRDs match what actually exists. Return findings — do not fix anything.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.
- `$GH_REPO` — GitHub repo identifier.

## Process

1. Read `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` — the PRDs to review
2. Read `$PROJECT_DIR/cowmoo/codebase/codebase.md` **if it exists** — architecture patterns and file conventions. Missing on greenfield projects (builder hasn't run `/map-codebase` yet); when absent, skip pattern-reality checks and rely on techstack/framework conventions only.
3. Read `$PROJECT_DIR/cowmoo/stack/techstack.md` — tech decisions
4. If prior stories exist, read Records from recently closed tasks:
   ```bash
   gh issue list --repo "$GH_REPO" --label "story" --state closed --json number,title --limit 5
   ```
   For each, check comments for Builder Records with deviation details.

## For Each Task PRD, Check:

**File paths:**
- Do referenced file paths match the conventions in techstack.md?
- For paths referencing existing files — do those files actually exist?
  ```bash
  ls "$PROJECT_DIR/[referenced path]" 2>/dev/null
  ```
- For paths referencing new files to create — do they follow naming conventions?

**Field names and data shapes:**
- Do entity field names match what's in specs?
- If referencing entities from completed stories — do field names match what was actually built? (Check Records for deviations)

**Interface references:**
- Does this task reference exports/APIs from completed tasks?
- Do those exports actually exist? (Check Records, or verify with Grep)
- If a prior task deviated, does this PRD reference the actual interface or the original planned one?

**Pattern references (only if codebase.md exists):**
- Does this task reference architecture patterns from codebase.md?
- Are those patterns described accurately?

If codebase.md does NOT exist, skip this section — pattern-reality verification requires the code map, which doesn't exist yet on greenfield projects.

## Return Format

```
## References Check

### Task: [name]
**Status:** <pass | issues found>

**File path issues:**
- [path]: doesn't follow convention — should be [correct path]
- [path]: references file that doesn't exist yet and isn't created by a prior task

**Field name mismatches:**
- [field]: spec says [X], PRD says [Y]
- [field]: Builder Record shows it was renamed to [Z]

**Interface issues:**
- References [export] from Task #NN, but Record shows it was changed to [actual export]

### Summary
- [N] tasks checked
- [N] reference issues
- [N] affected by prior deviations
```

## Rules

- **Read only** — report findings, never edit draft.md
- **Check reality first** — prefer what was actually built (Records) over what was planned (original PRDs)
- **This check matters most for subsequent stories** — first story has no prior references to verify
- **Your final response must be the complete findings report**
