# Design: Feature 0078 - auth-tokens

## Contexto

- La spec introduce un nuevo bloque raíz opcional `tokens` con valores nombrados, referenciables manualmente en
  cabeceras y con refresco proactivo opcional por intervalo. Cada token mantiene su propio ciclo de vida.
- El runtime ya tiene un sistema de referencias (`runtime-references/`) que cubre `forms.*`, `queries.*`, `params.*`,
  `item.*` y `translations.*`. El parser está en `runtime-reference-parser.ts` y el resolver en
  `runtime-reference-resolver.ts`; el primero usa un set cerrado de namespaces y patrones aceptados.
- La resolución de headers para operaciones, acciones de botón y `form.submitAction` pasa hoy por
  `src/queries/runtime-api-payload-resolver.ts` (`resolveHeaders` → `resolvePayloadValue` → `resolveRuntimeReference`).
  Esa misma capa también gobierna `query` y `body`. Es decir, ampliar el parser para un namespace nuevo lo abre
  automáticamente a todas las superficies de payload salvo que la validación previa al render restrinja superficie.
- El estado compartido del runtime vive en `runtime-state/` (`RuntimeState` con dominios `navigation`, `forms`,
  `queries`, `pageEntry`, `modal`, `i18n`) gestionado por un único reducer y un único provider (`RuntimeStateProvider`).
  El proyecto evita duplicar dominios y prefiere ampliar el reducer existente cuando aparece nuevo estado compartido.
- La ejecución real de requests vive en `src/queries/runtime-api-executor.ts` (`buildRuntimeApiRequest`,
  `executeBuiltRuntimeApiRequest`). `buildRuntimeApiRequest` orquesta la composición y devuelve un request listo o un
  error `request-build-failed`. Estos building blocks están preparados para reutilizarse fuera del flujo principal de
  queries.
- La validación previa al render se compone por dominio (`validate-api-config`, `validate-preloads`,
  `validate-layout-nodes`, `validate-actions-visibility`, `validate-form-nodes`, `validate-translations`,
  `validate-file-manager-nodes`) y la orquesta `validate-runtime-config`. Errores se diagnostican con códigos públicos
  como `invalid-layout` y rutas canónicas. Es el patrón que debe seguir el contrato del nuevo bloque.
- Existen códigos de error tipados estables en la ejecución de operaciones (`operation-not-found`,
  `request-build-failed`, `network-error`, `http-error`, `invalid-json-response`, `business-error-condition`). Esta
  feature añade uno nuevo: `token-refresh-failed`, semánticamente cercano a `request-build-failed` pero con causa
  distinta.

## Objetivos / No objetivos

### Objetivos

- Cerrar dónde vive el estado activo de cada token dentro del runtime y cómo se hidrata.
- Cerrar dónde viven los timers de refresco, cómo se programan y cómo se limpian.
- Cerrar cómo se ejecuta una operación de refresco sin contaminar `queries.*`.
- Cerrar cómo se expone `tokens.*` al sistema de referencias y cómo se gating la familia por superficie.
- Definir la introducción de `token-refresh-failed` y su comportamiento en la fase de build del request.
- Definir el reparto de responsabilidades entre `src/config/`, `src/runtime/` y `src/queries/` para esta feature.

### No objetivos

- Detectar dependencias circulares entre tokens y operaciones de refresco (la spec lo deja fuera explícitamente).
- Resolver refresco reactivo ante 401/403 o cualquier disparador no temporal.
- Inyectar tokens automáticamente en operaciones; toda inyección sigue siendo explícita por referencia.
- Soportar `tokens.*` en superficies distintas de las cuatro declaradas en la spec.
- Soportar sub-rutas distintas de `tokens.{tokenId}.value`.
- Persistir el valor de los tokens entre sesiones (live in-memory en el runtime).

## Decisiones

### D1. Nuevo dominio `runtime-tokens/` con scheduler como hook

- Se crea una nueva carpeta `src/runtime/runtime-tokens/` con la responsabilidad acotada de programar refrescos,
  ejecutarlos y exponer el resultado al reducer global.
- Expone `useRuntimeTokenScheduler({ config, dispatch, getLatestState, fetchImplementation })`, un hook que
  `RuntimeStateProvider` invoca una sola vez tras crear el estado inicial.
