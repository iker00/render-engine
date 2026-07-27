# Plan de implementación — Feature 0110

## Orden de ejecución
1. T1 — Extraer el núcleo compartido de validación de `preloads` en `src/config/`
2. T2 — Contrato de configuración raíz `preloads` (tipo, shell Zod, `validateGlobalPreloads`, integración)
3. T3 — Primitiva de reintentos acotados en `src/queries/`
4. T4 — Plan del `preloads` global y pre-inicialización de `queries.*` en bootstrap del runtime
5. T5 — Hook `use-runtime-global-preloads` y wiring en `RuntimeStateProvider`

Cada tarea debe completarse con sus tests en verde antes de empezar la siguiente. Ninguna tarea es puramente documental; la actualización de fichas de producto se hace después con `update-app-documentation` sobre `documentación afectada`.

---

## T1 — Extraer el núcleo compartido de validación de `preloads` en `src/config/`

### Estado
Completada

### Objetivo
Refactorizar `src/config/validate-preloads.ts` para aislar el núcleo reutilizable (validación de la lista de entradas de preload) en un helper interno `validatePreloadEntries` parametrizado por dos modos: `page` (comportamiento actual de `pages[].preloads`) y `root` (rechazo de `when`, prefijo de ruta `preloads[i]...`). La API pública sigue siendo `validatePagePreloads(rawPreloads, pageIndex, validateRuntimeApiRequestParams)` con el mismo contrato de entrada, misma firma, mismos mensajes de error, misma detección de duplicados y misma delegación en `runtimeApiRequestParamsSchema` y `validateRuntimeApiRequestParams`.

Esta tarea es un refactor puro: ninguna configuración válida hoy pasa a ser inválida, ninguna configuración inválida hoy pasa a ser válida, y todos los mensajes de error existentes se conservan literalmente (misma cadena, misma ruta). No se añade el modo `root` como export público todavía: sólo se prepara la superficie interna para que T2 lo consuma.

### Fuera de alcance
- Añadir el campo `preloads` al tipo `RuntimeConfig` o al shell Zod raíz.
- Exportar `validateGlobalPreloads` o cualquier API nueva de validación.
- Integrar la validación del bloque raíz en `validateRuntimeConfig` (T2).
- Cambiar el comportamiento observable de `pages[].preloads` para consumidores externos, incluida la firma pública de `validatePagePreloads` (`(rawPreloads, pageIndex, validateRuntimeApiRequestParams)`).
- Alterar la política ya vigente de rechazo/aceptación de `item.*` en `when` (`allowItem: false` se mantiene en modo `page`).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/validate-preloads.ts` — introducir un helper interno `validatePreloadEntries` (no exportado o exportado sólo para uso interno del paquete `src/config/`) que reciba las diferencias entre modos:
    - prefijo de ruta base: `pages[N].preloads` (`page`) vs `preloads` (`root`),
    - política de `when`: permitido con `allowItem: false` (`page`) vs rechazado con ruta exacta (`root`),
    - texto exacto de los mensajes de error: mantener literalmente los de hoy en modo `page`, e introducir la variante paralela para `root` (usable por T2 sin cambios).
  - `validatePagePreloads` pasa a ser un wrapper trivial que llama al helper en modo `page` y adapta el resultado al tipo actual.
  - Mantener `getPreloadPath` y helpers privados (`invalidPreloadEntry`, `mapPreloadRequestQueryIssue`, `mapPreloadRequestHeadersIssue`, `mapPreloadRequestBodyIssue`, `normalizePagePreloadRequestParamsIssue`, `findInvalidJsonBodyPath`, `isRecord`, `formatPathSegment`) reutilizables por el helper compartido, generalizando el prefijo de ruta cuando sea necesario.
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación) — no se añaden casos nuevos, pero se ejecuta como prueba de regresión de que el refactor no altera ninguna ruta de error ni ningún mensaje observable de `pages[].preloads`. Si algún test estaba acoplado a implementaciones internas ahora reubicadas, ajustar únicamente el import; no relajar aserciones sobre mensajes.
- Documentación afectada:
  - Ninguna. Es un refactor interno sin impacto observable en `app-features/`.

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación)

**Comportamiento cubierto**
- Todos los casos existentes de aceptación y rechazo de `pages[].preloads` siguen produciendo el mismo veredicto (`ready` vs `error`) y, en caso de error, la misma cadena literal de `message` y el mismo `code`.
- Un preload con `when: { reference: 'item.x', operator: 'isTruthy' }` sigue rechazándose con la ruta exacta `pages[N].preloads[i].when` (regresión de `allowItem: false` en modo `page`).
- Un preload con `operationName` duplicado dentro de la misma página sigue rechazándose con el mensaje literal actual.
- Un preload con `body` no serializable a JSON sigue rechazándose con la ruta más profunda (`pages[N].preloads[i].{operationName}.body[...]`).

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`

