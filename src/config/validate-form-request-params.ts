import type { LayoutNodeCollection, RuntimeConfigError } from './runtime-config-types'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'

export function validateExecutionRequestParams(
  config: import('./runtime-config-types').RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of config.pages) {
    const error = validateExecutionRequestParamsInCollection(page.layout, 'layout', page.id, config.api, [])

    if (error) {
      return error
    }
  }

  return null
}

function validateExecutionRequestParamsInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  api: import('./runtime-config-types').RuntimeApiConfig,
  breadcrumb: BreadcrumbSegment[],
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...breadcrumb, nodeSegment]

    if (node.type === 'button' && node.props.action?.type === 'executeOperation') {
      const operation = api[node.props.action.operationName]

      if (operation?.method === 'GET' && node.props.action.body !== undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.body": GET operations do not support body.`, nodeBreadcrumb, node)
      }
    }

    if (node.type === 'button' && node.props.action?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.props.action.operations.length; entryIndex += 1) {
        const entry = node.props.action.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
        }
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperation') {
      const operation = api[node.submitAction.operationName]

      if (operation?.method === 'GET' && node.submitAction.body !== undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.body": GET operations do not support body.`, nodeBreadcrumb, node)
      }
    }

    if (node.type === 'form' && node.submitAction?.type === 'executeOperations') {
      for (let entryIndex = 0; entryIndex < node.submitAction.operations.length; entryIndex += 1) {
        const entry = node.submitAction.operations[entryIndex]
        const operation = api[entry.operationName]

        if (operation?.method === 'GET' && entry.body !== undefined) {
          return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
        }
      }
    }

    if (node.type === 'form' && node.onSuccess) {
      for (let actionIndex = 0; actionIndex < node.onSuccess.length; actionIndex += 1) {
        const action = node.onSuccess[actionIndex]
        const actionPath = `${nodePath}.submitAction.onSuccess[${actionIndex}]`

        if (action.type === 'executeOperation') {
          const operation = api[action.operationName]

          if (operation?.method === 'GET' && action.body !== undefined) {
            return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`, nodeBreadcrumb, node)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
            }
          }
        }
      }
    }

    if (node.type === 'form' && node.onError) {
      for (let actionIndex = 0; actionIndex < node.onError.length; actionIndex += 1) {
        const action = node.onError[actionIndex]
        const actionPath = `${nodePath}.submitAction.onError[${actionIndex}]`

        if (action.type === 'executeOperation') {
          const operation = api[action.operationName]

          if (operation?.method === 'GET' && action.body !== undefined) {
            return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.body": GET operations do not support body.`, nodeBreadcrumb, node)
          }
        }

        if (action.type === 'executeOperations') {
          for (let entryIndex = 0; entryIndex < action.operations.length; entryIndex += 1) {
            const entry = action.operations[entryIndex]
            const operation = api[entry.operationName]

            if (operation?.method === 'GET' && entry.body !== undefined) {
              return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${actionPath}.operations[${entryIndex}].body": GET operations do not support body.`, nodeBreadcrumb, node)
            }
          }
        }
      }
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
      const childError = validateExecutionRequestParamsInCollection(node.children, `${nodePath}.children`, pageId, api, nodeBreadcrumb)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'repeater') {
      const childError = validateExecutionRequestParamsInCollection(node.props.template, `${nodePath}.props.template`, pageId, api, nodeBreadcrumb)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]

        if (item.children && item.children.length > 0) {
          const childError = validateExecutionRequestParamsInCollection(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            api,
            nodeBreadcrumb,
          )

          if (childError) {
            return childError
          }
        }
      }
    }
  }

  return null
}
