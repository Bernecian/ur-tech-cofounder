---
description: "End-of-feature session note. Delegates formatting to @wrapup-writer (Haiku) then persists a markdown session file to docs/cofounder/threads/<slug>/sessions/. Pass --slug (required), --project (optional), --commit (default pending), --status (default complete)."
argument-hint: "--slug <kebab-case> [--project <name>] [--commit <sha|pending>] [--status <complete|wip|blocked>]"
---

# Cofounder Wrapup

> **Write a session entry when any of these are true:**
>   - Prod code was modified (committed OR uncommitted)
>   - A decision was made (even small — "we chose X over Y")
>   - An architectural change or new module landed
>   - An agent learning was captured
>   - The user asked to log / remember / wrap up
>
> **Skip** when: pure read/explore with zero file edits AND no decisions.
> When in doubt → write. Missing entries are worse than redundant ones.

## Step 0 — Parse arguments

Parse `$ARGUMENTS`. Required: `--slug`. Optional: `--project`, `--commit` (default `pending`), `--status` (default `complete`).

If `--slug` is missing, error and stop.

## Step 1 — Delegate formatting to @wrapup-writer

Invoke Agent tool with subagent_type `wrapup-writer`. Pass all context including:
- Flags: slug, project, commit, status
- What happened this session (1-3 sentences)
- Files changed
- Decisions made
- Open questions
- Agents invoked
- Models used

The wrapup-writer returns a single-line JSON object. Capture it.

## Step 2 — Persist to vault

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" save '<JSON_FROM_STEP_1>'
```

The script writes `docs/cofounder/threads/<slug>/sessions/<date>.md` and sets the active thread.

Print the confirmation line from the script.

## Step 3 — Update digest (optional but recommended for significant sessions)

If this was a meaningful session (shipped feature, key decision), ask @wrapup-writer to also produce a 1-line "Active focus" update, then:

```bash
# The wrapup-writer handles this automatically if given the instruction.
# The query.mjs save call already updates thread.md updatedAt.
```

## Why lean

- Session entry = one markdown file in `docs/cofounder/threads/<slug>/sessions/`
- Human-readable, git-diffable, cross-machine
- Formatter runs on Haiku — ~20× cheaper than Opus
- No separate docs/sessions/*.md files — vault is the source of truth
