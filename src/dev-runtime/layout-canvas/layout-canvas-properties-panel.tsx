import { useEffect, useState } from 'react'
import type { LayoutNode, RuntimeConfigError } from '../../config/runtime-config'
import { serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'
import type { CommitCanvasMutationResult } from './layout-canvas-commit'
import { getNodeTypeJsonSchema } from './layout-canvas-node-schema'
import { PropertyFieldDispatcher, resolveUnionBranch } from './property-fields/property-field-dispatcher'

export interface LayoutCanvasPropertiesPanelProps {
  node: LayoutNode
  path: LayoutNodePath
  onCommitNodeUpdate: (
    path: LayoutNodePath,
    updater: (node: LayoutNode) => LayoutNode,
  ) => CommitCanvasMutationResult | void
  // T16/FR9: deletes the selected node (and its subtree) via the same
  // `commitCanvasMutation` pipeline T14/T15 already use — no second commit path. Optional so
  // callers that only need read/edit (e.g. the panel-only unit tests above, which render this
  // component in isolation without a delete pipeline wired) don't have to pass it; when absent,
  // no delete action renders at all rather than rendering a dead button.
  onDeleteNode?: () => void
}

type NodeSubsectionKey = 'props' | 'layout' | 'visibility' | 'queryStateFeedback'

// T9: the key used to track a rejected commit for the `submitAction` block, which lives
// outside `SUBSECTIONS` (see `buildSubmitActionFieldValue` below).
type PendingRejectionKey = NodeSubsectionKey | 'submitAction'

// T9 (bug fix): `commitCanvasMutation` validates the *entire* config before applying a panel
// commit (see dev-runtime.tsx). Switching a discriminated-union variant (T5) or adding a new
// array entry can produce a momentarily invalid full config (e.g. a required string field that
// starts out as `''`) — the commit is then rejected and `currentConfig` never changes. Without
// this state, the field derives its displayed value straight from `node`, so it would silently
// "snap back" to the pre-change variant with no feedback. `pendingRejections` remembers, per
// subsection, the last value the user tried to commit and the error that rejected it, purely for
// local re-rendering — it is never written into `currentConfig`.
type PendingRejections = Partial<Record<PendingRejectionKey, { value: unknown; error: RuntimeConfigError }>>

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

// T8: choosing "Sin acción" in the discriminated-union action selector (T5) resolves to
// `{ ...subsection, action: undefined }` rather than dropping the key outright — the dispatcher
// clears a variant by setting its value to `undefined`, not by removing it. Committing that as-is
// would leave a literal `"action": undefined` key in the node (and its serialized Monaco JSON).
// This strips `undefined`-valued keys recursively, at any depth, right before commit. Scoped to
// plain objects only: arrays and primitives pass through unchanged, since none of the current
// subsection editors produce `undefined` entries inside arrays.
function stripUndefined<T>(value: T): T {
  if (!isPlainObject(value)) return value
  const result: Record<string, unknown> = {}
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === undefined) continue
    result[key] = isPlainObject(entryValue) ? stripUndefined(entryValue) : entryValue
  }
  return result as T
}

type FormNode = Extract<LayoutNode, { type: 'form' }>

/**
 * `submitAction` is a special case, handled separately from `SUBSECTIONS` (T5): the generated JSON
 * Schema for `formNodeSchema.submitAction` nests `onSuccess`/`onError` inside each variant branch
 * (matching the raw config shape `formSubmitActionSchema` validates), but the in-memory
 * `FormLayoutNode` stores `submitAction`, `onSuccess` and `onError` as three separate sibling
 * fields (see `validate-form-nodes.ts`, which splits them apart, and `layout-canvas-commit.ts`'s
 * `denormalizeFormNode`, which nests them back for serialization). These two functions bridge that
 * gap for the dispatcher, which only ever sees the schema's own (nested) shape.
 */
function buildSubmitActionFieldValue(node: FormNode): unknown {
  if (node.submitAction === undefined) return undefined
  return {
    ...node.submitAction,
    ...(node.onSuccess !== undefined ? { onSuccess: node.onSuccess } : {}),
    ...(node.onError !== undefined ? { onError: node.onError } : {}),
  }
}

