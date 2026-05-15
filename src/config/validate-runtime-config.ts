import type {
  ButtonLayoutNode,
  CheckboxGroupLayoutNode,
  ContainerLayoutNode,
  ExecuteOperationRuntimeUiAction,
  FormLayoutNode,
  GoBackButtonAction,
  HeadingLayoutNode,
  InputLayoutNode,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
  LayoutNodeType,
  ListLayoutNode,
  NavigateToButtonAction,
  ParagraphLayoutNode,
  QueryStateFeedbackConfig,
  QueryStateFeedbackFallbackRule,
  QueryStateFeedbackRule,
  QueryStateFeedbackVisibleState,
  RadioGroupLayoutNode,
  RepeaterLayoutNode,
  RuntimeVisibilityConfig,
  RuntimeVisibilityOperator,
  RuntimeCollectionObjectItem,
  ResetFormRuntimeUiAction,
  RuntimeApiBodyValue,
  RuntimeApiConfig,
  RuntimeApiHeaders,
  RuntimeApiMethod,
  RuntimeApiOperation,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeUiAction,
  RuntimeFormFieldValidations,
  RuntimeFormValidationRuleName,
  RuntimeNumericValidationRule,
  RuntimeRequiredValidationRule,
  RuntimeConfigValidationResult,
  RuntimePageConfig,
  SelectLayoutNode,
  TextareaLayoutNode,
} from './runtime-config-types'
import {
  buttonNodeSchema,
  containerNodeSchema,
  executeOperationRuntimeUiActionSchema,
  formNodeSchema,
  goBackButtonActionSchema,
  headingNodeSchema,
  inputNodeSchema,
  listNodeSchema,
  navigateToButtonActionSchema,
  paragraphNodeSchema,
  radioGroupNodeSchema,
  repeaterNodeSchema,
  resetFormRuntimeUiActionSchema,
  runtimeApiOperationShellSchema,
  runtimeApiHeadersSchema,
  runtimeApiQuerySchema,
  runtimeConfigShellSchema,
  runtimePageShellSchema,
  selectItemSchema,
  selectNodeSchema,
  supportedNodeTypes,
  textareaNodeSchema,
  checkboxGroupNodeSchema,
} from './runtime-config-zod'
import { initialPageNotFound, invalidLayout, unsupportedNodeType } from './runtime-config-validation-errors'
import { parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const visibilityComparisonOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals', 'greaterThan', 'lessThan'])
const visibilityScalarOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals'])
const visibilityTruthinessOperators = new Set<RuntimeVisibilityOperator>(['isTruthy', 'isFalsy'])
const supportedFormValidationRuleNames = new Set<RuntimeFormValidationRuleName>([
  'required',
  'minLength',
  'maxLength',
  'min',
  'max',
  'minSelections',
  'maxSelections',
])

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

  const actionTargetError = validateActionTargets(config)

  if (actionTargetError) {
    return actionTargetError
  }

  const formSemanticError = validateFormSemantics(config)

  if (formSemanticError) {
    return formSemanticError
  }

  const requestParamsError = validateExecutionRequestParams(config)

  if (requestParamsError) {
    return requestParamsError
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

    if (path === 'headers') {
      return mapApiHeadersIssue(operationName, rawOperation.headers, issue.path)
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

  if (shellResult.data.headers !== undefined) {
    const headersIssue = validateApiHeadersKeys(operationName, shellResult.data.headers)

    if (headersIssue) {
      return headersIssue
    }
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

  if (shellResult.data.headers !== undefined) {
    operation.headers = shellResult.data.headers as RuntimeApiHeaders
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

function mapApiHeadersIssue(
  operationName: string,
  rawHeaders: unknown,
  path: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawHeaders)) {
    return invalidLayout(`The api operation "${operationName}.headers" must be an object with non-empty keys.`)
  }

  if (typeof path[1] === 'string') {
    return invalidLayout(`The api operation "${operationName}.headers.${path[1]}" must resolve to a string.`)
  }

  return invalidLayout(`The api operation "${operationName}.headers" must be an object with non-empty keys.`)
}

function validateApiHeadersKeys(
  operationName: string,
  headers: RuntimeApiHeaders | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (headers === undefined) {
    return null
  }

  const headersResult = runtimeApiHeadersSchema.safeParse(headers)

  if (!headersResult.success) {
    return mapApiHeadersIssue(operationName, headers, headersResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(headers)) {
    if (key.length === 0) {
      return invalidLayout(`The api operation "${operationName}.headers" contains an empty key.`)
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
    case 'repeater':
      return validateRepeaterNode(rawNode, path, pageId)
    case 'heading':
      return validateHeadingNode(rawNode, path, pageId)
    case 'paragraph':
      return validateParagraphNode(rawNode, path, pageId)
    case 'list':
      return validateListNode(rawNode, path, pageId)
    case 'button':
      return validateButtonNode(rawNode, path, pageId)
    case 'form':
      return validateFormNode(rawNode, path, pageId)
    case 'input':
      return validateInputNode(rawNode, path, pageId)
    case 'textarea':
      return validateTextareaNode(rawNode, path, pageId)
    case 'select':
      return validateSelectNode(rawNode, path, pageId)
    case 'radioGroup':
      return validateRadioGroupNode(rawNode, path, pageId)
    case 'checkboxGroup':
      return validateCheckboxGroupNode(rawNode, path, pageId)
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

    if (issuePath === 'props' && issue.path[1] === 'columns') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.columns".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'align') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.align".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'justify') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.justify".`)
    }

    if (issuePath === 'props' && issue.path[1] === 'wrap') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.wrap".`)
    }

    if (issuePath === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const containerProps = parseResult.data.props

  if (containerProps?.columns !== undefined && containerProps.wrap !== undefined) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.wrap": container nodes cannot declare "wrap" when "columns" is present.`,
    )
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
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: containerProps,
      children,
    },
  }
}

function validateRepeaterNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: RepeaterLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = repeaterNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const issuePath = issue?.path ?? []

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'template') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.template".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'source') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.items.source".`)
    }

    if (issuePath[0] === 'props' && issuePath[1] === 'items' && issuePath[2] === 'key') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
      )
    }

    if (issuePath[0] === 'props' && issuePath.length === 1) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const itemsSourceResult = validateCollectionSource(parseResult.data.props.items.source, `${path}.props.items.source`, pageId)

  if (itemsSourceResult.status === 'error') {
    return itemsSourceResult
  }

  if (!isValidRepeaterItemKeyPath(parseResult.data.props.items.key)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.props.items.key": repeater item keys must use a non-empty relative item path.`,
    )
  }

  const templateResult = validateLayoutCollection(parseResult.data.props.template, `${path}.props.template`, pageId)

  if (templateResult.status === 'error') {
    return templateResult
  }

  return {
    status: 'ready',
    node: {
      type: 'repeater',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        items: {
          source: itemsSourceResult.source,
          key: parseResult.data.props.items.key,
        },
        template: templateResult.nodes,
      },
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
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateParagraphNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ParagraphLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = paragraphNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateListNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: ListLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = listNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const itemsResult = validateListItems(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'list',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        items: itemsResult.items,
      },
    },
  }
}

