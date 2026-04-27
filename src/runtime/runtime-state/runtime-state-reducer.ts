import type { RuntimeConfig } from '../../config/runtime-config'
import type {
  RuntimeFormFieldDefinition,
  RuntimeFormFieldState,
  RuntimeFormState,
  RuntimeQueryState,
  RuntimeState,
  RuntimeStateAction,
} from './runtime-state-types'

export function createRuntimeState(config: RuntimeConfig): RuntimeState {
  return {
    navigation: {
      currentPageId: config.initialPage,
      history: [config.initialPage],
      lastError: null,
    },
    forms: {},
    queries: {},
  }
}

export function runtimeStateReducer(state: RuntimeState, action: RuntimeStateAction): RuntimeState {
  switch (action.type) {
    case 'runtime/reset':
      return action.payload.state
    case 'navigation/navigate':
      if (state.navigation.currentPageId === action.payload.pageId) {
        return {
          ...state,
          navigation: {
            ...state.navigation,
            lastError: null,
          },
        }
      }

      return {
        ...state,
        navigation: {
          currentPageId: action.payload.pageId,
          history: [...state.navigation.history, action.payload.pageId],
          lastError: null,
        },
      }
    case 'navigation/set-error':
      return {
        ...state,
        navigation: {
          ...state.navigation,
          lastError: action.payload.error,
        },
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
              ...getRuntimeFormFieldState(state.forms[action.payload.formId]?.[action.payload.fieldId]),
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

function getRuntimeFormFieldState(fieldState: RuntimeFormFieldState | undefined): RuntimeFormFieldState {
  return fieldState ?? createRuntimeFormFieldState(undefined)
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
