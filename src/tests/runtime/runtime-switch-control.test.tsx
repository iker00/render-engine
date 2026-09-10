import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { SwitchControl } from '../../runtime/nodes/switch-control'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  const baseState = createRuntimeState(config)

  return {
    ...baseState,
    queries,
    pageEntry: {
      ...baseState.pageEntry,
      pageId: baseState.navigation.currentPageId,
      params: baseState.pageEntry.params,
    },
  } satisfies RuntimeState
}

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
  const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

  return render(
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
  )
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SwitchControl', () => {
  it('renders role="switch" with aria-checked matching checked=false', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('renders role="switch" with aria-checked matching checked=true', () => {
    render(
      <SwitchControl
        checked={true}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('invokes onClick when clicked', () => {
    const onClick = vi.fn()
    render(
      <SwitchControl
        checked={false}
        onClick={onClick}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    fireEvent.click(screen.getByRole('switch'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies trackClassName to the button and knobClassName to the span', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="my-track-class"
        knobClassName="my-knob-class"
      />,
    )

    const button = screen.getByRole('switch')
    expect(button).toHaveClass('my-track-class')
    expect(button.querySelector('span')).toHaveClass('my-knob-class')
  })

  it('does not add aria-label when ariaLabel is absent', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })

  it('adds aria-label with the given value when ariaLabel is present', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
        ariaLabel="Enable notifications"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Enable notifications')
  })

  it('does not add aria-describedby when ariaDescribedBy is absent', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
      />,
    )

    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-describedby')
  })

  it('adds aria-describedby with the given value when ariaDescribedBy is present', () => {
    render(
      <SwitchControl
        checked={false}
        onClick={() => {}}
        trackClassName="track"
        knobClassName="knob"
        ariaDescribedBy="field-error-id"
      />,
    )

    expect(screen.getByRole('switch')).toHaveAttribute('aria-describedby', 'field-error-id')
  })
})

describe('switch checked with row.*', () => {
  it('reflects aria-checked per row from checked: "row.isPrimary" in a dynamic table and recalculates after source changes', () => {
    const activePage: RuntimePageConfig = {
      id: 'switch-row-dynamic-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Primary'],
            rows: {
              source: 'queries.users.data.results',
              cells: [
                'row.name',
                {
                  type: 'button',
                  props: { label: 'Primary', variant: 'switch', checked: 'row.isPrimary', action: { type: 'goBack' } },
                },
              ],
            },
          },
        },
      ],
    }

    const { rerender } = renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        users: {
          status: 'success',
          data: {
            results: [
              { name: 'Ada', isPrimary: true },
              { name: 'Grace', isPrimary: false },
              { name: 'Lin', isPrimary: true },
            ],
          },
          error: null,
        },
      }),
    )

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
    expect(switches[2]).toHaveAttribute('aria-checked', 'true')

    const config: RuntimeConfig = { api: {}, initialPage: activePage.id, pages: [activePage] }
    const updatedState = createRuntimePageState(activePage, {
      users: {
        status: 'success',
        data: {
          results: [
            { name: 'Ada', isPrimary: false },
            { name: 'Grace', isPrimary: true },
            { name: 'Lin', isPrimary: false },
          ],
        },
        error: null,
      },
    })
    const dispatch = vi.fn<(action: RuntimeStateAction) => void>()
    const dispatchAndSyncState = vi.fn<(action: RuntimeStateAction) => void>()

    rerender(
      <RuntimeStateContext.Provider
        value={{
          config,
          initialState: updatedState,
          state: updatedState,
          dispatch,
          dispatchAndSyncState,
          getLatestState: () => updatedState,
        }}
      >
        <RuntimePage />
      </RuntimeStateContext.Provider>,
    )

    const switchesAfterUpdate = screen.getAllByRole('switch')
    expect(switchesAfterUpdate[0]).toHaveAttribute('aria-checked', 'false')
    expect(switchesAfterUpdate[1]).toHaveAttribute('aria-checked', 'true')
    expect(switchesAfterUpdate[2]).toHaveAttribute('aria-checked', 'false')
  })

  it('renders aria-checked="false" for checked: "row.$index" in manual table mode (non-boolean resolved value degrades to false)', () => {
    const activePage: RuntimePageConfig = {
      id: 'switch-row-index-manual-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Position'],
            rows: [
              ['Ada', { type: 'button', props: { label: 'Row', variant: 'switch', checked: 'row.$index', action: { type: 'goBack' } } }],
              ['Grace', { type: 'button', props: { label: 'Row', variant: 'switch', checked: 'row.$index', action: { type: 'goBack' } } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(switches[0]).toHaveAttribute('aria-checked', 'false')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('renders aria-checked="false" for checked: "row.isPrimary" (without .$index) in manual table mode, since row has no backing item', () => {
    const activePage: RuntimePageConfig = {
      id: 'switch-row-field-manual-table',
      layout: [
        {
          type: 'table',
          props: {
            headers: ['Name', 'Primary'],
            rows: [
              ['Ada', { type: 'button', props: { label: 'Row', variant: 'switch', checked: 'row.isPrimary', action: { type: 'goBack' } } }],
              ['Grace', { type: 'button', props: { label: 'Row', variant: 'switch', checked: 'row.isPrimary', action: { type: 'goBack' } } }],
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(switches[0]).toHaveAttribute('aria-checked', 'false')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('sends the negation of the row own isPrimary in the request body via switch.next on click, in a dynamic table cell', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const config: RuntimeConfig = {
      api: {
        togglePrimary: { method: 'POST', endpoint: '/api/toggle-primary' },
      },
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'table',
              props: {
                headers: ['Name', 'Primary'],
                rows: {
                  source: 'queries.users.data.results',
                  cells: [
                    'row.name',
                    {
                      type: 'button',
                      props: {
                        label: 'Primary',
                        variant: 'switch',
                        checked: 'row.isPrimary',
                        action: {
                          type: 'executeOperation',
                          operationName: 'togglePrimary',
                          body: { isPrimary: 'switch.next' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    }

    render(<RuntimeStateProvider config={config} dataValues={{ users: { results: [{ name: 'Ada', isPrimary: false }, { name: 'Grace', isPrimary: true }] } }}><RuntimePage /></RuntimeStateProvider>)

    const switches = await waitFor(() => {
      const found = screen.getAllByRole('switch')
      expect(found).toHaveLength(2)
      return found
    })

    fireEvent.click(switches[0])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ isPrimary: true })

    fireEvent.click(switches[1])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ isPrimary: false })
  })

  it('resolves row.* against the row own data and item.* against the repeater ancestor without mutual shadowing, inside a table nested in a repeater', () => {
    const activePage: RuntimePageConfig = {
      id: 'switch-row-repeater-table',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.departments.data', key: 'id' },
            template: [
              {
                type: 'table',
                props: {
                  headers: ['Owner', 'Primary'],
                  rows: {
                    source: 'item.members',
                    cells: [
                      { type: 'paragraph', props: { text: '{{item.ownerName}}' } },
                      {
                        type: 'button',
                        props: {
                          label: 'Primary',
                          variant: 'switch',
                          checked: 'row.isPrimary',
                          action: { type: 'goBack' },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        departments: {
          status: 'success',
          data: [
            {
              id: 'dept-1',
              ownerName: 'Engineering',
              members: [
                { name: 'Ada', isPrimary: true },
                { name: 'Grace', isPrimary: false },
              ],
            },
          ],
          error: null,
        },
      }),
    )

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)

    expect(within(rows[0]).getByText('Engineering')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Engineering')).toBeInTheDocument()

    const switches = within(table).getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })
})
