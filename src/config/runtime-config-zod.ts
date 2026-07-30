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
  'link',
  'form',
  'input',
  'textarea',
  'select',
  'radioGroup',
  'checkboxGroup',
  'modal',
  'tabs',
  'accordion',
  'badge',
  'alert',
  'stat',
  'divider',
  'skeleton',
  'fileManager',
  'fileInput',
  'toggle',
  'hidden',
] as const

export const tableCellAllowedNodeTypes = ['image', 'list', 'button', 'container', 'heading', 'paragraph'] as const
export const supportedApiMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
export const supportedQueryStateFeedbackStates = ['idle', 'loading', 'error', 'empty', 'success'] as const
export const supportedVisibilityOperators = ['equals', 'notEquals', 'isTruthy', 'isFalsy', 'greaterThan', 'lessThan', 'arrayContains'] as const
export const supportedVisibilityGroupOperators = ['and', 'or'] as const
export const supportedInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date', 'datetime-local', 'time'] as const
export const supportedContainerAlignValues = ['start', 'center', 'end', 'stretch'] as const
export const supportedContainerJustifyValues = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const
export const supportedContainerWrapValues = ['nowrap', 'wrap', 'wrap-reverse'] as const
export const supportedContainerVariantValues = ['default', 'card'] as const
export const supportedChoiceGroupOptionLayoutValues = ['vertical', 'inline'] as const
export const supportedCollectionPaginationControlsVariants = ['previousNext', 'numbered', 'scroll'] as const
export const supportedResponsiveBreakpoints = ['base', 'sm', 'md', 'lg', 'xl', '2xl'] as const
export const supportedModalSizeValues = ['sm', 'md', 'lg'] as const

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
    preloads: z.array(z.unknown()).optional(),
  })
  .strip()

