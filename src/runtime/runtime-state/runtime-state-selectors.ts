import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from './runtime-state-types'

export function selectNavigationState(state: RuntimeState) {
  return state.navigation
}

export function selectFormsState(state: RuntimeState) {
  return state.forms
}

export function selectQueriesState(state: RuntimeState) {
  return state.queries
}

export function selectCurrentPageId(state: RuntimeState) {
  return state.navigation.currentPageId
}

export function selectCurrentPage(config: RuntimeConfig, state: RuntimeState) {
  return config.pages.find((page) => page.id === state.navigation.currentPageId) ?? null
}

export function selectFormState(state: RuntimeState, formId: string) {
  return state.forms[formId] ?? null
}

export function selectFormFieldState(state: RuntimeState, formId: string, fieldId: string) {
  return state.forms[formId]?.[fieldId] ?? null
}

export function selectFormFieldValue(state: RuntimeState, formId: string, fieldId: string) {
  return selectFormFieldState(state, formId, fieldId)?.value
}

export function selectQueryState(state: RuntimeState, queryName: string) {
  return state.queries[queryName] ?? null
}

export function selectQueryReferenceValue(
  state: RuntimeState,
  queryName: string,
  property?: 'data' | 'status' | 'error',
) {
  const queryState = selectQueryState(state, queryName)

  if (queryState === null) {
    return undefined
  }

  if (!property) {
    return queryState
  }

  return queryState[property]
}
