import type { StatLayoutNode, StatColor, StatVariant } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import { IconNode } from './icon-node'

interface StatNodeProps {
  node: StatLayoutNode
  iterationContext?: RuntimeIterationContext
}

const accentBorderColorMap: Record<StatColor, string> = {
  neutral: 'border-gray-400',
  primary: 'border-blue-500',
  success: 'border-green-500',
  warning: 'border-yellow-400',
  danger: 'border-red-500',
  info: 'border-cyan-500',
}

const accentIconColorMap: Record<StatColor, string> = {
  neutral: 'text-gray-400',
  primary: 'text-blue-500',
  success: 'text-green-500',
  warning: 'text-yellow-400',
  danger: 'text-red-500',
  info: 'text-cyan-500',
}

const tintedColorMap: Record<StatColor, { bg: string; labelText: string; valueText: string; iconText: string }> = {
  neutral: { bg: 'bg-gray-100', labelText: 'text-gray-600', valueText: 'text-gray-800 font-bold', iconText: 'text-gray-600' },
  primary: { bg: 'bg-blue-100', labelText: 'text-blue-600', valueText: 'text-blue-800 font-bold', iconText: 'text-blue-600' },
  success: { bg: 'bg-green-100', labelText: 'text-green-600', valueText: 'text-green-800 font-bold', iconText: 'text-green-600' },
  warning: { bg: 'bg-yellow-100', labelText: 'text-yellow-600', valueText: 'text-yellow-800 font-bold', iconText: 'text-yellow-600' },
  danger: { bg: 'bg-red-100', labelText: 'text-red-600', valueText: 'text-red-800 font-bold', iconText: 'text-red-600' },
  info: { bg: 'bg-cyan-100', labelText: 'text-cyan-600', valueText: 'text-cyan-800 font-bold', iconText: 'text-cyan-600' },
}

export function StatNode({ node, iterationContext }: StatNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'stat.props.label', { iterationContext })
  const value = resolveRuntimeTextReference(node.props.value, state, 'stat.props.value', { iterationContext })
  const variant: StatVariant = node.props.variant ?? 'accent'
  const color: StatColor = node.props.color ?? 'neutral'
  const icon = node.props.icon

  if (variant === 'tinted') {
    const { bg, labelText, valueText, iconText } = tintedColorMap[color]
    return (
      <div data-layout-node="stat" className={`rounded-lg p-4 ${bg}`}>
        <div className="flex items-center gap-3">
          <IconNode name={icon} className={`size-8 shrink-0 ${iconText}`} />
          <div>
            <p className={`text-sm ${labelText}`}>{label}</p>
            <p className={`text-2xl ${valueText}`}>{value}</p>
          </div>
        </div>
      </div>
    )
  }

  // accent (default)
  const borderClass = accentBorderColorMap[color]
  const iconColorClass = accentIconColorMap[color]
  return (
    <div data-layout-node="stat" className={`border-l-4 pl-4 py-2 ${borderClass}`}>
      <div className="flex items-center gap-3">
        <IconNode name={icon} className={`size-8 shrink-0 ${iconColorClass}`} />
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
