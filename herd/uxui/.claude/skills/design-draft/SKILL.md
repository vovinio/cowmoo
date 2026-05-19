---
name: design-draft
description: Compose task bodies for the batch agreed in /design-start, validate via @design-task-checker, write to design-draft.json. Rerunnable.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Write, Edit, Agent, AskUserQuestion
---

# Design Draft

Compose the design task bodies for the batch agreed in `/design-start`. Each task body has two sections — short Instructions for the human + dense self-contained Claude Design Prompt. After composition, validate the draft mechanically and refine until clean. Output: `cowmoo/agent-files/uxui/design-draft.json`.

This skill is **rerunnable**. Each run rewrites the draft from the current conversation. If the user wants changes after the first run, discuss → re-run `/design-draft`.

---

## Prerequisite

Look back through the conversation. Was `/design-start` run, and did it lock a batch — 1-3 design **units**, each with a **mode** (`new` or `revise`) and, for a multi-screen unit, a coupling rationale?

- **No batch agreed** → "No batch has been agreed yet. Run `/design-start` first to synthesize state and propose what to design next." Stop.
- **Batch agreed** → proceed to Step 1.

---

## Step 1: Read the template (once)

Read both task templates — `.claude/templates/design-task.md` (the `new`-mode from-scratch body) and `.claude/templates/design-task-revise.md` (the `revise`-mode change-request body). Each unit's body is composed against the template for its mode.

---

## Step 2: Read source content (once)

For the screens in the batch, read the inputs you'll inline into prompts:

- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — tone, references, navigation
- `$PROJECT_DIR/cowmoo/design/roles.md` — full role vocabulary (you'll inline only roles each screen uses)
- `$PROJECT_DIR/cowmoo/design/journeys.md` — relevant journey context
- `$PROJECT_DIR/cowmoo/design/domains/<domain>.md` — for each screen's domain — find the screen definition
- `$PROJECT_DIR/cowmoo/specs/domains/<domain>.md` (if present) — relevant business rules to inline (only what each screen needs, not the whole spec). Cross-cutting design domains like `dashboard`/`settings`/`onboarding` may have no matching spec-domain file — skip this read in that case; OVERVIEW and the design-domain file cover the needed context.

**Verify each batch screen has a definition.** For every screen name in the locked batch, confirm the screen appears under a `### ` heading in its domain file. If any screen has no definition (typo, never defined, dropped), stop and ask the user: "Screen `<name>` has no definition in `cowmoo/design/domains/<domain>.md`. Did you mean a different screen, or does it need Phase A definition first?" Do NOT proceed to compose a task body for an undefined screen — Claude Design would receive an empty screen section.

**For a `revise` unit, also locate the existing design.** From `/design-start`'s existing-design map, find the bundle covering the unit's screens: read `cowmoo/design/bundles/<ticket>/meta.json` for the Claude Design share URL, and list `cowmoo/design/bundles/<ticket>/project/` to identify the target file(s) the change request will name (e.g. `App.jsx`, `HomeTab.jsx`). The domain-file screen definition and the spec are still read for both modes — they drive *what* must change.

For visual continuity: the batch's "Inherits" notes from `/design-start` already summarize prior bundles' visual decisions. If you need richer context for inheriting (e.g. specific token names from a prior bundle), read the prior bundle's `chats/*.md` directly.

---

## Step 3: Compose task bodies (batched, single approval gate)

Compose every task body in the locked batch in one pass, then present the batch as a single compressed preview. Collapsing N per-screen approval gates into one keeps chat scannable; the full composed bodies live in your conversation context and get written to `design-draft.json` in Step 4 (where the user can inspect them in the file).

### 3a. Quick batch-wide check
Ask once, upfront: any specific emphasis for any screen in this batch beyond what `/design-start` covered? Single list, not per-screen (default: none).

### 3b. Compose each unit's body silently — by mode

For each unit, compose the body against the template for its **mode**. Both
modes open with an Instructions section carrying the canonical `**Mode:**`,
`**Domain:**`, `**Screens:**` lines, 2-4 "Pay attention to" bullets, acceptance
checks, and submission steps (share URL → comment → relabel `uxui:review`).

**`new` unit → `design-task.md`.** The from-scratch Claude Design Prompt: shared
`## Product context` once (tone, references, anti-references, voice samples —
from OVERVIEW), then a per-screen block repeated for each screen in the unit
(`# Screen: …` purpose · `## Business context` · `## Screen definition` ·
`## Required states` · `## Role meanings` · `## Interactions`), then shared
`## Visual direction already established` and `## Output expectation`.

**`revise` unit → `design-task-revise.md`.** A change request, NOT a from-scratch
brief. Instructions carry `**Existing design:**` (the bundle path + share URL
from Step 2). Then a `## Claude Design Prompt` verbatim-copy block — a
`# Change request` heading, `## Why these changes`, the changes as numbered
detailed prose paragraphs grouped under a per-screen `### <Screen>` heading
(each naming its `file(s):`), each change ending in a `*Spec: …*` rationale
line — then `## Add` for any new screen/region coupled in, `## What NOT to
change`, and `## Output expectation`. Prose pasted as one block, never a table.
Never re-spell a screen from scratch; name only what changes, each paired with
its spec reason.

**Critical rules — both modes:**
- Inline everything. No "see X" pointers to project files. Claude Design has no access to anything.
- Roles by name only. Never inline raw values (no hex, no pixels).
- Voice samples are concrete sentences, not adjectives.
- States use the canonical vocabulary names from `ui-vocabulary.md`.

### 3c. Present the batch in one compressed preview

Show the user named decisions per task — not full bodies. The composed prose stays in your context and lands in `design-draft.json` at Step 4.

```
## Batch preview — <N> units ready for draft

### Unit 1 — [<mode>] <screen(s)>
Pay attention to: <2–3 named risks>
  new:    States: <list> · Roles: <list> · Visual direction: <one-line>
  revise: Changes: <n> · Existing design: <bundle / share URL> · Files: <list>

### Unit 2 — [<mode>] <screen(s)>
...
```

Then render the approval gate as an `AskUserQuestion` picker — `Approve all` (Recommended — write the draft for every task as previewed) / `Refine specific tasks` (the user names which task(s) and what to change — picking it opens a free-text follow-up) / `See a full body first` (show the full composed body for a named task before approving).

**Misunderstanding check.** The named decisions per task must be specific enough that a wrong composition would render visibly different in the preview (different state list, wrong roles, missing visual direction). If two different compositions could produce the same preview line, re-add the load-bearing detail as a named decision.

**On `Refine specific tasks`** — edit the held body for the named task(s) inline; re-present only the changed task(s) in the same compressed shape, then re-render the approval picker. Don't re-show unchanged tasks.
**On `See a full body first`** — present the full composed body for the named task only; then re-render the approval picker.

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
      "title": "[UXUI] <domain>: <unit-label>",
      "label": "uxui:todo",
      "mode": "new",
      "domain": "<domain>",
      "screens": ["<screen>"],
      "body": "<the full composed from-scratch body — as one string>"
    },
    {
      "title": "[UXUI] <domain>: <unit-label>",
      "label": "uxui:todo",
      "mode": "revise",
      "domain": "<domain>",
      "screens": ["<screen a>", "<screen b>"],
      "body": "<the full composed change-request body>"
    }
  ]
}
```

Write it with the `Write` tool — it handles JSON string encoding, so each `body` carries its real newlines and markdown verbatim. Tasks appear in the agreed batch order; every task gets `"label": "uxui:todo"`, a `mode` (`new`/`revise`), its `domain`, and its `screens` list. `<unit-label>` is the screen name for a one-screen unit, or a short cluster label for a multi-screen unit; the `body`'s `**Mode:**`/`**Domain:**`/`**Screens:**` lines must agree with these fields.

---

## Step 5: Self-verify the write

Re-read `design-draft.json`. Verify:
- [ ] The file parses as valid JSON
- [ ] `batch` has `why`, `inherits`, and `setsUp`
- [ ] `tasks` has all N entries in agreed order
- [ ] Each task has a non-empty `title`, `label`, `body`, `mode` (`new`/`revise`), `domain`, and `screens`
- [ ] Each `body`'s `**Mode:**` / `**Domain:**` / `**Screens:**` lines agree with the task's fields
- [ ] A `new` body has Instructions + Claude Design Prompt; a `revise` body has Instructions + a Claude Design Prompt change-request block — no content silently dropped or truncated

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
## Draft compiled — <N> units

1. [<mode>] [UXUI] <domain>: <unit-label>
2. [<mode>] [UXUI] <domain>: <unit-label>
...

Validated: PUBLISH READY (no findings).
Saved to cowmoo/agent-files/uxui/design-draft.json.
```

