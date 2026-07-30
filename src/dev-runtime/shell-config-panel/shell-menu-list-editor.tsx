import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { ShellDndSortableList, ShellDndSortableRow } from './shell-config-panel-dnd'
import { MenuItemFieldsEditor } from './menu-item-fields-editor'

const NEW_ROOT_ITEM_LABEL = 'Nuevo elemento'

function reorder<T>(list: readonly T[], sourceIndex: number, targetIndex: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

// Per-row commit feedback (0122-T5's acceptance criterion: a rejected edit — e.g. a blank
// `label` — must keep the user's own attempted value on screen and show the same `role="alert"`
// banner the canvas properties panel uses, never revert in silence). Tracked per row index
// rather than per individual field (label/icon/mode/...) — coarser than the canvas panel's own
// per-subsection granularity, but the row is the natural unit here: a single `MenuItemConfig`
// object is committed as a whole on every edit, unlike the canvas panel's four independent
// subsections.
type RowItem = MenuItemConfig | MenuItemChildConfig
type PendingRowRejections = Partial<Record<number, { value: RowItem; error: RuntimeConfigError }>>

function usePendingRowRejections() {
  const [pending, setPending] = useState<PendingRowRejections>({})

  function record(index: number, attemptedValue: RowItem, result: CommitCanvasMutationResult) {
    if (result.status === 'rejected') {
      setPending((prev) => ({ ...prev, [index]: { value: attemptedValue, error: result.error } }))
      return
    }
    setPending((prev) => {
      if (!(index in prev)) return prev
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  return { pending, record }
}

interface ShellMenuChildrenListEditorProps {
  parentIndex: number
  items: MenuItemChildConfig[]
  onCommitChildren: (nextChildren: MenuItemChildConfig[]) => CommitCanvasMutationResult
}

/**
 * `children` sublist of a single root `menuItem` (0122-T5). `menuItemChild` never accepts its
 * own `children` (0122-T1) — every row here uses `allowChildren={false}`. The schema requires at
 * least one child (`z.array(menuItemChildSchema).nonempty()`), so "Quitar" is disabled at the
 * last remaining entry rather than letting the array go empty (same `minItems` pattern the
 * generic `ArrayPropertyField` already uses for other schema-enforced minimums).
 */
export function ShellMenuChildrenListEditor({ parentIndex, items, onCommitChildren }: ShellMenuChildrenListEditorProps) {
  const canRemove = items.length > 1
  const dndContextId = `shell-menu-children-${parentIndex}`
  const { pending, record } = usePendingRowRejections()

  function updateChild(index: number, nextChild: MenuItemChildConfig) {
    const next = items.slice()
    next[index] = nextChild
    record(index, nextChild, onCommitChildren(next))
  }

  function removeChild(index: number) {
    if (!canRemove) return
    onCommitChildren(items.filter((_, i) => i !== index))
  }

  function addChild() {
    // Same `refineMenuItemShape` constraint as the root list's `addItem`: a fresh entry needs
    // exactly one of href/action/children to be schema-valid, so it's seeded with an empty href.
    onCommitChildren([...items, { label: NEW_ROOT_ITEM_LABEL, href: '' }])
  }

  return (
    <fieldset className="ml-4 flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">Elementos del desplegable</legend>
      <ShellDndSortableList dndContextId={dndContextId} onReorder={(source, target) => onCommitChildren(reorder(items, source, target))}>
        {items.map((child, index) => {
          const pendingEntry = pending[index]
          const displayedChild = (pendingEntry?.value ?? child) as MenuItemChildConfig

          return (
            <ShellDndSortableRow key={index} index={index} dragHandleLabel={`Reordenar elemento de desplegable ${index + 1}`}>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removeChild(index)}
                  disabled={!canRemove}
                  aria-label={`Quitar elemento de desplegable ${index + 1}`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
              <MenuItemFieldsEditor
                item={displayedChild}
                allowChildren={false}
                onChange={(next) => updateChild(index, next)}
                labelText={`Elemento de desplegable ${index + 1}`}
              />
              {pendingEntry && (
                <CommitRejectionBanner
                  dataTestId={`shell-menu-children-${parentIndex}-${index}-error`}
                  error={pendingEntry.error}
                />
              )}
            </ShellDndSortableRow>
          )
        })}
      </ShellDndSortableList>
      <button
        type="button"
        onClick={addChild}
        aria-label={`Añadir elemento de desplegable para el elemento de menú ${parentIndex + 1}`}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Añadir elemento de desplegable
      </button>
    </fieldset>
  )
}

interface ShellMenuListEditorProps {
  menu: MenuItemConfig[]
  onCommitMenu: (nextMenu: MenuItemConfig[]) => CommitCanvasMutationResult
}

/** Root `shell.header.menu` list editor: reorder by drag, add/remove entries, expand `children`. */
export function ShellMenuListEditor({ menu, onCommitMenu }: ShellMenuListEditorProps) {
  const { pending, record } = usePendingRowRejections()

  function updateItem(index: number, nextItem: MenuItemConfig) {
    const next = menu.slice()
    next[index] = nextItem
    record(index, nextItem, onCommitMenu(next))
  }

  function removeItem(index: number) {
    onCommitMenu(menu.filter((_, i) => i !== index))
  }

  function addItem() {
    onCommitMenu([...menu, { label: NEW_ROOT_ITEM_LABEL, href: '' }])
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">Menú</legend>
      <ShellDndSortableList dndContextId="shell-menu-root" onReorder={(source, target) => onCommitMenu(reorder(menu, source, target))}>
        {menu.map((item, index) => {
          const pendingEntry = pending[index]
          const displayedItem = (pendingEntry?.value ?? item) as MenuItemConfig

          return (
            <ShellDndSortableRow key={index} index={index} dragHandleLabel={`Reordenar elemento de menú ${index + 1}`}>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={`Quitar elemento de menú ${index + 1}`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Quitar
                </button>
              </div>
              <MenuItemFieldsEditor
                item={displayedItem}
                allowChildren
                onChange={(next) => updateItem(index, next as MenuItemConfig)}
                labelText={`Elemento de menú ${index + 1}`}
              />
              {pendingEntry && <CommitRejectionBanner dataTestId={`shell-menu-root-${index}-error`} error={pendingEntry.error} />}
              {displayedItem.children !== undefined && (
                <ShellMenuChildrenListEditor
                  parentIndex={index}
                  items={displayedItem.children}
                  onCommitChildren={(nextChildren) => onCommitMenu(reorderChildrenIntoMenu(menu, index, nextChildren))}
                />
              )}
            </ShellDndSortableRow>
          )
        })}
      </ShellDndSortableList>
      <button
        type="button"
        onClick={addItem}
        aria-label="Añadir elemento de menú"
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Añadir elemento de menú
      </button>
    </fieldset>
  )
}

// `children` lives nested inside its parent root item, so committing a change made within the
// children sublist still goes through the same root `onCommitMenu` — there is no separate
// storage location for `children` to commit against.
function reorderChildrenIntoMenu(menu: MenuItemConfig[], parentIndex: number, nextChildren: MenuItemChildConfig[]): MenuItemConfig[] {
  const next = menu.slice()
  next[parentIndex] = { ...next[parentIndex], children: nextChildren }
  return next
}
