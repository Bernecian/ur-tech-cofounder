#!/usr/bin/env bash
# SessionStart hook — loads vault context + warms grounding cache.
# Zero LLM tokens. Emits routing rules + active thread + learnings count.

set -o pipefail

CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
QUERY="${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs"
GROUNDING_BOOT="${CLAUDE_PLUGIN_ROOT}/scripts/grounding-boot.js"

# ─── 1. Warm grounding cache (async, non-blocking) ────────────────────────────
node "$GROUNDING_BOOT" 2>/dev/null &
disown 2>/dev/null || true

# ─── 2. Learnings count ───────────────────────────────────────────────────────
learnings=""
if [ -f "$QUERY" ]; then
  learnings=$(node "$QUERY" learnings-count 2>/dev/null || echo "")
fi

# ─── 3. Active thread context ─────────────────────────────────────────────────
thread_ctx=""
if [ -f "$QUERY" ]; then
  raw=$(node "$QUERY" current 2>/dev/null || echo "")
  if [ -n "$raw" ] && ! echo "$raw" | grep -q "^No current thread" 2>/dev/null; then
    thread_ctx="$raw"
  else
    available=$(node "$QUERY" threads 2>/dev/null || echo "")
    if [ -n "$available" ]; then
      thread_ctx="No active thread. Available:"$'\n'"$available"$'\n\nPick one: /cofounder:thread <slug>  or start new: /cofounder:wrapup --slug <name>'
    fi
  fi
fi

# ─── 4. Assemble + emit ───────────────────────────────────────────────────────
routing_rules="Cofounder routing (consultant pattern — main thread codes):

  1. Strategic ('what should I build', 'is this right', 'what's next')
     → @cofounder:cofounder returns verdict; main thread executes.

  2. Design / UX / layout / 'looks bad' / screen polish
     → @cofounder:design explores + writes spec; main thread implements from spec.

  3. Architecture / coupling / module boundary / refactor-for-scale
     → @cofounder:architect-review returns findings; main thread applies.

  4. Security / auth / tokens / secrets / XSS / CSRF / injection
     → @cofounder:security-auditor (--scope backend|mobile|web); main thread fixes.

  5. Implementation, debugging, refactoring, testing, 'fix this'
     → MAIN THREAD handles directly. Grounding + reconcile inject context automatically.

  6. End of feature / decision made / code committed
     → /cofounder:wrapup --slug <name> persists to docs/cofounder/threads/."

ctx="$routing_rules"
[ -n "$learnings" ] && ctx+=$'\n\nLearnings: '"$learnings"$'. Full rules: /cofounder:brief'
[ -n "$thread_ctx" ] && ctx+=$'\n\nThread context:\n'"$thread_ctx"

[ -n "$ctx" ] || exit 0

jq -n --arg s "$ctx" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$s}}'