function validateListItems(
  rawItems: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; items: ListLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawItems)) {
    const items: string[] = []

    for (let index = 0; index < rawItems.length; index += 1) {
      if (typeof rawItems[index] !== 'string') {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${index}]".`)
      }

      items.push(rawItems[index])
    }

    return {
      status: 'ready',
      items,
    }
  }

  if (!isRecord(rawItems)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const hasSource = 'source' in rawItems
  const hasValues = 'values' in rawItems

  if (hasSource && hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (hasSource) {
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true })

    if (sourceResult.status === 'error') {
      return sourceResult
    }

    if (rawItems.itemType !== undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemType".`)
    }

    if (rawItems.itemText !== undefined && !isValidCollectionItemPath(rawItems.itemText)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`)
    }

    if (rawItems.itemText !== undefined && rawItems.itemType !== undefined) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    if (rawItems.itemText === undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare itemText.`,
      )
    }

    return {
      status: 'ready',
      items: rawItems.itemText === undefined
        ? { source: sourceResult.source, itemType: 'scalar' }
        : { source: sourceResult.source, itemText: rawItems.itemText },
    }
  }

  if (!hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!Array.isArray(rawItems.values)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values".`)
  }

  const values = rawItems.values

  if (values.every((value) => typeof value === 'string')) {
    return {
      status: 'ready',
      items: {
        values,
      },
    }
  }

  if (values.every((value) => isRecord(value))) {
    if (!isValidCollectionItemPath(rawItems.itemText)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemText".`)
    }

    return {
      status: 'ready',
      items: {
        values: values as RuntimeCollectionObjectItem[],
        itemText: rawItems.itemText,
      },
    }
  }

  const invalidIndex = values.findIndex((value) => typeof value !== 'string' && !isRecord(value))
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values[${Math.max(invalidIndex, 0)}]".`)
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

    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

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

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  let action: RuntimeUiAction | undefined

  if (parseResult.data.props.action !== undefined) {
    const actionResult = validateRuntimeUiAction(parseResult.data.props.action, `${path}.props.action`, pageId)

    if (actionResult.status === 'error') {
      return actionResult
    }

    action = actionResult.action
  }

  return {
    status: 'ready',
    node: {
      type: 'button',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        label: parseResult.data.props.label,
        action,
      },
    },
  }
}

function validateRuntimeUiAction(
  rawAction: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; action: RuntimeUiAction } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawAction)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (
    rawAction.type !== 'navigateTo' &&
    rawAction.type !== 'goBack' &&
    rawAction.type !== 'executeOperation' &&
    rawAction.type !== 'resetForm'
  ) {
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

  if (rawAction.type === 'navigateTo') {
    const parseResult = navigateToButtonActionSchema.safeParse(rawAction)

    if (!parseResult.success) {
      const issuePath = parseResult.error.issues[0]?.path ?? []

      if (issuePath[0] === 'pageId' || issuePath.length === 0) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.pageId".`)
      }

      if (issuePath[0] === 'params') {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.params".`)
      }

      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.${String(issuePath[0])}".`)
    }

    const paramsResult = validateNavigateToParams(parseResult.data.params, `${path}.params`, pageId)

    if (paramsResult.status === 'error') {
      return paramsResult
    }

    const action: NavigateToButtonAction = {
      type: 'navigateTo',
      pageId: parseResult.data.pageId,
    }

    if (paramsResult.params !== undefined) {
      action.params = paramsResult.params
    }

    return {
      status: 'ready',
      action,
    }
  }

  if (rawAction.type === 'executeOperation') {
    const executeOperationParseResult = executeOperationRuntimeUiActionSchema.safeParse(rawAction)

    if (!executeOperationParseResult.success) {
      return mapExecuteOperationActionIssue(pageId, path, rawAction, executeOperationParseResult.error.issues[0]?.path ?? [])
    }

    const action: ExecuteOperationRuntimeUiAction = executeOperationParseResult.data

    const requestParamsIssue = validateRuntimeApiRequestParams(action, path, pageId)

    if (requestParamsIssue) {
      return requestParamsIssue
    }

    return {
      status: 'ready',
      action,
    }
  }

  const resetFormParseResult = resetFormRuntimeUiActionSchema.safeParse(rawAction)

  if (!resetFormParseResult.success) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.formId".`)
  }

  const action: ResetFormRuntimeUiAction = resetFormParseResult.data

  return {
    status: 'ready',
    action,
  }
}