**Restricciones**
- No introducir dependencias nuevas, ni externas ni entre módulos de `src/`.
- No cambiar el nombre ni la firma pública de `validatePagePreloads`; el resto de `src/config/` sigue importándola sin cambios.
- Si el helper compartido se extrae a un fichero nuevo dentro de `src/config/`, mantenerlo en el mismo directorio y no exportarlo desde `src/config/runtime-config.ts` hasta T2.

### Criterios de finalización
- `validate-preloads.ts` implementa el núcleo compartido y `validatePagePreloads` delega en él sin cambios de comportamiento observable.
- Los tests existentes de `pages[].preloads` pasan en verde sin relajar aserciones.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura (`ai-workflow/standards/testing-rules.md`).

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T1`.

---

## T2 — Contrato de configuración raíz `preloads` (tipo, shell Zod, `validateGlobalPreloads`, integración)

### Estado
Completada

### Objetivo
Añadir el bloque raíz opcional `preloads` al contrato de configuración: extender el tipo `RuntimeConfig`, el shell Zod raíz y `validateRuntimeConfig` para reconocer y validar el nuevo bloque con reglas restringidas (sin `when`, sin `operationName` duplicado, cross-check contra el catálogo `api`), delegando en el helper compartido de T1 en modo `root`. Configuraciones sin bloque raíz o con `preloads: []` no experimentan ningún cambio observable; configuraciones con entradas válidas quedan aceptadas y expuestas como `config.preloads: RuntimePreloadConfig[]` para consumidores posteriores. El runtime todavía no dispara ninguna operación derivada de este bloque (eso llega en T4 y T5).

### Fuera de alcance
- Cualquier disparo, planificación o ejecución de operaciones del `preloads` global (T3, T4, T5).
- Cualquier cambio en el shape o en la validación de `pages[].preloads`.
- Añadir soporte para `when` en el bloque raíz (queda explícitamente rechazado por spec).
- Introducir una categoría separada de errores "reintentables" / "no reintentables" en la validación.
- Cualquier UI en `src/dev/` que consuma el nuevo bloque.

### Dependencias
- T1.

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/runtime-config-types.ts` — añadir `preloads?: RuntimePreloadConfig[]` a la interfaz `RuntimeConfig`, hermano de `api`, `pages`, `initialPage`, `translations` y `tokens`. El tipo `RuntimePreloadConfig` se reutiliza sin modificar (el `when?` sigue presente en el tipo pero se rechaza en validación cuando el modo es `root`).
  - `src/config/runtime-config-zod.ts` — extender `runtimeConfigShellSchema` para aceptar `preloads: z.array(z.unknown()).optional()` en el shell raíz, delegando la interpretación detallada al validador dedicado (mismo patrón que `pages[].preloads`).
  - `src/config/validate-preloads.ts` — exportar `validateGlobalPreloads(rawPreloads, validateRuntimeApiRequestParams)` que invoca el helper interno de T1 en modo `root` y devuelve `{ status: 'ready'; preloads?: RuntimePreloadConfig[] } | { status: 'error'; error: RuntimeConfigError }`. Rutas de error emitidas: `preloads` (no es array), `preloads[i]` (shape inválido), `preloads[i].{operationName}` / `preloads[i].{operationName}.query[.<key>]` / `preloads[i].{operationName}.headers[.<key>]` / `preloads[i].{operationName}.body[...]`, `preloads[i].when` (rechazo explícito del bloque raíz), y mensaje literal específico para `operationName` duplicado dentro del mismo bloque.
  - Al invocar `validateRuntimeApiRequestParams` en modo `root`, el parámetro `pageId` debe ser exactamente la cadena literal `'preloads'` (no vacío, no `null`). Tras obtener el error, el helper compartido de T1 en modo `root` debe normalizar el prefijo `Page "preloads" has an invalid layout at "` a `The runtime config has an invalid layout at "` (paralelo al `normalizePagePreloadRequestParamsIssue` ya existente, que sustituye `Page "pages[N]" has an invalid layout at "` por `The page at "`). El resto de la cadena (ruta exacta `preloads[i].{operationName}...` y mensaje) debe conservarse literalmente.
  - `src/config/validate-runtime-config.ts` — tras validar `api` y `tokens`, y antes de procesar las páginas, invocar `validateGlobalPreloads` con el mismo `validateRuntimeApiRequestParams` que ya usa `validatePagePreloads`. Propagar el resultado al `RuntimeConfig` final (`config.preloads = ...` sólo si hay entradas; ausencia o `[]` no añade la clave). Mapear el error del shell (`configShellResult`) cuando la primera issue del shell apunta a `preloads` a `invalidLayout('The runtime config field "preloads" must be an array.')`.