export const runtimePageShellSchema = z
  .object({
    id: nonEmptyStringSchema,
    preloads: z.array(z.unknown()).optional(),
    title: z.string().optional(),
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

const runtimeApiErrorConditionEqualsSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const runtimeApiErrorConditionSchema = z
  .object({
    path: nonEmptyStringSchema,
    equals: runtimeApiErrorConditionEqualsSchema.optional(),
    notEquals: runtimeApiErrorConditionEqualsSchema.optional(),
  })
  .strip()

export const runtimeApiOperationShellSchema = z
  .object({
    method: z.enum(supportedApiMethods),
    endpoint: nonEmptyStringSchema,
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
    headers: runtimeApiHeadersSchema.optional(),
    errorCondition: runtimeApiErrorConditionSchema.optional(),
    errorMessagePath: nonEmptyStringSchema.optional(),
    errorCodePath: nonEmptyStringSchema.optional(),
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

const visibilityConditionSchema = z
  .object({
    reference: nonEmptyStringSchema,
    operator: z.enum(supportedVisibilityOperators),
    value: z.unknown().optional(),
    negate: z.boolean().optional(),
    itemField: z.string().optional(),
  })
  .strip()

const visibilityGroupSchema = z
  .object({
    operator: z.enum(supportedVisibilityGroupOperators),
    conditions: z.array(visibilityConditionSchema).min(1),
  })
  .strip()

const visibilitySchema = z.discriminatedUnion('operator', [visibilityConditionSchema, visibilityGroupSchema])

export const whenConditionSchema = visibilitySchema

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
        icon: z.string().optional(),
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
        icon: z.string().optional(),
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

export const imageFetchSchema = z
  .object({
    url: nonEmptyStringSchema,
    method: z.enum(supportedApiMethods).optional(),
    headers: runtimeApiHeadersSchema.optional(),
    body: runtimeApiBodySchema.optional().nullable(),
  })
  .strip()

// Flexible props schema that accepts either src or fetch branches (plus alt and any extra stripped keys).
// Mutual exclusion (src XOR fetch) is enforced by validateImageNode after parsing.
const imagePropsSchema = z
  .object({
    src: nonEmptyStringSchema.optional(),
    fetch: imageFetchSchema.optional(),
    alt: nonEmptyStringSchema,
  })
  .strip()

export const imageNodeSchema = z
  .object({
    type: z.literal('image'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: imagePropsSchema,
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

export const executeOperationsRuntimeUiActionEntrySchema = z
  .object({
    operationName: nonEmptyStringSchema,
    query: runtimeApiQuerySchema.optional(),
    body: runtimeApiBodySchema.optional(),
    headers: runtimeApiHeadersSchema.optional(),
    when: whenConditionSchema.optional(),
  })
  .strip()

export const executeOperationsRuntimeUiActionSchema = z
  .object({
    type: z.literal('executeOperations'),
    operations: z.array(executeOperationsRuntimeUiActionEntrySchema).min(1),
  })
  .strip()

export const resetFormRuntimeUiActionSchema = z
  .object({
    type: z.literal('resetForm'),
    formId: nonEmptyStringSchema,
  })
  .strip()

export const openModalRuntimeUiActionSchema = z
  .object({
    type: z.literal('openModal'),
    modalId: nonEmptyStringSchema,
  })
  .strip()

export const closeModalRuntimeUiActionSchema = z
  .object({
    type: z.literal('closeModal'),
    modalId: nonEmptyStringSchema,
  })
  .strip()

export const buttonActionSchema = z.discriminatedUnion('type', [
  navigateToButtonActionSchema,
  goBackButtonActionSchema,
  executeOperationRuntimeUiActionSchema,
  executeOperationsRuntimeUiActionSchema,
  resetFormRuntimeUiActionSchema,
  openModalRuntimeUiActionSchema,
  closeModalRuntimeUiActionSchema,
])

// Shape of a single onSuccess/onError entry: the same 7 action variants accepted by
// buttonActionSchema, each extended with an optional `when` condition.
export const formLifecycleActionEntrySchema = z.discriminatedUnion('type', [
  navigateToButtonActionSchema.extend({ when: whenConditionSchema.optional() }),
  goBackButtonActionSchema.extend({ when: whenConditionSchema.optional() }),
  executeOperationRuntimeUiActionSchema.extend({ when: whenConditionSchema.optional() }),
  executeOperationsRuntimeUiActionSchema.extend({ when: whenConditionSchema.optional() }),
  resetFormRuntimeUiActionSchema.extend({ when: whenConditionSchema.optional() }),
  openModalRuntimeUiActionSchema.extend({ when: whenConditionSchema.optional() }),
  closeModalRuntimeUiActionSchema.extend({ when: whenConditionSchema.optional() }),
])

const formLifecycleActionsSchema = z.array(formLifecycleActionEntrySchema).optional()

export const formSubmitActionSchema = z.discriminatedUnion('type', [
  executeOperationRuntimeUiActionSchema.extend({
    onSuccess: formLifecycleActionsSchema,
    onError: formLifecycleActionsSchema,
  }),
  executeOperationsRuntimeUiActionSchema.extend({
    onSuccess: formLifecycleActionsSchema,
    onError: formLifecycleActionsSchema,
  }),
])

export const supportedButtonVariants = ['solid', 'outline', 'ghost', 'link'] as const
export const supportedButtonColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

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
        action: buttonActionSchema.optional(),
        color: z.enum(supportedButtonColors).optional(),
        variant: z.enum(supportedButtonVariants).optional(),
        fullWidth: z.boolean().optional(),
        icon: z.string().optional(),
        iconPosition: z.enum(['left', 'right']).optional(),
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
    submitAction: formSubmitActionSchema.optional(),
    resetOnSuccess: z.boolean().optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

const formFieldNodePropsSchema = z
  .object({
    fieldId: nonEmptyStringSchema,
    label: z.string(),
    tooltip: z.string().optional(),
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
        placeholder: z.string().optional(),
        icon: z.string().optional(),
        iconPosition: z.enum(['left', 'right']).optional(),
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
    props: formFieldNodePropsSchema
      .extend({
        placeholder: z.string().optional(),
      })
      .strip(),
  })
  .strip()

export const selectItemSchema = z
  .object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
  })
  .strip()

// Exclusive contract for props.items of select/radioGroup/checkboxGroup: manual literal
// (array of {label, value}), manual scalar ({ values: [...] }), or dynamic with an explicit
// itemType discriminator (scalar or object with label/value projection paths). No other shape
// is accepted; there is no compatibility adapter for retired shapes (manual object, dynamic
// without itemType).
export const selectItemsSchema = z.union([
  z.array(selectItemSchema),
  z.object({ values: z.array(z.union([z.string(), z.number()])) }).strict(),
  z.discriminatedUnion('itemType', [
    z.object({ source: z.string(), itemType: z.literal('scalar') }).strict(),
    z.object({ source: z.string(), itemType: z.literal('object'), label: z.string(), value: z.string() }).strict(),
  ]),
])

export const selectNodeSchema = z
  .object({
    type: z.literal('select'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: formFieldNodePropsSchema
      .extend({
        items: selectItemsSchema,
        multiple: z.boolean().optional(),
        placeholder: z.string().optional(),
        emptySubmitValue: z.union([z.string(), z.number()]).optional(),
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
        items: selectItemsSchema,
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
        items: selectItemsSchema,
        optionLayout: z.enum(supportedChoiceGroupOptionLayoutValues).optional(),
      })
      .strip(),
  })
  .strip()

export const modalNodeSchema = z
  .object({
    type: z.literal('modal'),
    id: nodeIdSchema,
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        size: z.enum(supportedModalSizeValues).optional(),
        defaultOpen: z.boolean().optional(),
        label: z.string().optional(),
      })
      .strip()
      .optional(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

export const tabsItemSchema = z
  .object({
    label: z.string(),
    children: z.array(z.unknown()).optional(),
    visibility: visibilitySchema.optional(),
  })
  .strip()

export const tabsNodeSchema = z
  .object({
    type: z.literal('tabs'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        orientation: z.enum(['horizontal', 'vertical']).optional(),
        defaultTab: z.number().int().min(0).optional(),
        items: z.array(tabsItemSchema).min(1),
      })
      .strip(),
    children: z.never().optional(),
  })
  .strip()

const nonEmptyLangSlugSchema = z.string().refine((value) => value.length > 0, {
  message: 'Language slug must not be empty',
})

export const runtimeTranslationsLangMapSchema = z.record(nonEmptyLangSlugSchema, z.string())

export const runtimeTranslationsSchema = z.record(z.string(), runtimeTranslationsLangMapSchema)

export const accordionNodeSchema = z
  .object({
    type: z.literal('accordion'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        label: nonEmptyStringSchema,
        defaultOpen: z.boolean().optional(),
        groupId: z.string().optional(),
      })
      .strip(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

export const linkNodeSchema = z
  .object({
    type: z.literal('link'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        label: z.string().optional(),
        href: z.string().optional(),
        download: z.string().optional(),
        target: z.string().optional(),
        action: z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema]).optional(),
        icon: z.string().optional(),
        iconPosition: z.enum(['left', 'right']).optional(),
      })
      .strip(),
    children: z.array(z.unknown()).optional(),
  })
  .strip()

export const supportedBadgeVariants = ['pill', 'circle'] as const
export const supportedBadgeColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

export const badgeNodeSchema = z
  .object({
    type: z.literal('badge'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        label: z.string(),
        variant: z.enum(supportedBadgeVariants).optional(),
        color: z.enum(supportedBadgeColors).optional(),
      })
      .strip(),
  })
  .strip()

export const supportedAlertTypes = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

export const alertNodeSchema = z
  .object({
    type: z.literal('alert'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        message: z.string(),
        type: z.enum(supportedAlertTypes).optional(),
        title: z.string().optional(),
      })
      .strip(),
  })
  .strip()

export const supportedStatVariants = ['accent', 'tinted', 'plain'] as const
export const supportedStatColors = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const

export const statNodeSchema = z
  .object({
    type: z.literal('stat'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        label: z.string(),
        value: z.string(),
        variant: z.enum(supportedStatVariants).optional(),
        color: z.enum(supportedStatColors).optional(),
        icon: z.string().optional(),
      })
      .strip(),
  })
  .strip()

export const supportedDividerVariants = ['solid', 'dashed', 'dotted', 'invisible'] as const

export const dividerNodeSchema = z
  .object({
    type: z.literal('divider'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        variant: z.enum(supportedDividerVariants).optional(),
      })
      .strip()
      .optional(),
  })
  .strip()

export const supportedSkeletonVariants = ['text', 'rect', 'circle'] as const

export const skeletonNodeSchema = z
  .object({
    type: z.literal('skeleton'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        variant: z.enum(supportedSkeletonVariants).optional(),
        lines: z.number().int().min(1).optional(),
        width: z.string().optional(),
        height: z.string().optional(),
        rounded: z.boolean().optional(),
        animate: z.boolean().optional(),
      })
      .strip()
      .optional(),
  })
  .strip()

