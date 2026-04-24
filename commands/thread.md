---
description: "Switch the active cofounder thread. Decoupled from git — work on any thread regardless of branch. No args = show current + available. Pass a slug to switch."
argument-hint: "[<slug>]"
---

# Cofounder Thread

Manage which thread is active. The active thread is loaded on SessionStart and is what `/cofounder:wrapup` appends to by default.

## What to do

Parse `$ARGUMENTS`.

### Case 1: empty — show status

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" current
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" threads
```

Run both in parallel. Output current thread (if any), then the list. Terse — no commentary.

### Case 2: slug provided — switch

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" set-current "<slug>"
node "${CLAUDE_PLUGIN_ROOT}/lib/vault/query.mjs" thread "<slug>"
```

Relay the output. If `set-current` errors with "No thread", tell the user to create it first via `/cofounder:wrapup --slug <slug>`.

## Why

Git branches and work threads are orthogonal. The active thread pointer lives at `docs/cofounder/.state/current.json` (git-ignored — it's a machine-local working state, not a shared artifact). Updated automatically by `/cofounder:wrapup`, or explicitly here.
