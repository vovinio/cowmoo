# Cowmoo — Multi-Agent Development System

A four-agent Claude Code configuration for building production applications. Each agent runs in its own terminal with fresh context, so a long-running project never collapses into one bloated conversation.

```
    ┌──────┐      ┌──────┐      ┌─────────┐      ┌─────────┐
    │  PM  │  →   │ UXUI │  →   │ Planner │  →   │ Builder │
    └──────┘      └──────┘      └─────────┘      └─────────┘
     specs         design          tasks             code
```

The **PM** writes product specs. The **UXUI agent** defines UI structure (with or without a designer). The **planner** breaks work into task PRDs. The **builder** ships the code. They share the project through `--add-dir` and coordinate through GitHub Issues.

---

## Table of Contents

- [Why Multiple Agents?](#why-multiple-agents)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands Reference](#commands-reference)
- [Project Structure](#project-structure)
- [Architecture](#architecture)

---

## Why Multiple Agents?

A single AI agent that plans, builds, reviews, and iterates in one conversation degrades over time — context rot, role confusion, clunky iteration. Splitting the work keeps each role focused:

| | PM | UXUI | Planner | Builder |
|---|---|---|---|---|
| **Terminal** | 1 | 2 | 3 | 4 |
| **Focus** | Product specs, business logic | UI definitions, design briefs | Strategy, task PRDs | Implementation, testing, code |
| **Writes to** | `cowmoo/specs/` | `cowmoo/design/` | GitHub stories + task PRDs, `cowmoo/stack/` | Project tree (code, tests, manifests), GitHub Records |
| **Core commands** | `/start` `/draft` `/digest` `/review` `/publish` | `/start` `/draft` `/define` `/review` `/publish` | `/start` `/draft` `/review` `/publish` | `/start` `/build` `/review` `/publish` |

---

## Prerequisites

| Tool | Required | Notes |
|------|---|---|
| [Claude Code](https://claude.com/claude-code) | yes | The CLI that runs each agent. |
| `git` | yes | Source control for the project and the cowmoo clone itself. |
| `gh` (GitHub CLI) | yes | Agents coordinate via GitHub Issues. Install with `brew install gh`, then `gh auth login`. |
| `bash`, `jq` | yes | Used by the `moo` script and statuslines. |
| `node` | yes | Used by per-agent `dev-tools.cjs` and the optional browser-tools installer. |
| Playwright CLI + Chrome DevTools MCP | optional | Install via `moo install-browser-tools` if you want UI verification or live-platform recon. |

Run `moo doctor` after `moo init` to verify everything is wired correctly.

---

## Quick Start

### 1. Clone cowmoo

```bash
git clone https://github.com/vovinio/cowmoo.git
cd cowmoo
```

#### Optional: make `moo` available globally

Cowmoo ships as a single shell script. **Run the commands below from inside the cloned `cowmoo` directory.** Pick one option — you don't need all three.

```bash
# Option A — symlink into ~/.local/bin
mkdir -p ~/.local/bin
ln -s "$PWD/moo" ~/.local/bin/moo

# Ensure ~/.local/bin is on your PATH (macOS zsh doesn't include it by default):
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# Option B — symlink into /usr/local/bin (already on PATH; may need sudo)
sudo ln -s "$PWD/moo" /usr/local/bin/moo

# Option C — add the cowmoo dir to PATH directly
echo 'export PATH="$PATH:'"$PWD"'"' >> ~/.zshrc && source ~/.zshrc
```

Verify with `which moo` and `moo --help`. Once `moo` is global, drop the `./cowmoo/` prefix in the rest of this guide — every command becomes plain `moo …`.

### 2. Initialize a project

```bash
moo init /path/to/your-project
```

This scaffolds the `cowmoo/` wrapper (`specs/`, `design/`, `stack/`, `codebase/`, per-agent `agent-files/`), writes `cowmoo/config.json`, configures `.gitignore`, and creates the GitHub labels agents coordinate through. If the project isn't already a git repo, `moo init` offers to initialize one.

### 3. Verify the setup

```bash
cd /path/to/your-project
moo doctor
```

`moo doctor` checks project structure, git, `gh` authentication, and GitHub labels. Fix anything it flags before launching agents — an agent launched against a broken project produces confusing errors later.

### 4. Launch agents in the right order

Each agent runs in its own terminal, from the project directory. **For a brand-new project the order matters:**

```
PM  →  UXUI  →  Planner  →  Builder
```

PM creates the spec, UXUI defines the UI surface, planner turns it into tasks, builder implements them. For an existing cowmoo project any agent can launch at any time — they reload context from project files each session.

### 5. Define your product (Terminal 1 — PM)

```bash
moo pm
```

```
/start              # Initialize or resume, discuss product
/draft              # Save conversation to working notes
/digest             # Turn confirmed notes into spec files
/review             # Check spec integrity
/publish            # Commit changes and push to remote
```

### 6. Define UI (Terminal 2 — UXUI)

```bash
moo uxui
```

UXUI works in two phases. **Phase A** defines UI structure directly from specs. **Phase B** hands screens off to a human designer working in Claude Design, then reviews the submissions.

```
# Phase A — UI definitions (committed to cowmoo/design/, pushed to remote)
/start              # Load specs, assess what needs UI work
/draft              # Save discussion to working notes
/define             # Formalize notes into UI definition files
/review             # Verify definitions cover all specs
/publish            # Commit changes and push to remote

# Phase B — Hand off design work to a human designer
/design-start       # Synthesize state, propose 1-3 next design tasks (no writes)
/design-draft       # Compose task bodies, validate, write draft.md
/design-publish     # Create uxui:todo issues for the designer

# Resolve a UX: Review task
/review-bundle      # Bundle path: fetch, evaluate, triage, reject
/approve-design     # The approval transaction: attach bundle, journal, close uxui:done
/resolve-review     # No-bundle path: treat the comments, resolve / send back / fix
```

See `herd/uxui/CLAUDE.md` → **Workflow** for the complete flow.

### 7. Plan (Terminal 3 — Planner)

```bash
moo planner
```

```
/start              # Load context, propose next story
/draft              # Compile conversation into task PRDs
/review             # Validate PRDs with check agents
/publish            # Commit files, push to remote, create GitHub issues
```

### 8. Build (Terminal 4 — Builder)

```bash
moo builder
```

```
/start              # Find task, load context, propose approach
/build              # Implement the task
/review             # Verify against PRD acceptance criteria
/publish            # Commit code, push to remote, post Record, close task
```

---

## How It Works

### Communication via GitHub Issues

Planner and builder coordinate through GitHub Issues — they never edit each other's files directly:

| What | Owner | Other agents |
|------|-------|-------------|
| Stories (parent issues, `story` label) | Planner creates | Builder reads |
| Task PRDs (issue body) | Planner writes | Builder reads — the complete brief |
| Task Records (issue comments) | Builder writes | Planner reads — the completion report |
| Workflow labels (`todo`, `in-progress`, `for-planner`, `for-pm`, `for-uxui`) | Agents change | All read |
| UXUI design labels (`uxui:todo`, `uxui:review`, `uxui:done`) | UXUI + human designer | UXUI manages the state machine; planner reads `uxui:done` as signal that a domain has approved bundles |

### Task Lifecycle

```
Planner /publish               →  creates task PRD                →  label: todo
Builder /start                 →  claims it                       →  label: in-progress
Builder /build                 →  implements, tracks deviations
Builder /review                →  verifies against PRD criteria
Builder /publish               →  closes issue + posts Record
  └─ if pattern deviations     →  label: for-planner
Builder /return                →  hands back when blocked         →  label: for-planner
Planner /catchup               →  approves (close) or rejects (todo + comment)
```

### Labels

| Label | Meaning |
|-------|---------|
| `story` | Parent issue grouping related tasks |
| `todo` | Task is ready to be picked up |
| `in-progress` | Builder is actively working on it |
| `for-planner` | Needs planner attention |
| `for-pm` | Needs PM attention |
| `for-uxui` | Needs UXUI agent attention |

---

## Commands Reference

### PM

| Command | Purpose |
|---------|---------|
| `/start` | Initialize or resume a project |
| `/draft` | Save conversation to working notes |
| `/digest` | Formalize confirmed notes into spec files |
| `/review` | Run all spec integrity checks |
| `/publish` | Commit changes and push to remote |
| `/notify` | Announce spec changes to planner or UXUI |
| `/catchup` | Process incoming planner or UXUI questions |
| `/status` | Quick project snapshot |
| `/tidy` | Reorganize working notes |
| `/import [folder]` | Import existing docs |
| `/import-design [url]` | Start spec work from a Claude Designer share URL — walk screens, populate notes, hand off to UXUI |
| `/copywrite` | Review and improve all user-facing text |
| `/ideate` | Research-informed product ideation |
| `/migrate` | Align existing specs to current templates |
| `/recon-chrome [url]` | Reverse-engineer a live platform via Claude in Chrome |
| `/recon-playwright [url]` | Reverse-engineer a live platform via Playwright CLI |
| `/compare` | Guided competitive comparison against analyzed platforms |
| `/propose [idea]` | Propose an agent system improvement |

### UXUI

| Command | Purpose |
|---------|---------|
| `/start` | Load specs, assess what needs UI work |
| `/draft` | Save UI discussion to working notes |
| `/define` | Formalize notes into UI definition files (OVERVIEW, journeys, roles, screen-index, domains) |
| `/review` | Verify definitions cover all specs |
| `/publish` | Commit UI definition changes and push to remote |
| `/design-start` · `/design-draft` · `/design-publish` | Phase B: synthesize, draft, and publish design tasks for a human designer |
| `/review-bundle` · `/approve-design` · `/resolve-review` | Phase B: resolve a `uxui:review` task — evaluate a designer's bundle, run the approval transaction, or treat a no-bundle card |
| `/ask [pm\|planner]` | Ask PM about spec gaps, or respond to a planner `for-uxui` finding |
| `/notify planner` | Announce `cowmoo/design/` file changes when active tasks may consume them |
| `/dispatch-corrections [designer\|pm\|planner]` | Batch non-blocking copy-grade corrections collected during review/design work into one consolidated issue per target |
| `/catchup` · `/process-inbox` · `/process-message` | Inbox: `/catchup` gates (reconcile board + scan), `/process-inbox` presents & routes, `/process-message` handles one `for-uxui` agent message |
| `/status` | Show UXUI project status |
| `/propose [idea]` | Propose an agent system improvement |

### Planner

| Command | Purpose |
|---------|---------|
| `/start` | Load context, propose next story |
| `/draft` | Compile conversation into task PRDs |
| `/review` | Validate PRDs with check agents |
| `/publish` | Commit files, push to remote, create GitHub issues |
| `/ask pm` · `/ask uxui` | Escalate spec questions to PM, or UI definition issues to UXUI |
| `/catchup` | Process pending builder/PM items |
| `/tech-stack` | Choose technologies |
| `/status` | Show progress |
| `/tidy` | Verify planning files |
| `/propose [idea]` | Propose an agent system improvement |

### Builder

| Command | Purpose |
|---------|---------|
| `/start` | Find task, load context, propose approach |
| `/build` | Implement the task |
| `/review` | Verify against PRD acceptance criteria |
| `/publish` | Commit code, push to remote, post Record, close task |
| `/return` | Return task to planner with explanation |
| `/status` | Show project status |
| `/map-codebase` | Analyze existing codebase, write to `cowmoo/codebase/codebase.md` |
| `/propose [idea]` | Propose an agent system improvement |

---

## Project Structure

```
your-project/
├── cowmoo/                          # Tracked in git — team-shared
│   ├── config.json                  # Project config
│   ├── specs/                       # Product specs        (PM writes)
│   ├── design/                      # UI definitions       (UXUI writes)
│   ├── stack/                       # Tech decisions       (planner writes)
│   ├── codebase/                    # codebase.md          (builder writes via /map-codebase)
│   └── agent-files/
│       ├── pm/                      # PM working files + per-project .claude/ + proposals/
│       ├── uxui/                    # UXUI working files + per-project .claude/ + proposals/
│       ├── planner/                 # Planner working files + per-project .claude/ + proposals/
│       └── builder/                 # Builder working files + per-project .claude/ + proposals/
└── src/                             # Code, tests, manifests — laid out per the project's stack
```

Per-project Claude overrides live inside each agent's `cowmoo/agent-files/<agent>/.claude/` directory and are tracked in git. Per-user session state (workflow step, draft notes, inbox context) is gitignored automatically by `moo init`.

---

## Architecture

Agents live in the cowmoo repo under `herd/` (one directory per agent). They access projects via Claude Code's `--add-dir` — no files are copied into your project. The `moo` CLI handles launching with the right environment variables (`PROJECT_DIR`, `GH_REPO`).

This means:

- Editing an agent in `herd/<agent>/` updates every project on the next launch.
- A clone of cowmoo is everything you need to launch all four agents.
- Projects don't accumulate stale agent files.

For details, see `docs/ARCHITECTURE.md`.
