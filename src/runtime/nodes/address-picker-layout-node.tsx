import type { LeafletMouseEvent } from 'leaflet'
import { Marker, useMapEvents } from 'react-leaflet'
import type { AddressPickerLayoutNode } from '../../config/runtime-config-types'
import { useOptionalFormContext } from '../use-optional-form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { resolveResolvedFormFieldDefinition } from './resolve-form-field-definition'
import {
  getFieldControlClassName,
  getFieldErrorClassName,
  getFieldLabelClassName,
  getFieldWrapperClassName,
} from '../runtime-node-styling'
import { getValidationErrorForEditedField } from '../runtime-form-validations'
import { getMapMarkerIcon } from '../runtime-node-styling-map'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState } from '../runtime-state/runtime-state-selectors'
import { MapShell } from './map-shell'

interface AddressPickerNodeProps {
  node: AddressPickerLayoutNode
  iterationContext?: RuntimeIterationContext
}

// Captures map clicks via react-leaflet's own event hook (not manual DOM listeners) and forwards
// the clicked point to the caller. Rendered as a child of `MapShell` so it shares the same
// `MapContainer` context that `useMapEvents` needs.
function AddressPickerMapClickHandler({
  onMapClick,
}: {
  onMapClick: (position: { lat: number; lng: number }) => void
}) {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

export function AddressPickerNode({ node, iterationContext }: AddressPickerNodeProps) {
  const formContext = useOptionalFormContext()
  const state = useRuntimeState()
  const { setFormFieldError, setFormFieldValue, setFormFieldSynthetic } = useRuntimeStateActions()

  if (!formContext) {
    return null
  }

  const formId = formContext.formId
  const fieldId = node.props.fieldId
  const scopeKey = deriveScopedStateKey(formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE)
  const fieldState = selectFormFieldState(state, scopeKey, fieldId)
  const fieldDefinition = resolveResolvedFormFieldDefinition(node, state, iterationContext)
  const label = resolveRuntimeTextReference(node.props.label, state, 'addressPicker.props.label', {
    iterationContext,
  })
  const defaultValue = fieldDefinition.defaultValue
  const value =
    typeof fieldState?.value === 'string'
      ? fieldState.value
      : typeof defaultValue === 'string'
        ? defaultValue
        : ''
  const error = fieldState?.error ?? null
  const synthetic = fieldState?.synthetic
  const lat = typeof synthetic?.lat === 'number' ? synthetic.lat : null
  const lng = typeof synthetic?.lng === 'number' ? synthetic.lng : null

  // Único punto de escritura de coordenadas del nodo (T7): el click del mapa las fija aquí. T8
  // colgará el disparo de geocodificación de esta misma función y T9 le entregará las coordenadas
  // de geolocalización; ningún otro camino debe escribir `synthetic.lat/lng`.
  const applyMarkerPosition = (position: { lat: number; lng: number }) => {
    setFormFieldSynthetic(formId, fieldId, position, { scopeChain: formContext.scopeChain })
  }

  const inputId = `${formId}-${fieldId}`

  return (
    <div className={getFieldWrapperClassName()} data-layout-node="addressPicker">
      <MapShell center={node.props.center} zoom={node.props.zoom} height={node.props.height}>
        <AddressPickerMapClickHandler onMapClick={applyMarkerPosition} />
        {lat !== null && lng !== null ? <Marker position={[lat, lng]} icon={getMapMarkerIcon('primary')} /> : null}
      </MapShell>
      <label className={getFieldLabelClassName()} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        className={getFieldControlClassName(error !== null)}
        aria-describedby={error !== null ? `${inputId}-error` : undefined}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          setFormFieldValue(formId, fieldId, nextValue, { scopeChain: formContext.scopeChain })
          if (error) {
            setFormFieldError(
              formId,
              fieldId,
              getValidationErrorForEditedField({
                fieldDefinition,
                formId: scopeKey,
                state,
                nextValue,
                iterationContext,
              }),
              { scopeChain: formContext.scopeChain },
            )
          }
        }}
      />
      {error ? (
        <span id={`${inputId}-error`} className={getFieldErrorClassName()}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
