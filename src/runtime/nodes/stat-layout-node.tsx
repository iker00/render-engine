import type { StatLayoutNode, StatVariant } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'
import {
  getStatAccentRootClassName,
  getStatAccentIconClassName,
  getStatAccentLabelClassName,
  getStatAccentValueClassName,
  getStatTintedRootClassName,
  getStatTintedIconClassName,
  getStatTintedLabelClassName,
  getStatTintedValueClassName,
} from '../runtime-node-styling'
import { IconNode } from './icon-node'

interface StatNodeProps {
  node: StatLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function StatNode({ node, iterationContext }: StatNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'stat.props.label', { iterationContext })
  const value = resolveRuntimeTextReference(node.props.value, state, 'stat.props.value', { iterationContext })
  const variant: StatVariant = node.props.variant ?? 'accent'
  const color = node.props.color ?? 'neutral'
  const icon = node.props.icon

  if (variant === 'tinted') {
    return (
      <div data-layout-node="stat" className={getStatTintedRootClassName(color)}>
        <div className="flex items-center gap-3">
          <IconNode name={icon} className={getStatTintedIconClassName(color)} />
          <div>
            <p className={getStatTintedLabelClassName(color)}>{label}</p>
            <p className={getStatTintedValueClassName(color)}>{value}</p>
          </div>
        </div>
      </div>
    )
  }

  // accent (default)
  return (
    <div data-layout-node="stat" className={getStatAccentRootClassName(color)}>
      <div className="flex items-center gap-3">
        <IconNode name={icon} className={getStatAccentIconClassName(color)} />
        <div>
          <p className={getStatAccentLabelClassName()}>{label}</p>
          <p className={getStatAccentValueClassName()}>{value}</p>
        </div>
      </div>
    </div>
  )
}
