---
date: <required — YYYY-MM-DD>
task_slug: <required — kebab-case slug>
classification: <required — bug-fix | feature | review | security | architecture | research | performance | test | strategy>
entry_agent: <required — team | dev | cofounder>
delegated_to: <required — list subagent types e.g. [architect-review, code-reviewer] or [none] for solo work. NEVER leave as []>
autonomous: <required — true | false>
status: <required — complete | in-progress | blocked>
produced_decision: <omit this field if no decision was recorded, otherwise dec-YYYY-MM-DD-slug>
tags: [session]
---

# {{Task title — one line}}

> [!info] TL;DR
> {{One sentence: what was asked and what happened.}}

## Ask

{{User's original prompt, verbatim.}}

## Classification

- **Kind:** {{bug-fix / feature / review / security / ...}}
- **Scope:** {{files / area of codebase touched or considered}}
- **Autonomy:** {{asked-for-clarification | implemented-without-asking | advisory-only}}

## Context loaded

{{List files read, memories recalled, docs consulted. Cite paths.}}

- Read: `path/to/file.ts`
- Doc: `path/to/decisions-log.md`
- Recent git: last 5 commits on {{branch}}

## Agents used

| Agent | Model | Purpose |
|---|---|---|
| {{code-reviewer}} | sonnet | {{spot-check auth handler}} |

## Findings / Decisions

{{Numbered list of conclusions. One sentence each. Link to a decision doc if it's a real architectural choice.}}

1. …
2. …

## Actions taken

{{What was actually changed. Empty if advisory-only.}}

- Edited: `path/to/file.ts:45` — {{what changed}}
- Created: `path/to/new-file.ts`

## Follow-ups

{{Anything punted. Bullet per item with a where/how link if possible.}}

- [ ] …

## Related

- Roadmap: {{link or path}}
- Decisions log: {{link or path}}
- Prior session: {{link to prior related session}}