const fileManagerValidationsSchema = z
  .object({
    accept: z.object({ value: z.array(z.string()), message: z.string().optional() }).strip().optional(),
    maxFileSize: z.object({ value: z.number(), message: z.string().optional() }).strip().optional(),
    maxTotalSize: z.object({ value: z.number(), message: z.string().optional() }).strip().optional(),
    minFiles: z.object({ value: z.number(), message: z.string().optional() }).strip().optional(),
    maxFiles: z.object({ value: z.number(), message: z.string().optional() }).strip().optional(),
    validFileNames: z.object({ value: z.array(z.string()), message: z.string().optional() }).strip().optional(),
  })
  .strip()

const fileManagerOperationSchema = z.union([z.string(), z.literal(false)]).optional()

const fileManagerLabelsSchema = z
  .object({
    dropzoneIdle: z.string().optional(),
    dropzoneAcceptedFormats: z.string().optional(),
    dropzoneUploading: z.string().optional(),
    dropzoneProgress: z.string().optional(),
    dropzoneSuccess: z.string().optional(),
    dropzoneMaxFilesReached: z.string().optional(),
    dropzoneAriaLabel: z.string().optional(),
    listLoadError: z.string().optional(),
    listEmpty: z.string().optional(),
    paginationPrevious: z.string().optional(),
    paginationNext: z.string().optional(),
    rowViewLabel: z.string().optional(),
    rowViewAriaLabel: z.string().optional(),
    rowViewUnavailableAriaLabel: z.string().optional(),
    rowDownloadLabel: z.string().optional(),
    rowDownloadAriaLabel: z.string().optional(),
    rowDownloadUnavailableAriaLabel: z.string().optional(),
    rowDeleteLabel: z.string().optional(),
    rowDeleteAriaLabel: z.string().optional(),
    uploadFileError: z.string().optional(),
    uploadListPathMissing: z.string().optional(),
    deleteError: z.string().optional(),
  })
  .strict()

