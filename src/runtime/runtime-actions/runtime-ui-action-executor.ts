import type { RuntimeApiRequestParams, RuntimeUiAction } from '../../config/runtime-config'

export interface RuntimeUiActionHandlers {
  executeQueryOperation: (operationName: string, options?: { requestParams?: RuntimeApiRequestParams }) => Promise<unknown>
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
      void handlers.executeQueryOperation(action.operationName, {
        requestParams: {
          query: action.query,
          body: action.body,
          headers: action.headers,
        },
      })
      return
    case 'resetForm':
      handlers.resetForm(action.formId)
      return
  }
}
