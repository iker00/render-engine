import { Columns2, LayoutGrid } from 'lucide-react'
import type { LayoutNode } from '../../../config/runtime-config'
import type { SegmentedToggleOption } from './segmented-toggle-property-field'
import { SegmentedTogglePropertyField } from './segmented-toggle-property-field'

type ContainerNode = Extract<LayoutNode, { type: 'container' }>

// The two mutually exclusive layout modes `container` can take: "Columnas" (`props.columns`
// declared, fixed integer or responsive map) or "Grid" (`props.columns` absent, plain flex-based
// layout via `direction`/`gap`). No other shape is part of the contract.
//
// Naming note: this maps `props.columns` presence to the "Columnas" segment, not "Grid" — the
// Zod field is a CSS Grid column count (`grid-cols-N`), which reads more naturally as "you get to
// set a number of columns" (Columnas) than as the mode without any column concept (Grid).
type ContainerColumnsMode = 'grid' | 'columns'

const SEGMENTS: ReadonlyArray<SegmentedToggleOption> = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'columns', label: 'Columnas', icon: Columns2 },
]

// Fixed column count seeded when reconstructing "Columnas" mode from "Grid".
// Named so a future default change stays a one-line edit.
const DEFAULT_COLUMNS_COUNT = 2

// Detects the mode from `props.columns` presence alone: declared (fixed integer or responsive
// map) -> "Columnas"; absent -> "Grid". `direction` is never considered, regardless of its value.
function detectMode(node: ContainerNode): ContainerColumnsMode {
  return node.props?.columns !== undefined ? 'columns' : 'grid'
}

// "Grid" -> "Columnas": seeds `props.columns = 2`. The rest of `props` (including `direction`, if
// declared) survives untouched.
function toColumnsMode(node: ContainerNode): ContainerNode {
  return { ...node, props: { ...node.props, columns: DEFAULT_COLUMNS_COUNT } }
}

// "Columnas" -> "Grid": drops the `columns` key entirely. The rest of `props` survives untouched.
// Edge case: a previously responsive `columns` map is not remembered — a later "Grid" ->
// "Columnas" round trip seeds a fresh `2`, not the discarded map.
function toGridMode(node: ContainerNode): ContainerNode {
  const { columns: _columns, ...restProps } = node.props ?? {}
  return { ...node, props: restProps }
}

export interface ContainerColumnsModePropertyFieldProps {
  label: string
  node: ContainerNode
  onChange: (node: ContainerNode) => void
}

/**
 * Dedicated widget for the `container` node's mutually exclusive layout mode (T5, 0128): "Grid"
 * (no `props.columns`) vs "Columnas" (`props.columns` declared), detected from `props.columns`
 * presence. Same full-node write scope as
 * `LinkContentModePropertyField` (0126, T3) — the panel wires this widget's `onChange` to
 * `onCommitNodeUpdate(path, (currentNode) => nextNode)`, the same wider write scope, rather than
 * the generic per-subsection `props` patch the rest of `Props` uses.
 *
 * Uses `SegmentedTogglePropertyField` (T1, 0128) rather than `LinkContentModePropertyField`'s
 * dropdown: this is a later widget in the same feature and the spec calls for the pill-style
 * segmented control here, with `LayoutGrid`/`Columns2` icons distinguishing the two segments.
 */
export function ContainerColumnsModePropertyField({ label, node, onChange }: ContainerColumnsModePropertyFieldProps) {
  const mode = detectMode(node)

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    onChange(nextMode === 'grid' ? toGridMode(node) : toColumnsMode(node))
  }

  return <SegmentedTogglePropertyField label={label} segments={SEGMENTS} activeValue={mode} onSelect={handleModeChange} />
}
