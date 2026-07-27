import type {
  FileManagerLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  RuntimeApiConfig,
  RuntimeConfigError,
} from './runtime-config-types'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'

export function validateFileManagerSemantics(
  config: { api: RuntimeApiConfig; pages: Array<{ id: string; layout: LayoutNodeCollection }> },
): { status: 'error'; error: RuntimeConfigError } | null {
  const apiOperationNames = new Set(Object.keys(config.api))
  const apiOperationMethods: Record<string, string> = {}

  for (const [name, operation] of Object.entries(config.api)) {
    apiOperationMethods[name] = operation.method
  }

  for (const page of config.pages) {
    const error = validateFileManagerNodesInCollection(
      page.layout,
      'layout',
      page.id,
      apiOperationNames,
      apiOperationMethods,
      [],
    )

    if (error) {
      return error
    }
  }

  return null
}

function validateFileManagerNodesInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  apiOperationNames: ReadonlySet<string>,
  apiOperationMethods: Record<string, string>,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...breadcrumb, nodeSegment]

    if (node.type === 'fileManager') {
      const error = validateFileManagerNodeCrossChecks(
        node,
        nodePath,
        pageId,
        apiOperationNames,
        apiOperationMethods,
        nodeBreadcrumb,
      )

      if (error) {
        return error
      }

      continue
    }

    const childrenError = visitNodeChildren(node, nodePath, pageId, apiOperationNames, apiOperationMethods, nodeBreadcrumb)

    if (childrenError) {
      return childrenError
    }
  }

  return null
}

function visitNodeChildren(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  apiOperationNames: ReadonlySet<string>,
  apiOperationMethods: Record<string, string>,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (
    (node.type === 'container' || node.type === 'form' || node.type === 'modal') &&
    node.children
  ) {
    return validateFileManagerNodesInCollection(
      node.children,
      `${nodePath}.children`,
      pageId,
      apiOperationNames,
      apiOperationMethods,
      breadcrumb,
    )
  }

  if (node.type === 'repeater') {
    return validateFileManagerNodesInCollection(
      node.props.template,
      `${nodePath}.props.template`,
      pageId,
      apiOperationNames,
      apiOperationMethods,
      breadcrumb,
    )
  }

  if (node.type === 'tabs') {
    for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
      const item = node.props.items[itemIndex]

      if (item.children && item.children.length > 0) {
        const itemError = validateFileManagerNodesInCollection(
          item.children,
          `${nodePath}.props.items[${itemIndex}].children`,
          pageId,
          apiOperationNames,
          apiOperationMethods,
          breadcrumb,
        )

        if (itemError) {
          return itemError
        }
      }
    }
  }

  if (node.type === 'accordion' && node.children) {
    return validateFileManagerNodesInCollection(
      node.children,
      `${nodePath}.children`,
      pageId,
      apiOperationNames,
      apiOperationMethods,
      breadcrumb,
    )
  }

  // Also visit queryStateFeedback fallback nodes
  if (node.queryStateFeedback?.states) {
    for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
      if (!rule || rule.mode !== 'fallback') {
        continue
      }

      const fallbackError = validateFileManagerNodesInCollection(
        [...rule.fallback],
        `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
        pageId,
        apiOperationNames,
        apiOperationMethods,
        breadcrumb,
      )

      if (fallbackError) {
        return fallbackError
      }
    }
  }

  return null
}

function validateFileManagerNodeCrossChecks(
  node: FileManagerLayoutNode,
  path: string,
  pageId: string,
  apiOperationNames: ReadonlySet<string>,
  apiOperationMethods: Record<string, string>,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const props = node.props
  const operationKeys = [
    'getOperation',
    'uploadOperation',
    'deleteOperation',
    'viewOperation',
    'downloadOperation',
  ] as const

  // Rule 1: at least one operation must be enabled
  // Reject if ALL operations are explicitly false (explicitly disabled with no legacy fallback)
  // OR if ALL operations are absent AND no fieldName (no legacy mode possible)
  const allExplicitlyFalse = operationKeys.every((key) => props[key] === false)
  const allAbsentAndNoFieldName =
    operationKeys.every((key) => props[key] === undefined) && !props.fieldName

  if (allExplicitlyFalse || allAbsentAndNoFieldName) {
    return enrichedInvalidLayoutFromNode(
      `Page "${pageId}" has an invalid layout at "${path}.props": at least one operation must be enabled.`,
      breadcrumb,
      node,
    )
  }

  // Rule 2: fieldName required when any operation is omitted (not false and not string)
  // i.e. when legacy mode is active (operation=undefined), fieldName must be declared
  const hasOmittedOperation = operationKeys.some((key) => props[key] === undefined)

  if (hasOmittedOperation && !props.fieldName) {
    return enrichedInvalidLayoutFromNode(
      `Page "${pageId}" has an invalid layout at "${path}.props.fieldName": fieldName is required when an operation is omitted.`,
      breadcrumb,
      node,
    )
  }

  // Rule 3: each string operation must exist in config.api
  for (const key of operationKeys) {
    const val = props[key]

    if (typeof val === 'string') {
      if (!apiOperationNames.has(val)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${path}.props.${key}": operation "${val}" is not declared in api.`,
          breadcrumb,
          node,
        )
      }
    }
  }

  // Rule 4: viewOperation / downloadOperation must be GET
  const viewDownloadKeys = ['viewOperation', 'downloadOperation'] as const

  for (const key of viewDownloadKeys) {
    const val = props[key]

    if (typeof val === 'string') {
      const method = apiOperationMethods[val]

      if (method && method !== 'GET') {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${path}.props.${key}": operation "${val}" must use method "GET" for view/download links.`,
          breadcrumb,
          node,
        )
      }
    }
  }

  // Rule 5: validations.validFileNames must be valid regexes
  if (props.validations?.validFileNames?.value) {
    const patterns = props.validations.validFileNames.value

    for (let i = 0; i < patterns.length; i += 1) {
      try {
        new RegExp(patterns[i])
      } catch {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${path}.props.validations.validFileNames[${i}]": invalid regex.`,
          breadcrumb,
          node,
        )
      }
    }
  }

  // Rule 6: numeric validation values must be >= 0
  const numericValidationKeys = ['maxFileSize', 'maxTotalSize', 'minFiles', 'maxFiles'] as const

  for (const key of numericValidationKeys) {
    const rule = props.validations?.[key]

    if (rule !== undefined && rule.value < 0) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${path}.props.validations.${key}": value must be >= 0.`,
        breadcrumb,
        node,
      )
    }
  }

  // Rule 7: maxFiles >= minFiles
  const maxFiles = props.validations?.maxFiles?.value
  const minFiles = props.validations?.minFiles?.value

  if (maxFiles !== undefined && minFiles !== undefined && maxFiles < minFiles) {
    return enrichedInvalidLayoutFromNode(
      `Page "${pageId}" has an invalid layout at "${path}.props.validations.maxFiles": maxFiles must be greater than or equal to minFiles.`,
      breadcrumb,
      node,
    )
  }

  return null
}
