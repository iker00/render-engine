# Tasks: Feature 0043 - Dev mode live config editor

## Convenciones

- Ejecutar las tareas en el orden declarado salvo que `Dependencias` permita lo contrario.
- Cada tarea se cierra en dos pasos: primero `Cierre de implementación` (código + tests verdes y umbral global de cobertura del 80 % en `src/` mantenido), después `Cierre documental` en la pasada posterior con `update-app-documentation`.
- Una tarea no se considera implementada hasta que `pnpm test` esté en verde para la feature y la cobertura siga sobre el umbral del proyecto.
- Ninguna tarea debe modificar la frontera pública del runtime, ni el contrato observable de `validateRuntimeConfig`, ni el comportamiento de `App.tsx` sin wrapper.
- La feature se monta exclusivamente bajo `import.meta.env.DEV` desde `src/main.tsx`. Ningún otro punto del runtime debe importar nada de `src/dev-runtime/`.
- Próxima tarea recomendada: **T1**.

## T1 — Añadir dependencias del wrapper dev

- **ID**: T1
- **Estado**: pending
- **Objetivo**: Incorporar al proyecto las dependencias necesarias para el editor en vivo (`monaco-editor`, `@monaco-editor/react`, `zod-to-json-schema`) en `package.json`, dejando el lockfile actualizado y los scripts existentes funcionales.
- **Fuera de alcance**:
  - Crear ningún módulo bajo `src/dev-runtime/`.
  - Tocar `src/main.tsx`, `src/app/` ni cualquier código del runtime.
  - Configurar workers de Monaco más allá del default de `@monaco-editor/react`.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código: `package.json`, `pnpm-lock.yaml`.
  - Tests: ninguno nuevo. Verificar que la suite existente sigue pasando con las dependencias añadidas.
  - Documentación: ninguno.
- **Tests requeridos**:
  - `pnpm install` debe ejecutarse sin error.
  - `pnpm test` debe seguir en verde sobre la base actual.
  - `pnpm build` debe completar sin romperse.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: las tres dependencias aparecen como `dependencies` en `package.json`, el lockfile refleja resoluciones reproducibles, y los tres comandos anteriores siguen funcionando sin warnings nuevos críticos.
- **Cierre de implementación**: dependencias añadidas, `pnpm install`, `pnpm test` y `pnpm build` verdes en local.
- **Cierre documental**: ninguno.

## T2 — Schema raíz Zod para autocompletado

- **ID**: T2
- **Estado**: pending
- **Objetivo**: Crear `src/config/runtime-config-root-zod.ts` que componga los schemas atómicos ya existentes en `src/config/runtime-config-zod.ts` en un único `runtimeConfigRootSchema` reutilizable, listo para alimentar la derivación a JSON Schema desde el wrapper. El validador (`validate-runtime-config.ts`) no se modifica ni se vuelve dependiente de este módulo.
- **Fuera de alcance**:
  - Refactorizar, reescribir o sustituir cualquier schema de `runtime-config-zod.ts`.
  - Cambiar mensajes, rutas o comportamiento de `validateRuntimeConfig`.
  - Generar el JSON Schema (esa derivación es T5).
  - Importar el schema raíz desde cualquier punto del runtime, del config validator o de `src/app/`.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código: `src/config/runtime-config-root-zod.ts` (nuevo).
  - Tests: `src/tests/runtime-config-root-zod.test.ts` (nuevo).
  - Documentación: ninguno.
- **Tests requeridos** (unit):
  - El schema raíz acepta el JSON real de `src/dev/config.json` sin errores.
  - El schema raíz acepta un JSON mínimo válido (`{ api: {}, pages: [{ id, layout: [] }], initialPage }`).
  - El schema raíz rechaza JSONs malformados representativos: `pages` no array, `initialPage` vacío, nodo con `type` no soportado dentro de `pages[].layout`.
  - El schema raíz expande recursivamente `container.children`, `repeater.template` y `form.children` a la unión discriminada por `type` y acepta árboles anidados de al menos dos niveles.
  - El validador existente (`validateRuntimeConfig`) sigue produciendo exactamente los mismos `code`/`message` para una muestra representativa de casos válidos e inválidos, demostrando que su comportamiento no depende del nuevo módulo.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Existe `runtimeConfigRootSchema` exportado desde el nuevo módulo.
  - El módulo no es importado por nadie fuera de los nuevos tests todavía (lo consumirá T5 más adelante).
  - Los tests cubren aceptación, rechazo y recursión.
