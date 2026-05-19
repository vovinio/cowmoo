---
name: design-start
description: Synthesize UI state and propose the next batch of design tasks (1-3 tasks). Phase B entry point. Conversational — nothing is written.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Bash, AskUserQuestion
---

# Design Start

Survey what's been designed, what's pending, and what visual direction has emerged. Lead the user with a concrete proposal for the next batch of design tasks — typically 1-3 screens that hang together with deliberate reasoning.

This is the **thinking** phase. Nothing gets written. The output is a shared understanding of what to draft next, captured in conversation. Run `/design-draft` after to compose the actual task bodies.

---

## Step 0: Verify UI definitions exist — bail if not

Phase B can't propose design tasks without UI definitions to draw from. Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `design-domains:` line — it reports the count of `*.md` files in `$PROJECT_DIR/cowmoo/design/domains/`.

**If `design-domains: 0`** — stop with:

```
No UI definitions found in cowmoo/design/domains/.

Phase B (design tasks) can only run after Phase A (UI definitions) has produced at least one domain. Run /start to begin Phase A discussion, then /draft → /define → /publish to write definitions, then come back here.
```

If `design-domains:` is 1 or more, proceed.

---

## Step 1: Read everything (synthesis pass)

Read in parallel where possible. Each of these sources contributes to "what's the right next batch":

**Source of truth — what we're building:**
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — product overview
- `$PROJECT_DIR/cowmoo/specs/domains/*.md` — per-domain business rules (every file)

**UI definitions — what the design surface covers:**
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — design intent, navigation
- `$PROJECT_DIR/cowmoo/design/journeys.md` — cross-domain user flows
- `$PROJECT_DIR/cowmoo/design/roles.md` — role vocabulary in use
- `$PROJECT_DIR/cowmoo/design/screen-index.md` — every screen, organized
- `$PROJECT_DIR/cowmoo/design/domains/*.md` — per-domain screen definitions

**What's been approved (the learning loop):**
- `$PROJECT_DIR/cowmoo/design/VISUAL-JOURNAL.md` (if exists) — one ~15-line entry per approved bundle: character, layout, state handling, roles established/used, patterns set up, deviations. This is the pre-digested source of "visual direction already established" — written at approval time by `/approve-design`.
- **Existing-design scan** — list `cowmoo/design/bundles/*/`; for each bundle, read its small `meta.json` and **list** its `project/` folder. This is the map of *what already has a design*. The `project/` listing is the truth about coverage — `meta.json`'s `screen` field names the *ticket*, not the scope; a bundle filed under one ticket is often a whole-project export (its `project/` may hold the whole app's screens, desktop + mobile). Do NOT read the full design files (`project/*.html`, `*.jsx`) here — a directory listing + `meta.json` is enough for the map, and reading every bundle's contents would blow the context budget as the project matures.
- If `VISUAL-JOURNAL.md` doesn't exist yet (project has no approved bundles, or you're mid-migration), treat as "no prior visual direction established — first batch will set direction."
- **Escape hatch:** if synthesis needs richer context on a specific prior bundle (e.g. exact token names from an earlier approval the journal summarized tersely), you MAY read that one bundle's `chats/*.md` directly — targeted, one bundle, not bulk. This mirrors the pattern in `/design-draft` Step 2.