function validateQueryStateFeedback(
  rawQueryStateFeedback: LayoutNodeFeedbackFields['queryStateFeedback'],
  path: string,
  pageId: string,
):
  | { status: 'ready'; queryStateFeedback: QueryStateFeedbackConfig | undefined }
  | { status: 'error'; error: RuntimeConfigError } {
  if (rawQueryStateFeedback === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: undefined,
    }
  }

  if (rawQueryStateFeedback.states === undefined) {
    return {
      status: 'ready',
      queryStateFeedback: rawQueryStateFeedback,
    }
  }

  const normalizedStates: Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>> = {}

  for (const state of Object.keys(rawQueryStateFeedback.states) as QueryStateFeedbackVisibleState[]) {
    const rule = rawQueryStateFeedback.states[state]

    if (rule === undefined) {
      continue
    }

    if (rule.mode !== 'fallback') {
      normalizedStates[state] = rule
      continue
    }

    const fallbackResult = validateLayoutCollection(rule.fallback, `${path}.states.${state}.fallback`, pageId)

    if (fallbackResult.status === 'error') {
      return fallbackResult
    }

    normalizedStates[state] = {
      mode: 'fallback',
      fallback: fallbackResult.nodes,
    } satisfies QueryStateFeedbackFallbackRule
  }

  return {
    status: 'ready',
    queryStateFeedback: {
      query: rawQueryStateFeedback.query,
      states: normalizedStates,
    },
  }
}

function validateNavigateToParams(
  rawParams: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; params: NavigateToButtonAction['params'] } | { status: 'error'; error: RuntimeConfigError } {
  if (rawParams === undefined) {
    return {
      status: 'ready',
      params: undefined,
    }
  }

  if (!isRecord(rawParams) || Array.isArray(rawParams)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": navigateTo params must be a flat object with non-empty keys.`)
  }

  const params: NonNullable<NavigateToButtonAction['params']> = {}

  for (const [key, value] of Object.entries(rawParams)) {
    if (key.length === 0) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": navigateTo params contain an empty key.`)
    }

    if (!isRuntimeConfigValue(value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.${key}": navigateTo params only accept string, number, boolean or null.`)
    }

    if (typeof value === 'string') {
      const parsedReference = parseRuntimeReference(value)

      if (
        parsedReference.kind === 'reference' &&
        parsedReference.namespace === 'params' &&
        parsedReference.status === 'invalid'
      ) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}.${key}": navigateTo params must use params.{paramName} when referencing page params.`,
        )
      }
    }

    params[key] = value
  }

  return {
    status: 'ready',
    params,
  }
}

function validateVisibility(
  rawVisibility: LayoutNodeFeedbackFields['visibility'],
  path: string,
  pageId: string,
): { status: 'ready'; visibility: RuntimeVisibilityConfig | undefined } | { status: 'error'; error: RuntimeConfigError } {
  if (rawVisibility === undefined) {
    return {
      status: 'ready',
      visibility: undefined,
    }
  }

  if (!isValidVisibilityReference(rawVisibility.reference)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.reference": visibility references must use item, item.*, forms.{formId}.{fieldId}, queries.{queryName}, queries.{queryName}.data, queries.{queryName}.data.*, queries.{queryName}.status or queries.{queryName}.error.`,
    )
  }

  const hasValue = Object.prototype.hasOwnProperty.call(rawVisibility, 'value')

  if (visibilityTruthinessOperators.has(rawVisibility.operator) && hasValue) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.value": operator "${rawVisibility.operator}" does not accept value.`,
    )
  }

  if (visibilityComparisonOperators.has(rawVisibility.operator) && !hasValue) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}.value": operator "${rawVisibility.operator}" requires value.`,
    )
  }

  if (!hasValue) {
    return {
      status: 'ready',
      visibility: rawVisibility,
    }
  }

  if (visibilityScalarOperators.has(rawVisibility.operator)) {
    if (!isRuntimeConfigValue(rawVisibility.value)) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.value": operator "${rawVisibility.operator}" only accepts string, number, boolean or null.`,
      )
    }

    return {
      status: 'ready',
      visibility: rawVisibility,
    }
  }

  if (rawVisibility.operator === 'greaterThan' || rawVisibility.operator === 'lessThan') {
    if (typeof rawVisibility.value !== 'number') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}.value": operator "${rawVisibility.operator}" only accepts numeric thresholds.`,
      )
    }

    return {
      status: 'ready',
      visibility: rawVisibility,
    }
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.operator".`)
}

function validateFormNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: FormLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = formNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, issue)

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, issue)

    if (visibilityIssue) {
      return visibilityIssue
    }

    const issuePath = issue?.path ?? []

    if (issuePath[0] === 'id') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.id".`)
    }

    if (issuePath[0] === 'submitAction') {
      const field = issuePath[1]
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.submitAction${field ? `.${String(field)}` : ''}".`)
    }

    if (issuePath[0] === 'resetOnSuccess') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.resetOnSuccess".`)
    }

    if (issuePath[0] === 'persistOnUnmount') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.persistOnUnmount".`)
    }

    if (issuePath[0] === 'children') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.children".`)
    }

    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  let children: LayoutNodeCollection | undefined
  let submitAction: ExecuteOperationRuntimeUiAction | undefined

  if (parseResult.data.submitAction !== undefined) {
    const submitActionResult = validateFormSubmitAction(parseResult.data.submitAction, `${path}.submitAction`, pageId)

    if (submitActionResult.status === 'error') {
      return submitActionResult
    }

    submitAction = submitActionResult.action
  }

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
      type: 'form',
      id: parseResult.data.id,
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      persistOnUnmount: parseResult.data.persistOnUnmount,
      submitAction,
      resetOnSuccess: parseResult.data.resetOnSuccess,
      children,
    },
  }
}

function validateInputNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: InputLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = inputNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": input fields do not accept array literal defaultValue.`)
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'input',
      inputType: parseResult.data.props.inputType,
    },
    path,
    pageId,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateTextareaNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: TextareaLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = textareaNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  if (Array.isArray(parseResult.data.props.defaultValue)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.defaultValue": textarea fields do not accept array literal defaultValue.`)
  }

  const validationsResult = validateFormFieldValidations(rawNode.props, parseResult.data.props.validations, { type: 'textarea' }, path, pageId)

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      ...parseResult.data,
      props: {
        ...parseResult.data.props,
        validations: validationsResult.validations,
      },
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
    },
  }
}

function validateSelectNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: SelectLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = selectNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    parseResult.data.props.multiple === true,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'select',
      multiple: parseResult.data.props.multiple === true,
    },
    path,
    pageId,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'select',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

function validateRadioGroupNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: RadioGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = radioGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    false,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'radioGroup',
    },
    path,
    pageId,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'radioGroup',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

function validateCheckboxGroupNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
): { status: 'ready'; node: CheckboxGroupLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = checkboxGroupNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return feedbackIssue
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return visibilityIssue
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [])
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return feedbackResult
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return visibilityResult
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    true,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'checkboxGroup',
    },
    path,
    pageId,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      type: 'checkboxGroup',
      queryStateFeedback: feedbackResult.queryStateFeedback,
      visibility: visibilityResult.visibility,
      props: {
        ...parseResult.data.props,
        items: itemsResult.items,
        validations: validationsResult.validations,
      },
    },
  }
}

type FormFieldValidationTarget =
  | { type: 'input'; inputType?: InputLayoutNode['props']['inputType'] }
  | { type: 'textarea' }
  | { type: 'select'; multiple: boolean }
  | { type: 'radioGroup' }
  | { type: 'checkboxGroup' }

function validateFormFieldValidations(
  rawProps: unknown,
  rawValidations: unknown,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
): { status: 'ready'; validations: RuntimeFormFieldValidations | undefined } | { status: 'error'; error: RuntimeConfigError } {
  if (isRecord(rawProps) && Object.hasOwn(rawProps, 'required')) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.required": use props.validations.required instead.`)
  }

  if (typeof rawValidations === 'undefined') {
    return {
      status: 'ready',
      validations: undefined,
    }
  }

  if (!isRecord(rawValidations)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations".`)
  }

  const validations: RuntimeFormFieldValidations = {}

  for (const [ruleName, rawRule] of Object.entries(rawValidations)) {
    if (!supportedFormValidationRuleNames.has(ruleName as RuntimeFormValidationRuleName)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`)
    }

    const validationResult =
      ruleName === 'required'
        ? validateRequiredRule(rawRule, `${path}.props.validations.${ruleName}`, pageId)
        : validateNumericRule(rawRule, `${path}.props.validations.${ruleName}`, pageId)

    if (validationResult.status === 'error') {
      return validationResult
    }

    const compatibilityError = validateValidationCompatibility(ruleName as RuntimeFormValidationRuleName, validationResult.rule, target, path, pageId)

    if (compatibilityError) {
      return compatibilityError
    }

    switch (ruleName) {
      case 'required':
        validations.required = validationResult.rule as RuntimeRequiredValidationRule
        break
      case 'minLength':
        validations.minLength = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'maxLength':
        validations.maxLength = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'min':
        validations.min = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'max':
        validations.max = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'minSelections':
        validations.minSelections = validationResult.rule as RuntimeNumericValidationRule
        break
      case 'maxSelections':
        validations.maxSelections = validationResult.rule as RuntimeNumericValidationRule
        break
    }
  }

  const rangesError = validateValidationRanges(validations, `${path}.props.validations`, pageId)

  if (rangesError) {
    return rangesError
  }

  return {
    status: 'ready',
    validations,
  }
}

function validateRequiredRule(
  rawRule: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; rule: RuntimeRequiredValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (rawRule === true) {
    return {
      status: 'ready',
      rule: { value: true },
    }
  }

  if (!isRecord(rawRule)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (rawRule.value !== true) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`)
  }

  return {
    status: 'ready',
    rule: typeof rawRule.message === 'string' ? { value: true, message: rawRule.message } : { value: true },
  }
}

function validateNumericRule(
  rawRule: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; rule: RuntimeNumericValidationRule } | { status: 'error'; error: RuntimeConfigError } {
  if (typeof rawRule === 'number') {
    if (!Number.isFinite(rawRule) || rawRule < 0) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    return {
      status: 'ready',
      rule: { value: rawRule },
    }
  }

  if (!isRecord(rawRule)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (typeof rawRule.value !== 'number' || !Number.isFinite(rawRule.value) || rawRule.value < 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
  }

  if (typeof rawRule.message !== 'undefined' && typeof rawRule.message !== 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.message".`)
  }

  return {
    status: 'ready',
    rule: typeof rawRule.message === 'string' ? { value: rawRule.value, message: rawRule.message } : { value: rawRule.value },
  }
}

function validateValidationCompatibility(
  ruleName: RuntimeFormValidationRuleName,
  rule: RuntimeRequiredValidationRule | RuntimeNumericValidationRule,
  target: FormFieldValidationTarget,
  path: string,
  pageId: string,
) {
  if (ruleName === 'required') {
    return null
  }

  if ((ruleName === 'minLength' || ruleName === 'maxLength') && supportsTextLengthValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`)
    }

    return null
  }

  if ((ruleName === 'min' || ruleName === 'max') && target.type === 'input' && target.inputType === 'number') {
    return null
  }

  if ((ruleName === 'minSelections' || ruleName === 'maxSelections') && supportsSelectionCardinalityValidations(target)) {
    if (!Number.isInteger((rule as RuntimeNumericValidationRule).value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}.value".`)
    }

    return null
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.props.validations.${ruleName}".`)
}

