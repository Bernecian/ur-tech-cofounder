#!/usr/bin/env bash
# PreToolUse — inject reconcile rules before Write/Edit/MultiEdit/NotebookEdit.
# Matches the target file path against docs/cofounder/rules/reconcile.json.

set -uo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

case "$tool_name" in
  Write|Edit|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' 2>/dev/null || echo "")
[ -z "$file_path" ] && exit 0

cwd=$(pwd)
rel_path="${file_path#$cwd/}"

QUERY="${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs"
[ -f "$QUERY" ] || exit 0

rules_out=$(node "$QUERY" rules-match-path "$rel_path" 2>/dev/null || echo "")
[ -z "$rules_out" ] && exit 0

jq -n --arg c "$rules_out" '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$c}}'