**Current GitHub state (what's in flight):**
```bash
gh issue list --label "uxui:todo" --state open --json number,title --limit 50
gh issue list --label "uxui:review" --state open --json number,title --limit 50
gh issue list --label "uxui:done" --state closed --json number,title --limit 50
```

---

## Step 2: Form a synthesis (internal — no chat output)

After the reads, build a concise mental model. **Don't echo this back as a verification step** — the user invoked `/design-start` to GET your proposal, not to verify your reading. The synthesis becomes evidence inside the Step 3 proposal ("Inherits", "Why these together", "Why now").

Hold in context:

- **What's defined:** N screens across M domains (+ K cross-domain flows from journeys.md)
- **What's been approved:** N screens (closed `uxui:done`); their bundles
- **What's pending:** screens with UI defs but no bundle attached yet
- **What's in flight:** open `uxui:todo` (designer queue), `uxui:review` (waiting for review)
- **What already has a design:** the existing-design map from the Step 1 scan — which screens appear in some bundle's `project/`. A project that began with an imported design has most screens here from the start; their tasks will be `revise`, not `new`.
- **Spec-vs-design drift:** where the current specs contradict or outrun what an existing design shows — these are the candidates this batch addresses. Step 3 triages each.
- **Visual direction so far:** the character + patterns captured in `VISUAL-JOURNAL.md` (e.g., "warm earth tones, serif headers, dense layout, conversational voice; 8px default radius established; blur-validation UX"). For first session or when the journal is empty: "None yet — first design batch will set direction."

Step 3 surfaces the load-bearing parts of this synthesis as the proposal's evidence — no separate "present synthesis" chat step.

---

## Step 3: Triage the drift, propose the next batch

Every candidate this batch could address is a **spec-vs-design drift** — a place
the specs and the existing design (or its absence) disagree. Triage each into
one of three resolutions:

- **`new` task** — the screen appears in no bundle's `project/`. A from-scratch design unit.
- **`revise` task** — the screen has an existing design AND the design itself must change to match the spec. A change-task against the existing design — reuse and modify, never rebuild.
- **Def-edit — no designer task** — the existing design is fine; it is `cowmoo/design/**` that is stale. UXUI fixes the def itself through the Phase A `/draft`→`/define` loop. Surface these, but they are not design tasks.

Then propose **ONE coherent batch of 1-3 design _units_** (`new` and/or `revise`). A unit is one screen, or several **coupled** screens — one renders inside another, they share load-bearing chrome, or they are a tight flow whose consistency must be designed together. Don't force coupling on independent screens. For a whole-project import, lean toward **coarser units** (a coherent area) — the screens share one Claude Design project, so there is no parallelism to preserve by splitting.

The proposal answers, per unit: **What** (screen[s]) · **Mode** (`new`/`revise`) · **Why coupled** (multi-screen only) · **Why now** · **Inherits** · **Sets up** — and it lists the def-edits found, so the user sees the whole picture.

Pattern:

```
Proposed next batch: <name — short noun phrase>

Units:
- [<mode>] <screen(s)> — <one-line>          (multi-screen: + "coupled: <why>")
- [<mode>] <screen(s)> — <one-line>

Def-edits (fix in cowmoo/design/, no designer task):
- <screen> — <why the def, not the design, is stale>      (or "none")

Why now: <ordering rationale>
Inherits: <prior visual decisions, or "first batch — establishes direction">
Sets up: <what this batch establishes for downstream work>
```

After showing the proposal, render the decision as an `AskUserQuestion` picker:

- When the synthesis admits 2-4 genuinely different starting points (different value/risk profiles, different parts of the product), present each as an option — the recommended batch first with `(Recommended)`, descriptions stating what each batch gets you.
- Otherwise, the proposal above is the single recommendation: render a confirmation picker — `Accept this batch` (Recommended) / `Different angle` (the user wants a different set — picking it opens a free-text follow-up where they describe what to change). Each option's `description` carries the consequence.

---

## Step 4: Refine through conversation

User reacts: confirms, narrows, broadens, picks a different angle. Keep the conversation tight — agent reflects back the refined batch concisely after each adjustment.

When the batch is locked, summarize:

```
Locked next batch:
- Units: [list — each with [mode] and its screen(s)]
- Why coupled: [for any multi-screen unit]
- Def-edits routed to /define: [list, or "none"]
- Inherits: [visual direction]
```

Then render an `AskUserQuestion` hand-off picker for the next action — `Run /design-draft` (Recommended — compose the task bodies for the locked batch) first; when def-edits were found, `Run /draft` (begin fixing the stale `cowmoo/design/` items via the Phase A loop) as a live continuation; `Refine the batch further` if the user might still adjust; `Done for now` last. Build the option set from where the conversation actually stands.

---

## Step 5: Stop

Do NOT write any files. Do NOT touch GitHub. Do NOT compose task bodies. The user runs `/design-draft` next, and the locked batch carries forward in conversation.

---

## Completion Checklist

- [ ] All sources read (specs, design defs, VISUAL-JOURNAL.md, GH state) — no per-bundle reads by default
- [ ] Synthesis presented (concise — what's done, what's pending, visual direction)
- [ ] Drift triaged (new / revise / def-edit); one batch of units proposed with mode + reasoning (what / mode / why-coupled / why-now / inherits / sets-up)
- [ ] User confirmed or redirected via picker; batch locked
- [ ] Hand-off picker presented (`/design-draft` recommended)

---

## Rules

- **Synthesize first, propose second.** Reading is a substantial step — do it thoroughly. The proposal is only as good as the synthesis.
- **Lead, don't ask.** Propose ONE batch with reasoning. The user reacts. Don't open with "what should we work on?"
- **Small batches (1-3 units).** Bigger batches lose the iteration loop and dilute coherence. If the user wants more, they run `/design-start` again after the first batch ships.
- **Reuse existing designs.** A screen that already has a design gets a `revise` change-task — never a from-scratch brief. Triage every drift: a `new` task, a `revise` task, or a def-edit with no designer task at all. Reinventing an already-designed screen is the failure this triage exists to prevent.
- **Visual direction is specific, not vague.** Distill what `VISUAL-JOURNAL.md` records into concrete observations ("warm earth tones, serif headers, 8px base spacing"), not adjectives ("nice and warm").
- **Scan bundle structure, don't read bundle internals.** Step 1's existing-design scan *lists* `bundles/*/project/` and reads each small `meta.json` — that is the coverage map, and it is cheap. Reading bundle *internals* (`project/*.html`, `*.jsx`, `chats/*.md`) blows the context budget as the project matures; the `VISUAL-JOURNAL.md` is the purpose-built pre-digested summary for visual direction. Read a specific bundle's internals only when a narrow question genuinely needs it — and name why.
- **First batch is foundational.** When no prior bundles exist, say so explicitly. The first batch establishes patterns the rest of the product inherits — propose accordingly (entry-point screen, foundational flow).
- **Don't write anything.** This skill is purely conversational. The output is a locked batch in conversation context.
- **Don't propose work for screens without UI defs.** If a screen isn't in `cowmoo/design/domains/`, it can't be designed yet — Phase A needs to define it first. Recommend `/start` (Phase A) instead.
