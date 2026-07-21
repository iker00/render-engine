import { useId, type ChangeEvent } from 'react'
import { BooleanPropertyField } from './boolean-property-field'
import { EnumPropertyField } from './enum-property-field'
import { NumberPropertyField } from './number-property-field'
import { TextPropertyField } from './text-property-field'

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

function buildDefaultValueForSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return ''
  switch (resolvePrimarySchemaType(schema)) {
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return false
    case 'object':
      return buildDefaultObjectForRequiredFields(schema)
    case 'array':
      return []
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
function buildDefaultObjectForRequiredFields(schema: Record<string, unknown>): Record<string, unknown> {
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
    const requiredFields = Array.isArray(schema.required) ? (schema.required as string[]) : []
    const objectValue = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
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
      {value.map((itemValue, index) => (
        // Items have no stable identity of their own (they are plain JSON values), so the
        // index is the only ordering key available here; consistent with the array's own semantics.
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            <PropertyFieldDispatcher
              schema={itemsSchema}
              value={itemValue}
              onChange={(nextValue) => handleItemChange(index, nextValue)}
              label={`${label} #${index + 1}`}
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
      ))}
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
          schema={propertySchema}
          value={value[key]}
          onChange={(nextValue) => handlePropertyChange(key, nextValue)}
          label={key}
          required={requiredFields.includes(key)}
        />
      ))}
    </fieldset>
  )
}

interface RawJsonPropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

// Escape hatch for schema fragments the dispatcher can't represent (missing schema, unsupported
// unions, etc.). Editing raw JSON back into a typed value is only safe when the current value is
// already a plain string; any other shape is shown read-only and must be edited from Monaco.
function RawJsonPropertyField({ label, value, onChange }: RawJsonPropertyFieldProps) {
  const textareaId = useId()
  const isEditableAsString = typeof value === 'string'
  const serialized = isEditableAsString ? value : (JSON.stringify(value, null, 2) ?? '')

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (isEditableAsString) onChange(event.target.value)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={textareaId} className="text-xs font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={textareaId}
        value={serialized}
        disabled={!isEditableAsString}
        onChange={handleChange}
        rows={3}
        className="rounded border border-gray-300 px-2 py-1 font-mono text-xs text-gray-900 focus:border-gray-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
      />
      {!isEditableAsString && (
        <p className="text-[11px] text-gray-500">
          Este valor no se puede editar de forma segura desde el formulario. Usa el editor JSON (Monaco) para
          modificarlo.
        </p>
      )}
    </div>
  )
}