- Tests a crear:
  - `src/tests/config-validation/runtime-config-validation-global-preloads.test.ts` (nuevo).
- Documentación afectada:
  - `ai-workflow/docs/app-features/config/structure.md`
  - `ai-workflow/docs/app-features/config/index.md`
  - `ai-workflow/docs/app-features/queries/preloads.md`
  - `ai-workflow/docs/app-features/queries/index.md`
  - `ai-workflow/docs/current-state.md`

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-global-preloads.test.ts` (nuevo)

**Comportamiento cubierto**
- Config sin bloque raíz `preloads`: `validateRuntimeConfig` devuelve `status: 'ready'` con el mismo `config` que produce hoy y sin la clave `preloads` en el objeto resultado.
- Config con `preloads: []`: se acepta como `ready`, sin añadir `preloads` al `config` de salida (comportamiento indistinguible de la ausencia).
- Config con `preloads: [{ getCatalog: {} }]` referenciando un `operationName` presente en `api`: se acepta y expone `config.preloads = [{ operationName: 'getCatalog', requestParams: {} }]`.
- Config con `preloads: [{ getCatalog: { query: { locale: 'es' }, headers: { 'x-a': 'b' } } }]`: se acepta y las `requestParams` viajan íntegras al resultado.
- Config con `preloads: [{ unknownOperation: {} }]`: se rechaza como `invalid-layout` con `message` que empieza por `The runtime config has an invalid layout at "preloads[0].unknownOperation"` (prefijo `The runtime config` tras la normalización del modo `root`; ruta exacta `preloads[0].unknownOperation`).
- Config con `preloads: [{ getCatalog: {}, when: { reference: 'queries.x', operator: 'isTruthy' } }]`: se rechaza con ruta exacta `preloads[0].when` y mensaje que explicite que `when` no se admite en el bloque raíz.
- Config con dos entradas cuyo `operationName` es idéntico dentro de `preloads`: se rechaza con mensaje literal que identifique la ruta `preloads` y el `operationName` duplicado (paralelo al mensaje que ya usa `pages[].preloads`).
- Config con `preloads: [{ getCatalog: { query: { locale: { nested: true } } } }]`: se rechaza con ruta exacta `preloads[0].getCatalog.query.locale`.
- Config con `preloads: [{ getCatalog: { body: { a: () => 0 } } }]` u otro valor no serializable: se rechaza con la ruta más profunda `preloads[0].getCatalog.body...` (mismo patrón que `pages[].preloads`).
- Config con `preloads: 'oops'` (no array): se rechaza con `The runtime config field "preloads" must be an array.` y `code: 'invalid-layout'`.
- Config con `preloads: [{}]` o `[{ '': {} }]`: se rechaza con ruta `preloads[0]` (shape inválido).
- Regresión: los ficheros de test de `pages[].preloads` (T1) siguen en verde sin cambios.

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-global-preloads.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`

**Restricciones**
- Reutilizar el helper compartido de T1 en modo `root`; no duplicar el shape-parsing de `runtimeApiRequestParamsSchema`.
- Reutilizar `validateRuntimeApiRequestParams` para el cross-check con el catálogo `api` (misma dependencia que `pages[].preloads`). El `pageId` que espera hoy la función se sustituye por un identificador estable (por ejemplo `'preloads'`) en modo `root`; ajustar la normalización del mensaje si el prefijo actual no encaja, sin cambiar el comportamiento de `pages[].preloads`.
- No añadir `preloads` al tipo `RuntimeConfig` de salida cuando la lista efectiva sea vacía o ausente.

