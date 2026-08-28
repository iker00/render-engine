import { useId } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeTokenRefreshConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import { BooleanPropertyField } from '../layout-canvas/property-fields/boolean-property-field'
import { NumberPropertyField } from '../layout-canvas/property-fields/number-property-field'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'

export type TokenRefreshField = 'operation' | 'responsePath' | 'intervalSeconds'

export type TokenRefreshPendingEntry = { value: unknown; error: RuntimeConfigError }
export type TokenRefreshPendingRejections = Partial<Record<string, TokenRefreshPendingEntry>>

// Composite key criterion (same shape as `preloadEntryFieldRejectionKey`): one entry per
// tokenId+field pair, so a rejection on one field of one token never affects the banner of
// another field or another token.
export function tokenRefreshFieldRejectionKey(tokenId: string, field: TokenRefreshField): string {
  return `${tokenId}.${field}`
}

export interface TokenRefreshFieldsEditorProps {
  tokenId: string
  refresh: RuntimeTokenRefreshConfig | undefined
  apiOperationNames: string[]
  pendingRejections: TokenRefreshPendingRejections
  onToggleRefresh: (enabled: boolean) => void
  onCommitRefreshField: (field: TokenRefreshField, nextValue: unknown) => void
}

const NO_OPERATIONS_DISABLED_REASON =
  'No hay ninguna operación declarada en Api; declara al menos una antes de activar el refresco.'

/**
 * Sub-form for a token's `refresh` block (T3, Decisión 4 de design.md). Purely presentational:
 * receives the current value and exposes callbacks; the consumer (T5) decides what to mutate and
 * commits it against `currentConfig`. `onToggleRefresh` only signals intent — this component never
 * builds or discards the `refresh` object itself.
 */
export function TokenRefreshFieldsEditor({
  tokenId,
  refresh,
  apiOperationNames,
  pendingRejections,
  onToggleRefresh,
  onCommitRefreshField,
}: TokenRefreshFieldsEditorProps) {
  const operationSelectId = useId()
  const isEnabled = refresh !== undefined
  // Switch stays enabled when `refresh` is already set, even with no operations left to offer,
  // so the user can still turn it off.
  const switchDisabled = apiOperationNames.length === 0 && !isEnabled

  const operationPending = pendingRejections[tokenRefreshFieldRejectionKey(tokenId, 'operation')]
  const responsePathPending = pendingRejections[tokenRefreshFieldRejectionKey(tokenId, 'responsePath')]
  const intervalSecondsPending = pendingRejections[tokenRefreshFieldRejectionKey(tokenId, 'intervalSeconds')]

  return (
    <div className="flex flex-col gap-3">
      <BooleanPropertyField
        label="Refresco automático"
        value={isEnabled}
        onChange={onToggleRefresh}
        disabled={switchDisabled}
        disabledReason={switchDisabled ? NO_OPERATIONS_DISABLED_REASON : undefined}
      />

      {refresh !== undefined && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={operationSelectId} className="text-xs font-medium text-gray-700">
              Operación
            </label>
            <select
              id={operationSelectId}
              value={operationPending ? (operationPending.value as string) : refresh.operation}
              onChange={(event) => onCommitRefreshField('operation', event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
            >
              {apiOperationNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {operationPending && (
            <CommitRejectionBanner
              dataTestId={`token-refresh-${tokenId}-operation-error`}
              error={operationPending.error}
            />
          )}

          <TextPropertyField
            label="Response path"
            value={responsePathPending ? (responsePathPending.value as string) : refresh.responsePath}
            onChange={(value) => onCommitRefreshField('responsePath', value)}
          />
          {responsePathPending && (
            <CommitRejectionBanner
              dataTestId={`token-refresh-${tokenId}-responsePath-error`}
              error={responsePathPending.error}
            />
          )}

          <NumberPropertyField
            label="Intervalo (segundos)"
            value={intervalSecondsPending ? (intervalSecondsPending.value as number) : refresh.intervalSeconds}
            onChange={(value) => onCommitRefreshField('intervalSeconds', value)}
          />
          {intervalSecondsPending && (
            <CommitRejectionBanner
              dataTestId={`token-refresh-${tokenId}-intervalSeconds-error`}
              error={intervalSecondsPending.error}
            />
          )}
        </>
      )}
    </div>
  )
}
