import { Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import type {
  LayoutNode,
  QueryStateFeedbackConfig,
  QueryStateFeedbackVisibleState,
  RuntimeConfigError,
  RuntimeResponsiveBreakpoint,
  RuntimeResponsiveLayoutValue,
} from '../../config/runtime-config'
import type { RuntimeGroupsConfig } from '../../config/runtime-config-types'
import { serializeLayoutNodePath, type LayoutNodePath } from '../../runtime/layout-node-path'
import { CommitRejectionBanner } from '../commit-rejection-banner'
import { commitLayoutSpan } from './commit-layout-span'
import { LayoutCanvasBreadcrumb } from './layout-canvas-breadcrumb'
import type { CommitCanvasMutationResult } from './layout-canvas-commit'
import { getNodeTypeJsonSchema } from './layout-canvas-node-schema'
import { NodePanelTabBar } from './node-panel-tab-bar'
import { resolveNodePanelTabs, type NodePanelTabKey } from './node-panel-tabs'
import { ChartOriginModePropertyField } from './property-fields/chart-origin-mode-property-field'
import { ContainerColumnsModePropertyField } from './property-fields/container-columns-mode-property-field'
import { GalleryOriginModePropertyField } from './property-fields/gallery-origin-mode-property-field'
import { GroupInstancePropertyField } from './property-fields/group-instance-property-field'
import { LayoutSpanWidgetContext, type LayoutSpanRowRejection } from './property-fields/layout-span-widget-context'
import { LinkContentModePropertyField } from './property-fields/link-content-mode-property-field'
import { PropertyFieldDispatcher } from './property-fields/property-field-dispatcher'
import { PropertyFieldRow } from './property-fields/property-field-row'
import { resolveUnionBranch } from './property-fields/property-field-schema-resolution'
import {
  buildInitialQueryStateFeedbackFallbackCache,
  getPresentQueryStateFeedbackStates,
} from './property-fields/query-state-feedback-accordion-state'
import { QueryStateFeedbackAccordionWidgetContext } from './property-fields/query-state-feedback-accordion-widget-context'
import { TableRowsPropertyField } from './property-fields/table-rows-property-field'
import { resolveAncestorContainerColumns } from './resolve-ancestor-container-columns'

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
  // T2 (0127): the full page layout tree the selected node lives in, needed to resolve the
  // nearest `container` ancestor's `columns` (`resolveAncestorContainerColumns`, T1) and decide
  // whether the `Layout` subsection renders at all. Optional because some callers render this
  // panel for nodes that never live in a page's `layout` tree (e.g. `ShellActionsListEditor`'s
  // shell header actions) — for those, the subsection is simply omitted. T3 (0133): also gates
  // whether the header's breadcrumb renders at all — same "no page tree, no breadcrumb" rule.
  pageLayout?: readonly LayoutNode[]
  // T3 (0133): closes the panel (e.g. `FloatingSelectionOverlay` wires this to
  // `onSelectNode(null)`). Optional so callers with no notion of "closing" the panel (e.g.
  // `ShellActionsListEditor`'s per-row panel, which never floats/overlays anything) simply don't
  // render the close button.
  onClose?: () => void
  // T3 (0133): navigates the canvas selection to a breadcrumb ancestor segment. Only meaningful
  // (and only ever invoked) when `pageLayout` is also passed, since the breadcrumb itself doesn't
  // render otherwise.
  onSelectAncestor?: (path: LayoutNodePath) => void
  // T15 (feature reusable-node-groups): root `groups` block, needed only by the `group`
  // instance's special block (`GroupInstancePropertyField`) to list existing group ids and
  // resolve the chosen group's declared params. Optional — every other node type ignores it, and
  // callers with no notion of a real `groups` block (e.g. `ShellActionsListEditor`, which only
  // ever renders `button`/`link` nodes) simply don't pass it.
  groups?: RuntimeGroupsConfig
}

// Stable no-op passed to `LayoutCanvasBreadcrumb`'s required `onSelectNode` when the panel
// renders a breadcrumb (`pageLayout` given) but its own `onSelectAncestor` prop was left
// unset — see React Best Practices 4.5 (extract non-primitive defaults to a constant) for why
// this isn't an inline arrow function.
const NOOP_SELECT_ANCESTOR = (_path: LayoutNodePath): void => {}

// T9: the key used to track a rejected commit for the `submitAction` block, which commits the
// entire node rather than a single subsection (see `buildSubmitActionFieldValue` below), so it
// needs its own rejection-tracking key distinct from `props`. T5 (0128) adds
// `containerColumnsMode` for the same reason: the `container` "Modo" widget also commits the
// entire node. T5 (0133) moved both blocks (plus the `link` "Contenido" selector) to render at
// the top of the `Props` tabpanel; the dedicated keys are unaffected by where they render. T9
// (0138) adds `tableRows`: the `table` rows/columns/cells widget (T8) commits the entire node too
// (D4), for the same reason — `headers`/`rows`/`columns` must commit as one coordinated mutation.
// Feature 2026-08-25-14-49-gallery-node adds `galleryOriginMode`: the `gallery` "Origen" widget
// (Estático/Dinámico) also commits the entire node, for the same reason as `containerColumnsMode`.
// T15 adds `groupInstance`: the `group` node's "groupId + params" special block (D above) also
// commits the entire node, for the same reason as `containerColumnsMode`/`galleryOriginMode` —
// changing `groupId` must reset `params`/`children` in the same commit, not a per-subsection patch.
// T07 (feature chart-node) adds `chartVariant`/`chartOriginMode`: the `chart` node's "Tipo de
// chart" and "Origen" special blocks each commit the entire node too, for the same reason —
// changing `variant` must reset `data`/`source` together (`buildChartNodeForVariant`), and
// changing origin must reset `data`/`source` together (`ChartOriginModePropertyField`, T06).
type PendingRejectionKey =
  | NodePanelTabKey
  | 'submitAction'
  | 'containerColumnsMode'
  | 'tableRows'
  | 'repeaterGrid'
  | 'galleryOriginMode'
  | 'groupInstance'
  | 'chartVariant'
  | 'chartOriginMode'

// T9 (bug fix): `commitCanvasMutation` validates the *entire* config before applying a panel
// commit (see dev-runtime.tsx). Switching a discriminated-union variant (T5) or adding a new
// array entry can produce a momentarily invalid full config (e.g. a required string field that
// starts out as `''`) — the commit is then rejected and `currentConfig` never changes. Without
// this state, the field derives its displayed value straight from `node`, so it would silently
// "snap back" to the pre-change variant with no feedback. `pendingRejections` remembers, per
// subsection, the last value the user tried to commit and the error that rejected it, purely for
// local re-rendering — it is never written into `currentConfig`.
type PendingRejections = Partial<Record<PendingRejectionKey, { value: unknown; error: RuntimeConfigError }>>

