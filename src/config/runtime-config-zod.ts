import { z } from 'zod'
import type { RuntimeApiBodyValue } from './runtime-config-types'

export const supportedNodeTypes = [
  'container',
  'repeater',
  'heading',
  'paragraph',
  'list',
  'image',
  'table',
  'button',
  'form',
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
] as const
export const supportedApiMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const supportedQueryStateFeedbackStates = ['idle', 'loading', 'error', 'empty', 'success'] as const
export const supportedVisibilityOperators = ['equals', 'notEquals', 'isTruthy', 'isFalsy', 'greaterThan', 'lessThan'] as const
export const supportedInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local'] as const
export const supportedContainerAlignValues = ['start', 'center', 'end', 'stretch'] as const
export const supportedContainerJustifyValues = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const
export const supportedContainerWrapValues = ['nowrap', 'wrap', 'wrap-reverse'] as const
export const supportedContainerVariantValues = ['default', 'card'] as const
export const supportedChoiceGroupOptionLayoutValues = ['vertical', 'inline'] as const
export const supportedCollectionPaginationControlsVariants = ['previousNext', 'numbered', 'scroll'] as const
export const supportedResponsiveBreakpoints = ['base', 'sm', 'md', 'lg', 'xl', '2xl'] as const

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0)
const nodeIdSchema = nonEmptyStringSchema
const runtimeConfigValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const formFieldDefaultValueSchema = z.union([runtimeConfigValueSchema, z.array(z.unknown())])
const formFieldValidationsSchema = z.record(z.string(), z.unknown())
const boundedLayoutValueSchema = z.number().int().min(1).max(12)
const responsiveBoundedLayoutValueSchema = z
  .object({
    base: boundedLayoutValueSchema.optional(),
    sm: boundedLayoutValueSchema.optional(),
    md: boundedLayoutValueSchema.optional(),
    lg: boundedLayoutValueSchema.optional(),
    xl: boundedLayoutValueSchema.optional(),
    '2xl': boundedLayoutValueSchema.optional(),
  })
  .strict()
const responsiveLayoutValueSchema = z.union([boundedLayoutValueSchema, responsiveBoundedLayoutValueSchema])

export const runtimeConfigShellSchema = z
  .object({
    api: z.record(z.string(), z.unknown()),
    pages: z.array(z.unknown()),
    initialPage: nonEmptyStringSchema,
  })
  .strip()

export const runtimePageShellSchema = z
  .object({
    id: nonEmptyStringSchema,
    preloads: z.array(z.unknown()).optional(),
    layout: z.array(z.unknown()),
  })
  .strip()

export const runtimeApiQuerySchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
export const runtimeApiHeadersSchema = z.record(z.string(), z.string())

const runtimeApiBodySchema: z.ZodType<RuntimeApiBodyValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(runtimeApiBodySchema), z.record(z.string(), runtimeApiBodySchema)]),
)

export const runtimeApiRequestParamsSchema = z
  .object({
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
    headers: runtimeApiHeadersSchema.optional(),
  })
  .strip()

export const runtimeApiOperationShellSchema = z
  .object({
    method: z.enum(supportedApiMethods),
    endpoint: nonEmptyStringSchema,
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
    headers: runtimeApiHeadersSchema.optional(),
  })
  .strip()

const queryStateFeedbackShowRuleSchema = z
  .object({
    mode: z.literal('show'),
  })
  .strip()

const queryStateFeedbackHideRuleSchema = z
  .object({
    mode: z.literal('hide'),
  })
  .strip()

const queryStateFeedbackFallbackRuleSchema = z
  .object({
    mode: z.literal('fallback'),
    fallback: z.array(z.unknown()),
  })
  .strip()

const queryStateFeedbackRuleSchema = z.discriminatedUnion('mode', [
  queryStateFeedbackShowRuleSchema,
  queryStateFeedbackHideRuleSchema,
  queryStateFeedbackFallbackRuleSchema,
])

const queryStateFeedbackStatesSchema = z
  .object({
    idle: queryStateFeedbackRuleSchema.optional(),
    loading: queryStateFeedbackRuleSchema.optional(),
    error: queryStateFeedbackRuleSchema.optional(),
    empty: queryStateFeedbackRuleSchema.optional(),
    success: queryStateFeedbackRuleSchema.optional(),
  })
  .strict()

const queryStateFeedbackSchema = z
  .object({
    query: nonEmptyStringSchema,
    states: queryStateFeedbackStatesSchema.optional(),
  })
  .strip()

const visibilitySchema = z
  .object({
    reference: nonEmptyStringSchema,
    operator: z.enum(supportedVisibilityOperators),
    value: z.unknown().optional(),
  })
  .strip()

const layoutNodeLayoutSchema = z
  .object({
    span: responsiveLayoutValueSchema.optional(),
  })
  .strip()