function validateValidationRanges(
  validations: RuntimeFormFieldValidations,
  path: string,
  pageId: string,
) {
  if (
    validations.minLength &&
    validations.maxLength &&
    validations.minLength.value > validations.maxLength.value
  ) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minLength cannot be greater than maxLength.`)
  }

  if (validations.min && validations.max && validations.min.value > validations.max.value) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": min cannot be greater than max.`)
  }

  if (
    validations.minSelections &&
    validations.maxSelections &&
    validations.minSelections.value > validations.maxSelections.value
  ) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": minSelections cannot be greater than maxSelections.`)
  }

  return null
}

function supportsTextLengthValidations(target: FormFieldValidationTarget) {
  if (target.type === 'textarea') {
    return true
  }

  return (
    target.type === 'input' &&
    target.inputType !== 'number' &&
    target.inputType !== 'date' &&
    target.inputType !== 'datetime-local'
  )
}

function supportsSelectionCardinalityValidations(target: FormFieldValidationTarget) {
  return target.type === 'checkboxGroup' || (target.type === 'select' && target.multiple)
}

function validateSelectItemsContract(
  rawItems: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; items: SelectLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  if (Array.isArray(rawItems)) {
    const items: SelectLayoutNode['props']['items'] = []

    for (let index = 0; index < rawItems.length; index += 1) {
      const itemResult = selectItemSchema.safeParse(rawItems[index])

      if (!itemResult.success) {
        const issuePath = itemResult.error.issues[0]?.path ?? []
        const formattedPath = issuePath.map(formatPathSegment).join('')
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}[${index}]${formattedPath}".`)
      }

      items.push(itemResult.data)
    }

    const scalarValuesIssue = validateSelectScalarValues(
      items.map((item) => item.value),
      path,
      pageId,
    )

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  if (!isRecord(rawItems)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  const hasSource = 'source' in rawItems
  const hasValues = 'values' in rawItems

  if (hasSource && hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (hasSource) {
    const sourceResult = validateCollectionSource(rawItems.source, `${path}.source`, pageId, { allowItemReference: true })

    if (sourceResult.status === 'error') {
      return sourceResult
    }

    if (rawItems.itemType !== undefined && rawItems.itemType !== 'scalar') {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.itemType".`)
    }

    if ((rawItems.label === undefined) !== (rawItems.value === undefined)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    if (rawItems.label === undefined && rawItems.value === undefined) {
      if (rawItems.itemType !== 'scalar') {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${path}": dynamic scalar collections must declare itemType: "scalar", and dynamic object collections must declare label and value.`,
        )
      }

      return {
        status: 'ready',
        items: {
          source: sourceResult.source,
          itemType: 'scalar',
        },
      }
    }

    if (!isValidCollectionItemPath(rawItems.label)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`)
    }

    if (!isValidCollectionItemPath(rawItems.value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
    }

    if (rawItems.itemType !== undefined) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
    }

    return {
      status: 'ready',
      items: {
        source: sourceResult.source,
        label: rawItems.label,
        value: rawItems.value,
      },
    }
  }

  if (!hasValues) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!Array.isArray(rawItems.values)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values".`)
  }

  const values = rawItems.values

  if (values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    const scalarValuesIssue = validateSelectScalarValues(values, `${path}.values`, pageId)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items: {
        values,
      },
    }
  }

  if (values.every((value) => isRecord(value))) {
    if (!isValidCollectionItemPath(rawItems.label)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`)
    }

    if (!isValidCollectionItemPath(rawItems.value)) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`)
    }

    const projectedValueTypeIssue = validateManualSelectObjectValueTypes(values as RuntimeCollectionObjectItem[], rawItems.value, `${path}.values`, pageId)

    if (projectedValueTypeIssue) {
      return projectedValueTypeIssue
    }

    return {
      status: 'ready',
      items: {
        values: values as RuntimeCollectionObjectItem[],
        label: rawItems.label,
        value: rawItems.value,
      },
    }
  }

  const invalidIndex = values.findIndex((value) => !isRecord(value) && typeof value !== 'string' && typeof value !== 'number')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.values[${Math.max(invalidIndex, 0)}]".`)
}

function validateCollectionSource(
  rawSource: unknown,
  path: string,
  pageId: string,
  options: { allowItemReference?: boolean } = {},
): { status: 'ready'; source: string } | { status: 'error'; error: RuntimeConfigError } {
  if (!isNonEmptyString(rawSource)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (!isValidCollectionSourceReference(rawSource, options)) {
    return invalidLayout(
      `Page "${pageId}" has an invalid layout at "${path}": collection sources must use queries.{queryName}.data, queries.{queryName}.data.* or item.*.`,
    )
  }

  return {
    status: 'ready',
    source: rawSource,
  }
}

function validateChoiceFieldDefaultValue(
  defaultValue: unknown,
  path: string,
  pageId: string,
  isMultiple: boolean,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (typeof defaultValue === 'undefined') {
    return null
  }

  if (Array.isArray(defaultValue)) {
    if (!isMultiple) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": single choice fields do not accept array literal defaultValue.`)
    }

    return validateMultipleChoiceDefaultValue(defaultValue, path, pageId)
  }

  if (!isMultiple) {
    return null
  }

  if (typeof defaultValue === 'string') {
    const parsedReference = parseRuntimeReference(defaultValue, { allowItemReference: true })

    if (parsedReference.kind === 'reference' && parsedReference.status === 'supported') {
      return null
    }
  }

  return invalidLayout(
    `Page "${pageId}" has an invalid layout at "${path}": multiple choice fields only accept array literals or supported runtime references.`,
  )
}

