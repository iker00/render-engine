import type { ComponentType } from 'react'
import { BooleanPropertyField } from './boolean-property-field'
import { ChoiceItemsPropertyField } from './choice-items-property-field'
import { DiscriminatedUnionPropertyField } from './discriminated-union-property-field'
import { EnumPropertyField } from './enum-property-field'
import { KeyValuePropertyField } from './key-value-property-field'
import { NumberPropertyField } from './number-property-field'
import { RawJsonPropertyField } from './raw-json-property-field'
import { TextPropertyField } from './text-property-field'

interface WidgetComponentProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

// Closed registry for the `x-widget` hook (D5, T4 0108): a schema fragment can opt out of every
// generic pattern below by declaring `'x-widget': '<key>'`, and the dispatcher delegates to the
// matching component instead. Deliberately not exported — there is no public API to register a
// widget from outside this module, only this fixed catalog.
const WIDGET_REGISTRY: Record<string, ComponentType<WidgetComponentProps>> = {
  'choice-items': ChoiceItemsPropertyField,
}

export interface PropertyFieldDispatcherProps {
  schema: Record<string, unknown> | undefined
  value: unknown
  onChange: (value: unknown) => void
  label: string
  required?: boolean
}

// Resolves a single primitive JSON Schema type out of `schema.type`, which may be a
// plain string or a union array (e.g. `['string', 'null']` for nullable properties).
function resolvePrimarySchemaType(schema: Record<string, unknown>): string | undefined {
  const { type } = schema
  if (typeof type === 'string') return type
  if (Array.isArray(type)) {
    return type.find((candidate) => candidate !== 'null' && typeof candidate === 'string')
  }
  return undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// A schema fragment that is nothing but a `$ref` pointer (e.g. `{ "$ref": "#/$defs/__schema0" }`).
// `runtimeApiBodySchema` (`params`/`operations[]`/`submitAction`'s `body`, T7) is the one recursive
// schema exposed to this dispatcher — `z.lazy(() => z.union([...,  z.record(z.string(), body)]))` —
// and a self-referencing schema can never be inlined by `toJSONSchema`, so it always arrives here as
// a bare `$ref` with no `type`/`anyOf`/`oneOf` of its own to inspect.
function isBareRefSchema(schema: Record<string, unknown>): boolean {
  return typeof schema.$ref === 'string'
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
function getDiscriminatedUnionVariants(schema: Record<string, unknown>): DiscriminatedUnionVariant[] | undefined {
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

function buildDefaultValueForSchema(schema: Record<string, unknown> | undefined): unknown {
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

/**
 * `PropertyFieldDispatcher` is a schema-agnostic dispatcher for editing a JSON Schema fragment +
 * its current value. It knows nothing about `LayoutNode`; callers (T9) feed it sub-schemas such
 * as a node's `properties.props`.
 */
export function PropertyFieldDispatcher({ schema, value, onChange, label, required = false }: PropertyFieldDispatcherProps) {
  if (!schema || typeof schema !== 'object') {
    return <RawJsonPropertyField label={label} value={value} onChange={onChange} />
  }

  // `x-widget` hook (D5, T4 0108): takes priority over every generic pattern below. Only a schema
  // fragment whose `x-widget` matches an entry in the closed `WIDGET_REGISTRY` is affected; any
  // other `x-widget` value (or none) falls through to the generic detectors unchanged.
  const widgetKey = typeof schema['x-widget'] === 'string' ? (schema['x-widget'] as string) : undefined
  const WidgetComponent = widgetKey ? WIDGET_REGISTRY[widgetKey] : undefined
  if (WidgetComponent) {
    return <WidgetComponent label={label} value={value} onChange={onChange} />
  }

  // `body` (T7): a bare `$ref` schema (see `isBareRefSchema`) has no `type`/`anyOf`/`oneOf` this
  // dispatcher can resolve generically — the recursive schema's `$defs` entry isn't threaded down
  // through the recursive calls that got us here. Rather than plumbing `$defs` through the whole
  // tree for the one recursive schema in this codebase, resolve the same way `resolveUnionBranch`
  // resolves any other undiscriminated union: by the current value's shape. A plain object matches
  // the union's `record(string, body)` branch, so it gets the same KV editor as `headers`/`query`
  // (T6) — except each row's own value can itself be an object/array, which
  // `KeyValuePropertyField` (T7) falls back to a disabled raw-JSON slot for, per row. Any other
  // value shape (string, number, boolean, null, array) keeps falling through to the raw-JSON escape
  // hatch below, unchanged from before T7.
  if (isBareRefSchema(schema) && isPlainObject(value)) {
    return <KeyValuePropertyField label={label} value={value} onChange={onChange} />
  }

  // Discriminated union with an explicit selector (T5) takes priority over the generic shape
  // checks below — a schema with `oneOf`/`anyOf` has no top-level `type`/`enum` of its own, so
  // this never shadows the primitive branches.
  const discriminatedUnionVariants = getDiscriminatedUnionVariants(schema)
  if (discriminatedUnionVariants) {
    return (
      <DiscriminatedUnionPropertyField
        variants={discriminatedUnionVariants}
        value={value}
        onChange={onChange}
        label={label}
        required={required}
      />
    )
  }

  const enumOptions = Array.isArray(schema.enum) ? (schema.enum as (string | number)[]) : undefined
  if (enumOptions && enumOptions.length > 0) {
    const enumValue = typeof value === 'string' || typeof value === 'number' ? value : enumOptions[0]
    return (
      <EnumPropertyField
        label={label}
        value={enumValue}
        options={enumOptions}
        onChange={onChange}
        required={required}
      />
    )
  }

  const schemaType = resolvePrimarySchemaType(schema)

  if (schemaType === 'string') {
    return (
      <TextPropertyField
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        required={required}
      />
    )
  }

  if (schemaType === 'number' || schemaType === 'integer') {
    return (
      <NumberPropertyField
        label={label}
        value={typeof value === 'number' ? value : 0}
        onChange={onChange}
        required={required}
      />
    )
  }

  if (schemaType === 'boolean') {
    return <BooleanPropertyField label={label} value={Boolean(value)} onChange={onChange} />
  }

  if (schemaType === 'array') {
    const itemsSchema = schema.items && typeof schema.items === 'object' ? (schema.items as Record<string, unknown>) : undefined
    const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0
    return (
      <ArrayPropertyField
        label={label}
        value={Array.isArray(value) ? value : []}
        itemsSchema={itemsSchema}
        minItems={minItems}
        onChange={onChange}
      />
    )
  }

  if (schemaType === 'object') {
    const propertiesSchema =
      schema.properties && typeof schema.properties === 'object'
        ? (schema.properties as Record<string, Record<string, unknown>>)
        : undefined
    const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

    // Open string-to-string map (T6, e.g. `httpRequest.headers`): no declared `properties`, plus
    // `additionalProperties: { type: 'string' }`. Takes priority over the generic `properties`
    // branch below, which stays for objects with a fixed, declared shape.
    const additionalProperties = schema.additionalProperties
    const isStringKeyValueMap =
      !propertiesSchema &&
      isPlainObject(additionalProperties) &&
      resolvePrimarySchemaType(additionalProperties) === 'string'
    if (isStringKeyValueMap) {
      return <KeyValuePropertyField label={label} value={objectValue} onChange={onChange} />
    }

    const requiredFields = Array.isArray(schema.required) ? (schema.required as string[]) : []
    return (
      <ObjectPropertyField
        label={label}
        value={objectValue}
        propertiesSchema={propertiesSchema}
        requiredFields={requiredFields}
        onChange={onChange}
      />
    )
  }

  // Unrecognized shape (missing type, unsupported union, etc.): escape hatch. The property
  // stays editable from Monaco even when the generated form can't represent it.
  return <RawJsonPropertyField label={label} value={value} onChange={onChange} />
}

interface ArrayPropertyFieldProps {
  label: string
  value: unknown[]
  itemsSchema: Record<string, unknown> | undefined
  minItems: number
  onChange: (value: unknown[]) => void
}

function ArrayPropertyField({ label, value, itemsSchema, minItems, onChange }: ArrayPropertyFieldProps) {
  // Generic JSON Schema `minItems` support: once the array is at its declared minimum, removing
  // another item would produce an invalid array, so "Quitar" is disabled rather than hidden
  // (native `disabled`, per the project's accessibility standard for disabled controls).
  const canRemove = value.length > minItems

  function handleItemChange(index: number, itemValue: unknown) {
    const next = value.slice()
    next[index] = itemValue
    onChange(next)
  }

  function handleAdd() {
    onChange([...value, buildDefaultValueForSchema(itemsSchema)])
  }

  function handleRemove(index: number) {
    if (!canRemove) return
    onChange(value.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      {value.map((itemValue, index) => {
        const resolvedItemSchema = resolveUnionBranch(itemsSchema, itemValue)
        // An existing array slot always has a value — presence is controlled by Añadir/Quitar,
        // not by the item itself being "optional". For a discriminated-union item (T5, e.g.
        // `submitAction.onSuccess[]`) this suppresses the "Sin acción" option, which would
        // otherwise let an entry hold an `undefined` hole in the array. Scalar/object items are
        // unaffected (`required` only decorates their label with `*` otherwise).
        const itemRequired = Boolean(resolvedItemSchema && getDiscriminatedUnionVariants(resolvedItemSchema))
        return (
          // Items have no stable identity of their own (they are plain JSON values), so the
          // index is the only ordering key available here; consistent with the array's own semantics.
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <PropertyFieldDispatcher
                schema={resolvedItemSchema}
                value={itemValue}
                onChange={(nextValue) => handleItemChange(index, nextValue)}
                label={`${label} #${index + 1}`}
                required={itemRequired}
              />
            </div>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              disabled={!canRemove}
              aria-label={`Quitar ${label} #${index + 1}`}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Quitar
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Añadir ${label}`}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Añadir
      </button>
    </fieldset>
  )
}

interface ObjectPropertyFieldProps {
  label: string
  value: Record<string, unknown>
  propertiesSchema: Record<string, Record<string, unknown>> | undefined
  requiredFields: string[]
  onChange: (value: Record<string, unknown>) => void
}

function ObjectPropertyField({ label, value, propertiesSchema, requiredFields, onChange }: ObjectPropertyFieldProps) {
  const propertyEntries = propertiesSchema ? Object.entries(propertiesSchema) : []

  function handlePropertyChange(key: string, propertyValue: unknown) {
    onChange({ ...value, [key]: propertyValue })
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      {propertyEntries.map(([key, propertySchema]) => (
        <PropertyFieldDispatcher
          key={key}
          schema={resolveUnionBranch(propertySchema, value[key])}
          value={value[key]}
          onChange={(nextValue) => handlePropertyChange(key, nextValue)}
          label={key}
          required={requiredFields.includes(key)}
        />
      ))}
    </fieldset>
  )
}

