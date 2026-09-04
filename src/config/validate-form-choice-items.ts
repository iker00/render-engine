import type { RuntimeConfigError, SelectLayoutNode } from './runtime-config-types'
import { selectItemsSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichedInvalidLayout, enrichErrorResult } from './validation-breadcrumb'
import { validateCollectionSource } from './validate-collection-source'
import { formatPathSegment, isValidCollectionProjectionPath } from './validate-node-shared-helpers'
import { isTokensReference } from './runtime-reference-namespace-guards'
import { parseRuntimeReference } from './runtime-reference-syntax'

export function validateSelectItemsContract(
  rawItems: unknown,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
  options: { allowPipeline?: boolean } = {},
): { status: 'ready'; items: SelectLayoutNode['props']['items'] } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = selectItemsSchema.safeParse(rawItems)

  if (!parseResult.success) {
    const issuePath = parseResult.error.issues[0]?.path ?? []
    const formattedPath = issuePath.map(formatPathSegment).join('')
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}${formattedPath}".`, breadcrumb, rawNode)
  }

  const items = parseResult.data

  if (Array.isArray(items)) {
    const scalarValuesIssue = validateSelectScalarValues(items.map((item) => item.value), path, pageId, breadcrumb, rawNode)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  if ('values' in items) {
    const scalarValuesIssue = validateSelectScalarValues(items.values, `${path}.values`, pageId, breadcrumb, rawNode)

    if (scalarValuesIssue) {
      return scalarValuesIssue
    }

    return {
      status: 'ready',
      items,
    }
  }

  const sourceResult = validateCollectionSource(items.source, `${path}.source`, pageId, {
    allowItemReference: true,
    allowPipeline: options.allowPipeline,
  })

  if (sourceResult.status === 'error') {
    return enrichErrorResult(sourceResult, breadcrumb, rawNode)
  }

  if (items.itemType === 'scalar') {
    return {
      status: 'ready',
      items: {
        source: sourceResult.source,
        itemType: 'scalar',
      },
    }
  }

  if (!isValidCollectionProjectionPath(items.label)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.label".`, breadcrumb, rawNode)
  }

  if (!isValidCollectionProjectionPath(items.value)) {
    return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}.value".`, breadcrumb, rawNode)
  }

  return {
    status: 'ready',
    items: {
      source: sourceResult.source,
      itemType: 'object',
      label: items.label,
      value: items.value,
    },
  }
}

export function validateChoiceFieldDefaultValue(
  defaultValue: unknown,
  path: string,
  pageId: string,
  isMultiple: boolean,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'error'; error: RuntimeConfigError } | null {
  if (typeof defaultValue === 'undefined') {
    return null
  }

  if (Array.isArray(defaultValue)) {
    if (!isMultiple) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": single choice fields do not accept array literal defaultValue.`, breadcrumb, rawNode)
    }

    return validateMultipleChoiceDefaultValue(defaultValue, path, pageId, breadcrumb, rawNode)
  }

  if (!isMultiple) {
    if (typeof defaultValue === 'string' && isTokensReference(defaultValue)) {
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": tokens.* references are not supported in defaultValue.`, breadcrumb, rawNode)
    }

    return null
  }

  if (typeof defaultValue === 'string') {
    const parsedReference = parseRuntimeReference(defaultValue, { allowItemReference: true })

    if (parsedReference.kind === 'reference' && parsedReference.status === 'supported') {
      return null
    }
  }

  return enrichedInvalidLayout(
    `Page "${pageId}" has an invalid layout at "${path}": multiple choice fields only accept array literals or supported runtime references.`,
    breadcrumb,
    rawNode,
  )
}

function validateMultipleChoiceDefaultValue(
  defaultValue: unknown[],
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
): { status: 'error'; error: RuntimeConfigError } | null {
  let valueType: 'string' | 'number' | null = null

  for (let index = 0; index < defaultValue.length; index += 1) {
    const item = defaultValue[index]

    if (typeof item !== 'string' && typeof item !== 'number') {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}[${index}]": multiple choice defaultValue arrays only accept string or number members.`,
        breadcrumb,
        rawNode,
      )
    }

    const currentType = typeof item as 'string' | 'number'

    if (valueType === null) {
      valueType = currentType
      continue
    }

    if (valueType !== currentType) {
      return enrichedInvalidLayout(
        `Page "${pageId}" has an invalid layout at "${path}": multiple choice defaultValue arrays must contain only strings or only numbers.`,
        breadcrumb,
        rawNode,
      )
    }
  }

  return null
}

function validateSelectScalarValues(
  items: Array<string | number>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
  rawNode?: Record<string, unknown>,
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
      return enrichedInvalidLayout(`Page "${pageId}" has an invalid layout at "${path}": select item values must all be strings or all be numbers.`, breadcrumb, rawNode)
    }
  }

  return null
}
