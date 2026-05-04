import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import type { RuntimeState } from '../runtime/runtime-state/runtime-state-types'
import {
  deriveQueryVisibleState,
  resolveQueryStateFeedback,
  type RuntimeQueryVisibleState,
} from '../runtime/runtime-query-state-feedback'
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
import {
  selectFormFieldValue,
  selectNestedQueryDataValue,
  selectPageEntryState,
  selectQueryVisibleState,
  selectQueryReferenceValue,
} from '../runtime/runtime-state/runtime-state-selectors'

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
  const { initializeForm, navigateToPage, resetForm, setFormFieldError, setFormFieldValue } =
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
    expect(screen.getByTestId('first-state')).toHaveTextContent('"history":["home"]')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"history":["details"]')
    expect(screen.getByTestId('first-state')).toHaveTextContent(
      '"pageEntry":{"entryId":0,"pageId":"home","preloadNames":[],"status":"idle"}',
    )
    expect(screen.getByTestId('second-state')).toHaveTextContent(
      '"pageEntry":{"entryId":0,"pageId":"details","preloadNames":[],"status":"idle"}',
    )
  })

  it('initializes navigation, forms and queries in the base state', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"navigation":{"currentPageId":"home","history":["home"],"lastError":null}',
    )
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"forms":{}')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"queries":{}')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"pageEntry":{"entryId":0,"pageId":"home","preloadNames":[],"status":"idle"}',
    )
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
    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"history":["details"]')
    expect(screen.getByTestId('navigation-state')).toHaveTextContent('"lastError":null')
    expect(screen.getByTestId('navigation-state')).toHaveTextContent(
      '"pageEntry":{"entryId":0,"pageId":"details","preloadNames":[],"status":"idle"}',
    )
  })

  it('resets the full runtime state back to the initial instance snapshot', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <ResetOnMount />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"history":["home"]')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"forms":{}')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent('"queries":{}')
    expect(screen.getByTestId('state-after-reset')).toHaveTextContent(
      '"pageEntry":{"entryId":0,"pageId":"home","preloadNames":[],"status":"idle"}',
    )
  })

  it('renders the visible page from navigation.currentPageId and changes it without touching the URL', () => {
    const initialPathname = window.location.pathname

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(window.location.pathname).toBe(initialPathname)
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

  it('goes back to the previous valid history entry and prunes the current one', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <NavigationControls />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Navigate to details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"navigation":{"currentPageId":"home","history":["home"],"lastError":null}',
    )
  })

  it('supports goBack after revisiting a page and returns to the previous entry in history order', () => {
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

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"navigation":{"currentPageId":"details","history":["home","details"],"lastError":null}',
    )
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
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"navigation":{"currentPageId":"home","history":["home"],"lastError":null}',
    )
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
        history: ['home'],
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

  it('keeps form state across page changes inside the same runtime instance', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FormsFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Update user name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
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
      '"queries":{"searchUsers":{"status":"idle","data":null,"error":null}}',
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
      '"queries":{"searchUsers":{"status":"loading","data":["Ada","Grace"],"error":null}}',
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
      '"queries":{"searchUsers":{"status":"error","data":null,"error":{"code":"network","message":"Could not load users."}}}',
    )
  })

  it('exposes selector helpers for forms and query reference paths without mutating runtime state', () => {
    const snapshot = {
      navigation: {
        currentPageId: 'home',
        history: ['home'],
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
        },
      },
      pageEntry: {
        entryId: 2,
        pageId: 'home',
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
    expect(selectQueryVisibleState(snapshot, 'missingQuery')).toBe('loading')
    expect(selectPageEntryState(snapshot)).toBe(snapshot.pageEntry)
  })

  it.each([
    {
      label: 'missing query state',
      queryState: null,
      expected: 'loading',
    },
    {
      label: 'idle query state',
      queryState: {
        status: 'idle',
        data: null,
        error: null,
      },
      expected: 'loading',
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
        loading: {
          mode: 'fallback',
          fallback: [
            {
              type: 'paragraph',
              props: {
                text: 'Loading users...',
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
      visibleState: 'loading',
      mode: 'fallback',
      fallback: [
        {
          type: 'paragraph',
          props: {
            text: 'Loading users...',
          },
        },
      ],
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

  it('keeps query state across page changes inside the same runtime instance', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to details page from query fixture' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"success","data":["Ada","Grace"],"error":null}}',
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"queries":{"searchUsers":{"status":"success","data":{"results":["Ada","Grace"]},"error":null}}',
      ),
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

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"loading","data":["Ada"],"error":null}}',
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"queries":{"searchUsers":{"status":"success","data":{"results":["Ada","Grace"]},"error":null}}',
      ),
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"queries":{"searchUsers":{"status":"error","data":["Ada"],"error":{"code":"http-error","message":"The api operation \\"searchUsers\\" failed with HTTP status 500."}}}',
      ),
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"missingOperation":{"status":"error","data":null,"error":{"code":"operation-not-found","message":"The api operation \\"missingOperation\\" does not exist."}}',
      ),
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"invalidSearch":{"status":"error","data":null,"error":{"code":"request-build-failed","message":"The api operation \\"invalidSearch\\" could not resolve \\"forms.userSearch.missingField\\" for \\"query.search\\"."}}',
      ),
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
      expect(screen.getByTestId('runtime-state')).toHaveTextContent(
        '"clearUsers":{"status":"success","data":null,"error":null}',
      ),
    )
  })

  it('keeps navigation, forms and queries isolated across multiple runtime instances', () => {
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

    expect(screen.getByTestId('first-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"value":"first-value"')
    expect(screen.getByTestId('first-state')).toHaveTextContent('"data":["first-query"]')

    expect(screen.getByTestId('second-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"value":"details"')
    expect(screen.getByTestId('second-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('creates a clean shared state when the runtime unmounts and mounts again', () => {
    const { unmount } = render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single" initialPage="home" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'single navigate' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set form value' }))
    fireEvent.click(screen.getByRole('button', { name: 'single set query success' }))

    expect(screen.getByTestId('single-state')).toHaveTextContent('"currentPageId":"details"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"value":"single-value"')
    expect(screen.getByTestId('single-state')).toHaveTextContent('"data":["single-query"]')

    unmount()

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <RuntimeInstanceFixture name="single-remount" initialPage="home" />
      </RuntimeStateProvider>,
    )

    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"currentPageId":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"value":"home"')
    expect(screen.getByTestId('single-remount-state')).toHaveTextContent('"status":"idle","data":null,"error":null')
  })

  it('initializes declarative form fields once and preserves user values across navigation', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Go home' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Grace')
    expect(screen.getByLabelText('Bio')).toHaveValue('Builder')
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Grace"')
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
                    required: true,
                    defaultValue: '',
                  },
                },
                {
                  type: 'select',
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
                    fieldId: 'role',
                    label: 'Role',
                    required: true,
                    defaultValue: '',
                    items: [
                      { label: '', value: '' },
                      { label: 'Editor', value: 'editor' },
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

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility success' }))
    fireEvent.submit(form!)

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')

    fireEvent.click(screen.getByRole('button', { name: 'Set visibility loading' }))
    fireEvent.submit(form!)

    expect(screen.queryByRole('combobox', { name: 'Role' })).not.toBeInTheDocument()
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"role":{"value":"","error":"Required"')
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