### Criterios de finalización
- `RuntimeConfig` reconoce el bloque opcional en el tipo público y en el shell Zod.
- `validateGlobalPreloads` está exportado desde `src/config/validate-preloads.ts` y consumido desde `validate-runtime-config.ts`.
- Todos los tests declarados arriba pasan en verde y los de `pages[].preloads` no regresionan.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T2`.

---

## T3 — Primitiva de reintentos acotados en `src/queries/`

### Estado
Completada

### Objetivo
Añadir en `src/queries/` una utilidad pura y reutilizable que ejecute un intento de operación remota hasta un máximo de N veces sin espera entre intentos, devolviendo el primer resultado `success` o, si todos fallan, el `error` del último intento. La primitiva no conoce `dispatch`, ni `RuntimeConfig`, ni el reducer: es un bucle secuencial parametrizado por una función `attempt: () => Promise<AttemptResult>`. La constante `GLOBAL_PRELOAD_MAX_ATTEMPTS = 3` se define y exporta desde este mismo módulo como única fuente de verdad para la política de reintentos del `preloads` global.

Ningún consumidor real (hook, provider) utiliza todavía esta primitiva; T5 la enchufa. Aquí sólo se garantiza la existencia de la utilidad y su comportamiento aislado.

### Fuera de alcance
- Ampliar la política de reintentos a `executeOperation`, `executeOperations`, `pages[].preloads` o cualquier otra superficie.
- Diferenciar códigos de error "reintentables" y "no reintentables": la primitiva aplica uniforme.
- Introducir cualquier forma de espera, backoff, timeout o cancelación entre intentos.
- Introducir cualquier lógica de dispatch o de actualización del store.

### Dependencias
Ninguna. Independiente de T1/T2; se puede implementar antes o después, pero se ejecuta después de T2 para simplificar la revisión secuencial.

### Impacto esperado en archivos
- Código a crear:
  - `src/queries/runtime-api-retry.ts` — expone:
    - `export const GLOBAL_PRELOAD_MAX_ATTEMPTS = 3`,
    - `export async function runRuntimeApiRequestWithRetries<TResult extends { status: 'success' } | { status: 'error' }>({ attempt, maxAttempts }: { attempt: (attemptIndex: number) => Promise<TResult>; maxAttempts: number }): Promise<TResult>` que:
      - itera `for (let i = 0; i < maxAttempts; i += 1)`,
      - llama a `await attempt(i)`,
      - devuelve el primer resultado con `status: 'success'`,
      - si todos los intentos devuelven `status: 'error'`, devuelve el resultado del último intento,
      - no captura excepciones lanzadas por `attempt` (deja que se propaguen; el llamante decide),
      - no introduce `setTimeout`, `Promise.resolve()` intermedios ni ninguna espera artificial entre iteraciones.
- Tests a crear:
  - `src/tests/runtime/runtime-api-retry.test.ts` (nuevo).
- Documentación afectada:
  - Ninguna en esta tarea. Se referencia desde `app-features/queries/preloads.md` cuando la política sea observable (T5) mediante `update-app-documentation`.

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-api-retry.test.ts` (nuevo)

