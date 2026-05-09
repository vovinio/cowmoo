#!/usr/bin/env bash
set -euo pipefail

# Resolve COWMOO dir (follows symlinks)
resolve_path() {
  local target="$1"
  # Follow symlinks to find the real location
  while [ -L "$target" ]; do
    local dir="$(cd "$(dirname "$target")" && pwd)"
    target="$(readlink "$target")"
    [[ "$target" != /* ]] && target="$dir/$target"
  done
  echo "$(cd "$(dirname "$target")" && pwd)"
}

COWMOO="$(resolve_path "$0")"

usage() {
  echo "cowmoo - multi-agent development system"
  echo ""
  echo "usage: moo <command>"
  echo ""
  echo "agents:"
  echo "  moo pm          Launch PM agent (product specs)"
  echo "  moo uxui        Launch UXUI agent (design + UI definitions)"
  echo "  moo planner     Launch Planner agent (stories + tasks)"
  echo "  moo builder     Launch Builder agent (implementation)"
  echo ""
  echo "setup:"
  echo "  moo init        Initialize current directory as a cowmoo project"
  echo "  moo doctor      Check project health (structure, git, gh, labels)"
  echo ""
  echo "curator:"
  echo "  moo projects    List registered projects"
  echo "  moo proposals   Check all projects for pending proposals"
  echo ""
  echo "browser tools:"
  echo "  moo install-browser-tools   Install Playwright CLI + Chrome DevTools MCP"
  echo "  moo update-skills           Refresh Playwright CLI skill docs in agents"
  echo "  moo chrome-devtools-on      Enable Chrome DevTools MCP (full mode) for builder — needed for Lighthouse"
  echo "  moo chrome-devtools-off     Disable Chrome DevTools MCP for builder"
  echo "  moo chrome-devtools-status  Show Chrome DevTools MCP state"
  echo ""
  echo "Run from your project directory (agents) or anywhere (curator commands)."
}

cmd_agent() {
  local AGENT="$1"
  local PROJECT
  PROJECT="$(pwd)"

  # Verify project is initialized
  if [ ! -f "$PROJECT/cowmoo/config.json" ]; then
    echo "Not a cowmoo project — no cowmoo/config.json in $PROJECT."
    echo ""
    echo "If this is a new project:  moo init"
    echo "If this is the wrong dir:  cd to the project root first"
    exit 1
  fi

  # Verify agent exists
  if [ ! -d "$COWMOO/herd/$AGENT" ]; then
    echo "Agent '$AGENT' not found in $COWMOO/herd/"
    exit 1
  fi

  # Detect GitHub repo (for gh CLI targeting)
  local GH_REPO=""
  if command -v gh >/dev/null 2>&1; then
    GH_REPO=$(cd "$PROJECT" && gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null </dev/null || echo "")
  fi

  if [ -z "$GH_REPO" ]; then
    echo "Warning: could not detect GitHub repo. gh commands may not target the right repo."
    echo "Make sure this project is a GitHub repo: gh repo view"
    echo ""
  fi

  # Ensure agent-specific project config dir exists
  mkdir -p "$PROJECT/cowmoo/agent-files/$AGENT/.claude/rules"
  mkdir -p "$PROJECT/cowmoo/agent-files/$AGENT/.claude/skills"

  # Launch Claude from agent dir with project as --add-dir
  cd "$COWMOO/herd/$AGENT" && \
    PROJECT_DIR="$PROJECT" \
    GH_REPO="$GH_REPO" \
    exec claude \
      --add-dir "$PROJECT" \
      --add-dir "$PROJECT/cowmoo/agent-files/$AGENT"
}

ask_yn() {
  local prompt="$1" default="${2:-n}"
  local yn
  if [ "$default" = "y" ]; then
    printf "%s [Y/n] " "$prompt"
  else
    printf "%s [y/N] " "$prompt"
  fi
  read -r yn
  yn="${yn:-$default}"
  case "$yn" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

cmd_init() {
  local PROJECT
  if [ -n "${1:-}" ]; then
    PROJECT="$(cd "$1" 2>/dev/null && pwd)" || { echo "Directory not found: $1"; exit 1; }
  else
    PROJECT="$(pwd)"
  fi

  echo "Initializing cowmoo project in: $PROJECT"
  echo ""

  # --- Git setup ---

  local has_git=false
  if [ -d "$PROJECT/.git" ]; then
    has_git=true
    echo "Git repo detected."
  else
    if ask_yn "No git repo found. Initialize one?" "y"; then
      git init "$PROJECT"
      has_git=true
      echo ""
    else
      echo "Skipping git init. You'll need a git repo for agents to work properly."
      echo ""
    fi
  fi

  # --- GitHub repo setup ---

  local has_gh=false
  if command -v gh >/dev/null 2>&1; then
    has_gh=true
  fi

  local has_remote=false
  local REPO_OWNER=""
  local dir_name="${PROJECT##*/}"
  if $has_git && $has_gh; then
    if gh repo view >/dev/null 2>&1 </dev/null; then
      has_remote=true
      local repo_name
      repo_name=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null </dev/null)
      REPO_OWNER="${repo_name%%/*}"
      echo "GitHub repo: $repo_name"
    else
      echo "No GitHub repo found for this project."
      if ask_yn "Create a GitHub repo '$dir_name'?" "y"; then
        local visibility="private"
        if ask_yn "Make it public?" "n"; then
          visibility="public"
        fi
        echo "Creating $visibility GitHub repo..."
        gh repo create "$dir_name" --"$visibility" --source="$PROJECT" --push 2>/dev/null && has_remote=true || {
          # If source flag fails (no commits yet), try without --push
          gh repo create "$dir_name" --"$visibility" --source="$PROJECT" 2>/dev/null && has_remote=true || {
            echo "Could not create repo. You can do it manually: gh repo create"
          }
        }
        if $has_remote; then
          REPO_OWNER=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null </dev/null | cut -d/ -f1)
        fi
        echo ""
      fi
    fi
  elif ! $has_gh; then
    echo "Note: gh CLI not found. Install it for GitHub integration: brew install gh"
    echo ""
  fi

  # --- Project directories ---
  #
  # Single cowmoo/ wrapper at project root holds all cowmoo-managed content:
  #   - Public outputs: specs/ (PM), stack/ (planner), design/ (UXUI), codebase/ (builder)
  #   - Per-agent private territories: agent-files/<agent>/ (flat scratch + proposals/ + .claude/)
  # Actual project code (src/, tests/, package.json, etc.) lives at the repo root, outside cowmoo/.

  mkdir -p "$PROJECT"/cowmoo/specs/domains
  mkdir -p "$PROJECT"/cowmoo/stack
  mkdir -p "$PROJECT"/cowmoo/design/domains
  mkdir -p "$PROJECT"/cowmoo/codebase
  for agent in pm planner uxui builder; do
    mkdir -p "$PROJECT/cowmoo/agent-files/$agent/proposals"
    mkdir -p "$PROJECT/cowmoo/agent-files/$agent/.claude/rules"
    mkdir -p "$PROJECT/cowmoo/agent-files/$agent/.claude/skills"
  done
  mkdir -p "$PROJECT"/cowmoo/agent-files/planner/research
  mkdir -p "$PROJECT"/cowmoo/agent-files/pm/competitive

  # Planner files
  if [ ! -f "$PROJECT/cowmoo/agent-files/planner/knowledge.md" ]; then
    cat > "$PROJECT/cowmoo/agent-files/planner/knowledge.md" << 'TMPL'