function validateMultipleChoiceDefaultValue(
  defaultValue: unknown[],
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (let index = 0; index < defaultValue.length; index += 1) {
    const item = defaultValue[index]

    if (typeof item !== 'string' && typeof item !== 'number') {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${index}]": multiple choice defaultValue arrays only accept string or number members.`,
      )
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": multiple choice defaultValue arrays must contain only strings or only numbers.`,
      )
    }
  }

  return null
}

function mapQueryStateFeedbackIssue(
  pageId: string,
  path: string,
  issue: { path?: PropertyKey[]; code?: string; keys?: string[] } | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue?.path ?? []

  if (issuePath[0] !== 'queryStateFeedback') {
    return null
  }

  if (issue?.code === 'unrecognized_keys' && issuePath[1] === 'states' && issue?.keys && issue.keys.length > 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.queryStateFeedback.states.${issue.keys[0]}".`)
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`)
}

function mapVisibilityIssue(
  pageId: string,
  path: string,
  issue: { path?: PropertyKey[] } | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  const issuePath = issue?.path ?? []

  if (issuePath[0] !== 'visibility') {
    return null
  }

  const formattedIssuePath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedIssuePath}".`)
}

function validateActionTargets(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const pageIds = new Set(config.pages.map((page) => page.id))
  const operationNames = new Set(Object.keys(config.api))

  for (const page of config.pages) {
    const invalidTarget = findInvalidActionTarget(page.layout, 'layout', pageIds, operationNames)

    if (!invalidTarget) {
      continue
    }

    if (invalidTarget.type === 'navigateTo') {
      return invalidLayout(
        `Page "${page.id}" has an invalid layout at "${invalidTarget.path}.pageId": unknown page "${invalidTarget.target}".`,
      )
    }

    return invalidLayout(
      `Page "${page.id}" has an invalid layout at "${invalidTarget.path}.operationName": unknown operation "${invalidTarget.target}".`,
    )
  }

  return null
}

function validateFormSemantics(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const formIds = new Set<string>()
  const operationNames = new Set(Object.keys(config.api))

  for (const page of config.pages) {
    const error = validateFormNodesInCollection(page.layout, 'layout', page.id, {
      inForm: false,
      pageId: page.id,
      formIds,
      currentFormId: null,
      fieldIds: null,
      operationNames,
    })

    if (error) {
      return error
    }
  }

  return null
}

function validateExecutionRequestParams(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (const page of config.pages) {
    const error = validateExecutionRequestParamsInCollection(page.layout, 'layout', page.id, config.api)

    if (error) {
      return error
    }
  }

  return null
}

interface FormValidationContext {
  inForm: boolean
  pageId: string
  formIds: Set<string>
  currentFormId: string | null
  fieldIds: Set<string> | null
  operationNames: ReadonlySet<string>
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
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormNodesInCollection(fallbackNodes, fallbackPath, pageId, context),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (node.type === 'form') {
      if (context.formIds.has(node.id)) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.id": duplicate form id "${node.id}".`)
      }

      context.formIds.add(node.id)

      if (node.resetOnSuccess === true && node.submitAction === undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.resetOnSuccess": resetOnSuccess requires submitAction.`)
      }

      if (node.submitAction && !context.operationNames.has(node.submitAction.operationName)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.operationName": unknown operation "${node.submitAction.operationName}".`,
        )
      }

      const childrenError = validateFormChildren(node.children ?? [], `${nodePath}.children`, pageId, {
        ...context,
        inForm: true,
        currentFormId: node.id,
        fieldIds: new Set<string>(),
      })

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormNodesInCollection(node.children, `${nodePath}.children`, pageId, context)

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (node.type === 'repeater') {
      const templateError = validateFormNodesInCollection(node.props.template, `${nodePath}.props.template`, pageId, context)

      if (templateError) {
        return templateError
      }

      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      if (!context.inForm || !context.currentFormId || !context.fieldIds) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
        )
      }

      context.fieldIds.add(node.props.fieldId)

      continue
    }

    if (node.type === 'button' && node.props.action === undefined && !context.inForm) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${nodePath}": button nodes without an action must be descendants of a form node.`,
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
    const fallbackError = validateFallbackCollections(node, nodePath, (fallbackNodes, fallbackPath) =>
      validateFormChildren(fallbackNodes, fallbackPath, pageId, context),
    )

    if (fallbackError) {
      return fallbackError
    }

    if (
      node.type !== 'input' &&
      node.type !== 'textarea' &&
      node.type !== 'select' &&
      node.type !== 'radioGroup' &&
      node.type !== 'checkboxGroup' &&
      node.type !== 'button' &&
      node.type !== 'heading' &&
      node.type !== 'paragraph' &&
      node.type !== 'container'
    ) {
      return invalidLayout(
        `Page "${pageId}" has an invalid layout at "${nodePath}": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph and container descendants.`,
      )
    }

    if (node.type === 'container' && node.children) {
      const childrenError = validateFormChildren(node.children, `${nodePath}.children`, pageId, context)

      if (childrenError) {
        return childrenError
      }

      continue
    }

    if (
      node.type === 'input' ||
      node.type === 'textarea' ||
      node.type === 'select' ||
      node.type === 'radioGroup' ||
      node.type === 'checkboxGroup'
    ) {
      if (!context.currentFormId || !context.fieldIds) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}": ${node.type} nodes must be descendants of a form node.`)
      }

      if (context.fieldIds.has(node.props.fieldId)) {
        return invalidLayout(
          `Page "${pageId}" has an invalid layout at "${nodePath}.props.fieldId": duplicate fieldId "${node.props.fieldId}" in form "${context.currentFormId}".`,
        )
      }

      context.fieldIds.add(node.props.fieldId)
    }
  }

  return null
}

