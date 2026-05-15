import type { RuntimeConfigResult } from './bootstrap/read-runtime-config'
import { RuntimePage } from '../runtime/runtime-page'
import {
  getAppShellClassName,
  getAppShellContentClassName,
  getAppShellErrorBodyClassName,
  getAppShellErrorEyebrowClassName,
  getAppShellErrorTitleClassName,
  getAppShellFrameClassName,
} from '../runtime/runtime-node-styling'
import { RuntimeStateProvider } from '../runtime/runtime-state/runtime-state-provider'

interface AppShellProps {
  isDevelopment: boolean
  runtimeConfig: RuntimeConfigResult
}

export function AppShell({ isDevelopment, runtimeConfig }: AppShellProps) {
  if (runtimeConfig.status === 'error') {
    if (runtimeConfig.error.displayMode === 'development-only' && !isDevelopment) {
      return <main className={getAppShellClassName()} data-testid="runtime-app" />
    }

    return (
      <main className={getAppShellClassName()} data-testid="runtime-app">
        <section className={`${getAppShellContentClassName()} flex-col justify-center`} data-testid="runtime-shell-content">
          <div className={`${getAppShellFrameClassName()} grid gap-6`} data-testid="runtime-shell-frame">
            <p className={getAppShellErrorEyebrowClassName()} data-testid="runtime-error-eyebrow">
            Runtime config error
            </p>
            <h1 className={getAppShellErrorTitleClassName()}>Runtime configuration could not be loaded.</h1>
            <p className={getAppShellErrorBodyClassName()} data-testid="runtime-error-message">
              {runtimeConfig.error.message}
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={getAppShellClassName()} data-testid="runtime-app">
      <section className={`${getAppShellContentClassName()} items-center`} data-testid="runtime-shell-content">
        <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
          <RuntimeStateProvider config={runtimeConfig.config}>
            <RuntimePage />
          </RuntimeStateProvider>
        </div>
      </section>
    </main>
  )
}
