import { describe, expect, it } from 'vitest'
import { runtimeConfigRootSchema } from '../../config/runtime-config-root-zod'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithPages } from './helpers'

function createShellCrossRefConfig(
  shell: Record<string, unknown>,
  options: { api?: Record<string, unknown>; pages?: Array<Record<string, unknown>> } = {},
) {
  const pages = options.pages ?? [
    { id: 'home', layout: [] },
    { id: 'details', layout: [] },
  ]
  const base = createConfigWithPages(pages, 'home')
  return { ...base, api: options.api ?? {}, shell }
}

function createRootConfig(shell?: Record<string, unknown>) {
  const base = createConfigWithPages([{ id: 'home', layout: [] }])
  return shell === undefined ? base : { ...base, shell }
}

function createMenuItem(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Dashboard',
    href: '/dashboard',
    ...overrides,
  }
}

describe('runtimeConfigRootSchema — shell: root block', () => {
  it('accepts a config without a shell block (full backward compatibility)', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig())
    expect(result.success).toBe(true)
  })

  it('accepts shell: {}', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({}))
    expect(result.success).toBe(true)
  })

  it('accepts shell: { header: {} }', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ header: {} }))
    expect(result.success).toBe(true)
  })

  it('accepts shell: { sidebar: {} } (sibling of header, added in 0123-T1)', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ sidebar: {} }))
    expect(result.success).toBe(true)
  })

  it('rejects shell with an unknown key (e.g. footer)', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ footer: {} }))
    expect(result.success).toBe(false)
  })
})

describe('runtimeConfigRootSchema — shell.header: individual fields', () => {
  it('accepts header with only logo (valid image props)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { logo: { src: '/logo.svg', alt: 'Company logo' } } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts header with only title as a literal string', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ header: { title: 'My App' } }))
    expect(result.success).toBe(true)
  })

  it('accepts header with only title as a full dynamic reference', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { title: 'queries.settings.data.appName' } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts header with only title containing {{...}} interpolation', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { title: 'Welcome, {{forms.profile.name}}' } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts header with only menu: []', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ header: { menu: [] } }))
    expect(result.success).toBe(true)
  })

  it('accepts header with only actions: []', () => {
    const result = runtimeConfigRootSchema.safeParse(createRootConfig({ header: { actions: [] } }))
    expect(result.success).toBe(true)
  })

  it('accepts header with all four keys declared and non-empty', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          logo: { src: '/logo.svg', alt: 'Company logo' },
          title: 'My App',
          menu: [createMenuItem()],
          actions: [{ type: 'link', props: { label: 'Docs', href: '/docs' } }],
        },
      }),
    )
    expect(result.success).toBe(true)
  })
})

describe('runtimeConfigRootSchema — shell.header.menu: menuItem acceptance', () => {
  it('accepts a menuItem with label + href (literal)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { menu: [createMenuItem({ label: 'Home', href: '/' })] } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a menuItem with label + action navigateTo', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
            createMenuItem({ href: undefined, action: { type: 'navigateTo', pageId: 'home' } }),
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a menuItem with label + action goBack', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [createMenuItem({ href: undefined, action: { type: 'goBack' } })],
        },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a menuItem with children, each child declaring its own href/action', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
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

  it('accepts a menuItem with an icon', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { menu: [createMenuItem({ icon: 'home' })] } }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts a menuItem with a visibility rule', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
            createMenuItem({
              visibility: { reference: 'forms.profile.role', operator: 'equals', value: 'admin' },
            }),
          ],
        },
      }),
    )
    expect(result.success).toBe(true)
  })
})

