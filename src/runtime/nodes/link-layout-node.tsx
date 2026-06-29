import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { LinkLayoutNode } from '../../config/runtime-config'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { executeRuntimeUiAction } from '../runtime-actions/runtime-ui-action-executor'
import { useRuntimeConfig, useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'
import { resolveLinkActionHref } from './link-action-href'
import { IconNode } from './icon-node'
import { getLinkNodeClassName } from '../runtime-node-styling'

interface LinkNodeProps {
  node: LinkLayoutNode
  iterationContext?: RuntimeIterationContext
  renderedChildren?: ReactNode
}

export function LinkNode({ node, iterationContext, renderedChildren }: LinkNodeProps) {
  const state = useRuntimeState()
  const config = useRuntimeConfig()
  const { executeQueryOperation, goBackPage, navigateToPage, openModal, closeModal, resetForm } = useRuntimeStateActions()
  const { href, download, target, action, icon } = node.props
  const label = resolveRuntimeTextReference(node.props.label ?? '', state, 'link.props.label', { iterationContext })
  const resolvedHref = href !== undefined
    ? resolveRuntimeTextReference(href, state, 'link.props.href', { iterationContext })
    : undefined

  const resolvedActionHref = useMemo(() => {
    if (action == null) {
      return undefined
    }
    return resolveLinkActionHref(action, state.navigation, config.initialPage)
  }, [action, state.navigation, config.initialPage])

  const effectiveHref = resolvedHref ?? resolvedActionHref

  return (
    <a
      data-layout-node="link"
      href={effectiveHref}
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
      className={getLinkNodeClassName()}
    >
      {node.children !== undefined ? renderedChildren : (
        <>
          <IconNode name={icon} className="size-4 shrink-0 inline-block align-middle mr-1" />
          {label}
        </>
      )}
    </a>
  )
}
