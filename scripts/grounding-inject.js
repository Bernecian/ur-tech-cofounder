#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const { build } = require('../lib/grounding/inject')

;(async () => {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'))
    const cwd = input.cwd || process.cwd()
    const prompt = String(input.prompt || '')

    // Store last prompt for /r:why equivalent debug aid
    try {
      fs.mkdirSync(path.join(cwd, 'docs', 'cofounder', '.state'), { recursive: true })
      fs.writeFileSync(path.join(cwd, 'docs', 'cofounder', '.state', 'last-prompt'), prompt)
    } catch (_) { /* silent */ }

    const ctx = await build(cwd, prompt)
    if (ctx) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
      }))
    }
  } catch (_) { /* silent — never block the session */ }
})()
