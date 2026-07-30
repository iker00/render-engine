import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { ShellDndSortableList, ShellDndSortableRow } from './shell-config-panel-dnd'
import { SidebarItemFieldsEditor } from './sidebar-item-fields-editor'
import { NEW_ROOT_ITEM_LABEL } from './sidebar-item-mode'

function reorder<T>(list: readonly T[], sourceIndex: number, targetIndex: number): T[] {
  const next = list.slice()
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

// Same per-row commit feedback contract as `ShellMenuListEditor`/`ShellMenuChildrenListEditor`
// (0122-T5): a rejected edit keeps the attempted value on screen and shows a `role="alert"`
// banner instead of reverting in silence. Kept as its own small local copy rather than importing
// the header's version — that hook isn't exported, and the header module is out of this task's
// scope to touch.
type PendingRowRejections = Partial<Record<number, { value: SidebarItemConfig; error: RuntimeConfigError }>>

function usePendingRowRejections() {
  const [pending, setPending] = useState<PendingRowRejections>({})

  function record(index: number, attemptedValue: SidebarItemConfig, result: CommitCanvasMutationResult) {
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

// `path` doubles as this level's identity for both the DnD context id (`shell-sidebar-${path}`)
// and the human-readable row numbering shown in field labels/buttons. The root level's path is
// the literal `"root"`; a nested level (the `children` of the item at `index` within a level
// whose own path is `parentPath`) is `${parentPath}.${index}` — e.g. `"root.0"` for the first
// root item's children, `"root.0.2"` for the third child's own children, and so on with no depth
// limit. `computeLevelLabelPrefix` turns that into a 1-based dot-notation breadcrumb ("1", "1.3",
// ...) purely for display; it never affects the config shape itself.
function computeLevelLabelPrefix(path: string): string {
  if (path === 'root') return ''
  return path
    .replace(/^root\./, '')
    .split('.')
    .map((segment) => String(Number(segment) + 1))
    .join('.')
}

export interface SidebarItemListEditorProps {
  items: SidebarItemConfig[]
  /** This level's identity — `"root"` for the top-level list, `${parentPath}.${index}` for any nested `children` list. */
  path: string
  onCommitItems: (nextItems: SidebarItemConfig[]) => CommitCanvasMutationResult
}

/**
 * Genuinely recursive editor for one level of `sidebarItem`s (0123-T8): add/edit/remove/reorder
 * at this level, and — whenever a row's own mode is "Con hijos" (`children !== undefined`) —
 * render another `SidebarItemListEditor` for that row's `children`, always shown inline (no
 * "expand to edit" toggle, same convention the header uses for its own `children` sublist).
 * Unlike the header's `menu`/`children` pair (two fixed, non-recursive components), this single
 * component renders itself at every depth: there is no separate depth limit for `sidebarItem`
 * (0123-T1).
 */
export function SidebarItemListEditor({ items, path, onCommitItems }: SidebarItemListEditorProps) {
  const { pending, record } = usePendingRowRejections()
  const dndContextId = `shell-sidebar-${path}`
  const levelPrefix = computeLevelLabelPrefix(path)
  const isRoot = path === 'root'
  // The schema only requires a non-empty `children` array when `children` is present at all
  // (`z.array(sidebarItemSchema).nonempty()`, 0123-T1) — the root `items` array has no such
  // minimum. So "Quitar" is disabled at the last remaining row of a nested level, same pattern
  // `ShellMenuChildrenListEditor` already uses for `menuItemChild`, but never at the root.
  const canRemove = isRoot || items.length > 1

  function updateItem(index: number, nextItem: SidebarItemConfig) {
    const next = items.slice()
    next[index] = nextItem
    record(index, nextItem, onCommitItems(next))
  }

  function removeItem(index: number) {
    if (!canRemove) return
    onCommitItems(items.filter((_, i) => i !== index))
  }

  function addItem() {
    // A fresh row must itself satisfy `refineSidebarItemShape` (exactly one of href/action/
    // children) — seeded with an empty href, same convention as the header's own `addItem`.
    onCommitItems([...items, { label: NEW_ROOT_ITEM_LABEL, href: '' }])
  }

  function commitChildrenOfItem(index: number, nextChildren: SidebarItemConfig[]): CommitCanvasMutationResult {
    const next = items.slice()
    next[index] = { ...next[index], children: nextChildren }
    return onCommitItems(next)
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">
        {isRoot ? 'Elementos del sidebar' : `Hijos del elemento de sidebar ${levelPrefix}`}
      </legend>
      <ShellDndSortableList dndContextId={dndContextId} onReorder={(source, target) => onCommitItems(reorder(items, source, target))}>
        {items.map((item, index) => {
          const pendingEntry = pending[index]
          const displayedItem = pendingEntry?.value ?? item
          const rowNumber = levelPrefix ? `${levelPrefix}.${index + 1}` : `${index + 1}`
          const labelText = `Elemento de sidebar ${rowNumber}`
          const lowercaseRowLabel = `elemento de sidebar ${rowNumber}`

          return (
            <ShellDndSortableRow key={index} index={index} dragHandleLabel={`Reordenar ${lowercaseRowLabel}`}>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={!canRemove}
                  aria-label={`Quitar ${lowercaseRowLabel}`}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
              <SidebarItemFieldsEditor item={displayedItem} onChange={(next) => updateItem(index, next)} labelText={labelText} />
              {pendingEntry && (
                <CommitRejectionBanner dataTestId={`shell-sidebar-${path}-${index}-error`} error={pendingEntry.error} />
              )}
              {displayedItem.children !== undefined && (
                <SidebarItemListEditor
                  items={displayedItem.children}
                  path={`${path}.${index}`}
                  onCommitItems={(nextChildren) => commitChildrenOfItem(index, nextChildren)}
                />
              )}
            </ShellDndSortableRow>
          )
        })}
      </ShellDndSortableList>
      <button
        type="button"
        onClick={addItem}
        aria-label={isRoot ? 'Añadir elemento de sidebar' : `Añadir elemento de sidebar en ${levelPrefix}`}
        className="self-start rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        {isRoot ? 'Añadir elemento de sidebar' : `Añadir elemento en ${levelPrefix}`}
      </button>
    </fieldset>
  )
}
