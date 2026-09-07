import type { RuntimeConfig } from '../../config/runtime-config'
import { deriveQueryVisibleState } from '../runtime-query-state-feedback'
import { deriveScopedStateKey, EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
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

/**
 * Scope-chain-aware form field value lookup (T05 / feature reusable-node-groups): composes the
 * effective store key from `formId` + `scope` before delegating to the raw, scope-agnostic
 * `selectFormFieldValue`. An empty scope produces the exact same key as before (`formId`
 * literal), so callers that never pass a scope keep reading the same value (cero regresión).
 */
export function getFormFieldValue(
  state: RuntimeState,
  formId: string,
  fieldId: string,
  scope: RuntimeInstanceScope = EMPTY_INSTANCE_SCOPE,
): unknown {
  return selectFormFieldValue(state, deriveScopedStateKey(formId, scope), fieldId)
}

/**
 * Scope-chain-aware form field error lookup (T05), mirroring `getFormFieldValue`.
 */
export function getFormFieldError(
  state: RuntimeState,
  formId: string,
  fieldId: string,
  scope: RuntimeInstanceScope = EMPTY_INSTANCE_SCOPE,
): string | null {
  return selectFormFieldState(state, deriveScopedStateKey(formId, scope), fieldId)?.error ?? null
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

export function isModalOpen(state: RuntimeState, modalId: string, scope: RuntimeInstanceScope = []): boolean {
  const modal = state.modal
  if (modal == null) return false
  return modal.activeModalId === modalId && modal.activeIterationKey === deriveModalScopeIterationKey(scope)
}

/**
 * Collapses a `RuntimeInstanceScope` into the flat string stored as `RuntimeModalState.activeIterationKey`.
 *
 * A 0-token scope (page-level modal) yields `null`, and a 1-token scope yields the bare
 * repeater key — exactly the pre-existing single-level representation, so `openModal`/`closeModal`
 * keep dispatching the same effective store key as before for those two cases (cero regresión).
 * A scope with 2+ tokens (nested repeaters) composes every ancestor token into a single unique
 * string so that iterations that share the same innermost key (e.g. two different outer groups
 * both containing an inner row keyed "1") never collide.
 */
export function deriveModalScopeIterationKey(scope: RuntimeInstanceScope): string | null {
  if (scope.length === 0) {
    return null
  }

  if (scope.length === 1) {
    const [token] = scope
    return token.kind === 'repeater' ? token.key : token.token
  }

  return scope.map((token) => (token.kind === 'repeater' ? `r:${token.key}` : `g:${token.token}`)).join('::')
}

const MODAL_SCOPE_KEY_SEGMENT_SEPARATOR = '::'

/**
 * True when `iterationKey` was derived from a scope chain with 2+ tokens (nested repeaters).
 *
 * A single `repeater` only ever knows its *own* bare iteration keys, so it can only safely
 * compare its D3 auto-close-on-refresh check (see `RepeaterNode`) against a 1-token scope key
 * (cero regresión). A composed key belongs to a chain this repeater alone can't resolve; it
 * should leave that instance alone rather than mismatch it and force-close it.
 */
export function isComposedModalScopeKey(iterationKey: string): boolean {
  return iterationKey.includes(MODAL_SCOPE_KEY_SEGMENT_SEPARATOR)
}

function isArrayIndexSegment(segment: string) {
  return /^(0|[1-9]\d*)$/.test(segment)
}
