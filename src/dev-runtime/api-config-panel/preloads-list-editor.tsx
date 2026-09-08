import { useId, useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeApiConfig, RuntimePreloadConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { PreloadEntryFieldsEditor } from './preload-entry-fields-editor'

export type PreloadEntryField = 'operationName' | 'query' | 'headers' | 'body' | 'blocking'

export type PreloadPendingEntry = { value: unknown; error: RuntimeConfigError }
export type PreloadPendingRejections = Partial<Record<string, PreloadPendingEntry>>

// Composite key criterion (same as `apiOperationFieldRejectionKey` in `api-operation-fields-helpers.ts`):
// one entry per preload-index+field pair, so a rejection on one field of one entry never affects
// the banner of another field or another entry.
export function preloadEntryFieldRejectionKey(index: number, field: PreloadEntryField): string {
  return `${index}.${field}`
}

const ADD_REJECTION_KEY = 'add'

// Same pattern as `ApiConfigPanel`'s `localValidationError`: client-side validation (no operation
// selected) never reaches `onCommitPreloads` — it's rejected before any commit is attempted, but
// still rendered through the shared `CommitRejectionBanner`, which needs a `RuntimeConfigError`-
// shaped value.
function localValidationError(message: string): RuntimeConfigError {
  return { code: 'invalid-layout', displayMode: 'development-only', message }
}

export interface PreloadsListEditorProps {
  preloads: RuntimePreloadConfig[] | undefined
  operationCatalog: RuntimeApiConfig
  onCommitPreloads: (
    mutate: (prev: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
}

/**
 * Add/delete/edit editor for a single `RuntimePreloadConfig[]` list (T7, FR11-FR15) — mounted
 * twice by `ApiConfigPanel`'s "Preloads" sub-view with different props: once for the root
 * `preloads` block ("Precargas globales") and once for the active page's `preloads`
 * ("Precargas de la página activa"). Both instances are this same component; there is no second
 * parallel implementation for either section.
 *
 * Delegates each entry's own fields (operationName + requestParams) to
 * `PreloadEntryFieldsEditor`. `blocking` is a sibling of `when`, not a `requestParams` field, so
 * it's edited here directly via a checkbox next to "Borrar precarga" rather than delegated.
 * Unchecking it omits the key entirely instead of writing `blocking: false`, keeping the config
 * minimal (absent is equivalent to `false`). Editing `when` is out of scope (spec.md).
 */
export function PreloadsListEditor({ preloads, operationCatalog, onCommitPreloads }: PreloadsListEditorProps) {
  const entries = preloads ?? []
  const operationNames = Object.keys(operationCatalog)

  const [pendingRejections, setPendingRejections] = useState<PreloadPendingRejections>({})
  const [newOperationName, setNewOperationName] = useState(operationNames[0] ?? '')
  const newOperationSelectId = useId()

  function recordResult(key: string, attemptedValue: unknown, result: CommitCanvasMutationResult) {
    if (result.status === 'rejected') {
      setPendingRejections((prev) => ({ ...prev, [key]: { value: attemptedValue, error: result.error } }))
      return
    }
    clearPending(key)
  }

  function recordLocalError(key: string, attemptedValue: unknown, message: string) {
    setPendingRejections((prev) => ({ ...prev, [key]: { value: attemptedValue, error: localValidationError(message) } }))
  }

  function clearPending(key: string) {
    setPendingRejections((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleNewOperationNameChange(value: string) {
    setNewOperationName(value)
    clearPending(ADD_REJECTION_KEY)
  }

  function handleAddEntry() {
    if (newOperationName === '') {
      recordLocalError(ADD_REJECTION_KEY, newOperationName, 'Selecciona una operación.')
      return
    }

    const result = onCommitPreloads((prev) => [
      ...(prev ?? []),
      { operationName: newOperationName, requestParams: {} },
    ])
    recordResult(ADD_REJECTION_KEY, newOperationName, result)
    if (result.status !== 'rejected') {
      setNewOperationName(operationNames[0] ?? '')
    }
  }

  function handleDeleteEntry(index: number) {
    onCommitPreloads((prev) => (prev ?? []).filter((_, entryIndex) => entryIndex !== index))
  }

  function handleCommitEntryField(index: number, field: PreloadEntryField, nextValue: unknown) {
    const result = onCommitPreloads((prev) => {
      const current = prev ?? []
      return current.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry
        if (field === 'operationName') return { ...entry, operationName: nextValue as string }
        if (field === 'blocking') {
          if (nextValue) return { ...entry, blocking: true }
          const { blocking: _blocking, ...rest } = entry
          return rest
        }
        return { ...entry, requestParams: { ...entry.requestParams, [field]: nextValue } }
      })
    })
    recordResult(preloadEntryFieldRejectionKey(index, field), nextValue, result)
  }

  const addPending = pendingRejections[ADD_REJECTION_KEY]

  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 ? (
        <p className="text-xs text-gray-500">Sin precargas configuradas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry, index) => {
            const blockingPending = pendingRejections[preloadEntryFieldRejectionKey(index, 'blocking')]
            const displayedBlocking = blockingPending ? Boolean(blockingPending.value) : Boolean(entry.blocking)

            return (
            <li key={index} className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={displayedBlocking}
                    onChange={(event) => handleCommitEntryField(index, 'blocking', event.target.checked)}
                    aria-label={`Bloqueante precarga ${index + 1}`}
                  />
                  Bloqueante
                </label>
                <button
                  type="button"
                  onClick={() => handleDeleteEntry(index)}
                  aria-label={`Borrar precarga ${index + 1}`}
                  className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Borrar precarga
                </button>
              </div>
              {blockingPending && (
                <CommitRejectionBanner
                  dataTestId={`preload-entry-${index}-blocking-error`}
                  error={blockingPending.error}
                />
              )}
              <PreloadEntryFieldsEditor
                index={index}
                entry={entry}
                operationCatalog={operationCatalog}
                pendingRejections={pendingRejections}
                onCommitField={(field, nextValue) => handleCommitEntryField(index, field, nextValue)}
              />
            </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-700">Añadir precarga</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleAddEntry()
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={newOperationSelectId} className="text-xs font-medium text-gray-700">
              Operación
            </label>
            <select
              id={newOperationSelectId}
              value={newOperationName}
              onChange={(event) => handleNewOperationNameChange(event.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
            >
              {operationNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {addPending && <CommitRejectionBanner dataTestId="preloads-list-editor-add-error" error={addPending.error} />}
          <button
            type="submit"
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Añadir precarga
          </button>
        </form>
      </div>
    </div>
  )
}
