import type { RuntimeConfigResult } from './bootstrap/read-runtime-config'
import { RuntimePage } from '../runtime/runtime-page'

interface AppShellProps {
  isDevelopment: boolean
  runtimeConfig: RuntimeConfigResult
}

export function AppShell({ isDevelopment, runtimeConfig }: AppShellProps) {
  if (runtimeConfig.status === 'error') {
    if (runtimeConfig.error.displayMode === 'development-only' && !isDevelopment) {
      return <main className="min-h-screen" data-testid="runtime-app" />
    }

    return (
      <main className="min-h-screen" data-testid="runtime-app">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
            Runtime config error
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Runtime configuration could not be loaded.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">{runtimeConfig.error.message}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen" data-testid="runtime-app">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16 sm:px-8">
        <div className="w-full rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <RuntimePage page={runtimeConfig.page} />
        </div>
      </section>
    </main>
  )
}
