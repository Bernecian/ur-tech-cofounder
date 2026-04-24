#!/usr/bin/env node
'use strict'
const path = require('path')
const { loadRules } = require('../lib/grounding/rules')
const { existsSync } = require('fs')

try {
  const cwd = process.cwd()
  const { path: rp, error } = loadRules(cwd)
  if (!existsSync(rp)) {
    // No grounding.yaml yet — quietly hint on first session
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          'Cofounder grounding: no rules file yet at docs/cofounder/rules/grounding.yaml. ' +
          'Run `/cofounder:setup` and the setup will scaffold a starter template.',
      },
    }))
  } else if (error) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `Cofounder grounding config error: ${error}`,
      },
    }))
  }
} catch (_) { /* silent */ }
