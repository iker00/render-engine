# Design: Feature 2026-08-20-15-27 - dev-editor-api-preloads-navigate-params

## Contexto

El editor de desarrollo (`src/dev-runtime/`) ya resuelve el mismo problema de fondo dos veces: `Shell` (`shell-config-panel/`) y `Traducciones` (`translations-panel/`) son paneles de formulario dedicados, montados desde la barra flotante (`dev-editor-floating-toolbar.tsx` / `dev-editor-layer.tsx`) en lugar del canvas de `Layout`, y ambos comparten el mismo pipeline commit: mutar en memoria → `patchRootKey(lastValidConfigText, '<clave-raíz>', valor)` → `validateRuntimeConfig` → aplicar solo si es válido. Ese pipeline es la "última barrera de seguridad" y no delega en un segundo validador.

Contrario a lo que planteaba la spec como pregunta técnica abierta, el bloque `api` **ya tiene tipado estable en TypeScript y Zod**, solo que no está enganchado al parser Zod raíz (`api: z.record(z.string(), z.unknown())` en `runtime-config-root-zod.ts`):
- Tipos ya existentes en `src/config/runtime-config-types.ts`: `RuntimeApiConfig`, `RuntimeApiOperation`, `RuntimeApiRequestParams`, `RuntimeApiMethod`, `RuntimeApiQuery`, `RuntimeApiHeaders`, `RuntimeApiBodyValue`, `RuntimePreloadConfig`.
- Schemas Zod ya existentes en `src/config/runtime-config-zod.ts`: `runtimeApiOperationShellSchema`, `runtimeApiQuerySchema`, `runtimeApiHeadersSchema`, `runtimeApiRequestParamsSchema` (este último ya reutilizado tanto por `api.{op}` como por `preloads[].requestParams`).
- `validate-api-config.ts` y `validate-preloads.ts` ya consumen esos tipos y schemas como su propio contrato interno; no son validación "ad hoc" sobre `unknown`.

También contrario a la spec, el botón de pestaña "Api" de la barra flotante **ya existe en el código actual** (`dev-editor-floating-toolbar.tsx`, `data-testid="dev-editor-toolbar-domain-api"`), renderizado `disabled`/`aria-disabled` con `title="Próximamente"`, igual que "Páginas" y "Tokens". No hace falta UI nueva a nivel de barra, solo activarlo — mismo patrón que ya se siguió para `shell`/`translations` (`ToolbarDomain = 'layout' | 'shell' | 'translations'` gana `'api'`).

El editor clave-valor ya compartido (`KeyValuePropertyField`, en `layout-canvas/property-fields/`) es un componente autocontenido (`{ label, value, onChange }`) sin dependencia del dispatcher de `Layout` ni de contexto Zod — ya se reutiliza directamente fuera del dispatcher (p. ej. `IconPickerPropertyField`/`ConditionGroupPropertyField` en `Shell`), así que es el punto de extensión natural para `navigateTo.params` y para los mapas de `api`/`preloads`.

## Objetivos / No objetivos

### Objetivos
- Panel de dominio "Api" en la barra flotante, con el mismo patrón de panel dedicado que `Shell`/`Traducciones` (sin canvas, sin selección de nodo).
- CRUD de operaciones `api` (alta/edición/borrado, sin renombrado) y edición de `method`/`endpoint`/`query`/`body`/`headers` por operación.
- CRUD de `preloads` a nivel `shell` (raíz) y a nivel de página activa, con selección de `operationName` restringida a claves ya declaradas en `api` y edición de `requestParams`.
- Editor visual de pares clave/valor para `navigateTo.params`, integrado en el panel de propiedades ya existente de `Layout` (mismo dispatcher que ya resuelve `headers`/`query`/`body`).
- Todo lo anterior sobre el mismo pipeline de commit/validación ya vigente (`validateRuntimeConfig` como única fuente de verdad), sin tocar su contrato de errores.

