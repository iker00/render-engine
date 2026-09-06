// Same rationale as dev-runtime-json-schema.ts: zod-to-json-schema@3.x does not support Zod v4
// internals, so this relies exclusively on the built-in Zod v4 `toJSONSchema`.
import { toJSONSchema, z } from 'zod'
import type { LayoutNodeType } from '../../config/runtime-config-types'
import { injectConditionGroupWidgetSentinel } from './property-fields/inject-condition-group-widget-sentinel'
import { injectNavigateParamsWidgetSentinel } from './property-fields/inject-navigate-params-widget-sentinel'
import {
  accordionNodeSchema,
  alertNodeSchema,
  autocompleteNodeSchema,
  badgeNodeSchema,
  buttonNodeSchema,
  checkboxGroupNodeSchema,
  containerNodeSchema,
  dividerNodeSchema,
  fileInputNodeSchema,
  fileManagerNodeSchema,
  formNodeSchema,
  galleryNodeSchema,
  groupInstanceNodeSchema,
  headingNodeSchema,
  hiddenNodeSchema,
  imageNodeSchema,
  inputNodeSchema,
  linkNodeSchema,
  listNodeSchema,
  mapNodeSchema,
  modalNodeSchema,
  paragraphNodeSchema,
  radioGroupNodeSchema,
  repeaterNodeSchema,
  selectNodeSchema,
  skeletonNodeSchema,
  slotNodeSchema,
  statNodeSchema,
  stepsNodeSchema,
  supportedNodeTypes,
  tableNodeSchema,
  tabsNodeSchema,
  textareaNodeSchema,
  toggleNodeSchema,
} from '../../config/runtime-config-zod'

// `group`/`slot` are structurally part of the catalog (`supportedNodeTypes`, T06) but are not yet
// wired into the visual editor — palette insertion, default instance and property panel support
// for reusable node groups is T15's responsibility. Excluded here so the palette and drag-id
// parsing keep listing exactly the node types users can already insert (regression-free).
const NODE_TYPES_NOT_YET_INSERTABLE_FROM_PALETTE: ReadonlySet<LayoutNodeType> = new Set(['group', 'slot'])

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
  steps: stepsNodeSchema,
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
  map: mapNodeSchema,
  gallery: galleryNodeSchema,
  autocomplete: autocompleteNodeSchema,
  group: groupInstanceNodeSchema,
  slot: slotNodeSchema,
}

const cachedSchemaByType = new Map<LayoutNodeType, Record<string, unknown>>()

export function getNodeTypeJsonSchema(type: LayoutNodeType): Record<string, unknown> {
  const cached = cachedSchemaByType.get(type)
  if (cached) {
    return cached
  }
  const rawSchema = toJSONSchema(nodeSchemaByType[type]) as unknown as Record<string, unknown>
  // T3 (0132): every `visibility`/`when` sub-schema (node root, and each action variant's
  // `executeOperations.operations[].when` inside `props.action.oneOf[...]`) is replaced once here,
  // on the cold cache path, so the properties panel and its dispatcher never see the raw union —
  // they only ever get the `x-widget: 'condition-group'` sentinel.
  const schemaWithConditionGroups = injectConditionGroupWidgetSentinel(rawSchema)
  // T3 (0141): chained on the same cold cache path — swaps every `navigateTo` action variant's
  // `properties.params` for the `x-widget: 'navigate-params'` sentinel. Independent key
  // (`params` vs. `visibility`/`when`), so the two transforms never touch the same sub-schema.
  const schema = injectNavigateParamsWidgetSentinel(schemaWithConditionGroups)
  cachedSchemaByType.set(type, schema)
  return schema
}

export function getSupportedNodeTypesCatalog(): LayoutNodeType[] {
  return supportedNodeTypes.filter((type) => !NODE_TYPES_NOT_YET_INSERTABLE_FROM_PALETTE.has(type))
}
