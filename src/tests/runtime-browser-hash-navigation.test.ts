import { describe, expect, it } from 'vitest'
import {
  areBrowserHashNavigationEntriesEqual,
  createBrowserHashNavigationHash,
  parseBrowserHashNavigationHash,
} from '../runtime/runtime-navigation/browser-hash-navigation'

const knownPageIds = ['home', 'details', 'announcements']

describe('Browser hash navigation', () => {
  it('parses home and non-home hashes into normalized entries', () => {
    expect(
      parseBrowserHashNavigationHash('#/', {
        initialPageId: 'home',
        knownPageIds,
      }),
    ).toEqual({
      canonicalHash: '#/',
      entry: {
        pageId: 'home',
        params: {},
      },
      isFallback: false,
      isCanonical: true,
    })

    expect(
      parseBrowserHashNavigationHash('#/details', {
        initialPageId: 'home',
        knownPageIds,
      }),
    ).toEqual({
      canonicalHash: '#/details',
      entry: {
        pageId: 'details',
        params: {},
      },
      isFallback: false,
      isCanonical: true,
    })
  })

  it('parses query params for home and non-home pages as strings', () => {
    expect(
      parseBrowserHashNavigationHash('#/?tab=search&draft', {
        initialPageId: 'home',
        knownPageIds,
      }),
    ).toEqual({
      canonicalHash: '#/?draft=&tab=search',
      entry: {
        pageId: 'home',
        params: {
          draft: '',
          tab: 'search',
        },
      },
      isFallback: false,
      isCanonical: false,
    })

    expect(
      parseBrowserHashNavigationHash('#/announcements?featured=true&id=42', {
        initialPageId: 'home',
        knownPageIds,
      }),
    ).toEqual({
      canonicalHash: '#/announcements?featured=true&id=42',
      entry: {
        pageId: 'announcements',
        params: {
          featured: 'true',
          id: '42',
        },
      },
      isFallback: false,
      isCanonical: true,
    })
  })

  it('degrades missing hashes and invalid hashes to normalized home', () => {
    for (const hash of ['', '#', '#details', '#//details', '#/missing', '#/details/extra']) {
      expect(
        parseBrowserHashNavigationHash(hash, {
          initialPageId: 'home',
          knownPageIds,
        }),
      ).toEqual({
        canonicalHash: '#/',
        entry: {
          pageId: 'home',
          params: {},
        },
        isFallback: true,
        isCanonical: hash === '#/',
      })
    }
  })

  it('keeps the last occurrence when a key is repeated', () => {
    expect(
      parseBrowserHashNavigationHash('#/details?id=41&id=42&mode=view&mode=edit', {
        initialPageId: 'home',
        knownPageIds,
      }),
    ).toEqual({
      canonicalHash: '#/details?id=42&mode=edit',
      entry: {
        pageId: 'details',
        params: {
          id: '42',
          mode: 'edit',
        },
      },
      isFallback: false,
      isCanonical: false,
    })
  })

  it('serializes canonical hashes and omits null or non-scalar params', () => {
    expect(
      createBrowserHashNavigationHash(
        {
          pageId: 'home',
          params: {
            mode: 'edit',
            empty: null,
            page: 2,
          },
        },
        {
          initialPageId: 'home',
        },
      ),
    ).toBe('#/?mode=edit&page=2')

    expect(
      createBrowserHashNavigationHash(
        {
          pageId: 'details',
          params: {
            featured: true,
            mode: 'view',
            optional: undefined,
          },
        },
        {
          initialPageId: 'home',
        },
      ),
    ).toBe('#/details?featured=true&mode=view')
  })

  it('treats equivalent params with different query ordering as the same entry', () => {
    const first = parseBrowserHashNavigationHash('#/details?mode=edit&id=42', {
      initialPageId: 'home',
      knownPageIds,
    }).entry

    const second = parseBrowserHashNavigationHash('#/details?id=42&mode=edit', {
      initialPageId: 'home',
      knownPageIds,
    }).entry

    expect(areBrowserHashNavigationEntriesEqual(first, second)).toBe(true)
    expect(createBrowserHashNavigationHash(first, { initialPageId: 'home' })).toBe('#/details?id=42&mode=edit')
    expect(createBrowserHashNavigationHash(second, { initialPageId: 'home' })).toBe('#/details?id=42&mode=edit')
  })

  it('never serializes home as the initial page slug', () => {
    expect(
      createBrowserHashNavigationHash(
        {
          pageId: 'home',
          params: {
            id: '42',
          },
        },
        {
          initialPageId: 'home',
        },
      ),
    ).toBe('#/?id=42')
  })
})
