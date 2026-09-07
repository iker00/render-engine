import type {
  LayoutNode,
  LayoutNodeCollection,
  RuntimeConfigError,
  RuntimeGroupInstanceNode,
  RuntimeGroupsConfig,
  RuntimePageConfig,
} from './runtime-config-types'
import { runtimeGroupsConfigSchema } from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { validateLayoutCollection } from './validate-layout-nodes'
import { isRecord, formatPathSegment } from './validate-node-shared-helpers'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'

// Cross-validations for `groups` that Zod cannot resolve on its own. The shape of the `groups`
// block itself (groupId keys, `params` as a string array, `template` as an array) is already
// guaranteed by `runtimeGroupsConfigSchema` (T06). This module resolves each group's `template`
// into fully validated `LayoutNode[]`, reusing the recursive layout validator with
// `insideGroupTemplate: true` (T07) so nested `slot`/`group` restrictions are enforced end to end,
// rejects templates declaring more than one `slot`, and cross-checks every `group` instance found
// anywhere in `pages[].layout` against the resolved `groups` block: unknown `groupId`, `params`
// mismatch, and `children` on a group whose template does not declare a `slot`.
export type ValidateGroupsConfigResult =
  | { status: 'error'; error: RuntimeConfigError }
  | { status: 'ready'; groups: RuntimeGroupsConfig | undefined }

export function validateGroupsConfig(
  rawConfig: unknown,
  pages: readonly RuntimePageConfig[],
): ValidateGroupsConfigResult {
  const rawGroups = isRecord(rawConfig) ? rawConfig.groups : undefined
  let groups: RuntimeGroupsConfig | undefined

  if (rawGroups !== undefined) {
    const shapeResult = runtimeGroupsConfigSchema.safeParse(rawGroups)

    if (!shapeResult.success) {
      const issue = shapeResult.error.issues[0]
      const issuePath = issue ? issue.path.map(formatPathSegment).join('') : ''
      return invalidLayout(`The runtime config has an invalid layout at "groups${issuePath}".`)
    }

    const resolvedGroups: RuntimeGroupsConfig = {}

    for (const [groupId, rawEntry] of Object.entries(shapeResult.data)) {
      const templateResult = validateLayoutCollection(
        rawEntry.template,
        `groups.${groupId}.template`,
        groupId,
        [],
        { insideGroupTemplate: true },
      )

      if (templateResult.status === 'error') {
        return templateResult
      }

      const slotCount = countSlotsInCollection(templateResult.nodes)

      if (slotCount > 1) {
        return invalidLayout(
          `The runtime config has an invalid layout at "groups.${groupId}.template": a group template must declare at most one "slot" node (found ${slotCount}).`,
        )
      }

      resolvedGroups[groupId] = {
        params: rawEntry.params,
        template: templateResult.nodes,
      }
    }

    groups = resolvedGroups
  }

  const instanceError = validateGroupInstances(pages, groups ?? {})

  if (instanceError) {
    return instanceError
  }

  return { status: 'ready', groups }
}

function validateGroupInstances(
  pages: readonly RuntimePageConfig[],
  groups: RuntimeGroupsConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of pages) {
    const error = checkGroupInstancesInCollection(page.layout, 'layout', page.id, groups, [])
    if (error) return error
  }

  return null
}

function checkGroupInstancesInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  groups: RuntimeGroupsConfig,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeBreadcrumb = [...breadcrumb, buildBreadcrumbSegmentFromNode(node, index)]

    if (node.type === 'group') {
      const instanceError = checkGroupInstance(node, nodePath, pageId, groups, nodeBreadcrumb)
      if (instanceError) return instanceError
    }

    for (const nested of getNestedLayoutCollections(node, nodePath)) {
      const nestedError = checkGroupInstancesInCollection(nested.nodes, nested.path, pageId, groups, nodeBreadcrumb)
      if (nestedError) return nestedError
    }
  }

  return null
}

function checkGroupInstance(
  node: RuntimeGroupInstanceNode,
  nodePath: string,
  pageId: string,
  groups: RuntimeGroupsConfig,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  // `''` is the dev canvas's deliberate "not yet selected" draft state (T15, feature
  // reusable-node-groups — see `groupInstanceNodeSchema`'s own comment): a freshly palette-
  // inserted `group` instance always starts this way, before the user picks a real group from
  // the properties panel. Skipping id/params cross-checks here (instead of erroring "unknown
  // group id \"\"") is what lets that placeholder commit successfully; `GroupLayoutNode` already
  // renders nothing for it at runtime.
  if (node.props.groupId === '') {
    return null
  }

  const groupDefinition = groups[node.props.groupId]

  if (!groupDefinition) {
    return enrichedInvalidLayoutFromNode(
      `Page "${pageId}" has an invalid layout at "${nodePath}.props.groupId": unknown group id "${node.props.groupId}".`,
      breadcrumb,
      node,
    )
  }

  const declaredParams = new Set(groupDefinition.params)
  const providedParams = Object.keys(node.props.params)

  for (const declaredParam of declaredParams) {
    if (!providedParams.includes(declaredParam)) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}.props.params": missing param "${declaredParam}" required by group "${node.props.groupId}".`,
        breadcrumb,
        node,
      )
    }
  }

  for (const providedParam of providedParams) {
    if (!declaredParams.has(providedParam)) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}.props.params": unexpected param "${providedParam}" not declared by group "${node.props.groupId}".`,
        breadcrumb,
        node,
      )
    }
  }

  if (node.children && node.children.length > 0 && countSlotsInCollection(groupDefinition.template) === 0) {
    return enrichedInvalidLayoutFromNode(
      `Page "${pageId}" has an invalid layout at "${nodePath}.children": group "${node.props.groupId}" template does not declare a "slot", so it cannot receive children.`,
      breadcrumb,
      node,
    )
  }

  return null
}

function getNestedLayoutCollections(
  node: LayoutNode,
  nodePath: string,
): Array<{ path: string; nodes: LayoutNodeCollection }> {
  switch (node.type) {
    case 'container':
    case 'form':
    case 'modal':
    case 'accordion':
    case 'link':
    case 'group':
      return node.children ? [{ path: `${nodePath}.children`, nodes: node.children }] : []
    case 'repeater':
      return [{ path: `${nodePath}.props.template`, nodes: node.props.template }]
    case 'tabs':
    case 'steps':
      return node.props.items.reduce<Array<{ path: string; nodes: LayoutNodeCollection }>>((collections, item, index) => {
        if (item.children) {
          collections.push({ path: `${nodePath}.props.items[${index}].children`, nodes: item.children })
        }
        return collections
      }, [])
    default:
      return []
  }
}

// Exported for reuse by the dev canvas's drop-validity engine (T15,
// `src/dev-runtime/layout-canvas/layout-drop-validity.ts`): dropping into a `group` instance's
// `children` is only a valid target when the referenced group's `template` declares a `slot`,
// the same "at least one slot" fact this function already computes for `checkGroupInstance`
// below. Not a new rule of its own — just the existing recursive slot count made available
// outside this module instead of duplicated.
export function countSlotsInCollection(nodes: LayoutNodeCollection): number {
  return nodes.reduce((total, node) => total + countSlotsInNode(node), 0)
}

function countSlotsInNode(node: LayoutNode): number {
  if (node.type === 'slot') {
    return 1
  }

  return getNestedLayoutCollections(node, '').reduce((total, nested) => total + countSlotsInCollection(nested.nodes), 0)
}
