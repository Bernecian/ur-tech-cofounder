const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.turbo', '.cache']);

function globToRegex(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*' && g[i + 2] === '/') {
      r += '(?:.*/)?';
      i += 2;
    } else if (c === '*' && g[i + 1] === '*') {
      r += '.*';
      i++;
    } else if (c === '*') {
      r += '[^/]*';
    } else if (c === '?') {
      r += '[^/]';
    } else if (/[.+^$()|\\\[\]{}]/.test(c)) {
      r += '\\' + c;
    } else {
      r += c;
    }
  }
  return new RegExp('^' + r + '$');
}

function isGlob(s) {
  return /[*?]/.test(s);
}

function expandGlob(cwd, pattern, { maxFiles = 50 } = {}) {
  if (!isGlob(pattern)) {
    const p = path.resolve(cwd, pattern);
    try {
      return fs.statSync(p).isFile() ? [pattern] : [];
    } catch (_) {
      return [];
    }
  }
  const re = globToRegex(pattern);
  const out = [];
  const walk = (dir) => {
    if (out.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (out.length >= maxFiles) return;
      if (IGNORED_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.') && e.name !== '.') continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(cwd, full);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && re.test(rel)) out.push(rel);
    }
  };
  walk(cwd);
  return out;
}

module.exports = { globToRegex, isGlob, expandGlob };
