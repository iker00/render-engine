import type { LayoutNode } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { getNodeTypeJsonSchema } from './layout-canvas-node-schema'
import { resolveAncestorContainerColumns } from './resolve-ancestor-container-columns'

export type NodePanelTabKey = 'props' | 'layout' | 'visibility' | 'queryStateFeedback'

export interface NodePanelTab {
  key: NodePanelTabKey
  label: string
}

const TAB_LABELS: Record<NodePanelTabKey, string> = {
  props: 'Props',
  layout: 'Diseño',
  visibility: 'Visibilidad',
  queryStateFeedback: 'Queries',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Resolves which tabs exist for `node`'s panel, and in what order — the single source of truth
 * for the tab bar (FR2). Order is fixed: Props, Diseño, Visibilidad, Queries, omitting whichever
 * don't exist for this node/context.
 *
 * `props`/`visibility`/`queryStateFeedback` exist when `getNodeTypeJsonSchema(node.type).properties`
 * declares that key as an object — the same criterion `LayoutCanvasPropertiesPanel`'s `SUBSECTIONS`
 * filter already uses. `layout` is different: it exists only when `context.pageLayout` is provided
 * and `resolveAncestorContainerColumns` finds a `container` ancestor with `columns` declared —
 * without a `pageLayout` (the `Shell` case), `Diseño` never exists, regardless of the node's schema.
 *
 * T5 (0133): `props` also exists when the schema declares `submitAction` even without a `props` key
 * of its own — `formNodeSchema` is the only node schema with no `props` field at all, but the panel
 * still needs a `Props` tab for `form` nodes so the "Acción de envío" special block (which now
 * renders at the top of that tabpanel, not standalone) has somewhere to mount. `renderTabContent`
 * simply renders nothing below it in that case, since there's no dispatcher-driven `props` schema.
 */
export function resolveNodePanelTabs(
  node: LayoutNode,
  context: { pageLayout?: readonly LayoutNode[]; path: LayoutNodePath },
): NodePanelTab[] {
  const schema = getNodeTypeJsonSchema(node.type)
  const schemaProperties = isPlainObject(schema.properties) ? schema.properties : {}

  const tabs: NodePanelTab[] = []

  if (isPlainObject(schemaProperties.props) || isPlainObject(schemaProperties.submitAction)) {
    tabs.push({ key: 'props', label: TAB_LABELS.props })
  }

  if (context.pageLayout && resolveAncestorContainerColumns(context.pageLayout, context.path) !== null) {
    tabs.push({ key: 'layout', label: TAB_LABELS.layout })
  }

  if (isPlainObject(schemaProperties.visibility)) {
    tabs.push({ key: 'visibility', label: TAB_LABELS.visibility })
  }

  if (isPlainObject(schemaProperties.queryStateFeedback)) {
    tabs.push({ key: 'queryStateFeedback', label: TAB_LABELS.queryStateFeedback })
  }

  return tabs
}
