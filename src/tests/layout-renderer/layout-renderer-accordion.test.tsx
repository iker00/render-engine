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

  it('clicking an open accordion starts close animation; content leaves DOM after animationEnd', () => {
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

    const { container } = renderRuntimePage(page)

    expect(screen.getByText('Contenido visible')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Contraer' }))

    // Content is still in DOM during close animation
    expect(screen.getByText('Contenido visible')).toBeInTheDocument()

    // Simulate animation completion
    fireEvent.animationEnd(container.querySelector('[data-layout-node="accordion-body"]')!)

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
  it('expanding a second accordion in the same group starts close animation on the first', () => {
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

    const { container } = renderRuntimePage(page)

    expect(screen.getByText('Cuerpo A')).toBeInTheDocument()
    expect(screen.queryByText('Cuerpo B')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sección B' }))

    // Cuerpo B is now open; Cuerpo A is animating close
    expect(screen.getByText('Cuerpo B')).toBeInTheDocument()

    // Simulate animation completion on the first accordion's body
    const bodies = container.querySelectorAll('[data-layout-node="accordion-body"]')
    const closingBody = Array.from(bodies).find((b) =>
      b.classList.contains('animate-accordion-close'),
    )
    if (closingBody) fireEvent.animationEnd(closingBody)

    expect(screen.queryByText('Cuerpo A')).not.toBeInTheDocument()
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

  it('accordions with groupId in repeater template: opening one iteration does NOT collapse another iteration in the same nominal group (T04, scope-chain isolation)', () => {
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

    // Open the second — each repeater iteration is a distinct scope chain, so the first
    // stays open instead of animating closed.
    fireEvent.click(secondBtn)
    expect(screen.getByText('Desc 2')).toBeInTheDocument()
    expect(screen.getByText('Desc 1')).toBeInTheDocument()
  })

  it('two accordions with the same groupId as siblings within the same repeater iteration still coordinate (same effective scope)', () => {
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
                props: { label: 'item.title', groupId: 'grupo-hermanos', defaultOpen: true },
                children: [{ type: 'paragraph', props: { text: 'item.first' } }],
              },
              {
                type: 'accordion',
                props: { label: 'item.titleTwo', groupId: 'grupo-hermanos' },
                children: [{ type: 'paragraph', props: { text: 'item.second' } }],
              },
            ],
          },
        },
      ],
    }

    const state = createRuntimePageState(page, {
      list: {
        status: 'success',
        data: [{ id: '1', title: 'Uno', titleTwo: 'Dos', first: 'Primero', second: 'Segundo' }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    const { container } = renderRuntimePageWithState(page, state)

    expect(screen.getByText('Primero')).toBeInTheDocument()
    expect(screen.queryByText('Segundo')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dos' }))

    expect(screen.getByText('Segundo')).toBeInTheDocument()

    const bodies = container.querySelectorAll('[data-layout-node="accordion-body"]')
    const closingBody = Array.from(bodies).find((b) => b.classList.contains('animate-accordion-close'))
    if (closingBody) fireEvent.animationEnd(closingBody)

    expect(screen.queryByText('Primero')).not.toBeInTheDocument()
  })

  it('an accordion with groupId inside a repeater template does NOT coordinate with an accordion with the same groupId outside the repeater (distinct scope chains)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Fuera del repeater', groupId: 'grupo-mixto', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo fuera' } }],
        },
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.list.data', key: 'id' },
            template: [
              {
                type: 'accordion',
                props: { label: 'item.title', groupId: 'grupo-mixto', defaultOpen: false },
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
        data: [{ id: '1', title: 'Fila 1', description: 'Desc 1' }],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })

    renderRuntimePageWithState(page, state)

    expect(screen.getByText('Cuerpo fuera')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fila 1' }))

    // Opening the repeater instance must not close the page-level accordion in the same
    // nominal group, because they live in different scope chains.
    expect(screen.getByText('Desc 1')).toBeInTheDocument()
    expect(screen.getByText('Cuerpo fuera')).toBeInTheDocument()
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

describe('AccordionNode — body open/close transition', () => {
  it('body wrapper is NOT in the DOM when accordion is initially closed', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Cerrado' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')

    expect(body).toBeNull()
  })

  it('body wrapper IS in the DOM with animate-accordion-open when defaultOpen is true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Abierto', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')!

    expect(body).not.toBeNull()
    expect(body.classList.contains('animate-accordion-open')).toBe(true)
  })

  it('after clicking a closed accordion, body appears with animate-accordion-open and children mount', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Expandir transición' },
          children: [{ type: 'paragraph', props: { text: 'Contenido expandido' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)

    expect(container.querySelector('[data-layout-node="accordion-body"]')).toBeNull()
    expect(screen.queryByText('Contenido expandido')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir transición' }))

    const body = container.querySelector('[data-layout-node="accordion-body"]')!
    expect(body).not.toBeNull()
    expect(body.classList.contains('animate-accordion-open')).toBe(true)
    expect(screen.getByText('Contenido expandido')).toBeInTheDocument()
  })

  it('body switches to animate-accordion-close and content stays in DOM immediately after close click', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Contraer transición', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Contenido abierto' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')!

    expect(body.classList.contains('animate-accordion-open')).toBe(true)
    expect(screen.getByText('Contenido abierto')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Contraer transición' }))

    expect(body.classList.contains('animate-accordion-close')).toBe(true)
    expect(body.classList.contains('animate-accordion-open')).toBe(false)
    // Content is still in DOM during the close animation
    expect(screen.getByText('Contenido abierto')).toBeInTheDocument()
  })

  it('body and content are removed from DOM after animationEnd fires on close', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Contraer animEnd', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Saliendo' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')!

    fireEvent.click(screen.getByRole('button', { name: 'Contraer animEnd' }))
    fireEvent.animationEnd(body)

    expect(container.querySelector('[data-layout-node="accordion-body"]')).toBeNull()
    expect(screen.queryByText('Saliendo')).not.toBeInTheDocument()
  })

  it('padding wrapper px-4 py-2 exists inside body when open with children', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Con hijos abierto', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Hijo visible' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')!
    const paddingDiv = body.querySelector('.px-4.py-2')

    expect(paddingDiv).not.toBeNull()
  })

  it('no padding wrapper when open with empty children array', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sin hijos abierto', defaultOpen: true },
          children: [],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')!
    const paddingDiv = body.querySelector('.px-4.py-2')

    expect(paddingDiv).toBeNull()
  })
})

describe('AccordionNode — body gap between children', () => {
  it('wrapper interno tiene flex, flex-col y gap-5 cuando accordion está abierto con dos hijos', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Dos hijos', defaultOpen: true },
          children: [
            { type: 'paragraph', props: { text: 'Hijo 1' } },
            { type: 'paragraph', props: { text: 'Hijo 2' } },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')

    expect(wrapper).not.toBeNull()
    expect(wrapper!.classList.contains('flex')).toBe(true)
    expect(wrapper!.classList.contains('flex-col')).toBe(true)
    expect(wrapper!.classList.contains('gap-5')).toBe(true)
  })

  it('wrapper interno tiene flex, flex-col y gap-5 cuando accordion está abierto con un único hijo', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Un hijo', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Único hijo' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')

    expect(wrapper).not.toBeNull()
    expect(wrapper!.classList.contains('flex')).toBe(true)
    expect(wrapper!.classList.contains('flex-col')).toBe(true)
    expect(wrapper!.classList.contains('gap-5')).toBe(true)
  })

  it('cuando accordion está cerrado por defecto, el wrapper interno no existe en el DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Cerrado gap' },
          children: [
            { type: 'paragraph', props: { text: 'Hijo 1' } },
            { type: 'paragraph', props: { text: 'Hijo 2' } },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const body = container.querySelector('[data-layout-node="accordion-body"]')
    expect(body).toBeNull()
    const wrapper = container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')
    expect(wrapper).toBeNull()
  })

  it('wrapper interno con px-4 py-2 flex flex-col gap-5 NO se renderiza con children vacío', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sin hijos gap', defaultOpen: true },
          children: [],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const wrapper = container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')
    expect(wrapper).toBeNull()
  })

  it('tras hacer click en accordion cerrado con dos hijos, el wrapper interno tiene flex, flex-col y gap-5', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Click gap' },
          children: [
            { type: 'paragraph', props: { text: 'Hijo click 1' } },
            { type: 'paragraph', props: { text: 'Hijo click 2' } },
          ],
        },
      ],
    }

    const { container } = renderRuntimePage(page)

    expect(container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Click gap' }))

    const wrapper = container.querySelector('[data-layout-node="accordion-body"] .px-4.py-2')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.classList.contains('flex')).toBe(true)
    expect(wrapper!.classList.contains('flex-col')).toBe(true)
    expect(wrapper!.classList.contains('gap-5')).toBe(true)
  })
})

