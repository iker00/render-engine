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
import {
  RuntimeStateProvider,
  useRuntimeState,
  useRuntimeStateActions,
} from '../../runtime/runtime-state/runtime-state-provider'
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
