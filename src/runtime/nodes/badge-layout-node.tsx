import type { ReactNode } from 'react'
import type { BadgeLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
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

interface BadgeVariantContext {
  color: BadgeColor
  label: string
}

interface BadgeVariantRender {
  rootClassName?: string
  children: ReactNode
}

const badgeVariantResolvers: Record<BadgeVariant, (ctx: BadgeVariantContext) => BadgeVariantRender> = {
  pill: ({ color, label }) => ({
    children: <span className={getBadgePillClassName(color)}>{label}</span>,
  }),
  circle: ({ color, label }) => ({
    rootClassName: 'inline-flex items-center gap-1.5',
    children: (
      <>
        <span className={getBadgeCircleDotClassName(color)} />
        <span className={getBadgeCircleLabelClassName()}>{label}</span>
      </>
    ),
  }),
}

export function BadgeNode({ node, iterationContext }: BadgeNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'badge.props.label', { iterationContext })
  const variant: BadgeVariant = node.props.variant ?? 'pill'
  const color: BadgeColor = node.props.color ?? 'neutral'

  const { rootClassName, children } = badgeVariantResolvers[variant]({ color, label })

  return (
    <span data-layout-node="badge" className={rootClassName}>
      {children}
    </span>
  )
}
