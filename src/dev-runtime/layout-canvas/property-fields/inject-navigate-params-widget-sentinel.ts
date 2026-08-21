// Pure JSON-Schema-fragment transform (no `zod`, no React) that swaps out any `params` sub-schema
// for the `x-widget: 'navigate-params'` sentinel the dispatcher's `x-widget` hook (T3) resolves to
// `NavigateParamsPropertyField`. Same swap-only-that-key-name deep-recursive pattern as
// `injectConditionGroupWidgetSentinel` (`./inject-condition-group-widget-sentinel.ts`, feature
// `0132`), duplicated here as an independent module rather than generalizing that transform to
// accept a parameterized key/widget — same precedent already established in the project for
// near-identical but distinct schema transforms (`dropHrefActionWhereChildrenExist` vs.
// `dropHrefActionWhereChildrenExistFromSidebarItem` in `shell-config-panel.tsx`).
//
// Consumed by `layout-canvas-node-schema.ts` (T3) and the `Shell` schema getter (T4) on their
// already-cached node/shell JSON schemas — this module itself has no consumers yet.

const NAVIGATE_PARAMS_WIDGET_SENTINEL_KEY = 'params'

function buildNavigateParamsWidgetSentinel(): Record<string, unknown> {
  return { 'x-widget': 'navigate-params' }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Given a schema fragment (a `Record<string, unknown>`, not necessarily the schema root),
 * returns a deep copy with every `params` entry found inside a `properties` object replaced
 * wholesale by the navigate-params sentinel. Descends into `properties`, `items`, `oneOf`,
 * `anyOf` and `$defs`; every other key is copied without recursing into its value — in
 * particular `$ref` is left untouched, which is what stops the recursion from following a
 * self-referencing schema into an infinite loop.
 */
export function injectNavigateParamsWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown> {
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

// Substitution is decided purely by key name (`params`), never by the replaced fragment's own
// shape — same precedent as `injectConditionGroupWidgetSentinel`.
function transformProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(properties)) {
    if (key === NAVIGATE_PARAMS_WIDGET_SENTINEL_KEY) {
      result[key] = buildNavigateParamsWidgetSentinel()
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
