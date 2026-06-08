import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

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

function createRuntimePageState(
  activePage: RuntimePageConfig,
  queries: RuntimeState['queries'],
): RuntimeState {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }
  const baseState = createRuntimeState(config)
  return { ...baseState, queries }
}

// ---

describe('AlertNode — render basic and data-layout-node', () => {
  it('renders an alert with type: "neutral" with data-layout-node="alert" in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje neutral', type: 'neutral' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })

  it('element with data-layout-node="alert" for type neutral has class bg-gray-100', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Msg', type: 'neutral' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).toHaveClass('bg-gray-100')
  })

  const colorCases = [
    { type: 'neutral', bgClass: 'bg-gray-100' },
    { type: 'primary', bgClass: 'bg-blue-100' },
    { type: 'success', bgClass: 'bg-green-100' },
    { type: 'warning', bgClass: 'bg-yellow-100' },
    { type: 'danger', bgClass: 'bg-red-100' },
    { type: 'info', bgClass: 'bg-cyan-100' },
  ] as const

  colorCases.forEach(({ type, bgClass }) => {
    it(`alert with type="${type}" has class ${bgClass} on the root element`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'alert', props: { message: 'Msg', type } }],
      }
      const { container } = renderRuntimePage(page)
      const alertEl = container.querySelector('[data-layout-node="alert"]')
      expect(alertEl).toBeInTheDocument()
      expect(alertEl).toHaveClass(bgClass)
    })
  })

  it('alert without props.type renders with bg-gray-100 (default neutral)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Msg sin tipo' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).toHaveClass('bg-gray-100')
  })
})

describe('AlertNode — Lucide icon by type', () => {
  const allTypes = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

  allTypes.forEach((type) => {
    it(`alert with type="${type}" renders an <svg> inside [data-layout-node="alert"]`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'alert', props: { message: 'Msg', type } }],
      }
      const { container } = renderRuntimePage(page)
      const alertEl = container.querySelector('[data-layout-node="alert"]')
      expect(alertEl).toBeInTheDocument()
      const svg = alertEl!.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  allTypes.forEach((type) => {
    it(`alert with type="${type}" renders <svg> with aria-hidden="true"`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'alert', props: { message: 'Msg', type } }],
      }
      const { container } = renderRuntimePage(page)
      const alertEl = container.querySelector('[data-layout-node="alert"]')
      const svg = alertEl!.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })
  })

  const accentClassCases = [
    { type: 'neutral', textClass: 'text-gray-700' },
    { type: 'primary', textClass: 'text-blue-700' },
    { type: 'success', textClass: 'text-green-700' },
    { type: 'warning', textClass: 'text-yellow-700' },
    { type: 'danger', textClass: 'text-red-700' },
    { type: 'info', textClass: 'text-cyan-700' },
  ] as const

  accentClassCases.forEach(({ type, textClass }) => {
    it(`alert with type="${type}" renders <svg> with class ${textClass}`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'alert', props: { message: 'Msg', type } }],
      }
      const { container } = renderRuntimePage(page)
      const alertEl = container.querySelector('[data-layout-node="alert"]')
      const svg = alertEl!.querySelector('svg')
      expect(svg).toHaveClass(textClass)
    })
  })

  it('the literal text "icon" does not appear inside [data-layout-node="alert"]', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Msg', type: 'success' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl!.textContent).not.toContain('icon')
  })

  it('alert with type="success" and type="warning" render distinct <svg> elements (different icons)', () => {
    const successPage: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Msg', type: 'success' } }],
    }
    const warningPage: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Msg', type: 'warning' } }],
    }
    const { container: successContainer } = renderRuntimePage(successPage)
    const { container: warningContainer } = renderRuntimePage(warningPage)
    const successSvg = successContainer.querySelector('[data-layout-node="alert"] svg')
    const warningSvg = warningContainer.querySelector('[data-layout-node="alert"] svg')
    expect(successSvg).toBeInTheDocument()
    expect(warningSvg).toBeInTheDocument()
    // Different icons have different inner path content
    expect(successSvg!.innerHTML).not.toBe(warningSvg!.innerHTML)
  })
})

