import type { RuntimeConfig, RuntimeGroupsConfig } from '../../config/runtime-config-types'
import type { CommitResult } from '../layout-canvas/layout-canvas-commit'

/**
 * Structural mutations over `config.groups` (T14 / feature reusable-node-groups): every CRUD
 * operation `GroupsConfigPanel` performs on the `groups` block itself — group id lifecycle and
 * its declared `params` — as a closed, serializable description. Editing a group's `template`
 * contents (the node tree) goes through the target-generalized `commitLayoutMutation` (T13)
 * instead, with `{ kind: 'group-template', groupId }` — never through this type.
 */
export type GroupsMutation =
  | { kind: 'add-group'; groupId: string }
  | { kind: 'rename-group'; from: string; to: string }
  | { kind: 'remove-group'; groupId: string }
  | { kind: 'add-param'; groupId: string; paramName: string }
  | { kind: 'remove-param'; groupId: string; paramName: string }

export function normalizeGroupId(rawId: string): string {
  return rawId.trim()
}

export function isDuplicateGroupId(normalizedId: string, groups: RuntimeGroupsConfig): boolean {
  if (normalizedId === '') return false
  return normalizedId in groups
}

/**
 * Pure transform of a `GroupsMutation` over a `RuntimeGroupsConfig` — never touches any other
 * root key of the config. Renaming carries the whole group object (`params` + `template`) over
 * unchanged under the new id. Every variant degrades to a no-op (returns `groups` unchanged)
 * against an unknown `groupId`/`from`, or a duplicate `add-param`, rather than throwing — the
 * panel only ever invokes this for a `groupId` already known to exist in the same `config.groups`
 * it renders.
 */
export function applyGroupsMutation(groups: RuntimeGroupsConfig, mutation: GroupsMutation): RuntimeGroupsConfig {
  switch (mutation.kind) {
    case 'add-group': {
      return { ...groups, [mutation.groupId]: { params: [], template: [] } }
    }

    case 'rename-group': {
      const existing = groups[mutation.from]
      if (existing === undefined) return groups
      const { [mutation.from]: _removed, ...rest } = groups
      return { ...rest, [mutation.to]: existing }
    }

    case 'remove-group': {
      const { [mutation.groupId]: _removed, ...rest } = groups
      return rest
    }

    case 'add-param': {
      const group = groups[mutation.groupId]
      if (!group || group.params.includes(mutation.paramName)) return groups
      return { ...groups, [mutation.groupId]: { ...group, params: [...group.params, mutation.paramName] } }
    }

    case 'remove-param': {
      const group = groups[mutation.groupId]
      if (!group) return groups
      return {
        ...groups,
        [mutation.groupId]: { ...group, params: group.params.filter((name) => name !== mutation.paramName) },
      }
    }
  }
}

/**
 * Pure business-rule gate for a `GroupsMutation` against the current `RuntimeConfig` (T14):
 * catches rules a JSON-schema re-validation cannot express on its own, because
 * `RuntimeGroupsConfig` is a plain `Record<string, RuntimeGroupConfig>` — renaming onto an id
 * that already exists would silently overwrite that group instead of failing schema validation.
 * `GroupsConfigPanel` calls this before delegating to the real root-key commit
 * (`onCommitGroupsMutation`, wired in `dev-runtime.tsx` following the same "clave raíz única"
 * pattern already used by Api/Tokens/Traducciones/Páginas), so a rejected rename never reaches
 * the store. Every other mutation variant has no business rule to enforce here — structural
 * validity (e.g. an empty groupId) is gated by the panel's own disabled-button pattern, mirroring
 * `pages-config-panel-rules.ts`/`tokens-config-panel-rules.ts`.
 */
export function commitGroupsMutation(config: RuntimeConfig, mutation: GroupsMutation): CommitResult {
  if (mutation.kind === 'rename-group' && mutation.to !== mutation.from) {
    const groups = config.groups ?? {}
    if (mutation.to in groups) {
      return {
        status: 'rejected',
        error: {
          code: 'invalid-layout',
          displayMode: 'development-only',
          message: `Cannot rename group: id "${mutation.to}" already exists.`,
        },
      }
    }
  }

  return { status: 'applied' }
}