function validateSelectScalarValues(
  items: Array<string | number>,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (const item of items) {
    if (item === '') {
      continue
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`)
    }
  }

  return null
}

function validateManualSelectObjectValueTypes(
  items: RuntimeCollectionObjectItem[],
  valuePath: string,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (const item of items) {
    const resolvedValue = resolveCollectionItemPathValue(item, valuePath)

    if (!resolvedValue.found || (typeof resolvedValue.value !== 'string' && typeof resolvedValue.value !== 'number')) {
      continue
    }

    if (resolvedValue.value === '') {
      continue
    }

    const currentType = typeof resolvedValue.value as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`)
    }
  }

  return null
}

function findInvalidActionTarget(
  nodes: LayoutNodeCollection,
  path: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
): { path: string; type: 'navigateTo' | 'executeOperation'; target: string } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`
    const fallbackTarget = findInvalidTargetInFallbackCollections(node, nodePath, pageIds, operationNames)

    if (fallbackTarget) {
      return fallbackTarget
    }

    if (
      node.type === 'button' &&
      node.props.action?.type === 'navigateTo' &&
      !pageIds.has(node.props.action.pageId)
    ) {
      return {
        path: `${nodePath}.props.action`,
        type: 'navigateTo',
        target: node.props.action.pageId,
      }
    }

    if (
      node.type === 'button' &&
      node.props.action?.type === 'executeOperation' &&
      !operationNames.has(node.props.action.operationName)
    ) {
      return {
        path: `${nodePath}.props.action`,
        type: 'executeOperation',
        target: node.props.action.operationName,
      }
    }

    if ((node.type === 'container' || node.type === 'form') && node.children) {
      const childResult = findInvalidActionTarget(node.children, `${nodePath}.children`, pageIds, operationNames)

      if (childResult) {
        return childResult
      }
    }

    if (node.type === 'repeater') {
      const childResult = findInvalidActionTarget(node.props.template, `${nodePath}.props.template`, pageIds, operationNames)

      if (childResult) {
        return childResult
      }
    }
  }

  return null
}

function validateExecutionRequestParamsInCollection(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  api: RuntimeApiConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    const nodePath = `${path}[${index}]`

    if (node.type === 'button' && node.props.action?.type === 'executeOperation') {
      const operation = api[node.props.action.operationName]

      if (operation?.method === 'GET' && node.props.action.body !== undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.props.action.body": GET operations do not support body.`)
      }
    }

    if (node.type === 'form' && node.submitAction) {
      const operation = api[node.submitAction.operationName]

      if (operation?.method === 'GET' && node.submitAction.body !== undefined) {
        return invalidLayout(`Page "${pageId}" has an invalid layout at "${nodePath}.submitAction.body": GET operations do not support body.`)
      }
    }

    if ((node.type === 'container' || node.type === 'form') && node.children) {
      const childError = validateExecutionRequestParamsInCollection(node.children, `${nodePath}.children`, pageId, api)

      if (childError) {
        return childError
      }
    }

    if (node.type === 'repeater') {
      const childError = validateExecutionRequestParamsInCollection(node.props.template, `${nodePath}.props.template`, pageId, api)

      if (childError) {
        return childError
      }
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

function findInvalidTargetInFallbackCollections(
  node: LayoutNode,
  nodePath: string,
  pageIds: ReadonlySet<string>,
  operationNames: ReadonlySet<string>,
) {
  if (!node.queryStateFeedback) {
    return null
  }

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states ?? {})) {
    if (!rule || rule.mode !== 'fallback') {
      continue
    }

    const childResult = findInvalidActionTarget(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      pageIds,
      operationNames,
    )

    if (childResult) {
      return childResult
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

function validateFormSubmitAction(
  rawAction: unknown,
  path: string,
  pageId: string,
): { status: 'ready'; action: ExecuteOperationRuntimeUiAction } | { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawAction)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}".`)
  }

  if (rawAction.type !== 'executeOperation') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.type".`)
  }

  const parseResult = executeOperationRuntimeUiActionSchema.safeParse(rawAction)

  if (!parseResult.success) {
    return mapExecuteOperationActionIssue(pageId, path, rawAction, parseResult.error.issues[0]?.path ?? [])
  }

  const action = parseResult.data
  const requestParamsIssue = validateRuntimeApiRequestParams(action, path, pageId)

  if (requestParamsIssue) {
    return requestParamsIssue
  }

  return {
    status: 'ready',
    action,
  }
}

function mapExecuteOperationActionIssue(
  pageId: string,
  path: string,
  rawAction: Record<string, unknown>,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (issuePath[0] === 'operationName' || issuePath.length === 0) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.operationName".`)
  }

  if (issuePath[0] === 'query') {
    return mapRequestQueryIssue(pageId, path, rawAction.query, issuePath.slice(1))
  }

  if (issuePath[0] === 'headers') {
    return mapRequestHeadersIssue(pageId, path, rawAction.headers, issuePath.slice(1))
  }

  if (issuePath[0] === 'body') {
    return mapRequestBodyIssue(pageId, path, rawAction.body, issuePath.slice(1))
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.${String(issuePath[0])}".`)
}

