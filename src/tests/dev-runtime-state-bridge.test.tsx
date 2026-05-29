import { createRef } from 'react'
import { render, act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../config/runtime-config'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'
import { RuntimePage } from '../runtime/runtime-page'
import type { DevRuntimeStateBridgeHandle } from '../dev-runtime/dev-runtime-state-bridge'
import { DevRuntimeStateBridge } from '../dev-runtime/dev-runtime-state-bridge'
import { createRuntimeState } from '../runtime/runtime-state/runtime-state-reducer'

const configFixture: RuntimeConfig = {
  api: {},
  initialPage: 'home',
  pages: [{ id: 'home', layout: [] }],
}

describe('DevRuntimeStateBridge', () => {
  it('getLatestState returns the current provider state', () => {
    const ref = createRef<DevRuntimeStateBridgeHandle>()
    render(
      <RuntimeStateProvider config={configFixture}>
        <DevRuntimeStateBridge ref={ref} />
      </RuntimeStateProvider>,
    )

    const state = ref.current!.getLatestState()
    expect(state.navigation.currentPageId).toBe('home')
    expect(state.pageEntry.pageId).toBe('home')
  })

  it('dispatchAndSyncState replaces the runtime state and provider reflects the change', () => {
    const ref = createRef<DevRuntimeStateBridgeHandle>()
    render(
      <RuntimeStateProvider config={configFixture}>
        <DevRuntimeStateBridge ref={ref} />
      </RuntimeStateProvider>,
    )

    const resetState = {
      ...createRuntimeState(configFixture),
      navigation: {
        currentPageId: 'home',
        history: [{ entryId: 99, pageId: 'home', params: {} }],
        currentEntryIndex: 0,
        lastError: null,
      },
    }

    act(() => {
      ref.current!.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: resetState } })
    })

    const stateAfter = ref.current!.getLatestState()
    expect(stateAfter.navigation.history[0].entryId).toBe(99)
  })

  it('renders no visible nodes', () => {
    const ref = createRef<DevRuntimeStateBridgeHandle>()
    const { container } = render(
      <RuntimeStateProvider config={configFixture}>
        <DevRuntimeStateBridge ref={ref} />
      </RuntimeStateProvider>,
    )

    expect(container.firstChild).toBeNull()
  })

  it('does not interfere with RuntimePage mounted as a sibling', () => {
    const configWithContent: RuntimeConfig = {
      api: {},
      initialPage: 'home',
      pages: [
        {
          id: 'home',
          layout: [{ type: 'heading', props: { text: 'Hello from runtime', level: 1 } }],
        },
      ],
    }
    const ref = createRef<DevRuntimeStateBridgeHandle>()
    render(
      <RuntimeStateProvider config={configWithContent}>
        <DevRuntimeStateBridge ref={ref} />
        <RuntimePage />
      </RuntimeStateProvider>,
    )

    expect(screen.getByText('Hello from runtime')).toBeInTheDocument()
  })

  it('throws a clear error when mounted outside RuntimeStateProvider', () => {
    const ref = createRef<DevRuntimeStateBridgeHandle>()
    const consoleError = console.error
    console.error = () => {}
    expect(() => {
      render(<DevRuntimeStateBridge ref={ref} />)
    }).toThrow()
    console.error = consoleError
  })
})
