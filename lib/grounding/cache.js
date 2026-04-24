const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_TTL_MS = 60 * 1000;

// Cofounder-bundled fork: cache lives at docs/cofounder/.state/cache/ (git-ignored)
function cacheDir(cwd) {
  return path.join(cwd, 'docs', 'cofounder', '.state', 'cache');
}

function keyFor(cmd, cwd) {
  return crypto.createHash('sha256').update(cmd + '\0' + cwd).digest('hex').slice(0, 16);
}

function get(cwd, cmd, ttlMs = DEFAULT_TTL_MS) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return null;
  const file = path.join(cacheDir(cwd), keyFor(cmd, cwd) + '.json');
  if (!fs.existsSync(file)) return null;
  try {
    const { ts, result } = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!ts || Date.now() - ts > ttlMs) return null;
    return result;
  } catch (_) {
    return null;
  }
}

function set(cwd, cmd, result) {
  try {
    const dir = cacheDir(cwd);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, keyFor(cmd, cwd) + '.json');
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), result }));
  } catch (_) { /* silent */ }
}

function clear(cwd) {
  const dir = cacheDir(cwd);
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { fs.unlinkSync(path.join(dir, f)); n++; } catch (_) {}
  }
  return n;
}

module.exports = { get, set, clear, keyFor, cacheDir, DEFAULT_TTL_MS };
