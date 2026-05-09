---
name: map-codebase
description: Scan the project codebase — structure, patterns, conventions. Write findings to codebase.md. Flag techstack discrepancies. Optional — run when the project has enough code worth documenting.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep
---

# Map Codebase

Scan the project's source code to understand its structure, patterns, and conventions. Write findings to `cowmoo/codebase/codebase.md`. Compare against `cowmoo/stack/techstack.md` and flag discrepancies.

---

## When to run this

`/map-codebase` is **optional** — the system works without `codebase.md`.

- **Greenfield project, no code yet:** don't run. There's nothing to map. The codebase map is something you add later as the project grows.
- **Greenfield, enough code exists to see real patterns:** run after a walking skeleton or after the first 2–3 stories ship. That's when conventions stabilize and a map starts paying off in future planning.
- **Brownfield (adopting this agent system on an existing project):** run early. Builder — and through it, planner — benefit from the map immediately.
- **After significant structural changes** (new modules, new layers, new framework patterns): refresh the map so planner's future PRDs cite real patterns.

You (builder) own this file. When planner notices the map is stale during its own work, it asks the user to switch to builder and re-run `/map-codebase` — planner never edits codebase.md directly.

---

## Steps

### 1. Observe the project

Walk the project tree and read actual code — don't guess from file names. The layout varies by language/framework, so don't assume a single code subdirectory. Gather:

**Structure**
- Directory layout (where code lives, where tests live, where migrations live)
- Framework detection from root manifests: `package.json`, `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, `deno.json`, etc.
- Entry points (main/index/app files, `cmd/` for Go, etc.)
- File counts by extension to understand the mix

**Patterns** (read the code)
- **Routing**: how are routes/endpoints defined?
- **Data access**: ORM, raw SQL, API clients?
- **Auth**: how is authentication/authorization handled?
- **Error handling**: centralized or per-handler?
- **Testing**: framework, location, naming conventions (`*.test.ts` co-located, `tests/` dir, `__tests__/`, etc.)
- **Shared utilities and components** — list with file paths

**Conventions**
- Naming (camelCase, snake_case, file naming)
- Code organization (by feature, by layer, hybrid)
- Import style, module structure
- Linting/formatting rules (from config files if present)

### 2. Write codebase.md

Write findings to `$PROJECT_DIR/cowmoo/codebase/codebase.md`:

```markdown
# Codebase

## Structure
[Key directories and their purposes — code dir(s), test dir(s), docs, migrations]

## Patterns
[Routing, data access, auth, error handling — with specific file examples]

## Conventions
[Naming, organization, style]

## Shared Components
[Reusable utilities, components, helpers — with file paths]

## Notes
[Tech debt, gotchas, areas to watch]
```

Self-verify: re-read after writing. Confirm every pattern claim references a specific real file.

### 3. Compare against techstack.md

Read `$PROJECT_DIR/cowmoo/stack/techstack.md`. Flag discrepancies:
- Code uses something different from what techstack says
- New patterns or tools not mentioned in techstack

If discrepancies found, present them to the user:
> "Found discrepancies with techstack.md:
> - [discrepancy]
> The planner owns techstack. If these look right, switch to the planner terminal and share them there — planner can update techstack.md. If a task is already in progress and the discrepancies block it, `/return` the task with these notes."

### 4. Present and suggest

Present findings to user for review. Suggest `/publish` to commit the updated map.

---

## Gotchas

- **Existing patterns may be mistakes, not conventions.** Flag workarounds and tech debt as Notes, not as patterns.
- **Dead code is common.** Check that files/functions are actually imported and used. Don't document dead code as architecture.
- **Framework version matters.** Next.js 12 (pages/) vs 14 (app/) have completely different patterns.
- **Include file paths.** Every pattern claim should reference specific files as evidence.

---

## Rules

- **Observe, don't judge.** Document what IS, not what should be.
- **Focus on what affects future tasks.** Patterns, conventions, shared components the builder will reuse across tasks.
- **Don't modify techstack.md.** Flag discrepancies, suggest the planner update it if needed.
- **Don't assume a single code directory.** Python may have tests/ at the repo root; Rust projects have src/ + tests/; monorepos have packages/*/src/. Describe what's actually there.
