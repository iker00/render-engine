import type { DividerLayoutNode, DividerVariant } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'

interface DividerNodeProps {
  node: DividerLayoutNode
  iterationContext?: RuntimeIterationContext
}

const variantClassMap: Record<DividerVariant, string> = {
  solid: 'border-t border-app-border-soft',
  dashed: 'border-t border-dashed border-app-border-soft',
  dotted: 'border-t border-dotted border-app-border-soft',
  invisible: 'block h-0',
}

export function DividerNode({ node }: DividerNodeProps) {
  const variant: DividerVariant = node.props?.variant ?? 'solid'
  const className = variantClassMap[variant]

  return <hr data-layout-node="divider" className={className} />
}
