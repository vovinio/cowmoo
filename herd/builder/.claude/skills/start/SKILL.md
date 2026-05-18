---
name: start
description: Find task, load context, present approach, discuss. The entry point for every build session.
user-invocable: true
disable-model-invocation: true
argument-hint: [issue-number]
allowed-tools: Read, Write, Glob, Agent, Bash
---

# Start

Find what to work on, load all context, and propose an implementation approach. Always lead — propose specific options, never ask open-ended questions.

---

## Step 1: Find Task

Spawn `@task-check` to check for in-progress task.

**If in-progress task found:**
- This is a resume. Note the task number.
- Spawn `@task-reader` GET_TASK_CONTEXT with that task number.

**If no in-progress task:**
- If argument provided (issue number), use that.
- Otherwise check the board for a human-queued task — a card a human dragged into the "In Progress" column to say "build this next":
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" board-drags "In Progress" in-progress
  ```
  This prints one `<number><TAB><current-labels>` line per card sitting in "In Progress" that isn't labelled `in-progress` yet. If it prints exactly one, prefer that issue as the task to load. If it prints several, mention them to the user and let them pick; if none or `Board: no board`, fall through.
- Otherwise spawn `@task-reader` FIND_TASK for the next available todo task.
- If no todo tasks: "No tasks available." Spawn `@task-reader` GET_STATUS for overview. Stop.
- Spawn `@task-reader` GET_TASK_CONTEXT with the found task.

**Save task context** — Write the full task context returned by `@task-reader` to `$PROJECT_DIR/cowmoo/agent-files/builder/active-task.md`. Include everything: task number, title, labels, full PRD body, parent story, sibling tasks, Records, and planner comments. This is the local reference for `/build`, `/review`, and `/publish` — no need to re-fetch the PRD from GitHub.

---

## Step 2: Load Project Context

Read these files (skip any that don't exist):

1. `$PROJECT_DIR/cowmoo/codebase/codebase.md` — project structure, patterns, conventions. Optional — may not exist on greenfield. When present, this is authoritative for "where does code live?" and "what patterns does this project use?"
2. `$PROJECT_DIR/cowmoo/stack/techstack.md` — tech decisions
3. `$PROJECT_DIR/cowmoo/agent-files/builder/BUILD-NOTES.md` — project-specific rules and directives from prior tasks
4. Spec files referenced in the PRD (from `cowmoo/specs/`)

If `codebase.md` is missing and the project has enough code worth documenting, note this for the user — running `/map-codebase` would establish the map for future sessions and help planner write more specific PRDs. Don't force it; just flag.

---

## Step 3: Assess Task State

From the task context (PRD, comments, labels), determine:

- **Fresh** — no prior builder comments, standard todo task
- **Returning** — has builder comments AND planner response (was returned, now resolved)
- **Rejected** — planner relabeled to todo with feedback on previous attempt
- **Resume** — was in-progress (session interrupted)

---

## Step 4: Check for Blockers

**Sibling check:** Does a sibling task (same story) have `for-planner` label?
- If yes → this task's PRD may get updated. Do NOT claim it.
- Tell the user: "Task #NN is blocked — sibling #XX is with the planner. Wait for resolution."
- If other non-blocked todo tasks exist in different stories → offer those instead.
- If no unblocked tasks exist → "All available tasks are blocked. Wait for planner." Stop.

**Dependency check:** Read the **Dependencies** field in the PRD (from task context returned by @task-reader).
- If "None" → no blockers from dependencies.
- If dependencies list issue numbers (`#45`, `#46`) → @task-reader will have checked their state. If any are still open → warn the user: "Task #NN depends on #XX which isn't complete yet."
- Don't hard-block — the user decides whether to proceed despite open dependencies.

**PRD check:**
- Does the PRD reference patterns not in the stack? → Flag.
- Does the PRD contradict specs? → Flag.
- Is anything unclear or missing from the PRD? → Flag for discussion.

---

## Step 5: Present Approach

Show the user:

**Task summary:**
- Task number and title
- State (fresh / returning / rejected / resume)
- If returning/rejected: what happened last time, what the planner responded

**Proposed implementation:**
- Which files to create or modify
- What order to implement
- Key decisions or trade-offs
- Any concerns from step 4

If resume — also show existing uncommitted changes via `@git-status`.

**End with:** "Ready to build — run `/build`" or flag concerns for discussion.

---

## Step 6: Claim Task

Only after user confirms readiness (not before):
- If resuming, task is already in-progress — skip this step entirely (no handoff file, no spawn).
- Otherwise, write the handoff file `$PROJECT_DIR/cowmoo/agent-files/builder/.op-handoff.json` (Write tool) — a one-element JSON array with the CLAIM entry:
  ```json
  [
    { "op": "CLAIM", "issue": <NN>, "removeLabel": "todo", "addLabel": "in-progress" }
  ]
  ```
  The handoff file is a single reused path, overwritten on each use.
- Run the claim command (Bash) — it reads the CLAIM entry from the handoff file and swaps labels todo → in-progress:
  ```bash
  node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/builder/.op-handoff.json --index 0
  ```
  The command prints exactly one line: `CLAIM #<n>: ✓ relabeled (...). Verified. Board: In Progress.` on success, or `CLAIM #<n>: ✗ <reason>` on failure. On `✗`, surface the report verbatim and stop — do NOT retry (the command already retried internally).

---

## Edge Cases

- **No tasks available** → Show project status. Stop.
- **Multiple todo tasks** → Pick the lowest issue number unless user specifies.
- **Sibling is `for-planner`** → Warn but don't block. User decides.
- **Task has 3+ prior rejections** → Warn: "This task has been rejected multiple times. The PRD may need a rewrite — consider `/return` after reviewing."

---

## Gotchas

- **Always read the full PRD and comments** — don't rely on memory from previous sessions.
- **Read sibling Records** — what was built in related tasks affects your approach.
- **Check BUILD-NOTES.md** — it has patterns and gotchas from previous tasks.
