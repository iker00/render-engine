# Test plan: Feature 0043 - Dev mode live config editor

## Estrategia general

- Toda la verificación se ejecuta con la infraestructura actual del repositorio: `Vitest`, `jsdom` y `@testing-library/react`.
- El umbral global de cobertura sigue siendo 80 % sobre `src/` y se valida con `pnpm test` (que incluye `--coverage`).
- El enfoque es tests-first por tarea: para cada tarea el bloque de tests debería redactarse antes que el código.
- Los tests sobre `@monaco-editor/react` usan un mock controlado de Vitest (`vi.mock`) para evitar inicializar Monaco real en `jsdom`.
- Ningún test debe acoplarse al detalle visual de Monaco (markers, theming) ni snapshotear el editor.
- Los tests sobre el runtime base existente deben seguir verdes sin cambios: ninguna tarea de esta feature debe modificarlos para acomodar el wrapper.

## Comandos de validación

- `pnpm test`: suite completa con cobertura. Es el gate principal de cada tarea y de la pasada completa.
- `pnpm test:watch`: iterar mientras se redactan tests, sin sustituir al gate de cobertura.
- `pnpm lint`: tipado y reglas vigentes; debe quedar en verde al cierre de la feature.
- `pnpm build`: el proceso ya invoca dos pasadas de `tsc --noEmit` y el bundle real; se usa además como pre-requisito del gate de bundle (T9).

## Cobertura por tarea

### T1 — Dependencias del wrapper dev
- No introduce tests nuevos.
- Gate: `pnpm install`, `pnpm test` y `pnpm build` siguen verdes con las dependencias añadidas.

### T2 — Schema raíz Zod (`runtimeConfigRootSchema`)
- Tipo: unit tests sobre el módulo nuevo.
- Casos cubiertos:
  - aceptación de `src/dev/config.json`.
  - aceptación de configuración mínima válida.
  - rechazo de `pages` no array, `initialPage` vacío y nodo con `type` no soportado.
  - aceptación recursiva: árbol con `container.children`, `repeater.template` y `form.children` a dos niveles.
  - verificación cruzada: `validateRuntimeConfig` produce los mismos `code` y `message` para una muestra representativa, demostrando que no se ha tocado.
- Comando: `pnpm test`.

### T3 — `migrateRuntimeStateAcrossConfig`
- Tipo: unit tests sobre la función pura.
- Casos cubiertos por rama:
  - forms: form preservado con filtrado de `fieldId`, form removido, form anidado en `repeater.template`, form anidado en `container.children`.
  - queries: query preservada con `data`/`requestSignature` intactos, query removida.
  - navigation: `currentPageId` conservada con `params` heredados, degradación a `nextConfig.initialPage` cuando la página activa desaparece, `lastError` siempre `null` tras la migración.
  - pageEntry: `entryId: 0`, `pageId` coherente, `preloadNames` recalculados, `status: 'idle'`.
  - inmutabilidad: `prevState` y `prevConfig` no se mutan.
- Comando: `pnpm test`.

### T4 — `DevRuntimeStateBridge`
- Tipo: integration ligera con `@testing-library/react`.
- Casos cubiertos:
  - `ref.current.getLatestState()` refleja el estado actual del provider tras dispatches externos.
  - `ref.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state } })` reemplaza el estado completo.
  - el bridge no renderiza nodos visibles y no interfiere con `<RuntimePage />` montada como hermana.
  - lanza error explícito cuando se monta fuera de un `RuntimeStateProvider`.
- Comando: `pnpm test`.

### T5 — Editor Monaco y JSON Schema
- Tipo: mezcla de unit (derivación) e integration mockeada (editor).
- Casos cubiertos:
  - `getRuntimeConfigJsonSchema()` devuelve un JSON Schema 7 con `type: 'object'` y propiedades `api`, `pages`, `initialPage`; segunda llamada devuelve la misma referencia (cache).
  - el JSON Schema incluye la unión discriminada por `type` de los nodos soportados (presencia mínima del nodo `container`).
  - `dev-runtime-monaco-editor` se monta con `value="{}"` usando un mock de `@monaco-editor/react`, llama a `onMount` con la instancia mock y emite `onChange` cuando el mock simula edición.
  - el componente registra el schema sobre el mock de `monaco.languages.json.jsonDefaults` cuando está disponible y degrada silenciosamente cuando no.