# Knowledge

Product facts, edge cases, and decisions learned during planning.
TMPL
  fi

  if [ ! -f "$PROJECT/cowmoo/agent-files/uxui/WORKING-NOTES.md" ]; then
    cat > "$PROJECT/cowmoo/agent-files/uxui/WORKING-NOTES.md" << 'TMPL'
# Working Notes

UI/UX discussion capture, decisions, and screen definitions in progress.
TMPL
  fi

  if [ ! -f "$PROJECT/cowmoo/agent-files/pm/WORKING-NOTES.md" ]; then
    cat > "$PROJECT/cowmoo/agent-files/pm/WORKING-NOTES.md" << 'TMPL'
# Working Notes

Product discussion capture, decisions, and edge cases discovered during conversation.
TMPL
  fi

  if [ ! -f "$PROJECT/cowmoo/specs/PRODUCT.md" ]; then
    cat > "$PROJECT/cowmoo/specs/PRODUCT.md" << 'TMPL'
# Product

Product overview, glossary, roles, target users, and key behaviors. Written via `/digest`.
TMPL
  fi

  if [ ! -f "$PROJECT/cowmoo/agent-files/pm/BACKLOG.md" ]; then
    cat > "$PROJECT/cowmoo/agent-files/pm/BACKLOG.md" << 'TMPL'
