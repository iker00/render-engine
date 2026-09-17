import type {
  DownloadOperationRuntimeUiAction,
  LayoutNode,
  LayoutNodeCollection,
  LayoutNodeType,
  RuntimeApiBodyValue,
  RuntimeApiRequestParams,
  RuntimeConfig,
  RuntimeConfigError,
  RuntimeUiAction,
} from './runtime-config-types'
import { FORM_ONLY_LEAF_NODE_TYPES } from './layout-placement-rules'
import { parseRuntimeReference } from './runtime-reference-syntax'
import { invalidLayout } from './runtime-config-validation-errors'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { buildBreadcrumbSegmentFromNode, enrichedInvalidLayoutFromNode } from './validation-breadcrumb'

type ErrorResult = { status: 'error'; error: RuntimeConfigError }

// formId -> fieldId -> node type, built once and shared by every admitted-surface check below.
type FieldIndex = Map<string, Map<string, LayoutNodeType>>

type ErrorLocation =
  | { kind: 'api'; operationName: string }
  | { kind: 'layout'; pageId: string; node: LayoutNode; breadcrumb: BreadcrumbSegment[] }

// Post-pass over the already-validated config: decides where `forms.{formId}.{fieldId}.$lat` /
// `.$lng` synthetic references are allowed (query/body of api operations, button actions and form
// submit actions) and rejects them everywhere else, plus checks that the referenced field actually
// exists and is an `addressPicker`. Mirrors the traversal pattern of `validateRowVisibilityScope`.
export function validateAddressPickerReferences(
  config: RuntimeConfig,
): { status: 'error'; error: RuntimeConfigError } | null {
  const fieldIndex = buildFieldIndex(config)

  const apiError = checkApiOperations(config, fieldIndex)
  if (apiError) return apiError

  for (const page of config.pages) {
    const error = checkNodesForReferences(page.layout, 'layout', page.id, fieldIndex, [])
    if (error) return error
  }

  return null
}

function isFieldBearingNode(node: LayoutNode): node is Extract<LayoutNode, { props: { fieldId: string } }> {
  return FORM_ONLY_LEAF_NODE_TYPES.has(node.type)
}

function buildFieldIndex(config: RuntimeConfig): FieldIndex {
  const index: FieldIndex = new Map()

  for (const page of config.pages) {
    indexNodes(page.layout, null, index)
  }

  return index
}

function indexNodes(nodes: LayoutNodeCollection, currentFormId: string | null, index: FieldIndex): void {
  for (const node of nodes) {
    indexNode(node, currentFormId, index)
  }
}

function indexNode(node: LayoutNode, currentFormId: string | null, index: FieldIndex): void {
  if (node.type === 'form') {
    if (!index.has(node.id)) {
      index.set(node.id, new Map())
    }

    if (node.children) {
      indexNodes(node.children, node.id, index)
    }

    return
  }

  if (isFieldBearingNode(node) && currentFormId !== null) {
    index.get(currentFormId)?.set(node.props.fieldId, node.type)
  }

  if (
    (node.type === 'container' || node.type === 'accordion' || node.type === 'modal' || node.type === 'group' || node.type === 'link') &&
    node.children
  ) {
    indexNodes(node.children, currentFormId, index)
  } else if (node.type === 'repeater') {
    indexNodes(node.props.template, currentFormId, index)
  } else if (node.type === 'tabs' || node.type === 'steps') {
    for (const item of node.props.items) {
      if (item.children) {
        indexNodes(item.children, currentFormId, index)
      }
    }
  }

  indexFallbacks(node, currentFormId, index)
}

function indexFallbacks(node: LayoutNode, currentFormId: string | null, index: FieldIndex): void {
  if (!node.queryStateFeedback?.states) return

  for (const rule of Object.values(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    indexNodes([...rule.fallback], currentFormId, index)
  }
}

function checkApiOperations(config: RuntimeConfig, fieldIndex: FieldIndex): ErrorResult | null {
  for (const [operationName, operation] of Object.entries(config.api)) {
    const error = checkRequestParamsSurface(operation, operationName, fieldIndex, { kind: 'api', operationName })
    if (error) return error
  }

  return null
}

function checkNodesForReferences(
  nodes: LayoutNodeCollection,
  path: string,
  pageId: string,
  fieldIndex: FieldIndex,
  breadcrumb: BreadcrumbSegment[],
): ErrorResult | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const nodePath = `${path}[${i}]`
    const nodeBreadcrumb = [...breadcrumb, buildBreadcrumbSegmentFromNode(node, i)]

    const error = checkNodeForReferences(node, nodePath, pageId, fieldIndex, nodeBreadcrumb)
    if (error) return error
  }

  return null
}

