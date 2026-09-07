import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ModalLayoutNode } from '../../config/runtime-config'
import type { RuntimeInstanceScope } from '../runtime-references/runtime-instance-scope'
import { EMPTY_INSTANCE_SCOPE } from '../runtime-references/runtime-instance-scope'
import { getModalOverlayClassName, getModalPanelClassName } from '../runtime-node-styling'
import { isModalOpen } from '../runtime-state/runtime-state-selectors'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/use-runtime-state'
import { useLayoutEditModeContext } from '../use-layout-edit-mode-context'

interface ModalNodeProps {
  node: ModalLayoutNode
  children?: ReactNode
  scopeChain?: RuntimeInstanceScope
}

export function ModalNode({ node, children, scopeChain }: ModalNodeProps) {
  const resolvedScopeChain = scopeChain ?? EMPTY_INSTANCE_SCOPE
  const state = useRuntimeState()
  const { openModal, closeModal } = useRuntimeStateActions()
  const editModeContext = useLayoutEditModeContext()
  const isEditMode = editModeContext !== null && editModeContext.active
  const open = isEditMode || isModalOpen(state, node.id, resolvedScopeChain)
  const defaultOpen = node.props?.defaultOpen ?? false
  const pageEntryId = state.pageEntry.entryId
  const lastAutoOpenedEntryIdRef = useRef<number | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isEditMode) return
    if (!defaultOpen) return
    if (lastAutoOpenedEntryIdRef.current === pageEntryId) return
    lastAutoOpenedEntryIdRef.current = pageEntryId
    openModal(node.id, { scopeChain: resolvedScopeChain })
  }, [isEditMode, defaultOpen, pageEntryId, node.id, openModal, resolvedScopeChain])

  useEffect(() => {
    if (isEditMode) return
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusable = getFocusableElements(panelRef.current)
    focusable[0]?.focus()
    return () => {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isEditMode, open])

  const handleClose = useCallback(() => {
    closeModal(node.id, { scopeChain: resolvedScopeChain })
  }, [closeModal, node.id, resolvedScopeChain])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose()
      }
    },
    [handleClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }
      if (e.key === 'Tab') {
        const focusable = getFocusableElements(panelRef.current)
        if (focusable.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [handleClose],
  )

  if (!open) {
    return null
  }

  return (
    <div
      data-layout-node="modal"
      data-testid="modal-overlay"
      className={getModalOverlayClassName()}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={node.props?.label && node.props.label.length > 0 ? node.props.label : 'Diálogo'}
        data-testid="modal-panel"
        className={getModalPanelClassName(node.props?.size ?? 'md')}
      >
        {children}
      </div>
    </div>
  )
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}
