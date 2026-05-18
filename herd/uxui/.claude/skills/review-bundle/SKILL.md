---
name: review-bundle
description: Review a designer's Claude Design submission for a uxui:review task — fetch bundle, evaluate, approve or reject.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Agent, Write
---

# Review Bundle

Process a designer's `uxui:review` submission: fetch the bundle from the share URL, evaluate it mechanically, then approve or reject with the user.

This skill is invoked two ways:
- **Via `/catchup`** — when the inbox shows `uxui:review` items
- **Directly** — `/review-bundle <issue>` to re-trigger review on a specific task

---

## Step 1: Load the issue

Take the issue number from the user (or from `/catchup`'s dispatch). Verify state:

```bash
gh issue view <issue> --json number,title,labels,body,comments \
  --jq '{number, title, labels: [.labels[].name], body, comments}'
```

Required:
- Label `uxui:review` is present
- A comment exists with a Claude Design share URL (typically `https://api.anthropic.com/v1/design/h/...` or `https://claude.ai/design/...`)

If `uxui:review` not present:
```
Issue #<N> doesn't have uxui:review label. Nothing to review.
```
Stop.

If no share URL in issue comments:
```
Issue #<N> has uxui:review label but no Claude Design URL in comments.
Designer needs to add the share URL.
```
Stop. Do not proceed.

---

## Step 2: Extract URL and identify domain/screen

From the issue:
- `<url>` — the share URL from the **last** comment whose body contains a Claude Design share URL (`https://api.anthropic.com/v1/design/h/` or `https://claude.ai/design/`). Scan all comments; if multiple comments contain share URLs (e.g. after an expired-URL re-share), the most recent wins.
- `<domain>` — extracted from issue title (titles follow `[UXUI] <domain>: <screen>`)
- `<screen>` — extracted from issue title
- `<designer>` — comment author who posted the URL

If the title doesn't match the expected pattern, ask the user to provide domain and screen explicitly.

---

## Step 3: Fetch the bundle

Run the `bundle-fetch` command directly — quote the URL (share URLs contain `?` and `&` that the shell would otherwise interpret); pass `-` for `<designer>` if the handle is unknown:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" bundle-fetch <issue> <domain> <screen> <designer> "<url>"
```

The command downloads the tarball (60s timeout), extracts it into `cowmoo/design/bundles/<issue>/` (`--strip-components=1`), writes `meta.json`, and `git add` + `git commit`s. It prints exactly one line and sets an exit code: `OK ticket=N files=M commit=<hash> path=<relpath>` on success, or a `FAIL <kind> — …` line otherwise (`url-unreachable`, `url-timeout`, `extraction-failed`, `extraction-empty`, `git-add`, `git-commit`, `meta-write`, `no-project-dir`).

**If the command reports `FAIL url-unreachable` (URL expired or unreachable):**

The `POST_COMMENT` op posts its comment via the `issue-transition` command, which reads the comment from a JSON handoff file. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — compose the comment with the `**[UXUI]** ` identity prefix:

```json
[
  { "op": "POST_COMMENT", "issue": <issue>, "comment": "**[UXUI]** The Claude Design share URL appears to have expired. Please re-share from your Claude Design session and post the new URL on this issue." }
]
```

Then run the command at `--index 0`, asking the designer for a fresh URL:

```bash
node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
```

Read its stdout — `POST_COMMENT #<n>: ✓ commented. Verified.` means done; `POST_COMMENT #<n>: ✗ <reason>` means the post failed. Stop. The designer will re-share and the cycle resumes.

**If the command reports `FAIL url-timeout` (download timed out):**

The URL itself is likely still valid — a re-share would not help. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (overwritten per use) — comment composed with the `**[UXUI]** ` identity prefix:

```json
[
  { "op": "POST_COMMENT", "issue": <issue>, "comment": "**[UXUI]** The Claude Design bundle download timed out (>60s). The URL itself is likely still valid — this is usually a large bundle or a slow network. Please either (a) retry by re-posting the same URL on this issue (we'll attempt another fetch), or (b) if this persists, re-share from Claude Design in case the export was unusually large." }
]
```

Then run `node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0`. Stop. The designer may retry or re-share.

**If `bundle-fetch` returns any other `FAIL` line** (e.g., `extraction-failed`, `extraction-empty`, `meta-write`, `git-add`, `git-commit`, `no-project-dir`):

Surface the raw error line to the user and stop. Do NOT proceed to Step 4 — either the bundle directory was cleaned up by the script (extraction / meta-write / no-project-dir) and `@design-evaluator` has nothing to read, or the bundle is uncommitted (git-add / git-commit) and ATTACH_DESIGN in Step 6a will either race or no-op later. These failure modes require manual intervention (check disk space, git hooks, signing config, lock files) before the review can resume.

---

## Step 4: Evaluate the bundle

Spawn `@design-evaluator`:

```
@design-evaluator
  ticket=<issue>
  domain=<domain>
  screen=<screen>
  bundle-path=$PROJECT_DIR/cowmoo/design/bundles/<issue>/
```

The sub-agent reads the brief, specs, domain UI def, roles, and the bundle. Returns classified findings: GAPS, CONCERNS, OBSERVATIONS, ROLE_ADDITIONS — plus a recommendation (APPROVE or RETURN).

---

## Step 5: Triage findings with the user

Present the evaluator's findings. Lead with the recommendation:

```
## Bundle review — #<issue> (<domain>: <screen>)

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

Discuss with the user. The user makes the final call: approve, return for revision, or address ROLE_ADDITIONS first by updating roles.md.

When the user has 2-4 distinct routes (e.g. "approve as-is", "approve and add new role", "return for X"), use the `AskUserQuestion` tool.

---

## Step 6a: Approval path

If the user approves:

1. **If ROLE_ADDITIONS were accepted** — discuss role names with user, then Edit `cowmoo/design/roles.md` to add them. Run the `commit roles` command with a `roles: add <role names>` message — `commit` mode `roles` is strictly scoped to `cowmoo/design/roles.md`, so unrelated pending UXUI-territory changes are not swept into the roles commit. Use a single-quoted heredoc so the message is not mangled by the shell:

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" commit roles "$(cat <<'EOF'
   roles: add <role names>
   EOF
   )"
   ```

   Read the command's one-line stdout (it may emit a trailing `Note:` line):

   **If the report begins with `COMMIT_ROLES: ✗`** — the command refused (mid-merge state) or failed verification (commit contains paths other than `roles.md`). Surface the report verbatim and **stop the approval flow** — do NOT proceed to step 2. The user resolves the underlying state then re-runs `/review-bundle`.

   **On `COMMIT_ROLES: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface it. (`COMMIT_ROLES: Nothing to commit.` means `roles.md` was unchanged — also fine to proceed.)

   Then run `node "$AGENT_DIR/tools/dev-tools.cjs" push` to publish the roles commit. A `PUSH: ✗` is non-fatal — the local commit is intact; surface the error and continue with the next steps. `push` reports `PUSH: skipped — …` if the project has no `origin` remote.

2. **Check for a prior partial run** — detect whether a previous invocation on this same ticket already attached a bundle line. Only runs on re-invocation; first-time runs fall through the "no prior attachment" branch immediately and proceed to step 3.

   a. Grep the whole domain file for a Bundle line scoped to this ticket:

      ```bash
      grep -nF '`cowmoo/design/bundles/<issue>/`' "$PROJECT_DIR/cowmoo/design/domains/<domain>.md" || true
      ```

   b. Check the domain file's working-tree state:

      ```bash
      git -C "$PROJECT_DIR" status --porcelain -- cowmoo/design/domains/<domain>.md
      ```

   Branch on the combined outputs:

   - **Grep empty (no prior Bundle line for this ticket)** — normal path. Proceed to step 3.

   - **Grep finds a match, but NOT under the currently matched screen heading** (line is under a different `### ` section, or between sections) — misattribution risk. Stop and ask the user: "A prior partial run left a Bundle line for this ticket at line N, under a different screen heading. Confirm whether to (a) move it under the correct screen, (b) leave it as-is and proceed, or (c) investigate manually." Do NOT auto-fix — matches the existing misattribution guard in step 3.

   - **Grep finds the line under the correct screen heading + porcelain output is any non-empty line** (staged `M `, unstaged ` M`, both `MM`, or `A ` — all mean "ATTACH didn't finish") — prior Edit uncommitted. Skip step 3 (Edit). Proceed to steps 4 (compose summary), 5 (UPDATE_JOURNAL), and 6 (ATTACH_DESIGN), which will commit the orphan Edit together with the journal update. If the porcelain diff shows content BEYOND a single Bundle-line append (e.g., the user hand-edited other parts of the domain file), tell the user what else is changing and confirm before running ATTACH_DESIGN. Note: re-running steps 4–5 on a partial-failure resume may post a duplicate summary comment on the issue — acceptable cost for keeping recovery simple; the more recent comment is canonical.

   - **Grep finds the line under the correct screen heading + porcelain output is empty** (line already committed) — prior ATTACH succeeded, APPROVE_DESIGN never ran. Skip steps 3 (Edit), 4 (compose summary), 5 (UPDATE_JOURNAL), and 6 (ATTACH_DESIGN) — all prior work is already committed (including the journal entry) and the summary comment is already posted. Proceed directly to step 7 (APPROVE_DESIGN).

   Tell the user explicitly which sub-case was detected before continuing.

3. **Edit the domain file** to attach the bundle reference (only if step 2 did not branch):

   Read `$PROJECT_DIR/cowmoo/design/domains/<domain>.md`, find the `### <Screen Name>` heading that matches the issue title's screen name, and append the `**Bundle:**` line at the END of that screen's section — just before the next `### ` heading (or end of file). This is resilient to screens that lack an "Interactions" subsection. Format:

   ```
   **Bundle:** `cowmoo/design/bundles/<issue>/` (approved YYYY-MM-DD, ticket #<issue>)
   ```

   If the screen heading cannot be located (title drift: casing, hyphenation, or the screen was renamed), stop and ask the user to confirm the canonical screen heading. Do NOT append the Bundle line to a different screen — the ATTACH_DESIGN guard would commit a misattribution.

4. **Compose the journal summary inline** (only if step 2 did not branch to APPROVE_DESIGN).

   Drawing on the full conversation context — the `@design-evaluator` findings, the user's triage decisions, and any role additions discussed in step 1 — compose a 15–20 line summary block for this bundle. The goal is a coherent interpretation of what was approved, rich enough that `/design-start` can synthesize "visual direction already established" from it without re-reading the bundle.

   Include these sections (omit any that are genuinely empty for the bundle under review):

   - **Character:** palette + typography + spacing density + voice. 2–4 sentences. Cite roles the bundle reinforces (e.g. "mid-brown `primary-action`, cream `surface-base`"). Voice expressed as concrete sample sentences, not adjectives.
   - **Layout:** high-level structure for this screen — column count, max-width, where primary/secondary actions sit, label positioning.
   - **State handling:** how the declared states render — validation timing, error display, loading affordances. Ground in the vocabulary from `.claude/rules/ui-vocabulary.md`.
   - **Roles established:** any NEW roles this bundle introduced (that were added to `roles.md` via step 1's COMMIT_ROLES). List them; if none, say "none new in this bundle."
   - **Roles used:** the roles referenced on this screen (from the domain-file "Roles Used" section).
   - **Patterns set up for downstream screens:** reusable decisions this bundle establishes for later work (e.g. "8px as default border-radius", "serif headers / sans body pairing").
   - **Deviations / open items:** anything the evaluator flagged as `CONCERN` or `OBSERVATION` that was accepted with rationale.

   Present the composed block as a durable-record preview, not a draft for chat-review:

   ```
   ## Journal entry preview — #<issue> (<domain>/<screen>)

   This goes to VISUAL-JOURNAL.md AND posts as a comment on the GH issue:

   <composed block>

   → Approve to finalize, or name a section to adjust?
   ```

   Frame the approval as "commit this final form?" — the block IS spec-grade content (the durable record of what was approved), not a draft you're asking the user to wordsmith in chat. On adjust, edit only the named section inline and re-present the changed section, not the whole block.

5. **Update the journal + post summary comment** — two direct steps, in order:

   **5a. Write the journal entry** via the `journal-update` command. It reads a JSON handoff file and performs the `VISUAL-JOURNAL.md` entry merge for this ticket (write/replace latest-only), leaving the file MODIFIED in the working tree — not staged; ATTACH_DESIGN in the next step handles staging + commit. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (a single reused path, overwritten each use) — `summary` is the approved composed block from step 4, the prose only, WITHOUT the `## #<ticket> — …` heading or trailing `**Bundle:**` line (the command adds those):

   ```json
   [
     { "op": "UPDATE_JOURNAL", "ticket": <issue>, "domain": "<domain>", "screen": "<screen>", "date": "<YYYY-MM-DD>", "summary": "<the 15-20 line summary prose>" }
   ]
   ```

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" journal-update --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
   ```

   Read its one-line stdout. **If it reports `✗`** (journal write or self-verify failed), stop — surface the error line to the user and let them resolve it before going further. Do NOT proceed to 5b: the journal file-write must succeed first.

   **5b. Post the summary comment** via the `issue-transition` command. The journal file is the primary artifact; the comment is a chronological broadcast mirror (always a NEW comment — never edits an existing one). **Write** the handoff file again (overwriting 5a's handoff — it's already been consumed) as a one-element array — the `comment` carries the `**[UXUI]** ` identity prefix and mirrors the journal summary:

   ```json
   [
     { "op": "UPDATE_JOURNAL", "issue": <issue>, "comment": "**[UXUI]** Summary (approved <YYYY-MM-DD>):\n\n<summary>\n\nBundle: `cowmoo/design/bundles/<issue>/`" }
   ]
   ```

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" issue-transition --from cowmoo/agent-files/uxui/.op-handoff.json --index 0
   ```

   Read its one-line stdout — `UPDATE_JOURNAL #<n>: ✓ commented. Verified.` means done; `UPDATE_JOURNAL #<n>: ✗ <reason>` means the comment post failed. Do NOT retry on `✗` — the command already retried internally. **If 5b reports `✗`**, surface it but do NOT roll back the 5a journal write — the file entry is the primary artifact; the comment is a mirror. The partial state (file written, comment failed) is still worth surfacing to the user before ATTACH_DESIGN — let them decide whether to retry the comment or proceed.

6. **Commit the attachment + journal** via the `commit attach-design` command. Build the commit message `design(<domain>): attach bundle + journal for <screen> (ticket #<issue>)`, then run:

   ```bash
   node "$AGENT_DIR/tools/dev-tools.cjs" commit attach-design <domain> "design(<domain>): attach bundle + journal for <screen> (ticket #<issue>)"
   ```

   `commit` mode `attach-design` stages and commits exactly two paths — `cowmoo/design/domains/<domain>.md` (from step 3) and `cowmoo/design/VISUAL-JOURNAL.md` (from step 5a) — together in one commit; its content-verify rejects anything else. If only one of the two paths has changes it commits that one; an idempotent re-run is fine.

   Read the command's one-line stdout (it may emit a trailing `Note:` line):

   **If the report begins with `ATTACH_DESIGN: ✗`** — the command refused (mid-merge state) or failed verification (commit contains paths outside the domain-file + VISUAL-JOURNAL.md shape). Surface the report verbatim and **stop the approval flow** — do NOT run PUSH or APPROVE_DESIGN. The user resolves the underlying state (recovery command is in the report) then re-runs `/review-bundle`.

   **Guard:** if the command reports `ATTACH_DESIGN: Nothing to commit.` AND step 2 did not detect a pre-existing attachment, neither step 3 nor step 5a took effect. Stop here, investigate (was the screen heading found? did the `journal-update` command succeed?), and resolve before proceeding. Do NOT run APPROVE_DESIGN with an un-attached bundle — that would close the issue without recording the bundle reference.

   **On `ATTACH_DESIGN: ✓`** — proceed. If the success report includes a `Note:` line about pre-existing foreign staged content, surface it.

   Run `node "$AGENT_DIR/tools/dev-tools.cjs" push` so the bundle attachment + journal commit lands on the remote before APPROVE_DESIGN closes the issue. A `PUSH: ✗` is non-fatal — surface the error and continue. `push` reports `PUSH: skipped — …` if the project has no `origin` remote.

7. **Approve and close** via the `issue-transition` command. It reads its parameters from a JSON handoff file. **Write** a one-element array to `$PROJECT_DIR/cowmoo/agent-files/uxui/.op-handoff.json` (overwriting step 5b's handoff — it's already been consumed, so the two never collide) — compose the approval comment with the `**[UXUI]** ` identity prefix:

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

   **Partial-commit recovery:** If ATTACH_DESIGN succeeded (domain file + journal committed; summary comment already posted by UPDATE_JOURNAL) but APPROVE_DESIGN fails (label flip or close errors out), the design artifacts are correct but the GitHub issue is still `uxui:review`. Options: (a) re-run `/review-bundle <issue>` — step 2 of the approval path will detect the already-committed attachment and route straight to APPROVE_DESIGN (skipping steps 3–6), or (b) manually relabel the issue to `uxui:done` and close it on GitHub.

8. **Optional: notify planner.** When a meaningful chunk of design work is complete (e.g., a coherent flow's screens are all `uxui:done`), the user may want to announce to planner. This is judgment — not automatic per-task. Prompt:

   ```
   This was approval N for <domain>/<related batch>. Notify planner now,
   or wait for more screens to land?
   ```

   On "notify now": suggest running `/notify planner` (existing skill, separate run).

---

## Step 6b: Reject path

If the user wants to return for revision:

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

## Step 7: Report

Approval:
```
## Approved — #<issue>

- Bundle attached to cowmoo/design/domains/<domain>.md
- Issue closed
- Approved tasks today: <count>
[- Suggested /notify planner if a meaningful chunk landed]
```

Rejection:
```
## Returned — #<issue>

- Feedback posted
- Label flipped: uxui:review → uxui:todo
- Designer will iterate
```

**Next:** Run `/catchup` to process any other pending items, or wait for the designer's next submission.

---

## Completion Checklist

- [ ] Issue loaded; `uxui:review` label confirmed; URL extracted
- [ ] Bundle fetched and committed via the `bundle-fetch` command
- [ ] `@design-evaluator` ran; findings classified
- [ ] User triaged findings and chose approve/reject
- [ ] (Approve) Step 6a.2 pre-Edit check run; sub-case reported to user if prior partial run detected
- [ ] (Approve) Domain file edited (or skipped per pre-check)
- [ ] (Approve) Summary composed inline and approved by user (or skipped per pre-check)
- [ ] (Approve) `journal-update` wrote the journal entry + `issue-transition` UPDATE_JOURNAL posted the summary comment (or skipped per pre-check)
- [ ] (Approve) `commit attach-design` committed domain file + journal in one commit (or skipped per pre-check)
- [ ] (Approve) `issue-transition` APPROVE_DESIGN ran; issue is now `uxui:done` and closed
- [ ] (Approve) Planner notification considered (judgment call)
- [ ] (Reject) `REJECT_DESIGN` ran with composed feedback
- [ ] Report shown

---

## Rules

- **Verify the label first.** Don't run on issues that aren't `uxui:review`. Stop with a clear message.
- **Don't fabricate URLs.** If no share URL is present in the issue comments, ask for one — don't guess or fall back.
- **Bundle is read-only.** Never edit files inside `cowmoo/design/bundles/` — the bundle is captured evidence of what was approved.
- **Domain file edits stay scoped.** The Edit you make adds one `**Bundle:**` line below the screen's Interactions. Don't restructure the file.
- **One bundle per task.** If a screen is re-designed (rejected → resubmitted → re-reviewed → approved), the prior `**Bundle:**` line in the domain file stays as history; the new one appends below it. The most recent line is the current canonical bundle. **Note:** the bundle directory at `cowmoo/design/bundles/<ticket>/` is scoped per-ticket — if the same ticket is re-fetched after rejection-and-resubmission (rare), the `bundle-fetch` command overwrites the existing dir. If you need to preserve the prior bundle, the ticket should be closed and a new one created instead of reusing. This is why reject paths flip back to `uxui:todo` (same ticket, new bundle) rather than creating a fresh ticket — we deliberately overwrite during iteration, preserve only via git history (which captures each FETCH_BUNDLE commit).
- **Notifying planner is a judgment call, not automatic.** When a meaningful chunk of related screens reach `uxui:done`, suggest `/notify planner` — but never run it without user confirmation.
- **Use `@design-evaluator` always.** Even if you're confident the bundle is fine, run the evaluator. It catches things you'd miss.
- **Journal summary is the durable record.** The 15–20 line summary composed in step 6a.4 and persisted by the `journal-update` command is the canonical record of what was approved. It lives latest-only in `cowmoo/design/VISUAL-JOURNAL.md` (replace-in-place on re-approval) AND as a new comment on the GH issue (chronological — never edit, always post anew). The journal is what `/design-start` reads for visual-direction synthesis; the bundle internals are for `@design-evaluator` at review time (designer/human reference otherwise — they are not consumed by the build chain). Compose it with care.
