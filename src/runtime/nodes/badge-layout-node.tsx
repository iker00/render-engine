import type { BadgeLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import {
  getBadgeCircleDotClassName,
  getBadgeCircleLabelClassName,
  getBadgePillClassName,
} from '../runtime-node-styling'

interface BadgeNodeProps {
  node: BadgeLayoutNode
  iterationContext?: RuntimeIterationContext
}

type BadgeColor = NonNullable<BadgeLayoutNode['props']['color']>
type BadgeVariant = NonNullable<BadgeLayoutNode['props']['variant']>

export function BadgeNode({ node, iterationContext }: BadgeNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'badge.props.label', { iterationContext })
  const variant: BadgeVariant = node.props.variant ?? 'pill'
  const color: BadgeColor = node.props.color ?? 'neutral'

  if (variant === 'circle') {
    return (
      <span data-layout-node="badge" className="inline-flex items-center gap-1.5">
        <span className={getBadgeCircleDotClassName(color)} />
        <span className={getBadgeCircleLabelClassName()}>{label}</span>
      </span>
    )
  }

  // pill (default)
  return (
    <span data-layout-node="badge">
      <span className={getBadgePillClassName(color)}>
        {label}
      </span>
    </span>
  )
}
