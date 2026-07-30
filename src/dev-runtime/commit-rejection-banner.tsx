import type { RuntimeConfigError } from '../config/runtime-config'

/**
 * Shared feedback banner for a commit rejected by `commitCanvasMutation`'s full-config
 * validation (canvas properties panel, T9 of 0107) or by `commitShellMutation`'s equivalent
 * validation for the Shell config panel (0122-T5). Both callers keep the user's own attempted
 * value displayed instead of silently reverting it, and render this banner alongside it so the
 * rejection is announced (`role="alert"`) with the error's code and message.
 */
export function CommitRejectionBanner({ dataTestId, error }: { dataTestId: string; error: RuntimeConfigError }) {
  return (
    <div role="alert" data-testid={dataTestId} className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">
      No se pudo guardar este cambio: <span className="font-medium">{error.code}</span>
      {': '}
      {error.message}
    </div>
  )
}
