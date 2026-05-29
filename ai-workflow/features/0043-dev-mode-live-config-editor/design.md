# Design: Feature 0043 - Dev mode live config editor

## Contexto

### Estado actual del runtime
- `src/main.tsx` monta `<App />`. `App.tsx` invoca `readRuntimeConfig` y compone `<AppShell runtimeConfig={...} />`. `AppShell` pinta error de bootstrap o renderiza `<RuntimeStateProvider config>` → `<RuntimePage />`.
- `RuntimeStateProvider` captura el estado inicial una sola vez con `useState(() => createRuntimeStateFromBrowserHash(config))`. El `config` se mantiene como prop, pasa al contexto y alimenta efectos (hash sync, planner de preloads). Cambios posteriores en el prop `config` no reinician estado del reducer; solo re-disparan los efectos.
- El reducer ya soporta `{ type: 'runtime/reset', payload: { state } }`, que sustituye el estado completo. Es el único punto de entrada existente para reemplazar `navigation`, `forms`, `queries` y `pageEntry` en bloque.

### Esquemas Zod actuales
- `src/config/runtime-config-zod.ts` define schemas por nodo (`containerNodeSchema`, `formNodeSchema`, etc.) y schemas "shell" (`runtimeConfigShellSchema`, `runtimePageShellSchema`), pero no expone un schema raíz que componga el árbol completo (`api` + `pages[].layout` recursivo + `form.children` + `repeater.template`).
- `src/config/validate-runtime-config.ts` (≈3900 líneas) orquesta el parseo, valida cruces (`initialPage` ∈ `pages`, `operationName` ∈ `api`, rangos numéricos, etc.) y produce el `RuntimeConfigError` flat documentado en `runtime-config-types.ts`.
- `validateRuntimeConfig` devuelve `{ status: 'ready', config, page }` o `{ status: 'error', error }` con `code`, `message` y `displayMode`. Los mensajes ya incluyen rutas canónicas en texto (`layout[0].props.items[1]`, `searchUsers.query.filters`, etc.).

### Restricciones de bundle
- `pnpm` + `Vite 7` + React 19, sin code-splitting explícito hoy. Una sola entrada (`src/main.tsx` → `index.html`).
- `import.meta.env.DEV` distingue `vite dev` (true) de `vite build` (false). Vite tree-shake ESM por defecto cuando un import dinámico queda dentro de una rama estáticamente eliminable.

### Restricciones del proyecto
- `Tailwind v4` con `@theme` global en `src/app/index.css` para tokens visuales. Sin theming declarativo.
- Cobertura mínima 80 % sobre `src/`. Coverage gate sigue siendo bloqueante.
- Convenciones: `kebab-case` para archivos, módulos agrupados por feature, validación al borde, errores explícitos con intención semántica.

## Objetivos / No objetivos

### Objetivos
- Definir la arquitectura del wrapper como capa opt-in completamente desacoplada del runtime, con su propio área de código.
- Fijar cómo entra Monaco al árbol React sin contaminar el bundle del runtime cuando el wrapper no se monta.
- Fijar la estrategia de unificación de esquemas Zod en un schema raíz aditivo para derivar el JSON Schema del editor sin tocar el validador actual.
- Fijar el mecanismo de "aplicar" un JSON validado al runtime preservando estado de formularios, queries y página activa.
- Establecer la frontera entre los artefactos nuevos del wrapper y los del runtime para que las tareas posteriores puedan trocearse sin reinterpretar arquitectura.

### No objetivos
- Cambiar el contrato observable del runtime, su política de errores de bootstrap o su semántica de re-render.
- Sustituir o refactorizar el cuerpo de `validate-runtime-config.ts`; sigue siendo la fuente de verdad de validación.
- Persistir cambios entre sesiones, descargar JSON como fichero o integrar IA en el editor.
- Habilitar el modo dev en producción ni introducir flags en el JSON de configuración.

## Decisiones