# Backlog

Deferred items — from rough ideas to fully specified features. Each item notes why it was deferred and where it came from.
TMPL
  fi

  if [ ! -f "$PROJECT/cowmoo/agent-files/pm/RESEARCH.md" ]; then
    cat > "$PROJECT/cowmoo/agent-files/pm/RESEARCH.md" << 'TMPL'
# Research

Accumulated research findings from `@research` agent sessions.
TMPL
  fi

  # codebase.md is NOT pre-created — it's optional, written by builder's /map-codebase
  # when a project has enough code worth documenting.

  # Config file — marks this as a cowmoo project. Version field pins the schema so
  # future structural changes have a clear upgrade signal.
  cat > "$PROJECT/cowmoo/config.json" <<EOF
{
  "version": 1,
  "cowmoo": "$COWMOO"
}
EOF
  # No code directory name is recorded — code layout lives in cowmoo/codebase/codebase.md
  # (written by builder's /map-codebase) and is learned fresh from the project each session.

  # --- Gitignore ---
  # cowmoo/ itself is fully tracked in git. Only per-user/per-session state inside it
  # is ignored so teammates don't clobber each other's session state.

  local gitignore="$PROJECT/.gitignore"
  touch "$gitignore"
  local entries=(
    "# Cowmoo agent session state (per-user, not shared)"
    "cowmoo/agent-files/*/.workflow-step"
    "cowmoo/agent-files/planner/.inbox-context"
    "cowmoo/agent-files/planner/draft.md"
    "cowmoo/agent-files/planner/techstack-notes.md"
  )
  for entry in "${entries[@]}"; do
    grep -qxF "$entry" "$gitignore" 2>/dev/null || echo "$entry" >> "$gitignore"
  done

  # --- GitHub labels ---

  if $has_remote; then
    echo "Creating GitHub labels..."
    # Builder/task workflow
    gh label create "todo" --color "0E8A16" --description "Ready for builder" --force </dev/null 2>/dev/null || true
    gh label create "in-progress" --color "D93F0B" --description "Builder working" --force </dev/null 2>/dev/null || true
    gh label create "story" --color "5319E7" --description "Parent story" --force </dev/null 2>/dev/null || true
    # Cross-agent inboxes
    gh label create "for-pm" --color "C5DEF5" --description "PM must address" --force </dev/null 2>/dev/null || true
    gh label create "for-planner" --color "BFD4F2" --description "Planner must review" --force </dev/null 2>/dev/null || true
    gh label create "for-uxui" --color "D4C5F9" --description "UXUI agent must review (from PM, planner, or builder)" --force </dev/null 2>/dev/null || true
    echo ""
  elif $has_gh && ! $has_remote; then
    echo "No GitHub repo — skipping label creation."
    echo "Create these labels after adding a remote: todo, in-progress, story, for-pm, for-planner, for-uxui"
    echo ""
  fi

  # --- GitHub Project (kanban board) ---

  if $has_remote && $has_gh; then
    if ask_yn "Create a GitHub Project board?" "y"; then
      create_project_board "$dir_name" "$REPO_OWNER"
    fi
  fi

  # --- Initial commit ---

  if $has_git; then
    local has_commits
    has_commits=$(git -C "$PROJECT" rev-parse HEAD >/dev/null 2>&1 && echo "yes" || echo "no")
    if [ "$has_commits" = "no" ]; then
      if ask_yn "Create initial commit?" "y"; then
        git -C "$PROJECT" add .gitignore cowmoo/ 2>/dev/null || true
        git -C "$PROJECT" commit -m "chore: initialize cowmoo project" --allow-empty 2>/dev/null || true
        echo ""
      fi
    fi
  fi

  # --- Register project ---

  register_project "$PROJECT"

  echo "Project initialized!"
  echo ""
  echo "Next steps:"
  echo "  moo pm          Define the product (Terminal 1)"
  echo "  moo planner     Plan the work (Terminal 2)"
  echo "  moo builder     Build it (Terminal 3)"
}

