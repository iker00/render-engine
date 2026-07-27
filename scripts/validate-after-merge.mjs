import { readFileSync, writeFileSync } from 'fs'
import { validateRuntimeConfig } from '../src/config/runtime-config.ts'
const config = JSON.parse(readFileSync('./dist/unified-config/ADE_Unificado.json','utf8'))
const result = validateRuntimeConfig(config)
const out = result.status === 'ready' ? { status: 'ready' } : { status: result.status, error: result.error }
writeFileSync('./scripts/validate-after-merge.json', JSON.stringify(out, null, 2))
console.error(JSON.stringify(out))
