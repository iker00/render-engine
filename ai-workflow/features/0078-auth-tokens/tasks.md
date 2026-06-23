# Tareas de implementación — Feature 0078

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature `0078` añade un nuevo bloque raíz opcional `tokens` al JSON de configuración. Cada token expone su valor activo mediante la referencia `tokens.{tokenId}.value`, inyectable manualmente solo en cabeceras de las superficies acotadas por la spec. Un sub-bloque opcional `refresh` programa un refresco proactivo por intervalo que reutiliza una operación `api` ya declarada y extrae el nuevo valor del body por `responsePath`. Tras dos intentos fallidos consecutivos el token pasa a estado de error y las operaciones que lo referencian fallan en build con `token-refresh-failed`.

El cambio cruza cuatro capas, en este orden:

1. **Contrato y validación (`src/config/`)**: nuevo shape Zod de `tokens` en `runtime-config-zod.ts`; nuevo módulo `validate-tokens-config.ts` con validaciones de presencia/forma y cross-check contra `api`; orquestación en `validate-runtime-config.ts`; nueva regla de superficie en `validate-actions-visibility.ts` (y validadores de superficie afines) que rechaza `tokens.*` fuera de las cuatro cabeceras admitidas.
2. **Sistema de referencias (`src/runtime/runtime-references/`)**: ampliar el namespace cerrado del parser para aceptar `tokens` con shape único `tokens.{tokenId}.value`; ampliar `RuntimeReferenceResolutionResult` con un nuevo branch `token-error` que el resolver emite cuando el estado del token es `'error'`; mantener compatibilidad con todas las superficies actuales.
3. **Estado del runtime (`src/runtime/runtime-state/`)**: nuevo dominio `tokens: Record<string, RuntimeTokenState>` con shape `{ value, status, failedAttempts }`, hidratación desde `config.tokens` en `createRuntimeState`, y nuevas acciones del reducer (`tokens/set-refreshing`, `tokens/set-value`, `tokens/set-error`, `tokens/record-failed-attempt`). `runtime/reset` debe restaurar también `tokens`.
4. **Ejecución y refresco (`src/queries/` y `src/runtime/runtime-tokens/`)**: en `runtime-api-payload-resolver.ts`, traducir el branch `token-error` del resolver a un nuevo error de build `token-refresh-failed` que `buildRuntimeApiRequest` propaga; añadir `'token-refresh-failed'` al union `RuntimeApiError['code']` en `runtime-api-types.ts`. Nuevo módulo `src/runtime/runtime-tokens/` que expone el hook `useRuntimeTokenScheduler` (decisión D1 del design) y la función `executeTokenRefresh`; el hook se invoca desde `RuntimeStateProvider` exactamente una vez tras crear el estado inicial.

Decisiones técnicas vinculantes (literales del design):

- **D1** scheduler como hook: `useRuntimeTokenScheduler({ config, dispatch, getLatestState, fetchImplementation })` mantiene refs por `tokenId` con `timeoutId` activo y una generación monotónica para descartar resultados tardíos. No usa `setInterval` (encadena `setTimeout` desde el final de cada ciclo). En cleanup cancela todos los timers.
- **D2** estado de tokens dentro de `RuntimeState`: shape mínimo `{ value: string; status: 'ready' | 'refreshing' | 'error'; failedAttempts: number }`. Hidratación: arranca en `'ready'` con `value` declarado y `failedAttempts: 0`. Configs sin `tokens` producen `tokens: {}`. `runtime/reset` incluye `tokens` en el snapshot restaurado.
- **D3** path de ejecución token-scoped: el scheduler invoca `buildRuntimeApiRequest` + `executeBuiltRuntimeApiRequest` directamente, sin pasar por `executeQueryOperationWithSnapshot` ni dispatch a `queries/*`. Política de reintento: intento 1 falla → `tokens/record-failed-attempt` + reprograma intento 2 inmediato (sin esperar `intervalSeconds`); intento 2 falla → `tokens/set-error` y se reprograma el siguiente ciclo a los `intervalSeconds` siguientes; éxito posterior reabre la salida del error.
- **D4** `tokens.*` como nuevo namespace soportado del parser; shape único `tokens.{tokenId}.value`. El resolver añade rama de `token-error` al union `RuntimeReferenceResolutionResult` (nuevo discriminator `status: 'token-error'`). En `'refreshing'` se sigue sirviendo `value` (refresco proactivo no bloquea peticiones).
- **D5** validación de superficie: parser/resolver aceptan `tokens.*` globalmente; los validadores de superficie rechazan `tokens.*` en todo sitio que no sea `api.{op}.headers.*`, `pages[].preloads[].{op}.headers.*`, `button.props.action.headers.*` (incluyendo `executeOperations.operations[].headers.*`) y `form.submitAction.headers.*` (incluyendo `executeOperations.operations[].headers.*`).
- **D6** validador nuevo `src/config/validate-tokens-config.ts` paralelo a `validate-preloads`/`validate-api-config`, con cross-check de `refresh.operation` contra `config.api` realizado en `validate-runtime-config.ts` después de validar `api`.
- **D7** `token-refresh-failed` se introduce en `RuntimeApiError['code']`. `resolveHeaders` traduce el branch `'token-error'` del resolver a un error con ese código; `buildRuntimeApiRequest` propaga el shape; el provider lo dispatcha a `queries/set-error`. Mensaje sin exponer el valor del token.
- **D8** `executeTokenRefresh` vive en `runtime-tokens/` y reusa `buildRuntimeApiRequest` + `executeBuiltRuntimeApiRequest`. La navegación dot-notation de `responsePath` se evalúa con el mismo helper que ya usa el executor (`resolveBodyPath` en `runtime-api-executor.ts`); si ese helper aún no está exportado, se exporta desde su módulo y se reusa.
- **D9** ámbito del scheduler: arranca al montar `RuntimeStateProvider`, se limpia al desmontar; no reacciona a navegación. Si `config` cambia entre renders, cancela timers actuales y programa nuevos (defensa, no caso explícito de la spec).
- **D10** sin persistencia cross-session; cada reload reinicia el valor declarado en `value`.

Resolución de las preguntas abiertas del design:

- **Q1 (estado `'error'` perpetuo vs reabrir el ciclo)**: se adopta la política conservadora D3 — tras entrar en error, el scheduler vuelve a intentar al siguiente `intervalSeconds`; un éxito posterior vuelve a `'ready'` con el nuevo valor. No se introduce flag de "congelar hasta intervención".
- **Q2 (naming del código de error en el validador del bloque `tokens`)**: se reutiliza `invalid-layout` con ruta canónica del tipo `tokens.{tokenId}.refresh.intervalSeconds`, alineado con el resto de validadores actuales (`validate-api-config`, `validate-preloads`, `validate-form-nodes`). No se introduce `invalid-tokens-config`.

No se introduce un provider dedicado para tokens. No se modifica la fachada actual `executeQueryOperation` ni el camino de queries. La operación que un developer use como `refresh.operation` sigue siendo invocable también desde el layout: el scheduler no escribe en `queries.{operationName}` salvo si la propia operación se llamara desde botón/submit por separado.

---

## T1 — Tipos y schema Zod del bloque `tokens`

