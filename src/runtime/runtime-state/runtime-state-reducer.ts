import type { RuntimeConfig } from '../../config/runtime-config'
import type {
  RuntimeFormFieldDefinition,
  RuntimeFormFieldState,
  RuntimeNavigationHistoryEntry,
  RuntimePageEntryState,
  RuntimePageParams,
  RuntimeFormState,
  RuntimeQueryState,
  RuntimeState,
  RuntimeStateAction,
} from './runtime-state-types'

export function createRuntimeState(
  config: RuntimeConfig,
  options?: { dataValues?: Record<string, unknown>; activeLanguage?: string },
): RuntimeState {
  const initialPage = config.pages.find((page) => page.id === config.initialPage)
  const initialEntry = createNavigationHistoryEntry(0, config.initialPage, {})

  const dataValues = options?.dataValues
  const queries: RuntimeState['queries'] =
    dataValues && Object.keys(dataValues).length > 0
      ? Object.fromEntries(
          Object.entries(dataValues).map(([queryName, data]) => [
            queryName,
            { status: 'success' as const, data, error: null, requestSignature: null },
          ]),
        )
      : {}

  return {
    navigation: {
      currentPageId: initialEntry.pageId,
      history: [initialEntry],
      currentEntryIndex: 0,
      lastError: null,
    },
    forms: {},
    queries,
    pageEntry: createRuntimePageEntryState({
      entryId: 0,
      pageId: config.initialPage,
      params: {},
      preloadNames: initialPage?.preloads?.map((preload) => preload.operationName) ?? [],
      status: 'idle',
    }),
    modal: {
      activeModalId: null,
      activeIterationKey: null,
    },
    i18n: {
      translations: config.translations ?? {},
      activeLanguage: options?.activeLanguage ?? 'es',
    },
  }
}

const closedModalState = { activeModalId: null, activeIterationKey: null } as const

