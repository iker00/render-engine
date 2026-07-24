# Design: Feature 0110 - global preloads first load

## Contexto

Estado técnico actual relevante:

- `RuntimeConfig` (en `src/config/runtime-config-types.ts`) declara `api`, `pages`, `initialPage`, y opcionales `translations` y `tokens`. No existe todavía un bloque raíz `preloads`.
- `RuntimePreloadConfig` ya existe y modela `{ operationName, requestParams, when? }`. Se usa exclusivamente dentro de `pages[].preloads`.
- La validación de `pages[].preloads` vive en `src/config/validate-preloads.ts` (función `validatePagePreloads`). Emite errores de ruta `pages[N].preloads[i]...` a través de `invalidLayout`. Rechaza `operationName` duplicado dentro de la misma página. Admite `when` (con `allowItem: false`).
- La ejecución de operaciones remotas vive en `src/queries/runtime-api-executor.ts` (`buildRuntimeApiRequest`, `executeBuiltRuntimeApiRequest`, etc.). Es pura respecto al estado del runtime: recibe el snapshot y devuelve un resultado tipado.
- La orquestación de precargas por página vive en `src/runtime/runtime-state/runtime-state-provider.tsx`, acoplada al ciclo de `pageEntry` (planificación por `entryId`, tanda agregada, latest-only, limpieza fresca por firma). Reevalúa por firma efectiva contra `queries.{operationName}`.
- El estado compartido se inicializa en `createRuntimeStateFromBrowserHash` (`runtime-state-provider.tsx`) y en `createRuntimeState` (`runtime-state-reducer.ts`). El reducer soporta acciones `queries/set-loading`, `queries/set-success`, `queries/set-error`.
- No existe hoy una política de reintentos automática. `executeQueryOperation`, `pages[].preloads` y `executeOperation`/`executeOperations` hacen un único intento por disparo.
- El feedback visual (`queryStateFeedback`) deriva `idle | loading | error | empty | success` a partir de `state.queries[operationName]` mediante `runtime-query-state-feedback`. Un consumidor puede reaccionar reactivamente a transiciones de estado sin coordinación adicional.

Marco arquitectónico:

- `src/config/` valida antes del render. Es el borde de contrato JSON.
- `src/queries/` posee composición y ejecución de requests. Los nodos y el resto del runtime no construyen `fetch` ni `RequestInit`.
- `src/runtime/` interpreta y orquesta estado; el provider concentra hoy las orquestaciones de pageEntry, tokens y navegación.
- `src/app/` sólo hace bootstrap de carga de config, no gestiona red ni estado.

## Objetivos / No objetivos

### Objetivos

- Añadir un bloque raíz opcional `preloads: RuntimePreloadConfig[]` en `RuntimeConfig`, hermano de `api`/`pages`/`initialPage`/`translations`/`tokens`.
- Validar el bloque raíz con reglas más restrictivas que `pages[].preloads`: sin `when`, sin `item.*`, sin `operationName` duplicado.
- Disparar en paralelo todas las operaciones del bloque raíz una única vez por instancia de runtime montada, sin bloquear el render inicial ni depender de `initialPage`/`pageEntry`.
- Aplicar una política de reintentos acotados (3 intentos totales, sin espera) exclusiva del `preloads` global; el resto de superficies mantienen su comportamiento actual de un único intento.
- Cuando el mismo `operationName` aparezca simultáneamente en el `preloads` global y en `pages[].preloads` de la página inicial con la misma request efectiva, garantizar en la primera carga que no se emitan dos requests independientes.
- Mantener la composición y ejecución (incluidos los reintentos) dentro de `src/queries/`. El runtime sólo coordina disparo y dispatch de estado.

### No objetivos

- Modo bloqueante, pantallas de carga globales, o cualquier UI a nivel de aplicación para reflejar el estado del `preloads` global. Los consumidores usan el feedback ya existente por query.
- Cambios en el comportamiento de `pages[].preloads` (shape, `when`, tanda agregada, latest-only, limpieza fresca por firma).
- Persistencia entre recargas del navegador (localStorage/sessionStorage). El estado es en memoria por instancia de runtime.
- Ampliar la política de reintentos al resto de superficies (`executeOperation`, `executeOperations`, `pages[].preloads`).
- Diferenciar códigos de error "reintentables" y "no reintentables". La política aplica uniforme a cualquier `code`.
- Un nuevo tipo de acción o mecanismo para relanzar el `preloads` global desde la UI.

