---
name: design-draft
description: Compose task bodies for the batch agreed in /design-start, validate via @design-task-checker, write to design-draft.json. Rerunnable.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Write, Edit, Agent
---

# Design Draft

Compose the design task bodies for the batch agreed in `/design-start`. Each task body has two sections — short Instructions for the human + dense self-contained Claude Design Prompt. After composition, validate the draft mechanically and refine until clean. Output: `cowmoo/agent-files/uxui/design-draft.json`.

This skill is **rerunnable**. Each run rewrites the draft from the current conversation. If the user wants changes after the first run, discuss → re-run `/design-draft`.

---

## Prerequisite

Look back through the conversation. Was `/design-start` run, and did it lock a batch (1-3 screens with reasoning)?

- **No batch agreed** → "No batch has been agreed yet. Run `/design-start` first to synthesize state and propose what to design next." Stop.
- **Batch agreed** → proceed to Step 1.

---

## Step 1: Read the template (once)

Read `.claude/templates/design-task.md` for the body structure (Instructions + Claude Design Prompt sections, with required sub-sections inside the Prompt).

---

## Step 2: Read source content (once)

For the screens in the batch, read the inputs you'll inline into prompts:

- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — tone, references, navigation
- `$PROJECT_DIR/cowmoo/design/roles.md` — full role vocabulary (you'll inline only roles each screen uses)
- `$PROJECT_DIR/cowmoo/design/journeys.md` — relevant journey context
- `$PROJECT_DIR/cowmoo/design/domains/<domain>.md` — for each screen's domain — find the screen definition
- `$PROJECT_DIR/cowmoo/specs/domains/<domain>.md` (if present) — relevant business rules to inline (only what each screen needs, not the whole spec). Cross-cutting design domains like `dashboard`/`settings`/`onboarding` may have no matching spec-domain file — skip this read in that case; OVERVIEW and the design-domain file cover the needed context.

**Verify each batch screen has a definition.** For every screen name in the locked batch, confirm the screen appears under a `### ` heading in its domain file. If any screen has no definition (typo, never defined, dropped), stop and ask the user: "Screen `<name>` has no definition in `cowmoo/design/domains/<domain>.md`. Did you mean a different screen, or does it need Phase A definition first?" Do NOT proceed to compose a task body for an undefined screen — Claude Design would receive an empty screen section.

For visual continuity: the batch's "Inherits" notes from `/design-start` already summarize prior bundles' visual decisions. If you need richer context for inheriting (e.g. specific token names from a prior bundle), read the prior bundle's `chats/*.md` directly.

---

## Step 3: Compose task bodies (batched, single approval gate)

Compose every task body in the locked batch in one pass, then present the batch as a single compressed preview. Collapsing N per-screen approval gates into one keeps chat scannable; the full composed bodies live in your conversation context and get written to `design-draft.json` in Step 4 (where the user can inspect them in the file).

### 3a. Quick batch-wide check
Ask once, upfront: any specific emphasis for any screen in this batch beyond what `/design-start` covered? Single list, not per-screen (default: none).

### 3b. Compose each body silently
For each screen, compose the body following the `design-task.md` template. The body has two sections:

**Instructions section** (short, scannable bullets for the human):
- Brief invocation — paste prompt below into `claude.ai/design`
- 2-4 "Pay attention to" bullets specific to this screen's risk areas (states with edge-case copy, accessibility considerations, brand voice precision)
- Acceptance checks (3-5 yes/no items derived from required states + spec validations)
- Submission steps (share URL → comment → relabel `uxui:review`)
- Optional: note about session continuity

**Claude Design Prompt section** (dense, self-contained, copy-paste verbatim into CD — no project file references):
1. `# [Screen Name]` — one-sentence purpose
2. `## Product context` — inline tone words, references, anti-references, voice samples (from OVERVIEW)
3. `## Business context` — inline relevant entities, rules, validations, terminology (from spec, only what this screen needs)
4. `## Screen definition` — Purpose, Entry points, Type, Layout, Components, Copy (from domain file)
5. `## Required states` — only states applicable to this screen, with each state's meaning inlined per `ui-vocabulary.md`
6. `## Role meanings` — only roles this screen uses, each with semantic purpose inlined from `roles.md`
7. `## Interactions` — from the screen definition
8. `## Visual direction already established` — concrete visual decisions inherited from prior approved bundles (or "None yet — this batch establishes initial direction" for first batch)
9. `## Output expectation` — framework-agnostic HTML/CSS, viewport, mobile notes if applicable

**Critical rules for the Prompt section:**
- Inline everything. No "see X" pointers to project files. Claude Design has no access to anything.
- Roles by name only. Never inline raw values (no hex, no pixels).
- Voice samples are concrete sentences, not adjectives.
- States use the canonical vocabulary names from `ui-vocabulary.md`.

### 3c. Present the batch in one compressed preview

Show the user named decisions per task — not full bodies. The composed prose stays in your context and lands in `design-draft.json` at Step 4.

```
## Batch preview — <N> tasks ready for draft

### Task 1 — <Screen 1 name>
Pay attention to: <2–3 named risks>
States: <state list>
Roles: <role list>
Visual direction: <one-line — inherited specifics or "initial direction">

### Task 2 — <Screen 2 name>
...

→ Approve all, name task(s) to refine, or ask to see a full body before approving?
```

**Misunderstanding check.** The named decisions per task must be specific enough that a wrong composition would render visibly different in the preview (different state list, wrong roles, missing visual direction). If two different compositions could produce the same preview line, re-add the load-bearing detail as a named decision.

**On refine** — edit the held body for the named task(s) inline; re-present only the changed task(s) in the same compressed shape. Don't re-show unchanged tasks.
**On "show full body for task N"** — present the full composed body for that task only; ask the approval question again.

Hold off on writing the draft file (Step 4) until the user approves the full batch.

---

## Step 4: Write preliminary draft (design-draft.json)

Once all task bodies are composed (in conversation), write the draft to `$PROJECT_DIR/cowmoo/agent-files/uxui/design-draft.json`. The draft is a single JSON object — one machine-readable artifact, consumed by `@design-task-checker` and by `/design-publish`'s `issue-create` subcommand:

```json
{
  "batch": {
    "why": "<coherence reason from /design-start — why these screens together>",
    "inherits": "<visual direction inherited, or 'None yet' for the first batch>",
    "setsUp": "<what this batch establishes for downstream>"
  },
  "tasks": [
    {
      "title": "[UXUI] <domain>: <screen 1>",
      "label": "uxui:todo",
      "body": "<the full composed task body — Instructions + Claude Design Prompt — as one string>"
    },
    {
      "title": "[UXUI] <domain>: <screen 2>",
      "label": "uxui:todo",
      "body": "<the full composed task body>"
    }
  ]
}
```

Write it with the `Write` tool — it handles JSON string encoding, so each `body` carries its real newlines and markdown verbatim. Tasks appear in the agreed batch order; every task gets `"label": "uxui:todo"`.

---

## Step 5: Self-verify the write

Re-read `design-draft.json`. Verify:
- [ ] The file parses as valid JSON
- [ ] `batch` has `why`, `inherits`, and `setsUp`
- [ ] `tasks` has all N entries in agreed order
- [ ] Each task has a non-empty `title`, `label`, and `body`
- [ ] Each `body` has both Instructions and Claude Design Prompt sections, with no content silently dropped or truncated

If any check fails, fix and re-write. Don't proceed until self-verify passes.

---

## Step 6: Validate via @design-task-checker

Spawn `@design-task-checker` (no args needed — the sub-agent reads `cowmoo/agent-files/uxui/design-draft.json` directly).

The sub-agent returns classified findings (structure compliance, self-containment violations, missing states, raw values where roles should appear, etc.) plus a recommendation: PUBLISH READY or REFINE.

---

## Step 7: Triage findings inline

If checker reports **PUBLISH READY** → proceed to Step 8.

If checker reports **REFINE** → present findings to the user. For each finding:
- Discuss what to change
- Edit the relevant task body inline (Edit `design-draft.json` directly, scoped to the affected task's `body` string or `batch` field — keep the file valid JSON)
- Track which findings are addressed

After all findings have been fixed inline, re-spawn `@design-task-checker` **once** as a final mechanical-regression check — not a loop. This is a safety net that catches things the inline fixes may have introduced (e.g., a replacement role that doesn't exist in `roles.md`, a raw value that slipped into a new edit).

- If the second check reports **PUBLISH READY** → proceed to Step 8.
- If the second check still reports **REFINE** → surface the remaining findings to the user and **stop**. Do NOT attempt another automatic fix pass. Message: "After one fix pass, the checker still reports: [findings]. Edit `design-draft.json` directly or re-run `/design-draft` to recompose from scratch."

Rationale: the human is already in the loop approving each inline fix. A second mechanical check catches regressions humans skim past (hex codes, role-vs-value, vocabulary names). Beyond that, more automatic cycles add noise, not signal — if the checker isn't satisfied after one fix pass, the right move is human triage, not another agent cycle.

---

## Step 8: HARD GATE — preview to user

Show a summary:

```
## Draft compiled — <N> tasks

1. [UXUI] <domain>: <screen 1>
2. [UXUI] <domain>: <screen 2>
...

Validated: PUBLISH READY (no findings).
Saved to cowmoo/agent-files/uxui/design-draft.json.

**Next:** Run `/design-publish` to create the GitHub tasks.
```

Do NOT proceed to publish. The user runs `/design-publish` when ready.

If the user wants changes → discuss → re-run `/design-draft` to rewrite.

---

## Completion Checklist

- [ ] Batch from `/design-start` verified in conversation
- [ ] Template + source content read
- [ ] Each task body composed inline and approved
- [ ] `design-draft.json` written
- [ ] Self-verified (re-read after write)
- [ ] `@design-task-checker` ran (initial). If REFINE, one fix pass completed and the final regression check reported PUBLISH READY — OR findings surfaced and skill stopped for manual triage
- [ ] Preview presented at HARD GATE
- [ ] User informed `/design-publish` is next

---

## Rules

- **Compose inline, not via sub-agent.** Main agent has the full conversation context — user preferences, emphasis, refinements made during `/design-start`. Sub-agent composition would lose this.
- **Rewrite, don't append.** Re-running `/design-draft` writes a fresh draft from the current conversation. Old drafts get replaced.
- **Self-verify after every write.** Read it back. Catches silent data loss.
- **Don't publish here.** This skill stops at the draft. `/design-publish` does the GitHub work.
- **One batch per run.** The batch from `/design-start` is what this run composes. Don't try to compose multiple batches.
- **Validation runs twice max.** Initial check + (if REFINE) one fix pass + one final regression check. Never loop further — if the checker still reports issues after one fix pass, surface them and stop for manual triage. The human is already in the loop approving each inline fix; additional automatic cycles add noise, not signal.
