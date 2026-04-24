const fs = require('fs');
const path = require('path');
const { loadRules } = require('./rules');
const { pickRules } = require('./match');
const { expandGlob, isGlob } = require('./util');
const { runCommand, normalizeRun, DEFAULT_TIMEOUT, DEFAULT_MAX_BYTES } = require('./exec');
const cache = require('./cache');

const DEFAULT_TOTAL_BUDGET = 16 * 1024;
const DEFAULT_DOC_BUDGET = 4 * 1024;
const DEFAULT_CACHE_TTL_MS = 60 * 1000;

function readDoc(cwd, rel, maxBytes) {
  const full = path.resolve(cwd, rel);
  try {
    const stat = fs.statSync(full);
    if (!stat.isFile()) return null;
    const content = fs.readFileSync(full, 'utf8');
    if (content.length <= maxBytes) return { content, truncated: false };
    return { content: content.slice(0, maxBytes), truncated: true };
  } catch (_) {
    return null;
  }
}

function expandLoadTargets(cwd, load) {
  const out = [];
  const seen = new Set();
  for (const entry of load || []) {
    const s = String(entry);
    const files = expandGlob(cwd, s);
    for (const f of files) if (!seen.has(f)) { seen.add(f); out.push(f); }
    if (!files.length && !isGlob(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

async function executeRunsForRule(cwd, rule, { defaultTtlMs = DEFAULT_CACHE_TTL_MS } = {}) {
  if (!rule.trust || !Array.isArray(rule.run) || !rule.run.length) return [];
  const tasks = rule.run.map(async (entry) => {
    const e = normalizeRun(entry);
    if (!e) return null;
    const ttl = Number.isFinite(e.cache_ttl_ms) ? e.cache_ttl_ms : defaultTtlMs;
    if (ttl > 0) {
      const hit = cache.get(cwd, e.cmd, ttl);
      if (hit) return { cmd: e.cmd, ...hit, cached: true };
    }
    const res = await runCommand(e.cmd, {
      timeout: e.timeout ?? DEFAULT_TIMEOUT,
      maxBytes: e.max_bytes ?? DEFAULT_MAX_BYTES,
      cwd,
      shell: e.shell ?? true,
    });
    if (ttl > 0 && res.ok) cache.set(cwd, e.cmd, res);
    return { cmd: e.cmd, ...res, cached: false };
  });
  return (await Promise.all(tasks)).filter(Boolean);
}

function renderRule(cwd, rule, runResults, { docBudget }) {
  const name = rule.name || '(unnamed)';
  let section = `\n▸ ${name}\n`;
  if (rule.reason) section += `  ${rule.reason}\n`;

  const targets = expandLoadTargets(cwd, rule.load);
  for (const t of targets) {
    const doc = readDoc(cwd, t, docBudget);
    if (!doc) {
      section += `  • ${t} (not found)\n`;
      continue;
    }
    section += `  • ${t}${doc.truncated ? ' (truncated)' : ''}\n`;
    section += '    ---\n';
    for (const line of doc.content.split('\n')) section += `    ${line}\n`;
    section += '    ---\n';
  }

  if (Array.isArray(rule.run) && rule.run.length && !rule.trust) {
    section += `  (${rule.run.length} run command(s) skipped — rule is not trusted; set trust: true to enable)\n`;
  }
  for (const r of runResults) {
    const label = r.cached ? ' (cached)'
      : r.timedOut ? ' (timeout)'
      : r.truncated ? ' (truncated)'
      : !r.ok ? ` (exit ${r.code ?? '?'})`
      : '';
    section += `  $ ${r.cmd}${label} — ${r.ms}ms\n`;
    if (r.stdout) {
      section += '    ---\n';
      for (const line of r.stdout.split('\n')) section += `    ${line}\n`;
      section += '    ---\n';
    }
  }
  return section;
}

async function build(cwd, prompt, {
  totalBudget = DEFAULT_TOTAL_BUDGET,
  docBudget = DEFAULT_DOC_BUDGET,
} = {}) {
  const { rules, config, error } = loadRules(cwd);
  if (error) return null;
  const matched = pickRules(rules, prompt);
  if (!matched.length) return null;

  const defaultTtlMs = Number.isFinite(config?.cache_ttl_ms)
    ? config.cache_ttl_ms
    : DEFAULT_CACHE_TTL_MS;

  const runResultsByIndex = await Promise.all(
    matched.map((r) => executeRunsForRule(cwd, r, { defaultTtlMs }))
  );

  const sections = [];
  let used = 0;
  let truncatedRules = 0;

  for (let i = 0; i < matched.length; i++) {
    const section = renderRule(cwd, matched[i], runResultsByIndex[i], { docBudget });
    if (used + section.length > totalBudget) {
      truncatedRules = matched.length - i;
      break;
    }
    sections.push(section);
    used += section.length;
  }

  let out = 'R (Reason) pre-flight context:\n';
  for (const s of sections) out += s;
  if (truncatedRules) out += `\n(budget exhausted; ${truncatedRules} rule(s) omitted)\n`;
  return out;
}

module.exports = { build, renderRule, executeRunsForRule, expandLoadTargets };
