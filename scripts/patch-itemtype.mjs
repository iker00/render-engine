import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

function patchItems(node, stats) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((child) => patchItems(child, stats))
    return
  }
  if (node.props && node.props.items && typeof node.props.items === 'object' && !Array.isArray(node.props.items)) {
    const items = node.props.items
    if (typeof items.source === 'string' && typeof items.label === 'string' && typeof items.value === 'string' && items.itemType === undefined) {
      // Insert itemType after source for readability
      node.props.items = {
        source: items.source,
        itemType: 'object',
        label: items.label,
        value: items.value,
        ...Object.fromEntries(Object.entries(items).filter(([k]) => !['source','label','value'].includes(k))),
      }
      stats.count += 1
    }
  }
  for (const value of Object.values(node)) patchItems(value, stats)
}

const files = [
  'dist/unified-config/ADE_Unificado.json',
  ...readdirSync('src/dev/portal-config').filter((f) => f.endsWith('.json')).map((f) => join('src/dev/portal-config', f)),
  ...readdirSync('src/dev/tests-config').filter((f) => f.endsWith('.json')).map((f) => join('src/dev/tests-config', f)),
]

const report = []
for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const json = JSON.parse(raw)
  const stats = { count: 0 }
  patchItems(json, stats)
  if (stats.count > 0) {
    writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
  }
  report.push({ file, patched: stats.count })
}
writeFileSync('./scripts/itemtype-patch-report.json', JSON.stringify(report, null, 2))
console.error(JSON.stringify(report.filter((r) => r.patched > 0), null, 2))