export const fileManagerNodeSchema = z
  .object({
    type: z.literal('fileManager'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        fieldName: z.string().optional(),
        fileField: z.string().optional(),
        listPath: z.string().optional(),
        fileIdField: z.string().optional(),
        fileNameField: z.string().optional(),
        multiple: z.boolean().optional(),
        prefix: z.string().optional(),
        acceptExtension: z.array(z.string()).optional(),
        getOperation: fileManagerOperationSchema,
        uploadOperation: fileManagerOperationSchema,
        deleteOperation: fileManagerOperationSchema,
        viewOperation: fileManagerOperationSchema,
        downloadOperation: fileManagerOperationSchema,
        validations: fileManagerValidationsSchema.optional(),
        pagination: z
          .object({
            pageSize: z.number().int().min(1).optional(),
          })
          .strip()
          .optional(),
        labels: fileManagerLabelsSchema.optional(),
      })
      .strip(),
  })
  .strip()

export const supportedToggleLabelPositions = ['top', 'inline'] as const

export const toggleNodeSchema = z
  .object({
    type: z.literal('toggle'),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        fieldId: nonEmptyStringSchema,
        label: z.string(),
        tooltip: z.string().optional(),
        labelPosition: z.enum(supportedToggleLabelPositions).optional(),
        defaultValue: z.union([z.boolean(), z.string()]).optional(),
        validations: formFieldValidationsSchema.optional(),
      })
      .strip(),
  })
  .strip()

export const hiddenNodeSchema = z
  .object({
    type: z.literal('hidden'),
    props: z
      .object({
        fieldId: nonEmptyStringSchema,
        value: z.union([z.string(), z.number(), z.boolean()]),
      })
      .strip(),
  })
  .strip()

export const runtimeTokenRefreshSchema = z
  .object({
    operation: nonEmptyStringSchema,
    responsePath: nonEmptyStringSchema,
    intervalSeconds: z.number().int().positive(),
  })
  .strip()

export const runtimeTokenConfigSchema = z
  .object({
    value: nonEmptyStringSchema,
    refresh: runtimeTokenRefreshSchema.optional(),
  })
  .strip()

export const runtimeTokensConfigSchema = z.record(nonEmptyStringSchema, runtimeTokenConfigSchema)

export const supportedCaptureValues = ['environment', 'user'] as const

