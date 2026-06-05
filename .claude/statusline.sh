#!/usr/bin/env bash
# Claude Code statusline
# Reads the Status JSON from stdin and prints a one-line statusline.
# Features: working dir | git branch | model | context remaining | cost | tokens | burn rate
# Generated for threejs-tactics-game.

# --- read stdin ---
input="$(cat)"

# --- locate jq (PATH first, then winget install dir) ---
JQ="$(command -v jq 2>/dev/null)"
if [ -z "$JQ" ]; then
  for c in /c/Users/"$USERNAME"/AppData/Local/Microsoft/WinGet/Packages/jqlang.jq*/jq.exe \
           "$LOCALAPPDATA"/Microsoft/WinGet/Packages/jqlang.jq*/jq.exe; do
    [ -f "$c" ] && JQ="$c" && break
  done
fi

# --- ANSI colors ---
RESET=$'\e[0m'; DIM=$'\e[2m'
CYAN=$'\e[36m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'
MAGENTA=$'\e[35m'; BLUE=$'\e[34m'; RED=$'\e[31m'; GREY=$'\e[90m'

# --- helpers ---
jq_get() { # jq_get <filter> <default>
  if [ -n "$JQ" ]; then
    local v; v="$(printf '%s' "$input" | "$JQ" -r "$1 // empty" 2>/dev/null)"
    [ -n "$v" ] && printf '%s' "$v" || printf '%s' "$2"
  else
    printf '%s' "$2"
  fi
}

fmt_tokens() { # humanize a token count: 1234 -> 1.2k, 1500000 -> 1.5M
  awk -v n="$1" 'BEGIN{
    if (n=="" || n+0<=0){print "0"; exit}
    if (n>=1000000){printf "%.1fM", n/1000000}
    else if (n>=1000){printf "%.1fk", n/1000}
    else {printf "%d", n}
  }'
}

# --- parse JSON fields ---
cwd="$(jq_get '.workspace.current_dir' "$(jq_get '.cwd' "$PWD")")"
model="$(jq_get '.model.display_name' "$(jq_get '.model.id' "Claude")")"
transcript="$(jq_get '.transcript_path' "")"
cost_usd="$(jq_get '.cost.total_cost_usd' "0")"
dur_ms="$(jq_get '.cost.total_duration_ms' "0")"

# --- working directory (basename, with ~ for home) ---
dir_name="$(basename "$cwd" 2>/dev/null)"
[ -z "$dir_name" ] && dir_name="$cwd"

# --- git branch + dirty flag ---
branch=""
if command -v git >/dev/null 2>&1; then
  branch="$(git -C "$cwd" branch --show-current 2>/dev/null)"
  if [ -n "$branch" ]; then
    if [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ]; then
      branch="${branch}*"
    fi
  fi
fi

# --- context tokens: last usage entry in the transcript ---
ctx_tokens=""
if [ -n "$JQ" ] && [ -f "$transcript" ]; then
  reverse="tac"; command -v tac >/dev/null 2>&1 || reverse="tail -r"
  while IFS= read -r line; do
    u="$(printf '%s' "$line" | "$JQ" -r '
      (.message.usage // empty)
      | ((.input_tokens // 0) + (.cache_read_input_tokens // 0) + (.cache_creation_input_tokens // 0))' 2>/dev/null)"
    if [ -n "$u" ] && [ "$u" -gt 0 ] 2>/dev/null; then ctx_tokens="$u"; break; fi
  done < <($reverse "$transcript" 2>/dev/null)
fi

CTX_WINDOW=200000
ctx_remaining_pct=""
if [ -n "$ctx_tokens" ]; then
  ctx_remaining_pct="$(awk -v t="$ctx_tokens" -v w="$CTX_WINDOW" 'BEGIN{
    r=(1 - t/w)*100; if(r<0)r=0; printf "%d", r}')"
fi

# --- burn rate: $/hr and tokens/min ---
burn_usd_hr=""; burn_tok_min=""
if awk -v d="$dur_ms" 'BEGIN{exit !(d+0>0)}'; then
  burn_usd_hr="$(awk -v c="$cost_usd" -v d="$dur_ms" 'BEGIN{printf "%.2f", c/(d/3600000)}')"
  if [ -n "$ctx_tokens" ]; then
    burn_tok_min="$(awk -v t="$ctx_tokens" -v d="$dur_ms" 'BEGIN{printf "%d", t/(d/60000)}')"
  fi
fi

# ---------------- assemble segments ----------------
out=""
sep="${GREY} | ${RESET}"

out+="${CYAN}📁 ${dir_name}${RESET}"

[ -n "$branch" ] && out+="${sep}${GREEN}🌿 ${branch}${RESET}"

out+="${sep}${MAGENTA}🤖 ${model}${RESET}"

if [ -n "$ctx_remaining_pct" ]; then
  cc="$GREEN"
  [ "$ctx_remaining_pct" -lt 50 ] && cc="$YELLOW"
  [ "$ctx_remaining_pct" -lt 20 ] && cc="$RED"
  out+="${sep}${cc}🧠 ${ctx_remaining_pct}%${RESET}"
fi

# cost
cost_disp="$(awk -v c="$cost_usd" 'BEGIN{printf "%.4f", c}')"
out+="${sep}${YELLOW}💵 \$${cost_disp}${RESET}"

# tokens
[ -n "$ctx_tokens" ] && out+="${sep}${BLUE}📊 $(fmt_tokens "$ctx_tokens")${RESET}"

# burn rate
if [ -n "$burn_usd_hr" ]; then
  br="⚡ \$${burn_usd_hr}/hr"
  [ -n "$burn_tok_min" ] && br="${br} · $(fmt_tokens "$burn_tok_min")/min"
  out+="${sep}${DIM}${br}${RESET}"
fi

printf '%s' "$out"
