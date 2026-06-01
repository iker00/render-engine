import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState, runtimeStateReducer } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return {
    ...render(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: state,
          state,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => state,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    ),
    dispatch,
    dispatchAndSyncState,
  }
}

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
  navigation?: RuntimeState['navigation'],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    navigation: navigation ?? baseState.navigation,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: (navigation ?? baseState.navigation).currentPageId,
      params: navigation?.history[navigation.history.length - 1]?.params ?? baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

function seedRuntimeState(state: RuntimeState) {
  return [
    {
      type: 'forms/initialize',
      payload: {
        formId: 'userSearch',
        fields: {
          name: {
            defaultValue: 'Ada',
          },
        },
      },
    },
    {
      type: 'forms/set-value',
      payload: {
        formId: 'userSearch',
        fieldId: 'name',
        value: 'Grace',
      },
    },
    {
      type: 'queries/initialize',
      payload: {
        queryName: 'searchUsers',
      },
    },
    {
      type: 'queries/set-success',
      payload: {
        queryName: 'searchUsers',
        data: {
          user: {
            profile: {
              name: 'Ada',
              active: true,
            },
          },
          results: [
            {
              id: 'user-1',
              name: 'Ada',
            },
            {
              id: 'user-2',
              name: 'Grace',
            },
          ],
          stats: {
            total: 2,
          },
        },
      },
    },
    {
      type: 'queries/set-error',
      payload: {
        queryName: 'searchUsers',
        error: {
          code: 'network',
          message: 'Could not load users.',
        },
      },
    },
  ].reduce(runtimeStateReducer, state)
}

function renderRuntimePageWithSeed(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const initialState = createRuntimeState(config)
  const seededState = seedRuntimeState(initialState)
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: seededState,
        state: seededState,
        dispatch,
        dispatchAndSyncState,
        getLatestState: () => seededState,
      }}
    >
        <RuntimePage />
    </RuntimeStateContext.Provider>,
  )
}