- **ID**: T1
- **Estado**: done
- **Objetivo**: Declarar los tipos `RuntimeTokenConfig`, `RuntimeTokenRefreshConfig` y `RuntimeTokensConfig` en `runtime-config-types.ts`; añadir el campo opcional `tokens?: RuntimeTokensConfig` a `RuntimeConfig`. Añadir en `runtime-config-zod.ts` los esquemas Zod sueltos del bloque (sin orquestación) y exponerlos para que el validador (T2) los consuma. Aún no se integra en `validate-runtime-config.ts` ni se cruza con `api`.
- **Fuera de alcance**:
  - Validador de presencia y cross-check (T2).
  - Orquestación en `validate-runtime-config.ts` (T3).
  - Cambios en el parser/resolver de referencias (T4).
  - Cambios en `RuntimeState` (T6).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/runtime-config-types.ts` (modificar): exportar
      ```ts
      export interface RuntimeTokenRefreshConfig {
        operation: string
        responsePath: string
        intervalSeconds: number
      }
      export interface RuntimeTokenConfig {
        value: string
        refresh?: RuntimeTokenRefreshConfig
      }
      export type RuntimeTokensConfig = Record<string, RuntimeTokenConfig>
      ```
      Y ampliar `RuntimeConfig` con `tokens?: RuntimeTokensConfig`.
    - `src/config/runtime-config-zod.ts` (modificar): añadir y exportar `runtimeTokenRefreshSchema` y `runtimeTokenConfigSchema`, ambos con `.strip()` para descartar claves extra. `intervalSeconds` se valida como `z.number().int().positive()`. `responsePath` y `operation` como `nonEmptyStringSchema`. `value` como `nonEmptyStringSchema`. `refresh` opcional dentro de `runtimeTokenConfigSchema`. Exportar también `runtimeTokensConfigSchema = z.record(nonEmptyStringSchema, runtimeTokenConfigSchema)`.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (nuevo): cobertura a nivel de Zod del shape, validando aceptación y rechazo de cada regla estructural.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - Ningún cambio en `runtime-config-root-zod.ts` (los esquemas se consumen desde `validate-tokens-config.ts` en T2 sin recursión al árbol de layout).
  - Los nuevos tipos no se exportan desde la fachada pública `runtime-config.ts` salvo donde ya re-exporte tipos del módulo; no añadir re-exports nuevos para mantener la frontera estable de tipos públicos.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - `runtimeTokenConfigSchema` acepta `{ value: 'abc' }` sin `refresh`.
    - `runtimeTokenConfigSchema` acepta `{ value: 'abc', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 } }`.
    - `runtimeTokenConfigSchema` rechaza `{ value: '' }` (string vacío).
    - `runtimeTokenConfigSchema` rechaza `{ value: 123 }`, `{ value: null }` y `{}` (sin `value`).
    - `runtimeTokenConfigSchema` con `refresh` rechaza `{ refresh: {} }`, `{ refresh: { operation: 'op' } }` (faltan `responsePath` y `intervalSeconds`), `{ refresh: { operation: 'op', responsePath: 'x' } }` (falta `intervalSeconds`), `{ refresh: { operation: '', responsePath: 'x', intervalSeconds: 1 } }`, `{ refresh: { operation: 'op', responsePath: '', intervalSeconds: 1 } }`.
    - `runtimeTokenConfigSchema` con `refresh.intervalSeconds: 0`, `-1`, `1.5`, `'5'` se rechaza.
    - `runtimeTokenConfigSchema` con `refresh.intervalSeconds: 1` se acepta (no hay mínimo > 1).
    - Claves extra dentro del token (`{ value: 'x', foo: 'bar' }`) o de `refresh` (`{ operation, responsePath, intervalSeconds, extra: true }`) se descartan silenciosamente (`.strip()`), no son error.
    - `runtimeTokensConfigSchema` acepta `{}` y `{ token1: {...}, token2: {...} }` con claves no vacías.
    - `runtimeTokensConfigSchema` rechaza una clave vacía como `tokenId`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-tokens.test.ts`
  - **Restricciones**:
    - No introducir helpers de validación específicos de superficie en este módulo; las reglas cruzadas viven en T2.
    - Mantener `.strip()` en todos los objetos nuevos, alineado con el resto de schemas del módulo.
- **Documentación afectada**: ninguna en esta tarea (las fichas funcionales se actualizan al cierre completo de la feature mediante `update-app-documentation`).
- **Criterios de finalización**: tipos y schemas Zod del bloque `tokens` declarados y testeados; ningún consumidor los usa todavía.
- **Cierre de implementación**: tipos exportados, schemas pasan los tests definidos; `pnpm test` global cumple umbral del 80%.

---

## T2 — Validador `validate-tokens-config.ts`