# --- Project Registry ---

PROJECTS_FILE="$COWMOO/projects.md"

register_project() {
  local project_path="$1"
  local project_name="${project_path##*/}"

  # Create registry if it doesn't exist
  if [ ! -f "$PROJECTS_FILE" ]; then
    cat > "$PROJECTS_FILE" <<'EOF'
# Registered Projects

<!-- One project per line. Used by /curate to find proposals. -->
EOF
  fi

  # Check if already registered (by path)
  if grep -qF "$project_path" "$PROJECTS_FILE" 2>/dev/null; then
    return
  fi

  # Detect GitHub repo name if available
  local repo_name=""
  if command -v gh >/dev/null 2>&1; then
    repo_name=$(cd "$project_path" && gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null </dev/null || echo "")
  fi

  # Append to registry
  if [ -n "$repo_name" ]; then
    echo "- **$project_name** — \`$project_path\` — $repo_name" >> "$PROJECTS_FILE"
  else
    echo "- **$project_name** — \`$project_path\`" >> "$PROJECTS_FILE"
  fi

  echo "Registered in $PROJECTS_FILE"
}

create_project_board() {
  local project_name="$1"
  local owner="$2"

  echo "Creating GitHub Project board..."

  # Create the project
  local project_url
  project_url=$(gh project create --owner "$owner" --title "$project_name" --format json 2>/dev/null | jq -r '.url // empty')

  if [ -z "$project_url" ]; then
    echo "  Could not create project. You may need: gh auth refresh -h github.com -s project"
    echo "  Then re-run: gh project create --owner $owner --title \"$project_name\""
    return 1
  fi

  echo "  Project: $project_url"

  # Get project number and ID
  local project_num
  project_num=$(gh project list --owner "$owner" --format json 2>/dev/null | jq -r ".projects[] | select(.title==\"$project_name\") | .number")
  local project_id
  project_id=$(gh api graphql -f query="query(\$owner:String!,\$num:Int!) { user(login:\$owner) { projectV2(number:\$num) { id } } }" -f owner="$owner" -F num="$project_num" --jq '.data.user.projectV2.id' 2>/dev/null)

  if [ -z "$project_id" ]; then
    # Try as org
    project_id=$(gh api graphql -f query="query(\$owner:String!,\$num:Int!) { organization(login:\$owner) { projectV2(number:\$num) { id } } }" -f owner="$owner" -F num="$project_num" --jq '.data.organization.projectV2.id' 2>/dev/null)
  fi

  if [ -z "$project_id" ]; then
    echo "  Project created but could not configure columns."
    return 0
  fi

  # Link project to repo
  gh project link "$project_num" --owner "$owner" --repo "$owner/$project_name" </dev/null 2>/dev/null || true

  # Get Status field ID
  local status_field_id
  status_field_id=$(gh api graphql -f query="{ node(id:\"$project_id\") { ... on ProjectV2 { field(name:\"Status\") { ... on ProjectV2SingleSelectField { id } } } } }" --jq '.data.node.field.id' 2>/dev/null)

  if [ -n "$status_field_id" ]; then
    # Set up kanban columns
    gh api graphql -f query='mutation($fid:ID!) {
      updateProjectV2Field(input: {
        fieldId: $fid
        singleSelectOptions: [
          {name: "Backlog", color: GRAY, description: "Future work"}
          {name: "Todo", color: GREEN, description: "Ready for builder"}
          {name: "In Progress", color: ORANGE, description: "Builder working"}
          {name: "Planner", color: BLUE, description: "Needs planner review"}
          {name: "PM", color: PURPLE, description: "Needs PM attention"}
          {name: "UXUI", color: PINK, description: "Needs UXUI agent attention"}
          {name: "UX: Todo", color: PINK, description: "Design task for designer"}
          {name: "UX: In Progress", color: ORANGE, description: "Designer working"}
          {name: "UX: Review", color: YELLOW, description: "Designer finished — UXUI reviews"}
          {name: "Done", color: GREEN, description: "Completed"}
        ]
      }) { clientMutationId }
    }' -f fid="$status_field_id" >/dev/null 2>&1 && echo "  Columns: Backlog, Todo, In Progress, Planner, PM, UXUI, UX: Todo, UX: In Progress, UX: Review, Done"
  fi

  echo ""
  echo "  Opening project — switch to Board view for kanban."
  echo "  Also enable 'Item closed → Done' in project Settings > Workflows."
  open "$project_url" 2>/dev/null || echo "  Open: $project_url"
  echo ""
}

