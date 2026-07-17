import type { LayoutNode } from '../../config/runtime-config'
import type { LayoutNodePath } from '../../runtime/layout-node-path'
import { getNodeTypeJsonSchema } from './layout-canvas-node-schema'
import { PropertyFieldDispatcher } from './property-fields/property-field-dispatcher'

export interface LayoutCanvasPropertiesPanelProps {
  node: LayoutNode
  path: LayoutNodePath
  onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void
  // T16/FR9: deletes the selected node (and its subtree) via the same
  // `commitCanvasMutation` pipeline T14/T15 already use — no second commit path. Optional so
  // callers that only need read/edit (e.g. the panel-only unit tests above, which render this
  // component in isolation without a delete pipeline wired) don't have to pass it; when absent,
  // no delete action renders at all rather than rendering a dead button.
  onDeleteNode?: () => void
}

type NodeSubsectionKey = 'props' | 'layout' | 'visibility' | 'queryStateFeedback'

const SUBSECTIONS: ReadonlyArray<{ key: NodeSubsectionKey; label: string }> = [
  { key: 'props', label: 'Props' },
  { key: 'layout', label: 'Layout' },
  { key: 'visibility', label: 'Visibilidad' },
  { key: 'queryStateFeedback', label: 'Estado de consulta' },
]

// `LayoutNode` is a union of ~27 node-type interfaces; not every member declares
// every subsection (e.g. `hidden` has neither `layout` nor `visibility`/
// `queryStateFeedback` — see runtime-config-types.ts). Reading/writing a
// subsection by a dynamic key needs a generic cast, the same pattern
// `layout-tree-mutations.ts` uses for the `children` field.
function readSubsection(node: LayoutNode, key: NodeSubsectionKey): unknown {
  return (node as unknown as Record<NodeSubsectionKey, unknown>)[key]
}

function withSubsection(node: LayoutNode, key: NodeSubsectionKey, value: unknown): LayoutNode {
  return { ...(node as unknown as Record<string, unknown>), [key]: value } as unknown as LayoutNode
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * `PropertyFieldDispatcher` (T8) resolves plain JSON Schema `type`s but has no
 * notion of `anyOf`/`oneOf` (zod `.union()`/`.discriminatedUnion()` output) — an
 * unresolved union falls back to its disabled raw-JSON escape hatch. Two fields
 * relevant to this panel are unions in the generated schema: `layout.span`
 * (integer | responsive per-breakpoint map) and a node's own `visibility`
 * (single condition | group). Resolving the branch that matches the current
 * value's shape here is what keeps both fields genuinely editable.
 */
function resolveUnionBranch(
  schema: Record<string, unknown> | undefined,
  value: unknown,
): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== 'object') return schema

  const branches = (
    Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined
  ) as Record<string, unknown>[] | undefined
  if (!branches || branches.length === 0) return schema

  if (!isPlainObject(value)) {
    return branches.find((branch) => branch.type !== 'object') ?? branches[0]
  }

  const matchByRequiredKeys = branches.find((branch) => {
    if (branch.type !== 'object') return false
    const required = Array.isArray(branch.required) ? (branch.required as string[]) : []
    return required.every((key) => key in value)
  })
  return matchByRequiredKeys ?? branches.find((branch) => branch.type === 'object') ?? branches[0]
}

/**
 * `layout.span` is nested one level inside the `layout` subsection, so the
 * generic top-level `resolveUnionBranch` call for that subsection never reaches
 * it. Editing it must preserve breakpoint keys not touched by the current edit
 * (e.g. editing `md` on `{ sm: 6, lg: 4 }` must not drop `lg`) — resolving the
 * matching union branch here, before delegating to the dispatcher, is what makes
 * the dispatcher's own object-field merge (`{ ...value, [key]: nextValue }`)
 * apply to `span` instead of falling back to the disabled raw-JSON escape hatch.
 */
function resolveLayoutSubsectionSchema(
  layoutSchema: Record<string, unknown>,
  currentLayoutValue: unknown,
): Record<string, unknown> {
  const properties = layoutSchema.properties
  if (!isPlainObject(properties)) return layoutSchema

  const spanSchema = properties.span
  if (!spanSchema || typeof spanSchema !== 'object') return layoutSchema

  const currentSpanValue = isPlainObject(currentLayoutValue) ? currentLayoutValue.span : undefined

  return {
    ...layoutSchema,
    properties: {
      ...properties,
      span: resolveUnionBranch(spanSchema as Record<string, unknown>, currentSpanValue),
    },
  }
}

/**
 * Edits `props`, `layout`, `visibility` and `queryStateFeedback` for the
 * selected node, rendering only the subsections the node's own generated JSON
 * Schema (T7) declares. Every editable field comes from that schema — there is
 * no separate hardcoded list of properties per node type.
 *
 * Each subsection is dispatched to a single `PropertyFieldDispatcher` call; for
 * an object-typed subsection (`props`/`layout`/`queryStateFeedback`, and
 * `visibility` once its union branch is resolved) T8's own object handling
 * already renders one field per property and merges edits against the
 * subsection's current value, so per-field wiring does not need to be
 * duplicated here.
 */
export function LayoutCanvasPropertiesPanel({
  node,
  path,
  onCommitNodeUpdate,
  onDeleteNode,
}: LayoutCanvasPropertiesPanelProps) {
  const nodeSchema = getNodeTypeJsonSchema(node.type)
  const schemaProperties = isPlainObject(nodeSchema.properties) ? nodeSchema.properties : {}

  return (
    <div
      data-testid="layout-canvas-properties-panel"
      className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-3"
    >
      {onDeleteNode !== undefined && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-3">
          <span className="text-xs font-medium text-gray-600">{node.type}</span>
          <button
            type="button"
            data-testid="layout-canvas-delete-node-button"
            onClick={onDeleteNode}
            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar nodo
          </button>
        </div>
      )}
      {SUBSECTIONS.map(({ key, label }) => {
        const subsectionSchema = schemaProperties[key]
        if (!subsectionSchema || typeof subsectionSchema !== 'object') return null

        const currentValue = readSubsection(node, key)
        const effectiveSchema =
          key === 'layout'
            ? resolveLayoutSubsectionSchema(subsectionSchema as Record<string, unknown>, currentValue)
            : resolveUnionBranch(subsectionSchema as Record<string, unknown>, currentValue)

        return (
          <PropertyFieldDispatcher
            key={key}
            schema={effectiveSchema}
            value={currentValue ?? {}}
            label={label}
            onChange={(nextValue) => {
              onCommitNodeUpdate(path, (currentNode) => withSubsection(currentNode, key, nextValue))
            }}
          />
        )
      })}
    </div>
  )
}
