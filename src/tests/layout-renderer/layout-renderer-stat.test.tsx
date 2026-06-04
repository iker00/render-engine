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

describe('StatNode — variant and data-layout-node', () => {
  it('stat with variant: "accent" renders an element with data-layout-node="stat" in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Revenue', value: '$12,000', variant: 'accent' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })

  it('stat with variant: "tinted" renders an element with data-layout-node="stat" in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Revenue', value: '$12,000', variant: 'tinted' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })

  it('stat without variant renders as accent (no tinted background color class)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Revenue', value: '$12,000' } }],
    }
    const { container } = renderRuntimePage(page)
    const stat = container.querySelector('[data-layout-node="stat"]')
    expect(stat).toBeInTheDocument()
    // accent variant: border-l-4 class, no tinted bg classes like bg-gray-100
    expect(stat).toHaveClass('border-l-4')
    expect(stat).not.toHaveClass('bg-gray-100')
  })

  it('stat without color uses neutral (accent: border-gray-400)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Revenue', value: '$12,000' } }],
    }
    const { container } = renderRuntimePage(page)
    const stat = container.querySelector('[data-layout-node="stat"]')
    expect(stat).toBeInTheDocument()
    expect(stat).toHaveClass('border-gray-400')
  })

  it('label and value are visible in the DOM as text', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Users', value: '1,234' } }],
    }
    renderRuntimePage(page)
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })
})

describe('StatNode — accent variant border color classes', () => {
  const accentColors = [
    { color: 'neutral', borderClass: 'border-gray-400' },
    { color: 'primary', borderClass: 'border-blue-500' },
    { color: 'success', borderClass: 'border-green-500' },
    { color: 'warning', borderClass: 'border-yellow-400' },
    { color: 'danger', borderClass: 'border-red-500' },
    { color: 'info', borderClass: 'border-cyan-500' },
  ] as const

  accentColors.forEach(({ color, borderClass }) => {
    it(`stat accent with color="${color}" has class ${borderClass} on the root element`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'stat', props: { label: 'Metric', value: '100', variant: 'accent', color } }],
      }
      const { container } = renderRuntimePage(page)
      const stat = container.querySelector('[data-layout-node="stat"]')
      expect(stat).toBeInTheDocument()
      expect(stat).toHaveClass(borderClass)
    })
  })
})

describe('StatNode — tinted variant background and text color classes', () => {
  const tintedColors = [
    { color: 'neutral', bgClass: 'bg-gray-100', labelClass: 'text-gray-600', valueClass: 'text-gray-800' },
    { color: 'primary', bgClass: 'bg-blue-100', labelClass: 'text-blue-600', valueClass: 'text-blue-800' },
    { color: 'success', bgClass: 'bg-green-100', labelClass: 'text-green-600', valueClass: 'text-green-800' },
    { color: 'warning', bgClass: 'bg-yellow-100', labelClass: 'text-yellow-600', valueClass: 'text-yellow-800' },
    { color: 'danger', bgClass: 'bg-red-100', labelClass: 'text-red-600', valueClass: 'text-red-800' },
    { color: 'info', bgClass: 'bg-cyan-100', labelClass: 'text-cyan-600', valueClass: 'text-cyan-800' },
  ] as const

  tintedColors.forEach(({ color, bgClass, labelClass, valueClass }) => {
    it(`stat tinted with color="${color}" has class ${bgClass} on the root element`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'stat', props: { label: 'Metric', value: '100', variant: 'tinted', color } }],
      }
      const { container } = renderRuntimePage(page)
      const stat = container.querySelector('[data-layout-node="stat"]')
      expect(stat).toBeInTheDocument()
      expect(stat).toHaveClass(bgClass)
    })

    it(`stat tinted with color="${color}" — label text has class ${labelClass}`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'stat', props: { label: 'Label text', value: '100', variant: 'tinted', color } }],
      }
      const { container } = renderRuntimePage(page)
      const labelEl = screen.getByText('Label text')
      expect(labelEl).toHaveClass(labelClass)
    })

    it(`stat tinted with color="${color}" — value text has class ${valueClass}`, () => {
      const page: RuntimePageConfig = {
        id: 'home',
        layout: [{ type: 'stat', props: { label: 'Label', value: 'Value text', variant: 'tinted', color } }],
      }
      const { container } = renderRuntimePage(page)
      const valueEl = screen.getByText('Value text')
      expect(valueEl).toHaveClass(valueClass)
    })
  })
})