- **ID**: T2
- **Estado**: done
- **Objetivo**: Crear el módulo `src/config/validate-tokens-config.ts` con la fachada `validateTokensConfig(rawTokens: unknown, knownApiOperations: ReadonlySet<string>): { status: 'ready'; tokens: RuntimeTokensConfig } | { status: 'error'; error: RuntimeConfigError }`. El validador procesa el bloque opcional, aplica los schemas Zod de T1, traduce sus issues a `invalid-layout` con ruta canónica `tokens.{tokenId}.{...}`, y realiza el cross-check `refresh.operation ∈ knownApiOperations`. Devuelve `{}` cuando el bloque está ausente o es `undefined`.
- **Fuera de alcance**:
  - Llamar al validador desde `validate-runtime-config.ts` (es T3).
  - Cualquier regla de superficie sobre referencias `tokens.*` en otros bloques de la config (es T5).
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-tokens-config.ts` (nuevo): expone `validateTokensConfig`. Si `rawTokens === undefined` devuelve `{ status: 'ready', tokens: {} }`. Si no es un objeto plano (`null`, array, primitivos) devuelve `invalidLayout('The runtime config field "tokens" must be a plain object.')`. Si Zod falla, mapea cada issue a un mensaje con la ruta `tokens.{tokenId}.{...}` exacta (ver mensajes en "Tests"). Para `refresh.operation` se hace una pasada adicional que comprueba membresía en `knownApiOperations`; si no existe, devuelve `invalidLayout(\`The runtime config field "tokens.${tokenId}.refresh.operation" references unknown api operation "${operationName}".\`)`.
    - `src/config/runtime-config-validation-errors.ts` (no modificar; `invalidLayout` cubre todas las salidas; en caso de necesitar un helper menor lo definimos local al módulo).
  - tests:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación): añadir un `describe('validateTokensConfig')` independiente del bloque de schemas Zod ya cubierto en T1.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El validador procesa los tokens en el orden de entrada (`Object.entries(rawTokens)`) y se detiene en el primer error (consistente con el resto de validadores del módulo).
  - El cross-check de `refresh.operation` se hace contra un `ReadonlySet<string>` recibido por parámetro; el validador no conoce `RuntimeApiConfig` para no ampliar acoplamiento.
  - Las claves no string del objeto raíz se rechazan vía Zod (no debería ocurrir con JSON nativo; el mensaje genérico de Zod basta y se traduce con el helper interno).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - `validateTokensConfig(undefined, new Set())` devuelve `{ status: 'ready', tokens: {} }`.
    - `validateTokensConfig({}, new Set())` devuelve `{ status: 'ready', tokens: {} }`.
    - `validateTokensConfig(null, new Set())` devuelve `invalidLayout` con mensaje exacto `The runtime config field "tokens" must be a plain object.`.
    - `validateTokensConfig([], ...)` y `validateTokensConfig('foo', ...)` devuelven el mismo error de plain object.
    - `validateTokensConfig({ session: { value: 'abc' } }, new Set())` devuelve `{ status: 'ready', tokens: { session: { value: 'abc' } } }` (sin `refresh`).
    - `validateTokensConfig({ session: { value: '' } }, new Set())` devuelve `invalidLayout` con mensaje `The runtime config field "tokens.session.value" must be a non-empty string.`.
    - `validateTokensConfig({ session: {} }, new Set())` devuelve el mismo error de `value` ausente.
    - `validateTokensConfig({ session: { value: 'abc', refresh: { operation: 'refreshToken' } } }, new Set(['refreshToken']))` devuelve error `The runtime config field "tokens.session.refresh.responsePath" must be a non-empty string.` (o el campo siguiente que falte, en este orden: `responsePath`, `intervalSeconds`).
    - `validateTokensConfig({ session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 0 } } }, new Set(['op']))` devuelve `The runtime config field "tokens.session.refresh.intervalSeconds" must be a positive integer.`.
    - `validateTokensConfig({ session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 1.5 } } }, new Set(['op']))` devuelve el mismo error de positive integer.
    - `validateTokensConfig({ session: { value: 'a', refresh: { operation: 'missing', responsePath: 'data.token', intervalSeconds: 30 } } }, new Set(['someOtherOp']))` devuelve `The runtime config field "tokens.session.refresh.operation" references unknown api operation "missing".`.
    - `validateTokensConfig({ session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 } } }, new Set(['op']))` devuelve `{ status: 'ready', tokens: { session: { value: 'a', refresh: { operation: 'op', responsePath: 'data.token', intervalSeconds: 30 } } } }`.
    - Claves extra en el cuerpo del token y en `refresh` se descartan sin convertir el resultado en error (resultado normalizado las omite).
    - Si hay varios tokens y el segundo es inválido, el error indica la ruta del segundo (`tokens.{segundoId}.value` o equivalente), no del primero.
    - `validateTokensConfig({ '': { value: 'a' } }, ...)` devuelve un error que menciona que las claves del bloque `tokens` deben ser no vacías.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-tokens.test.ts`
  - **Restricciones**:
    - El validador no debe importar `RuntimeApiConfig` ni `RuntimeApiOperation`; recibe el set de nombres conocidos como parámetro.
    - Los mensajes de error son contractuales y los tests verifican el literal exacto.
    - No reusar la maquinaria de `validate-translations.ts`; este validador es paralelo, no idéntico (las traducciones requieren un schema recursivo distinto).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: `validateTokensConfig` cubierto por tests para los 14 criterios de aceptación de la spec relevantes a este nivel (1, 11, 12, 13, 14), más los bordes del cross-check.
- **Cierre de implementación**: módulo y tests verdes; `pnpm test` global cumple umbral del 80%.

---

## T3 — Wiring del bloque `tokens` en `validate-runtime-config.ts`

- **ID**: T3
- **Estado**: done
- **Objetivo**: Extraer `tokens` del raw config antes de aplicar el shell schema (que lo descartaría por `.strip()`), invocar `validateTokensConfig` con el set de nombres de operaciones derivado de `apiResult.api`, e incluir el resultado normalizado en `config.tokens`. Garantiza que el cross-check con `api` ocurre después de validar `api`. Las configuraciones que no declaren `tokens` siguen funcionando exactamente igual que antes.
- **Fuera de alcance**:
  - Reglas de superficie (`tokens.*` solo en ciertas cabeceras) — es T5.
  - Cambios en `runtime-config-root-zod.ts` (no se necesita; `tokens` se procesa por separado, como ya se hace con `translations`).
  - Consumo de `config.tokens` desde el reducer o el scheduler (T6 y T8).
- **Dependencias**: T1, T2.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-runtime-config.ts` (modificar): tras la extracción opcional de `translations`, hacer una extracción análoga de `tokens`. Como `runtimeConfigShellSchema` strip-elimina campos extra, la extracción debe ocurrir sobre el `rawConfig` original (igual que el patrón actual de `translations`). El validador se llama después de validar `apiResult`, pasando `new Set(Object.keys(apiResult.api))` como `knownApiOperations`. El resultado se asigna a `config.tokens` solo si el mapa devuelto es no vacío. Si está vacío, no se asigna nada (para preservar la igualdad estructural en configs sin tokens).
    - `src/config/runtime-config-zod.ts` (modificar): asegurar que `runtimeConfigShellSchema` no rechaza claves extra (ya usa `.strip()`); no hace falta cambio.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación): casos end-to-end mediante `validateRuntimeConfig` con un config completo.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - La extracción de `tokens` se hace exactamente con el mismo patrón que `translations`: comprobar `isRecord(rawConfig) && 'tokens' in rawConfig && rawConfig.tokens !== undefined`.
  - Si la validación de `tokens` falla, `validateRuntimeConfig` devuelve el error inmediatamente, antes de validar `apiResult` solo si la spec requiere — pero **el cross-check exige conocer `api` primero**, así que la llamada al validador se ubica **después** de `validateApiConfig` y **antes** de `validateActionTargets`. La validación "estructural pura" (sin cross-check) sigue activa: una entrada como `tokens: 'foo'` o `tokens: { x: {} }` falla en cualquier orden; los tests cubren ambas rutas.
  - Si una config declara `tokens.session.refresh.operation: 'foo'` y `api: { foo: {...} }` está vacío, el cross-check rechaza la config. Si `api` falla primero (porque tiene su propio error), gana el error de `api` (consistente con orden de validación).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - `validateRuntimeConfig` con una config válida que incluye `tokens: { session: { value: 'abc' } }` devuelve `status: 'ready'` y `config.tokens === { session: { value: 'abc' } }`.
    - `validateRuntimeConfig` con una config válida que incluye `tokens: { session: { value: 'abc', refresh: { operation: 'refreshToken', responsePath: 'data.token', intervalSeconds: 30 } } }` y `api: { refreshToken: { method: 'POST', endpoint: '/refresh' } }` se acepta.
    - `validateRuntimeConfig` con `tokens.session.refresh.operation: 'unknown'` se rechaza con `invalid-layout` y mensaje que incluye la ruta exacta `tokens.session.refresh.operation`.
    - `validateRuntimeConfig` con `tokens: {}` se acepta y el resultado expone `config.tokens` ausente o `undefined` (no se asigna).
    - `validateRuntimeConfig` con `tokens` omitido se acepta y `config.tokens` es `undefined` — confirma el criterio 10 de la spec (regresión: configuraciones sin bloque `tokens` siguen produciendo exactamente la misma forma de `config`).
    - `validateRuntimeConfig` con `tokens: null` se rechaza con el error de plain object.
    - Si `api` es inválido (p. ej. `api.foo.method` desconocido) y a la vez `tokens` referencia una operación inexistente, el error reportado es el de `api` (gana primero por orden).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-tokens.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (sanity check: no se rompió la validación de `api`).
  - **Restricciones**:
    - No mover la extracción de `tokens` antes de `validateApiConfig`; el cross-check lo necesita.
    - Mantener el código de error como `invalid-layout`; no introducir códigos nuevos (Q2 del design).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: `config.tokens` queda normalizado y disponible para consumidores posteriores; configs sin `tokens` siguen produciendo el mismo shape estable.
- **Cierre de implementación**: orquestación integrada y tests verdes; `pnpm test` global cumple umbral del 80%.

---

## T4 — Dominio `tokens` en `RuntimeState` y reducer

- **ID**: T4
- **Estado**: done
- **Objetivo**: Añadir el dominio `tokens: Record<string, RuntimeTokenState>` al `RuntimeState`, hidratarlo en `createRuntimeState` a partir de `config.tokens`, y declarar las cuatro acciones del reducer (`tokens/set-refreshing`, `tokens/set-value`, `tokens/set-error`, `tokens/record-failed-attempt`). Asegurar que `runtime/reset` restaura el dominio `tokens` junto al resto. Los selectores específicos no son necesarios en esta versión (el resolver lee directamente `state.tokens`). Esta tarea se ejecuta antes de la del parser/resolver para que el shape estructural ya exista cuando los consumidores tipados aparezcan.
- **Fuera de alcance**:
  - El scheduler y la ejecución del refresco (T8).
  - El mapeo `'token-error'` a `token-refresh-failed` en el payload resolver (T7).
  - El parser/resolver del namespace `tokens.*` (T5).
