import { useState } from 'react'
import type { ShellScrollBehavior, ShellSidebarConfig, SidebarItemConfig } from '../../config/runtime-config-types'
import { IconNode } from '../nodes/icon-node'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import type { RuntimeUiActionHandlers } from '../runtime-actions/runtime-ui-action-executor'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import {
  getAppShellSidebarChildrenClassName,
  getAppShellSidebarClassName,
  getAppShellSidebarItemClassName,
  getAppShellSidebarStickyStyle,
  getAppShellSidebarToggleClassName,
  getAppShellSidebarTriggerClassName,
} from '../runtime-node-styling-app-shell-sidebar'
import { useRuntimeCurrentPage, useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import { computeActiveSidebarItemIds } from './compute-active-sidebar-item-ids'
import { renderSidebarItemGlyphOrIcon } from './render-sidebar-item-glyph-or-icon'
import { SidebarRailFlyout } from './sidebar-rail-flyout'

interface AppShellSidebarProps {
  sidebar?: ShellSidebarConfig
  scrollBehavior?: ShellScrollBehavior
  stickyTopPx?: number
}

// Manual expand/collapse state for branch triggers, keyed by the same `path` encoding used by
// `computeActiveSidebarItemIds` (0123-T3). `collapsed` (rail mode, 0123-T6) is a separate concern:
// it only changes how *root*-level items render (icon-only leaf, or a `SidebarRailFlyout` trigger
// instead of an inline disclosure list) — `expandedPaths`/`onToggleExpand` stay the single source
// of truth for "which branches are open" in both modes, including inside a flyout's own inline
// expansion of depth-3+ children.
export function AppShellSidebar({ sidebar, scrollBehavior = 'page', stickyTopPx = 0 }: AppShellSidebarProps) {
  const state = useRuntimeState()
  const handlers = useRuntimeStateActions()
  const activePage = useRuntimeCurrentPage()
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())
  const [collapsed, setCollapsed] = useState<boolean>(() => sidebar?.defaultCollapsed ?? false)
  const [lastAutoExpandedPageId, setLastAutoExpandedPageId] = useState<string | null>(null)

  const { activePaths } = computeActiveSidebarItemIds(sidebar?.items, activePage?.id ?? null)

  // Auto-expands every ancestor branch of the active item on each navigation (requirement 15), as
  // a render-time state adjustment (React's documented alternative to an Effect for "reset/adjust
  // state when a prop changes") rather than a `useEffect`: `activePage?.id` changing is detected by
  // comparing against `lastAutoExpandedPageId`, and both setters fire in the same render pass,
  // which React coalesces without committing the intermediate state to the screen. Always a union
  // with the previous `expandedPaths`, never a reset: a branch expanded manually by the user for an
  // unrelated reason — or one the user had explicitly collapsed — must not be fought here except to
  // reopen it when it becomes an ancestor of the newly active item (design decision 5). Adding a
  // leaf's own path is harmless: `expandedPaths` is only ever read to decide whether a branch
  // *trigger* shows its children, and a leaf is never a trigger.
  const currentPageId = activePage?.id ?? null
  if (currentPageId !== lastAutoExpandedPageId) {
    setLastAutoExpandedPageId(currentPageId)
    setExpandedPaths((previousExpandedPaths) => {
      const nextExpandedPaths = new Set(previousExpandedPaths)
      activePaths.forEach((path) => nextExpandedPaths.add(path))
      return nextExpandedPaths
    })
  }

  if (sidebar === undefined || sidebar.items === undefined || sidebar.items.length === 0) {
    return null
  }

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((previousExpandedPaths) => {
      const nextExpandedPaths = new Set(previousExpandedPaths)
      if (nextExpandedPaths.has(path)) {
        nextExpandedPaths.delete(path)
      } else {
        nextExpandedPaths.add(path)
      }
      return nextExpandedPaths
    })
  }

  return (
    <nav
      data-testid="app-shell-sidebar"
      className={getAppShellSidebarClassName({ collapsed, scrollBehavior })}
      style={scrollBehavior === 'fixed' ? undefined : getAppShellSidebarStickyStyle(stickyTopPx)}
    >
      <div className="flex flex-col gap-1 p-2">
        <button
          type="button"
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
          className={getAppShellSidebarToggleClassName()}
          onClick={() => setCollapsed((previousCollapsed) => !previousCollapsed)}
        >
          <IconNode name={collapsed ? 'panel-left-open' : 'panel-left-close'} className="size-4 shrink-0" />
        </button>
        {sidebar.items.map((item, rootIndex) => {
          const path = String(rootIndex)

          if (collapsed) {
            return (
              <SidebarRailRootItem
                key={path}
                item={item}
                path={path}
                state={state}
                handlers={handlers}
                activePaths={activePaths}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
              />
            )
          }

          return (
            <SidebarItemNode
              key={path}
              item={item}
              path={path}
              depth={0}
              state={state}
              handlers={handlers}
              activePaths={activePaths}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
            />
          )
        })}
      </div>
    </nav>
  )
}

interface SidebarItemNodeProps {
  item: SidebarItemConfig
  path: string
  depth: number
  state: RuntimeState
  handlers: RuntimeUiActionHandlers
  activePaths: ReadonlySet<string>
  expandedPaths: ReadonlySet<string>
  onToggleExpand: (path: string) => void
  showGlyphFallback?: boolean
  onLeafSelect?: () => void
}

