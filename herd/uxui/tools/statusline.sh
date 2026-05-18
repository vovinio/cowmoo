#!/bin/bash
# Statusline: up to four lines
# Line 1: context │ API limits │ model@branch
# Line 2: notes │ inbox │ design tasks
# Line 3: workflow step → next │ uncommitted
# Line 4: warnings
set -f

input=$(cat)
[ -z "$input" ] && { printf "Design Agent"; exit 0; }
command -v jq >/dev/null 2>&1 || { printf "Design Agent"; exit 0; }

# ── Colors ──
green='\033[38;2;80;200;120m'
orange='\033[38;2;255;176;85m'
yellow='\033[38;2;240;210;60m'
red='\033[38;2;255;100;100m'
cyan='\033[38;2;100;210;220m'
blue='\033[38;2;100;160;255m'
white='\033[38;2;220;220;220m'
gray='\033[38;2;55;55;55m'
dim='\033[2m'
bold='\033[1m'
reset='\033[0m'

sep="  ${dim}\xe2\x94\x82${reset}  "

# ── Helpers ──

format_tokens() {
    local n=$1
    if [ "$n" -ge 1000000 ] 2>/dev/null; then
        awk "BEGIN {printf \"%.1fm\", $n / 1000000}"
    elif [ "$n" -ge 1000 ] 2>/dev/null; then
        awk "BEGIN {printf \"%.0fk\", $n / 1000}"
    else
        printf "%d" "$n"
    fi
}

color_for_pct() {
    local p=$1
    if [ "$p" -ge 90 ] 2>/dev/null; then printf "${bold}${red}"
    elif [ "$p" -ge 75 ] 2>/dev/null; then printf "$yellow"
    elif [ "$p" -ge 50 ] 2>/dev/null; then printf "$orange"
    else printf "$green"
    fi
}

build_bar() {
    local pct=$1 width=$2
    [ "$pct" -lt 0 ] 2>/dev/null && pct=0
    [ "$pct" -gt 100 ] 2>/dev/null && pct=100
    local filled=$(( pct * width / 100 ))
    local empty=$(( width - filled ))
    local clr
    clr=$(color_for_pct "$pct")
    local f="" e=""
    for ((i=0; i<filled; i++)); do f+="\xe2\x96\x88"; done
    for ((i=0; i<empty; i++)); do e+="\xe2\x96\x91"; done
    printf "${clr}${f}${reset}${gray}${e}${reset}"
}

# ── Workspace paths ──

cwd=$(echo "$input" | jq -r '.cwd // empty')
agent_name="uxui"
files_dir=""
if [ -n "$PROJECT_DIR" ]; then
    files_dir="$PROJECT_DIR/cowmoo/agent-files/${agent_name}"
elif [ -n "$cwd" ]; then
    files_dir="$cwd/cowmoo/agent-files/${agent_name}"
fi

# ══════════════════════════════════════════════════════
# LINE 1: context │ API limits │ model@branch
# ══════════════════════════════════════════════════════

line1=""

# ── Context window ──

ctx_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
[ "$ctx_size" -eq 0 ] 2>/dev/null && ctx_size=200000

input_tok=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
cache_cr=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
cache_rd=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')
current=$(( input_tok + cache_cr + cache_rd ))

pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | awk '{printf "%.0f", $1}')
[ "$pct" -eq 0 ] 2>/dev/null && [ "$ctx_size" -gt 0 ] && [ "$current" -gt 0 ] && pct=$(( current * 100 / ctx_size ))

used_fmt=$(format_tokens $current)
total_fmt=$(format_tokens $ctx_size)
pct_clr=$(color_for_pct "$pct")

line1+="${white}${used_fmt}/${total_fmt}${reset} "
line1+=$(build_bar "$pct" 8)
line1+=" ${pct_clr}${pct}%${reset}"

# ── API limits ──

get_oauth_token() {
    [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] && { echo "$CLAUDE_CODE_OAUTH_TOKEN"; return 0; }
    if command -v security >/dev/null 2>&1; then
        local b; b=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null)
        if [ -n "$b" ]; then
            local t; t=$(echo "$b" | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null)
            [ -n "$t" ] && [ "$t" != "null" ] && { echo "$t"; return 0; }
        fi
    fi
    local cf="$HOME/.claude/.credentials.json"
    if [ -f "$cf" ]; then
        local t; t=$(jq -r '.claudeAiOauth.accessToken // empty' "$cf" 2>/dev/null)
        [ -n "$t" ] && [ "$t" != "null" ] && { echo "$t"; return 0; }
    fi
    echo ""
}

