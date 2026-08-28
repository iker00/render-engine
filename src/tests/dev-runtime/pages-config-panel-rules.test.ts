import { describe, expect, it } from 'vitest'
import type { RuntimePageConfig } from '../../config/runtime-config-types'
import {
  getPageDeleteBlockedReason,
  isDuplicatePageId,
  normalizePageId,
} from '../../dev-runtime/pages-config-panel/pages-config-panel-rules'

function buildPage(id: string): RuntimePageConfig {
  return { id, layout: [] }
}

describe('normalizePageId', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizePageId('  home  ')).toBe('home')
  })

  it('preserves internal whitespace', () => {
    expect(normalizePageId('  home page  ')).toBe('home page')
  })

  it('normalizes a value made only of whitespace to an empty string', () => {
    expect(normalizePageId('   ')).toBe('')
  })
})

describe('isDuplicatePageId', () => {
  const pages = [buildPage('home'), buildPage('settings')]

  it('returns true for an exact match', () => {
    expect(isDuplicatePageId('home', pages)).toBe(true)
  })

  it('returns false for a case-only variant', () => {
    expect(isDuplicatePageId('Home', pages)).toBe(false)
  })

  it('returns false for an id not present in pages', () => {
    expect(isDuplicatePageId('missing', pages)).toBe(false)
  })

  it('returns false for an empty normalized id', () => {
    expect(isDuplicatePageId('', pages)).toBe(false)
  })
})

describe('getPageDeleteBlockedReason', () => {
  it('returns a non-null reason when there is only one page, regardless of whether it is the initial page', () => {
    const pages = [buildPage('home')]

    expect(getPageDeleteBlockedReason('home', pages, 'settings')).not.toBeNull()
  })

  it('returns the "only remaining page" reason with priority over the "initial page" reason when both apply', () => {
    const pages = [buildPage('home')]

    const onlyPageReason = getPageDeleteBlockedReason('home', pages, 'home')
    const initialPageOnlyReason = getPageDeleteBlockedReason('home', pages, 'other')

    expect(onlyPageReason).not.toBeNull()
    expect(onlyPageReason).toBe(initialPageOnlyReason)
  })

  it('returns a non-null reason when pageId is the initial page and there is more than one page', () => {
    const pages = [buildPage('home'), buildPage('settings')]

    expect(getPageDeleteBlockedReason('home', pages, 'home')).not.toBeNull()
  })

  it('returns null when there is more than one page and pageId is not the initial page', () => {
    const pages = [buildPage('home'), buildPage('settings')]

    expect(getPageDeleteBlockedReason('settings', pages, 'home')).toBeNull()
  })
})
