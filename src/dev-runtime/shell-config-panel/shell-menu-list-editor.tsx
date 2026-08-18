import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type { MenuItemChildConfig, MenuItemConfig } from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { ShellTreeDndContext, ShellTreeDraggableRow, ShellTreeGapZone } from './shell-config-panel-dnd'
import type { useShellCollapseState } from './shell-collapse-state'
import type { ShellTreeDestination } from './shell-tree-mutations'
import { MenuItemFieldsEditor } from './menu-item-fields-editor'

const NEW_ROOT_ITEM_LABEL = 'Nuevo elemento'

/**
 * Shared collapse controls handed down from `ShellConfigPanel`'s single `useShellCollapseState()`
 * instance for the whole `shell.header.menu` tree (0125-T2/T4). `ShellMenuListEditor` forwards it
 * to `ShellMenuChildrenListEditor` unchanged — one hook instance covers both levels.
 */
type ShellCollapseControls = ReturnType<typeof useShellCollapseState>

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

interface RowDisclosureButtonProps {
  path: string
  collapsed: boolean
  label: string
  icon: string | undefined
  labelText: string
  onToggle: () => void
}

/**
 * Combined collapse toggle + name (0125, post-implementation simplification): a single button
 * that both shows this row's name (so a collapsed row still reads at a glance) and toggles it —
 * clicking the name itself opens/closes the row, there is no separate icon-only button and no
 * separate read-only summary box below. Rendered as this row's `headerContent`, right beside the
 * drag handle in `ShellTreeDraggableRow`, so the name a user drags by is also the name they click.
 */
