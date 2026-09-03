import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

afterEach(() => {
  vi.unstubAllGlobals()
})

function makeConfigWithItems(_items: Array<{ id: string; name: string }>) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.users.data.results', key: 'id' },
              template: [
                {
                  type: 'button',
                  props: {
                    label: 'Open {{item.name}}',
                    action: { type: 'openModal', modalId: 'row-modal' },
                  },
                },
                {
                  type: 'modal',
                  id: 'row-modal',
                  children: [
                    {
                      type: 'heading',
                      props: { level: 2, text: '{{item.name}}' },
                    },
                    {
                      type: 'button',
                      props: {
                        label: 'Close modal',
                        action: { type: 'closeModal', modalId: 'row-modal' },
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

  return config
}

function QuerySetter({ queryName, data }: { queryName: string; data: unknown }) {
  const { setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    setQuerySuccess(queryName, data)
  }, [queryName, data, setQuerySuccess])

  return null
}

function renderWithItems(items: Array<{ id: string; name: string }>) {
  const config = makeConfigWithItems(items)

  return render(
    <RuntimeStateProvider config={config}>
      <QuerySetter queryName="users" data={{ results: items }} />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('modal inside repeater template', () => {
  it('opens only the modal for its own iteration when open button is clicked', () => {
    renderWithItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Alice' }))

    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('modal-panel')).getByText('Alice')).toBeInTheDocument()
    expect(within(screen.getByTestId('modal-panel')).queryByText('Bob')).not.toBeInTheDocument()
  })

  it('applies max-h-[90vh] and overflow-y-auto to the panel of an opened iteration instance', () => {
    renderWithItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Alice' }))

    const panelClassName = screen.getByTestId('modal-panel').className
    expect(panelClassName).toContain('max-h-[90vh]')
    expect(panelClassName).toContain('overflow-y-auto')
  })

  it('opening the modal for iteration N closes the modal for iteration M (global one-at-a-time rule)', () => {
    renderWithItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Alice' }))
    expect(within(screen.getByTestId('modal-panel')).getByText('Alice')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Bob' }))
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('modal-panel')).getByText('Bob')).toBeInTheDocument()
    expect(within(screen.getByTestId('modal-panel')).queryByText('Alice')).not.toBeInTheDocument()
  })

  it('item.* references inside modal children resolve to the iteration item', () => {
    renderWithItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Bob' }))

    expect(within(screen.getByTestId('modal-panel')).getByText('Bob')).toBeInTheDocument()
  })

  it('close button inside the template closes only the active instance', () => {
    renderWithItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Alice' }))
    expect(screen.getByTestId('modal-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
  })

  it('changing the collection closes any modal whose iteration no longer exists', () => {
    const config: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'repeater',
              props: {
                items: { source: 'queries.users.data.results', key: 'id' },
                template: [
                  {
                    type: 'button',
                    props: {
                      label: 'Open {{item.name}}',
                      action: { type: 'openModal', modalId: 'row-modal' },
                    },
                  },
                  {
                    type: 'modal',
                    id: 'row-modal',
                    children: [{ type: 'heading', props: { level: 2, text: '{{item.name}}' } }],
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const initialItems = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]
    const updatedItems = [{ id: '2', name: 'Bob' }]

    const { rerender } = render(
      <RuntimeStateProvider config={config}>
        <QuerySetter queryName="users" data={{ results: initialItems }} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Alice' }))
    expect(within(screen.getByTestId('modal-panel')).getByText('Alice')).toBeInTheDocument()

    rerender(
      <RuntimeStateProvider config={config}>
        <QuerySetter queryName="users" data={{ results: updatedItems }} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.queryByTestId('modal-panel')).not.toBeInTheDocument()
  })
})

function makeConfigWithModalHeading(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.users.data.results', key: 'id' },
              template: [
                {
                  type: 'button',
                  props: {
                    label: 'Open {{item.name}}',
                    action: { type: 'openModal', modalId: 'row-modal' },
                  },
                },
                {
                  type: 'modal',
                  id: 'row-modal',
                  children: [{ type: 'heading', props: { level: 2, text: '{{item.name}}' } }],
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function renderWithModalHeadingItems(items: Array<{ id: string; name: string }>) {
  const config = makeConfigWithModalHeading()

  return render(
    <RuntimeStateProvider config={config}>
      <QuerySetter queryName="users" data={{ results: items }} />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('collection refresh preserves an open modal outside its own iteration (D3)', () => {
  it('keeps the modal open with the same dialog DOM node when an unrelated row is removed', () => {
    const { rerender } = renderWithModalHeadingItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Bob' }))
    const dialogBeforeRefresh = screen.getByRole('dialog')

    rerender(
      <RuntimeStateProvider config={makeConfigWithModalHeading()}>
        <QuerySetter
          queryName="users"
          data={{
            results: [
              { id: '1', name: 'Alice' },
              { id: '2', name: 'Bobby' },
            ],
          }}
        />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const dialogAfterRefresh = screen.getByRole('dialog')
    expect(dialogAfterRefresh).toBe(dialogBeforeRefresh)
    expect(within(dialogAfterRefresh).getByText('Bobby')).toBeInTheDocument()
  })

  it('keeps the modal open with the same dialog DOM node when a new row is added', () => {
    const { rerender } = renderWithModalHeadingItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Bob' }))
    const dialogBeforeRefresh = screen.getByRole('dialog')

    rerender(
      <RuntimeStateProvider config={makeConfigWithModalHeading()}>
        <QuerySetter
          queryName="users"
          data={{
            results: [
              { id: '1', name: 'Alice' },
              { id: '2', name: 'Bobby' },
              { id: '3', name: 'Carol' },
            ],
          }}
        />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const dialogAfterRefresh = screen.getByRole('dialog')
    expect(dialogAfterRefresh).toBe(dialogBeforeRefresh)
    expect(within(dialogAfterRefresh).getByText('Bobby')).toBeInTheDocument()
  })

  it('keeps the modal open with the same dialog DOM node when rows are reordered', () => {
    const { rerender } = renderWithModalHeadingItems([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Open Bob' }))
    const dialogBeforeRefresh = screen.getByRole('dialog')

    rerender(
      <RuntimeStateProvider config={makeConfigWithModalHeading()}>
        <QuerySetter
          queryName="users"
          data={{
            results: [
              { id: '3', name: 'Carol' },
              { id: '2', name: 'Bobby' },
              { id: '1', name: 'Alice' },
            ],
          }}
        />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    const dialogAfterRefresh = screen.getByRole('dialog')
    expect(dialogAfterRefresh).toBe(dialogBeforeRefresh)
    expect(within(dialogAfterRefresh).getByText('Bobby')).toBeInTheDocument()
  })
})

function makeConfigWithPageLevelModal(): RuntimeConfig {
  return {
    api: {
      submitProfile: { method: 'POST', endpoint: '/api/profile' },
    },
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'modal',
            id: 'pageModal',
            children: [{ type: 'heading', props: { level: 2, text: 'Page modal' } }],
          },
          {
            type: 'repeater',
            props: {
              items: { source: 'queries.users.data.results', key: 'id' },
              template: [
                {
                  type: 'form',
                  id: 'row-form',
                  submitAction: {
                    type: 'executeOperation',
                    operationName: 'submitProfile',
                  },
                  onSuccess: [{ type: 'openModal', modalId: 'pageModal' }],
                  children: [{ type: 'button', props: { label: 'Submit {{item.name}}' } }],
                },
              ],
            },
          },
          {
            type: 'button',
            props: {
              label: 'Close page modal from outside',
              action: { type: 'closeModal', modalId: 'pageModal' },
            },
          },
        ],
      },
    ],
  }
}

function stubSuccessfulSubmitFetch() {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPageLevelModalFixture() {
  const config = makeConfigWithPageLevelModal()

  return render(
    <RuntimeStateProvider config={config}>
      <QuerySetter
        queryName="users"
        data={{
          results: [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
          ],
        }}
      />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('page-level modal targeted by openModal from inside repeater.props.template', () => {
  it('opens the page-level modal visually after a form submit triggered from a repeater row', async () => {
    stubSuccessfulSubmitFetch()
    renderPageLevelModalFixture()

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bob' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('closes the page-level modal, once opened from a repeater row, via a closeModal button declared outside the repeater', async () => {
    stubSuccessfulSubmitFetch()
    renderPageLevelModalFixture()

    fireEvent.click(screen.getByRole('button', { name: 'Submit Alice' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close page modal from outside' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('the page-level modal opens regardless of which repeater row triggered openModal, not tied to that row iteration key', async () => {
    stubSuccessfulSubmitFetch()
    renderPageLevelModalFixture()

    fireEvent.click(screen.getByRole('button', { name: 'Submit Alice' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close page modal from outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bob' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close page modal from outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