This is the HARD GATE — do NOT proceed to publish. Render an `AskUserQuestion` hand-off picker: `Run /design-publish` (Recommended — create the GitHub tasks from the draft) first, `Revise the draft` (the user wants changes — picking it opens a free-text follow-up; discuss, then re-run `/design-draft` to rewrite) as a live continuation, and `Done for now` last.

---

## Completion Checklist

- [ ] Batch from `/design-start` verified in conversation
- [ ] Template + source content read
- [ ] Each task body composed inline and approved
- [ ] `design-draft.json` written
- [ ] Self-verified (re-read after write)
- [ ] `@design-task-checker` ran (initial). If REFINE, one fix pass completed and the final regression check reported PUBLISH READY — OR findings surfaced and skill stopped for manual triage
- [ ] Preview presented at HARD GATE
- [ ] Hand-off picker presented (`/design-publish` recommended)

---

## Rules

- **Compose inline, not via sub-agent.** Main agent has the full conversation context — user preferences, emphasis, refinements made during `/design-start`. Sub-agent composition would lose this.
- **Rewrite, don't append.** Re-running `/design-draft` writes a fresh draft from the current conversation. Old drafts get replaced.
- **Self-verify after every write.** Read it back. Catches silent data loss.
- **Don't publish here.** This skill stops at the draft. `/design-publish` does the GitHub work.
- **One batch per run.** The batch from `/design-start` is what this run composes. Don't try to compose multiple batches.
- **Validation runs twice max.** Initial check + (if REFINE) one fix pass + one final regression check. Never loop further — if the checker still reports issues after one fix pass, surface them and stop for manual triage. The human is already in the loop approving each inline fix; additional automatic cycles add noise, not signal.