cmd_projects() {
  if [ ! -f "$PROJECTS_FILE" ]; then
    echo "No projects registered yet. Run: moo init (from a project directory)"
    exit 0
  fi

  echo "Registered projects:"
  echo ""

  # Parse project paths from registry
  sed -n 's/.*`\([^`]*\)`.*/\1/p' "$PROJECTS_FILE" | while read -r path; do
    local name="${path##*/}"
    if [ -d "$path" ]; then
      printf "  %-20s %s\n" "$name" "$path"
    else
      printf "  %-20s %s (NOT FOUND)\n" "$name" "$path"
    fi
  done
}

cmd_proposals() {
  if [ ! -f "$PROJECTS_FILE" ]; then
    echo "No projects registered yet. Run: moo init (from a project directory)"
    exit 0
  fi

  echo "Checking projects for proposals..."
  echo ""

  # Parse project paths from registry
  sed -n 's/.*`\([^`]*\)`.*/\1/p' "$PROJECTS_FILE" | while read -r path; do
    local name="${path##*/}"
    local count=0

    if [ ! -d "$path" ]; then
      echo "  $name: project directory not found ($path)"
      continue
    fi

    for agent in pm planner builder uxui; do
      local dir="$path/cowmoo/agent-files/$agent/proposals"
      if [ -d "$dir" ]; then
        local agent_count
        agent_count=$(find "$dir" -name '*.md' -not -name '.*' 2>/dev/null | wc -l | tr -d ' ')
        if [ "$agent_count" -gt 0 ]; then
          count=$((count + agent_count))
        fi
      fi
    done

    if [ "$count" -gt 0 ]; then
      echo "  $name: $count proposal(s)"

      # Show breakdown by agent
      for agent in pm planner builder uxui; do
        local dir="$path/cowmoo/agent-files/$agent/proposals"
        if [ -d "$dir" ]; then
          local files
          files=$(find "$dir" -name '*.md' -not -name '.*' 2>/dev/null)
          if [ -n "$files" ]; then
            local n
            n=$(echo "$files" | wc -l | tr -d ' ')
            echo "    $agent ($n):"
            echo "$files" | while read -r f; do
              echo "      - ${f##*/}"
            done
          fi
        fi
      done
      echo ""
    else
      echo "  $name: no proposals"
    fi
  done

  echo ""
  echo "Run /curate from the cowmoo repo to review and apply proposals."
}

# --- Doctor ---

