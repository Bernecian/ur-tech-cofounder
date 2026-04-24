const { globToRegex } = require('./util');

function anyKeywordHit(keywords, lowerPrompt) {
  for (const k of keywords || []) {
    if (lowerPrompt.includes(String(k).toLowerCase())) return true;
  }
  return false;
}

function anyPathHit(paths, prompt) {
  if (!paths || !paths.length) return false;
  const tokens = prompt.split(/[\s,()`'"]+/).filter(t => t.includes('/') || t.includes('.'));
  if (!tokens.length) return false;
  for (const g of paths) {
    const re = globToRegex(String(g));
    for (const t of tokens) if (re.test(t)) return true;
  }
  return false;
}

function matchRule(rule, prompt) {
  const m = rule.match || rule;
  const lower = prompt.toLowerCase();

  const exclude = m.exclude || {};
  if (anyKeywordHit(exclude.keywords, lower)) return false;
  if (anyPathHit(exclude.paths, prompt)) return false;

  if (anyKeywordHit(m.keywords, lower)) return true;
  if (anyPathHit(m.paths, prompt)) return true;
  return false;
}

function pickRules(rules, prompt) {
  return (rules || []).filter(r => matchRule(r, prompt));
}

module.exports = { matchRule, pickRules };
