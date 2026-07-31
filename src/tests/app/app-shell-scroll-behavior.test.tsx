import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../app/App'
import type { RuntimeConfig } from '../../app/bootstrap/read-runtime-config'
import type { ShellConfig } from '../../config/runtime-config-types'

// jsdom does not implement ResizeObserver — install a controllable stub that captures the
// registered callback so tests can drive a synthetic header resize deterministically (same
// pattern as `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx`).
type ResizeObserverEntryLike = { contentRect: { height: number } }
type ResizeObserverCallbackLike = (entries: ResizeObserverEntryLike[]) => void
let resizeObserverCallbacks: ResizeObserverCallbackLike[] = []

class MockResizeObserver {
  callback: ResizeObserverCallbackLike
  constructor(callback: ResizeObserverCallbackLike) {
    this.callback = callback
    resizeObserverCallbacks.push(callback)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  resizeObserverCallbacks = []
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

function buildConfig(shell: ShellConfig | undefined): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [{ type: 'heading', props: { text: 'Home page', level: 1 } }],
      },
    ],
    shell,
  }
}

function renderApp(shell: ShellConfig | undefined) {
  return render(<App devConfigOverride={buildConfig(shell)} isDevelopment rootElement={document.createElement('div')} />)
}

describe('shell.scrollBehavior — absent (regression, identical to T2 close)', () => {
  it('renders without overflow-hidden on runtime-app and without overflow-y-auto/flex-1/min-h-0 on the page content wrapper', () => {
    renderApp({ header: { title: 'Acme' } })

    expect(screen.getByTestId('runtime-app')).not.toHaveClass('overflow-hidden')
    const pageContent = screen.getByTestId('runtime-page-content')
    expect(pageContent).not.toHaveClass('overflow-y-auto')
    expect(pageContent).not.toHaveClass('flex-1')
    expect(pageContent).not.toHaveClass('min-h-0')
  })

  it('renders AppShellHeader as sticky by default', () => {
    renderApp({ header: { title: 'Acme' } })

    expect(screen.getByTestId('app-shell-header')).toHaveClass('sticky', 'top-0', 'z-10')
  })

  it('renders AppShellSidebar sticky with its own internal scroll and the body row without flex-1/min-h-0 (0124-T4)', () => {
    renderApp({ sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] } })

    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass(
      'sticky',
      'top-[var(--shell-sidebar-sticky-top)]',
      'h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]',
      'overflow-y-auto',
    )
  })
})

describe('shell.sidebar sticky positioning tracks the header height (0124-T4)', () => {
  it('is sticky/scrollable from the initial render and exposes --shell-sidebar-sticky-top from a measured ResizeObserver entry', () => {
    renderApp({
      header: { title: 'Acme' },
      sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
    })

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).toHaveClass(
      'sticky',
      'top-[var(--shell-sidebar-sticky-top)]',
      'h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]',
      'overflow-y-auto',
    )

    act(() => {
      resizeObserverCallbacks.forEach((callback) => callback([{ contentRect: { height: 56 } }]))
    })

    expect(sidebar).toHaveStyle('--shell-sidebar-sticky-top: 56px')
  })

  it('defaults --shell-sidebar-sticky-top to 0px when there is no header to measure', () => {
    renderApp({
      sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
    })

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).toHaveClass(
      'sticky',
      'top-[var(--shell-sidebar-sticky-top)]',
      'h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]',
      'overflow-y-auto',
    )
    expect(sidebar).toHaveStyle('--shell-sidebar-sticky-top: 0px')
  })
})

describe('shell.scrollBehavior — "page" explicit (same as absent)', () => {
  it('reproduces the same output as omitting the field', () => {
    renderApp({ scrollBehavior: 'page', header: { title: 'Acme' } })

    expect(screen.getByTestId('runtime-app')).not.toHaveClass('overflow-hidden')
    expect(screen.getByTestId('app-shell-header')).toHaveClass('sticky', 'top-0', 'z-10')
    const pageContent = screen.getByTestId('runtime-page-content')
    expect(pageContent).not.toHaveClass('overflow-y-auto')
  })

  it('reproduces the same sticky sidebar output as omitting the field (0124-T4)', () => {
    renderApp({
      scrollBehavior: 'page',
      header: { title: 'Acme' },
      sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
    })

    expect(screen.getByTestId('app-shell-sidebar')).toHaveClass(
      'sticky',
      'top-[var(--shell-sidebar-sticky-top)]',
      'h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]',
      'overflow-y-auto',
    )
  })
})

