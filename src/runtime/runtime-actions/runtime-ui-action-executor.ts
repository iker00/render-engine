import type {
  NavigateToRuntimeUiAction,
  RuntimeApiRequestParams,
  RuntimeUiAction,
  RuntimeUiActionListEntry,
} from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeState } from '../runtime-state/runtime-state-types'

export interface RuntimeUiActionHandlers {
  executeQueryOperation: (
    operationName: string,
    options?: { requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext },
  ) => Promise<unknown>
  goBackPage: () => void
  navigateToPage: (
    pageId: string,
    params?: NavigateToRuntimeUiAction['params'],
    options?: { iterationContext?: RuntimeIterationContext },
  ) => void
  openModal: (modalId: string, options?: { iterationContext?: RuntimeIterationContext }) => void
  closeModal: (modalId: string, options?: { iterationContext?: RuntimeIterationContext }) => void
  resetForm: (formId: string) => void
}

export function executeRuntimeUiAction(
  action: RuntimeUiAction,
  handlers: RuntimeUiActionHandlers,
  options?: { state?: RuntimeState; iterationContext?: RuntimeIterationContext },
) {
  switch (action.type) {
    case 'navigateTo':
      handlers.navigateToPage(action.pageId, action.params, {
        iterationContext: options?.iterationContext,
      })
      return
    case 'goBack':
      handlers.goBackPage()
      return
    case 'executeOperation':
      void handlers.executeQueryOperation(action.operationName, {
        requestParams: {
          query: action.query,
          body: action.body,
          headers: action.headers,
        },
        iterationContext: options?.iterationContext,
      })
      return
    case 'executeOperations':
      for (const entry of action.operations) {
        if (options?.state && !matchesVisibilityRule(entry.when, options.state, options.iterationContext)) {
          continue
        }
        void handlers.executeQueryOperation(entry.operationName, {
          requestParams: {
            query: entry.query,
            body: entry.body,
            headers: entry.headers,
          },
          iterationContext: options?.iterationContext,
        })
      }
      return
    case 'openModal':
      handlers.openModal(action.modalId, { iterationContext: options?.iterationContext })
      return
    case 'closeModal':
      handlers.closeModal(action.modalId, { iterationContext: options?.iterationContext })
      return
    case 'resetForm':
      handlers.resetForm(action.formId)
      return
  }
}

export function runRuntimeUiActionLifecycleList(
  actions: RuntimeUiActionListEntry[] | undefined,
  handlers: RuntimeUiActionHandlers,
  readState: () => RuntimeState,
  iterationContext?: RuntimeIterationContext,
) {
  if (!actions || actions.length === 0) {
    return
  }

  for (const action of actions) {
    const snapshot = readState()

    if (!matchesVisibilityRule(action.when, snapshot, iterationContext)) {
      continue
    }

    // Strip 'when' before passing to executor since RuntimeUiAction doesn't have 'when'
    const { when: _when, ...baseAction } = action as RuntimeUiActionListEntry & { when?: unknown }
    executeRuntimeUiAction(baseAction as Parameters<typeof executeRuntimeUiAction>[0], handlers, {
      state: snapshot,
      iterationContext,
    })
  }
}
