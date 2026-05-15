---
name: import-design
description: Initiate spec work from an existing Claude Designer share URL — fetch the bundle to a temp dir, walk the screens, populate working notes, then hand the URL to UXUI for canonical capture.
user-invocable: true
argument-hint: <share-url>
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Agent
---

# Import Design

Use when the user already has a Claude Designer bundle and wants PM to extract specs from it. The bundle is read transiently — PM does not persist it. After extraction, the same share URL is handed to UXUI via a `for-uxui` GitHub issue so UXUI can fetch the bundle into `cowmoo/design/bundles/` for ongoing design work.

**Share URL:** $ARGUMENTS

This is an initiation skill — it can run before any other PM work. It populates working notes; formalization still happens via `/digest`.

---

## Step 1: Validate Argument

If `$ARGUMENTS` is empty or doesn't look like a Claude Design share URL (must contain `claude.ai/design/` or `api.anthropic.com/v1/design/`):

```
/import-design needs a Claude Designer share URL.
Example: /import-design https://claude.ai/design/abc123
```

Stop.

---

## Step 2: Ensure Project Exists

Check if `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` exists.

- **If missing** — create the project structure. Use the Write tool with the exact content shown for each file (newlines as written — no escape shorthand). This content matches what `moo init` produces, so all three creation paths stay byte-identical:

  1. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`:
     ```
     # Product

     Product overview, glossary, roles, target users, and key behaviors. Written via `/digest`.
     ```
  2. `$PROJECT_DIR/cowmoo/specs/domains/.gitkeep` — empty file (ensures the directory exists)
  3. `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`:
     ```
     # Working Notes

     Product discussion capture, decisions, and edge cases discovered during conversation.
     ```
  4. `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`:
     ```
     # Backlog

     Deferred items — from rough ideas to fully specified features. Each item notes why it was deferred and where it came from.
     ```
  5. `$PROJECT_DIR/cowmoo/agent-files/pm/RESEARCH.md`:
     ```
     # Research

     Accumulated research findings from `@research` agent sessions.
     ```
- **If exists** — read `WORKING-NOTES.md` and `cowmoo/specs/PRODUCT.md` to understand current state. The import will append.

---

## Step 3: Fetch the Bundle (transient)

Spawn `@pm-bundle-ops`:

```
@pm-bundle-ops FETCH_DESIGN url=<share-url>
```

The agent invokes `node tools/dev-tools.cjs design-fetch <url>`, which downloads the tarball and extracts it into `/tmp/pm-import-<timestamp>/`. No git commit, no project files. The bundle is transient — PM throws it away when this skill finishes.

**Result handling:**

- **Success** — agent reports `FETCH_DESIGN: ✓ path=<tmp-path> files=<N>`. Save the path in conversation; proceed to Step 4.
- **URL expired or unreachable** — agent reports `FETCH_DESIGN: ✗ URL expired or unreachable. Re-share required.`
  ```
  The share URL appears expired or unreachable. Re-share the bundle from
  Claude Designer and run /import-design again with the fresh URL.
  ```
  Stop.
- **Download timeout** — agent reports `FETCH_DESIGN: ✗ Download timed out (>60s).`
  ```
  Bundle download timed out (>60s). The URL is likely still valid — the
  bundle may be unusually large or the network slow. Retry /import-design
  with the same URL, or re-share if the issue persists.
  ```
  Stop.
- **Other failure** — agent reports `FETCH_DESIGN: ✗ <error>`. Surface the error and stop.

---

## Step 4: Read Source Material

Glob the temp path returned by Step 3 — typical Claude Designer bundles contain:

- `README*` — bundle-level summary if present
- `project/*.html` — rendered screens
- `chats/*.md` — designer-with-Claude conversation transcripts (often the richest source of intent)
- Any other `.md` or `.json` describing the design

Read every file completely. Build a mental map:

- What screens exist? What does each one show — entities visible, fields, actions, navigation?
- What states are implied (loading, empty, error, populated, dirty form, etc.)?
- What user flows tie screens together?
- What roles or permissions are implied (admin-only screens, owner-vs-viewer differences)?
- What does the chat transcript reveal about user intent or business rules that aren't visible in the rendered HTML?

---

## Step 5: Present Overview

Share a scannable overview before the walk-through. Keep the screens list verbatim (one line per screen — the screen-to-entity mapping IS the walk-through's whole point) but compress the narrative. Don't preview the full walk-through order; name only the first topic (dependency-rooted).

```
## Design Import Overview

Product (inferred): <one-sentence summary based on screens + chats>

Screens ([N]):
  • <Screen A> (project/screen-a.html) — <what it shows, who uses it>
  • <Screen B> (project/screen-b.html) — <...>

Implied entities: <Entity X (fields a/b/c); Entity Y (fields ...)>
Implied features: <Feature P (Screen A → B workflow); Feature Q (...)>
Implied roles: <admin, member, viewer | or "single role visible">

Ambiguities ([N]):
  • <contradiction | undefined-in-UI | unsupported-by-UI>: <specific item>

Starting with: <first topic> — foundational, others depend on it.
Different starting point?
```

**Misunderstanding check.** Screens list stays dense — don't drop a screen for compression; every screen is load-bearing. If the inferred entities / features / roles could equally describe a different product the user didn't intend, add a one-line `Key call:` naming the inferred product-defining decision (e.g., `Key call: multi-tenant SaaS inferred from workspace-switcher in <Screen X>`).

---

## Step 6: Guided Walk-Through

Walk through by **topic** (entity, feature, or screen group), not file-by-file. For each topic:

1. **Summarize** what the design shows: screen elements + what the chat transcript says about intent
2. **Infer the spec content** — entities (fields, types in business terms, relationships), features (who triggers, workflow steps, validations), states (per the canonical state vocabulary), edge cases
3. **Flag gaps** — what the design implies but doesn't pin down (e.g., "the design shows a 'Status' chip with 3 colors — what are the actual statuses and transitions?")
4. **Ask specific questions** — one or two at a time. Propose concrete answers per CLAUDE.md "Propose completions" rule; don't ask the user to fill from a blank. **When the question admits 2-4 meaningful resolutions with tradeoffs (e.g., contradictions between screen and chat — keep screen as truth / adopt chat-stated intent / merge), render the choice via `AskUserQuestion`, not as a prose `(a)/(b)/(c)` list.** Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff. Per CLAUDE.md's picker rule. Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.
5. **Wait for user answers** before moving on
6. **Append confirmed understanding** to `WORKING-NOTES.md` after each topic, tagged `[ready]` for confirmed items, `[future]` for explicitly deferred items, untagged for items still in discussion. Always note `Source: design import (<url>)` so provenance is preserved.

Agent leads — propose the next topic based on dependencies.

---

## Step 7: Coverage Check

After walking all topics, summarize what got captured and where the gaps are:

```
## Coverage Check

**Captured to working notes:**
- Entities: [N] inferred ([list]) — [N] [ready], [N] open
- Features: [N] inferred ([list]) — [N] [ready], [N] open
- Roles: [N] inferred ([list])
- States: [N] screens have all required states; [N] missing — [which]

**Gaps that block /digest:**
- [Specific question or undefined area]
- [...]

**Gaps that DON'T block /digest (can become open questions):**
- [...]
```

Propose: fill the blocking gaps now via more discussion, or accept the gaps as open questions and proceed to the hand-off step.

---

## Step 8: Hand the URL to UXUI

When the user is ready to wrap (gaps acceptable, walk-through complete), confirm the hand-off:

```
Ready to notify UXUI? This creates a for-uxui GitHub issue with the share URL
so when the user runs `moo uxui` next, the design import is in their inbox
and UXUI can fetch the bundle for canonical use.

Confirm or skip? (skip is fine if the user wants to handle this manually later)
```

On confirm, spawn `@pm-ops`:

```
@pm-ops CREATE_FOR_UXUI
  title=Design import: <short URL fragment or "initial design">
  body=
    **Design import — share URL handed off from PM**

    **URL:** <full-share-url>
    **Imported on:** <YYYY-MM-DD>

    PM ran /import-design against this URL to extract product specs into working notes (formalization pending /digest). The bundle was read transiently — it does NOT live in this repo yet.

    **Suggested next step (UXUI):** if you want a canonical design reference, fetch this URL into `cowmoo/design/bundles/` via your existing bundle-fetch tooling. Note: Claude Design share URLs may expire — if the fetch returns `url-unreachable`, re-share from the original Claude Designer session.

    **Working-notes extracts (pre-spec — not yet confirmed):**
    - Entities being captured: [list]
    - Features being captured: [list]
    - Roles inferred: [list]

    These are still in PM's working notes — formalization happens via /digest + /review + /publish. The /notify uxui announcement below is the canonical signal that specs exist.

    Once specs are formalized, PM will follow up with the standard /notify uxui announcement for spec changes — that's the signal to act on confirmed spec content.
```

On `CREATE_FOR_UXUI ✓`, note the issue number for the final report. On failure, surface the error — the working-notes content is already saved, so no rollback needed; just report that the hand-off issue couldn't be created and suggest the user retry manually.

If the user skipped the hand-off, write the URL to working notes under a `**Source URL (deferred handoff):**` heading so it isn't lost.

---

## Step 9: Final Report

```
## Import Complete

**Captured to working notes:**
- [N] [ready] items — formalize via /digest
- [N] [future] items — will move to backlog during /digest
- [N] open items — need more discussion

**Hand-off:**
- for-uxui issue #<N> created with the share URL  (or: deferred — URL saved in working notes)

**Next steps:**
- Run /tidy to organize imported notes (optional)
- Run /digest to formalize [ready] items into specs
- After /digest + /publish, run /notify uxui to announce the spec changes
- (User runs `moo uxui` later — UXUI sees the import issue and proposes capturing the bundle)
```

The temp directory at `/tmp/pm-import-<timestamp>/` is left for OS cleanup. If the session is interrupted before completion, the user re-runs `/import-design` with the same URL — there is nothing to recover.

---

## Rules

- **Read transiently — never write the bundle into project files.** PM's job is spec extraction, not bundle storage. UXUI owns persistent design artifacts.
- **Walk by topic, not by file** — a single entity is often visible in 3 screens and discussed in 2 chat transcripts. Group related content.
- **Propose, don't interrogate** — when a screen implies something ambiguous, suggest a concrete reading and ask the user to confirm or adjust. Never present a blank gap.
- **Preserve source context** — note which screen or chat each piece of inferred spec came from, plus the share URL, so future digestion can verify.
- **Use the tagging system** — `[ready]` confirmed, `[future]` deferred, untagged still open.
- **Respect scope** — if the design implies database schema, API design, or component code, note their existence but don't import them. PM owns business-level entities and features only.
- **Single hand-off** — only one for-uxui issue per import. If the user runs /import-design twice with different URLs, that's two separate handoffs; that's fine.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Share URL validated; bundle fetched transiently
- [ ] All bundle files read (HTML screens + chat transcripts + any docs)
- [ ] Overview presented with screens, implied entities/features/roles, observations
- [ ] Topics walked through in dependency order
- [ ] Each topic: items classified, questions asked, understanding appended to notes
- [ ] Coverage check presented
- [ ] Hand-off issue created (or URL saved to notes if user skipped)
- [ ] Final report presented with item counts and next steps
