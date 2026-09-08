/**
 * Indicador de carga genérico, fijo y no configurable, usado en el hueco del
 * contenido bloqueado tanto por el gate de página como por el gate de
 * app-mount. No acepta props ni children: es un componente presentacional
 * puro sin estado ni efectos.
 */
export function RuntimeBlockingLoadingIndicator() {
  return (
    <div
      role="status"
      data-testid="runtime-blocking-loading-indicator"
      className="flex min-h-40 w-full flex-col items-center justify-center gap-3 bg-app-surface text-app-text"
    >
      <span aria-hidden="true" className="h-8 w-8 animate-pulse rounded-full bg-app-accent" />
      <span className="sr-only">Cargando</span>
    </div>
  )
}
