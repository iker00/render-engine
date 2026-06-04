import type { LinkLayoutNode } from '../../config/runtime-config'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'

interface LinkNodeProps {
  node: LinkLayoutNode
  iterationContext?: RuntimeIterationContext
}

export function LinkNode({ node, iterationContext }: LinkNodeProps) {
  const state = useRuntimeState()
  const { executeQueryOperation, goBackPage, navigateToPage, openModal, closeModal, resetForm } = useRuntimeStateActions()
  const { href, download, target, action } = node.props
  const label = resolveRuntimeTextReference(node.props.label, state, 'link.props.label', { iterationContext })
  const resolvedHref = href !== undefined
    ? resolveRuntimeTextReference(href, state, 'link.props.href', { iterationContext })
    : undefined

  return (
    <a
      data-layout-node="link"
      href={resolvedHref}
      download={download}
      target={target}
      onClick={
        action
          ? (event) => {
              event.preventDefault()
              executeRuntimeUiAction(action, {
                executeQueryOperation,
                goBackPage,
                navigateToPage,
                openModal,
                closeModal,
                resetForm,
              }, { iterationContext })
            }
          : undefined
      }
      className="text-blue-600 underline hover:text-blue-800"
    >
      {label}
    </a>
  )
}