**Comportamiento cubierto**
- Un `attempt` que devuelve `success` en el intento 0 se resuelve con ese resultado tras exactamente una invocación (`attempt` llamado 1 vez).
- Un `attempt` que devuelve `error` en el intento 0 y `success` en el intento 1 se resuelve con el `success` tras exactamente 2 invocaciones.
- Un `attempt` que devuelve `error` en todos los intentos hasta `maxAttempts = 3` se resuelve con el `error` del último intento tras exactamente 3 invocaciones, y el resultado devuelto es referencialmente el del último intento (permite comprobar que el `code`/`message` reflejan el fallo final, no el primero).
- `GLOBAL_PRELOAD_MAX_ATTEMPTS === 3`.
- El bucle no introduce esperas artificiales entre intentos: al usar timers falsos (por ejemplo `vi.useFakeTimers()` con `vi.advanceTimersByTime(0)`) los intentos se resuelven en microtasks consecutivas sin necesidad de avanzar el reloj (regresión de "sin espera entre intentos").
- Si `attempt` lanza una excepción síncrona o rechazada, la excepción se propaga al `await` del llamante sin ser transformada en un resultado `error` (contrato de "no capturar excepciones").

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-api-retry.test.ts`

**Restricciones**
- No importar `RuntimeConfig`, `RuntimeState`, `runtime-state-reducer` ni ningún módulo de `src/runtime/` desde `src/queries/runtime-api-retry.ts`.
- No exponer `GLOBAL_PRELOAD_MAX_ATTEMPTS` desde otro módulo distinto: `runtime-api-retry.ts` es la única fuente de verdad.
- Mantener el fichero por debajo del límite orientativo de 400 líneas (`ai-workflow/standards/coding-style.md`).

### Criterios de finalización
- La primitiva existe, es pura, no tiene dependencias en el runtime y está cubierta por los tests descritos.
- La constante `GLOBAL_PRELOAD_MAX_ATTEMPTS` está exportada y usable por T5.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T3`.

---

## T4 — Plan del `preloads` global y pre-inicialización de `queries.*` en bootstrap del runtime

### Estado
Completada

### Objetivo
Introducir un helper puro `planGlobalPreloads` en el nuevo módulo `src/runtime/runtime-global-preloads/` y modificar `createRuntimeStateFromBrowserHash` en `runtime-state-provider.tsx` para que, al construir el estado inicial, siembre `queries.{operationName}` con el marcador correcto por cada operación del `preloads` raíz:

- Si `buildRuntimeApiRequest` produce una request válida, sembrar `{ status: 'loading', data: null, error: null, requestSignature: <sig> }`.
- Si `buildRuntimeApiRequest` produce un error determinista de compose (`operation-not-found`, `request-build-failed`, etc.), sembrar `{ status: 'loading', data: null, error: null, requestSignature: null }` como marcador de que la primera tentativa ya está prevista, sin fijar todavía el error real (lo hará T5 tras el primer intento).

En esta tarea todavía no se disparan requests reales ni se despachan `set-success`/`set-error`. Sólo se seedea el estado inicial y se materializa el plan (operationNames + requestSignature + `RuntimeApiRequestParams` efectivo + snapshot del estado) que T5 consumirá.

### Fuera de alcance
- Cualquier `fetch`, dispatch de resultado o efecto de red.
- Wiring del hook en `RuntimeStateProvider` (T5).
- Cambios en el comportamiento de `pages[].preloads`, en la orquestación por `pageEntry` o en la limpieza fresca por firma.
- Reutilización de la primitiva de reintentos (T3): se conecta en T5.
- Cualquier cambio en `runtime-state-reducer.ts` (la siembra ocurre en la creación del estado inicial, no vía acciones).

### Dependencias
- T2 (necesita `config.preloads` disponible).

### Impacto esperado en archivos
- Código a crear:
  - `src/runtime/runtime-global-preloads/plan-global-preloads.ts` — expone:
    - `interface GlobalPreloadPlanItem { operationName: string; requestParams: RuntimeApiRequestParams; requestSignature: string | null; composeError: RuntimeApiError | null }`.
    - `function planGlobalPreloads({ config, state }: { config: RuntimeConfig; state: RuntimeState }): { items: GlobalPreloadPlanItem[] }`.
    - Para cada entrada de `config.preloads ?? []`: invoca `buildRuntimeApiRequest({ config, operationName, state, requestParams })` reutilizando el módulo existente en `src/queries/runtime-api-executor.ts`. Si `status === 'ready'`, guarda `requestSignature`. Si `status === 'error'`, guarda `composeError` y `requestSignature: null`.
    - Es puro: mismo input → mismo output; no despacha ni muta.
  - `src/runtime/runtime-global-preloads/index.ts` — re-export interno del helper y de los tipos (preparado para que T5 añada aquí `use-runtime-global-preloads`).
