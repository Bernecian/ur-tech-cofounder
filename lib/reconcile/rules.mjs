/**
 * Reconciliation layer — project convention loader.
 * Reads docs/cofounder/rules/reconcile.json and resolves:
 *   - task shapes matching a user prompt (keywords)
 *   - task shapes matching a file path (glob patterns)
 *
 * Schema (docs/cofounder/rules/reconcile.json):
 * {
 *   "taskShapes": {
 *     "<slug>": {
 *       "match": {
 *         "prompt": [ "<substring>", ... ],
 *         "path":   [ "<glob>", ... ]
 *       },
 *       "load":   [ "<doc-path>", ... ],
 *       "verify": [ "<one-line rule>", ... ]
 *     }
 *   }
 * }
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { RECONCILE_RULES } from '../vault/paths.mjs'

export async function loadRules(cwd) {
  const rulesFile = join(cwd, RECONCILE_RULES)
  if (!existsSync(rulesFile)) return null
  try {
    const raw = await readFile(rulesFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed?.taskShapes) return null
    return parsed
  } catch {
    return null
  }
}

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

export function matchByPrompt(rules, prompt) {
  if (!rules || !prompt) return []
  const lower = prompt.toLowerCase()
  return Object.entries(rules.taskShapes ?? {})
    .filter(([, shape]) => (shape?.match?.prompt ?? []).some(k => lower.includes(String(k).toLowerCase())))
    .map(([slug, shape]) => ({ slug, ...shape }))
}

export function matchByPath(rules, filePath) {
  if (!rules || !filePath) return []
  return Object.entries(rules.taskShapes ?? {})
    .filter(([, shape]) => (shape?.match?.path ?? []).some(p => globToRegex(p).test(filePath)))
    .map(([slug, shape]) => ({ slug, ...shape }))
}

export function renderMatches(matches, { kind = 'prompt' } = {}) {
  if (!matches.length) return ''
  const lines = [`Cofounder rules — ${matches.length} task shape${matches.length > 1 ? 's' : ''} matched for this ${kind}:`]
  for (const m of matches) {
    lines.push('')
    lines.push(`• ${m.slug}`)
    if (m.load?.length) {
      lines.push(`  Load docs:`)
      for (const d of m.load) lines.push(`    - ${d}`)
    }
    if (m.verify?.length) {
      lines.push(`  Verify after work:`)
      for (const v of m.verify) lines.push(`    ☐ ${v}`)
    }
  }
  return lines.join('\n')
}