const fileInputValidationsSchema = z
  .object({
    required: z.object({ value: z.literal(true), message: z.string().optional() }).strip().optional(),
    accept: z.object({ value: z.array(z.string()).nonempty(), message: z.string().optional() }).strip().optional(),
    maxFileSize: z.object({ value: z.number().positive(), message: z.string().optional() }).strip().optional(),
    maxTotalSize: z.object({ value: z.number().positive(), message: z.string().optional() }).strip().optional(),
    minFiles: z.object({ value: z.number().int().positive(), message: z.string().optional() }).strip().optional(),
    maxFiles: z.object({ value: z.number().int().positive(), message: z.string().optional() }).strip().optional(),
    validFileNames: z.object({ value: z.array(z.string()).nonempty(), message: z.string().optional() }).strip().optional(),
  })
  .strip()

export const fileInputNodeSchema = z
  .object({
    type: z.literal('fileInput'),
    id: nodeIdSchema.optional(),
    queryStateFeedback: queryStateFeedbackSchema.optional(),
    visibility: visibilitySchema.optional(),
    layout: layoutNodeLayoutSchema.optional(),
    props: z
      .object({
        fieldId: nonEmptyStringSchema,
        label: z.string(),
        tooltip: z.string().optional(),
        multiple: z.boolean().optional(),
        capture: z.enum(supportedCaptureValues).optional(),
        validations: fileInputValidationsSchema.optional(),
      })
      .strip(),
  })
  .strip()

// --- Shell (app-wide header) -------------------------------------------------------------
// Additive root block, independent from the page layout tree. Uses `.strict()` throughout
// (unlike most node schemas above, which `.strip()` extra keys) so the contract stays closed
// and future unknown keys surface as validation errors instead of being silently dropped.

// Fields shared by the root `menuItem` and its `menuItemChild` entries. `href`/`action` mirror
// the same shape used by `link.props.href`/`link.props.action`. The mutually exclusive
// combination with `children` (only added on the root variant below) is enforced by
// `refineMenuItemShape` via `superRefine` so it is detected during Zod parsing and never needs
// to be duplicated by cross-validation code later.
const menuItemFieldsSchema = z
  .object({
    label: z.string(),
    icon: z.string().optional(),
    visibility: visibilitySchema.optional(),
    href: z.string().optional(),
    action: z.discriminatedUnion('type', [navigateToButtonActionSchema, goBackButtonActionSchema]).optional(),
  })
  .strict()

const refineMenuItemShape = (
  data: { href?: string; action?: unknown; children?: unknown[] },
  ctx: z.RefinementCtx,
): void => {
  const hasHref = data.href !== undefined
  const hasAction = data.action !== undefined
  const hasChildren = data.children !== undefined

  if (hasChildren && (hasHref || hasAction)) {
    ctx.addIssue({
      code: 'custom',
      path: hasHref ? ['href'] : ['action'],
      message: 'Menu items with children cannot declare href or action.',
    })
    return
  }

  if (hasHref && hasAction) {
    ctx.addIssue({
      code: 'custom',
      path: ['href'],
      message: 'Menu items cannot declare both href and action.',
    })
    return
  }

  if (!hasHref && !hasAction && !hasChildren) {
    ctx.addIssue({
      code: 'custom',
      path: [],
      message: 'Menu items must declare either href, action or children.',
    })
  }
}

// `menuItemChild` never accepts `children` itself: the key is absent from this schema's
// shape, so `.strict()` rejects it at the Zod level rather than relying on the refinement.
const menuItemChildSchema = menuItemFieldsSchema.superRefine(refineMenuItemShape)

export const menuItemSchema = menuItemFieldsSchema
  .extend({
    children: z.array(menuItemChildSchema).nonempty().optional(),
  })
  .superRefine(refineMenuItemShape)

// Restricted to `link`/`button` only — reuses the exact node schemas already defined above.
export const shellHeaderActionNodeSchema = z.discriminatedUnion('type', [linkNodeSchema, buttonNodeSchema])

export const shellHeaderSchema = z
  .object({
    // Same shape as `image.props` (already validated above), without the `type` wrapper.
    logo: imagePropsSchema.optional(),
    title: z.string().optional(),
    menu: z.array(menuItemSchema).optional(),
    actions: z.array(shellHeaderActionNodeSchema).optional(),
  })
  .strict()

// `.strict()` keeps `shell` closed today: an unknown key like a future `sidebar` is rejected
// instead of silently stripped, making the additive-only intent explicit.
export const shellSchema = z
  .object({
    header: shellHeaderSchema.optional(),
  })
  .strict()