- **Dependencias**: T1, T3 (necesita poder leer `config.tokens` desde el reducer).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-state/runtime-state-types.ts` (modificar):
      - Declarar `RuntimeTokenStatus = 'ready' | 'refreshing' | 'error'`.
      - Declarar `RuntimeTokenState = { value: string; status: RuntimeTokenStatus; failedAttempts: number }`.
      - Añadir `tokens: Record<string, RuntimeTokenState>` al `RuntimeState`.
      - Añadir las cuatro acciones al union `RuntimeStateAction`:
        - `{ type: 'tokens/set-refreshing'; payload: { tokenId: string } }`
        - `{ type: 'tokens/set-value'; payload: { tokenId: string; value: string } }`
        - `{ type: 'tokens/set-error'; payload: { tokenId: string } }`
        - `{ type: 'tokens/record-failed-attempt'; payload: { tokenId: string } }`
    - `src/runtime/runtime-state/runtime-state-reducer.ts` (modificar):
      - En `createRuntimeState`, leer `config.tokens` y construir el mapa inicial: cada entrada arranca en `{ value: tokenConfig.value, status: 'ready', failedAttempts: 0 }`. Si `config.tokens` es `undefined`, el dominio queda `{}`.
      - Añadir cuatro cases:
        - `tokens/set-refreshing`: `{ ...current, status: 'refreshing' }` preservando `value` y `failedAttempts`.
        - `tokens/set-value`: `{ value: payload.value, status: 'ready', failedAttempts: 0 }`.
        - `tokens/set-error`: `{ ...current, status: 'error' }` preservando `value` para diagnóstico (consumidores solo deben mirar `status`).
        - `tokens/record-failed-attempt`: `{ ...current, failedAttempts: current.failedAttempts + 1 }`.
      - Asegurarse de que `runtime/reset` ya restaura el shape completo (devuelve `action.payload.state`); como ya devuelve el estado pasado por payload, basta con que `createRuntimeState` produzca el shape correcto.
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar): nada de scheduler aquí (T8); pero `createRuntimeStateFromBrowserHash` ya delega en `createRuntimeState`, así que la hidratación funciona automáticamente. Verificar que el spread `...initialState` en `createRuntimeStateFromBrowserHash` preserva `tokens` (sí: lo hace).
  - tests:
    - `src/tests/runtime-state/runtime-state-tokens.test.tsx` (nuevo): cobertura focalizada del dominio tokens dentro del store.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El reducer no necesita selectores nuevos; el resolver leerá `state.tokens?.[tokenId]` directamente (T5).
  - Acciones idempotentes: `tokens/set-refreshing` sobre un token ya en `'refreshing'` no resetea `failedAttempts`. `tokens/set-value` siempre resetea `failedAttempts` a 0 (porque indica éxito del ciclo).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime-state/runtime-state-tokens.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - `createRuntimeState` con `config.tokens === undefined` produce `state.tokens === {}`.
    - `createRuntimeState` con `config.tokens: { session: { value: 'abc' } }` produce `state.tokens.session === { value: 'abc', status: 'ready', failedAttempts: 0 }`.
    - `createRuntimeState` con dos tokens los hidrata independientemente.
    - Acción `tokens/set-refreshing` deja `status: 'refreshing'` preservando `value` y `failedAttempts`.
    - Acción `tokens/record-failed-attempt` incrementa `failedAttempts` en 1 sin tocar `status` ni `value`.
    - Dos `tokens/record-failed-attempt` consecutivos llevan `failedAttempts` a 2.
    - Acción `tokens/set-error` deja `status: 'error'` preservando `value` (cualquiera que fuese).
    - Acción `tokens/set-value` con `payload.value: 'nuevo'` reemplaza `value` y deja `status: 'ready'`, `failedAttempts: 0` (regresión: aunque venía de `'error'`).
    - Acción sobre `tokenId` inexistente es ignorada (el reducer no debería romper; lo verifica una llamada con `tokenId` que no está en el mapa inicial).
    - `runtime/reset` restaura el snapshot exactamente (incluido `tokens`).
    - Una secuencia 'refreshing' → 'record-failed' → 'record-failed' → 'set-error' deja el token en `{ value: 'inicial', status: 'error', failedAttempts: 2 }` (modelo del flujo D3 de dos fallos).
    - Una secuencia 'refreshing' → 'set-value' deja `{ value: 'nuevo', status: 'ready', failedAttempts: 0 }`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime-state/runtime-state-tokens.test.tsx`
    - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (regresión: el reducer global sigue verde).
  - **Restricciones**:
    - No introducir selectores nuevos en `runtime-state-selectors.ts` salvo que un consumidor real los necesite (no es el caso en esta feature).
    - No tocar el provider (T8 lo hará).
    - Mantener la inmutabilidad: cada case clona el sub-mapa afectado.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: dominio `tokens` existe en el `RuntimeState` con hidratación correcta y cuatro acciones verificadas.
- **Cierre de implementación**: reducer y store actualizados con cobertura por tests; `pnpm test` global cumple umbral del 80%.

---

## T5 — Parser y resolver: namespace `tokens` y branch `token-error`

- **ID**: T5
- **Estado**: done
- **Objetivo**: Extender el sistema de referencias del runtime para reconocer `tokens.{tokenId}.value` como única forma válida, propagarlo como `RuntimeSupportedReference` y permitir que el resolver lo lea desde `state.tokens` (shape ya formalizado en T4). Introducir el nuevo branch `'token-error'` en `RuntimeReferenceResolutionResult`, usado solo cuando el token referenciado existe pero su `status === 'error'`. El resolver no debe explotar si `state.tokens` está ausente (legacy/tests viejos): trata `state.tokens === undefined` como mapa vacío.
- **Fuera de alcance**:
  - Las decisiones de superficie (`tokens.*` solo en ciertas cabeceras) — es T6.
  - Mapeo de `'token-error'` a `token-refresh-failed` en el payload resolver — es T7.
- **Dependencias**: T1 (tipos del config disponibles), T4 (shape `state.tokens` formal disponible).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-references/runtime-reference-types.ts` (modificar):
      - Ampliar `RuntimeReferenceNamespace` con `'tokens'`.
      - Ampliar el `namespace` de `RuntimeSupportedReference` con `'tokens'`.
      - Añadir `RuntimeTokenErrorResolution` al union `RuntimeReferenceResolutionResult` con `{ status: 'token-error'; reference: RuntimeSupportedReference }`.
    - `src/runtime/runtime-references/runtime-reference-parser.ts` (modificar):
      - Añadir `'tokens'` a `SUPPORTED_NAMESPACES`.
      - Ampliar el `REFERENCE_PATTERN` para incluir `tokens` como namespace reconocido.
      - Añadir `tokens` a `hasRecognizedNamespace`.
      - En `hasValidReferenceShape`, añadir un case `'tokens'` que devuelve `true` solo si `path.length === 2 && path[1] === 'value'` (es decir, la única forma soportada es `tokens.{tokenId}.value`).
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` (modificar):
      - En `resolveSupportedReferenceValue`, añadir una rama para `reference.namespace === 'tokens'` que lea `state.tokens?.[tokenId]`. Si no existe, `{ found: false }`. Si existe y `status === 'error'`, devolver una marca interna que el caller traduce a `RuntimeTokenErrorResolution`. Si `status` es `'ready'` o `'refreshing'`, `{ found: true, value: tokenState.value }`.
      - Ajustar `resolveRuntimeReference` para emitir `{ status: 'token-error', reference }` cuando la marca interna llegue desde el sub-resolver; en cualquier otro consumidor visible (`resolveRuntimeVisibleValue`, `resolveRuntimeTextReference`, `resolveRuntimeImageSource`, `resolveRuntimeImageAlt`) tratar `'token-error'` como string vacío para coherencia con `'missing'`/`'invalid'`/`'unsupported'`.
  - tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación): cobertura del parser/resolver para el namespace `tokens` y el nuevo branch.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El parser sigue devolviendo `kind: 'literal'` para strings que no empiecen por un namespace reconocido; `tokens.foo.value` debe pasar a `supported`, `tokens` (sin path) y `tokens.foo` (sin `.value`) deben ser `invalid`, y `tokens.foo.bar` o `tokens.foo.value.extra` también `invalid`.
  - El resolver no necesita helper externo: la rama `tokens` es lookup directo en `state.tokens?.[tokenId]`. El acceso defensivo `state.tokens ?? {}` evita romper código de test antiguo que arme `RuntimeState` sin el dominio.
  - Cuando se introduzca `token-error` en la unión, `resolveRuntimeValueWithOptions` propaga el resultado tal cual (no lo aplana a `resolved`); los consumidores actuales del helper (provider, payload resolver) lo verán como un branch nuevo. Las superficies visibles que llaman a `resolveRuntimeVisibleValue` retornan string vacío en este branch.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - `parseRuntimeReference('tokens.session.value')` devuelve `{ kind: 'reference', status: 'supported', namespace: 'tokens', path: ['session', 'value'] }`.
    - `parseRuntimeReference('tokens')` devuelve `{ kind: 'reference', status: 'invalid', ... }`.
    - `parseRuntimeReference('tokens.session')` devuelve `invalid`.
    - `parseRuntimeReference('tokens.session.value.extra')` devuelve `invalid`.
    - `parseRuntimeReference('tokens.session.other')` devuelve `invalid`.
    - `parseRuntimeReference('\\tokens.session.value')` devuelve `{ kind: 'literal', value: 'tokens.session.value' }` (escape preservado).
    - `resolveRuntimeReference('tokens.session.value', state)` con `state.tokens.session = { value: 'abc', status: 'ready', failedAttempts: 0 }` devuelve `status: 'resolved'`, `value: 'abc'`.
    - El mismo escenario con `status: 'refreshing'` devuelve `value: 'abc'` y `status: 'resolved'` (refresco proactivo no bloquea).
    - El mismo escenario con `status: 'error'` devuelve `status: 'token-error'`.
    - `resolveRuntimeReference('tokens.unknown.value', state)` con `state.tokens` sin esa clave devuelve `status: 'missing'`.
    - `resolveRuntimeReference('tokens.session.value', stateSinTokens)` con `state.tokens === undefined` no lanza y devuelve `status: 'missing'`.
    - `resolveRuntimeVisibleValue('tokens.session.value', state, 'surface')` con `state.tokens.session.status === 'error'` devuelve string vacío (degrade visible coherente).
    - Interpolación `{{tokens.session.value}}` en un string visible se ignora silenciosamente cuando el token está en `'error'` (string vacío), y se resuelve al `value` cuando está en `'ready'`. (Estos casos cubren el comportamiento de las superficies textuales; la validación previa al render impedirá que `tokens.*` aparezca ahí, pero el resolver debe degradar sin romper.)
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
  - **Restricciones**:
    - No reescribir el parser; ampliar el set cerrado y el switch existente.
    - No introducir un namespace alias (`token`). Solo `tokens` (plural).
    - No tocar `resolvePayloadValue` aquí; el mapeo a `token-refresh-failed` vive en T7.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: parser acepta exclusivamente `tokens.{id}.value`; resolver expone `token-error` cuando aplica; los consumidores visibles degradan a string vacío sin lanzar.