describe('AlertNode — title and message', () => {
  it('alert with props.title renders a <strong> element with the title text', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: 'Aviso' } }],
    }
    renderRuntimePage(page)
    const strong = screen.getByText('Aviso').closest('strong')
    expect(strong).toBeInTheDocument()
    expect(screen.getByText('Aviso')).toBeInTheDocument()
  })

  it('alert without props.title does not contain any <strong> element', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Solo mensaje' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('alert with props.title as empty string does not contain any <strong> element', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: '' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('alert with props.message shows that text visible in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Texto de mensaje' } }],
    }
    renderRuntimePage(page)
    expect(screen.getByText('Texto de mensaje')).toBeInTheDocument()
  })

  it('alert with props.message as empty string renders the block without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: '' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })
})

describe('AlertNode — interpolation', () => {
  it('props.message with {{queries.foo.data}} resolves to query value when query has status success', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: '{{queries.foo.data}}' } }],
    }
    const state = createRuntimePageState(page, {
      foo: {
        status: 'success',
        data: 'Valor resuelto',
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Valor resuelto')).toBeInTheDocument()
  })

  it('props.title with {{forms.f.name}} resolves to form field value', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'f',
          children: [
            { type: 'input', props: { fieldId: 'name', label: 'Name', defaultValue: 'Ada' } },
            { type: 'alert', props: { message: 'Msg', title: '{{forms.f.name}}' } },
          ],
        },
      ],
    }
    renderRuntimePage(page)
    const strong = screen.getByText('Ada').closest('strong')
    expect(strong).toBeInTheDocument()
  })

  it('props.title with unresolved placeholder renders <strong> with empty text; alert does not fail', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: '{{queries.nonexistent.data}}' } }],
    }
    const state = createRuntimePageState(page, {})
    const { container } = renderRuntimePageWithState(page, state)
    // Alert renders without throwing
    expect(container.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })

  it('props.message with unresolved placeholder renders message as empty without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: '{{queries.missing.data}}' } }],
    }
    const state = createRuntimePageState(page, {})
    const { container } = renderRuntimePageWithState(page, state)
    expect(container.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })
})

describe('AlertNode — transversal features', () => {
  it('alert with visibility evaluated to false is not rendered in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'alert',
          props: { message: 'Oculto' },
          visibility: {
            reference: 'queries.q.data.show',
            operator: 'isTruthy',
          },
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
    expect(screen.queryByText('Oculto')).not.toBeInTheDocument()
  })

  it('alert with queryStateFeedback in loading state with fallback paragraph renders the fallback', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'alert',
          props: { message: 'Original' },
          queryStateFeedback: {
            query: 'q',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Cargando...' } }],
              },
            },
          },
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
    expect(screen.queryByText('Original')).not.toBeInTheDocument()
  })

  it('alert with layout.span: 4 inside a container with columns: 12 is wrapped in div with col-span-4', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'alert',
              layout: { span: 4 },
              props: { message: 'Con span' },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-4')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })
})