export function runtimeStateReducer(stateIn: RuntimeState, action: RuntimeStateAction): RuntimeState {
  // Normalize state that predates the modal domain (e.g. preserved across a dev HMR reload)
  const state: RuntimeState = stateIn.modal == null ? { ...stateIn, modal: closedModalState } : stateIn
  switch (action.type) {
    case 'runtime/reset':
      return action.payload.state
    case 'navigation/sync-from-browser': {
      const next = synchronizeNavigationWithEntry(state, action.payload.pageId, action.payload.params)
      return { ...next, modal: closedModalState }
    }
    case 'navigation/navigate': {
      const next = appendNavigationEntry(state, action.payload.pageId, action.payload.params)
      return { ...next, modal: closedModalState }
    }
    case 'navigation/go-back': {
      if (state.navigation.currentEntryIndex < 1) {
        return {
          ...state,
          navigation: {
            ...state.navigation,
            lastError: null,
          },
        }
      }

      const previousEntry = state.navigation.history[state.navigation.currentEntryIndex - 1]

      return {
        ...state,
        navigation: {
          currentPageId: previousEntry.pageId,
          history: state.navigation.history,
          currentEntryIndex: state.navigation.currentEntryIndex - 1,
          lastError: null,
        },
      }
    }
    case 'navigation/set-error':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          lastError: action.payload.error,
        },
      }
    case 'page-entry/set-idle':
      return {
        ...state,
        pageEntry: createRuntimePageEntryState({
          entryId: action.payload.entryId,
          pageId: action.payload.pageId,
          params: action.payload.params,
          preloadNames: action.payload.preloadNames,
          status: 'idle',
        }),
        modal: closedModalState,
      }
    case 'page-entry/start-preload-batch':
      return {
        ...state,
        queries: resetQueriesForPreloadBatch(
          state.queries,
          action.payload.resetQueries ?? action.payload.preloadNames.map((queryName) => ({ queryName, requestSignature: null })),
        ),
        pageEntry: createRuntimePageEntryState({
          entryId: action.payload.entryId,
          pageId: action.payload.pageId,
          params: action.payload.params,
          preloadNames: action.payload.preloadNames,
          status: 'loading',
        }),
        modal: closedModalState,
      }
    case 'page-entry/set-loading':
      return {
        ...state,
        pageEntry: createRuntimePageEntryState({
          entryId: action.payload.entryId,
          pageId: action.payload.pageId,
          params: action.payload.params,
          preloadNames: action.payload.preloadNames,
          status: 'loading',
        }),
      }
    case 'page-entry/set-settled-entry':
      return {
        ...state,
        pageEntry: createRuntimePageEntryState({
          entryId: action.payload.entryId,
          pageId: action.payload.pageId,
          params: action.payload.params,
          preloadNames: action.payload.preloadNames,
          status: action.payload.status,
        }),
      }
    case 'page-entry/set-settled':
      if (state.pageEntry.entryId !== action.payload.entryId) {
        return state
      }

      return {
        ...state,
        pageEntry: createRuntimePageEntryState({
          ...state.pageEntry,
          status: action.payload.status,
        }),
      }
    case 'forms/initialize':
      return {
        ...state,
        forms: {
          ...state.forms,
          [action.payload.formId]: initializeRuntimeForm(
            state.forms[action.payload.formId],
            action.payload.fields,
          ),
        },
      }
    case 'forms/set-value':
      return {
        ...state,
        forms: {
          ...state.forms,
          [action.payload.formId]: {
            ...state.forms[action.payload.formId],
            [action.payload.fieldId]: updateRuntimeFormFieldValue(
              state.forms[action.payload.formId]?.[action.payload.fieldId],
              action.payload.value,
            ),
          },
        },
      }
    case 'forms/set-error':
      return {
        ...state,
        forms: {
          ...state.forms,
          [action.payload.formId]: {
            ...state.forms[action.payload.formId],
            [action.payload.fieldId]: {
              ...getRuntimeFormFieldState(
                state.forms[action.payload.formId]?.[action.payload.fieldId],
                action.payload.defaultValue,
              ),
              error: action.payload.error,
            },
          },
        },
      }
    case 'forms/reset':
      return {
        ...state,
        forms: {
          ...state.forms,
          [action.payload.formId]: resetRuntimeForm(state.forms[action.payload.formId]),
        },
      }
    case 'forms/remove':
      return {
        ...state,
        forms: removeRuntimeForm(state.forms, action.payload.formId),
      }
    case 'queries/initialize':
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.payload.queryName]:
            state.queries[action.payload.queryName] ?? createRuntimeQueryState(),
        },
      }
    case 'queries/set-loading':
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.payload.queryName]: {
            ...getRuntimeQueryState(state.queries[action.payload.queryName]),
            status: 'loading',
            error: null,
            requestSignature: action.payload.requestSignature ?? null,
          },
        },
      }
    case 'queries/set-success':
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.payload.queryName]: {
            status: 'success',
            data: action.payload.data,
            error: null,
            requestSignature: action.payload.requestSignature ?? null,
          },
        },
      }
    case 'queries/set-error':
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.payload.queryName]: {
            ...getRuntimeQueryState(state.queries[action.payload.queryName]),
            status: 'error',
            error: action.payload.error,
            requestSignature: action.payload.requestSignature ?? null,
          },
        },
      }
    case 'queries/reset':
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.payload.queryName]: createRuntimeQueryState(),
        },
      }
    case 'modal/open':
      return {
        ...state,
        modal: {
          activeModalId: action.payload.modalId,
          activeIterationKey: action.payload.iterationKey ?? null,
        },
      }
    case 'modal/close':
      if (
        state.modal.activeModalId === action.payload.modalId &&
        state.modal.activeIterationKey === (action.payload.iterationKey ?? null)
      ) {
        return {
          ...state,
          modal: {
            activeModalId: null,
            activeIterationKey: null,
          },
        }
      }
      return state
    case 'modal/close-all':
      return {
        ...state,
        modal: {
          activeModalId: null,
          activeIterationKey: null,
        },
      }
    default:
      return state
  }
}

