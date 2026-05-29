import type { ReactNode } from 'react'
import type { RuntimeConfigError } from '../config/runtime-config'

interface DevRuntimeDrawerProps {
  open: boolean
  onClose: () => void
  onApply: () => void
  onCopy: () => void
  pendingChanges: boolean
  errors: RuntimeConfigError | { code: string; message: string } | null
  children: ReactNode
}

export function DevRuntimeDrawer({
  open,
  onClose,
  onApply,
  onCopy,
  pendingChanges,
  errors,
  children,
}: DevRuntimeDrawerProps) {
  return (
    <>
      {/* Overlay — visible only when drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-black/10"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        data-testid="dev-runtime-drawer"
        className={[
          'fixed inset-y-0 right-0 z-[9999] flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Dev config editor"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Dev Config Editor</span>
          <div className="flex items-center gap-2">
            {pendingChanges && (
              <span
                data-testid="dev-runtime-pending-indicator"
                className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
              >
                Cambios pendientes
              </span>
            )}
            <button
              data-testid="dev-runtime-close"
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100"
              aria-label="Close editor"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Editor slot */}
        <div className="min-h-0 flex-1">{children}</div>

        {/* Error panel */}
        {errors !== null && (
          <div
            data-testid="dev-runtime-error-panel"
            className="border-t bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span className="font-medium">{errors.code}</span>
            {': '}
            {errors.message}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            data-testid="dev-runtime-copy"
            onClick={onCopy}
            className="rounded px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Copiar al portapapeles
          </button>
          <button
            data-testid="dev-runtime-apply"
            onClick={onApply}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Aplicar
          </button>
        </div>
      </div>
    </>
  )
}
