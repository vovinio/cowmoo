# Product Specification Agent

A Claude Code agent that helps you think through product ideas and turn them into structured, developer-ready specifications. You talk through your product — the agent asks questions, challenges your thinking, proposes solutions, and organizes everything into specs that define **what** to build.

It focuses on business logic, user workflows, and edge cases. Not visual design, not database schemas, not architecture.

---

## Setup

**Prerequisites:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated.

**First time:**

```bash
cd /path/to/this/project
claude
```

Claude Code will automatically load the agent configuration from CLAUDE.md and `.claude/`. No additional setup needed.

Once inside, run:

```
/start
```

This initializes the project structure (`cowmoo/specs/` for shared specs and `cowmoo/agent-files/pm/` for private working files). Then start describing your product.

**Returning to an existing project:**

```bash
cd /path/to/this/project
claude
```

Then run `/start` again — it detects the existing project, loads your working notes, assesses their condition, and suggests where to pick up.

---

## How It Works

The agent operates in three main phases: **discussion**, **formalization**, and **shipping**.

### Discussion Phase

This is where thinking happens. You describe your product, the agent asks questions, you make decisions together.

```
/start → discuss → /draft
```

- The agent asks concrete questions — "What happens when this fails?", "Who can do this?"
- When it spots a gap, it proposes a specific answer for you to react to, rather than asking you to invent one
- It pushes back when things are vague, contradictory, or have UX problems
- Nothing is written to spec files during discussion — only to working notes via `/draft`

**Run `/draft` regularly** to save decisions to working notes. Before ending a session, run **`/publish`** to commit working notes and push them to the remote.

### Formalization Phase

This is where working notes become formal specs. Run this as a **dedicated session** — not at the end of a discussion.

```
/digest → /review → /publish → /notify
```

1. **`/digest`** — reads your working notes, transforms confirmed items into spec format using templates, proposes completions for gaps, writes to spec files, cleans processed items from notes
2. **`/review`** — runs 6 integrity checks in parallel (terminology, references, scope, completeness, structure, risk), presents findings, applies fixes
3. **`/publish`** — commits all changes to git
4. **`/notify`** — announces spec changes to the planner or UXUI (inference will propose targets based on which downstream files exist) and resolves any tracked inbox issues

### Inbox Phase

When other agents (planner, builder) have questions or escalations, they create `for-pm` labeled GitHub issues. Process them with:

```
/catchup
```

The agent loads all inbox issues, categorizes them, and you triage: quick questions get resolved inline, issues needing spec work transition into a discussion session.

---

## Typical Workflow

### Starting a New Product

1. **`/start`** — Initialize the project
2. **Describe your product** — What problem does it solve? Who uses it? The agent will guide you through the core concepts
3. **`/draft`** — Persist decisions to working notes

### Building Out Specs Over Multiple Sessions

4. **`/start`** — Resume. The agent assesses your notes and suggests what to work on
5. **Discuss a domain** — e.g., "Let's talk about how billing works." Go deep on entities, features, edge cases
6. **`/draft`** — Persist decisions to working notes
7. **Repeat** steps 4-6 for each area of your product

### Formalizing Into Specs

8. **Start a fresh session** and run **`/digest`** — This is a dedicated session, not a continuation of discussion
9. The agent walks you through each item, proposes completions for gaps, writes to spec files
10. Run **`/review`** — Verify spec integrity before shipping
11. Run **`/publish`** — Commit changes to git
12. Run **`/notify`** — Announce spec changes to planner and/or UXUI

---

## Best Practices

### One domain at a time

Go deep on billing OR user management, not both in the same conversation. Cross-domain observations get saved and picked up when that domain is the focus.

- **Run `/draft` regularly** — write decisions to files as you go, don't wait until the end
- **Run `/publish` before ending** — this saves working notes to git so the next session starts clean
- **Start digest in a fresh session** — don't tack it onto a long discussion. Digest works best with focused attention.
- **Use `/status` for quick checks** — it's read-only and doesn't load you into discussion mode.

### Be specific, not vague

The agent is designed to push you for specifics. Work with it:

- Bring real examples from your domain, not hypotheticals
- When the agent asks "what happens when X fails?", give a concrete answer — an exact error message, a specific recovery flow
- If you don't know yet, say so — the agent will keep it as an open question rather than guessing

### React to proposals, don't start from scratch

