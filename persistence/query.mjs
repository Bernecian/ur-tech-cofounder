#!/usr/bin/env node
/**
 * cofounder persistence CLI — used by hooks.
 * Zero dependencies. Node built-ins only. Shares storage.mjs with the MCP server.
 *
 * Usage:
 *   node query.mjs thread <slug>          → print thread context
 *   node query.mjs threads [--project X]  → list threads
 *   node query.mjs learnings [agent]      → print learnings
 *   node query.mjs learnings-count        → counts per agent
 *   node query.mjs save <json>            → save a session (json via stdin or arg)
 *   node query.mjs add-learning <json>    → add a learning
 */
import {
  getThread,
  listThreads,
  upsertSession,
  getLearnings,
  addLearning,
  countLearnings,
  getCurrent,
  setCurrent,
  clearCurrent,
} from './storage.mjs'
import { loadRules, matchByPrompt, matchByPath, renderMatches } from './rules.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0]

function parseArg(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

async function readJsonArg(fallback) {
  if (fallback && fallback.startsWith('{')) return JSON.parse(fallback)
  // Read from stdin
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function formatThread(t, { last = 5 } = {}) {
  const lines = []
  lines.push(`Thread: ${t.slug} (${t.project}) [${t.status}]`)
  lines.push(`Last active: ${t.updatedAt.slice(0, 10)} · ${t.sessions.length} sessions total`)
  if (t.digest) {
    lines.push('')
    lines.push('Digest:')
    lines.push(t.digest)
  }
  const recent = t.sessions.slice(-last)
  if (recent.length) {
    lines.push('')
    for (const s of recent) {
      lines.push(`[${s.date}] ${s.summary}`)
      if (s.decisions?.length) lines.push(`  Decisions: ${s.decisions.join(' · ')}`)
      if (s.openQs?.length) lines.push(`  Open: ${s.openQs.join(' · ')}`)
      if (s.modelsUsed?.length) lines.push(`  Models: ${s.modelsUsed.join(', ')}`)
      if (s.commit) lines.push(`  Commit: ${s.commit}`)
    }
  }
  return lines.join('\n')
}

async function run() {
  if (cmd === 'thread') {
    const slug = argv[1]
    if (!slug) { console.error('usage: query.mjs thread <slug>'); process.exit(1) }
    const t = await getThread(slug)
    if (!t) { console.log(`No thread: ${slug}`); return }
    console.log(formatThread(t))
    return
  }

  if (cmd === 'threads') {
    const project = parseArg('--project')
    const all = await listThreads({ project })
    if (!all.length) return
    for (const t of all) {
      const last = t.sessions[t.sessions.length - 1]
      console.log(`${t.slug} (${t.project}) [${t.status}] — ${t.updatedAt.slice(0, 10)} · ${t.sessions.length} sessions`)
      if (last) console.log(`  ${last.summary.slice(0, 100)}`)
    }
    return
  }

  if (cmd === 'learnings') {
    const agent = argv[1]
    const store = await getLearnings(agent)
    for (const [a, rules] of Object.entries(store)) {
      if (!rules.length) continue
      console.log(`${a}:`)
      for (const r of rules) console.log(`  [${r.severity}] ${r.rule}`)
    }
    return
  }

  if (cmd === 'learnings-count') {
    const counts = await countLearnings()
    const parts = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([a, n]) => `${a}=${n} rules`)
    if (parts.length) console.log(parts.join(', '))
    return
  }

  if (cmd === 'save') {
    const input = await readJsonArg(argv[1])
    const { thread, session } = await upsertSession(input.slug, input.project, {
      date: input.date,
      summary: input.summary,
      decisions: input.decisions,
      openQs: input.openQs,
      agentsUsed: input.agentsUsed,
      modelsUsed: input.modelsUsed,
      tokensApprox: input.tokensApprox,
      commit: input.commit,
    })
    console.log(`saved session ${session.id} to thread ${thread.slug} (${thread.sessions.length} total)`)
    return
  }

  if (cmd === 'touch') {
    // Idempotent daily session — ensures the current thread exists with a record
    // for today. No-op if a session for today already exists. Used by stop.sh.
    const cur = await getCurrent()
    if (!cur) return
    const today = new Date().toISOString().slice(0, 10)
    const thread = await getThread(cur.slug)
    if (thread) {
      if (thread.sessions.some(s => s.date === today)) return // already have today
    }
    await upsertSession(cur.slug, cur.project ?? cur.slug, { date: today, summary: '' })
    console.log(`touched: ${cur.slug} (${today})`)
    return
  }

  if (cmd === 'add-learning') {
    const input = await readJsonArg(argv[1])
    const learning = await addLearning(input)
    console.log(`added learning ${learning.id} for ${learning.agent} [${learning.severity}]`)
    return
  }

  if (cmd === 'current') {
    // Print the currently active thread's context (same format as `thread`)
    const cur = await getCurrent()
    if (!cur) { console.log('No current thread. Use /cofounder:thread <slug> or /cofounder:wrapup to set one.'); return }
    const t = await getThread(cur.slug)
    if (!t) { console.log(`Current thread '${cur.slug}' not found in store.`); return }
    console.log(formatThread(t))
    return
  }

  if (cmd === 'set-current') {
    const slug = argv[1]
    if (!slug) { console.error('usage: query.mjs set-current <slug>'); process.exit(1) }
    const t = await getThread(slug)
    if (!t) { console.error(`No thread: ${slug}. Create it first via query.mjs save.`); process.exit(1) }
    await setCurrent(slug, { project: t.project })
    console.log(`current thread set to: ${slug}`)
    return
  }

  if (cmd === 'clear-current') {
    await clearCurrent()
    console.log('current thread cleared')
    return
  }

  if (cmd === 'rules-match-prompt') {
    const prompt = argv.slice(1).join(' ')
    const rules = await loadRules()
    const matches = matchByPrompt(rules, prompt)
    const out = renderMatches(matches, { kind: 'prompt' })
    if (out) console.log(out)
    return
  }

  if (cmd === 'rules-match-path') {
    const p = argv[1]
    if (!p) { console.error('usage: query.mjs rules-match-path <path>'); process.exit(1) }
    const rules = await loadRules()
    const matches = matchByPath(rules, p)
    const out = renderMatches(matches, { kind: 'file path' })
    if (out) console.log(out)
    return
  }

  console.error('Usage:')
  console.error('  query.mjs current                → load the active thread')
  console.error('  query.mjs set-current <slug>     → switch the active thread')
  console.error('  query.mjs clear-current          → unset the active thread')
  console.error('  query.mjs thread <slug>          → load a specific thread')
  console.error('  query.mjs threads [--project X]  → list all threads')
  console.error('  query.mjs learnings [agent]')
  console.error('  query.mjs learnings-count')
  console.error('  query.mjs save <json>            → add session (auto-sets current)')
  console.error('  query.mjs add-learning <json>')
  console.error('  query.mjs rules-match-prompt <prompt>  → match task shapes by keywords')
  console.error('  query.mjs rules-match-path <path>      → match task shapes by file glob')
  process.exit(1)
}

run().catch(e => { console.error(e.message); process.exit(1) })
