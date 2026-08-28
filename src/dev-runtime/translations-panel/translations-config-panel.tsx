import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { RuntimeTranslationsConfig, RuntimeTranslationsLangMap } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type {
  EndpointOperationUnavailableReason,
  ResolvedEndpointOperation,
} from '../endpoints-config/resolve-endpoint-operation'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { PropertyFieldRow } from '../layout-canvas/property-fields/property-field-row'
import type {
  TranslationsProvider,
  TranslationsProviderError,
  TranslationsProviderSearchResult,
} from './translations-provider'
import { isNumericTranslationKey } from './translations-panel-helpers'

export interface TranslationsConfigPanelProps {
  translations: RuntimeTranslationsConfig | undefined
  onCommitTranslationsMutation: (
    mutate: (prev: RuntimeTranslationsConfig | undefined) => RuntimeTranslationsConfig | undefined,
  ) => CommitCanvasMutationResult
  // Optional so existing/older call sites and tests that don't exercise "Buscar y añadir" (0130-T4)
  // don't need to supply one. The real app always wires a resolved provider — see DevEditorLayer.
  provider?: TranslationsProvider
  // T7 (0131): replaces the former `tokens` prop + token dropdown (FR10/FR11/D7). Each action
  // enables/disables independently from its own resolution, with an explanatory message when
  // `unavailable`.
  searchResolution: ResolvedEndpointOperation
  refreshResolution: ResolvedEndpointOperation
}

// FR11/D7: one message per `EndpointOperationUnavailableReason`, shown next to each action's
// button instead of the retired token dropdown. Same wording pattern as
// `DevEditorFloatingToolbar`'s `SAVE_UNAVAILABLE_MESSAGES` (0131-T6) for consistency across the
// editor.
const SEARCH_UNAVAILABLE_MESSAGES: Record<EndpointOperationUnavailableReason, string> = {
  'operation-not-declared': 'La operación de búsqueda de textos no está declarada en la configuración de endpoints',
  'token-not-resolvable': 'El token declarado para la operación de búsqueda de textos no existe en tokens',
}

const REFRESH_UNAVAILABLE_MESSAGES: Record<EndpointOperationUnavailableReason, string> = {
  'operation-not-declared': 'La operación de refresco de traducciones no está declarada en la configuración de endpoints',
  'token-not-resolvable': 'El token declarado para la operación de refresco de traducciones no existe en tokens',
}

// PlataGes' "idioma 1" is the provider's default language (Decisión D3): every key created from a
// search result is populated under this app language code only, leaving other languages empty.
const PROVIDER_DEFAULT_LANGUAGE = 'es'

// Fixed mapping from PlataGes' numeric `idioma` code to this app's language slug, used by
// "Refrescar todo" (0130-T5) to patch translations. Extending this map is a code change, not a
// configuration option (Decisión D5) — an `idioma` not present here is ignored silently.
const PROVIDER_LANGUAGE_MAP: Record<number, string> = { 1: 'es', 2: 'eu' }

// Union of every language slug used by any key, in first-seen order across `translations`'
// own key/value insertion order. Stable for a given input.
function collectLanguages(translations: RuntimeTranslationsConfig): string[] {
  const languages: string[] = []
  const seen = new Set<string>()
  for (const key of Object.keys(translations)) {
    for (const lang of Object.keys(translations[key])) {
      if (!seen.has(lang)) {
        seen.add(lang)
        languages.push(lang)
      }
    }
  }
  return languages
}

// Table/add-form columns: committed languages first, then any language added locally via
// "Añadir idioma nuevo" that isn't already committed (Decisión D5 — a pending column lives as
// local state until the first cell edit under it persists it into `translations`).
function computeColumns(translations: RuntimeTranslationsConfig | undefined, pendingLanguages: string[]): string[] {
  const committed = translations ? collectLanguages(translations) : []
  const columns = [...committed]
  for (const lang of pendingLanguages) {
    if (!columns.includes(lang)) columns.push(lang)
  }
  return columns
}

