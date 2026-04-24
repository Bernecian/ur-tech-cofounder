import { join } from 'node:path'

export const VAULT_ROOT   = 'docs/cofounder'
export const STATE_DIR    = 'docs/cofounder/.state'
export const INDEX_FILE   = 'docs/cofounder/index.md'
export const THREADS_DIR  = 'docs/cofounder/threads'
export const LEARNINGS_DIR = 'docs/cofounder/learnings'
export const RULES_DIR    = 'docs/cofounder/rules'
export const CURRENT_FILE = 'docs/cofounder/.state/current.json'
export const HOOK_LOG     = 'docs/cofounder/.state/hook.log'
export const GROUNDING_RULES = 'docs/cofounder/rules/grounding.yaml'
export const RECONCILE_RULES = 'docs/cofounder/rules/reconcile.json'

export const AGENTS = ['cofounder', 'design', 'architect-review', 'security-auditor']

export function abs(cwd, rel) { return join(cwd, rel) }

export function threadDir(slug)          { return `${THREADS_DIR}/${slug}` }
export function threadFile(slug)         { return `${THREADS_DIR}/${slug}/thread.md` }
export function sessionsDir(slug)        { return `${THREADS_DIR}/${slug}/sessions` }
export function decisionsDir(slug)       { return `${THREADS_DIR}/${slug}/decisions` }
export function questionsFile(slug)      { return `${THREADS_DIR}/${slug}/questions.md` }
export function learningFile(agent)      { return `${LEARNINGS_DIR}/${agent}.md` }

export function sessionFile(slug, date, suffix = '') {
  return `${THREADS_DIR}/${slug}/sessions/${date}${suffix}.md`
}

export function decisionFile(slug, num, name) {
  const n = String(num).padStart(4, '0')
  return `${THREADS_DIR}/${slug}/decisions/${n}-${name}.md`
}