- Código a modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx` — extender `createRuntimeStateFromBrowserHash` para que, tras `createRuntimeState(config, ...)`, invoque `planGlobalPreloads({ config, state: initialState })` y mezcle en `state.queries` una entrada por cada `item.operationName`. La entrada se seedea con `status: 'loading'` y el `requestSignature` calculado (o `null` si hubo error de compose). Debe respetar `dataValues`: si una clave del preload ya existe en `queries` por `dataValues`, no la sobrescribe (política latest-only + no colisionar con seeds explícitos del embedder). `createRuntimeStateFromBrowserHash` permanece como función privada del módulo (no se exporta): los tests observan la siembra montando `RuntimeStateProvider` y leyendo el estado inicial vía `useRuntimeState()`.
- Tests a crear:
  - `src/tests/runtime-state/runtime-state-global-preloads-init.test.tsx` (nuevo).
- Documentación afectada:
  - Ninguna en esta tarea (el comportamiento observable se documenta cuando T5 lo hace visible extremo a extremo, vía `update-app-documentation`).

### Tests

**Ficheros de test**
- `src/tests/runtime-state/runtime-state-global-preloads-init.test.tsx` (nuevo)

**Comportamiento cubierto**
- Config con `preloads: []`: al montar `RuntimeStateProvider`, el estado inicial expuesto por `useRuntimeState()` tiene `queries` idéntico al que hoy produce el mismo montaje sin cambios (sin nuevas claves).
- Config sin bloque `preloads`: idem al caso `[]` (regresión). Sirve como control de que no hay activación implícita.
- Config con `preloads: [{ getCatalog: {} }]` donde `getCatalog` existe en `api`: `queries.getCatalog` en el estado inicial es `{ status: 'loading', data: null, error: null, requestSignature: <string no vacío> }`. El `requestSignature` debe coincidir byte a byte con el que produce `buildRuntimeApiRequest` para esa misma operación y estado.
- Config con `preloads: [{ unknownOperation: {} }]` donde `unknownOperation` NO existe en `api`: `queries.unknownOperation` en el estado inicial es exactamente `{ status: 'loading', data: null, error: null, requestSignature: null }`. Aserción explícita: la seed NO fija todavía `status: 'error'` ni un `error.code` como `'operation-not-found'` (el error real lo escribe T5 tras el primer intento fallido de compose). Es un marcador de "primer intento ya previsto".
- Config con `preloads: [{ getCatalog: { query: { locale: 'es' } } }]`: el `requestSignature` seedeado incluye el `query` efectivo (dos configs con `query` distinta producen `requestSignature` distintos).
- Config con `preloads: [{ getCatalog: {} }]` y `dataValues: { getCatalog: { pre: true } }` pasados al provider: la seed no sobrescribe la entrada existente en `queries.getCatalog` (que sigue siendo `{ status: 'success', data: { pre: true }, ... }`). Los preloads que no colisionan con `dataValues` sí se seedean con `loading`.
- `planGlobalPreloads` es puro: dos llamadas consecutivas con el mismo `config` y `state` devuelven un objeto `items` con los mismos `operationName`, `requestSignature` y `composeError` en el mismo orden.
- Un mismo `operationName` que aparece en `preloads` raíz y en `pages[].preloads` de la página inicial, con la misma request efectiva, produce el mismo `requestSignature` en ambos cálculos (regresión anticipada de dedup; el efecto observable termina de comprobarse en T5).

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime-state/runtime-state-global-preloads-init.test.tsx`

**Restricciones**
- El nuevo módulo `runtime-global-preloads/` es hermano de `runtime-tokens/` y `runtime-navigation/` dentro de `src/runtime/`, no vive dentro de `runtime-state/`.
- `planGlobalPreloads` sólo importa `buildRuntimeApiRequest` de `src/queries/runtime-api-executor.ts`; no importa del reducer ni del provider.
- No modificar `runtime-state-reducer.ts` para seedear los preloads: la siembra ocurre en `createRuntimeStateFromBrowserHash`, no vía acción.
- No introducir dependencia del helper en `runtime-state-reducer.ts` (mantiene el reducer libre de la lógica de red).
- `createRuntimeStateFromBrowserHash` permanece privada del módulo `runtime-state-provider.tsx`. El test observa la siembra montando el provider y leyendo el estado vía `useRuntimeState()`; no exportar la función para instrumentarla directamente.

