import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeApiConfig, RuntimeConfig, RuntimeTokenConfig, RuntimeTokensConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import { normalizeTokenId, isDuplicateTokenId } from './tokens-config-panel-rules'
import { scanOrphanTokenHeaderReferences, type TokenHeaderReferenceScan } from './scan-orphan-token-header-references'
import { TokenDeleteConfirmDialog } from './token-delete-confirm-dialog'
import {
  TokenRefreshFieldsEditor,
  tokenRefreshFieldRejectionKey,
  type TokenRefreshField,
  type TokenRefreshPendingRejections,
} from './token-refresh-fields-editor'

export interface TokensConfigPanelProps {
  config: RuntimeConfig
  tokens: RuntimeTokensConfig | undefined
  api: RuntimeApiConfig
  onCommitTokensMutation: (mutate: (tokens: RuntimeTokensConfig) => RuntimeTokensConfig) => CommitCanvasMutationResult
}

interface ValueRejectionState {
  value: string
  error: RuntimeConfigError
}

interface AddRejectionState {
  id: string
  value: string
  error: RuntimeConfigError
}

interface DeleteRejectionState {
  error: RuntimeConfigError
}

interface DeleteTargetState {
  tokenId: string
  scan: TokenHeaderReferenceScan
}

// Default `refresh` values used when a token's refresh switch is activated: the first available
// api operation, and `responsePath: 'data'` deliberately non-empty (see task contract) because
// `runtimeTokenRefreshSchema.responsePath` uses `nonEmptyStringSchema` and would otherwise reject
// every freshly-activated refresh block.
const DEFAULT_REFRESH_RESPONSE_PATH = 'data'
const DEFAULT_REFRESH_INTERVAL_SECONDS = 60

/**
 * "Tokens" section of the visual editor (T5, FR2-FR9). Full manual CRUD for the `tokens` block —
 * listing, creation, `value` editing, `refresh` sub-form (delegated to `TokenRefreshFieldsEditor`,
 * T3) and delete-with-confirmation (delegated to `TokenDeleteConfirmDialog`, T4, informed by
 * `scanOrphanTokenHeaderReferences`, T1). Every mutation goes through `onCommitTokensMutation`,
 * the same "mutate, validate, patch only the affected root key" pipeline other config panels use.
 * Not wired into the floating toolbar or `DevEditorLayer` yet (T6).
 */
