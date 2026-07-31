export function getAppShellClassName() {
  return 'flex h-full w-full flex-col text-app-text'
}

export function getAppShellContentClassName() {
  return 'flex w-full flex-1 min-w-0 min-h-0'
}

export function getAppShellFrameClassName() {
  return 'flex w-full flex-1 min-w-0 min-h-0 flex-col'
}

// Padding propio del área de contenido, equivalente al que hoy aporta la card que se elimina en
// 0124. `shell.header` y `shell.sidebar` no llevan este padding: siguen anclados a los bordes del
// contenedor de montaje ("edge to edge") y quedan visualmente separados del contenido por su propia
// superficie/borde ya existente. Aplicado tanto por el envoltorio de `RuntimePage` cuando hay
// sidebar como por el `RuntimePage` suelto cuando no lo hay, y por el bloque de error de
// configuración.
export function getAppShellContentPaddingClassName() {
  return 'p-6 sm:p-8 lg:p-10'
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