- El scheduler mantiene refs internos por `tokenId` con el `timeoutId` activo y la "generación" del refresco (un
  contador monotónico por token para resolver carreras entre re-runs y desmontaje).
- Para cada token con `refresh`, programa el primer `setTimeout` a los `refresh.intervalSeconds` segundos desde el
  montaje. Al completar un ciclo (éxito o error), reprograma el siguiente desde ese punto. No usa `setInterval` para
  evitar drift acumulativo y solapamientos cuando un refresco tarda más de un intervalo.
- En `cleanup` del hook se cancelan todos los `timeoutId` activos. La generación monotónica permite ignorar resultados
  tardíos cuyo timer ya fue cancelado.
- Alternativas descartadas:
    - Provider dedicado `RuntimeTokensProvider`: introduce otra capa de contexto sin necesidad; el estado compartido
      sigue siendo el del runtime y no se gana aislamiento real.
    - Refs y `useEffect` inline en `RuntimeStateProvider`: engorda un fichero ya grande, mezcla dominios y dificulta
      tests aislados del scheduler.
- Trade-off: una pieza nueva del runtime con su propia superficie de tests; coste razonable para mantener separación por
  dominio según `architecture.md`.

### D2. Estado de tokens dentro de `RuntimeState`

- Se añade un nuevo dominio `tokens: Record<string, RuntimeTokenState>` al `RuntimeState`, con shape mínimo:
    - `value: string` (valor activo actual).
    - `status: 'ready' | 'refreshing' | 'error'`.
    - `failedAttempts: number` (contador interno de intentos fallidos consecutivos del ciclo de refresco actual; 0
      cuando `status` deja de ser `'refreshing'` salvo entrada a `'error'`).
- Se hidrata en `createRuntimeState` a partir de `config.tokens`: cada token arranca en `status: 'ready'` con el `value`
  declarado y `failedAttempts: 0`. Configuraciones sin `tokens` producen `tokens: {}`.
- Nuevas acciones del reducer:
    - `tokens/set-refreshing` (entra a `'refreshing'`; conserva `value` y `failedAttempts`).
    - `tokens/set-value` (`'ready'`, nuevo `value`, `failedAttempts: 0`).
    - `tokens/set-error` (`'error'`, mantiene último `value` o lo conserva para diagnóstico; consumidores solo deben
      mirar `status`).
    - `tokens/record-failed-attempt` (`failedAttempts: n + 1`, `status` sigue siendo `'refreshing'`).
- Estas acciones se enrutan por el mismo `dispatchAndSyncState` ya disponible para mantener `latestStateRef`
  sincronizado.
- `runtime/reset` debe incluir `tokens` en el snapshot que restaura, aunque para v1 nunca se llame con un estado de
  tokens manipulado: mantener la coherencia formal del action.

### D3. Path de ejecución token-scoped, no toca `queries.*`

- El scheduler ejecuta la operación de refresco reutilizando `buildRuntimeApiRequest` y `executeBuiltRuntimeApiRequest`
  directamente, sin pasar por `executeQueryOperationWithSnapshot` ni dispatch a `queries/*`.
- Razones:
    - La operación de refresco es detalle de implementación de la feature de tokens, no un dato consumible desde el
      layout.
    - Reescribir `queries.{operationName}` en cada refresco contaminaría `visibility.reference`, `queryStateFeedback`,
      lecturas de `queries.*` desde nodos, y haría aparecer estados `loading/error` con cada tic del scheduler.
    - El developer mantiene libre el nombre de operación: puede consumirlo en el layout si lo dispara explícitamente
      desde otro sitio, sin que el scheduler le sobreescriba estados.
- El snapshot del estado para construir el request es el último `getLatestState()` al disparar el refresco; los headers
  de la operación pueden referenciar `tokens.{otroId}.value` y resuelven contra ese snapshot.
- Tras la respuesta, el scheduler extrae el valor desde `refresh.responsePath` (dot-notation) sobre `data` del
  resultado:
    - éxito si y solo si la subruta resuelve a string no vacío.
    - cualquier otro caso (`request-build-failed`, `network-error`, `http-error`, `invalid-json-response`,
      `business-error-condition`, valor no string, valor string vacío) se trata como intento fallido del ciclo actual.
