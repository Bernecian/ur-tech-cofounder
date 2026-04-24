import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { abs, threadFile, threadDir, sessionsDir, decisionsDir, questionsFile } from './paths.mjs'
import { parse, stringify } from './frontmatter.mjs'

async function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data, 'utf8')
  await rename(tmp, path)
}

// ─── Thread record (thread.md) ────────────────────────────────────────────────

export async function readThread(cwd, slug) {
  const p = abs(cwd, threadFile(slug))
  if (!existsSync(p)) return null
  const raw = await readFile(p, 'utf8')
  const { data, body } = parse(raw)
  return { slug, ...data, body }
}

export async function writeThread(cwd, slug, data, body) {
  const dir = abs(cwd, threadDir(slug))
  await mkdir(dir, { recursive: true })
  await mkdir(abs(cwd, sessionsDir(slug)), { recursive: true })
  await mkdir(abs(cwd, decisionsDir(slug)), { recursive: true })
  await atomicWrite(abs(cwd, threadFile(slug)), stringify(data, body))
}

export async function ensureThread(cwd, slug, project) {
  if (existsSync(abs(cwd, threadFile(slug)))) {
    return readThread(cwd, slug)
  }
  const now = new Date().toISOString()
  const data = { id: randomId(), slug, project, status: 'active', createdAt: now, updatedAt: now }
  const body = `# ${slug}\n\n## Digest\n_No sessions yet._\n\n## Active focus\n_Not set._\n`
  await writeThread(cwd, slug, data, body)
  return { slug, ...data, body }
}

export async function listThreads(cwd) {
  const dir = abs(cwd, 'docs/cofounder/threads')
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const threads = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const t = await readThread(cwd, e.name)
    if (t) threads.push(t)
  }
  return threads.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export async function touchThread(cwd, slug, project) {
  const t = await ensureThread(cwd, slug, project)
  const { body, ...data } = t
  data.updatedAt = new Date().toISOString()
  await writeThread(cwd, slug, data, body ?? '')
  return t
}

export async function updateDigest(cwd, slug, digest, focus) {
  const t = await readThread(cwd, slug)
  if (!t) return
  const { body, ...data } = t
  data.updatedAt = new Date().toISOString()

  let newBody = body ?? ''
  newBody = replaceSection(newBody, 'Digest', digest)
  if (focus) newBody = replaceSection(newBody, 'Active focus', focus)
  await writeThread(cwd, slug, data, newBody)
}

function replaceSection(body, heading, content) {
  const re = new RegExp(`(## ${heading}\\n)[\\s\\S]*?(?=\\n##|$)`)
  const replacement = `## ${heading}\n${content}\n\n`
  return re.test(body) ? body.replace(re, replacement) : body + `\n## ${heading}\n${content}\n`
}

// ─── Sessions ──────────────────────────────────────────────────────────────────

export async function writeSession(cwd, slug, project, sessionData) {
  await ensureThread(cwd, slug, project)
  const date = sessionData.date ?? today()
  const dir = abs(cwd, sessionsDir(slug))

  // Find a non-colliding filename
  let suffix = ''
  let n = 2
  while (existsSync(abs(cwd, `docs/cofounder/threads/${slug}/sessions/${date}${suffix}.md`))) {
    suffix = `-${n++}`
  }
  const relPath = `docs/cofounder/threads/${slug}/sessions/${date}${suffix}.md`

  const fm = {
    date: date,
    commit: sessionData.commit ?? 'pending',
    status: sessionData.status ?? 'complete',
    agents: sessionData.agentsUsed ?? [],
    models: sessionData.modelsUsed ?? [],
  }
  if (sessionData.tokensApprox) fm.tokensApprox = sessionData.tokensApprox

  const bullets = (sessionData.summary ?? '').split('\n').filter(Boolean)
  let body = `## Summary\n${bullets.map(b => b.startsWith('•') ? b : `• ${b}`).join('\n')}\n`
  if (sessionData.decisions?.length) {
    body += `\n## Decisions\n${sessionData.decisions.map(d => `- ${d}`).join('\n')}\n`
  }
  if (sessionData.openQs?.length) {
    body += `\n## Open questions\n${sessionData.openQs.map(q => `- ${q}`).join('\n')}\n`
  }

  await atomicWrite(abs(cwd, relPath), stringify(fm, body))

  // Update thread's updatedAt
  const t = await readThread(cwd, slug)
  if (t) {
    const { body: tb, ...td } = t
    td.updatedAt = new Date().toISOString()
    await writeThread(cwd, slug, td, tb ?? '')
  }
  return { path: relPath, date, suffix }
}

export async function listSessions(cwd, slug, limit = 5) {
  const dir = abs(cwd, sessionsDir(slug))
  if (!existsSync(dir)) return []
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.md')).sort()
  const recent = files.slice(-limit)
  const sessions = []
  for (const f of recent) {
    const raw = await readFile(`${dir}/${f}`, 'utf8').catch(() => '')
    const { data, body } = parse(raw)
    sessions.push({ file: f, ...data, body })
  }
  return sessions
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}
