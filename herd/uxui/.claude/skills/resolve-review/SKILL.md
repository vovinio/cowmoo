---
name: resolve-review
description: Resolve a no-bundle uxui:review task — a card in "UX: Review" whose comments are not a Claude Design submission. Treat the comments, then classify via the uxui:review decision procedure and resolve — send back to the designer, close as no-longer-needed, or escalate a contested spec premise to PM.
argument-hint: <issue-number>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
---

# Resolve Review

Resolve a `uxui:review` task that carries **no Claude Design bundle**. A card reaches "UX: Review" with comments that are not a submission — the designer decided the screen is no longer needed (superseded, redirected), asked a question, or left mid-work notes. A bundle is not required to resolve a task: the comments may already carry the decision.

This skill is one of two resolution paths for a `uxui:review` card. `/catchup` classifies each card and dispatches: a card with no share URL in its comments comes here; a card with one goes to `/review-bundle`.

Invoked two ways:
- **By `/catchup`** — dispatched after classification (no share URL present)
- **Directly** — `/resolve-review <issue>` to resolve a specific no-bundle task

---

## Step 1: Load the task

Take the issue number from the user (or from `/catchup`'s dispatch). Load it:

```bash
gh issue view <issue> --json number,title,labels,body,comments \
  --jq '{number, title, labels: [.labels[].name], body, comments}'
```

**Verify `uxui:review` is present.** If not:
```
Issue #<N> doesn't have the uxui:review label. Nothing to resolve.
```
Stop.

**If a comment carries a Claude Design share URL** (`https://api.anthropic.com/v1/design/h/...` or `https://claude.ai/design/...`) — this card IS a bundle submission, so it was mis-routed here:
```
Issue #<N> has a Claude Design share URL — it is a bundle submission.
Review it with /review-bundle <N> instead.
```
Stop. `/review-bundle` is the right path for a bundle.

---

## Step 2: Treat the comments

Read every comment and the issue body. Work out what the designer or user is communicating, and discuss it with the user. State plainly what the comments say (e.g. "the latest comment says this screen is no longer needed — the existing X screen will be reused as a redirect") so the user sees you read the move correctly.

A bundle is not required to resolve a task — the comments may already carry the decision.

---

## Step 3: Resolve the card

You have treated the comments (Step 2). Resolve the card in two parts.

**3a — Design-file work, if the comments imply it.** If the decision changes `cowmoo/design/` files (a redirect noted in `screen-index.md` or a domain file, a journey update, a UI-definition fix), make those edits and self-verify (re-read what you wrote).

**If the edit reflects a designer-led spec divergence** — the comments record a deliberate product decision that runs ahead of the current spec — the *same* edit also adds a `**Spec divergence:**` marker to the screen, so one commit captures both the design change and the marker. Then log a `For: PM` spec-divergence entry to `PENDING-CORRECTIONS.md`, per `.claude/rules/corrections.md`; the divergence is reconciled with PM in a batch via `/dispatch-corrections pm`, not escalated now.

Then commit + push:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit general "design: <what changed> (ticket #<issue>)"
node "$AGENT_DIR/tools/dev-tools.cjs" push
```

Read each one-line stdout, keying on the `✓` / `✗` marker. A `PUSH: ✗` is non-fatal — the local commit is intact; surface the error and continue. `push` reports `PUSH: skipped — …` if the project has no `origin` remote. For a large multi-screen change, prefer running `/publish` separately.

If the comments imply no `cowmoo/design/` change, skip 3a.

**3b — Classify the card and apply the resolution.** Classify the card's terminal state via the **"Resolving a `uxui:review` card"** decision procedure in `.claude/rules/github-workflow.md` — the pivot is *who must act next*. Three of its rows are reachable from a no-bundle review task (the "design approved" row is `/review-bundle`'s; the "blocked" row is a `bundle-fetch` failure, which cannot occur here):

- **Designer acts next → `uxui:todo`.** The card still needs design work — the comments are mid-work notes, or 3a fixed a definition but the screen still needs a designer.
- **No design produced → close, no `uxui:done`.** The screen is no longer needed (superseded, redirected, dropped), or 3a's fix fully answered the task.
- **PM acts next → close + escalate.** The comments contest the task's *spec premise* in a way that **breaks the product** — a question only PM can answer, and the design cannot sensibly proceed without the answer. A *non-breaking* designer decision that merely runs ahead of the spec is **not** this row: treat it as a spec divergence (3a logged it `For: PM`) and resolve via designer-acts-next or no-design-produced as fits — escalate only the breaking case. See `.claude/rules/corrections.md`.

Render the choice with `AskUserQuestion` — the user makes the call, never resolve a task unilaterally. Present each genuinely-live row as an option (recommended row first with `(Recommended)`, descriptions carrying each row's consequence). When only one row is live, the picker is still the confirmation gate — render it as `Proceed with <the row>` (Recommended) / `Choose a different resolution` (picking it opens a free-text follow-up).

Apply the chosen row via the `issue-transition` command — it reads a JSON handoff file. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use), `comment` carrying the `**[UXUI]** ` identity prefix, then run the command at `--index 0`:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

**Designer acts next** — include `comment` only if there is guidance to add:
```json
[
  { "op": "RETURN_TO_TODO", "issue": <issue>, "comment": "**[UXUI]** <guidance for the designer, if any>", "removeLabel": "uxui:review", "addLabel": "uxui:todo" }
]
```

**No design produced** — `removeLabel` clears `uxui:review` so the statusline stops counting a closed task; **no `addLabel`** — `uxui:done` is reserved for screens actually designed:
```json
[
  { "op": "RESOLVE_ISSUE", "issue": <issue>, "comment": "**[UXUI]** Resolved without a design: <why — e.g. superseded by the existing X screen, reused as a redirect>.", "removeLabel": "uxui:review", "close": true }
]
```

**PM acts next** — close first (this skill cannot invoke `/ask pm` itself, so the close is the action it owns), then escalate. The `comment` states the task is closed as *overtaken by a spec escalation* (not "moot"); **no `addLabel`**:
```json
[
  { "op": "RESOLVE_ISSUE", "issue": <issue>, "comment": "**[UXUI]** Closed as overtaken by a spec escalation — the review comments contest this task's spec premise (<one line: what is contested>). The spec question is being escalated to PM; this close is provisional on PM's answer. If the spec keeps the screen, /design-start re-derives the task, or this issue reopens cleanly.", "removeLabel": "uxui:review", "close": true }
]
```
After the close lands, the spec question must go to PM — `/ask pm` (separate skill, separate run) creates the `for-pm` issue. Make `/ask pm` the recommended first option in the Step 4 hand-off picker: the escalation is the other half of this resolution, not optional follow-up. The loop closes through the `for-pm` issue — PM's answer relabels it `for-pm → for-uxui` and returns it to UXUI's inbox; that issue, not the closed review task, is the durable tracker.

Read the command's stdout — `<op> #<n>: ✓ …` means done; `✗ <reason>` names what already succeeded. Do NOT retry on `✗` — the command already retried internally. A close syncs the board to "Done"; a relabel to `uxui:todo` syncs it to "UX: Todo".

**Partial-failure recovery.** When 3a ran, the resolution is a sequence (`commit general` → `push` → `issue-transition`). `commit general` ok but `push` failed → the local commit is intact, re-running `push` is idempotent. `issue-transition` failed after a successful commit+push → the design change is committed but the issue is still open and `uxui:review`; re-running `/resolve-review` re-runs `commit general` idempotently (`Nothing to commit`) but re-posts the `issue-transition` comment as a duplicate. Options: (a) re-Write the handoff file and re-run only `issue-transition`, accepting the duplicate comment, or (b) manually close / relabel on GitHub. For the PM row, still run `/ask pm` regardless — the escalation is independent of the close.

---

## Step 4: Report

```
## Resolved — #<issue> (no-bundle review task)

- Resolution: <designer — back to uxui:todo | no design — closed without uxui:done | PM — closed + escalated>
- <cowmoo/design/ files changed, if any — committed + pushed>
- <`/ask pm` suggested, if specs are affected>
```

Then render an `AskUserQuestion` hand-off picker for the next action — `Run /catchup` (Recommended — process any other pending items) first, any other live continuation (e.g. `Run /ask pm` if the resolution surfaced spec changes, `Run /dispatch-corrections pm` if 3a logged a spec divergence), and `Done for now` last. Build the option set from where the conversation stands. **After the PM-acts-next resolution, `/ask pm` is the recommended first option instead of `/catchup`** — the escalation is the other half of that resolution, and the review task was closed expecting it.

---

## Completion Checklist

- [ ] Issue loaded; `uxui:review` label confirmed; no share URL (a URL → redirected to `/review-bundle`)
- [ ] Comments treated; what they communicate stated plainly to the user
- [ ] Card classified via the github-workflow decision procedure; resolution chosen with the user via picker (designer / no-design close / escalate to PM)
- [ ] `cowmoo/design/` files updated + committed + pushed, if the outcome required it
- [ ] `issue-transition` ran — issue closed (`uxui:review` removed, no `uxui:done`) or relabelled to `uxui:todo`
- [ ] Report shown
- [ ] Hand-off picker presented

---

## Rules

- **Verify the label first.** Don't run on issues that aren't `uxui:review`. Stop with a clear message.
- **A share URL means wrong skill.** If a comment carries a Claude Design share URL, this is a bundle — redirect to `/review-bundle`.
- **`uxui:done` only for designs.** A task closed because it's moot is closed *without* `uxui:done` — nothing was designed, so it must not count toward "what's been designed."
- **User decides the resolution.** Designer hand-back, no-design close, or escalate-to-PM & close — present your reading and recommendation, let the user confirm. Never close or relabel a task on your own.
- **Specs are PM's.** When a resolution implies spec changes, UXUI cannot write them — surface `/ask pm`, don't guess. When the comments contest the task's *spec premise* (not just a tangential spec gap), that is the PM-acts-next resolution — escalate and close, don't leave the card untreated.
