import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../../runtime/runtime-page'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import {
  selectPageEntryState,
} from '../../runtime/runtime-state/runtime-state-selectors'

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})

const runtimeConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [],
    },
    {
      id: 'details',
      layout: [],
    },
  ],
}

function RuntimeStateSnapshot({ testId }: { testId: string }) {
  const state = useRuntimeState()

  return <pre data-testid={testId}>{JSON.stringify(state)}</pre>
}

function readRuntimeStateSnapshot(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '') as RuntimeState
}

function ResetOnMount() {
  const { resetRuntimeState } = useRuntimeStateActions()

  useEffect(() => {
    resetRuntimeState()
  }, [resetRuntimeState])

  return <RuntimeStateSnapshot testId="state-after-reset" />
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
      <button type="button" onClick={() => navigateToPage('details', { userId: '42' })}>
        Navigate to details with params
      </button>
      <button type="button" onClick={() => navigateToPage('details', { userId: '7' })}>
        Navigate to details with other params
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

describe('Runtime shared state store', () => {
  it('creates isolated state per provider instance', () => {
    const firstConfig = {
      ...runtimeConfig,
      initialPage: 'home',
    }
    const secondConfig = {
      ...runtimeConfig,
      initialPage: 'details',
    }

    render(
      <>
        <RuntimeStateProvider config={firstConfig}>
          <RuntimeStateSnapshot testId="first-state" />
        </RuntimeStateProvider>
        <RuntimeStateProvider config={secondConfig}>
          <RuntimeStateSnapshot testId="second-state" />
        </RuntimeStateProvider>
      </>,
    )

    expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(readRuntimeStateSnapshot('first-state').navigation.history).toEqual([{ entryId: 0, pageId: 'home', params: {} }])
    expect(readRuntimeStateSnapshot('second-state').navigation.history).toEqual([{ entryId: 0, pageId: 'details', params: {} }])
    expect(readRuntimeStateSnapshot('first-state').pageEntry).toEqual({
      entryId: 0,
      pageId: 'home',
      params: {},
      preloadNames: [],
      status: 'idle',
    })
    expect(readRuntimeStateSnapshot('second-state').pageEntry).toEqual({
      entryId: 0,
      pageId: 'details',
      params: {},
      preloadNames: [],
      status: 'idle',
    })
  })

  it('initializes navigation, forms and queries in the base state', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(readRuntimeStateSnapshot('runtime-state')).toMatchObject({
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {},
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    })
  })

  it('seeds navigation from initialPage with the minimal history shape', () => {
    render(
      <RuntimeStateProvider
        config={{
          ...runtimeConfig,
          initialPage: 'details',
        }}
      >
        <RuntimeStateSnapshot testId="navigation-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"currentPageId":"details"')
    expect(readRuntimeStateSnapshot('navigation-state')).toMatchObject({
      navigation: {
        currentPageId: 'details',
        history: [{ entryId: 0, pageId: 'details', params: {} }],
        lastError: null,
      },
      pageEntry: {
        entryId: 0,
        pageId: 'details',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    })
  })

  it('resets the full runtime state back to the initial instance snapshot', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ResetOnMount />
      </RuntimeStateProvider>,
    )

    expect(readRuntimeStateSnapshot('state-after-reset')).toMatchObject({
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {},
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    })
  })

  it('renders the visible page from navigation.currentPageId and changes it through the hash without touching the pathname', async () => {
    const initialPathname = window.location.pathname

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(window.location.pathname).toBe(initialPathname)
    expect(window.location.hash).toBe('#/details')
  })

  it('keeps the previous page and stores a recoverable navigation error when the target page does not exist', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to missing page' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"lastError":{"code":"page-not-found","message":"The runtime page \\"missing-page\\" does not exist.","pageId":"missing-page"}',
    )
  })

  it('hydrates the visible entry from a direct hash and rewrites it to the canonical order', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/details?userId=42&mode=edit`)

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(window.location.hash).toBe('#/details?mode=edit&userId=42'))
    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toMatchObject({
      currentPageId: 'details',
      currentEntryIndex: 0,
      history: [{ entryId: 0, pageId: 'details', params: { mode: 'edit', userId: '42' } }],
    })
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry).toMatchObject({
      entryId: 0,
      pageId: 'details',
      params: { mode: 'edit', userId: '42' },
    })
  })

  it('falls back to the initial page and canonical home hash for invalid direct hashes', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/missing`)

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toMatchObject({
      currentPageId: 'home',
      currentEntryIndex: 0,
      history: [{ entryId: 0, pageId: 'home', params: {} }],
    })
  })

  it('goes back to the previous valid history entry while keeping the observed session trace', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'),
    )
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
      currentPageId: 'home',
      history: [
        { entryId: 0, pageId: 'home', params: {} },
        { entryId: 1, pageId: 'details', params: {} },
      ],
      currentEntryIndex: 0,
      lastError: null,
    })
    expect(window.location.hash).toBe('#/')
  })

  it('treats a direct hash entry as having no previous in-session history for goBack', async () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/details`)

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(window.location.hash).toBe('#/details')
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
      currentPageId: 'details',
      history: [{ entryId: 0, pageId: 'details', params: {} }],
      currentEntryIndex: 0,
      lastError: null,
    })
  })

  it('preserves manual query semantics while preload batching uses a separate transition', () => {
    const baseState: RuntimeState = {
      ...createRuntimeState(runtimeConfig),
      queries: {
        searchUsers: {
          status: 'success',
          data: ['Ada'],
          error: null,
          requestSignature: null,
        },
      },
    }

    const loadingState = runtimeStateReducer(baseState, {
      type: 'queries/set-loading',
      payload: {
        queryName: 'searchUsers',
      },
    })

    expect(loadingState.queries.searchUsers).toEqual({
      status: 'loading',
      data: ['Ada'],
      error: null,
      requestSignature: null,
    })

    const errorState = runtimeStateReducer(loadingState, {
      type: 'queries/set-error',
      payload: {
        queryName: 'searchUsers',
        error: {
          code: 'network',
          message: 'Could not load users.',
        },
      },
    })

    expect(errorState.queries.searchUsers).toEqual({
      status: 'error',
      data: null,
      error: {
        code: 'network',
        message: 'Could not load users.',
      },
      requestSignature: null,
    })

    const successState = runtimeStateReducer(errorState, {
      type: 'queries/set-success',
      payload: {
        queryName: 'searchUsers',
        data: ['Grace'],
      },
    })

    expect(successState.queries.searchUsers).toEqual({
      status: 'success',
      data: ['Grace'],
      error: null,
      requestSignature: null,
    })

    const resetState = runtimeStateReducer(successState, {
      type: 'queries/reset',
      payload: {
        queryName: 'searchUsers',
      },
    })

    expect(resetState.queries.searchUsers).toEqual({
      status: 'idle',
      data: null,
      error: null,
      requestSignature: null,
    })
  })

  it('persists the effective request signature across loading success and error, and clears it on reset', () => {
    const signature = '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}'
    const baseState = createRuntimeState(runtimeConfig)

    const loadingState = runtimeStateReducer(baseState, {
      type: 'queries/set-loading',
      payload: {
        queryName: 'searchUsers',
        requestSignature: signature,
      },
    })

    expect(loadingState.queries.searchUsers.requestSignature).toBe(signature)

    const successState = runtimeStateReducer(loadingState, {
      type: 'queries/set-success',
      payload: {
        queryName: 'searchUsers',
        data: ['Ada'],
        requestSignature: signature,
      },
    })

    expect(successState.queries.searchUsers.requestSignature).toBe(signature)

    const errorState = runtimeStateReducer(successState, {
      type: 'queries/set-error',
      payload: {
        queryName: 'searchUsers',
        error: {
          code: 'http-error',
          message: 'Boom',
        },
        requestSignature: signature,
      },
    })

    expect(errorState.queries.searchUsers.requestSignature).toBe(signature)

    const resetState = runtimeStateReducer(errorState, {
      type: 'queries/reset',
      payload: {
        queryName: 'searchUsers',
      },
    })

    expect(resetState.queries.searchUsers.requestSignature).toBeNull()
  })

  it('supports goBack after revisiting a page and returns to the previous entry in history order', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Navigate to home' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
      currentPageId: 'details',
      history: [
        { entryId: 0, pageId: 'home', params: {} },
        { entryId: 1, pageId: 'details', params: {} },
        { entryId: 2, pageId: 'home', params: {} },
      ],
      currentEntryIndex: 1,
      lastError: null,
    })
  })

  it('keeps the current page and does not create a recoverable error when goBack has no previous entry', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
      currentPageId: 'home',
      history: [{ entryId: 0, pageId: 'home', params: {} }],
      currentEntryIndex: 0,
      lastError: null,
    })
  })

  it('creates distinct same-page history entries when params differ and restores the previous params on goBack', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details with params' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { userId: '42' } },
        ],
        currentEntryIndex: 1,
        lastError: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry).toMatchObject({
      entryId: 1,
      pageId: 'details',
      params: { userId: '42' },
    })
    expect(selectPageEntryState(readRuntimeStateSnapshot('runtime-state'))).toMatchObject({
      entryId: 1,
      pageId: 'details',
      params: { userId: '42' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details with other params' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { userId: '42' } },
          { entryId: 2, pageId: 'details', params: { userId: '7' } },
        ],
        currentEntryIndex: 2,
        lastError: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry).toMatchObject({
      entryId: 2,
      pageId: 'details',
      params: { userId: '7' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').navigation).toEqual({
        currentPageId: 'details',
        history: [
          { entryId: 0, pageId: 'home', params: {} },
          { entryId: 1, pageId: 'details', params: { userId: '42' } },
          { entryId: 2, pageId: 'details', params: { userId: '7' } },
        ],
        currentEntryIndex: 1,
        lastError: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry).toMatchObject({
      entryId: 1,
      pageId: 'details',
      params: { userId: '42' },
    })
  })

  it('renders the initial page section with tabIndex={-1} and moves focus to it on mount', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const section = screen.getByTestId('runtime-page')
    expect(section).toHaveAttribute('tabindex', '-1')
    await waitFor(() => expect(section).toHaveFocus())
  })

  it('moves focus to the new section after navigating to a different page', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const homeSection = screen.getByTestId('runtime-page')
    await waitFor(() => expect(homeSection).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    const detailsSection = screen.getByTestId('runtime-page')
    await waitFor(() => expect(detailsSection).toHaveFocus())
    expect(detailsSection).toHaveAttribute('tabindex', '-1')
  })

  it('moves focus to the section again when navigating to the same page with different params (new pageEntry)', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details with params' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    const detailsSectionFirst = screen.getByTestId('runtime-page')
    await waitFor(() => expect(detailsSectionFirst).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details with other params' }))

    await waitFor(() => {
      const section = screen.getByTestId('runtime-page')
      expect(section).toHaveFocus()
    })
  })

  it('does not add tabIndex to the empty section when page is null', () => {
    const configWithNullPage: RuntimeConfig = {
      api: {},
      initialPage: 'missing-page',
      pages: [
        {
          id: 'home',
          layout: [],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={configWithNullPage}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const section = screen.getByTestId('runtime-page')
    expect(section).not.toHaveAttribute('tabindex')
  })

  it('shows expected page content after navigation without regression', async () => {
    const configWithContent: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [{ id: 'home-heading', type: 'heading', props: { text: 'Home page', level: 1 } }],
        },
        {
          id: 'details',
          layout: [{ id: 'details-heading', type: 'heading', props: { text: 'Details page', level: 1 } }],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={configWithContent}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Details page' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Home page' })).not.toBeInTheDocument()

    const detailsSection = screen.getByTestId('runtime-page')
    await waitFor(() => expect(detailsSection).toHaveFocus())
  })
})
