import { createBrowserHashNavigationHash } from '../runtime-navigation/browser-hash-navigation'
import type { GoBackRuntimeUiAction, NavigateToRuntimeUiAction } from '../../config/runtime-config'
import type { RuntimeNavigationState } from '../runtime-state/runtime-state-types'

type LinkAction = NavigateToRuntimeUiAction | GoBackRuntimeUiAction

/**
 * Pure helper that resolves the decorative `href` attribute for a `<a>` rendered
 * by a `link` node when `props.action` is declared.
 *
 * For `navigateTo`: always returns `#/{pageId}` as a literal — no normalization
 * to `#/` even when `pageId` equals `initialPageId`.
 *
 * For `goBack`: resolves the previous history entry using the canonical hash
 * function. Falls back to `"#"` when there is no previous entry.
 */
export function resolveLinkActionHref(
  action: LinkAction,
  navigation: RuntimeNavigationState,
  initialPageId: string,
): string {
  if (action.type === 'navigateTo') {
    return `#/${action.pageId}`
  }

  // goBack
  const previousIndex = navigation.currentEntryIndex - 1

  if (previousIndex < 0) {
    return '#'
  }

  const previousEntry = navigation.history[previousIndex]

  if (previousEntry == null) {
    return '#'
  }

  return createBrowserHashNavigationHash(
    { pageId: previousEntry.pageId, params: previousEntry.params },
    { initialPageId },
  )
}
