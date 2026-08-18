import { useLayoutEffect, useRef } from 'react'
import { selectCurrentNavigationEntry, selectPageEntryState } from './runtime-state/runtime-state-selectors'
import { useRuntimeState } from './runtime-state/use-runtime-state'

export function RuntimeScrollRestorationEffect() {
  const state = useRuntimeState()
  const entryId = selectCurrentNavigationEntry(state)?.entryId ?? null
  const pageEntry = selectPageEntryState(state)
  const scrollPositionsByEntryIdRef = useRef<Map<number, number>>(new Map())

  useLayoutEffect(() => {
    if (entryId === null) {
      return
    }

    // A push: this entryId has never had a scroll position captured for it, regardless of
    // whether its page was visited before under a different entryId (navigateTo always creates a
    // fresh entryId unless it's a no-op). Pop restoration for an entryId already in the map is
    // handled separately.
    if (!scrollPositionsByEntryIdRef.current.has(entryId)) {
      window.scrollTo(0, 0)
    }

    return () => {
      scrollPositionsByEntryIdRef.current.set(entryId, window.scrollY)
    }
  }, [entryId])

  // A pop: this entryId already has a captured scroll position, so restore it once pageEntry has
  // caught up with this entryId. While pageEntry.status is "loading" for this entryId (a relaunched
  // preload after a signature change), the effect re-evaluates on every pageEntry change but applies
  // no position — it fires again as soon as status leaves "loading".
  useLayoutEffect(() => {
    if (entryId === null || pageEntry.entryId !== entryId || pageEntry.status === 'loading') {
      return
    }

    const savedScrollPosition = scrollPositionsByEntryIdRef.current.get(entryId)

    if (savedScrollPosition === undefined) {
      return
    }

    window.scrollTo(0, savedScrollPosition)
  }, [entryId, pageEntry.entryId, pageEntry.status])

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration

    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  return null
}
