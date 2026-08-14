// Pure JSON-Schema-fragment transform (no `zod`, no React) that swaps out any `visibility`/`when`
// sub-schema for the `x-widget: 'condition-group'` sentinel the dispatcher's `x-widget` hook (T3)
// resolves to `ConditionGroupPropertyField`. Same swap-only-that-key-name pattern as
// `resolveIconPropsSchema` (0129-T2, `layout-canvas-properties-panel.tsx`), but generalized into a
// standalone deep-recursive transform since `visibility`/`when` can appear at arbitrary depth
// (nested union branches, array items, `$defs`) rather than only at a fixed `props.*` position.
//
// Consumed by `layout-canvas-node-schema.ts` (T3) and `shell-config-panel-schema.ts` (T4) on their
// already-cached node/shell JSON schemas — this module itself has no consumers yet.

const CONDITION_GROUP_WIDGET_SENTINEL_KEYS = new Set(['visibility', 'when'])

function buildConditionGroupWidgetSentinel(): Record<string, unknown> {
  return { 'x-widget': 'condition-group' }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Given a schema fragment (a `Record<string, unknown>`, not necessarily the schema root),
 * returns a deep copy with every `visibility`/`when` entry found inside a `properties` object
 * replaced wholesale by the condition-group sentinel. Descends into `properties`, `items`,
 * `oneOf`, `anyOf` and `$defs`; every other key is copied without recursing into its value — in
 * particular `$ref` is left untouched, which is what stops the recursion from following a
 * self-referencing schema (e.g. `sidebarItemSchema`'s recursive `children`) into an infinite loop.
 */
export function injectConditionGroupWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown> {
  return transformFragment(schema)
}

function transformFragment(fragment: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(fragment)) {
    if (key === 'properties' && isPlainObject(value)) {
      result[key] = transformProperties(value)
    } else if (key === 'items') {
      result[key] = transformItems(value)
    } else if ((key === 'oneOf' || key === 'anyOf') && Array.isArray(value)) {
      result[key] = value.map((branch) => (isPlainObject(branch) ? transformFragment(branch) : branch))
    } else if (key === '$defs' && isPlainObject(value)) {
      result[key] = transformDefs(value)
    } else {
      result[key] = value
    }
  }

  return result
}

// Substitution is decided purely by key name (`visibility`/`when`), never by the replaced
// fragment's own shape — same precedent as `resolveIconPropsSchema` (0129-T2).
function transformProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(properties)) {
    if (CONDITION_GROUP_WIDGET_SENTINEL_KEYS.has(key)) {
      result[key] = buildConditionGroupWidgetSentinel()
      continue
    }
    result[key] = isPlainObject(value) ? transformFragment(value) : value
  }

  return result
}

function transformItems(items: unknown): unknown {
  if (Array.isArray(items)) {
    return items.map((item) => (isPlainObject(item) ? transformFragment(item) : item))
  }
  if (isPlainObject(items)) {
    return transformFragment(items)
  }
  return items
}

function transformDefs(defs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(defs)) {
    result[key] = isPlainObject(value) ? transformFragment(value) : value
  }

  return result
}
