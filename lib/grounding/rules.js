const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Cofounder-bundled fork: rules live at docs/cofounder/rules/grounding.yaml
// Override via COFOUNDER_GROUNDING_RULES env var.
function rulesPath(cwd) {
  if (process.env.COFOUNDER_GROUNDING_RULES) return process.env.COFOUNDER_GROUNDING_RULES;
  return path.join(cwd, 'docs', 'cofounder', 'rules', 'grounding.yaml');
}

function loadRules(cwd) {
  const p = rulesPath(cwd);
  if (!fs.existsSync(p)) return { rules: [], path: p, config: null };
  try {
    const parsed = YAML.parse(fs.readFileSync(p, 'utf8'));
    const rules = (parsed && Array.isArray(parsed.rules)) ? parsed.rules : [];
    const config = (parsed && parsed.config) || null;
    return { rules, path: p, config };
  } catch (err) {
    return { rules: [], path: p, config: null, error: err.message };
  }
}

module.exports = { loadRules, rulesPath };
