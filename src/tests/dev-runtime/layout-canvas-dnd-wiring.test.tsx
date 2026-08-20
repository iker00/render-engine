import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from '../../config/runtime-config'
import { LayoutCanvasDndContext, type LayoutCanvasDropAttempt } from '../../dev-runtime/layout-canvas/layout-canvas-dnd-context'
import { LayoutEditModeProvider } from '../../runtime/layout-edit-mode-context'
import { LayoutRenderer } from '../../runtime/layout-renderer'
import {
  deserializeLayoutNodePath,
  parseDropZoneId,
  serializeDropZoneId,
  serializeLayoutNodePath,
  type LayoutCanvasDropZone,
  type LayoutNodePath,
} from '../../runtime/layout-node-path'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { serializePaletteDragId } from '../../dev-runtime/layout-canvas/layout-canvas-palette-drag-id'

// Light mock of @dnd-kit/core (see subagent-prompt.md / T12 tests contract): real pointer
// simulation against PointerSensor is impractical in jsdom (no real layout, no real
// PointerEvent-driven activation). DndContext is replaced with a pass-through that captures
// the onDragEnd handler LayoutCanvasDndContext registers, so tests can invoke it directly
// with synthetic {active, over} pairs. useDraggable/useDroppable keep their real
// implementation (recorded via a spy) so the hooks still behave like the real library and
// exercise the actual id-construction path in layout-node-renderer.tsx / layout-renderer.tsx.
const draggableCalls: string[] = []
// Records the `disabled` argument alongside the id (T4): the existing `draggableCalls` array
// above only ever tracked ids for "was this node registered as draggable at all" assertions,
// but T4 needs to inspect the `disabled` value itself for a table cell vs. a cell-container's
// child, so a second array parallels it without disturbing any pre-existing assertion.
const draggableArgs: Array<{ id: string; disabled: boolean | undefined }> = []
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
    useDraggable: (args: { id: string | number; disabled?: boolean }) => {
      draggableCalls.push(String(args.id))
      draggableArgs.push({ id: String(args.id), disabled: args.disabled })
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
          // T4 fixture: a manual-mode table with one row of two cells — a plain-text
          // primitive cell (Text mode: no wrapper of any kind, see table-layout-node.tsx) and
          // a `container` node cell with one nested child, to distinguish "the cell itself"
          // (never a drag source, T4) from "a child of a cell-container" (still draggable).
          {
            type: 'table',
            props: {
              headers: ['A', 'B'],
              rows: [
                [
                  'Plain text cell',
                  {
                    type: 'container',
                    props: {},
                    children: [{ type: 'heading', props: { text: 'Nested', level: 2 } }],
                  },
                ],
              ],
            },
          },
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
const TABLE_PATH: LayoutNodePath = [{ field: 'children', index: 2 }]
const TABLE_CELL_CONTAINER_PATH: LayoutNodePath = [...TABLE_PATH, { field: 'row', rowIndex: 0, index: 1 }]
const TABLE_CELL_CONTAINER_CHILD_PATH: LayoutNodePath = [...TABLE_CELL_CONTAINER_PATH, { field: 'children', index: 0 }]

const BETWEEN_SIBLINGS_ZONE_ID = serializeDropZoneId({ parentPath: CONTAINER_A_PATH, index: 1 })
const EMPTY_PLACEHOLDER_ZONE_ID = serializeDropZoneId({ parentPath: CONTAINER_B_EMPTY_PATH, index: 0 })

// LayoutCanvas (0102) was retired in 0103/T10 in favor of DevEditorLayer wrapping the real
// `<RuntimePage />` in place. This harness composes the exact same underlying, still-live
// pieces LayoutCanvas used to wire together for its canvas pane — LayoutCanvasDndContext,
// LayoutEditModeProvider (active: true), RuntimeStateProvider, LayoutRenderer — without the
// retired component itself, so the draggable/droppable registration and onDragEnd wiring this
// file verifies keeps exercising the real, unmocked id-construction path.
function renderCanvas(onDropAttempt: (attempt: LayoutCanvasDropAttempt) => void) {
  const config = buildConfig()
  const pageLayout = config.pages[0].layout

  return render(
    <LayoutCanvasDndContext pageLayout={pageLayout} onDropAttempt={onDropAttempt}>
      <LayoutEditModeProvider
        value={{ active: true, selectedPath: null, hoveredPath: null, onSelectNode: () => {}, onHoverNode: () => {} }}
      >
        <RuntimeStateProvider config={config}>
          <LayoutRenderer nodes={pageLayout} />
        </RuntimeStateProvider>
      </LayoutEditModeProvider>
    </LayoutCanvasDndContext>,
  )
}

beforeEach(() => {
  draggableCalls.length = 0
  draggableArgs.length = 0
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

describe('table cell exclusion from drag source (T4)', () => {
  it('disables useDraggable for a table cell node, whose path ends in a `row` step', () => {
    renderCanvas(() => {})

    const call = draggableArgs.find((entry) => entry.id === serializeLayoutNodePath(TABLE_CELL_CONTAINER_PATH))
    expect(call).toBeDefined()
    expect(call!.disabled).toBe(true)
  })

  it('keeps a child of a cell-container draggable normally — its path continues past `row` with a `children` step', () => {
    renderCanvas(() => {})

    const call = draggableArgs.find((entry) => entry.id === serializeLayoutNodePath(TABLE_CELL_CONTAINER_CHILD_PATH))
    expect(call).toBeDefined()
    expect(call!.disabled).toBe(false)
  })

  it('registers no droppable zone for any cell position of a table row, unlike a container with the same child count', () => {
    renderCanvas(() => {})

    // Control: container A has 2 children, so it gets 3 gap zones (indices 0, 1, 2) keyed by
    // its own path — the same shape a table row's 2 cells would need if cell reordering were
    // ever a supported gesture.
    expect(droppableCalls).toContain(serializeDropZoneId({ parentPath: CONTAINER_A_PATH, index: 0 }))
    expect(droppableCalls).toContain(serializeDropZoneId({ parentPath: CONTAINER_A_PATH, index: 1 }))
    expect(droppableCalls).toContain(serializeDropZoneId({ parentPath: CONTAINER_A_PATH, index: 2 }))

    // `table` is absent from `nodeTypeAcceptsChildren` (layout-placement-rules.ts), so
    // LayoutRenderer never runs its drop-zone-gap logic for the table's own path — no zone
    // exists at any index for either the primitive text cell (index 0) or the node cell
    // (index 1) position.
    expect(droppableCalls).not.toContain(serializeDropZoneId({ parentPath: TABLE_PATH, index: 0 }))
    expect(droppableCalls).not.toContain(serializeDropZoneId({ parentPath: TABLE_PATH, index: 1 }))
    expect(droppableCalls).not.toContain(serializeDropZoneId({ parentPath: TABLE_PATH, index: 2 }))
  })

  it('a palette-origin drag over a table cell position produces no drop attempt — no data-drop-zone ever exists there', () => {
    const onDropAttempt = vi.fn()
    renderCanvas(onDropAttempt)

    // Since no droppable was ever registered for a cell position (previous test), @dnd-kit's
    // own collision detection can never resolve `over` to one when a palette drag is released
    // there — it reports `over: null`, exactly like a drag cancelled outside any droppable.
    // parseDropAttempt (layout-canvas-dnd-context.tsx) short-circuits on `over === null`
    // before it would even need to distinguish a palette-origin id from a node path, so the
    // callback is never invoked and the config stays untouched.
    capturedOnDragEnd!({
      active: { id: serializePaletteDragId('heading') },
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
