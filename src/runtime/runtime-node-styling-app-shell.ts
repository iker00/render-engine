export function getAppShellClassName() {
  return 'min-h-screen bg-app-background text-app-text'
}

export function getAppShellContentClassName() {
  return 'mx-auto flex w-full max-w-shell px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12'
}

export function getAppShellFrameClassName() {
  return 'w-full rounded-shell border border-app-border-strong bg-app-surface p-4 shadow-shell sm:p-6 lg:p-8'
}

export function getAppShellErrorEyebrowClassName() {
  return 'text-xs font-semibold uppercase tracking-[0.24em] text-app-accent'
}

export function getAppShellErrorTitleClassName() {
  return 'm-0 text-2xl font-semibold leading-tight tracking-[-0.02em] text-app-text-strong sm:text-3xl'
}

export function getAppShellErrorBodyClassName() {
  return 'max-w-2xl text-sm leading-6 text-app-text-muted sm:text-base sm:leading-7'
}

export function getRuntimePageClassName() {
  return 'grid gap-5 lg:gap-6'
}
