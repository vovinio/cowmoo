---
name: status
description: Quick read-only project snapshot — working notes counts, domain list, backlog size, inbox
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Agent, Bash
---

# Status

Quick snapshot of the project state. No loading into discussion mode — just report and done.

---

## Steps

### 1. Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — report "No project initialized. Run /start to begin." and stop.

### 2. Check Inbox

Spawn `@inbox-reader` with operation **GET_INBOX** to get any pending for-pm issues.

Show any pending issues — these may need your attention.

### 3. Read Key Files

Read:
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`

Use Glob to list all files in `$PROJECT_DIR/cowmoo/specs/domains/`.

### 4. Count and Report

```
## Project Status

**Inbox:** [N] for-pm issues (or "none")

**Product:** [name from PRODUCT.md, or "unnamed" if not yet defined]

**Working Notes:**
- [N] items tagged [ready]
- [N] items tagged [future]
- [N] untagged items (in discussion)

**Domains:** [N] domain files
- [list each domain file name]

**Backlog:** [N] deferred items

**Last session:** [brief summary from most recent session header in working notes, or "no sessions recorded"]
```

---

## Rules

- **Read only** — don't modify any files
- **Quick** — no analysis, no suggestions, just counts and facts
- **Don't enter discussion mode** — report and stop

---

## Completion Checklist

Before finishing, confirm:

- [ ] Inbox checked
- [ ] Working notes counted (ready/future/open)
- [ ] Domain files listed
- [ ] Backlog counted
- [ ] Report presented
