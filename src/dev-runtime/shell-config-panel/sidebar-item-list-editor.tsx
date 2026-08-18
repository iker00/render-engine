import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { SidebarItemConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { ShellTreeDndContext, ShellTreeDraggableRow, ShellTreeGapZone } from './shell-config-panel-dnd'
import type { useShellCollapseState } from './shell-collapse-state'
import type { ShellTreeDestination } from './shell-tree-mutations'
import { SidebarItemFieldsEditor } from './sidebar-item-fields-editor'
import { NEW_ROOT_ITEM_LABEL } from './sidebar-item-mode'

/**
 * Shared collapse controls handed down from `ShellConfigPanel`'s single `useShellCollapseState()`
 * instance for the whole `shell.sidebar.items` tree (0125-T2/T6). `SidebarItemListEditor` forwards
 * it to itself unchanged on every recursive call — one hook instance covers every depth.
 */
type ShellCollapseControls = ReturnType<typeof useShellCollapseState>

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

// This level's identity (`path`) doubles as this level's list `data-testid` suffix
// (`shell-sidebar-${path}`) and the base for every row's own path. The root level's `path` is `''`
// (0125-T6 — previously the literal `'root'`); a nested level (the `children` of the row at
// `index` within a level whose own path is `path`) is identified by that row's own path, computed
// by `childPath` below. There is no depth limit (0123-T1), unlike the header's `menuItem`/
// `menuItemChild` pair.
function childPath(path: string, index: number): string {
  return path === '' ? String(index) : `${path}.${index}`
}

// `computeLevelLabelPrefix` turns a level's `path` into a 1-based dot-notation breadcrumb ("",
// "1", "1.3", ...) purely for display; it never affects the config shape itself.
function computeLevelLabelPrefix(path: string): string {
  if (path === '') return ''
  return path
    .split('.')
    .map((segment) => String(Number(segment) + 1))
    .join('.')
}

interface RowDisclosureButtonProps {
  path: string
  collapsed: boolean
  label: string
  icon: string | undefined
  labelText: string
  onToggle: () => void
}

// Same combined disclosure button as `ShellMenuListEditor`'s local `RowDisclosureButton` (0125,
// post-implementation simplification): not imported from there since it isn't exported and the
// header module is out of this task's scope. A single button shows this row's name and toggles
// it — no separate icon-only button, no separate read-only summary box below. Rendered as this
// row's `headerContent`, right beside the drag handle in `ShellTreeDraggableRow`.
function RowDisclosureButton({ path, collapsed, label, icon, labelText, onToggle }: RowDisclosureButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? 'Expandir' : 'Colapsar'} ${labelText}`}
      data-testid={`sidebar-item-collapse-toggle-${path}`}
      className="flex min-w-0 items-center gap-2 truncate rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
    >
      {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  )
}

export interface SidebarItemListEditorProps {
  items: SidebarItemConfig[]
  /** This level's identity — `''` for the top-level list, a row's own path for any nested `children` list. */
  path: string
  onCommitItems: (nextItems: SidebarItemConfig[]) => CommitCanvasMutationResult
  collapse: ShellCollapseControls
  /** Tree-wide move handler from `ShellConfigPanel.handleMoveSidebarItem` — forwarded unchanged on every recursive call. */
  onMoveItem: (sourcePath: string, destination: ShellTreeDestination) => void
  /** Tree-wide destination validity from `ShellConfigPanel.isValidSidebarDestination` — forwarded unchanged on every recursive call. */
  isValidDestination: (sourcePath: string, destination: ShellTreeDestination) => boolean
}

/**
 * Genuinely recursive editor for one level of `sidebarItem`s (0123-T8): add/edit/remove/reorder
 * at this level, collapse/expand each row's own field editor independently (0125-T6) and —
 * whenever a row's own mode is "Con hijos" (`children !== undefined`) — render another
 * `SidebarItemListEditor` for that row's `children`, always shown inline (no "expand to edit"
 * toggle, same convention the header uses for its own `children` sublist). Unlike the header's
 * `menu`/`children` pair (two fixed, non-recursive components), this single component renders
 * itself at every depth: there is no separate depth limit for `sidebarItem` (0123-T1), so neither
 * the collapse control nor the branch indicator are restricted to the root level the way the
 * header's are.
 *
 * Drag/drop (0125-T7): mirrors `ShellMenuListEditor`'s own 0125-T5 tree-wide redesign — a single
 * `ShellTreeDndContext` (`treeId="shell-sidebar"`) is mounted **once**, only by the root
 * invocation (`path === ''`); every recursive call for a nested `children` level renders its own
 * `gap`/`nest` zones inside that same inherited context instead of mounting one of its own. Move
 * validity and the move itself are resolved one level up, in `ShellConfigPanel`'s
 * `handleMoveSidebarItem`/`isValidSidebarDestination` (with `maxDepth: null` — unlike the header's
 * `menuItem`, `sidebarItem` has no nesting limit) — this component has no move logic of its own.
 */
export function SidebarItemListEditor({ items, path, onCommitItems, collapse, onMoveItem, isValidDestination }: SidebarItemListEditorProps) {
  const { pending, record } = usePendingRowRejections()
  const listTestId = `shell-sidebar-${path}`
  const levelPrefix = computeLevelLabelPrefix(path)
  const isRoot = path === ''
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
    // Every row starts collapsed by default, but a freshly created one should open right away so
    // its fields are ready to fill in without an extra click.
    collapse.expand(childPath(path, items.length))
  }

  function commitChildrenOfItem(index: number, nextChildren: SidebarItemConfig[]): CommitCanvasMutationResult {
    const next = items.slice()
    next[index] = { ...next[index], children: nextChildren }
    return onCommitItems(next)
  }

  const rows: ReactNode[] = [<ShellTreeGapZone key="gap-0" parentPath={path} index={0} />]

  items.forEach((item, index) => {
    const rowPath = childPath(path, index)
    const pendingEntry = pending[index]
    const displayedItem = pendingEntry?.value ?? item
    const collapsed = collapse.isCollapsed(rowPath)
    const rowNumber = levelPrefix ? `${levelPrefix}.${index + 1}` : `${index + 1}`
    const labelText = `Elemento de sidebar ${rowNumber}`
    const lowercaseRowLabel = `elemento de sidebar ${rowNumber}`
    const hasChildren = displayedItem.children !== undefined

    const headerContent = (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RowDisclosureButton
            path={rowPath}
            collapsed={collapsed}
            label={displayedItem.label}
            icon={displayedItem.icon}
            labelText={labelText}
            onToggle={() => collapse.toggleCollapse(rowPath)}
          />
          {hasChildren && (
            <ListTree size={14} aria-hidden="true" data-testid={`sidebar-item-branch-indicator-${rowPath}`} className="shrink-0 text-gray-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => removeItem(index)}
          disabled={!canRemove}
          aria-label={`Quitar ${lowercaseRowLabel}`}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar
        </button>
      </div>
    )

    rows.push(
      <ShellTreeDraggableRow
        key={`row-${index}`}
        path={rowPath}
        dragHandleLabel={`Reordenar ${lowercaseRowLabel}`}
        headerContent={headerContent}
      >
        {!collapsed && (
          <SidebarItemFieldsEditor
            item={displayedItem}
            onChange={(next) => updateItem(index, next)}
            labelText={labelText}
            onEnterChildrenMode={() => collapse.expand(`${rowPath}.0`)}
          />
        )}
        {pendingEntry && (
          <CommitRejectionBanner dataTestId={`shell-sidebar-${path}-${index}-error`} error={pendingEntry.error} />
        )}
        {hasChildren && (
          <SidebarItemListEditor
            items={displayedItem.children!}
            path={rowPath}
            onCommitItems={(nextChildren) => commitChildrenOfItem(index, nextChildren)}
            collapse={collapse}
            onMoveItem={onMoveItem}
            isValidDestination={isValidDestination}
          />
        )}
      </ShellTreeDraggableRow>,
    )
    rows.push(<ShellTreeGapZone key={`gap-${index + 1}`} parentPath={path} index={index + 1} />)
  })

  const list = (
    <div data-testid={`shell-dnd-list-${listTestId}`} className="flex flex-col gap-2">
      {rows}
    </div>
  )

  // The root list uses a plain-text legend with no box (FR7, 0136-T4, matching `ShellMenuListEditor`'s
  // own "Menú" fieldset); every nested `children` level — same recursive component, one level
  // deeper each time — keeps its indentation plus a vertical guide line instead, so a deep tree
  // reads as indentation, not boxes nested inside boxes.
  const fieldsetClassName = isRoot ? 'flex flex-col gap-2' : 'ml-2 flex flex-col gap-2 border-l border-gray-200 pl-4'

  return (
    <fieldset className={fieldsetClassName}>
      <legend className="px-1 text-xs font-medium text-gray-700">
        {isRoot ? 'Elementos del sidebar' : `Hijos del elemento de sidebar ${levelPrefix}`}
      </legend>
      {isRoot ? (
        <ShellTreeDndContext treeId="shell-sidebar" onMoveAttempt={onMoveItem} isValidDestination={isValidDestination}>
          {list}
        </ShellTreeDndContext>
      ) : (
        list
      )}
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
