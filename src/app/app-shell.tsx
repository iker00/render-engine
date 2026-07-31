import { useLayoutEffect, useState } from 'react'
import type { RuntimeConfigResult } from './bootstrap/read-runtime-config'
import type { RuntimeDataValuesError } from './bootstrap/read-runtime-data-values'
import type { ShellScrollBehavior } from '../config/runtime-config-types'
import { RuntimePage } from '../runtime/runtime-page'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellContentPaddingClassName,
  getAppShellErrorBodyClassName,
  getAppShellErrorEyebrowClassName,
  getAppShellErrorTitleClassName,
  getAppShellFrameClassName,
} from '../runtime/runtime-node-styling'
import {
  getAppShellBodyClassName,
  getAppShellBodyContentClassName,
} from '../runtime/runtime-node-styling-app-shell-sidebar'
import { AppShellHeader, AppShellSidebar } from '../runtime/runtime-shell'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'

interface AppShellProps {
  isDevelopment: boolean
  runtimeConfig: RuntimeConfigResult
  dataValues?: Record<string, unknown>
  dataValuesError?: RuntimeDataValuesError
  activeLanguage?: string
}

function renderErrorBlock(message: string, displayMode: string, isDevelopment: boolean) {
  if (displayMode === 'development-only' && !isDevelopment) {
    return <main className={getAppShellClassName()} data-testid="runtime-app" />
  }

  return (
    <main className={getAppShellClassName()} data-testid="runtime-app">
      <section className={`${getAppShellContentClassName()} flex-col justify-center`} data-testid="runtime-shell-content">
        <div
          className={`${getAppShellFrameClassName()} ${getAppShellContentPaddingClassName()} grid gap-6`}
          data-testid="runtime-shell-frame"
        >
          <p className={getAppShellErrorEyebrowClassName()} data-testid="runtime-error-eyebrow">
          Runtime config error
          </p>
          <h1 className={getAppShellErrorTitleClassName()}>Runtime configuration could not be loaded.</h1>
          <p className={getAppShellErrorBodyClassName()} data-testid="runtime-error-message">
            {message}
          </p>
        </div>
      </section>
    </main>
  )
}

export function AppShell({ isDevelopment, runtimeConfig, dataValues, dataValuesError, activeLanguage }: AppShellProps) {
  // Measures the rendered header's height so the sidebar's sticky offset (FR11, 0124-T4) tracks it
  // at runtime — the header's real height varies with its content (logo, title, wrapping menu,
  // actions), so a static value can't stand in for it. `useLayoutEffect` (not `useEffect`): the
  // synchronous `getBoundingClientRect()` measurement runs before the first paint, avoiding a
  // flash of `top: 0px` while waiting for `ResizeObserver`'s always-async first callback.
  const [headerNode, setHeaderNode] = useState<HTMLElement | null>(null)
  const [headerHeightPx, setHeaderHeightPx] = useState(0)

  useLayoutEffect(() => {
    // Local wrapper (same shape as `recompute` in `layout-canvas-grid-drop-zones.tsx`) so the
    // effect body calls a local function rather than the `useState` setter directly.
    const measureHeaderHeight = (heightPx: number) => {
      setHeaderHeightPx(heightPx)
    }

    if (headerNode === null) {
      measureHeaderHeight(0)
      return
    }
    measureHeaderHeight(headerNode.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      measureHeaderHeight(entries[0].contentRect.height)
    })
    observer.observe(headerNode)
    return () => observer.disconnect()
  }, [headerNode])

  if (runtimeConfig.status === 'error') {
    return renderErrorBlock(runtimeConfig.error.message, runtimeConfig.error.displayMode, isDevelopment)
  }

  if (dataValuesError) {
    return renderErrorBlock(dataValuesError.message, dataValuesError.displayMode, isDevelopment)
  }

  const sidebarItems = runtimeConfig.config.shell?.sidebar?.items
  const hasSidebarItems = sidebarItems !== undefined && sidebarItems.length > 0

  const scrollBehavior: ShellScrollBehavior = runtimeConfig.config.shell?.scrollBehavior ?? 'page'
  const isFixed = scrollBehavior === 'fixed'

  const appShellClassName = isFixed ? `${getAppShellClassName()} overflow-hidden` : getAppShellClassName()
  const bodyRowClassName = isFixed ? `${getAppShellBodyClassName()} flex-1 min-h-0` : getAppShellBodyClassName()
  const contentWrapperClassName = isFixed
    ? `${getAppShellBodyContentClassName()} ${getAppShellContentPaddingClassName()} flex-1 min-h-0 overflow-y-auto`
    : `${getAppShellBodyContentClassName()} ${getAppShellContentPaddingClassName()}`
  const pageContentClassName = isFixed
    ? `${getAppShellContentPaddingClassName()} flex-1 min-h-0 overflow-y-auto`
    : getAppShellContentPaddingClassName()

  return (
    <main className={appShellClassName} data-testid="runtime-app">
      <section className={getAppShellContentClassName()} data-testid="runtime-shell-content">
        <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
          <RuntimeStateProvider config={runtimeConfig.config} dataValues={dataValues} activeLanguage={activeLanguage}>
            <AppShellHeader ref={setHeaderNode} header={runtimeConfig.config.shell?.header} pinned={!isFixed} />
            {hasSidebarItems ? (
              <div className={bodyRowClassName}>
                <AppShellSidebar
                  sidebar={runtimeConfig.config.shell?.sidebar}
                  scrollBehavior={scrollBehavior}
                  stickyTopPx={headerHeightPx}
                />
                <div className={contentWrapperClassName}>
                  <RuntimePage />
                </div>
              </div>
            ) : (
              <div className={pageContentClassName} data-testid="runtime-page-content">
                <RuntimePage />
              </div>
            )}
          </RuntimeStateProvider>
        </div>
      </section>
    </main>
  )
}
