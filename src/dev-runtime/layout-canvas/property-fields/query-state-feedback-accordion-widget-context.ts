import { createContext, useContext } from 'react'
import type { QueryStateFeedbackVisibleState } from '../../../config/runtime-config'

// T2 (0135): ephemeral UI state the `query-state-feedback-accordion` widget needs to survive a
// tab change within the same node — never part of the config itself, which the widget keeps
// reading/writing through its own `value`/`onChange` props like any other `WIDGET_REGISTRY` entry
// (unlike `layout-span`, whose context also carries the commit channel). T3 hosts this state for
// real in `LayoutCanvasPropertiesPanel`; this module only declares the contract and the consumer
// hook.
//
// `fallbackCacheByState` preserves each row's last-known `fallback` array across a Mostrar/Ocultar
// detour (FR6): switching a row away from `Fallback` and back must restore the exact same array
// reference rather than resetting to `[]`, and the widget's tabpanel unmounts on every tab switch,
// so this can't live in the widget's own state.
export interface QueryStateFeedbackAccordionWidgetContextValue {
  fallbackCacheByState: Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>
  // Called every time a row switches to `Fallback` mode, with the array that transition just
  // committed. Idempotent when that array is already the cached one for that state.
  onFallbackCacheCommit: (state: QueryStateFeedbackVisibleState, fallback: unknown[]) => void
  expandedStates: ReadonlySet<QueryStateFeedbackVisibleState>
  // Not a plain toggle: the widget needs to force `true` when adding a new row (regardless of any
  // stale entry left over from a previously removed row with the same key) and to flip the current
  // value when the header of an already-present row is pressed.
  onSetExpanded: (state: QueryStateFeedbackVisibleState, expanded: boolean) => void
}

export const QueryStateFeedbackAccordionWidgetContext =
  createContext<QueryStateFeedbackAccordionWidgetContextValue | null>(null)

// Deliberately throws rather than returning `null`/a default: this widget can only ever be
// mounted inside the provider `LayoutCanvasPropertiesPanel` hosts for it (T3). Any other mount
// point is a wiring bug, and failing loudly in tests/dev surfaces it immediately instead of
// rendering a silently broken widget — same criterion as `useLayoutSpanWidgetContext`.
export function useQueryStateFeedbackAccordionWidgetContext(): QueryStateFeedbackAccordionWidgetContextValue {
  const context = useContext(QueryStateFeedbackAccordionWidgetContext)
  if (context === null) {
    throw new Error(
      'useQueryStateFeedbackAccordionWidgetContext must be used within QueryStateFeedbackAccordionWidgetContext.Provider — the query-state-feedback-accordion widget was mounted outside its host.',
    )
  }
  return context
}