// `LayoutNode` is a union of ~27 node-type interfaces; not every member declares
// every subsection (e.g. `hidden` has neither `layout` nor `visibility`/
// `queryStateFeedback` — see runtime-config-types.ts). Reading/writing a
// subsection by a dynamic key needs a generic cast, the same pattern
// `layout-tree-mutations.ts` uses for the `children` field.
function readSubsection(node: LayoutNode, key: NodePanelTabKey): unknown {
  return (node as unknown as Record<NodePanelTabKey, unknown>)[key]
}

function withSubsection(node: LayoutNode, key: NodePanelTabKey, value: unknown): LayoutNode {
  return { ...(node as unknown as Record<string, unknown>), [key]: value } as unknown as LayoutNode
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// T3 (0135): shared by the lazy initializers and the node-change reset guard below — both need the
// same extraction of `queryStateFeedback.states` off a given node.
function extractQueryStateFeedbackStates(node: LayoutNode): QueryStateFeedbackConfig['states'] {
  const queryStateFeedback = readSubsection(node, 'queryStateFeedback')
  return (isPlainObject(queryStateFeedback) ? queryStateFeedback.states : undefined) as QueryStateFeedbackConfig['states']
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

type ChartNode = Extract<LayoutNode, { type: 'chart' }>
type ChartVariant = ChartNode['props']['variant']

// T07 (feature chart-node): the six variants split into two point families — categorical
// (`bar`/`line`/`area`/`pie`/`donut`, x axis is a discrete category) and numeric (`scatter`, both
// axes are numbers). Crossing families requires reseeding `data`/`source` with a shape-correct
// template; staying within a family never touches them. `CHART_PIE_LIKE_VARIANTS` is the other
// axis of variation `buildChartNodeForVariant` cares about: `pie`/`donut` have no axes at all, so
// `color`/`label`/`xAxisLabel`/`yAxisLabel` (all meaningless there) are dropped on entry.
const CHART_VARIANTS: readonly ChartVariant[] = ['bar', 'line', 'area', 'pie', 'donut', 'scatter']
const CHART_NUMERIC_VARIANTS: ReadonlySet<ChartVariant> = new Set(['scatter'])
const CHART_PIE_LIKE_VARIANTS: ReadonlySet<ChartVariant> = new Set(['pie', 'donut'])

function isChartNumericVariant(variant: ChartVariant): boolean {
  return CHART_NUMERIC_VARIANTS.has(variant)
}

// Same minimal templates `ChartOriginModePropertyField` (T06) seeds when toggling origin — kept in
// sync by hand (both files are the only two producers of a fresh `chart.props.data`/`.source`
// value): a categorical/numeric static array of one point, or a categorical/numeric dynamic source
// object referencing a made-up `queries.query.data` collection.
const CHART_CATEGORICAL_STATIC_TEMPLATE: ChartNode['props']['data'] = [{ category: 'Ejemplo', value: 1 }]
const CHART_NUMERIC_STATIC_TEMPLATE: ChartNode['props']['data'] = [{ x: 0, y: 0 }]
const CHART_CATEGORICAL_DYNAMIC_TEMPLATE: ChartNode['props']['source'] = {
  source: 'queries.query.data',
  category: 'category',
  value: 'value',
}
const CHART_NUMERIC_DYNAMIC_TEMPLATE: ChartNode['props']['source'] = { source: 'queries.query.data', x: 'x', y: 'y' }

// Drops whichever origin key is currently active (`source` in dynamic mode, `data` in static mode)
// and reseeds it with the family-correct template for `nextVariant` — only called when the family
// actually changed (see `buildChartNodeForVariant` below).
function resetChartOriginTemplate(props: ChartNode['props'], nextVariant: ChartVariant): ChartNode['props'] {
  const isDynamic = 'source' in props
  if (isDynamic) {
    const { source: _source, ...rest } = props
    return { ...rest, source: isChartNumericVariant(nextVariant) ? CHART_NUMERIC_DYNAMIC_TEMPLATE : CHART_CATEGORICAL_DYNAMIC_TEMPLATE }
  }
  const { data: _data, ...rest } = props
  return { ...rest, data: isChartNumericVariant(nextVariant) ? CHART_NUMERIC_STATIC_TEMPLATE : CHART_CATEGORICAL_STATIC_TEMPLATE }
}

// `pie`/`donut` have no axes/series label to speak of — drops all four unconditionally. Leaving
// `pie`/`donut` towards a variant that does support them never re-seeds these keys (they stay
// absent until the user declares them again): this function is only ever called when *entering*
// `pie`/`donut`, never on the way out.
function dropChartAxisLabelFields(props: ChartNode['props']): ChartNode['props'] {
  const { color: _color, label: _label, xAxisLabel: _xAxisLabel, yAxisLabel: _yAxisLabel, ...rest } = props
  return rest
}

/**
 * Rebuilds the `chart` node's `props` for a new `variant` picked from the "Tipo de chart" special
 * block below (T07, D5). `data`/`source` pass through untouched when the point family
 * (categorical vs. numeric) stays the same; crossing families resets whichever origin is active
 * with the matching minimal template (`resetChartOriginTemplate`). Entering `pie`/`donut`
 * additionally drops the four axis/series label props (`dropChartAxisLabelFields`); `height`
 * always survives untouched, it has no relationship to `variant`.
 */
function buildChartNodeForVariant(node: ChartNode, nextVariant: ChartVariant): ChartNode {
  const familyChanged = isChartNumericVariant(node.props.variant) !== isChartNumericVariant(nextVariant)
  const propsAfterOriginReset = familyChanged ? resetChartOriginTemplate(node.props, nextVariant) : node.props
  const propsWithVariant = { ...propsAfterOriginReset, variant: nextVariant }

  const nextProps = CHART_PIE_LIKE_VARIANTS.has(nextVariant) ? dropChartAxisLabelFields(propsWithVariant) : propsWithVariant

  return { ...node, props: nextProps }
}

// D6 (0108): the node types whose `props.items` is the closed choice-items contract (T1) —
// manual literal, manual scalar, or dynamic with a mandatory `itemType` discriminator. None of
// these shapes share a common literal discriminant the dispatcher's generic union detectors could
// key off, so the panel routes them through the dedicated `ChoiceItemsPropertyField` widget (T4)
// instead, the same way `resolveTabsPropsSchema` routes `tabs.props.items` through a panel-specific
// adapter below.
const CHOICE_LIKE_NODE_TYPES: ReadonlySet<LayoutNode['type']> = new Set(['select', 'radioGroup', 'checkboxGroup', 'autocomplete'])

/**
 * Replaces the generated `oneOf` sub-schema of `props.items` (from Zod's `selectItemsSchema`
 * union, T1) with the `{ 'x-widget': 'choice-items' }` sentinel the dispatcher's `x-widget` hook
 * (T4) resolves to `ChoiceItemsPropertyField`. The rest of `props` — and its own schema-driven
 * fields — passes through unchanged; only the `items` sub-schema is swapped out, never derived
 * from the raw Zod union again. This keeps the union entirely out of the generic dispatcher path:
 * `resolveUnionBranch` never sees an `anyOf`/`oneOf` for `items` to (mis)resolve by shape.
 *
 * Same precedent as `resolveTabsPropsSchema` above: a panel-level adapter narrows one node type's
 * `props` schema before handing it to the dispatcher, without touching the dispatcher itself.
 */
function resolveChoiceLikePropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('items' in properties)) return propsSchema

  return {
    ...propsSchema,
    properties: {
      ...properties,
      items: { 'x-widget': 'choice-items' },
    },
  }
}

