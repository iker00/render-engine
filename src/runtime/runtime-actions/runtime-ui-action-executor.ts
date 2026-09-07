import type {
  NavigateToRuntimeUiAction,
  RuntimeApiRequestParams,
  RuntimeUiAction,
  RuntimeUiActionListEntry,
} from '../../config/runtime-config'
import type { RuntimeApiDownloadResult } from '../../queries/runtime-api-download-types'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import type { RuntimeState } from '../runtime-state/runtime-state-types'

export interface RuntimeUiActionHandlers {
  executeQueryOperation: (
    operationName: string,
    options?: { requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext },
  ) => Promise<unknown>
  executeDownloadOperation: (
    operationName: string,
    options?: { requestParams?: RuntimeApiRequestParams; iterationContext?: RuntimeIterationContext },
  ) => Promise<RuntimeApiDownloadResult | { status: 'skipped' }>
  goBackPage: () => void
  navigateToPage: (
    pageId: string,
    params?: NavigateToRuntimeUiAction['params'],
    options?: { iterationContext?: RuntimeIterationContext },
  ) => void
  openModal: (modalId: string, options?: { scopeChain?: RuntimeInstanceScope }) => void
  closeModal: (modalId: string, options?: { scopeChain?: RuntimeInstanceScope }) => void
  resetForm: (formId: string, options?: { scopeChain?: RuntimeInstanceScope }) => void
}

export function executeRuntimeUiAction(
  action: RuntimeUiAction,
  handlers: RuntimeUiActionHandlers,
  options?: { state?: RuntimeState; iterationContext?: RuntimeIterationContext; scopeChain?: RuntimeInstanceScope },
): Promise<unknown> | void {
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
      return handlers.executeQueryOperation(action.operationName, {
        requestParams: {
          query: action.query,
          body: action.body,
          headers: action.headers,
        },
        iterationContext: options?.iterationContext,
      })
    case 'executeOperations': {
      const pendingOperations: Promise<unknown>[] = []

      for (const entry of action.operations) {
        if (options?.state && !matchesVisibilityRule(entry.when, options.state, options.iterationContext)) {
          continue
        }
        pendingOperations.push(
          handlers.executeQueryOperation(entry.operationName, {
            requestParams: {
              query: entry.query,
              body: entry.body,
              headers: entry.headers,
            },
            iterationContext: options?.iterationContext,
          }),
        )
      }

      return Promise.all(pendingOperations)
    }
    case 'openModal':
      handlers.openModal(action.modalId, { scopeChain: options?.scopeChain })
      return
    case 'closeModal':
      handlers.closeModal(action.modalId, { scopeChain: options?.scopeChain })
      return
    case 'resetForm':
      handlers.resetForm(action.formId, { scopeChain: options?.scopeChain })
      return
  }
}

/**
 * Runs an operation, then dispatches the matching `onSuccess`/`onError`
 * lifecycle action list based on its outcome. Shared by every runtime node
 * that executes one or more operations and reacts to their result
 * (`button`, `form`, and any future node with the same shape).
 *
 * `execute` may resolve to a richer status than `'success' | 'error'` (e.g.
 * `executeQueryOperation` also resolves to `'skipped'` while in edit mode).
 * Only `'success'` and `'error'` trigger a lifecycle list; any other status
 * is a deliberate no-op, matching the pre-refactor behavior of the callers.
 */
export async function runActionOutcomeWithLifecycle<TResult extends { status: string }>(
  execute: () => Promise<TResult>,
  onSuccess: RuntimeUiActionListEntry[] | undefined,
  onError: RuntimeUiActionListEntry[] | undefined,
  handlers: RuntimeUiActionHandlers,
  readState: () => RuntimeState,
  iterationContext?: RuntimeIterationContext,
  scopeChain?: RuntimeInstanceScope,
): Promise<TResult> {
  const result = await execute()

  if (result.status === 'success') {
    await runRuntimeUiActionLifecycleList(onSuccess, handlers, readState, iterationContext, scopeChain)
  } else if (result.status === 'error') {
    await runRuntimeUiActionLifecycleList(onError, handlers, readState, iterationContext, scopeChain)
  }

  return result
}

/**
 * Runs a lifecycle action list (`onSuccess`/`onError`) sequentially: each entry's
 * asynchronous work (`executeOperation`, `executeOperations`) is awaited before the
 * next entry in the list starts. This lets a later entry's `when` observe state
 * produced by an earlier entry of the same list (e.g. `queries.<op>.status`/`.data`
 * after that operation has resolved). Synchronous entries (`navigateTo`, `goBack`,
 * `resetForm`, `openModal`, `closeModal`) don't introduce any wait of their own.
 */
export async function runRuntimeUiActionLifecycleList(
  actions: RuntimeUiActionListEntry[] | undefined,
  handlers: RuntimeUiActionHandlers,
  readState: () => RuntimeState,
  iterationContext?: RuntimeIterationContext,
  scopeChain?: RuntimeInstanceScope,
): Promise<void> {
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
    await executeRuntimeUiAction(baseAction as Parameters<typeof executeRuntimeUiAction>[0], handlers, {
      state: snapshot,
      iterationContext,
      scopeChain,
    })
  }
}
