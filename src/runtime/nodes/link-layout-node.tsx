import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LinkLayoutNode } from '../../config/runtime-config'
import type { DownloadOperationRuntimeUiAction } from '../../config/runtime-config-types'
import {
  resolveRuntimeTextReference,
  type RuntimeIterationContext,
} from '../runtime-references/runtime-reference-resolver'
import { runDownloadAction } from '../runtime-actions/runtime-download-action'
import {
  executeRuntimeUiAction,
  runActionOutcomeWithLifecycle,
  type RuntimeUiActionHandlers,
} from '../runtime-actions/runtime-ui-action-executor'
import { useRuntimeConfig, useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
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
  const {
    executeQueryOperation,
    executeDownloadOperation,
    goBackPage,
    navigateToPage,
    openModal,
    closeModal,
    readRuntimeState,
    resetForm,
  } = useRuntimeStateActions()
  const { href, download, target, action, icon, iconPosition } = node.props
  const label = resolveRuntimeTextReference(node.props.label ?? '', state, 'link.props.label', { iterationContext })
  const resolvedHref = href !== undefined
    ? resolveRuntimeTextReference(href, state, 'link.props.href', { iterationContext })
    : undefined
  const [isDownloading, setIsDownloading] = useState(false)

  const resolvedActionHref = useMemo(() => {
    if (action == null || action.type === 'downloadOperation') {
      return undefined
    }
    return resolveLinkActionHref(action, state.navigation, config.initialPage)
  }, [action, state.navigation, config.initialPage])

  const effectiveHref = resolvedHref ?? resolvedActionHref

  function buildHandlers(): RuntimeUiActionHandlers {
    return {
      executeQueryOperation,
      executeDownloadOperation,
      goBackPage,
      navigateToPage,
      openModal,
      closeModal,
      resetForm,
    }
  }

  async function handleDownloadAction(downloadAction: DownloadOperationRuntimeUiAction) {
    setIsDownloading(true)

    try {
      await runActionOutcomeWithLifecycle(
        () =>
          runDownloadAction(
            downloadAction,
            buildHandlers(),
            readRuntimeState(),
            'link.props.action.filename',
            iterationContext,
          ),
        downloadAction.onSuccess,
        downloadAction.onError,
        buildHandlers(),
        readRuntimeState,
        iterationContext,
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <a
      data-layout-node="link"
      href={effectiveHref}
      download={download}
      target={target}
      aria-disabled={action?.type === 'downloadOperation' && isDownloading ? true : undefined}
      onClick={
        action
          ? (event) => {
              event.preventDefault()

              if (action.type === 'downloadOperation') {
                if (isDownloading) {
                  return
                }
                void handleDownloadAction(action)
                return
              }

              executeRuntimeUiAction(action, buildHandlers(), { iterationContext })
            }
          : undefined
      }
      className={getLinkNodeClassName()}
    >
      {node.children !== undefined ? renderedChildren : (
        iconPosition === 'right'
          ? (
            <>
              {label}
              <IconNode name={icon} className="size-4 shrink-0 inline-block align-middle ml-1" />
            </>
          )
          : (
            <>
              <IconNode name={icon} className="size-4 shrink-0 inline-block align-middle mr-1" />
              {label}
            </>
          )
      )}
    </a>
  )
}
