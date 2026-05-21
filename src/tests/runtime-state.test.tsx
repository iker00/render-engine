import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'
import {
  deriveQueryVisibleState,
  resolveQueryStateFeedback,
  type RuntimeQueryVisibleState,
} from '../runtime/runtime-query-state-feedback'
import {
  getValidationErrorForEditedField,
  type ResolvedFormFieldDefinition,
} from '../runtime/runtime-form-validations'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
import { createRuntimeState, runtimeStateReducer } from '../runtime/runtime-state/runtime-state-reducer'
import {
  selectFormFieldValue,
  selectNestedQueryDataValue,
  selectPageEntryState,
  selectQueryVisibleState,
  selectQueryReferenceValue,
} from '../runtime/runtime-state/runtime-state-selectors'

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

const runtimeApiConfig: RuntimeConfig = {
  api: {
    searchUsers: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.name',
      },
    },
    invalidSearch: {
      method: 'GET',
      endpoint: '/api/users',
      query: {
        search: 'forms.userSearch.missingField',
      },
    },
    clearUsers: {
      method: 'DELETE',
      endpoint: '/api/users',
    },
  },
  initialPage: 'home',
  pages: runtimeConfig.pages,
}

const resetFormButtonConfig: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [
    {
      id: 'home',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Reset user search form from layout',
            action: {
              type: 'resetForm',
              formId: 'userSearch',
            },
          },
        },
        {
          type: 'button',
          props: {
            label: 'Reset missing form from layout',
            action: {
              type: 'resetForm',
              formId: 'missingForm',
            },
          },
        },
      ],
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

function FormsFixture() {
  const { initializeForm, navigateToPage, removeForm, resetForm, setFormFieldError, setFormFieldValue } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    initializeForm('newsletter', {
      email: {
        defaultValue: 'news@example.com',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', 'Grace')}>
        Update user name
      </button>
      <button type="button" onClick={() => setFormFieldError('userSearch', 'name', 'Required')}>
        Set user name error
      </button>
      <button type="button" onClick={() => resetForm('userSearch')}>
        Reset user search form
      </button>
      <button type="button" onClick={() => removeForm('userSearch')}>
        Remove user search form
      </button>
      <button type="button" onClick={() => removeForm('missingForm')}>
        Remove missing form
      </button>
      <button type="button" onClick={() => navigateToPage('details')}>
        Go to details page
      </button>
    </>
  )
}

function QueriesFixture() {
  const { initializeQuery, navigateToPage, setQueryError, setQueryLoading, setQuerySuccess } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('searchUsers')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada', 'Grace'])}>
        Store query success
      </button>
      <button type="button" onClick={() => setQueryLoading('searchUsers')}>
        Reload query
      </button>
      <button
        type="button"
        onClick={() =>
          setQueryError('searchUsers', {
            code: 'network',
            message: 'Could not load users.',
          })
        }
      >
        Store query error
      </button>
      <button type="button" onClick={() => navigateToPage('details')}>
        Go to details page from query fixture
      </button>
    </>
  )
}

function RuntimeInstanceFixture({ name, initialPage }: { name: string; initialPage: 'home' | 'details' }) {
  const { initializeForm, initializeQuery, navigateToPage, setFormFieldValue, setQuerySuccess } =
    useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: initialPage,
      },
    })
    initializeQuery('searchUsers')
  }, [initializeForm, initializeQuery, initialPage])

  return (
    <>
      <button type="button" onClick={() => navigateToPage(initialPage === 'home' ? 'details' : 'home')}>
        {name} navigate
      </button>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', `${name}-value`)}>
        {name} set form value
      </button>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', [`${name}-query`])}>
        {name} set query success
      </button>
      <RuntimeStateSnapshot testId={`${name}-state`} />
      <RuntimePage />
    </>
  )
}

function QueryOperationFixture({
  operationName,
  fetchMock,
}: {
  operationName: string
  fetchMock?: typeof fetch
}) {
  const { executeQueryOperation, initializeForm, initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    initializeQuery('searchUsers')
  }, [initializeForm, initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQuerySuccess('searchUsers', ['Ada'])}>
        Seed prior query success
      </button>
      <button type="button" onClick={() => void executeQueryOperation(operationName, { fetch: fetchMock })}>
        Execute operation
      </button>
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function FormRuntimeFixture() {
  const { initializeQuery, setQueryLoading, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('visibilityQuery')
  }, [initializeQuery])

  return (
    <>
      <button type="button" onClick={() => setQueryLoading('visibilityQuery')}>
        Set visibility loading
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Set visibility success
      </button>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function QueryDrivenFormLifecycleFixture() {
  const { initializeQuery, navigateToPage, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('selectedUser')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Countess',
            },
          })
        }
      >
        Seed Countess
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Architect',
            },
          })
        }
      >
        Seed Architect
      </button>
      <button type="button" onClick={() => navigateToPage('editor')}>
        Open editor
      </button>
      <button type="button" onClick={() => navigateToPage('home')}>
        Leave editor
      </button>
    </>
  )
}

function RepeaterFormFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('profiles')
    setQuerySuccess('profiles', [
      {
        id: 'ada',
        requiresCode: true,
      },
    ])
  }, [initializeQuery, setQuerySuccess])

  return (
    <>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function FormVisibilityFixture() {
  const { initializeForm, setFormFieldValue } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('visibilityControl', {
      mode: {
        defaultValue: 'show',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('visibilityControl', 'mode', 'hide')}>
        Hide profile form
      </button>
      <button type="button" onClick={() => setFormFieldValue('visibilityControl', 'mode', 'show')}>
        Show profile form
      </button>
    </>
  )
}

function DynamicSelectQueryFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('roleCatalog')
    initializeQuery('visibilityQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'admin',
                label: 'Admin',
              },
              {
                id: 'editor',
                label: 'Editor',
              },
            ],
          })
        }
      >
        Seed role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('roleCatalog', {
            results: [
              {
                id: 'viewer',
                label: 'Viewer',
              },
            ],
          })
        }
      >
        Seed replacement role catalog
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Seed dynamic visibility success
      </button>
    </>
  )
}

function VisibilityRuleQueryFixture() {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    initializeQuery('selectedUser')
    initializeQuery('visibilityQuery')
    initializeQuery('thresholdQuery')
  }, [initializeQuery])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('selectedUser', {
            profile: {
              nickname: 'Countess',
            },
          })
        }
      >
        Seed conditional selected user
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('visibilityQuery', {
            ok: true,
          })
        }
      >
        Set conditional visibility success
      </button>
      <button
        type="button"
        onClick={() =>
          setQuerySuccess('thresholdQuery', [
            { id: 'user-1' },
            { id: 'user-2' },
          ])
        }
      >
        Seed threshold list
      </button>
      <button type="button" onClick={() => setQuerySuccess('thresholdQuery', [])}>
        Seed threshold empty list
      </button>
      <RuntimePage />
      <RuntimeStateSnapshot testId="runtime-state" />
    </>
  )
}