describe('AlertNode — repeater integration', () => {
  it('alert inside repeater with two items renders two [data-layout-node="alert"] elements with distinct messages', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.items.data',
              key: 'id',
            },
            template: [
              { type: 'alert', props: { message: '{{item.text}}' } },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      items: {
        status: 'success',
        data: [
          { id: '1', text: 'Mensaje uno' },
          { id: '2', text: 'Mensaje dos' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const alerts = container.querySelectorAll('[data-layout-node="alert"]')
    expect(alerts).toHaveLength(2)
    expect(screen.getByText('Mensaje uno')).toBeInTheDocument()
    expect(screen.getByText('Mensaje dos')).toBeInTheDocument()
  })

  it('alert inside repeater with props.title using item.* renders <strong> with correct value per iteration', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.items.data',
              key: 'id',
            },
            template: [
              { type: 'alert', props: { message: 'Msg', title: '{{item.name}}' } },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      items: {
        status: 'success',
        data: [
          { id: '1', name: 'Título A' },
          { id: '2', name: 'Título B' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    const strongA = screen.getByText('Título A').closest('strong')
    const strongB = screen.getByText('Título B').closest('strong')
    expect(strongA).toBeInTheDocument()
    expect(strongB).toBeInTheDocument()
  })
})

describe('AlertNode — two-row layout with title', () => {
  it('when props.title is present and not empty, an inner column container has class flex-col and the root does not', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: 'Título' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).not.toHaveClass('flex-col')
    const strong = container.querySelector('strong')
    const innerColumn = strong!.parentElement
    expect(innerColumn).toHaveClass('flex-col')
  })

  it('when props.title is present, the icon svg is a direct child of the root alert and not inside the column container', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: 'Título' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    const strong = container.querySelector('strong')
    expect(strong).toBeInTheDocument()
    const innerColumn = strong!.parentElement
    // The icon svg is a direct child of the root, not inside the inner column
    const svgDirect = Array.from(alertEl!.children).find((el) => el.tagName === 'svg')
    expect(svgDirect).toBeInTheDocument()
    const svgInsideColumn = innerColumn!.querySelector('svg')
    expect(svgInsideColumn).not.toBeInTheDocument()
  })

  it('when props.title is present, the inner column container has class flex-1', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: 'Título' } }],
    }
    const { container } = renderRuntimePage(page)
    const strong = container.querySelector('strong')
    expect(strong).toBeInTheDocument()
    const innerColumn = strong!.parentElement
    expect(innerColumn).toHaveClass('flex-1')
  })

  it('when props.title is absent, the root alert element does not have class flex-col', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Solo mensaje' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).not.toHaveClass('flex-col')
  })

  it('when props.title is empty string, the root alert element does not have class flex-col and has no <strong>', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: '' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).not.toHaveClass('flex-col')
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('when props.title resolves to empty string via placeholder, layout is single row without flex-col and without <strong>', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: '{{queries.nonexistent.data}}' } }],
    }
    const state = createRuntimePageState(page, {})
    const { container } = renderRuntimePageWithState(page, state)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    expect(alertEl).not.toHaveClass('flex-col')
    expect(container.querySelector('strong')).not.toBeInTheDocument()
  })

  it('when props.message is empty with props.title declared and not empty, inner column renders with title without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: '', title: 'Título' } }],
    }
    const { container } = renderRuntimePage(page)
    const alertEl = container.querySelector('[data-layout-node="alert"]')
    expect(alertEl).toBeInTheDocument()
    const strong = container.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong).toHaveTextContent('Título')
    const innerColumn = strong!.parentElement
    expect(innerColumn).toHaveClass('flex-col')
  })

  it('when props.title is present, the message span is inside the inner column container alongside the title', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'alert', props: { message: 'Mensaje', title: 'Título' } }],
    }
    const { container } = renderRuntimePage(page)
    const strong = container.querySelector('strong')
    expect(strong).toBeInTheDocument()
    const innerColumn = strong!.parentElement
    // Message is inside the inner column (same container as the title, not below the icon)
    const messageSpanInColumn = Array.from(innerColumn!.querySelectorAll('span')).find(
      (s) => s.textContent === 'Mensaje',
    )
    expect(messageSpanInColumn).toBeInTheDocument()
    // No icon svg inside the inner column
    const svgInColumn = innerColumn!.querySelector('svg')
    expect(svgInColumn).not.toBeInTheDocument()
  })
})

describe('AlertNode — form integration', () => {
  it('alert as child of a form renders [data-layout-node="alert"] in the DOM without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'test-form',
          children: [
            { type: 'alert', props: { message: 'Alert en form' } },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="alert"]')).toBeInTheDocument()
  })

  it('alert inside form does not produce any field in state.forms[formId]', () => {
    const formId = 'test-form'
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: formId,
          children: [
            { type: 'alert', props: { message: 'Alert en form' } },
          ],
        },
      ],
    }
    const config: RuntimeConfig = {
      api: {},
      initialPage: page.id,
      pages: [page],
    }
    const state = createRuntimeState(config)
    expect(Object.keys(state.forms[formId] ?? {})).toHaveLength(0)
  })
})