/**
 * Replaces the generated sub-schema of `heading.props.level` (Zod's `z.number()` on
 * `headingNodeSchema`, T7) with the `{ 'x-widget': 'heading-level' }` sentinel the dispatcher's
 * `x-widget` hook (T2, 0128) resolves to `HeadingLevelPropertyField`. Same pattern as
 * `resolveChoiceLikePropsSchema` above for `select.props.items`: only `properties.level` is
 * swapped out, the rest of `props` (`text`, `icon`) passes through unchanged.
 */
function resolveHeadingPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('level' in properties)) return propsSchema

  return {
    ...propsSchema,
    properties: {
      ...properties,
      level: { 'x-widget': 'heading-level' },
    },
  }
}

/**
 * Replaces the generated sub-schema of `props.icon` (Zod's `z.string().optional()`, declared
 * identically on `button`/`heading`/`paragraph`/`link`/`stat`/`input` in `runtime-config-zod.ts`)
 * with the `{ 'x-widget': 'icon' }` sentinel the dispatcher's `x-widget` hook (T2, 0129) resolves
 * to `IconPickerPropertyField`. Same swap-only-that-key pattern as `resolveHeadingPropsSchema`
 * above, but keyed purely by field-name convention rather than `node.type`: any node whose
 * generated `props` schema declares an `icon` property gets the widget, with no explicit list of
 * node types to maintain — a future node that reuses the same `icon: z.string().optional()` shape
 * inherits it automatically (spec risk 1, deliberate).
 */
function resolveIconPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('icon' in properties)) return propsSchema

  return {
    ...propsSchema,
    properties: {
      ...properties,
      icon: { 'x-widget': 'icon' },
    },
  }
}

/**
 * Replaces the generated sub-schema of `props.color` with the `{ 'x-widget': 'color-swatch' }`
 * sentinel (T2, 0134, FR3/FR4) the dispatcher's `x-widget` hook resolves to
 * `ColorSwatchPropertyField` — takes priority over the generic segmented (2-5 options)/`<select>`
 * enum branches, by construction of the dispatcher's `x-widget` check running before either.
 * Keyed by field-name convention (`color`) the same way `resolveIconPropsSchema` above is keyed by
 * `icon` — no explicit list of node types — but additionally requires the field to declare an
 * `enum`: a `color` property of any other shape (not expected on any node type today, but not
 * guaranteed to stay that way) is left untouched and falls through to whatever generic branch the
 * dispatcher would otherwise resolve for it.
 */
function resolveColorSwatchPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('color' in properties)) return propsSchema
  const colorSchema = properties.color
  if (!isPlainObject(colorSchema) || !Array.isArray(colorSchema.enum)) return propsSchema

  return {
    ...propsSchema,
    properties: {
      ...properties,
      color: { 'x-widget': 'color-swatch' },
    },
  }
}

/**
 * Omits `properties.columns` from `container.props`'s generated schema when the node's current
 * `props.columns` is `undefined` (T5, 0128): `ObjectPropertyField` renders every declared schema
 * property unconditionally, regardless of whether the node's own value has that key — unlike the
 * `x-widget` swaps above, plainly declaring `columns` would always show its generic numeric/map
 * input in `Props`, defeating the "Grid" mode the `ContainerColumnsModePropertyField` widget above
 * represents (no `columns` key at all). When `columns` *is* declared ("Columnas" mode), this is a
 * no-op: the property passes through unchanged and stays editable with the generic controls,
 * exactly like every other `container.props` field.
 */
