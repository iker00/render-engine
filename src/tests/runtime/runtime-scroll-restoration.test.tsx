import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

const runtimeConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    { id: 'home', layout: [] },
    { id: 'details', layout: [] },
  ],
}

function NavigationControls() {
  const { goBackPage, navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('details')}>
        Navigate to details
      </button>
      <button type="button" onClick={() => navigateToPage('home')}>
        Navigate to home
      </button>
      <button type="button" onClick={() => navigateToPage('missing-page')}>
        Navigate to missing page
      </button>
      <button type="button" onClick={() => goBackPage()}>
        Go back
      </button>
    </>
  )
}

const preloadRuntimeConfig: RuntimeConfig = {
  api: {
    loadProfile: {
      method: 'GET',
      endpoint: '/api/profile',
      query: {
        userId: 'params.userId',
      },
    },
  },
  initialPage: 'home',
  pages: [
    { id: 'home', layout: [] },
    {
      id: 'editor',
      preloads: [{ operationName: 'loadProfile', requestParams: {} }],
      layout: [],
    },
  ],
}

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function PreloadNavigationControls() {
  const { goBackPage, navigateToPage } = useRuntimeStateActions()

  return (
    <>
      <button type="button" onClick={() => navigateToPage('editor', { userId: 'ada' })}>
        Edit ada
      </button>
      <button type="button" onClick={() => navigateToPage('editor', { userId: 'grace' })}>
        Edit grace
      </button>
      <button type="button" onClick={() => goBackPage()}>
        Go back
      </button>
    </>
  )
}

function PageEntryStatusProbe() {
  const state = useRuntimeState()

  return <div data-testid="page-entry-status">{state.pageEntry.status}</div>
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

describe('RuntimeScrollRestorationEffect', () => {
  it('scrolls to the top for the initial pageEntry on mount', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('scrolls to the top synchronously after navigating to a new page (push)', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(window.scrollTo).toHaveBeenCalledTimes(2)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0)
  })

  it('scrolls to the top again when navigating to an already visited page, because navigateTo always creates a new entryId', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(window.scrollTo).toHaveBeenCalledTimes(2)

    // Back to "home", a page already visited once (entryId 0), but navigateTo always creates a
    // fresh entryId unless it's a no-op — so this is still a push, not a restoration.
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'),
    )
    expect(window.scrollTo).toHaveBeenCalledTimes(3)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0)
  })

  it('does not call scrollTo again for a repeated no-op navigation to the same page and params', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    // Already on "home": both clicks are no-ops that never create a new entryId.
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not call scrollTo when navigating to a page that does not exist', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to missing page' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not scroll to the top when reactivating a previously visited entry via goBack', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    // Simulate the user having scrolled down on the initial "home" entry before leaving it, so
    // the capture-on-abandon path has a real value to record for entryId 0.
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true })

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(window.scrollTo).toHaveBeenCalledTimes(2)

    const scrollToCallsBeforeGoBack = vi.mocked(window.scrollTo).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))

    // entryId 0 ("home") was already captured in the positions map when it was abandoned above,
    // so reactivating it through goBack must not trigger the push (scroll-to-top) path. The single
    // extra call below is T2's pop restoration to the saved position (0, 240), not a push to (0, 0)
    // — see the "pop restoration (T2)" describe block for full coverage of that behavior.
    expect(window.scrollTo).toHaveBeenCalledTimes(scrollToCallsBeforeGoBack + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 240)
  })

  it('sets history.scrollRestoration to manual while mounted and restores the previous value on unmount', () => {
    const previousScrollRestoration = window.history.scrollRestoration

    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.history.scrollRestoration).toBe('manual')

    unmount()

    expect(window.history.scrollRestoration).toBe(previousScrollRestoration)
  })
})

describe('RuntimeScrollRestorationEffect — pop restoration (T2)', () => {
  it('restores the saved scroll position after reactivating a previously visited entry via the app goBack() action', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true })

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    const callsBeforeGoBack = vi.mocked(window.scrollTo).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'),
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(callsBeforeGoBack + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 240)
  })

  it('restores the saved scroll position when the reactivation is triggered directly by window.history.back() (native browser control)', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    Object.defineProperty(window, 'scrollY', { value: 180, configurable: true })

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    const callsBeforeGoBack = vi.mocked(window.scrollTo).mock.calls.length

    // Native browser back/forward control, bypassing the app's own goBack action entirely — the
    // real popstate event is what RuntimeStateProvider already listens to.
    act(() => {
      window.history.back()
    })

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'),
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(callsBeforeGoBack + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 180)
  })

  it('does not call scrollTo for a goBack that is a visible no-op because there is no previous entry in session history', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('still restores scrollTo(0, 0) without error when the abandoned entry never scrolled away from the top', async () => {
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    const callsBeforeGoBack = vi.mocked(window.scrollTo).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'),
    )

    expect(window.scrollTo).toHaveBeenCalledTimes(callsBeforeGoBack + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0)
  })

  it('waits for pageEntry.status to leave "loading" before restoring the saved position when goBack relaunches a preload with a changed signature', async () => {
    let resolveAdaInitial: ((response: Response) => void) | null = null
    let resolveGrace: ((response: Response) => void) | null = null
    let resolveAdaReplay: ((response: Response) => void) | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/profile?userId=ada' && resolveAdaInitial === null) {
        return new Promise<Response>((resolve) => {
          resolveAdaInitial = resolve
        })
      }

      if (url === '/api/profile?userId=grace') {
        return new Promise<Response>((resolve) => {
          resolveGrace = resolve
        })
      }

      return new Promise<Response>((resolve) => {
        resolveAdaReplay = resolve
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RuntimeStateProvider config={preloadRuntimeConfig}>
        <PreloadNavigationControls />
        <PageEntryStatusProbe />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit ada' }))
    resolveAdaInitial?.(createJsonResponse({ name: 'Ada' }))
    await waitFor(() => expect(screen.getByTestId('page-entry-status')).toHaveTextContent('success'))

    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true })

    fireEvent.click(screen.getByRole('button', { name: 'Edit grace' }))
    resolveGrace?.(createJsonResponse({ name: 'Grace' }))
    await waitFor(() => expect(screen.getByTestId('page-entry-status')).toHaveTextContent('success'))

    const callsBeforeGoBack = vi.mocked(window.scrollTo).mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(screen.getByTestId('page-entry-status')).toHaveTextContent('loading'))

    // The relaunched preload (params.userId went back from "grace" to "ada", changing the
    // effective request signature) keeps pageEntry.status at "loading" for the reactivated
    // entryId — the saved position (0, 400) must not be applied yet.
    expect(window.scrollTo).toHaveBeenCalledTimes(callsBeforeGoBack)

    resolveAdaReplay?.(createJsonResponse({ name: 'Ada replay' }))
    await waitFor(() => expect(screen.getByTestId('page-entry-status')).toHaveTextContent('success'))

    expect(window.scrollTo).toHaveBeenCalledTimes(callsBeforeGoBack + 1)
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 400)
  })
})