cmd_doctor() {
  # Disable strict mode inside doctor — it runs many diagnostic checks
  # that are EXPECTED to fail (missing dirs, missing gh auth, etc.).
  # We want the function to report every finding, not abort on the first.
  set +e

  local PROJECT
  PROJECT="$(pwd)"
  local ok=0 warn=0 fail=0

  pass()  { printf "  \033[32m✓\033[0m %s\n" "$1"; ok=$((ok+1)); }
  warn()  { printf "  \033[33m⚠\033[0m %s\n" "$1"; warn=$((warn+1)); }
  fail()  { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); }

  echo "cowmoo doctor — checking project health"
  echo ""

  # --- Project structure ---
  echo "Project structure:"
  if [ -f "$PROJECT/cowmoo/config.json" ]; then
    local ver=""
    command -v jq >/dev/null 2>&1 && ver=$(jq -r '.version // "?"' "$PROJECT/cowmoo/config.json" 2>/dev/null)
    pass "cowmoo/config.json exists (version: ${ver:-?})"
  else
    fail "cowmoo/config.json MISSING — run 'moo init' from the project root"
    echo ""
    echo "Skipping remaining checks (not a cowmoo project)."
    return 1
  fi

  local missing=()
  for d in cowmoo/specs cowmoo/stack cowmoo/design cowmoo/codebase \
           cowmoo/agent-files/pm cowmoo/agent-files/planner \
           cowmoo/agent-files/uxui cowmoo/agent-files/builder; do
    [ -d "$PROJECT/$d" ] || missing+=("$d")
  done
  if [ ${#missing[@]} -eq 0 ]; then
    pass "all cowmoo/ subdirs present"
  else
    fail "missing dirs: ${missing[*]}  — re-run 'moo init' to recreate"
  fi

  local legacy=()
  for d in .cowmoo files-pm files-planner files-uxui files-builder \
           proposals-pm proposals-planner proposals-uxui proposals-builder \
           techstack uxui specs; do
    [ -d "$PROJECT/$d" ] && legacy+=("$d")
  done
  if [ ${#legacy[@]} -eq 0 ]; then
    pass "no legacy dirs at project root"
  else
    warn "legacy dirs found at root: ${legacy[*]}  — migration from pre-cowmoo/ layout may be incomplete"
  fi

  echo ""
  echo "Git:"
  if [ -d "$PROJECT/.git" ]; then
    pass "git repo initialized"
    local remote
    remote=$(git -C "$PROJECT" remote get-url origin 2>/dev/null)
    if [ -n "$remote" ]; then
      pass "git remote origin: $remote"
    else
      warn "no git remote 'origin' configured — GitHub operations will fail"
    fi
  else
    warn "no .git directory — 'moo init' can initialize one"
  fi

  if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
      local user
      user=$(gh api user --jq .login 2>/dev/null)
      pass "gh CLI authenticated${user:+ as $user}"
    else
      fail "gh CLI not authenticated — run 'gh auth login'"
    fi
  else
    fail "gh CLI not installed — agents need it for GitHub operations"
  fi

  echo ""
  echo "GitHub labels (required for cross-agent workflow):"
  if command -v gh >/dev/null 2>&1 && gh repo view >/dev/null 2>&1 </dev/null; then
    local required_labels=(todo in-progress story for-pm for-planner for-uxui)
    local missing_labels=()
    local existing
    existing=$(gh label list --limit 100 --json name --jq '.[].name' 2>/dev/null)
    for label in "${required_labels[@]}"; do
      echo "$existing" | grep -qxF "$label" || missing_labels+=("$label")
    done
    if [ ${#missing_labels[@]} -eq 0 ]; then
      pass "all required labels present"
    else
      warn "missing labels: ${missing_labels[*]}  — re-run 'moo init' to create them"
    fi
  else
    warn "skipped label check (no GitHub repo detected)"
  fi

  echo ""
  echo "Gitignore:"
  if [ -f "$PROJECT/.gitignore" ]; then
    local required_gitignore=(
      "cowmoo/agent-files/*/.workflow-step"
      "cowmoo/agent-files/planner/.inbox-context"
      "cowmoo/agent-files/planner/draft.md"
      "cowmoo/agent-files/planner/techstack-notes.md"
    )
    local missing_gitignore=()
    for entry in "${required_gitignore[@]}"; do
      grep -qxF "$entry" "$PROJECT/.gitignore" 2>/dev/null || missing_gitignore+=("$entry")
    done
    if [ ${#missing_gitignore[@]} -eq 0 ]; then
      pass "session-state entries present in .gitignore"
    else
      warn ".gitignore missing entries: ${missing_gitignore[*]}  — re-run 'moo init' to add them"
    fi
  else
    warn "no .gitignore file"
  fi

  echo ""
  echo "Summary: $ok ok, $warn warnings, $fail failures"
  set -e
  [ "$fail" -eq 0 ]
}

# --- Browser Tools ---

cmd_install_browser_tools() {
  echo "Installing browser tools for cowmoo agents..."
  echo ""

  # Check Node.js
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found. Install Node.js 18+ first: https://nodejs.org"
    exit 1
  fi

  # Playwright CLI
  if command -v playwright-cli >/dev/null 2>&1; then
    local pw_ver
    pw_ver=$(playwright-cli --version 2>/dev/null || echo "unknown")
    echo "Playwright CLI: already installed ($pw_ver)"
  else
    echo "Installing @playwright/cli..."
    npm install -g @playwright/cli@latest
    echo ""
  fi

  # Playwright browser
  echo "Ensuring browser is installed..."
  playwright-cli install-browser 2>/dev/null || playwright-cli install 2>/dev/null || echo "  Browser install skipped (run manually: playwright-cli install-browser)"
  echo ""

  # Chrome DevTools MCP (verify npx can find it)
  echo "Chrome DevTools MCP: available via npx (chrome-devtools-mcp@latest)"
  echo "  Builder uses this for Lighthouse audits. Enable with: moo chrome-devtools-on"
  echo ""

  # Reminder about extension
  echo "Optional: Install 'Playwright MCP Bridge' Chrome extension for recon auth."
  echo "  Chrome Web Store → search 'Playwright MCP Bridge'"
  echo "  Needed for /recon-playwright to use your logged-in Chrome sessions."
  echo ""

  echo "Done. Run 'moo update-skills' to install skill docs into agents."
}

cmd_update_skills() {
  echo "Updating Playwright CLI skill docs..."
  echo ""

  if ! command -v playwright-cli >/dev/null 2>&1; then
    echo "playwright-cli not found. Run: moo install-browser-tools"
    exit 1
  fi

  local updated=0

  for agent in pm builder; do
    local agent_dir="$COWMOO/herd/$agent"
    if [ -d "$agent_dir" ]; then
      echo "Updating $agent..."
      (cd "$agent_dir" && playwright-cli install --skills 2>/dev/null)
      if [ $? -eq 0 ]; then
        local changes
        changes=$(cd "$COWMOO" && git diff --stat -- "herd/$agent/.claude/skills/playwright-cli/" 2>/dev/null)
        if [ -n "$changes" ]; then
          echo "  Changes:"
          echo "$changes" | sed 's/^/    /'
          updated=$((updated + 1))
        else
          echo "  No changes (already up to date)"
        fi
      else
        echo "  Warning: install --skills failed for $agent"
      fi
      echo ""
    fi
  done

  if [ "$updated" -gt 0 ]; then
    echo "$updated agent(s) updated. Review with: git diff -- herd/*/. claude/skills/playwright-cli/"
  else
    echo "All agents already up to date."
  fi
}

cmd_chrome_devtools_on() {
  local mcp_file="$COWMOO/herd/builder/.mcp.json"

  # jq is required — chrome-devtools-on must merge the `chrome-devtools` key into any
  # pre-existing .mcp.json safely without clobbering other MCP servers.
  if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required for chrome-devtools-on. Install it first:"
    echo "  brew install jq"
    exit 1
  fi

  local entry='{"command":"npx","args":["-y","chrome-devtools-mcp@latest","--headless"]}'

  if [ -f "$mcp_file" ]; then
    if jq -e '.mcpServers["chrome-devtools"]' "$mcp_file" >/dev/null 2>&1; then
      echo "Chrome DevTools MCP already enabled in $mcp_file."
      return 0
    fi
    jq --argjson cd "$entry" '.mcpServers["chrome-devtools"] = $cd' "$mcp_file" > "$mcp_file.tmp" \
      && mv "$mcp_file.tmp" "$mcp_file"
    echo "MCP config updated (chrome-devtools merged alongside existing servers): $mcp_file"
  else
    cat > "$mcp_file" <<'EOF'
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--headless"]
    }
  }
}
EOF
    echo "MCP config written: $mcp_file"
  fi

  echo ""
  echo "Chrome DevTools MCP: enabled (full mode, 29 tools, ~19k tokens)."
  echo "Lighthouse audits now available via @audit-lighthouse during /review."
  echo "If a builder session is currently open, exit and relaunch with: moo builder"
}

cmd_chrome_devtools_off() {
  local mcp_file="$COWMOO/herd/builder/.mcp.json"

  if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required for chrome-devtools-off. Install it first:"
    echo "  brew install jq"
    exit 1
  fi

  if [ ! -f "$mcp_file" ]; then
    echo "Chrome DevTools MCP already disabled (no $mcp_file)."
    return 0
  fi

  if ! jq -e '.mcpServers["chrome-devtools"]' "$mcp_file" >/dev/null 2>&1; then
    echo "Chrome DevTools MCP already disabled in $mcp_file."
    return 0
  fi

  local other_count
  other_count=$(jq '.mcpServers | keys | map(select(. != "chrome-devtools")) | length' "$mcp_file" 2>/dev/null || echo 0)

  if [ "$other_count" -gt 0 ] 2>/dev/null; then
    jq 'del(.mcpServers["chrome-devtools"])' "$mcp_file" > "$mcp_file.tmp" && mv "$mcp_file.tmp" "$mcp_file"
    echo "chrome-devtools removed from $mcp_file (other MCP servers preserved)."
  else
    rm "$mcp_file"
    echo "MCP config removed: $mcp_file"
  fi

  echo ""
  echo "Chrome DevTools MCP: disabled."
  echo "Re-enable anytime with: moo chrome-devtools-on"
  echo "If a builder session is currently open, the change takes effect on next: moo builder"
}

cmd_chrome_devtools_status() {
  local mcp_file="$COWMOO/herd/builder/.mcp.json"

  echo "Chrome DevTools MCP status:"
  echo ""

  if [ -f "$mcp_file" ] && command -v jq >/dev/null 2>&1 && jq -e '.mcpServers["chrome-devtools"]' "$mcp_file" >/dev/null 2>&1; then
    local other_servers
    other_servers=$(jq -r '.mcpServers | keys | map(select(. != "chrome-devtools")) | join(", ")' "$mcp_file" 2>/dev/null)
    if [ -n "$other_servers" ]; then
      echo "  MCP config:  $mcp_file (chrome-devtools enabled, alongside: $other_servers)"
    else
      echo "  MCP config:  $mcp_file (chrome-devtools enabled)"
    fi
    echo ""
    echo "Status: ENABLED"
    echo "To disable: moo chrome-devtools-off"
  else
    if [ -f "$mcp_file" ]; then
      echo "  MCP config:  $mcp_file (exists, chrome-devtools NOT configured)"
    else
      echo "  MCP config:  NOT FOUND"
    fi
    echo ""
    echo "Status: NOT CONFIGURED"
    echo "To enable: moo chrome-devtools-on"
  fi
}

# --- Main ---

case "${1:-}" in
  pm|planner|builder|uxui)
    cmd_agent "$1"
    ;;
  init)
    cmd_init "${2:-}"
    ;;
  projects)
    cmd_projects
    ;;
  proposals)
    cmd_proposals
    ;;
  doctor)
    cmd_doctor
    ;;
  install-browser-tools)
    cmd_install_browser_tools
    ;;
  update-skills)
    cmd_update_skills
    ;;
  chrome-devtools-on)
    cmd_chrome_devtools_on
    ;;
  chrome-devtools-off)
    cmd_chrome_devtools_off
    ;;
  chrome-devtools-status)
    cmd_chrome_devtools_status
    ;;
  -h|--help|help)
    usage
    ;;
  "")
    usage
    ;;
  *)
    echo "Unknown command: $1"
    echo ""
    usage
    exit 1
    ;;
esac
