import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'
import type { ShellHeaderConfig } from '../../config/runtime-config-types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function buildConfig(header: ShellHeaderConfig | undefined, overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    api: {
      pingOperation: { method: 'GET', endpoint: '/api/ping' },
    },
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
    ],
    shell: header !== undefined ? { header } : undefined,
    ...overrides,
  }
}

function renderApp(config: RuntimeConfig) {
  return render(<App devConfigOverride={config} isDevelopment rootElement={document.createElement('div')} />)
}

describe('AppShellHeader — absence and empty header', () => {
  it('renders no <header> when the config declares no shell block', () => {
    renderApp(buildConfig(undefined))

    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument()
  })

  it('renders no <header> when shell is {}', () => {
    renderApp({ ...buildConfig(undefined), shell: {} })

    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })

  it('renders no <header> when shell.header is {}', () => {
    renderApp(buildConfig({}))

    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
  })
})

describe('AppShellHeader — logo and title', () => {
  it('renders the logo as an <img> with the configured src/alt', () => {
    renderApp(buildConfig({ logo: { src: '/logo.svg', alt: 'Company logo' } }))

    const logo = screen.getByRole('img', { name: 'Company logo' })
    expect(logo).toHaveAttribute('src', '/logo.svg')
  })

  it('renders a literal title', () => {
    renderApp(buildConfig({ title: 'My App' }))

    expect(screen.getByTestId('app-shell-header-title')).toHaveTextContent('My App')
  })

  it('does not render the title element when a full dynamic reference resolves to an empty string', () => {
    // `params.role` is genuinely unresolved before any navigation happens, which is the exact
    // case this test wants to observe: the dev-only diagnostic it logs is expected, not a bug.
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderApp(buildConfig({ title: 'params.role' }))

    expect(screen.queryByTestId('app-shell-header-title')).not.toBeInTheDocument()

    consoleWarnSpy.mockRestore()
  })

  it('resolves an interpolated title reactively as referenced state changes', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderApp(buildConfig({ title: 'Role: {{params.role}}' }))

    expect(screen.getByTestId('app-shell-header-title')).toHaveTextContent('Role:')

    fireEvent.click(screen.getByRole('button', { name: 'Reveal admin item' }))

    await waitFor(() => expect(screen.getByTestId('app-shell-header-title')).toHaveTextContent('Role: admin'))

    consoleWarnSpy.mockRestore()
  })
})

describe('AppShellHeader — left/right order', () => {
  it('orders logo, title and menu in the left area and actions in the right area, omitting absent pieces', () => {
    renderApp(
      buildConfig({
        logo: { src: '/logo.svg', alt: 'Logo' },
        title: 'Acme',
        menu: [{ label: 'Go home', action: { type: 'navigateTo', pageId: 'home' } }],
        actions: [{ type: 'button', props: { label: 'Sign out' } }],
      }),
    )

    const left = screen.getByTestId('app-shell-header-left')
    const actions = screen.getByTestId('app-shell-header-actions')
    const leftTagOrder = Array.from(left.children).map((el) => el.tagName)

    expect(leftTagOrder[0]).toBe('IMG')
    expect(within(left).getByText('Acme')).toBeInTheDocument()
    expect(within(left).getByRole('button', { name: /Go home/ })).toBeInTheDocument()
    expect(within(actions).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(within(actions).queryByText('Acme')).not.toBeInTheDocument()
  })

  it('renders only the menu, with no gap, when logo/title/actions are absent', () => {
    renderApp(buildConfig({ menu: [{ label: 'Go home', action: { type: 'navigateTo', pageId: 'home' } }] }))

    const left = screen.getByTestId('app-shell-header-left')
    expect(left.children).toHaveLength(1)
    expect(within(left).getByRole('button', { name: /Go home/ })).toBeInTheDocument()
  })
})

describe('AppShellHeader — root menu leaves', () => {
  it('renders a root href item as a native <a>, without wiring the runtime action executor', () => {
    renderApp(buildConfig({ menu: [{ label: 'External', href: '/external' }] }))

    const link = screen.getByRole('link', { name: /External/ })
    expect(link).toHaveAttribute('href', '/external')
  })

  it('navigates when a root item declares action.navigateTo', async () => {
    renderApp(buildConfig({ menu: [{ label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } }] }))

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())
  })

  it('goes back when a root item declares action.goBack', async () => {
    renderApp(
      buildConfig({
        menu: [
          { label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } },
          { label: 'Back', action: { type: 'goBack' } },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument())
  })

  it('hides a menu item whose visibility condition is not met, and shows it without a gap once it is', async () => {
    renderApp(
      buildConfig({
        menu: [
          { label: 'Always visible', href: '/always' },
          {
            label: 'Admin panel',
            action: { type: 'navigateTo', pageId: 'settings' },
            visibility: { reference: 'params.role', operator: 'equals', value: 'admin' },
          },
        ],
      }),
    )

    expect(screen.queryByText('Admin panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('app-shell-header-left').children).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Reveal admin item' }))

    await waitFor(() => expect(screen.getByText('Admin panel')).toBeInTheDocument())
    expect(screen.getByTestId('app-shell-header-left').children).toHaveLength(2)
  })
})