describe('AccordionNode — header icon', () => {
  it('renders an icon before the label when props.icon is a valid Lucide name', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Con icono', icon: 'ChevronRight' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const header = container.querySelector('[data-layout-node="accordion-header"]')!
    const svgs = header.querySelectorAll('svg')

    // Icon svg + chevron svg = 2, icon comes first in DOM order
    expect(svgs).toHaveLength(2)
    expect(svgs[svgs.length - 1]).toHaveAttribute('data-layout-node', 'accordion-chevron')

    const iconSvg = svgs[0]
    expect(iconSvg).toHaveAttribute('aria-hidden', 'true')
    expect(iconSvg.compareDocumentPosition(screen.getByText('Con icono'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('icon does not add to the accessible name of the header button', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Nombre accesible', icon: 'ChevronRight' },
        },
      ],
    }

    renderRuntimePage(page)

    expect(screen.getByRole('button', { name: 'Nombre accesible' })).toBeInTheDocument()
  })

  it('renders no icon element and keeps header unchanged when props.icon is not a known Lucide name', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Icono inválido', icon: 'NoExiste' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const header = container.querySelector('[data-layout-node="accordion-header"]')!
    const svgs = header.querySelectorAll('svg')

    // Only the chevron remains
    expect(svgs).toHaveLength(1)
    expect(svgs[0]).toHaveAttribute('data-layout-node', 'accordion-chevron')
    expect(screen.getByRole('button', { name: 'Icono inválido' })).toBeInTheDocument()
  })

  it('renders header exactly as before this task when props.icon is absent (regression)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Sin icono' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const header = container.querySelector('[data-layout-node="accordion-header"]')!
    const svgs = header.querySelectorAll('svg')

    expect(header.textContent).toBe('Sin icono')
    expect(svgs).toHaveLength(1)
    expect(svgs[0]).toHaveAttribute('data-layout-node', 'accordion-chevron')
  })

  it('icon behaves the same across all instances of a groupId when declared', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Grupo icono A', groupId: 'grupo-icono', icon: 'ChevronRight', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo A' } }],
        },
        {
          type: 'accordion',
          props: { label: 'Grupo icono B', groupId: 'grupo-icono', icon: 'ChevronRight' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo B' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const headers = container.querySelectorAll('[data-layout-node="accordion-header"]')

    expect(headers).toHaveLength(2)
    headers.forEach((header) => {
      const svgs = header.querySelectorAll('svg')
      expect(svgs).toHaveLength(2)
      expect(svgs[svgs.length - 1]).toHaveAttribute('data-layout-node', 'accordion-chevron')
    })
  })
})

