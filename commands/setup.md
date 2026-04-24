---
description: "One-time per-project setup: scaffolds the cofounder vault at docs/cofounder/, migrates legacy .cofounder/ JSON if present, copies rule templates, and wires the SessionStart hook into .claude/settings.json. Run once per project."
argument-hint: ""
---

# Cofounder Setup (per-project)

Runs the setup script which is idempotent — safe to run again if anything is out of sync.

## Step 1 — Run the setup script

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs"
```

Relay the output verbatim to the user. The script handles everything:
- Detects and migrates old `.cofounder/` JSON store
- Creates `docs/cofounder/` vault skeleton
- Copies `grounding.yaml` and `reconcile.json` rule templates
- Adds `docs/cofounder/.state/` to `.gitignore`
- Wires `SessionStart` hook into `.claude/settings.json`

## Step 2 — Validate

```bash
jq -e '.hooks.SessionStart[0].hooks[0].type' .claude/settings.json
```

Must return `"command"`. If it fails or the file doesn't exist, show the error.

## Step 3 — Generate context-aware rules

If `CLAUDE.md` exists in the project root, run `/cofounder:regen-rules` now.
It scans the project with a Haiku subagent and writes rules that actually match
this codebase — only loads docs that exist, keywords that reflect the real workflow.

Skip only if the project has no `CLAUDE.md` yet (the minimal template rules are
a sufficient placeholder until one exists).

## Step 4 — Confirm

After the script and rule generation succeed, tell the user:

```
Cofounder installed.

  Vault:    docs/cofounder/           ← commit this directory
  Rules:    docs/cofounder/rules/grounding.yaml
            docs/cofounder/rules/reconcile.json

Next steps:
  1. Open a new Claude Code session — watch for "Cofounder loading context..." in the status line.
  2. Run /cofounder:brief to verify the vault is working.
  3. Re-generate rules anytime with /cofounder:regen-rules.

Commit the vault:
  git add docs/cofounder && pnpm commit -- --type chore --scope cofounder --message "init cofounder vault"
```
