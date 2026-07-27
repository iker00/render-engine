import type { ButtonColor, ButtonLayoutNode, ButtonVariant } from '../../config/runtime-config'
import { useOptionalFormContext } from '../form-context'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import { getButtonVariantClassName } from '../runtime-node-styling'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { IconNode } from './icon-node'

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

  const iconRight = node.props.iconPosition === 'right'

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
      {iconRight ? null : <IconNode name={node.props.icon} className="size-4 shrink-0" />}
      {label}
      {iconRight ? <IconNode name={node.props.icon} className="size-4 shrink-0" /> : null}
    </button>
  )
}
