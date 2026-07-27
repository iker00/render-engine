// Same rationale as dev-runtime-json-schema.ts: zod-to-json-schema@3.x does not support Zod v4
// internals, so this relies exclusively on the built-in Zod v4 `toJSONSchema`.
import { toJSONSchema, z } from 'zod'
import type { LayoutNodeType } from '../../config/runtime-config-types'
import {
  accordionNodeSchema,
  alertNodeSchema,
  badgeNodeSchema,
  buttonNodeSchema,
  checkboxGroupNodeSchema,
  containerNodeSchema,
  dividerNodeSchema,
  fileInputNodeSchema,
  fileManagerNodeSchema,
  formNodeSchema,
  headingNodeSchema,
  hiddenNodeSchema,
  imageNodeSchema,
  inputNodeSchema,
  linkNodeSchema,
  listNodeSchema,
  modalNodeSchema,
  paragraphNodeSchema,
  radioGroupNodeSchema,
  repeaterNodeSchema,
  selectNodeSchema,
  skeletonNodeSchema,
  statNodeSchema,
  supportedNodeTypes,
  tableNodeSchema,
  tabsNodeSchema,
  textareaNodeSchema,
  toggleNodeSchema,
} from '../../config/runtime-config-zod'

const nodeSchemaByType: Record<LayoutNodeType, z.ZodType> = {
  container: containerNodeSchema,
  repeater: repeaterNodeSchema,
  heading: headingNodeSchema,
  paragraph: paragraphNodeSchema,
  list: listNodeSchema,
  image: imageNodeSchema,
  table: tableNodeSchema,
  button: buttonNodeSchema,
  link: linkNodeSchema,
  form: formNodeSchema,
  input: inputNodeSchema,
  textarea: textareaNodeSchema,
  select: selectNodeSchema,
  radioGroup: radioGroupNodeSchema,
  checkboxGroup: checkboxGroupNodeSchema,
  modal: modalNodeSchema,
  tabs: tabsNodeSchema,
  accordion: accordionNodeSchema,
  badge: badgeNodeSchema,
  alert: alertNodeSchema,
  stat: statNodeSchema,
  divider: dividerNodeSchema,
  skeleton: skeletonNodeSchema,
  fileManager: fileManagerNodeSchema,
  fileInput: fileInputNodeSchema,
  toggle: toggleNodeSchema,
  hidden: hiddenNodeSchema,
}

const cachedSchemaByType = new Map<LayoutNodeType, Record<string, unknown>>()

export function getNodeTypeJsonSchema(type: LayoutNodeType): Record<string, unknown> {
  const cached = cachedSchemaByType.get(type)
  if (cached) {
    return cached
  }
  const schema = toJSONSchema(nodeSchemaByType[type]) as unknown as Record<string, unknown>
  cachedSchemaByType.set(type, schema)
  return schema
}

export function getSupportedNodeTypesCatalog(): LayoutNodeType[] {
  return [...supportedNodeTypes]
}
