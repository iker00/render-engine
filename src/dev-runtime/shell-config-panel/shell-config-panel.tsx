import { useState } from 'react'
import type { RuntimeConfigError } from '../../config/runtime-config'
import type {
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
import { getShellHeaderJsonSchema } from './shell-config-panel-schema'
import { ShellMenuListEditor } from './shell-menu-list-editor'
import { SidebarItemListEditor } from './sidebar-item-list-editor'

export interface ShellConfigPanelProps {
  shell: ShellConfig | undefined
  onCommitShellMutation: (mutate: (shell: ShellConfig | undefined) => ShellConfig | undefined) => CommitCanvasMutationResult
}

type ShellPendingKey = 'logo' | 'title'
type ShellPendingRejections = Partial<Record<ShellPendingKey, { value: unknown; error: RuntimeConfigError }>>

const EMPTY_HEADER: ShellHeaderConfig = {}

/**
 * "Shell" section of the visual editor (0122-T5): toggles the header on/off, edits `logo`/
 * `title` through the same generic schema-driven widgets the canvas properties panel uses, and
 * mounts the dedicated `menu`/`actions` list editors. Every commit here goes through
 * `onCommitShellMutation` — the same "mutate, validate, patch only this root key onto the raw
 * Monaco buffer" pipeline `commitCanvasMutation` already uses for `layout` (see
 * `patchRootKey`/`layout-canvas-commit.ts`), so a Shell edit never touches `layout`/`api`/
 * `initialPage`/`preloads`/`tokens`/`translations`.
 */
export function ShellConfigPanel({ shell, onCommitShellMutation }: ShellConfigPanelProps) {
  const header = shell?.header
  const headerActive = header !== undefined
  const sidebar = shell?.sidebar
  const sidebarActive = sidebar !== undefined
  const [pendingRejections, setPendingRejections] = useState<ShellPendingRejections>({})

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

  const shellHeaderSchema = getShellHeaderJsonSchema()
  const schemaProperties = isPlainObject(shellHeaderSchema.properties) ? shellHeaderSchema.properties : {}
  const logoSchema = isPlainObject(schemaProperties.logo) ? (schemaProperties.logo as Record<string, unknown>) : undefined

  const logoPending = pendingRejections.logo
  const titlePending = pendingRejections.title
  const displayedLogo = logoPending ? logoPending.value : (header?.logo ?? {})
  const displayedTitle = titlePending ? (titlePending.value as string) : (header?.title ?? '')

  return (
    <div data-testid="shell-config-panel" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
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

          <ShellMenuListEditor menu={header.menu ?? []} onCommitMenu={commitMenu} />
          <ShellActionsListEditor actions={header.actions ?? []} onCommitActions={commitActions} />
        </>
      )}

      <BooleanPropertyField
        label="Sidebar activo"
        value={sidebarActive}
        onChange={(nextActive) => commitShellSectionToggle('sidebar', nextActive)}
      />

      {sidebarActive && sidebar !== undefined && (
        <SidebarItemListEditor items={sidebar.items ?? []} path="root" onCommitItems={commitSidebarItems} />
      )}
    </div>
  )
}
