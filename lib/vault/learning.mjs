import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { abs, learningFile, LEARNINGS_DIR } from './paths.mjs'

async function atomicWrite(path, data) {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data, 'utf8')
  await rename(tmp, path)
}

function today() { return new Date().toISOString().slice(0, 10) }

export async function appendLearning(cwd, { agent, rule, severity = 'soft', scope = 'all' }) {
  const relPath = learningFile(agent)
  const fullPath = abs(cwd, relPath)
  await mkdir(abs(cwd, LEARNINGS_DIR), { recursive: true })

  let content = existsSync(fullPath) ? await readFile(fullPath, 'utf8') : `---\nagent: ${agent}\n---\n`
  const entry = `- [${severity}] ${rule} (scope: ${scope}) (${today()})\n`

  // Append to end (simple; humans can reorganize)
  content = content.trimEnd() + '\n' + entry
  await atomicWrite(fullPath, content)
  return { path: relPath, entry }
}

export async function readLearnings(cwd, agent) {
  const fullPath = abs(cwd, learningFile(agent))
  if (!existsSync(fullPath)) return []
  const raw = await readFile(fullPath, 'utf8')
  return raw.split('\n').filter(l => l.startsWith('- ['))
}

export async function countAllLearnings(cwd) {
  const { AGENTS } = await import('./paths.mjs')
  const counts = {}
  for (const agent of AGENTS) {
    const lines = await readLearnings(cwd, agent)
    if (lines.length) counts[agent] = lines.length
  }
  return counts
}
