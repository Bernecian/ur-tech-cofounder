# cofounder

AI tech cofounder plugin for Claude Code. **Consultant agents + git-backed vault memory + pre-flight grounding.**

## Install

```bash
# Option A — plugin marketplace (recommended)
/plugin marketplace add Bernecian/ur-tech-cofounder
/plugin install cofounder@cofounder

# Option B — manual
claude plugin install /path/to/cofounder
```

Then run once per project:

```bash
/cofounder:setup
```

That's it. The setup command scaffolds your vault, copies rule templates, and wires the hook.

---

## The philosophy

**Main thread is the engineer.** It reads code, writes code, runs tests, commits. Don't hand coding off to a subagent — you lose context and gain nothing.

**Agents are consultants.** Call one when the decision is judgement-heavy: a design direction, an architectural boundary, a security posture, a strategic priority. The consultant researches and returns a structured findings payload (verdict + recommendations). Main thread applies it.

**Memory is git-backed.** Sessions, decisions, and taste rules live as markdown in `docs/cofounder/`. Commit it, push it. New machine? `git clone` and memory is intact. No cloud, no accounts.

**Grounding is pre-flight.** Before Claude reasons, matched rules inject docs and trusted shell commands as context — automatically, at hook time.

---

## Agents

| Agent | Model | When to call |
|---|---|---|
| `@cofounder:cofounder` | Opus | "What should I build / ship / prioritize?" Returns a verdict. |
| `@cofounder:design` | Opus | UI/UX, layout, screen polish. Explores → asks → writes a spec. Main thread implements from spec. |
| `@cofounder:architect-review` | Opus | Module boundaries, coupling, refactor-for-scale. Returns VERDICT + findings + fixes. |
| `@cofounder:security-auditor` | Opus | Auth, tokens, secrets, injection. Pass `--scope backend\|mobile\|web`. |
| `@cofounder:brief-reader` | Haiku | Internal — used by `/cofounder:brief`. |
| `@cofounder:wrapup-writer` | Haiku | Internal — used by `/cofounder:wrapup`. |

---

## Commands

| Command | What it does |
|---|---|
| `/cofounder:setup` | One-time per-project setup. Scaffolds vault, migrates legacy data, wires hooks. |
| `/cofounder:brief` | Start-of-session brief. Reads vault + git state, outputs ≤30 lines. Runs on Haiku. |
| `/cofounder:wrapup --slug <name>` | Persist a session entry to the vault. Runs on Haiku. |
| `/cofounder:thread [<slug>]` | Switch active thread or list all. |
| `/cofounder:critique --agent <name> --rule "<text>"` | Capture a taste rule so the agent remembers it next session. |
| `/cofounder:cost [--days N]` | Token cost report. Zero LLM — pure local aggregation. |

---

## Vault layout

After `/cofounder:setup`, your project gets:

```
docs/cofounder/
  index.md                          ← active thread + roster
  threads/
    <slug>/
      thread.md                     ← digest + active focus
      sessions/
        2026-04-25.md               ← one file per session (append-only)
      decisions/
        0001-use-neon.md            ← ADR-style decision records
      questions.md                  ← open questions
  learnings/
    design.md                       ← taste rules per agent (via /cofounder:critique)
    architect-review.md
  rules/
    grounding.yaml                  ← pre-flight rules (edit this)
    reconcile.json                  ← task-shape → docs + verify checklists
  .state/                           ← git-ignored: cache + active thread pointer
```

Commit `docs/cofounder/`. Push it. That's the persistence model.

---

## Grounding rules

Edit `docs/cofounder/rules/grounding.yaml`:

```yaml
rules:
  - name: auth-surface
    match:
      keywords: [auth, login, token, session, jwt]
    load:
      - docs/auth.md
    run:
      - cmd: "grep -rn 'SECRET\\|API_KEY' src/ | head -20 || true"
    trust: true
    reason: Ground auth work in the current secret-handling surface.
```

Rules fire at every `UserPromptSubmit`. Matched docs + command outputs are injected before Claude reasons. Budget: 16 KB total.

---

## Task-shape rules

Edit `docs/cofounder/rules/reconcile.json`:

```json
{
  "taskShapes": {
    "commit": {
      "match": { "prompt": ["commit", "ship it"] },
      "load": ["CLAUDE.md"],
      "verify": ["Used project commit convention"]
    }
  }
}
```

Injected automatically at `UserPromptSubmit` and before every file edit (`PreToolUse`).

---

## Routing

The `UserPromptSubmit` hook classifies every prompt and nudges the main thread:

| Signal | Consultant |
|---|---|
| "what should I build / prioritize" | `@cofounder:cofounder` |
| design / layout / UI / polish | `@cofounder:design` |
| architecture / module boundary / coupling | `@cofounder:architect-review` |
| auth / token / secret / injection | `@cofounder:security-auditor` |
| everything else | main thread handles directly |

---

## License

MIT — see [LICENSE](LICENSE).
