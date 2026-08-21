import type { ComponentType } from 'react'
import { useId } from 'react'
import { BooleanPropertyField } from './boolean-property-field'
import { ChoiceItemsPropertyField } from './choice-items-property-field'
import { ColorSwatchPropertyField } from './color-swatch-property-field'
import { ConditionGroupPropertyField } from './condition-group-property-field'
import { DiscriminatedUnionPropertyField } from './discriminated-union-property-field'
import { EnumPropertyField } from './enum-property-field'
import { HeadingLevelPropertyField } from './heading-level-property-field'
import { IconPickerPropertyField } from './icon-picker-property-field'
import { KeyValuePropertyField } from './key-value-property-field'
import { LayoutSpanPropertyField } from './layout-span-property-field'
import { NavigateParamsPropertyField } from './navigate-params-property-field'
import { NumberPropertyField } from './number-property-field'
import { PropertyFieldRow } from './property-field-row'
import { QueryStateFeedbackAccordionPropertyField } from './query-state-feedback-accordion-property-field'
import { RawJsonPropertyField } from './raw-json-property-field'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'
import { TabsOrientationPropertyField } from './tabs-orientation-property-field'
import { TextPropertyField } from './text-property-field'
import {
  buildDefaultValueForSchema,
  getDiscriminatedUnionVariants,
  isPlainObject,
  resolvePrimarySchemaType,
  resolveUnionBranch,
} from './property-field-schema-resolution'

// Bounded enum cardinality (FR1/FR2, T1 0134) that switches the generic `enum` branch from
// `EnumPropertyField` (`<select>`) to the shared segmented-toggle control. Below this range (a
// single option) a `<select>` is still the simplest control; above it (6+) a pill row would wrap
// or overflow, so `<select>` stays the fallback on both ends.
const SEGMENTED_ENUM_MIN_OPTIONS = 2
const SEGMENTED_ENUM_MAX_OPTIONS = 5

interface WidgetComponentProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
  // T4 (0133): forwarded from the dispatcher's own `hideRootLegend` (see
  // `PropertyFieldDispatcherProps` below) only for the widget resolved at the top level of a call —
  // never for a widget reached through recursion. Every widget except `ConditionGroupPropertyField`
  // ignores it (their own prop signatures simply don't declare it), which is fine: an extra,
  // unused optional prop is a no-op for a component that never destructures it.
  hideRootLegend?: boolean
}

// Closed registry for the `x-widget` hook (D5, T4 0108): a schema fragment can opt out of every
// generic pattern below by declaring `'x-widget': '<key>'`, and the dispatcher delegates to the
// matching component instead. Deliberately not exported — there is no public API to register a
// widget from outside this module, only this fixed catalog.
const WIDGET_REGISTRY: Record<string, ComponentType<WidgetComponentProps>> = {
  'choice-items': ChoiceItemsPropertyField,
  'layout-span': LayoutSpanPropertyField,
  'heading-level': HeadingLevelPropertyField,
  'tabs-orientation': TabsOrientationPropertyField,
  icon: IconPickerPropertyField,
  'condition-group': ConditionGroupPropertyField,
  'color-swatch': ColorSwatchPropertyField,
  'query-state-feedback-accordion': QueryStateFeedbackAccordionPropertyField,
  'navigate-params': NavigateParamsPropertyField,
}

export interface PropertyFieldDispatcherProps {
  schema: Record<string, unknown> | undefined
  value: unknown
  onChange: (value: unknown) => void
  label: string
  required?: boolean
  // T4 (0133), FR6: set by the properties panel only on its top-level call for a tab's content —
  // never propagated into any recursive `PropertyFieldDispatcher` call this component makes itself
  // (`ObjectPropertyField`'s per-property fields, `ArrayPropertyField`'s per-item fields). Applied
  // only to the two shapes that render a root `legend` of their own: `ObjectPropertyField` (renders
  // it `sr-only` instead of hiding the field) and a resolved `x-widget` component (forwarded as-is;
  // only `ConditionGroupPropertyField` currently consumes it). Defaults to `false`.
  hideRootLegend?: boolean
}

// A schema fragment that is nothing but a `$ref` pointer (e.g. `{ "$ref": "#/$defs/__schema0" }`).
// `runtimeApiBodySchema` (`params`/`operations[]`/`submitAction`'s `body`, T7) is the one recursive
// schema exposed to this dispatcher — `z.lazy(() => z.union([...,  z.record(z.string(), body)]))` —
// and a self-referencing schema can never be inlined by `toJSONSchema`, so it always arrives here as
// a bare `$ref` with no `type`/`anyOf`/`oneOf` of its own to inspect.
function isBareRefSchema(schema: Record<string, unknown>): boolean {
  return typeof schema.$ref === 'string'
}

