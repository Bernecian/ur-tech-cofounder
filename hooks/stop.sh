#!/usr/bin/env bash
# Reads the most recent session JSONL for this project and prints a compact
# single-line token summary. Called by the wrapup command.
# Output: tokens: <n>in/<n>out/<n>cache ~$<cost>

set -euo pipefail

python3 - "$@" <<'PYEOF'
import json, sys, os
from pathlib import Path
from collections import defaultdict

# ── Find session JSONL ───────────────────────────────────────────────────────
home = Path.home()
cwd  = os.getcwd()
slug = cwd.replace('/', '-')           # /Users/foo/bar → -Users-foo-bar
project_dir = home / '.claude' / 'projects' / slug

if not project_dir.exists():
    # Fallback: most-recently-touched project dir
    candidates = list((home / '.claude' / 'projects').glob('*/'))
    if not candidates:
        sys.exit(0)
    project_dir = max(candidates, key=lambda p: p.stat().st_mtime)

files = sorted(project_dir.glob('*.jsonl'), key=lambda p: p.stat().st_mtime, reverse=True)
if not files:
    sys.exit(0)

session_file = files[0]

# ── Parse assistant turns ────────────────────────────────────────────────────
stats = defaultdict(lambda: {'input': 0, 'output': 0, 'cache_read': 0, 'cache_write': 0, 'turns': 0})

with open(session_file) as f:
    for line in f:
        try:
            obj = json.loads(line.strip())
            if obj.get('type') != 'assistant':
                continue
            msg   = obj.get('message', {})
            usage = msg.get('usage') or obj.get('usage')
            model = msg.get('model') or obj.get('model') or 'unknown'
            if not usage:
                continue

            # Normalise model to a short key
            m = model.lower()
            if   'opus' in m and ('4-7' in m or '4.7' in m):  key = 'opus-4.7'
            elif 'opus' in m and ('4-5' in m or '4.5' in m):  key = 'opus-4.5'
            elif 'sonnet' in m and ('4-6' in m or '4.6' in m): key = 'sonnet-4.6'
            elif 'sonnet' in m and ('4-5' in m or '4.5' in m): key = 'sonnet-4.5'
            elif 'haiku' in m:                                  key = 'haiku-4.5'
            else:                                               key = model.split('@')[0]

            stats[key]['input']       += usage.get('input_tokens', 0)
            stats[key]['output']      += usage.get('output_tokens', 0)
            stats[key]['cache_read']  += usage.get('cache_read_input_tokens', 0)
            stats[key]['cache_write'] += usage.get('cache_creation_input_tokens', 0)
            stats[key]['turns']       += 1
        except Exception:
            pass

if not stats:
    sys.exit(0)

# ── Approximate pricing (Anthropic list rates, per 1M tokens) ────────────────
PRICES = {
    'opus-4.7':   {'input': 15.00, 'output': 75.00, 'cache_read': 1.50,  'cache_write': 18.75},
    'opus-4.5':   {'input': 15.00, 'output': 75.00, 'cache_read': 1.50,  'cache_write': 18.75},
    'sonnet-4.6': {'input':  3.00, 'output': 15.00, 'cache_read': 0.30,  'cache_write':  3.75},
    'sonnet-4.5': {'input':  3.00, 'output': 15.00, 'cache_read': 0.30,  'cache_write':  3.75},
    'haiku-4.5':  {'input':  0.80, 'output':  4.00, 'cache_read': 0.08,  'cache_write':  1.00},
}
DEFAULT_PRICE = {'input': 3.00, 'output': 15.00, 'cache_read': 0.30, 'cache_write': 3.75}

def approx_cost(key, s):
    p = PRICES.get(key, DEFAULT_PRICE)
    return (
        s['input']       * p['input']       / 1e6 +
        s['output']      * p['output']      / 1e6 +
        s['cache_read']  * p['cache_read']  / 1e6 +
        s['cache_write'] * p['cache_write'] / 1e6
    )

def fmt(n):
    if n >= 1_000_000: return f'{n/1e6:.2f}M'
    if n >= 1_000:     return f'{n/1000:.1f}k'
    return str(n)

# ── Compact single-line output ────────────────────────────────────────────────
total_in    = sum(s['input']       for s in stats.values())
total_out   = sum(s['output']      for s in stats.values())
total_cache = sum(s['cache_read']  for s in stats.values())
total_cost  = sum(approx_cost(k, s) for k, s in stats.items())

# ── Delta since last invocation ──────────────────────────────────────────────
cache_path = home / '.claude' / 'state' / f'_usage-{session_file.stem}.json'
cache_path.parent.mkdir(parents=True, exist_ok=True)
prev = {'in': 0, 'out': 0, 'cache': 0, 'cost': 0.0}
if cache_path.exists():
    try:
        prev = json.loads(cache_path.read_text())
    except Exception:
        pass

d_in    = total_in    - prev.get('in', 0)
d_out   = total_out   - prev.get('out', 0)
d_cache = total_cache - prev.get('cache', 0)
d_cost  = total_cost  - prev.get('cost', 0.0)

cache_path.write_text(json.dumps({'in': total_in, 'out': total_out, 'cache': total_cache, 'cost': total_cost}))

print(f'Δ {fmt(d_in)}in/{fmt(d_out)}out/{fmt(d_cache)}cache ~${d_cost:.3f} · session {fmt(total_in)}in/{fmt(total_out)}out/{fmt(total_cache)}cache ~${total_cost:.2f}')
PYEOF

# Auto-touch the active thread — creates a session record for today if none exists.
# Idempotent: no-op if today's session already exists. Zero LLM cost.
QUERY="${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs"
if [ -f "$QUERY" ]; then
  node "$QUERY" touch 2>/dev/null || true
fi