function cellDraftKey(key: string, lang: string): string {
  return `cell:${key}:${lang}`
}

function editRejectionKey(key: string, lang: string): string {
  return `edit:${key}:${lang}`
}

function deleteRejectionKey(key: string): string {
  return `delete:${key}`
}

// Client-side validation errors (empty/duplicate key, empty/duplicate language code) never reach
// `onCommitTranslationsMutation` — they are rejected before any commit is attempted. They are
// still rendered through the shared `CommitRejectionBanner`, so they need a `RuntimeConfigError`-
// shaped value; `invalid-layout` is the closest existing code for "the entered shape is invalid".
function localValidationError(message: string): RuntimeConfigError {
  return { code: 'invalid-layout', displayMode: 'development-only', message }
}

type PendingEntry = { value: unknown; error: RuntimeConfigError }
type PendingRejections = Partial<Record<string, PendingEntry>>

/**
 * Manual editor for the `translations` config block (0130-T3): a table with one row per key and
 * one column per known language, inline cell editing committed on blur, entry add/delete, and
 * adding a new language column. "Buscar y añadir"/"Refrescar todo" (T4/T5) each enable
 * independently from `searchResolution`/`refreshResolution` (T7, 0131) — there is no token
 * dropdown. Every mutation goes through `onCommitTranslationsMutation` — the same "mutate,
 * validate, patch only `translations`" pipeline `ShellConfigPanel` uses for `shell` (see
 * `commitTranslationsMutation` in `dev-runtime.tsx`).
 */
