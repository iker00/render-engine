import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ShellTreeDndContext,
  ShellTreeDraggableRow,
  ShellTreeGapZone,
} from '../../dev-runtime/shell-config-panel/shell-config-panel-dnd'
import { parseShellTreeDropZoneId, type ShellTreeDestination } from '../../dev-runtime/shell-config-panel/shell-tree-mutations'

// Same mocking pattern as layout-canvas-dnd-wiring.test.tsx / shell-config-panel.test.tsx: real
// pointer-drag simulation is impractical in jsdom, so `DndContext` becomes a pass-through that
// captures the `onDragEnd`/`onDragOver`/`onDragCancel` handlers it was given, keyed by its own
// `id` prop (one distinct id per tree: header vs sidebar). Tests then invoke the captured
// handlers directly with synthetic {active, over} pairs. `useDraggable`/`useDroppable` keep
// their real implementation so the row/zone wiring itself still exercises the genuine hooks.
type CapturedHandlers = {
  onDragEnd?: (event: { active: { id: string }; over: { id: string } | null }) => void
  onDragOver?: (event: { active: { id: string }; over: { id: string } | null }) => void
  onDragCancel?: () => void
}

const capturedByTreeId = new Map<string, CapturedHandlers>()

// Forces a given droppable id's `isOver` to a fixed value, on top of the real `useDroppable`
// implementation — used only by the `ShellTreeDraggableRow` isOver test below, so that test can
// verify the row's own isOver-driven className without needing a real, simulated pointer drag.
const droppableIsOverOverrides = new Map<string, boolean>()

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: {
      id?: string
      children: React.ReactNode
      onDragEnd?: CapturedHandlers['onDragEnd']
      onDragOver?: CapturedHandlers['onDragOver']
      onDragCancel?: CapturedHandlers['onDragCancel']
    }) => {
      if (props.id) {
        capturedByTreeId.set(props.id, {
          onDragEnd: props.onDragEnd,
          onDragOver: props.onDragOver,
          onDragCancel: props.onDragCancel,
        })
      }
      return props.children
    },
    useDroppable: (args: { id: string | number }) => {
      const real = actual.useDroppable(args)
      const forcedIsOver = droppableIsOverOverrides.get(String(args.id))
      return forcedIsOver === undefined ? real : { ...real, isOver: forcedIsOver }
    },
  }
})

afterEach(() => {
  droppableIsOverOverrides.clear()
})

describe('parseShellTreeDropZoneId', () => {
  it('parses a gap zone at the root (empty parentPath)', () => {
    expect(parseShellTreeDropZoneId('gap::0')).toEqual({ type: 'gap', parentPath: '', index: 0 })
  })

  it('parses a gap zone under a nested parentPath', () => {
    expect(parseShellTreeDropZoneId('gap:0:2')).toEqual({ type: 'gap', parentPath: '0', index: 2 })
  })

  it('parses a nest zone', () => {
    expect(parseShellTreeDropZoneId('nest:0.1')).toEqual({ type: 'nest', path: '0.1' })
  })

  it('returns null for ids without a gap:/nest: prefix', () => {
    expect(parseShellTreeDropZoneId('drop:0:1')).toBeNull()
    expect(parseShellTreeDropZoneId('0.1')).toBeNull()
  })

  it('returns null for a gap id with a non-numeric index', () => {
    expect(parseShellTreeDropZoneId('gap:0:not-a-number')).toBeNull()
  })

  it('returns null for an empty id', () => {
    expect(parseShellTreeDropZoneId('')).toBeNull()
  })
})

function renderTree(props: {
  treeId: string
  onMoveAttempt: (sourcePath: string, destination: ShellTreeDestination) => void
  isValidDestination: (sourcePath: string, destination: ShellTreeDestination) => boolean
}) {
  return render(
    <ShellTreeDndContext treeId={props.treeId} onMoveAttempt={props.onMoveAttempt} isValidDestination={props.isValidDestination}>
      <ShellTreeGapZone parentPath="" index={0} />
      <ShellTreeDraggableRow path="0" dragHandleLabel="Reordenar elemento 1">
        <span>Item 0</span>
      </ShellTreeDraggableRow>
      <ShellTreeGapZone parentPath="" index={1} />
    </ShellTreeDndContext>,
  )
}

