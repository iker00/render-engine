import { describe, expect, it } from 'vitest'
import { runtimeConfigRootSchema } from '../../config/runtime-config-root-zod'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

function createRootConfig(shell?: Record<string, unknown>) {
  const base = createConfigWithPages([{ id: 'home', layout: [] }])
  return shell === undefined ? base : { ...base, shell }
}

function createSidebarItem(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Dashboard',
    href: '/dashboard',
    ...overrides,
  }
}

function createSidebarCrossRefConfig(
  sidebar: Record<string, unknown>,
  options: { api?: Record<string, unknown>; pages?: Array<Record<string, unknown>> } = {},
) {
  const pages = options.pages ?? [
    { id: 'home', layout: [] },
    { id: 'details', layout: [] },
  ]
  const base = createConfigWithPages(pages, 'home')
  return { ...base, api: options.api ?? {}, shell: { sidebar } }
}

describe('runtimeConfigRootSchema — shell.sidebar: root block acceptance', () => {
  it('accepts a config without shell.sidebar, with shell.header present', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { title: 'My App' } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a config without shell.sidebar and without shell.header', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({}))
    expect(result.success).toBe(true)
  })

  it('accepts shell.sidebar: {}', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: {} }))
    expect(result.success).toBe(true)
  })

  it('accepts shell.sidebar.items: []', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: { items: [] } }))
    expect(result.success).toBe(true)
  })

  it('accepts shell.sidebar.defaultCollapsed: true', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: { defaultCollapsed: true } }))
    expect(result.success).toBe(true)
  })

  it('accepts shell.sidebar.defaultCollapsed: false', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: { defaultCollapsed: false } }))
    expect(result.success).toBe(true)
  })

  it('accepts shell.sidebar without defaultCollapsed', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: { items: [createSidebarItem()] } }))
    expect(result.success).toBe(true)
  })

  it('rejects shell.sidebar with an unknown key', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: { unknownKey: true } }))
    expect(result.success).toBe(false)
  })
})