function resolveContainerPropsSchema(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('columns' in properties)) return propsSchema
  if (isPlainObject(propsValue) && propsValue.columns !== undefined) return propsSchema

  const { columns: _columns, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

// The four flat scalar props repeater's own grid-mode contract added (T2/T3, repeater-grid-mode):
// unlike `items`/`pagination`/`template`, none of these is a nested object/array in the Zod schema,
// so `ObjectPropertyField` would render each as a bare row with no group header at all (the same
// "orphaned" gap `container.props.columns`/`gap`/`align`/`justify` already has, left as-is per D5 —
// this stays repeater-only). `renderPropsSpecialBlocks`'s dedicated "Grid" fieldset below is their
// only editing surface; `resolveRepeaterPropsSchema` keeps the generic dispatcher from rendering
// them a second time.
const REPEATER_GRID_KEYS = ['columns', 'gap', 'align', 'justify'] as const

/**
 * Omits `columns`, `gap`, `align` and `justify` from `repeater.props`'s generated schema
 * unconditionally: the dedicated "Grid" fieldset in `renderPropsSpecialBlocks` is these four keys'
 * only editing surface (see `REPEATER_GRID_KEYS` above), the same "generic dispatcher stops
 * iterating these keys for this node type" precedent `resolveTablePropsSchema` below already
 * establishes for `table`. Any other `repeater.props` key (`items`, `pagination`, `template`)
 * passes through unchanged and keeps rendering with the generic dispatcher.
 */
function resolveRepeaterPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties)) return propsSchema

  const { columns: _columns, gap: _gap, align: _align, justify: _justify, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

/**
 * Omits `groupId` and `params` from `group.props`'s generated schema unconditionally (T15): the
 * dedicated `GroupInstancePropertyField` special block above is these two keys' only editing
 * surface — declaring them again in the generic dispatcher would show a bare-string `groupId`
 * input (no options list, no reset-on-change of `params`/`children`) and an open key-value editor
 * for `params` instead of one text field per param the chosen group actually declares. Same
 * "generic dispatcher stops iterating these keys for this node type" precedent as
 * `resolveTablePropsSchema` below.
 */
function resolveGroupInstancePropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties)) return propsSchema

  const { groupId: _groupId, params: _params, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

/**
 * Omits `headers`, `rows` and `columns` from `table.props`'s generated schema unconditionally
 * (T9, 0138, D4): the dedicated `TableRowsPropertyField` widget above is these three keys' only
 * editing surface, since they must commit together as one coordinated mutation — declaring them
 * again in the generic dispatcher would either duplicate editing (a raw-JSON escape hatch for
 * `rows`, whose schema is `z.unknown()`) or let `columns` drift out of sync with `headers`. Same
 * "generic dispatcher stops iterating these keys for this node type" precedent as
 * `tabs.props.items[].children` (`resolveTabsPropsSchema`). Any other `table.props` key (e.g.
 * `pagination`) passes through unchanged and keeps rendering with the generic dispatcher.
 */
function resolveTablePropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties)) return propsSchema

  const { headers: _headers, rows: _rows, columns: _columns, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

/**
 * Omits `properties.images`/`properties.source` from `gallery.props`'s generated schema depending
 * on which origin is currently active (T1, feature 2026-08-25-14-49-gallery-node): the
 * `GalleryOriginModePropertyField` special block above is the toggle's only editing surface —
 * declaring both unconditionally would show a manual `images` array editor and a `source` editor
 * simultaneously, defeating the point of the toggle, the same "generic dispatcher stops iterating
 * this key for this node type" precedent `resolveContainerPropsSchema` already establishes for
 * `container.props.columns`. The active origin's own key (`images` when static, `source` when
 * dynamic) passes through — `images` keeps the generic array-of-`{src,alt}` editor unchanged;
 * `source` is additionally swapped for the `{ 'x-widget': 'gallery-dynamic-source' }` sentinel,
 * resolved by the dispatcher's `x-widget` hook to `GalleryDynamicSourcePropertyField` — same
 * swap-only-that-key pattern as `resolveChoiceLikePropsSchema` for `select.props.items`. `display`
 * (common to both origins) is untouched either way.
 */
function resolveGalleryPropsSchema(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || (!('images' in properties) && !('source' in properties))) return propsSchema

  const isStatic = isPlainObject(propsValue) && propsValue.images !== undefined
  const { images: imagesSchema, source: sourceSchema, ...restProperties } = properties

  const nextProperties: Record<string, unknown> = { ...restProperties }
  if (isStatic && imagesSchema) {
    nextProperties.images = imagesSchema
  }
  if (!isStatic && sourceSchema) {
    nextProperties.source = { 'x-widget': 'gallery-dynamic-source' }
  }

  return { ...propsSchema, properties: nextProperties }
}

/**
 * Omits `variant` from `chart.props`'s generated schema unconditionally (T07): the dedicated
 * "Tipo de chart" special block above is `variant`'s only editing surface — changing it must
 * reconstruct `data`/`source` together with the new value (`buildChartNodeForVariant`), which a
 * generic per-field patch through the dispatcher can't express. Same "generic dispatcher stops
 * iterating this key for this node type" precedent `resolveGroupInstancePropsSchema` above already
 * establishes for `group.props.groupId`/`params`.
 */
function resolveChartVariantPropsSchema(propsSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || !('variant' in properties)) return propsSchema

  const { variant: _variant, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

// D5 (T07, feature chart-node): excludes `color`/`label`/`xAxisLabel`/`yAxisLabel` from
// `chart.props`'s generated schema when the active `variant` is `pie`/`donut` — those axis/series
// labels have no meaning on a chart with no axes. Pure function of `(schema, propsValue)`, keyed
// purely off `props.variant`; the other half of `resolveChartPropsSchema`'s composition below.
function resolveChartPropsSchemaByVariant(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties)) return propsSchema
  const variant = isPlainObject(propsValue) ? propsValue.variant : undefined
  if (variant !== 'pie' && variant !== 'donut') return propsSchema

  const { color: _color, label: _label, xAxisLabel: _xAxisLabel, yAxisLabel: _yAxisLabel, ...restProperties } = properties
  return { ...propsSchema, properties: restProperties }
}