describe('shell.scrollBehavior — "fixed" without header and without sidebar', () => {
  it('adds overflow-hidden to runtime-app and flex-1/min-h-0/overflow-y-auto to the page content wrapper', () => {
    renderApp({ scrollBehavior: 'fixed' })

    expect(screen.getByTestId('runtime-app')).toHaveClass('overflow-hidden')
    const pageContent = screen.getByTestId('runtime-page-content')
    expect(pageContent).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
    expect(pageContent).toHaveClass('p-6', 'sm:p-8', 'lg:p-10')
    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-shell-sidebar')).not.toBeInTheDocument()
  })
})

describe('shell.scrollBehavior — "fixed" with header only', () => {
  it('renders the header without sticky/top-0/z-10, and the page content with flex-1 min-h-0 overflow-y-auto', () => {
    renderApp({ scrollBehavior: 'fixed', header: { title: 'Acme' } })

    const header = screen.getByTestId('app-shell-header')
    expect(header).not.toHaveClass('sticky')
    expect(header).not.toHaveClass('top-0')
    expect(header).not.toHaveClass('z-10')
    expect(header).toHaveClass('w-full', 'border-b', 'border-app-border-soft', 'bg-app-surface', 'shadow-shell')

    const pageContent = screen.getByTestId('runtime-page-content')
    expect(pageContent).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
  })
})

describe('shell.scrollBehavior — "fixed" with header and sidebar', () => {
  it('anchors header, body row and sidebar, and scrolls the content wrapper internally', () => {
    renderApp({
      scrollBehavior: 'fixed',
      header: { title: 'Acme' },
      sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
    })

    expect(screen.getByTestId('runtime-app')).toHaveClass('overflow-hidden')

    const header = screen.getByTestId('app-shell-header')
    expect(header).not.toHaveClass('sticky')
    expect(header).not.toHaveClass('top-0')
    expect(header).not.toHaveClass('z-10')

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).toHaveClass('overflow-y-auto')
    expect(sidebar).not.toHaveClass('sticky')
    expect(sidebar).not.toHaveClass('top-[var(--shell-sidebar-sticky-top)]')
    expect(sidebar).not.toHaveClass('h-[calc(100vh_-_var(--shell-sidebar-sticky-top))]')
    expect(sidebar).not.toHaveAttribute('style')

    const bodyRow = sidebar.parentElement as HTMLElement
    expect(bodyRow).toHaveClass('flex-1', 'min-h-0')

    const pageContent = screen.getByTestId('runtime-page')?.parentElement as HTMLElement
    expect(pageContent).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
  })
})

describe('shell.scrollBehavior — "fixed" with sidebar only (no header)', () => {
  it('anchors the body row and sidebar, scrolls the content wrapper internally, and renders no header', () => {
    renderApp({
      scrollBehavior: 'fixed',
      sidebar: { items: [{ label: 'Home', action: { type: 'navigateTo', pageId: 'home' } }] },
    })

    expect(screen.queryByTestId('app-shell-header')).not.toBeInTheDocument()

    const sidebar = screen.getByTestId('app-shell-sidebar')
    expect(sidebar).toHaveClass('overflow-y-auto')
    expect(sidebar).not.toHaveClass('sticky')
    expect(sidebar).not.toHaveAttribute('style')

    const bodyRow = sidebar.parentElement as HTMLElement
    expect(bodyRow).toHaveClass('flex-1', 'min-h-0')

    const pageContent = screen.getByTestId('runtime-page')?.parentElement as HTMLElement
    expect(pageContent).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
  })
})
