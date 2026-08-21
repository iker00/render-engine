import { useId, useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeApiConfig, RuntimeApiMethod, RuntimePreloadConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { PropertyFieldRow } from '../layout-canvas/property-fields/property-field-row'
import { SegmentedTogglePropertyField } from '../layout-canvas/property-fields/segmented-toggle-property-field'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import { ApiOperationFieldsEditor } from './api-operation-fields-editor'
import {
  API_METHOD_OPTIONS,
  apiOperationFieldRejectionKey,
  type ApiOperationField,
  type ApiPendingRejections,
} from './api-operation-fields-helpers'
import { PreloadsListEditor } from './preloads-list-editor'

export interface ApiConfigPanelProps {
  api: RuntimeApiConfig
  onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult
  globalPreloads: RuntimePreloadConfig[] | undefined
  activePageId: string
  pagePreloads: RuntimePreloadConfig[] | undefined
  onCommitGlobalPreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
  onCommitPagePreloadsMutation: (
    mutate: (preloads: RuntimePreloadConfig[] | undefined) => RuntimePreloadConfig[] | undefined,
  ) => CommitCanvasMutationResult
}

const OPERATIONS_TAB_ID = 'api-config-panel-tab-operations'
const PRELOADS_TAB_ID = 'api-config-panel-tab-preloads'
const OPERATIONS_PANEL_ID = 'api-config-panel-operations-panel'
const PRELOADS_PANEL_ID = 'api-config-panel-preloads-panel'
type ApiConfigSubView = 'operations' | 'preloads'

const ADD_REJECTION_KEY = 'add'

// Same pattern as `TranslationsConfigPanel`'s `localValidationError`: client-side validation
// (empty/duplicate key) never reaches `onCommitApiMutation` — it's rejected before any commit is
// attempted, but still rendered through the shared `CommitRejectionBanner`, which needs a
// `RuntimeConfigError`-shaped value. `invalid-layout` is the closest existing code for "the
// entered shape is invalid".
function localValidationError(message: string): RuntimeConfigError {
  return { code: 'invalid-layout', displayMode: 'development-only', message }
}

/**
 * "Api" section of the visual editor. "Operaciones" (T6, FR4-FR10) is a full manual CRUD editor
 * for the `api` block — add/delete operations plus method/endpoint/query/body/headers per
 * operation, each committed independently through `onCommitApiMutation`, the same "mutate,
 * validate, patch only this root key" pipeline `ShellConfigPanel`/`TranslationsConfigPanel` use
 * for `shell`/`translations` (see `commitApiMutation` in `dev-runtime.tsx`). "Preloads" (T7,
 * FR11-FR15) mounts the same `PreloadsListEditor` twice — once over `globalPreloads`/
 * `onCommitGlobalPreloadsMutation` for the root `preloads` block, once over `pagePreloads`/
 * `onCommitPagePreloadsMutation` for the active page's `preloads` — each independently committed
 * via its own pipeline in `dev-runtime.tsx` (`commitGlobalPreloadsMutation`/
 * `commitPagePreloadsMutation`). The page section is remounted (`key={activePageId}`) on every
 * page change so a half-filled add draft never carries over from one page to another.
 */
export function ApiConfigPanel({
  api,
  onCommitApiMutation,
  globalPreloads,
  activePageId,
  pagePreloads,
  onCommitGlobalPreloadsMutation,
  onCommitPagePreloadsMutation,
}: ApiConfigPanelProps) {
  const [activeSubView, setActiveSubView] = useState<ApiConfigSubView>('operations')
  const operationNames = Object.keys(api)

  const [pendingRejections, setPendingRejections] = useState<ApiPendingRejections>({})
  const [newKey, setNewKey] = useState('')
  const [newMethod, setNewMethod] = useState<RuntimeApiMethod>('GET')
  const [newEndpoint, setNewEndpoint] = useState('')
  const newMethodRowId = useId()

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

  function handleNewKeyChange(value: string) {
    setNewKey(value)
    clearPending(ADD_REJECTION_KEY)
  }

  function handleNewMethodChange(value: RuntimeApiMethod) {
    setNewMethod(value)
    clearPending(ADD_REJECTION_KEY)
  }

  function handleNewEndpointChange(value: string) {
    setNewEndpoint(value)
    clearPending(ADD_REJECTION_KEY)
  }

  function handleAddOperation() {
    const key = newKey.trim()
    if (key === '') {
      recordLocalError(ADD_REJECTION_KEY, newKey, 'La clave no puede estar vacía.')
      return
    }
    if (key in api) {
      recordLocalError(ADD_REJECTION_KEY, newKey, `La clave "${key}" ya existe.`)
      return
    }

    const result = onCommitApiMutation((prev) => ({ ...prev, [key]: { method: newMethod, endpoint: newEndpoint } }))
    recordResult(ADD_REJECTION_KEY, newKey, result)
    if (result.status !== 'rejected') {
      setNewKey('')
      setNewMethod('GET')
      setNewEndpoint('')
    }
  }

  function handleDeleteOperation(key: string) {
    onCommitApiMutation((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleCommitOperationField(key: string, field: ApiOperationField, nextValue: unknown) {
    const result = onCommitApiMutation((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: nextValue },
    }))
    recordResult(apiOperationFieldRejectionKey(key, field), nextValue, result)
  }

  const addPending = pendingRejections[ADD_REJECTION_KEY]

  return (
    <div data-testid="api-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div role="tablist" aria-label="Sub-vistas de Api" className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          role="tab"
          id={OPERATIONS_TAB_ID}
          aria-selected={activeSubView === 'operations'}
          aria-controls={OPERATIONS_PANEL_ID}
          onClick={() => setActiveSubView('operations')}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeSubView === 'operations' ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Operaciones
        </button>
        <button
          type="button"
          role="tab"
          id={PRELOADS_TAB_ID}
          aria-selected={activeSubView === 'preloads'}
          aria-controls={PRELOADS_PANEL_ID}
          onClick={() => setActiveSubView('preloads')}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeSubView === 'preloads' ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Preloads
        </button>
      </div>

      <div
        role="tabpanel"
        id={OPERATIONS_PANEL_ID}
        aria-labelledby={OPERATIONS_TAB_ID}
        data-testid={OPERATIONS_PANEL_ID}
        className={activeSubView === 'operations' ? 'flex flex-col gap-4' : 'hidden'}
      >
        {operationNames.length === 0 ? (
          <p className="text-xs text-gray-500">Sin operaciones declaradas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {operationNames.map((name) => (
              <li
                key={name}
                data-testid={`api-config-panel-operation-${name}`}
                className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-800">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteOperation(name)}
                    aria-label={`Borrar operación ${name}`}
                    className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    Borrar operación
                  </button>
                </div>
                <ApiOperationFieldsEditor
                  operationKey={name}
                  operation={api[name]}
                  pendingRejections={pendingRejections}
                  onCommitField={(field, nextValue) => handleCommitOperationField(name, field, nextValue)}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-700">Añadir operación</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleAddOperation()
            }}
            className="flex flex-col gap-2"
          >
            <TextPropertyField label="Clave" value={newKey} onChange={handleNewKeyChange} />
            <PropertyFieldRow htmlFor={newMethodRowId} label="Método">
              <SegmentedTogglePropertyField
                label="Método"
                segments={API_METHOD_OPTIONS}
                activeValue={newMethod}
                onSelect={(value) => handleNewMethodChange(value as RuntimeApiMethod)}
              />
            </PropertyFieldRow>
            <TextPropertyField label="Endpoint" value={newEndpoint} onChange={handleNewEndpointChange} />
            {addPending && <CommitRejectionBanner dataTestId="api-config-panel-add-error" error={addPending.error} />}
            <button
              type="submit"
              className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Añadir
            </button>
          </form>
        </div>
      </div>

      <div
        role="tabpanel"
        id={PRELOADS_PANEL_ID}
        aria-labelledby={PRELOADS_TAB_ID}
        data-testid={PRELOADS_PANEL_ID}
        className={activeSubView === 'preloads' ? 'flex flex-col gap-4' : 'hidden'}
      >
        <div data-testid="api-config-panel-preloads-global" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-gray-800">Precargas globales</h3>
          <PreloadsListEditor
            preloads={globalPreloads}
            operationCatalog={api}
            onCommitPreloads={onCommitGlobalPreloadsMutation}
          />
        </div>

        <div data-testid="api-config-panel-preloads-page" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-gray-800">Precargas de la página activa</h3>
          <PreloadsListEditor
            key={activePageId}
            preloads={pagePreloads}
            operationCatalog={api}
            onCommitPreloads={onCommitPagePreloadsMutation}
          />
        </div>
      </div>
    </div>
  )
}