- **Cierre de implementación**: `pnpm test` en verde con la nueva suite incluida; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno (la frontera pública del validador no cambia).

## T3 — Migración pura de estado entre configs

- **ID**: T3
- **Estado**: pending
- **Objetivo**: Implementar `migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig): RuntimeState` como función pura en `src/dev-runtime/dev-runtime-state-migration.ts`, siguiendo exactamente las reglas declaradas en `design.md` § D5 (forms, queries, navigation, pageEntry).
- **Fuera de alcance**:
  - Disparar dispatches, integrar la función con `RuntimeStateProvider` o con `runtime-state-reducer`.
  - Reejecutar preloads o tocar `requestSignature` más allá de filtrarlas por presencia en `nextConfig.api`.
  - Implementar el bridge, el editor, el drawer o el toggle.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código: `src/dev-runtime/dev-runtime-state-migration.ts` (nuevo).
  - Tests: `src/tests/dev-runtime-state-migration.test.ts` (nuevo).
  - Documentación: ninguno.
- **Tests requeridos** (unit, cobertura exhaustiva por rama):
  - Forms: `formId` que sigue existiendo conserva solo los `fieldId` que el nuevo árbol declara; `fieldId` eliminado desaparece; `formId` que desaparece se descarta completo.
  - Forms anidados dentro de `repeater.template` y `container.children` también se descubren correctamente.
  - Queries: queries cacheadas cuyo nombre sigue en `nextConfig.api` se preservan con `data`, `status`, `error` y `requestSignature` intactos; las eliminadas desaparecen.
  - Navigation: si `currentPageId` sigue declarada, se conserva con `params` heredados y `history` con una sola entrada `entryId: 0`; si no, degrada a `nextConfig.initialPage` con `history` nuevo y `params: {}`; `lastError` queda en `null` en ambos casos.
  - PageEntry: `entryId: 0`, `pageId` resuelto coherente con la navegación, `params` heredados según la regla anterior, `preloadNames` derivados del nuevo page activo y `status: 'idle'`.
  - Función pura: no muta `prevState` ni `prevConfig`.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: función exportada, cubierta por tests de todas las ramas declaradas, sin imports de React ni de `RuntimeStateProvider`.
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno (la función es interna del wrapper dev).

## T4 — Bridge entre wrapper y estado del runtime

- **ID**: T4
- **Estado**: pending
- **Objetivo**: Añadir `src/dev-runtime/dev-runtime-state-bridge.tsx`, un componente hijo de `RuntimeStateProvider` que expone vía `useImperativeHandle` un puente con `dispatchAndSyncState(action)` y `getLatestState()` consumibles por el wrapper desde un `ref`. El bridge se monta exclusivamente desde el wrapper dev.
- **Fuera de alcance**:
  - Modificar `RuntimeStateProvider`, `RuntimeStateContext`, los tipos del estado o las hooks públicas (`useRuntimeState`, `useRuntimeStateActions`, etc.).
  - Implementar el handler de Aplicar (ese vive en T7).
  - Renderizar UI propia: el bridge devuelve `null`.
- **Nota de implementación**: `useRuntimeStateContext()` es una función privada (no exportada) de `runtime-state-provider.tsx`. El bridge debe acceder al contexto vía `useContext(RuntimeStateContext)` importado directamente desde `runtime-state-context.ts` (que sí es exportado), añadiendo su propio null-guard explícito. Importar el contexto en modo lectura no constituye modificarlo; la restricción de "Fuera de alcance" aplica a cambios estructurales del módulo del runtime.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código: `src/dev-runtime/dev-runtime-state-bridge.tsx` (nuevo).
  - Tests: `src/tests/dev-runtime-state-bridge.test.tsx` (nuevo).
  - Documentación: ninguno.
- **Tests requeridos** (integration mínimo, sin Monaco):
  - Montar `<RuntimeStateProvider config={configFixture}><DevRuntimeStateBridge ref={ref} /></RuntimeStateProvider>` en un test: `ref.current.getLatestState()` devuelve el estado actual del provider; tras un dispatch externo, refleja el cambio.
  - `ref.current.dispatchAndSyncState({ type: 'runtime/reset', payload: { state } })` reemplaza el estado completo y el provider lo refleja.
  - El bridge no renderiza nada visible y no introduce regresiones en consumidores hermanos (`<RuntimePage />` no se rompe si se monta junto al bridge).
  - Lanza error claro si se monta fuera de un `RuntimeStateProvider`.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: bridge consumido únicamente por tests propios; ningún archivo del runtime lo importa.
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno.