function RuntimeButtonResetSeed() {
  const { initializeForm, setFormFieldError, setFormFieldValue } = useRuntimeStateActions()

  useEffect(() => {
    initializeForm('userSearch', {
      name: {
        defaultValue: 'Ada',
      },
    })
    initializeForm('newsletter', {
      email: {
        defaultValue: 'news@example.com',
      },
    })
  }, [initializeForm])

  return (
    <>
      <button type="button" onClick={() => setFormFieldValue('userSearch', 'name', 'Grace')}>
        Seed reset target value
      </button>
      <button type="button" onClick={() => setFormFieldError('userSearch', 'name', 'Required')}>
        Seed reset target error
      </button>
      <button type="button" onClick={() => setFormFieldValue('newsletter', 'email', 'updated@example.com')}>
        Seed other form value
      </button>
      <RuntimeStateSnapshot testId="runtime-state" />
      <RuntimePage />
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
      data: ['Ada'],
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

  it('stores forms by formId and fieldId with default values in the shared state', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"forms":{"userSearch":{"name":{')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"value":"Ada","error":null,"touched":false,"dirty":false,"defaultValue":"Ada"',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"news@example.com","error":null,"touched":false,"dirty":false,"defaultValue":"news@example.com"}}',
    )
  })

  it('updates a form field value consistently and keeps the base field shape', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set user name error' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"forms":{"userSearch":{"name":{"value":"Grace","error":"Required","touched":true,"dirty":true,"defaultValue":"Ada"}}',
    )
  })

  it('navigates nested query data paths with array indexes and object keys without mutating their meaning', () => {
    const state: RuntimeState = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {},
      queries: {
        searchUsers: {
          status: 'success',
          data: {
            results: [
              { id: 'user-1', name: 'Ada' },
              { id: 'user-2', name: 'Grace' },
            ],
            years: {
              '2024': {
                label: 'Q1',
              },
            },
            total: 3,
          },
          error: null,
        },
      },
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    expect(selectQueryReferenceValue(state, 'searchUsers', 'data')).toEqual({
      results: [
        { id: 'user-1', name: 'Ada' },
        { id: 'user-2', name: 'Grace' },
      ],
      years: {
        '2024': {
          label: 'Q1',
        },
      },
      total: 3,
    })
    expect(selectNestedQueryDataValue(state, 'searchUsers', ['results', '1', 'name'])).toEqual({
      found: true,
      value: 'Grace',
    })
    expect(selectNestedQueryDataValue(state, 'searchUsers', ['years', '2024', 'label'])).toEqual({
      found: true,
      value: 'Q1',
    })
    expect(selectNestedQueryDataValue(state, 'searchUsers', ['results', '9', 'name'])).toEqual({
      found: false,
    })
    expect(selectNestedQueryDataValue(state, 'searchUsers', ['total', 'value'])).toEqual({
      found: false,
    })
  })

  it('resets one form to its initial effective state without affecting other forms', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set user name error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset user search form' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"userSearch":{"name":{"value":"Ada","error":null,"touched":false,"dirty":false,"defaultValue":"Ada"}}',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"news@example.com","error":null,"touched":false,"dirty":false,"defaultValue":"news@example.com"}}',
    )
  })

  it('removes one form completely without affecting other forms, navigation, or queries', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set user name error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page' }))
    await waitFor(() => expect(screen.getByTestId('runtime-state')).toHaveTextContent('"currentPageId":"details"'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove user search form' }))

    const runtimeState = readRuntimeStateSnapshot('runtime-state')

    expect(runtimeState.navigation.currentPageId).toBe('details')
    expect(runtimeState.queries.searchUsers).toEqual({
      status: 'success',
      data: ['Ada', 'Grace'],
      error: null,
      requestSignature: null,
    })
    expect(runtimeState.forms.userSearch).toBeUndefined()
    expect(runtimeState.forms).toEqual({
      newsletter: {
        email: {
          value: 'news@example.com',
          error: null,
          touched: false,
          dirty: false,
          defaultValue: 'news@example.com',
        },
      },
    })
  })

  it('keeps the state stable when removing a form that does not exist', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const stateBeforeRemoval = readRuntimeStateSnapshot('runtime-state')

    fireEvent.click(screen.getByRole('button', { name: 'Remove missing form' }))

    expect(readRuntimeStateSnapshot('runtime-state')).toEqual(stateBeforeRemoval)
  })

  it('resets the target form from a rendered button without affecting other runtime forms', () => {
    render(
      <RuntimeStateProvider config={resetFormButtonConfig}>
        <RuntimeButtonResetSeed />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed reset target value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seed reset target error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seed other form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset user search form from layout' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"userSearch":{"name":{"value":"Ada","error":null,"touched":false,"dirty":false,"defaultValue":"Ada"}}',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"updated@example.com","error":null,"touched":true,"dirty":true,"defaultValue":"news@example.com"}}',
    )
  })

  it('keeps the screen stable when a rendered resetForm button targets an uninitialized form', () => {
    render(
      <RuntimeStateProvider config={resetFormButtonConfig}>
        <RuntimeButtonResetSeed />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset missing form from layout' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"newsletter":{"email":{"value":"news@example.com","error":null,"touched":false,"dirty":false,"defaultValue":"news@example.com"}}',
    )
  })

  it('keeps form state across page changes inside the same runtime instance', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"userSearch":{"name":{"value":"Grace","error":null,"touched":true,"dirty":true,"defaultValue":"Ada"}}',
    )
  })

  it('stores queries by shared name with the base status, data and error shape', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"idle","data":null,"error":null,"requestSignature":null}}',
    )
  })

  it('keeps the last successful query data while the same query reloads', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reload query' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"loading","data":["Ada","Grace"],"error":null,"requestSignature":null}}',
    )
  })

  it('stores recoverable query errors with a stable UI-oriented shape without breaking the runtime', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query error' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"error","data":null,"error":{"code":"network","message":"Could not load users."},"requestSignature":null}}',
    )
  })

  it('exposes selector helpers for forms and query reference paths without mutating runtime state', () => {
    const snapshot = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {
        userSearch: {
          name: {
            value: 'Grace',
            error: null,
            touched: true,
            dirty: true,
            defaultValue: 'Ada',
          },
        },
      },
      queries: {
        searchUsers: {
          status: 'success' as const,
          data: ['Ada', 'Grace'],
          error: null,
          requestSignature: null,
        },
      },
      pageEntry: {
        entryId: 2,
        pageId: 'home',
        params: { userId: '42' },
        preloadNames: ['searchUsers'],
        status: 'success' as const,
      },
    }

    expect(selectFormFieldValue(snapshot, 'userSearch', 'name')).toBe('Grace')
    expect(selectFormFieldValue(snapshot, 'userSearch', 'email')).toBeUndefined()
    expect(selectQueryReferenceValue(snapshot, 'searchUsers')).toBe(snapshot.queries.searchUsers)
    expect(selectQueryReferenceValue(snapshot, 'searchUsers', 'data')).toEqual(['Ada', 'Grace'])
    expect(selectQueryReferenceValue(snapshot, 'searchUsers', 'status')).toBe('success')
    expect(selectQueryReferenceValue(snapshot, 'searchUsers', 'error')).toBeNull()
    expect(selectQueryVisibleState(snapshot, 'searchUsers')).toBe('success')
    expect(selectQueryVisibleState(snapshot, 'missingQuery')).toBe('idle')
    expect(selectPageEntryState(snapshot)).toBe(snapshot.pageEntry)
    expect(snapshot.pageEntry.params).toEqual({ userId: '42' })
  })

  it.each([
    {
      label: 'missing query state',
      queryState: null,
      expected: 'idle',
    },
    {
      label: 'idle query state',
      queryState: {
        status: 'idle',
        data: null,
        error: null,
      },
      expected: 'idle',
    },
    {
      label: 'loading query state with stale data',
      queryState: {
        status: 'loading',
        data: ['Ada'],
        error: null,
      },
      expected: 'loading',
    },
    {
      label: 'error query state',
      queryState: {
        status: 'error',
        data: ['Ada'],
        error: {
          code: 'network',
          message: 'Could not load users.',
        },
      },
      expected: 'error',
    },
    {
      label: 'success with null data',
      queryState: {
        status: 'success',
        data: null,
        error: null,
      },
      expected: 'empty',
    },
    {
      label: 'success with undefined data',
      queryState: {
        status: 'success',
        data: undefined,
        error: null,
      },
      expected: 'empty',
    },
    {
      label: 'success with empty string data',
      queryState: {
        status: 'success',
        data: '',
        error: null,
      },
      expected: 'empty',
    },
    {
      label: 'success with empty array data',
      queryState: {
        status: 'success',
        data: [],
        error: null,
      },
      expected: 'empty',
    },
    {
      label: 'success with empty object data',
      queryState: {
        status: 'success',
        data: {},
        error: null,
      },
      expected: 'empty',
    },
    {
      label: 'success with zero',
      queryState: {
        status: 'success',
        data: 0,
        error: null,
      },
      expected: 'success',
    },
    {
      label: 'success with false',
      queryState: {
        status: 'success',
        data: false,
        error: null,
      },
      expected: 'success',
    },
    {
      label: 'success with non-empty string',
      queryState: {
        status: 'success',
        data: 'Ada',
        error: null,
      },
      expected: 'success',
    },
    {
      label: 'success with populated array',
      queryState: {
        status: 'success',
        data: ['Ada'],
        error: null,
      },
      expected: 'success',
    },
    {
      label: 'success with populated object',
      queryState: {
        status: 'success',
        data: {
          total: 1,
        },
        error: null,
      },
      expected: 'success',
    },
  ] satisfies Array<{
    label: string
    queryState: Parameters<typeof deriveQueryVisibleState>[0]
    expected: RuntimeQueryVisibleState
  }>)('derives the visible query state for $label', ({ queryState, expected }) => {
    expect(deriveQueryVisibleState(queryState)).toBe(expected)
  })

  it('applies query state feedback defaults and selective overrides without affecting other states', () => {
    const feedback = {
      query: 'searchUsers',
      states: {
        idle: {
          mode: 'fallback',
          fallback: [
            {
              type: 'paragraph',
              props: {
                text: 'Run a search first',
              },
            },
          ],
        },
        error: {
          mode: 'show',
        },
      },
    } as const

    expect(
      resolveQueryStateFeedback(feedback, {
        status: 'idle',
        data: null,
        error: null,
      }),
    ).toEqual({
      visibleState: 'idle',
      mode: 'fallback',
      fallback: [
        {
          type: 'paragraph',
          props: {
            text: 'Run a search first',
          },
        },
      ],
    })

    expect(
      resolveQueryStateFeedback(feedback, {
        status: 'loading',
        data: ['Ada'],
        error: null,
      }),
    ).toEqual({
      visibleState: 'loading',
      mode: 'hide',
    })

    expect(
      resolveQueryStateFeedback(feedback, {
        status: 'error',
        data: null,
        error: {
          code: 'network',
          message: 'Could not load users.',
        },
      }),
    ).toEqual({
      visibleState: 'error',
      mode: 'show',
    })

    expect(
      resolveQueryStateFeedback(feedback, {
        status: 'success',
        data: [],
        error: null,
      }),
    ).toEqual({
      visibleState: 'empty',
      mode: 'hide',
    })

    expect(
      resolveQueryStateFeedback(feedback, {
        status: 'success',
        data: ['Ada'],
        error: null,
      }),
    ).toEqual({
      visibleState: 'success',
      mode: 'show',
    })
  })

  it('keeps query state across page changes inside the same runtime instance', async () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page from query fixture' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"success","data":["Ada","Grace"],"error":null,"requestSignature":null}}',
    )
  })

  it('executes a declared operation by name and stores the successful result in queries', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ results: ['Ada', 'Grace'] }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'success',
        data: { results: ['Ada', 'Grace'] },
        error: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )
  })

  it('keeps the last successful data while the operation reload is in flight', async () => {
    let resolveFetch: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="searchUsers" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
      status: 'loading',
      data: ['Ada'],
      error: null,
    })
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )

    if (resolveFetch) {
      resolveFetch(
        new Response(JSON.stringify({ results: ['Ada', 'Grace'] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      )
    }

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'success',
        data: { results: ['Ada', 'Grace'] },
        error: null,
      }),
    )
  })

  it('stores stable query errors without dropping the last successful data', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="searchUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ message: 'Boom' }), {
              status: 500,
              headers: {
                'content-type': 'application/json',
              },
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed prior query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers).toMatchObject({
        status: 'error',
        data: ['Ada'],
        error: {
          code: 'http-error',
          message: 'The api operation "searchUsers" failed with HTTP status 500.',
        },
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.searchUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"GET","operationName":"searchUsers","query":{"search":"Ada"}}',
    )
  })

  it('stores an operation-not-found error without calling fetch', async () => {
    const fetchMock = vi.fn()

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="missingOperation" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.missingOperation).toEqual({
        status: 'error',
        data: null,
        error: {
          code: 'operation-not-found',
          message: 'The api operation "missingOperation" does not exist.',
        },
        requestSignature: null,
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores a request-build-failed error without calling fetch when references are not resolvable', async () => {
    const fetchMock = vi.fn()

    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture operationName="invalidSearch" fetchMock={fetchMock} />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.invalidSearch).toEqual({
        status: 'error',
        data: null,
        error: {
          code: 'request-build-failed',
          message: 'The api operation "invalidSearch" could not resolve "forms.userSearch.missingField" for "query.search".',
        },
        requestSignature: null,
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores data null in queries when an operation succeeds with an empty response body', async () => {
    render(
      <RuntimeStateProvider config={runtimeApiConfig}>
        <QueryOperationFixture
          operationName="clearUsers"
          fetchMock={vi.fn().mockResolvedValue(
            new Response(null, {
              status: 204,
            }),
          )}
        />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Execute operation' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.clearUsers).toMatchObject({
        status: 'success',
        data: null,
        error: null,
      }),
    )
    expect(readRuntimeStateSnapshot('runtime-state').queries.clearUsers.requestSignature).toBe(
      '{"endpoint":"/api/users","method":"DELETE","operationName":"clearUsers"}',
    )
  })

  it('keeps navigation, forms and queries isolated across multiple runtime instances', async () => {
    render(
      <>
        <RuntimeStateProvider config={runtimeConfig}>
          <RuntimeInstanceFixture name="first" initialPage="home" />
        </RuntimeStateProvider>
        <RuntimeStateProvider
          config={{
            ...runtimeConfig,
            initialPage: 'details',
          }}
        >
          <RuntimeInstanceFixture name="second" initialPage="details" />
        </RuntimeStateProvider>
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'first navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'first set query success' }))

    await waitFor(() => expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"details"'))
    expect(screen.getByTestId('first-state')).toHaveTextContent('"value":"first-value"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"data":["first-query"]')

    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"value":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('creates a clean shared state when the runtime unmounts and mounts again', async () => {
    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single" initialPage="home" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'single navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set query success' }))

    await waitFor(() => expect(screen.getByTestId('single-state')).toHaveTextContent('"currentPageId":"details"'))
    expect(screen.getByTestId('single-state')).toHaveTextContent('"value":"single-value"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"data":["single-query"]')

    unmount()
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single-remount" initialPage="home" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"value":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('cleans declarative form state on unmount and reinitializes defaults on the next mount by default', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'textarea',
                  props: {
                    fieldId: 'bio',
                    label: 'Bio',
                    defaultValue: 'Builder',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Bio')).toHaveValue('Builder')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Ada"')
  })

  it('preserves declarative form values across unmount and remount when persistOnUnmount is enabled', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              persistOnUnmount: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Grace"')
  })

  it('invalidates default-persistence form state when the active page entry changes within the same page', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Stay on Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Ada' } })
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Manual Ada')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Grace')
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Grace' })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Stay on Grace' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Manual Grace')
    expect(readRuntimeStateSnapshot('runtime-state').navigation.history).toEqual([
      { entryId: 0, pageId: 'home', params: {} },
      { entryId: 1, pageId: 'home', params: { userId: 'Ada' } },
      { entryId: 2, pageId: 'home', params: { userId: 'Grace' } },
    ])
  })

  it('keeps same-page form values across page-entry changes when persistOnUnmount is enabled', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              persistOnUnmount: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'params.userId',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Edit Ada',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Ada',
                  },
                },
              },
            },
            {
              type: 'button',
              props: {
                label: 'Edit Grace',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                  params: {
                    userId: 'Grace',
                  },
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pinned value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada' }))
    await waitFor(() => expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Ada' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Pinned value')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Grace' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Pinned value'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Pinned value')
    expect(readRuntimeStateSnapshot('runtime-state').pageEntry.params).toEqual({ userId: 'Grace' })
  })

  it('reinitializes a reused form node when navigation activates a different page entry', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Home profile',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go to details',
                action: {
                  type: 'navigateTo',
                  pageId: 'details',
                },
              },
            },
          ],
        },
        {
          id: 'details',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Details profile',
                  },
                },
              ],
            },
            {
              type: 'button',
              props: {
                label: 'Go home',
                action: {
                  type: 'navigateTo',
                  pageId: 'home',
                },
              },
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual home value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go to details' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'))
    expect(screen.getByLabelText('Name')).toHaveValue('Details profile')
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Details profile')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Manual details value' } })
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    expect(screen.getByLabelText('Name')).toHaveValue('Home profile')
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Home profile')
  })

  it('keeps form state when the form is hidden and shown again within the same page', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              visibility: {
                reference: 'forms.visibilityControl.mode',
                operator: 'equals',
                value: 'show',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FormVisibilityFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide profile form' }))

    await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Grace"')

    fireEvent.click(screen.getByRole('button', { name: 'Show profile form' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Grace'))
    expect(readRuntimeStateSnapshot('runtime-state').forms['profile-form']?.name?.value).toBe('Grace')
  })

  it('keeps query-driven defaults stable while mounted and rebuilds them from the latest query data after remount', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [],
        },
        {
          id: 'editor',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'nickname',
                    label: 'Nickname',
                    defaultValue: 'queries.selectedUser.data.profile.nickname',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <QueryDrivenFormLifecycleFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed Countess' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    await waitFor(() => expect(screen.getByLabelText('Nickname')).toHaveValue('Countess'))

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Manual nickname' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seed Architect' }))

    expect(screen.getByLabelText('Nickname')).toHaveValue('Manual nickname')

    fireEvent.click(screen.getByRole('button', { name: 'Leave editor' }))
    await waitFor(() => expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home'))
    fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))

    await waitFor(() => expect(screen.getByLabelText('Nickname')).toHaveValue('Architect'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"nickname":{"value":"Architect"')
  })

  it('keeps declarative forms isolated and normalizes select state to strings', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 2,
                    items: [
                      { label: '', value: '' },
                      { label: 'Editor', value: 2 },
                    ],
                  },
                },
              ],
            },
            {
              type: 'form',
              id: 'preferences-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'theme',
                    label: 'Theme',
                    defaultValue: 'missing',
                    items: [{ label: 'Light', value: 'light' }],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue('2')
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"2"')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"theme":{"value":""')
  })

  it('applies dynamic select defaults only on first effective initialization and does not reinitialize when options arrive later', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'lateRole',
                    label: 'Late role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'select',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'visibleRole',
                    label: 'Visible role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByRole('combobox', { name: 'Late role' })).toHaveValue('')
    expect(screen.queryByRole('combobox', { name: 'Visible role' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    expect(screen.getByRole('combobox', { name: 'Late role' })).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Seed dynamic visibility success' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Visible role' })).toHaveValue('editor'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"lateRole":{"value":"","error":null')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"visibleRole":{"value":"editor","error":null')
  })

  it('stores select.multiple as an ordered string array and resets it through the shared form state', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    multiple: true,
                    defaultValue: ['publish', 'read'],
                    items: {
                      values: ['read', 'write', 'publish'],
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Reset scopes',
                    action: {
                      type: 'resetForm',
                      formId: 'profile-form',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    const scopes = screen.getByRole('listbox', { name: 'Scopes' }) as HTMLSelectElement

    expect(Array.from(scopes.selectedOptions, (option) => option.value)).toEqual(['read', 'publish'])
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","publish"]')

    const options = within(scopes).getAllByRole('option')
    ;(options[0] as HTMLOptionElement).selected = true
    ;(options[1] as HTMLOptionElement).selected = true
    ;(options[2] as HTMLOptionElement).selected = false
    fireEvent.change(scopes)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","write"]')

    fireEvent.click(screen.getByRole('button', { name: 'Reset scopes' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["read","publish"]')
  })

  it('keeps inline radioGroup as a single string value and cleans it when the dynamic option disappears', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    optionLayout: 'inline',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Editor' })).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Editor' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Editor' }))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"editor"')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Editor' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":null')
  })

  it('shares multiple-selection semantics between inline checkboxGroup and select.multiple for cleanup and submit payloads', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            scopes: 'forms.profileForm.scopes',
            teams: 'forms.profileForm.teams',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    multiple: true,
                    defaultValue: ['editor', 'admin'],
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'teams',
                    label: 'Teams',
                    optionLayout: 'inline',
                    defaultValue: ['editor', 'admin'],
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit dynamic groups',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Scopes' })).toBeInTheDocument())

    const scopes = screen.getByRole('listbox', { name: 'Scopes' }) as HTMLSelectElement
    const scopeOptions = within(scopes).getAllByRole('option')
    ;(scopeOptions[0] as HTMLOptionElement).selected = true
    ;(scopeOptions[1] as HTMLOptionElement).selected = true
    fireEvent.change(scopes)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Admin' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Editor' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":["admin","editor"]')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"teams":{"value":["admin","editor"]')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByTestId('runtime-state')).toHaveTextContent('"scopes":{"value":[],"error":null'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"teams":{"value":[],"error":null')

    fireEvent.click(screen.getByRole('button', { name: 'Submit dynamic groups' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        scopes: [],
        teams: [],
      }),
    })
  })

  it('blocks submit for visible required fields, clears errors on valid change and ignores hidden required fields', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: '',
                  },
                },
                {
                  type: 'radioGroup',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                      loading: {
                        mode: 'show',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    optionLayout: 'inline',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: '',
                    items: [
                      { label: 'Editor', value: 'editor' },
                      { label: 'Admin', value: 'admin' },
                    ],
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <FormRuntimeFixture />
      </RuntimeStateProvider>,
    )

    const form = screen.getByTestId('runtime-page').querySelector('form')
    expect(form).not.toBeNull()

    fireEvent.submit(form!)

    expect(screen.getAllByText('Required')).toHaveLength(1)
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"","error":"Required"')

    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Ada' } })

    await waitFor(() => expect(screen.queryByText('Required')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility loading' }))
    fireEvent.submit(form!)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))
    fireEvent.submit(form!)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')
  })

  it('preserves hidden field state and allows submit while a visibility-hidden required field stays out of validation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            name: 'forms.profileForm.name',
            nickname: 'forms.profileForm.nickname',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 'admin',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'Editor', value: 'editor' },
                    ],
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.profileForm.role',
                    operator: 'equals',
                    value: 'admin',
                  },
                  props: {
                    fieldId: 'nickname',
                    label: 'Nickname',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Nickname' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })

    await waitFor(() => expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"nickname":{"value":"","error":"Required","touched":true,"dirty":true,"defaultValue":"Ada"}',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    await waitFor(() => {
      const nicknameInput = screen.getByText('Nickname').closest('label')?.querySelector('input')
      expect(nicknameInput).not.toBeNull()
      expect(nicknameInput).toHaveValue('')
    })
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('does not validate required fields nested inside a visibility-hidden container', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          query: {
            clientType: 'forms.dynamicForm.clientType',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'dynamicForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'radioGroup',
                  props: {
                    fieldId: 'clientType',
                    label: 'Tipo de cliente',
                    optionLayout: 'inline',
                    items: [
                      { label: 'Particular', value: 'particular' },
                      { label: 'Empresa', value: 'empresa' },
                    ],
                    defaultValue: 'particular',
                  },
                },
                {
                  type: 'container',
                  visibility: {
                    reference: 'forms.dynamicForm.clientType',
                    operator: 'equals',
                    value: 'empresa',
                  },
                  children: [
                    {
                      type: 'input',
                      props: {
                        fieldId: 'company_cif',
                        label: 'CIF',
                        validations: {
                          required: {
                            value: true,
                          },
                        },
                        defaultValue: '',
                      },
                    },
                  ],
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.queryByRole('textbox', { name: 'CIF' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"company_cif"')
  })

  it('allows submit while a queryStateFeedback-hidden required field stays hidden and revalidates it when visible again', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            name: 'forms.profileForm.name',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                  },
                },
                {
                  type: 'input',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      loading: {
                        mode: 'hide',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  props: {
                    fieldId: 'roleCode',
                    label: 'Role code',
                    defaultValue: '',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <FormRuntimeFixture />
      </RuntimeStateProvider>,
    )

    expect(screen.queryByRole('textbox', { name: 'Role code' })).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"roleCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"roleCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))

    await waitFor(() => {
      const roleCodeInput = screen.getByText('Role code').closest('label')?.querySelector('input')
      expect(roleCodeInput).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"roleCode":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility loading' }))

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Role code' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"roleCode":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))

    await waitFor(() => {
      const roleCodeInput = screen.getByText('Role code').closest('label')?.querySelector('input')
      expect(roleCodeInput).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('blocks submit for repeater form fields whose visibility depends on the current item context', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: {
                  source: 'queries.profiles.data',
                  key: 'id',
                },
                template: [
                  {
                    type: 'form',
                    id: 'profileForm',
                    submitAction: {
                      type: 'executeOperation',
                      operationName: 'submitProfile',
                    },
                    children: [
                      {
                        type: 'input',
                        props: {
                          fieldId: 'name',
                          label: 'Name',
                          defaultValue: 'Ada',
                        },
                      },
                      {
                        type: 'input',
                        visibility: {
                          reference: 'item.requiresCode',
                          operator: 'equals',
                          value: true,
                        },
                        props: {
                          fieldId: 'roleCode',
                          label: 'Role code',
                          defaultValue: '',
                          validations: {
                            required: {
                              value: true,
                            },
                          },
                        },
                      },
                      {
                        type: 'button',
                        props: {
                          label: 'Submit profile',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RepeaterFormFixture />
      </RuntimeStateProvider>,
    )

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Role code' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('initializes visibility-controlled fields lazily, keeps queryStateFeedback precedence, and supports length-based rules for input textarea and select', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: '',
                    items: [
                      { label: '', value: '' },
                      { label: 'Admin', value: 'admin' },
                    ],
                  },
                },
                {
                  type: 'input',
                  queryStateFeedback: {
                    query: 'visibilityQuery',
                    states: {
                      idle: {
                        mode: 'hide',
                      },
                      success: {
                        mode: 'show',
                      },
                    },
                  },
                  visibility: {
                    reference: 'forms.profileForm.role',
                    operator: 'equals',
                    value: 'admin',
                  },
                  props: {
                    fieldId: 'secretCode',
                    label: 'Secret code',
                    defaultValue: 'queries.selectedUser.data.profile.nickname',
                  },
                },
                {
                  type: 'textarea',
                  visibility: {
                    reference: 'queries.thresholdQuery.data',
                    operator: 'greaterThan',
                    value: 1,
                  },
                  props: {
                    fieldId: 'notes',
                    label: 'Notes',
                    defaultValue: '',
                  },
                },
                {
                  type: 'select',
                  visibility: {
                    reference: 'queries.thresholdQuery.data',
                    operator: 'lessThan',
                    value: 1,
                  },
                  props: {
                    fieldId: 'reviewer',
                    label: 'Reviewer',
                    defaultValue: '',
                    items: [
                      { label: '', value: '' },
                      { label: 'Lead', value: 'lead' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <VisibilityRuleQueryFixture />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed conditional selected user' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } })

    expect(screen.queryByRole('textbox', { name: 'Secret code' })).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).not.toHaveTextContent('"secretCode"')

    fireEvent.click(screen.getByRole('button', { name: 'Set conditional visibility success' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Secret code' })).toHaveValue('Countess'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"secretCode":{"value":"Countess"')

    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Reviewer' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed threshold list' }))

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument())
    expect(screen.queryByRole('combobox', { name: 'Reviewer' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seed threshold empty list' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Reviewer' })).toBeInTheDocument())
    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument()
  })

  it('applies ordered local validations on submit for text, number, and multiselect fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'username',
                    label: 'Username',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 3 },
                      required: { value: true },
                      maxLength: { value: 5 },
                    },
                  },
                },
                {
                  type: 'input',
                  props: {
                    fieldId: 'age',
                    label: 'Age',
                    inputType: 'number',
                    defaultValue: 16,
                    validations: {
                      min: { value: 18 },
                      max: { value: 65 },
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    optionLayout: 'inline',
                    defaultValue: ['read'],
                    items: [
                      { label: 'Read', value: 'read' },
                      { label: 'Write', value: 'write' },
                      { label: 'Deploy', value: 'deploy' },
                      { label: 'Audit', value: 'audit' },
                    ],
                    validations: {
                      minSelections: { value: 2 },
                      maxSelections: { value: 3 },
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
      expect(screen.getByText('Must be at least 18.')).toBeInTheDocument()
      expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcdef' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /Age/ }), { target: { value: '70' } })
    fireEvent.click(screen.getByLabelText('Write'))
    fireEvent.click(screen.getByLabelText('Deploy'))
    fireEvent.click(screen.getByLabelText('Audit'))

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at most 5 characters.')).toBeInTheDocument()
      expect(screen.getByText('Must be at most 65.')).toBeInTheDocument()
      expect(screen.getByText('Select no more than 3 options.')).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores hidden advanced validation rules during submit while preserving the hidden field error state', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 'admin',
                    items: [
                      { label: 'Admin', value: 'admin' },
                      { label: 'Editor', value: 'editor' },
                    ],
                  },
                },
                {
                  type: 'input',
                  visibility: {
                    reference: 'forms.profileForm.role',
                    operator: 'equals',
                    value: 'admin',
                  },
                  props: {
                    fieldId: 'secret',
                    label: 'Secret',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 4 },
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(screen.getByText('Must be at least 4 characters.')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Secret' })).not.toBeInTheDocument())
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"secret":{"value":"","error":"Must be at least 4 characters."')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('preserves the previous field error when editing causes that same field to become hidden', () => {
    const fieldDefinition: ResolvedFormFieldDefinition = {
      fieldId: 'secret',
      type: 'input',
      validations: {
        minLength: { value: 6 },
      },
      visibility: {
        reference: 'forms.profileForm.secret',
        operator: 'notEquals',
        value: 'hide',
      },
      multiple: false,
      defaultValue: 'abc',
      inputType: 'text',
    }

    const state: RuntimeState = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {
        profileForm: {
          secret: {
            value: 'abc',
            error: 'Must be at least 6 characters.',
            touched: false,
            dirty: true,
            defaultValue: 'abc',
          },
        },
      },
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    expect(
      getValidationErrorForEditedField({
        fieldDefinition,
        formId: 'profileForm',
        state,
        nextValue: 'hide',
      }),
    ).toBe('Must be at least 6 characters.')
  })

  it('reevaluates edited multiselect fields against their normalized effective value', () => {
    const fieldDefinition: ResolvedFormFieldDefinition = {
      fieldId: 'scopes',
      type: 'checkboxGroup',
      validations: {
        minSelections: { value: 2 },
      },
      items: [
        { label: 'Read', value: 'read' },
        { label: 'Write', value: 'write' },
      ],
      multiple: true,
      defaultValue: [],
    }

    const state: RuntimeState = {
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 0, pageId: 'home', params: {} }],
        lastError: null,
      },
      forms: {
        profileForm: {
          scopes: {
            value: [],
            error: 'Select at least 2 options.',
            touched: false,
            dirty: true,
            defaultValue: [],
          },
        },
      },
      queries: {},
      pageEntry: {
        entryId: 0,
        pageId: 'home',
        params: {},
        preloadNames: [],
        status: 'idle',
      },
    }

    expect(
      getValidationErrorForEditedField({
        fieldDefinition,
        formId: 'profileForm',
        state,
        nextValue: ['read', 'missing'],
      }),
    ).toBe('Select at least 2 options.')
  })

  it('reevaluates field errors locally instead of clearing them blindly while editing', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'username',
                    label: 'Username',
                    defaultValue: '',
                    validations: {
                      minLength: { value: 3 },
                      maxLength: { value: 5 },
                    },
                  },
                },
                {
                  type: 'checkboxGroup',
                  props: {
                    fieldId: 'scopes',
                    label: 'Scopes',
                    defaultValue: [],
                    items: [
                      { label: 'Read', value: 'read' },
                      { label: 'Write', value: 'write' },
                      { label: 'Deploy', value: 'deploy' },
                      { label: 'Audit', value: 'audit' },
                    ],
                    validations: {
                      minSelections: { value: 2 },
                      maxSelections: { value: 3 },
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
      expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'ab' } })
    fireEvent.click(screen.getByLabelText('Read'))

    expect(screen.getByText('Must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Select at least 2 options.')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abc' } })
    fireEvent.click(screen.getByLabelText('Write'))

    await waitFor(() => {
      expect(screen.queryByText('Must be at least 3 characters.')).not.toBeInTheDocument()
      expect(screen.queryByText('Select at least 2 options.')).not.toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcdef' } })
    fireEvent.click(screen.getByLabelText('Deploy'))
    fireEvent.click(screen.getByLabelText('Audit'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => {
      expect(screen.getByText('Must be at most 5 characters.')).toBeInTheDocument()
      expect(screen.getByText('Select no more than 3 options.')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: /Username/ }), { target: { value: 'abcd' } })
    fireEvent.click(screen.getByLabelText('Audit'))

    await waitFor(() => {
      expect(screen.queryByText('Must be at most 5 characters.')).not.toBeInTheDocument()
      expect(screen.queryByText('Select no more than 3 options.')).not.toBeInTheDocument()
    })
  })

  it('cleans a dynamic select value when its option disappears and submits the empty value', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            role: 'forms.profileForm.role',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    validations: {
                      required: {
                        value: true,
                      },
                    },
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit dynamic profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"editor"')

    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":null')

    fireEvent.click(screen.getByRole('button', { name: 'Submit dynamic profile' }))

    await waitFor(() => expect(screen.getByText('Required')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits the cleaned empty string after a dynamic select loses its selected option', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            role: 'forms.profileForm.role',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              children: [
                {
                  type: 'select',
                  props: {
                    fieldId: 'role',
                    label: 'Role',
                    defaultValue: 'editor',
                    items: {
                      source: 'queries.roleCatalog.data.results',
                      label: 'label',
                      value: 'id',
                    },
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit cleaned dynamic profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <DynamicSelectQueryFixture />
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed role catalog' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), { target: { value: 'editor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Seed replacement role catalog' }))

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(''))

    fireEvent.click(screen.getByRole('button', { name: 'Submit cleaned dynamic profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        role: '',
      }),
    })
  })

  it('submits declarative forms with the latest field values and resets them after a successful submit', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )

    const config: RuntimeConfig = {
      api: {
        submitProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            name: 'forms.profileForm.name',
          },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profileForm',
              submitAction: {
                type: 'executeOperation',
                operationName: 'submitProfile',
              },
              resetOnSuccess: true,
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: 'Ada',
                  },
                },
                {
                  type: 'button',
                  props: {
                    label: 'Submit profile',
                  },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        name: 'Grace',
      }),
    })
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ada'))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"submitProfile":{"status":"success"')
  })
})
