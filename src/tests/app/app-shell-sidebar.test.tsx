import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'
import type { ShellConfig } from '../../config/runtime-config-types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function buildConfig(shell: ShellConfig | undefined, overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          { type: 'heading', props: { text: 'Home page', level: 1 } },
          {
            type: 'button',
            props: {
              label: 'Reveal admin item',
              action: { type: 'navigateTo', pageId: 'home', params: { role: 'admin' } },
            },
          },
        ],
      },
      {
        id: 'settings',
        layout: [{ type: 'heading', props: { text: 'Settings page', level: 1 } }],
      },
      {
        id: 'deep-page',
        layout: [{ type: 'heading', props: { text: 'Deep page', level: 1 } }],
      },
    ],
    shell,
    ...overrides,
  }
}

function renderApp(config: RuntimeConfig) {
  return render(<App devConfigOverride={config} isDevelopment rootElement={document.createElement('div')} />)
}

describe('AppShellSidebar — absence', () => {
  it('renders no sidebar and keeps RuntimePage as the sole frame body when shell is undefined', () => {
    renderApp(buildConfig(undefined))

    expect(screen.queryByTestId('app-shell-sidebar')).not.toBeInTheDocument()
    // 0124-T2: RuntimePage is now wrapped in a padded `runtime-page-content` div (FR11); that
    // wrapper, not RuntimePage itself, is the frame's sole body child.
    const frame = screen.getByTestId('runtime-shell-frame')
    expect(frame.children).toHaveLength(1)
    expect(frame.children[0]).toBe(screen.getByTestId('runtime-page-content'))
    expect(screen.getByTestId('runtime-page-content')).toContainElement(screen.getByTestId('runtime-page'))
  })

  it('renders no sidebar when sidebar.items is an empty array', () => {
    renderApp(buildConfig({ sidebar: { items: [] } }))

    expect(screen.queryByTestId('app-shell-sidebar')).not.toBeInTheDocument()
    const frame = screen.getByTestId('runtime-shell-frame')
    expect(frame.children).toHaveLength(1)
    expect(frame.children[0]).toBe(screen.getByTestId('runtime-page-content'))
    expect(screen.getByTestId('runtime-page-content')).toContainElement(screen.getByTestId('runtime-page'))
  })
})

describe('AppShellSidebar — composition', () => {
  it('renders the header above a body row with the sidebar preceding the page content', () => {
    renderApp(
      buildConfig({
        header: { title: 'Acme' },
        sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
      }),
    )

    const frame = screen.getByTestId('runtime-shell-frame')
    const header = screen.getByTestId('app-shell-header')
    const sidebar = screen.getByTestId('app-shell-sidebar')
    const runtimePage = screen.getByTestId('runtime-page')
    const bodyRow = sidebar.parentElement

    expect(Array.from(frame.children)).toEqual([header, bodyRow])
    expect(bodyRow?.children[0]).toBe(sidebar)
    expect(bodyRow?.children[1]?.contains(runtimePage)).toBe(true)
  })

  it('renders the sidebar body row as the first frame child when only sidebar is declared', () => {
    renderApp(
      buildConfig({
        sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
      }),
    )

    const frame = screen.getByTestId('runtime-shell-frame')
    const sidebar = screen.getByTestId('app-shell-sidebar')

    expect(frame.children[0]).toBe(sidebar.parentElement)
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })
})

describe('AppShellSidebar — leaf items', () => {
  it('renders an href item as a native <a>', () => {
    renderApp(buildConfig({ sidebar: { items: [{ label: 'External', href: '/external' }] } }))

    const link = screen.getByRole('link', { name: /External/ })
    expect(link).toHaveAttribute('href', '/external')
  })

  it('navigates when an item declares action.navigateTo', async () => {
    renderApp(
      buildConfig({
        sidebar: { items: [{ label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } }] },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
  })
})

describe('AppShellSidebar — branch triggers', () => {
  it('renders a children trigger collapsed by default, expanding its indented children on click', () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            {
              // `Users` targets `settings`, not the initially active `home` page, so this branch
              // has no active descendant and the auto-expansion added in 0123-T5 stays out of the
              // way of this collapsed-by-default assertion.
              label: 'Admin',
              children: [{ label: 'Users', action: { type: 'navigateTo', pageId: 'settings' } }],
            },
          ],
        },
      }),
    )

    const trigger = screen.getByRole('button', { name: /Admin/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Users/ })).not.toBeInTheDocument()

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const childButton = screen.getByRole('button', { name: /Users/ })
    expect(childButton).toBeInTheDocument()
    expect(childButton.parentElement?.className).toMatch(/pl-\d/)
  })

  it('keeps two expanded branches simultaneously expanded, with no exclusion', () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            { label: 'Admin', children: [{ label: 'Users', href: '/users' }] },
            { label: 'Reports', children: [{ label: 'Sales', href: '/sales' }] },
          ],
        },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reports/ }))

    expect(screen.getByRole('button', { name: /Admin/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Reports/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sales/ })).toBeInTheDocument()
  })

  it('reveals each successive level of a four-level-deep tree as it is expanded, up to the leaf', async () => {
    renderApp(
      buildConfig({
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
                      children: [{ label: 'Level 4', action: { type: 'navigateTo', pageId: 'deep-page' } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    )

    expect(screen.queryByRole('button', { name: /Level 2/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Level 1/ }))
    expect(screen.getByRole('button', { name: /Level 2/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Level 3/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Level 2/ }))
    expect(screen.getByRole('button', { name: /Level 3/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Level 4/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Level 3/ }))
    const leafButton = screen.getByRole('button', { name: /Level 4/ })
    expect(leafButton).toBeInTheDocument()

    fireEvent.click(leafButton)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Deep page' })).toBeInTheDocument())
  })
})

describe('AppShellSidebar — visibility', () => {
  it('hides an item whose visibility condition is not met, and shows it once met', async () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            { label: 'Always visible', href: '/always' },
            {
              label: 'Admin panel',
              href: '/admin',
              visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
            },
          ],
        },
      }),
    )

    expect(screen.queryByText('Admin panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal admin item' }))

    await waitFor(() => expect(screen.getByText('Admin panel')).toBeInTheDocument())
  })

  it('keeps a trigger clickable even when all of its children are hidden by visibility', () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            {
              label: 'Admin',
              children: [
                {
                  label: 'Hidden child',
                  href: '/hidden',
                  visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
                },
              ],
            },
          ],
        },
      }),
    )

    const trigger = screen.getByRole('button', { name: /Admin/ })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('link', { name: /Hidden child/ })).not.toBeInTheDocument()
  })
})