### D1. Composición de montaje y bundle del wrapper
- **Decisión**: el host (entry point) decide estructuralmente. `src/main.tsx` carga el wrapper sólo bajo `if (import.meta.env.DEV)` mediante `await import('./dev-runtime/dev-runtime')`; si la rama es false (production), Vite elimina el chunk completo del bundle final.
- **Forma concreta**:
  - `src/main.tsx` queda async, espera la promesa de import y monta `<DevRuntime />` (modo dev) o `<App />` (production). Ambos coexisten en el repo, ninguno se vuelve obsoleto.
  - El chunk del wrapper agrupa Monaco, `@monaco-editor/react`, `zod-to-json-schema` y los módulos bajo `src/dev-runtime/`.
  - `App` no cambia su firma. El wrapper reutiliza internamente `readRuntimeConfig` con la misma prioridad `data-config` > `src/dev/config.json`.
- **Alternativa descartada**: entrada HTML separada (`index-dev.html` + `main-dev.tsx`). Más explícita pero introduce dos entradas Vite con la misma plantilla; el gate por `import.meta.env.DEV` cubre el objetivo de bundle con menos fricción.
- **Trade-off**: el wrapper queda atado al modo `vite dev`; no se podrá probar en `vite preview` o staging sin promover el toggle a una variable explícita. Aceptable para v1 (la spec lo limita a "entornos donde el host monte el wrapper" y la spec no lista staging como soporte).
- **Riesgo residual**: si una feature futura quiere montar el wrapper en builds productivos, habrá que sustituir el gate `import.meta.env.DEV` por otro mecanismo. No bloquea esta feature.

### D2. Estructura de carpetas del wrapper
- **Decisión**: todo el área del wrapper vive bajo `src/dev-runtime/`, paralelo al runtime y al config. El runtime no importa nada de ahí.
- **Módulos previstos**:
  - `dev-runtime.tsx`: componente raíz que reemplaza a `<App />` cuando se monta el wrapper. Hace bootstrap, gestiona `currentConfig`, drawer state, editor buffer y handlers de Aplicar/Copiar.
  - `dev-runtime-state-bridge.tsx`: componente hijo dentro del provider que expone vía `useImperativeHandle` un puente con `dispatchAndSyncState` y `getLatestState`.
  - `dev-runtime-state-migration.ts`: función pura `migrateRuntimeStateAcrossConfig(prevState, prevConfig, nextConfig)`.
  - `dev-runtime-monaco-editor.tsx`: wrapper de `@monaco-editor/react` con configuración de JSON Schema y opciones del editor.
  - `dev-runtime-json-schema.ts`: derivación lazy del JSON Schema desde el Zod raíz vía `zod-to-json-schema`.
  - `dev-runtime-drawer.tsx`: drawer lateral (overlay + panel) con cabecera, editor, panel de errores y acciones.
  - `dev-runtime-toggle-button.tsx`: botón flotante fijo en esquina.
  - `dev-runtime-keyboard.ts`: hook para el atajo de teclado opcional.
- **Alternativa descartada**: meter el wrapper dentro de `src/app/`. Mezcla código opt-in con la composición productiva; complica el code-splitting porque `src/app/` se importa en cualquier build.
- **Trade-off**: una carpeta más a nivel raíz de `src/`. Compensado por la claridad de frontera y por la facilidad de tree-shaking.

### D3. Unificación del schema raíz para autocompletado
- **Decisión**: añadir `src/config/runtime-config-root-zod.ts` que componga los schemas por nodo existentes en un único schema raíz `runtimeConfigRootSchema`. Lo consume el wrapper para generar JSON Schema; el validador (`validate-runtime-config.ts`) **no** lo usa. Cero cambios funcionales en la validación.
- **Forma concreta**:
  - El schema raíz declara `api`, `initialPage`, `pages[].id`, `pages[].preloads`, `pages[].layout` reutilizando los `*NodeSchema` ya exportados.
  - Para el árbol recursivo (`children`, `template`, `form.children`) usa `z.lazy` y `z.discriminatedUnion('type', [...])` con los node schemas ya disponibles.
  - Se exportan también versiones "loose" de los schemas que reemplacen `z.unknown()` en `children`/`template` por la unión recursiva. Estas versiones loose viven en el mismo módulo nuevo, no se mezclan con los originales.
  - No se borra ni reescribe nada de `runtime-config-zod.ts`. El runtime sigue importando los schemas atómicos como hoy.
