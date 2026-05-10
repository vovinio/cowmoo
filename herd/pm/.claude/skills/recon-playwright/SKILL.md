---
name: recon-playwright
description: "Reverse-engineer a live web platform using Playwright CLI. Token-efficient for long sessions (150-200 turns). Scouts, researches, inspects entities and operations, then writes domain-based product analysis."
user-invocable: true
disable-model-invocation: true
argument-hint: [url]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, TaskCreate, TaskUpdate, TaskGet, TaskList
---

# Platform Reverse Engineering (Playwright CLI)

Automated deep-dive of a live web platform using Playwright CLI for browser automation. Produces the same output as `/recon-chrome` but uses file-based snapshots for token efficiency — critical for the 150-200 turn entity and ops inspection phases.

**Usage:** `/recon-playwright https://app.example.com/#/dashboard`

---

## How It Works

Same 5-phase structure as `/recon-chrome`. The only difference is the browser tool: Playwright CLI instead of Claude in Chrome.

```
You (orchestrator):
  Phase 0: Auth setup (connect to user's Chrome via Playwright)
  Phase 1: @recon-scout-pw → maps navigation and structure
  Phase 2: @recon-research → researches platform from public sources (shared, no browser)
  Phase 3: @recon-entities-pw → inspects all entity forms
  Phase 4: @recon-ops-pw → inspects reports/admin/tools
  Phase 5: You read all working files → write domain-based product analysis
```

---

## Phase 0: Setup

The platform URL is: `$ARGUMENTS`

If no URL was provided, ask the user for it.

Determine a kebab-case folder name from the URL (e.g., `https://app.acmeplatform.com` → `acmeplatform`).

Set `FOLDER` = `$PROJECT_DIR/cowmoo/agent-files/pm/competitive/[platform-name]/playwright` for use throughout.

Create the working directory:
- Write an empty file to `[FOLDER]/_working/.gitkeep`

### Auth Setup

Most platforms require authentication. Connect to the user's existing Chrome session:

**Primary path — attach to Chrome via extension:**

Tell the user: "I'll connect Playwright to your Chrome browser for authenticated access. Make sure you're logged into the platform."

```bash
playwright-cli attach --extension
```

- If successful → connected to user's Chrome. Verify by taking a snapshot and checking for logged-in indicators.
- If extension not installed or connection failed → fall back to manual login (below).

**Fallback — manual login:**

```bash
playwright-cli -s=recon open <url>/login --headed --persistent
```

Tell the user: "Log in manually in the browser window. Tell me when you're done."

After user confirms:
```bash
playwright-cli -s=recon state-save "/tmp/pm-recon-auth-[platform-name]-$(date +%s).json"
```

Auth state goes to `/tmp/` because the recon session is transient and the file contains session cookies. Saving anywhere under `cowmoo/agent-files/pm/` would let `@pm-ops COMMIT` stage it (the op `git add`s the whole PM tree) and propagate credentials to the remote on the next `/publish`. Same transient pattern `/import-design` uses for design bundles.

**Auth verification:**

```bash
playwright-cli -s=recon snapshot --filename=recon-auth-check.yaml
```

Read the snapshot. If you see login form elements instead of dashboard/app content → auth failed. Report and stop.

### Resume Detection

Check if `[FOLDER]/_working/` already has files from a previous run:
- `SCOUT.md` exists → Phase 1 done
- `research-context.md` exists → Phase 2 done
- `notes-entities.md` exists → Phase 3 done (check header for partial completion)
- `notes-ops.md` exists → Phase 4 done (check header for partial completion)

If working files exist: "Previous recon data found. Resume from Phase [N], or start fresh?"

---

## Phase 1: Scout

Tell the user: **"Phase 1: Scouting the platform..."**

Spawn agent with `subagent_type: "recon-scout-pw"`. In the prompt, provide:
- The platform URL
- The session name (`-s=recon`) — the scout reuses the authenticated session from Phase 0
- Output instruction: `Write the scout report to [FOLDER]/_working/SCOUT.md`

When the agent returns, verify `SCOUT.md` was written and has entity types and navigation.

---

## Phase 2: Research

Tell the user: **"Phase 2: Researching the platform from public sources..."**

