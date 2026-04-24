---
name: session-recording
description: Use at the end of a meaningful unit of work (feature shipped, decision made, refactor landed, learning captured) to persist a compact entry to the active cofounder thread. NOT for end-of-turn. Keeps context across conversations without bloating the store.
---

# Session Recording

Your job: decide whether this turn warrants a persistent entry, and if so, call `/cofounder:wrapup` with the right slug. Nothing more.

## The gate — write an entry if ANY of these are true

- Production code was modified (committed OR uncommitted — the work happened, it deserves a trace)
- A decision was made, even a small one ("we chose X over Y")
- An architectural change, refactor, or new module landed
- An agent learning was captured via `/cofounder:critique`
- The user explicitly asked to remember / log / wrap up

**Skip when:** pure read / explore / Q&A with zero file edits AND no decisions.

If skipping, reply with one line: `skip: <reason>` and do nothing else.

When in doubt → write. Missing entries are worse than redundant ones.

## What "compact" means

The thread store is built for fast scanning across many sessions. Each entry is:

- A summary of ≤3 bullets, ≤15 words each — what changed and why
- An array of short decision strings
- An array of short open-question strings
- An array of agent names invoked
- An array of model names used
- A commit sha (or `pending`)

If you find yourself writing paragraphs, you're doing it wrong. Compress.

## The mechanics

1. Pick a `--slug` for the thread. Re-use an existing thread slug if this work continues a prior feature; create a new slug for a new feature.
2. Run `/cofounder:wrapup --slug <slug>`. The command delegates to the haiku formatter and persists via `query.mjs save`.
3. Confirm the one-line output (`saved session <id> to thread <slug> (N total)`) before ending the turn.

Session entries are written to `docs/cofounder/threads/<slug>/sessions/` as markdown. The vault is the source of truth.

## What NOT to save

- Step-by-step narration of what you did — the diff has it
- Code snippets — they live in git
- Reasoning walk-throughs — pointless to re-read later
- "What I learned about TypeScript today" — unless it's a repeatable rule; then use `/cofounder:critique` instead

Persistent entries are for **load-bearing state**: what decision was made, what's still open, what thread to pick up next session.

## One pathological anti-pattern

A session entry per turn turns the thread store into log spam. Only write when the work has a natural checkpoint. Three turns editing a single file = one entry at the end, not three entries along the way.
