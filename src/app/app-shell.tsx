import type { RuntimeConfigResult } from './bootstrap/read-runtime-config'
import type { RuntimeDataValuesError } from './bootstrap/read-runtime-data-values'
import { RuntimePage } from '../runtime/runtime-page'
import {
  getAppShellClassName,
  getAppShellContentClassName,
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
        <div className={`${getAppShellFrameClassName()} grid gap-6`} data-testid="runtime-shell-frame">
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
  if (runtimeConfig.status === 'error') {
    return renderErrorBlock(runtimeConfig.error.message, runtimeConfig.error.displayMode, isDevelopment)
  }

  if (dataValuesError) {
    return renderErrorBlock(dataValuesError.message, dataValuesError.displayMode, isDevelopment)
  }

  const sidebarItems = runtimeConfig.config.shell?.sidebar?.items
  const hasSidebarItems = sidebarItems !== undefined && sidebarItems.length > 0

  return (
    <main className={getAppShellClassName()} data-testid="runtime-app">
      <section className={`${getAppShellContentClassName()} items-center`} data-testid="runtime-shell-content">
        <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
          <RuntimeStateProvider config={runtimeConfig.config} dataValues={dataValues} activeLanguage={activeLanguage}>
            <AppShellHeader header={runtimeConfig.config.shell?.header} />
            {hasSidebarItems ? (
              <div className={getAppShellBodyClassName()}>
                <AppShellSidebar sidebar={runtimeConfig.config.shell?.sidebar} />
                <div className={getAppShellBodyContentClassName()}>
                  <RuntimePage />
                </div>
              </div>
            ) : (
              <RuntimePage />
            )}
          </RuntimeStateProvider>
        </div>
      </section>
    </main>
  )
}
