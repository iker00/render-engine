import { useId } from 'react'
import type {
  RuntimeApiConfig,
  RuntimeApiHeaders,
  RuntimeApiQuery,
  RuntimePreloadConfig,
} from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import { KeyValuePropertyField } from '../layout-canvas/property-fields/key-value-property-field'
import { isPlainObject } from '../layout-canvas/property-fields/property-field-schema-resolution'
import { RawJsonPropertyField } from '../layout-canvas/property-fields/raw-json-property-field'
import {
  preloadEntryFieldRejectionKey,
  type PreloadEntryField,
  type PreloadPendingRejections,
} from './preloads-list-editor'

export interface PreloadEntryFieldsEditorProps {
  index: number
  entry: RuntimePreloadConfig
  operationCatalog: RuntimeApiConfig
  pendingRejections: PreloadPendingRejections
  onCommitField: (field: PreloadEntryField, nextValue: unknown) => void
}

/**
 * Fields for a single preload entry (T7, FR14/FR15): an `operationName` `<select>` restricted to
 * `Object.keys(operationCatalog)` — the catalog is the only source of options, so it can never
 * offer a value outside it — plus `requestParams` (`query`/`headers`/`body`) edited with the same
 * `KeyValuePropertyField` T6 already uses for an `api` operation's own request params.
 *
 * D7 (broken reference): when `entry.operationName` isn't a key of `operationCatalog` (e.g. the
 * referenced operation was deleted), the `<select>` simply has no option for that value — no
 * fallback option is injected, and no value is forced onto the entry — while the rest of the row
 * (`requestParams`) stays editable. `body` visibility (D8, same rule as T6) is resolved from
 * `operationCatalog[entry.operationName]?.method`; when that lookup is `undefined` (broken
 * reference), `body` is shown exactly as it would for any non-GET method, since there is no method
 * to resolve.
 */
export function PreloadEntryFieldsEditor({
  index,
  entry,
  operationCatalog,
  pendingRejections,
  onCommitField,
}: PreloadEntryFieldsEditorProps) {
  const operationSelectId = useId()
  const operationNames = Object.keys(operationCatalog)

  const operationNamePending = pendingRejections[preloadEntryFieldRejectionKey(index, 'operationName')]
  const queryPending = pendingRejections[preloadEntryFieldRejectionKey(index, 'query')]
  const headersPending = pendingRejections[preloadEntryFieldRejectionKey(index, 'headers')]
  const bodyPending = pendingRejections[preloadEntryFieldRejectionKey(index, 'body')]

  const displayedOperationName = operationNamePending ? (operationNamePending.value as string) : entry.operationName
  const displayedQuery = queryPending ? (queryPending.value as RuntimeApiQuery) : (entry.requestParams.query ?? {})
  const displayedHeaders = headersPending
    ? (headersPending.value as RuntimeApiHeaders)
    : (entry.requestParams.headers ?? {})
  const displayedBody = bodyPending ? bodyPending.value : (entry.requestParams.body ?? {})

  const showBody = operationCatalog[displayedOperationName]?.method !== 'GET'
  const bodyIsMap = isPlainObject(displayedBody)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={operationSelectId} className="text-xs font-medium text-gray-700">
          {`Operación #${index + 1}`}
        </label>
        <select
          id={operationSelectId}
          value={displayedOperationName}
          onChange={(event) => onCommitField('operationName', event.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
        >
          {operationNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {operationNamePending && (
        <CommitRejectionBanner
          dataTestId={`preload-entry-${index}-operation-error`}
          error={operationNamePending.error}
        />
      )}

      <KeyValuePropertyField label="Query" value={displayedQuery} onChange={(value) => onCommitField('query', value)} />
      {queryPending && (
        <CommitRejectionBanner dataTestId={`preload-entry-${index}-query-error`} error={queryPending.error} />
      )}

      <KeyValuePropertyField
        label="Headers"
        value={displayedHeaders}
        onChange={(value) => onCommitField('headers', value)}
      />
      {headersPending && (
        <CommitRejectionBanner dataTestId={`preload-entry-${index}-headers-error`} error={headersPending.error} />
      )}

      {showBody && (
        <>
          {bodyIsMap ? (
            <KeyValuePropertyField
              label="Body"
              value={displayedBody as Record<string, unknown>}
              onChange={(value) => onCommitField('body', value)}
            />
          ) : (
            <RawJsonPropertyField label="Body" value={displayedBody} onChange={() => {}} />
          )}
          {bodyPending && (
            <CommitRejectionBanner dataTestId={`preload-entry-${index}-body-error`} error={bodyPending.error} />
          )}
        </>
      )}
    </div>
  )
}
