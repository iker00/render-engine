import type {
  ContainerLayoutNode,
  HeadingLayoutNode,
  RuntimeApiBodyValue,
  RuntimeApiConfig,
  RuntimeApiMethod,
  RuntimeApiOperation,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeType,
  ListLayoutNode,
  ParagraphLayoutNode,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeConfigValidationResult,
  RuntimePageConfig,
} from './runtime-config-types'

const supportedNodeTypes: LayoutNodeType[] = ['container', 'heading', 'paragraph', 'list']
const supportedApiMethods: RuntimeApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export function validateRuntimeConfig(rawConfig: unknown): RuntimeConfigValidationResult {
  if (!isRecord(rawConfig)) {
    return invalidLayout('The runtime config must be an object.')
  }

  if (!isRecord(rawConfig.api)) {
    return invalidLayout('The runtime config field "api" must be an object.')
  }

  const apiResult = validateApiConfig(rawConfig.api)

  if (apiResult.status === 'error') {
    return apiResult
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

    const layoutResult = validateLayoutCollection(page.layout, 'layout', page.id)

    if (layoutResult.status === 'error') {
      return layoutResult
    }

    const preloadResult = validatePagePreloads(page.preloads, index)

    if (preloadResult.status === 'error') {
      return preloadResult
    }

    const validatedPage: RuntimePageConfig = {
      id: page.id,
      layout: layoutResult.nodes,
    }

    if (preloadResult.preloads !== undefined) {
      validatedPage.preloads = preloadResult.preloads
    }

    pages.push(validatedPage)
  }

  const config: RuntimeConfig = {
    api: apiResult.api,
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

function validatePagePreloads(
  rawPreloads: unknown,
  pageIndex: number,
):
  | { status: 'ready'; preloads: string[] | undefined }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawPreloads === undefined) {
    return {
      status: 'ready',
      preloads: undefined,
    }
  }

  if (!Array.isArray(rawPreloads)) {
    return invalidLayout(`The page at "pages[${pageIndex}].preloads" must be an array of non-empty strings.`)
  }

  const preloads: string[] = []

  for (let preloadIndex = 0; preloadIndex < rawPreloads.length; preloadIndex += 1) {
    const preloadName = rawPreloads[preloadIndex]

    if (typeof preloadName !== 'string' || preloadName.trim().length === 0) {
      return invalidLayout(`The page at "pages[${pageIndex}].preloads[${preloadIndex}]" must be a non-empty string.`)
    }

    preloads.push(preloadName)
  }

  return {
    status: 'ready',
    preloads,
  }
}

function validateApiConfig(
  rawApiConfig: Record<string, unknown>,
): { status: 'ready'; api: RuntimeApiConfig } | { status: 'error'; error: RuntimeConfigError } {
  const api: RuntimeApiConfig = {}

  for (const [operationName, rawOperation] of Object.entries(rawApiConfig)) {
    if (!isRecord(rawOperation)) {
      return invalidLayout(`The api operation "${operationName}" must be an object.`)
    }

    const operationResult = validateApiOperation(operationName, rawOperation)

    if (operationResult.status === 'error') {
      return operationResult
    }

    api[operationName] = operationResult.operation
  }

  return {
    status: 'ready',
    api,
  }
}

function validateApiOperation(
  operationName: string,
  rawOperation: Record<string, unknown>,
): { status: 'ready'; operation: RuntimeApiOperation } | { status: 'error'; error: RuntimeConfigError } {
  if (!supportedApiMethods.includes(rawOperation.method as RuntimeApiMethod)) {
    return invalidLayout(`The api operation "${operationName}" uses unsupported method "${String(rawOperation.method)}".`)
  }

  if (typeof rawOperation.endpoint !== 'string' || rawOperation.endpoint.trim().length === 0) {
    return invalidLayout(`The api operation "${operationName}" must declare a non-empty endpoint.`)
  }

  const method = rawOperation.method as RuntimeApiMethod
  const queryResult = validateApiQuery(operationName, rawOperation.query)

  if (queryResult.status === 'error') {
    return queryResult
  }

  const bodyResult = validateApiBody(operationName, method, rawOperation.body)

  if (bodyResult.status === 'error') {
    return bodyResult
  }

  const operation: RuntimeApiOperation = {
    method,
    endpoint: rawOperation.endpoint,
  }

  if (queryResult.query !== undefined) {
    operation.query = queryResult.query
  }

  if (bodyResult.hasBody) {
    operation.body = bodyResult.body
  }

  return {
    status: 'ready',
    operation,
  }
}