- Comando: `pnpm test`.

### T6 — Drawer, toggle y atajo de teclado
- Tipo: integration con `@testing-library/react` y `userEvent`.
- Casos cubiertos:
  - el botón flotante con `data-testid="dev-runtime-toggle"` está montado y dispara el callback al hacer click.
  - el drawer renderiza children, cabecera, sección de errores y barra de acciones según props; pasa de oculto a visible con `open: true`.
  - el aviso `Cambios pendientes` aparece cuando `pendingChanges: true`.
  - el hook de teclado reacciona a `Ctrl+Shift+J` y `Cmd+Shift+J` para toggle, y a `Esc` solo cuando el drawer está abierto.
  - los listeners de teclado se limpian al desmontar el hook.
- Comando: `pnpm test`.

### T7 — `DevRuntime` raíz (Aplicar/Copiar)
- Tipo: integration end-to-end sobre el wrapper con Monaco mockeado.
- Casos cubiertos:
  - bootstrap: `data-config` válido alimenta `currentConfig`; sin `data-config` cae a `src/dev/config.json`.
  - bootstrap inválido: la frontera de error de bootstrap existente sigue aplicando.
  - botón flotante visible; toggle abre/cierra; buffer del editor se conserva entre cierres y aperturas dentro del mismo montaje; un remount fresco descarta el buffer.
  - Aplicar válido: runtime re-renderizado con el nuevo árbol; buffer pasa a coincidir con el nuevo JSON activo; `hasPendingChanges` queda en `false`.
  - Preservación: `formId.fieldId` que sobrevive conserva su valor; `fieldId` eliminado desaparece; queries cacheadas que siguen en `api` se preservan; página activa se mantiene o degrada a `initialPage`.
  - Aplicar inválido (sintaxis): runtime intacto; panel muestra error de parseo con `message` y línea cuando esté disponible.
  - Aplicar inválido (validación): runtime intacto; panel muestra `error.code` y `error.message` tal cual.
  - Copiar: copia el texto del editor (no el JSON activo); usa `navigator.clipboard.writeText` cuando existe y cae al fallback `document.execCommand('copy')` en su ausencia.
  - Sin regresión: con el editor cerrado y sin cambios aplicados, el árbol visible coincide con el del runtime sin wrapper sobre el mismo `data-config`.
- Comando: `pnpm test`.

### T8 — Wiring de `src/main.tsx`
- Tipo: integration con doble rama de `import.meta.env.DEV`.
- Casos cubiertos:
  - bajo `import.meta.env.DEV = true`, `main` monta el wrapper dev (verificable mediante mock del módulo `./dev-runtime/dev-runtime`).
  - bajo `import.meta.env.DEV = false`, `main` monta `<App />` y el módulo del wrapper no se carga (verificable por ausencia del side-effect del mock).
  - los tests existentes en `src/tests/main.test.tsx` siguen verdes sin ajustar su contrato observable.
- Comando: `pnpm test`.

### T9 — Gate de bundle sin Monaco
- Tipo: integration sobre el build real.
- Casos cubiertos:
  - tras un `vite build` aislado, los assets generados en `dist/assets/` no contienen los markers `monaco-editor`, `@monaco-editor/react`, `MonacoEnvironment`, `zod-to-json-schema`, `DevRuntime` ni `runtimeConfigRootSchema`.
  - mensaje de fallo accionable cuando cualquier marker se detecta.
  - el test es resiliente a un `dist/` previo: limpia o aísla la carpeta antes de medir.
- Comando: `pnpm test` (el test se encarga de invocar `vite build` o de consumir su salida).

## Tests e2e

- No aplican en esta feature: el alcance es de runtime + wrapper local, sin flujos de navegador real ni infraestructura externa.

## Criterios de cierre de la pasada

- `pnpm test` en verde, incluyendo el gate de bundle de T9.
- Cobertura global `functions`, `lines` y `statements` ≥ 80 % sobre `src/`.
- `pnpm lint` y `pnpm build` en verde sin warnings nuevos bloqueantes.
- Ningún test del runtime base existente modificado para acomodar el wrapper.
