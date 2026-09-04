import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'

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

function renderElementWithState(activePage: RuntimePageConfig, config: RuntimeConfig, state: RuntimeState) {
  return (
    <RuntimeStateContext.Provider
      value={{
        config,
        initialState: state,
        state,
        dispatch: vi.fn<(action: RuntimeStateAction) => void>(),
        dispatchAndSyncState: vi.fn<(action: RuntimeStateAction) => void>(),
        getLatestState: () => state,
      }}
    >
      <RuntimePage />
    </RuntimeStateContext.Provider>
  )
}

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
  } satisfies RuntimeState
}

function createRuntimePageStateWithForms(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
  forms: RuntimeState['forms'],
) {
  return {
    ...createRuntimePageState(activePage, queries),
    forms,
  } satisfies RuntimeState
}

function createFilterFormsState(status: string): RuntimeState['forms'] {
  return {
    filterForm: {
      status: {
        value: status,
        error: null,
        touched: false,
        dirty: false,
      },
    },
  }
}

function paragraphTexts() {
  return screen.getAllByRole('paragraph').map((paragraph) => paragraph.textContent)
}

describe('repeater collection pipeline source', () => {
  it('regression: an array source without a pipeline renders the same iterations as before the feature', () => {
    const activePage: RuntimePageConfig = {
      id: 'products-no-pipeline-array',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.products.data', key: 'id' },
            template: [{ type: 'paragraph', props: { text: 'item.name' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        products: {
          status: 'success',
          data: [
            { id: 'p1', name: 'A' },
            { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' },
          ],
          error: null,
        },
      }),
    )

    expect(paragraphTexts()).toEqual(['A', 'B', 'C'])
  })

  it('regression: a plain-object dictionary source without a pipeline still iterates by dictionary key', () => {
    const activePage: RuntimePageConfig = {
      id: 'registry-no-pipeline-object',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.registry.data', key: '$key' },
            template: [{ type: 'paragraph', props: { text: '{{item.$key}}: {{item.name}}' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        registry: {
          status: 'success',
          data: { u1: { name: 'Ana' }, u2: { name: 'Bob' } },
          error: null,
        },
      }),
    )

    expect(paragraphTexts()).toEqual(['u1: Ana', 'u2: Bob'])
  })

  it('renders at most 10 iterations ordered from highest to lowest price with orderby:price,desc | slice:0,10', () => {
    const products = Array.from({ length: 15 }, (_, index) => ({ id: `p${index + 1}`, price: index + 1 }))
    const activePage: RuntimePageConfig = {
      id: 'products-orderby-slice',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.products.data | orderby:price,desc | slice:0,10', key: 'id' },
            template: [{ type: 'paragraph', props: { text: 'item.price' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        products: { status: 'success', data: products, error: null },
      }),
    )

    expect(paragraphTexts()).toEqual(['15', '14', '13', '12', '11', '10', '9', '8', '7', '6'])
  })

  it('renders only the iterations matching a filter:status,eq,"pending" stage', () => {
    const activePage: RuntimePageConfig = {
      id: 'orders-filter-pending',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.orders.data | filter:status,eq,"pending"', key: 'id' },
            template: [{ type: 'paragraph', props: { text: 'item.id' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        orders: {
          status: 'success',
          data: [
            { id: 'o1', status: 'pending' },
            { id: 'o2', status: 'shipped' },
            { id: 'o3', status: 'pending' },
          ],
          error: null,
        },
      }),
    )

    expect(paragraphTexts()).toEqual(['o1', 'o3'])
  })

  it('re-renders with the updated filter result when forms.filterForm.status changes, without any explicit repeater action', () => {
    const activePage: RuntimePageConfig = {
      id: 'orders-reactive-filter-arg',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.orders.data | filter:status,eq,forms.filterForm.status',
              key: 'id',
            },
            template: [{ type: 'paragraph', props: { text: 'item.id' } }],
          },
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: activePage.id,
      pages: [activePage],
    }
    const orders: RuntimeState['queries'] = {
      orders: {
        status: 'success',
        data: [
          { id: 'o1', status: 'pending' },
          { id: 'o2', status: 'shipped' },
          { id: 'o3', status: 'pending' },
        ],
        error: null,
      },
    }

    const { rerender } = renderRuntimePageWithState(
      activePage,
      createRuntimePageStateWithForms(activePage, orders, createFilterFormsState('pending')),
    )

    expect(paragraphTexts()).toEqual(['o1', 'o3'])

    rerender(
      renderElementWithState(
        activePage,
        config,
        createRuntimePageStateWithForms(activePage, orders, createFilterFormsState('shipped')),
      ),
    )

    expect(paragraphTexts()).toEqual(['o2'])
  })

  it('does not apply the filter stage and renders every iteration when the dynamic argument is an empty string', () => {
    const activePage: RuntimePageConfig = {
      id: 'orders-empty-filter-arg',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.orders.data | filter:status,eq,forms.filterForm.status',
              key: 'id',
            },
            template: [{ type: 'paragraph', props: { text: 'item.id' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageStateWithForms(
        activePage,
        {
          orders: {
            status: 'success',
            data: [
              { id: 'o1', status: 'pending' },
              { id: 'o2', status: 'shipped' },
              { id: 'o3', status: 'pending' },
            ],
            error: null,
          },
        },
        createFilterFormsState(''),
      ),
    )

    expect(paragraphTexts()).toEqual(['o1', 'o2', 'o3'])
  })

  it('sorts items missing the orderby field as the minimum value in a stable way, without breaking the render', () => {
    const activePage: RuntimePageConfig = {
      id: 'products-orderby-typo',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.products.data | orderby:precio,asc', key: 'id' },
            template: [{ type: 'paragraph', props: { text: 'item.id' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        products: {
          status: 'success',
          data: [
            { id: 'p1', precio: 30 },
            { id: 'p2' },
            { id: 'p3', precio: 10 },
          ],
          error: null,
        },
      }),
    )

    expect(paragraphTexts()).toEqual(['p2', 'p3', 'p1'])
  })

  it('degrades to zero iterations when a pipeline is declared over a plain-object dictionary source', () => {
    const activePage: RuntimePageConfig = {
      id: 'registry-pipeline-over-object',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.registry.data | filter:role,eq,"admin"', key: '$key' },
            template: [{ type: 'paragraph', props: { text: 'item.role' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        registry: {
          status: 'success',
          data: { u1: { role: 'admin' }, u2: { role: 'user' } },
          error: null,
        },
      }),
    )

    expect(screen.queryAllByRole('paragraph')).toHaveLength(0)
  })

  it('renders zero iterations without throwing when the pipeline base reference is loading, null or undefined', () => {
    function createPage(): RuntimePageConfig {
      return {
        id: 'results-pending-base-reference',
        layout: [
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.results.data | slice:0,2', key: '$index' },
              template: [{ type: 'paragraph', props: { text: 'item.label' } }],
            },
          },
        ],
      }
    }

    const loadingQueries: RuntimeState['queries'] = {
      results: { status: 'loading', data: undefined, error: null, requestSignature: null },
    }
    const nullDataQueries: RuntimeState['queries'] = {
      results: { status: 'success', data: null, error: null, requestSignature: null },
    }
    const unresolvedQueries: RuntimeState['queries'] = {}

    for (const queries of [loadingQueries, nullDataQueries, unresolvedQueries]) {
      const page = createPage()
      const { unmount } = renderRuntimePageWithState(page, createRuntimePageState(page, queries))

      expect(screen.queryAllByRole('paragraph')).toHaveLength(0)
      unmount()
    }
  })

  it('produces 4 pages of 5 rows when a declarative orderby+slice:0,20 stage feeds local pagination with pageSize 5', () => {
    const products = Array.from({ length: 30 }, (_, index) => ({ id: `p${index + 1}`, price: index + 1 }))
    const activePage: RuntimePageConfig = {
      id: 'products-slice-pagination',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.products.data | orderby:price,desc | slice:0,20', key: 'id' },
            pagination: { enabled: true, pageSize: 5, controls: { variant: 'numbered' } },
            template: [{ type: 'paragraph', props: { text: 'item.price' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        products: { status: 'success', data: products, error: null },
      }),
    )

    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument()
    // Page 1 shows the top 5 prices from the sliced-and-ordered pool.
    expect(paragraphTexts()).toEqual(['30', '29', '28', '27', '26'])
  })

  it('exposes item.$index as the position within the pipeline-processed collection, not the original source', () => {
    const activePage: RuntimePageConfig = {
      id: 'products-index-after-pipeline',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.products.data | filter:status,eq,"active"', key: 'id' },
            template: [{ type: 'paragraph', props: { text: '{{item.$index}}: {{item.id}}' } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        products: {
          status: 'success',
          data: [
            { id: 'p1', status: 'active' },
            { id: 'p2', status: 'inactive' },
            { id: 'p3', status: 'active' },
            { id: 'p4', status: 'active' },
          ],
          error: null,
        },
      }),
    )

    expect(paragraphTexts()).toEqual(['0: p1', '1: p3', '2: p4'])
  })
})
