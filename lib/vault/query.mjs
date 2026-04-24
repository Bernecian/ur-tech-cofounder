#!/usr/bin/env node
/**
 * cofounder vault CLI — used by hooks and commands.
 * Replaces persistence/query.mjs. Reads/writes markdown vault in docs/cofounder/.
 *
 * Usage:
 *   node query.mjs current                         → active thread context
 *   node query.mjs set-current <slug>              → switch active thread
 *   node query.mjs clear-current                   → unset active thread
 *   node query.mjs thread <slug>                   → thread context
 *   node query.mjs threads                         → list all threads
 *   node query.mjs save <json>                     → write session (json via stdin or arg)
 *   node query.mjs touch                           → create today's session placeholder
 *   node query.mjs learnings [agent]               → print learnings
 *   node query.mjs learnings-count                 → counts per agent
 *   node query.mjs add-learning <json>             → append a learning
 *   node query.mjs rules-match-prompt <prompt>     → match reconcile task shapes
 *   node query.mjs rules-match-path <path>         → match reconcile task shapes by file
 */
import { listThreads, readThread, ensureThread, writeSession, listSessions } from './thread.mjs'
import { getCurrent, setCurrent, clearCurrent } from './index.mjs'
import { appendLearning, readLearnings, countAllLearnings } from './learning.mjs'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

function clearDirtyFlag(cwd) {
  const flag = join(cwd, 'docs/cofounder/.state/session-dirty')
  if (existsSync(flag)) {
    try { rmSync(flag) } catch {}
  }
}

const cwd = process.cwd()
const argv = process.argv.slice(2)
const cmd  = argv[0]