function initializeRuntimeForm(
  formState: RuntimeFormState | undefined,
  fields: Record<string, RuntimeFormFieldDefinition>,
): RuntimeFormState {
  return Object.entries(fields).reduce<RuntimeFormState>((nextFormState, [fieldId, fieldDefinition]) => {
    if (nextFormState[fieldId]) {
      nextFormState[fieldId] = hydrateRuntimeFormFieldState(nextFormState[fieldId], fieldDefinition.defaultValue)
      return nextFormState
    }

    return {
      ...nextFormState,
      [fieldId]: createRuntimeFormFieldState(fieldDefinition.defaultValue),
    }
  }, formState ?? {})
}

function updateRuntimeFormFieldValue(fieldState: RuntimeFormFieldState | undefined, value: unknown): RuntimeFormFieldState {
  const nextFieldState = getRuntimeFormFieldState(fieldState)

  return {
    ...nextFieldState,
    value,
    touched: true,
    dirty: !Object.is(value, nextFieldState.defaultValue),
  }
}

function resetRuntimeForm(formState: RuntimeFormState | undefined): RuntimeFormState {
  if (!formState) {
    return {}
  }

  return Object.entries(formState).reduce<RuntimeFormState>((nextFormState, [fieldId, fieldState]) => {
    nextFormState[fieldId] = createRuntimeFormFieldState(fieldState.defaultValue)
    return nextFormState
  }, {})
}

function removeRuntimeForm(formsState: RuntimeState['forms'], formId: string): RuntimeState['forms'] {
  if (!Object.hasOwn(formsState, formId)) {
    return formsState
  }

  const nextFormsState = { ...formsState }
  delete nextFormsState[formId]
  return nextFormsState
}

function getRuntimeFormFieldState(fieldState: RuntimeFormFieldState | undefined, defaultValue?: unknown): RuntimeFormFieldState {
  return fieldState ?? createRuntimeFormFieldState(defaultValue)
}

function hydrateRuntimeFormFieldState(
  fieldState: RuntimeFormFieldState,
  defaultValue: unknown,
): RuntimeFormFieldState {
  if (shouldRefreshPristinePlaceholderDefault(fieldState, defaultValue)) {
    return createRuntimeFormFieldState(defaultValue)
  }

  if (
    typeof fieldState.value !== 'undefined' ||
    typeof fieldState.defaultValue !== 'undefined' ||
    fieldState.touched ||
    fieldState.dirty
  ) {
    return fieldState
  }

  return {
    ...fieldState,
    value: defaultValue,
    defaultValue,
  }
}

function createRuntimeFormFieldState(defaultValue: unknown): RuntimeFormFieldState {
  return {
    value: defaultValue,
    error: null,
    touched: false,
    dirty: false,
    defaultValue,
  }
}

function shouldRefreshPristinePlaceholderDefault(
  fieldState: RuntimeFormFieldState,
  nextDefaultValue: unknown,
) {
  if (fieldState.touched || fieldState.dirty || fieldState.error !== null) {
    return false
  }

  if (!areRuntimeFormValuesEqual(fieldState.value, fieldState.defaultValue)) {
    return false
  }

  if (!isPlaceholderDefaultValue(fieldState.defaultValue)) {
    return false
  }

  return !areRuntimeFormValuesEqual(fieldState.defaultValue, nextDefaultValue)
}

function isPlaceholderDefaultValue(value: unknown) {
  if (value === '' || typeof value === 'undefined') {
    return true
  }

  return Array.isArray(value) && value.length === 0
}

function areRuntimeFormValuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false
    }

    return left.every((item, index) => Object.is(item, right[index]))
  }

  return Object.is(left, right)
}

function getRuntimeQueryState(queryState: RuntimeQueryState | undefined): RuntimeQueryState {
  return queryState ?? createRuntimeQueryState()
}

function createRuntimeQueryState(): RuntimeQueryState {
  return {
    status: 'idle',
    data: null,
    error: null,
    requestSignature: null,
  }
}

