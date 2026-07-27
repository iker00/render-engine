import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeState } from '../../runtime/runtime-state/runtime-state-types'
import {
  deriveQueryVisibleState,
  resolveQueryStateFeedback,
  type RuntimeQueryVisibleState,
} from '../../runtime/runtime-query-state-feedback'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeState, useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'
import { RuntimePage } from '../../runtime/runtime-page'
import {
  selectFormFieldValue,
  selectNestedQueryDataValue,
  selectPageEntryState,
  selectQueryVisibleState,
  selectQueryReferenceValue,
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

  it('clears data to null when a query transitions to error after having successful data', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Store query error' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"error","data":null,"error":{"code":"network","message":"Could not load users."},"requestSignature":null}}',
    )
  })

  it('clears data to null when a query transitions to error from loading with stale data', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reload query' }))
    fireEvent.click(screen.getByRole('button', { name: 'Store query error' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"error","data":null,"error":{"code":"network","message":"Could not load users."},"requestSignature":null}}',
    )
  })

  it('rehidrates data normally when set-success is dispatched after a set-error transition', () => {
    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <QueriesFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Store query error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Store query success' }))

    expect(screen.getByTestId('runtime-state')).toHaveTextContent(
      '"queries":{"searchUsers":{"status":"success","data":["Ada","Grace"],"error":null,"requestSignature":null}}',
    )
  })

  it('keeps the last successful query data while the same query reloads (set-loading does not clear data)', () => {
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
})

describe('Form submitAction.onSuccess', () => {
  function makeSuccessFetch() {
    return vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  }

  function makeErrorFetch() {
    return vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  }

  it('navigates to pageId from onSuccess after a successful executeOperation submit', async () => {
    const fetchMock = makeSuccessFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
  })

  it('does not execute onSuccess actions when the submit fails', async () => {
    const fetchMock = makeErrorFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
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

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.saveProfile?.status).toBe('error'),
    )

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
  })

  it('only executes onSuccess actions whose when condition is met', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [
                {
                  type: 'navigateTo',
                  pageId: 'details',
                  when: {
                    reference: 'queries.saveProfile.data.status',
                    operator: 'equals',
                    value: 'ok',
                  },
                },
                {
                  type: 'navigateTo',
                  pageId: 'other',
                  when: {
                    reference: 'queries.saveProfile.data.status',
                    operator: 'equals',
                    value: 'pending',
                  },
                },
              ],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
        { id: 'other', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )
  })

  it('executes both onSuccess actions in order when both when conditions are met', async () => {
    const fetchMock = makeSuccessFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
        },
        reloadUser: {
          method: 'GET',
          endpoint: '/api/user',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [
                { type: 'executeOperation', operationName: 'reloadUser' },
                { type: 'navigateTo', pageId: 'details' },
              ],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/profile')
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/user')
  })

  it('resets form after executing onSuccess actions when resetOnSuccess is true', async () => {
    const fetchMock = makeSuccessFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: {
            name: 'forms.profile-form.name',
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
              id: 'profile-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              resetOnSuccess: true,
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"name":{"value":"Ada"')

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['profile-form']?.name?.value).toBe(''),
    )
  })

  it('executes onSuccess and resetOnSuccess for executeOperations when all entries succeed', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'POST', endpoint: '/api/op2' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'multi-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              resetOnSuccess: true,
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit multi' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
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
    fireEvent.click(screen.getByRole('button', { name: 'Submit multi' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['multi-form']?.name?.value).toBe(''),
    )
  })

  it('does not execute onSuccess when executeOperations has a failing entry', async () => {
    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'POST', endpoint: '/api/op2' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'multi-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit multi fail' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
    }

    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      )

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit multi fail' }))

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.op2?.status).toBe('error'),
    )

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
  })

  it('executes onSuccess and resetOnSuccess when all executeOperations entries are filtered by when', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'filtered-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'op1',
                    when: {
                      reference: 'forms.filtered-form.name',
                      operator: 'equals',
                      value: 'trigger',
                    },
                  },
                ],
              },
              resetOnSuccess: true,
              onSuccess: [{ type: 'navigateTo', pageId: 'details' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit filtered' },
                },
              ],
            },
          ],
        },
        { id: 'details', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'no-match' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit filtered' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details'),
    )

    expect(fetchMock).not.toHaveBeenCalled()

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['filtered-form']?.name?.value).toBe(''),
    )
  })

  it('evaluates onSuccess when against queries data after the successful submit operation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: 'approved' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const config: RuntimeConfig = {
      api: {
        reviewProfile: {
          method: 'POST',
          endpoint: '/api/review',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'review-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'reviewProfile',
              },
              onSuccess: [
                {
                  type: 'navigateTo',
                  pageId: 'approved',
                  when: {
                    reference: 'queries.reviewProfile.data.result',
                    operator: 'equals',
                    value: 'approved',
                  },
                },
                {
                  type: 'navigateTo',
                  pageId: 'rejected',
                  when: {
                    reference: 'queries.reviewProfile.data.result',
                    operator: 'equals',
                    value: 'rejected',
                  },
                },
              ],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit review' },
                },
              ],
            },
          ],
        },
        { id: 'approved', layout: [] },
        { id: 'rejected', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'approved'),
    )
  })
})

