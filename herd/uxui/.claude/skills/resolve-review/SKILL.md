---
name: resolve-review
description: Resolve a no-bundle uxui:review task — a card in "UX: Review" whose comments are not a Claude Design submission. Treat the comments, then resolve & close, send back to the designer, or fix a UI definition.
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

## Step 3: Choose the outcome with the user

Render the outcome choice with `AskUserQuestion` — the user makes the call, never resolve a task unilaterally. When two or more of the outcomes below are genuinely live, present each live outcome as an option (recommended outcome first with `(Recommended)`, descriptions carrying each outcome's consequence). When only one outcome is live, the picker is still the confirmation gate — render it as `Proceed with <the outcome>` (Recommended) / `Choose a different outcome` (picking it opens a free-text follow-up).

### Outcome A — Resolve and close (the task is moot)

The design is no longer needed: superseded by an existing design, redirected, or dropped.

1. If the decision changes `cowmoo/design/` files (a redirect noted in `screen-index.md` or the domain file, a journey update), make those edits, self-verify (re-read what you wrote), then commit + push:

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" commit general "design: <what changed> (ticket #<issue>)"
   node "$AGENT_DIR/tools/dev-tools.cjs" push
   ```

   Read each command's one-line stdout, keying on the `✓` / `✗` marker. A `PUSH: ✗` is non-fatal — the local commit is intact; surface the error and continue. `push` reports `PUSH: skipped — …` if the project has no `origin` remote. If the design change is large (multi-screen), prefer running `/publish` separately instead of an inline `commit general`.

2. If the decision requires **spec** changes, that is PM's territory — UXUI cannot write specs. Tell the user; they run `/ask pm` to raise it (separate skill, separate run).

3. Close the issue via the `issue-transition` command. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — `comment` carries the `**[UXUI]** ` identity prefix; `removeLabel` clears `uxui:review` so the statusline does not keep counting a closed task; **no `addLabel`** — `uxui:done` is reserved for screens that were actually designed (it feeds the "what's been designed" count), and nothing was designed here:

   ```json
   [
     { "op": "RESOLVE_ISSUE", "issue": <issue>, "comment": "**[UXUI]** Resolved without a design: <why — e.g. superseded by the existing X screen, reused as a redirect>.", "removeLabel": "uxui:review", "close": true }
   ]
   ```

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
   ```

   Read its stdout — `RESOLVE_ISSUE #<n>: ✓ …` means done; `✗ <reason>` names what already succeeded. Do NOT retry on `✗` — the command already retried internally. A close syncs the board to "Done".

**Partial-failure recovery.** Outcome A is a 3-step sequence (`commit general` → `push` → `issue-transition`). If `commit general` succeeded but `push` failed — the local commit is intact and re-running `push` is idempotent (per the step-1 note). If `commit general` + `push` succeeded but the `issue-transition` RESOLVE_ISSUE failed — the design change is committed and pushed, but the issue is still open and still `uxui:review`. Re-running `/resolve-review` re-runs `commit general` idempotently (`Nothing to commit`) but **re-posts the RESOLVE_ISSUE comment as a duplicate**. Options: (a) re-Write the handoff file and re-run only the `issue-transition` command — accepting the duplicate comment, or (b) manually close the issue and remove `uxui:review` on GitHub. Outcome C reuses this same `commit` → `push` → `issue-transition` sequence, so the same recovery applies.

### Outcome B — Send back to the designer

The task still needs design work — the comments are mid-work notes, or raise something the designer must address before the screen is done. Return it to `uxui:todo` (board → "UX: Todo").

**Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` — include a `comment` only if there is guidance to add (omit the field otherwise):

```json
[
  { "op": "RETURN_TO_TODO", "issue": <issue>, "comment": "**[UXUI]** <guidance for the designer, if any>", "removeLabel": "uxui:review", "addLabel": "uxui:todo" }
]
```

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

Read its stdout, keying on the `✓` / `✗` marker. Do NOT retry on `✗`.

### Outcome C — UI-definition work needed

The comments raise a question about an existing UI definition, or surface UXUI work that belongs in `cowmoo/design/`. Discuss with the user, update the `cowmoo/design/` files, self-verify, and commit + push (the `commit general` + `push` pair from Outcome A — or `/publish` for a large change). Then resolve the issue:

- If the work fully answers the task → close it (Outcome A's `RESOLVE_ISSUE`, with a comment summarising the answer).
- If the screen still needs a designer after the definition is fixed → send it back (Outcome B).

---

## Step 4: Report

```
## Resolved — #<issue> (no-bundle review task)

- Outcome: <resolved & closed | sent back to uxui:todo | UI-definition work + close/return>
- <cowmoo/design/ files changed, if any — committed + pushed>
- <`/ask pm` suggested, if specs are affected>
```

Then render an `AskUserQuestion` hand-off picker for the next action — `Run /catchup` (Recommended — process any other pending items) first, any other live continuation (e.g. `Run /ask pm` if the resolution surfaced spec changes), and `Done for now` last. Build the option set from where the conversation stands.

---

## Completion Checklist

- [ ] Issue loaded; `uxui:review` label confirmed; no share URL (a URL → redirected to `/review-bundle`)
- [ ] Comments treated; what they communicate stated plainly to the user
- [ ] Outcome chosen with the user via picker (resolve & close / send back / UI-definition work)
- [ ] `cowmoo/design/` files updated + committed + pushed, if the outcome required it
- [ ] `issue-transition` ran — issue closed (`uxui:review` removed, no `uxui:done`) or relabelled to `uxui:todo`
- [ ] Report shown
- [ ] Hand-off picker presented

---

## Rules

- **Verify the label first.** Don't run on issues that aren't `uxui:review`. Stop with a clear message.
- **A share URL means wrong skill.** If a comment carries a Claude Design share URL, this is a bundle — redirect to `/review-bundle`.
- **`uxui:done` only for designs.** A task closed because it's moot is closed *without* `uxui:done` — nothing was designed, so it must not count toward "what's been designed."
- **User decides the outcome.** Resolve & close, send back, or fix-and-resolve — present your reading and recommendation, let the user confirm. Never close or relabel a task on your own.
- **Specs are PM's.** When a resolution implies spec changes, UXUI cannot write them — surface `/ask pm`, don't guess.
