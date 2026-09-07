import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { RuntimeStateContext } from '../../runtime/runtime-state/runtime-state-context'
import { createRuntimeState } from '../../runtime/runtime-state/runtime-state-reducer'
import type { RuntimeState, RuntimeStateAction } from '../../runtime/runtime-state/runtime-state-types'
import { EMPTY_INSTANCE_SCOPE } from '../../runtime/runtime-references/runtime-instance-scope'
import type { RuntimeInstanceScope } from '../../runtime/runtime-references/runtime-instance-scope'
import type { LayoutNodeRendererProps } from '../../runtime/layout-node-renderer'

// `LayoutNodeRenderer` is the single boundary through which every descendant node receives
// `scopeChain` (T02). Wrapping it here — rather than replacing it — lets this suite observe
// the value threaded by `LayoutRenderer`/`repeater` for arbitrary node types while still
// exercising the real render pipeline (no consumer node reads `scopeChain` yet, so there is no
// other observable side effect to assert on).
interface CapturedScopeChain {
  nodeType: LayoutNode['type']
  iterationKey: string | undefined
  scopeChain: RuntimeInstanceScope
}

const capturedScopeChains: CapturedScopeChain[] = []

vi.mock('../../runtime/layout-node-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../runtime/layout-node-renderer')>()
  return {
    ...actual,
    LayoutNodeRenderer: vi.fn((props: LayoutNodeRendererProps) => {
      capturedScopeChains.push({
        nodeType: props.node.type,
        iterationKey: props.iterationContext?.key,
        scopeChain: props.scopeChain ?? EMPTY_INSTANCE_SCOPE,
      })
      return actual.LayoutNodeRenderer(props)
    }),
  }
})

beforeEach(() => {
  capturedScopeChains.length = 0
})

function renderRuntimePageWithState(activePage: RuntimePageConfig, state: RuntimeState) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
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
    </RuntimeStateContext.Provider>,
  )
}

function createRuntimePageState(activePage: RuntimePageConfig, queries: RuntimeState['queries']) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return {
    ...createRuntimeState(config),
    queries,
  } satisfies RuntimeState
}

function renderLayoutDirectly(nodes: LayoutNode[], scopeChain?: RuntimeInstanceScope) {
  const config: RuntimeConfig = { api: {}, initialPage: 'home', pages: [{ id: 'home', layout: nodes }] }
  const state = createRuntimeState(config)

  return render(
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
      <LayoutRenderer nodes={nodes} scopeChain={scopeChain} />
    </RuntimeStateContext.Provider>,
  )
}

describe('scopeChain threading through LayoutRenderer/LayoutNodeRenderer/repeater', () => {
  it('gives a node rendered outside any repeater an empty scopeChain', () => {
    const activePage: RuntimePageConfig = {
      id: 'home',
      layout: [{ type: 'heading', props: { text: 'Probe', level: 2 } }],
    }

    renderRuntimePageWithState(activePage, createRuntimePageState(activePage, {}))

    const probeCaptures = capturedScopeChains.filter((capture) => capture.nodeType === 'heading')
    expect(probeCaptures).toHaveLength(1)
    expect(probeCaptures[0].scopeChain).toEqual(EMPTY_INSTANCE_SCOPE)
  })

  it('gives a node inside repeater.props.template exactly one repeater token per iteration, distinct per iteration', () => {
    const activePage: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.items.data', key: 'id' },
            template: [{ type: 'heading', props: { text: 'item.id', level: 2 } }],
          },
        },
      ],
    }

    renderRuntimePageWithState(
      activePage,
      createRuntimePageState(activePage, {
        items: {
          status: 'success',
          data: [{ id: 'a' }, { id: 'b' }],
          error: null,
          requestSignature: null,
        },
      }),
    )

    const probeCaptures = capturedScopeChains.filter((capture) => capture.nodeType === 'heading')
    expect(probeCaptures.map((capture) => capture.scopeChain)).toEqual([
      [{ kind: 'repeater', key: 'a' }],
      [{ kind: 'repeater', key: 'b' }],
    ])
  })

  it('gives a node inside a repeater nested in repeater.props.template a chain of length 2, outer iteration first', () => {
    const activePage: RuntimePageConfig = {
      id: 'home',
      layout: [
        {
          type: 'repeater',
          props: {
            items: { source: 'queries.outer.data', key: 'id' },
            template: [
              {
                type: 'repeater',
                props: {
                  items: { source: 'queries.inner.data', key: 'id' },
                  template: [{ type: 'heading', props: { text: 'Probe', level: 3 } }],
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
        outer: {
          status: 'success',
          data: [{ id: 'o1' }, { id: 'o2' }],
          error: null,
          requestSignature: null,
        },
        inner: {
          status: 'success',
          data: [{ id: 'i1' }, { id: 'i2' }],
          error: null,
          requestSignature: null,
        },
      }),
    )

    const probeCaptures = capturedScopeChains.filter((capture) => capture.nodeType === 'heading')
    expect(probeCaptures.map((capture) => capture.scopeChain)).toEqual([
      [
        { kind: 'repeater', key: 'o1' },
        { kind: 'repeater', key: 'i1' },
      ],
      [
        { kind: 'repeater', key: 'o1' },
        { kind: 'repeater', key: 'i2' },
      ],
      [
        { kind: 'repeater', key: 'o2' },
        { kind: 'repeater', key: 'i1' },
      ],
      [
        { kind: 'repeater', key: 'o2' },
        { kind: 'repeater', key: 'i2' },
      ],
    ])
  })

  it('renders a repeater-less layout identically whether the consumer declares scopeChain explicitly or omits it', () => {
    const nodes: LayoutNode[] = [
      { type: 'heading', props: { text: 'Welcome', level: 1 } },
      { type: 'paragraph', props: { text: 'Build forms from configuration.' } },
      {
        type: 'container',
        props: { direction: 'row', gap: 'sm' },
        children: [{ type: 'list', props: { items: ['Reusable layout nodes', 'Static content'] } }],
      },
    ]

    const withoutExplicitProp = renderLayoutDirectly(nodes)
    const htmlWithoutExplicitProp = withoutExplicitProp.container.innerHTML
    withoutExplicitProp.unmount()

    const withExplicitProp = renderLayoutDirectly(nodes, EMPTY_INSTANCE_SCOPE)
    const htmlWithExplicitProp = withExplicitProp.container.innerHTML
    withExplicitProp.unmount()

    expect(htmlWithExplicitProp).toBe(htmlWithoutExplicitProp)
  })
})
