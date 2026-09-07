import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState, type MutableRefObject } from 'react'
import { describe, expect, it } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import type { RuntimeGroupConfig } from '../../config/runtime-config-types'
import type { CommitResult, LayoutCanvasTarget, LayoutTreeMutation } from '../../dev-runtime/layout-canvas/layout-canvas-commit'
import { DevEditorGroupsCanvas } from '../../dev-runtime/floating-toolbar/dev-editor-groups-canvas'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function buildConfig(groups: Record<string, RuntimeGroupConfig>): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: [] }],
    groups,
  } as RuntimeConfig
}

const CARD_GROUP: RuntimeGroupConfig = {
  params: ['title'],
  template: [{ type: 'paragraph', props: { text: 'Value: {{group.title}}' } }] as LayoutNode[],
}

const BANNER_GROUP: RuntimeGroupConfig = {
  params: ['label'],
  template: [{ type: 'paragraph', props: { text: 'Banner: {{group.label}}' } }] as LayoutNode[],
}

const noopCommitLayoutMutation = (): CommitResult => ({ status: 'applied' })

// Stands in for the rest of `DevRuntime` mounted above this component in production — a
// mount-only effect (empty deps) so `mountCountRef` only increments on a genuine mount, the same
// pattern `dev-editor-layer.test.tsx`'s `EditModeProbe` uses to verify "switching never
// remounts" behavior.
function DevRuntimeProbe({ mountCountRef }: { mountCountRef: MutableRefObject<number> }) {
  useEffect(() => {
    mountCountRef.current += 1
  }, [mountCountRef])
  return null
}

interface HarnessProps {
  config: RuntimeConfig
  initialGroupId: string
  mountCountRef: MutableRefObject<number>
  onCommitLayoutMutation?: (target: LayoutCanvasTarget, patch: LayoutTreeMutation) => CommitResult
}

function Harness({ config, initialGroupId, mountCountRef, onCommitLayoutMutation = noopCommitLayoutMutation }: HarnessProps) {
  const [groupId, setGroupId] = useState(initialGroupId)
  const group = config.groups?.[groupId]
  if (!group) throw new Error(`setup: group "${groupId}" must exist in the fixture config`)

  return (
    <RuntimeStateProvider config={config}>
      <DevRuntimeProbe mountCountRef={mountCountRef} />
      <button type="button" onClick={() => setGroupId('banner')}>
        Switch to banner
      </button>
      <DevEditorGroupsCanvas groupId={groupId} group={group} onCommitLayoutMutation={onCommitLayoutMutation} />
    </RuntimeStateProvider>
  )
}

function renderHarness(overrides: Partial<HarnessProps> = {}) {
  const mountCountRef = { current: 0 }
  const config = overrides.config ?? buildConfig({ card: CARD_GROUP, banner: BANNER_GROUP })
  render(
    <Harness
      config={config}
      initialGroupId={overrides.initialGroupId ?? 'card'}
      mountCountRef={mountCountRef}
      onCommitLayoutMutation={overrides.onCommitLayoutMutation}
    />,
  )
  return { mountCountRef }
}

describe('DevEditorGroupsCanvas retargeting', () => {
  it('renders the selected group\'s template nodes', () => {
    renderHarness()
    expect(screen.getByTestId('dev-editor-groups-canvas')).toBeInTheDocument()
    expect(screen.getByText(/Value:/)).toBeInTheDocument()
  })
})

describe('DevEditorGroupsCanvas mock group context', () => {
  it('feeds a RuntimeGroupContextProvider with a mock value per declared param, substituting {{group.paramName}}', () => {
    renderHarness()
    // Explicit documented mock format: "{groupId}.{paramName}" — see dev-editor-groups-canvas.tsx.
    expect(screen.getByText('Value: card.title')).toBeInTheDocument()
  })

  it('uses a distinct mock value per group when a different group is selected', () => {
    renderHarness({ initialGroupId: 'banner' })
    expect(screen.getByText('Banner: banner.label')).toBeInTheDocument()
  })
})

describe('DevEditorGroupsCanvas switching target', () => {
  it('switching groupId swaps the rendered template without remounting the ambient DevRuntime tree', () => {
    const { mountCountRef } = renderHarness()
    expect(screen.getByText('Value: card.title')).toBeInTheDocument()
    expect(mountCountRef.current).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to banner' }))

    expect(screen.getByText('Banner: banner.label')).toBeInTheDocument()
    expect(screen.queryByText(/Value:/)).not.toBeInTheDocument()
    expect(mountCountRef.current).toBe(1)
  })
})