### No objetivos
- No se toca `src/config/` (`runtime-config-zod.ts`, `runtime-config-types.ts`, `validate-api-config.ts`, `validate-preloads.ts`, `runtime-config-root-zod.ts`): la validación real sigue siendo exactamente la que ya existe hoy.
- No se añade un tipado Zod estructural a nivel de parser raíz para `api`/`preloads` (ver Decisión 1): quedan como `z.record(z.string(), z.unknown())` / `z.array(z.unknown())`, igual que hoy.
- No se generaliza `PropertyFieldDispatcher`/`toJSONSchema` para cubrir "Api": el panel se construye a mano, como `Shell`/`Traducciones`, no como una extensión del canvas de `Layout`.
- Pickers contextuales de referencias, autocorrección de referencias rotas, renombrado de operación: fuera de alcance según `spec.md`.

## Decisiones

### D1 — No tipar `api`/`preloads` a nivel de parser Zod raíz; reutilizar los tipos/schemas ya existentes
**Elegido:** el panel visual se construye directamente contra `RuntimeApiConfig`/`RuntimeApiOperation`/`RuntimeApiRequestParams`/`RuntimePreloadConfig` (ya en `runtime-config-types.ts`) para su estado en memoria, y sigue usando `validateApiConfig`/`validatePagePreloads`/`validateGlobalPreloads` sin modificarlos como única puerta de validación, exactamente igual que `Shell`/`Traducciones` usan `validateRuntimeConfig` sin tocar `validate-shell.ts`/`validate-translations.ts` desde su propio panel.
**Por qué frente a la alternativa:** la alternativa (mover `api`/`preloads` a un schema Zod estructural en el parser raíz, replicando el patrón de `shellSchema` + `validate-shell.ts`) es técnicamente viable — es justo el patrón que ya usa `shell` — pero el riesgo que la propia spec señala ("cambio transversal... revisión cuidadosa para no perder ninguna regla de validación ya vigente") solo tiene sentido pagarlo si hace falta el tipado para *generar* el formulario (como pasa con `Layout`/`Shell`, que sí derivan JSON Schema de Zod vía `toJSONSchema`). Aquí no hace falta: el panel "Api" no se genera desde JSON Schema, se escribe a mano (ver D2), así que el tipado TypeScript ya existente basta para la superficie de edición, y la validación real la sigue haciendo el módulo ya probado.
**Coste asumido:** el bloque `api`/`preloads` sigue sin autocompletado JSON Schema estructurado en Monaco (limitación ya vigente hoy, no la introduce ni la resuelve esta feature).
**Riesgo residual:** ninguno nuevo sobre validación — es exactamente el riesgo que ya existe hoy, sin ampliarlo.

### D2 — Panel "Api" como componente de formulario dedicado (patrón `Shell`/`Traducciones`), no como extensión del dispatcher de `Layout`
**Elegido:** nuevo módulo hermano de `shell-config-panel/` y `translations-panel/` (p. ej. `api-config-panel/`), con su propio componente raíz montado desde `DevEditorLayer` cuando `activeDomain === 'api'`, sin selección de nodo, breadcrumb ni panel de propiedades por nodo — mismo criterio ya documentado para `Shell`/`Traducciones`.
**Por qué frente a la alternativa:** la alternativa de generar el panel desde `toJSONSchema`/`PropertyFieldDispatcher` (como `Layout`) exigiría D1 en su variante "sí tipar en el parser raíz". Como D1 descarta eso, un panel a mano es la única forma consistente de construir el formulario sin ese tipado — y ya es el patrón preferido del proyecto para secciones de dominio fuera de `layout` (`Shell`, `Traducciones`).
**Trade-off:** el panel "Api" no hereda gratis el resto de la maquinaria del dispatcher genérico (enum→segmented, etc.); cada widget compartido que se quiera reutilizar (`KeyValuePropertyField`, `SegmentedTogglePropertyField`, `PropertyFieldRow`) se monta directamente, igual que `IconPickerPropertyField`/`ConditionGroupPropertyField` ya se montan directamente en `Shell`.

