import { readFileSync, writeFileSync } from 'fs'
import { validateSelectItemsContract } from '../src/config/validate-form-nodes.ts'
const config = JSON.parse(readFileSync('./dist/unified-config/ADE_Unificado.json','utf8'))
const page = config.pages.find(p => p.id === 'crear-hecho')
const form = page.layout[0].children[2].children[1]
const select = form.children[3]
const result = validateSelectItemsContract(select.props.items, 'layout[0].children[2].children[1].children[3].props.items', 'crear-hecho')
writeFileSync('./scripts/select-items-debug.json', JSON.stringify({ items: select.props.items, result }, null, 2))
console.error(JSON.stringify({ items: select.props.items, result }, null, 2))