function checkNodeForReferences(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  fieldIndex: FieldIndex,
  breadcrumb: BreadcrumbSegment[],
): ErrorResult | null {
  const location: ErrorLocation = { kind: 'layout', pageId, node, breadcrumb }

  // `heading.props.text` is a representative "visible/interpolable" surface: it resolves bare
  // references at runtime (see `resolveRuntimeTextReference`), which always parses with
  // `allowFormCoordinateReference: true`. Bootstrap must reject a coordinate reference here
  // explicitly, since nothing else in config validation inspects this prop.
  if (node.type === 'heading') {
    const error = checkCoordinateCandidate(node.props.text, `${nodePath}.props.text`, fieldIndex, location, false)
    if (error) return error
  }

  if (node.type === 'button' && node.props.action) {
    const error = checkActionSurfaces(node.props.action, `${nodePath}.props.action`, fieldIndex, location)
    if (error) return error
  }

  if (node.type === 'form' && node.submitAction) {
    const error = checkActionSurfaces(node.submitAction, `${nodePath}.submitAction`, fieldIndex, location)
    if (error) return error
  }

  const fallbackError = checkFallbacksForReferences(node, nodePath, pageId, fieldIndex, breadcrumb)
  if (fallbackError) return fallbackError

  if (
    (node.type === 'container' || node.type === 'form' || node.type === 'accordion' || node.type === 'modal' || node.type === 'group' || node.type === 'link') &&
    node.children
  ) {
    return checkNodesForReferences(node.children, `${nodePath}.children`, pageId, fieldIndex, breadcrumb)
  }

  if (node.type === 'repeater') {
    return checkNodesForReferences(node.props.template, `${nodePath}.props.template`, pageId, fieldIndex, breadcrumb)
  }

  if (node.type === 'tabs' || node.type === 'steps') {
    for (let i = 0; i < node.props.items.length; i += 1) {
      const item = node.props.items[i]
      if (!item.children) continue

      const error = checkNodesForReferences(
        item.children,
        `${nodePath}.props.items[${i}].children`,
        pageId,
        fieldIndex,
        breadcrumb,
      )
      if (error) return error
    }
  }

  return null
}

function checkFallbacksForReferences(
  node: LayoutNode,
  nodePath: string,
  pageId: string,
  fieldIndex: FieldIndex,
  breadcrumb: BreadcrumbSegment[],
): ErrorResult | null {
  if (!node.queryStateFeedback?.states) return null

  for (const [stateName, rule] of Object.entries(node.queryStateFeedback.states)) {
    if (!rule || rule.mode !== 'fallback') continue

    const error = checkNodesForReferences(
      [...rule.fallback],
      `${nodePath}.queryStateFeedback.states.${stateName}.fallback`,
      pageId,
      fieldIndex,
      breadcrumb,
    )
    if (error) return error
  }

  return null
}

function checkActionSurfaces(
  action: RuntimeUiAction | DownloadOperationRuntimeUiAction,
  pathPrefix: string,
  fieldIndex: FieldIndex,
  location: ErrorLocation,
): ErrorResult | null {
  if (action.type === 'executeOperation' || action.type === 'downloadOperation') {
    return checkRequestParamsSurface(action, pathPrefix, fieldIndex, location)
  }

  if (action.type === 'executeOperations') {
    for (let i = 0; i < action.operations.length; i += 1) {
      const error = checkRequestParamsSurface(action.operations[i], `${pathPrefix}.operations[${i}]`, fieldIndex, location)
      if (error) return error
    }
  }

  return null
}

function checkRequestParamsSurface(
  params: RuntimeApiRequestParams,
  pathPrefix: string,
  fieldIndex: FieldIndex,
  location: ErrorLocation,
): ErrorResult | null {
  if (params.query) {
    for (const [key, value] of Object.entries(params.query)) {
      if (typeof value !== 'string') continue

      const error = checkCoordinateCandidate(value, `${pathPrefix}.query.${key}`, fieldIndex, location, true)
      if (error) return error
    }
  }

  if (params.body !== undefined) {
    const error = checkBodyValue(params.body, `${pathPrefix}.body`, fieldIndex, location)
    if (error) return error
  }

  if (params.headers) {
    for (const [key, value] of Object.entries(params.headers)) {
      const error = checkCoordinateCandidate(value, `${pathPrefix}.headers.${key}`, fieldIndex, location, false)
      if (error) return error
    }
  }

  return null
}

function checkBodyValue(
  value: RuntimeApiBodyValue,
  path: string,
  fieldIndex: FieldIndex,
  location: ErrorLocation,
): ErrorResult | null {
  if (typeof value === 'string') {
    return checkCoordinateCandidate(value, path, fieldIndex, location, true)
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const error = checkBodyValue(value[i], `${path}[${i}]`, fieldIndex, location)
      if (error) return error
    }

    return null
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, childValue] of Object.entries(value)) {
      const error = checkBodyValue(childValue, `${path}.${key}`, fieldIndex, location)
      if (error) return error
    }
  }

  return null
}

// `admitted` distinguishes query/body (coordinate references allowed, semantics checked below)
// from headers (coordinate references are never allowed there).
function checkCoordinateCandidate(
  value: string,
  path: string,
  fieldIndex: FieldIndex,
  location: ErrorLocation,
  admitted: boolean,
): ErrorResult | null {
  const parsed = parseRuntimeReference(value, { allowFormCoordinateReference: true })

  if (parsed.kind !== 'reference' || parsed.namespace !== 'forms' || parsed.path.length === 2) {
    return null
  }

  if (!admitted) {
    return buildError(
      location,
      path,
      'forms.{formId}.{fieldId}.$lat/$lng coordinate references are only supported in query and body payload surfaces, not here.',
    )
  }

  if (parsed.status !== 'supported') {
    return buildError(location, path, `"${value}" is not a valid forms.{formId}.{fieldId}.$lat/$lng coordinate reference.`)
  }

  const [formId, fieldId] = parsed.path
  const fieldType = fieldIndex.get(formId)?.get(fieldId)

  if (fieldType === undefined) {
    return buildError(location, path, `references unknown form field "forms.${formId}.${fieldId}".`)
  }

  if (fieldType !== 'addressPicker') {
    return buildError(
      location,
      path,
      `forms.${formId}.${fieldId}.$lat/$lng requires "${fieldId}" to be an addressPicker field; only an addressPicker exposes coordinates.`,
    )
  }

  return null
}

function buildError(location: ErrorLocation, path: string, reason: string): ErrorResult {
  if (location.kind === 'api') {
    return invalidLayout(`The api operation "${path}" ${reason}`)
  }

  return enrichedInvalidLayoutFromNode(
    `Page "${location.pageId}" has an invalid layout at "${path}": ${reason}`,
    location.breadcrumb,
    location.node,
  )
}
