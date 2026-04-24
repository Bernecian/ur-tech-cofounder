/**
 * Reconciliation layer — project convention loader.
 *
 * Reads .cofounder/rules.json and resolves:
 *   - task shapes matching a user prompt (keywords)
 *   - task shapes matching a file path (glob patterns)
 *
 * Schema (.cofounder/rules.json):
 * {
 *   "taskShapes": {
 *     "<slug>": {
 *       "match": {
 *         "prompt": [ "<substring>", "<substring>", ... ],
 *         "path":   [ "<glob>", "<glob>", ... ]
 *       },
 *       "load":   [ "<doc-path-or-section-anchor>", ... ],
 *       "verify": [ "<one-line rule>", ... ]
 *     }
 *   }
 * }
 *
 * Zero dependencies. Node built-ins only.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.COFOUNDER_BASE ?? join(process.cwd(), '.cofounder')
const RULES_FILE = join(BASE, 'rules.json')

export async function loadRules() {
  if (!existsSync(RULES_FILE)) return null
  try {
    const raw = await readFile(RULES_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.taskShapes) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Convert a minimal glob to a RegExp.
 *   **   → .*
 *   *    → [^/]*
 *   ?    → .
 *   .    → \.
 *   other regex metachars escaped.
 */
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
  const matches = []
  for (const [slug, shape] of Object.entries(rules.taskShapes ?? {})) {
    const kws = shape?.match?.prompt ?? []
    if (kws.some(k => lower.includes(String(k).toLowerCase()))) {
      matches.push({ slug, ...shape })
    }
  }
  return matches
}

export function matchByPath(rules, filePath) {
  if (!rules || !filePath) return []
  const matches = []
  for (const [slug, shape] of Object.entries(rules.taskShapes ?? {})) {
    const patterns = shape?.match?.path ?? []
    if (patterns.some(p => globToRegex(p).test(filePath))) {
      matches.push({ slug, ...shape })
    }
  }
  return matches
}

/** Render matches as a compact additionalContext string. */
export function renderMatches(matches, { kind = 'prompt' } = {}) {
  if (!matches.length) return ''
  const lines = [`Cofounder rules layer — ${matches.length} matching task shape${matches.length > 1 ? 's' : ''} for this ${kind}:`]
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