## T5 — Editor Monaco con JSON Schema derivado

- **ID**: T5
- **Estado**: pending
- **Objetivo**: Añadir `src/dev-runtime/dev-runtime-json-schema.ts` que derive una vez el JSON Schema de `runtimeConfigRootSchema` vía `zod-to-json-schema`, y `src/dev-runtime/dev-runtime-monaco-editor.tsx` que envuelve `@monaco-editor/react`, registra ese schema en `monaco.languages.json.jsonDefaults` con un URI ficticio y enlaza el modelo del editor a ese URI. El componente recibe `value`, `onChange` y `onMount` como props; no implementa la lógica de Aplicar/Copiar.
- **Fuera de alcance**:
  - Implementar drawer, toggle, keyboard shortcut, panel de errores o handlers de Aplicar/Copiar.
  - Servir Monaco desde recursos locales versionados (decisión deferida; sólo se aborda si T7 detecta fallo offline).
  - Activar markers de validación inline en Monaco; el MVP los muestra en el panel adjunto.
- **Dependencias**: T1, T2.
- **Impacto esperado en archivos**:
  - Código: `src/dev-runtime/dev-runtime-json-schema.ts` (nuevo), `src/dev-runtime/dev-runtime-monaco-editor.tsx` (nuevo).
  - Tests: `src/tests/dev-runtime-json-schema.test.ts` (nuevo), `src/tests/dev-runtime-monaco-editor.test.tsx` (nuevo).
  - Documentación: ninguno.
- **Tests requeridos**:
  - Unit: `getRuntimeConfigJsonSchema()` produce un JSON Schema 7 válido cuyo tipo raíz es `object` con propiedades `api`, `pages` e `initialPage`; segunda llamada devuelve la misma referencia (cache).
  - Unit: el schema generado contiene la unión discriminada por `type` para nodos de layout (al menos un node `container` aparece como variante).
  - Integration (con `@monaco-editor/react` mockeado por Vitest): al montar el componente con `value="{}"`, llama a `onMount` exponiendo la instancia mock y emite `onChange` cuando el mock simula edición.
  - Integration: al montar, registra el schema mediante el handle expuesto por Monaco; si `monaco.languages.json` no está disponible (mock), el componente no lanza y degrada en silencio.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: el editor es importable y aislable sin Aplicar; los tests cubren derivación, cache y montaje.
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno.

## T6 — Drawer lateral, botón flotante y atajo de teclado

- **ID**: T6
- **Estado**: pending
- **Objetivo**: Añadir la carcasa UI del wrapper sin Monaco ni handlers de Aplicar: `src/dev-runtime/dev-runtime-toggle-button.tsx` (botón fijo en esquina), `src/dev-runtime/dev-runtime-drawer.tsx` (drawer lateral derecho con cabecera, slots de contenido y acciones, panel de errores y aviso `Cambios pendientes`) y `src/dev-runtime/dev-runtime-keyboard.ts` (hook que registra `Ctrl/Cmd+Shift+J` para abrir/cerrar y `Esc` para cerrar).
- **Fuera de alcance**:
  - Montar el editor Monaco real dentro del drawer (lo hace T7).
  - Implementar Aplicar, Copiar, validación o preservación de estado.
  - Persistir el estado de apertura entre sesiones.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código: `src/dev-runtime/dev-runtime-toggle-button.tsx`, `src/dev-runtime/dev-runtime-drawer.tsx`, `src/dev-runtime/dev-runtime-keyboard.ts` (todos nuevos).
  - Tests: `src/tests/dev-runtime-drawer.test.tsx`, `src/tests/dev-runtime-keyboard.test.ts` (nuevos).
  - Documentación: ninguno.
- **Tests requeridos**:
  - Render: el botón de toggle aparece fijo con `data-testid="dev-runtime-toggle"`; pulsarlo invoca el callback de toggle.
  - Render: el drawer renderiza children, cabecera, sección de errores y barra de acciones cuando se le pasan como props; está oculto por defecto y visible al pasar `open: true`.
  - Render: si el drawer recibe `pendingChanges: true`, muestra el aviso visible asociado.
  - Keyboard hook: `Ctrl+Shift+J` y `Cmd+Shift+J` invocan el callback de toggle; `Esc` invoca el callback de cierre solo cuando el drawer está abierto; el listener se limpia al desmontar.
  - Estilos: todas las clases usan utilidades Tailwind; no se introducen `style` inline arbitrarios ni nuevos `@theme`.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: la carcasa es montable de forma aislada; ningún test depende todavía del runtime real ni del editor Monaco.
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno.

