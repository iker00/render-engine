import type { ButtonLayoutNode } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import { getButtonNodeClassName } from '../runtime-node-styling'
import { useRuntimeStateActions } from '../runtime-state/runtime-state-provider'

interface ButtonNodeProps {
  node: ButtonLayoutNode
}

export function ButtonNode({ node }: ButtonNodeProps) {
  const { executeQueryOperation, goBackPage, navigateToPage, resetForm } = useRuntimeStateActions()
  const formContext = useOptionalFormContext()
  const action = node.props.action
  const isImplicitSubmit = action === undefined && formContext !== null

  return (
    <button
      data-layout-node="button"
      type={isImplicitSubmit ? 'submit' : 'button'}
      className={getButtonNodeClassName()}
      onClick={
        action
          ? () =>
              executeRuntimeUiAction(action, {
                executeQueryOperation,
                goBackPage,
                navigateToPage,
                resetForm,
              })
          : undefined
      }
    >
      {node.props.label}
    </button>
  )
}
