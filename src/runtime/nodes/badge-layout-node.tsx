import type { BadgeLayoutNode } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface BadgeNodeProps {
  node: BadgeLayoutNode
  iterationContext?: RuntimeIterationContext
}

type BadgeColor = NonNullable<BadgeLayoutNode['props']['color']>
type BadgeVariant = NonNullable<BadgeLayoutNode['props']['variant']>

const pillColorMap: Record<BadgeColor, { bg: string; text: string }> = {
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700' },
  primary: { bg: 'bg-blue-100', text: 'text-blue-700' },
  success: { bg: 'bg-green-100', text: 'text-green-700' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  danger: { bg: 'bg-red-100', text: 'text-red-700' },
  info: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
}

const circleDotColorMap: Record<BadgeColor, string> = {
  neutral: 'bg-gray-400',
  primary: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-400',
  danger: 'bg-red-500',
  info: 'bg-cyan-500',
}

export function BadgeNode({ node, iterationContext }: BadgeNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'badge.props.label', { iterationContext })
  const variant: BadgeVariant = node.props.variant ?? 'pill'
  const color: BadgeColor = node.props.color ?? 'neutral'

  if (variant === 'circle') {
    const dotClass = circleDotColorMap[color]
    return (
      <span data-layout-node="badge" className="inline-flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-sm">{label}</span>
      </span>
    )
  }

  // pill (default)
  const { bg, text } = pillColorMap[color]
  return (
    <span data-layout-node="badge">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    </span>
  )
}
