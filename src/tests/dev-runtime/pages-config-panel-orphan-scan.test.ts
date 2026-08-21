import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config-types'
import { scanOrphanNavigateToReferences } from '../../dev-runtime/pages-config-panel/scan-orphan-navigate-to-references'

function buildConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [],
      },
    ],
    ...overrides,
  }
}

describe('scanOrphanNavigateToReferences', () => {
  it('returns totalCount 0 and empty sources when there are no references anywhere', () => {
    const config = buildConfig()

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('detects a reference in button.props.action inside the layout of another page', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Ir a ajustes',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en la página «home»', count: 1 }],
    })
  })

  it('detects nested references in form.onSuccess[] and form.onError[]', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: { type: 'executeOperation', operationName: 'save' },
              onSuccess: [{ type: 'navigateTo', pageId: 'settings' }],
              onError: [{ type: 'navigateTo', pageId: 'settings' }],
            },
          ],
        },
      ],
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 2,
      sources: [{ label: 'en la página «home»', count: 2 }],
    })
  })

  it('counts multiple references within the same page correctly', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Uno',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
            {
              type: 'link',
              props: {
                label: 'Dos',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
            {
              type: 'link',
              props: {
                label: 'Otra página',
                action: { type: 'navigateTo', pageId: 'other' },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 2,
      sources: [{ label: 'en la página «home»', count: 2 }],
    })
  })

  it('detects a reference in a menuItem/menuItemChild of shell.header.menu', () => {
    const config = buildConfig({
      shell: {
        header: {
          menu: [
            {
              label: 'Padre',
              children: [{ label: 'Hijo', action: { type: 'navigateTo', pageId: 'settings' } }],
            },
          ],
        },
      },
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en el menú del header', count: 1 }],
    })
  })

  it('detects a reference in a link/button node of shell.header.actions', () => {
    const config = buildConfig({
      shell: {
        header: {
          actions: [
            {
              type: 'button',
              props: {
                label: 'Ir',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
          ],
        },
      },
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en el menú del header', count: 1 }],
    })
  })

  it('detects a sidebarItem reference nested several levels deep in shell.sidebar.items', () => {
    const config = buildConfig({
      shell: {
        sidebar: {
          items: [
            {
              label: 'Nivel 1',
              children: [
                {
                  label: 'Nivel 2',
                  children: [
                    {
                      label: 'Nivel 3',
                      action: { type: 'navigateTo', pageId: 'settings' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 1,
      sources: [{ label: 'en el sidebar', count: 1 }],
    })
  })

  it('does not count a navigateTo reference whose pageId does not match targetPageId', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Otro',
                action: { type: 'navigateTo', pageId: 'other' },
              },
            },
          ],
        },
      ],
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('does not throw when config.shell is absent and adds no header/sidebar sources', () => {
    const config = buildConfig()
    expect(config.shell).toBeUndefined()

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({ totalCount: 0, sources: [] })
  })

  it('orders sources as pages (in config.pages order), then header, then sidebar', () => {
    const config = buildConfig({
      pages: [
        {
          id: 'page-b',
          layout: [
            {
              type: 'button',
              props: {
                label: 'B',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
          ],
        },
        {
          id: 'page-a',
          layout: [
            {
              type: 'button',
              props: {
                label: 'A',
                action: { type: 'navigateTo', pageId: 'settings' },
              },
            },
          ],
        },
      ],
      shell: {
        header: {
          menu: [{ label: 'Menu', action: { type: 'navigateTo', pageId: 'settings' } }],
        },
        sidebar: {
          items: [{ label: 'Sidebar', action: { type: 'navigateTo', pageId: 'settings' } }],
        },
      },
    })

    const result = scanOrphanNavigateToReferences(config, 'settings')

    expect(result).toEqual({
      totalCount: 4,
      sources: [
        { label: 'en la página «page-b»', count: 1 },
        { label: 'en la página «page-a»', count: 1 },
        { label: 'en el menú del header', count: 1 },
        { label: 'en el sidebar', count: 1 },
      ],
    })
  })
})