describe('RuntimePage', () => {
  it('renders button nodes as accessible button elements with stable base classes', () => {
    renderRuntimePage({
      id: 'button-page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Open details',
            action: {
              type: 'navigateTo',
              pageId: 'details',
            },
          },
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Open details' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Open details' })).toHaveClass(
      'inline-flex',
      'items-center',
      'justify-center',
      'rounded-control',
      'border-app-border-strong',
      'bg-white',
      'px-4',
      'py-3',
      'sm:px-3.5',
      'sm:py-2.5',
      'text-sm',
      'font-semibold',
      'text-app-text-strong',
    )
  })

  it('treats button as a leaf node even when it receives children', () => {
    renderRuntimePage({
      id: 'button-leaf',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Back',
            action: {
              type: 'goBack',
            },
          },
          children: [
            {
              type: 'paragraph',
              props: {
                text: 'Unexpected child',
              },
            },
          ],
        },
      ],
    })

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(screen.queryByText('Unexpected child')).not.toBeInTheDocument()
  })

  it('lets a rendered button navigate declaratively to another page', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'button',
              props: {
                label: 'Open details',
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
              type: 'heading',
              props: {
                text: 'Details page',
                level: 1,
              },
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

    fireEvent.click(screen.getByRole('button', { name: 'Open details' }))

    expect(screen.getByTestId('runtime-page')).toHaveAttribute('data-runtime-page-id', 'details')
    expect(screen.getByRole('heading', { name: 'Details page', level: 1 })).toBeInTheDocument()
  })

  it('renders current forms and queries references inside heading and paragraph text', () => {
    renderRuntimePageWithSeed({
      id: 'dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.status',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders nested query data values inside heading and paragraph text when they resolve to text-compatible scalars', () => {
    renderRuntimePageWithSeed({
      id: 'nested-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.1.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.stats.total',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user.profile.active',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Grace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('renders interpolated visible strings in heading, image attributes, and table cells', () => {
    const activePage: RuntimePageConfig = {
      id: 'interpolated-visible-strings',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Hello {{queries.searchUsers.data.user.profile.name}} from {{params.mode}}',
            level: 1,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: '{{forms.userSearch.name}} sees {{queries.searchUsers.data.stats.total}} users',
          },
        },
        {
          type: 'image',
          props: {
            src: '/media/{{queries.searchUsers.data.user.profile.avatarFile}}',
            alt: 'Avatar de {{queries.searchUsers.data.user.profile.name}} {{queries.searchUsers.data.user.profile.nickname}}',
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Metric', 'Value'],
            rows: [
              ['Total {{queries.searchUsers.data.stats.total}}', '{{queries.searchUsers.data.stats.missing}}'],
            ],
          },
        },
        {
          type: 'table',
          props: {
            headers: ['Code', 'Name'],
            rows: {
              source: 'queries.searchUsers.data.results',
              cells: ['{{item.code}}', '{{item.name}} ({{item.status}})'],
            },
          },
        },
      ],
    }
    const navigation = {
      currentPageId: activePage.id,
      history: [
        {
          entryId: 0,
          pageId: activePage.id,
          params: {
            mode: 'preview',
          },
        },
      ],
      currentEntryIndex: 0,
      lastError: null,
    } satisfies RuntimeState['navigation']
    const state = createRuntimePageState(
      activePage,
      {
        searchUsers: {
          status: 'success',
          data: {
            user: {
              profile: {
                name: 'Ada',
                avatarFile: 'ada.png',
              },
            },
            stats: {
              total: 2,
            },
            results: [
              {
                code: 'A1',
                name: 'Ada',
                status: 'active',
              },
              {
                code: 'G2',
                name: 'Grace',
              },
            ],
          },
          error: null,
        },
      },
      navigation,
    )

    renderRuntimePageWithState(activePage, {
      ...state,
      forms: {
        userSearch: {
          name: {
            value: 'Grace',
            error: null,
            touched: true,
            dirty: true,
          },
        },
      },
    })

    expect(screen.getByRole('heading', { name: 'Hello Ada from preview', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Grace sees 2 users')).toBeInTheDocument()

    const image = screen.getByRole('img', { name: 'Avatar de Ada' })
    expect(image).toHaveAttribute('src', '/media/ada.png')
    expect(image).toHaveAttribute('alt', 'Avatar de Ada ')

    const [manualTable, dynamicTable] = screen.getAllByRole('table')
    expect(within(manualTable).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total 2', ''])
    expect(within(dynamicTable).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'A1',
      'Ada (active)',
      'G2',
      'Grace ()',
    ])
  })

  it('keeps static and partially interpolated text literal', () => {
    renderRuntimePageWithSeed({
      id: 'literal-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'Welcome back',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'User: forms.userSearch.name',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'Welcome back', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('User: forms.userSearch.name')).toBeInTheDocument()
  })

  it('degrades missing, unsupported and invalid references to an empty string in visible text nodes', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'empty-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'forms.userSearch.email',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'navigation.currentPageId',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.foo',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)

    consoleWarnSpy.mockRestore()
  })

  it('degrades unresolved or non-text nested query references to an empty string in visible text nodes', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    renderRuntimePageWithSeed({
      id: 'nested-empty-dynamic-text',
      layout: [
        {
          type: 'heading',
          props: {
            text: 'queries.searchUsers.data.results.3.name',
            level: 2,
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.results',
          },
        },
        {
          type: 'paragraph',
          props: {
            text: 'queries.searchUsers.data.user',
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
    expect(screen.getAllByText('', { selector: '[data-layout-node="paragraph"]' })).toHaveLength(2)

    consoleWarnSpy.mockRestore()
  })

  it('renders escaped references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\forms.userSearch.name',
            level: 3,
          },
        },
      ],
    })

    expect(screen.getByRole('heading', { name: 'forms.userSearch.name', level: 3 })).toBeInTheDocument()
  })

  it('renders escaped nested query references as visible literal text without the escape character', () => {
    renderRuntimePageWithSeed({
      id: 'escaped-nested-literal',
      layout: [
        {
          type: 'heading',
          props: {
            text: '\\queries.searchUsers.data.results.0.name',
            level: 3,
          },
        },
      ],
    })

    expect(
      screen.getByRole('heading', { name: 'queries.searchUsers.data.results.0.name', level: 3 }),
    ).toBeInTheDocument()
  })
})
