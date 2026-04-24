#!/usr/bin/env node
/**
 * Cofounder vault scaffolder — called by /cofounder:setup.
 * Idempotent: safe to run multiple times.
 *
 * Does:
 *  1. Detect old .cofounder/ JSON store → run migrate.mjs
 *  2. Create docs/cofounder/ skeleton
 *  3. Copy grounding.yaml + reconcile.json templates if absent
 *  4. Add docs/cofounder/.state/ to .gitignore
 *  5. Wire hooks into .claude/settings.json
 *
 * Usage: node scripts/setup.mjs [--plugin-root <path>]
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dir = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = join(__dir, '..')
const cwd = process.cwd()

const VAULT = join(cwd, 'docs', 'cofounder')
const STATE = join(VAULT, '.state')
const THREADS = join(VAULT, 'threads')
const LEARNINGS = join(VAULT, 'learnings')
const RULES = join(VAULT, 'rules')
const OLD_COFOUNDER = join(cwd, '.cofounder')
const GITIGNORE = join(cwd, '.gitignore')
const SETTINGS = join(cwd, '.claude', 'settings.json')

async function atomicWrite(p, data) {
  const tmp = `${p}.tmp`
  await writeFile(tmp, data, 'utf8')
  const { rename } = await import('node:fs/promises')
  await rename(tmp, p)
}

async function run() {
  console.log('Cofounder setup — scaffolding vault...\n')

  // Step 1 — migrate old JSON store if present
  if (existsSync(OLD_COFOUNDER)) {
    console.log('Found legacy .cofounder/ — running migration...')
    try {
      const { default: migrate } = await import('./migrate.mjs')
      await migrate(cwd, OLD_COFOUNDER)
      console.log('Migration complete.\n')
    } catch (err) {
      console.warn(`Migration warning (non-fatal): ${err.message}\n`)
    }
  }

  // Step 2 — scaffold vault directories
  for (const dir of [VAULT, STATE, THREADS, LEARNINGS, RULES]) {
    await mkdir(dir, { recursive: true })
  }

  // Step 3 — copy rule templates if absent
  const groundingDest = join(RULES, 'grounding.yaml')
  const reconcileDest = join(RULES, 'reconcile.json')

  if (!existsSync(groundingDest)) {
    const src = join(PLUGIN_ROOT, 'templates', 'rules', 'grounding.yaml.example')
    if (existsSync(src)) await copyFile(src, groundingDest)
    else await writeFile(groundingDest, GROUNDING_DEFAULT, 'utf8')
    console.log('Created docs/cofounder/rules/grounding.yaml (starter template)')
  }

  if (!existsSync(reconcileDest)) {
    const src = join(PLUGIN_ROOT, 'templates', 'rules', 'reconcile.json.example')
    if (existsSync(src)) await copyFile(src, reconcileDest)
    else await writeFile(reconcileDest, RECONCILE_DEFAULT, 'utf8')
    console.log('Created docs/cofounder/rules/reconcile.json (starter template)')
  }

  // Create vault README if absent
  const readmeDest = join(VAULT, 'README.md')
  if (!existsSync(readmeDest)) {
    await writeFile(readmeDest, VAULT_README, 'utf8')
    console.log('Created docs/cofounder/README.md')
  }

  // Create index.md if absent
  const indexDest = join(VAULT, 'index.md')
  if (!existsSync(indexDest)) {
    await writeFile(indexDest, INDEX_DEFAULT, 'utf8')
  }

  // Step 4 — add .state/ to .gitignore
  const ignoreEntry = 'docs/cofounder/.state/'
  let gitignore = existsSync(GITIGNORE) ? await readFile(GITIGNORE, 'utf8') : ''
  if (!gitignore.includes(ignoreEntry)) {
    gitignore = gitignore.trimEnd() + (gitignore ? '\n' : '') + `\n# cofounder transient state\n${ignoreEntry}\n`
    await atomicWrite(GITIGNORE, gitignore)
    console.log('Added docs/cofounder/.state/ to .gitignore')
  }

  // Step 5 — wire hooks into .claude/settings.json
  await mkdir(join(cwd, '.claude'), { recursive: true })
  let settings = {}
  if (existsSync(SETTINGS)) {
    try { settings = JSON.parse(await readFile(SETTINGS, 'utf8')) }
    catch { settings = {} }
  }

  const hookCmd = `bash "${PLUGIN_ROOT}/hooks/session-start.sh"`
  const hooks = settings.hooks ?? {}
  const existing = hooks.SessionStart ?? []
  const alreadyWired = existing.some(e => e.hooks?.some(h => h.command?.includes('cofounder') && h.command?.includes('session-start')))

  if (!alreadyWired) {
    hooks.SessionStart = [
      ...existing,
      {
        hooks: [{
          type: 'command',
          statusMessage: 'Cofounder loading context...',
          command: hookCmd,
        }],
      },
    ]
    settings.hooks = hooks
    await atomicWrite(SETTINGS, JSON.stringify(settings, null, 2))
    console.log('Wired SessionStart hook into .claude/settings.json')
  } else {
    console.log('SessionStart hook already wired — skipped')
  }

  console.log(`
Cofounder ready.

  Vault:   docs/cofounder/
  Rules:   docs/cofounder/rules/grounding.yaml   ← edit to add grounding rules
           docs/cofounder/rules/reconcile.json    ← edit to add task-shape rules

  Start a new session and run /cofounder:brief to verify.
  Add context: /cofounder:wrapup --slug <feature-name>
`)
}

// ─── Default file contents ────────────────────────────────────────────────────

const VAULT_README = `# Cofounder vault

This directory is managed by the cofounder plugin. Commit it. Push it.
That's the entire persistence model — git-backed, cross-machine, zero cloud.

- \`index.md\` — active thread + thread roster
- \`threads/<slug>/\` — one directory per thread (sessions, decisions, open questions)
- \`learnings/<agent>.md\` — taste rules captured via /cofounder:critique
- \`rules/grounding.yaml\` — pre-flight doc + command injection rules (edit this)
- \`rules/reconcile.json\` — task-shape → docs + verify checklist (edit this)
- \`.state/\` — transient cache + active thread pointer (git-ignored)
`

const INDEX_DEFAULT = `---
updatedAt: ${new Date().toISOString()}
---

# Cofounder threads

_No threads yet. Run /cofounder:wrapup --slug <name> after your first session._
`

const GROUNDING_DEFAULT = `# Cofounder grounding rules
# Match prompts / paths → inject docs + run commands before Claude reasons.
# trust: true required to execute run: commands.
#
# See docs: https://github.com/Bernecian/ur-tech-cofounder

rules: []
`

const RECONCILE_DEFAULT = JSON.stringify({
  $comment: 'Task-shape rules. Match prompts/paths → load docs + verify checklists. Injected by hooks automatically.',
  taskShapes: {
    commit: {
      match: { prompt: ['commit', 'commit this', 'ship it', 'make a commit'] },
      load: ['CLAUDE.md'],
      verify: [
        "Used `pnpm commit -- --type <type> --scope <scope> --message \"...\"`",
        'No Co-Authored-By trailer, no emoji, no AI attribution',
      ],
    },
  },
}, null, 2)

run().catch(err => {
  console.error(`Setup failed: ${err.message}`)
  process.exit(1)
})
