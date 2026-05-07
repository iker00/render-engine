import { z } from 'zod'

export const supportedNodeTypes = ['container', 'heading', 'paragraph', 'list', 'button', 'form', 'input', 'textarea', 'select'] as const
export const supportedApiMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const supportedQueryStateFeedbackStates = ['idle', 'loading', 'error', 'empty', 'success'] as const
export const supportedVisibilityOperators = ['equals', 'notEquals', 'isTruthy', 'isFalsy', 'greaterThan', 'lessThan'] as const
export const supportedInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url'] as const

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0)
const nodeIdSchema = nonEmptyStringSchema
const runtimeConfigValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

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
    preloads: z.array(nonEmptyStringSchema).optional(),
    layout: z.array(z.unknown()),
  })
  .strip()

export const runtimeApiQuerySchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
export const runtimeApiHeadersSchema = z.record(z.string(), z.string())

const runtimeApiBodySchema: z.ZodType<unknown> = z.lazy(() =>
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

export const containerNodeSchema = z
  .object({
    type: z.literal('container'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    props: z
      .object({
        direction: z.string().optional(),
        gap: z.string().optional(),
      })
      .strip()
      .optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

export const headingNodeSchema = z
  .object({
    type: z.literal('heading'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    props: z
      .object({
        text: z.string(),
        level: z.number().int(),
      })
      .strip(),
  })
  .strip()

export const paragraphNodeSchema = z
  .object({
    type: z.literal('paragraph'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
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
    props: z
      .object({
        items: z.unknown(),
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
    submitAction: z.unknown().optional(),
    resetOnSuccess: z.boolean().optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

const formFieldNodePropsSchema = z
  .object({
    fieldId: nonEmptyStringSchema,
    label: z.string(),
    required: z.boolean().optional(),
    defaultValue: runtimeConfigValueSchema.optional(),
  })
  .strip()

export const inputNodeSchema = z
  .object({
    type: z.literal('input'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
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
    props: formFieldNodePropsSchema
      .extend({
        items: z.unknown(),
      })
      .strip(),
  })
  .strip()