describe('StatNode — interpolation', () => {
  it('props.label with {{queries.foo.data}} resolves to query value when query has status success', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: '{{queries.foo.data}}', value: '100' } }],
    }
    const state = createRuntimePageState(page, {
      foo: {
        status: 'success',
        data: 'Revenue',
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })

  it('props.value with {{queries.foo.data}} resolves to query value when query has status success', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Metric', value: '{{queries.foo.data}}' } }],
    }
    const state = createRuntimePageState(page, {
      foo: {
        status: 'success',
        data: '$42,000',
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    renderRuntimePageWithState(page, state)
    expect(screen.getByText('$42,000')).toBeInTheDocument()
  })

  it('props.label with empty string renders stat without label text visible (no error)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: '', value: '100' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })

  it('props.value with empty string renders stat without value text visible (no error)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Metric', value: '' } }],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })

  it('props.label with unresolved placeholder renders without error (data-layout-node="stat" present)', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: '{{queries.missing.data}}', value: '100' } }],
    }
    const state = createRuntimePageState(page, {})
    const { container } = renderRuntimePageWithState(page, state)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })

  it('props.value with unresolved placeholder renders without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'stat', props: { label: 'Metric', value: '{{queries.missing.data}}' } }],
    }
    const state = createRuntimePageState(page, {})
    const { container } = renderRuntimePageWithState(page, state)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })
})

describe('StatNode — transversal features', () => {
  it('stat with visibility evaluated to false is not rendered in the DOM', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'stat',
          props: { label: 'Hidden', value: '100' },
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
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('stat with queryStateFeedback in loading state with fallback paragraph renders the fallback and hides stat', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'stat',
          props: { label: 'Original', value: '100' },
          queryStateFeedback: {
            query: 'q',
            states: {
              loading: {
                mode: 'fallback',
                fallback: [{ type: 'paragraph', props: { text: 'Loading...' } }],
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
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Original')).not.toBeInTheDocument()
  })

  it('stat with layout.span: 4 inside a container with columns: 12 is wrapped in div.col-span-4', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'container',
          props: { columns: 12 },
          children: [
            {
              type: 'stat',
              layout: { span: 4 },
              props: { label: 'Metric', value: '100' },
            },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    const spanWrapper = container.querySelector('.col-span-4')
    expect(spanWrapper).toBeInTheDocument()
    expect(spanWrapper!.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })
})

describe('StatNode — repeater integration', () => {
  it('stat inside repeater with two items renders two [data-layout-node="stat"] with distinct labels and values using item.*', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: {
              source: 'queries.metrics.data',
              key: 'id',
            },
            template: [
              { type: 'stat', props: { label: '{{item.label}}', value: '{{item.value}}' } },
            ],
          },
        },
      ],
    }
    const state = createRuntimePageState(page, {
      metrics: {
        status: 'success',
        data: [
          { id: '1', label: 'Revenue', value: '$1,000' },
          { id: '2', label: 'Users', value: '500' },
        ],
        requestedAt: 0,
        resolvedAt: 0,
        error: null,
      },
    })
    const { container } = renderRuntimePageWithState(page, state)
    const stats = container.querySelectorAll('[data-layout-node="stat"]')
    expect(stats).toHaveLength(2)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })
})

describe('StatNode — form integration', () => {
  it('stat as child of a form renders [data-layout-node="stat"] in the DOM without error', () => {
    const page: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'form',
          id: 'test-form',
          children: [
            { type: 'stat', props: { label: 'Metric', value: '100' } },
          ],
        },
      ],
    }
    const { container } = renderRuntimePage(page)
    expect(container.querySelector('[data-layout-node="stat"]')).toBeInTheDocument()
  })
})