// Inverse of `buildSubmitActionFieldValue`: splits the dispatcher's nested value back into the
// three flattened fields `FormLayoutNode` actually stores.
function withSubmitActionField(node: FormNode, nextValue: unknown): FormNode {
  if (nextValue === undefined) {
    return { ...node, submitAction: undefined, onSuccess: undefined, onError: undefined }
  }
  const { onSuccess, onError, ...restAction } = nextValue as Record<string, unknown>
  return {
    ...node,
    submitAction: restAction as unknown as FormNode['submitAction'],
    onSuccess: onSuccess as FormNode['onSuccess'],
    onError: onError as FormNode['onError'],
  }
}

// RF2 (0105): label seeded onto a brand-new `tabs.props.items` entry via `handleAdd`'s generic
// default-object builder (property-field-dispatcher.tsx). Named so a future copy change stays a
// one-line edit.
const NEW_TAB_DEFAULT_LABEL = 'Nueva pestaña'

/**
 * The generated schema for `tabs.props.items[]` mirrors the runtime contract literally, which
 * includes `children` — an arbitrary nested `LayoutNode[]` subtree that the generic property-field
 * dispatcher has no way to represent as a form field (it would fall back to an unusable/disabled
 * raw-JSON escape hatch). RF2 (0105) excludes it from the generic editor: tab content stays
 * editable only via canvas drag/drop and Monaco, never through this per-item form.
 *
 * This also seeds `label`'s sub-schema with a non-empty `default`, consumed by the dispatcher's
 * object-default builder when "Añadir" creates a new item, so a fresh tab starts with a usable
 * label instead of an empty string. `minItems` is preserved from the generated schema (already
 * `1` from the zod `.min(1)` on `tabs.props.items`) with a defensive fallback to `1` — the node
 * schema is this function's only input, so if it ever stopped declaring the minimum this keeps
 * the "at least one tab" guarantee the properties panel must honor.
 */
function resolveTabsPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties)) return propsSchema

  const itemsFieldSchema = properties.items
  if (!itemsFieldSchema || typeof itemsFieldSchema !== 'object') return propsSchema
  const itemsFieldRecord = itemsFieldSchema as Record<string, unknown>

  const itemSchema = itemsFieldRecord.items
  if (!itemSchema || typeof itemSchema !== 'object') return propsSchema
  const itemRecord = itemSchema as Record<string, unknown>

  const itemProperties = itemRecord.properties
  if (!isPlainObject(itemProperties)) return propsSchema

  const visibleItemProperties: Record<string, unknown> = {}
  for (const [propertyKey, propertySchema] of Object.entries(itemProperties)) {
    if (propertyKey === 'children') continue
    visibleItemProperties[propertyKey] = propertySchema
  }
  const labelSchema = visibleItemProperties.label
  const nextItemProperties =
    labelSchema && typeof labelSchema === 'object'
      ? { ...visibleItemProperties, label: { ...(labelSchema as Record<string, unknown>), default: NEW_TAB_DEFAULT_LABEL } }
      : visibleItemProperties

  return {
    ...propsSchema,
    properties: {
      ...properties,
      items: {
        ...itemsFieldRecord,
        minItems: typeof itemsFieldRecord.minItems === 'number' ? itemsFieldRecord.minItems : 1,
        items: {
          ...itemRecord,
          properties: nextItemProperties,
        },
      },
    },
  }
}

// T9: rendered under a subsection's `PropertyFieldDispatcher` when its last commit attempt was
// rejected by `commitCanvasMutation`. Same visual pattern as the error panel in
// `floating-monaco-panel.tsx` (bold error code, then `: `, then the message).
function CommitRejectionBanner({ dataTestId, error }: { dataTestId: string; error: RuntimeConfigError }) {
  return (
    <div
      role="alert"
      data-testid={dataTestId}
      className="rounded bg-red-50 px-3 py-2 text-xs text-red-800"
    >
      No se pudo guardar este cambio: <span className="font-medium">{error.code}</span>
      {': '}
      {error.message}
    </div>
  )
}

