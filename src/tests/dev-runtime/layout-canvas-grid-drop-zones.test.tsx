import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LayoutNode, RuntimeConfig } from '../../config/runtime-config'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import { parseDropZoneId, serializeDropZoneId } from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

// T1 (feature 0105 / RF1): contract for the drop-zone gaps `LayoutRenderer` injects in Editor
// mode when the collection it iterates is the direct children of a `container` in grid mode
// (`props.columns` set). A gap participating in the grid flow like a real item would consume
// its own cell and shift every subsequent child's column/row relative to Visual mode, so in
// grid mode only the boundary gaps (index 0 and index N) are rendered, each forced to span the
// full grid row. No mock of `@dnd-kit/core` is introduced here: `useDroppable` without an
// ancestor `DndContext` is a safe no-op, exactly as `layout-renderer.tsx` already assumes for
// production rendering.

function buildConfig(nodes: LayoutNode[]): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [{ id: 'home', layout: nodes }],
  }
}

function renderEditor(nodes: LayoutNode[]) {
  return render(
    <RuntimeStateProvider config={buildConfig(nodes)}>
      <LayoutEditModeProvider
        value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode: vi.fn(), onHoverNode: vi.fn() }}
      >
        <LayoutRenderer nodes={nodes} />
      </LayoutEditModeProvider>
    </RuntimeStateProvider>,
  )
}

function renderVisual(nodes: LayoutNode[]) {
  return render(
    <RuntimeStateProvider config={buildConfig(nodes)}>
      <LayoutRenderer nodes={nodes} />
    </RuntimeStateProvider>,
  )
}

function getDirectDropZones(container: HTMLElement) {
  const section = container.querySelector('[data-layout-node="container"]') as HTMLElement
  return Array.from(section.children).filter((el) => el.hasAttribute('data-drop-zone'))
}

function getRealChildTexts(container: HTMLElement) {
  const section = container.querySelector('[data-layout-node="container"]') as HTMLElement
  return Array.from(section.children)
    .filter((el) => !el.hasAttribute('data-drop-zone'))
    .map((el) => el.textContent)
}

// Container path is `children.0` because it is the only root node; its own children
// collection is rendered by a nested `LayoutRenderer` whose drop-zone `parentPath` is that
// same path.
const containerPath = [{ field: 'children' as const, index: 0 }]

