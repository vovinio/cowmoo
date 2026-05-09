---
name: status
description: Quick read-only snapshot — cowmoo/design/ coverage, working notes, design tasks, inbox
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Bash
---

# Status

Quick snapshot of UXUI project state. Read-only — no modifications.

---

## Steps

### 1. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — report "No project initialized. Run /start to begin." and stop.

### 2. Read Key Files

Read:
- `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md`
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/journeys.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/roles.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/screen-index.md` (if exists)

Use Glob to list all files in `$PROJECT_DIR/cowmoo/design/domains/` and `$PROJECT_DIR/cowmoo/specs/domains/`.

While reading OVERVIEW.md, check whether Design Intent and Navigation Structure sections are present and populated. While reading roles.md, count defined roles. While reading screen-index.md, count listed screens.

### 3. Check GitHub

```bash
gh issue list --label "for-uxui" --state open --json number,title --limit 10
```

### 4. Report

```
## UXUI Status

**Inbox:** [N] for-uxui issues (agent messages) (or "none")

**UI Definitions:**
- OVERVIEW.md: [exists / missing]
  - Design Intent: [filled / missing / thin]
  - Navigation Structure: [filled / missing]
- journeys.md: [exists / missing] — [N] journeys
- roles.md: [exists / missing] — [N] roles
- screen-index.md: [exists / missing] — [N] screens
- [N] domain files in cowmoo/design/domains/

**Coverage:**
- Spec domains: [list]
- Domains with UI definitions: [list]
- Domains without: [list]

**Working Notes:**
- [N] items tagged [ready]
- [N] items tagged [future]
- [N] untagged items

**Last session:** [from most recent session header in working notes]
```

---

## Rules

- **Read only** — don't modify any files
- **Quick** — no analysis, no suggestions, just counts and facts