describe('Form submitAction.onError', () => {
  function makeSuccessFetch() {
    return vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  }

  function makeErrorFetch() {
    return vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
  }

  it('navigates to pageId from onError after a failed executeOperation submit (HTTP error)', async () => {
    const fetchMock = makeErrorFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'error-page', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )
  })

  it('navigates to pageId from onError after a business error (errorCondition on 2xx payload)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, message: 'forbidden' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          errorCondition: { path: 'success', equals: false },
          errorMessagePath: 'message',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'error-page', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )
  })

  it('does not execute onError when the submit succeeds; onSuccess executes instead', async () => {
    const fetchMock = makeSuccessFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'success-page'),
    )

    // Must not have navigated to error-page
    expect(screen.getByTestId('runtime-page')).not.toHaveAttribute('data-runtime-page-id', 'error-page')
  })

  it('does not execute onError when submit fails due to local field validation', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
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
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'input',
                  props: {
                    fieldId: 'name',
                    label: 'Name',
                    defaultValue: '',
                    validations: { required: true },
                  },
                },
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'error-page', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Submit without filling required field — triggers local validation failure
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    // Wait for validation error to appear in state
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['profile-form']?.name?.error).toBeTruthy(),
    )

    // Must stay on home page, not navigate to error-page
    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
    // Fetch must not have been called
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('executes onError (not onSuccess) when executeOperations has one failing entry', async () => {
    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'POST', endpoint: '/api/op2' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'multi-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              resetOnSuccess: true,
              onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit multi' },
                },
              ],
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
      ],
    }

    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      )

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit multi' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )

    // Confirm resetOnSuccess was NOT triggered: the form value should still be 'Ada'
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['multi-form']?.name?.value).toBe('Ada'),
    )
  })

  it('does not execute onError when all executeOperations entries are filtered by their when condition', async () => {
    const fetchMock = vi.fn<typeof fetch>()

    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'filtered-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperations',
                operations: [
                  {
                    operationName: 'op1',
                    when: {
                      reference: 'forms.filtered-form.name',
                      operator: 'equals',
                      value: 'trigger',
                    },
                  },
                ],
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit filtered' },
                },
              ],
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Field value 'no-match' does not match 'trigger', so all ops filtered → allSuccess = true
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'no-match' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit filtered' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'success-page'),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('executes onError once when all executeOperations entries fail', async () => {
    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'POST', endpoint: '/api/op2' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'all-fail-form',
              submitAction: {
                type: 'executeOperations',
                operations: [
                  { operationName: 'op1' },
                  { operationName: 'op2' },
                ],
              },
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit all fail' },
                },
              ],
            },
          ],
        },
        { id: 'error-page', layout: [] },
      ],
    }

    globalThis.fetch = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit all fail' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )
  })

  it('evaluates onError when conditions against the post-error snapshot (business error via errorCondition)', async () => {
    // Use a 2xx response with errorCondition so the error.message is populated from the payload
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, message: 'Access denied' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          errorCondition: { path: 'success', equals: false },
          errorMessagePath: 'message',
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [
                {
                  type: 'navigateTo',
                  pageId: 'forbidden-page',
                  when: {
                    reference: 'queries.saveProfile.error.message',
                    operator: 'equals',
                    value: 'Access denied',
                  },
                },
                {
                  type: 'navigateTo',
                  pageId: 'generic-error-page',
                  when: {
                    reference: 'queries.saveProfile.error.message',
                    operator: 'equals',
                    value: 'Other error',
                  },
                },
              ],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'forbidden-page', layout: [] },
        { id: 'generic-error-page', layout: [] },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'forbidden-page'),
    )
  })

  it('executes both onError actions in order when neither has a when condition', async () => {
    const callOrder: string[] = []

    const config: RuntimeConfig = {
      api: {
        op1: { method: 'POST', endpoint: '/api/op1' },
        op2: { method: 'GET', endpoint: '/api/op2' },
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [
                { type: 'executeOperation', operationName: 'op1' },
                { type: 'executeOperation', operationName: 'op2' },
              ],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
      ],
    }

    const successResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    const errorResponse = new Response(JSON.stringify({ error: 'fail' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })

    globalThis.fetch = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/profile')) {
        callOrder.push('saveProfile')
        return Promise.resolve(errorResponse.clone())
      }
      if (url.includes('/api/op1')) {
        callOrder.push('op1')
        return Promise.resolve(successResponse.clone())
      }
      if (url.includes('/api/op2')) {
        callOrder.push('op2')
        return Promise.resolve(successResponse.clone())
      }
      return Promise.resolve(successResponse.clone())
    })

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() =>
      expect(callOrder).toContain('op2'),
    )

    expect(callOrder).toEqual(['saveProfile', 'op1', 'op2'])
  })

  it('executes only onError (not onSuccess) when submit fails with both declared', async () => {
    globalThis.fetch = makeErrorFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )
  })

  it('executes only onSuccess (not onError) when submit succeeds with both declared', async () => {
    globalThis.fetch = makeSuccessFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onSuccess: [{ type: 'navigateTo', pageId: 'success-page' }],
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'success-page', layout: [] },
        { id: 'error-page', layout: [] },
      ],
    }

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'success-page'),
    )
  })

  it('does not trigger resetOnSuccess when submit fails and onError is declared', async () => {
    const fetchMock = makeErrorFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: {
          method: 'POST',
          endpoint: '/api/profile',
          body: { name: 'forms.profile-form.name' },
        },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              persistOnUnmount: true,
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              resetOnSuccess: true,
              onError: [{ type: 'navigateTo', pageId: 'error-page' }],
              children: [
                {
                  type: 'input',
                  props: { fieldId: 'name', label: 'Name', defaultValue: '' },
                },
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'error-page', layout: [] },
      ],
    }

    globalThis.fetch = fetchMock

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    await waitFor(() =>
      expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'error-page'),
    )

    // resetOnSuccess must not have fired: form value should remain 'Ada'
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').forms?.['profile-form']?.name?.value).toBe('Ada'),
    )
  })

  it('does not recursively trigger onError when the onError action itself fails', async () => {
    let submitCount = 0

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
        notifyError: { method: 'POST', endpoint: '/api/notify-error' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [{ type: 'executeOperation', operationName: 'notifyError' }],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
      ],
    }

    globalThis.fetch = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/profile')) {
        submitCount++
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'fail' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
      // notifyError also fails
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'notify fail' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })

    render(
      <RuntimeStateProvider config={config}>
        <RuntimePage />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit profile' }))

    // Wait for notifyError to be dispatched (it fires fire-and-forget)
    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.notifyError?.status).toBe('error'),
    )

    // saveProfile was only submitted once — no recursive cycle
    expect(submitCount).toBe(1)
  })

  it('does not execute any side-effect when onError is an empty array and submit fails', async () => {
    const fetchMock = makeErrorFetch()

    const config: RuntimeConfig = {
      api: {
        saveProfile: { method: 'POST', endpoint: '/api/profile' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'profile-form',
              submitAction: {
                type: 'executeOperation',
                operationName: 'saveProfile',
              },
              onError: [],
              children: [
                {
                  type: 'button',
                  props: { label: 'Submit profile' },
                },
              ],
            },
          ],
        },
        { id: 'other', layout: [] },
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

    await waitFor(() =>
      expect(readRuntimeStateSnapshot('runtime-state').queries.saveProfile?.status).toBe('error'),
    )

    // Must stay on home page — no side effects from empty onError
    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'home')
  })
})