## T7 — Componente raíz DevRuntime y handlers Aplicar/Copiar

- **ID**: T7
- **Estado**: pending
- **Objetivo**: Implementar `src/dev-runtime/dev-runtime.tsx` como componente raíz del wrapper. Hace bootstrap con `readRuntimeConfig`, gestiona `currentConfig` con `useState`, mantiene buffer de editor en memoria, monta `<RuntimeStateProvider config={currentConfig}><DevRuntimeStateBridge ref={...} /><RuntimePage /></RuntimeStateProvider>`, monta el botón flotante y el drawer con el editor Monaco, y orquesta las acciones `Aplicar` y `Copiar` según `design.md` § D5/D6/D7/D9.
- **Fuera de alcance**:
  - Modificar `RuntimeStateProvider`, `RuntimeStateContext`, `AppShell`, `App`, `readRuntimeConfig` o cualquier código del runtime.
  - Cambiar la frontera de bootstrap: errores de config inicial siguen tratándose por la frontera existente reutilizando `AppShell` importado directamente desde `src/app/app-shell.tsx`; no replicar su superficie de error para evitar divergencia.
  - Persistir el buffer del editor entre recargas (`localStorage`/`sessionStorage` quedan fuera).
  - Mostrar varios errores de validación a la vez (se respeta la forma flat actual de `RuntimeConfigError`).
- **Dependencias**: T2, T3, T4, T5, T6.
- **Impacto esperado en archivos**:
  - Código: `src/dev-runtime/dev-runtime.tsx` (nuevo).
  - Tests: `src/tests/dev-runtime.test.tsx` (nuevo).
  - Documentación: nueva ficha `ai-workflow/docs/app-features/development/dev-mode-editor.md` (se redactará en la pasada documental posterior; aquí solo se anota la deuda).
- **Tests requeridos** (integration sobre el wrapper completo, Monaco mockeado):
  - Bootstrap: con `data-config` válido en el root, el wrapper carga `currentConfig` desde ahí; con `data-config` ausente, carga `src/dev/config.json`.
  - Bootstrap inválido: error de config inicial sigue mostrándose por la frontera de bootstrap existente; el editor no se vuelve utilizable hasta que el bootstrap sea válido.
  - Botón flotante visible siempre que el wrapper esté montado; pulsar abre el drawer; cerrar y reabrir conserva el buffer editado en la misma sesión; recargar el wrapper (remount fresco) descarta el buffer.
  - Aplicar válido: el runtime se re-renderiza con el nuevo árbol; el buffer pasa a coincidir con el nuevo JSON activo; `hasPendingChanges` queda en `false`.
  - Aplicar válido + preservación: un `formId.fieldId` que sigue existiendo conserva su valor previo; un `fieldId` desaparecido se descarta; queries cacheadas que siguen en `api` se preservan; página activa que sigue existiendo se mantiene; página activa que desaparece degrada a `initialPage` del nuevo config.
  - Aplicar inválido (sintaxis JSON): el runtime no cambia y el panel adjunto muestra un error de parseo claro con `message` y línea cuando esté disponible.
  - Aplicar inválido (validación estructural): el runtime no cambia y el panel adjunto muestra `error.code` y `error.message` tal cual los devuelve `validateRuntimeConfig`, sin reescribir rutas.
  - Copiar: la acción `Copiar al portapapeles` copia el texto actual del editor (no el JSON activo); usa `navigator.clipboard.writeText` cuando está disponible y cae al fallback `document.execCommand('copy')` cuando no.
  - Sin regresión: con el editor cerrado y sin aplicar cambios, el árbol visible y el comportamiento observable del runtime son indistinguibles del runtime sin wrapper sobre el mismo `data-config`.