- **Política de tree-shaking**: el módulo raíz queda fuera del grafo de imports del runtime. El wrapper lo importa explícitamente; Vite mantiene el código sólo en el chunk del wrapper. Verificación posterior: comprobar que el bundle de producción no contiene `runtimeConfigRootSchema` ni `zod-to-json-schema`.
- **Alternativa descartada**: refactorizar `validate-runtime-config.ts` para usar el schema raíz unificado. Beneficio teórico (una sola fuente), coste real alto: cambia mensajes, rutas y posiblemente comportamiento de validaciones cruzadas; introduce riesgo de regresión que la spec excluye explícitamente del alcance.
- **Trade-off**: dos representaciones internas del contrato (schemas atómicos del validador + schema raíz para autocompletado). Aceptable porque el schema raíz se construye **a partir de** los atómicos, no en paralelo: si un node schema cambia, el raíz lo refleja automáticamente.
- **Riesgo residual**: posible drift si un node schema cambia su shape de tal forma que el schema raíz lo refleje peor para autocompletado pero el validador siga aceptando entradas válidas (autocompletado incompleto). Aceptable; el editor sigue siendo orientativo y la validación real ocurre al pulsar `Aplicar`.

### D4. Generación del JSON Schema para Monaco
- **Decisión**: usar `zod-to-json-schema` como dependencia añadida exclusivamente al chunk del wrapper. La derivación se ejecuta una vez al montar el editor y se cachea durante la sesión.
- **Forma concreta**:
  - `dev-runtime-json-schema.ts` exporta `getRuntimeConfigJsonSchema(): JSONSchema7` con cache `useMemo` o memoización modular.
  - `dev-runtime-monaco-editor.tsx` registra el schema en `monaco.languages.json.jsonDefaults.setDiagnosticsOptions` con un `uri` ficticio (`inmemory://runtime-config.json`) y enlaza el modelo abierto a ese URI.
- **Alternativa descartada**: mantener el JSON Schema escrito a mano. Coste de mantenimiento alto, divergencia probable. Sin beneficio frente a derivar.
- **Trade-off**: dependencia nueva (`zod-to-json-schema`, ~30 KB). Aceptable: queda fuera del bundle del runtime y dentro del chunk dev.

