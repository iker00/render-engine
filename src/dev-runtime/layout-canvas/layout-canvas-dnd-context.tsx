import type { ReactNode } from 'react'
import { useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import type { LayoutNode, LayoutNodeType } from '../../config/runtime-config'
import { deserializeLayoutNodePath, parseDropZoneId, type LayoutNodePath } from '../../runtime/layout-node-path'
import { isValidDropTarget } from './layout-drop-validity'
import { parsePaletteDragId } from './layout-canvas-node-palette'

/**
 * Raw, unvalidated drop intent (Decisión 7 / T12 de design.md): where a drag was released,
 * decoded from the `@dnd-kit/core` drag ids, and either the existing node being moved
 * (`draggedPath`, T12/T14) or the palette entry being inserted (`draggedNodeType`, T15) — never
 * both: `draggedPath` is `null` exactly when the drag originated in the palette, mirroring
 * `isValidDropTarget`'s own `draggedPath`/`options.draggedNodeType` contract (T13). Deciding
 * whether this is a legal move/insert is out of scope here — that is T13 (validity) and
 * T14/T15 (commit).
 */
export interface LayoutCanvasDropAttempt {
  draggedPath: LayoutNodePath | null
  draggedNodeType?: LayoutNodeType
  targetParentPath: LayoutNodePath
  targetIndex: number
  targetTabItemIndex?: number
}

interface DragEndLikeEvent {
  active: { id: string | number }
  over: { id: string | number } | null
}

function parseDropAttempt(event: DragEndLikeEvent): LayoutCanvasDropAttempt | null {
  if (event.over === null) return null

  const zone = parseDropZoneId(String(event.over.id))
  if (zone === null) return null

  const activeId = String(event.active.id)
  const paletteNodeType = parsePaletteDragId(activeId)

  if (paletteNodeType !== null) {
    return {
      draggedPath: null,
      draggedNodeType: paletteNodeType,
      targetParentPath: zone.parentPath,
      targetIndex: zone.index,
      targetTabItemIndex: zone.tabItemIndex,
    }
  }

  const draggedPath = deserializeLayoutNodePath(activeId)
  if (draggedPath === null) return null

  return {
    draggedPath,
    targetParentPath: zone.parentPath,
    targetIndex: zone.index,
    targetTabItemIndex: zone.tabItemIndex,
  }
}

// Stable default so callers that don't need the T13 validity indicator (a read-only canvas,
// existing dnd-wiring tests that mock DndContext and never invoke onDragOver) don't have to
// pass one — see react-best-practices.md 4.5 for why this must be a module constant.
const EMPTY_PAGE_LAYOUT: readonly LayoutNode[] = []

// T13: Tailwind outline classes for the drop-target validity indicator, mirroring the
// selection/hover outline convention already used by `layout-node-renderer.tsx` /
// `layout-renderer.tsx` (`outline outline-{1,2} -outline-offset-{1,2} outline-<color>`).
const VALID_DROP_TARGET_CLASSES = ['outline', 'outline-2', '-outline-offset-2', 'outline-emerald-500']
const INVALID_DROP_TARGET_CLASSES = ['outline', 'outline-2', '-outline-offset-2', 'outline-red-500']

interface LayoutCanvasDndContextProps {
  children: ReactNode
  /**
   * Current page layout (T13): needed to resolve drop validity for the live visual indicator.
   * Defaults to an empty tree for callers that don't need it.
   */
  pageLayout?: readonly LayoutNode[]
  /** Invoked with the raw drop intent on a successful drag release over a known zone. */
  onDropAttempt: (attempt: LayoutCanvasDropAttempt) => void
  /** Optional: live feedback while dragging (e.g. highlighting a candidate target in T14+). */
  onDragOverAttempt?: (attempt: LayoutCanvasDropAttempt | null) => void
}

/**
 * Wraps the canvas render tree in a `@dnd-kit/core` `DndContext` (Decisión 7 de design.md).
 * The individual nodes/zones become draggable/droppable inside the shared
 * `layout-node-renderer.tsx` / `layout-renderer.tsx` wrapper (active only when
 * `LayoutEditModeContext` is present, same gating as the rest of the T2 wrapper) — this
 * component only owns the sensors, the collision strategy, and translating
 * `active.id`/`over.id` back into a structured drop attempt.
 */
export function LayoutCanvasDndContext({
  children,
  pageLayout = EMPTY_PAGE_LAYOUT,
  onDropAttempt,
  onDragOverAttempt,
}: LayoutCanvasDndContextProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A small activation distance keeps a plain click (select a node) from being
      // misread as the start of a drag.
      activationConstraint: { distance: 4 },
    }),
  )

  // T13: the DOM node currently carrying a validity indicator class, so it can be cleared
  // before marking a new one (or on drag end/cancel) instead of accumulating classes across
  // zones. This is deliberately imperative DOM access, not React state: the droppable zones
  // themselves are rendered deep inside `children`, by `layout-renderer.tsx` in `src/runtime/`
  // — a layer this dev-only context cannot reach through props or context, since `src/runtime/`
  // must never import from `src/dev-runtime/` (see architecture.md). `data-drop-zone` is the
  // same attribute `LayoutCanvasDropZoneGap` already exposes on every gap zone for this exact
  // purpose; the empty-container placeholder does not carry it yet (documented limitation).
  const markedZoneRef = useRef<{ element: Element; classes: string[] } | null>(null)

  const clearDropTargetIndicator = () => {
    const marked = markedZoneRef.current
    if (marked === null) return
    marked.element.classList.remove(...marked.classes)
    markedZoneRef.current = null
  }

  const markDropTargetIndicator = (zoneId: string, valid: boolean) => {
    clearDropTargetIndicator()
    if (typeof document === 'undefined') return
    // `zoneId` is always an algorithmically-generated `serializeDropZoneId` value (digits,
    // colons, dots, "tabItem"), never user input, so no attribute-value escaping is needed.
    const element = document.querySelector(`[data-drop-zone="${zoneId}"]`)
    if (element === null) return
    const classes = valid ? VALID_DROP_TARGET_CLASSES : INVALID_DROP_TARGET_CLASSES
    element.classList.add(...classes)
    markedZoneRef.current = { element, classes }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const attempt = parseDropAttempt(event)
    onDragOverAttempt?.(attempt)

    if (attempt === null || event.over === null) {
      clearDropTargetIndicator()
      return
    }

    const valid = isValidDropTarget(pageLayout, attempt.draggedPath, attempt.targetParentPath, attempt.targetIndex, {
      targetTabItemIndex: attempt.targetTabItemIndex,
      draggedNodeType: attempt.draggedNodeType,
    })
    markDropTargetIndicator(String(event.over.id), valid)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    clearDropTargetIndicator()
    const attempt = parseDropAttempt(event)
    if (attempt !== null) {
      onDropAttempt(attempt)
    }
  }

  const handleDragCancel = () => {
    clearDropTargetIndicator()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
    </DndContext>
  )
}
