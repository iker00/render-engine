import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'

/**
 * The single reordering interaction the Shell config panel supports (0122-T5, spec restriction):
 * reorder a flat list of entries within its own level — the root `menu` array, or a single
 * parent's `children` array. There is no `@dnd-kit/sortable` in this project (only
 * `@dnd-kit/core` is installed, and the task forbids adding a new dependency), so this builds
 * the same "sortable list" pattern directly on `@dnd-kit/core`'s own primitives
 * (`useDraggable`/`useDroppable`), the same way `layout-canvas-dnd-context.tsx` already does for
 * the canvas — just scoped to a single flat array instead of a whole node tree.
 *
 * Each list gets its OWN `DndContext` instance (one per level: one for the root `menu`, one per
 * open `children` sublist) instead of a single shared context for the whole form. This is what
 * makes "no DnD between root and children" a structural guarantee rather than a rule to
 * remember: a drag started inside one `DndContext` can only ever end over a droppable zone
 * registered in that same context, so a cross-level move is never observable as a drop at all.
 */
export interface ShellDndSortableListProps {
  /** Passed through to `DndContext`'s own `id` prop — also doubles as this list's test id. */
  dndContextId: string
  onReorder: (sourceIndex: number, targetIndex: number) => void
  children: ReactNode
}

export function ShellDndSortableList({ dndContextId, onReorder, children }: ShellDndSortableListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(event: DragEndEvent) {
    if (event.over === null) return

    const sourceIndex = Number(event.active.id)
    const targetIndex = Number(event.over.id)
    if (Number.isNaN(sourceIndex) || Number.isNaN(targetIndex) || sourceIndex === targetIndex) return

    onReorder(sourceIndex, targetIndex)
  }

  return (
    <DndContext id={dndContextId} sensors={sensors} onDragEnd={handleDragEnd}>
      <div data-testid={`shell-dnd-list-${dndContextId}`} className="flex flex-col gap-2">
        {children}
      </div>
    </DndContext>
  )
}

interface ShellDndSortableRowProps {
  /** Position of this row within its own list — the only identity a plain-JSON entry has. */
  index: number
  /** Accessible name for this row's drag handle button, e.g. "Reordenar elemento de menú 1". */
  dragHandleLabel: string
  children: ReactNode
}

/**
 * A single reorderable row: draggable (via its own handle button) and droppable (the whole row)
 * on the same id (its current index). `useDraggable`'s `setActivatorNodeRef`/`attributes`/
 * `listeners` are applied directly on the handle button rendered right here, in the same
 * component that calls the hook — mirroring the pattern `layout-node-renderer.tsx` already uses
 * for the canvas's own draggable nodes, rather than threading the raw hook result through a
 * render-prop/child component boundary.
 */
export function ShellDndSortableRow({ index, dragHandleLabel, children }: ShellDndSortableRowProps) {
  const id = String(index)
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id })

  function setRefs(element: HTMLElement | null) {
    setDropRef(element)
    setDragRef(element)
  }

  return (
    <div
      ref={setRefs}
      data-testid={`shell-dnd-row-${id}`}
      className={`flex flex-col gap-2 rounded border border-gray-200 p-2 ${isOver ? 'outline outline-2 -outline-offset-2 outline-emerald-500' : ''}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={dragHandleLabel}
        className="w-fit cursor-grab rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
      >
        ⠿
      </button>
      {children}
    </div>
  )
}
