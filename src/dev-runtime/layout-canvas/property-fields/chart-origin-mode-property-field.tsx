import type {
  ChartCategoricalDynamicSource,
  ChartLayoutNode,
  ChartNumericDynamicSource,
  ChartStaticCategoricalPoint,
  ChartStaticNumericPoint,
  ChartVariant,
} from '../../../config/runtime-config-types'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'

// The two mutually exclusive origins `chart.props` can take (props.data vs props.source, T01 of
// feature 2026-09-08-08-50-chart-node): "Estático" (a manual `data` array) or "Dinámico" (a
// `source` resolved from a query at runtime). Same shape as `gallery`'s origin toggle.
type ChartOriginMode = 'static' | 'dynamic'

const SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'static', label: 'Estático' },
  { value: 'dynamic', label: 'Dinámico' },
]

// `chart` has two point families depending on `props.variant`: categorical (bar/line/area/pie/
// donut, x axis is a discrete category) and numeric (scatter, both axes are numbers). The origin
// toggle must seed the family-correct template on every switch, not a family-agnostic one, or the
// freshly seeded value would fail the runtime's own family/variant match (T02) as soon as it lands.
const numericVariants: ReadonlySet<ChartVariant> = new Set(['scatter'])

function isNumericVariant(variant: ChartVariant): boolean {
  return numericVariants.has(variant)
}

const DEFAULT_CATEGORICAL_DYNAMIC_SOURCE: ChartCategoricalDynamicSource = {
  source: 'queries.query.data',
  category: 'category',
  value: 'value',
}

const DEFAULT_NUMERIC_DYNAMIC_SOURCE: ChartNumericDynamicSource = {
  source: 'queries.query.data',
  x: 'x',
  y: 'y',
}

const DEFAULT_CATEGORICAL_STATIC_DATA: ChartStaticCategoricalPoint[] = [{ category: 'Ejemplo', value: 1 }]

const DEFAULT_NUMERIC_STATIC_DATA: ChartStaticNumericPoint[] = [{ x: 0, y: 0 }]

// Detects the origin from `props.data` presence alone, mirroring the runtime's own branch
// selection criterion (T01/T02): a `chart` node renders from `props.data` when present, from
// `props.source` otherwise.
function detectMode(node: ChartLayoutNode): ChartOriginMode {
  return 'data' in node.props ? 'static' : 'dynamic'
}

// "Estático" -> "Dinámico": drops `data` entirely, seeds the family-correct `source` template.
// Every other `props` field (`variant`, `color`, `label`, `xAxisLabel`, `yAxisLabel`, `height`)
// survives untouched.
function toDynamicMode(node: ChartLayoutNode): ChartLayoutNode {
  const { data: _data, ...restProps } = node.props
  const source = isNumericVariant(node.props.variant) ? DEFAULT_NUMERIC_DYNAMIC_SOURCE : DEFAULT_CATEGORICAL_DYNAMIC_SOURCE
  return { ...node, props: { ...restProps, source } }
}

// "Dinámico" -> "Estático": drops `source` entirely, seeds the family-correct `data` template.
// Edge case (same as `GalleryOriginModePropertyField`'s round trip): a previously edited `data`/
// `source` value is not remembered — switching back always seeds a fresh minimal template.
function toStaticMode(node: ChartLayoutNode): ChartLayoutNode {
  const { source: _source, ...restProps } = node.props
  const data = isNumericVariant(node.props.variant) ? DEFAULT_NUMERIC_STATIC_DATA : DEFAULT_CATEGORICAL_STATIC_DATA
  return { ...node, props: { ...restProps, data } }
}

export interface ChartOriginModePropertyFieldProps {
  label: string
  node: ChartLayoutNode
  onChange: (node: ChartLayoutNode) => void
}

/**
 * Dedicated widget for the `chart` node's mutually exclusive origin (T06, feature
 * 2026-09-08-08-50-chart-node): "Estático" (`props.data`) vs "Dinámico" (`props.source`),
 * detected from `props.data` presence. Same full-node write scope as
 * `GalleryOriginModePropertyField` — the panel (T07) wires this widget's `onChange` to the
 * existing commit pipeline and renders it as a special block at the top of the `Props` tabpanel,
 * before the dispatcher-driven fields.
 *
 * Unlike `gallery`, the seeded template also depends on the active `variant`: categorical
 * variants (`bar`/`line`/`area`/`pie`/`donut`) seed the categorical shape, `scatter` seeds the
 * numeric shape. This widget only owns the toggle itself, not the origin-specific editors nor the
 * variant selector (T07's "Tipo de chart" block).
 */
export function ChartOriginModePropertyField({ label, node, onChange }: ChartOriginModePropertyFieldProps) {
  const mode = detectMode(node)

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    onChange(nextMode === 'dynamic' ? toDynamicMode(node) : toStaticMode(node))
  }

  return <SegmentedTogglePropertyField label={label} segments={SEGMENTS} activeValue={mode} onSelect={handleModeChange} />
}
