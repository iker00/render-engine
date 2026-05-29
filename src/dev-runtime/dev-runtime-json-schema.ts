// zod-to-json-schema@3.x does not support Zod v4 internals (no _def.typeName).
// Zod v4 provides a built-in toJSONSchema function that handles its own schema structure.
import { toJSONSchema } from 'zod'
import { runtimeConfigRootSchema } from '../config/runtime-config-root-zod'

let cachedSchema: Record<string, unknown> | null = null

export function getRuntimeConfigJsonSchema(): Record<string, unknown> {
  if (cachedSchema === null) {
    cachedSchema = toJSONSchema(runtimeConfigRootSchema) as unknown as Record<string, unknown>
  }
  return cachedSchema
}