- Política de reintento:
    - Intento 1 falla → `tokens/record-failed-attempt`, programa intento 2 inmediato (sin esperar otro
      `intervalSeconds`).
    - Intento 2 falla → `tokens/set-error`. Se reprograma el siguiente ciclo a los `intervalSeconds` siguientes (la spec
      no exige permanecer en error de forma perpetua; tras el siguiente intervalo se vuelve a intentar). Si más adelante
      un refresco vuelve a tener éxito, el token vuelve a `'ready'` con el nuevo valor.
    - Trade-off: la spec deja abierto si seguir reintentando tras entrar en error. Esta decisión es la más conservadora:
      no congelar el ciclo, pero no enmascarar el error temporal. Si en revisión se prefiere "congelar hasta
      intervención manual", se trata como cambio menor en este mismo design.

### D4. `tokens.*` como nuevo namespace en parser/resolver

- Se añade `tokens` al set cerrado de namespaces soportados en `runtime-reference-parser.ts` y a
  `RuntimeReferenceNamespace`/`RuntimeSupportedReference`.
- Shape válido único: `tokens.{tokenId}.value`. El parser rechaza como `invalid` cualquier otra cardinalidad o subruta (
  `tokens`, `tokens.id`, `tokens.id.value.x`, `tokens.id.other`).
- `runtime-reference-resolver.ts` añade una rama que lee `state.tokens[tokenId]`:
    - si el token no existe → `found: false` (la capa superior lo traducirá a error de build).
    - si `status === 'error'` → resolución especial que el resolver señala como "token-error" mediante un nuevo
      discriminator añadido a `RuntimeReferenceResolutionResult` (p. ej. `status: 'token-error'`), permitiendo al
      payload resolver distinguirlo de `'missing'`.
    - si `status` es `'ready'` o `'refreshing'` → `found: true, value: state.tokens[tokenId].value`. En `'refreshing'`
      se sigue sirviendo el valor activo: el refresco es proactivo, no bloquea peticiones.
- Trade-off: añadir un nuevo branch (`token-error`) al resultado del resolver implica tocar consumidores. Solo
  `resolvePayloadValue` necesita reaccionar; las superficies visibles tratan `tokens.*` como string ausente por
  validación, así que no debería propagarse a nodos textuales.

### D5. Validación de superficie en `src/config/`

- Se sigue el mismo patrón que `params.*`: el parser/resolver acepta `tokens.*` globalmente; la validación previa al
  render rechaza la familia en cualquier superficie distinta de las cuatro declaradas en la spec.
- Superficies admitidas (no se rechazan):
    - `api.{operationName}.headers.*`
    - `pages[].preloads[].{operationName}.headers.*`
    - `button.props.action.headers.*` y, dentro de `executeOperations`, `operations[].headers.*`
    - `form.submitAction.headers.*` y, dentro de `executeOperations`, `operations[].headers.*`
- Superficies que rechazan `tokens.*` con código `invalid-layout` (o el equivalente del dominio) y ruta exacta:
    - `api.*.query`, `api.*.body`, `api.*.endpoint` (incluyendo placeholders)
    - `button.props.action.query`, `button.props.action.body`, `button.props.action.params`,
      `button.props.action.pageId` y equivalentes en `executeOperations`
    - `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.params` y equivalentes en
      `executeOperations`
    - `preloads[].query`, `preloads[].body`, `preloads[].when`
    - `visibility.reference`, `queryStateFeedback.reference`
    - `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`,
      `radioGroup.props.items.source`, `checkboxGroup.props.items.source`
    - `defaultValue` de campos de formulario
    - superficies visibles interpolables (`heading.props.text`, etc.) y celdas/labels de `table`, `list`,
      `image.props.src`, `image.props.alt`
- La detección reutiliza el mismo enfoque actual: en cada validador de superficie se comprueba el namespace del string
  resuelto vía el parser ya existente y se rechaza si es `tokens.*`. Como hay varias superficies, se añade un helper
  compartido `assertNamespaceAllowed(reference, allowedNamespaces, diagnostic)` para no duplicar checks.

