import type {
  FileInputLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  RuntimeConfigError,
} from './runtime-config-types'
import { invalidLayout } from './runtime-config-validation-errors'

export function validateFileInputSemantics(
  config: { pages: Array<{ id: string; layout: LayoutNodeCollection }> },
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of config.pages) {
    const error = validateFileInputNodesInCollection(page.layout, 'layout', page.id)

    if (error) {
      return error
    }
  }

  return null
}

function validateFileInputNodesInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`

    if (node.type === 'fileInput') {
      const error = validateFileInputCaptureAccept(node, nodePath, pageId)

      if (error) {
        return error
      }

      continue
    }

    const childError = visitNodeChildren(node, nodePath, pageId)

    if (childError) {
      return childError
    }
  }

  return null
}

function visitNodeChildren(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (
    (node.type === 'container' || node.type === 'form' || node.type === 'modal' || node.type === 'accordion') &&
    node.children
  ) {
    return validateFileInputNodesInCollection(node.children, `${nodePath}.children`, pageId)
  }

  if (node.type === 'repeater') {
    return validateFileInputNodesInCollection(node.props.template, `${nodePath}.props.template`, pageId)
  }

  if (node.type === 'tabs') {
    for (let itemIndex = 0; itemIndex < node.props.items.length; itemIndex += 1) {
      const item = node.props.items[itemIndex]

      if (item.children && item.children.length > 0) {
        const itemError = validateFileInputNodesInCollection(
          item.children,
          `${nodePath}.props.items[${itemIndex}].children`,
          pageId,
        )

        if (itemError) {
          return itemError
        }
      }
    }
  }

  if (node.queryStateFeedback?.states) {
    for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
      if (!rule || rule.mode !== 'fallback') {
        continue
      }

      const fallbackError = validateFileInputNodesInCollection(
        [...rule.fallback],
        `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
        pageId,
      )

      if (fallbackError) {
        return fallbackError
      }
    }
  }

  return null
}

function validateFileInputCaptureAccept(
  node: FileInputLayoutNode,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (!node.props.capture) {
    return null
  }

  const acceptValues = node.props.validations?.accept?.value

  if (
    !acceptValues ||
    !acceptValues.some((mime) => mime.startsWith('image/') || mime.startsWith('video/'))
  ) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.capture": capture requires at least one image/* or video/* MIME type in validations.accept.`,
    )
  }

  return null
}
