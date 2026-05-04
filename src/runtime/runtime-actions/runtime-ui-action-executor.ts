import type { RuntimeUiAction } from '../../config/runtime-config'

export interface RuntimeUiActionHandlers {
  executeQueryOperation: (operationName: string) => Promise<unknown>
  goBackPage: () => void
  navigateToPage: (pageId: string) => void
  resetForm: (formId: string) => void
}

export function executeRuntimeUiAction(action: RuntimeUiAction, handlers: RuntimeUiActionHandlers) {
  switch (action.type) {
    case 'navigateTo':
      handlers.navigateToPage(action.pageId)
      return
    case 'goBack':
      handlers.goBackPage()
      return
    case 'executeOperation':
      void handlers.executeQueryOperation(action.operationName)
      return
    case 'resetForm':
      handlers.resetForm(action.formId)
      return
  }
}