### D6. Nuevo módulo `src/config/validate-tokens-config.ts`

- Estructura paralela a `validate-preloads`, `validate-api-config`.
- Validaciones:
    - bloque opcional; si no existe se acepta y produce `config.tokens = {}` normalizado.
    - claves deben ser strings no vacíos y únicos (Zod ya garantiza unicidad de claves en objetos).
    - `value` requerido string no vacío.
    - `refresh` opcional; si presente, `operation`, `responsePath`, `intervalSeconds` son requeridos.
    - `refresh.operation` debe existir en `api` (validación cruzada en `validate-runtime-config` después de validar
      `api`).
    - `refresh.intervalSeconds` entero positivo (rechazo si `<= 0` o no entero).
    - `refresh.responsePath` string no vacío (dot-notation se evalúa en runtime).
    - claves extra se descartan silenciosamente, alineado con el resto del contrato.
- Errores siguen el patrón `invalid-layout`/`invalid-tokens-config` (se decide en implementación según naming existente,
  sin reabrir contrato) con ruta canónica del tipo `tokens.{tokenId}.refresh.intervalSeconds`.

### D7. `token-refresh-failed` en build de request

- En `resolvePayloadValue` (y por extensión `resolveHeaders`), cuando el resolver devuelve `status: 'token-error'`, se
  emite un fallo distinguible que `resolveHeaders` traduce a un nuevo error en la fase de build:
    - `code: 'token-refresh-failed'`
    - `message`: indicando qué cabecera/token causó el fallo, sin exponer el valor del token.
- `buildRuntimeApiRequest` (en `src/queries/runtime-api-executor.ts`) propaga ese error con el mismo shape que
  `request-build-failed`. El executor lo dispatcha a `queries/set-error` con `code: 'token-refresh-failed'` y no emite
  red.
- Decisión: la prioridad sobre `request-build-failed` cuando ambos podrían ocurrir no es relevante porque un token en
  error impide construir el header concreto; otros fallos en `body`/`query` mantienen su semántica. Para legibilidad, el
  orden de evaluación es el actual: primero query, después body, después headers — el primer error gana. Si un header
  tiene `tokens.{id}.value` con token en error, la operación falla con `token-refresh-failed`.
- Se documenta como nuevo código tipado en `queries/execution.md` junto a los existentes.

### D8. Reutilización del executor para operaciones de refresco

- `src/queries/runtime-api-executor.ts` ya expone `buildRuntimeApiRequest` y `executeBuiltRuntimeApiRequest` como
  building blocks reutilizables.
- El scheduler los invoca directamente. No se necesita una nueva fachada en `runtime-api-executor.ts`; basta una función
  local en `runtime-tokens/` (`executeTokenRefresh`) que orqueste build + execute y extraiga `responsePath`.
- `responsePath` se evalúa con la utilidad de navegación dot-notation que ya existe en helpers internos de
  `errorMessagePath`/`errorCodePath` del executor (`api-catalog.md` describe ese contrato). Si no existe ya un helper
  exportable, se extrae a un helper compartido y se reutiliza tanto desde `runtime-api-executor` como desde
  `runtime-tokens`.

### D9. Ámbito del scheduler frente al ciclo de vida del runtime

- El scheduler arranca al montar `RuntimeStateProvider` y se limpia al desmontar. No reacciona a navegación entre
  páginas: los tokens son globales de la instancia del runtime, no por página.
- Cambios en `config.tokens` entre renders no son un caso soportado por la app vigente (la config es global por
  instancia y no se hot-swappea), pero el hook usa `config` como dependencia: si cambiase, se cancelarían los timers
  actuales y se programarían los nuevos. Esto es un comportamiento defensivo, no un caso explícito de la spec.

### D10. No persistencia ni cache cross-session

- El valor del token vive solo en memoria. No se persiste en `localStorage`, `sessionStorage` ni cookies, alineado con
  la restricción de no exponerlo en superficies visibles ni en logs.
- Cada reload de la app reinicia el valor declarado en `value`. El primer refresco sigue ocurriendo a los
  `intervalSeconds` desde el arranque.

## Riesgos y trade-offs

