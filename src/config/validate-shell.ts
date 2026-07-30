import type {
  MenuItemChildConfig,
  RuntimeConfigError,
  RuntimeVisibilityCondition,
  RuntimeVisibilityConfig,
  RuntimeVisibilityOperator,
  ShellConfig,
  ShellHeaderActionNode,
  SidebarItemConfig,
} from './runtime-config-types'
import { isVisibilityGroup } from './runtime-config-types'
import { shellSchema } from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { isRecord, formatPathSegment } from './validate-node-shared-helpers'

// Cross-validations for `shell` that Zod cannot resolve on its own (0122-T2). The shape itself
// (menuItem mutual exclusivity, link/button restriction on actions, ...) is already guaranteed by
// the `shellSchema` from 0122-T1; this module only checks references against the surfaces
// computed elsewhere in the config: `pages` (for pageId) and `api` (for operationName).
//
// Messages intentionally use their own "Shell configuration is invalid at ..." prefix instead of
// the "Page \"{pageId}\" has an invalid layout at ..." format used by the rest of this folder,
// because shell nodes are not scoped to any single page.
//
// The reference/operator parsing for `visibility` below duplicates part of the logic in
// `validate-actions-visibility.ts` (`validateSingleVisibilityCondition` / `isValidVisibilityReference`)
// on purpose: shell surfaces exclude `item.*` and shell messages use a different prefix. Refactoring
// those functions to be parametrized by context is deliberately deferred until a third consumer
// (e.g. `sidebar`) appears — see design decision 4.

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const paramsReferencePattern = /^params\.[A-Za-z0-9_-]+$/
const visibilityComparisonOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals', 'greaterThan', 'lessThan', 'arrayContains'])
const visibilityScalarOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals'])
const visibilityTruthinessOperators = new Set<RuntimeVisibilityOperator>(['isTruthy', 'isFalsy'])

// Result carries the parsed, validated `shell` block back to the caller (0122-T4): unlike the
// other `validate*` modules in this folder, `shell` is not assembled field-by-field into the
// final `RuntimeConfig` elsewhere, so this is the only place the Zod-parsed value is available.
// Without surfacing it here, `validate-runtime-config.ts` would validate `shell` but never attach
// it to the `RuntimeConfig` it returns, leaving every runtime consumer unable to read it.
export type ValidateShellConfigResult =
  | { status: 'error'; error: RuntimeConfigError }
  | { status: 'ok'; shell: ShellConfig | undefined }

export function validateShellConfig(
  config: unknown,
  pageIds: readonly string[],
  apiOperationNames: readonly string[],
): ValidateShellConfigResult {
  if (!isRecord(config) || config.shell === undefined) {
    return { status: 'ok', shell: undefined }
  }

  const parseResult = shellSchema.safeParse(config.shell)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path.map(formatPathSegment).join('') ?? ''
    return invalidLayout(`Shell configuration is invalid at "shell${issuePath}".`)
  }

  const shell = parseResult.data as ShellConfig
  const crossRefError = validateShellCrossReferences(shell, pageIds, apiOperationNames)

  if (crossRefError) {
    return crossRefError
  }

  return { status: 'ok', shell }
}