describe('LayoutRenderer drop-zone contract inside a grid container (modo Editor)', () => {
  const fiveChildren: LayoutNode[] = [
    { type: 'heading', props: { text: 'One', level: 2 } },
    { type: 'paragraph', props: { text: 'Two' } },
    { type: 'divider' },
    { type: 'paragraph', props: { text: 'Four' } },
    { type: 'heading', props: { text: 'Five', level: 3 } },
  ]

  it('renders exactly 2 drop-zones (index 0 and index N) for a fixed columns container, with no intermediate zone', () => {
    const nodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: fiveChildren }]

    const { container } = renderEditor(nodes)
    const dropZones = getDirectDropZones(container)

    expect(dropZones).toHaveLength(2)

    const ids = dropZones.map((el) => el.getAttribute('data-drop-zone'))
    expect(ids).toContain(serializeDropZoneId({ parentPath: containerPath, index: 0 }))
    expect(ids).toContain(serializeDropZoneId({ parentPath: containerPath, index: fiveChildren.length }))

    for (const intermediateIndex of [1, 2, 3, 4]) {
      expect(ids).not.toContain(serializeDropZoneId({ parentPath: containerPath, index: intermediateIndex }))
    }
  })

  it('forces grid-column: 1 / -1 on both boundary drop-zones so they never occupy a real column', () => {
    const nodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: fiveChildren }]

    const { container } = renderEditor(nodes)
    const dropZones = getDirectDropZones(container)

    for (const zone of dropZones) {
      expect(zone).toHaveStyle('grid-column: 1 / -1')
    }
  })

  it('round-trips both boundary drop-zone ids back to the container path and the right index', () => {
    const nodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: fiveChildren }]

    const { container } = renderEditor(nodes)
    const ids = getDirectDropZones(container).map((el) => el.getAttribute('data-drop-zone') as string)
    const parsed = ids.map((id) => parseDropZoneId(id))

    expect(parsed.map((zone) => zone?.index).toSorted()).toEqual([0, fiveChildren.length])
    for (const zone of parsed) {
      expect(zone?.parentPath).toEqual(containerPath)
    }
  })

  it('preserves the N+1 drop-zone contract (regression) for a container without columns (flex/row)', () => {
    const threeChildren: LayoutNode[] = [
      { type: 'paragraph', props: { text: 'A' } },
      { type: 'paragraph', props: { text: 'B' } },
      { type: 'paragraph', props: { text: 'C' } },
    ]
    const nodes: LayoutNode[] = [{ type: 'container', props: { direction: 'row' }, children: threeChildren }]

    const { container } = renderEditor(nodes)
    const dropZones = getDirectDropZones(container)

    expect(dropZones).toHaveLength(4)
    const ids = dropZones.map((el) => el.getAttribute('data-drop-zone'))
    for (let index = 0; index <= 3; index += 1) {
      expect(ids).toContain(serializeDropZoneId({ parentPath: containerPath, index }))
    }

    for (const zone of dropZones) {
      expect(zone.getAttribute('style') ?? '').not.toContain('grid-column')
    }
  })

  it('still exposes only the 2 boundary drop-zones for a responsive columns map (base/md)', () => {
    const fourChildren: LayoutNode[] = [
      { type: 'paragraph', props: { text: 'A' } },
      { type: 'paragraph', props: { text: 'B' } },
      { type: 'paragraph', props: { text: 'C' } },
      { type: 'paragraph', props: { text: 'D' } },
    ]
    const nodes: LayoutNode[] = [
      { type: 'container', props: { columns: { base: 1, md: 4 } }, children: fourChildren },
    ]

    const { container } = renderEditor(nodes)
    const dropZones = getDirectDropZones(container)

    expect(dropZones).toHaveLength(2)
  })

  it('keeps the boundary-only contract and the order/span classes of pre-existing children after a node is inserted (simulated canvas commit)', () => {
    const initialChildren: LayoutNode[] = [
      { type: 'paragraph', props: { text: 'P1' } },
      { type: 'paragraph', props: { text: 'P2' }, layout: { span: 2 } },
      { type: 'paragraph', props: { text: 'P3' } },
    ]
    const initialNodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: initialChildren }]

    const { container, rerender } = renderEditor(initialNodes)

    expect(getDirectDropZones(container)).toHaveLength(2)
    expect(container.querySelectorAll('.col-span-2')).toHaveLength(1)
    expect(container.querySelector('.col-span-2')?.textContent).toBe('P2')

    const updatedChildren: LayoutNode[] = [
      { type: 'paragraph', props: { text: 'P1' } },
      { type: 'paragraph', props: { text: 'INSERTED' } },
      { type: 'paragraph', props: { text: 'P2' }, layout: { span: 2 } },
      { type: 'paragraph', props: { text: 'P3' } },
    ]
    const updatedNodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: updatedChildren }]

    rerender(
      <RuntimeStateProvider config={buildConfig(updatedNodes)}>
        <LayoutEditModeProvider
          value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode: vi.fn(), onHoverNode: vi.fn() }}
        >
          <LayoutRenderer nodes={updatedNodes} />
        </LayoutEditModeProvider>
      </RuntimeStateProvider>,
    )

    expect(getRealChildTexts(container)).toEqual(['P1', 'INSERTED', 'P2', 'P3'])
    expect(getDirectDropZones(container)).toHaveLength(2)
    const idsAfterInsert = getDirectDropZones(container).map((el) => el.getAttribute('data-drop-zone'))
    expect(idsAfterInsert).toContain(serializeDropZoneId({ parentPath: containerPath, index: 0 }))
    expect(idsAfterInsert).toContain(serializeDropZoneId({ parentPath: containerPath, index: updatedChildren.length }))

    expect(container.querySelectorAll('.col-span-2')).toHaveLength(1)
    expect(container.querySelector('.col-span-2')?.textContent).toBe('P2')
  })

  it('renders no drop-zone at all in Visual mode/production for the same grid container (byte-identical guarantee)', () => {
    const nodes: LayoutNode[] = [{ type: 'container', props: { columns: 3 }, children: fiveChildren }]

    const { container } = renderVisual(nodes)

    expect(container.querySelectorAll('[data-drop-zone]')).toHaveLength(0)
    expect(getRealChildTexts(container)).toEqual(['One', 'Two', '', 'Four', 'Five'])
  })
})
