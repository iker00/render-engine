// JSON Schema fragments for the `shell` block, derived from the same Zod schemas
// `validate-shell.ts` (0122-T2) validates against — never a hand-maintained duplicate. Cached
// module-level (same pattern as `layout-canvas-node-schema.ts`'s `getNodeTypeJsonSchema`) since
// `toJSONSchema` re-derivation on every render would be wasted work: the schema is static.
import { toJSONSchema } from 'zod'
import { menuItemSchema, shellHeaderSchema, shellSidebarSchema, sidebarItemSchema } from '../../config/runtime-config-zod'
import { injectConditionGroupWidgetSentinel } from '../layout-canvas/property-fields/inject-condition-group-widget-sentinel'

let cachedMenuItemJsonSchema: Record<string, unknown> | null = null
let cachedShellHeaderJsonSchema: Record<string, unknown> | null = null
let cachedSidebarItemJsonSchema: Record<string, unknown> | null = null
let cachedShellSidebarJsonSchema: Record<string, unknown> | null = null

/**
 * Schema for a `menuItem`/`menuItemChild` entry: `label`, `icon`, `visibility`, `href`,
 * `action` (discriminated union navigateTo/goBack) and `children` (root-only in the runtime
 * contract, but the Shell config panel never reads `children` off this schema for a child row —
 * it only renders the `children` UI for root items, regardless of what this schema declares).
 *
 * T4 (0132): `visibility` is replaced by the `x-widget: 'condition-group'` sentinel on the cold
 * cache path, same pattern as `getNodeTypeJsonSchema` (T3) — so `MenuItemFieldsEditor`'s
 * dispatcher call mounts `ConditionGroupPropertyField` for it automatically.
 */
export function getMenuItemJsonSchema(): Record<string, unknown> {
  if (!cachedMenuItemJsonSchema) {
    const rawSchema = toJSONSchema(menuItemSchema) as unknown as Record<string, unknown>
    cachedMenuItemJsonSchema = injectConditionGroupWidgetSentinel(rawSchema)
  }
  return cachedMenuItemJsonSchema
}

/**
 * Schema for `shell.header`: `logo` (same shape as `image.props`), `title`, `menu`, `actions`.
 *
 * T4 (0132): the Shell editors never read `menu`'s `visibility` off *this* schema — they call
 * `getMenuItemJsonSchema()` directly (`MenuItemFieldsEditor`) — but `toJSONSchema(shellHeaderSchema)`
 * inlines the full `menuItem` shape under `properties.menu.items` (verified empirically: `menuItem`
 * is referenced only once in this schema's graph, so Zod's `toJSONSchema` doesn't hoist it to
 * `$defs`), leaving its `visibility` unresolved if left untransformed. Wrapped defensively so no raw
 * `visibility` union ever leaks out of this getter, even though nothing consumes it today.
 */
export function getShellHeaderJsonSchema(): Record<string, unknown> {
  if (!cachedShellHeaderJsonSchema) {
    const rawSchema = toJSONSchema(shellHeaderSchema) as unknown as Record<string, unknown>
    cachedShellHeaderJsonSchema = injectConditionGroupWidgetSentinel(rawSchema)
  }
  return cachedShellHeaderJsonSchema
}

/**
 * Schema for a `sidebarItem` entry: `label`, `icon`, `visibility`, `href`, `action`
 * (discriminated union navigateTo/goBack) and a recursive, non-empty `children` of the same
 * shape (unlike `menuItem`, `sidebarItem` allows nesting at any depth, not just one level).
 *
 * T4 (0132): same sentinel substitution as `getMenuItemJsonSchema`. `sidebarItemSchema`'s
 * self-reference resolves as `{ "$ref": "#" }` pointing at this schema's own root rather than a
 * `$defs` entry (T1 finding), so substituting `visibility` once at the root covers every depth of
 * `SidebarItemFieldsEditor`'s recursive rendering.
 */
export function getSidebarItemJsonSchema(): Record<string, unknown> {
  if (!cachedSidebarItemJsonSchema) {
    const rawSchema = toJSONSchema(sidebarItemSchema) as unknown as Record<string, unknown>
    cachedSidebarItemJsonSchema = injectConditionGroupWidgetSentinel(rawSchema)
  }
  return cachedSidebarItemJsonSchema
}

/**
 * Schema for `shell.sidebar`: `items` (array of `sidebarItem`) and `defaultCollapsed`.
 *
 * T4 (0132): unlike `sidebarItemSchema` on its own, nesting it inside `shellSidebarSchema` makes
 * `toJSONSchema` hoist the recursive `sidebarItem` shape into a `$defs` entry (verified
 * empirically), so its `visibility` needs the transform's `$defs` branch here. No current consumer
 * reads `visibility` off this getter (`ShellConfigPanel` doesn't call it at all today), but wrapped
 * for the same defensive reason as `getShellHeaderJsonSchema`.
 */
export function getShellSidebarJsonSchema(): Record<string, unknown> {
  if (!cachedShellSidebarJsonSchema) {
    const rawSchema = toJSONSchema(shellSidebarSchema) as unknown as Record<string, unknown>
    cachedShellSidebarJsonSchema = injectConditionGroupWidgetSentinel(rawSchema)
  }
  return cachedShellSidebarJsonSchema
}