- **Cierre de implementación**: parser/resolver actualizados y testeados; `pnpm test` global cumple umbral del 80%.

---

## T6 — Gating de superficie para `tokens.*`

- **ID**: T6
- **Estado**: done
- **Objetivo**: Rechazar antes del render cualquier referencia `tokens.*` que aparezca fuera de las cuatro superficies admitidas por la spec: `api.{op}.headers.*`, `pages[].preloads[].{op}.headers.*`, `button.props.action.headers.*` (incluido `executeOperations.operations[].headers.*`) y `form.submitAction.headers.*` (incluido `executeOperations.operations[].headers.*`). La validación se hace en los puntos del config donde ya existen reglas de superficie análogas; se añade un helper compartido `assertReferenceAllowsTokens` para evitar duplicación, alineado con D5.
- **Fuera de alcance**:
  - El comportamiento runtime cuando alguien evita la validación y consigue inyectar la referencia en otra superficie (el resolver ya degrada a string vacío en superficies visibles; en payloads inválidos por shape, ya estaban cubiertos por sus errores existentes).
  - Cambios en el parser o el resolver (T5).
  - Reglas sobre `queryStateFeedback.query`: ese campo es un nombre de operación de `api`, no una referencia runtime; no se interpola ni se resuelve como referencia, así que no necesita gating de `tokens.*`. Solo se rechaza `tokens.*` en `visibility.reference` y en los `when` predicates (mismo shape de `visibility`).