### D5. Mecanismo de "aplicar" config y preservación de estado
- **Decisión**: reutilizar la action `runtime/reset` ya existente. El wrapper guarda `currentConfig` como estado React. Al aplicar, calcula `nextState` con `migrateRuntimeStateAcrossConfig`, hace el swap del prop `config` del provider y dispatcha el reset en el mismo event handler. Para garantizar orden y consistencia en una sola pintura React, usa `flushSync` alrededor del `setCurrentConfig` antes del dispatch.
- **Forma concreta**:
  - `RuntimeStateProvider` no cambia su API externa. Internamente se mete un componente hijo `DevRuntimeStateBridge` (sólo se renderiza cuando el wrapper lo monta) que llama a `useRuntimeStateContext()` y, vía `useImperativeHandle`, expone al wrapper:
    - `dispatchAndSyncState(action)`
    - `getLatestState()`
  - El wrapper renderiza:
    ```tsx
    <RuntimeStateProvider config={currentConfig}>
      <DevRuntimeStateBridge ref={bridgeRef} />
      <RuntimePage />
    </RuntimeStateProvider>
    ```
  - Handler de aplicar (simplificado):
    ```ts
    function handleApply() {
      const editedText = editorBuffer
      let parsed: unknown
      try { parsed = JSON.parse(editedText) } catch (error) { setParseError(...); return }
      const validation = validateRuntimeConfig(parsed)
      if (validation.status === 'error') { setValidationError(validation.error); return }
      const prev = bridgeRef.current!.getLatestState()
      const next = migrateRuntimeStateAcrossConfig(prev, currentConfig, validation.config)
      flushSync(() => setCurrentConfig(validation.config))
      bridgeRef.current!.dispatchAndSyncState({ type: 'runtime/reset', payload: { state: next } })
      clearPendingChanges()
    }
    ```
  - `migrateRuntimeStateAcrossConfig(prev, prevConfig, nextConfig): RuntimeState`:
    - Recorre `nextConfig.pages[].layout` (y `form.children`, `repeater.template`, `container.children`) construyendo `Map<formId, Set<fieldId>>` de formularios soportados.
    - `forms`: para cada `formId` en `prev.forms` que aparezca en el mapa, filtra `fieldId` a los que sigan existiendo; el resto desaparece.
    - `queries`: filtra `prev.queries` a `Object.keys(nextConfig.api)`. Las que ya no estén declaradas se descartan.
    - `navigation`: si `prev.navigation.currentPageId` ∈ `nextConfig.pages`, conserva el `currentPageId` y reconstruye `history` con una sola entrada `{ entryId: 0, pageId: currentPageId, params: prev params }`. Si no, degrada a `nextConfig.initialPage` con history nuevo. `lastError: null`.
    - `pageEntry`: rebuild con `entryId: 0`, `pageId` actual ya resuelto, `params` heredados (mismos criterios), `preloadNames` = preloads del nuevo page, `status: 'idle'`. El planner de preloads de `RuntimeStateProvider` reaccionará después y disparará los que falten, sin re-disparar los que sigan con `requestSignature` válida (lógica ya existente).
- **Alternativa descartada A**: refactor del provider para volverse controlado (`initialState` por prop). Cambia un contrato estable cubierto por tests amplios; riesgo medio-alto fuera de alcance.
- **Alternativa descartada B**: remount con `key` derivada de config + restauración por efectos. Pierde garantía determinista sobre el orden de hash sync y preloads; difícil de cubrir con tests.
- **Trade-off**: `flushSync` es invasivo de cara a React 18+, pero su uso aquí está acotado a un único event handler de un componente dev. No afecta producción.
- **Riesgo residual**: si el JSON nuevo cambia drásticamente el shape de un formulario activo (mismo `formId`, mismos `fieldId`, pero defaults o tipos distintos), el estado preservado puede quedar "stale". Aceptable: la spec lo cubre como "descartar silenciosamente cualquier estado huérfano que ya no encaje"; aquí el campo sigue existiendo y conserva su valor, lo cual es coherente con "preservar `fieldId` que sigan existiendo".

### D6. Buffer del editor y ciclo del drawer
- **Decisión**: estado del wrapper (`useState`) para `editorOpen`, `editorBuffer`, `hasPendingChanges`, `lastValidationError`, `parseError`. Sin `localStorage` ni `sessionStorage`. Reload de página = reset.
- **Forma concreta**:
  - Primera apertura del drawer en la sesión: `editorBuffer` se inicializa con `JSON.stringify(currentConfig, null, 2)`.
  - Cerrar el drawer no descarta el buffer; reaperturas posteriores reabren con el último buffer.
  - Aplicar exitoso: reemplaza el buffer por `JSON.stringify(newConfig, null, 2)`, marca `hasPendingChanges: false`.
  - Cambio en el editor: marca `hasPendingChanges: true`.

### D7. Errores de validación en el panel
- **Decisión**: reutilizar la forma plana de `RuntimeConfigError` que ya produce `validateRuntimeConfig`. El panel muestra `error.code` (etiqueta) y `error.message` (incluye ruta canónica en el texto). Los errores de `JSON.parse` se muestran con su `message` original y, si está disponible, su línea (de `error instanceof SyntaxError` con position).
- **No objetivo de design**: rediseñar el shape de errores ni expandirlo a lista. Se mantiene flat (un error a la vez) para no cambiar la frontera pública del validador.
- **Riesgo residual**: la UX del panel queda condicionada al granular del validador (un error mostrado por aplicar). Aceptable para MVP; la spec excluye explícitamente markers inline y reescritura de mensajes.

