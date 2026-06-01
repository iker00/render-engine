import type { RuntimeConfig } from '../../config/runtime-config'
import { deriveQueryVisibleState } from '../runtime-query-state-feedback'
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

export function selectPageEntryState(state: RuntimeState) {
  return state.pageEntry
}

export function selectCurrentNavigationEntry(state: RuntimeState) {
  return state.navigation.history[state.navigation.currentEntryIndex] ?? null
}

export function selectCurrentPageId(state: RuntimeState) {
  return state.navigation.currentPageId
}

export function selectCurrentPageParams(state: RuntimeState) {
  return selectCurrentNavigationEntry(state)?.params ?? {}
}

export function selectPageEntryStatus(state: RuntimeState) {
  return state.pageEntry.status
}

export function selectCurrentPage(config: RuntimeConfig, state: RuntimeState) {
  return config.pages.find((page) => page.id === state.pageEntry.pageId) ?? null
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

export function selectQueryRequestSignature(state: RuntimeState, queryName: string) {
  return selectQueryState(state, queryName)?.requestSignature ?? null
}

export function selectQueryVisibleState(state: RuntimeState, queryName: string) {
  return deriveQueryVisibleState(selectQueryState(state, queryName))
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

export function selectNestedQueryDataValue(state: RuntimeState, queryName: string, path: string[]) {
  const queryState = selectQueryState(state, queryName)

  if (queryState === null) {
    return {
      found: false,
    } as const
  }

  let currentValue = queryState.data

  for (const segment of path) {
    if (currentValue == null) {
      return {
        found: false,
      } as const
    }

    if (Array.isArray(currentValue)) {
      if (!isArrayIndexSegment(segment)) {
        return {
          found: false,
        } as const
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return {
          found: false,
        } as const
      }

      continue
    }

    if (typeof currentValue !== 'object') {
      return {
        found: false,
      } as const
    }

    const objectValue = currentValue as Record<string, unknown>

    if (!Object.hasOwn(objectValue, segment)) {
      return {
        found: false,
      } as const
    }

    currentValue = objectValue[segment]
  }

  return {
    found: true,
    value: currentValue,
  } as const
}

export function selectActiveModal(state: RuntimeState) {
  return state.modal ?? { activeModalId: null, activeIterationKey: null }
}

export function isModalOpen(state: RuntimeState, modalId: string, iterationKey?: string): boolean {
  const modal = state.modal
  if (modal == null) return false
  return (
    modal.activeModalId === modalId &&
    modal.activeIterationKey === (iterationKey ?? null)
  )
}

function isArrayIndexSegment(segment: string) {
  return /^(0|[1-9]\d*)$/.test(segment)
}
