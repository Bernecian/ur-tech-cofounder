import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { abs, INDEX_FILE, CURRENT_FILE, STATE_DIR } from './paths.mjs'

async function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data, 'utf8')
  await rename(tmp, path)
}

// ─── Active thread pointer (.state/current.json) ──────────────────────────────

export async function getCurrent(cwd) {
  const p = abs(cwd, CURRENT_FILE)
  if (!existsSync(p)) return null
  try { return JSON.parse(await readFile(p, 'utf8')) }
  catch { return null }
}

export async function setCurrent(cwd, slug, project) {
  await mkdir(abs(cwd, STATE_DIR), { recursive: true })
  const payload = { slug, project: project ?? slug, setAt: new Date().toISOString() }
  await atomicWrite(abs(cwd, CURRENT_FILE), JSON.stringify(payload, null, 2))
  return payload
}

export async function clearCurrent(cwd) {
  const p = abs(cwd, CURRENT_FILE)
  if (existsSync(p)) {
    const { unlink } = await import('node:fs/promises')
    await unlink(p)
  }
}

// ─── index.md roster ─────────────────────────────────────────────────────────

export async function rebuildIndex(cwd, threads) {
  const active = threads.find(t => t.status === 'active')
  const paused = threads.filter(t => t.status === 'paused')
  const archived = threads.filter(t => t.status === 'done')

  const lines = [
    '---',
    `updatedAt: ${new Date().toISOString()}`,
    '---',
    '',
    '# Cofounder threads',
    '',
  ]

  if (active) {
    lines.push('## Active')
    lines.push(`- [${active.slug}](threads/${active.slug}/thread.md) — ${active.status} — ${fmtDate(active.updatedAt)}`)
    lines.push('')
  }

  if (paused.length || archived.length) {
    lines.push('## Recent')
    for (const t of [...paused, ...archived].slice(0, 10)) {
      lines.push(`- [${t.slug}](threads/${t.slug}/thread.md) — ${t.status} — ${fmtDate(t.updatedAt)}`)
    }
    lines.push('')
  }

  await atomicWrite(abs(cwd, INDEX_FILE), lines.join('\n'))
}

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : 'unknown'
}