- **Race condition refresco/consumo**: una petición se construye en el snapshot del momento de disparo (
  `getLatestState()`). Si el refresco completa entre la lectura del snapshot y la emisión real del request, el header
  llevará el valor anterior. Aceptable: es coherente con cómo el resto del runtime ya trata snapshots por disparo; el
  siguiente request usará el nuevo valor.
- **Refresco que depende de su propio token**: si la operación de refresco lleva un header `tokens.{mismoId}.value`,
  usará el valor activo en el instante del refresco. Si ese token entra en error, el refresco siguiente también fallará
  con `token-refresh-failed` en build, dejando el token en error de forma estable hasta intervención humana. La spec
  acepta no detectar circularidad; este design lo deja como riesgo conocido visible al desarrollador.
- **Tokens dependientes entre sí**: si tokenA usa tokenB en sus headers de refresco y tokenB entra en error, el refresco
  de tokenA empezará a fallar. El comportamiento es predecible y no requiere lógica nueva: cada token gestiona su ciclo
  de forma independiente.
- **Drift de timers**: con `setTimeout` encadenado, el intervalo efectivo es `intervalSeconds + tiempo_del_refresco`.
  Para v1 no se busca precisión sub-segundo; documentar en la ficha funcional.
- **Tests con timers**: los tests del scheduler deben usar `vi.useFakeTimers()` para controlar `setTimeout`. Coste
  asumido y consistente con prácticas existentes del proyecto.
- **Nuevo branch en el resolver**: introducir `status: 'token-error'` en `RuntimeReferenceResolutionResult` toca tipos
  compartidos. Riesgo: que algún consumidor existente no contemple ese case y degrade silenciosamente. Mitigación: el
  branch es relevante solo en `resolvePayloadValue`; los consumidores visibles (`resolveRuntimeVisibleValue`,
  `resolveRuntimeTextReference`) deben tratarlo igual que `'missing'`/`'invalid'` (string vacío), porque la validación
  previa al render ya impide que `tokens.*` aparezca en esas superficies. Aun así, se cubrirá con tests que prueben el
  degrade explícito.
- **Cobertura ≥ 80%**: la feature añade varios módulos nuevos (scheduler, validator, executor wrapper). Es esperable que
  los tests del scheduler con fake timers y los del validator sean los más extensos; ningún módulo debería quedar sin
  cobertura directa.

## Migración o despliegue

- Cambio aditivo. Configuraciones sin bloque `tokens` no se ven afectadas.
- No requiere migración de configs existentes; `config.tokens` queda como `{}` tras la normalización.
- `data-config` y `data-values` no cambian. `dev/config.json` puede usar el nuevo bloque opcional para validación manual
  local.
- Documentación afectada (a actualizar en la fase de `update-app-documentation`, no aquí):
    - `app-features/config/structure.md`: nuevo bloque raíz `tokens` y enlace a la nueva sub-ficha.
    - `app-features/config/api-catalog.md`: nota de que `api.headers` admite `tokens.*` además de los namespaces ya
      soportados.
    - `app-features/config/validation.md`: nueva sección "Reglas del bloque `tokens`" y reglas de rechazo por
      superficie.
    - `app-features/references/reference-resolution.md`: nueva familia `tokens.*`, superficies admitidas y
      comportamiento.
    - `app-features/queries/execution.md`: nuevo código `token-refresh-failed`.
    - `current-state.md`: nueva área "Auth tokens" o actualizar "Autenticación y permisos" mostrando el alcance v1
      cubierto.
    - opcional: nueva ficha `app-features/auth/tokens.md` si el equipo prefiere consolidar la feature como dominio
      propio.

## Preguntas abiertas

- Tras entrar en `'error'`, ¿el scheduler debe seguir reintentando cada `intervalSeconds` (decisión D3 actual) o
  congelarse hasta intervención manual? La spec no lo fija. Esta decisión queda explícita como D3 conservador y
  revisable; si se prefiere congelar, ajustar en planning sin necesidad de cambiar el modelo de estado.
- Naming del código de error en el validador de bloque `tokens` (`invalid-tokens-config` vs reutilizar `invalid-layout`
  con ruta `tokens.*`). Se cierra en planning según convención de naming local; no condiciona la arquitectura.