### D3 — `preloads` vive dentro de la misma pestaña "Api", como segunda sub-vista
**Elegido:** dos sub-vistas mutuamente excluyentes dentro del panel "Api" — "Operaciones" y "Preloads" — con el mismo patrón `role="tablist"` de dos `role="tab"` ya usado por `Shell` (Header/Sidebar), ambos `tabpanel` siempre montados en el DOM (oculto con clase Tailwind, no desmontado), para no perder estado de expansión/avisos de commit rechazado al alternar.
**Por qué frente a la alternativa:** la spec dejaba abierta una sección propia fuera de "Api". Se descarta porque cada entrada de preload depende directamente del catálogo de `api` (selección de `operationName`) — mantenerlas en la misma pestaña evita duplicar la lógica de "leer el catálogo de operaciones vigente" en dos puntos de montaje distintos de la barra flotante, y reutiliza un patrón de sub-vistas ya validado en el propio código (`Shell`).
**Dentro de "Preloads":** dos secciones apiladas sin caja (mismo lenguaje visual "sin caja, cabecera de texto simple" que el resto del editor) — "Precargas globales" (bloque raíz `preloads`, visible siempre) y "Precargas de la página activa" (`pages[activePageId].preloads`), leyendo `activePageId` del mismo selector de página que ya existe en la barra flotante — no se introduce un segundo selector de página.