The agent proposes specific content when it spots gaps — error messages, edge case handling, acceptance criteria. It's faster to react ("yes, but change X") than to invent from scratch. If a proposal is wrong, say why and the agent will adjust.

### Use @research for external context

When you need to understand industry standards, how competitors handle something, or best practices for a pattern:

```
@research How do SaaS products typically handle subscription cancellation and refunds?
```

Findings are saved to RESEARCH.md and returned to the conversation so you can discuss them immediately.

### Don't skip review before shipping

After `/digest`, always run `/review` before `/publish`. The review catches terminology inconsistencies, broken references, scope leaks, and template compliance issues that are hard to spot manually.

---

## What You Get

Output is split into shared specs and private working files:

```
cowmoo/specs/                       # Shared — planner and builder read these
├── PRODUCT.md                      # Product overview, roles, glossary, how it works
└── domains/                        # Business logic by area
    ├── billing.md                  # Entities + features for billing
    ├── user-management.md
    └── ...

cowmoo/agent-files/pm/              # Private — PM working files only
├── WORKING-NOTES.md                # Staging area — trends toward empty after digests
├── BACKLOG.md                      # Deferred items with full context and reasoning
└── RESEARCH.md                     # Accumulated research findings
```

**Domain files** contain the core specs — entities (the things in your system) and features (what users do with them). Each entity has fields, relationships, rules, and states. Each feature has a user story, workflow, validations, edge cases, permissions, and acceptance criteria.

The specs are written in business language, not technical language. A developer reading them should understand exactly what to build without needing to ask follow-up questions.

---

## Commands Reference

### Core Workflow

| Command | What It Does |
|---------|-------------|
| `/start` | Initialize a new project or resume an existing one. Assesses notes condition and suggests focus area. |
| `/draft` | Extract decisions from the current conversation and save to working notes. |
| `/digest` | Formalize confirmed working notes into spec files. Run as a dedicated session. |
| `/review` | Verify spec integrity — terminology, references, scope, completeness, structure. Run after digest. |
| `/publish` | Commit PM file changes to git — specs, working notes, proposals. Run after /review or anytime. |
| `/notify` | Announce spec changes to the planner or UXUI, and resolve tracked inbox issues. Run after /publish. |

### Utilities

| Command | What It Does |
|---------|-------------|
| `/tidy` | Reorganize working notes — group related items, tag confirmed decisions, remove superseded content. |
| `/status` | Quick read-only snapshot: item counts, domain list, last session summary. |
| `/catchup` | Triage for-pm GitHub issues — quick-resolve or transition into a working session. |
| `/import [folder]` | Import existing docs. Walks through by topic, resolves contradictions, populates working notes. |
| `/migrate` | Align existing specs from a previous agent version to current templates. |
| `/propose` | Propose a change to the shared agent system — missing instructions, better approaches, gaps in skills. |

### Quality & Refinement

| Command | What It Does |
|---------|-------------|
| `/copywrite` | Review and improve all user-facing text — terminology, messages, labels — informed by domain research via @research. |
| `/ideate` | Research-informed product ideation — identify parity gaps, automation opportunities, and new capabilities based on current specs and industry context. |

### Agents

| Agent | Purpose |
|-------|---------|
| `@notes-health` | Assess working notes condition (counts, organization quality). Used by `/start`. |
| `@inbox-reader` | Read for-pm GitHub issues with full context. Used by `/catchup`. |
| `@pm-ops` | Execute GitHub and git write operations with verification (commits, comments, labels, CREATE_FOR_PLANNER / CREATE_FOR_UXUI). Used by `/publish`, `/catchup`, `/notify`. |
| `@research` | Research external topics — industry standards, competitor approaches, best practices. Saves to RESEARCH.md. |
| `@check-terms` | Scan spec files against glossary for terminology inconsistencies. Used by `/review`. |
| `@check-refs` | Verify cross-reference integrity between files. Used by `/review`. |
| `@check-scope` | Verify scope boundaries between active specs and backlog. Used by `/review`. |
| `@check-completeness` | Verify specs follow templates, flag missing sections and vague language. Used by `/review`. |
| `@check-structure` | Verify domain cohesion, feature/domain classification, and spec self-containment. Used by `/review`. |
| `@check-risk` | Examine specs for product-level risks — implicit assumptions, unaddressed scenarios, fragile dependencies. Used by `/review`. |
