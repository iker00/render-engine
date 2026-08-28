import type { AlertLayoutNode, AlertType } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getAlertBodyClassName, getAlertClassName, getAlertIconClassName, getAlertTitleClassName } from '../runtime-node-styling'
import { useRuntimeState } from '../runtime-state/use-runtime-state'
import { IconNode } from './icon-node'

interface AlertNodeProps {
  node: AlertLayoutNode
  iterationContext?: RuntimeIterationContext
}

const alertTypeIconMap: Record<AlertType, string> = {
  neutral: 'MessageCircle',
  primary: 'Megaphone',
  success: 'CheckCircle',
  warning: 'AlertTriangle',
  danger: 'XCircle',
  info: 'Info',
}

export function AlertNode({ node, iterationContext }: AlertNodeProps) {
  const state = useRuntimeState()
  const alertType: AlertType = node.props.type ?? 'neutral'

  const message = resolveRuntimeTextReference(node.props.message, state, 'alert.props.message', { iterationContext })
  const title = node.props.title !== undefined
    ? resolveRuntimeTextReference(node.props.title, state, 'alert.props.title', { iterationContext })
    : undefined

  const showTitle = title !== undefined && title !== ''

  if (showTitle) {
    return (
      <div data-layout-node="alert" className={getAlertClassName(alertType)}>
        <IconNode name={alertTypeIconMap[alertType]} className={getAlertIconClassName(alertType)} />
        <div className="flex flex-col flex-1">
          <strong className={getAlertTitleClassName(alertType)}>{title}</strong>
          <span className={getAlertBodyClassName(alertType)}>{message}</span>
        </div>
      </div>
    )
  }

  return (
    <div data-layout-node="alert" className={getAlertClassName(alertType)}>
      <IconNode name={alertTypeIconMap[alertType]} className={getAlertIconClassName(alertType)} />
      <span className={getAlertBodyClassName(alertType)}>{message}</span>
    </div>
  )
}
