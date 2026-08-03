import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type {
  MenuItemChildConfig,
  MenuItemConfig,
  ShellConfig,
  ShellHeaderActionNode,
  ShellHeaderConfig,
  SidebarItemConfig,
} from '../../config/runtime-config-types'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import type { CommitCanvasMutationResult } from '../layout-canvas/layout-canvas-commit'
import { BooleanPropertyField } from '../layout-canvas/property-fields/boolean-property-field'
import { PropertyFieldDispatcher } from '../layout-canvas/property-fields/property-field-dispatcher'
import { isPlainObject, resolveUnionBranch } from '../layout-canvas/property-fields/property-field-schema-resolution'
import { TextPropertyField } from '../layout-canvas/property-fields/text-property-field'
import { ShellActionsListEditor } from './shell-actions-list-editor'
import { useShellCollapseState } from './shell-collapse-state'
import { getShellHeaderJsonSchema } from './shell-config-panel-schema'
import { ShellMenuListEditor } from './shell-menu-list-editor'
import { isValidShellTreeDestination, moveShellSubtree, type ShellTreeDestination } from './shell-tree-mutations'
import { SidebarItemListEditor } from './sidebar-item-list-editor'

// `shell.header.menu`'s tree (root `MenuItemConfig` items + their `MenuItemChildConfig` children)
// is addressed generically as `MenuItemChildConfig[]` when calling into `shell-tree-mutations.ts`
// (T1's own type note): `MenuItemConfig extends MenuItemChildConfig` and `MenuItemChildConfig`
// itself never declares `children`, so the whole tree already satisfies `T extends { children?:
// T[] }` under `T = MenuItemChildConfig` without a union — no cast needed either way, since a
// `MenuItemConfig[]`/`MenuItemChildConfig[]` differ only by one optional field and are mutually
// assignable. `menuItem`'s own nesting limit (root items may have `children`; a child may not) is
// enforced by `maxDepth: 1` below, not by this type choice.
const MENU_TREE_MAX_DEPTH = 1

// `appendChildAtPath` (T1) is deliberately domain-agnostic: it only ever adds/appends to
// `children`, never touches any other field. `menuItem`'s own schema (`refineMenuItemShape` in
// `runtime-config-zod.ts`) forbids `href`/`action` alongside `children`, so nesting a dragged item
// onto a leaf `menuItem` (design.md Decisión 5) needs this domain-specific pass on top: whichever
// node the move gave a `children` array to loses its previous `href`/`action`. Applied to the
// whole tree unconditionally after every move (not only `nest` destinations) because it is a
// no-op wherever the invariant already holds, which is simpler than threading "was this a nest
// move, and onto which resulting path" through the result.
function dropHrefActionWhereChildrenExist(item: MenuItemConfig): MenuItemConfig {
  if (item.children === undefined) return item
  const sanitizedChildren = item.children.map(
    (child) => dropHrefActionWhereChildrenExist(child as MenuItemConfig) as MenuItemChildConfig,
  )
  if (item.href === undefined && item.action === undefined) {
    return { ...item, children: sanitizedChildren }
  }
  const { href: _href, action: _action, ...rest } = item
  return { ...rest, children: sanitizedChildren }
}

function sanitizeMenuTree(tree: MenuItemConfig[]): MenuItemConfig[] {
  return tree.map(dropHrefActionWhereChildrenExist)
}

// `sidebarItem` shares the exact same "children forbids href/action" constraint as `menuItem`
// (`refineSidebarItemShape` in `runtime-config-zod.ts`, design.md Decisión 5 — it applies to
// nesting onto *any* item, `menuItem` or `sidebarItem` alike). A separate function (rather than
// reusing `dropHrefActionWhereChildrenExist`) because the two config shapes, while structurally
// identical in the fields this cares about, are distinct types with no common supertype declared.
function dropHrefActionWhereChildrenExistFromSidebarItem(item: SidebarItemConfig): SidebarItemConfig {
  if (item.children === undefined) return item
  const sanitizedChildren = item.children.map(dropHrefActionWhereChildrenExistFromSidebarItem)
  if (item.href === undefined && item.action === undefined) {
    return { ...item, children: sanitizedChildren }
  }
  const { href: _href, action: _action, ...rest } = item
  return { ...rest, children: sanitizedChildren }
}