- **Documentación afectada**:
  - Pendiente para la pasada documental: nueva ficha `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - Pendiente para la pasada documental: actualizar `ai-workflow/docs/app-features/development/index.md` para enlazar la ficha nueva.
  - Pendiente para la pasada documental: ajustar `ai-workflow/docs/app-features/development/local-config.md` (sección `Límites de v1`) para reflejar que ya existe panel editable en vivo bajo modo dev.
- **Criterios de finalización**: el wrapper cubre todos los criterios de aceptación de `spec.md` que no dependen del gate de bundle (cubierto por T9) ni del wiring del entrypoint (cubierto por T8).
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: pendiente de la pasada `update-app-documentation`.

## T8 — Wiring del entrypoint para montar el wrapper solo en DEV

- **ID**: T8
- **Estado**: pending
- **Objetivo**: Reescribir `src/main.tsx` para que, dentro de un `bootstrap()` async, decida estructuralmente qué montar: si `import.meta.env.DEV`, hace `await import('./dev-runtime/dev-runtime')` y monta `<DevRuntime />`; en caso contrario, monta `<App />`. Mantener `React.StrictMode` y el `createRoot` actual.
- **Fuera de alcance**:
  - Cambiar la firma o el comportamiento de `App`.
  - Reescribir la carga de CSS (`./app/index.css` se sigue importando como hoy).
  - Introducir gates adicionales tipo variables de entorno custom.
- **Dependencias**: T7.
- **Impacto esperado en archivos**:
  - Código: `src/main.tsx`.
  - Tests: `src/tests/main.test.tsx` actualizado para cubrir ambas ramas (DEV y producción) sin regresiones sobre los tests previos.
  - Documentación: actualización pendiente de `ai-workflow/docs/current-state.md` para reflejar que el área de desarrollo local ya incluye editor en vivo.
- **Tests requeridos**:
  - Bajo `import.meta.env.DEV = true` (en el entorno test simulado), `main` monta el wrapper dev y no monta `<App />` directamente.
  - Bajo `import.meta.env.DEV = false`, `main` monta `<App />` directamente sin importar el wrapper dev.
  - La rama productiva no ejecuta el import dinámico de `./dev-runtime/dev-runtime` (verificable mediante spy sobre `import` o el side-effect equivalente del mock).
- **Documentación afectada**:
  - Pendiente para la pasada documental: `ai-workflow/docs/current-state.md` (estado del área de desarrollo local apunta a feature `0043`).
- **Criterios de finalización**: ambos paths (DEV y prod) están cubiertos por tests; ningún import estático del wrapper queda referenciado desde `App.tsx`, `AppShell` ni desde el runtime.
- **Cierre de implementación**: tests verdes; cobertura global ≥ 80 %.
- **Cierre documental**: pendiente de la pasada `update-app-documentation`.

## T9 — Verificación de bundle productivo sin Monaco

- **ID**: T9
- **Estado**: pending
- **Objetivo**: Garantizar que el chunk del wrapper queda fuera del bundle de producción. Añadir una verificación automática que ejecute `vite build` y asegure que el output de `dist/` no incluye contenido de `monaco-editor`, `@monaco-editor/react` ni `zod-to-json-schema`.
- **Fuera de alcance**:
  - Configurar code-splitting adicional más allá de lo necesario para que la rama dev quede tree-shaken.
  - Servir Monaco desde recursos locales versionados o reconfigurar workers.
  - Cambiar el comportamiento del wrapper en DEV.
- **Dependencias**: T8.
- **Impacto esperado en archivos**:
  - Código: posibles ajustes acotados en `src/main.tsx` o `vite.config.ts` solo si el script demuestra que el tree-shaking actual no basta; ninguno por defecto.
  - Tests: `src/tests/dev-runtime-bundle.test.ts` (nuevo) que invoca `vite build` o consume su salida, o bien script `scripts/check-dev-bundle.mjs` ejecutado desde el test, según lo que resulte estable.
  - Documentación: ninguno.
- **Tests requeridos**:
  - El test corre en CI/local con `pnpm test`. Tras un build limpio, lee los `.js` generados en `dist/assets/` y verifica que ninguno contiene los markers `monaco-editor`, `@monaco-editor/react`, `MonacoEnvironment`, `zod-to-json-schema` ni nombres de export específicos del wrapper (`DevRuntime`, `runtimeConfigRootSchema`).
  - El test falla con un mensaje accionable si cualquier marker se detecta.
  - El test es resiliente a un `dist/` sucio: hace su propio `vite build` aislado o limpia antes de medir.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**: el gate de bundle es ejecutable en local y forma parte de la suite que `pnpm test` corre.
- **Cierre de implementación**: gate en verde; cobertura global ≥ 80 %.
- **Cierre documental**: ninguno.