### D8. Toggle, drawer, atajo de teclado
- **Decisión**:
  - Botón flotante: `position: fixed`, esquina inferior derecha, `z-index` alto. Visible siempre mientras el wrapper esté montado.
  - Drawer: panel lateral derecho con animación `translate-x`. Ancho ~`max-w-2xl`. Overlay opcional sin oscurecer fuertemente; el runtime debe seguir visible detrás.
  - Estilo: utilidades Tailwind sobre tokens existentes (`bg-app-surface`, `text-app-text`); ningún nuevo `@theme`.
  - Atajo de teclado: `Ctrl+Shift+J` (Cmd+Shift+J en macOS) abre/cierra el drawer. Se registra con `addEventListener('keydown')` mientras el wrapper esté montado. `Esc` cierra el drawer si está abierto.
- **Trade-off**: el atajo `Ctrl+Shift+J` puede colisionar con shortcuts del navegador en algunas plataformas (Firefox abre el browser console con Ctrl+Shift+J). Aceptable como elección dev: se documenta y el toggle visual queda como fallback. No es un atajo crítico.

### D9. Acción "Copiar al portapapeles"
- **Decisión**: copiar el contenido textual actual del editor (no el JSON activo). Usar `navigator.clipboard.writeText`. Si falla, fallback a `document.execCommand('copy')` con un textarea oculto. Sin notificación toast nueva: feedback inline corto en el botón (`Copiado`).

## Riesgos y trade-offs

### Riesgos técnicos
- **Drift entre schema raíz y validador real**: mitigado porque el schema raíz se compone de los atómicos existentes. Riesgo residual sólo en autocompletado, no en validación.
- **Errores sutiles en `migrateRuntimeStateAcrossConfig`**: alta cobertura de unit tests sobre todas las ramas (form rename, field drop, query drop, page drop, page kept). Sin esta cobertura el aplicar puede dejar estado inconsistente.
- **Workers de Monaco bajo Vite**: `@monaco-editor/react` por defecto carga workers desde CDN. Hay que confirmar que en `vite dev` funciona sin red. Mitigación: documentar y, si falla, configurar `monaco-editor/min/vs/loader` local. Se trata en una tarea concreta.
- **flushSync dentro del event handler**: si dentro del proceso de migración React detecta un re-render no compatible (concurrent features), puede lanzar warning. Mitigación: aislar el handler y testearlo sobre el árbol completo del wrapper.

### Trade-offs aceptados
- Dos representaciones del contrato (atomic schemas + root schema). Justificado por evitar regresiones sobre el validador.
- Wrapper sólo disponible bajo `import.meta.env.DEV`. Sin soporte staging.
- Atajo de teclado posiblemente colisiona con devtools en Firefox. Toggle visual es el camino canónico.
- Errores plano (uno a la vez). Limitación heredada del validador, no es ámbito de este design ampliarlo.

## Migración o despliegue
- Sin migración de datos. El JSON consumido por el runtime no cambia.
- Sin cambios en `data-config` ni en `src/dev/config.json`.
- Tras esta feature, `pnpm install` añadirá `monaco-editor`, `@monaco-editor/react` y `zod-to-json-schema` como `dependencies` o `devDependencies`. Como sólo entran en el chunk del wrapper, recomendación: declararlas como `dependencies` (Vite las trata en runtime aunque el chunk sea dev). El bundle de producción no las arrastra.
- Verificación de bundle: script de build comprueba que el output de `vite build` no incluye `monaco`, `@monaco-editor` ni `zod-to-json-schema`. Esto debe quedar fijado como criterio de cierre durante la planificación.

## Preguntas abiertas
- Ninguna técnica bloqueante para planificar. Si durante la implementación se descubre que `@monaco-editor/react` no puede operar sin red en `vite dev` por defecto, se decidirá en tarea concreta si se sirve Monaco desde recursos locales versionados o se acepta la dependencia de red.