function sanitizeSidebarTree(tree: SidebarItemConfig[]): SidebarItemConfig[] {
  return tree.map(dropHrefActionWhereChildrenExistFromSidebarItem)
}

export interface ShellConfigPanelProps {
  shell: ShellConfig | undefined
  onCommitShellMutation: (mutate: (shell: ShellConfig | undefined) => ShellConfig | undefined) => CommitCanvasMutationResult
}

type ShellPendingKey = 'logo' | 'title'
type ShellPendingRejections = Partial<Record<ShellPendingKey, { value: unknown; error: RuntimeConfigError }>>

const EMPTY_HEADER: ShellHeaderConfig = {}

// Sub-navigation (0125-T8, design.md Decisión 6): fixed ids are enough here — unlike a
// list-editor row, `ShellConfigPanel` never mounts more than one instance of itself at a time.
const HEADER_TAB_ID = 'shell-config-panel-tab-header'
const SIDEBAR_TAB_ID = 'shell-config-panel-tab-sidebar'
const HEADER_PANEL_ID = 'shell-config-panel-tabpanel-header'
const SIDEBAR_PANEL_ID = 'shell-config-panel-tabpanel-sidebar'
type ShellConfigSubView = 'header' | 'sidebar'

/**
 * "Shell" section of the visual editor (0122-T5): toggles the header on/off, edits `logo`/
 * `title` through the same generic schema-driven widgets the canvas properties panel uses, and
 * mounts the dedicated `menu`/`actions` list editors. Every commit here goes through
 * `onCommitShellMutation` — the same "mutate, validate, patch only this root key onto the raw
 * Monaco buffer" pipeline `commitCanvasMutation` already uses for `layout` (see
 * `patchRootKey`/`layout-canvas-commit.ts`), so a Shell edit never touches `layout`/`api`/
 * `initialPage`/`preloads`/`tokens`/`translations`.
 *
 * The panel is split into two `role="tabpanel"` sub-views ("Header"/"Sidebar", 0125-T8, design.md
 * Decisión 6) behind a `role="tablist"`. Both stay mounted at all times — only a Tailwind
 * `hidden` class toggles which one is visible — the same "always present in the DOM" precedent
 * already documented for `accordion`/`modal` bodies in Editor mode. Purely presentational: it
 * changes nothing about `headerActive`/`sidebarActive` or either commit pipeline below.
 */
