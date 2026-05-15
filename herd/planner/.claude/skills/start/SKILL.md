---
name: start
description: Load all context, synthesize project state, and propose the next action. The entry point for every planning session.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Agent, Bash, AskUserQuestion
---

# Start

Load all context, understand where we are, and propose what to do next. Always lead — propose specific options, never ask open-ended questions.

---

## Step 0: Verify specs and tech stack exist — bail if not

Run `node tools/dev-tools.cjs check-files` and read two lines:

- `domain-specs:` — reports how many `*.md` files exist in `$PROJECT_DIR/cowmoo/specs/domains/`. Project initialization creates `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` as a stub template, so its mere existence isn't evidence of real specs — domain files are. PM publishes at least one domain via `/digest` once there's enough to plan from.
- `techstack.md:` — reports `not found`, `exists (empty)`, or `exists (has content)`. Project initialization does NOT create `techstack.md` — it is only written by `/tech-stack` at finalization. Treat `exists (empty)` the same as `not found` — empty content isn't a real decision to plan from.

**If `domain-specs: 0`:** stop immediately and tell the user:

```
Can't run /start yet — there are no domain specs to plan from.

Planning decomposes product specs into stories and tasks; without at least one domain file in cowmoo/specs/domains/, any proposal would be a guess.

Ask PM to publish at least one domain via `/digest`, then re-run /start.
```

**If `techstack.md` is `not found` or `exists (empty)`:** stop immediately and tell the user:

```
Can't run /start yet — no tech stack decisions exist.

Planning grounds stories and tasks in the actual technology choice — database, framework, auth, deployment. Without techstack.md, any proposal would hand-wave over choices that shape task shape.

Run /tech-stack first, then re-run /start.
```

Do NOT proceed to Step 1. Do NOT read or spawn anything. Stop.

---

## Step 1: Load Context

Read all of these (specs and techstack.md are guaranteed by Step 0; design files are optional):

1. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — product overview
2. All files in `$PROJECT_DIR/cowmoo/specs/domains/` — entity and feature specs
3. `$PROJECT_DIR/cowmoo/stack/techstack.md` — tech decisions
4. `$PROJECT_DIR/cowmoo/codebase/codebase.md` — actual code structure and patterns (if exists)
5. `$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md` — product constraints and cross-domain facts
6. `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — design intent + navigation + pointers (if exists)
7. `$PROJECT_DIR/cowmoo/design/journeys.md` — end-to-end user arcs (if exists)
8. `$PROJECT_DIR/cowmoo/design/roles.md` — role vocabulary domain files reference (if exists)
9. `$PROJECT_DIR/cowmoo/design/screen-index.md` — master screen list (if exists)
10. `$PROJECT_DIR/cowmoo/design/domains/*.md` — read the file for each domain in the candidate story (or stories) being proposed this session. Skip domains you're not actively considering. On fresh greenfield where multiple stories are in play, read the files for all candidates you'll present in Step 4.

---

## Step 2: Load GitHub State

Spawn `@plan-check` for current project state. It returns:
- Files: presence of techstack / techstack-notes / codebase / knowledge / draft
- Inbox: tracked issue count and list (from `.inbox-context`)
- For-Planner: open for-planner issue list
- Stories & Tasks: counts by label plus the per-story roster

Also spawn `@plan-reader` with **GET_COMPLETED_WORK** to get Records from recently closed tasks — patterns, deviations, what was actually built.

**Before using either result, verify the outputs.** Both helpers can fail partway (gh timeout, auth hiccup, opus turn truncation) and return empty or error-shaped prose. A silent failure looks identical to "nothing notable found", which is exactly the failure mode downstream synthesis can't distinguish. Apply a presence + shape check, modeled on `/review` Step 2:

- `@plan-check` output must contain both the `## Files` and `## For-Planner` headings. These are always emitted; their absence means the helper failed. The `## Stories & Tasks` section is legitimately omitted on projects with no stories yet, so don't require it.
- `@plan-reader` output must contain the `## Completed Work` heading. On a project with no closed tasks the body will say so, but the heading itself is always present.

If either output is empty, an error message, or missing a required heading above: stop, name which helper failed, and ask the user whether to re-spawn it or proceed knowingly without its coverage. Do not continue to Step 3 with unverified data.

---

## Step 3: Check Session State

**Tracked inbox issues:** from `@plan-check`'s "inbox" line. If it reports tracked issues, these are items a prior `/catchup` tracked for planning work. Mention them: "There are N tracked issues from a previous `/catchup` that need attention during this session: [list]."

**Draft from previous session:** If `$PROJECT_DIR/cowmoo/agent-files/planner/draft.md` exists (per `@plan-check`'s "draft.md" line), **render the continue-or-discard choice via `AskUserQuestion`** (single-select). Recommended option first with `(Recommended)` suffix — typically pick "continue" when the draft looks coherent and recent, pick "start fresh" when the draft is stale or the user's new context has moved past it. Each option's `description` carries the consequence ("reads the draft, presents its contents, suggests `/draft` to refine or `/review` if ready" vs "discards the draft and plans a new story from scratch"). Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

If the user chooses to continue → read `draft.md`, present its contents, suggest the next action (`/draft` to refine, `/review` if ready).

---

## Step 4: Synthesize and Propose

Based on everything loaded, determine where we are and propose the best next action.

**No stories exist (first-time planning):**

Lead with the proposed build order. Surface understanding as evidence inside the proposal — don't gate on the user validating your reading of the specs first. The user invoked `/start` to GET your proposal.

```
Proposed build order (first 3–5 stories):
1. <Story name> — <one-line scope + what it unlocks>
2. <Story name> — <one-line>
3. <Story name> — <one-line>

Why this order: <load-bearing reasoning — dependencies, foundational pieces, integrations>
Inherits: <key spec context — domains touched, roles involved>
Open assumptions: <2–3 inferred things the user should confirm or redirect>

→ Approve order, name a story to swap, or redirect to a different starting point?
```

On "name a story to swap" or "redirect" — adjust the order inline and re-present only the changed slots. Don't re-show unchanged stories.

After the order is approved, read `references/feature-questions.md` and ask the 2-3 most relevant questions for the first story being planned. Skip questions specs already answer; lead each question with a proposed default per the propose-first discipline.

**Stories exist (subsequent planning):**

Review completed work from @plan-reader:
- Note deviations from PRDs — what changed and why
- Note new patterns (shared components, utilities, naming conventions)
- Check if these affect the planned order of remaining work

Use the story progress from @plan-check to determine where we are:

**Active story with remaining tasks** — the current story isn't done yet. Don't propose a new story. Instead:
- Show which tasks are done, in-progress, and remaining
- Note deviations from completed tasks that affect upcoming PRDs
- If remaining tasks need PRD updates based on what was built → propose updating them
- If all remaining tasks look good → "Story [name] has X/Y tasks done. Builder can continue."
- **If a tracked inbox issue surfaced a need for a prerequisite task** (e.g., a builder RETURN that `/catchup` routed as "preconditions don't hold — add a prereq task") → propose the new task scope, then proceed to `/draft` for that single task. The draft will be a one-task addition to the existing story; `/publish` creates and links it to the same story via `@plan-ops` CREATE_TASK. Order matters: the prereq must be created with a lower issue number than the blocked task — but since the blocked task already exists, prereq must explicitly be flagged as "do this first" in PRD prose; builder picks lowest issue number, which the new prereq won't be. Tell the user: "The new prereq task will get a higher issue number than the blocked task. Either close the blocked task and let me re-create it after the prereq, or leave it and tell the builder to pick the prereq first via `/start <prereq-number>`."

**All tasks in active story done** — story is complete. Time for next story:
- "Story [name] is complete (all N tasks done). Based on completed work and specs, I'd suggest [next story] because [reasoning]."
- Note any spec changes since last session
- Note any deviations that affect the next story
- Propose the next story scope

**For-planner items pending:**

If @plan-check reports for-planner items, mention it:
- "There are N for-planner items pending. Consider running `/catchup` first — unresolved deviations can affect PRDs."
- Don't block — the user decides.

---

## Step 5: Discuss

Have a natural conversation about the next story. For each task being discussed:
- Propose specific scope, deliverables, and dependencies
- Reference spec sections by name
- Note what this task produces for downstream work
- Flag edge cases from specs and knowledge.md

When the story scope is agreed upon, tell the user:
"Story scope agreed. Run `/draft` to compile PRDs."

---

## Completion Checklist

Before finishing, confirm:

- [ ] All context loaded (specs, stack, knowledge, GitHub)
- [ ] Draft.md checked (continue or discard if exists)
- [ ] Current state synthesized and presented to user
- [ ] Specific next action proposed with reasoning
- [ ] Discussion concluded with clear story scope
- [ ] User directed to `/draft` when ready

---

## Gotchas

- **Always read specs fresh** — don't rely on memory from previous sessions. Specs may have changed.
- **Read completed Records** — what was planned may differ from what was built. PRDs must reference reality.
- **Don't plan stories the user hasn't prioritized** — propose order, let user decide.
- **Research before planning** — if unknowns exist, use @research before proposing story scope.

## References

- `references/feature-questions.md`
