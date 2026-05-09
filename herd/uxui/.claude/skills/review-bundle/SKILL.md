---
name: review-bundle
description: Review a designer's Claude Design submission for a uxui:review task — fetch bundle, evaluate, approve or reject.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Agent
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

Spawn `@uxui-bundle-ops`:

```
@uxui-bundle-ops FETCH_BUNDLE
  ticket=<issue>
  url=<url>
  domain=<domain>
  screen=<screen>
  designer=<designer>
```

The agent invokes `node tools/dev-tools.cjs bundle-fetch ...`, which downloads the tarball, extracts it into `cowmoo/design/bundles/<issue>/`, writes `meta.json`, and commits.

**If FETCH_BUNDLE fails (URL expired):**

The agent reports back exactly: `FETCH_BUNDLE: ✗ URL expired or unreachable. Designer must re-share.`

Spawn `@uxui-gh-ops` to comment on the issue asking the designer for a fresh URL:

```
@uxui-gh-ops POST_COMMENT
  issue=<issue>
  text=The Claude Design share URL appears to have expired. Please re-share from your Claude Design session and post the new URL on this issue.
```

Stop. The designer will re-share and the cycle resumes.

**If FETCH_BUNDLE fails with a download timeout:**

The agent reports back exactly: `FETCH_BUNDLE: ✗ Download timed out (>60s). Bundle may be large or network slow.`

The URL itself is likely still valid — a re-share would not help. Spawn `@uxui-gh-ops` to comment on the issue:

```
@uxui-gh-ops POST_COMMENT
  issue=<issue>
  text=The Claude Design bundle download timed out (>60s). The URL itself is likely still valid — this is usually a large bundle or a slow network. Please either (a) retry by re-posting the same URL on this issue (we'll attempt another fetch), or (b) if this persists, re-share from Claude Design in case the export was unusually large.
```

Stop. The designer may retry or re-share.

**If FETCH_BUNDLE returns any other `✗` FAIL line** (e.g., `extraction-failed`, `extraction-empty`, `meta-write`, `git-add`, `git-commit`, `no-project-dir`):

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

1. **If ROLE_ADDITIONS were accepted** — discuss role names with user, then Edit `cowmoo/design/roles.md` to add them. Run `@uxui-git-ops COMMIT_ROLES` with `roles: add <role names>` message. (COMMIT_ROLES stages only `roles.md` — unrelated pending UXUI-territory changes are not swept into the roles commit.)

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

   Present the composed block to the user for approval:

   ```
   ## Summary for journal — #<issue> (<domain>/<screen>)

   <composed block>

   Approve, or adjust before journaling?
   ```

   Iterate inline with the user until approved. This is the final content that will (a) live in `cowmoo/design/VISUAL-JOURNAL.md` and (b) be posted as a summary comment on the GitHub issue — so treat it as the durable record of what was approved.

5. **Update the journal + post summary comment** via `@uxui-journal-ops`:

   ```
   @uxui-journal-ops UPDATE_JOURNAL
     ticket=<issue>
     domain=<domain>
     screen=<screen>
     approval-date=<YYYY-MM-DD>
     summary-text=<the approved composed block from step 4, WITHOUT the "## #<ticket> — ..." heading or trailing **Bundle:** line — the op adds those>
   ```

   The op (a) writes/replaces the entry for this ticket in `cowmoo/design/VISUAL-JOURNAL.md`, (b) posts the same summary as a new comment on the GH issue (prefixed `**[UXUI]** Summary (approved <date>):`), and (c) leaves the journal file MODIFIED in the working tree (not staged — ATTACH_DESIGN in the next step handles the staging + commit). It does NOT commit.

   **If UPDATE_JOURNAL reports any failure** (journal write self-verify fails, or the gh comment post fails), stop. Surface the op's error line to the user and let them resolve it before proceeding to ATTACH_DESIGN. The file and comment are independent artifacts — a partial success (file written, comment failed) is still a degraded state worth surfacing before committing.

6. **Commit the attachment + journal** via `@uxui-git-ops`:

   ```
   @uxui-git-ops ATTACH_DESIGN
     domain=<domain>
     ticket=<issue>
     screen=<screen>
   ```

   ATTACH_DESIGN now stages BOTH the domain file (from step 3) and the journal file (from step 5) and commits them together in one message.

   **Guard:** if the op reports `ATTACH_DESIGN: Nothing to commit — domain file and journal unchanged` AND step 2 did not detect a pre-existing attachment, neither step 3 nor step 5 took effect. Stop here, investigate (was the screen heading found? did UPDATE_JOURNAL succeed?), and resolve before proceeding. Do NOT run APPROVE_DESIGN with an un-attached bundle — that would close the issue without recording the bundle reference.

