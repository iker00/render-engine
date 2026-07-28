// Pure JSON-Schema-fragment helpers shared by `PropertyFieldDispatcher` and by the properties
// panel's own subsections (`visibility`, `submitAction`, T9). Kept in their own module (rather
// than alongside the `PropertyFieldDispatcher` component) so this file only exports non-component
// values — Fast Refresh requires component-only modules to preserve state across edits.

// Resolves a single primitive JSON Schema type out of `schema.type`, which may be a
// plain string or a union array (e.g. `['string', 'null']` for nullable properties).
export function resolvePrimarySchemaType(schema: Record<string, unknown>): string | undefined {
  const { type } = schema
  if (typeof type === 'string') return type
  if (Array.isArray(type)) {
    return type.find((candidate) => candidate !== 'null' && typeof candidate === 'string')
  }
  return undefined
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getUnionBranches(schema: Record<string, unknown>): Record<string, unknown>[] | undefined {
  const branches = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined
  return branches as Record<string, unknown>[] | undefined
}

// Fixed discriminator property name, matching the project's own `z.discriminatedUnion('type', …)`
// convention (D5, design.md) — not configurable per schema.
const UNION_DISCRIMINATOR_KEY = 'type'

function getBranchDiscriminatorValue(branch: Record<string, unknown>): string | undefined {
  if (branch.type !== 'object') return undefined
  const properties = branch.properties
  if (!isPlainObject(properties)) return undefined
  const discriminatorSchema = properties[UNION_DISCRIMINATOR_KEY]
  if (!isPlainObject(discriminatorSchema)) return undefined
  if (typeof discriminatorSchema.const === 'string') return discriminatorSchema.const
  if (Array.isArray(discriminatorSchema.enum) && discriminatorSchema.enum.length === 1 && typeof discriminatorSchema.enum[0] === 'string') {
    return discriminatorSchema.enum[0]
  }
  return undefined
}

export interface DiscriminatedUnionVariant {
  typeValue: string
  schema: Record<string, unknown>
}

/**
 * Detects the "discriminated union with explicit selector" pattern (T5, D5 in design.md): a
 * `oneOf`/`anyOf` schema whose branches are all objects sharing a literal in the same
 * `properties.type` (`const`, or a single-value `enum`). Returns the variant catalog (in branch
 * order) when the pattern matches, `undefined` otherwise.
 *
 * Distinct from `resolveUnionBranch` below, which resolves unions with NO explicit discriminator
 * (e.g. `visibility`'s single-condition-vs-group, `layout.span`'s integer-vs-responsive-map) by
 * matching the current value's shape — the user never picks a branch for those.
 */
export function getDiscriminatedUnionVariants(schema: Record<string, unknown>): DiscriminatedUnionVariant[] | undefined {
  const branches = getUnionBranches(schema)
  if (!branches || branches.length === 0) return undefined

  const variants: DiscriminatedUnionVariant[] = []
  for (const branch of branches) {
    const typeValue = getBranchDiscriminatorValue(branch)
    if (typeValue === undefined) return undefined
    variants.push({ typeValue, schema: branch })
  }
  return variants
}

/**
 * Resolves a JSON Schema `anyOf`/`oneOf` union down to the single branch that matches `value`'s
 * shape: the object branch whose `required` keys are all present on `value` when `value` is
 * itself a plain object, or the first non-object branch otherwise (falling back to the first
 * branch if nothing else matches). Applies only to unions whose branches are plain objects that
 * do NOT share a common literal `type` discriminant (D5) — e.g. `layout.span` (integer |
 * responsive per-breakpoint map) or a node's `visibility` (single condition | group). A schema
 * that DOES share a literal `type` discriminant (T5's "discriminated union with selector") is
 * returned unchanged instead: the dispatcher's own top-level entry point detects that pattern and
 * renders a `DiscriminatedUnionPropertyField`, which owns picking the branch (via the user's
 * selection), not this by-shape resolver.
 *
 * This is applied during the dispatcher's own recursion — once per object property (
 * `ObjectPropertyField`) and once per array item (`ArrayPropertyField`) — so a union nested
 * anywhere inside `props`/`layout`/`queryStateFeedback` resolves against that field's own current
 * value before being handed to a nested `PropertyFieldDispatcher` call. It does NOT resolve a
 * union schema passed directly as the dispatcher's own top-level `schema` prop; callers that pass
 * such a schema (e.g. the properties panel's `visibility`/`submitAction` subsections) must resolve
 * it themselves before calling in — or, for a discriminated union, simply pass it through
 * unchanged, since the dispatcher's own top-level detection covers it.
 */
export function resolveUnionBranch(
  schema: Record<string, unknown> | undefined,
  value: unknown,
): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object') return schema

  if (getDiscriminatedUnionVariants(schema)) return schema

  const branches = getUnionBranches(schema)
  if (!branches || branches.length === 0) return schema

  if (!isPlainObject(value)) {
    return branches.find((branch) => branch.type !== 'object') ?? branches[0]
  }

  const matchByRequiredKeys = branches.find((branch) => {
    if (branch.type !== 'object') return false
    const required = Array.isArray(branch.required) ? (branch.required as string[]) : []
    return required.every((key) => key in value)
  })
  return matchByRequiredKeys ?? branches.find((branch) => branch.type === 'object') ?? branches[0]
}

export function buildDefaultValueForSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return ''

  // A discriminated union (T5) defaults to its first variant fully populated — e.g. adding an
  // entry to `submitAction.onSuccess` (itself a `oneOf` of the 7 action variants) seeds a real
  // `{ type: 'navigateTo', pageId: '' }` instead of an unusable `''`/`{}`.
  const discriminatedUnionVariants = getDiscriminatedUnionVariants(schema)
  if (discriminatedUnionVariants && discriminatedUnionVariants.length > 0) {
    const [firstVariant] = discriminatedUnionVariants
    return { ...buildDefaultObjectForRequiredFields(firstVariant.schema), type: firstVariant.typeValue }
  }

  switch (resolvePrimarySchemaType(schema)) {
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return false
    case 'object':
      return buildDefaultObjectForRequiredFields(schema)
    case 'array': {
      // Respect `minItems` (e.g. `executeOperations.operations`, RF7) instead of always defaulting
      // to `[]`: an array required to be non-empty must start structurally valid.
      const itemsSchema = isPlainObject(schema.items) ? schema.items : undefined
      const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0
      return Array.from({ length: minItems }, () => buildDefaultValueForSchema(itemsSchema))
    }
    default:
      // A caller (e.g. the tabs properties panel) may seed a non-empty default onto a string
      // sub-schema so that adding an array item produces a usable value instead of `''`.
      return typeof schema.default === 'string' ? schema.default : ''
  }
}

// Builds an object default satisfying only the sub-schema's own `required` fields, recursing
// through this same builder per field. This is what lets adding an item to an array of objects
// (e.g. `tabs.props.items`) produce `{ label: 'Nueva pestaña' }` instead of `{}` — the item stays
// structurally valid without inventing values for optional fields the schema doesn't require.
export function buildDefaultObjectForRequiredFields(schema: Record<string, unknown>): Record<string, unknown> {
  const properties =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, Record<string, unknown>>)
      : {}
  const requiredFields = Array.isArray(schema.required) ? (schema.required as string[]) : []

  const defaultObject: Record<string, unknown> = {}
  for (const key of requiredFields) {
    const propertySchema = properties[key]
    defaultObject[key] = buildDefaultValueForSchema(
      propertySchema && typeof propertySchema === 'object' ? propertySchema : undefined,
    )
  }
  return defaultObject
}