export const containerNodeSchema = z
  .object({
    type: z.literal('container'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        direction: z.string().optional(),
        gap: z.string().optional(),
        columns: responsiveLayoutValueSchema.optional(),
        variant: z.enum(supportedContainerVariantValues).optional(),
        align: z.enum(supportedContainerAlignValues).optional(),
        justify: z.enum(supportedContainerJustifyValues).optional(),
        wrap: z.enum(supportedContainerWrapValues).optional(),
      })
      .strip()
      .optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

const collectionPaginationControlsSchema = z
  .object({
    variant: z.enum(supportedCollectionPaginationControlsVariants).optional(),
  })
  .strict()

const collectionPaginationSchema = z
  .object({
    enabled: z.literal(true),
    pageSize: z.number().int().finite().min(1),
    controls: collectionPaginationControlsSchema.optional(),
  })
  .strict()

const tableColumnConfigSchema = z
  .object({
    id: nonEmptyStringSchema,
    filterable: z.literal(true).optional(),
    filterPlaceholder: nonEmptyStringSchema.optional(),
    sortable: z.literal(true).optional(),
  })
  .strict()

export const headingNodeSchema = z
  .object({
    type: z.literal('heading'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        text: z.string(),
        level: z.number().int(),
      })
      .strip(),
  })
  .strip()

export const repeaterNodeSchema = z
  .object({
    type: z.literal('repeater'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        items: z
          .object({
            source: nonEmptyStringSchema,
            key: nonEmptyStringSchema,
          })
          .strip(),
        pagination: collectionPaginationSchema.optional(),
        template: z.array(z.unknown()),
      })
      .strip(),
    children: z.never().optional(),
  })
  .strip()

export const paragraphNodeSchema = z
  .object({
    type: z.literal('paragraph'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        text: z.string(),
      })
      .strip(),
  })
  .strip()

export const listNodeSchema = z
  .object({
    type: z.literal('list'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        items: z.unknown(),
      })
      .strip(),
  })
  .strip()

export const imageNodeSchema = z
  .object({
    type: z.literal('image'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        src: nonEmptyStringSchema,
        alt: nonEmptyStringSchema,
      })
      .strip(),
  })
  .strip()

export const tableNodeSchema = z
  .object({
    type: z.literal('table'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        headers: z.array(z.string()),
        columns: z.array(tableColumnConfigSchema).optional(),
        rows: z.unknown(),
        pagination: collectionPaginationSchema.optional(),
      })
      .strip(),
  })
  .strip()

export const goBackButtonActionSchema = z
  .object({
    type: z.literal('goBack'),
  })
  .strip()

export const navigateToButtonActionSchema = z
  .object({
    type: z.literal('navigateTo'),
    pageId: nonEmptyStringSchema,
    params: z.unknown().optional(),
  })
  .strip()

export const executeOperationRuntimeUiActionSchema = z
  .object({
    type: z.literal('executeOperation'),
    operationName: nonEmptyStringSchema,
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
    headers: runtimeApiHeadersSchema.optional(),
  })
  .strip()

export const resetFormRuntimeUiActionSchema = z
  .object({
    type: z.literal('resetForm'),
    formId: nonEmptyStringSchema,
  })
  .strip()

export const buttonNodeSchema = z
  .object({
    type: z.literal('button'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        label: z.string(),
        action: z.unknown().optional(),
      })
      .strip(),
  })
  .strip()

export const formNodeSchema = z
  .object({
    type: z.literal('form'),
    id: nodeIdSchema,
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    persistOnUnmount: z.boolean().optional(),
    submitAction: z.unknown().optional(),
    resetOnSuccess: z.boolean().optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

const formFieldNodePropsSchema = z
  .object({
    fieldId: nonEmptyStringSchema,
    label: z.string(),
    validations: formFieldValidationsSchema.optional(),
    defaultValue: formFieldDefaultValueSchema.optional(),
  })
  .strip()

export const inputNodeSchema = z
  .object({
    type: z.literal('input'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema
      .extend({
        inputType: z.enum(supportedInputTypes).optional(),
      })
      .strip(),
  })
  .strip()

export const textareaNodeSchema = z
  .object({
    type: z.literal('textarea'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema,
  })
  .strip()

export const selectItemSchema = z
  .object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
  })
  .strip()

export const selectNodeSchema = z
  .object({
    type: z.literal('select'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema
      .extend({
        items: z.unknown(),
        multiple: z.boolean().optional(),
      })
      .strip(),
  })
  .strip()

export const radioGroupNodeSchema = z
  .object({
    type: z.literal('radioGroup'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema
      .extend({
        items: z.unknown(),
        optionLayout: z.enum(supportedChoiceGroupOptionLayoutValues).optional(),
      })
      .strip(),
  })
  .strip()

export const checkboxGroupNodeSchema = z
  .object({
    type: z.literal('checkboxGroup'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema
      .extend({
        items: z.unknown(),
        optionLayout: z.enum(supportedChoiceGroupOptionLayoutValues).optional(),
      })
      .strip(),
  })
  .strip()
