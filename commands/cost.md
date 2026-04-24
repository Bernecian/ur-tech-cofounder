---
description: "Show token cost report across all Claude Code sessions. Tells you where Opus is going so you can spot wasteful patterns. Runs locally — no LLM tokens spent."
argument-hint: "[--days <N>] [--by project|model|day]"
---

# Cofounder Cost

Run the cost report and relay the output verbatim. Zero LLM tokens needed — pure Python aggregation.

## What to do

Parse `$ARGUMENTS` for `--days N` (default 7) and `--by <project|model|day>` (default project).

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/persistence/cost.py" $ARGUMENTS
```

Output the result verbatim. No summarizing, no commentary.

## Interpretation hints (only if user asks)

- **Opus > 80%**: most routine implementation should route to Sonnet.
- **Haiku near zero**: wrapup/brief aren't delegating. Run `/cofounder:brief` and `/cofounder:wrapup` — they use Haiku subagents.
- **Single project dominates**: check if that project's CLAUDE.md is pushing Opus.