function RowDisclosureButton({ path, collapsed, label, icon, labelText, onToggle }: RowDisclosureButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? 'Expandir' : 'Colapsar'} ${labelText}`}
      data-testid={`menu-item-collapse-toggle-${path}`}
      className="flex min-w-0 items-center gap-2 truncate rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
    >
      {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      {icon && <span aria-hidden="true">{icon}</span>}
      <span className="truncate">{label}</span>
    </button>
  )
}

interface ShellMenuChildrenListEditorProps {
  parentIndex: number
  items: MenuItemChildConfig[]
  onCommitChildren: (nextChildren: MenuItemChildConfig[]) => CommitCanvasMutationResult
  collapse: ShellCollapseControls
}

/**
 * `children` sublist of a single root `menuItem` (0122-T5). `menuItemChild` never accepts its
 * own `children` (0122-T1) — every row here uses `allowChildren={false}` and never shows the
 * branch indicator. The schema requires at least one child (`z.array(menuItemChildSchema).nonempty()`),
 * so "Quitar" is disabled at the last remaining entry rather than letting the array go empty
 * (same `minItems` pattern the generic `ArrayPropertyField` already uses for other
 * schema-enforced minimums).
 *
 * Drag/drop (0125-T5): this list no longer owns its own `DndContext` — it only renders
 * `ShellTreeDraggableRow`/`ShellTreeGapZone` inside the single tree-wide `ShellTreeDndContext`
 * `ShellMenuListEditor` mounts once for the whole `shell.header.menu` tree. Reordering,
 * nesting and cross-level moves are all resolved by `moveShellSubtree`/`isValidShellTreeDestination`
 * one level up, in `ShellConfigPanel`'s `handleMoveMenuItem`/`isValidMenuDestination` — this
 * component has no move logic of its own.
 */
export function ShellMenuChildrenListEditor({ parentIndex, items, onCommitChildren, collapse }: ShellMenuChildrenListEditorProps) {
  const canRemove = items.length > 1
  const parentPath = String(parentIndex)
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
    // Every row starts collapsed by default, but a freshly created one should open right away so
    // its fields are ready to fill in without an extra click.
    collapse.expand(`${parentPath}.${items.length}`)
  }

  const rows: ReactNode[] = [<ShellTreeGapZone key="gap-0" parentPath={parentPath} index={0} />]

  items.forEach((child, index) => {
    const path = `${parentIndex}.${index}`
    const pendingEntry = pending[index]
    const displayedChild = (pendingEntry?.value ?? child) as MenuItemChildConfig
    const collapsed = collapse.isCollapsed(path)
    const labelText = `Elemento de desplegable ${index + 1}`

    const headerContent = (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <RowDisclosureButton
          path={path}
          collapsed={collapsed}
          label={displayedChild.label}
          icon={displayedChild.icon}
          labelText={labelText}
          onToggle={() => collapse.toggleCollapse(path)}
        />
        <button
          type="button"
          onClick={() => removeChild(index)}
          disabled={!canRemove}
          aria-label={`Quitar elemento de desplegable ${index + 1}`}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar
        </button>
      </div>
    )

    rows.push(
      <ShellTreeDraggableRow
        key={`row-${index}`}
        path={path}
        dragHandleLabel={`Reordenar elemento de desplegable ${index + 1}`}
        headerContent={headerContent}
      >
        {!collapsed && (
          <MenuItemFieldsEditor
            item={displayedChild}
            allowChildren={false}
            onChange={(next) => updateChild(index, next)}
            labelText={labelText}
          />
        )}
        {pendingEntry && (
          <CommitRejectionBanner
            dataTestId={`shell-menu-children-${parentIndex}-${index}-error`}
            error={pendingEntry.error}
          />
        )}
      </ShellTreeDraggableRow>,
    )
    rows.push(<ShellTreeGapZone key={`gap-${index + 1}`} parentPath={parentPath} index={index + 1} />)
  })

  return (
    <fieldset className="ml-2 flex flex-col gap-2 border-l border-gray-200 pl-4">
      <div data-testid={`shell-dnd-list-shell-menu-children-${parentIndex}`} className="flex flex-col gap-2">
        {rows}
      </div>
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
  collapse: ShellCollapseControls
  onMoveItem: (sourcePath: string, destination: ShellTreeDestination) => void
  isValidDestination: (sourcePath: string, destination: ShellTreeDestination) => boolean
}

/**
 * Root `shell.header.menu` list editor: add/remove entries, expand `children`, collapse/expand
 * each row's own field editor independently (0125-T4), and — since 0125-T5 — drag to reorder,
 * nest as a child, or move across levels (root <-> a parent's `children`) capped at `menuItem`'s
 * one-level nesting limit. Mounts the **single** `ShellTreeDndContext` for the whole menu tree:
 * `ShellMenuChildrenListEditor` renders its rows/gaps inside this same context rather than
 * mounting one of its own, so a drag can resolve to any `gap`/`nest` zone anywhere in the tree,
 * not just within its own level.
 */
export function ShellMenuListEditor({ menu, onCommitMenu, collapse, onMoveItem, isValidDestination }: ShellMenuListEditorProps) {
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
    // Every row starts collapsed by default, but a freshly created one should open right away so
    // its fields are ready to fill in without an extra click.
    collapse.expand(String(menu.length))
  }

  const rows: ReactNode[] = [<ShellTreeGapZone key="gap-0" parentPath="" index={0} />]

  menu.forEach((item, index) => {
    const path = String(index)
    const pendingEntry = pending[index]
    const displayedItem = (pendingEntry?.value ?? item) as MenuItemConfig
    const collapsed = collapse.isCollapsed(path)
    const labelText = `Elemento de menú ${index + 1}`
    const hasChildren = displayedItem.children !== undefined

    const headerContent = (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RowDisclosureButton
            path={path}
            collapsed={collapsed}
            label={displayedItem.label}
            icon={displayedItem.icon}
            labelText={labelText}
            onToggle={() => collapse.toggleCollapse(path)}
          />
          {hasChildren && (
            <ListTree size={14} aria-hidden="true" data-testid={`menu-item-branch-indicator-${path}`} className="shrink-0 text-gray-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => removeItem(index)}
          aria-label={`Quitar elemento de menú ${index + 1}`}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          Quitar
        </button>
      </div>
    )

    rows.push(
      <ShellTreeDraggableRow
        key={`row-${index}`}
        path={path}
        dragHandleLabel={`Reordenar elemento de menú ${index + 1}`}
        headerContent={headerContent}
      >
        {!collapsed && (
          <MenuItemFieldsEditor
            item={displayedItem}
            allowChildren
            onChange={(next) => updateItem(index, next as MenuItemConfig)}
            labelText={labelText}
            onEnterChildrenMode={() => collapse.expand(`${path}.0`)}
          />
        )}
        {pendingEntry && <CommitRejectionBanner dataTestId={`shell-menu-root-${index}-error`} error={pendingEntry.error} />}
        {hasChildren && (
          <ShellMenuChildrenListEditor
            parentIndex={index}
            items={displayedItem.children!}
            onCommitChildren={(nextChildren) => onCommitMenu(reorderChildrenIntoMenu(menu, index, nextChildren))}
            collapse={collapse}
          />
        )}
      </ShellTreeDraggableRow>,
    )
    rows.push(<ShellTreeGapZone key={`gap-${index + 1}`} parentPath="" index={index + 1} />)
  })

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="px-1 text-xs font-medium text-gray-700">Menú</legend>
      <ShellTreeDndContext treeId="shell-menu" onMoveAttempt={onMoveItem} isValidDestination={isValidDestination}>
        <div data-testid="shell-dnd-list-shell-menu-root" className="flex flex-col gap-2">
          {rows}
        </div>
      </ShellTreeDndContext>
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
