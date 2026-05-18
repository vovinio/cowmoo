#!/bin/bash
# Curator statusline: two-line layout
# Line 1: context │ API limits │ model@branch
# Line 2: uncommitted │ audit findings │ proposals per project
set -f

input=$(cat)
[ -z "$input" ] && { printf "Curator Agent"; exit 0; }
command -v jq >/dev/null 2>&1 || { printf "Curator Agent"; exit 0; }

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

# ── API limits (cached) ──

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
# account → same numbers regardless of agent or project), so all cowmoo agents
# read and write this one file — collapsing every refresh into a single 60s
# loop instead of one cache per agent, which is what keeps the
# /api/oauth/usage endpoint from rate-limiting.
cache_file="/tmp/claude-code-oauth-usage.json"

needs_refresh=true
usage_data=""
if [ -f "$cache_file" ]; then
    mt=$(stat -c %Y "$cache_file" 2>/dev/null || stat -f %m "$cache_file" 2>/dev/null)
    [ $(( $(date +%s) - mt )) -lt 60 ] && { needs_refresh=false; usage_data=$(cat "$cache_file"); }
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
            echo "$resp" > "$cache_file" 2>/dev/null
        fi
    fi
    # Fetch failed or was rejected — fall back to the last good cached payload.
    [ -z "$usage_data" ] && [ -f "$cache_file" ] && usage_data=$(cat "$cache_file")
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

if [ -n "$cwd" ]; then
    dir="${cwd##*/}"
    branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
    line1+="  ${cyan}${dir}${reset}"
    [ -n "$branch" ] && line1+="${dim}@${reset}${green}${branch}${reset}"
fi

# ══════════════════════════════════════════════════════
# LINE 2: uncommitted │ proposals (60s cache)
# ══════════════════════════════════════════════════════

line2=""

if [ -n "$cwd" ]; then
    curator_cache="/tmp/cowmoo-curator-status"
    needs_check=true
    if [ -f "$curator_cache" ]; then
        cmt=$(stat -c %Y "$curator_cache" 2>/dev/null || stat -f %m "$curator_cache" 2>/dev/null)
        [ $(( $(date +%s) - cmt )) -lt 60 ] && needs_check=false
    fi

    if $needs_check; then
        # Uncommitted agent changes
        uncommitted=$(git -C "$cwd" status --porcelain -- herd/ 2>/dev/null | wc -l | tr -d ' ')

        # Proposals per project (canonical path: cowmoo/agent-files/<agent>/proposals/)
        proposals_line=""
        projects_file="$cwd/projects.md"
        if [ -f "$projects_file" ]; then
            while IFS= read -r pline; do
                proj_path=$(echo "$pline" | sed -n 's/.*`\([^`]*\)`.*/\1/p')
                [ -z "$proj_path" ] && continue
                [ ! -d "$proj_path" ] && continue

                proj_name=$(basename "$proj_path")
                pcount=0
                for agent in pm uxui planner builder; do
                    pdir="$proj_path/cowmoo/agent-files/$agent/proposals"
                    [ -d "$pdir" ] || continue
                    n=$(find "$pdir" -name '*.md' -not -name '.*' -type f 2>/dev/null | wc -l | tr -d ' ')
                    pcount=$((pcount + n))
                done
                [ "$pcount" -gt 0 ] && proposals_line+="${proj_name}(${pcount}) "
            done < "$projects_file"
        fi

        printf '%s|%s\n' "${uncommitted:-0}" "${proposals_line% }" > "$curator_cache" 2>/dev/null
    fi

    # Read cache
    if [ -f "$curator_cache" ]; then
        IFS='|' read -r c_uncommitted c_proposals < "$curator_cache" 2>/dev/null

        # Uncommitted
        if [ "${c_uncommitted:-0}" -gt 0 ] 2>/dev/null; then
            line2+="${orange}${c_uncommitted} uncommitted${reset}"
        fi

        # Proposals
        c_proposals=$(echo "$c_proposals" | tr -d '\n')
        if [ -n "$c_proposals" ] && [ "$c_proposals" != " " ]; then
            [ -n "$line2" ] && line2+="${sep}"
            line2+="${dim}proposals:${reset} ${green}${c_proposals}${reset}"
        fi
    fi
fi

# ── Output ──

printf "%b" "$line1"
[ -n "$line2" ] && printf "\n%b" "$line2"
exit 0
