/**
 * Storage layer — local filesystem backend.
 *
 * Layout:
 *   ~/.cofounder/
 *     threads/<slug>.json   → one file per thread
 *     learnings.json        → all learnings, grouped by agent
 *     meta.json             → schema version, timestamps
 *
 * Zero dependencies. Only Node built-ins. Swap to remote backend by
 * implementing the same exported functions against an HTTP API.
 */
import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { newThread, newSession, newLearning, touchThread, SCHEMA_VERSION } from './schema.mjs'

// Project-local store so sessions are visible in the repo.
// Hooks run from project root, so process.cwd() resolves correctly.
// Override via COFOUNDER_BASE env var if needed.
const BASE = process.env.COFOUNDER_BASE ?? join(process.cwd(), '.cofounder')
const THREADS_DIR = join(BASE, 'threads')
const LEARNINGS_FILE = join(BASE, 'learnings.json')
const META_FILE = join(BASE, 'meta.json')
const CURRENT_FILE = join(BASE, 'current.json')

async function ensureDirs() {
  await mkdir(THREADS_DIR, { recursive: true })
  if (!existsSync(META_FILE)) {
    await writeFile(META_FILE, JSON.stringify({ version: SCHEMA_VERSION, createdAt: new Date().toISOString() }, null, 2))
  }
}

async function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data)
  await rename(tmp, path)
}

// ─── Threads ──────────────────────────────────────────────────────────────────

function threadPath(slug) {
  return join(THREADS_DIR, `${slug}.json`)
}

export async function getThread(slug) {
  await ensureDirs()
  const p = threadPath(slug)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(await readFile(p, 'utf8'))
  } catch (err) {
    throw new Error(`Failed to parse thread ${slug}: ${err.message}`)
  }
}

export async function saveThread(thread) {
  await ensureDirs()
  await atomicWrite(threadPath(thread.slug), JSON.stringify(thread, null, 2))
}

export async function listThreads({ project, status } = {}) {
  await ensureDirs()
  const files = await readdir(THREADS_DIR).catch(() => [])
  const threads = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const t = JSON.parse(await readFile(join(THREADS_DIR, f), 'utf8'))
      if (project && t.project !== project) continue
      if (status && t.status !== status) continue
      threads.push(t)
    } catch {}
  }
  return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function upsertSession(slug, project, sessionInput) {
  let thread = await getThread(slug)
  if (!thread) thread = newThread({ slug, project })

  const session = newSession(sessionInput)

  // Replace an empty same-date placeholder (created by stop.sh touch) instead of
  // appending alongside it. A placeholder is detected by empty summary + no data.
  const existingIdx = thread.sessions.findIndex(s => s.date === session.date)
  const existing = existingIdx >= 0 ? thread.sessions[existingIdx] : null
  const isPlaceholder =
    existing &&
    !existing.summary &&
    (!existing.decisions || existing.decisions.length === 0) &&
    (!existing.agentsUsed || existing.agentsUsed.length === 0)

  if (isPlaceholder) {
    thread.sessions[existingIdx] = session
  } else {
    thread.sessions.push(session)
  }

  thread.project = project
  touchThread(thread)
  await saveThread(thread)
  // Saving a session makes this thread the active one
  await setCurrent(slug, { project })
  return { thread, session }
}

// ─── Current thread pointer ──────────────────────────────────────────────────
// Explicit "what am I working on right now" — decoupled from git branch.
// Updated by: upsertSession (implicit), setCurrent (explicit /cofounder:thread).

export async function getCurrent() {
  await ensureDirs()
  if (!existsSync(CURRENT_FILE)) return null
  try {
    return JSON.parse(await readFile(CURRENT_FILE, 'utf8'))
  } catch {
    return null
  }
}

export async function setCurrent(slug, extra = {}) {
  await ensureDirs()
  const payload = {
    slug,
    project: extra.project,
    setAt: new Date().toISOString(),
  }
  await atomicWrite(CURRENT_FILE, JSON.stringify(payload, null, 2))
  return payload
}

export async function clearCurrent() {
  await ensureDirs()
  if (existsSync(CURRENT_FILE)) {
    const { unlink } = await import('node:fs/promises')
    await unlink(CURRENT_FILE)
  }
}

export async function setThreadStatus(slug, status) {
  const thread = await getThread(slug)
  if (!thread) throw new Error(`Thread not found: ${slug}`)
  thread.status = status
  touchThread(thread)
  await saveThread(thread)
  return thread
}

// ─── Learnings ────────────────────────────────────────────────────────────────

export async function getLearnings(agent) {
  await ensureDirs()
  if (!existsSync(LEARNINGS_FILE)) return {}
  const store = JSON.parse(await readFile(LEARNINGS_FILE, 'utf8'))
  if (!agent) return store
  return { [agent]: store[agent] ?? [] }
}

export async function addLearning(input) {
  await ensureDirs()
  const store = existsSync(LEARNINGS_FILE)
    ? JSON.parse(await readFile(LEARNINGS_FILE, 'utf8'))
    : {}
  const learning = newLearning(input)
  if (!store[input.agent]) store[input.agent] = []
  store[input.agent].push(learning)
  await atomicWrite(LEARNINGS_FILE, JSON.stringify(store, null, 2))
  return learning
}

export async function countLearnings() {
  const store = await getLearnings()
  const out = {}
  for (const [agent, rules] of Object.entries(store)) out[agent] = rules.length
  return out
}
