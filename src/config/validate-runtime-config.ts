import type {
  ButtonAction,
  ButtonLayoutNode,
  ContainerLayoutNode,
  GoBackButtonAction,
  HeadingLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeType,
  ListLayoutNode,
  NavigateToButtonAction,
  ParagraphLayoutNode,
  RuntimeApiBodyValue,
  RuntimeApiConfig,
  RuntimeApiMethod,
  RuntimeApiOperation,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeConfigValidationResult,
  RuntimePageConfig,
} from './runtime-config-types'
import {
  buttonNodeSchema,
  containerNodeSchema,
  goBackButtonActionSchema,
  headingNodeSchema,
  listNodeSchema,
  navigateToButtonActionSchema,
  paragraphNodeSchema,
  runtimeApiOperationShellSchema,
  runtimeApiQuerySchema,
  runtimeConfigShellSchema,
  runtimePageShellSchema,
  supportedNodeTypes,
} from './runtime-config-zod'
import { initialPageNotFound, invalidLayout, unsupportedNodeType } from './runtime-config-validation-errors'

export function validateRuntimeConfig(rawConfig: unknown): RuntimeConfigValidationResult {
  const configShellResult = runtimeConfigShellSchema.safeParse(rawConfig)

  if (!configShellResult.success) {
    const issue = configShellResult.error.issues[0]

    if (!issue || issue.path.length === 0) {
      return invalidLayout('The runtime config must be an object.')
    }

    if (issue.path[0] === 'api') {
      return invalidLayout('The runtime config field "api" must be an object.')
    }

    if (issue.path[0] === 'pages') {
      return invalidLayout('The runtime config field "pages" must be an array.')
    }

    if (issue.path[0] === 'initialPage') {
      return invalidLayout('The runtime config field "initialPage" must be a non-empty string.')
    }

    return invalidLayout('The runtime config must be an object.')
  }

  const apiResult = validateApiConfig(configShellResult.data.api)

  if (apiResult.status === 'error') {
    return apiResult
  }

  const pageShellResults: RuntimePageConfig[] = []

  for (let index = 0; index < configShellResult.data.pages.length; index += 1) {
    const pageShellResult = runtimePageShellSchema.safeParse(configShellResult.data.pages[index])

    if (!pageShellResult.success) {
      const issue = pageShellResult.error.issues[0]
      const pagePath = issue?.path[0]

      if (pagePath === 'id') {
        return invalidLayout(`The page at "pages[${index}].id" must be a non-empty string.`)
      }

      if (pagePath === 'preloads' && issue.path.length === 1) {
        return invalidLayout(`The page at "pages[${index}].preloads" must be an array of non-empty strings.`)
      }

      if (pagePath === 'preloads' && typeof issue.path[1] === 'number') {
        return invalidLayout(`The page at "pages[${index}].preloads[${issue.path[1]}]" must be a non-empty string.`)
      }

      if (pagePath === 'layout') {
        const rawPage = configShellResult.data.pages[index]
        const pageId = isRecord(rawPage) && typeof rawPage.id === 'string' ? rawPage.id : `pages[${index}]`
        return invalidLayout(`Page "${pageId}" has an invalid layout at "layout".`)
      }

      return invalidLayout(`The page at "pages[${index}]" must be an object.`)
    }

    pageShellResults.push({
      id: pageShellResult.data.id,
      preloads: pageShellResult.data.preloads,
      layout: pageShellResult.data.layout as LayoutNodeCollection,
    })
  }

  const pages: RuntimePageConfig[] = []

  for (let index = 0; index < pageShellResults.length; index += 1) {
    const pageShell = pageShellResults[index]
    const layoutResult = validateLayoutCollection(pageShell.layout, 'layout', pageShell.id)

    if (layoutResult.status === 'error') {
      return layoutResult
    }

    const pageConfig: RuntimePageConfig = {
      id: pageShell.id,
      layout: layoutResult.nodes,
    }

    if (pageShell.preloads !== undefined) {
      pageConfig.preloads = pageShell.preloads
    }

    pages.push(pageConfig)
  }

  const config: RuntimeConfig = {
    api: apiResult.api,
    pages,
    initialPage: configShellResult.data.initialPage,
  }

  const page = config.pages.find((entry) => entry.id === config.initialPage)

  if (!page) {
    return initialPageNotFound(config.initialPage)
  }

  const navigationTargetError = validateNavigationTargets(config.pages)

  if (navigationTargetError) {
    return navigationTargetError
  }

  return {
    status: 'ready',
    config,
    page,
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
  const shellResult = runtimeApiOperationShellSchema.safeParse(rawOperation)

  if (!shellResult.success) {
    const issue = shellResult.error.issues[0]
    const path = issue?.path[0]

    if (path === 'method') {
      return invalidLayout(`The api operation "${operationName}" uses unsupported method "${String(rawOperation.method)}".`)
    }

    if (path === 'endpoint') {
      return invalidLayout(`The api operation "${operationName}" must declare a non-empty endpoint.`)
    }

    if (path === 'query') {
      return mapApiQueryIssue(operationName, rawOperation.query, issue.path)
    }

    if (path === 'body') {
      return mapApiBodyIssue(operationName, rawOperation.body, issue.path)
    }

    return invalidLayout(`The api operation "${operationName}" must be an object.`)
  }

  if (shellResult.data.query !== undefined) {
    const queryIssue = validateApiQueryKeys(operationName, shellResult.data.query)

    if (queryIssue) {
      return queryIssue
    }
  }

  if (shellResult.data.body !== undefined && shellResult.data.method === 'GET') {
    return invalidLayout(`The api operation "${operationName}" uses method "GET" but declares an unsupported body.`)
  }

  const operation: RuntimeApiOperation = {
    method: shellResult.data.method as RuntimeApiMethod,
    endpoint: shellResult.data.endpoint,
  }

  if (shellResult.data.query !== undefined) {
    operation.query = shellResult.data.query as RuntimeApiOperation['query']
  }

  if (shellResult.data.body !== undefined) {
    operation.body = shellResult.data.body as RuntimeApiBodyValue
  }

  return {
    status: 'ready',
    operation,
  }
}

function mapApiQueryIssue(
  operationName: string,
  rawQuery: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawQuery)) {
    return invalidLayout(`The api operation "${operationName}.query" must be an object with non-empty keys.`)
  }

  if (typeof path[1] === 'string') {
    return invalidLayout(
      `The api operation "${operationName}.query.${path[1]}" must resolve to a string, number, or boolean.`,
    )
  }

  return invalidLayout(`The api operation "${operationName}.query" must be an object with non-empty keys.`)
}