describe('runtimeConfigRootSchema — shell.header.menu: menuItem rejection', () => {
  it('rejects a menuItem without label', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { menu: [{ href: '/' }] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('label'))).toBe(true)
    }
  })

  it('rejects a menuItem with both href and action — custom error on path ["href"]', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [createMenuItem({ href: '/', action: { type: 'goBack' } })],
        },
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((entry) => entry.message === 'Menu items cannot declare both href and action.')
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
      expect(issue?.path[issue.path.length - 1]).toBe('href')
    }
  })

  it('rejects a menuItem without href, action or children — custom error on root path', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { menu: [{ label: 'Nothing here' }] } }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (entry) => entry.message === 'Menu items must declare either href, action or children.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
      // The rule's own `addIssue` path is `[]` (relative to the menuItem being refined); Zod
      // appends it after the outer path, so the last segment here is the array index, not "menu".
      expect(issue?.path[issue.path.length - 1]).toBe(0)
    }
  })

  it('rejects a menuItem with both children and href', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
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
        (entry) => entry.message === 'Menu items with children cannot declare href or action.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
    }
  })

  it('rejects a menuItem with both children and action', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
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
        (entry) => entry.message === 'Menu items with children cannot declare href or action.',
      )
      expect(issue).toBeDefined()
      expect(issue?.code).toBe('custom')
    }
  })

  it('rejects an explicit empty children array via .nonempty()', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({ header: { menu: [{ label: 'Settings', children: [] }] } }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a menuItemChild that itself declares children', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: {
          menu: [
            {
              label: 'Settings',
              children: [
                {
                  label: 'Profile',
                  children: [{ label: 'Nested', href: '/nested' }],
                },
              ],
            },
          ],
        },
      }),
    )
    expect(result.success).toBe(false)
  })
})

describe('runtimeConfigRootSchema — shell.header.actions', () => {
  it('accepts actions with a valid link node', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: { actions: [{ type: 'link', props: { label: 'Docs', href: '/docs' } }] },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts actions with a valid button node', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: { actions: [{ type: 'button', props: { label: 'New item' } }] },
      }),
    )
    expect(result.success).toBe(true)
  })

  it('accepts actions with a button whose action is executeOperation referencing an api operation', () => {
    const base = createRootConfig({
      header: {
        actions: [
          {
            type: 'button',
            props: {
              label: 'Refresh',
              action: { type: 'executeOperation', operationName: 'refreshData' },
            },
          },
        ],
      },
    }) as Record<string, unknown>
    base.api = { refreshData: { method: 'GET', endpoint: '/api/refresh' } }
    const result = runtimeConfigRootSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('rejects actions with a node type other than link/button (e.g. table)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: { actions: [{ type: 'table', props: { headers: [], rows: [] } }] },
      }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects actions with a node type other than link/button (e.g. container)', () => {
    const result = runtimeConfigRootSchema.safeParse(
      createRootConfig({
        header: { actions: [{ type: 'container', children: [] }] },
      }),
    )
    expect(result.success).toBe(false)
  })
})