function parseArg(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

async function readJsonArg(fallback) {
  if (fallback && fallback.startsWith('{')) return JSON.parse(fallback)
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function formatThread(slug, limit = 3) {
  const t = await readThread(cwd, slug)
  if (!t) return `No thread: ${slug}`
  const lines = [`Thread: ${t.slug} (${t.project ?? '?'}) [${t.status}]`]
  lines.push(`Last active: ${(t.updatedAt ?? '').slice(0, 10)}`)

  // Show digest from body
  const digestMatch = (t.body ?? '').match(/## Digest\n([\s\S]*?)(?=\n##|$)/)
  if (digestMatch) {
    const digest = digestMatch[1].trim()
    if (digest && digest !== '_No sessions yet._') {
      lines.push('', 'Digest:', digest)
    }
  }

  const focusMatch = (t.body ?? '').match(/## Active focus\n([\s\S]*?)(?=\n##|$)/)
  if (focusMatch) {
    const focus = focusMatch[1].trim()
    if (focus && focus !== '_Not set._') lines.push('', `Focus: ${focus}`)
  }

  const sessions = await listSessions(cwd, slug, limit)
  if (sessions.length) {
    lines.push('')
    for (const s of sessions) {
      const summary = (s.body ?? '').match(/## Summary\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim() ?? ''
      lines.push(`[${s.date ?? s.file}] ${summary.split('\n')[0] ?? ''}`)
      if (s.agents?.length) lines.push(`  Agents: ${s.agents.join(', ')}`)
      if (s.commit && s.commit !== 'pending') lines.push(`  Commit: ${s.commit}`)
    }
  }
  return lines.join('\n')
}

async function run() {

  if (cmd === 'current') {
    const cur = await getCurrent(cwd)
    if (!cur) { console.log('No current thread. Use /cofounder:thread <slug> or /cofounder:wrapup to set one.'); return }
    const t = await readThread(cwd, cur.slug)
    if (!t) { console.log(`Current thread '${cur.slug}' not found in vault.`); return }
    console.log(await formatThread(cur.slug))
    return
  }

  if (cmd === 'set-current') {
    const slug = argv[1]
    if (!slug) { console.error('usage: query.mjs set-current <slug>'); process.exit(1) }
    const t = await readThread(cwd, slug)
    if (!t) { console.error(`No thread: ${slug}. Create it first via /cofounder:wrapup --slug ${slug}`); process.exit(1) }
    await setCurrent(cwd, slug, t.project)
    console.log(`current thread set to: ${slug}`)
    return
  }

  if (cmd === 'clear-current') {
    await clearCurrent(cwd)
    console.log('current thread cleared')
    return
  }

  if (cmd === 'thread') {
    const slug = argv[1]
    if (!slug) { console.error('usage: query.mjs thread <slug>'); process.exit(1) }
    console.log(await formatThread(slug))
    return
  }

  if (cmd === 'threads') {
    const all = await listThreads(cwd)
    if (!all.length) return
    for (const t of all) {
      const sessions = await listSessions(cwd, t.slug, 1)
      const last = sessions[sessions.length - 1]
      const summary = last ? (last.body ?? '').match(/## Summary\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim()?.split('\n')[0] ?? '' : ''
      console.log(`${t.slug} (${t.project ?? '?'}) [${t.status}] — ${(t.updatedAt ?? '').slice(0, 10)}`)
      if (summary) console.log(`  ${summary.slice(0, 100)}`)
    }
    return
  }

  if (cmd === 'learnings') {
    const agent = argv[1]
    const { AGENTS } = await import('./paths.mjs')
    const agents = agent ? [agent] : AGENTS
    for (const a of agents) {
      const lines = await readLearnings(cwd, a)
      if (lines.length) {
        console.log(`${a}:`)
        for (const l of lines) console.log(`  ${l}`)
      }
    }
    return
  }

  if (cmd === 'learnings-count') {
    const counts = await countAllLearnings(cwd)
    const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([a, n]) => `${a}=${n} rules`)
    if (parts.length) console.log(parts.join(', '))
    return
  }

  if (cmd === 'save') {
    const input = await readJsonArg(argv[1])
    const { path: sessionPath, date, suffix } = await writeSession(cwd, input.slug, input.project ?? input.slug, {
      date: input.date,
      summary: input.summary,
      decisions: input.decisions,
      openQs: input.openQs,
      agentsUsed: input.agentsUsed,
      modelsUsed: input.modelsUsed,
      tokensApprox: input.tokensApprox,
      commit: input.commit,
      status: input.status,
    })
    await setCurrent(cwd, input.slug, input.project ?? input.slug)
    clearDirtyFlag(cwd)
    console.log(`saved session to ${sessionPath}`)
    return
  }

  if (cmd === 'touch') {
    const cur = await getCurrent(cwd)
    if (!cur) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const sessions = await listSessions(cwd, cur.slug, 10)
    if (sessions.some(s => s.date === todayStr)) return
    await writeSession(cwd, cur.slug, cur.project ?? cur.slug, { date: todayStr, summary: '' })
    return
  }

  if (cmd === 'add-learning') {
    const input = await readJsonArg(argv[1])
    const { path: lp, entry } = await appendLearning(cwd, input)
    console.log(`added learning to ${lp}: ${entry.trim()}`)
    return
  }

  if (cmd === 'rules-match-prompt') {
    const prompt = argv.slice(1).join(' ')
    await runReconcile('prompt', prompt)
    return
  }

  if (cmd === 'rules-match-path') {
    const p = argv[1]
    if (!p) { console.error('usage: query.mjs rules-match-path <path>'); process.exit(1) }
    await runReconcile('path', p)
    return
  }

  printHelp()
  process.exit(1)
}

async function runReconcile(kind, value) {
  const { loadRules, matchByPrompt, matchByPath, renderMatches } = await import('../reconcile/rules.mjs')
  const rules = await loadRules(cwd)
  const matches = kind === 'prompt' ? matchByPrompt(rules, value) : matchByPath(rules, value)
  const out = renderMatches(matches, { kind: kind === 'path' ? 'file path' : 'prompt' })
  if (out) console.log(out)
}

function printHelp() {
  console.error('Usage:')
  console.error('  query.mjs current                       → active thread context')
  console.error('  query.mjs set-current <slug>            → switch active thread')
  console.error('  query.mjs clear-current                 → unset active thread')
  console.error('  query.mjs thread <slug>                 → load a specific thread')
  console.error('  query.mjs threads                       → list all threads')
  console.error('  query.mjs learnings [agent]')
  console.error('  query.mjs learnings-count')
  console.error('  query.mjs save <json>                   → write session markdown + set current')
  console.error('  query.mjs touch                         → create today placeholder')
  console.error('  query.mjs add-learning <json>')
  console.error('  query.mjs rules-match-prompt <prompt>')
  console.error('  query.mjs rules-match-path <path>')
}

run().catch(e => { console.error(e.message); process.exit(1) })
