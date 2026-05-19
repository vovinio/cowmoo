---
name: approve-design
description: The approval transaction for a reviewed Claude Design bundle — commit roles, attach the bundle to the domain file, write the visual journal, commit, and close the uxui:review issue as uxui:done. Re-invocable to resume a partial run.
argument-hint: <issue-number> <domain> <screens>
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Bash, Edit, Write, AskUserQuestion
---

# Approve Design

Run the approval transaction for a bundle the user has already reviewed and approved: commit any new roles, attach the bundle to the domain file, write the visual-journal entry, commit, and flip the issue `uxui:review` → `uxui:done` and close it.

**This skill is normally invoked by `/review-bundle`** right after the user approves — it runs in that same conversation, so it inherits the `@design-evaluator` findings and the triage decisions, which Step 4 needs to compose the journal summary.

**It is also re-invocable directly** — `/approve-design <issue> <domain> <screens>` — to resume a run that failed partway through the commit sequence. Step 2 detects how far the prior run got and skips the completed steps.

**Arguments:** `<issue> <domain> <screens>` — `<screens>` is the comma-separated list of screens the reviewed unit covers (one, or several for a coupled unit). If `/review-bundle` reported accepted ROLE_ADDITIONS, it also names the role names — those drive Step 1.

`<unit-label>` is not a passed argument — derive it locally: parse it from the issue title pattern `[UXUI] <domain>: <unit-label>`, or, if the title is unavailable, use the single screen name when `<screens>` has one entry or a short cluster label over `<screens>` for a coupled unit. Bind it before Step 4 (its first use).

---

## Step 1: Commit new roles (if any were accepted)

If ROLE_ADDITIONS were accepted during review — discuss role names with the user, then Edit `cowmoo/design/roles.md` to add them. Run the `commit roles` command with a `roles: add <role names>` message — `commit` mode `roles` is strictly scoped to `cowmoo/design/roles.md`, so unrelated pending UXUI-territory changes are not swept into the roles commit. Use a single-quoted heredoc so the message is not mangled by the shell:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit roles "$(cat <<'EOF'
roles: add <role names>
EOF
)"
```

Read the command's one-line stdout (it may emit a trailing `Note:` line):

**If the report begins with `COMMIT_ROLES: ✗`** — the command refused (mid-merge state) or failed verification (commit contains paths other than `roles.md`). Surface the report verbatim and **stop** — do NOT proceed to Step 2. The user resolves the underlying state then re-runs `/approve-design`.

**On `COMMIT_ROLES: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface it. (`COMMIT_ROLES: Nothing to commit.` means `roles.md` was unchanged — also fine to proceed.)

Then run `node "$AGENT_DIR/tools/dev-tools.cjs" push` to publish the roles commit. A `PUSH: ✗` is non-fatal — the local commit is intact; surface the error and continue. `push` reports `PUSH: skipped — …` if the project has no `origin` remote.

If no ROLE_ADDITIONS were accepted, skip this step.

---

## Step 2: Detect a prior partial run

A previous `/approve-design` invocation on this ticket may have completed some steps. Detect how far it got with the `review-resume-state` command:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" review-resume-state <issue> <domain>
```

It prints exactly one line:

- **`RESUME: none`** — no `**Bundle:**` line for this ticket in the domain file. Normal first run. Proceed to Step 3.
- **`RESUME: found line=<n> heading="<heading>" porcelain=clean`** — a Bundle line for this ticket is already committed.
  - If `<heading>` is one of the unit's `<screens>` → the prior run committed the attachment + journal; only APPROVE_DESIGN is left. **Skip Steps 3, 4, 5, 6 — go straight to Step 7.**
  - If `<heading>` is not any of `<screens>` → **misattribution** (handle below).
- **`RESUME: found line=<n> heading="<heading>" porcelain=dirty`** — a Bundle line for this ticket exists but the domain file has uncommitted changes (the prior run's Edit landed, the commit didn't).
  - If `<heading>` is one of `<screens>` → **Skip Step 3 (the Edit is done). Proceed to Steps 4, 5, 6, 7.** Step 4 needs the review context — see its note.
  - If `<heading>` is not any of `<screens>` → **misattribution** (handle below).
- **`RESUME: error — <reason>`** — surface the reason and stop; resolve it before retrying.

Step 3 attaches all of the unit's `**Bundle:**` lines in one atomic Edit, so `review-resume-state` finding *any* one line means the whole attachment landed — the resume stays binary (none / found).

**Misattribution** — the Bundle line sits under a screen heading that is not part of this unit. Do NOT auto-fix. Render the choice with `AskUserQuestion`: (a) move the line(s) under the correct `### <screen>` headings and proceed, (b) leave as-is and proceed (the line is for a different screen — proceed only if that is correct), (c) stop and investigate manually.

