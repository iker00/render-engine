// JSON Schema fragments for the `shell` block, derived from the same Zod schemas
// `validate-shell.ts` (0122-T2) validates against — never a hand-maintained duplicate. Cached
// module-level (same pattern as `layout-canvas-node-schema.ts`'s `getNodeTypeJsonSchema`) since
// `toJSONSchema` re-derivation on every render would be wasted work: the schema is static.
import { toJSONSchema } from 'zod'
import { menuItemSchema, shellHeaderSchema } from '../../config/runtime-config-zod'

let cachedMenuItemJsonSchema: Record<string, unknown> | null = null
let cachedShellHeaderJsonSchema: Record<string, unknown> | null = null

/**
 * Schema for a `menuItem`/`menuItemChild` entry: `label`, `icon`, `visibility`, `href`,
 * `action` (discriminated union navigateTo/goBack) and `children` (root-only in the runtime
 * contract, but the Shell config panel never reads `children` off this schema for a child row —
 * it only renders the `children` UI for root items, regardless of what this schema declares).
 */
export function getMenuItemJsonSchema(): Record<string, unknown> {
  if (!cachedMenuItemJsonSchema) {
    cachedMenuItemJsonSchema = toJSONSchema(menuItemSchema) as unknown as Record<string, unknown>
  }
  return cachedMenuItemJsonSchema
}

/** Schema for `shell.header`: `logo` (same shape as `image.props`), `title`, `menu`, `actions`. */
export function getShellHeaderJsonSchema(): Record<string, unknown> {
  if (!cachedShellHeaderJsonSchema) {
    cachedShellHeaderJsonSchema = toJSONSchema(shellHeaderSchema) as unknown as Record<string, unknown>
  }
  return cachedShellHeaderJsonSchema
}
