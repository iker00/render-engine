import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ModalLayoutNode } from '../../config/runtime-config'
import type { RuntimeIterationContext } from '../runtime-references/runtime-reference-resolver'
import { getModalOverlayClassName, getModalPanelClassName } from '../runtime-node-styling'
import { isModalOpen } from '../runtime-state/runtime-state-selectors'
import { useRuntimeState, useRuntimeStateActions } from '../runtime-state/runtime-state-provider'

interface ModalNodeProps {
  node: ModalLayoutNode
  children?: ReactNode
  iterationContext?: RuntimeIterationContext
}

export function ModalNode({ node, children, iterationContext }: ModalNodeProps) {
  const state = useRuntimeState()
  const { openModal, closeModal } = useRuntimeStateActions()
  const iterationKey = iterationContext?.key
  const open = isModalOpen(state, node.id, iterationKey)
  const defaultOpen = node.props?.defaultOpen ?? false
  const pageEntryId = state.pageEntry.entryId
  const lastAutoOpenedEntryIdRef = useRef<number | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!defaultOpen) return
    if (lastAutoOpenedEntryIdRef.current === pageEntryId) return
    lastAutoOpenedEntryIdRef.current = pageEntryId
    openModal(node.id, { iterationContext })
  }, [defaultOpen, pageEntryId, node.id, openModal, iterationContext])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusable = getFocusableElements(panelRef.current)
    focusable[0]?.focus()
    return () => {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  const handleClose = useCallback(() => {
    closeModal(node.id, { iterationContext })
  }, [closeModal, node.id, iterationContext])

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
