import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
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
  } satisfies RuntimeState
}

describe('AccordionNode — initial state', () => {
  it('renders the header but not the body when defaultOpen is false (default)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Mi sección' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo del acordeón' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Mi sección')).toBeInTheDocument()
    expect(screen.queryByText('Cuerpo del acordeón')).not.toBeInTheDocument()
  })

  it('renders both header and body when defaultOpen is true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Mi sección', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo del acordeón' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Mi sección')).toBeInTheDocument()
    expect(screen.getByText('Cuerpo del acordeón')).toBeInTheDocument()
  })
})

describe('AccordionNode — toggle behavior', () => {
  it('clicking a closed accordion opens it and shows the body', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Expandir' },
          children: [{ type: 'paragraph', props: { text: 'Contenido oculto' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.queryByText('Contenido oculto')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir' }))

    expect(screen.getByText('Contenido oculto')).toBeInTheDocument()
  })

  it('clicking an open accordion closes it and removes the body from DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Contraer', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Contenido visible' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Contenido visible')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Contraer' }))

    expect(screen.queryByText('Contenido visible')).not.toBeInTheDocument()
  })
})

describe('AccordionNode — ARIA accessibility', () => {
  it('header exposes aria-expanded="false" when accordion is closed', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sección cerrada' },
        },
      ],
    }

    renderRuntimePage(page)

    const button = screen.getByRole('button', { name: 'Sección cerrada' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('header exposes aria-expanded="true" when accordion is open', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sección abierta', defaultOpen: true },
        },
      ],
    }

    renderRuntimePage(page)

    const button = screen.getByRole('button', { name: 'Sección abierta' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('AccordionNode — label interpolation', () => {
  it('renders a literal label in the header', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Etiqueta literal' },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('button', { name: 'Etiqueta literal' })).toBeInTheDocument()
  })

  it('resolves {{queries.q.data.title}} interpolation in the label', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: '{{queries.q.data.title}}' },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { title: 'Título resuelto' },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByRole('button', { name: 'Título resuelto' })).toBeInTheDocument()
  })
})

describe('AccordionNode — group coordination', () => {
  it('expanding a second accordion in the same group collapses the first', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sección A', groupId: 'grupo-1', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo A' } }],
        },
        {
          type: 'accordion',
          props: { label: 'Sección B', groupId: 'grupo-1' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo B' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Cuerpo A')).toBeInTheDocument()
    expect(screen.queryByText('Cuerpo B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sección B' }))

    expect(screen.queryByText('Cuerpo A')).not.toBeInTheDocument()
    expect(screen.getByText('Cuerpo B')).toBeInTheDocument()
  })

  it('when two accordions with same groupId have defaultOpen:true, only the first stays open', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Primero', groupId: 'grupo-x', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo primero' } }],
        },
        {
          type: 'accordion',
          props: { label: 'Segundo', groupId: 'grupo-x', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo segundo' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Cuerpo primero')).toBeInTheDocument()
    expect(screen.queryByText('Cuerpo segundo')).not.toBeInTheDocument()
  })

  it('two accordions without groupId can both be open at the same time', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Independiente A', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo independiente A' } }],
        },
        {
          type: 'accordion',
          props: { label: 'Independiente B', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo independiente B' } }],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByText('Cuerpo independiente A')).toBeInTheDocument()
    expect(screen.getByText('Cuerpo independiente B')).toBeInTheDocument()
  })
})

describe('AccordionNode — transversal features', () => {
  it('hides the entire accordion (header and body) when visibility evaluates to false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Oculto', defaultOpen: true },
          visibility: {
            reference: 'queries.q.data.show',
            operator: 'isTruthy',
          },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo oculto' } }],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'success',
        data: { show: false },
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.queryByRole('button', { name: 'Oculto' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cuerpo oculto')).not.toBeInTheDocument()
  })

  it('replaces accordion with feedback fallback when queryStateFeedback triggers', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Con feedback' },
          queryStateFeedback: {
            query: 'q',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }],
              },
            },
          },
          children: [{ type: 'paragraph', props: { text: 'Contenido real' } }],
        },
      ],
    }

    const state = createRuntimePageState(page, {
      q: {
        status: 'loading',
        data: null,
        requestedAt: 0,
        resolvedAt: null,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Con feedback' })).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido real')).not.toBeInTheDocument()
  })

  it('wraps accordion in col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'accordion',
              layout: { span: 6 },
              props: { label: 'Span seis' },
            },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-6')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="accordion-header"]')).toBeInTheDocument()
  })
})

describe('AccordionNode — inside repeater (T-04)', () => {
  it('renders one accordion instance per repeater iteration', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [
              {
                type: 'accordion',
                props: { label: 'item.title' },
                children: [{ type: 'paragraph', props: { text: 'item.description' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      list: {
        status: 'success',
        data: [
          { id: '1', title: 'Fila 1', description: 'Desc 1' },
          { id: '2', title: 'Fila 2', description: 'Desc 2' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    const headers = screen.getAllByRole('button')
    expect(headers).toHaveLength(2)
  })

  it('each repeater accordion instance has independent open/closed state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [
              {
                type: 'accordion',
                props: { label: 'item.title' },
                children: [{ type: 'paragraph', props: { text: 'item.description' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      list: {
        status: 'success',
        data: [
          { id: '1', title: 'Fila 1', description: 'Desc 1' },
          { id: '2', title: 'Fila 2', description: 'Desc 2' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    // Click first accordion only
    const [firstBtn] = screen.getAllByRole('button')
    fireEvent.click(firstBtn)

    expect(screen.getByText('Desc 1')).toBeInTheDocument()
    expect(screen.queryByText('Desc 2')).not.toBeInTheDocument()
  })

  it('accordions with groupId in repeater template: opening one iteration collapses another in the same group', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [
              {
                type: 'accordion',
                props: { label: 'item.title', groupId: 'grupo-repeater', defaultOpen: false },
                children: [{ type: 'paragraph', props: { text: 'item.description' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      list: {
        status: 'success',
        data: [
          { id: '1', title: 'Fila 1', description: 'Desc 1' },
          { id: '2', title: 'Fila 2', description: 'Desc 2' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    const [firstBtn, secondBtn] = screen.getAllByRole('button')

    // Open the first
    fireEvent.click(firstBtn)
    expect(screen.getByText('Desc 1')).toBeInTheDocument()
    expect(screen.queryByText('Desc 2')).not.toBeInTheDocument()

    // Open the second — should close the first
    fireEvent.click(secondBtn)
    expect(screen.queryByText('Desc 1')).not.toBeInTheDocument()
    expect(screen.getByText('Desc 2')).toBeInTheDocument()
  })
})

describe('AccordionNode — edge cases', () => {
  it('renders an empty body without error when children is empty', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sin hijos', defaultOpen: true },
          children: [],
        },
      ],
    }

    const { container } = renderRuntimePage(page)

    expect(screen.getByRole('button', { name: 'Sin hijos' })).toBeInTheDocument()
    const body = container.querySelector('[data-layout-node="accordion-body"]')
    expect(body).toBeInTheDocument()
  })

  it('renders correctly inside a form node', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'accordion',
              props: { label: 'Dentro del form', defaultOpen: true },
              children: [{ type: 'paragraph', props: { text: 'Contenido del form accordion' } }],
            },
          ],
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('button', { name: 'Dentro del form' })).toBeInTheDocument()
    expect(screen.getByText('Contenido del form accordion')).toBeInTheDocument()
  })
})
