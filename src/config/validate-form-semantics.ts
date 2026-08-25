import type { FormOnErrorAction, LayoutNode, LayoutNodeCollection, RuntimeConfigError } from './runtime-config-types'
import { buttonRequiresFormAncestor, FORM_ALLOWED_DESCENDANT_TYPES, FORM_ONLY_LEAF_NODE_TYPES } from './layout-placement-rules'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'
import { invalidLayout } from './runtime-config-validation-errors'

interface FormValidationContext {
  inForm: boolean
  pageId: string
  formIds: Set<string>
  currentFormId: string | null
  fieldIds: Set<string> | null
  operationNames: ReadonlySet<string>
  pageIds: ReadonlySet<string>
  modalIds: ReadonlySet<string>
  breadcrumb: BreadcrumbSegment[]
}

export function validateFormSemantics(
  config: import('./runtime-config-types').RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const formIds = new Set<string>()
  const operationNames = new Set(Object.keys(config.api))
  const pageIds = new Set(config.pages.map((page) => page.id))
  const modalIds = collectModalIds(config.pages.flatMap((page) => page.layout))

  for (const page of config.pages) {
    const error = validateFormNodesInCollection(page.layout, 'layout', page.id, {
      inForm: false,
      pageId: page.id,
      formIds,
      currentFormId: null,
      fieldIds: null,
      operationNames,
      pageIds,
      modalIds,
      breadcrumb: [],
    })

    if (error) {
      return error
    }
  }

  return null
}

function collectModalIds(nodes: LayoutNodeCollection): ReadonlySet<string> {
  const ids = new Set<string>()

  for (const node of nodes) {
    if (node.type === 'modal' && node.id) {
      ids.add(node.id)
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
      for (const id of collectModalIds(node.children)) {
        ids.add(id)
      }
    }

    if (node.type === 'repeater') {
      for (const id of collectModalIds(node.props.template)) {
        ids.add(id)
      }
    }
  }

  return ids
}

// Structural narrowing companion for FORM_ONLY_LEAF_NODE_TYPES: TypeScript does not
// narrow a discriminated union via ReadonlySet#has, so this type guard reuses the
// shared set for the runtime check while still giving downstream code a narrowed
// `node.props.fieldId` access.
function isFormOnlyLeafNode(node: LayoutNode): node is Extract<LayoutNode, { props: { fieldId: string } }> {
  return FORM_ONLY_LEAF_NODE_TYPES.has(node.type)
}

function validateFormNodesInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  context: FormValidationContext,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...context.breadcrumb, nodeSegment]
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormNodesInCollection(fallbackNodes, fallbackPath, pageId, { ...context, breadcrumb: nodeBreadcrumb }),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'form') {
      if (context.formIds.has(node.id)) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.id": duplicate form id "${node.id}".`, nodeBreadcrumb, node)
      }

      context.formIds.add(node.id)

      if (node.resetOnSuccess === true && node.submitAction === undefined) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}.resetOnSuccess": resetOnSuccess requires submitAction.`, nodeBreadcrumb, node)
      }

      if (node.submitAction?.type === 'executeOperation' && !context.operationNames.has(node.submitAction.operationName)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operationName": unknown operation "${node.submitAction.operationName}".`,
          nodeBreadcrumb,
          node,
        )
      }

      if (node.onSuccess) {
        const onSuccessError = validateOnSuccessActionTargets(
          node.onSuccess,
          `${nodePath}.submitAction.onSuccess`,
          pageId,
          context.pageIds,
          context.operationNames,
          context.modalIds,
        )

        if (onSuccessError) {
          return onSuccessError
        }
      }

      if (node.onError) {
        const onErrorError = validateOnErrorActionTargets(
          node.onError,
          `${nodePath}.submitAction.onError`,
          pageId,
          context.pageIds,
          context.operationNames,
          context.modalIds,
        )

        if (onErrorError) {
          return onErrorError
        }
      }

      const childrenError = validateFormChildren(node.children ?? [], `${nodePath}.children`, pageId, {
        ...context,
        inForm: true,
        currentFormId: node.id,
        fieldIds: new Set<string>(),
        breadcrumb: nodeBreadcrumb,
      })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'modal' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'repeater') {
      const templateError = validateFormNodesInCollection(node.props.template, `${nodePath}.props.template`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (templateError) {
        return templateError
      }

      continue
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]
        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormNodesInCollection(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (node.type === 'steps') {
      if (!context.inForm) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}": steps nodes must be descendants of a form node.`, nodeBreadcrumb, node)
      }

      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]
        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormNodesInCollection(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (isFormOnlyLeafNode(node)) {
      if (!context.inForm || !context.currentFormId || !context.fieldIds) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`, nodeBreadcrumb, node)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
          nodeBreadcrumb,
          node,
        )
      }

      context.fieldIds.add(node.props.fieldId)

      continue
    }

    if (node.type === 'button' && buttonRequiresFormAncestor(node) && !context.inForm) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": button nodes without an action must be descendants of a form node.`,
        nodeBreadcrumb,
        node,
      )
    }
  }

  return null
}

