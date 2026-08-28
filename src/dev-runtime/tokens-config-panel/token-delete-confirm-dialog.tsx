import { useCallback, useEffect, useRef } from 'react'
import type { TokenHeaderReferenceScan } from './scan-orphan-token-header-references'

export interface TokenDeleteConfirmDialogProps {
  tokenId: string
  scan: TokenHeaderReferenceScan
  onConfirm: () => void
  onCancel: () => void
}

const OVERLAY_CLASSES =
  'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'

const PANEL_CLASSES =
  'flex w-full max-w-sm flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg'

const WARNING_CLASSES =
  'rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'

const ACTIONS_CLASSES = 'flex justify-end gap-2 pt-1'

const CANCEL_BUTTON_CLASSES =
  'rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100'

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

export function TokenDeleteConfirmDialog({
  tokenId,
  scan,
  onConfirm,
  onCancel,
}: TokenDeleteConfirmDialogProps) {
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
      data-testid="token-delete-confirm-overlay"
      className={OVERLAY_CLASSES}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Eliminar token «${tokenId}»`}
        data-testid="token-delete-confirm-panel"
        className={PANEL_CLASSES}
      >
        <h2 className="text-sm font-semibold text-gray-900">Eliminar token «{tokenId}»</h2>
        {scan.totalCount > 0 && (
          <div className={WARNING_CLASSES} data-testid="token-delete-confirm-orphan-warning">
            <p>
              Este token tiene {scan.totalCount} referencia
              {scan.totalCount === 1 ? '' : 's'} en cabeceras que quedarán huérfanas tras
              borrarlo. Puedes eliminarlo igualmente; las referencias no se actualizan
              automáticamente.
            </p>
            <ul className="mt-1 list-disc pl-4">
              {scan.sources.map((source) => (
                <li key={source.label}>
                  {source.label}: {source.count}
                </li>
              ))}
            </ul>
          </div>
        )}
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
