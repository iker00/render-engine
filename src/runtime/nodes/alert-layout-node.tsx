import type { AlertLayoutNode, AlertType } from '../../config/runtime-config'
import { resolveRuntimeTextReference, type RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { useRuntimeState } from '../runtime-state/runtime-state-provider'

interface AlertNodeProps {
  node: AlertLayoutNode
  iterationContext?: RuntimeIterationContext
}

const colorMap: Record<AlertType, { bg: string; text: string }> = {
  neutral: { bg: 'bg-gray-100', text: 'text-gray-700' },
  primary: { bg: 'bg-blue-100', text: 'text-blue-700' },
  success: { bg: 'bg-green-100', text: 'text-green-700' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  danger: { bg: 'bg-red-100', text: 'text-red-700' },
  info: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
}

export function AlertNode({ node, iterationContext }: AlertNodeProps) {
  const state = useRuntimeState()
  const alertType: AlertType = node.props.type ?? 'neutral'
  const { bg, text } = colorMap[alertType]

  const message = resolveRuntimeTextReference(node.props.message, state, 'alert.props.message', { iterationContext })
  const title = node.props.title !== undefined
    ? resolveRuntimeTextReference(node.props.title, state, 'alert.props.title', { iterationContext })
    : undefined

  const showTitle = title !== undefined && title !== ''

  return (
    <div data-layout-node="alert" className={`flex items-start gap-3 rounded-md p-4 ${bg}`}>
      <span className={text}>icon</span>
      <div>
        {showTitle && <strong>{title}</strong>}
        <span>{message}</span>
      </div>
    </div>
  )
}