describe('AppShellSidebar — active state', () => {
  it('applies the active class to the matching root item and its ancestors, auto-expanding the ancestor branch (0123-T5)', () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            {
              label: 'Admin',
              children: [{ label: 'Users', action: { type: 'navigateTo', pageId: 'home' } }],
            },
            { label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } },
          ],
        },
      }),
    )

    const adminTrigger = screen.getByRole('button', { name: /Admin/ })
    expect(adminTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(adminTrigger).toHaveClass('text-app-accent')
    expect(screen.getByRole('button', { name: /Settings/ })).not.toHaveClass('text-app-accent')
  })
})

describe('AppShellSidebar — persistence across navigation', () => {
  it('keeps the same sidebar DOM node mounted across a page navigation', async () => {
    renderApp(
      buildConfig({
        sidebar: { items: [{ label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } }] },
      }),
    )

    const sidebarBeforeNavigation = screen.getByTestId('app-shell-sidebar')

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())

    expect(screen.getByTestId('app-shell-sidebar')).toBe(sidebarBeforeNavigation)
  })
})

describe('AppShellSidebar — auto-expansion of active ancestor branches', () => {
  function buildDeepSidebarConfig(initialPage: string): RuntimeConfig {
    return buildConfig(
      {
        sidebar: {
          items: [
            {
              label: 'Level 1',
              children: [
                {
                  label: 'Level 2',
                  children: [{ label: 'Reports leaf', action: { type: 'navigateTo', pageId: 'reports' } }],
                },
              ],
            },
            {
              label: 'Unrelated',
              children: [{ label: 'Analytics leaf', action: { type: 'navigateTo', pageId: 'analytics' } }],
            },
            { label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } },
          ],
        },
      },
      {
        initialPage,
        pages: [
          {
            id: 'home',
            layout: [
              { type: 'heading', props: { text: 'Home page', level: 1 } },
              {
                type: 'button',
                props: { label: 'Go to reports', action: { type: 'navigateTo', pageId: 'reports' } },
              },
            ],
          },
          {
            id: 'reports',
            layout: [
              { type: 'heading', props: { text: 'Reports page', level: 1 } },
              {
                type: 'button',
                props: { label: 'Go to settings', action: { type: 'navigateTo', pageId: 'settings' } },
              },
            ],
          },
          {
            id: 'settings',
            layout: [
              { type: 'heading', props: { text: 'Settings page', level: 1 } },
              {
                type: 'button',
                props: { label: 'Go to reports', action: { type: 'navigateTo', pageId: 'reports' } },
              },
            ],
          },
          {
            id: 'analytics',
            layout: [{ type: 'heading', props: { text: 'Analytics page', level: 1 } }],
          },
        ],
      },
    )
  }

  it('expands all ancestor branches on mount when the initial page matches a third-level item', () => {
    renderApp(buildDeepSidebarConfig('reports'))

    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Level 2/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Reports leaf/ })).toBeInTheDocument()
  })

  it('expands a previously collapsed branch after navigating into it from an unrelated control', async () => {
    renderApp(buildDeepSidebarConfig('home'))

    expect(screen.queryByRole('button', { name: /Level 2/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to reports' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Reports page' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Level 2/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Reports leaf/ })).toBeInTheDocument()
  })

  it('keeps a manually expanded, unrelated branch expanded after navigating elsewhere', async () => {
    renderApp(buildDeepSidebarConfig('home'))

    fireEvent.click(screen.getByRole('button', { name: /Unrelated/ }))
    expect(screen.getByRole('button', { name: /Analytics leaf/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to reports' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Reports page' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Unrelated/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Analytics leaf/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('reopens a branch the user had manually collapsed once it becomes active again after navigation', async () => {
    renderApp(buildDeepSidebarConfig('reports'))

    const level1Trigger = screen.getByRole('button', { name: /Level 1/ })
    expect(level1Trigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(level1Trigger)
    expect(level1Trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Level 2/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to settings' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Go to reports' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Reports page' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Level 2/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('does not collapse already expanded branches when navigating to a page with no nested sidebar item', async () => {
    renderApp(buildDeepSidebarConfig('reports'))

    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Level 2/ })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Go to settings' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Level 1/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Level 2/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
