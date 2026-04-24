import YAML from 'yaml'

const FM_FENCE = '---'

export function parse(content) {
  if (!content.startsWith(FM_FENCE + '\n')) return { data: {}, body: content }
  const end = content.indexOf('\n' + FM_FENCE + '\n', FM_FENCE.length)
  if (end < 0) return { data: {}, body: content }
  const yamlStr = content.slice(FM_FENCE.length + 1, end)
  const body = content.slice(end + FM_FENCE.length + 2)
  try {
    return { data: YAML.parse(yamlStr) ?? {}, body }
  } catch {
    return { data: {}, body: content }
  }
}

export function stringify(data, body) {
  const fm = YAML.stringify(data).trimEnd()
  return `${FM_FENCE}\n${fm}\n${FM_FENCE}\n\n${body ?? ''}`
}
