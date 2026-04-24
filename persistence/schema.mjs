/**
 * cofounder data schema — versioned for SaaS-ready evolution.
 * Every record has id (uuid), createdAt, updatedAt. Safe to swap backends.
 */
import { randomUUID } from 'node:crypto'

export const SCHEMA_VERSION = 1

function now() {
  return new Date().toISOString()
}

export function newThread({ slug, project }) {
  const ts = now()
  return {
    version: SCHEMA_VERSION,
    id: randomUUID(),
    slug,
    project,
    status: 'active',
    sessions: [],
    digest: null,
    createdAt: ts,
    updatedAt: ts,
  }
}

export function newSession({
  date,
  summary,
  decisions = [],
  openQs = [],
  agentsUsed = [],
  modelsUsed = [],
  tokensApprox,
  commit,
}) {
  return {
    id: randomUUID(),
    date,
    summary,
    decisions,
    openQs,
    agentsUsed,
    modelsUsed,
    tokensApprox,
    commit,
    createdAt: now(),
  }
}

export function newLearning({ agent, rule, severity = 'soft', scope = 'all' }) {
  return {
    id: randomUUID(),
    agent,
    rule,
    severity,
    scope,
    createdAt: now(),
  }
}

export function touchThread(thread) {
  thread.updatedAt = now()
  return thread
}
