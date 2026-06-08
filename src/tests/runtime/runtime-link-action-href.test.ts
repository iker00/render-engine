import { describe, expect, it } from 'vitest'
import { resolveLinkActionHref } from '../../runtime/nodes/link-action-href'
import type { RuntimeNavigationState } from '../../runtime/runtime-state/runtime-state-types'

function makeNavigation(overrides?: Partial<RuntimeNavigationState>): RuntimeNavigationState {
  return {
    currentPageId: 'home',
    history: [{ entryId: 0, pageId: 'home', params: {} }],
    currentEntryIndex: 0,
    lastError: null,
    ...overrides,
  }
}

describe('resolveLinkActionHref', () => {
  describe('navigateTo', () => {
    it('returns #/{pageId} when pageId is different from initialPage', () => {
      const action = { type: 'navigateTo' as const, pageId: 'dashboard' }
      const navigation = makeNavigation()

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#/dashboard')
    })

    it('returns #/{initialPageId} literal when pageId equals initialPage (does NOT normalize to #/)', () => {
      const action = { type: 'navigateTo' as const, pageId: 'home' }
      const navigation = makeNavigation()

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#/home')
    })

    it('ignores any action params and returns only the page hash without query string', () => {
      const action = {
        type: 'navigateTo' as const,
        pageId: 'dashboard',
        params: { tab: 'settings', mode: 'edit' },
      }
      const navigation = makeNavigation()

      const result = resolveLinkActionHref(action, navigation, 'home')
      expect(result).toBe('#/dashboard')
      expect(result).not.toContain('?')
    })
  })

  describe('goBack', () => {
    it('returns "#" when currentEntryIndex is 0 (initial entry, no previous)', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentEntryIndex: 0,
        history: [{ entryId: 0, pageId: 'home', params: {} }],
      })

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#')
    })

    it('returns "#" when currentEntryIndex is negative (guard case)', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentEntryIndex: -1,
        history: [],
      })

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#')
    })

    it('returns "#" when history entry at currentEntryIndex - 1 is undefined', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentEntryIndex: 3,
        history: [{ entryId: 0, pageId: 'home', params: {} }],
      })

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#')
    })

    it('returns #/{previousPageId} when previous entry pageId is different from initialPage', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentPageId: 'details',
        currentEntryIndex: 1,
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: {} },
        ],
      })

      expect(resolveLinkActionHref(action, navigation, 'details')).toBe('#/home')
    })

    it('returns #/ when previous entry pageId coincides with initialPage (canonical home)', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentPageId: 'dashboard',
        currentEntryIndex: 1,
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'dashboard', params: {} },
        ],
      })

      expect(resolveLinkActionHref(action, navigation, 'home')).toBe('#/')
    })

    it('returns a hash with query string when previous entry has scalar params', () => {
      const action = { type: 'goBack' as const }
      const navigation = makeNavigation({
        currentPageId: 'details',
        currentEntryIndex: 1,
        history: [
          { entryId: 0, pageId: 'search', params: { tab: 'users', page: '2' } },
          { entryId: 1, pageId: 'details', params: {} },
        ],
      })

      const result = resolveLinkActionHref(action, navigation, 'home')
      // params are alphabetically ordered per createBrowserHashNavigationHash contract
      expect(result).toBe('#/search?page=2&tab=users')
    })
  })
})
