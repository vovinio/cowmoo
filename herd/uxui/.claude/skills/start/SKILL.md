---
name: start
description: Load specs, assess what UI work is needed, propose session focus. Entry point for every UXUI session.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Agent, Bash
---

# Start

Load all context, understand what UI work exists and what's needed, propose what to do next.

---

## Step 0: Check Project Exists

Run `node tools/dev-tools.cjs check-files` and read the output.

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
- Present your understanding of the product from specs
- List the domains and estimate UI complexity for each (number of entities, features, expected screens)
- Propose which domain to start with and why (typically: core domain first, or the domain with most user-facing features)
- Explain the flow: discussion on a domain → `/draft` → `/define` → `/review` → `/publish`. The first `/define` session creates initial `OVERVIEW.md` (with Design Intent prose and Navigation), seeds `roles.md`, and writes the first `domains/*.md`.

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

Based on the assessment, propose a specific action:

- **First time:** "I recommend starting with [domain] because [reasoning]. Let's begin by defining the UI — discussion first, then /draft, then /define."
- **Continuing:** "Let's continue with [domain]. Last session we defined [X], next up is [Y]."
- **All domains covered:** "All spec domains have UI definitions. Run /review for a full coverage check."

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