### Criterios de finalización
- `planGlobalPreloads` existe, es puro, y `createRuntimeStateFromBrowserHash` lo consume para seedear `queries.*`.
- Todos los tests declarados arriba pasan en verde y los tests existentes de `runtime-state-navigation.test.tsx` y `runtime-state-forms-queries.test.tsx` no regresionan.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T4`.

---

## T5 — Hook `use-runtime-global-preloads` y wiring en `RuntimeStateProvider`

### Estado
Completada

### Objetivo
Cerrar la feature enchufando el disparo real de las operaciones del `preloads` global una única vez por instancia de runtime, con la política de reintentos acotados de T3, sin bloquear el render inicial y sin depender de `initialPage`/`pageEntry`. El hook consume el plan producido por T4, ejecuta cada operación vía la primitiva de reintentos y despacha `queries/set-success` o `queries/set-error` al reducer existente. Al montarse en `RuntimeStateProvider`, la guardia por `useRef<boolean>` garantiza exactamente una ejecución por instancia (resistente a StrictMode y a re-renders).

### Fuera de alcance
- Modo bloqueante, pantallas globales de carga/error, o cualquier UI a nivel de aplicación.
- Cambios en el comportamiento de `pages[].preloads` (shape, tanda, latest-only, limpieza fresca).
- Nuevo tipo de acción o mecanismo UI para relanzar manualmente el `preloads` global.
- Persistencia entre recargas del navegador.
- Coordinación explícita con `runtime-tokens` (más allá de que un compose que dependa de un token en refresco falle igual y consuma un intento, sin lógica especial nueva).

### Dependencias
- T2, T3, T4.

### Impacto esperado en archivos
- Código a crear:
  - `src/runtime/runtime-global-preloads/use-runtime-global-preloads.ts` — hook consumido desde `RuntimeStateProvider`. Recibe `{ config, dispatch, getLatestState, fetchImplementation? }`. En `useEffect`/`useLayoutEffect` con guardia por `useRef<boolean>`:
    - si el ref ya está en `true`, retorna (idempotente frente a StrictMode / remount lógico dentro de la misma instancia),
    - marca el ref a `true` sin revertirlo en cleanup,
    - invoca `planGlobalPreloads({ config, state: getLatestState() })`,
    - para cada `item` del plan, lanza en paralelo un `runRuntimeApiRequestWithRetries({ maxAttempts: GLOBAL_PRELOAD_MAX_ATTEMPTS, attempt })` donde `attempt`:
      - reconstruye la request con `buildRuntimeApiRequest({ config, operationName, state: getLatestState(), requestParams: item.requestParams })`,
      - si `status === 'error'`, devuelve el error de compose tal cual (sin `fetch`),
      - si `status === 'ready'`, invoca `executeBuiltRuntimeApiRequest({ request, fetch: fetchImplementation })` y devuelve su resultado tipado,
    - al terminar cada operación, despacha `queries/set-success` o `queries/set-error` con el `requestSignature` de la request final (o `null` si el fallo fue de compose).
    - Nota: el hook NO despacha `queries/set-loading` porque la seed inicial (T4) ya lo hace; esto garantiza que los consumidores con `queryStateFeedback` vean `loading` desde el primer render sin doble transición.
  - Ampliar `src/runtime/runtime-global-preloads/index.ts` para re-exportar `useRuntimeGlobalPreloads`.
- Código a modificar:
  - `src/runtime/runtime-state/runtime-state-provider.tsx` — invocar `useRuntimeGlobalPreloads({ config, dispatch: dispatchAndSyncState, getLatestState: getLatestStateForScheduler })` junto a `useRuntimeTokenScheduler`. Debe montarse dentro del provider una vez el estado inicial ya está creado.
- Tests a crear:
  - `src/tests/runtime/runtime-global-preloads.test.tsx` (nuevo).
- Tests a modificar:
  - `src/tests/runtime-state/runtime-state-navigation.test.tsx` (ampliación, opcional) — sólo si algún test existente monta un provider con config que ahora incluye preloads raíz por casualidad y necesita neutralizar el efecto; no añadir casos nuevos aquí.
- Documentación afectada:
  - `ai-workflow/docs/app-features/config/structure.md`
  - `ai-workflow/docs/app-features/config/index.md`
  - `ai-workflow/docs/app-features/queries/preloads.md`
  - `ai-workflow/docs/app-features/queries/index.md`
  - `ai-workflow/docs/current-state.md`

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-global-preloads.test.tsx` (nuevo)

