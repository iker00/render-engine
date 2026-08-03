import type { LayoutNode } from '../../../config/runtime-config'
import { EnumPropertyField } from './enum-property-field'

type LinkNode = Extract<LayoutNode, { type: 'link' }>

// The two mutually exclusive content shapes `link` can take (spec requisito 1, design.md D1):
// "Texto" (`props.label`, with optional `props.icon`/`props.iconPosition`) or "Elementos
// anidados" (`children`). No other shape is part of the contract.
type LinkContentMode = 'text' | 'children'

const MODE_OPTIONS: LinkContentMode[] = ['text', 'children']

const MODE_LABELS: Record<string, string> = {
  text: 'Texto',
  children: 'Elementos anidados',
}

// Default label seeded when reconstructing "Texto" mode from "Elementos anidados" (spec
// requisito 3). Named so a future copy change stays a one-line edit.
const DEFAULT_TEXT_LABEL = 'Enlace'

// Detects the mode from the node's own shape, mirroring `ChoiceItemsPropertyField.detectMode`
// one level up (node instead of a `props` value): `props.label` present → "Texto"; `children`
// present → "Elementos anidados". Any other shape (which valid config never produces once
// validation accepts the node) falls back silently to "Texto" rather than throwing.
function detectMode(node: LinkNode): LinkContentMode {
  if (node.props.label !== undefined) return 'text'
  if (node.children !== undefined) return 'children'
  return 'text'
}

// "Texto" -> "Elementos anidados" (spec requisito 2): drop `label`/`icon`/`iconPosition`, add
// `children: []`. `href`/`download`/`target`/`action` survive untouched.
function toChildrenMode(node: LinkNode): LinkNode {
  const { label: _label, icon: _icon, iconPosition: _iconPosition, ...restProps } = node.props
  return { ...node, props: restProps, children: [] }
}

// "Elementos anidados" -> "Texto" (spec requisito 3): drop `children` (and its whole subtree),
// add `props.label: 'Enlace'` without `icon`/`iconPosition`. `href`/`download`/`target`/`action`
// survive untouched.
function toTextMode(node: LinkNode): LinkNode {
  const { children: _children, ...restNode } = node
  const { icon: _icon, iconPosition: _iconPosition, ...restProps } = restNode.props
  return { ...restNode, props: { ...restProps, label: DEFAULT_TEXT_LABEL } }
}

export interface LinkContentModePropertyFieldProps {
  label: string
  node: LinkNode
  onChange: (node: LinkNode) => void
}

/**
 * Dedicated widget for the `link` node's mutually exclusive content shape (T3, 0126): "Texto" vs
 * "Elementos anidados". Same visual/interactive pattern as `DiscriminatedUnionPropertyField`
 * (fieldset + single-select dropdown), but it is deliberately NOT one of its instances: `link` has
 * no `type`-discriminated union in its generated JSON Schema to key off (design.md D1) — there is
 * no union for `getDiscriminatedUnionVariants` to detect.
 *
 * It is also NOT a `props`-scoped widget like `ChoiceItemsPropertyField` (its closest structural
 * precedent — same "detect mode by shape, reconstruct wholesale on change" pattern). This widget
 * receives and returns the **entire node**, not a `props` sub-value: the two content shapes span
 * both `props` (`label`/`icon`/`iconPosition`) and a sibling top-level field (`children`), so its
 * `onChange` must write outside `props`. The panel wires this widget to the same full-node patch
 * mechanism (`onCommitNodeUpdate(path, (currentNode) => nextNode)`) `layout-canvas-properties-panel.tsx`
 * already uses for "Eliminar nodo" — the first non-delete caller of that wider write scope.
 */
export function LinkContentModePropertyField({ label, node, onChange }: LinkContentModePropertyFieldProps) {
  const mode = detectMode(node)

  function handleModeChange(nextMode: string | number) {
    if (nextMode === mode) return
    onChange(nextMode === 'children' ? toChildrenMode(node) : toTextMode(node))
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded border border-gray-200 p-2">
      <legend className="px-1 text-xs font-medium text-gray-700">{label}</legend>
      <EnumPropertyField label={label} value={mode} options={MODE_OPTIONS} optionLabels={MODE_LABELS} onChange={handleModeChange} />
    </fieldset>
  )
}