## Decisiones

### 1. Nuevo bloque raíz `preloads` en el contrato

- Añadir `preloads?: RuntimePreloadConfig[]` a `RuntimeConfig`. Reutiliza el tipo `RuntimePreloadConfig` ya existente. El campo `when` del tipo queda técnicamente presente pero se rechaza en validación cuando se usa en el bloque raíz; el runtime no lo evalúa nunca en ese contexto.
- Actualizar `runtimeConfigShellSchema` para aceptar `preloads: z.array(z.unknown()).optional()` en el shell raíz, dejando la interpretación detallada a un validador dedicado (mismo patrón que `pages[].preloads`).
- Un config sin bloque raíz o con `preloads: []` es idéntico al comportamiento previo.

**Por qué**: reutiliza el shape ya validado y consumido por el runtime, evita duplicar tipos en el contrato público y aísla la restricción "sin `when`" en la capa de validación.

**Alternativa descartada**: crear un tipo `RuntimeGlobalPreloadConfig` sin `when`. Descartada porque duplicaría el tipo y añadiría fricción a cualquier consumidor que ya lee `RuntimePreloadConfig` (planning, ejecución). El coste es mínimo: la restricción se expresa en el validador y en la documentación del contrato.

### 2. Validación en `src/config/`

- Extraer el núcleo reutilizable de `validatePagePreloads` en `validate-preloads.ts`: un helper `validatePreloadEntries` que valida el shape base de la lista (objeto de una clave por entrada, `operationName` no vacío, `requestParams` válidos, sin `operationName` duplicado, rechazo de `item.*`) y admite dos configuraciones:
  - Modo "page": permite `when` con `allowItem: false`, produce mensajes de ruta `pages[N].preloads[i]...`.
  - Modo "root": rechaza `when` con ruta exacta `preloads[i].when`, produce mensajes de ruta `preloads[i]...`.
- Añadir `validateGlobalPreloads(rawPreloads)` que llama al helper compartido en modo "root".
- `validateRuntimeConfig` invoca `validateGlobalPreloads` tras validar `api` y `tokens`, antes de procesar las páginas. Cross-check: las operaciones referenciadas en `preloads` global deben existir en `api` (mismo control que hoy hace `validatePagePreloads` vía `validateRuntimeApiRequestParams`).
- Regla de ruta para errores de validación del bloque raíz: `preloads[i].{operationName}[.body|.headers|.query][...]`, `preloads[i].when`, `preloads[i]` (shape inválido), `preloads` (no es array).

**Por qué**: mantiene un único núcleo de validación entre las dos superficies (shape base compartido), y expresa como diferencias explícitas del helper las reglas que sí divergen (rechazo de `when`, prefijo de ruta). Evita divergencias silenciosas cuando cambien reglas comunes en el futuro.

**Alternativa descartada**: duplicar completamente `validatePagePreloads` en un `validateGlobalPreloads` independiente. Descartada por riesgo real de drift entre las dos superficies.

### 3. Estructura runtime: nuevo módulo `runtime-global-preloads/`

- Nueva carpeta `src/runtime/runtime-global-preloads/` hermana a `runtime-tokens/`, `runtime-navigation/`, etc. Contiene:
  - `use-runtime-global-preloads.ts`: hook consumido desde `RuntimeStateProvider`. Lanza en paralelo las operaciones del bloque raíz una vez por montaje, coordinando dispatches de estado.
  - `plan-global-preloads.ts`: helper puro que, dado el `config` y un `RuntimeState`, devuelve el plan (operationNames + requestSignature efectiva calculada con `buildRuntimeApiRequest`, o error de compose determinista).
- El hook se invoca desde `RuntimeStateProvider` justo después de crear el estado y antes/junto a `useRuntimeTokenScheduler`. Usa un `useRef<boolean>` como guardia de "ya lanzado" para asegurar exactamente una ejecución por instancia, resistente a re-renders y a modo StrictMode en desarrollo.
- El módulo no conoce `pageEntry`. Solo lee `config.preloads`, dispara requests y actualiza `queries.*`. Es independiente de navegación.

**Por qué**: separar responsabilidades. `runtime-state-provider.tsx` ya concentra suficiente orquestación (navegación, tokens, pageEntry). Un módulo dedicado facilita testing en unidad y evita mezclar el ciclo de `pageEntry` con un disparo que es explícitamente ajeno a él.

