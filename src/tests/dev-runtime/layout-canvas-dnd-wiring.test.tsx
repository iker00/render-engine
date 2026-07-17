import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { LayoutCanvas } from '../../dev-runtime/layout-canvas/layout-canvas'
import {
  deserializeLayoutNodePath,
  parseDropZoneId,
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import type { LayoutCanvasDropAttempt } from '../../dev-runtime/layout-canvas/layout-canvas-dnd-context'

// Light mock of @dnd-kit/core (see subagent-prompt.md / T12 tests contract): real pointer
// simulation against PointerSensor is impractical in jsdom (no real layout, no real
// PointerEvent-driven activation). DndContext is replaced with a pass-through that captures
// the onDragEnd handler LayoutCanvasDndContext registers, so tests can invoke it directly
// with synthetic {active, over} pairs. useDraggable/useDroppable keep their real
// implementation (recorded via a spy) so the hooks still behave like the real library and
// exercise the actual id-construction path in layout-node-renderer.tsx / layout-renderer.tsx.
const draggableCalls: string[] = []
const droppableCalls: string[] = []
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core')
  return {
    ...actual,
    DndContext: (props: { children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => {
      capturedOnDragEnd = props.onDragEnd as typeof capturedOnDragEnd
      return props.children
    },
    useDraggable: (args: { id: string | number }) => {
      draggableCalls.push(String(args.id))
      return actual.useDraggable(args)
    },
    useDroppable: (args: { id: string | number }) => {
      droppableCalls.push(String(args.id))
      return actual.useDroppable(args)
    },
  }
})

function buildConfig(): RuntimeConfig {
  return {
    api: {},
    initialPage: 'home',
    pages: [
      {
        id: 'home',
        layout: [
          {
            type: 'container',
            props: {},
            children: [
              { type: 'heading', props: { text: 'First', level: 1 } },
              { type: 'heading', props: { text: 'Second', level: 1 } },
            ],
          },
          { type: 'container', props: {}, children: [] },
        ],
      },
    ],
  }
}

const CONTAINER_A_PATH: LayoutNodePath = [{ field: 'children', index: 0 }]
const HEADING_FIRST_PATH: LayoutNodePath = [
  { field: 'children', index: 0 },
  { field: 'children', index: 0 },
]
const HEADING_SECOND_PATH: LayoutNodePath = [
  { field: 'children', index: 0 },
  { field: 'children', index: 1 },
]
const CONTAINER_B_EMPTY_PATH: LayoutNodePath = [{ field: 'children', index: 1 }]

const BETWEEN_SIBLINGS_ZONE_ID = serializeDropZoneId({ parentPath: CONTAINER_A_PATH, index: 1 })
const EMPTY_PLACEHOLDER_ZONE_ID = serializeDropZoneId({ parentPath: CONTAINER_B_EMPTY_PATH, index: 0 })

function renderCanvas(onDropAttempt: (attempt: LayoutCanvasDropAttempt) => void) {
  return render(
    <LayoutCanvas
      config={buildConfig()}
      activePageId="home"
      onActivePageIdChange={() => {}}
      onDropAttempt={onDropAttempt}
    />,
  )
}

beforeEach(() => {
  draggableCalls.length = 0
  droppableCalls.length = 0
  capturedOnDragEnd = null
})

describe('LayoutCanvasDndContext wiring: draggable nodes', () => {
  it('makes every rendered node draggable via useDraggable, keyed by its serialized path', () => {
    renderCanvas(() => {})

    expect(draggableCalls).toContain(serializeLayoutNodePath(CONTAINER_A_PATH))
    expect(draggableCalls).toContain(serializeLayoutNodePath(HEADING_FIRST_PATH))
    expect(draggableCalls).toContain(serializeLayoutNodePath(HEADING_SECOND_PATH))
    expect(draggableCalls).toContain(serializeLayoutNodePath(CONTAINER_B_EMPTY_PATH))
  })
})

describe('LayoutCanvasDndContext wiring: droppable zones', () => {
  it('registers a droppable zone between two known siblings, encoding the parent path and insertion index', () => {
    renderCanvas(() => {})

    expect(droppableCalls).toContain(BETWEEN_SIBLINGS_ZONE_ID)

    const zone = parseDropZoneId(BETWEEN_SIBLINGS_ZONE_ID) as LayoutCanvasDropZone
    expect(zone.parentPath).toEqual(CONTAINER_A_PATH)
    expect(zone.index).toBe(1)
    expect(zone.tabItemIndex).toBeUndefined()
  })

  it('registers the empty container placeholder as a droppable zone at index 0 of the container', () => {
    renderCanvas(() => {})

    expect(droppableCalls).toContain(EMPTY_PLACEHOLDER_ZONE_ID)

    const zone = parseDropZoneId(EMPTY_PLACEHOLDER_ZONE_ID) as LayoutCanvasDropZone
    expect(zone.parentPath).toEqual(CONTAINER_B_EMPTY_PATH)
    expect(zone.index).toBe(0)
  })
})

describe('LayoutCanvasDndContext onDragEnd: raw drop attempt', () => {
  it('produces exactly {draggedPath, targetParentPath, targetIndex} for a drop between two known siblings', () => {
    const onDropAttempt = vi.fn()
    renderCanvas(onDropAttempt)

    expect(capturedOnDragEnd).not.toBeNull()
    capturedOnDragEnd!({
      active: { id: serializeLayoutNodePath(HEADING_FIRST_PATH) },
      over: { id: BETWEEN_SIBLINGS_ZONE_ID },
    })

    expect(onDropAttempt).toHaveBeenCalledTimes(1)
    expect(onDropAttempt).toHaveBeenCalledWith({
      draggedPath: HEADING_FIRST_PATH,
      targetParentPath: CONTAINER_A_PATH,
      targetIndex: 1,
      targetTabItemIndex: undefined,
    })
  })

  it('produces targetParentPath equal to the container path and targetIndex 0 for a drop on an empty container placeholder', () => {
    const onDropAttempt = vi.fn()
    renderCanvas(onDropAttempt)

    capturedOnDragEnd!({
      active: { id: serializeLayoutNodePath(HEADING_SECOND_PATH) },
      over: { id: EMPTY_PLACEHOLDER_ZONE_ID },
    })

    expect(onDropAttempt).toHaveBeenCalledTimes(1)
    expect(onDropAttempt).toHaveBeenCalledWith({
      draggedPath: HEADING_SECOND_PATH,
      targetParentPath: CONTAINER_B_EMPTY_PATH,
      targetIndex: 0,
      targetTabItemIndex: undefined,
    })
  })

  it('does not invoke the drop-attempt callback for a drag cancelled outside any droppable', () => {
    const onDropAttempt = vi.fn()
    renderCanvas(onDropAttempt)

    capturedOnDragEnd!({
      active: { id: serializeLayoutNodePath(HEADING_FIRST_PATH) },
      over: null,
    })

    expect(onDropAttempt).not.toHaveBeenCalled()
  })
})

describe('drop zone id encoding (pure, non-ambiguous)', () => {
  it('round-trips parentPath/index through serializeDropZoneId/parseDropZoneId', () => {
    const zone: LayoutCanvasDropZone = { parentPath: CONTAINER_A_PATH, index: 2 }
    const id = serializeDropZoneId(zone)

    expect(id).toBe('drop:children.0:2')
    expect(parseDropZoneId(id)).toEqual({ parentPath: CONTAINER_A_PATH, index: 2 })
  })

  it('round-trips a tabItemIndex disambiguator for a drop target inside a tabs node', () => {
    const zone: LayoutCanvasDropZone = { parentPath: CONTAINER_A_PATH, index: 1, tabItemIndex: 0 }
    const id = serializeDropZoneId(zone)

    expect(id).toBe('drop:children.0:1:tabItem.0')
    expect(parseDropZoneId(id)).toEqual({ parentPath: CONTAINER_A_PATH, index: 1, tabItemIndex: 0 })
  })

  it('encodes an empty parentPath (root) with no ambiguity', () => {
    const id = serializeDropZoneId({ parentPath: [], index: 0 })

    expect(id).toBe('drop::0')
    expect(parseDropZoneId(id)).toEqual({ parentPath: [], index: 0 })
  })

  it('returns null for malformed zone ids', () => {
    expect(parseDropZoneId('not-a-drop-zone')).toBeNull()
    expect(parseDropZoneId('drop:children.0:not-a-number')).toBeNull()
    expect(parseDropZoneId('drop:children.0:1:not-tabitem')).toBeNull()
  })

  it('round-trips a draggable node id through serializeLayoutNodePath/deserializeLayoutNodePath', () => {
    expect(deserializeLayoutNodePath(serializeLayoutNodePath(HEADING_FIRST_PATH))).toEqual(HEADING_FIRST_PATH)
    expect(deserializeLayoutNodePath('')).toEqual([])
    expect(deserializeLayoutNodePath('not.a.valid.path')).toBeNull()
  })
})