### D4 — Activar el botón "Api" ya existente en la barra flotante, sin UI nueva de nivel barra
**Elegido:** quitar `disabled`/`aria-disabled`/`title="Próximamente"` del botón `data-testid="dev-editor-toolbar-domain-api"` ya presente en `dev-editor-floating-toolbar.tsx`, añadir `'api'` a `ToolbarDomain` y cablear `onDomainSelected('api')`/`isApiActive` igual que ya existe para `shell`/`translations`; en `DevEditorLayer`, tratar `'api'` igual que `'shell'`/`'translations'` en la limpieza de selección al cambiar de dominio (ver [[dev-mode-editor.md#Estado del editor entre modos]]).
**Corrección sobre la spec:** la spec plantea esto como "requiere UI nueva, no activar algo ya existente" — no es así en el código actual; se corrige la nota correspondiente en `spec.md` (riesgos/preguntas abiertas) para reflejar este hallazgo.

### D5 — `navigateTo.params` reutiliza `KeyValuePropertyField` con un predicado de solo-lectura por fila configurable, en vez de forzar el mismo comportamiento que `headers`/`query`
**Elegido:** añadir un prop opcional a `KeyValuePropertyField` (p. ej. `isValueEditable?: (value: unknown) => boolean`, con default equivalente al `isNestedValue` actual — solo objeto/array cae a solo lectura) para que el punto de montaje de `navigateTo.params` en el dispatcher de `Layout` pase un predicado más estricto (`value => typeof value === 'string'`), cumpliendo FR3: cualquier valor no-string (number/boolean/null) se muestra en solo lectura por fila.
**Por qué frente a la alternativa:** hoy `KeyValueRow` solo degrada a solo-lectura para objeto/array (`isNestedValue`); un valor primitivo no-string se muestra editable vía `String(value)` y se coacciona a string en cuanto el usuario edita esa fila — ese es el comportamiento correcto y ya probado para `headers`/`query` (que si acaso admiten `number`/`boolean` en `query`), pero **no** es lo que pide FR3 para `params`, que exige solo-lectura explícita para cualquier no-string. Forkear un segundo componente casi idéntico duplicaría lógica de commit/accesibilidad ya cubierta por tests; inyectar el predicado mantiene un único componente y dos comportamientos declarados en su call site, sin condicionales por nombre de campo dentro del propio widget.
**Riesgo residual:** el default del nuevo prop debe reproducir exactamente el `isNestedValue` actual para no regresar el comportamiento ya probado de `headers`/`query`/`body` — a cubrir explícitamente en el contrato de tests de la tarea que toque este componente.

### D6 — Patch de `preloads` de página reutiliza/extiende el mismo mecanismo de parcheo por página que ya usa el canvas de `Layout`, no uno nuevo
**Elegido:** el commit de "Precargas de la página activa" se apoya en el mismo módulo (`layout-canvas-commit.ts`) que ya sabe sustituir una clave de la página activa (`layout`) preservando el resto del documento intacto (`buildCommitCandidateConfig` + su contraparte de parcheo de texto crudo, `patchRawConfigTextWithLayout`), generalizándolo o añadiéndole una función hermana equivalente para `preloads` de página, en vez de introducir una segunda implementación de "sustituir una clave de la página activa sobre el texto crudo".
**Por qué:** es exactamente el mismo problema (sustituir una clave de una página concreta sin tocar el resto del documento) que `Layout` ya resuelve; reutilizar evita dos rutas de parcheo divergentes para el mismo tipo de operación.
**Precarga global (`preloads` raíz) y `api`:** ambas son claves de nivel raíz, así que su commit usa `patchRootKey` directamente — mismo mecanismo exacto que `commitShellMutation`/`commitTranslationsMutation`.

### D7 — Guardas de alta duplicada y de `operationName` inexistente se resuelven en el panel, no en `validateRuntimeConfig`
**Elegido:** el intento de alta de una operación `api` con clave ya existente, y la restricción del desplegable de `operationName` de un preload a las claves ya declaradas en `api`, se resuelven como guardas locales del panel (mismo patrón `CommitRejectionBanner` que ya usa "Añadir entrada" en `Traducciones` para clave vacía/duplicada) antes de intentar ningún commit — no llegan a invocar el pipeline de validación porque, a nivel de objeto JS, una clave duplicada no es un error estructural detectable por `validateApiConfig` (sobrescribiría en silencio, no fallaría).
**Por qué:** es el mismo problema exacto que ya resolvió `Traducciones` para clave de entrada duplicada; reutilizar el criterio evita una tercera forma de "rechazo local" en el editor.

### D8 — El editor de operación oculta `body` mientras `method` es `GET`, en vez de mostrarlo y solo rechazar al aplicar
**Elegido:** el campo `body` de una operación (y de un preload cuya operación referenciada es `GET`) no se renderiza mientras el `method` activo es `GET`; cambiar a un método con body lo vuelve a mostrar. `method` se edita con `SegmentedTogglePropertyField` (5 opciones, coherente con la regla ya vigente de "enum 2-5 → segmented").
**Por qué:** mismo criterio ya usado por el selector "Modo" de `container` (Grid/Columnas) — un campo que dejaría de tener sentido con la selección actual desaparece del panel en vez de quedar visible-pero-inválido. La regla de validación ("GET no admite `body`") se mantiene como red de seguridad para configs que llegan así desde Monaco, sin cambiar su comportamiento.

## Riesgos y trade-offs
- **Regresión de comportamiento en `headers`/`query`/`body`:** D5 introduce un parámetro nuevo en un componente ya compartido y probado; el contrato de tests de la tarea correspondiente debe cubrir explícitamente que el comportamiento por defecto (sin el nuevo prop) no cambia.
- **Documentación desalineada con el código:** este design corrige dos afirmaciones de `spec.md` (tipado de `api`/`preloads`, existencia del botón "Api" en la barra) que no coincidían con el estado real del código explorado durante esta fase — ver actualización aplicada a `spec.md`.
- **Alcance de `patchRawConfigTextWithLayout`:** generalizar ese módulo para `preloads` de página exige mantener la garantía ya vigente de "solo la clave tocada cambia" — si el patch de `preloads` acabase tocando accidentalmente `layout` de la misma página (o viceversa), rompería la preservación de ediciones manuales en Monaco que documenta `dev-mode-editor.md`. Riesgo a vigilar en la tarea que toque ese módulo, no una decisión abierta.
- **Sin cambio en la política de validación de referencias rotas** (`operationName` de un preload apuntando a una operación borrada): igual que hoy, por diseño explícito de la spec — el panel no intenta ser más inteligente que el validador existente.

## Migración o despliegue
No aplica. Cambio exclusivo del editor de desarrollo (`src/dev-runtime/`), sin persistencia a backend, sin cambio en el contrato JSON de producción ni en `src/config/`. No requiere migración de datos ni coordinación de despliegue.

## Preguntas abiertas
Ninguna bloqueante para planificación: ambas decisiones técnicas que la spec dejaba pendientes (D1, D4) quedaron resueltas por evidencia directa en el código actual durante esta fase, no por supuestos.
