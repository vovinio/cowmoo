---
name: recon-chrome
description: "Reverse-engineer a live web platform using Claude in Chrome. Scouts, researches, inspects entities and operations, then writes domain-based product analysis."
user-invocable: true
disable-model-invocation: false
argument-hint: [url]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion
---

# Platform Reverse Engineering

Automated deep-dive of a live web platform. One command produces a complete product analysis — domains, entities, flows, UX insights, UI patterns.

**Usage:** `/recon-chrome https://app.example.com/#/dashboard`

---

## How It Works

You are the orchestrator. You spawn 4 agents sequentially, then compile the final output yourself:

```
You (orchestrator):
  → @recon-scout-chrome → maps navigation and structure via browser
  → @recon-research → researches platform from public sources (using scout findings)
  → @recon-entities-chrome → inspects all entity forms via browser
  → @recon-ops-chrome → inspects reports/admin/tools via browser
  → You read all working files → write domain-based product analysis
```

You do NO browser work yourself. All browser interaction happens in sub-agents with fresh context. Each browser agent has safety rules built in.

---

## Phase 0: Setup

The platform URL is: `$ARGUMENTS`

If no URL was provided, ask the user for it.

**Precondition:** this skill drives a live browser through the Claude-in-Chrome browser integration. That integration must be enabled before running — if it is not, the scout in Phase 1 will fail because the browser tools are unavailable.

Determine a kebab-case folder name from the URL (e.g., `https://app.acmeplatform.com` → `acmeplatform`).

Set `FOLDER` = `$PROJECT_DIR/cowmoo/agent-files/pm/competitive/[platform-name]/chrome` for use throughout.

Create the working directory by writing a placeholder:
- Write an empty file to `[FOLDER]/_working/.gitkeep` (this creates all intermediate directories via the Write tool)

### Resume Detection

Check if `[FOLDER]/_working/` already has files from a previous run:
- `SCOUT.md` exists → Phase 1 done
- `research-context.md` exists → Phase 2 done
- `notes-entities.md` exists → Phase 3 done (check header for partial completion)
- `notes-ops.md` exists → Phase 4 done (check header for partial completion)

If any working files exist, tell the user what was already completed, then render an `AskUserQuestion` picker — `Resume from Phase [N]` `(Recommended)` / `Start fresh`. Each option's `description` carries the consequence: `Resume from Phase [N]` continues from the first incomplete phase, keeping prior working files; `Start fresh` deletes the `_working/` contents and proceeds from Phase 1. On `Start fresh`, delete the `_working/` contents and proceed from Phase 1.

---

## Phase 1: Scout

Tell the user: **"Phase 1: Scouting the platform..."**

Spawn agent with `subagent_type: "recon-scout-chrome"`. In the prompt, provide:
- The platform URL
- Output instruction: `Write the scout report to [FOLDER]/_working/SCOUT.md`

When the agent returns, verify `SCOUT.md` was written and has entity types and navigation. If the agent failed or the file is missing, tell the user what went wrong and stop — and if the scout reports the browser tools were unavailable, tell the user the likely cause is that the Claude-in-Chrome browser integration is not enabled.

---

## Phase 2: Research

Tell the user: **"Phase 2: Researching the platform from public sources..."**

Read `[FOLDER]/_working/SCOUT.md` to extract the platform name, type, and key terminology discovered by the scout.

Spawn agent with `subagent_type: "recon-research"`. In the prompt, provide:
- The platform URL
- The platform name and type from SCOUT.md (e.g., "Acme Corp — project management platform")
- Key entity names and terminology the scout found (so research is targeted)
- Output instruction: `Write findings to [FOLDER]/_working/research-context.md`

When the agent returns, verify the file was written. If research found limited info, that's OK — proceed.

---

## Phase 3: Entity Inspection

Tell the user: **"Phase 3: Inspecting entity forms..."**

Spawn agent with `subagent_type: "recon-entities-chrome"`. In the prompt, provide:
- Path to SCOUT.md: `[FOLDER]/_working/SCOUT.md`
- Path to research context: `[FOLDER]/_working/research-context.md`
- How many entity types were found (from SCOUT.md) — if more than 6, tell the agent to prioritize by entity count
- Output instruction: `Write findings to [FOLDER]/_working/notes-entities.md`