iso_to_local() {
    local iso="$1" style="$2"
    [ -z "$iso" ] || [ "$iso" = "null" ] && return
    local epoch
    epoch=$(date -d "$iso" +%s 2>/dev/null)
    if [ -z "$epoch" ]; then
        local s="${iso%%.*}"; s="${s%%Z}"; s="${s%%+*}"
        if [[ "$iso" == *"Z"* ]] || [[ "$iso" == *"+00:00"* ]]; then
            epoch=$(env TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "$s" +%s 2>/dev/null)
        else
            epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "$s" +%s 2>/dev/null)
        fi
    fi
    [ -z "$epoch" ] && return
    case "$style" in
        time)
            date -j -r "$epoch" +"%l:%M%p" 2>/dev/null | sed 's/^ //' | tr '[:upper:]' '[:lower:]' || \
            date -d "@$epoch" +"%l:%M%P" 2>/dev/null | sed 's/^ //'
            ;;
        datetime)
            date -j -r "$epoch" +"%b %e" 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr -s ' ' || \
            date -d "@$epoch" +"%b %e" 2>/dev/null | tr -s ' '
            ;;
    esac
}

# Shared OAuth usage cache. The usage payload is account-global (same OAuth
# account → same numbers regardless of agent or project), so a single file —
# rather than one cache per agent per project — collapses every refresh into
# one 60s loop, which is what keeps the /api/oauth/usage endpoint from
# rate-limiting.
usage_cache="/tmp/claude-code-oauth-usage.json"

# proj_hash keys the per-project inbox/design caches further down.
proj_hash=""
[ -n "$PROJECT_DIR" ] && proj_hash=$(echo "$PROJECT_DIR" | md5 2>/dev/null || echo "$PROJECT_DIR" | md5sum 2>/dev/null | cut -d' ' -f1)

needs_refresh=true
usage_data=""
if [ -f "$usage_cache" ]; then
    mt=$(stat -c %Y "$usage_cache" 2>/dev/null || stat -f %m "$usage_cache" 2>/dev/null)
    [ $(( $(date +%s) - mt )) -lt 60 ] && { needs_refresh=false; usage_data=$(cat "$usage_cache"); }
fi

