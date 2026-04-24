#!/usr/bin/env bash
# PostToolUse — re-emit verify checklist after edits; catch commit convention violations.

set -uo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

QUERY="${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs"
[ -f "$QUERY" ] || exit 0

rules_out=""

case "$tool_name" in
  Write|Edit|MultiEdit|NotebookEdit)
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' 2>/dev/null || echo "")
    [ -z "$file_path" ] && exit 0
    cwd=$(pwd)
    rel_path="${file_path#$cwd/}"

    # Mark session dirty so Stop hook can auto-trigger session recording
    state_dir="${cwd}/docs/cofounder/.state"
    mkdir -p "$state_dir" 2>/dev/null || true
    touch "${state_dir}/session-dirty" 2>/dev/null || true

    rules_out=$(node "$QUERY" rules-match-path "$rel_path" 2>/dev/null || echo "")
    [ -n "$rules_out" ] && rules_out="✅ Post-edit check — verify task-shape rules still hold:"$'\n\n'"$rules_out"
    ;;
  Bash)
    cmd=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
    [ -z "$cmd" ] && exit 0
    rules_out=$(node "$QUERY" rules-match-prompt "$cmd" 2>/dev/null || echo "")
    [ -n "$rules_out" ] && rules_out="✅ Post-command check — verify task-shape rules still hold:"$'\n\n'"$rules_out"
    ;;
  *) exit 0 ;;
esac

[ -z "$rules_out" ] && exit 0
jq -n --arg c "$rules_out" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