/**
 * `PropertyFieldDispatcher` is a schema-agnostic dispatcher for editing a JSON Schema fragment +
 * its current value. It knows nothing about `LayoutNode`; callers (T9) feed it sub-schemas such
 * as a node's `properties.props`.
 */
export function PropertyFieldDispatcher({
  schema,
  value,
  onChange,
  label,
  required = false,
  hideRootLegend = false,
}: PropertyFieldDispatcherProps) {
  if (!schema || typeof schema !== 'object') {
    return <RawJsonPropertyField label={label} value={value} onChange={onChange} />
  }

  // `x-widget` hook (D5, T4 0108): takes priority over every generic pattern below. Only a schema
  // fragment whose `x-widget` matches an entry in the closed `WIDGET_REGISTRY` is affected; any
  // other `x-widget` value (or none) falls through to the generic detectors unchanged.
  const widgetKey = typeof schema['x-widget'] === 'string' ? (schema['x-widget'] as string) : undefined
  const WidgetComponent = widgetKey ? WIDGET_REGISTRY[widgetKey] : undefined
  if (WidgetComponent) {
    return <WidgetComponent label={label} value={value} onChange={onChange} hideRootLegend={hideRootLegend} />
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
    // FR1/FR2 (T1, 0134): a bounded enum (2-5 options, not otherwise resolved by `x-widget` above)
    // renders as a segmented control instead of a `<select>` — same label-left/control-right row,
    // just a different control on the right. 1 option or 6+ keeps the existing `<select>`.
    if (enumOptions.length >= SEGMENTED_ENUM_MIN_OPTIONS && enumOptions.length <= SEGMENTED_ENUM_MAX_OPTIONS) {
      return <SegmentedEnumPropertyField label={label} value={enumValue} options={enumOptions} onChange={onChange} required={required} />
    }
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
        hideRootLegend={hideRootLegend}
      />
    )
  }

  // Unrecognized shape (missing type, unsupported union, etc.): escape hatch. The property
  // stays editable from Monaco even when the generated form can't represent it.
  return <RawJsonPropertyField label={label} value={value} onChange={onChange} />
}

interface SegmentedEnumPropertyFieldProps {
  label: string
  value: string | number
  options: readonly (string | number)[]
  onChange: (value: string | number) => void
  required?: boolean
}

// Generic segmented enum (FR1/FR2, T1 0134): same label-left/control-right row `EnumPropertyField`
// already uses, but the control is the shared `SegmentedTogglePropertyField` radiogroup instead of
// a `<select>`. Segment labels are always `String(option)` — no translation layer, unlike the
// discriminated-union selector's `optionLabels`.
//
// `SegmentedTogglePropertyField` exposes no single focusable element with an `id` of its own to
// give `PropertyFieldRow`'s required `htmlFor` — its accessibility is already covered by its own
// `radiogroup` `aria-label`. The `useId()` value below only satisfies that prop signature; the
// row's visible `<label>` has no functional focus association here. Accepted limitation, not a bug
// to fix in this task.
function SegmentedEnumPropertyField({ label, value, options, onChange, required = false }: SegmentedEnumPropertyFieldProps) {
  const rowId = useId()
  const segments: SegmentedToggleOption[] = options.map((option) => ({ value: option, label: String(option) }))

  return (
    <PropertyFieldRow htmlFor={rowId} label={label} required={required}>
      <SegmentedTogglePropertyField label={label} segments={segments} activeValue={value} onSelect={onChange} />
    </PropertyFieldRow>
  )
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
    <fieldset className="flex flex-col gap-2">
      <legend className="pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</legend>
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
  // T4 (0133), FR6: see `PropertyFieldDispatcherProps.hideRootLegend` — applied only to this
  // fieldset's own `legend`, never forwarded to the recursive `PropertyFieldDispatcher` calls below
  // (each nested field keeps its normal visible label).
  hideRootLegend?: boolean
}

function ObjectPropertyField({ label, value, propertiesSchema, requiredFields, onChange, hideRootLegend = false }: ObjectPropertyFieldProps) {
  const propertyEntries = propertiesSchema ? Object.entries(propertiesSchema) : []

  function handlePropertyChange(key: string, propertyValue: unknown) {
    onChange({ ...value, [key]: propertyValue })
  }

  return (
    <fieldset className="flex flex-col gap-2 mb-4">
      <legend className={hideRootLegend ? 'sr-only' : 'pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500'}>
        {label}
      </legend>
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

