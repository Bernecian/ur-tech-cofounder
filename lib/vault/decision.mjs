import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { abs, decisionsDir } from './paths.mjs'
import { stringify } from './frontmatter.mjs'

async function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data, 'utf8')
  await rename(tmp, path)
}

export async function nextDecisionNumber(cwd, slug) {
  const dir = abs(cwd, decisionsDir(slug))
  if (!existsSync(dir)) return 1
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.md'))
  if (!files.length) return 1
  const nums = files.map(f => parseInt(f.split('-')[0], 10)).filter(Number.isFinite)
  return nums.length ? Math.max(...nums) + 1 : 1
}

export async function writeDecision(cwd, slug, { title, context, decision, consequences, thread, status = 'accepted' }) {
  const num = await nextDecisionNumber(cwd, slug)
  const nameSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  const dir = abs(cwd, decisionsDir(slug))
  await mkdir(dir, { recursive: true })
  const relPath = `docs/cofounder/threads/${slug}/decisions/${String(num).padStart(4, '0')}-${nameSlug}.md`
  const fm = { id: num, slug: nameSlug, date: today(), status, thread: thread ?? slug }
  const body = `## Context\n${context ?? '_Not specified._'}\n\n## Decision\n${decision ?? '_Not specified._'}\n\n## Consequences\n${consequences ?? '_Not specified._'}\n`
  await atomicWrite(abs(cwd, relPath), stringify(fm, body))
  return { path: relPath, num, nameSlug }
}

function today() { return new Date().toISOString().slice(0, 10) }