if $needs_refresh; then
    tk=$(get_oauth_token)
    if [ -n "$tk" ] && [ "$tk" != "null" ]; then
        resp=$(curl -s --max-time 5 \
            -H "Accept: application/json" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $tk" \
            -H "anthropic-beta: oauth-2025-04-20" \
            -H "User-Agent: claude-code" \
            "https://api.anthropic.com/api/oauth/usage" 2>/dev/null)
        # Accept only a real usage payload. A rate-limit error is valid JSON
        # too, so checking that `.five_hour.utilization` exists is what rejects
        # it — and a rejected error is never cached, which would otherwise
        # poison the shared cache for the full 60s TTL.
        if [ -n "$resp" ] && echo "$resp" | jq -e '.five_hour.utilization' >/dev/null 2>&1; then
            usage_data="$resp"
            echo "$resp" > "$usage_cache" 2>/dev/null
        fi
    fi
    # Fetch failed or was rejected — fall back to the last good cached payload.
    [ -z "$usage_data" ] && [ -f "$usage_cache" ] && usage_data=$(cat "$usage_cache")
fi

if [ -n "$usage_data" ] && echo "$usage_data" | jq -e . >/dev/null 2>&1; then
    bw=6

    five_pct=$(echo "$usage_data" | jq -r '.five_hour.utilization // 0' | awk '{printf "%.0f", $1}')
    five_ri=$(echo "$usage_data" | jq -r '.five_hour.resets_at // empty')
    five_r=$(iso_to_local "$five_ri" "time")
    five_clr=$(color_for_pct "$five_pct")

    seven_pct=$(echo "$usage_data" | jq -r '.seven_day.utilization // 0' | awk '{printf "%.0f", $1}')
    seven_ri=$(echo "$usage_data" | jq -r '.seven_day.resets_at // empty')
    seven_r=$(iso_to_local "$seven_ri" "datetime")
    seven_clr=$(color_for_pct "$seven_pct")

    line1+="${sep}"
    line1+="${white}5h${reset} $(build_bar "$five_pct" $bw) ${five_clr}${five_pct}%${reset}"
    [ -n "$five_r" ] && line1+=" ${dim}@${five_r}${reset}"

    line1+="   "

    line1+="${white}7d${reset} $(build_bar "$seven_pct" $bw) ${seven_clr}${seven_pct}%${reset}"
    [ -n "$seven_r" ] && line1+=" ${dim}@${seven_r}${reset}"
fi

# ── Model + dir@branch ──

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
line1+="${sep}${blue}${model}${reset}"

if [ -n "$PROJECT_DIR" ]; then
    dir=$(basename "$PROJECT_DIR")
    branch=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
    line1+="  ${cyan}${dir}${reset}"
    [ -n "$branch" ] && line1+="${dim}@${reset}${green}${branch}${reset}"
fi

# ══════════════════════════════════════════════════════
# LINE 2: notes │ inbox │ design tasks
# ══════════════════════════════════════════════════════

line2=""

# ── Working notes stats ──

if [ -n "$files_dir" ]; then
    notes_file="$files_dir/WORKING-NOTES.md"
    if [ -f "$notes_file" ]; then
        # Parse counts via read, not eval — eval of command output is avoided
        # on principle even though the awk output is integer-only by construction.
        notes_counts=$(awk '
            /^## / {
                if (/\[ready\]/) tag="ready"
                else if (/\[future\]/) tag="future"
                else tag=""
            }
            /^- / {
                if (/\[ready\]/ || tag=="ready") r++
                else if (/\[future\]/ || tag=="future") f++
                else o++
            }
            END { printf "%d %d %d", r+0, f+0, o+0 }
        ' "$notes_file" 2>/dev/null)
        read -r nr nf no <<< "$notes_counts"
        nr=${nr:-0}; no=${no:-0}

        if [ "$nr" -gt 0 ] || [ "$no" -gt 0 ]; then
            dot=" ${dim}\xc2\xb7${reset} "
            parts=""
            [ "$nr" -gt 0 ] && { [ -n "$parts" ] && parts+="$dot"; parts+="${green}${nr} ready${reset}"; }
            [ "$no" -gt 0 ] && { [ -n "$parts" ] && parts+="$dot"; parts+="${dim}${no} open${reset}"; }
            line2+="$parts"
        fi
    fi
fi

# ── Inbox (for-uxui issues) ──

c_uxui=0
if command -v gh >/dev/null 2>&1 && [ -n "$GH_REPO" ]; then
    inbox_cache=""
    [ -n "$proj_hash" ] && inbox_cache="/tmp/${agent_name}-inbox-${proj_hash}"

    inbox_fresh=false
    if [ -n "$inbox_cache" ] && [ -f "$inbox_cache" ]; then
        imt=$(stat -c %Y "$inbox_cache" 2>/dev/null || stat -f %m "$inbox_cache" 2>/dev/null)
        [ $(( $(date +%s) - imt )) -lt 60 ] && { inbox_fresh=true; c_uxui=$(cat "$inbox_cache"); }
    fi

    if ! $inbox_fresh; then
        c_uxui=$(gh issue list --label "for-uxui" --state open --json number 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
        [ -n "$inbox_cache" ] && echo "$c_uxui" > "$inbox_cache" 2>/dev/null
    fi
fi

[ "${c_uxui:-0}" -gt 0 ] 2>/dev/null && { [ -n "$line2" ] && line2+="${sep}"; line2+="${orange}${c_uxui} for-uxui${reset}"; }

# ── Tracked inbox issues ──

c_tracked=0
if [ -n "$files_dir" ] && [ -f "$files_dir/.inbox-context" ]; then
    c_tracked=$(wc -l < "$files_dir/.inbox-context" | tr -d ' ')
fi
[ "${c_tracked:-0}" -gt 0 ] 2>/dev/null && { [ -n "$line2" ] && line2+="${sep}"; line2+="${cyan}${c_tracked} tracked${reset}"; }

# ── Pending corrections (PENDING-CORRECTIONS.md unchecked entries) ──

c_corr=0
if [ -n "$files_dir" ] && [ -f "$files_dir/PENDING-CORRECTIONS.md" ]; then
    # Count unchecked queue entries — lines starting with "- [ ]".
    c_corr=$(awk '/^- \[ \]/ {n++} END {print n+0}' "$files_dir/PENDING-CORRECTIONS.md" 2>/dev/null)
fi
[ "${c_corr:-0}" -gt 0 ] 2>/dev/null && { [ -n "$line2" ] && line2+="${sep}"; line2+="${yellow}${c_corr} corrections${reset}"; }

# ── Design task counts (uxui:todo, uxui:in-progress, uxui:review) ──

if command -v gh >/dev/null 2>&1 && [ -n "$GH_REPO" ]; then
    design_cache=""
    [ -n "$proj_hash" ] && design_cache="/tmp/${agent_name}-design-${proj_hash}"

    design_fresh=false
    if [ -n "$design_cache" ] && [ -f "$design_cache" ]; then
        dmt=$(stat -c %Y "$design_cache" 2>/dev/null || stat -f %m "$design_cache" 2>/dev/null)
        if [ $(( $(date +%s) - dmt )) -lt 60 ]; then
            design_fresh=true
            # Parse the cache with read, not eval — $design_cache is a
            # predictable /tmp path; eval would execute anything written there.
            IFS=' ' read -r d_todo d_prog d_review d_done < "$design_cache" 2>/dev/null
        fi
    fi

    if ! $design_fresh; then
        d_todo=$(gh issue list --label "uxui:todo" --state open --json number 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
        # uxui:in-progress — designer-side label; not consumed by UXUI agent.
        d_prog=$(gh issue list --label "uxui:in-progress" --state open --json number 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
        d_review=$(gh issue list --label "uxui:review" --state open --json number 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
        d_done=$(gh issue list --label "uxui:done" --state closed --json number 2>/dev/null | jq 'length' 2>/dev/null || echo 0)
        [ -n "$design_cache" ] && printf '%s %s %s %s\n' "$d_todo" "$d_prog" "$d_review" "$d_done" > "$design_cache" 2>/dev/null
    fi

    parts=""
    [ "${d_todo:-0}" -gt 0 ] 2>/dev/null && parts+="${parts:+ }${dim}todo:${reset}${yellow}${d_todo}${reset}"
    [ "${d_prog:-0}" -gt 0 ] 2>/dev/null && parts+="${parts:+ }${dim}wip:${reset}${cyan}${d_prog}${reset}"
    [ "${d_review:-0}" -gt 0 ] 2>/dev/null && parts+="${parts:+ }${dim}review:${reset}${orange}${d_review}${reset}"
    [ "${d_done:-0}" -gt 0 ] 2>/dev/null && parts+="${parts:+ }${dim}done:${reset}${green}${d_done}${reset}"
    if [ -n "$parts" ]; then
        [ -n "$line2" ] && line2+="${sep}"
        line2+="${dim}design:${reset} ${parts}"
    fi
fi

# ══════════════════════════════════════════════════════
# LINE 3: workflow step → next │ uncommitted
# ══════════════════════════════════════════════════════

line3=""

if [ -n "$PROJECT_DIR" ] && [ -f "$AGENT_DIR/tools/dev-tools.cjs" ]; then
    step_info=$(node "$AGENT_DIR/tools/dev-tools.cjs" next-step 2>/dev/null)
    if [ -n "$step_info" ]; then
        last=$(echo "$step_info" | sed 's/|.*//' | sed 's/last://')
        next=$(echo "$step_info" | sed 's/.*next://' | sed 's/|.*//')

        if [ -n "$last" ]; then
            line3+="${green}/${last} \xe2\x9c\x93${reset}  ${dim}\xe2\x86\x92${reset}  "
        else
            line3+="${dim}\xe2\x86\x92${reset}  "
        fi
        [ -n "$next" ] && line3+="${yellow}/${next}${reset}"
    fi
fi

# ── Uncommitted files ──

if [ -n "$PROJECT_DIR" ]; then
    git_status=$(git -C "$PROJECT_DIR" status --porcelain -- cowmoo/design/ cowmoo/agent-files/uxui/ 2>/dev/null)
    if [ -n "$git_status" ]; then
        parts=""
        for dir in "cowmoo/design" "cowmoo/agent-files/uxui" "cowmoo/agent-files/uxui/proposals"; do
            if [ "$dir" = "cowmoo/agent-files/uxui" ]; then
                # Exclude the proposals subdir so files under it are not double-counted
                # in both this bucket and the dedicated proposals bucket below.
                n=$(echo "$git_status" | grep " ${dir}/" | grep -cv " ${dir}/proposals/" 2>/dev/null || true)
            else
                n=$(echo "$git_status" | grep -c " ${dir}/" 2>/dev/null || true)
            fi
            [ "$n" -gt 0 ] 2>/dev/null && parts+="${parts:+ }${dim}${dir}:${reset}${orange}${n}${reset}"
        done
        if [ -n "$parts" ]; then
            [ -n "$line3" ] && line3+="$sep"
            line3+="$parts"
        fi
    fi
fi

# ══════════════════════════════════════════════════════
# LINE 4: warnings (only shown when something is wrong)
# ══════════════════════════════════════════════════════

line4=""

# ── Untracked skills check ──

known="start draft define review publish ask notify dispatch-corrections catchup process-inbox process-message status propose design-start design-draft design-publish review-bundle approve-design resolve-review"
if [ -n "$AGENT_DIR" ] && [ -d "$AGENT_DIR/.claude/skills" ]; then
    for skill in $(ls "$AGENT_DIR/.claude/skills/" 2>/dev/null); do
        [ -d "$AGENT_DIR/.claude/skills/$skill" ] || continue
        case " $known " in
            *" $skill "*) ;;
            *) line4+="${line4:+, }${skill}" ;;
        esac
    done
fi
[ -n "$line4" ] && line4="${red}Untracked skills: ${line4} — add to SEQUENCE, UNTRACKED, or ANYTIME in dev-tools.cjs AND to 'known' in statusline.sh${reset}"

# ── Output ──

printf "%b" "$line1"
[ -n "$line2" ] && printf "\n%b" "$line2"
[ -n "$line3" ] && printf "\n%b" "$line3"
[ -n "$line4" ] && printf "\n%b" "$line4"
exit 0
