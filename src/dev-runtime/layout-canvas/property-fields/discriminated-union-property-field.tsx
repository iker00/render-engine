import { PropertyFieldDispatcher } from './property-field-dispatcher'
import { buildDefaultObjectForRequiredFields, type DiscriminatedUnionVariant } from './property-field-schema-resolution'
import { EnumPropertyField } from './enum-property-field'

export type { DiscriminatedUnionVariant }

interface DiscriminatedUnionPropertyFieldProps {
  variants: DiscriminatedUnionVariant[]
  value: unknown
  onChange: (value: unknown) => void
  label: string
  required: boolean
}

// Readable Spanish labels for the real action variants (RF7/RF8, design.md D3). A variant
// `type` missing here (a fabricated schema in tests, or a future action variant) falls back to
// its literal `type` value, so the selector never breaks for an unknown variant.
const VARIANT_LABELS: Record<string, string> = {
  navigateTo: 'Navegar a página',
  goBack: 'Volver atrás',
  executeOperation: 'Ejecutar operación',
  executeOperations: 'Ejecutar operaciones',
  resetForm: 'Reiniciar formulario',
  openModal: 'Abrir modal',
  closeModal: 'Cerrar modal',
  downloadOperation: 'Descargar operación',
}

const NO_ACTION_LABEL = 'Sin acción'
// Sentinel <select> option value for "no variant selected". Distinct from any real `type` literal
// (all non-empty camelCase identifiers), so it never collides with a variant's own value.
const NO_ACTION_VALUE = '__none__'

function variantLabel(typeValue: string): string {
  return VARIANT_LABELS[typeValue] ?? typeValue
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function currentTypeValue(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined
  return typeof value.type === 'string' ? value.type : undefined
}

// The active variant's own fields, minus the discriminator itself — the selector above already
// owns editing `type`, so re-rendering it as a plain field below would be redundant and would let
// the user type an arbitrary string over it.
function variantFieldsSchema(variantSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = variantSchema.properties
  if (!isPlainObject(properties)) return variantSchema
  const rest = { ...properties }
  delete rest.type
  return { ...variantSchema, properties: rest }
}

/**
 * Renders the "discriminated union with selector" pattern the dispatcher detects (T5): an
 * `EnumPropertyField` listing the union's `type` variants (plus "Sin acción" when `required` is
 * `false`) and, below it, the active variant's own fields delegated back to
 * `PropertyFieldDispatcher` — the same recursive entry point objects and arrays already use.
 *
 * Changing the selector reconstructs the value from scratch via `buildDefaultObjectForRequiredFields`
 * on the newly chosen variant's schema (plus the literal `type`) — no field from the previous
 * variant survives the switch. Choosing "Sin acción" calls `onChange(undefined)`.
 */
export function DiscriminatedUnionPropertyField({ variants, value, onChange, label, required }: DiscriminatedUnionPropertyFieldProps) {
  const activeType = currentTypeValue(value)
  const selectValue = activeType ?? NO_ACTION_VALUE

  const options: string[] = required ? variants.map((variant) => variant.typeValue) : [NO_ACTION_VALUE, ...variants.map((variant) => variant.typeValue)]

  const optionLabels: Record<string, string> = { [NO_ACTION_VALUE]: NO_ACTION_LABEL }
  for (const variant of variants) {
    optionLabels[variant.typeValue] = variantLabel(variant.typeValue)
  }

  function handleTypeChange(nextValue: string | number) {
    const nextType = String(nextValue)
    if (nextType === NO_ACTION_VALUE) {
      onChange(undefined)
      return
    }
    const variant = variants.find((candidate) => candidate.typeValue === nextType)
    if (!variant) return
    onChange({ ...buildDefaultObjectForRequiredFields(variant.schema), type: nextType })
  }

  const activeVariant = variants.find((variant) => variant.typeValue === activeType)
  const activeFieldsSchema = activeVariant ? variantFieldsSchema(activeVariant.schema) : undefined
  const hasVisibleFields = isPlainObject(activeFieldsSchema?.properties) && Object.keys(activeFieldsSchema.properties).length > 0

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</legend>
      <EnumPropertyField label={label} value={selectValue} options={options} optionLabels={optionLabels} onChange={handleTypeChange} required={required} />
      {activeVariant && hasVisibleFields && (
        <PropertyFieldDispatcher schema={activeFieldsSchema} value={value} onChange={onChange} label={variantLabel(activeVariant.typeValue)} />
      )}
    </fieldset>
  )
}
