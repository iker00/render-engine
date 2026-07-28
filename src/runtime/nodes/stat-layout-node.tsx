import type { StatColor, StatLayoutNode, StatVariant } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import {
  getStatAccentRootClassName,
  getStatAccentIconClassName,
  getStatAccentLabelClassName,
  getStatAccentValueClassName,
  getStatTintedRootClassName,
  getStatTintedIconClassName,
  getStatTintedLabelClassName,
  getStatTintedValueClassName,
  getStatPlainRootClassName,
  getStatPlainIconClassName,
  getStatPlainLabelClassName,
  getStatPlainValueClassName,
} from '../runtime-node-styling'
import { IconNode } from './icon-node'

interface StatNodeProps {
  node: StatLayoutNode
  iterationContext?: RuntimeIterationContext
}

interface StatVariantClassNames {
  root: string
  icon: string
  label: string
  value: string
}

const statVariantClassResolvers: Record<StatVariant, (color: StatColor) => StatVariantClassNames> = {
  accent: (color) => ({
    root: getStatAccentRootClassName(color),
    icon: getStatAccentIconClassName(color),
    label: getStatAccentLabelClassName(),
    value: getStatAccentValueClassName(),
  }),
  tinted: (color) => ({
    root: getStatTintedRootClassName(color),
    icon: getStatTintedIconClassName(color),
    label: getStatTintedLabelClassName(color),
    value: getStatTintedValueClassName(color),
  }),
  plain: () => ({
    root: getStatPlainRootClassName(),
    icon: getStatPlainIconClassName(),
    label: getStatPlainLabelClassName(),
    value: getStatPlainValueClassName(),
  }),
}

export function StatNode({ node, iterationContext }: StatNodeProps) {
  const state = useRuntimeState()
  const label = resolveRuntimeTextReference(node.props.label, state, 'stat.props.label', { iterationContext })
  const value = resolveRuntimeTextReference(node.props.value, state, 'stat.props.value', { iterationContext })
  const variant: StatVariant = node.props.variant ?? 'accent'
  const color: StatColor = node.props.color ?? 'neutral'
  const icon = node.props.icon
  const classes = statVariantClassResolvers[variant](color)

  return (
    <div data-layout-node="stat" className={classes.root}>
      <div className="flex items-center gap-3">
        <IconNode name={icon} className={classes.icon} />
        <div>
          <p className={classes.label}>{label}</p>
          <p className={classes.value}>{value}</p>
        </div>
      </div>
    </div>
  )
}
