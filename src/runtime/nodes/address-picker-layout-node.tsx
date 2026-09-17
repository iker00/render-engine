import { useEffect } from 'react'
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
import { useAddressGeocodeTrigger } from '../runtime-geocode-trigger'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { selectFormFieldState, selectQueryState } from '../runtime-state/runtime-state-selectors'
import { MapShell } from './map-shell'

// Local equivalent of the private path-navigation helpers duplicated across the runtime (see
// `resolveCollectionItemPath` in `runtime-collection-sources.ts` and `resolveGalleryItemPath` in
// `runtime-gallery-photos.ts`, neither exported for reuse outside their own module). Only a
// string result counts as a resolved address: a number/boolean/object/array at `props.addressPath`
// is treated the same as "not found" — the geocode response is out of coverage for this field.
function resolveGeocodeAddressText(data: unknown, path: string): string | null {
  const segments = path.split('.')
  let currentValue: unknown = data

  for (const segment of segments) {
    if (segment.length === 0) {
      return null
    }

    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return null
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return null
      }

      continue
    }

    if (typeof currentValue !== 'object' || currentValue === null || !Object.hasOwn(currentValue, segment)) {
      return null
    }

    currentValue = (currentValue as Record<string, unknown>)[segment]
  }

  return typeof currentValue === 'string' ? currentValue : null
}

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

  const scopeKey = formContext
    ? deriveScopedStateKey(formContext.formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE)
    : null
  const fieldState = scopeKey !== null ? selectFormFieldState(state, scopeKey, node.props.fieldId) : null
  const synthetic = fieldState?.synthetic
  const lat = typeof synthetic?.lat === 'number' ? synthetic.lat : null
  const lng = typeof synthetic?.lng === 'number' ? synthetic.lng : null
  const position = lat !== null && lng !== null ? { lat, lng } : null

  const geocodeQueryState = selectQueryState(state, node.props.geocodeOperation)
  const { status: geocodeStatus, lastFiredRequestSignature: geocodeRequestSignature } = useAddressGeocodeTrigger({
    operationName: node.props.geocodeOperation,
    position,
    iterationContext,
  })
  // A geocode result only counts if it is the response to the most recent fire from this very
  // instance (T8, requisito 5) — the same freshness criterion already accepted for `autocomplete`.
  const isGeocodeResultFresh =
    geocodeRequestSignature !== null && geocodeQueryState?.requestSignature === geocodeRequestSignature
  const geocodeAddressText =
    isGeocodeResultFresh && geocodeQueryState?.status === 'success'
      ? resolveGeocodeAddressText(geocodeQueryState.data, node.props.addressPath)
      : null

  // Writing a resolved address into the field is a reaction to state settling into a fresh
  // success, not a user gesture — it belongs in an effect, not inline during render. Depending on
  // the derived `isGeocodeResultFresh`/`status` (not on `formContext`/`geocodeQueryState` objects,
  // which are recreated every render) keeps this from re-firing on unrelated renders once the
  // text for this particular fresh result has already been applied.
  useEffect(() => {
    if (!formContext || !isGeocodeResultFresh || geocodeQueryState?.status !== 'success') {
      return
    }

    if (geocodeAddressText === null) {
      return
    }

    setFormFieldValue(formContext.formId, node.props.fieldId, geocodeAddressText, {
      scopeChain: formContext.scopeChain,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formContext/setFormFieldValue/node.props se comparan por referencia como en runtime-search-trigger.ts; el efecto sólo debe reaccionar a que el resultado de geocodeOperation pase a success con una firma fresca
  }, [isGeocodeResultFresh, geocodeQueryState?.status, geocodeAddressText])

  if (!formContext) {
    return null
  }

  const formId = formContext.formId
  const fieldId = node.props.fieldId
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
  const validationError = fieldState?.error ?? null
  const isGeocoding = geocodeStatus === 'loading'
  const geocodeErrorMessage = isGeocodeResultFresh
    ? geocodeQueryState?.status === 'error'
      ? (geocodeQueryState.error?.message ?? 'Could not resolve the address.')
      : geocodeQueryState?.status === 'success' && geocodeAddressText === null
        ? 'Could not resolve the address.'
        : null
    : null
  const displayError = validationError ?? geocodeErrorMessage

  // Único punto de escritura de coordenadas del nodo (T7): el click del mapa las fija aquí. T8
  // cuelga el disparo de geocodificación de esta misma función (vía `useAddressGeocodeTrigger`,
  // reaccionando al cambio de `position`) y T9 le entregará las coordenadas de geolocalización;
  // ningún otro camino debe escribir `synthetic.lat/lng`.
  const applyMarkerPosition = (nextPosition: { lat: number; lng: number }) => {
    setFormFieldSynthetic(formId, fieldId, nextPosition, { scopeChain: formContext.scopeChain })
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
        className={getFieldControlClassName(displayError !== null)}
        aria-describedby={displayError !== null ? `${inputId}-error` : undefined}
        aria-busy={isGeocoding}
        disabled={isGeocoding}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.value
          setFormFieldValue(formId, fieldId, nextValue, { scopeChain: formContext.scopeChain })
          if (validationError) {
            setFormFieldError(
              formId,
              fieldId,
              getValidationErrorForEditedField({
                fieldDefinition,
                formId: deriveScopedStateKey(formId, formContext.scopeChain ?? EMPTY_INSTANCE_SCOPE),
                state,
                nextValue,
                iterationContext,
              }),
              { scopeChain: formContext.scopeChain },
            )
          }
        }}
      />
      {isGeocoding ? (
        <span role="status" className="sr-only">
          Loading
        </span>
      ) : null}
      {displayError ? (
        <span id={`${inputId}-error`} className={getFieldErrorClassName()}>
          {displayError}
        </span>
      ) : null}
    </div>
  )
}
