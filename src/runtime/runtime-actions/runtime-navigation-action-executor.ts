import type { ButtonAction } from '../../config/runtime-config'
import { executeRuntimeUiAction } from './runtime-ui-action-executor'

export interface RuntimeNavigationActionHandler {
  goBackPage: () => void
  navigateToPage: (pageId: string) => void
}

export function executeRuntimeNavigationAction(
  action: ButtonAction,
  handlers: RuntimeNavigationActionHandler,
) {
  executeRuntimeUiAction(action, {
    executeQueryOperation: async () => undefined,
    goBackPage: handlers.goBackPage,
    navigateToPage: handlers.navigateToPage,
    resetForm: () => undefined,
  })
}