describe('validateRuntimeConfig — shell cross-references (0122-T2)', () => {
  it('accepts a root menuItem action.navigateTo referencing an existing page', () => {
    const config = createShellCrossRefConfig({
      header: { menu: [{ label: 'Details', action: { type: 'navigateTo', pageId: 'details' } }] },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a menuItem child action.navigateTo referencing an existing page', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'Settings',
            children: [{ label: 'Details', action: { type: 'navigateTo', pageId: 'details' } }],
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a menuItem with action.goBack without requiring a pageId cross-ref', () => {
    const config = createShellCrossRefConfig({
      header: { menu: [{ label: 'Back', action: { type: 'goBack' } }] },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a menuItem visibility referencing forms, queries and params surfaces', () => {
    const config = createShellCrossRefConfig(
      {
        header: {
          menu: [
            {
              label: 'A',
              href: '/a',
              visibility: { reference: 'forms.someForm.someField', operator: 'equals', value: 'x' },
            },
            {
              label: 'B',
              href: '/b',
              visibility: { reference: 'queries.someQuery.data', operator: 'isTruthy' },
            },
            {
              label: 'C',
              href: '/c',
              visibility: { reference: 'params.someParam', operator: 'equals', value: 'y' },
            },
          ],
        },
      },
      { api: { someQuery: { method: 'GET', endpoint: '/api/data' } } },
    )

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts shell.header.actions link with action.navigateTo referencing an existing page', () => {
    const config = createShellCrossRefConfig({
      header: {
        actions: [{ type: 'link', props: { label: 'Details', action: { type: 'navigateTo', pageId: 'details' } } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts shell.header.actions button with executeOperation referencing a declared api operation', () => {
    const config = createShellCrossRefConfig(
      {
        header: {
          actions: [
            {
              type: 'button',
              props: { label: 'Refresh', action: { type: 'executeOperation', operationName: 'refreshData' } },
            },
          ],
        },
      },
      { api: { refreshData: { method: 'GET', endpoint: '/api/refresh' } } },
    )

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a root menuItem action.navigateTo referencing an unknown page', () => {
    const config = createShellCrossRefConfig({
      header: { menu: [{ label: 'Ghost', action: { type: 'navigateTo', pageId: 'ghost' } }] },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.menu[0].action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })

  it('rejects a menuItem child action.navigateTo referencing an unknown page', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'Settings',
            children: [{ label: 'Ghost', action: { type: 'navigateTo', pageId: 'ghost' } }],
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.menu[0].children[0].action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })

  it('rejects a menuItem visibility referencing item.*', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'item.role', operator: 'equals', value: 'admin' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.menu[0].visibility": Shell menu items do not support item.* references.',
      },
    })
  })

  it('rejects a menuItem visibility referencing an undeclared api operation via queries.*', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'queries.foo.data', operator: 'isTruthy' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message.startsWith('Shell configuration is invalid at "shell.header.menu[0].visibility')).toBe(true)
      expect(result.error.message).toContain('foo')
    }
  })

  it('rejects shell.header.actions link with a pageId that does not exist in pages', () => {
    const config = createShellCrossRefConfig({
      header: {
        actions: [{ type: 'link', props: { label: 'Ghost', action: { type: 'navigateTo', pageId: 'ghost' } } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.actions[0].props.action.pageId": pageId "ghost" is not declared in "pages".',
      },
    })
  })

  it('rejects shell.header.actions button with an operationName that does not exist in api', () => {
    const config = createShellCrossRefConfig({
      header: {
        actions: [
          {
            type: 'button',
            props: { label: 'Refresh', action: { type: 'executeOperation', operationName: 'missingOperation' } },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.actions[0].props.action.operationName": operation "missingOperation" is not declared in "api".',
      },
    })
  })

  it('rejects a shell block whose shape does not match the 0122-T1 schema', () => {
    const config = createShellCrossRefConfig({
      header: { unknownKey: true },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message.startsWith('Shell configuration is invalid at "shell')).toBe(true)
    }
  })

  it('rejects shell.header.actions button with an executeOperations entry referencing an unknown operation', () => {
    const config = createShellCrossRefConfig(
      {
        header: {
          actions: [
            {
              type: 'button',
              props: {
                label: 'Batch',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'refreshData' }, { operationName: 'missingOperation' }],
                },
              },
            },
          ],
        },
      },
      { api: { refreshData: { method: 'GET', endpoint: '/api/refresh' } } },
    )

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.actions[0].props.action.operations[1].operationName": operation "missingOperation" is not declared in "api".',
      },
    })
  })

  it('rejects a menuItem visibility whose reference uses an unsupported namespace', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'tokens.secret', operator: 'equals', value: 'x' } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toContain('shell.header.menu[0].visibility.reference')
      expect(result.error.message).toContain('visibility references must use')
    }
  })

  it('accepts a menuItem visibility group (and/or) whose conditions all resolve against declared surfaces', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: {
              operator: 'and',
              conditions: [
                { reference: 'forms.profile.role', operator: 'equals', value: 'admin' },
                { reference: 'params.mode', operator: 'notEquals', value: 'readonly' },
              ],
            },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a menuItem visibility group whose second condition references an undeclared api operation', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: {
              operator: 'or',
              conditions: [
                { reference: 'params.mode', operator: 'equals', value: 'edit' },
                { reference: 'queries.missingQuery.data', operator: 'isTruthy' },
              ],
            },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.menu[0].visibility.conditions[1].reference": operation "missingQuery" is not declared in "api".',
      },
    })
  })

  it('rejects a menuItem visibility with itemField declared on a non-arrayContains operator', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'params.mode', operator: 'equals', value: 'x', itemField: 'user.code' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.menu[0].visibility.itemField": itemField is only valid when operator is "arrayContains".',
      },
    })
  })

  it('rejects a menuItem visibility with isTruthy declaring a value', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'params.mode', operator: 'isTruthy', value: 'x' } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.menu[0].visibility.value": operator "isTruthy" does not accept value.',
      },
    })
  })

  it('rejects a menuItem visibility with equals missing a value', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'params.mode', operator: 'equals' } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.menu[0].visibility.value": operator "equals" requires value.',
      },
    })
  })

  it('rejects a menuItem visibility with arrayContains value that is not a scalar', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'params.mode', operator: 'arrayContains', value: { nested: true } },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toBe(
        'Shell configuration is invalid at "shell.header.menu[0].visibility.value": operator "arrayContains" only accepts string, number, boolean or null.',
      )
    }
  })

  it('rejects a menuItem visibility whose itemField is not a string (rejected by the 0122-T1 shape)', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'params.mode', operator: 'arrayContains', value: 'x', itemField: 42 },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('invalid-layout')
      expect(result.error.message).toBe('Shell configuration is invalid at "shell.header.menu[0].visibility.itemField".')
    }
  })

  it('accepts a menuItem visibility with arrayContains and a string itemField', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [
          {
            label: 'A',
            href: '/a',
            visibility: { reference: 'params.roles', operator: 'arrayContains', value: 'admin', itemField: 'user.code' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a menuItem visibility with greaterThan value that is not numeric', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'params.count', operator: 'greaterThan', value: 'high' } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          'Shell configuration is invalid at "shell.header.menu[0].visibility.value": operator "greaterThan" only accepts numeric thresholds.',
      },
    })
  })

  it('accepts a menuItem visibility with greaterThan and a numeric value', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'params.count', operator: 'greaterThan', value: 3 } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts shell: {} (no header) without recursing any further', () => {
    const config = createShellCrossRefConfig({})

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts shell.header.actions button with executeOperations whose entries are all declared in api', () => {
    const config = createShellCrossRefConfig(
      {
        header: {
          actions: [
            {
              type: 'button',
              props: {
                label: 'Batch',
                action: {
                  type: 'executeOperations',
                  operations: [{ operationName: 'refreshData' }, { operationName: 'refreshOther' }],
                },
              },
            },
          ],
        },
      },
      {
        api: {
          refreshData: { method: 'GET', endpoint: '/api/refresh' },
          refreshOther: { method: 'GET', endpoint: '/api/refresh-other' },
        },
      },
    )

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('accepts a shell.header.actions node whose own visibility resolves against declared surfaces', () => {
    const config = createShellCrossRefConfig({
      header: {
        actions: [
          {
            type: 'link',
            props: { label: 'Docs', href: '/docs' },
            visibility: { reference: 'params.mode', operator: 'equals', value: 'edit' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a shell.header.actions node whose own visibility references item.*', () => {
    const config = createShellCrossRefConfig({
      header: {
        actions: [
          {
            type: 'link',
            props: { label: 'Docs', href: '/docs' },
            visibility: { reference: 'item.role', operator: 'equals', value: 'admin' },
          },
        ],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Shell configuration is invalid at "shell.header.actions[0].visibility": Shell menu items do not support item.* references.',
      },
    })
  })

  it('rejects a menuItem visibility whose forms reference has the wrong number of segments', () => {
    const config = createShellCrossRefConfig({
      header: {
        menu: [{ label: 'A', href: '/a', visibility: { reference: 'forms.tooMany.segments.here', operator: 'isTruthy' } }],
      },
    })

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('shell.header.menu[0].visibility.reference')
    }
  })

  it('accepts menuItem visibility references covering the bare, status and error queries surfaces', () => {
    const config = createShellCrossRefConfig(
      {
        header: {
          menu: [
            { label: 'A', href: '/a', visibility: { reference: 'queries.someQuery', operator: 'isTruthy' } },
            { label: 'B', href: '/b', visibility: { reference: 'queries.someQuery.status', operator: 'equals', value: 'success' } },
            { label: 'C', href: '/c', visibility: { reference: 'queries.someQuery.error', operator: 'isTruthy' } },
            {
              label: 'D',
              href: '/d',
              visibility: { reference: 'queries.someQuery.error.message', operator: 'equals', value: 'oops' },
            },
          ],
        },
      },
      { api: { someQuery: { method: 'GET', endpoint: '/api/data' } } },
    )

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('ready')
  })

  it('rejects a menuItem visibility referencing an invalid nested data segment', () => {
    const config = createShellCrossRefConfig(
      { header: { menu: [{ label: 'A', href: '/a', visibility: { reference: 'queries.someQuery.data.bad!', operator: 'isTruthy' } }] } },
      { api: { someQuery: { method: 'GET', endpoint: '/api/data' } } },
    )

    const result = validateRuntimeConfig(config)

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('shell.header.menu[0].visibility.reference')
    }
  })
})