function validateApiQuery(
  operationName: string,
  rawQuery: unknown,
):
  | { status: 'ready'; query: RuntimeApiOperation['query'] }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawQuery === undefined) {
    return {
      status: 'ready',
      query: undefined,
    }
  }

  if (!isRecord(rawQuery)) {
    return invalidLayout(`The api operation "${operationName}.query" must be an object with non-empty keys.`)
  }

  const query: NonNullable<RuntimeApiOperation['query']> = {}

  for (const [key, value] of Object.entries(rawQuery)) {
    if (key.length === 0) {
      return invalidLayout(`The api operation "${operationName}.query" contains an empty key.`)
    }

    if (!isRuntimeApiQueryValue(value)) {
      return invalidLayout(
        `The api operation "${operationName}.query.${key}" must resolve to a string, number, or boolean.`,
      )
    }

    query[key] = value
  }

  return {
    status: 'ready',
    query,
  }
}

function validateApiBody(
  operationName: string,
  method: RuntimeApiMethod,
  rawBody: unknown,
):
  | { status: 'ready'; hasBody: boolean; body?: RuntimeApiBodyValue }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawBody === undefined) {
    return {
      status: 'ready',
      hasBody: false,
    }
  }

  if (method === 'GET') {
    return invalidLayout(`The api operation "${operationName}" uses method "${method}" but declares an unsupported body.`)
  }

  const bodyValidation = isRuntimeApiBodyValue(rawBody, `${operationName}.body`)

  if (bodyValidation !== true) {
    return invalidLayout(`The api operation "${bodyValidation}" must be valid JSON data.`)
  }

  return {
    status: 'ready',
    hasBody: true,
    body: rawBody as RuntimeApiBodyValue,
  }
}

function validateLayoutCollection(
  rawNodes: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; nodes: LayoutNodeCollection } | { status: 'error'; error: RuntimeConfigError } {
  if (!Array.isArray(rawNodes)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const nodes: LayoutNode[] = []

  for (let index = 0; index < rawNodes.length; index += 1) {
    const nodeResult = validateLayoutNode(rawNodes[index], `${path}[${index}]`, pageId)

    if (nodeResult.status === 'error') {
      return nodeResult
    }

    nodes.push(nodeResult.node)
  }

  return {
    status: 'ready',
    nodes,
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

  return invalidLayout(`Page "${pageId}" uses an invalid layout node at "${path}".`)
}

function validateContainerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ContainerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const props = getOptionalRecord(rawNode.props)

  if (rawNode.props !== undefined && !props) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  if (props) {
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

  const childrenResult = validateLayoutCollection(rawNode.children, `${path}.children`, pageId)

  if (childrenResult.status === 'error') {
    return childrenResult
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
      children: childrenResult.nodes,
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
  return isPlainObject(value)
}

function getOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isRuntimeApiQueryValue(value: unknown): value is RuntimeApiOperation['query'][string] {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isRuntimeApiBodyValue(value: unknown, path: string): true | string {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const childValidation = isRuntimeApiBodyValue(value[index], `${path}[${index}]`)

      if (childValidation !== true) {
        return childValidation
      }
    }

    return true
  }

  if (!isPlainObject(value)) {
    return path
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key.length === 0) {
      return `${path}.${key}`
    }

    const childValidation = isRuntimeApiBodyValue(childValue, `${path}.${key}`)

    if (childValidation !== true) {
      return childValidation
    }
  }

  return true
}
