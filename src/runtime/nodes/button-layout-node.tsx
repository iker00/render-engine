import type { ButtonLayoutNode } from '../../config/runtime-config'
import { executeRuntimeNavigationAction } from '../runtime-actions/runtime-navigation-action-executor'
import { getButtonNodeClassName } from '../runtime-node-styling'
import { useRuntimeStateActions } from '../runtime-state/runtime-state-provider'

interface ButtonNodeProps {
  node: ButtonLayoutNode
}

export function ButtonNode({ node }: ButtonNodeProps) {
  const { goBackPage, navigateToPage } = useRuntimeStateActions()

  return (
    <button
      data-layout-node="button"
      type="button"
      className={getButtonNodeClassName()}
      onClick={() =>
        executeRuntimeNavigationAction(node.props.action, {
          goBackPage,
          navigateToPage,
        })
      }
    >
      {node.props.label}
    </button>
  )
}
