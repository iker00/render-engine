import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { vi } from 'vitest'

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

describe('BadgeNode — variant and data-layout-node', () => {
  it('renders a badge with variant: "pill" with data-layout-node="badge" and visible label', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: 'Activo', variant: 'pill' } }],
    }
    const { container } = renderRuntimePage(page)
    const badge = container.querySelector('[data-layout-node="badge"]')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('renders a badge with variant: "circle" with data-layout-node="badge" and visible label', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: 'Inactivo', variant: 'circle' } }],
    }
    const { container } = renderRuntimePage(page)
    const badge = container.querySelector('[data-layout-node="badge"]')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('renders a badge without variant as pill (default)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: 'Default' } }],
    }
    const { container } = renderRuntimePage(page)
    const badge = container.querySelector('[data-layout-node="badge"]')
    expect(badge).toBeInTheDocument()
    // pill variant classes: rounded-full, bg- and text- classes on the inner span
    expect(badge!.querySelector('.rounded-full')).toBeInTheDocument()
  })

  it('renders a badge without color as neutral (default)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: 'Neutral default' } }],
    }
    const { container } = renderRuntimePage(page)
    const badge = container.querySelector('[data-layout-node="badge"]')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Neutral default')).toBeInTheDocument()
  })
})

describe('BadgeNode — pill variant color classes (semantic tokens D10)', () => {
  const pillColors = [
    { color: 'neutral', bgClass: 'bg-neutral-100', textClass: 'text-neutral-700' },
    { color: 'primary', bgClass: 'bg-primary-100', textClass: 'text-primary-700' },
    { color: 'success', bgClass: 'bg-success-100', textClass: 'text-success-700' },
    { color: 'warning', bgClass: 'bg-warning-100', textClass: 'text-warning-700' },
    { color: 'danger', bgClass: 'bg-danger-100', textClass: 'text-danger-700' },
    { color: 'info', bgClass: 'bg-info-100', textClass: 'text-info-700' },
  ] as const

  pillColors.forEach(({ color, bgClass, textClass }) => {
    it(`badge pill with color="${color}" has ${bgClass} and ${textClass} classes (semantic)`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'badge', props: { label: 'Test', variant: 'pill', color } }],
      }
      const { container } = renderRuntimePage(page)
      const badge = container.querySelector('[data-layout-node="badge"]')
      expect(badge).toBeInTheDocument()
      // pill span inside badge
      const pillSpan = badge!.querySelector(`.${bgClass}`)
      expect(pillSpan).toBeInTheDocument()
      expect(pillSpan).toHaveClass(textClass)
    })
  })

  it('badge pill does not use any raw Tailwind color classes', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const
    colors.forEach((color) => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'badge', props: { label: 'Test', variant: 'pill', color } }],
      }
      const { container } = renderRuntimePage(page)
      const badge = container.querySelector('[data-layout-node="badge"]')
      const pillSpan = badge!.querySelector('.rounded-full')
      expect(pillSpan).not.toBeNull()
      // Verify no raw Tailwind color classes
      const classList = Array.from(pillSpan!.classList).join(' ')
      expect(classList).not.toMatch(/\b(blue|red|green|yellow|cyan|gray)-/)
    })
  })
})

describe('BadgeNode — circle variant color classes (semantic tokens D10)', () => {
  const circleColors = [
    { color: 'neutral', dotClass: 'bg-neutral-500' },
    { color: 'primary', dotClass: 'bg-primary-500' },
    { color: 'success', dotClass: 'bg-success-500' },
    { color: 'warning', dotClass: 'bg-warning-500' },
    { color: 'danger', dotClass: 'bg-danger-500' },
    { color: 'info', dotClass: 'bg-info-500' },
  ] as const

  circleColors.forEach(({ color, dotClass }) => {
    it(`badge circle with color="${color}" has dot with class ${dotClass} (semantic)`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'badge', props: { label: 'Test', variant: 'circle', color } }],
      }
      const { container } = renderRuntimePage(page)
      const badge = container.querySelector('[data-layout-node="badge"]')
      expect(badge).toBeInTheDocument()
      const dot = badge!.querySelector(`.${dotClass}`)
      expect(dot).toBeInTheDocument()
    })
  })

  it('badge circle dot does not use any raw Tailwind color classes', () => {
    const colors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const
    colors.forEach((color) => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'badge', props: { label: 'Test', variant: 'circle', color } }],
      }
      const { container } = renderRuntimePage(page)
      const badge = container.querySelector('[data-layout-node="badge"]')
      const dot = badge!.querySelector('.rounded-full.inline-block')
      expect(dot).not.toBeNull()
      const classList = Array.from(dot!.classList).join(' ')
      expect(classList).not.toMatch(/\b(blue|red|green|yellow|cyan|gray)-/)
    })
  })
})

describe('BadgeNode — label interpolation', () => {
  it('resolves {{queries.foo.data}} placeholder in props.label', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: '{{queries.foo.data}}' } }],
    }
    const state = createRuntimePageState(page, {
      foo: {
        status: 'success',
        data: 'Resuelto',
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Resuelto')).toBeInTheDocument()
  })

  it('renders the badge without text when props.label is empty string', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'badge', props: { label: '' } }],
    }
    const { container } = renderRuntimePage(page)
    const badge = container.querySelector('[data-layout-node="badge"]')
    expect(badge).toBeInTheDocument()
  })
})

describe('BadgeNode — transversal features (via LayoutNodeRenderer)', () => {
  it('hides the badge when visibility evaluates to false', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'badge',
          props: { label: 'Oculto' },
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

  it('shows feedback fallback when queryStateFeedback triggers on loading state', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'badge',
          props: { label: 'Original' },
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

  it('wraps badge in col-span wrapper when layout.span is set inside a container with columns', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'badge',
              layout: { span: 4 },
              props: { label: 'Span badge' },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-4')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="badge"]')).toBeInTheDocument()
  })
})
