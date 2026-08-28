import type { ButtonAction, NavigateToRuntimeUiAction } from '../../config/runtime-config'
import { executeRuntimeUiAction } from './runtime-ui-action-executor'

export interface RuntimeNavigationActionHandler {
  goBackPage: () => void
  navigateToPage: (pageId: string, params?: NavigateToRuntimeUiAction['params']) => void
}

export function executeRuntimeNavigationAction(
  action: ButtonAction,
  handlers: RuntimeNavigationActionHandler,
) {
  executeRuntimeUiAction(action, {
    executeQueryOperation: async () => undefined,
    executeDownloadOperation: async () => ({ status: 'skipped' as const }),
    goBackPage: handlers.goBackPage,
    navigateToPage: handlers.navigateToPage,
    resetForm: () => undefined,
    openModal: () => undefined,
    closeModal: () => undefined,
  })
}
