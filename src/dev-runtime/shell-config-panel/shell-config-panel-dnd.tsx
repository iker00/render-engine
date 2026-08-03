import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import type { ShellTreeDestination } from './shell-tree-mutations'

/**
 * Extended DnD module for the Shell config panel (Decisión 1 y 2 de design.md, feature 0125).
 * Replaces the previous "one `DndContext` per level" pattern (`ShellDndSortableList`/
 * `ShellDndSortableRow`, one per flat list) with a single `DndContext` shared by the **whole
 * tree** (all of `shell.header.menu` with its `children`; all of `shell.sidebar.items` with its
 * full recursion). Header and sidebar keep separate `DndContext`s from each other (two distinct
 * data trees) — that separation, not a validation rule, is what makes a cross-tree drag
 * structurally impossible: there is no `over.id` to resolve against the other tree at all.
 *
 * Two droppable zone categories live inside the same context (Decisión 2):
 * - `gap:{parentPath}:{index}` — reorder/move: a thin `<div>` in the normal document flow,
 *   mirroring `LayoutCanvasDropZoneGap` in `src/runtime/layout-renderer.tsx` (no measurement, no
 *   overlay). Dropping here inserts the dragged item at that ordinal position of that sibling
 *   list.
 * - `nest:{path}` — nest as a child: the whole row body of an item, mirroring what
 *   `ShellDndSortableRow`'s row used to mean before `gap` zones took over reordering.
 *
 * There is no `@dnd-kit/sortable` in this project (only `@dnd-kit/core`, and the task forbids
 * adding a new dependency), so this builds directly on `@dnd-kit/core`'s own primitives
 * (`useDraggable`/`useDroppable`), the same way `layout-canvas-dnd-context.tsx` already does for
 * the canvas.
 */

/**
 * Parses a droppable zone id produced by `ShellTreeGapZone`/`ShellTreeDraggableRow` back into a
 * structured `ShellTreeDestination` (the type `moveShellSubtree`/`isValidShellTreeDestination`
 * from `shell-tree-mutations.ts` already consume). Returns `null` for any id that doesn't match
 * either shape, including a non-integer or negative `gap` index.
 */
export function parseShellTreeDropZoneId(id: string): ShellTreeDestination | null {
  const parts = id.split(':')

  if (parts[0] === 'gap' && parts.length === 3) {
    const [, parentPath, indexText] = parts
    if (!/^\d+$/.test(indexText)) return null
    return { type: 'gap', parentPath, index: Number(indexText) }
  }

  if (parts[0] === 'nest' && parts.length === 2) {
    const [, path] = parts
    return { type: 'nest', path }
  }

  return null
}

// Same Tailwind outline convention T13 already established in `layout-canvas-dnd-context.tsx`
// for the canvas's own drop-target validity indicator; declared locally (not imported from
// `layout-canvas/`) since that module doesn't export these as a reusable constant.
const VALID_DROP_TARGET_CLASSES = ['outline', 'outline-2', '-outline-offset-2', 'outline-emerald-500']
const INVALID_DROP_TARGET_CLASSES = ['outline', 'outline-2', '-outline-offset-2', 'outline-red-500']

export interface ShellTreeDndContextProps {
  /** Passed through to `DndContext`'s own `id` prop; distinguishes header from sidebar in tests
   * the same way `dndContextId`s like `'shell-menu-root'` do today. */
  treeId: string
  onMoveAttempt: (sourcePath: string, destination: ShellTreeDestination) => void
  isValidDestination: (sourcePath: string, destination: ShellTreeDestination) => boolean
  children: ReactNode
}

/**
 * Wraps a whole Shell tree (header menu or sidebar items) in a single `@dnd-kit/core`
 * `DndContext` (Decisión 1). Owns sensors, drag-id parsing and the imperative
 * `[data-drop-zone]` validity indicator — the same mechanism `LayoutCanvasDndContext` uses,
 * reused here rather than reimplemented in parallel.
 *
 * `collisionDetection={closestCenter}` (post-implementation fix): a `gap` zone is a thin 4px
 * strip sitting right next to a `nest` zone that covers an entire row's body, so the default
 * `rectIntersection` algorithm — which only resolves a drop when the dragged item's rect
 * literally overlaps the target's rect — almost always resolves to `nest` even when the user is
 * clearly aiming for the boundary between two rows, making plain reordering feel broken.
 * `closestCenter` instead picks whichever droppable's center is nearest the dragged item's
 * center, which correctly favors a `gap` zone when hovering near a row boundary and a `nest`
 * zone when hovering over a row's body — the same collision strategy `LayoutCanvasDndContext`
 * already uses for the canvas's own gap-vs-container drop zones.
 */
