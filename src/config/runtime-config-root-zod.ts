import { z } from 'zod'
import {
  accordionNodeSchema,
  alertNodeSchema,
  autocompleteNodeSchema,
  badgeNodeSchema,
  buttonNodeSchema,
  chartNodeSchema,
  checkboxGroupNodeSchema,
  containerNodeSchema,
  dividerNodeSchema,
  fileInputNodeSchema,
  fileManagerNodeSchema,
  formNodeSchema,
  galleryNodeSchema,
  groupInstanceNodeSchema,
  headingNodeSchema,
  imageNodeSchema,
  inputNodeSchema,
  linkNodeSchema,
  listNodeSchema,
  mapNodeSchema,
  modalNodeSchema,
  nonEmptyStringSchema,
  paragraphNodeSchema,
  radioGroupNodeSchema,
  repeaterNodeSchema,
  runtimeApiOperationShellSchema,
  runtimeGroupEntrySchema,
  runtimeTokensConfigSchema,
  runtimeTranslationsSchema,
  selectNodeSchema,
  shellSchema,
  skeletonNodeSchema,
  slotNodeSchema,
  statNodeSchema,
  stepsNodeSchema,
  tabsNodeSchema,
  tableNodeSchema,
  textareaNodeSchema,
  toggleNodeSchema,
  hiddenNodeSchema,
} from './runtime-config-zod'

// Lazy recursive schema — resolved at parse time, after all loose schemas are initialized
const layoutNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    containerNodeLooseSchema,
    repeaterNodeLooseSchema,
    formNodeLooseSchema,
    modalNodeLooseSchema,
    tabsNodeLooseSchema,
    stepsNodeLooseSchema,
    accordionNodeLooseSchema,
    headingNodeSchema,
    paragraphNodeSchema,
    listNodeSchema,
    imageNodeSchema,
    tableNodeSchema,
    buttonNodeSchema,
    linkNodeSchema,
    inputNodeSchema,
    textareaNodeSchema,
    selectNodeSchema,
    radioGroupNodeSchema,
    checkboxGroupNodeSchema,
    badgeNodeSchema,
    alertNodeSchema,
    statNodeSchema,
    dividerNodeSchema,
    skeletonNodeSchema,
    fileManagerNodeSchema,
    fileInputNodeSchema,
    toggleNodeSchema,
    hiddenNodeSchema,
    groupInstanceNodeLooseSchema,
    slotNodeSchema,
    mapNodeSchema,
    galleryNodeSchema,
    chartNodeSchema,
    autocompleteNodeSchema,
  ]),
)

// Loose versions replace z.unknown() in children/template with the recursive union
const containerNodeLooseSchema = containerNodeSchema.extend({
  children: z.array(layoutNodeSchema).optional(),
})

const formNodeLooseSchema = formNodeSchema.extend({
  children: z.array(layoutNodeSchema).optional(),
})

const modalNodeLooseSchema = modalNodeSchema.extend({
  children: z.array(layoutNodeSchema).optional(),
})

// tabs items children are overridden to use recursive layoutNodeSchema
const tabsNodeLooseSchema = tabsNodeSchema.extend({
  props: z
    .object({
      orientation: z.enum(['horizontal', 'vertical']).optional(),
      defaultTab: z.number().int().min(0).optional(),
      items: z
        .array(
          z
            .object({
              label: z.string(),
              children: z.array(layoutNodeSchema).optional(),
            })
            .strip(),
        )
        .min(1),
    })
    .strip(),
})

// steps items children are overridden to use recursive layoutNodeSchema
const stepsNodeLooseSchema = stepsNodeSchema.extend({
  props: z
    .object({
      variant: z.enum(['horizontal', 'vertical', 'progress']).optional(),
      backLabel: z.string().optional(),
      nextLabel: z.string().optional(),
      submitLabel: z.string().optional(),
      items: z
        .array(
          z
            .object({
              label: z.string(),
              children: z.array(layoutNodeSchema).optional(),
            })
            .strip(),
        )
        .min(1),
    })
    .strip(),
})

const accordionNodeLooseSchema = accordionNodeSchema.extend({
  children: z.array(layoutNodeSchema).optional(),
})

const groupInstanceNodeLooseSchema = groupInstanceNodeSchema.extend({
  children: z.array(layoutNodeSchema).optional(),
})

// `groups.{groupId}.template` is overridden the same way `repeater.props.template` is: the
// structural shape (`params`, `template: array`) is defined once in `runtime-config-zod.ts`, and
// `template` is widened here to accept the recursive layout node union.
const runtimeGroupEntryLooseSchema = runtimeGroupEntrySchema.extend({
  template: z.array(layoutNodeSchema),
})

const runtimeGroupsConfigLooseSchema = z.record(nonEmptyStringSchema, runtimeGroupEntryLooseSchema)

// repeater.props.template is overridden directly; items/pagination keep the original shape
const repeaterNodeLooseSchema = repeaterNodeSchema.extend({
  props: z
    .object({
      items: z.object({ source: z.string().min(1), key: z.string().min(1) }).strip(),
      pagination: z.unknown().optional(),
      template: z.array(layoutNodeSchema),
    })
    .strip(),
})

const runtimePageRootSchema = z
  .object({
    id: z.string().min(1),
    preloads: z.array(z.unknown()).optional(),
    title: z.string().optional(),
    layout: z.array(layoutNodeSchema),
  })
  .strip()

export const runtimeConfigRootSchema = z
  .object({
    api: z.record(z.string(), runtimeApiOperationShellSchema),
    pages: z.array(runtimePageRootSchema),
    initialPage: z.string().min(1),
    translations: runtimeTranslationsSchema.optional(),
    tokens: runtimeTokensConfigSchema.optional(),
    shell: shellSchema.optional(),
    groups: runtimeGroupsConfigLooseSchema.optional(),
  })
  .strip()