describe('AppShellHeader — active state', () => {
  it('applies the active class to the root menu item matching the visible page', () => {
    renderApp(
      buildConfig({
        menu: [
          { label: 'Home', action: { type: 'navigateTo', pageId: 'home' } },
          { label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } },
        ],
      }),
    )

    expect(screen.getByRole('button', { name: /Home/ })).toHaveClass('text-app-accent')
    expect(screen.getByRole('button', { name: /Settings/ })).not.toHaveClass('text-app-accent')
  })

  it('applies the active class to both a dropdown trigger and its active child', () => {
    renderApp(
      buildConfig({
        menu: [
          {
            label: 'Admin',
            children: [
              { label: 'Users', action: { type: 'navigateTo', pageId: 'home' } },
              { label: 'Roles', action: { type: 'navigateTo', pageId: 'settings' } },
            ],
          },
        ],
      }),
    )

    const trigger = screen.getByRole('button', { name: /Admin/ })
    expect(trigger).toHaveClass('text-app-accent')

    fireEvent.click(trigger)

    expect(screen.getByRole('menuitem', { name: /Users/ })).toHaveClass('text-app-accent')
    expect(screen.getByRole('menuitem', { name: /Roles/ })).not.toHaveClass('text-app-accent')
  })
})

describe('AppShellHeader — actions area', () => {
  it('renders a link and a button action via the central node dispatcher', () => {
    renderApp(
      buildConfig({
        actions: [
          { type: 'link', props: { label: 'Docs', href: '/docs' } },
          { type: 'button', props: { label: 'Sign out' } },
        ],
      }),
    )

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '/docs')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('dispatches a real operation when an actions button declares executeOperation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    renderApp(
      buildConfig({
        actions: [
          {
            type: 'button',
            props: { label: 'Ping', action: { type: 'executeOperation', operationName: 'pingOperation' } },
          },
        ],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ping' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toContain('/api/ping')
  })
})

describe('AppShellHeader — full-width inner row (0124-T2 reset)', () => {
  it('renders the inner row edge-to-edge, without a centered max-width band', () => {
    renderApp(buildConfig({ title: 'Acme' }))

    const inner = screen.getByTestId('app-shell-header').firstElementChild as HTMLElement

    expect(inner).not.toHaveClass('mx-auto')
    expect(inner).not.toHaveClass('max-w-shell')
    expect(inner).toHaveClass('flex', 'w-full', 'flex-wrap', 'items-center', 'justify-between', 'gap-4')
    expect(inner).toHaveClass('px-4', 'py-3', 'sm:px-6', 'lg:px-8')
  })
})

describe('AppShellHeader — persistence across navigation', () => {
  it('keeps the same <header> DOM node mounted across a page navigation', async () => {
    renderApp(buildConfig({ menu: [{ label: 'Settings', action: { type: 'navigateTo', pageId: 'settings' } }] }))

    const headerBeforeNavigation = screen.getByTestId('app-shell-header')

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Settings page' })).toBeInTheDocument())

    expect(screen.getByTestId('app-shell-header')).toBe(headerBeforeNavigation)
  })
})