export function ShellTreeDndContext({ treeId, onMoveAttempt, isValidDestination, children }: ShellTreeDndContextProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // The DOM node currently carrying a validity indicator class, so it can be cleared before
  // marking a new one (or on drag end/cancel) instead of accumulating classes across zones —
  // same imperative-DOM pattern as `LayoutCanvasDndContext.markedZoneRef`.
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
    // `zoneId` is always an algorithmically-generated id (digits, colons, dots), never user
    // input, so no attribute-value escaping is needed.
    const element = document.querySelector(`[data-drop-zone="${zoneId}"]`)
    if (element === null) return
    const classes = valid ? VALID_DROP_TARGET_CLASSES : INVALID_DROP_TARGET_CLASSES
    element.classList.add(...classes)
    markedZoneRef.current = { element, classes }
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over === null) {
      clearDropTargetIndicator()
      return
    }

    const destination = parseShellTreeDropZoneId(String(event.over.id))
    if (destination === null) {
      clearDropTargetIndicator()
      return
    }

    const sourcePath = String(event.active.id)
    markDropTargetIndicator(String(event.over.id), isValidDestination(sourcePath, destination))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    clearDropTargetIndicator()
    if (event.over === null) return

    const destination = parseShellTreeDropZoneId(String(event.over.id))
    if (destination === null) return

    const sourcePath = String(event.active.id)
    if (!isValidDestination(sourcePath, destination)) return

    onMoveAttempt(sourcePath, destination)
  }

  const handleDragCancel = () => {
    clearDropTargetIndicator()
  }

  return (
    <DndContext
      id={treeId}
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

interface ShellTreeGapZoneProps {
  parentPath: string
  index: number
}

/**
 * A `gap` droppable zone (Decisión 2): mirrors `LayoutCanvasDropZoneGap` — a minimal, unstyled
 * `<div>` participating in the normal `flex flex-col` flow, so no measurement or overlay is
 * needed to place it.
 */
export function ShellTreeGapZone({ parentPath, index }: ShellTreeGapZoneProps) {
  const id = `gap:${parentPath}:${index}`
  const { setNodeRef } = useDroppable({ id })

  return <div ref={setNodeRef} data-drop-zone={id} aria-hidden="true" className="h-1 min-w-1" />
}

interface ShellTreeDraggableRowProps {
  /** This item's own positional path — its identity as both the draggable source id and, via
   * `nest:${path}`, the target id of its own `nest` zone. */
  path: string
  dragHandleLabel: string
  /** Rendered directly beside the drag handle, in the same row (e.g. the disclosure button that
   * shows this item's name — kept next to the handle rather than the row body below, so the
   * name a user drags by is the same name they click to expand/collapse). Omit for a row with no
   * such header (e.g. the plain rows this module's own tests render). */
  headerContent?: ReactNode
  children: ReactNode
}

/**
 * A single tree row: draggable (via its own handle button, activated the same way
 * `ShellDndSortableRow` used to) and, on its whole body, droppable as a `nest` zone (Decisión 2)
 * — dropping here nests the dragged item as this row's child rather than reordering it.
 * `useDraggable`'s `setActivatorNodeRef`/`attributes`/`listeners` are applied directly on the
 * handle button rendered right here, mirroring the pattern `layout-node-renderer.tsx` uses for
 * the canvas's own draggable nodes.
 *
 * Also carries `data-drop-zone={dropId}` (0125-T5) so `ShellTreeDndContext.handleDragOver`'s own
 * `markDropTargetIndicator` — until now only ever finding a `gap` zone's element — can locate and
 * color-code this row's own `nest` zone too, the same generic mechanism the module's own doc
 * comment already describes for "any `[data-drop-zone]`" element. `isOver`'s own unconditional
 * emerald outline (below) is unaware of validity and can transiently coexist with the marker's
 * red one while the pointer sits over an invalid nest target; this is an accepted, narrow visual
 * overlap (not a data-correctness concern — an invalid drop is still rejected on end) rather than
 * a redesign of either mechanism.
 *
 * No permanent border/box around the row (post-implementation simplification): a bordered
 * rectangle per row, multiplied by a bordered rectangle per nesting level (see
 * `ShellMenuChildrenListEditor`/`SidebarItemListEditor` below), made a deep tree read as boxes
 * nested inside boxes with no legible sense of depth. Depth is now conveyed by indentation and a
 * vertical guide line on the children container instead, so the row itself only gets a subtle
 * `hover:bg-gray-50` for interactive affordance; the `isOver` outline remains the only
 * emphasis-worthy state.
 */
export function ShellTreeDraggableRow({ path, dragHandleLabel, headerContent, children }: ShellTreeDraggableRowProps) {
  const dropId = `nest:${path}`
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId })
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id: path })

  function setRefs(element: HTMLElement | null) {
    setDropRef(element)
    setDragRef(element)
  }

  return (
    <div
      ref={setRefs}
      data-testid={`shell-tree-row-${path}`}
      data-drop-zone={dropId}
      className={`flex flex-col gap-2 rounded p-2 hover:bg-gray-50 ${isOver ? 'outline outline-2 -outline-offset-2 outline-emerald-500' : ''}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={dragHandleLabel}
          className="w-fit shrink-0 cursor-grab rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          ⠿
        </button>
        {headerContent}
      </div>
      {children}
    </div>
  )
}
