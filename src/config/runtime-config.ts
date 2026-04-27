export type LayoutNodeType = 'container' | 'heading' | 'paragraph' | 'list'

export interface ContainerLayoutNode {
  type: 'container'
  id?: string
  props?: {
    direction?: string
    gap?: string
  }
  children?: LayoutNode[]
}

export interface HeadingLayoutNode {
  type: 'heading'
  id?: string
  props: {
    text: string
    level: number
  }
  children?: unknown
}

export interface ParagraphLayoutNode {
  type: 'paragraph'
  id?: string
  props: {
    text: string
  }
  children?: unknown
}

export interface ListLayoutNode {
  type: 'list'
  id?: string
  props: {
    items: string[]
  }
  children?: unknown
}

export type LayoutNode =
  | ContainerLayoutNode
  | HeadingLayoutNode
  | ParagraphLayoutNode
  | ListLayoutNode

export interface RuntimePageConfig {
  id: string
  layout: LayoutNode
}

export interface RuntimeConfig {
  api: Record<string, unknown>
  pages: RuntimePageConfig[]
  initialPage: string
}

export interface RuntimeConfigError {
  code:
    | 'invalid-json'
    | 'missing-config'
    | 'initial-page-not-found'
    | 'invalid-layout'
    | 'unsupported-node-type'
  displayMode: 'always' | 'development-only'
  message: string
}

export type RuntimeConfigValidationResult =
  | {
      status: 'ready'
      config: RuntimeConfig
      page: RuntimePageConfig
    }
  | {
      status: 'error'
      error: RuntimeConfigError
    }

const supportedNodeTypes: LayoutNodeType[] = ['container', 'heading', 'paragraph', 'list']

export function validateRuntimeConfig(rawConfig: unknown): RuntimeConfigValidationResult {
  if (!isRecord(rawConfig)) {
    return invalidLayout('The runtime config must be an object.')
  }

  if (!isRecord(rawConfig.api)) {
    return invalidLayout('The runtime config field "api" must be an object.')
  }

  if (!Array.isArray(rawConfig.pages)) {
    return invalidLayout('The runtime config field "pages" must be an array.')
  }

  if (typeof rawConfig.initialPage !== 'string' || rawConfig.initialPage.length === 0) {
    return invalidLayout('The runtime config field "initialPage" must be a non-empty string.')
  }

  const pages: RuntimePageConfig[] = []

  for (let index = 0; index < rawConfig.pages.length; index += 1) {
    const page = rawConfig.pages[index]

    if (!isRecord(page)) {
      return invalidLayout(`The page at "pages[${index}]" must be an object.`)
    }

    if (typeof page.id !== 'string' || page.id.length === 0) {
      return invalidLayout(`The page at "pages[${index}].id" must be a non-empty string.`)
    }

    const layoutResult = validateLayoutNode(page.layout, 'layout', page.id)

    if (layoutResult.status === 'error') {
      return layoutResult
    }

    pages.push({
      id: page.id,
      layout: layoutResult.node,
    })
  }

  const config: RuntimeConfig = {
    api: rawConfig.api,
    pages,
    initialPage: rawConfig.initialPage,
  }

  const page = config.pages.find((entry) => entry.id === config.initialPage)

  if (!page) {
    return {
      status: 'error',
      error: {
        code: 'initial-page-not-found',
        displayMode: 'always',
        message: `The initialPage "${config.initialPage}" does not match any page id.`,
      },
    }
  }

  return {
    status: 'ready',
    config,
    page,
  }
}

function validateLayoutNode(
  rawNode: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; node: LayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (typeof rawNode.type !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  if (!supportedNodeTypes.includes(rawNode.type as LayoutNodeType)) {
    return {
      status: 'error',
      error: {
        code: 'unsupported-node-type',
        displayMode: 'development-only',
        message: `Page "${pageId}" uses unsupported layout node type "${rawNode.type}" at "${path}".`,
      },
    }
  }

  if ('id' in rawNode && rawNode.id !== undefined && typeof rawNode.id !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
  }

  if ('props' in rawNode && rawNode.props !== undefined && !isRecord(rawNode.props)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  switch (rawNode.type) {
    case 'container':
      return validateContainerNode(rawNode, path, pageId)
    case 'heading':
      return validateHeadingNode(rawNode, path, pageId)
    case 'paragraph':
      return validateParagraphNode(rawNode, path, pageId)
    case 'list':
      return validateListNode(rawNode, path, pageId)
  }
}

function validateContainerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ContainerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const props = rawNode.props

  if (props !== undefined) {
    if ('direction' in props && props.direction !== undefined && typeof props.direction !== 'string') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.direction".`)
    }

    if ('gap' in props && props.gap !== undefined && typeof props.gap !== 'string') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.gap".`)
    }
  }

  if (rawNode.children === undefined) {
    return {
      status: 'ready',
      node: {
        type: 'container',
        id: typeof rawNode.id === 'string' ? rawNode.id : undefined,
        props: props
          ? {
              direction: typeof props.direction === 'string' ? props.direction : undefined,
              gap: typeof props.gap === 'string' ? props.gap : undefined,
            }
          : undefined,
      },
    }
  }

  if (!Array.isArray(rawNode.children)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
  }

  const children: LayoutNode[] = []

  for (let index = 0; index < rawNode.children.length; index += 1) {
    const childResult = validateLayoutNode(rawNode.children[index], `${path}.children[${index}]`, pageId)

    if (childResult.status === 'error') {
      return childResult
    }

    children.push(childResult.node)
  }

  return {
    status: 'ready',
    node: {
      type: 'container',
      id: typeof rawNode.id === 'string' ? rawNode.id : undefined,
      props: props
        ? {
            direction: typeof props.direction === 'string' ? props.direction : undefined,
            gap: typeof props.gap === 'string' ? props.gap : undefined,
          }
        : undefined,
      children,
    },
  }
}

function validateHeadingNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: HeadingLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode.props)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  if (typeof rawNode.props.text !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.text".`)
  }

  if (typeof rawNode.props.level !== 'number' || !Number.isInteger(rawNode.props.level)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.level".`)
  }

  return {
    status: 'ready',
    node: {
      type: 'heading',
      id: typeof rawNode.id === 'string' ? rawNode.id : undefined,
      props: {
        text: rawNode.props.text,
        level: rawNode.props.level,
      },
      children: rawNode.children,
    },
  }
}

function validateParagraphNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ParagraphLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode.props)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  if (typeof rawNode.props.text !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.text".`)
  }

  return {
    status: 'ready',
    node: {
      type: 'paragraph',
      id: typeof rawNode.id === 'string' ? rawNode.id : undefined,
      props: {
        text: rawNode.props.text,
      },
      children: rawNode.children,
    },
  }
}

function validateListNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ListLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawNode.props)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  if (!Array.isArray(rawNode.props.items) || rawNode.props.items.some((item) => typeof item !== 'string')) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items".`)
  }

  return {
    status: 'ready',
    node: {
      type: 'list',
      id: typeof rawNode.id === 'string' ? rawNode.id : undefined,
      props: {
        items: rawNode.props.items,
      },
      children: rawNode.children,
    },
  }
}

function invalidLayout(message: string): { status: 'error'; error: RuntimeConfigError } {
  return {
    status: 'error',
    error: {
      code: 'invalid-layout',
      displayMode: 'development-only',
      message,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
