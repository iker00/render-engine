import type { AutocompleteLayoutNode, LayoutNodeFeedbackFields, RuntimeConfigError } from './runtime-config-types'
import { autocompleteNodeSchema } from './runtime-config-zod'
import type { BreadcrumbSegment } from './validation-breadcrumb'
import { enrichErrorResult } from './validation-breadcrumb'
import { validateQueryStateFeedback } from './validate-layout-nodes-core'
import { mapLeafNodeIssue } from './validate-layout-issue-mapping'
import { mapQueryStateFeedbackIssue, mapVisibilityIssue, validateVisibility } from './validate-actions-visibility'
import { validateFormFieldValidations } from './validate-form-field-validations'
import { validateChoiceFieldDefaultValue, validateSelectItemsContract } from './validate-form-choice-items'

export function validateAutocompleteNode(
  rawNode: Record<string, unknown>,
  path: string,
  pageId: string,
  breadcrumb: BreadcrumbSegment[] = [],
): { status: 'ready'; node: AutocompleteLayoutNode } | { status: 'error'; error: RuntimeConfigError } {
  const parseResult = autocompleteNodeSchema.safeParse(rawNode)

  if (!parseResult.success) {
    const feedbackIssue = mapQueryStateFeedbackIssue(pageId, path, parseResult.error.issues[0])

    if (feedbackIssue) {
      return enrichErrorResult(feedbackIssue, breadcrumb, rawNode)
    }

    const visibilityIssue = mapVisibilityIssue(pageId, path, parseResult.error.issues[0])

    if (visibilityIssue) {
      return enrichErrorResult(visibilityIssue, breadcrumb, rawNode)
    }

    return mapLeafNodeIssue(pageId, path, parseResult.error.issues[0]?.path ?? [], breadcrumb, rawNode)
  }

  const feedbackResult = validateQueryStateFeedback(
    parseResult.data.queryStateFeedback as LayoutNodeFeedbackFields['queryStateFeedback'],
    `${path}.queryStateFeedback`,
    pageId,
  )

  if (feedbackResult.status === 'error') {
    return enrichErrorResult(feedbackResult, breadcrumb, rawNode)
  }

  const visibilityResult = validateVisibility(
    parseResult.data.visibility as LayoutNodeFeedbackFields['visibility'],
    `${path}.visibility`,
    pageId,
  )

  if (visibilityResult.status === 'error') {
    return enrichErrorResult(visibilityResult, breadcrumb, rawNode)
  }

  const itemsResult = validateSelectItemsContract(parseResult.data.props.items, `${path}.props.items`, pageId, breadcrumb, rawNode)

  if (itemsResult.status === 'error') {
    return itemsResult
  }

  const defaultValueIssue = validateChoiceFieldDefaultValue(
    parseResult.data.props.defaultValue,
    `${path}.props.defaultValue`,
    pageId,
    parseResult.data.props.multiple === true,
    breadcrumb,
    rawNode,
  )

  if (defaultValueIssue) {
    return defaultValueIssue
  }

  const validationsResult = validateFormFieldValidations(
    rawNode.props,
    parseResult.data.props.validations,
    {
      type: 'autocomplete',
      multiple: parseResult.data.props.multiple === true,
    },
    path,
    pageId,
    breadcrumb,
    rawNode,
  )

  if (validationsResult.status === 'error') {
    return validationsResult
  }

  return {
    status: 'ready',
    node: {
      layout: parseResult.data.layout,
      type: 'autocomplete',
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