// D5 (T07, feature chart-node): excludes whichever origin key (`source` in static mode, `data` in
// dynamic mode) isn't active from `chart.props`'s generated schema — same "generic dispatcher
// stops iterating this key for this node type" precedent `resolveGalleryPropsSchema` above already
// establishes for `gallery.props.images`/`source`, and the same detection criterion (`props.data`
// presence, not `props.source`).
function resolveChartPropsSchemaByOrigin(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown> {
  const properties = propsSchema.properties
  if (!isPlainObject(properties) || (!('data' in properties) && !('source' in properties))) return propsSchema

  const isStatic = isPlainObject(propsValue) && propsValue.data !== undefined
  const { data: dataSchema, source: sourceSchema, ...restProperties } = properties

  const nextProperties: Record<string, unknown> = { ...restProperties }
  if (isStatic && dataSchema) {
    nextProperties.data = dataSchema
  }
  if (!isStatic && sourceSchema) {
    nextProperties.source = sourceSchema
  }

  return { ...propsSchema, properties: nextProperties }
}

/**
 * Composes the two `chart.props`-specific schema conditionings above (T07, D5): first excludes the
 * axis/series label fields when the active `variant` has no axes (`resolveChartPropsSchemaByVariant`),
 * then excludes whichever origin key isn't active (`resolveChartPropsSchemaByOrigin`). Each
 * conditioning is a separate pure function so either can be tested and reasoned about in isolation;
 * this function only composes them in that fixed order.
 */
export function resolveChartPropsSchema(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown> {
  return resolveChartPropsSchemaByOrigin(resolveChartPropsSchemaByVariant(propsSchema, propsValue), propsValue)
}

/**
 * Replaces the generated sub-schema of `layout.span` (integer | responsive per-breakpoint map,
 * T4's `layout.span` union) with the `{ 'x-widget': 'layout-span' }` sentinel the dispatcher's
 * `x-widget` hook resolves to `LayoutSpanPropertyField` (T2, 0127). Same pattern as
 * `resolveChoiceLikePropsSchema` above for `select.props.items`: only `properties.span` is
 * swapped out, the rest of the `layout` subsection schema (currently just `span` itself) passes
 * through unchanged. Only called when the panel has already established a `Layout` subsection
 * should render at all (a `container` ancestor with `columns` exists) — see the caller below.
 */
function resolveLayoutSubsectionSchema(layoutSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = layoutSchema.properties
  if (!isPlainObject(properties) || !('span' in properties)) return layoutSchema

  return {
    ...layoutSchema,
    properties: {
      ...properties,
      span: { 'x-widget': 'layout-span' },
    },
  }
}

/**
 * Replaces the generated sub-schema of `queryStateFeedback.states` (Zod's `queryStateFeedbackStatesSchema`,
 * a `.strict()` object with the five optional per-state rules) with the
 * `{ 'x-widget': 'query-state-feedback-accordion' }` sentinel the dispatcher's `x-widget` hook
 * resolves to `QueryStateFeedbackAccordionPropertyField` (T2/T3, 0135). Same swap-only-that-key
 * pattern as `resolveLayoutSubsectionSchema` above for `layout.span`: only `properties.states` is
 * swapped out, `query` (a plain required string) keeps rendering with the generic text input.
 */
function resolveQueryStateFeedbackSubsectionSchema(subsectionSchema: Record<string, unknown>): Record<string, unknown> {
  const properties = subsectionSchema.properties
  if (!isPlainObject(properties) || !('states' in properties)) return subsectionSchema

  return {
    ...subsectionSchema,
    properties: {
      ...properties,
      states: { 'x-widget': 'query-state-feedback-accordion' },
    },
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
 *
 * T3 (0128): also replaces `properties.orientation` (Zod's `z.enum(['horizontal', 'vertical'])`)
 * with the `{ 'x-widget': 'tabs-orientation' }` sentinel, resolved to `TabsOrientationPropertyField`
 * by the dispatcher's `x-widget` hook — same swap-only-that-key pattern as `level` above and
 * `items` below, independent of the `items` transformation.
 *
 * T5 (accordion-tabs-icon): also replaces each item's `properties.icon` (Zod's
 * `z.string().optional()`, T3) with the `{ 'x-widget': 'icon' }` sentinel, resolved to
 * `IconPickerPropertyField` by the dispatcher's `x-widget` hook. `resolveIconPropsSchema` above
 * only swaps `props.icon` at the top level of a node's own `props`, never inside a nested array
 * item's sub-schema — this handles the equivalent swap for `tabs.props.items[].icon` explicitly,
 * inside the same loop that already excludes `children` from `visibleItemProperties`.
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
    if (propertyKey === 'icon') {
      visibleItemProperties[propertyKey] = { 'x-widget': 'icon' }
      continue
    }
    visibleItemProperties[propertyKey] = propertySchema
  }
  const labelSchema = visibleItemProperties.label
  const nextItemProperties =
    labelSchema && typeof labelSchema === 'object'
      ? { ...visibleItemProperties, label: { ...(labelSchema as Record<string, unknown>), default: NEW_TAB_DEFAULT_LABEL } }
      : visibleItemProperties

  const nextProperties: Record<string, unknown> = {
    ...properties,
    items: {
      ...itemsFieldRecord,
      minItems: typeof itemsFieldRecord.minItems === 'number' ? itemsFieldRecord.minItems : 1,
      items: {
        ...itemRecord,
        properties: nextItemProperties,
      },
    },
  }
  if ('orientation' in properties) {
    nextProperties.orientation = { 'x-widget': 'tabs-orientation' }
  }

  return {
    ...propsSchema,
    properties: nextProperties,
  }
}

/**
 * Edits `props`, `layout`, `visibility` and `queryStateFeedback` for the selected node behind a
 * tab bar (T4, 0133): `resolveNodePanelTabs` (T1) decides which of the four exist and in what
 * order, `NodePanelTabBar` (T2) renders them, and only the active tab's content is ever mounted —
 * every editable field still comes from the node's own generated JSON Schema (T7), there is no
 * separate hardcoded list of properties per node type.
 *
 * The active tab's content is dispatched to a single top-level `PropertyFieldDispatcher` call. The
 * dispatcher itself only resolves plain JSON Schema `type`s, not a union (`anyOf`/`oneOf`) passed
 * as its own top-level `schema` — that's what `resolveUnionBranch` handles here for `visibility`,
 * which is a union at the subsection's own root (single condition | group). `layout.span`, by
 * contrast, is a union nested one level inside the `layout` subsection's `properties`, so it no
 * longer needs a panel-specific resolver: the dispatcher's own `ObjectPropertyField` recursion (T4,
 * 0108) resolves it against `layout.span`'s current value before rendering that nested field.
 *
 * T9: each subsection also tracks its own `pendingRejections` entry — the last value the user
 * tried to commit through this panel plus the error that rejected it — so a commit rejected by
 * `commitCanvasMutation`'s full-config validation still shows the user's own edit (and why it
 * didn't save) instead of silently reverting to the pre-edit value derived from `node`. Switching
 * tabs does not discard a pending rejection (FR7); only selecting a different node does, via the
 * same `serializedPath` guard that now also resets the active tab.
 *
 * T5 (0133): the three special blocks that commit the entire node rather than a single subsection
 * (link "Contenido", container "Modo", form "Acción de envío" — see `renderPropsSpecialBlocks`
 * below) render at the top of the `Props` tabpanel, before the dispatcher-driven `props` fields.
 * They only exist while `Props` is the active tab and only for their own node type.
 */
export function LayoutCanvasPropertiesPanel({
  node,
  path,
  onCommitNodeUpdate,
  onDeleteNode,
  pageLayout,
  onClose,
  onSelectAncestor,
  groups,
}: LayoutCanvasPropertiesPanelProps) {
  // FR4/FR5, criterion 5: `hidden` is the only node type with no `id` field at all (same
  // detection `layout-canvas-breadcrumb.tsx`'s `buildBreadcrumbLabel` uses); every other node
  // type declares it, so a plain "in" check reads it safely across the full `LayoutNode` union.
  const nodeId = 'id' in node ? node.id : undefined

  const nodeSchema = getNodeTypeJsonSchema(node.type)
  const schemaProperties = isPlainObject(nodeSchema.properties) ? nodeSchema.properties : {}
  const submitActionSchema =
    node.type === 'form' && isPlainObject(schemaProperties.submitAction) ? (schemaProperties.submitAction as Record<string, unknown>) : undefined

  const idPrefix = useId()
  // T07 (feature chart-node): the "Tipo de chart" special block's `<select>` needs a stable id for
  // `PropertyFieldRow`'s `htmlFor`, called unconditionally (React hook rules) even though the
  // block itself only ever renders for a `chart` node.
  const chartVariantSelectId = useId()
  const tabs = resolveNodePanelTabs(node, { pageLayout, path })

  const [pendingRejections, setPendingRejections] = useState<PendingRejections>({})
  const [activeTabKey, setActiveTabKey] = useState<NodePanelTabKey | undefined>(tabs[0]?.key)
  // T6 (0133), FR7: per-row commit-rejection state for the `layout-span` widget, hosted here
  // instead of inside the widget itself so it survives a tab change within the same node — see
  // `layout-span-widget-context.ts`'s doc comment for why the widget can no longer keep this in
  // its own `useState`. Reset by the same `serializedPath` guard as `pendingRejections` below, so
  // selecting a different node still clears it (FR7's other half).
  const [layoutSpanRowRejections, setLayoutSpanRowRejections] = useState<
    Partial<Record<RuntimeResponsiveBreakpoint, LayoutSpanRowRejection>>
  >({})
  // T3 (0135): ephemeral UI state the `query-state-feedback-accordion` widget needs to survive a
  // tab change within the same node (FR6) — see `query-state-feedback-accordion-widget-context.ts`
  // for why this can't live in the widget's own `useState`. `queryStateFeedbackFallbackCache`
  // remembers each row's last-known `fallback` array across a Mostrar/Ocultar detour;
  // `queryStateFeedbackExpandedStates` remembers which rows are expanded (present rows start
  // expanded, same default the widget's own isolated tests use). Lazily seeded from the initial
  // `node` (not just on a later node change) so the very first mount already reflects it, then
  // reset only when the selected node changes, never on a tab switch.
  const [queryStateFeedbackFallbackCache, setQueryStateFeedbackFallbackCache] = useState<
    Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>
  >(() => buildInitialQueryStateFeedbackFallbackCache(extractQueryStateFeedbackStates(node)))
  const [queryStateFeedbackExpandedStates, setQueryStateFeedbackExpandedStates] = useState<
    ReadonlySet<QueryStateFeedbackVisibleState>
  >(() => new Set(getPresentQueryStateFeedbackStates(extractQueryStateFeedbackStates(node))))

  // Selecting a different node discards any rejection pending on the previously selected
  // node — it belongs to that node's edit, not this one. A successful commit on this node
  // clears its own entry explicitly below, so this must not also fire on every `node`
  // reference change (e.g. its own successful commit would otherwise race this reset).
  // Adjusted during render (tracking the previous path in state) instead of an effect —
  // the guard only fires once per actual path change, so it cannot loop. FR3/criterion 4: the
  // active tab resets to the new node's first available tab at the same time — switching node
  // never leaves a stale tab key selected.
  const serializedPath = serializeLayoutNodePath(path)
  const [prevSerializedPath, setPrevSerializedPath] = useState(serializedPath)
  if (serializedPath !== prevSerializedPath) {
    setPrevSerializedPath(serializedPath)
    setPendingRejections({})
    setLayoutSpanRowRejections({})
    setActiveTabKey(tabs[0]?.key)
    // T3 (0135): re-seeded from the *new* node's own `queryStateFeedback.states` — a manually
    // collapsed row and a cached `fallback` array belong to the previously selected node's editing
    // session, not this one (unlike a tab switch, which must not touch either).
    const nextStates = extractQueryStateFeedbackStates(node)
    setQueryStateFeedbackFallbackCache(buildInitialQueryStateFeedbackFallbackCache(nextStates))
    setQueryStateFeedbackExpandedStates(new Set(getPresentQueryStateFeedbackStates(nextStates)))
  }

  // Defensive fallback (T4 contract): if the tracked active key doesn't match any of this node's
  // current tabs (e.g. a stale key from before the guard above ran on this same render), fall back
  // to the first available tab instead of rendering nothing.
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0]

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

  // T6 (0133): mirrors `recordCommitResult` above, but keyed by breakpoint instead of
  // `PendingRejectionKey` — passed to `LayoutSpanWidgetContext` as `onRowCommitResult` so the
  // `layout-span` widget's row edits/removals record here instead of in local widget state.
  function recordLayoutSpanRowCommitResult(
    breakpoint: RuntimeResponsiveBreakpoint,
    attemptedValue: number,
    result: CommitCanvasMutationResult | void,
  ) {
    if (result && result.status === 'rejected') {
      setLayoutSpanRowRejections((prev) => ({ ...prev, [breakpoint]: { value: attemptedValue, error: result.error } }))
      return
    }
    setLayoutSpanRowRejections((prev) => {
      if (!(breakpoint in prev)) return prev
      const next = { ...prev }
      delete next[breakpoint]
      return next
    })
  }

  // T5 (0133): the three special blocks (link "Contenido", container "Modo", form "Acción de
  // envío") live at the top of the `Props` tabpanel, before the dispatcher-driven fields —
  // rendered only while `Props` is the active tab (see the call site below), never standalone and
  // never under another tab. Each block only exists for its own node type, exactly as before this
  // task moved them; only their position (inside `Props`, instead of straddling the tab bar)
  // changed. Same `pendingRejections`/`recordCommitResult` mechanism T9 already established for
  // the rest of the panel.
  function renderPropsSpecialBlocks() {
    return (
      <>
        {node.type === 'link' && (
          <LinkContentModePropertyField
            label="Contenido"
            node={node}
            onChange={(nextNode) => onCommitNodeUpdate(path, () => nextNode)}
          />
        )}
        {node.type === 'container' &&
          (() => {
            const pendingRejection = pendingRejections.containerColumnsMode
            const displayedNode = pendingRejection ? (pendingRejection.value as typeof node) : node

            return (
              <div className="flex flex-col gap-2">
                <ContainerColumnsModePropertyField
                  label="Modo"
                  node={displayedNode}
                  onChange={(nextNode) => {
                    const result = onCommitNodeUpdate(path, () => nextNode)
                    recordCommitResult('containerColumnsMode', nextNode, result)
                  }}
                />
                {pendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-containerColumnsMode-error"
                    error={pendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
        {node.type === 'gallery' &&
          (() => {
            const pendingRejection = pendingRejections.galleryOriginMode
            const displayedNode = pendingRejection ? (pendingRejection.value as typeof node) : node

            return (
              <div className="flex flex-col gap-2">
                <GalleryOriginModePropertyField
                  label="Origen"
                  node={displayedNode}
                  onChange={(nextNode) => {
                    const result = onCommitNodeUpdate(path, () => nextNode)
                    recordCommitResult('galleryOriginMode', nextNode, result)
                  }}
                />
                {pendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-galleryOriginMode-error"
                    error={pendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
        {node.type === 'chart' &&
          (() => {
            const variantPendingRejection = pendingRejections.chartVariant
            const originPendingRejection = pendingRejections.chartOriginMode
            const displayedVariantNode = variantPendingRejection ? (variantPendingRejection.value as typeof node) : node
            const displayedOriginNode = originPendingRejection ? (originPendingRejection.value as typeof node) : node

            return (
              <div className="flex flex-col gap-2">
                <PropertyFieldRow htmlFor={chartVariantSelectId} label="Tipo de chart">
                  <select
                    id={chartVariantSelectId}
                    value={displayedVariantNode.props.variant}
                    onChange={(event) => {
                      const nextNode = buildChartNodeForVariant(displayedVariantNode, event.target.value as ChartVariant)
                      const result = onCommitNodeUpdate(path, () => nextNode)
                      recordCommitResult('chartVariant', nextNode, result)
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    {CHART_VARIANTS.map((variant) => (
                      <option key={variant} value={variant}>
                        {variant}
                      </option>
                    ))}
                  </select>
                </PropertyFieldRow>
                {variantPendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-chartVariant-error"
                    error={variantPendingRejection.error}
                  />
                )}
                <ChartOriginModePropertyField
                  label="Origen"
                  node={displayedOriginNode}
                  onChange={(nextNode) => {
                    const result = onCommitNodeUpdate(path, () => nextNode)
                    recordCommitResult('chartOriginMode', nextNode, result)
                  }}
                />
                {originPendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-chartOriginMode-error"
                    error={originPendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
        {node.type === 'group' &&
          (() => {
            const pendingRejection = pendingRejections.groupInstance
            const displayedNode = pendingRejection ? (pendingRejection.value as typeof node) : node

            return (
              <div className="flex flex-col gap-2">
                <GroupInstancePropertyField
                  label="Grupo"
                  node={displayedNode}
                  groups={groups}
                  onChange={(nextNode) => {
                    const result = onCommitNodeUpdate(path, () => nextNode)
                    recordCommitResult('groupInstance', nextNode, result)
                  }}
                />
                {pendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-groupInstance-error"
                    error={pendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
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
        {node.type === 'repeater' &&
          (() => {
            const repeaterPropsSchema = schemaProperties.props
            const gridProperties =
              isPlainObject(repeaterPropsSchema) && isPlainObject(repeaterPropsSchema.properties)
                ? repeaterPropsSchema.properties
                : {}
            const pendingRejection = pendingRejections.repeaterGrid
            const displayedProps = pendingRejection ? (pendingRejection.value as typeof node.props) : node.props

            return (
              <div className="flex flex-col gap-2">
                <fieldset className="flex flex-col gap-2 mb-4">
                  <legend className="pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Grid</legend>
                  {REPEATER_GRID_KEYS.map((key) => {
                    const fieldSchema = gridProperties[key]
                    if (!fieldSchema || typeof fieldSchema !== 'object') return null
                    const fieldValue = (displayedProps as Record<string, unknown> | undefined)?.[key]

                    return (
                      <PropertyFieldDispatcher
                        key={key}
                        schema={resolveUnionBranch(fieldSchema as Record<string, unknown>, fieldValue)}
                        value={fieldValue}
                        label={key}
                        onChange={(nextValue) => {
                          const nextProps = { ...displayedProps, [key]: nextValue }
                          const result = onCommitNodeUpdate(path, (currentNode) =>
                            currentNode.type === 'repeater' ? { ...currentNode, props: nextProps } : currentNode,
                          )
                          recordCommitResult('repeaterGrid', nextProps, result)
                        }}
                      />
                    )
                  })}
                </fieldset>
                {pendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-repeaterGrid-error"
                    error={pendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
        {node.type === 'table' &&
          (() => {
            const pendingRejection = pendingRejections.tableRows
            const displayedNode = pendingRejection ? (pendingRejection.value as typeof node) : node

            return (
              <div className="flex flex-col gap-2">
                <TableRowsPropertyField
                  label="Filas y columnas"
                  node={displayedNode}
                  onChange={(nextNode) => {
                    const result = onCommitNodeUpdate(path, () => nextNode)
                    recordCommitResult('tableRows', nextNode, result)
                  }}
                />
                {pendingRejection && (
                  <CommitRejectionBanner
                    dataTestId="layout-canvas-properties-panel-tableRows-error"
                    error={pendingRejection.error}
                  />
                )}
              </div>
            )
          })()}
      </>
    )
  }

  // T4 (0133): content for a single tab, built from exactly the same per-subsection logic the
  // pre-tabs implementation looped over — only called for the currently active tab (`activeTab`
  // above), never for the others, so their content never mounts. FR6: the dispatcher's root
  // `legend` is hidden (`hideRootLegend`) since the tab button itself already shows `label`.
  function renderTabContent(key: NodePanelTabKey, label: string) {
    const subsectionSchema = schemaProperties[key]
    if (!subsectionSchema || typeof subsectionSchema !== 'object') return null

    const currentValue = readSubsection(node, key)
    let effectiveSchema = resolveUnionBranch(subsectionSchema as Record<string, unknown>, currentValue)
    if (key === 'props' && node.type === 'tabs' && effectiveSchema) {
      effectiveSchema = resolveTabsPropsSchema(effectiveSchema)
    }
    if (key === 'props' && node.type === 'heading' && effectiveSchema) {
      effectiveSchema = resolveHeadingPropsSchema(effectiveSchema)
    }
    if (key === 'props' && node.type === 'container' && effectiveSchema) {
      effectiveSchema = resolveContainerPropsSchema(effectiveSchema, currentValue)
    }
    if (key === 'props' && node.type === 'table' && effectiveSchema) {
      effectiveSchema = resolveTablePropsSchema(effectiveSchema)
    }
    if (key === 'props' && node.type === 'repeater' && effectiveSchema) {
      effectiveSchema = resolveRepeaterPropsSchema(effectiveSchema)
    }
    if (key === 'props' && node.type === 'gallery' && effectiveSchema) {
      effectiveSchema = resolveGalleryPropsSchema(effectiveSchema, currentValue)
    }
    if (key === 'props' && node.type === 'chart' && effectiveSchema) {
      effectiveSchema = resolveChartVariantPropsSchema(resolveChartPropsSchema(effectiveSchema, currentValue))
    }
    if (key === 'props' && node.type === 'group' && effectiveSchema) {
      effectiveSchema = resolveGroupInstancePropsSchema(effectiveSchema)
    }
    if (key === 'props' && CHOICE_LIKE_NODE_TYPES.has(node.type) && effectiveSchema) {
      effectiveSchema = resolveChoiceLikePropsSchema(effectiveSchema)
    }
    if (key === 'props' && effectiveSchema) {
      effectiveSchema = resolveIconPropsSchema(effectiveSchema)
    }
    if (key === 'props' && effectiveSchema) {
      effectiveSchema = resolveColorSwatchPropsSchema(effectiveSchema)
    }
    if (key === 'queryStateFeedback' && effectiveSchema) {
      effectiveSchema = resolveQueryStateFeedbackSubsectionSchema(effectiveSchema)
    }

    // T2 (0127): `Layout` only exists when a `container` ancestor with `columns` is resolvable —
    // without one, `span` has nothing to be relative to. `resolveNodePanelTabs` (T1) already
    // applies the same check to decide whether the `Diseño` tab exists at all, so in practice this
    // only ever runs for `key === 'layout'` when that tab is present; the `null` branch stays as a
    // defensive no-op consistent with the panel's own `pageLayout`-optional contract.
    let parentColumns: RuntimeResponsiveLayoutValue | null = null
    if (key === 'layout') {
      parentColumns = pageLayout ? resolveAncestorContainerColumns(pageLayout, path) : null
      if (parentColumns === null) return null
      if (effectiveSchema) {
        effectiveSchema = resolveLayoutSubsectionSchema(effectiveSchema)
      }
    }

    const pendingRejection = pendingRejections[key]
    const displayedValue = pendingRejection ? pendingRejection.value : currentValue

    const subsectionField = (
      <div className="flex flex-col gap-2">
        <PropertyFieldDispatcher
          schema={effectiveSchema}
          value={displayedValue ?? {}}
          label={label}
          hideRootLegend
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

    // T3 (0135): the `query-state-feedback-accordion` widget's ephemeral UI state (expansion,
    // fallback cache) lives here in the panel, not inside the widget — unlike `layout-span`, no
    // `key` is needed to force a remount on node change: there is no local widget state left to
    // leak across nodes, since the two `useState`s that back this context are already reset by the
    // `serializedPath` guard above.
    if (key === 'queryStateFeedback') {
      return (
        <QueryStateFeedbackAccordionWidgetContext.Provider
          value={{
            fallbackCacheByState: queryStateFeedbackFallbackCache,
            onFallbackCacheCommit: (state, fallback) =>
              setQueryStateFeedbackFallbackCache((prev) => ({ ...prev, [state]: fallback })),
            expandedStates: queryStateFeedbackExpandedStates,
            onSetExpanded: (state, expanded) =>
              setQueryStateFeedbackExpandedStates((prev) => {
                const next = new Set(prev)
                if (expanded) {
                  next.add(state)
                } else {
                  next.delete(state)
                }
                return next
              }),
          }}
        >
          {subsectionField}
        </QueryStateFeedbackAccordionWidgetContext.Provider>
      )
    }

    if (key !== 'layout' || parentColumns === null) return subsectionField

    const spanValue = isPlainObject(currentValue) ? (currentValue.span as RuntimeResponsiveLayoutValue | undefined) : undefined

    return (
      <LayoutSpanWidgetContext.Provider
        // T4 (0127, bug fix): keyed by `serializedPath` (not just the constant subsection `key`)
        // so selecting a different node remounts `LayoutSpanPropertyField` instead of reusing the
        // same instance. T6 (0133) moved per-row commit-rejection state (`layoutSpanRowRejections`
        // above) out of the widget and into this panel, but the same `serializedPath` guard that
        // resets it also resets this key — remounting the widget on node change stays harmless
        // (and keeps its internal DOM/focus state, e.g. the input's own uncontrolled bits, from
        // leaking across an unrelated node's widget instance).
        key={`${key}-${serializedPath}`}
        value={{
          parentColumns,
          spanValue,
          commitSpan: (nextSpan) => commitLayoutSpan(onCommitNodeUpdate, path, nextSpan),
          rowRejections: layoutSpanRowRejections,
          onRowCommitResult: recordLayoutSpanRowCommitResult,
        }}
      >
        {subsectionField}
      </LayoutSpanWidgetContext.Provider>
    )
  }

  return (
    <div
      data-testid="layout-canvas-properties-panel"
      className="flex shrink-0 flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-3"
    >
      <div className="flex flex-col gap-2 border-b border-gray-200 pb-3">
        {pageLayout !== undefined && (
          <LayoutCanvasBreadcrumb
            pageLayout={pageLayout}
            selectedPath={path}
            onSelectNode={onSelectAncestor ?? NOOP_SELECT_ANCESTOR}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900">{node.type}</span>
          <div className="flex items-center gap-1">
            {onDeleteNode !== undefined && (
              <button
                type="button"
                data-testid="layout-canvas-delete-node-button"
                onClick={onDeleteNode}
                aria-label="Eliminar nodo"
                className="rounded p-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {onClose !== undefined && (
              <button
                type="button"
                data-testid="dev-editor-selection-overlay-close"
                onClick={onClose}
                aria-label="Cerrar panel de selección"
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div
          data-testid="layout-canvas-properties-panel-id-row"
          className="flex items-center justify-between gap-2 rounded bg-gray-100 px-2 py-1.5 text-sm"
        >
          <span className="text-gray-500">id</span>
          {nodeId !== undefined ? (
            <span className="text-gray-700">{nodeId}</span>
          ) : (
            <span className="text-gray-400">Sin id</span>
          )}
        </div>
      </div>
      {tabs.length > 0 && activeTab && (
        <>
          <NodePanelTabBar tabs={tabs} activeKey={activeTab.key} onSelectTab={setActiveTabKey} idPrefix={idPrefix} />
          <div
            role="tabpanel"
            id={`${idPrefix}-panel-${activeTab.key}`}
            aria-labelledby={`${idPrefix}-tab-${activeTab.key}`}
          >
            {activeTab.key === 'props' && renderPropsSpecialBlocks()}
            {renderTabContent(activeTab.key, activeTab.label)}
          </div>
        </>
      )}
    </div>
  )
}