- **Dependencias**: T5 (el parser ya entiende `tokens.*`).
- **Impacto esperado en archivos**:
  - código:
    - `src/config/validate-actions-visibility.ts` (modificar):
      - En `validateVisibility`/`isValidVisibilityReference` (y su gemelo de `when`): si la referencia parseada tiene `namespace === 'tokens'`, devolver `invalidLayout` con mensaje exacto `Page "${pageId}" has an invalid layout at "${path}.reference": tokens.* references are not supported in visibility or queryStateFeedback.`.
      - En `validateNavigateToParams`: ya rechaza referencias que no sean `params.*`; verificar que un `tokens.session.value` literal cae en la rama "no value escalar válido" o se rechaza explícitamente con mensaje claro. Si no, añadir guard: `tokens.*` no soportado en `navigateTo.params`.
      - En `validateRuntimeApiRequestParams` (y `mapRequestQueryIssue`, `mapRequestBodyIssue`): añadir un sub-paso que, después de Zod, recorre los valores resueltos de `query` y `body` (no `headers`) y rechaza explícitamente cualquier string cuyo parseo dé `namespace === 'tokens'`. `headers` se deja pasar siempre.
    - `src/config/validate-layout-nodes.ts` (modificar, si aplica): si existe validación de orígenes de colección (`repeater.props.items.source`, `list.props.items.source`, etc.), añadir el mismo guard para rechazar `tokens.*`. Si esos validadores viven en otros módulos (por ejemplo, sub-validadores de `validate-form-nodes.ts`), aplicar allí.
    - `src/config/validate-form-nodes.ts` (modificar): si valida `defaultValue` literales escalares o referencias dinámicas, añadir guard para rechazar `tokens.*` en `defaultValue`.
    - **Helper compartido**: introducir `src/config/runtime-reference-namespace-guards.ts` (nuevo) con `assertReferenceAllowsTokens(reference: string): boolean` y `parseNamespaceOf(reference: string): RuntimeReferenceNamespace | null`. Reexportar lo mínimo necesario para mantener stable la frontera del módulo `config/`.
      - Si introducir un nuevo módulo aumenta riesgo, alternativa equivalente: añadir el helper como función local en `validate-actions-visibility.ts` y exportarlo a los demás validadores. Decisión final del implementador, pero debe haber **una sola** definición del helper.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación): bloque `describe('tokens.* surface gating')` con un caso por superficie rechazada y un caso de cada superficie admitida.
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación): rechazo de `tokens.*` en `visibility.reference`.
    - `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación): rechazo de `tokens.*` en `api.{op}.query` y `api.{op}.body`; aceptación en `api.{op}.headers`.
    - `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación) o el equivalente que cubra `repeater.props.items.source` y demás `*.props.items.source`: rechazo de `tokens.*`.
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación): aceptación de `tokens.*` en `preloads[].headers`; rechazo en `preloads[].query`, `preloads[].body`, `preloads[].when`.
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación): aceptación de `tokens.*` en `button.props.action.headers`; rechazo en `button.props.action.query`, `.body`, `.params`, `.pageId`. Igualmente para `executeOperations.operations[].headers` (aceptado) vs `.query`/`.body` (rechazado).
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación) o el archivo donde se prueba `submitAction`: aceptación en `form.submitAction.headers` y rechazo en `form.submitAction.query`/`.body`.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El helper `assertReferenceAllowsTokens(value)` retorna `true` solo si el parseo del string da `namespace !== 'tokens'`. Para las superficies que ya hacen su propio parseo, basta integrar el check; para las que solo verifican shape escalar (e.g. `query`/`body`/`params`), iterar pares y aplicar el check sobre cada string.
  - En `validateNavigateToParams`, los `tokens.*` se rechazan porque la spec no los admite en `params.*`; el mensaje debe ser específico: `Page "${pageId}" has an invalid layout at "${path}.${key}": navigateTo params do not accept tokens.* references.`.
  - En `validateRuntimeApiRequestParams`, `query` y `body` se chequean (recorriendo recursivamente los strings de `body`); `headers` se omite del check.
  - El gating sobre `api.{op}.headers` no hace falta: las cabeceras de operaciones son una superficie admitida. Pero `api.{op}.query`, `api.{op}.body` y `api.{op}.endpoint` (placeholders) deben rechazarlo.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-tokens.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-api-operations.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación).
    - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - **Superficies admitidas (regresión: acepta `tokens.*`)**:
      - `api.{op}.headers: { Authorization: 'tokens.session.value' }` se acepta cuando la config declara `tokens.session.value`.
      - `pages[].preloads[].{op}.headers: { 'X-Token': 'tokens.session.value' }` se acepta.
      - `button.props.action: { type: 'executeOperation', operationName: 'op', headers: { 'X-Token': 'tokens.session.value' } }` se acepta.
      - `button.props.action: { type: 'executeOperations', operations: [{ operationName: 'op', headers: { 'X-Token': 'tokens.session.value' } }] }` se acepta.
      - `form.submitAction.headers: { 'X-Token': 'tokens.session.value' }` se acepta.
      - `form.submitAction: { type: 'executeOperations', operations: [{ ..., headers: { 'X-Token': 'tokens.session.value' } }] }` se acepta.
    - **Superficies rechazadas (cada una con su mensaje específico y ruta exacta)**:
      - `api.{op}.query: { token: 'tokens.session.value' }` se rechaza.
      - `api.{op}.body: { token: 'tokens.session.value' }` (objeto raíz con string) se rechaza; también una hoja anidada `body.nested.token` se rechaza con la ruta canónica.
      - `api.{op}.endpoint: '/x/{{tokens.session.value}}'` (placeholder) se rechaza.
      - `pages[].preloads[].{op}.query`/`.body`/`.when` con `tokens.*` se rechaza.
      - `button.props.action.query`/`.body`/`.params`/`.pageId` con `tokens.*` se rechaza (incluyendo `executeOperations.operations[].query`/`.body`).
      - `form.submitAction.query`/`.body` con `tokens.*` se rechaza.
      - `visibility.reference: 'tokens.session.value'` se rechaza con mensaje exacto `Page "${pageId}" has an invalid layout at "${path}.reference": tokens.* references are not supported in visibility or when conditions.`.
      - `pages[].preloads[].when.reference: 'tokens.session.value'` se rechaza con el mismo tipo de mensaje sobre la ruta del `when`.
      - `queryStateFeedback.query: '...'` (regresión): este campo es un nombre de operación de `api`, no una referencia runtime, así que el gating NO aplica aquí; un valor literal como `'session'` se sigue tratando como nombre de operación. Test de regresión asegura que el validador no rechaza por error un `queryStateFeedback.query` cuyo literal coincide con un nombre que recordara a un namespace.
      - `repeater.props.items.source: 'tokens.session.value'` se rechaza.
      - `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source` con `tokens.*` se rechazan.
      - `defaultValue: 'tokens.session.value'` literal en `input`/`textarea`/`select`/`radioGroup`/`checkboxGroup` se rechaza.
      - Superficies visibles interpolables que aceptan `{{queries...}}` (p. ej. `heading.props.text: 'X {{tokens.session.value}}'`) NO se rechazan en la validación (la spec no exige error de bootstrap aquí; el resolver degrada a string vacío); este caso queda cubierto por T4 (visible degrade).
    - Si una superficie rechazada está dentro de un repeater (`repeater.props.template[...]`), la ruta diagnóstica incluye `repeater.props.template[N]....`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-tokens.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-api-operations.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-preloads.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`
  - **Restricciones**:
    - El helper de gating debe vivir en un único módulo (`runtime-reference-namespace-guards.ts` o local en `validate-actions-visibility.ts`); no duplicar la lógica de namespace en cada validador.
    - Los mensajes de error son contractuales; los tests verifican literales exactos para los pares (ruta, mensaje).
    - No tocar el resolver/parsing en esta tarea.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: cada una de las superficies admitidas acepta `tokens.*`; cada una de las superficies rechazadas falla en bootstrap con ruta canónica.
- **Cierre de implementación**: gating completo y tests verdes; `pnpm test` global cumple umbral del 80%.

---

## T7 — Mapeo `token-error` → `token-refresh-failed` en build de request

- **ID**: T7
- **Estado**: done
- **Objetivo**: Introducir `'token-refresh-failed'` en `RuntimeApiError['code']` (`src/queries/runtime-api-types.ts`). En `resolvePayloadValue` (`src/queries/runtime-api-payload-resolver.ts`), traducir el branch `'token-error'` del resolver a un nuevo estado de retorno (`{ status: 'token-error', tokenId }`). En `resolveHeaders`, mapear ese estado a un `{ status: 'error', error: { code: 'token-refresh-failed', message: ... } }` que distinga del `request-build-failed` genérico. `buildRuntimeApiRequest` (y por extensión `buildInlineRuntimeApiRequest`) propaga ese error con el mismo shape que el resto. Cuando llega al provider, se dispatcha a `queries/set-error` con `code: 'token-refresh-failed'`. No se emite red.
- **Mensaje contractual único**: `${messagePrefix} cannot build the request because token "${tokenId}" is in error state.`. Es el literal que tanto `resolveHeaders` como `resolveBody` deben producir; los tests assertean esa forma exacta parametrizada por el `messagePrefix` ya en uso en el resto del payload resolver. No incluir `value` ni partes del header en el mensaje.
- **Fuera de alcance**:
  - Disparar el error (T8 ejecuta el scheduler que pone el token en `'error'`).
  - Cambios en la UI o en `queryStateFeedback` (la nueva semántica encaja en `status: error` con `code` distinto, ya soportada por el resto del sistema).
- **Dependencias**: T4 (existe `state.tokens`), T5 (existe el branch `'token-error'` del resolver).
- **Impacto esperado en archivos**:
  - código:
    - `src/queries/runtime-api-types.ts` (modificar): añadir `'token-refresh-failed'` al union de `RuntimeApiError['code']`.
    - `src/queries/runtime-api-payload-resolver.ts` (modificar):
      - `resolvePayloadValue` añade un retorno `{ status: 'token-error', tokenId: string }` cuando el resolver devuelve `status: 'token-error'`. `tokenId` se extrae de `reference.path[0]`.
      - `resolveJsonPayloadValue` (body) propaga el `token-error`: cuando una hoja string resuelve a `token-error`, el body completo no se construye y devuelve `{ status: 'token-error', tokenId }`. En arrays, también propaga (no se silencia).
      - `resolveHeaders` traduce `token-error` a un `ResolveFieldErrorResult` con `code: 'token-refresh-failed'` y el mensaje contractual único de la sección "Objetivo" (forma parametrizada por `messagePrefix`).
      - `resolveBody` traduce `token-error` al mismo error con el mismo mensaje contractual único (consistente: si un token aparece en `body`, la build falla con `token-refresh-failed` en lugar de `request-build-failed`). Aunque la validación de superficie (T6) rechaza `tokens.*` en `body`, el resolver lo trata por defensa; un test cubre el path por completitud.
    - `src/queries/runtime-api-request.ts` (modificar si fuese necesario): asegurarse de que el `code` `'token-refresh-failed'` propaga sin transformación desde `resolveHeaders`/`resolveBody`. La mayoría del flujo ya solo propaga lo que reciben.
  - tests:
    - `src/tests/runtime/runtime-api-token-refresh-failed.test.ts` (nuevo): cobertura del nuevo error code de build cuando un header referencia un token en `'error'`.
    - `src/tests/runtime/runtime-api-payload-omission.test.ts` (ampliación) o `runtime-api-execution.test.ts` (ampliación): regresión asegurando que un header normal con `tokens.{id}.value` en estado `'ready'` o `'refreshing'` resuelve al `value` actual sin errores.
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El mensaje de error de header debe ser informativo pero **no incluir el valor del token** (criterio no funcional de la spec). El mensaje contractual único (ver "Objetivo") usa `messagePrefix` (p. ej., `The action "saveUser"`) seguido literalmente de `cannot build the request because token "${tokenId}" is in error state.`. El mensaje no expone `value` ni el contenido bruto del header.
  - `resolvePayloadValue` devuelve un union ampliado: `{ status: 'ready'; value } | { status: 'omit' } | { status: 'error' } | { status: 'token-error'; tokenId }`. Todos los consumidores se ajustan.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-api-token-refresh-failed.test.ts` (nuevo).
    - `src/tests/runtime/runtime-api-payload-omission.test.ts` (ampliación).
  - **Comportamiento cubierto**:
    - `buildRuntimeApiRequest` con `api.{op}.headers: { Authorization: 'tokens.session.value' }` y `state.tokens.session = { value: 'abc', status: 'ready' }` produce un request con `Authorization: 'abc'`.
    - Lo mismo con `status: 'refreshing'` produce `Authorization: 'abc'` (valor anterior sigue activo).
    - Lo mismo con `status: 'error'` produce `{ status: 'error', error: { code: 'token-refresh-failed', message: <string que menciona el tokenId "session"> } }`.
    - El mensaje **no contiene** el valor activo del token (e.g., assert que `'abc'` no aparece en el mensaje).
    - `buildRuntimeApiRequest` con `headers: { 'X-Token': 'tokens.unknown.value' }` y `state.tokens` sin esa clave devuelve `code: 'request-build-failed'` (NO `token-refresh-failed`); cubre el criterio 8 de la spec.
    - `buildInlineRuntimeApiRequest` con la misma config produce el mismo resultado (paridad con la fachada inline).
    - Headers que mezclan `tokens.*` (en error) y `forms.*` o `params.*`: el primer error reportado es el de `token-refresh-failed` para el header que lo causa.
    - Sanity: cuando el header NO referencia ningún token (referencias normales como `params.x`, `queries.x.data.y`), el comportamiento no cambia (regresión).
    - Cobertura de `resolveBody`: si por algún path patológico (validación skip) un `body` lleva `tokens.{id}.value`, `buildRuntimeApiRequest` falla con `token-refresh-failed`, no con `request-build-failed`. Este test cubre el camino del resolver aunque la validación de superficie (T6) lo rechazara antes.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-api-token-refresh-failed.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-api-payload-omission.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts` (regresión).
    - `pnpm test --run src/tests/runtime/runtime-api-multipart.test.ts` (regresión: el camino multipart sigue intacto).
  - **Restricciones**:
    - No exponer el valor del token en el mensaje de error (criterio NFR).
    - No introducir un código de error nuevo distinto de `token-refresh-failed`; reusar el contrato.
    - No cambiar el comportamiento de `request-build-failed` para referencias no-token; debe seguir disparándose para `tokens.unknown` u otros tokens inexistentes.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**: el nuevo código de error está en el tipo, en el resolver y en el builder; todos los caminos (build con lookup, inline, body) lo emiten correctamente y los tests cubren los cuatro estados del token contra cada superficie.
- **Cierre de implementación**: `token-refresh-failed` operativo end-to-end en build; `pnpm test` global cumple umbral del 80%.

---

## T8 — Scheduler `runtime-tokens/` y wiring en `RuntimeStateProvider`

- **ID**: T8
- **Estado**: done
- **Objetivo**: Implementar el módulo `src/runtime/runtime-tokens/` con `executeTokenRefresh` y `useRuntimeTokenScheduler`, e integrarlo en `RuntimeStateProvider` exactamente una vez tras crear el estado inicial. Cubrir el flujo completo de la spec: primer refresco al cabo de `intervalSeconds`, política de reintento (1 fallo → intento 2 inmediato; 2 fallos → `tokens/set-error` y reprograma al siguiente `intervalSeconds`), extracción del nuevo valor por `responsePath`, y cancelación limpia de timers en cleanup. Los tokens sin `refresh` no se programan.
- **Fuera de alcance**:
  - Cambios en validación o tipos (T1–T6).
  - Cambios en el reducer (T4); el scheduler solo dispatcha las acciones ya definidas.
- **Dependencias**: T2, T3, T4, T7.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-tokens/runtime-token-types.ts` (nuevo): tipos auxiliares (`TokenRefreshOutcome = { kind: 'success'; value: string } | { kind: 'failure' }`).
    - `src/runtime/runtime-tokens/execute-token-refresh.ts` (nuevo): `executeTokenRefresh({ config, tokenId, refreshConfig, snapshotState, fetchImplementation })` con `fetchImplementation: typeof fetch` requerido (los callers internos siempre lo pasan; mantener obligatorio facilita el mock en tests del módulo). La función:
      1. Reutiliza `buildRuntimeApiRequest({ config, operationName: refreshConfig.operation, state: snapshotState })`. Si devuelve `error`, retorna `{ kind: 'failure' }`.
      2. Reutiliza `executeBuiltRuntimeApiRequest({ request, fetch: fetchImplementation })`. Si retorna `error` (`network-error`, `http-error`, `invalid-json-response`, `business-error-condition`), retorna `{ kind: 'failure' }`.
      3. Si retorna `success`, navega `result.data` con el helper dot-notation `resolveBodyPath` (exportar desde `src/queries/runtime-api-executor.ts` si aún es interno, para reuso). Si el valor en `refreshConfig.responsePath` es string no vacío, retorna `{ kind: 'success', value }`. Cualquier otro caso (no string, string vacío, ruta no resuelve), retorna `{ kind: 'failure' }`.
    - `src/runtime/runtime-tokens/use-runtime-token-scheduler.ts` (nuevo): hook `useRuntimeTokenScheduler({ config, dispatch, getLatestState, fetchImplementation? })`. **Contrato del parámetro `fetchImplementation`**: opcional; cuando no se pasa, el hook usa `globalThis.fetch` (resuelto en el momento de cada disparo, no en el momento de montaje, para permitir `vi.stubGlobal('fetch', ...)` y otros mocks de test). El provider invoca el hook sin `fetchImplementation`. El hook:
      1. Mantiene un `Map<tokenId, { timeoutId: number; generation: number }>` en una ref.
      2. En `useEffect`, para cada token con `refresh`, programa el primer `setTimeout` a `intervalSeconds * 1000` ms.
      3. Cada ciclo: dispatch `tokens/set-refreshing`; llama `executeTokenRefresh`; según resultado:
         - éxito → dispatch `tokens/set-value` con el nuevo valor → programa siguiente ciclo a `intervalSeconds * 1000` ms.
         - fallo (intento 1) → dispatch `tokens/record-failed-attempt` → reprograma inmediato (0 ms) para intento 2.
         - fallo (intento 2: `failedAttempts === 1` antes de incrementar) → dispatch `tokens/set-error` → reprograma siguiente ciclo a `intervalSeconds * 1000` ms (continúa intentando proactivamente).
         - éxito tras `'error'` → dispatch `tokens/set-value` resetea el estado y vuelve a `'ready'` (el reducer ya lo hace).
      4. Cuando completa un ciclo y la generación del token cambió (cleanup intermedio), descarta el resultado sin dispatch.
      5. Cleanup: cancela todos los `timeoutId` y borra el mapa.
    - `src/runtime/runtime-tokens/index.ts` (nuevo): re-exports limpios de `useRuntimeTokenScheduler`.
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar): importar e invocar `useRuntimeTokenScheduler({ config, dispatch: dispatchAndSyncState, getLatestState })` una sola vez dentro del componente, después de definir `dispatchAndSyncState`. No pasar `fetchImplementation` desde el provider (queda opcional según el contrato del hook; los tests inyectan `fetch` con `vi.stubGlobal('fetch', mockFetch)` o pasan `fetchImplementation` a `executeTokenRefresh` directamente desde tests unitarios).
    - `src/queries/runtime-api-executor.ts` (modificar): exportar `resolveBodyPath` (actualmente interno) para reuso desde `runtime-tokens/`. Mantener el nombre estable.
  - tests:
    - `src/tests/runtime/runtime-tokens-scheduler.test.tsx` (nuevo): cobertura del hook con `vi.useFakeTimers()`.
    - `src/tests/runtime/runtime-tokens-execute-refresh.test.ts` (nuevo): cobertura unit de `executeTokenRefresh` (extracción por `responsePath`, criterios de fallo).
  - documentación: ninguna en esta tarea.