Read `[FOLDER]/_working/SCOUT.md` to extract the platform name, type, and key terminology.

Spawn agent with `subagent_type: "recon-research"`. In the prompt, provide:
- The platform URL
- The platform name and type from SCOUT.md
- Key entity names and terminology
- Output instruction: `Write findings to [FOLDER]/_working/research-context.md`

---

## Phase 3: Entity Inspection

Tell the user: **"Phase 3: Inspecting entity forms..."**

Spawn agent with `subagent_type: "recon-entities-pw"`. In the prompt, provide:
- Path to SCOUT.md: `[FOLDER]/_working/SCOUT.md`
- Path to research context: `[FOLDER]/_working/research-context.md`
- The session name (`-s=recon`)
- How many entity types were found
- Output instruction: `Write findings to [FOLDER]/_working/notes-entities.md`

---

## Phase 4: Operations Inspection

Tell the user: **"Phase 4: Inspecting reports, admin, and tools..."**

Spawn agent with `subagent_type: "recon-ops-pw"`. In the prompt, provide:
- Path to SCOUT.md: `[FOLDER]/_working/SCOUT.md`
- Path to entity notes: `[FOLDER]/_working/notes-entities.md`
- Path to research context: `[FOLDER]/_working/research-context.md`
- The session name (`-s=recon`)
- Output instruction: `Write findings to [FOLDER]/_working/notes-ops.md`

---

## Phase 5: Compile Output (you do this directly)

Tell the user: **"Phase 5: Compiling product analysis..."**

Read all working files:
- `[FOLDER]/_working/research-context.md`
- `[FOLDER]/_working/SCOUT.md`
- `[FOLDER]/_working/notes-entities.md`
- `[FOLDER]/_working/notes-ops.md`

### Determine Domain Boundaries

Before writing, analyze SCOUT.md's navigation tree to determine product domains:
1. Each major navigation section is a candidate domain
2. Sections with entities become their own domain
3. Small utility sections merge into the domain they serve
4. Reporting becomes a domain if the platform has substantial analytics
5. Admin/Settings becomes a domain if it has users, roles, or significant config
6. Name domains using the platform's own terminology, kebab-case (e.g., `project-management`, `user-management`, `billing`)

### Write Output Files

#### README.md — Product Overview

```markdown
# [Platform Name] — Product Analysis

**URL:** [url]
**Type:** [platform type — describe what you observed]
**Analyzed:** [date]
**Tool:** Playwright CLI
**Account:** [if visible]

## What It Is
[2-3 paragraphs combining research context + observed behavior. What the product does, who it's for, how it works at a high level.]

## Entity Hierarchy
[Diagram showing all entities and their parent-child/connection relationships]

## Navigation Map
[Full tree from SCOUT.md]

## Domain Index
| Domain | File | Entities | Key Capabilities |
|--------|------|----------|-----------------|

## Key Flows
[3-5 primary end-to-end workflows, step-by-step, cross-referencing domain files]

## Key Observations
[10-15 most notable/surprising findings about this product]

## Platform Context
[Company background, market position, pricing — from research]
```

#### domains/[name].md — One Per Domain

For each domain, write a file in `[FOLDER]/domains/`:

```markdown
# [Domain Name]

[1-2 sentence description of what this domain covers]

## Entities

### [Entity Name]

**What it is:** [one sentence]

**List view:**
- Columns: [exact names]
- Filters: [all controls with options]
- Status indicators: [badges, counts]
- Actions: per-row and bulk
- Count: [N items observed]

**Creation flow:**
- Flow type: [wizard / single page / tabbed]
- Required fields: [list with defaults]
- Dynamic behavior: [what changes based on type/mode selection]
- Tabs disabled until save: [list]

**Edit form:**
| Tab | Field | Type | Options/Range | Required | Notes |
|-----|-------|------|---------------|----------|-------|

**Create vs Edit differences:**
[Fields unique to each, different defaults, tabs only in edit]

**Relationships:**
[How this entity connects to others — include cardinality: one-to-many, many-to-many, etc.]

**Status lifecycle:**
[State machine: all observed states and valid transitions between them.]

**Business rules:**
[Implicit rules observed — auto-calculations, conditional requirements, constraints.]

### [Next Entity...]

## Flows
### [Flow Name]
[Step-by-step workflow as observed, with decision points and branching paths]

## Domain UX Notes
[UX observations specific to this domain]
```

