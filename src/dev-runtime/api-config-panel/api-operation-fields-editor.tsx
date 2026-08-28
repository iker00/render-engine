import { useId } from 'react'
import type {
  RuntimeApiHeaders,
  RuntimeApiMethod,
  RuntimeApiOperation,
  RuntimeApiQuery,
} from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import { KeyValuePropertyField } from '../layout-canvas/property-fields/key-value-property-field'
import { PropertyFieldRow } from '../layout-canvas/property-fields/property-field-row'
import { isPlainObject } from '../layout-canvas/property-fields/property-field-schema-resolution'
import { RawJsonPropertyField } from '../layout-canvas/property-fields/raw-json-property-field'
import { SegmentedTogglePropertyField } from '../layout-canvas/property-fields/segmented-toggle-property-field'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import {
  API_METHOD_OPTIONS,
  apiOperationFieldRejectionKey,
  type ApiOperationField,
  type ApiPendingRejections,
} from './api-operation-fields-helpers'

export interface ApiOperationFieldsEditorProps {
  operationKey: string
  operation: RuntimeApiOperation
  pendingRejections: ApiPendingRejections
  onCommitField: (field: ApiOperationField, nextValue: unknown) => void
}

/**
 * Form for a single `api` operation's editable fields (T6, FR9): method/endpoint/query/body/
 * headers. Reused by every row of `ApiConfigPanel`'s "Operaciones" listing — one instance per
 * operation key, always expanded (no collapse). `errorCondition`/`errorMessagePath`/
 * `errorCodePath`, when already present on `operation`, are preserved by the caller's spread on
 * every commit (`{ ...api[key], [field]: nextValue }`) but have no control here — out of scope,
 * FR9 doesn't list them.
 *
 * `body` (FR10, D8) is hidden entirely while the displayed method is `GET`. When visible: a plain
 * object (or `undefined`, treated as `{}`) is edited with `KeyValuePropertyField`; any other valid
 * shape (string/number/boolean/null/array) falls back to a read-only `RawJsonPropertyField` (its
 * `onChange` is a no-op) — same criterion `PropertyFieldDispatcher.isBareRefSchema` uses today for
 * `body` in `Layout` to pick between the two widgets, but always read-only here regardless of
 * whether the value happens to be a string.
 */
export function ApiOperationFieldsEditor({ operationKey, operation, pendingRejections, onCommitField }: ApiOperationFieldsEditorProps) {
  const methodRowId = useId()

  const methodPending = pendingRejections[apiOperationFieldRejectionKey(operationKey, 'method')]
  const endpointPending = pendingRejections[apiOperationFieldRejectionKey(operationKey, 'endpoint')]
  const queryPending = pendingRejections[apiOperationFieldRejectionKey(operationKey, 'query')]
  const headersPending = pendingRejections[apiOperationFieldRejectionKey(operationKey, 'headers')]
  const bodyPending = pendingRejections[apiOperationFieldRejectionKey(operationKey, 'body')]

  const displayedMethod = methodPending ? (methodPending.value as RuntimeApiMethod) : operation.method
  const displayedEndpoint = endpointPending ? (endpointPending.value as string) : operation.endpoint
  const displayedQuery = queryPending ? (queryPending.value as RuntimeApiQuery) : (operation.query ?? {})
  const displayedHeaders = headersPending ? (headersPending.value as RuntimeApiHeaders) : (operation.headers ?? {})
  const displayedBody = bodyPending ? bodyPending.value : (operation.body ?? {})

  const showBody = displayedMethod !== 'GET'
  const bodyIsMap = isPlainObject(displayedBody)

  return (
    <div className="flex flex-col gap-3">
      <PropertyFieldRow htmlFor={methodRowId} label="Método">
        <SegmentedTogglePropertyField
          label="Método"
          segments={API_METHOD_OPTIONS}
          activeValue={displayedMethod}
          onSelect={(value) => onCommitField('method', value)}
        />
      </PropertyFieldRow>
      {methodPending && (
        <CommitRejectionBanner dataTestId={`api-config-panel-operation-${operationKey}-method-error`} error={methodPending.error} />
      )}

      <TextPropertyField label="Endpoint" value={displayedEndpoint} onChange={(value) => onCommitField('endpoint', value)} />
      {endpointPending && (
        <CommitRejectionBanner dataTestId={`api-config-panel-operation-${operationKey}-endpoint-error`} error={endpointPending.error} />
      )}

      <KeyValuePropertyField label="Query" value={displayedQuery} onChange={(value) => onCommitField('query', value)} />
      {queryPending && (
        <CommitRejectionBanner dataTestId={`api-config-panel-operation-${operationKey}-query-error`} error={queryPending.error} />
      )}

      <KeyValuePropertyField label="Headers" value={displayedHeaders} onChange={(value) => onCommitField('headers', value)} />
      {headersPending && (
        <CommitRejectionBanner dataTestId={`api-config-panel-operation-${operationKey}-headers-error`} error={headersPending.error} />
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
            <CommitRejectionBanner dataTestId={`api-config-panel-operation-${operationKey}-body-error`} error={bodyPending.error} />
          )}
        </>
      )}
    </div>
  )
}