function validateFormChildren(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  context: FormValidationContext,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const nodeSegment = buildBreadcrumbSegmentFromNode(node, index)
    const nodeBreadcrumb = [...context.breadcrumb, nodeSegment]
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormChildren(fallbackNodes, fallbackPath, pageId, { ...context, breadcrumb: nodeBreadcrumb }),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'fileManager') {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": "fileManager" is not allowed inside a form.`,
        nodeBreadcrumb,
        node,
      )
    }

    if (!FORM_ALLOWED_DESCENDANT_TYPES.has(node.type)) {
      return enrichedInvalidLayoutFromNode(
        `Page "${pageId}" has an invalid layout at "${nodePath}": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph, image, table, container, accordion, divider, tabs and steps descendants.`,
        nodeBreadcrumb,
        node,
      )
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'accordion' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, { ...context, breadcrumb: nodeBreadcrumb })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'tabs') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]

        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormChildren(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (node.type === 'steps') {
      for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
        const item = node.props.items[itemIndex]

        if (item.children && item.children.length > 0) {
          const itemChildrenError = validateFormChildren(
            item.children,
            `${nodePath}.props.items[${itemIndex}].children`,
            pageId,
            { ...context, breadcrumb: nodeBreadcrumb },
          )

          if (itemChildrenError) {
            return itemChildrenError
          }
        }
      }

      continue
    }

    if (isFormOnlyLeafNode(node)) {
      if (!context.currentFormId || !context.fieldIds) {
        return enrichedInvalidLayoutFromNode(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`, nodeBreadcrumb, node)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return enrichedInvalidLayoutFromNode(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
          nodeBreadcrumb,
          node,
        )
      }

      context.fieldIds.add(node.props.fieldId)
    }
  }

  return null
}

function validateOnSuccessActionTargets(
  actions: import('./runtime-config-types').FormOnSuccessAction[],
  basePath: string,
  pageId: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
  modalIds: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    const actionPath = `${basePath}[${index}]`

    if (action.type === 'navigateTo' && !pageIds.has(action.pageId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.pageId": unknown page "${action.pageId}".`,
      )
    }

    if (action.type === 'executeOperation' && !operationNames.has(action.operationName)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.operationName": unknown operation "${action.operationName}".`,
      )
    }

    if (action.type === 'openModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }

    if (action.type === 'closeModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }
  }

  return null
}

function validateOnErrorActionTargets(
  actions: FormOnErrorAction[],
  basePath: string,
  pageId: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
  modalIds: ReadonlySet<string>,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]
    const actionPath = `${basePath}[${index}]`

    if (action.type === 'navigateTo' && !pageIds.has(action.pageId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.pageId": unknown page "${action.pageId}".`,
      )
    }

    if (action.type === 'executeOperation' && !operationNames.has(action.operationName)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.operationName": unknown operation "${action.operationName}".`,
      )
    }

    if (action.type === 'openModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }

    if (action.type === 'closeModal' && !modalIds.has(action.modalId)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": unknown modal "${action.modalId}".`,
      )
    }
  }

  return null
}

function validateFallbackCollections<TError>(
  node: LayoutNode,
  nodePath: string,
  validateCollection: (nodes: LayoutNodeCollection, path: string) => TError | null,
) {
  if (!node.queryStateFeedback) {
    return null
  }

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states ?? {})) {
    if (!rule || rule.mode !== 'fallback') {
      continue
    }

    const fallbackPath = `${nodePath}.queryStateFeedback.states.${stateName}.fallback`
    const error = validateCollection([...rule.fallback], fallbackPath)

    if (error) {
      return error
    }
  }

  return null
}