describe('runtimeConfigRootSchema — sidebarItem: acceptance', () => {
  it('accepts a sidebarItem with label + href', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [createSidebarItem({ label: 'Home', href: '/' })] } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a sidebarItem with label + action navigateTo', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: { items: [createSidebarItem({ href: undefined, action: { type: 'navigateTo', pageId: 'home' } })] },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a sidebarItem with label + action goBack', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: { items: [createSidebarItem({ href: undefined, action: { type: 'goBack' } })] },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a sidebarItem with an icon', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [createSidebarItem({ icon: 'home' })] } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a sidebarItem with a visibility rule', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            createSidebarItem({
              visibility: { reference: 'forms.profile.role', operator: 'equals', value: 'admin' },
            }),
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a sidebarItem with a non-empty children array, each child with its own href/action', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Settings',
              children: [
                { label: 'Profile', href: '/settings/profile' },
                { label: 'Logout', action: { type: 'goBack' } },
              ],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a depth-2+ sidebarItem that itself declares its own children (real recursion, unlike menuItemChild)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Settings',
              children: [
                {
                  label: 'Advanced',
                  children: [{ label: 'Danger zone', href: '/settings/advanced/danger' }],
                },
              ],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a four-level-deep sidebar tree (each level with children, leaf at depth 4) — no depth cap', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Level 1',
              children: [
                {
                  label: 'Level 2',
                  children: [
                    {
                      label: 'Level 3',
                      children: [{ label: 'Level 4 leaf', href: '/deep' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })
})

describe('runtimeConfigRootSchema — sidebarItem: rejection', () => {
  it('rejects a sidebarItem without label', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [{ href: '/' }] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('label'))).toBe(true)
    }
  })

  it('rejects a sidebarItem with both href and action — custom error on path ["href"]', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [createSidebarItem({ href: '/', action: { type: 'goBack' } })] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Sidebar items cannot declare both href and action.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
      expect(issue?.path[issue.path.length - 1]).toBe('href')
    }
  })

  it('rejects a sidebarItem without href, action or children — custom error on root path', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [{ label: 'Nothing here' }] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Sidebar items must declare either href, action or children.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
    }
  })

  it('rejects a sidebarItem with both children and href', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Settings',
              href: '/settings',
              children: [{ label: 'Profile', href: '/settings/profile' }],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Sidebar items with children cannot declare href or action.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
    }
  })

  it('rejects a sidebarItem with both children and action', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Settings',
              action: { type: 'goBack' },
              children: [{ label: 'Profile', href: '/settings/profile' }],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Sidebar items with children cannot declare href or action.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
    }
  })

  it('rejects an explicit empty children array via .nonempty()', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ sidebar: { items: [{ label: 'Settings', children: [] }] } }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a nested child at any depth that breaks the same shape rules (third-level child with href and action)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        sidebar: {
          items: [
            {
              label: 'Level 1',
              children: [
                {
                  label: 'Level 2',
                  children: [
                    {
                      label: 'Level 3 bad',
                      href: '/bad',
                      action: { type: 'goBack' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Sidebar items cannot declare both href and action.',
      )
      expect(issue).toBeDefined()
    }
  })
})

describe('validateRuntimeConfig — shell.sidebar cross-references (0123-T2)', () => {
  it('accepts a root sidebarItem action.navigateTo referencing an existing page', () => {
    const config = createSidebarCrossRefConfig({
      items: [createSidebarItem({ href: undefined, action: { type: 'navigateTo', pageId: 'details' } })],
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a sidebarItem at depth 4 with action.navigateTo referencing an existing page (recursion beyond one level)', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        {
          label: 'Level 1',
          children: [
            {
              label: 'Level 2',
              children: [
                {
                  label: 'Level 3',
                  children: [{ label: 'Level 4', action: { type: 'navigateTo', pageId: 'details' } }],
                },
              ],
            },
          ],
        },
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a sidebarItem with action.goBack without requiring a pageId cross-ref', () => {
    const config = createSidebarCrossRefConfig({
      items: [createSidebarItem({ href: undefined, action: { type: 'goBack' } })],
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a sidebarItem visibility valid at the root', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        createSidebarItem({
          visibility: { reference: 'forms.profile.role', operator: 'equals', value: 'admin' },
        }),
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a sidebarItem visibility valid when nested', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        {
          label: 'Settings',
          children: [
            {
              label: 'Profile',
              href: '/settings/profile',
              visibility: { reference: 'params.canEdit', operator: 'isTruthy' },
            },
          ],
        },
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a root sidebarItem action.navigateTo referencing an unknown page, with exact path', () => {
    const config = createSidebarCrossRefConfig({
      items: [createSidebarItem({ href: undefined, action: { type: 'navigateTo', pageId: 'ghost' } })],
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.sidebar.items[0].action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })

  it('rejects a sidebarItem at depth 3 with an unknown pageId, with exact nested path', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        {
          label: 'Level 1',
          children: [
            {
              label: 'Level 2',
              children: [{ label: 'Level 3', action: { type: 'navigateTo', pageId: 'ghost' } }],
            },
          ],
        },
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.sidebar.items[0].children[0].children[0].action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })

  it('rejects a sidebarItem visibility referencing item.*, reusing the menuItem message', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        createSidebarItem({
          visibility: { reference: 'item.role', operator: 'equals', value: 'admin' },
        }),
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.sidebar.items[0].visibility": Shell menu items do not support item.* references.',
      },
    })
  })

  it('rejects a sidebarItem visibility referencing an operation not declared in api, at any depth', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        {
          label: 'Settings',
          children: [
            {
              label: 'Profile',
              href: '/settings/profile',
              visibility: { reference: 'queries.missingQuery.data', operator: 'isTruthy' },
            },
          ],
        },
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.sidebar.items[0].children[0].visibility.reference": operation "missingQuery" is not declared in "api".',
      },
    })
  })

  it('does not stop prematurely on a valid intermediate node: an invalid grandchild is still detected', () => {
    const config = createSidebarCrossRefConfig({
      items: [
        {
          label: 'Settings',
          children: [
            {
              label: 'Advanced',
              children: [{ label: 'Danger zone', action: { type: 'navigateTo', pageId: 'ghost' } }],
            },
          ],
        },
      ],
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.sidebar.items[0].children[0].children[0].action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })
})