function validateApiQueryKeys(
  operationName: string,
  query: RuntimeApiOperation['query'],
): { status: 'error'; error: RuntimeConfigError } | null {
  if (query === undefined) {
    return null
  }

  const queryResult = runtimeApiQuerySchema.safeParse(query)

  if (!queryResult.success) {
    return mapApiQueryIssue(operationName, query, queryResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(query)) {
    if (key.length === 0) {
      return invalidLayout(`The api operation "${operationName}.query" contains an empty key.`)
    }
  }

  return null
}

function mapApiBodyIssue(
  operationName: string,
  rawBody: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const bodyPath = findInvalidJsonBodyPath(rawBody, `${operationName}.body`)

  if (bodyPath) {
    return invalidLayout(`The api operation "${bodyPath}" must be valid JSON data.`)
  }

  const formattedPath = path.slice(1).map(formatPathSegment).join('')
  return invalidLayout(`The api operation "${operationName}.body${formattedPath}" must be valid JSON data.`)
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
    return unsupportedNodeType(pageId, path, rawNode.type)
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
    case 'button':
      return validateButtonNode(rawNode, path, pageId)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
}

function validateContainerNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ContainerLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = containerNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path[0]

    if (issuePath === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath === 'props' && issue.path.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'direction') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.direction".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'gap') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.gap".`)
    }

    if (issuePath === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  let children: LayoutNodeCollection | undefined

  if (parseResult.data.children !== undefined) {
    const childrenResult = validateLayoutCollection(parseResult.data.children, `${path}.children`, pageId)

    if (childrenResult.status === 'error') {
      return childrenResult
    }

    children = childrenResult.nodes
  }

  return {
    status: 'ready',
    node: {
      type: 'container',
      id: parseResult.data.id,
      props: parseResult.data.props,
      children,
    },
  }
}

function validateHeadingNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: HeadingLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = headingNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  return {
    status: 'ready',
    node: parseResult.data,
  }
}

function validateParagraphNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ParagraphLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = paragraphNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  return {
    status: 'ready',
    node: parseResult.data,
  }
}

function validateListNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ListLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = listNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  return {
    status: 'ready',
    node: parseResult.data,
  }
}

function mapLeafNodeIssue(
  pageId: string,
  path: string,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (issuePath[0] === 'id') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
  }

  if (issuePath[0] === 'props' && issuePath.length === 1) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`)
}

function validateButtonNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ButtonLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = buttonNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'label') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.label".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'action') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.action".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
  }

  const actionResult = validateButtonAction(parseResult.data.props.action, `${path}.props.action`, pageId)

  if (actionResult.status === 'error') {
    return actionResult
  }

  return {
    status: 'ready',
    node: {
      type: 'button',
      id: parseResult.data.id,
      props: {
        label: parseResult.data.props.label,
        action: actionResult.action,
      },
    },
  }
}

function validateButtonAction(
  rawAction: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; action: ButtonAction } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawAction)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (rawAction.type !== 'navigateTo' && rawAction.type !== 'goBack') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  if (rawAction.type === 'goBack') {
    const parseResult = goBackButtonActionSchema.safeParse(rawAction)

    if (!parseResult.success) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
    }

    const action: GoBackButtonAction = parseResult.data

    return {
      status: 'ready',
      action,
    }
  }

  const parseResult = navigateToButtonActionSchema.safeParse(rawAction)

  if (!parseResult.success) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.pageId".`)
  }

  const action: NavigateToButtonAction = parseResult.data

  return {
    status: 'ready',
    action,
  }
}

function validateNavigationTargets(
  pages: RuntimePageConfig[],
): { status: 'error'; error: RuntimeConfigError } | null {
  const pageIds = new Set(pages.map((page) => page.id))

  for (const page of pages) {
    const invalidTarget = findInvalidNavigationTarget(page.layout, 'layout', pageIds)

    if (invalidTarget) {
      return invalidLayout(
        `Page "${page.id}" has an invalid layout at "${invalidTarget.path}.pageId": unknown page "${invalidTarget.pageId}".`,
      )
    }
  }

  return null
}

function findInvalidNavigationTarget(
  nodes: LayoutNodeCollection,
  path: string,
  pageIds: ReadonlySet<string>,
): { path: string; pageId: string } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`

    if (node.type === 'button' && node.props.action.type === 'navigateTo' && !pageIds.has(node.props.action.pageId)) {
      return {
        path: `${nodePath}.props.action`,
        pageId: node.props.action.pageId,
      }
    }

    if (node.type === 'container' && node.children) {
      const childResult = findInvalidNavigationTarget(node.children, `${nodePath}.children`, pageIds)

      if (childResult) {
        return childResult
      }
    }
  }

  return null
}

function formatPathSegment(segment: PropertyKey): string {
  if (typeof segment === 'number') {
    return `[${segment}]`
  }

  return `.${String(segment)}`
}

function findInvalidJsonBodyPath(value: unknown, path: string): string | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalidChildPath = findInvalidJsonBodyPath(value[index], `${path}[${index}]`)

      if (invalidChildPath) {
        return invalidChildPath
      }
    }

    return null
  }

  if (!isRecord(value)) {
    return path
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key.length === 0) {
      return `${path}.${key}`
    }

    const invalidChildPath = findInvalidJsonBodyPath(childValue, `${path}.${key}`)

    if (invalidChildPath) {
      return invalidChildPath
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
