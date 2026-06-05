import type { ButtonColor, ButtonLayoutNode, ButtonVariant } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import { getButtonVariantClassName } from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'

interface ButtonNodeProps {
  node: ButtonLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function ButtonNode({ node, iterationContext }: ButtonNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, goBackPage, navigateToPage, openModal, closeModal, resetForm } = useRuntimeStateActions()
  const formContext = useOptionalFormContext()
  const action = node.props.action
  const isImplicitSubmit = action === undefined && formContext !== null
  const color: ButtonColor = node.props.color ?? 'primary'
  const variant: ButtonVariant = node.props.variant ?? 'solid'
  const fullWidth = node.props.fullWidth ?? false
  const className = getButtonVariantClassName(color, variant, fullWidth)
  const label = resolveRuntimeTextReference(node.props.label, state, 'button.props.label', { iterationContext })

  return (
    <button
      data-layout-node="button"
      type={isImplicitSubmit ? 'submit' : 'button'}
      className={className}
      onClick={
        action
          ? () =>
              executeRuntimeUiAction(action, {
                executeQueryOperation,
                goBackPage,
                navigateToPage,
                openModal,
                closeModal,
                resetForm,
              }, { iterationContext })
          : undefined
      }
    >
      {label}
    </button>
  )
}