// Recursive renderer for one `sidebarItem`: a navigable leaf (`SidebarItemLeaf`) when it has no
// `children`, or a manual expand/collapse trigger whose own `children` render inline and indented
// once expanded — with no depth limit, mirroring `computeActiveSidebarItemIds`'s own path
// encoding (`${parentPath}.children.${index}`).
//
// Reused verbatim by `SidebarRailFlyout` (0123-T6) to render a flyout's own children: same
// `expandedPaths`/`onToggleExpand`, so a depth-3+ item still expands *inline inside the panel*
// instead of opening a second flyout. Two optional props only matter to that flyout usage —
// `showGlyphFallback` (glyph-for-missing-icon fallback, off in the ordinary expanded sidebar) and
// `onLeafSelect` (closes the flyout once a leaf is chosen) — both default to the expanded-mode
// behaviour (no fallback glyph, no extra callback) when omitted.
function SidebarItemNode({
  item,
  path,
  depth,
  state,
  handlers,
  activePaths,
  expandedPaths,
  onToggleExpand,
  showGlyphFallback = false,
  onLeafSelect,
}: SidebarItemNodeProps) {
  if (!matchesVisibilityRule(item.visibility, state)) {
    return null
  }

  const active = activePaths.has(path)
  const label = resolveRuntimeTextReference(item.label, state, 'shell.sidebar.item.label')

  if (item.children !== undefined && item.children.length > 0) {
    const expanded = expandedPaths.has(path)

    return (
      <div>
        <button
          type="button"
          aria-expanded={expanded}
          className={getAppShellSidebarTriggerClassName({ active, expanded })}
          onClick={() => onToggleExpand(path)}
        >
          {renderSidebarItemGlyphOrIcon(item, label, showGlyphFallback)}
          {label}
        </button>
        {expanded ? (
          <div className={getAppShellSidebarChildrenClassName(depth + 1)}>
            {item.children.map((childItem, childIndex) => (
              <SidebarItemNode
                key={String(childIndex)}
                item={childItem}
                path={`${path}.children.${childIndex}`}
                depth={depth + 1}
                state={state}
                handlers={handlers}
                activePaths={activePaths}
                expandedPaths={expandedPaths}
                onToggleExpand={onToggleExpand}
                showGlyphFallback={showGlyphFallback}
                onLeafSelect={onLeafSelect}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <SidebarItemLeaf
      item={item}
      label={label}
      state={state}
      handlers={handlers}
      className={getAppShellSidebarItemClassName({ active })}
      showGlyphFallback={showGlyphFallback}
      onSelect={onLeafSelect}
    />
  )
}

interface SidebarItemLeafProps {
  item: SidebarItemConfig
  label: string
  className: string
  state: RuntimeState
  handlers: RuntimeUiActionHandlers
  collapsed?: boolean
  showGlyphFallback?: boolean
  onSelect?: () => void
}

// Analogous to `MenuItemLeaf` (`app-shell-header.tsx`) but typed over `SidebarItemConfig`, which
// does not share a Zod type with `menuItem`/`menuItemChild` (design decisión 3, 0123-T4). Schema
// guarantees exactly one of `href`/`action` on any leaf item, same shape as the header's contract.
// `collapsed` (rail-mode root leaf) hides the visible label text and moves it to `aria-label`/
// `title` instead; `showGlyphFallback` additionally applies inside `SidebarRailFlyout`, whose rows
// keep the visible label but still want the icon-or-glyph fallback (`collapsed` implies it too).
function SidebarItemLeaf({
  item,
  label,
  className,
  state,
  handlers,
  collapsed = false,
  showGlyphFallback = false,
  onSelect,
}: SidebarItemLeafProps) {
  const iconOrGlyph = renderSidebarItemGlyphOrIcon(item, label, collapsed || showGlyphFallback)
  const accessibleNameProps = collapsed ? { 'aria-label': label, title: label } : {}

  if (item.href !== undefined) {
    const resolvedHref = resolveRuntimeTextReference(item.href, state, 'shell.sidebar.item.href')

    return (
      <a href={resolvedHref} className={className} onClick={onSelect} {...accessibleNameProps}>
        {iconOrGlyph}
        {collapsed ? null : label}
      </a>
    )
  }

  const handleClick = () => {
    onSelect?.()
    if (item.action) {
      executeRuntimeUiAction(item.action, handlers)
    }
  }

  return (
    <button type="button" className={className} onClick={handleClick} {...accessibleNameProps}>
      {iconOrGlyph}
      {collapsed ? null : label}
    </button>
  )
}

interface SidebarRailRootItemProps {
  item: SidebarItemConfig
  path: string
  state: RuntimeState
  handlers: RuntimeUiActionHandlers
  activePaths: ReadonlySet<string>
  expandedPaths: ReadonlySet<string>
  onToggleExpand: (path: string) => void
}

// Root-level rendering when the sidebar is collapsed into rail mode (0123-T6, design decisiones 7
// and 9): icon-only, no visible label text. A leaf becomes an icon-only button/link with the full
// label preserved as its accessible name; a branch becomes a `SidebarRailFlyout` trigger instead
// of the expanded mode's inline disclosure list, since there is no room to render children inline
// in a 4rem-wide rail.
function SidebarRailRootItem({
  item,
  path,
  state,
  handlers,
  activePaths,
  expandedPaths,
  onToggleExpand,
}: SidebarRailRootItemProps) {
  if (!matchesVisibilityRule(item.visibility, state)) {
    return null
  }

  const active = activePaths.has(path)
  const label = resolveRuntimeTextReference(item.label, state, 'shell.sidebar.item.label')

  if (item.children !== undefined && item.children.length > 0) {
    return (
      <SidebarRailFlyout
        item={item}
        path={path}
        activePaths={activePaths}
        expandedPaths={expandedPaths}
        onToggleExpand={onToggleExpand}
      />
    )
  }

  return (
    <SidebarItemLeaf
      item={item}
      label={label}
      state={state}
      handlers={handlers}
      className={getAppShellSidebarItemClassName({ active, collapsed: true })}
      collapsed
    />
  )
}

export { SidebarItemNode }
