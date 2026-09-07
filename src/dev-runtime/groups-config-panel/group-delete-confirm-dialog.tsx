import { useCallback, useEffect, useRef } from 'react'

export interface GroupDeleteConfirmDialogProps {
  groupId: string
  onConfirm: () => void
  onCancel: () => void
}

const OVERLAY_CLASSES = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'

const PANEL_CLASSES =
  'flex w-full max-w-sm flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg'

const ACTIONS_CLASSES = 'flex justify-end gap-2 pt-1'

const CANCEL_BUTTON_CLASSES = 'rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100'

const CONFIRM_BUTTON_CLASSES =
  'rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700'

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

/**
 * Delete confirmation for a group (T14 / feature reusable-node-groups), following the same
 * accessible `alertdialog` pattern as `TokenDeleteConfirmDialog`/`PagesDeleteConfirmDialog`
 * (focus trap, Esc/click-outside cancel, focus restored on unmount) — minus their orphan-scan
 * warning: unlike a token or a page id, nothing in the runtime config resolves a `groupId` by
 * string reference outside of a `group` instance node's own `props.groupId`, and authoring those
 * instances is out of scope for T14 (see T15).
 */
export function GroupDeleteConfirmDialog({ groupId, onConfirm, onCancel }: GroupDeleteConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusable = getFocusableElements(panelRef.current)
    focusable[0]?.focus()
    return () => {
      const previous = previousFocusRef.current
      if (previous && document.contains(previous)) {
        previous.focus()
      }
      previousFocusRef.current = null
    }
  }, [])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
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
        } else if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onCancel],
  )

  return (
    <div
      data-testid="group-delete-confirm-overlay"
      className={OVERLAY_CLASSES}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Eliminar grupo «${groupId}»`}
        data-testid="group-delete-confirm-panel"
        className={PANEL_CLASSES}
      >
        <h2 className="text-sm font-semibold text-gray-900">Eliminar grupo «{groupId}»</h2>
        <div className={ACTIONS_CLASSES}>
          <button type="button" className={CANCEL_BUTTON_CLASSES} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={CONFIRM_BUTTON_CLASSES} onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
