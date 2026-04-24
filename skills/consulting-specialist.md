---
name: consulting-specialist
description: Use when about to make a judgement-heavy decision (design direction, architectural boundary, security posture, strategic priority) OR when stuck and unsure whether a specialist model would help. Decides which consultant agent to call, what context to pass, and what to expect back. Does NOT call the agent for you — it tells you how to frame the call.
---

# Consulting a Specialist

You are main thread. You do the coding. But some decisions are judgement-heavy and warrant a consultant — an agent that researches, thinks, and returns a structured recommendation. This skill is your decision tree.

## When to call a consultant

**Call one when you're about to:**
- Design a screen, layout, component, or flow from scratch — `@cofounder:design`
- Introduce a new module, rename a boundary, or refactor for scale — `@cofounder:architect-review`
- Touch authentication, tokens, secrets, user input at a trust boundary, or any security-critical path — `@cofounder:security-auditor`
- Make a strategic call ("build X or Y?", "what's the priority?", "is this the right move?") — `@cofounder:cofounder`

**Also call one when:**
- You've tried twice and something still feels wrong — a second pair of eyes with opus thinking is cheaper than a bad commit
- The user is non-technical and the decision is load-bearing — let a specialist explain the tradeoff
- You're about to write a 200+ line change in an area you don't know well — get a boundary check first

## When NOT to call a consultant

- Routine implementation (main thread)
- Bug fixes where the root cause is obvious (main thread — read, reproduce, fix, verify)
- Mechanical refactors / renames (main thread)
- Writing tests (main thread — TDD when the API is new, post-hoc tests for regressions)
- Running a command, reading a file, or reporting state (main thread)

Rule of thumb: if it's mostly typing, don't consult. If it's mostly thinking, consult.

## How to frame the call

A good consultant call has three parts:

1. **Context** — what's the code/decision they need to see? Give paths, not prose summaries.
2. **The question** — one sentence. Specific.
3. **The expected output** — what decision will you make based on their answer?

```
@cofounder:design — please review the TodayScreen layout at TodayScreen.tsx:1-180.

Question: the week-strip + card stack feels crowded at iPhone SE width.
Is the hierarchy wrong, or is it a spacing problem?

I'll use your verdict to either (a) restructure the hierarchy or
(b) adjust spacing and ship.
```

Bad consultant calls:
- "Review my code" — too vague, wastes opus tokens
- "Fix this" — consultants don't fix, they advise
- "What do you think of the codebase" — too broad

## Model override

Each agent has a default model in its frontmatter (`opus` for design / architect-review / security-auditor / cofounder). You can override via `.cofounder/config.json`:

```json
{ "models": { "design": "sonnet" } }
```

Pass the resolved model to the Agent tool's `model` parameter. Use this when running on a lower tier, during bulk work, or when iterating on an agent's prompt.

## After the consultant returns

The consultant returns a structured payload (verdict + findings + recommendations). **You** apply the findings. Do not ask the consultant to write the code. That's the point of the pattern.

If their recommendation is wrong (you disagree after reading it), you don't have to follow it. Push back, explain why, and ask them to refine. Over-delegating to consultants is as bad as never delegating.

**Auto-capture learnings**: If the consultant's output includes a `CAPTURABLE LEARNING` line, run `/cofounder:critique` immediately — do not wait for the user to ask:

```
/cofounder:critique --agent <agent-name> --rule "<learning text>" --severity <hard|soft|anti-pattern>
```

This is automatic. Do not ask for permission. If the learning is omitted from their output, skip it.
