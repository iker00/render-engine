import type { ButtonAction } from '../../config/runtime-config'

export interface RuntimeNavigationActionHandler {
  goBackPage: () => void
  navigateToPage: (pageId: string) => void
}

export function executeRuntimeNavigationAction(
  action: ButtonAction,
  handlers: RuntimeNavigationActionHandler,
) {
  if (action.type === 'goBack') {
    handlers.goBackPage()
    return
  }

  handlers.navigateToPage(action.pageId)
}