7. **Approve and close** via `@uxui-gh-ops`:

   ```
   @uxui-gh-ops APPROVE_DESIGN
     ticket=<issue>
     summary=Bundle attached to cowmoo/design/domains/<domain>.md (cowmoo/design/bundles/<issue>/); journal entry + summary comment posted.
   ```

   This op flips `uxui:review` → `uxui:done`, posts the approval comment, and closes the issue.

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

2. **Send via `@uxui-gh-ops`:**

   ```
   @uxui-gh-ops REJECT_DESIGN
     ticket=<issue>
     feedback=<composed feedback text>
   ```

   The op posts the comment, removes `uxui:review`, adds `uxui:todo`. Designer iterates.

   **Partial-failure recovery:** REJECT_DESIGN is composite (comment + relabel). If the comment posted but relabel failed, the feedback is visible to the designer but the issue still reads as `uxui:review`. Tell the user explicitly and offer: (a) re-run `@uxui-gh-ops REJECT_DESIGN` (the comment will double-post — undesirable but recoverable), (b) manually flip labels on GitHub (remove `uxui:review`, add `uxui:todo`). If relabel worked but comment failed, tell the user the designer will see the label change without guidance — suggest re-running with just `POST_COMMENT` to add the missing feedback.

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
- [ ] Bundle fetched and committed via `@uxui-bundle-ops FETCH_BUNDLE`
- [ ] `@design-evaluator` ran; findings classified
- [ ] User triaged findings and chose approve/reject
- [ ] (Approve) Step 6a.2 pre-Edit check run; sub-case reported to user if prior partial run detected
- [ ] (Approve) Domain file edited (or skipped per pre-check)
- [ ] (Approve) Summary composed inline and approved by user (or skipped per pre-check)
- [ ] (Approve) `@uxui-journal-ops UPDATE_JOURNAL` ran (journal entry written + summary comment posted) (or skipped per pre-check)
- [ ] (Approve) `@uxui-git-ops ATTACH_DESIGN` committed domain file + journal in one commit (or skipped per pre-check)
- [ ] (Approve) `@uxui-gh-ops APPROVE_DESIGN` ran; issue is now `uxui:done` and closed
- [ ] (Approve) Planner notification considered (judgment call)
- [ ] (Reject) `REJECT_DESIGN` ran with composed feedback
- [ ] Report shown

---

## Rules

- **Verify the label first.** Don't run on issues that aren't `uxui:review`. Stop with a clear message.
- **Don't fabricate URLs.** If no share URL is present in the issue comments, ask for one — don't guess or fall back.
- **Bundle is read-only.** Never edit files inside `cowmoo/design/bundles/` — the bundle is captured evidence of what was approved.
- **Domain file edits stay scoped.** The Edit you make adds one `**Bundle:**` line below the screen's Interactions. Don't restructure the file.
- **One bundle per task.** If a screen is re-designed (rejected → resubmitted → re-reviewed → approved), the prior `**Bundle:**` line in the domain file stays as history; the new one appends below it. The most recent line is the current canonical bundle. **Note:** the bundle directory at `cowmoo/design/bundles/<ticket>/` is scoped per-ticket — if the same ticket is re-fetched after rejection-and-resubmission (rare), `@uxui-bundle-ops FETCH_BUNDLE` overwrites the existing dir. If you need to preserve the prior bundle, the ticket should be closed and a new one created instead of reusing. This is why reject paths flip back to `uxui:todo` (same ticket, new bundle) rather than creating a fresh ticket — we deliberately overwrite during iteration, preserve only via git history (which captures each FETCH_BUNDLE commit).
- **Notifying planner is a judgment call, not automatic.** When a meaningful chunk of related screens reach `uxui:done`, suggest `/notify planner` — but never run it without user confirmation.
- **Use `@design-evaluator` always.** Even if you're confident the bundle is fine, run the evaluator. It catches things you'd miss.
- **Journal summary is the durable record.** The 15–20 line summary composed in step 6a.4 and persisted by `@uxui-journal-ops` is the canonical record of what was approved. It lives latest-only in `cowmoo/design/VISUAL-JOURNAL.md` (replace-in-place on re-approval) AND as a new comment on the GH issue (chronological — never edit, always post anew). The journal is what `/design-start` reads for visual-direction synthesis; the bundle internals are for `@design-evaluator` at review time (designer/human reference otherwise — they are not consumed by the build chain). Compose it with care.