**Alternativa descartada**: añadir directamente un `useLayoutEffect` en `runtime-state-provider.tsx`. Menor superficie de cambio pero acumula orquestaciones, complica leer el provider y hace más difícil aislar en tests que la política de reintentos no contamina otras superficies.

### 4. Pre-inicialización de queries en `createRuntimeStateFromBrowserHash`

- Extender `createRuntimeStateFromBrowserHash` para que, tras invocar `createRuntimeState(config, ...)`, ejecute `planGlobalPreloads({ config, state })` y mezcle en `state.queries` una entrada por cada operación del `preloads` raíz:
  - Si el plan produjo `requestSignature` para esa operación: `{ status: 'loading', data: null, error: null, requestSignature: <sig> }`.
  - Si el plan produjo error determinista de compose (`operation-not-found`, `request-build-failed`): `{ status: 'loading', data: null, error: null, requestSignature: null }` (marcador de que la primera tentativa ya está prevista; el hook posterior escribirá el error real tras el primer intento).
- El hook `use-runtime-global-preloads` recibe el plan calculado (o lo recalcula sobre el estado inicial ya sincronizado) y ejecuta directamente los intentos, sin duplicar el dispatch de `set-loading` cuando la firma ya coincide.

**Por qué**: garantiza el criterio de aceptación #8 sin acoplar los efectos del provider por orden de declaración. El efecto de `pages[].preloads` que ya existe compara `currentQuery?.requestSignature !== requestResult.request.requestSignature`; si el estado inicial ya trae `requestSignature: <sig>` con `status: 'loading'`, el efecto de la página inicial omite naturalmente cualquier preload cuya firma efectiva coincida, sin lógica cruzada nueva. También hace observable desde el primer render que la operación está en curso (feedback `loading` inmediato en el árbol layout).

**Trade-off asumido**: `createRuntimeStateFromBrowserHash` deja de ser trivial y realiza trabajo de compose en el arranque. Se acota a operaciones declaradas en `preloads` raíz; el coste es un `buildRuntimeApiRequest` por operación durante bootstrap, comparable al que ya realiza el efecto de `pages[].preloads` en su planning.

**Alternativa descartada**: ordenar los `useLayoutEffect` en el provider para que el disparo global preceda al de pageEntry. Frágil: cualquier reordenación futura de hooks rompe la dedup, y el efecto de pageEntry lee del render closure, no del `latestStateRef`.

### 5. Política de reintentos: helper puro en `src/queries/`

- Nuevo módulo `src/queries/runtime-api-retry.ts` con:
  - Constante `GLOBAL_PRELOAD_MAX_ATTEMPTS = 3` (única fuente de verdad exportada).
  - Función `runRuntimeApiRequestWithRetries({ attempt, maxAttempts })`:
    - `attempt: () => Promise<AttemptResult>` donde `AttemptResult` refleja el resultado tipado equivalente al de `executeBuiltRuntimeApiRequest` (`{ status: 'success', data } | { status: 'error', error }`).
    - Bucle secuencial `for i in [0, maxAttempts)`: si el intento devuelve `success`, retorna inmediatamente; si retorna `error`, sigue.
    - Sin espera entre intentos (`await` directo, sin `setTimeout`).
    - Devuelve el último resultado (éxito temprano o error del último intento).
  - No conoce `dispatch`, `config`, ni el reducer. Es una utilidad de bucle.
- El hook `use-runtime-global-preloads` construye la función `attempt` por operación (llamando internamente al ciclo compose + execute ya existente) y despacha `queries/set-success` o `queries/set-error` según el resultado final.

**Por qué**: cumple literalmente el requisito no funcional "composición y ejecución de requests, incluidos los reintentos, se mantiene en `src/queries/`". Mantiene la primitiva reutilizable, pura y trivial de testear en aislado. El hook del runtime queda como una capa fina de wiring entre plan + retry + dispatch.

**Alternativa descartada**: bucle inline en el hook. Cruza la frontera declarada del no-funcional y duplicaría el código si otra feature futura reutiliza reintentos.

**Trade-off asumido**: reintentos deterministas idénticos entre intentos (`operation-not-found`, `request-build-failed` con contexto invariable) desperdician 2 intentos garantizados. Se acepta explícitamente en la spec y en esta feature: la uniformidad de política es más simple y auditable que categorizar códigos.

### 6. Dedup con ejecución manual concurrente

