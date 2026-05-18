---
name: return
description: Return current task to planner with structured explanation. Preview before executing.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Agent, Bash
---

# Return

Return the current task to the planner with a structured explanation. Always previews before executing.

---

## When to Return

Return the task to the planner when:

- **3 rejections** on the same task — the PRD needs rewriting, not more fixes
- **Ambiguity** requiring a design decision — don't guess
- **Scope exceeds** what the task describes — flag, don't expand
- **Structural deviation** — approach or data model must be fundamentally different from the PRD
- **Spec contradiction** — specs say one thing, PRD says another

Otherwise, `/build` or `/review` is the right skill — not `/return`.

---

## Prerequisites

1. Spawn `@task-check` to find active task.
   - If in-progress task found → use it.
   - If no in-progress → check conversation for recently discussed todo task.
   - If nothing → "Nothing to return. No task is active." Stop.

2. Compose the return comment from conversation context.
   - If no clear issue was discussed → ask: "What's the problem? I need a reason to send this back."

---

## Step 1: Preview

Show the user exactly what will be posted:

```
Returning Task #NN: [task title]

Comment to post:
─────────────────
**[Builder]** RETURN

**Issue:** [composed from conversation — what's wrong]
**Tried:** [what was attempted, if applicable]
**Needed:** [what the builder needs in order to proceed — not what the planner should do]
─────────────────

This will label #NN as for-planner and remove in-progress.
Proceed?
```

User can edit the comment before confirming.

---

## Step 2: Execute (after user confirms)

**First, write the handoff file.** Compose the return comment with the `**[Builder]** ` identity prefix, then write `$PROJECT_DIR/cowmoo/agent-files/builder/.op-handoff.json` (Write tool) — a one-element JSON array with the RETURN entry:

```json
[
  { "op": "RETURN", "issue": <NN>, "comment": "**[Builder]** <confirmed return comment from Step 1>", "removeLabel": ["in-progress", "todo"], "addLabel": "for-planner" }
]
```

The handoff file is a single reused path, overwritten on each use. The identity prefix is the skill's job — compose `**[Builder]** ` into the `comment` field; the `issue-transition` command does not add it.

Then, in order:

1. **Post comment + relabel** — run the return command (Bash); it reads the RETURN entry from the handoff file and runs comment → relabel in order:
   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/builder/.op-handoff.json --index 0
   ```
   The command prints exactly one line: `RETURN #<n>: ✓ <steps>. Verified. Board: Planner.` on success, or `RETURN #<n>: ✗ <reason>` on failure (the `✗` report names what already succeeded — if the comment failed, no relabel happened). Do not retry on `✗` — the command already retried internally.
2. **Warn on uncommitted changes** — if uncommitted code changes exist: "Note: uncommitted code changes remain in the working tree. They'll be here when the task comes back."
3. **Clean up** — `rm -f "$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md"`

**If the return command reports `✗`:** Stop. Report the failure (which step — comment post or relabel — and the error). Do NOT run the cleanup in step 3 — `active-task.md` must stay so the user can retry `/return` without re-running `/start`. On a retry, the handoff file is rewritten from scratch.

---

## Step 3: Report

"Task #NN returned to planner. Switch to planner terminal, run `/catchup`."

---

## Edge Cases

- **No issue discussed** → Ask user for the reason before previewing.
- **Uncommitted code changes** → Warn but don't discard. Code stays for when task returns.
- **Task never claimed (still todo)** → Post comment and label for-planner. No in-progress to remove.