When the agent returns, read `notes-entities.md` and check its header. If the file is missing entirely, tell the user and stop. If the file exists but shows "in-progress" status (agent ran out of turns), tell the user which entities were completed vs skipped, and proceed with partial data.

---

## Phase 4: Operations Inspection

Tell the user: **"Phase 4: Inspecting reports, admin, and tools..."**

Spawn agent with `subagent_type: "recon-ops-chrome"`. In the prompt, provide:
- Path to SCOUT.md: `[FOLDER]/_working/SCOUT.md`
- Path to entity notes: `[FOLDER]/_working/notes-entities.md`
- Path to research context: `[FOLDER]/_working/research-context.md`
- Output instruction: `Write findings to [FOLDER]/_working/notes-ops.md`

When the agent returns, read `notes-ops.md` and check its header. If the file is missing entirely, tell the user and stop. If "in-progress", tell the user which sections were completed vs skipped, and proceed with partial data.

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
[State machine: all observed states and valid transitions between them. E.g., Enabled → Paused → Archived. Can transitions go backwards?]

**Business rules:**
[Implicit rules observed — auto-calculations, conditional requirements, constraints. E.g., "Total cost auto-calculated from quantity x unit price", "Must select at least one category"]

### [Next Entity...]

## Flows
### [Flow Name] (e.g., "Create and Configure a Project")
[Step-by-step workflow as observed, with decision points and branching paths]

## Domain UX Notes
[UX observations specific to this domain — form design, navigation within the domain, help text quality]
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

Synthesize the entity-relationship model from all domain files:

```markdown
# Data Model — [Platform Name]

## Entity Map

[List every entity with a one-line description]

## Relationships

| Entity A | Relationship | Entity B | Notes |
|----------|-------------|----------|-------|
| [Parent] | has many | [Child] | Parent-child ownership |
| [Entity X] | connects to many | [Entity Y] | Many-to-many via [connection mechanism] |
| ... | ... | ... | ... |

## Key Relationship Patterns
[How entities connect — direct ownership, many-to-many matching, reference lists, etc.]

## Field Inventory Summary

| Entity | Total Fields | Required | Dropdowns | Dynamic Variants |
|--------|-------------|----------|-----------|-----------------|
```

#### glossary.md — Platform Terminology

Extract and define every platform-specific term observed:

```markdown
# Glossary — [Platform Name]

| Term | Definition | Where Used |
|------|-----------|------------|
| [Term] | [What it means in this platform's context] | [Which domain/entity] |
```

Include: entity names, status labels, metric names, field labels that use domain-specific language, any term that wouldn't be obvious to someone unfamiliar with the platform.

#### feature-matrix.md — Capability Inventory

Structured inventory of all features/capabilities discovered:

```markdown
# Feature Matrix — [Platform Name]

## By Domain

### [Domain Name]
| Feature | Description | Maturity | Notes |
|---------|------------|----------|-------|
| [Feature] | [What it does] | [Basic / Advanced / Unique] | [Notable details] |

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

Verify as you write each file — not as a separate pass at the end. These are the checks that matter:

**Per domain file** (check immediately after writing each one):
- Every entity from SCOUT.md that belongs to this domain is covered
- Each entity has: list view, create form, edit form, relationships with cardinality, status lifecycle
- Dropdown option lists are actual lists, not just "dropdown"
- No placeholder text ("[TODO]", "[...]")

**After all files are written** (quick scan):
- README has all required sections (What It Is, entity hierarchy, nav tree, key flows, observations)
- data-model.md relationships match what domain files describe
- Domain names use the platform's own terminology
- If any agent completed partially, note the gaps in README under a "Coverage Gaps" section

---

## Finish

List all files in `[FOLDER]/` and `[FOLDER]/domains/` with sizes.

Show summary: domains created, entity types documented, report metrics counted, top 3 findings.

Tell the user: **"Recon complete. Full product analysis in `[FOLDER]/`."**

Then render an `AskUserQuestion` hand-off picker of concrete next actions, recommended first and `Done for now` last. Build the options from state — e.g. `/compare` to compare this analysis against the product specs (recommended), `/recon-playwright` against the same URL to cross-check with the other tool (especially worth surfacing if the user also ran `/recon-playwright` — comparing the two output directories), `/recon-chrome` against a different platform, and `Done for now` last.
