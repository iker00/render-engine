import { useLayoutEffect, useRef } from 'react'
import { selectCurrentNavigationEntry, selectPageEntryState } from './runtime-state/runtime-state-selectors'
import { useRuntimeState } from './runtime-state/use-runtime-state'

export function RuntimeScrollRestorationEffect() {
  const state = useRuntimeState()
  const entryId = selectCurrentNavigationEntry(state)?.entryId ?? null
  const pageEntry = selectPageEntryState(state)
  const scrollPositionsByEntryIdRef = useRef<Map<number, number>>(new Map())
  // The last entryId this effect actually restored (or attempted to restore) a position for.
  // Distinguishes "this entryId just became active" (worth restoring for) from "pageEntry.status
  // merely changed again while entryId stayed the same" — the latter legitimately happens whenever
  // something re-triggers this same page's preloads without a real navigation (e.g. the dev-mode
  // editor migrating runtime state across a config edit always rebuilds pageEntry from scratch,
  // cycling status back through "idle"/"loading" to "success" for the page already on screen).
  // Without this guard, every such re-trigger re-runs the restore below and yanks the scroll
  // position back to whatever was captured the first time this entryId was left — even if the user
  // has scrolled since and never actually navigated away.
  const restoredForEntryIdRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (entryId === null) {
      return
    }

    // A push: this entryId has never had a scroll position captured for it, regardless of
    // whether its page was visited before under a different entryId (navigateTo always creates a
    // fresh entryId unless it's a no-op). Pop restoration for an entryId already in the map is
    // handled separately.
    const scrollPositionsByEntryId = scrollPositionsByEntryIdRef.current

    if (!scrollPositionsByEntryId.has(entryId)) {
      window.scrollTo(0, 0)
    }

    return () => {
      scrollPositionsByEntryId.set(entryId, window.scrollY)
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

    if (restoredForEntryIdRef.current === entryId) {
      return
    }
    restoredForEntryIdRef.current = entryId

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