Tell the user explicitly which sub-case Step 2 detected before continuing.

---

## Step 3: Attach the bundle to the domain file

(Skip if Step 2 detected a prior attachment.)

Read `$PROJECT_DIR/cowmoo/design/domains/<domain>.md`. For **each** screen in `<screens>`, find its `### <Screen Name>` heading and append a `**Bundle:**` line at the END of that screen's section — just before the next `### ` heading (or end of file; resilient to screens that lack an "Interactions" subsection). All the lines point at the same bundle directory. Format:

```
**Bundle:** `cowmoo/design/bundles/<issue>/` (approved YYYY-MM-DD, ticket #<issue>)
```

**Spec divergences (if `/review-bundle` passed any).** For each accepted designer-led spec divergence, also — in the same Edit — update that screen's definition in the domain file to reflect what the design now does (the layout, state, interaction, or element the designer decided), and add a marker line in the screen's section:

```
**Spec divergence:** <what the design does that the spec does not yet> — pending PM alignment (logged YYYY-MM-DD)
```

The divergence was already logged to `PENDING-CORRECTIONS.md` `For: PM` by `/review-bundle`; this step makes the domain file itself reflect the decision and flags it for downstream readers (builder, planner). See `.claude/rules/corrections.md`. If no divergences were passed, skip this — append only the `**Bundle:**` lines.

Make **all** the changes — every `**Bundle:**` line, plus any spec-divergence definition updates and markers — in a single Edit (or one Write of the whole file) — one atomic change, so a partial run never leaves some of the unit's screens attached and others not, and Step 2's resume detection stays binary.

If ANY screen heading in `<screens>` cannot be located (title drift: casing, hyphenation, a renamed screen), stop and ask the user to confirm the canonical screen headings. Do NOT attach a partial set, and do NOT append a Bundle line to a different screen — the ATTACH_DESIGN guard would commit a misattribution.

---

## Step 4: Compose the journal summary inline

(Skip if Step 2 routed straight to Step 7.)

**Context note:** this step composes spec-grade content from the review conversation — the `@design-evaluator` findings, the user's triage decisions, the role additions. When `/review-bundle` invoked this skill, that context is present. If you were invoked **directly** to resume and the `porcelain=dirty` (uncommitted) sub-case applies but the review conversation is NOT in context, you cannot compose the summary faithfully — stop and tell the user to re-run `/review-bundle <issue>` instead, which re-evaluates the bundle and re-drives approval with full context.

Drawing on the full conversation context, compose a 15–20 line summary block for this bundle — a coherent interpretation of what was approved, rich enough that `/design-start` can synthesize "visual direction already established" from it without re-reading the bundle.

Include these sections (omit any that are genuinely empty for the bundle under review):

