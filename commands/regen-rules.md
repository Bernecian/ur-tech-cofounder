---
description: "Scan the project with a Haiku subagent and regenerate docs/cofounder/rules/grounding.yaml + reconcile.json with context-aware rules based on what docs actually exist."
argument-hint: ""
---

# Cofounder: Regenerate Rules

Scans the project and rewrites both rule files with rules that match the actual codebase.
Safe to re-run anytime the project evolves.

## Step 1 — Collect project context

Run these commands and hold the results for the Haiku prompt:

```bash
# What docs exist (exclude cofounder vault itself)
find docs/ -name "*.md" -not -path "*/cofounder/*" 2>/dev/null | sort || true
```

```bash
# App/package structure
ls apps/ packages/ 2>/dev/null || true
```

```bash
# CLAUDE.md (the primary source of truth)
cat CLAUDE.md 2>/dev/null || echo "(no CLAUDE.md)"
```

```bash
# Existing grounding.yaml (preserve any manually written rules)
cat docs/cofounder/rules/grounding.yaml 2>/dev/null || echo "(empty)"
```

```bash
# Existing reconcile.json (preserve any manually written shapes)
cat docs/cofounder/rules/reconcile.json 2>/dev/null || echo "(empty)"
```

## Step 1b — Pre-read rule files with the Read tool

Read both rule files using the Read tool (not Bash) so the write guard is satisfied
before the agent returns. Do this in parallel with any remaining Step 1 commands:

- Read `docs/cofounder/rules/grounding.yaml`
- Read `docs/cofounder/rules/reconcile.json`

## Step 2 — Spawn Haiku scan agent

Spawn a Haiku subagent (`model: "haiku"`) with the following prompt, substituting
the collected context into the `<…>` placeholders:

---

**Haiku prompt:**

You are generating configuration files for a Claude Code assistant plugin called
"cofounder". Analyze the project and produce two YAML/JSON config files that are
immediately useful — no placeholders, no phantom doc references.

**Hard constraints:**
1. `load:` arrays in both files must ONLY reference docs from the "Existing docs" list below.
   If a doc doesn't exist, skip that rule or omit the load entry.
2. Generate rules that reflect what the project ACTUALLY does, inferred from CLAUDE.md
   and the app/package structure.
3. Keep it minimal: 2–4 grounding rules, 2–5 reconcile task shapes. Quality > quantity.
4. The `commit` task shape is mandatory. Extract the actual commit workflow from CLAUDE.md.

---

**Project CLAUDE.md:**
```
<CLAUDE.md content>
```

**Existing docs (relative to project root — only these may appear in load:):**
```
<find docs/ output>
```

**App/package layout:**
```
<ls apps/ packages/ output>
```

**Current grounding.yaml (preserve manually-added rules if any):**
```yaml
<existing grounding.yaml>
```

**Current reconcile.json (preserve manually-added shapes if any):**
```json
<existing reconcile.json>
```

---

**Output format — return exactly two fenced code blocks, nothing else:**

```yaml
# grounding.yaml
config:
  cache_ttl_ms: 60000

rules:
  - name: <name>
    match:
      keywords: [<specific keywords for this project>]
    load:
      - <doc that exists>
    reason: <one line>
```

```json
{
  "$comment": "Task-shape rules. Match prompts/paths → load docs + verify checklists.",
  "taskShapes": {
    "commit": { ... },
    "<shape>": { ... }
  }
}
```

---

## Step 3 — Write the output

Parse the two code blocks from the Haiku agent's response and write them:

- First block → `docs/cofounder/rules/grounding.yaml`
- Second block → `docs/cofounder/rules/reconcile.json`

Confirm with:

```
Rules regenerated.

  docs/cofounder/rules/grounding.yaml  — <N> rules
  docs/cofounder/rules/reconcile.json  — <N> task shapes

Re-run anytime with /cofounder:regen-rules.
```