export function TranslationsConfigPanel({
  translations,
  onCommitTranslationsMutation,
  provider,
  searchResolution,
  refreshResolution,
}: TranslationsConfigPanelProps) {
  const keys = translations ? Object.keys(translations) : []
  const [pendingLanguages, setPendingLanguages] = useState<string[]>([])
  const columns = computeColumns(translations, pendingLanguages)

  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({})
  const [pendingRejections, setPendingRejections] = useState<PendingRejections>({})

  const [newKey, setNewKey] = useState('')
  const [newEntryValues, setNewEntryValues] = useState<Record<string, string>>({})

  const [newLanguageCode, setNewLanguageCode] = useState('')

  // 0130-T4: "Buscar y añadir" against `provider.searchTexts`. `searchResults === null` means no
  // search has produced a list to show yet (initial state, or cleared after a successful commit);
  // an empty array is a real "no results" outcome and renders its own explicit state.
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<TranslationsProviderSearchResult[] | null>(null)
  const [selectedResultIds, setSelectedResultIds] = useState<Set<number>>(new Set())
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<TranslationsProviderError | null>(null)

  // 0130-T5: "Refrescar todo" against `provider.getTranslationsBatch`.
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [refreshError, setRefreshError] = useState<TranslationsProviderError | null>(null)
  const [noRefreshableKeysNotice, setNoRefreshableKeysNotice] = useState(false)

  function recordCommitResult(key: string, attemptedValue: unknown, result: CommitCanvasMutationResult) {
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

  function handleCellChange(key: string, lang: string, value: string) {
    const draftKey = cellDraftKey(key, lang)
    setCellDrafts((prev) => ({ ...prev, [draftKey]: value }))
    clearPending(editRejectionKey(key, lang))
  }

  function handleCellBlur(key: string, lang: string) {
    const draftKey = cellDraftKey(key, lang)
    const draftValue = cellDrafts[draftKey]
    if (draftValue === undefined) return

    const originalValue = translations?.[key]?.[lang] ?? ''
    if (draftValue === originalValue) {
      setCellDrafts((prev) => {
        if (!(draftKey in prev)) return prev
        const next = { ...prev }
        delete next[draftKey]
        return next
      })
      return
    }

    const result = onCommitTranslationsMutation((prev) => {
      const prevEntry = prev?.[key] ?? {}
      if (draftValue === '') {
        const { [lang]: _removed, ...rest } = prevEntry
        return { ...(prev ?? {}), [key]: rest }
      }
      return { ...(prev ?? {}), [key]: { ...prevEntry, [lang]: draftValue } }
    })
    recordCommitResult(editRejectionKey(key, lang), draftValue, result)
    if (result.status !== 'rejected') {
      setCellDrafts((prev) => {
        const next = { ...prev }
        delete next[draftKey]
        return next
      })
    }
  }

  function handleDelete(key: string) {
    const result = onCommitTranslationsMutation((prev) => {
      const next = { ...(prev ?? {}) }
      delete next[key]
      return next
    })
    recordCommitResult(deleteRejectionKey(key), key, result)
  }

  function handleNewKeyChange(value: string) {
    setNewKey(value)
    clearPending('add')
  }

  function handleNewEntryValueChange(lang: string, value: string) {
    setNewEntryValues((prev) => ({ ...prev, [lang]: value }))
    clearPending('add')
  }

  function handleAddEntry() {
    const key = newKey.trim()
    if (key === '') {
      recordLocalError('add', newKey, 'La clave no puede estar vacía.')
      return
    }
    if (translations && key in translations) {
      recordLocalError('add', newKey, `La clave "${key}" ya existe.`)
      return
    }

    const langMap: RuntimeTranslationsLangMap = {}
    for (const lang of columns) {
      const value = newEntryValues[lang]
      if (value !== undefined && value !== '') {
        langMap[lang] = value
      }
    }

    const result = onCommitTranslationsMutation((prev) => ({ ...(prev ?? {}), [key]: langMap }))
    recordCommitResult('add', newKey, result)
    if (result.status !== 'rejected') {
      setNewKey('')
      setNewEntryValues({})
    }
  }

  function handleNewLanguageCodeChange(value: string) {
    setNewLanguageCode(value)
    clearPending('add-language')
  }

  function handleAddLanguage() {
    const code = newLanguageCode.trim()
    if (code === '') {
      recordLocalError('add-language', newLanguageCode, 'El código de idioma no puede estar vacío.')
      return
    }
    if (columns.includes(code)) {
      recordLocalError('add-language', newLanguageCode, `El idioma "${code}" ya existe.`)
      return
    }
    setPendingLanguages((prev) => [...prev, code])
    setNewLanguageCode('')
    clearPending('add-language')
  }

  function handleSearchTextChange(value: string) {
    setSearchText(value)
    setSearchError(null)
  }

  async function handleSearch() {
    const text = searchText.trim()
    if (text === '' || !provider || searchResolution.status !== 'ready' || searchLoading) return

    setSearchLoading(true)
    const outcome = await provider.searchTexts({ text, token: searchResolution.token })
    setSearchLoading(false)

    if (outcome.status === 'error') {
      setSearchError(outcome.error)
      return
    }
    setSearchError(null)
    setSearchResults(outcome.data)
    setSelectedResultIds(new Set())
  }

  function resultAlreadyExists(idTexto: number): boolean {
    return translations !== undefined && String(idTexto) in translations
  }

  function handleToggleResult(idTexto: number) {
    if (resultAlreadyExists(idTexto)) return
    setSelectedResultIds((prev) => {
      const next = new Set(prev)
      if (next.has(idTexto)) {
        next.delete(idTexto)
      } else {
        next.add(idTexto)
      }
      return next
    })
  }

  function handleAddSelectedResults() {
    if (searchResults === null || selectedResultIds.size === 0) return
    const selected = searchResults.filter((result) => selectedResultIds.has(result.idTexto))
    if (selected.length === 0) return

    const result = onCommitTranslationsMutation((prev) => {
      const next = { ...(prev ?? {}) }
      for (const item of selected) {
        next[String(item.idTexto)] = { [PROVIDER_DEFAULT_LANGUAGE]: item.texto }
      }
      return next
    })
    recordCommitResult('search-add', selectedResultIds, result)
    if (result.status !== 'rejected') {
      setSearchResults(null)
      setSelectedResultIds(new Set())
    }
  }

  async function handleRefreshAll() {
    if (!provider || refreshResolution.status !== 'ready' || refreshLoading) return

    clearPending('refresh')
    setRefreshError(null)
    setNoRefreshableKeysNotice(false)

    const numericKeys = translations ? Object.keys(translations).filter(isNumericTranslationKey) : []
    if (numericKeys.length === 0) {
      setNoRefreshableKeysNotice(true)
      return
    }

    setRefreshLoading(true)
    const outcome = await provider.getTranslationsBatch({
      ids: numericKeys.map(Number),
      token: refreshResolution.token,
    })
    setRefreshLoading(false)

    if (outcome.status === 'error') {
      setRefreshError(outcome.error)
      return
    }

    const result = onCommitTranslationsMutation((prev) => {
      const next = { ...(prev ?? {}) }
      for (const item of outcome.data) {
        const key = String(item.idTexto)
        const patchedLangs: RuntimeTranslationsLangMap = { ...(next[key] ?? {}) }
        for (const traduccion of item.traducciones) {
          const lang = PROVIDER_LANGUAGE_MAP[traduccion.idioma]
          if (lang === undefined) continue
          patchedLangs[lang] = traduccion.texto
        }
        next[key] = patchedLangs
      }
      return next
    })
    recordCommitResult('refresh', numericKeys, result)
  }

  const addPending = pendingRejections.add
  const addLanguagePending = pendingRejections['add-language']
  const searchAddPending = pendingRejections['search-add']
  const refreshPending = pendingRejections.refresh

  return (
    <div data-testid="translations-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <h2 className="text-base font-semibold text-gray-900">Traducciones</h2>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">Sin traducciones definidas</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b border-gray-200 px-2 py-1">
                Clave
              </th>
              {columns.map((lang) => (
                <th key={lang} scope="col" className="border-b border-gray-200 px-2 py-1">
                  {lang}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key}>
                <td className="border-b border-gray-100 px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span>{key}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(key)}
                      aria-label={`Borrar entrada ${key}`}
                      className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Borrar
                    </button>
                  </div>
                  {pendingRejections[deleteRejectionKey(key)] && (
                    <CommitRejectionBanner
                      dataTestId={`translations-config-panel-delete-${key}-error`}
                      error={pendingRejections[deleteRejectionKey(key)]!.error}
                    />
                  )}
                </td>
                {columns.map((lang) => {
                  const draftKey = cellDraftKey(key, lang)
                  const value = cellDrafts[draftKey] ?? translations?.[key]?.[lang] ?? ''
                  const cellRejection = pendingRejections[editRejectionKey(key, lang)]
                  return (
                    <td key={lang} className="border-b border-gray-100 px-2 py-1">
                      <input
                        type="text"
                        aria-label={`Traducción de ${key} en ${lang}`}
                        value={value}
                        onChange={(event) => handleCellChange(key, lang, event.target.value)}
                        onBlur={() => handleCellBlur(key, lang)}
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
                      />
                      {cellRejection && (
                        <CommitRejectionBanner
                          dataTestId={`translations-config-panel-edit-${key}-${lang}-error`}
                          error={cellRejection.error}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleAddEntry()
        }}
        className="flex flex-col gap-2"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="px-1 text-xs font-medium text-gray-700">Añadir entrada</legend>
          <PropertyFieldRow htmlFor="translations-add-key" label="Clave">
            <input
              id="translations-add-key"
              type="text"
              value={newKey}
              onChange={(event) => handleNewKeyChange(event.target.value)}
              className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
            />
          </PropertyFieldRow>
          {columns.map((lang) => (
            <PropertyFieldRow key={lang} htmlFor={`translations-add-lang-${lang}`} label={lang}>
              <input
                id={`translations-add-lang-${lang}`}
                type="text"
                value={newEntryValues[lang] ?? ''}
                onChange={(event) => handleNewEntryValueChange(lang, event.target.value)}
                className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
              />
            </PropertyFieldRow>
          ))}
          {addPending && <CommitRejectionBanner dataTestId="translations-config-panel-add-error" error={addPending.error} />}
          <button
            type="submit"
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Añadir
          </button>
        </fieldset>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleAddLanguage()
        }}
        className="flex flex-col gap-2"
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="px-1 text-xs font-medium text-gray-700">Añadir idioma</legend>
          <PropertyFieldRow htmlFor="translations-add-language-code" label="Código de idioma">
            <input
              id="translations-add-language-code"
              type="text"
              value={newLanguageCode}
              onChange={(event) => handleNewLanguageCodeChange(event.target.value)}
              className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
            />
          </PropertyFieldRow>
          {addLanguagePending && (
            <CommitRejectionBanner dataTestId="translations-config-panel-add-language-error" error={addLanguagePending.error} />
          )}
          <button
            type="submit"
            className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Añadir idioma
          </button>
        </fieldset>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-700">Buscar y añadir</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleSearch()
          }}
          className="flex flex-col gap-2"
        >
          <PropertyFieldRow htmlFor="translations-search-text" label="Buscar texto">
            <div className="flex gap-2">
              <input
                id="translations-search-text"
                type="text"
                value={searchText}
                onChange={(event) => handleSearchTextChange(event.target.value)}
                className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm"
              />
              <button
                type="submit"
                disabled={searchResolution.status !== 'ready' || searchLoading}
                className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          </PropertyFieldRow>
          {searchResolution.status === 'unavailable' && (
            <p className="text-xs text-gray-500">{SEARCH_UNAVAILABLE_MESSAGES[searchResolution.reason]}</p>
          )}
          {searchLoading && (
            <span role="status" className="text-xs text-gray-500">
              Buscando...
            </span>
          )}
          {searchError && (
            <p
              role="alert"
              data-testid="translations-config-panel-search-error"
              className="rounded bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {searchError.message}
            </p>
          )}
        </form>

        {searchResults !== null && (
          <>
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-500">Sin resultados</p>
            ) : (
              <>
                <ul className="flex flex-col gap-1">
                  {searchResults.map((result) => {
                    const alreadyExists = resultAlreadyExists(result.idTexto)
                    const checkboxId = `translations-search-result-${result.idTexto}`
                    return (
                      <li key={result.idTexto} className="flex items-center gap-2 text-sm">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          aria-label={`Seleccionar resultado ${result.idTexto}`}
                          checked={selectedResultIds.has(result.idTexto)}
                          disabled={alreadyExists}
                          onChange={() => handleToggleResult(result.idTexto)}
                        />
                        <label htmlFor={checkboxId} className="flex flex-1 items-center gap-2">
                          <span className="text-gray-500">{String(result.idTexto)}</span>
                          <span>{result.texto}</span>
                        </label>
                        {alreadyExists && <span className="text-xs text-gray-500">Ya existe</span>}
                      </li>
                    )
                  })}
                </ul>
                <button
                  type="button"
                  onClick={handleAddSelectedResults}
                  disabled={selectedResultIds.size === 0}
                  className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Añadir seleccionados
                </button>
                {searchAddPending && (
                  <CommitRejectionBanner
                    dataTestId="translations-config-panel-search-add-error"
                    error={searchAddPending.error}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-gray-700">Refrescar todo</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefreshAll()}
            disabled={refreshResolution.status !== 'ready' || refreshLoading}
            className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refrescar todo
          </button>
          {refreshLoading && (
            <span role="status" className="text-xs text-gray-500">
              Actualizando...
            </span>
          )}
        </div>
        {refreshResolution.status === 'unavailable' && (
          <p className="text-xs text-gray-500">{REFRESH_UNAVAILABLE_MESSAGES[refreshResolution.reason]}</p>
        )}
        {noRefreshableKeysNotice && <p className="text-xs text-gray-500">Sin claves refrescables</p>}
        {refreshError && (
          <p
            role="alert"
            data-testid="translations-config-panel-refresh-error"
            className="rounded bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {refreshError.message}
          </p>
        )}
        {refreshPending && (
          <CommitRejectionBanner
            dataTestId="translations-config-panel-refresh-commit-error"
            error={refreshPending.error}
          />
        )}
      </div>
    </div>
  )
}
