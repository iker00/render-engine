import { fireEvent, render, screen, within } from '@testing-library/react'
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