- **Cambios concretos**:
  - El scheduler corre **fuera** de `useLayoutEffect`; usa `useEffect` para no bloquear el render.
  - `useRuntimeTokenScheduler` recibe `dispatchAndSyncState` (no el `dispatch` puro) para mantener `latestStateRef` sincronizado cuando el scheduler ejecuta refrescos consecutivos rápido.
  - La generación monotónica por token garantiza idempotencia: si el efecto se reinicia (porque cambia `config.tokens`), se incrementa la generación y los resultados pendientes se descartan.
  - `getLatestState()` se invoca en el momento de disparar el refresco para tomar el snapshot actual del estado (consistencia con el resto del runtime).
  - El scheduler no interactúa con `queries.*`; el camino de refresco no escribe en ese dominio.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-tokens-execute-refresh.test.ts` (nuevo).
    - `src/tests/runtime/runtime-tokens-scheduler.test.tsx` (nuevo).
  - **Comportamiento cubierto** (`execute-token-refresh`):
    - `executeTokenRefresh` con una operación que devuelve `{ data: { token: 'newValue' } }` y `responsePath: 'data.token'`: retorna `{ kind: 'success', value: 'newValue' }`. **Atención**: `responsePath` opera sobre el `data` ya parseado por el executor; los tests verifican que la convención de path coincide con cómo navega `resolveBodyPath` (incluyendo `data.X` vs `X` según diseño). El test fija la convención: `responsePath` se evalúa sobre el `data` devuelto por el executor (mismo helper, raíz `data`).
    - Respuesta con `responsePath` que resuelve a número, boolean, null o objeto: `{ kind: 'failure' }`.
    - Respuesta con `responsePath` que resuelve a string vacío: `{ kind: 'failure' }`.
    - Respuesta con `responsePath` cuya ruta no resuelve (segmento ausente): `{ kind: 'failure' }`.
    - Mock de `fetch` que lanza network error: `{ kind: 'failure' }`.
    - Mock de `fetch` con status 500: `{ kind: 'failure' }`.
    - Mock con JSON inválido: `{ kind: 'failure' }`.
    - Operación con `errorCondition` cumplido (HTTP 200 con error de negocio): `{ kind: 'failure' }`.
    - `buildRuntimeApiRequest` falla (referencia missing en headers): `{ kind: 'failure' }`.
  - **Comportamiento cubierto** (`scheduler`):
    - Un token sin `refresh` declarado no se programa (no se invoca `fetch` aunque pase tiempo).
    - Un token con `refresh: { intervalSeconds: 10, ... }` programa el primer refresco a los 10s. Antes de los 10s, `state.tokens.{id}.status === 'ready'` sin actividad. A los 10s, `fetch` se invoca exactamente una vez; tras éxito, el estado pasa a `'ready'` con el nuevo `value` y `failedAttempts: 0`. El siguiente refresco está programado para 10s más tarde.
    - Refresco exitoso en cadena: dos ciclos consecutivos actualizan `value` con dos respuestas distintas.
    - Refresco fallido en intento 1 → dispatch `tokens/record-failed-attempt` (verificable como `state.tokens.{id}.failedAttempts === 1`, `status === 'refreshing'`); inmediatamente (`setTimeout` con delay 0) se ejecuta el intento 2.
    - Intento 2 exitoso → `state.tokens.{id} === { value: 'new', status: 'ready', failedAttempts: 0 }` (criterio 3 de la spec).
    - Intento 2 fallido → `state.tokens.{id} === { value: 'inicial', status: 'error', failedAttempts: 2 }` (criterio 4 de la spec).
    - Tras entrar en `'error'`, el siguiente `intervalSeconds` reabre el ciclo (intento 1 nuevo); si tiene éxito, vuelve a `'ready'` (Q1 resuelta).
    - Múltiples tokens independientes: tokenA refresca cada 5s y tokenB cada 30s; los timers de cada uno avanzan por separado, y el fallo de tokenA no afecta a tokenB (criterio 15 de la spec).
    - Cleanup del hook: si se desmonta el `RuntimeStateProvider` antes del primer disparo, no se invoca `fetch` y el timer se cancela (criterio "casos límite" de la spec).
    - Cleanup tras dispatch en vuelo: si el hook se desmonta entre `fetch` y el dispatch del resultado, la acción nunca llega al reducer (la generación monotónica descarta el resultado).
    - Operación de refresco que referencia `tokens.{otroId}.value` en sus headers: la build del request usa el `value` actual del otro token; si el otro token está en `'error'`, el refresco del primero falla y aplica la política de reintento. (Cubre el caso "casos límite" de la spec sobre tokens cruzados.)
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-tokens-execute-refresh.test.ts`
    - `pnpm test --run src/tests/runtime/runtime-tokens-scheduler.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-api-execution.test.ts` (regresión).
    - `pnpm test --run src/tests/runtime-state/runtime-state-tokens.test.tsx` (regresión).
  - **Restricciones**:
    - Usar `vi.useFakeTimers()` en los tests del scheduler. Los `await` de promesas en cada tick se resuelven con `await vi.runAllTimersAsync()` o equivalente.
    - El scheduler NO debe escribir en `queries.*` ni dispatchar acciones de `queries/*`.
    - Mantener `setTimeout` encadenado (no `setInterval`) por D1.
    - El mensaje de error de refresco no se expone al usuario en superficies visibles (el scheduler no informa fuera del estado del token).