/**
 * Edits `props`, `layout`, `visibility` and `queryStateFeedback` for the
 * selected node, rendering only the subsections the node's own generated JSON
 * Schema (T7) declares. Every editable field comes from that schema — there is
 * no separate hardcoded list of properties per node type.
 *
 * Each subsection is dispatched to a single top-level `PropertyFieldDispatcher`
 * call. The dispatcher itself only resolves plain JSON Schema `type`s, not a
 * union (`anyOf`/`oneOf`) passed as its own top-level `schema` — that's what
 * `resolveUnionBranch` handles here for `visibility`, which is a union at the
 * subsection's own root (single condition | group). `layout.span`, by
 * contrast, is a union nested one level inside the `layout` subsection's
 * `properties`, so it no longer needs a panel-specific resolver: the
 * dispatcher's own `ObjectPropertyField` recursion (T4) resolves it against
 * `layout.span`'s current value before rendering that nested field.
 *
 * T9: each subsection also tracks its own `pendingRejections` entry — the last value the user
 * tried to commit through this panel plus the error that rejected it — so a commit rejected by
 * `commitCanvasMutation`'s full-config validation still shows the user's own edit (and why it
 * didn't save) instead of silently reverting to the pre-edit value derived from `node`.
 */
export function LayoutCanvasPropertiesPanel({
  node,
  path,
  onCommitNodeUpdate,
  onDeleteNode,
}: LayoutCanvasPropertiesPanelProps) {
  const nodeSchema = getNodeTypeJsonSchema(node.type)
  const schemaProperties = isPlainObject(nodeSchema.properties) ? nodeSchema.properties : {}
  const submitActionSchema =
    node.type === 'form' && isPlainObject(schemaProperties.submitAction) ? (schemaProperties.submitAction as Record<string, unknown>) : undefined

  const [pendingRejections, setPendingRejections] = useState<PendingRejections>({})

  // Selecting a different node discards any rejection pending on the previously selected
  // node — it belongs to that node's edit, not this one. A successful commit on this node
  // clears its own entry explicitly below, so this effect must not also fire on every `node`
  // reference change (e.g. its own successful commit would otherwise race this reset).
  const serializedPath = serializeLayoutNodePath(path)
  useEffect(() => {
    setPendingRejections({})
  }, [serializedPath])

  function recordCommitResult(key: PendingRejectionKey, attemptedValue: unknown, result: CommitCanvasMutationResult | void) {
    if (result && result.status === 'rejected') {
      setPendingRejections((prev) => ({ ...prev, [key]: { value: attemptedValue, error: result.error } }))
      return
    }
    // `undefined` (a `vi.fn()` test double without `mockReturnValue`) is treated exactly like
    // `{ status: 'applied' }` — see design.md / T9 motivation for why this must not show a banner.
    setPendingRejections((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div
      data-testid="layout-canvas-properties-panel"
      className="flex shrink-0 flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-3"
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
        let effectiveSchema = resolveUnionBranch(subsectionSchema as Record<string, unknown>, currentValue)
        if (key === 'props' && node.type === 'tabs' && effectiveSchema) {
          effectiveSchema = resolveTabsPropsSchema(effectiveSchema)
        }

        const pendingRejection = pendingRejections[key]
        const displayedValue = pendingRejection ? pendingRejection.value : currentValue

        return (
          <div key={key} className="flex flex-col gap-2">
            <PropertyFieldDispatcher
              schema={effectiveSchema}
              value={displayedValue ?? {}}
              label={label}
              onChange={(nextValue) => {
                const sanitizedValue = stripUndefined(nextValue)
                const result = onCommitNodeUpdate(path, (currentNode) => withSubsection(currentNode, key, sanitizedValue))
                recordCommitResult(key, sanitizedValue, result)
              }}
            />
            {pendingRejection && (
              <CommitRejectionBanner
                dataTestId={`layout-canvas-properties-panel-${key}-error`}
                error={pendingRejection.error}
              />
            )}
          </div>
        )
      })}
      {node.type === 'form' &&
        submitActionSchema &&
        (() => {
          const pendingRejection = pendingRejections.submitAction
          const displayedValue = pendingRejection ? pendingRejection.value : buildSubmitActionFieldValue(node)

          return (
            <div className="flex flex-col gap-2">
              <PropertyFieldDispatcher
                schema={submitActionSchema}
                value={displayedValue}
                label="Acción de envío"
                onChange={(nextValue) => {
                  const result = onCommitNodeUpdate(path, (currentNode) =>
                    currentNode.type === 'form' ? withSubmitActionField(currentNode, nextValue) : currentNode,
                  )
                  recordCommitResult('submitAction', nextValue, result)
                }}
              />
              {pendingRejection && (
                <CommitRejectionBanner
                  dataTestId="layout-canvas-properties-panel-submitAction-error"
                  error={pendingRejection.error}
                />
              )}
            </div>
          )
        })()}
    </div>
  )
}
