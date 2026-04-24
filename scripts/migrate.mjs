#!/usr/bin/env node
/**
 * One-shot migration: .cofounder/ JSON → docs/cofounder/ markdown vault.
 *
 * Safe: moves old .cofounder/ to .cofounder.backup-<timestamp>/ after success.
 * Idempotent: skips if docs/cofounder/threads/ already exists.
 * Called automatically by setup.mjs when .cofounder/ is detected.
 */
import { readFile, writeFile, mkdir, rename, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { writeSession, ensureThread } from '../lib/vault/thread.mjs'
import { appendLearning } from '../lib/vault/learning.mjs'
import { setCurrent } from '../lib/vault/index.mjs'

export default async function migrate(cwd, oldBase) {
  const threadsDir = join(cwd, 'docs', 'cofounder', 'threads')

  // Skip if vault already has threads
  if (existsSync(threadsDir)) {
    const entries = await readdir(threadsDir).catch(() => [])
    if (entries.length > 0) {
      console.log('  Vault already has threads — skipping migration')
      return
    }
  }

  const threadsJsonDir = join(oldBase, 'threads')
  const learningsFile = join(oldBase, 'learnings.json')
  const currentFile = join(oldBase, 'current.json')

  let migratedThreads = 0
  let migratedSessions = 0
  let migratedLearnings = 0

  // Migrate threads
  if (existsSync(threadsJsonDir)) {
    const files = (await readdir(threadsJsonDir)).filter(f => f.endsWith('.json'))
    for (const f of files) {
      try {
        const raw = await readFile(join(threadsJsonDir, f), 'utf8')
        const thread = JSON.parse(raw)
        await ensureThread(cwd, thread.slug, thread.project ?? thread.slug)

        for (const s of thread.sessions ?? []) {
          if (!s.date) continue
          await writeSession(cwd, thread.slug, thread.project ?? thread.slug, {
            date: s.date,
            summary: s.summary ?? '',
            decisions: s.decisions ?? [],
            openQs: s.openQs ?? [],
            agentsUsed: s.agentsUsed ?? [],
            modelsUsed: s.modelsUsed ?? [],
            tokensApprox: s.tokensApprox,
            commit: s.commit ?? 'pending',
            status: s.status ?? 'complete',
          })
          migratedSessions++
        }
        migratedThreads++
      } catch (err) {
        console.warn(`  Skipped ${f}: ${err.message}`)
      }
    }
  }

  // Migrate learnings
  if (existsSync(learningsFile)) {
    try {
      const store = JSON.parse(await readFile(learningsFile, 'utf8'))
      for (const [agent, rules] of Object.entries(store)) {
        for (const r of rules ?? []) {
          if (!r.rule) continue
          await appendLearning(cwd, {
            agent: r.agent ?? agent,
            rule: r.rule,
            severity: r.severity ?? 'soft',
            scope: r.scope ?? 'all',
          })
          migratedLearnings++
        }
      }
    } catch (err) {
      console.warn(`  Skipped learnings: ${err.message}`)
    }
  }

  // Migrate current pointer
  if (existsSync(currentFile)) {
    try {
      const cur = JSON.parse(await readFile(currentFile, 'utf8'))
      if (cur.slug) await setCurrent(cwd, cur.slug, cur.project)
    } catch (_) { /* non-critical */ }
  }

  // Move old directory to backup
  const backup = `${oldBase}.backup-${Date.now()}`
  await rename(oldBase, backup)

  console.log(`  Migrated: ${migratedThreads} threads, ${migratedSessions} sessions, ${migratedLearnings} learnings`)
  console.log(`  Old store backed up to: ${backup}`)
}
