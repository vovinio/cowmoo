---
name: review-bundle
description: Evaluate a designer's Claude Design bundle submission for a uxui:review task — fetch, evaluate via @design-evaluator, triage, then approve (hand to /approve-design) or reject.
argument-hint: <issue-number>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Bash, Agent, Write, AskUserQuestion, Skill
---

# Review Bundle

Resolve a `uxui:review` task that carries a **Claude Design bundle** — a designer's submission. Fetch the bundle, evaluate it via `@design-evaluator`, triage the findings with the user, then approve or reject.

This skill is one of two resolution paths for a `uxui:review` card. `/catchup` classifies each card and dispatches: a card with a share URL in its comments comes here; a card without one goes to `/resolve-review`. So a bundle is expected by the time this skill runs.

Invoked two ways:
- **By `/catchup`** — dispatched after classification (a share URL is present)
- **Directly** — `/review-bundle <issue>` to re-trigger bundle review on a specific task

The **approval transaction** lives in a separate skill, `/approve-design` — this skill hands off to it once the user approves. The **reject** path is short and stays here.

---

## Step 1: Load the issue

Take the issue number from the user (or from `/catchup`'s dispatch). Load it:

```bash
gh issue view <issue> --json number,title,labels,body,comments \
  --jq '{number, title, labels: [.labels[].name], body, comments}'
```

Required:
- Label `uxui:review` is present.
- A comment exists with a Claude Design share URL (`https://api.anthropic.com/v1/design/h/...` or `https://claude.ai/design/...`).

If `uxui:review` not present:
```
Issue #<N> doesn't have the uxui:review label. Nothing to review.
```
Stop.

If no share URL in any comment — this card is **not** a bundle submission, so it was mis-routed here:
```
Issue #<N> is uxui:review but has no Claude Design share URL — it is not a bundle
submission. Resolve it with /resolve-review <N> instead (it treats the comments
and resolves the task without a bundle).
```
Stop. Do not proceed — `/resolve-review` is the right path for a no-bundle card.

---

## Step 2: Extract URL and identify the unit

From the issue:
- `<url>` — the share URL from the **last** comment whose body contains a Claude Design share URL (`https://api.anthropic.com/v1/design/h/` or `https://claude.ai/design/`). Scan all comments; the most recent wins.
- `<mode>` — from the `**Mode:**` line in the issue body (`new` or `revise`).
- `<domain>` — from the `**Domain:**` line in the issue body.
- `<screens>` — from the `**Screens:**` line in the issue body (one screen, or several for a coupled unit).
- `<designer>` — comment author who posted the URL.

These canonical lines live in the task's Instructions section (written by `/design-draft` or `/dispatch-corrections`). **Fallback** — an older task with no such lines: parse `<domain>` and a single `<screen>` from the title pattern `[UXUI] <domain>: <screen>`, treat `<mode>` as `new`. If neither the lines nor the title resolve, ask the user for the mode, domain, and screens.

---

## Step 3: Fetch the bundle

Run the `bundle-fetch` command directly — quote the URL (share URLs contain `?` and `&` that the shell would otherwise interpret); pass `-` for `<designer>` if the handle is unknown:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" bundle-fetch <issue> <domain> <unit-label> <designer> "<url>"
```

The command downloads the tarball (60s timeout), extracts it into `cowmoo/design/bundles/<issue>/` (`--strip-components=1`), writes `meta.json`, and `git add` + `git commit`s. It prints exactly one line and sets an exit code: `OK ticket=N files=M commit=<hash> path=<relpath>` on success, or a `FAIL <kind> — …` line otherwise (`url-unreachable`, `url-timeout`, `extraction-failed`, `extraction-empty`, `git-add`, `git-commit`, `meta-write`, `no-project-dir`).

**On `OK`** — proceed to Step 4.

**On `FAIL`** — classify the failure via the **"Resolving a `uxui:review` card"** decision procedure in `.claude/rules/github-workflow.md`. A `bundle-fetch` failure is one of two rows:

**`url-unreachable` / `url-timeout` → the designer acts next.** The fetch cannot proceed without the designer (re-share an expired URL; retry or re-share after a timeout). Apply the **designer-acts-next** row — relabel `uxui:review → uxui:todo` so the card sits in the designer's column, not stranded in "UX: Review". **Write** a one-element handoff array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use), `comment` composed with the `**[UXUI]** ` identity prefix, then run `issue-transition` at `--index 0`:

```json
[
  { "op": "RETURN_TO_TODO", "issue": <issue>, "comment": "**[UXUI]** <comment text — see below>", "removeLabel": "uxui:review", "addLabel": "uxui:todo" }
]
```
```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

Comment text by kind:
- **`url-unreachable`** — "The Claude Design share URL appears to have expired. Please re-share from your Claude Design session and post the new URL on this issue."
- **`url-timeout`** — "The Claude Design bundle download timed out (>60s). The URL itself is likely still valid — usually a large bundle or a slow network. Please either (a) retry by re-posting the same URL on this issue, or (b) if this persists, re-share from Claude Design in case the export was unusually large."

Read the command's stdout — `RETURN_TO_TODO #<n>: ✓ …` means done (comment posted, card flipped `uxui:review → uxui:todo`); `✗ <reason>` names what already succeeded — do NOT retry on `✗`. Stop. The designer acts from "UX: Todo"; on a re-share they relabel back to `uxui:review` and `/catchup` re-routes the card here.

**Any other `FAIL`** (`extraction-failed`, `extraction-empty`, `meta-write`, `git-add`, `git-commit`, `no-project-dir`) **→ UXUI is blocked mid-resolution.** This is the one row whose destination is "stays `uxui:review`": the bundle directory was cleaned up or the commit didn't land, so `@design-evaluator` has nothing to read and `/approve-design`'s ATTACH_DESIGN would later race or no-op — and the failure is infrastructural (disk space, git hooks, signing config, lock files), not a designer hand-back. Surface the raw `FAIL` line to the user and stop. Do NOT proceed to Step 4 and do NOT relabel — the card correctly stays `uxui:review` for re-run once the infra issue is fixed.

---

## Step 4: Evaluate the bundle

Spawn `@design-evaluator`:

```
@design-evaluator
  ticket=<issue>
  mode=<mode>
  domain=<domain>
  screens=<screens — comma-separated>
  bundle-path=$PROJECT_DIR/cowmoo/design/bundles/<issue>/
```

The sub-agent reads the brief, specs, domain UI def, roles, and the bundle. For a `new` task it compares the bundle against the from-scratch brief; for a `revise` task, against the changeset. Returns classified findings per screen: GAPS, CONCERNS, OBSERVATIONS, ROLE_ADDITIONS — plus a recommendation (APPROVE or RETURN).

---

## Step 5: Triage findings with the user

Present the evaluator's findings. Lead with the recommendation:

```
## Bundle review — #<issue> (<domain>: <unit-label>) · mode: <mode>

**Evaluator recommendation:** APPROVE | RETURN

### GAPS (N)
- ...

### CONCERNS (N)
- ...

### OBSERVATIONS (N)
- ...

### ROLE_ADDITIONS (N)
- ...
```

Discuss with the user. **Classify each finding — blocking or deferrable** (see `.claude/rules/corrections.md`). A finding that changes what the screen *does* or whether a builder can build it correctly — a missing state, a layout or role change, a contradiction — is **blocking**. A finding that is purely copy-grade — microcopy, a label, wording that drifted from a spec — is **deferrable**: the bundle's HTML is the build reference, but a copy delta does not stop the screen from being correct, so it is logged to `PENDING-CORRECTIONS.md` rather than forcing a bundle return. Do not inflate a copy nit into a blocker.

The user makes the final call. The routes:

- **Approve** — no findings, or only deferrable copy deltas. Log each deferrable delta to `PENDING-CORRECTIONS.md` first — to `For: designer` for copy in the bundle's HTML (key the entry to the affected screen's `<domain> / <screen>` — one of the unit's screens — per the entry format in `.claude/rules/corrections.md`), or `For: PM` for a copy mismatch against a spec — then proceed to Step 6. The bundle is approved as-is; `/dispatch-corrections` batches the logged deltas later.
- **Approve with role additions** — accept ROLE_ADDITIONS, then approve (Step 6 passes the role names to `/approve-design`).
- **Return for revision** — any blocking finding. The bundle goes back to the designer (Step 7).

Render the choice with the `AskUserQuestion` tool — recommended route first. When deferrable copy deltas were logged on an approve route, tell `/approve-design` so its journal entry records them.

---

## Step 6: Approve → hand off to /approve-design

If the user approves, this skill is done — the approval transaction (roles commit, domain-file attach, journal, commit, close) lives in `/approve-design`. **Invoke it now**, passing the issue, domain, and the unit's screens, plus any accepted ROLE_ADDITIONS:

```
/approve-design <issue> <domain> <screens — comma-separated>
```

`/approve-design` runs in this same conversation, so it inherits the `@design-evaluator` findings and your triage decisions — it needs that context to compose the journal summary. Do NOT attach the bundle, edit the domain file, or close the issue here; `/approve-design` owns all of that.

If ROLE_ADDITIONS were accepted, tell `/approve-design` which role names — it commits `roles.md` as its first step.

---

## Step 7: Reject path

A rejection is the **designer-acts-next** row of the `uxui:review` decision procedure in `.claude/rules/github-workflow.md` — a feedback comment plus a relabel `uxui:review → uxui:todo`. If the user wants to return for revision:

1. **Compose feedback comment** — discuss with user what to write. Should include:
   - Which findings need to be addressed (specific gaps/concerns)
   - Concrete guidance on what to change
   - Optional: any roles or vocabulary clarifications

2. **Send via the `issue-transition` command:**

   The `issue-transition` command reads its parameters from a JSON handoff file. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — compose the feedback comment with the `**[UXUI]** ` identity prefix:

   ```json
   [
     {
       "op": "REJECT_DESIGN",
       "issue": <issue>,
       "comment": "**[UXUI]** Returned for revision:\n\n<composed feedback text>",
       "removeLabel": "uxui:review",
       "addLabel": "uxui:todo"
     }
   ]
   ```

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
   ```

   The command runs comment → relabel in order, verifies each step, and syncs the board — posting the comment, removing `uxui:review`, adding `uxui:todo`. Designer iterates. Read its stdout — `REJECT_DESIGN #<ticket>: ✓ …` means done; `REJECT_DESIGN #<ticket>: ✗ <reason>` names what already succeeded. Do NOT retry on `✗`.

   **Partial-failure recovery:** REJECT_DESIGN is composite (comment + relabel). If the comment posted but relabel failed, the feedback is visible to the designer but the issue still reads as `uxui:review`. Tell the user explicitly and offer: (a) re-run the `issue-transition` REJECT_DESIGN command — re-Write the handoff file (it's overwritten per use, so the prior entry is gone) and re-run; the comment will double-post — undesirable but recoverable, (b) manually flip labels on GitHub (remove `uxui:review`, add `uxui:todo`). If relabel worked but comment failed, tell the user the designer will see the label change without guidance — suggest re-running with just a `POST_COMMENT` handoff entry (Write a one-element `POST_COMMENT` array, run `issue-transition` at `--index 0`) to add the missing feedback.

---

## Step 8: Report

On reject:
```
## Returned — #<issue>

- Feedback posted
- Label flipped: uxui:review → uxui:todo
- Designer will iterate
```

On approve, this skill produces no report — `/approve-design` reports the approval outcome.

On the reject path, after the report render an `AskUserQuestion` hand-off picker for the next action — `Run /catchup` (Recommended — process any other pending items) first, any other live continuation, and `Done for now` last (the user may simply be waiting for the designer's next submission). Build the option set from where the conversation stands. On the approve path, `/approve-design` owns the hand-off — do not add one here.

---

## Completion Checklist

- [ ] Issue loaded; `uxui:review` label confirmed; share URL found in comments (no URL → redirected to `/resolve-review`)
- [ ] Bundle fetched and committed via the `bundle-fetch` command
- [ ] (Bundle-fetch `url-unreachable`/`url-timeout`) `RETURN_TO_TODO` ran — comment posted, card flipped `uxui:review → uxui:todo`; skill stopped
- [ ] (Bundle-fetch infra failure) raw `FAIL` line surfaced; card left `uxui:review` for re-run; skill stopped
- [ ] `@design-evaluator` ran; findings classified
- [ ] User triaged findings and chose approve/reject
- [ ] (Approve) `/approve-design <issue> <domain> <screen>` invoked
- [ ] (Reject) `REJECT_DESIGN` ran with composed feedback; report shown

---

## Rules

- **Verify the label first.** Don't run on issues that aren't `uxui:review`. Stop with a clear message.
- **A bundle is required for this path.** No share URL in the comments → this is not a bundle submission; redirect to `/resolve-review`. Never invent a URL or fall back.
- **Bundle is read-only.** Never edit files inside `cowmoo/design/bundles/` — the bundle is captured evidence of what was submitted.
- **Approval is `/approve-design`'s job.** This skill never attaches a bundle, edits a domain file, writes the journal, or closes the issue. On approve it hands off; on reject it handles the short relabel itself.
- **Use `@design-evaluator` always.** Even if you're confident the bundle is fine, run the evaluator. It catches things you'd miss.