export function TokensConfigPanel({ config, tokens, api, onCommitTokensMutation }: TokensConfigPanelProps) {
  const tokenEntries = Object.entries(tokens ?? {})
  const apiOperationNames = Object.keys(api)

  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({})
  const [valueRejections, setValueRejections] = useState<Record<string, ValueRejectionState>>({})

  const [refreshPendingRejections, setRefreshPendingRejections] = useState<TokenRefreshPendingRejections>({})

  const [newId, setNewId] = useState('')
  const [newValue, setNewValue] = useState('')
  const [addRejection, setAddRejection] = useState<AddRejectionState | null>(null)

  const [deleteRejections, setDeleteRejections] = useState<Record<string, DeleteRejectionState>>({})
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null)

  const normalizedNewId = normalizeTokenId(newId)
  const addDisabledReason =
    normalizedNewId === ''
      ? 'El id no puede estar vacío.'
      : isDuplicateTokenId(normalizedNewId, tokens ?? {})
        ? `El id "${normalizedNewId}" ya existe.`
        : newValue === ''
          ? 'El value no puede estar vacío.'
          : null

  function clearValueRejection(tokenId: string) {
    setValueRejections((prev) => {
      if (!(tokenId in prev)) return prev
      const next = { ...prev }
      delete next[tokenId]
      return next
    })
  }

  function handleValueChange(tokenId: string, value: string) {
    setValueDrafts((prev) => ({ ...prev, [tokenId]: value }))
    clearValueRejection(tokenId)
  }

  function handleValueBlur(token: RuntimeTokenConfig & { id: string }) {
    const draft = valueDrafts[token.id]
    if (draft === undefined) return

    if (draft === token.value) {
      setValueDrafts((prev) => {
        const next = { ...prev }
        delete next[token.id]
        return next
      })
      return
    }

    const result = onCommitTokensMutation((prev) => ({ ...prev, [token.id]: { ...prev[token.id], value: draft } }))

    if (result.status === 'rejected') {
      setValueRejections((prev) => ({ ...prev, [token.id]: { value: draft, error: result.error } }))
      return
    }

    setValueDrafts((prev) => {
      const next = { ...prev }
      delete next[token.id]
      return next
    })
    clearValueRejection(token.id)
  }

  function handleNewIdChange(value: string) {
    setNewId(value)
    setAddRejection(null)
  }

  function handleNewValueChange(value: string) {
    setNewValue(value)
    setAddRejection(null)
  }

  function handleAddToken() {
    if (addDisabledReason !== null) return

    const result = onCommitTokensMutation((prev) => ({ ...prev, [normalizedNewId]: { value: newValue } }))

    if (result.status === 'rejected') {
      setAddRejection({ id: newId, value: newValue, error: result.error })
      return
    }

    setAddRejection(null)
    setNewId('')
    setNewValue('')
  }

  function recordRefreshResult(
    tokenId: string,
    field: TokenRefreshField,
    attemptedValue: unknown,
    result: CommitCanvasMutationResult,
  ) {
    const key = tokenRefreshFieldRejectionKey(tokenId, field)

    if (result.status === 'rejected') {
      setRefreshPendingRejections((prev) => ({ ...prev, [key]: { value: attemptedValue, error: result.error } }))
      return
    }

    setRefreshPendingRejections((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleToggleRefresh(tokenId: string, enabled: boolean) {
    const nextRefresh = enabled
      ? {
          operation: apiOperationNames[0],
          responsePath: DEFAULT_REFRESH_RESPONSE_PATH,
          intervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
        }
      : undefined

    const result = onCommitTokensMutation((prev) => {
      const token = prev[tokenId]
      if (nextRefresh === undefined) {
        const { refresh: _refresh, ...rest } = token
        return { ...prev, [tokenId]: rest }
      }
      return { ...prev, [tokenId]: { ...token, refresh: nextRefresh } }
    })

    recordRefreshResult(tokenId, 'operation', nextRefresh?.operation, result)
  }

  function handleCommitRefreshField(tokenId: string, field: TokenRefreshField, nextValue: unknown) {
    const result = onCommitTokensMutation((prev) => {
      const token = prev[tokenId]
      if (token.refresh === undefined) return prev
      return { ...prev, [tokenId]: { ...token, refresh: { ...token.refresh, [field]: nextValue } } }
    })

    recordRefreshResult(tokenId, field, nextValue, result)
  }

  function handleDeleteClick(tokenId: string) {
    const scan = scanOrphanTokenHeaderReferences(config, tokenId)
    setDeleteTarget({ tokenId, scan })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    const { tokenId } = deleteTarget
    setDeleteTarget(null)

    const result = onCommitTokensMutation((prev) => {
      const next = { ...prev }
      delete next[tokenId]
      return next
    })

    if (result.status === 'rejected') {
      setDeleteRejections((prev) => ({ ...prev, [tokenId]: { error: result.error } }))
      return
    }

    setDeleteRejections((prev) => {
      if (!(tokenId in prev)) return prev
      const next = { ...prev }
      delete next[tokenId]
      return next
    })
  }

  function handleCancelDelete() {
    setDeleteTarget(null)
  }

  return (
    <div data-testid="tokens-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <h2 className="text-base font-semibold text-gray-900">Tokens</h2>

      {tokenEntries.length === 0 ? (
        <p className="text-xs text-gray-500">Sin operaciones declaradas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tokenEntries.map(([id, token]) => {
            const valueDraft = valueDrafts[id] ?? token.value
            const valueRejection = valueRejections[id]
            const deleteRejection = deleteRejections[id]

            return (
              <li
                key={id}
                data-testid={`tokens-config-panel-token-${id}`}
                className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-800">{id}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(id)}
                    aria-label={`Eliminar token ${id}`}
                    className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    Eliminar token
                  </button>
                </div>

                <input
                  type="text"
                  aria-label={`Value de ${id}`}
                  value={valueDraft}
                  onChange={(event) => handleValueChange(id, event.target.value)}
                  onBlur={() => handleValueBlur({ ...token, id })}
                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                />
                {valueRejection && (
                  <CommitRejectionBanner dataTestId={`tokens-config-panel-value-${id}-error`} error={valueRejection.error} />
                )}

                <TokenRefreshFieldsEditor
                  tokenId={id}
                  refresh={token.refresh}
                  apiOperationNames={apiOperationNames}
                  pendingRejections={refreshPendingRejections}
                  onToggleRefresh={(enabled) => handleToggleRefresh(id, enabled)}
                  onCommitRefreshField={(field, nextValue) => handleCommitRefreshField(id, field, nextValue)}
                />

                {deleteRejection && (
                  <CommitRejectionBanner dataTestId={`tokens-config-panel-delete-${id}-error`} error={deleteRejection.error} />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-700">Añadir token</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleAddToken()
          }}
          className="flex flex-col gap-2"
        >
          <TextPropertyField label="Id" value={newId} onChange={handleNewIdChange} />
          <TextPropertyField label="Value" value={newValue} onChange={handleNewValueChange} />
          {addDisabledReason !== null && <p className="text-xs text-gray-500">{addDisabledReason}</p>}
          {addRejection && <CommitRejectionBanner dataTestId="tokens-config-panel-add-error" error={addRejection.error} />}
          <button
            type="submit"
            disabled={addDisabledReason !== null}
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Añadir
          </button>
        </form>
      </div>

      {deleteTarget && (
        <TokenDeleteConfirmDialog
          tokenId={deleteTarget.tokenId}
          scan={deleteTarget.scan}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  )
}