**Comportamiento cubierto**
- Config con `preloads: [{ getCatalog: {} }]` monta el provider y dispara exactamente 1 `fetch` para `getCatalog` al montarse, sin depender de `initialPage`.
- El render de la página inicial (nodos visibles en el DOM) ocurre antes de que el `fetch` del preload global complete (usando un `fetch` con `Promise` deferido). Regresión de "no bloqueante".
- Un nodo con `queryStateFeedback` sobre `queries.getCatalog` en la página inicial transita de `loading` a `success` (o `error`) reflejando el resultado del preload global sin acción del usuario.
- Navegar a otra página y volver a la inicial (mediante `hashchange`) NO emite una nueva request para `getCatalog`: el contador de `fetch` sigue en 1.
- Con `fetch` configurado para fallar siempre: tras 3 llamadas consecutivas, `queries.getCatalog.status === 'error'` con el `code` del último fallo, y no se emiten más `fetch` automáticos durante esa misma carga (contador queda en 3).
- Con `fetch` que falla en el primer intento y devuelve éxito en el segundo: `queries.getCatalog.status === 'success'`, `data` del segundo intento, y se emitieron exactamente 2 `fetch` (no hay tercer intento).
- Config sin bloque `preloads` (o con `preloads: []`): montar el provider no emite ningún `fetch` adicional atribuible al preload global (regresión: no hay activación implícita).
- Un `operationName` que aparece en `preloads` raíz y también en `pages[].preloads` de la página inicial, con la misma request efectiva: se emite exactamente 1 `fetch` en la primera carga (dedup vía `requestSignature` sembrado por T4). Regresión del criterio de aceptación #8.
- Ejecutar manualmente (`executeQueryOperation` desde botón/submit) el mismo `operationName` mientras el preload global aún reintenta: ambas ejecuciones conviven, y `queries.{operationName}` refleja la última en cerrar (latest-only), sin excepciones ni condiciones de carrera detectables por el test.
- Config con `preloads: [{ unknownOperation: {} }]` (operación fuera del catálogo): tras 3 intentos, `queries.unknownOperation.status === 'error'` con `code: 'operation-not-found'`, se emiten 0 `fetch` (fallo determinista de compose antes de tocar la red).
- Config con `preloads: [{ getCatalog: { query: { locale: 'forms.someForm.locale' } } }]` (referencia no resoluble en arranque porque no existe contexto de formulario activo): tras 3 intentos, `queries.getCatalog.status === 'error'` con `code: 'request-build-failed'`, se emiten 0 `fetch` (fallo determinista de compose no ligado a operación inexistente). El intento falla igual en cada iteración porque el contexto no cambia entre intentos; el test refleja el caso límite explícito del spec.
- StrictMode: envolver el provider en `<StrictMode>` sigue emitiendo exactamente 1 `fetch` (regresión de la guardia `useRef` que no revierte en cleanup).

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-global-preloads.test.tsx`

**Restricciones**
- Reutilizar `runRuntimeApiRequestWithRetries` y `GLOBAL_PRELOAD_MAX_ATTEMPTS` de T3; no reimplementar el bucle en el hook.
- Reutilizar `planGlobalPreloads` de T4 dentro del hook (una llamada, al montar), en lugar de reimplementar el cálculo de `requestSignature` en línea.
- El hook no puede depender de `state.pageEntry` ni de la orquestación de `pages[].preloads` en el provider: el efecto se dispara con independencia del ciclo de `pageEntry`.
- No introducir `setTimeout` ni ninguna espera artificial en el hook.
- No cambiar la firma pública de `useRuntimeStateActions` ni añadir nuevas acciones al reducer: reutilizar `queries/set-success` y `queries/set-error`.

### Criterios de finalización
- El hook está montado en `RuntimeStateProvider` y despacha exactamente los estados finales por `operationName` del bloque raíz.
- Todos los tests declarados arriba pasan en verde.
- Los tests existentes de `runtime-state-navigation.test.tsx`, `runtime-page-entry-preloads.test.tsx`, `runtime-state-operations.test.tsx` y demás ficheros de `pages[].preloads` siguen en verde sin regresión.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T5`. La feature queda funcionalmente cerrada a nivel de código; la actualización documental se hace después con `update-app-documentation` sobre `documentación afectada`.