- **Character:** palette + typography + spacing density + voice. 2–4 sentences. Cite roles the bundle reinforces (e.g. "mid-brown `primary-action`, cream `surface-base`"). Voice expressed as concrete sample sentences, not adjectives.
- **Layout:** high-level structure for this screen — column count, max-width, where primary/secondary actions sit, label positioning.
- **State handling:** how the declared states render — validation timing, error display, loading affordances. Ground in the vocabulary from `.claude/rules/ui-vocabulary.md`.
- **Roles established:** any NEW roles this bundle introduced (added to `roles.md` via Step 1). List them; if none, say "none new in this bundle."
- **Roles used:** the roles referenced on this screen (from the domain-file "Roles Used" section).
- **Patterns set up for downstream screens:** reusable decisions this bundle establishes for later work (e.g. "8px as default border-radius", "serif headers / sans body pairing").
- **Deviations / open items:** anything the evaluator flagged as `CONCERN` or `OBSERVATION` that was accepted with rationale. Also record any copy delta `/review-bundle` logged to `PENDING-CORRECTIONS.md` during review — the stale copy, the corrected copy, and that it is queued for batched dispatch. And record any **designer-led spec divergence** accepted this review — what the design now does vs. what the spec says, and that it is logged `For: PM` for batched alignment (the bundle was approved as-is per `.claude/rules/corrections.md`, since both a copy delta and a sound divergence are non-blocking).

Present the composed block as a durable-record preview, not a draft for chat-review:

```
## Journal entry preview — #<issue> (<domain>/<unit-label>)

This goes to VISUAL-JOURNAL.md AND posts as a comment on the GH issue:

<composed block>
```

Then render the approval gate as an `AskUserQuestion` picker — `Finalize` (Recommended — commit this block to `VISUAL-JOURNAL.md` and post it as the issue comment) / `Adjust a section` (the user names which section to change — picking it opens a free-text follow-up; edit only that section inline and re-present the changed section, then re-render this picker) / `Cancel` (stop the approval transaction here). Each option's `description` carries the consequence. Frame `Finalize` as "commit this final form" — the block IS spec-grade content (the durable record of what was approved), not a draft to wordsmith in chat.

---

## Step 5: Update the journal + post summary comment

(Skip if Step 2 routed straight to Step 7.) Two direct steps, in order:

**5a. Write the journal entry** via the `journal-update` command. It reads a JSON handoff file and performs the `VISUAL-JOURNAL.md` entry merge for this ticket (write/replace latest-only), leaving the file MODIFIED in the working tree — not staged; ATTACH_DESIGN in the next step handles staging + commit. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — `summary` is the approved composed block from Step 4, the prose only, WITHOUT the `## #<ticket> — …` heading or trailing `**Bundle:**` line (the command adds those):

```json
[
  { "op": "UPDATE_JOURNAL", "ticket": <issue>, "domain": "<domain>", "screen": "<unit-label>", "date": "<YYYY-MM-DD>", "summary": "<the 15-20 line summary prose>" }
]
```

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" journal-update --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

Read its one-line stdout. **If it reports `✗`** (journal write or self-verify failed), stop — surface the error line and let the user resolve it before going further. Do NOT proceed to 5b: the journal file-write must succeed first.

**5b. Post the summary comment** via the `issue-transition` command. The journal file is the primary artifact; the comment is a chronological broadcast mirror (a NEW comment — never edits an existing one).

**Idempotency pre-check (resume safety).** Step 2's `review-resume-state` inspects only the domain file — it cannot tell whether a prior partial run already posted this comment (a run that reached 5b then failed at Step 6 leaves the domain file dirty, so the resume re-enters here). Before posting, check for an existing summary comment:

```bash
gh issue view <issue> --json comments --jq '[.comments[].body | select(startswith("**[UXUI]** Summary (approved"))] | length'
```

If the count is `1` or more, a prior run already posted the summary comment — **skip the rest of 5b** (do not write the handoff, do not run `issue-transition`) and proceed to Step 6. If the count is `0`, post it now.

**Write** the handoff file again (overwriting 5a's handoff — it's already been consumed) as a one-element array — the `comment` carries the `**[UXUI]** ` identity prefix and mirrors the journal summary:

```json
[
  { "op": "UPDATE_JOURNAL", "issue": <issue>, "comment": "**[UXUI]** Summary (approved <YYYY-MM-DD>):\n\n<summary>\n\nBundle: `cowmoo/design/bundles/<issue>/`" }
]
```

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

