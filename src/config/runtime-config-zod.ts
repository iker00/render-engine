import { z } from 'zod'

export const supportedNodeTypes = ['container', 'heading', 'paragraph', 'list', 'button'] as const
export const supportedApiMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const supportedQueryStateFeedbackStates = ['loading', 'error', 'empty', 'success'] as const

const nonEmptyStringSchema = z.string().refine((value) => value.trim().length > 0)
const nodeIdSchema = nonEmptyStringSchema

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

const runtimeApiBodySchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(runtimeApiBodySchema), z.record(z.string(), runtimeApiBodySchema)]),
)

export const runtimeApiOperationShellSchema = z
  .object({
    method: z.enum(supportedApiMethods),
    endpoint: nonEmptyStringSchema,
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
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

export const containerNodeSchema = z
  .object({
    type: z.literal('container'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
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
    props: z
      .object({
        items: z.array(z.string()),
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
  })
  .strip()

export const buttonNodeSchema = z
  .object({
    type: z.literal('button'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    props: z
      .object({
        label: z.string(),
        action: z.unknown(),
      })
      .strip(),
  })
  .strip()