describe('Form state — fileInput field initialization and reset', () => {
  it('auto-initializes a fileInput field to value: [] and defaultValue: [] when the form mounts', async () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'uploadForm',
              children: [
                { type: 'fileInput', props: { fieldId: 'photos', label: 'Fotos' } },
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

    await waitFor(() =>
      expect(screen.getByTestId('runtime-state')).toHaveTextContent('"photos":{'),
    )

    const state = readRuntimeStateSnapshot('runtime-state')
    const fieldState = state.forms['uploadForm']?.['photos']
    expect(fieldState?.value).toEqual([])
    expect(fieldState?.defaultValue).toEqual([])
    expect(fieldState?.error).toBeNull()
  })

  it('resetForm restores a fileInput field to value: [] after files were set via setFormFieldValue', () => {
    function FileInputFixture() {
      const { initializeForm, resetForm, setFormFieldValue } = useRuntimeStateActions()

      useEffect(() => {
        initializeForm('uploadForm', {
          photos: { defaultValue: [] },
        })
      }, [initializeForm])

      return (
        <>
          <button
            type="button"
            onClick={() =>
              setFormFieldValue(
                'uploadForm',
                'photos',
                [new File(['data'], 'shot.jpg', { type: 'image/jpeg' })],
              )
            }
          >
            Add file
          </button>
          <button type="button" onClick={() => resetForm('uploadForm')}>
            Reset form
          </button>
        </>
      )
    }

    render(
      <RuntimeStateProvider config={runtimeConfig}>
        <FileInputFixture />
        <RuntimeStateSnapshot testId="runtime-state" />
      </RuntimeStateProvider>,
    )

    // Add a file — dirty becomes true
    fireEvent.click(screen.getByRole('button', { name: 'Add file' }))
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('"dirty":true')

    // Reset — value must be restored to []
    fireEvent.click(screen.getByRole('button', { name: 'Reset form' }))

    const state = readRuntimeStateSnapshot('runtime-state')
    const fieldState = state.forms['uploadForm']?.['photos']
    expect(fieldState?.value).toEqual([])
    expect(fieldState?.dirty).toBe(false)
  })
})
