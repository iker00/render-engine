import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      { id: 'home', layout: [{ type: 'heading', props: { text: 'Home page', level: 1 } }] },
      { id: 'settings', layout: [{ type: 'heading', props: { text: 'Settings page', level: 1 } }] },
      { id: 'deep-page', layout: [{ type: 'heading', props: { text: 'Deep page', level: 1 } }] },
    ],
    shell,
    ...overrides,
  }
}

function renderApp(config: RuntimeConfig) {
  return render(<App devConfigOverride={config} isDevelopment rootElement={document.createElement('div')} />)
}

describe('AppShellSidebar — rail mode on mount', () => {
  it('starts collapsed (w-16, no visible label text) when sidebar.defaultCollapsed is true', () => {
    renderApp(
      buildConfig({ sidebar: { defaultCollapsed: true, items: [{ label: 'Home', href: '/home' }] } }),
    )

    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-16')
    expect(screen.queryByText('Home')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
  })

  it('starts expanded (w-64) when sidebar.defaultCollapsed is omitted', () => {
    renderApp(buildConfig({ sidebar: { items: [{ label: 'Home', href: '/home' }] } }))

    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-64')
    expect(screen.getByText('Home')).toBeInTheDocument()
  })
})

describe('AppShellSidebar — collapse control', () => {
  it('toggles between w-64 and w-16, updating its own aria-pressed and aria-label', () => {
    renderApp(buildConfig({ sidebar: { items: [{ label: 'Home', href: '/home' }] } }))

    const toggle = screen.getByRole('button', { name: 'Colapsar barra lateral' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-64')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Expandir barra lateral' })).toBe(toggle)
    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-16')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Colapsar barra lateral' })).toBe(toggle)
    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-64')
  })
})

describe('AppShellSidebar — icon-only root items in rail mode', () => {
  it('shows the uppercase initial of the label as a glyph when an item has no icon', () => {
    renderApp(
      buildConfig({
        sidebar: { defaultCollapsed: true, items: [{ label: 'Reports', href: '/reports' }] },
      }),
    )

    const link = screen.getByRole('link', { name: 'Reports' })
    expect(link).toHaveTextContent('R')
    expect(link.querySelector('svg')).not.toBeInTheDocument()
    expect(link).toHaveAttribute('aria-label', 'Reports')
    expect(link).toHaveAttribute('title', 'Reports')
  })

  it('shows the icon, not the initial, when an item declares icon', () => {
    renderApp(
      buildConfig({
        sidebar: { defaultCollapsed: true, items: [{ label: 'Dashboard', icon: 'home', href: '/dashboard' }] },
      }),
    )

    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link.querySelector('svg')).toBeInTheDocument()
    expect(link).not.toHaveTextContent('D')
  })
})

describe('AppShellSidebar — SidebarRailFlyout', () => {
  function buildFlyoutConfig() {
    return buildConfig({
      sidebar: {
        defaultCollapsed: true,
        items: [
          {
            label: 'Admin',
            children: [
              { label: 'Users', action: { type: 'navigateTo', pageId: 'settings' } },
              {
                label: 'Hidden',
                href: '/hidden',
                visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
              },
            ],
          },
        ],
      },
    })
  }

  it('opens the flyout on click, exposing role="menu", aria-expanded="true" and the visible children', () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('button', { name: 'Users' })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Hidden' })).not.toBeInTheDocument()
  })

  it('renders the panel as `fixed`, positioned from the trigger\'s measured rect — regression for the sidebar\'s own overflow-y-auto (0124-T4) clipping an `absolute` panel', () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      left: 8,
      right: 64,
      bottom: 152,
      width: 56,
      height: 32,
      x: 8,
      y: 120,
      toJSON: () => {},
    } as DOMRect)

    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    expect(menu).toHaveClass('fixed')
    expect(menu).not.toHaveClass('absolute')
    expect(menu).not.toHaveClass('left-full')
    expect(menu).toHaveStyle('--sidebar-rail-flyout-top: 120px')
    expect(menu).toHaveStyle('--sidebar-rail-flyout-left: 68px')
  })

  it('closes the flyout when the sidebar scrolls, instead of leaving it visually detached from the trigger', () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.scroll(screen.getByTestId('app-shell-sidebar'))

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the trigger', () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu')

    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('closes on an outside click', () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the flyout and triggers navigation when a leaf inside it is selected', async () => {
    renderApp(buildFlyoutConfig())

    const trigger = screen.getByRole('button', { name: 'Admin' })
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole('button', { name: 'Users' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('expands a depth-3+ child inline inside the same panel instead of opening a nested flyout', () => {
    renderApp(
      buildConfig({
        sidebar: {
          defaultCollapsed: true,
          items: [
            {
              label: 'Level 1',
              children: [
                {
                  label: 'Level 2',
                  children: [{ label: 'Level 3 leaf', action: { type: 'navigateTo', pageId: 'deep-page' } }],
                },
              ],
            },
          ],
        },
      }),
    )

    const level1Trigger = screen.getByRole('button', { name: 'Level 1' })
    fireEvent.click(level1Trigger)

    const menu = screen.getByRole('menu')
    expect(within(menu).queryByRole('button', { name: /Level 3 leaf/ })).not.toBeInTheDocument()

    const level2Trigger = within(menu).getByRole('button', { name: /Level 2/ })
    fireEvent.click(level2Trigger)

    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(level1Trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('button', { name: /Level 3 leaf/ })).toBeInTheDocument()
  })
})

describe('AppShellSidebar — rail mode persistence across navigation', () => {
  it('stays in rail mode after navigating to another page', async () => {
    renderApp(
      buildConfig({
        sidebar: {
          defaultCollapsed: true,
          items: [{ label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } }],
        },
      }),
    )

    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-16')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass('w-16')
  })
})

describe('AppShellSidebar — expanded mode regression', () => {
  it('still renders visible label text and an expandable trigger when collapsed is false', () => {
    renderApp(
      buildConfig({
        sidebar: {
          items: [
            { label: 'Home', href: '/home' },
            { label: 'Admin', children: [{ label: 'Users', href: '/users' }] },
          ],
        },
      }),
    )

    expect(screen.getByRole('link', { name: 'Home' })).toHaveTextContent('Home')

    const trigger = screen.getByRole('button', { name: 'Admin' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
  })
})
