let activeConfigHmrApply: ((nextConfig: unknown) => void) | null = null

/**
 * Registers (or clears, passing `null`) the function `DevRuntimeReady` uses to
 * apply a config reload coming from Vite HMR. Kept in its own module (rather
 * than alongside the `DevRuntime` component) so this file only exports
 * non-component values — Fast Refresh requires component-only modules to
 * preserve state across edits.
 */
export function setActiveConfigHmrApply(apply: ((nextConfig: unknown) => void) | null): void {
  activeConfigHmrApply = apply
}

/**
 * Test-only seam: `activeConfigHmrApply` is only ever invoked in practice by
 * Vite's real HMR runtime when `../dev/config.json` changes on disk, which does
 * not happen inside a `vitest run` pass. This forwards to the exact same
 * function the `import.meta.hot.accept` callback below calls, so tests can
 * exercise the real HMR commit path without a live dev server.
 */
export function triggerActiveConfigHmrApplyForTests(nextConfig: unknown): void {
  activeConfigHmrApply?.(nextConfig)
}

if (import.meta.hot) {
  // Fast Refresh re-evaluates this module on config.json HMR but preserves
  // DevRuntimeReady's state, so the new config never reaches `currentConfig`
  // through the initialConfig prop. Forward the update directly to the mounted
  // component so it can re-apply via the same migration path as the drawer.
  import.meta.hot.accept('../dev/config.json', (newModule) => {
    if (newModule && activeConfigHmrApply) {
      activeConfigHmrApply((newModule as unknown as { default: unknown }).default)
    }
  })
}
