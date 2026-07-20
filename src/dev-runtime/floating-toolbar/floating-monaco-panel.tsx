import type { RuntimeConfigError } from '../../config/runtime-config'
import { DevRuntimeMonacoEditor } from '../dev-runtime-monaco-editor'

interface FloatingMonacoPanelProps {
  open: boolean
  onClose: () => void
  editorBuffer: string | null
  onEditorChange: (value: string) => void
  onApply: () => void
  onCopy: () => void
  pendingChanges: boolean
  errors: RuntimeConfigError | { code: string; message: string } | null
}

const PANEL_CLASSES = [
  'fixed',
  'inset-y-0',
  'right-0',
  'z-[9999]',
  'flex',
  'w-full',
  'max-w-2xl',
  'flex-col',
  'bg-white',
  'shadow-2xl',
].join(' ')

export function FloatingMonacoPanel({
  open,
  onClose,
  editorBuffer,
  onEditorChange,
  onApply,
  onCopy,
  pendingChanges,
  errors,
}: FloatingMonacoPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div
      data-testid="dev-editor-floating-monaco"
      className={PANEL_CLASSES}
      role="dialog"
      aria-modal="true"
      aria-label="Dev config editor"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Dev Config Editor</span>
        <div className="flex items-center gap-2">
          {pendingChanges && (
            <span
              data-testid="dev-editor-floating-monaco-pending-indicator"
              className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
            >
              Cambios pendientes
            </span>
          )}
          <button
            type="button"
            data-testid="dev-editor-floating-monaco-close"
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Cerrar editor"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <DevRuntimeMonacoEditor
          value={editorBuffer ?? ''}
          onChange={onEditorChange}
          onMount={() => {}}
        />
      </div>

      {errors !== null && (
        <div
          data-testid="dev-editor-floating-monaco-error-panel"
          className="border-t bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span className="font-medium">{errors.code}</span>
          {': '}
          {errors.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <button
          type="button"
          data-testid="dev-editor-floating-monaco-copy"
          onClick={onCopy}
          className="rounded px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          Copiar al portapapeles
        </button>
        <button
          type="button"
          data-testid="dev-editor-floating-monaco-apply"
          onClick={onApply}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          Aplicar
        </button>
      </div>
    </div>
  )
}