- Durante los reintentos del `preloads` global, la operación puede ser también relanzada manualmente (`executeOperation` desde botón/submit) sin coordinación nueva. Sigue la semántica `latest-only` ya vigente: el último dispatch de estado (`set-success` o `set-error`) gana. Ambas rutas escriben en `queries.{operationName}` sin coordinación cruzada.
- No se introduce lock, cola ni cancelación de intentos pendientes: la spec y los casos límite lo excluyen.

**Por qué**: preserva el modelo mental existente y no añade concurrency primitives al runtime. Los efectos observables ("gana el último en cerrar") coinciden con el resto de superficies actuales.

### 7. Diferenciación clara frente a `pages[].preloads`

- El `preloads` raíz **no** contribuye a `pageEntry` ni comparte tanda agregada con `pages[].preloads`. No existe un agregado equivalente a `pageEntry` para el bloque raíz; cada `operationName` sigue su propia política de reintentos e informa su estado únicamente vía `queries.{operationName}`.
- Los tests deben cubrir explícitamente que:
  - Navegar entre páginas (hash routing) no relanza el `preloads` raíz.
  - Un mismo `operationName` en global + página inicial no dispara dos requests en la primera carga.
  - La página inicial se pinta en el DOM sin esperar a operaciones del `preloads` raíz.

## Riesgos y trade-offs

- **Coste de compose en bootstrap**: `createRuntimeStateFromBrowserHash` ejecuta `buildRuntimeApiRequest` por cada operación del `preloads` raíz al montar el runtime. Es una operación pura y ya ejecutada por página, pero se traslada al arranque. Mitigación: acotado al número de operaciones declaradas; la spec asume que un uso razonable son unas pocas operaciones transversales.
- **Estado inicial `loading` "artificial"**: consumidores con `queryStateFeedback` sobre esas operaciones verán `loading` desde el primer render, incluso si la primera petición todavía no ha salido a la red. Esto coincide con la intención funcional (feedback reactivo desde el arranque) y con el criterio de aceptación #3 de la spec.
- **Reintentos deterministas malgastados**: 3 intentos garantizados para errores como `operation-not-found`. Coste asumido y documentado en la spec. Alternativa (clasificar códigos) queda explícitamente fuera de alcance.
- **StrictMode / doble montaje en desarrollo**: la guardia por `useRef<boolean>` protege contra re-lanzamientos, pero en StrictMode React monta y desmonta el árbol dos veces al primer render. La guardia debe implementarse comparando estado real de las queries (`status !== 'idle'` para el `operationName`) o combinando `useRef` con el efecto de limpieza. Mitigación: usar un `useRef` que se ponga a `true` de manera irreversible en el arranque del hook y que el efecto de limpieza NO revierta; el efecto es re-entrable pero idempotente.
- **Compatibilidad con features de tokens**: si un `preloads` raíz declara headers que dependen de un token en refresco, el compose puede quedar en `token-refresh-failed`. La política de reintentos aplica igual (uniforme). No se introduce coordinación especial con `runtime-tokens`.
- **Dedup vs `pages[].preloads` cuando la firma difiere**: si las requests efectivas divergen (por ejemplo el preload de página añade `query` extra), sí se emiten ambas y cada una escribe en `queries.{operationName}` siguiendo latest-only. Esto es coherente con la política vigente y con la spec ("reutiliza la política ya vigente de reevaluación selectiva por firma").
- **Riesgo residual de orden de mount**: si el árbol se remonta (por ejemplo tras un reset explícito de runtime desde tests), la guardia por ref se reinicializa, lo que dispararía otra vez. Aceptable porque un remount lógico equivale a una nueva instancia del runtime, alineado con la spec ("una vez por carga = una vez por instancia montada").

## Migración o despliegue

- Cambio puramente aditivo en el contrato JSON: el bloque `preloads` raíz es opcional y no altera configs previas.
- No hay migración de datos, ni cambios en el shape de `pages[].preloads`, ni cambios en `queries.*`.
- Dev editor (`src/dev/`) puede consumir el nuevo bloque en `src/dev/config.json` sin cambios previos; queda a decisión de tareas si se añade un ejemplo local de referencia.
- No hay banderas de release necesarias.

## Preguntas abiertas

Ninguna bloqueante. Todas las decisiones técnicas que condicionaban planning (ubicación de la orquestación, garantía de dedup en primera carga, ubicación de la primitiva de reintentos, extracción de núcleo común del validador) quedan cerradas.

Riesgo residual único: la interacción con StrictMode en desarrollo se resuelve durante la implementación por convención estándar (guardia por `useRef` no revertida en cleanup) y no requiere decisión previa.