#### ux-insights.md — Cross-Cutting UX Analysis

```markdown
# UX Insights — [Platform Name]

## Navigation
[Nav paradigm, breadcrumbs, back navigation, section switching, URL structure]

## Information Architecture
[Content organization, findability, hierarchy depth, entity discoverability]

## Form Design
[Wizard vs single-page, tabbed forms, field density, progressive disclosure, required field patterns]

## List & Table Design
[Filtering, sorting, pagination, bulk actions, column density, status indicators]

## Dynamic Behavior
[Forms that change based on selections — most important UX pattern observed]

## Validation & Error Handling
[Required field indicators, inline validation, error messages, empty states]

## Consistency
[Where patterns are consistent across domains, where they break]

## Notable UX Decisions
[Specific good or questionable design choices with analysis]
```

#### ui-insights.md — Visual Design Analysis

```markdown
# UI Insights — [Platform Name]

## Visual Design Language
[Overall aesthetic — modern/dated, clean/cluttered, polished/rough]

## Color Scheme
[Primary, accent, status colors — describe what you observed]

## Typography
[Font observations, heading hierarchy, readability]

## Component Patterns
[UI framework, button styles, form controls, modals, dropdowns]

## Layout
[Grid system, card vs table, sidebar patterns, density, responsive hints]

## Iconography
[Icon style and library, action icons, status indicators]

## Data Visualization
[Chart types, dashboard cards, metric presentation patterns]
```

#### data-model.md — Entity Relationships

```markdown
# Data Model — [Platform Name]

## Entity Map
[List every entity with a one-line description]

## Relationships
| Entity A | Relationship | Entity B | Notes |
|----------|-------------|----------|-------|

## Key Relationship Patterns
[How entities connect — direct ownership, many-to-many matching, reference lists, etc.]

## Field Inventory Summary
| Entity | Total Fields | Required | Dropdowns | Dynamic Variants |
|--------|-------------|----------|-----------|-----------------|
```

#### glossary.md — Platform Terminology

```markdown
# Glossary — [Platform Name]

| Term | Definition | Where Used |
|------|-----------|------------|
```

#### feature-matrix.md — Capability Inventory

```markdown
# Feature Matrix — [Platform Name]

## By Domain

### [Domain Name]
| Feature | Description | Maturity | Notes |
|---------|------------|----------|-------|

## Cross-Cutting Capabilities
| Capability | Present? | Details |
|-----------|----------|---------|
| User roles / permissions | Yes/No | [what roles exist] |
| API access | Yes/No | [per-entity, global, documented?] |
| Export / import | Yes/No | [CSV, Excel, API, bulk?] |
| Audit trail / changelog | Yes/No | [field-level? entity-level?] |
| Scheduled reports | Yes/No | [details] |
| 2FA / security | Yes/No | [details] |
| Multi-account / white-label | Yes/No | [details] |
| Alerts / notifications | Yes/No | [details] |
| Compliance tools | Yes/No | [details] |
| Fraud detection | Yes/No | [details] |
```

---

## Quality Checks

Verify as you write each file — not as a separate pass at the end:

**Per domain file** (check immediately after writing each one):
- Every entity from SCOUT.md that belongs to this domain is covered
- Each entity has: list view, create form, edit form, relationships with cardinality, status lifecycle
- Dropdown option lists are actual lists, not just "dropdown"
- No placeholder text ("[TODO]", "[...]")

**After all files are written** (quick scan):
- README has all required sections
- data-model.md relationships match what domain files describe
- Domain names use the platform's own terminology
- If any agent completed partially, note the gaps in README under a "Coverage Gaps" section

---

## Finish

Close the browser session:
```bash
playwright-cli -s=recon close
```

List all files in `[FOLDER]/` and `[FOLDER]/domains/` with sizes.

Show summary: domains created, entity types documented, top 3 findings.

Tell the user: **"Recon complete (Playwright). Full product analysis in `[FOLDER]/`."**

If the user also ran `/recon-chrome`, suggest comparing the two output directories.
