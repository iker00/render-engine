import type { RuntimeConfigResult } from './bootstrap/read-runtime-config'

const capabilityItems = [
  'Bootstrap single-package frontend with pnpm-managed dependencies.',
  'Run a local shell without backend dependencies.',
  'Resolve config from data-config or the local development fixture.',
]

interface AppShellProps {
  runtimeConfig: RuntimeConfigResult
}

function getSourceLabel(source: 'data-config' | 'dev-config') {
  if (source === 'data-config') {
    return 'data-config'
  }

  return 'src/dev/config.json'
}

export function AppShell({ runtimeConfig }: AppShellProps) {
  if (runtimeConfig.status === 'error') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
            Bootstrap error
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">
            Runtime configuration could not be loaded.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">{runtimeConfig.message}</p>
        </section>
      </main>
    )
  }

  const initialPage = runtimeConfig.config.pages.find(
    (page) => page.id === runtimeConfig.config.initialPage,
  )

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
            React Form Builder
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Frontend bootstrap ready for the first runtime features.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            This bootstrap shell confirms the runtime config boundary is connected before the
            declarative renderer is implemented.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {capabilityItems.map((item) => (
            <article
              key={item}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30"
            >
              <p className="text-sm leading-7 text-slate-200">{item}</p>
            </article>
          ))}
        </div>

        <article className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-8 text-slate-100 shadow-2xl shadow-cyan-950/40">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Active config source
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {getSourceLabel(runtimeConfig.source)}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-200">
            Initial page: <span className="font-semibold text-white">{runtimeConfig.config.initialPage}</span>
          </p>
          {initialPage ? (
            <p className="mt-2 text-sm leading-7 text-slate-300">
              {initialPage.title}: {initialPage.description}
            </p>
          ) : null}
        </article>
      </section>
    </main>
  )
}
