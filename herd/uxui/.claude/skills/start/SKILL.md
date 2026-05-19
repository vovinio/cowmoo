---
name: start
description: Load specs, assess what UI work is needed, propose session focus. Entry point for every UXUI session.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Bash, AskUserQuestion
---

# Start

Load all context, understand what UI work exists and what's needed, propose what to do next.

---

## Step 0: Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the output.

- **If `working-notes: not found`** — tell the user: "No project initialized at $PROJECT_DIR. Initialize first, then return to /start." and stop.
- **If `spec-domains: 0`** — tell the user: "No specs found in cowmoo/specs/domains/. PM needs to produce specs before UXUI can define UI. Run PM first." and stop.

---

## Step 1: Load Context

Read all of these:

1. `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — product overview, roles, glossary
2. All files in `$PROJECT_DIR/cowmoo/specs/domains/` — entity and feature specs
3. `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — design intent + navigation + pointers (if exists)
4. `$PROJECT_DIR/cowmoo/design/journeys.md` — end-to-end user arcs (if exists)
5. `$PROJECT_DIR/cowmoo/design/roles.md` — role vocabulary domain files reference (if exists)
6. `$PROJECT_DIR/cowmoo/design/screen-index.md` — master screen list (if exists)
7. All files in `$PROJECT_DIR/cowmoo/design/domains/` — existing screen definitions (if any exist)
8. `$PROJECT_DIR/cowmoo/agent-files/uxui/WORKING-NOTES.md` — current discussion state

---

## Step 2: Assess State

Determine where we are:

**No cowmoo/design/ files exist (first time):**

Don't echo a spec-reading recap to the user — they invoked `/start` to GET your proposal. Build the mental model internally; surface it as evidence inside Step 3's recommendation.

Hold internally:
- Domains identified from specs and their UI complexity (number of entities, features, expected screens)
- The most foundational domain (typically: core domain, or the domain with most user-facing features) — this becomes Step 3's proposed starting point
- Open assumptions about the product worth flagging when Step 3 proposes

Surface in Step 3's proposal:
- The proposed starting domain + why-this-one reasoning (Inherits / Why now)
- The flow ahead: discussion on this domain → `/draft` → `/define` → `/review` → `/publish`. First `/define` creates initial `OVERVIEW.md` (Design Intent + Navigation), seeds `roles.md`, writes first `domains/*.md`.

**cowmoo/design/ files exist (returning):**
- Compare specs vs cowmoo/design/ coverage — which domains are defined, which aren't
- Check OVERVIEW state:
  - Does it exist?
  - Is Design Intent filled in (1-2 paragraphs describing density/formality/mood)?
  - Is Navigation Structure filled in?
- Check roles.md state:
  - Does it exist?
  - Does it have roles referenced by existing domain files?
- Check screen-index.md state:
  - Does it exist?
  - Does it match the screens defined in domain files?
- Check working notes for in-progress work
- Propose: continue current domain, start the next undefined domain, OR fill gaps in OVERVIEW/roles/screen-index if thin
- If working notes have [ready] items: "Ready items found — consider /define."
- If OVERVIEW is missing Design Intent: "OVERVIEW has no Design Intent yet — worth capturing before going further. We can discuss it now."

**For-uxui inbox:**
- Check for open for-uxui issues
- If any exist, mention them: "There are N for-uxui issues. Consider /catchup first."

---

## Step 3: Propose Focus

Based on the assessment, propose a specific action — embed reasoning + flow inside the proposal, don't echo it back as a separate verification step.

- **First time:** present the proposal as prose, then render the approval as an `AskUserQuestion` picker — never close on the prose `→ Approve…` line.
  ```
  Proposed starting domain: <name>

  Why this domain: <load-bearing reasoning — foundational, most user-facing, etc.>
  Domain landscape: <one-line — N domains, complexity profile>
  Open assumptions: <2-3 inferred from specs — the picker below can lock the domain or open these for discussion>

  Flow ahead: discussion → /draft → /define → /review → /publish. First /define creates initial OVERVIEW.md (Design Intent + Navigation), seeds roles.md, writes first domains/*.md.
  ```
  Then render an `AskUserQuestion` picker for the starting-domain decision: `Start with <proposed domain>` `(Recommended)` (description: the why-this-one reasoning) / `Name a different domain` (description: pick another domain to begin from — leads to a free-text follow-up asking which) / `Discuss the assumptions first` (description: work through the open assumptions before locking a domain). On the "Name a different domain" option, ask which domain and proceed from there.

- **Continuing:** state the recommendation in prose — "Let's continue with [domain]. Last session we defined [X], next up is [Y]."
- **All domains covered:** state in prose — "All spec domains have UI definitions."

Then close with an `AskUserQuestion` hand-off picker built from the path that holds: recommended next action first with `(Recommended)`, other live continuations, `Done for now` last. Build the options from context — e.g. first-time/continuing: `Discuss <domain> screens now` (Recommended) / `Run /define` (if working notes have [ready] items) / `Run /catchup` (if open for-uxui issues exist) / `Done for now`; all-domains-covered: `Run /review` (Recommended) / `Run /catchup` (if open for-uxui issues exist) / `Done for now`. Omit options that don't apply this run.

---

## Completion Checklist

Before finishing, confirm:

- [ ] All context loaded (specs, OVERVIEW, journeys, roles, screen-index, domains, working notes)
- [ ] Coverage assessed (which domains have UI definitions)
- [ ] OVERVIEW state assessed (Design Intent present? Navigation present?)
- [ ] Roles and screen-index state assessed
- [ ] Open for-uxui inbox checked
- [ ] Specific focus proposed with reasoning
- [ ] User directed to next action (/draft, /review, or /define)
