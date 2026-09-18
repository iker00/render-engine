import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver. `AppShell`/`dev-runtime.tsx` (0124-T4) observe the
// mounted shell header's node to keep the sidebar's sticky offset in sync, so any test that mounts
// a non-empty `shell.header` needs a `ResizeObserver` in the global scope even when it doesn't
// care about resize callbacks itself. Tests that need to control invocations deterministically
// still override this per-file via `vi.stubGlobal('ResizeObserver', ...)`, which restores this
// default once `vi.unstubAllGlobals()` runs.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom define `scrollTo` pero solo para volcar "Not implemented: Window's scrollTo()" por
// consola; cualquier componente que lo llame al montar dispara ese aviso en cada test, sin que
// indique un fallo real.
window.scrollTo = () => {}