- **Documentación afectada**: ninguna en esta tarea (las fichas funcionales se actualizan en `update-app-documentation` al cierre completo de la feature).
- **Criterios de finalización**: scheduler operativo, integrado en el provider, cubierto por tests con fake timers; el ciclo completo (intervalo → intento → éxito/fallo → retry → estado de error → reapertura) está validado para tokens únicos y múltiples.
- **Cierre de implementación**: feature completa end-to-end; `pnpm test` global cumple umbral del 80%. Tras este cierre, las fichas funcionales declaradas en el design (`config/structure.md`, `config/api-catalog.md`, `config/validation.md`, `references/reference-resolution.md`, `queries/execution.md`, `current-state.md`, opcional `app-features/auth/tokens.md`) quedan listadas como impacto para la pasada manual de `update-app-documentation`.

---

## Documentación afectada al cierre completo de la feature

Estas fichas se actualizan mediante `update-app-documentation` después de cerrar T8. No se crean tareas documentales en este `tasks.md`:

- `ai-workflow/docs/app-features/config/structure.md`: nuevo bloque raíz `tokens` (shape, opcionalidad, semántica de hidratación).
- `ai-workflow/docs/app-features/config/api-catalog.md`: nota de que `api.headers` admite `tokens.*` además de los namespaces ya soportados.
- `ai-workflow/docs/app-features/config/validation.md`: nueva sección "Reglas del bloque `tokens`" y reglas de rechazo por superficie.
- `ai-workflow/docs/app-features/references/reference-resolution.md`: nueva familia `tokens.*`, shape único `tokens.{id}.value`, superficies admitidas y semántica de degradación en `'error'`.
- `ai-workflow/docs/app-features/queries/execution.md`: nuevo código tipado `token-refresh-failed`.
- `ai-workflow/docs/app-features/runtime/overview.md` y/o `ai-workflow/docs/current-state.md`: nueva área "Auth tokens" o actualización del área de autenticación con el alcance v1 cubierto.
- Opcional: nueva ficha `ai-workflow/docs/app-features/auth/tokens.md` si el equipo prefiere consolidar la feature como dominio propio.

## Siguiente tarea a escoger

**T1**.
