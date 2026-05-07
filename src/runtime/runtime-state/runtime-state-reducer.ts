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

export function createRuntimeState(config: RuntimeConfig): RuntimeState {
  const initialPage = config.pages.find((page) => page.id === config.initialPage)

  return {
    navigation: {
      currentPageId: config.initialPage,
      history: [
        {
          entryId: 0,
          pageId: config.initialPage,
          params: {},
        },
      ],
      lastError: null,
    },
    forms: {},
    queries: {},
    pageEntry: createRuntimePageEntryState({
      entryId: 0,
      pageId: config.initialPage,
      params: {},
      preloadNames: initialPage?.preloads ?? [],
      status: 'idle',
    }),
  }
}

export function runtimeStateReducer(state: RuntimeState, action: RuntimeStateAction): RuntimeState {
  switch (action.type) {
    case 'runtime/reset':
      return action.payload.state
    case 'navigation/navigate':
      if (isSameNavigationEntry(state.navigation.history[state.navigation.history.length - 1], action.payload.pageId, action.payload.params)) {
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
        action.payload.pageId,
        action.payload.params,
      )

      return {
        ...state,
        navigation: {
          currentPageId: nextEntry.pageId,
          history: [...state.navigation.history, nextEntry],
          lastError: null,
        },
      }
    case 'navigation/go-back': {
      if (state.navigation.history.length < 2) {
        return {
          ...state,
          navigation: {
            ...state.navigation,
            lastError: null,
          },
        }
      }

      const nextHistory = state.navigation.history.slice(0, -1)
      const previousEntry = nextHistory[nextHistory.length - 1]

      return {
        ...state,
        navigation: {
          currentPageId: previousEntry.pageId,
          history: nextHistory,
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

function getRuntimeFormFieldState(fieldState: RuntimeFormFieldState | undefined, defaultValue?: unknown): RuntimeFormFieldState {
  return fieldState ?? createRuntimeFormFieldState(defaultValue)
}

function hydrateRuntimeFormFieldState(
  fieldState: RuntimeFormFieldState,
  defaultValue: unknown,
): RuntimeFormFieldState {
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

function getRuntimeQueryState(queryState: RuntimeQueryState | undefined): RuntimeQueryState {
  return queryState ?? createRuntimeQueryState()
}

function createRuntimeQueryState(): RuntimeQueryState {
  return {
    status: 'idle',
    data: null,
    error: null,
  }
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
  return (history[history.length - 1]?.entryId ?? -1) + 1
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