function validateRuntimeApiRequestParams(
  requestParams: RuntimeApiRequestParams,
  path: string,
  pageId: string,
): { status: 'error'; error: RuntimeConfigError } | null {
  const queryIssue = validateRequestQueryKeys(pageId, path, requestParams.query)

  if (queryIssue) {
    return queryIssue
  }

  const headersIssue = validateRequestHeadersKeys(pageId, path, requestParams.headers)

  if (headersIssue) {
    return headersIssue
  }

  return null
}

function mapRequestQueryIssue(
  pageId: string,
  path: string,
  rawQuery: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawQuery)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.query".`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.query.${issuePath[0]}".`)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.query".`)
}

function validateRequestQueryKeys(
  pageId: string,
  path: string,
  query: RuntimeApiQuery | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (query === undefined) {
    return null
  }

  const queryResult = runtimeApiQuerySchema.safeParse(query)

  if (!queryResult.success) {
    return mapRequestQueryIssue(pageId, path, query, queryResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(query)) {
    if (key.length === 0) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.query": contains an empty key.`)
    }
  }

  return null
}

function mapRequestHeadersIssue(
  pageId: string,
  path: string,
  rawHeaders: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  if (!isRecord(rawHeaders)) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.headers".`)
  }

  if (typeof issuePath[0] === 'string') {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.headers.${issuePath[0]}".`)
  }

  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.headers".`)
}

function validateRequestHeadersKeys(
  pageId: string,
  path: string,
  headers: RuntimeApiHeaders | undefined,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (headers === undefined) {
    return null
  }

  const headersResult = runtimeApiHeadersSchema.safeParse(headers)

  if (!headersResult.success) {
    return mapRequestHeadersIssue(pageId, path, headers, headersResult.error.issues[0]?.path ?? [])
  }

  for (const key of Object.keys(headers)) {
    if (key.length === 0) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.headers": contains an empty key.`)
    }
  }

  return null
}

function mapRequestBodyIssue(
  pageId: string,
  path: string,
  rawBody: unknown,
  issuePath: PropertyKey[],
): { status: 'error'; error: RuntimeConfigError } {
  const bodyPath = findInvalidJsonBodyPath(rawBody, `${path}.body`)

  if (bodyPath) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${bodyPath}".`)
  }

  const formattedPath = issuePath.map(formatPathSegment).join('')
  return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.body${formattedPath}".`)
}

function isRuntimeConfigValue(value: unknown): value is RuntimeVisibilityConfig['value'] {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isValidVisibilityReference(reference: string): boolean {
  if (reference === 'item' || reference.startsWith('item.')) {
    return parseRuntimeReference(reference, { allowItemReference: true }).status === 'supported'
  }

  const segments = reference.split('.')

  if (segments[0] === 'forms') {
    return segments.length === 3 && segments.slice(1).every((segment) => collectionPathSegmentPattern.test(segment))
  }

  if (segments[0] !== 'queries' || segments.length < 2 || !collectionPathSegmentPattern.test(segments[1])) {
    return false
  }

  if (segments.length === 2) {
    return true
  }

  if (segments[2] === 'status' || segments[2] === 'error') {
    return segments.length === 3
  }

  if (segments[2] !== 'data') {
    return false
  }

  return segments.length === 3 || segments.slice(3).every((segment) => collectionPathSegmentPattern.test(segment))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidCollectionSourceReference(value: string, options: { allowItemReference?: boolean } = {}) {
  if (options.allowItemReference && (value === 'item' || value.startsWith('item.'))) {
    return parseRuntimeReference(value, { allowItemReference: true }).status === 'supported'
  }

  return isValidQueryCollectionSource(value)
}

function isValidQueryCollectionSource(value: string) {
  const parts = value.split('.')

  if (parts.length < 3) {
    return false
  }

  const [namespace, queryName, property, ...nestedPath] = parts

  if (namespace !== 'queries' || property !== 'data' || !isValidCollectionPathSegment(queryName)) {
    return false
  }

  return nestedPath.every(isValidCollectionPathSegment)
}

function isValidCollectionItemPath(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  return value.split('.').every(isValidCollectionPathSegment)
}

function isValidRepeaterItemKeyPath(value: unknown): value is string {
  if (!isValidCollectionItemPath(value)) {
    return false
  }

  const [firstSegment] = value.split('.')

  return (
    firstSegment !== 'item' &&
    firstSegment !== 'queries' &&
    firstSegment !== 'forms' &&
    firstSegment !== 'params' &&
    firstSegment !== 'navigation' &&
    firstSegment !== 'routeParams'
  )
}

function isValidCollectionPathSegment(segment: string) {
  return segment.length > 0 && collectionPathSegmentPattern.test(segment)
}

function resolveCollectionItemPathValue(item: unknown, path: string) {
  const pathSegments = path.split('.')
  let currentValue: unknown = item

  for (const segment of pathSegments) {
    if (Array.isArray(currentValue)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) {
        return {
          found: false,
        } as const
      }

      currentValue = currentValue[Number(segment)]

      if (typeof currentValue === 'undefined') {
        return {
          found: false,
        } as const
      }

      continue
    }

    if (!isRecord(currentValue) || !Object.hasOwn(currentValue, segment)) {
      return {
        found: false,
      } as const
    }

    currentValue = currentValue[segment]
  }

  return {
    found: true,
    value: currentValue,
  } as const
}