export function ShellConfigPanel({ shell, onCommitShellMutation }: ShellConfigPanelProps) {
  const header = shell?.header
  const headerActive = header !== undefined
  const sidebar = shell?.sidebar
  const sidebarActive = sidebar !== undefined
  const [activeSubView, setActiveSubView] = useState<ShellConfigSubView>('header')
  const [pendingRejections, setPendingRejections] = useState<ShellPendingRejections>({})
  // Single collapse-state instance for the whole `shell.header.menu` tree (0125-T2/T4): one hook
  // call here, forwarded down through `ShellMenuListEditor` to every nesting level, rather than
  // one instance per row/list.
  const menuCollapse = useShellCollapseState()
  // Independent collapse-state instance for `shell.sidebar.items` (0125-T2/T6): a distinct tree
  // from `shell.header.menu`, so it gets its own hook instance, forwarded down through
  // `SidebarItemListEditor` unchanged on every recursive call.
  const sidebarCollapse = useShellCollapseState()

  function recordResult(key: ShellPendingKey, attemptedValue: unknown, result: CommitCanvasMutationResult) {
    if (result.status === 'rejected') {
      setPendingRejections((prev) => ({ ...prev, [key]: { value: attemptedValue, error: result.error } }))
      return
    }
    setPendingRejections((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // Toggling one `shell` section (header/sidebar) on or off must never disturb the other: each
  // is an additive, independent sibling of `shell` (see `shellSchema` in `runtime-config-zod.ts`).
  // Replacing the whole `shell` object on every toggle — as the previous `handleToggleHeader`
  // did — was harmless while `header` was the only possible key, but silently destroys a
  // configured `shell.sidebar` once `sidebar` becomes a sibling (0123-T7 regression fix).
  function commitShellSectionToggle(section: 'header' | 'sidebar', nextActive: boolean) {
    onCommitShellMutation((prevShell) => {
      const next = { ...(prevShell ?? {}) }
      if (nextActive) {
        next[section] = section === 'header' ? {} : { items: [] }
      } else {
        delete next[section]
      }
      return Object.keys(next).length === 0 ? undefined : next
    })
  }

  function commitHeaderField(key: ShellPendingKey, value: unknown) {
    const result = onCommitShellMutation((prevShell) => ({
      ...(prevShell ?? {}),
      header: { ...(prevShell?.header ?? EMPTY_HEADER), [key]: value },
    }))
    recordResult(key, value, result)
  }

  function commitMenu(nextMenu: MenuItemConfig[]): CommitCanvasMutationResult {
    return onCommitShellMutation((prevShell) => ({
      ...(prevShell ?? {}),
      header: { ...(prevShell?.header ?? EMPTY_HEADER), menu: nextMenu },
    }))
  }

  // Drag/drop for `shell.header.menu` (0125-T5): reorder, nest, or move a `menuItem`/
  // `menuItemChild` across levels, capped at `MENU_TREE_MAX_DEPTH`. `moveShellSubtree` also
  // produces the `pathRemap` needed to carry each moved node's (and shifted sibling's) collapse
  // state to its new path — applied only when the commit actually lands, so a rejected mutation
  // never desyncs collapse state from the config that's still on screen.
  function handleMoveMenuItem(sourcePath: string, destination: ShellTreeDestination): void {
    const { tree, pathRemap } = moveShellSubtree<MenuItemChildConfig>(header?.menu ?? [], sourcePath, destination)
    const result = commitMenu(sanitizeMenuTree(tree))
    if (result.status !== 'rejected') menuCollapse.applyPathRemap(pathRemap)
  }

  function isValidMenuDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
    return isValidShellTreeDestination<MenuItemChildConfig>(header?.menu ?? [], sourcePath, destination, MENU_TREE_MAX_DEPTH)
  }

  function commitActions(nextActions: ShellHeaderActionNode[]): CommitCanvasMutationResult {
    return onCommitShellMutation((prevShell) => ({
      ...(prevShell ?? {}),
      header: { ...(prevShell?.header ?? EMPTY_HEADER), actions: nextActions },
    }))
  }

  // Same "patch only this root key" pipeline as `commitMenu`/`commitActions` above: replaces
  // `shell.sidebar.items` while conserving `defaultCollapsed` if it was already set, and never
  // touches `shell.header`.
  function commitSidebarItems(nextItems: SidebarItemConfig[]): CommitCanvasMutationResult {
    return onCommitShellMutation((prevShell) => ({
      ...(prevShell ?? {}),
      sidebar: { ...(prevShell?.sidebar ?? {}), items: nextItems },
    }))
  }

  // `shell.sidebar.defaultCollapsed` (0125-T8): the field already existed in the schema/type
  // (conserved by the spread above) but had no editor of its own yet. Direct `BooleanPropertyField`
  // wiring, same style as the "Header activo"/"Sidebar activo" toggles above, rather than routing
  // through `PropertyFieldDispatcher` — a single boolean field doesn't need schema-driven dispatch.
  function commitSidebarDefaultCollapsed(nextValue: boolean): CommitCanvasMutationResult {
    return onCommitShellMutation((prevShell) => ({
      ...(prevShell ?? {}),
      sidebar: { ...(prevShell?.sidebar ?? {}), defaultCollapsed: nextValue },
    }))
  }

  // Drag/drop for `shell.sidebar.items` (0125-T7): same tree-wide reorder/nest/cross-level-move
  // pattern `handleMoveMenuItem`/`isValidMenuDestination` above build for the header, but with
  // `maxDepth: null` — `sidebarItem` has no nesting limit (0123-T1), unlike `menuItem`'s
  // `MENU_TREE_MAX_DEPTH`.
  function handleMoveSidebarItem(sourcePath: string, destination: ShellTreeDestination): void {
    const { tree, pathRemap } = moveShellSubtree<SidebarItemConfig>(sidebar?.items ?? [], sourcePath, destination)
    const result = commitSidebarItems(sanitizeSidebarTree(tree))
    if (result.status !== 'rejected') sidebarCollapse.applyPathRemap(pathRemap)
  }

  function isValidSidebarDestination(sourcePath: string, destination: ShellTreeDestination): boolean {
    return isValidShellTreeDestination<SidebarItemConfig>(sidebar?.items ?? [], sourcePath, destination, null)
  }

  const shellHeaderSchema = getShellHeaderJsonSchema()
  const schemaProperties = isPlainObject(shellHeaderSchema.properties) ? shellHeaderSchema.properties : {}
  const logoSchema = isPlainObject(schemaProperties.logo) ? (schemaProperties.logo as Record<string, unknown>) : undefined

  const logoPending = pendingRejections.logo
  const titlePending = pendingRejections.title
  const displayedLogo = logoPending ? logoPending.value : (header?.logo ?? {})
  const displayedTitle = titlePending ? (titlePending.value as string) : (header?.title ?? '')

  return (
    <div data-testid="shell-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div role="tablist" aria-label="Sub-vistas de Shell" className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          role="tab"
          id={HEADER_TAB_ID}
          aria-selected={activeSubView === 'header'}
          aria-controls={HEADER_PANEL_ID}
          onClick={() => setActiveSubView('header')}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeSubView === 'header' ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Header
        </button>
        <button
          type="button"
          role="tab"
          id={SIDEBAR_TAB_ID}
          aria-selected={activeSubView === 'sidebar'}
          aria-controls={SIDEBAR_PANEL_ID}
          onClick={() => setActiveSubView('sidebar')}
          className={`px-3 py-1.5 text-xs font-medium ${
            activeSubView === 'sidebar' ? 'border-b-2 border-gray-800 text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sidebar
        </button>
      </div>

      <div
        role="tabpanel"
        id={HEADER_PANEL_ID}
        aria-labelledby={HEADER_TAB_ID}
        data-testid={HEADER_PANEL_ID}
        className={activeSubView === 'header' ? 'flex flex-col gap-4' : 'hidden'}
      >
        <BooleanPropertyField
          label="Header activo"
          value={headerActive}
          onChange={(nextActive) => commitShellSectionToggle('header', nextActive)}
        />

        {headerActive && header !== undefined && (
          <>
            <div className="flex flex-col gap-2">
              <PropertyFieldDispatcher
                schema={resolveUnionBranch(logoSchema, displayedLogo)}
                value={displayedLogo}
                onChange={(nextLogo) => commitHeaderField('logo', nextLogo)}
                label="Logo"
              />
              {logoPending && <CommitRejectionBanner dataTestId="shell-config-panel-logo-error" error={logoPending.error} />}
            </div>

            <div className="flex flex-col gap-2">
              <TextPropertyField label="Title" value={displayedTitle} onChange={(nextTitle) => commitHeaderField('title', nextTitle)} />
              {titlePending && <CommitRejectionBanner dataTestId="shell-config-panel-title-error" error={titlePending.error} />}
            </div>

            <ShellMenuListEditor
              menu={header.menu ?? []}
              onCommitMenu={commitMenu}
              collapse={menuCollapse}
              onMoveItem={handleMoveMenuItem}
              isValidDestination={isValidMenuDestination}
            />
            <ShellActionsListEditor actions={header.actions ?? []} onCommitActions={commitActions} />
          </>
        )}
      </div>

      <div
        role="tabpanel"
        id={SIDEBAR_PANEL_ID}
        aria-labelledby={SIDEBAR_TAB_ID}
        data-testid={SIDEBAR_PANEL_ID}
        className={activeSubView === 'sidebar' ? 'flex flex-col gap-4' : 'hidden'}
      >
        <BooleanPropertyField
          label="Sidebar activo"
          value={sidebarActive}
          onChange={(nextActive) => commitShellSectionToggle('sidebar', nextActive)}
        />

        {sidebarActive && sidebar !== undefined && (
          <>
            <BooleanPropertyField
              label="Modo rail por defecto"
              value={sidebar.defaultCollapsed ?? false}
              onChange={(nextValue) => commitSidebarDefaultCollapsed(nextValue)}
            />
            <SidebarItemListEditor
              items={sidebar.items ?? []}
              path=""
              onCommitItems={commitSidebarItems}
              collapse={sidebarCollapse}
              onMoveItem={handleMoveSidebarItem}
              isValidDestination={isValidSidebarDestination}
            />
          </>
        )}
      </div>
    </div>
  )
}
