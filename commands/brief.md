---
description: "Start-of-session cofounder brief — delegates to @brief-reader (Haiku). Reads the markdown vault (docs/cofounder/) and produces a ≤30-line brief: active thread, recent sessions, open questions, git state, and suggested focus."
argument-hint: ""
---

# Cofounder Brief

Delegate to `@brief-reader` via the Agent tool. It runs on Haiku — reading vault files and formatting a brief does NOT need Opus.

## What to do

Invoke the Agent tool:

```
subagent_type: brief-reader
description: "Start-of-session brief"
prompt: "Generate the cofounder brief for this project. Follow your instructions exactly — read the vault files, output the brief in the specified format. Start with 'COFOUNDER BRIEF'."
```

Relay the output verbatim. No commentary, no re-formatting. If the agent fails, do the brief yourself using the same format defined in the agent's instructions.