describe('AccordionNode — header styling and chevron', () => {
  it('header has bg-primary-50 and hover:bg-primary-100 classes and no legacy app-accent or gray classes', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Estilo header' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const header = container.querySelector('[data-layout-node="accordion-header"]')!

    expect(header.classList.contains('bg-primary-50')).toBe(true)
    expect(header.classList.contains('hover:bg-primary-100')).toBe(true)
    expect(header.classList.contains('focus-visible:ring-primary-600')).toBe(true)
    expect(header.classList.contains('bg-app-accent/10')).toBe(false)
    expect(header.classList.contains('hover:bg-app-accent/20')).toBe(false)
    expect(header.classList.contains('focus-visible:ring-app-accent')).toBe(false)
    expect(header.classList.contains('bg-gray-100')).toBe(false)
    expect(header.classList.contains('bg-gray-200')).toBe(false)
    expect(header.classList.contains('focus:ring-blue-500')).toBe(false)
  })

  it('header contains a unique accordion-chevron element with aria-hidden="true"', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Chevron test' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const chevrons = container.querySelectorAll('[data-layout-node="accordion-chevron"]')

    expect(chevrons).toHaveLength(1)
    expect(chevrons[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('chevron does not have rotate-180 when accordion is closed by default', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Cerrado' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const chevron = container.querySelector('[data-layout-node="accordion-chevron"]')!

    expect(chevron.classList.contains('rotate-180')).toBe(false)
  })

  it('chevron has rotate-180 when accordion starts with defaultOpen: true', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Abierto', defaultOpen: true },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const chevron = container.querySelector('[data-layout-node="accordion-chevron"]')!

    expect(chevron.classList.contains('rotate-180')).toBe(true)
  })

  it('chevron gains rotate-180 after clicking a closed accordion and loses it after second click', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Toggle chevron' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const header = screen.getByRole('button', { name: 'Toggle chevron' })
    const chevron = container.querySelector('[data-layout-node="accordion-chevron"]')!

    expect(chevron.classList.contains('rotate-180')).toBe(false)

    fireEvent.click(header)
    expect(chevron.classList.contains('rotate-180')).toBe(true)

    fireEvent.click(header)
    expect(chevron.classList.contains('rotate-180')).toBe(false)
  })

  it('chevron includes transition-transform class', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Transición chevron' },
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const chevron = container.querySelector('[data-layout-node="accordion-chevron"]')!

    expect(chevron.classList.contains('transition-transform')).toBe(true)
  })

  it('each repeater iteration renders its own chevron independently', () => {
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

    const { container } = renderRuntimePageWithState(page, state)
    const chevrons = container.querySelectorAll('[data-layout-node="accordion-chevron"]')

    expect(chevrons.length).toBeGreaterThanOrEqual(2)
  })

  it('chevron and restyle apply correctly for accordions with groupId', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'accordion',
          props: { label: 'Grupo A', groupId: 'g1', defaultOpen: true },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo A' } }],
        },
        {
          type: 'accordion',
          props: { label: 'Grupo B', groupId: 'g1' },
          children: [{ type: 'paragraph', props: { text: 'Cuerpo B' } }],
        },
      ],
    }

    const { container } = renderRuntimePage(page)
    const chevrons = container.querySelectorAll('[data-layout-node="accordion-chevron"]')

    // First accordion is open (defaultOpen: true), second is closed
    expect(chevrons[0].classList.contains('rotate-180')).toBe(true)
    expect(chevrons[1].classList.contains('rotate-180')).toBe(false)

    // Click second accordion to open it — first should close
    fireEvent.click(screen.getByRole('button', { name: 'Grupo B' }))

    expect(chevrons[0].classList.contains('rotate-180')).toBe(false)
    expect(chevrons[1].classList.contains('rotate-180')).toBe(true)
  })
})