function resetQueriesForPreloadBatch(
  queriesState: RuntimeState['queries'],
  preloadQueries: Array<{ queryName: string; requestSignature: string | null }>,
): RuntimeState['queries'] {
  if (preloadQueries.length === 0) {
    return queriesState
  }

  const nextQueriesState = { ...queriesState }

  for (const preloadQuery of preloadQueries) {
    nextQueriesState[preloadQuery.queryName] = {
      status: 'loading',
      data: null,
      error: null,
      requestSignature: preloadQuery.requestSignature,
    }
  }

  return nextQueriesState
}

function createRuntimePageEntryState(pageEntryState: RuntimePageEntryState): RuntimePageEntryState {
  return {
    entryId: pageEntryState.entryId,
    pageId: pageEntryState.pageId,
    params: { ...pageEntryState.params },
    preloadNames: [...pageEntryState.preloadNames],
    status: pageEntryState.status,
  }
}

function createNavigationHistoryEntry(
  entryId: number,
  pageId: string,
  params: RuntimePageParams | undefined,
): RuntimeNavigationHistoryEntry {
  return {
    entryId,
    pageId,
    params: { ...(params ?? {}) },
  }
}

function getNextNavigationEntryId(history: RuntimeNavigationHistoryEntry[]) {
  return Math.max(-1, ...history.map((entry) => entry.entryId)) + 1
}

function isSameNavigationEntry(
  currentEntry: RuntimeNavigationHistoryEntry | undefined,
  pageId: string,
  params: RuntimePageParams | undefined,
) {
  if (!currentEntry || currentEntry.pageId !== pageId) {
    return false
  }

  return arePageParamsEqual(currentEntry.params, params ?? {})
}

function synchronizeNavigationWithEntry(
  state: RuntimeState,
  pageId: string,
  params: RuntimePageParams | undefined,
): RuntimeState {
  const nextParams = { ...(params ?? {}) }
  const currentEntry = state.navigation.history[state.navigation.currentEntryIndex]

  if (isSameNavigationEntry(currentEntry, pageId, nextParams)) {
    return {
      ...state,
      navigation: {
        ...state.navigation,
        lastError: null,
      },
    }
  }

  const matchingEntryIndex = state.navigation.history.findIndex((entry) =>
    isSameNavigationEntry(entry, pageId, nextParams),
  )

  if (matchingEntryIndex >= 0) {
    const matchingEntry = state.navigation.history[matchingEntryIndex]

    return {
      ...state,
      navigation: {
        currentPageId: matchingEntry.pageId,
        history: state.navigation.history,
        currentEntryIndex: matchingEntryIndex,
        lastError: null,
      },
    }
  }

  const nextEntry = createNavigationHistoryEntry(
    getNextNavigationEntryId(state.navigation.history),
    pageId,
    nextParams,
  )
  const nextHistory = [...state.navigation.history.slice(0, state.navigation.currentEntryIndex + 1), nextEntry]

  return {
    ...state,
    navigation: {
      currentPageId: nextEntry.pageId,
      history: nextHistory,
      currentEntryIndex: nextHistory.length - 1,
      lastError: null,
    },
  }
}

function appendNavigationEntry(
  state: RuntimeState,
  pageId: string,
  params: RuntimePageParams | undefined,
): RuntimeState {
  const nextParams = { ...(params ?? {}) }
  const currentEntry = state.navigation.history[state.navigation.currentEntryIndex]

  if (isSameNavigationEntry(currentEntry, pageId, nextParams)) {
    return {
      ...state,
      navigation: {
        ...state.navigation,
        lastError: null,
      },
    }
  }

  const nextEntry = createNavigationHistoryEntry(
    getNextNavigationEntryId(state.navigation.history),
    pageId,
    nextParams,
  )
  const nextHistory = [...state.navigation.history.slice(0, state.navigation.currentEntryIndex + 1), nextEntry]

  return {
    ...state,
    navigation: {
      currentPageId: nextEntry.pageId,
      history: nextHistory,
      currentEntryIndex: nextHistory.length - 1,
      lastError: null,
    },
  }
}

function arePageParamsEqual(left: RuntimePageParams, right: RuntimePageParams) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) {
      return false
    }
  }

  return true
}
