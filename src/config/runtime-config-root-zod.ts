import { z } from 'zod'
import {
  buttonNodeSchema,
  checkboxGroupNodeSchema,
  containerNodeSchema,
  formNodeSchema,
  headingNodeSchema,
  imageNodeSchema,
  inputNodeSchema,
  listNodeSchema,
  modalNodeSchema,
  paragraphNodeSchema,
  radioGroupNodeSchema,
  repeaterNodeSchema,
  runtimeApiOperationShellSchema,
  selectNodeSchema,
  tableNodeSchema,
  textareaNodeSchema,
} from './runtime-config-zod'

// Lazy recursive schema — resolved at parse time, after all loose schemas are initialized
const layoutNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    containerNodeLooseSchema,
    repeaterNodeLooseSchema,
    formNodeLooseSchema,
    modalNodeLooseSchema,
    headingNodeSchema,
    paragraphNodeSchema,
    listNodeSchema,
    imageNodeSchema,
    tableNodeSchema,
    buttonNodeSchema,
    inputNodeSchema,
    textareaNodeSchema,
    selectNodeSchema,
    radioGroupNodeSchema,
    checkboxGroupNodeSchema,
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
    layout: z.array(layoutNodeSchema),
  })
  .strip()

export const runtimeConfigRootSchema = z
  .object({
    api: z.record(z.string(), runtimeApiOperationShellSchema),
    pages: z.array(runtimePageRootSchema),
    initialPage: z.string().min(1),
  })
  .strip()
