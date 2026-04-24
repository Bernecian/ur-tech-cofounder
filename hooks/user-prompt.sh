#!/usr/bin/env bash
# UserPromptSubmit — orchestrator hook.
#
# Pipeline (order matters — grounding first, routing second):
#   1. Grounding inject: match .r rules → inline docs + command outputs
#   2. Consultant routing: signal-based nudge to call specialist agents
#   3. Reconcile: match task-shape rules → load docs + verify checklist
#
# Grounding failure never suppresses routing/reconcile output and vice versa.
# All three write to separate vars; combined output emitted once at the end.
#
# Philosophy: MAIN THREAD CODES. Agents are consultants for judgement-heavy
# decisions — design, architecture, security, strategy. Never dispatch implementation.

set -uo pipefail

QUERY="${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs"
GROUNDING="${CLAUDE_PLUGIN_ROOT}/scripts/grounding-inject.js"
LOG="${CLAUDE_PLUGIN_ROOT}/../../../docs/cofounder/.state/hook.log"

prompt=$(jq -r '.prompt // ""' 2>/dev/null || echo "")
lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

ctx_grounding=""
ctx_routing=""
ctx_reconcile=""
ctx_record=""

# ─── 1. Grounding inject (docs + command outputs) ─────────────────────────────
if [ -f "$GROUNDING" ]; then
  raw_g=$(echo "{\"prompt\":$(echo "$prompt" | jq -Rs '.'),\"cwd\":\"$(pwd)\"}" \
    | node "$GROUNDING" 2>/dev/null || echo "")
  if [ -n "$raw_g" ]; then
    ctx_grounding=$(echo "$raw_g" | jq -r '.hookSpecificOutput.additionalContext // ""' 2>/dev/null || echo "")
  fi
fi

# ─── 2. Consultant routing (signal-based nudges) ──────────────────────────────

# Disapproval → critique reminder
if echo "$lower" | grep -qE "this looks bad|looks bad|looks ugly|not good|doesn.t look good|looks wrong|\bugly\b|hate this|terrible|awful|garbage|don.t like|dont like|i don.t like|not liking" 2>/dev/null; then
  ctx_routing="User expressed dissatisfaction. After addressing the issue, capture a durable rule: /cofounder:critique --agent <name> --rule \"<one-liner>\" --severity <hard|soft|anti-pattern>."
fi

# Strategic question → @cofounder
if echo "$lower" | grep -qE "\b(what (should|do) (i|we) (build|ship|do|prioritize|focus|work on)|what.s (next|the priority|the risk)|biggest risk|should (i|we) (build|ship|do)|am i on the right|is this the right (call|idea|move|approach)|stuck on (direction|what))\b" 2>/dev/null; then
  ctx_routing="Strategic question detected. Call @cofounder:cofounder FIRST for a verdict + recommendation. Main thread then executes."

# Design intent → @cofounder:design
elif echo "$lower" | grep -qE "\b(design|redesign|ui|ux|layout|spacing|typography|padding|margin|shadow|screen|modal|sheet|button|header|footer|card|list row|affordance|look|looks|looking|feel|feels|polish|icon|color|colour|wireframe|mockup)\b" 2>/dev/null; then
  ctx_routing="Design intent detected. Call @cofounder:design FIRST — it explores, asks, and writes a spec. Main thread implements from the spec."

# Architecture → @cofounder:architect-review
elif echo "$lower" | grep -qE "\b(architect|structure|module boundary|refactor for scale|coupling|layering|service boundary|api design|schema design|data ownership|domain model|bounded context|monorepo structure|folder structure)\b" 2>/dev/null; then
  ctx_routing="Structural question detected. Call @cofounder:architect-review FIRST. Returns verdict + recommendations. Main thread applies."

# Security → @cofounder:security-auditor
elif echo "$lower" | grep -qE "\b(security|auth|token|password|encrypt|secret|credential|xss|csrf|injection|vulner|owasp|sql injection|rate limit|jwt|oauth|session fixation|keychain|keystore|deep link|webview)\b" 2>/dev/null; then
  ctx_routing="Security-sensitive prompt. Call @cofounder:security-auditor FIRST (pass --scope backend|mobile|web). Main thread applies the fix list."
fi

# ─── 3. Reconcile layer (task-shape rules) ────────────────────────────────────
if [ -f "$QUERY" ]; then
  ctx_reconcile=$(node "$QUERY" rules-match-prompt "$prompt" 2>/dev/null || echo "")
fi

# ─── 4. Session-recording nudge ───────────────────────────────────────────────
# Soft hint only — fires when (a) files were edited since last record AND
# (b) the user's prompt looks like a context switch (natural checkpoint).
# Claude decides whether to act. Flag is cleared by query.mjs save on success.
DIRTY_FLAG="$(pwd)/docs/cofounder/.state/session-dirty"
if [ -f "$DIRTY_FLAG" ]; then
  if echo "$lower" | grep -qE "\b(ok next|next task|next thing|moving on|let.s move on|done with (that|this)|that.s done|ship it|wrap (it )?up|switching gears|different (topic|task)|now (let.s|do|let me)|new (task|feature|thing))\b" 2>/dev/null; then
    ctx_record="Context switch detected and files were edited since the last session record. Consider invoking the session-recording skill to persist a compact entry to the active thread before moving on. If the work was trivial, skip; when in doubt, log."
  fi
fi

# ─── Emit combined additionalContext ─────────────────────────────────────────
parts=()
[ -n "$ctx_grounding" ] && parts+=("$ctx_grounding")
[ -n "$ctx_routing"   ] && parts+=("$ctx_routing")
[ -n "$ctx_reconcile" ] && parts+=("$ctx_reconcile")
[ -n "$ctx_record"    ] && parts+=("$ctx_record")

if [ ${#parts[@]} -gt 0 ]; then
  combined=$(printf '%s\n\n' "${parts[@]}")
  jq -n --arg c "$combined" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$c}}'
fi

# Log hook execution for debugging (silent, non-blocking)
if [ -n "${LOG:-}" ]; then
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
  echo "[$(date -u +%H:%M:%S)] user-prompt grounding=$([ -n "$ctx_grounding" ] && echo "hit" || echo "miss") routing=$([ -n "$ctx_routing" ] && echo "hit" || echo "miss") reconcile=$([ -n "$ctx_reconcile" ] && echo "hit" || echo "miss") record=$([ -n "$ctx_record" ] && echo "hit" || echo "miss")" >> "$LOG" 2>/dev/null || true
fi
