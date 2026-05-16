---
name: status
description: Quick read-only project snapshot — file states, tagged-item counts, inbox, domains, backlog size
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Agent, Bash
---

# Status

Quick snapshot of the project state. No discussion mode, no semantic deep-dive — that's `/start`'s job. `/status` reports the state and stops.

---

## Steps

### 1. Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — report "No project initialized. Run /start to begin." and stop.

### 2. Check Inbox

Spawn `@inbox-reader` with operation **GET_INBOX** to get any pending for-pm issues. Show any pending issues — they may need attention.

### 3. Gather Counts (lightweight)

For the working-notes count, use a quick grep — counting only TAGGED items, which are unambiguous regardless of section context. The raw-vs-active semantic count (which requires reading the file fully and judging) is `/start`'s job, not `/status`'s.

```bash
notes="$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md"
ready_count=$(grep -cE '^- .*\[ready\]' "$notes" 2>/dev/null)
future_count=$(grep -cE '^- .*\[future\]' "$notes" 2>/dev/null)
```

For the backlog count: number of top-level entries (top-level `##` headers under the `# Backlog` heading).

For domains: Glob `$PROJECT_DIR/cowmoo/specs/domains/*.md` and count names.

For the last session header: grep for the most recent `## Session —` header in WORKING-NOTES.md (or "no sessions recorded" if none).

For the product name: grep PRODUCT.md for its top-level `# ` heading (one Bash call, no full read).

### 4. Report

```
## Project Status

**Inbox:** [N] for-pm issues (or "none")

**Product:** [name from PRODUCT.md, or "unnamed" if not yet defined]

**Working Notes:** [N] tagged [ready], [N] tagged [future]
  (If raw `- ` line count is significantly higher than tagged-count, add: "Run /start for a full assessment — the file has untagged content that needs semantic review.")

**Domains:** [N] domain files
- [list each domain file name]

**Backlog:** [N] deferred items

**Last session:** [brief one-liner from most recent `## Session —` header, or "no sessions recorded"]
```

---

## Rules

- **Read only** — don't modify any files
- **Quick** — grep + glob, no full file reads. If you need full reads, you're doing `/start`'s work.
- **Don't enter discussion mode** — report and stop
- **Tagged-only counts** — `/status` only counts `[ready]` and `[future]` items. The "untagged-as-open" count requires semantic judgment about which sections are active vs. archive — that's `/start`'s job.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Inbox checked
- [ ] Tagged counts gathered via grep (not full Read)
- [ ] Domain files listed via Glob
- [ ] Backlog count + product name + last session header gathered via grep
- [ ] Report presented; no discussion follow-up
