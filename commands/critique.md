---
description: "Capture a taste rule for a specific agent so it remembers it next session. Pass --agent <name> --rule \"<text>\" and optionally --severity <hard|soft|anti-pattern> (default: soft) and --scope <project-slug|all> (default: all)."
argument-hint: "--agent <name> --rule \"<rule text>\" [--severity hard|soft|anti-pattern] [--scope <slug|all>]"
---

# Cofounder Critique

Appends a learning to `docs/cofounder/learnings/<agent>.md`. The only sanctioned way to teach an agent a new rule.

## Step 0 — Parse and validate

Parse `$ARGUMENTS`:

| Flag | Required | Default |
|---|---|---|
| `--agent` | YES | — |
| `--rule` | YES | — |
| `--severity` | no | `soft` |
| `--scope` | no | `all` |

If `--agent` or `--rule` is missing, error loudly and stop:

```
Error: Both --agent and --rule are required.

Usage: /cofounder:critique --agent design --rule "prefer left-aligned headers" --severity soft

Flags:
  --agent     <name>                     e.g. design, architect-review, cofounder
  --rule      "<text>"                   plain English (quote it)
  --severity  hard|soft|anti-pattern     hard = must follow; soft = preference; anti-pattern = never
  --scope     <project-slug|all>         where this applies (default: all)
```

Valid agents: `cofounder`, `design`, `architect-review`, `security-auditor`.

Validate severity: if provided but not `hard`/`soft`/`anti-pattern`, error.

## Step 1 — Persist the learning

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" add-learning \
  '{"agent":"<agent>","rule":"<rule>","severity":"<severity>","scope":"<scope>"}'
```

## Step 2 — Confirm

Output:
```
Logged for <agent>: <rule> [<severity>, scope: <scope>]

File: docs/cofounder/learnings/<agent>.md
This rule will be loaded by the agent's instructions on next invocation.
```

If this is the first entry for this agent, add:
```
Note: Created docs/cofounder/learnings/<agent>.md for the first time.
```
