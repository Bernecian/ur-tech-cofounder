#!/usr/bin/env python3
"""
cofounder cost report — aggregates token usage across ALL Claude Code
session logs, not just the current project. Tells you where Opus is
going so you can spot wasteful patterns.

Usage:
    python3 cost.py                 # last 7 days
    python3 cost.py --days 30       # custom range
    python3 cost.py --by project    # group by project (default)
    python3 cost.py --by model      # group by model
    python3 cost.py --by day        # group by day
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta, timezone

# ─── Pricing (per 1M tokens, Anthropic list rates) ───────────────────────────
PRICES = {
    'opus-4.7':   {'input': 15.00, 'output': 75.00, 'cache_read': 1.50,  'cache_write': 18.75},
    'opus-4.5':   {'input': 15.00, 'output': 75.00, 'cache_read': 1.50,  'cache_write': 18.75},
    'sonnet-4.6': {'input':  3.00, 'output': 15.00, 'cache_read': 0.30,  'cache_write':  3.75},
    'sonnet-4.5': {'input':  3.00, 'output': 15.00, 'cache_read': 0.30,  'cache_write':  3.75},
    'haiku-4.5':  {'input':  0.80, 'output':  4.00, 'cache_read': 0.08,  'cache_write':  1.00},
}
DEFAULT_PRICE = {'input': 3.00, 'output': 15.00, 'cache_read': 0.30, 'cache_write': 3.75}


def normalize_model(model):
    m = (model or '').lower()
    if 'opus'   in m and ('4-7' in m or '4.7' in m): return 'opus-4.7'
    if 'opus'   in m and ('4-5' in m or '4.5' in m): return 'opus-4.5'
    if 'opus'   in m: return 'opus-4.7'  # assume latest
    if 'sonnet' in m and ('4-6' in m or '4.6' in m): return 'sonnet-4.6'
    if 'sonnet' in m and ('4-5' in m or '4.5' in m): return 'sonnet-4.5'
    if 'sonnet' in m: return 'sonnet-4.6'
    if 'haiku'  in m: return 'haiku-4.5'
    return m.split('@')[0] or 'unknown'


def approx_cost(model_key, usage):
    p = PRICES.get(model_key, DEFAULT_PRICE)
    return (
        usage['input']       * p['input']       / 1e6 +
        usage['output']      * p['output']      / 1e6 +
        usage['cache_read']  * p['cache_read']  / 1e6 +
        usage['cache_write'] * p['cache_write'] / 1e6
    )


def fmt_tokens(n):
    if n >= 1_000_000: return f'{n/1e6:.2f}M'
    if n >= 1_000:     return f'{n/1000:.1f}k'
    return str(n)


def parse_args(argv):
    days = 7
    by = 'project'
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--days' and i + 1 < len(argv):
            days = int(argv[i + 1]); i += 2
        elif a == '--by' and i + 1 < len(argv):
            by = argv[i + 1]; i += 2
        else:
            i += 1
    if by not in ('project', 'model', 'day'):
        print(f'Invalid --by: {by} (use project | model | day)', file=sys.stderr)
        sys.exit(1)
    return days, by


def iter_sessions(since_iso):
    """Yield (project_slug, session_file_path, line_obj) for each assistant turn."""
    home = Path.home()
    projects_dir = home / '.claude' / 'projects'
    if not projects_dir.exists():
        return

    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue
        project_slug = project_dir.name
        for jsonl_file in project_dir.glob('*.jsonl'):
            try:
                with open(jsonl_file) as f:
                    for line in f:
                        try:
                            obj = json.loads(line.strip())
                        except Exception:
                            continue
                        if obj.get('type') != 'assistant':
                            continue
                        ts = obj.get('timestamp') or obj.get('message', {}).get('timestamp')
                        if ts and ts < since_iso:
                            continue
                        yield project_slug, jsonl_file, obj
            except Exception:
                continue


def project_label(slug):
    """Turn -Users-macbook-Projects-self into projects-self"""
    parts = [p for p in slug.replace('\\', '/').split('-') if p]
    # keep last 2 non-empty segments for readability
    return '/'.join(parts[-2:]) if len(parts) >= 2 else slug


def main():
    days, by = parse_args(sys.argv[1:])
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    # buckets: key -> model -> {input, output, cache_read, cache_write, turns}
    buckets = defaultdict(lambda: defaultdict(lambda: {
        'input': 0, 'output': 0, 'cache_read': 0, 'cache_write': 0, 'turns': 0,
    }))

    for project_slug, jsonl_file, obj in iter_sessions(since_iso):
        msg = obj.get('message', {})
        usage = msg.get('usage') or obj.get('usage')
        if not usage:
            continue
        model = normalize_model(msg.get('model') or obj.get('model'))

        # Determine bucket key
        if by == 'project':
            key = project_label(project_slug)
        elif by == 'model':
            key = model
        else:  # day
            ts = obj.get('timestamp') or ''
            key = ts[:10] if ts else 'unknown'

        b = buckets[key][model]
        b['input']       += usage.get('input_tokens', 0)
        b['output']      += usage.get('output_tokens', 0)
        b['cache_read']  += usage.get('cache_read_input_tokens', 0)
        b['cache_write'] += usage.get('cache_creation_input_tokens', 0)
        b['turns']       += 1

    if not buckets:
        print(f'No sessions in the last {days} days.')
        return

    # Rollup totals + print
    total_cost = 0
    total_by_model = defaultdict(float)

    rows = []
    for key, models in buckets.items():
        key_cost = 0
        key_models = []
        for model, usage in models.items():
            c = approx_cost(model, usage)
            key_cost += c
            total_by_model[model] += c
            key_models.append((model, usage, c))
        total_cost += key_cost
        rows.append((key, key_cost, key_models))

    rows.sort(key=lambda r: -r[1])

    print(f'Cost report — last {days} days · grouped by {by}')
    print(f'Total: ~${total_cost:.2f}')
    print()

    # Model breakdown line
    by_model_str = ' · '.join(
        f'{m}: ${c:.2f}' for m, c in sorted(total_by_model.items(), key=lambda x: -x[1])
    )
    print(f'By model: {by_model_str}')
    print()

    # Top buckets
    for key, key_cost, models in rows[:20]:
        pct = (key_cost / total_cost * 100) if total_cost > 0 else 0
        print(f'{key}  ~${key_cost:.2f}  ({pct:.0f}%)')
        for model, usage, cost in sorted(models, key=lambda m: -m[2]):
            tokens = fmt_tokens(usage['input'] + usage['output'])
            print(f'  {model:12s} {tokens:>7s}  {usage["turns"]:>4d} turns  ${cost:.3f}')
        print()


if __name__ == '__main__':
    main()
