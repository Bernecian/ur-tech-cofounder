const { spawn } = require('child_process');

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_MAX_BYTES = 4096;
const STDERR_CAP = 1024;

function runCommand(cmd, {
  timeout = DEFAULT_TIMEOUT,
  maxBytes = DEFAULT_MAX_BYTES,
  cwd,
  env,
  shell = true,
} = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let child;
    try {
      child = spawn(cmd, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        shell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({
        ok: false, stdout: '', stderr: err.message,
        code: null, ms: 0, timedOut: false, truncated: false,
      });
    }

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGKILL'); } catch (_) {}
    }, timeout);

    child.stdout.on('data', (chunk) => {
      if (stdout.length >= maxBytes) return;
      const remaining = maxBytes - stdout.length;
      if (chunk.length > remaining) {
        stdout += chunk.slice(0, remaining).toString('utf8');
        truncated = true;
        try { child.kill('SIGTERM'); } catch (_) {}
      } else {
        stdout += chunk.toString('utf8');
      }
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length >= STDERR_CAP) return;
      const remaining = STDERR_CAP - stderr.length;
      stderr += chunk.slice(0, remaining).toString('utf8');
    });
    child.on('error', (err) => {
      finish({
        ok: false, stdout, stderr: err.message, code: null,
        ms: Date.now() - started, timedOut, truncated,
      });
    });
    child.on('close', (code) => {
      finish({
        ok: code === 0 && !timedOut, stdout, stderr, code,
        ms: Date.now() - started, timedOut, truncated,
      });
    });
  });
}

function normalizeRun(entry) {
  if (typeof entry === 'string') return { cmd: entry };
  if (entry && typeof entry === 'object' && typeof entry.cmd === 'string') return entry;
  return null;
}

module.exports = { runCommand, normalizeRun, DEFAULT_TIMEOUT, DEFAULT_MAX_BYTES };