function validateShellCrossReferences(
  shell: ShellConfig,
  pageIds: readonly string[],
  apiOperationNames: readonly string[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const header = shell.header

  const pageIdSet = new Set(pageIds)
  const operationNameSet = new Set(apiOperationNames)

  if (header !== undefined) {
    if (header.menu) {
      for (let i = 0; i < header.menu.length; i += 1) {
        const item = header.menu[i]
        const basePath = `shell.header.menu[${i}]`

        const itemError = validateMenuItemCrossRefs(item, basePath, pageIdSet, operationNameSet)
        if (itemError) return itemError

        if (item.children) {
          for (let j = 0; j < item.children.length; j += 1) {
            const childError = validateMenuItemCrossRefs(
              item.children[j],
              `${basePath}.children[${j}]`,
              pageIdSet,
              operationNameSet,
            )
            if (childError) return childError
          }
        }
      }
    }

    if (header.actions) {
      for (let i = 0; i < header.actions.length; i += 1) {
        const actionError = validateShellHeaderAction(header.actions[i], i, pageIdSet, operationNameSet)
        if (actionError) return actionError
      }
    }
  }

  if (shell.sidebar?.items) {
    for (let i = 0; i < shell.sidebar.items.length; i += 1) {
      const itemError = validateSidebarItemCrossRefs(
        shell.sidebar.items[i],
        `shell.sidebar.items[${i}]`,
        pageIdSet,
        operationNameSet,
      )
      if (itemError) return itemError
    }
  }

  return null
}

function validateSidebarItemCrossRefs(
  item: SidebarItemConfig,
  path: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (item.action?.type === 'navigateTo' && !pageIds.has(item.action.pageId)) {
    return invalidLayout(
      `Shell configuration is invalid at "${path}.action.pageId": pageId "${item.action.pageId}" is not declared in "pages".`,
    )
  }

  if (item.visibility !== undefined) {
    const visibilityError = validateShellVisibility(item.visibility, `${path}.visibility`, operationNames)
    if (visibilityError) return visibilityError
  }

  if (item.children) {
    for (let i = 0; i < item.children.length; i += 1) {
      const childError = validateSidebarItemCrossRefs(item.children[i], `${path}.children[${i}]`, pageIds, operationNames)
      if (childError) return childError
    }
  }

  return null
}

function validateMenuItemCrossRefs(
  item: MenuItemChildConfig,
  basePath: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (item.action?.type === 'navigateTo' && !pageIds.has(item.action.pageId)) {
    return invalidLayout(
      `Shell configuration is invalid at "${basePath}.action.pageId": pageId "${item.action.pageId}" is not declared in "pages".`,
    )
  }

  if (item.visibility !== undefined) {
    return validateShellVisibility(item.visibility, `${basePath}.visibility`, operationNames)
  }

  return null
}

function validateShellHeaderAction(
  action: ShellHeaderActionNode,
  index: number,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  const basePath = `shell.header.actions[${index}]`
  const nodeAction = action.props.action

  if (nodeAction?.type === 'navigateTo' && !pageIds.has(nodeAction.pageId)) {
    return invalidLayout(
      `Shell configuration is invalid at "${basePath}.props.action.pageId": pageId "${nodeAction.pageId}" is not declared in "pages".`,
    )
  }

  if (nodeAction?.type === 'executeOperation' && !operationNames.has(nodeAction.operationName)) {
    return invalidLayout(
      `Shell configuration is invalid at "${basePath}.props.action.operationName": operation "${nodeAction.operationName}" is not declared in "api".`,
    )
  }

  if (nodeAction?.type === 'executeOperations') {
    for (let i = 0; i < nodeAction.operations.length; i += 1) {
      const { operationName } = nodeAction.operations[i]

      if (!operationNames.has(operationName)) {
        return invalidLayout(
          `Shell configuration is invalid at "${basePath}.props.action.operations[${i}].operationName": operation "${operationName}" is not declared in "api".`,
        )
      }
    }
  }

  if (action.visibility !== undefined) {
    return validateShellVisibility(action.visibility, `${basePath}.visibility`, operationNames)
  }

  return null
}

function validateShellVisibility(
  visibility: RuntimeVisibilityConfig,
  visibilityPath: string,
  operationNames: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (isVisibilityGroup(visibility)) {
    for (let i = 0; i < visibility.conditions.length; i += 1) {
      const error = validateShellVisibilityCondition(
        visibility.conditions[i],
        visibilityPath,
        `${visibilityPath}.conditions[${i}]`,
        operationNames,
      )
      if (error) return error
    }

    return null
  }

  return validateShellVisibilityCondition(visibility, visibilityPath, visibilityPath, operationNames)
}

function validateShellVisibilityCondition(
  condition: RuntimeVisibilityCondition,
  visibilityPath: string,
  conditionPath: string,
  operationNames: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  const { reference } = condition

  if (reference === 'item' || reference.startsWith('item.')) {
    return invalidLayout(`Shell configuration is invalid at "${visibilityPath}": Shell menu items do not support item.* references.`)
  }

  const referenceCheck = checkShellVisibilityReference(reference, operationNames)

  if (!referenceCheck.valid) {
    if (referenceCheck.reason === 'unknown-operation') {
      return invalidLayout(
        `Shell configuration is invalid at "${conditionPath}.reference": operation "${referenceCheck.operationName}" is not declared in "api".`,
      )
    }

    return invalidLayout(
      `Shell configuration is invalid at "${conditionPath}.reference": visibility references must use params.{paramName}, forms.{formId}.{fieldId} or queries.{queryName}(.data|.status|.error).`,
    )
  }

  // `operator` is already restricted to the supported enum by `shellSchema` (0122-T1); no need to
  // re-validate its value here, unlike `reference`/`value`/`itemField`, which Zod leaves loose.
  const { operator } = condition

  const hasItemField = Object.prototype.hasOwnProperty.call(condition, 'itemField')

  if (hasItemField && operator !== 'arrayContains') {
    return invalidLayout(
      `Shell configuration is invalid at "${conditionPath}.itemField": itemField is only valid when operator is "arrayContains".`,
    )
  }

  const hasValue = Object.prototype.hasOwnProperty.call(condition, 'value')

  if (visibilityTruthinessOperators.has(operator) && hasValue) {
    return invalidLayout(`Shell configuration is invalid at "${conditionPath}.value": operator "${operator}" does not accept value.`)
  }

  if (visibilityComparisonOperators.has(operator) && !hasValue) {
    return invalidLayout(`Shell configuration is invalid at "${conditionPath}.value": operator "${operator}" requires value.`)
  }

  if (!hasValue) {
    return null
  }

  // `itemField`'s own type (string) is already enforced by `shellSchema` (0122-T1), so unlike
  // `validateSingleVisibilityCondition` in validate-actions-visibility.ts (which parses genuinely
  // unknown raw input), there is no further type check to duplicate here.
  if (visibilityScalarOperators.has(operator) || operator === 'arrayContains') {
    if (!isRuntimeConfigValue(condition.value)) {
      return invalidLayout(
        `Shell configuration is invalid at "${conditionPath}.value": operator "${operator}" only accepts string, number, boolean or null.`,
      )
    }

    return null
  }

  if (typeof condition.value !== 'number') {
    return invalidLayout(
      `Shell configuration is invalid at "${conditionPath}.value": operator "${operator}" only accepts numeric thresholds.`,
    )
  }

  return null
}

type ShellVisibilityReferenceCheck =
  | { valid: true }
  | { valid: false; reason: 'invalid' }
  | { valid: false; reason: 'unknown-operation'; operationName: string }

function checkShellVisibilityReference(reference: string, operationNames: ReadonlySet<string>): ShellVisibilityReferenceCheck {
  if (paramsReferencePattern.test(reference)) {
    return { valid: true }
  }

  const segments = reference.split('.')

  if (segments[0] === 'forms') {
    if (segments.length === 3 && segments.slice(1).every((segment) => collectionPathSegmentPattern.test(segment))) {
      return { valid: true }
    }

    return { valid: false, reason: 'invalid' }
  }

  if (segments[0] !== 'queries' || segments.length < 2 || !collectionPathSegmentPattern.test(segments[1])) {
    return { valid: false, reason: 'invalid' }
  }

  if (!operationNames.has(segments[1])) {
    return { valid: false, reason: 'unknown-operation', operationName: segments[1] }
  }

  if (segments.length === 2) {
    return { valid: true }
  }

  if (segments[2] === 'status') {
    return segments.length === 3 ? { valid: true } : { valid: false, reason: 'invalid' }
  }

  if (segments[2] === 'error') {
    if (segments.length === 3) {
      return { valid: true }
    }

    if (segments.length === 4 && (segments[3] === 'message' || segments[3] === 'code')) {
      return { valid: true }
    }

    return { valid: false, reason: 'invalid' }
  }

  if (segments[2] !== 'data') {
    return { valid: false, reason: 'invalid' }
  }

  if (segments.length === 3 || segments.slice(3).every((segment) => collectionPathSegmentPattern.test(segment))) {
    return { valid: true }
  }

  return { valid: false, reason: 'invalid' }
}

function isRuntimeConfigValue(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}