Read its one-line stdout — `UPDATE_JOURNAL #<n>: ✓ commented. Verified.` means done; `UPDATE_JOURNAL #<n>: ✗ <reason>` means the comment post failed. Do NOT retry on `✗` — the command already retried internally. **If 5b reports `✗`**, surface it but do NOT roll back the 5a journal write — the file entry is the primary artifact; the comment is a mirror. The partial state (file written, comment failed) is still worth surfacing before Step 6 — let the user decide whether to retry the comment or proceed.

---

## Step 6: Commit the attachment + journal

(Skip if Step 2 routed straight to Step 7.) Build the commit message `design(<domain>): attach bundle + journal for <unit-label> (ticket #<issue>)`, then run:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" commit attach-design <domain> "design(<domain>): attach bundle + journal for <unit-label> (ticket #<issue>)"
```

`commit` mode `attach-design` stages and commits up to three paths — `cowmoo/design/domains/<domain>.md` (Step 3), `cowmoo/design/VISUAL-JOURNAL.md` (Step 5a), and `cowmoo/agent-files/uxui/PENDING-CORRECTIONS.md` (the corrections / spec-divergence entries `/review-bundle` logged for this review) — together in one commit; its content-verify rejects anything else. It commits whichever of the three paths have changes; an idempotent re-run is fine.

Read the command's one-line stdout (it may emit a trailing `Note:` line):

**If the report begins with `ATTACH_DESIGN: ✗`** — the command refused (mid-merge state) or failed verification (commit contains paths outside the domain-file + VISUAL-JOURNAL.md shape). Surface the report verbatim and **stop** — do NOT run PUSH or APPROVE_DESIGN. The user resolves the underlying state (recovery command is in the report) then re-runs `/approve-design`.

**Guard:** if the command reports `ATTACH_DESIGN: Nothing to commit.` AND Step 2 reported `RESUME: none`, neither Step 3 nor Step 5a took effect. Stop here, investigate (was the screen heading found? did the `journal-update` command succeed?), and resolve before proceeding. Do NOT run APPROVE_DESIGN with an un-attached bundle — that would close the issue without recording the bundle reference.

**On `ATTACH_DESIGN: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface it.

Run `node "$AGENT_DIR/tools/dev-tools.cjs" push` so the bundle attachment + journal commit lands on the remote before APPROVE_DESIGN closes the issue. A `PUSH: ✗` is non-fatal — surface the error and continue. `push` reports `PUSH: skipped — …` if the project has no `origin` remote.

---

## Step 7: Approve and close

Via the `issue-transition` command. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — compose the approval comment with the `**[UXUI]** ` identity prefix:

```json
[
  {
    "op": "APPROVE_DESIGN",
    "issue": <issue>,
    "comment": "**[UXUI]** Approved: Bundle attached to cowmoo/design/domains/<domain>.md (cowmoo/design/bundles/<issue>/); journal entry + summary comment posted.",
    "removeLabel": "uxui:review",
    "addLabel": "uxui:done",
    "close": true
  }
]
```

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

The command runs comment → relabel → close in order, verifies each step, and syncs the board — flipping `uxui:review` → `uxui:done`, posting the approval comment, and closing the issue. Read its stdout — `APPROVE_DESIGN #<ticket>: ✓ …` means done; `APPROVE_DESIGN #<ticket>: ✗ <reason>` names what already succeeded. Do NOT retry on `✗`.

**Partial-commit recovery:** If Step 6 succeeded (domain file + journal committed; summary comment posted) but APPROVE_DESIGN fails (label flip or close errors out), the design artifacts are correct but the GitHub issue is still `uxui:review`. Re-run `/approve-design <issue> <domain> <screens>` — Step 2 will report `RESUME: found … porcelain=clean`, route straight here, and retry the close without re-fetching or re-evaluating the bundle. (Or manually relabel to `uxui:done` and close on GitHub.)

---

## Step 8: Optional — notify planner / align specs with PM

When a meaningful chunk of design work is complete (e.g., a coherent flow's screens are all `uxui:done`), two judgment-call follow-ups may apply — neither is automatic per task:

- **Notify planner** — announce the `cowmoo/design/` changes so planner can update affected task PRDs (`/notify planner`, a separate run).
- **Align specs with PM** — if `PENDING-CORRECTIONS.md` carries unchecked `For: PM` spec-divergence entries, the design has run ahead of the spec; dispatch them to PM with `/dispatch-corrections pm` (a separate run) so PM adopts the divergences into the specs. This is the alignment milestone — see `.claude/rules/corrections.md`.

Render the choice as an `AskUserQuestion` picker, building the options from what actually applies this run — e.g. `Notify planner`, `Align specs with PM` (offer only when `For: PM` divergence entries are queued), `Wait for more screens`. Recommend based on whether a coherent chunk is complete and whether divergences have accumulated. Each option leads to a separate skill invocation.

---

## Step 9: Report

```
## Approved — #<issue>

- Bundle attached to cowmoo/design/domains/<domain>.md
- Journal entry written; summary comment posted
- Issue flipped uxui:review → uxui:done and closed
[- Spec divergences applied + marked: <list>, logged to PENDING-CORRECTIONS.md For: PM]
[- Suggested /notify planner if a meaningful chunk landed]
[- Suggested /dispatch-corrections pm if For: PM divergences are queued]
```

Then render an `AskUserQuestion` hand-off picker for the next action — `Run /catchup` (Recommended — process any other pending items) first, any other live continuation (e.g. `Run /notify planner` when Step 8 indicated a meaningful chunk landed, `Run /dispatch-corrections pm` when `For: PM` spec divergences are queued), and `Done for now` last. Build the option set from where the conversation stands.

---

## Completion Checklist

- [ ] Step 1 — new roles committed + pushed (or skipped: none accepted)
- [ ] Step 2 — `review-resume-state` run; sub-case reported to the user
- [ ] Step 3 — domain file edited with the `**Bundle:**` line, plus any accepted spec-divergence definition updates + `**Spec divergence:**` markers (or skipped per Step 2)
- [ ] Step 4 — journal summary composed inline and approved by the user (or skipped per Step 2)
- [ ] Step 5 — `journal-update` wrote the entry; `issue-transition` UPDATE_JOURNAL posted the summary comment (or skipped per Step 2, or skipped by 5b's idempotency pre-check)
- [ ] Step 6 — `commit attach-design` committed domain file + journal; pushed (or skipped per Step 2)
- [ ] Step 7 — `issue-transition` APPROVE_DESIGN ran; issue is `uxui:done` and closed
- [ ] Step 8 — planner notification and PM spec-alignment dispatch considered via picker (judgment calls)
- [ ] Report shown
- [ ] Hand-off picker presented

---

## Rules

- **The user already approved.** This skill runs the transaction; it does not re-litigate the approve/reject decision — that happened in `/review-bundle`.
- **Re-invocation is safe.** Step 2's `review-resume-state` makes a resume idempotent — it skips whatever the prior run committed, and Step 5b's idempotency pre-check skips the summary comment if a prior run already posted it. Never run the commit sequence blind.
- **Never close with an un-attached bundle.** The Step 6 guard exists for this — APPROVE_DESIGN must not close an issue whose bundle was never recorded in the domain file.
- **Domain file edits stay scoped.** The Edit adds a `**Bundle:**` line below each covered screen's section — nothing else. Don't restructure the file.
- **One bundle per task.** If a screen is re-designed (rejected → resubmitted → re-reviewed → approved), the prior `**Bundle:**` line stays as history; the new one appends below it. The most recent line is the current canonical bundle. The bundle directory `cowmoo/design/bundles/<ticket>/` is per-ticket — a re-fetch overwrites it; prior bundles are preserved only via git history.
- **Journal summary is the durable record.** The 15–20 line summary from Step 4, persisted by `journal-update`, is the canonical record of what was approved. It lives latest-only in `cowmoo/design/VISUAL-JOURNAL.md` (replace-in-place on re-approval) AND as a comment on the GH issue (posted once per approval — Step 5b's pre-check keeps a resume from double-posting; never edited in place). `/design-start` reads the journal for visual-direction synthesis. Compose it with care.
- **Notifying planner is a judgment call, not automatic.**
