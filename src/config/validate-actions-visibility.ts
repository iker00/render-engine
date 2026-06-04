import type {
  CloseModalRuntimeUiAction,
  ExecuteOperationRuntimeUiAction,
  GoBackButtonAction,
  NavigateToButtonAction,
  OpenModalRuntimeUiAction,
  ResetFormRuntimeUiAction,
  RuntimeApiConfig,
  RuntimeApiHeaders,
  RuntimeApiQuery,
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeConfigValue,
  RuntimeUiAction,
  RuntimeVisibilityConfig,
  RuntimeVisibilityOperator,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeFeedbackFields,
} from './runtime-config-types'
import {
  closeModalRuntimeUiActionSchema,
  executeOperationRuntimeUiActionSchema,
  goBackButtonActionSchema,
  navigateToButtonActionSchema,
  openModalRuntimeUiActionSchema,
  resetFormRuntimeUiActionSchema,
  runtimeApiQuerySchema,
  runtimeApiHeadersSchema,
} from './runtime-config-zod'
import { invalidLayout } from './runtime-config-validation-errors'
import { hasRuntimeTemplateDelimiter, parseRuntimeReference } from '../runtime/runtime-references/runtime-reference-parser'

const collectionPathSegmentPattern = /^[A-Za-z0-9_-]+$/
const visibilityComparisonOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals', 'greaterThan', 'lessThan'])
const visibilityScalarOperators = new Set<RuntimeVisibilityOperator>(['equals', 'notEquals'])
const visibilityTruthinessOperators = new Set<RuntimeVisibilityOperator>(['isTruthy', 'isFalsy'])

export function validateRuntimeUiAction(
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
    rawAction.type !== 'resetForm' &&
    rawAction.type !== 'openModal' &&
    rawAction.type !== 'closeModal'
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

  if (rawAction.type === 'resetForm') {
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

  if (rawAction.type === 'openModal') {
    const parseResult = openModalRuntimeUiActionSchema.safeParse(rawAction)

    if (!parseResult.success) {
      return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.modalId".`)
    }

    const action: OpenModalRuntimeUiAction = parseResult.data

    return {
      status: 'ready',
      action,
    }
  }

  const closeModalParseResult = closeModalRuntimeUiActionSchema.safeParse(rawAction)

  if (!closeModalParseResult.success) {
    return invalidLayout(`Page "${pageId}" has an invalid layout at "${path}.modalId".`)
  }

  const action: CloseModalRuntimeUiAction = closeModalParseResult.data

  return {
    status: 'ready',
    action,
  }
}

export function validateFormSubmitAction(
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

export function validateNavigateToParams(
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

export function validateVisibility(
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

export function mapQueryStateFeedbackIssue(
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

export function mapVisibilityIssue(
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

export function validateActionTargets(
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

export function validateRuntimeApiRequestParams(
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

    if (
      node.type === 'link' &&
      node.props.action?.type === 'navigateTo' &&
      !pageIds.has(node.props.action.pageId)
    ) {
      return {
        path: `${nodePath}.props.action`,
        type: 'navigateTo',
        target: node.props.action.pageId,
      }
    }

    if ((node.type === 'container' || node.type === 'form' || node.type === 'modal') && node.children) {
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

function isRuntimeConfigValue(value: unknown): value is RuntimeConfigValue {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function isValidVisibilityReference(reference: string): boolean {
  if (reference === 'item' || reference.startsWith('item.')) {
    const parsedReference = parseRuntimeReference(reference, { allowItemReference: true })
    return parsedReference.kind === 'reference' && parsedReference.status === 'supported'
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