describe('ShellTreeDndContext onDragEnd', () => {
  it('invokes onMoveAttempt with sourcePath/destination for a valid gap drop', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-a', onMoveAttempt, isValidDestination })

    capturedByTreeId.get('tree-a')!.onDragEnd!({ active: { id: '1' }, over: { id: 'gap::0' } })

    expect(isValidDestination).toHaveBeenCalledWith('1', { type: 'gap', parentPath: '', index: 0 })
    expect(onMoveAttempt).toHaveBeenCalledTimes(1)
    expect(onMoveAttempt).toHaveBeenCalledWith('1', { type: 'gap', parentPath: '', index: 0 })
  })

  it('invokes onMoveAttempt with sourcePath/destination for a valid nest drop', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-b', onMoveAttempt, isValidDestination })

    capturedByTreeId.get('tree-b')!.onDragEnd!({ active: { id: '1' }, over: { id: 'nest:0' } })

    expect(isValidDestination).toHaveBeenCalledWith('1', { type: 'nest', path: '0' })
    expect(onMoveAttempt).toHaveBeenCalledTimes(1)
    expect(onMoveAttempt).toHaveBeenCalledWith('1', { type: 'nest', path: '0' })
  })

  it('does not invoke onMoveAttempt when isValidDestination returns false', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(false)
    renderTree({ treeId: 'tree-c', onMoveAttempt, isValidDestination })

    capturedByTreeId.get('tree-c')!.onDragEnd!({ active: { id: '1' }, over: { id: 'gap::0' } })

    expect(onMoveAttempt).not.toHaveBeenCalled()
  })

  it('does not invoke onMoveAttempt and does not throw when over is null', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-d', onMoveAttempt, isValidDestination })

    expect(() => capturedByTreeId.get('tree-d')!.onDragEnd!({ active: { id: '1' }, over: null })).not.toThrow()
    expect(onMoveAttempt).not.toHaveBeenCalled()
  })

  it('does not invoke onMoveAttempt and does not throw when over.id is not parseable', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-e', onMoveAttempt, isValidDestination })

    expect(() =>
      capturedByTreeId.get('tree-e')!.onDragEnd!({ active: { id: '1' }, over: { id: 'not-a-zone' } }),
    ).not.toThrow()
    expect(onMoveAttempt).not.toHaveBeenCalled()
  })
})

describe('ShellTreeDndContext onDragOver: validity indicator', () => {
  it('marks the hovered zone with the valid (emerald) classes when isValidDestination is true', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-f', onMoveAttempt, isValidDestination })

    capturedByTreeId.get('tree-f')!.onDragOver!({ active: { id: '1' }, over: { id: 'gap::0' } })

    const zone = document.querySelector('[data-drop-zone="gap::0"]')!
    expect(zone.classList.contains('outline-emerald-500')).toBe(true)
    expect(zone.classList.contains('outline-red-500')).toBe(false)
  })

  it('marks the hovered zone with the invalid (red) classes when isValidDestination is false', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(false)
    renderTree({ treeId: 'tree-g', onMoveAttempt, isValidDestination })

    capturedByTreeId.get('tree-g')!.onDragOver!({ active: { id: '1' }, over: { id: 'gap::0' } })

    const zone = document.querySelector('[data-drop-zone="gap::0"]')!
    expect(zone.classList.contains('outline-red-500')).toBe(true)
    expect(zone.classList.contains('outline-emerald-500')).toBe(false)
  })

  it('clears the previous zone classes when hovering over a different zone', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-h', onMoveAttempt, isValidDestination })

    const handlers = capturedByTreeId.get('tree-h')!
    handlers.onDragOver!({ active: { id: '1' }, over: { id: 'gap::0' } })
    handlers.onDragOver!({ active: { id: '1' }, over: { id: 'gap::1' } })

    const firstZone = document.querySelector('[data-drop-zone="gap::0"]')!
    const secondZone = document.querySelector('[data-drop-zone="gap::1"]')!
    expect(firstZone.classList.contains('outline-emerald-500')).toBe(false)
    expect(secondZone.classList.contains('outline-emerald-500')).toBe(true)
  })

  it('clears the marked zone classes on drag cancel', () => {
    const onMoveAttempt = vi.fn()
    const isValidDestination = vi.fn().mockReturnValue(true)
    renderTree({ treeId: 'tree-i', onMoveAttempt, isValidDestination })

    const handlers = capturedByTreeId.get('tree-i')!
    handlers.onDragOver!({ active: { id: '1' }, over: { id: 'gap::0' } })
    handlers.onDragCancel!()

    const zone = document.querySelector('[data-drop-zone="gap::0"]')!
    expect(zone.classList.contains('outline-emerald-500')).toBe(false)
    expect(zone.classList.contains('outline-red-500')).toBe(false)
  })
})

describe('ShellTreeGapZone', () => {
  it('renders the id/data-drop-zone derived from parentPath/index', () => {
    render(<ShellTreeGapZone parentPath="0.1" index={3} />)

    const zone = document.querySelector('[data-drop-zone="gap:0.1:3"]')
    expect(zone).not.toBeNull()
    expect(zone).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('ShellTreeDraggableRow', () => {
  it('exposes the drag handle button with dragHandleLabel as its accessible name', () => {
    const { getByRole } = render(
      <ShellTreeDraggableRow path="0" dragHandleLabel="Reordenar elemento de menú 1">
        <span>Row content</span>
      </ShellTreeDraggableRow>,
    )

    expect(getByRole('button', { name: 'Reordenar elemento de menú 1' })).toBeInTheDocument()
  })

  it('renders the row body as a droppable nest zone at nest:{path}', () => {
    const { container } = render(
      <ShellTreeDraggableRow path="0.2" dragHandleLabel="Reordenar">
        <span>Row content</span>
      </ShellTreeDraggableRow>,
    )

    expect(container.querySelector('[data-testid="shell-tree-row-0.2"]')).not.toBeNull()
  })

  it('applies the isOver indicator while the pointer is over the row, without a validity class', () => {
    droppableIsOverOverrides.set('nest:0', true)

    const { container } = render(
      <ShellTreeDraggableRow path="0" dragHandleLabel="Reordenar">
        <span>Row content</span>
      </ShellTreeDraggableRow>,
    )

    const row = container.querySelector('[data-testid="shell-tree-row-0"]')!
    expect(row.classList.contains('outline-emerald-500')).toBe(true)
    expect(row.classList.contains('outline-red-500')).toBe(false)
  })
})
