import type { KeyboardEvent } from 'react'
import type { MenuItemChildConfig, ShellHeaderActionNode, ShellHeaderConfig } from '../../config/runtime-config-types'
import { LayoutNodeRenderer } from '../layout-node-renderer'
import { LayoutRenderer } from '../layout-renderer'
import { LazyNode } from '../lazy-node'
import { NodeComponents } from '../nodes/node-components-map'
import { IconNode } from '../nodes/icon-node'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import type { RuntimeUiActionHandlers } from '../runtime-actions/runtime-ui-action-executor'
import { matchesVisibilityRule } from '../runtime-layout-visibility'
import { resolveRuntimeTextReference } from '../runtime-references/runtime-reference-resolver'
import {
  getAppShellHeaderActionsClassName,
  getAppShellHeaderClassName,
  getAppShellHeaderInnerClassName,
  getAppShellHeaderLeftClassName,
  getAppShellHeaderMenuItemClassName,
  getAppShellHeaderTitleClassName,
} from '../runtime-node-styling'
import { useRuntimeCurrentPage, useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import type { RuntimeState } from '../runtime-state/runtime-state-types'
import { computeActiveMenuItemIds } from './compute-active-menu-item-ids'
import { MenuItemDropdown } from './menu-item-dropdown'

interface AppShellHeaderProps {
  header?: ShellHeaderConfig
}

function isShellHeaderEmpty(header: ShellHeaderConfig) {
  return (
    header.logo === undefined &&
    !header.title &&
    (header.menu === undefined || header.menu.length === 0) &&
    (header.actions === undefined || header.actions.length === 0)
  )
}

export function AppShellHeader({ header }: AppShellHeaderProps) {
  const state = useRuntimeState()
  const handlers = useRuntimeStateActions()
  const activePage = useRuntimeCurrentPage()

  if (header === undefined || isShellHeaderEmpty(header)) {
    return null
  }

  const { activePaths } = computeActiveMenuItemIds(header.menu, activePage?.id ?? null)
  const title = header.title !== undefined
    ? resolveRuntimeTextReference(header.title, state, 'shell.header.title')
    : ''
  const ImageNode = NodeComponents.image

  return (
    <header data-testid="app-shell-header" className={getAppShellHeaderClassName()}>
      <div className={getAppShellHeaderInnerClassName()}>
        <div data-testid="app-shell-header-left" className={getAppShellHeaderLeftClassName()}>
          {header.logo !== undefined ? (
            <LazyNode>
              <ImageNode node={{ type: 'image', props: header.logo }} />
            </LazyNode>
          ) : null}
          {title.length > 0 ? (
            <span data-testid="app-shell-header-title" className={getAppShellHeaderTitleClassName()}>
              {title}
            </span>
          ) : null}
          {(header.menu ?? []).map((item, rootIndex) => {
            if (!matchesVisibilityRule(item.visibility, state)) {
              return null
            }

            const rootPath = String(rootIndex)

            if (item.children !== undefined) {
              return (
                <MenuItemDropdown
                  key={rootPath}
                  item={item}
                  rootPath={rootPath}
                  activePaths={activePaths}
                  active={activePaths.has(rootPath)}
                />
              )
            }

            return (
              <MenuItemLeaf
                key={rootPath}
                item={item}
                state={state}
                handlers={handlers}
                className={getAppShellHeaderMenuItemClassName({ active: activePaths.has(rootPath) })}
              />
            )
          })}
        </div>
        <div data-testid="app-shell-header-actions" className={getAppShellHeaderActionsClassName()}>
          {(header.actions ?? []).map((actionNode, index) => renderShellHeaderAction(actionNode, index))}
        </div>
      </div>
    </header>
  )
}

function renderShellHeaderAction(actionNode: ShellHeaderActionNode, key: number) {
  const renderedChildren =
    actionNode.type === 'link' && actionNode.children !== undefined
      ? <LayoutRenderer nodes={actionNode.children} />
      : undefined

  return <LayoutNodeRenderer key={key} node={actionNode} renderedChildren={renderedChildren} />
}

export interface MenuItemLeafProps {
  item: MenuItemChildConfig
  className: string
  role?: 'menuitem'
  state: RuntimeState
  handlers: RuntimeUiActionHandlers
  onSelect?: () => void
}

// Shared leaf renderer for a single navigable `menuItem`/`menuItemChild` (never one with
// `children`, which is handled by `MenuItemDropdown` instead): reused both by the root-level
// menu here and by each dropdown child in `menu-item-dropdown.tsx`. Schema guarantees exactly
// one of `href`/`action` is present on any leaf item (0122-T1's `refineMenuItemShape`).
export function MenuItemLeaf({ item, className, role, state, handlers, onSelect }: MenuItemLeafProps) {
  const label = resolveRuntimeTextReference(item.label, state, 'shell.header.menu.item.label')

  if (item.href !== undefined) {
    const resolvedHref = resolveRuntimeTextReference(item.href, state, 'shell.header.menu.item.href')

    return (
      <a
        href={resolvedHref}
        role={role}
        className={className}
        onClick={onSelect}
        onKeyDown={onSelect ? (event: KeyboardEvent<HTMLAnchorElement>) => {
          if (event.key === ' ') {
            event.preventDefault()
            onSelect()
          }
        } : undefined}
      >
        <IconNode name={item.icon} className="size-4 shrink-0" />
        {label}
      </a>
    )
  }

  const handleActionSelect = () => {
    onSelect?.()
    if (item.action) {
      executeRuntimeUiAction(item.action, handlers)
    }
  }

  return (
    <button
      type="button"
      role={role}
      className={className}
      onClick={handleActionSelect}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        // A native <button> already turns Enter/Space into a `click` in real browsers; this
        // explicit handling only exists so keyboard selection is deterministic under jsdom
        // (which does not synthesize that click). `preventDefault` suppresses the browser's own
        // synthetic click so a real browser does not fire `handleActionSelect` twice.
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleActionSelect()
        }
      }}
    >
      <IconNode name={item.icon} className="size-4 shrink-0" />
      {label}
    </button>
  )
}
