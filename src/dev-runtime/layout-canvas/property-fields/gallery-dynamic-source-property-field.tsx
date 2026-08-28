import { useId } from 'react'
import { toJSONSchema } from 'zod'
import { imageFetchSchema } from '../../../config/runtime-config-zod'
import { PropertyFieldDispatcher } from './property-field-dispatcher'
import { PropertyFieldRow } from './property-field-row'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'
import { TextPropertyField } from './text-property-field'

// Computed once at module load, same rationale as `layout-canvas-node-schema.ts`'s per-type cache:
// `imageFetchSchema` is reused as-is (T1 of feature 2026-08-25-14-49-gallery-node: gallery's
// `source.fetch` has the same shape and validation as `image.props.fetch`), so its JSON Schema
// fragment is derived directly from the same Zod schema `image` already validates against, rather
// than hand-duplicating a schema for this widget.
const FETCH_SCHEMA = toJSONSchema(imageFetchSchema) as Record<string, unknown>

// The two mutually exclusive load modes `gallery.props.source` can take (T1): "src" (a resolvable
// string path/interpolation) or "fetch" (a binary HTTP request per photo, same contract as
// `image.props.fetch`). No other shape is part of the contract. Segment labels intentionally show
// the raw schema literals (`src`/`fetch`), not a translated paraphrase — same convention
// `ChoiceItemsPropertyField`'s `itemType` (`scalar`/`object`) already uses for a technical mode
// field with no natural Spanish equivalent.
const MODE_SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'src', label: 'src' },
  { value: 'fetch', label: 'fetch' },
]

const DEFAULT_FETCH_CONFIG = { url: '' }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function detectMode(value: Record<string, unknown>): 'src' | 'fetch' {
  return value.mode === 'fetch' ? 'fetch' : 'src'
}

function stringField(value: Record<string, unknown>, key: string): string {
  return typeof value[key] === 'string' ? (value[key] as string) : ''
}

export interface GalleryDynamicSourcePropertyFieldProps {
  label: string
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * Dedicated widget for `gallery.props.source` (T1, feature 2026-08-25-14-49-gallery-node), wired
 * into `PropertyFieldDispatcher` via the `x-widget: 'gallery-dynamic-source'` hook (same mechanism
 * as `choice-items`) instead of the generic object pattern: the schema's `src`/`fetch` shape is
 * enforced imperatively by `validateGalleryNode`, not a Zod discriminated union, so the dispatcher's
 * generic detectors would otherwise show both fields unconditionally regardless of `mode`.
 *
 * `source`/`key`/`alt` are common to both modes and edited directly; `mode` reconstructs the value
 * wholesale on switch (drops the inactive mode's field, seeds a fresh empty one for the newly
 * active mode) — same pattern as `ChoiceItemsPropertyField`'s `DynamicItemsEditor.handleItemTypeChange`.
 * `fetch` delegates back to the generic `PropertyFieldDispatcher` with `imageFetchSchema`'s own JSON
 * Schema, reusing the same url/method/headers/body editor `image.props.fetch` already gets.
 */
export function GalleryDynamicSourcePropertyField({ label, value, onChange }: GalleryDynamicSourcePropertyFieldProps) {
  const rowId = useId()
  const currentValue = isPlainObject(value) ? value : {}
  const mode = detectMode(currentValue)

  function commitField(key: 'source' | 'key' | 'alt' | 'src' | 'idField', nextFieldValue: string) {
    onChange({ ...currentValue, [key]: nextFieldValue })
  }

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    const { src: _src, fetch: _fetch, idField: _idField, ...rest } = currentValue
    if (nextMode === 'fetch') {
      onChange({ ...rest, mode: 'fetch', fetch: DEFAULT_FETCH_CONFIG })
      return
    }
    onChange({ ...rest, mode: 'src', src: '' })
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      <TextPropertyField label="source" value={stringField(currentValue, 'source')} onChange={(next) => commitField('source', next)} required />
      <TextPropertyField label="key" value={stringField(currentValue, 'key')} onChange={(next) => commitField('key', next)} required />
      <TextPropertyField label="alt" value={stringField(currentValue, 'alt')} onChange={(next) => commitField('alt', next)} required />
      <PropertyFieldRow htmlFor={rowId} label="mode" required>
        <SegmentedTogglePropertyField label="mode" segments={MODE_SEGMENTS} activeValue={mode} onSelect={handleModeChange} />
      </PropertyFieldRow>
      {mode === 'src' ? (
        <TextPropertyField label="src" value={stringField(currentValue, 'src')} onChange={(next) => commitField('src', next)} required />
      ) : (
        <>
          <TextPropertyField
            label="idField"
            value={stringField(currentValue, 'idField')}
            onChange={(next) => commitField('idField', next)}
          />
          <PropertyFieldDispatcher
            schema={FETCH_SCHEMA}
            value={isPlainObject(currentValue.fetch) ? currentValue.fetch : DEFAULT_FETCH_CONFIG}
            onChange={(nextFetch) => onChange({ ...currentValue, fetch: nextFetch })}
            label="fetch"
            required
          />
        </>
      )}
    </fieldset>
  )
}
