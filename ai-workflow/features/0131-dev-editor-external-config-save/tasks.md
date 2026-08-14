# Plan de implementación — 0131 dev-editor-external-config-save

Contrato de ejecución de la feature. Cada tarea es un cambio acotado, verificable por sí mismo y ordenado
por dependencia. Referencias cruzadas: `spec.md` (contrato funcional), `design.md` (decisiones técnicas D1–D8).

Reglas globales de testing (umbral de cobertura del proyecto, aislamiento por fichero, no repetición de setup) viven
en `ai-workflow/standards/testing-rules.md`; el sub-bloque `tests` de cada tarea aquí solo declara lo específico.

---

## T1 — Módulo `endpoints-config`: schema + parser + resolver

### Objetivo
Crear el módulo puro que define el shape de la config de endpoints externos y resuelve una operación
concreta contra los `tokens.*` del config activo. No hay integración con bootstrap, DevRuntime ni UI en esta
tarea: solo los ladrillos puros que consumirán las tareas siguientes.

Contenido:
- Zod schema del shape declarado en design D1 (baseUrl string requerida; `operations.searchTexts`,
  `operations.getTranslationsBatch`, `operations.saveConfig` opcionales de forma independiente; los tres
  IDs de negocio de `saveConfig` — `idGestion`, `idSeccion`, `idObjetoOcurrencia` — como enteros).
- `parseRuntimeEndpointsConfig(raw: unknown): RuntimeEndpointsConfig | undefined`: devuelve el objeto
  parseado si valida, o `undefined` para todo caso de fallo (JSON estructuralmente inválido, shape que no
  cumple el schema). Sin resultado `ready | error`, ni superficie de error propia (FR3).
- `resolveEndpointOperation(endpointsConfig, operationKey, tokens)`: helper puro que devuelve
  `{ status: 'ready', url, token }` o `{ status: 'unavailable', reason: 'operation-not-declared' | 'token-not-resolvable' }`.
  `url` = `endpointsConfig.baseUrl + operations[operationKey].path`. `token` = valor del `tokens.*`
  referenciado por `operations[operationKey].tokenId`. Sin `endpointsConfig` (es decir, `undefined`) la
  respuesta es siempre `operation-not-declared`.

### Fuera de alcance
- Lectura desde bootstrap o desde el DOM (T2).
- Cualquier consumidor real (`translations-provider`, `save-config-provider`, DevEditorLayer) (T3+).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código a crear:
    - `src/dev-runtime/endpoints-config/runtime-endpoints-config-schema.ts` (schema Zod, tipo exportado
      `RuntimeEndpointsConfig`, tipo `EndpointOperationKey` como unión literal de las tres claves,
      `parseRuntimeEndpointsConfig`).
    - `src/dev-runtime/endpoints-config/resolve-endpoint-operation.ts` (helper puro + tipos
      `ResolvedEndpointOperation` / `EndpointOperationUnavailableReason`).
- Tests a crear:
    - `src/tests/dev-runtime/endpoints-config-schema.test.ts`.
    - `src/tests/dev-runtime/resolve-endpoint-operation.test.ts`.
- Documentación a revisar: ninguna en esta tarea (la ficha `development/local-config.md` se toca al
  cerrar la implementación desde `update-app-documentation`).

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/endpoints-config-schema.test.ts` *(nuevo)*
    - `src/tests/dev-runtime/resolve-endpoint-operation.test.ts` *(nuevo)*
- **Comportamiento cubierto**:
    - schema: acepta la config completa con las 3 operaciones y con solo un subconjunto (0, 1, 2, 3
      operaciones declaradas de forma independiente); rechaza (`parseRuntimeEndpointsConfig` → `undefined`)
      un `baseUrl` ausente o no string, una `path` ausente o no string en una operación declarada, un
      `tokenId` ausente o no string, un `idGestion`/`idSeccion`/`idObjetoOcurrencia` no entero (float,
      string), y un raw que no es un objeto plano (string, array, null); ignora silenciosamente claves
      extra dentro de `operations.*` y a nivel raíz (Zod por defecto `.strip()`; **no** usar
      `.strict()`) — así claves extra caen bajo el modo permisivo por diseño, no colisionan con FR3.
      El test debe cubrir explícitamente un objeto con una clave extra a nivel raíz y una dentro de
      `operations.saveConfig` para dejar fijado ese comportamiento.
    - `parseRuntimeEndpointsConfig(undefined)` y `(null)` devuelven `undefined` sin lanzar.
    - resolver: sin `endpointsConfig` devuelve `unavailable` con `operation-not-declared` para cualquier
      operationKey; con endpointsConfig sin la clave `operations[X]` devuelve `operation-not-declared`;
      con `operations[X]` presente pero `tokenId` no resoluble contra `tokens` (ausente en el mapa)
      devuelve `unavailable` con `token-not-resolvable`; con todo resoluble devuelve `ready` con
      `url = baseUrl + path` (concatenación tal cual, sin normalizar slashes) y `token = tokens[tokenId].value`;
      la resolución de una operación no depende ni afecta a la resolución de las otras dos.
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/endpoints-config-schema.test.ts`
    - `pnpm test --run src/tests/dev-runtime/resolve-endpoint-operation.test.ts`
- **Restricciones**: reutilizar `zod` (ya dependencia del proyecto), no introducir librerías nuevas.

### Documentación afectada
Ninguna en la pasada de implementación. Al cerrar la feature: `development/local-config.md` (se documenta
como parte de T3/T7).

### Criterios de finalización
El módulo `endpoints-config/` valida y resuelve exactamente como declara la spec (FR1–FR3) y el design
(D1, D7), sin acoplarse todavía a ningún consumidor real.

### Cierre de implementación
Los dos ficheros de test verdes con los casos descritos y sin regresión en `pnpm test`.

---

## T2 — Bootstrap: `readRuntimeEndpointsConfig` + fichero local `endpoints-config.json`

### Objetivo
Añadir la frontera de arranque que decide, una sola vez al montar `DevRuntime`, qué config de endpoints
está declarada. Aplica el patrón atributo-de-host → fichero local → no declarado (FR1), invocando
`parseRuntimeEndpointsConfig` de T1 en ambos orígenes.

Contenido:
- `readRuntimeEndpointsConfig({ devEndpointsConfig, rootElement })` inspirado en
  `readRuntimeDataValues`: si `rootElement.dataset.endpointsConfig` está presente, se `JSON.parse` y se
  pasa por `parseRuntimeEndpointsConfig`; si el atributo no está, se usa `devEndpointsConfig`; si
  ninguno resuelve a algo válido, devuelve `undefined`. No devuelve nunca un `status: 'error'`: FR3
  fuerza que una config estructuralmente inválida se trate igual que ausente para todo el editor, sin
  bloquear el arranque.
- Nuevo `src/dev/endpoints-config.json` versionado, análogo a `src/dev/config.json` y
  `src/dev/data-values.json`, con un ejemplo mínimo válido que declare las 3 operaciones y un
  `tokenId` (recomendado: reutilizar un `tokens.*` que ya declare `src/dev/config.json`, para que las 3
  operaciones queden habilitadas en desarrollo local). El fichero se importa como JSON en T5.

### Fuera de alcance
- Invocación de esta función desde `DevRuntime`; sucede en T5.
- Cualquier consumidor de la config resuelta.

### Dependencias
T1.

### Impacto esperado en archivos
- Código a crear:
    - `src/app/bootstrap/read-runtime-endpoints-config.ts`.
    - `src/dev/endpoints-config.json`.
- Tests a crear:
    - `src/tests/app/read-runtime-endpoints-config.test.ts`.
- Documentación a revisar: ninguna en esta tarea.

### Tests
- **Ficheros de test**:
    - `src/tests/app/read-runtime-endpoints-config.test.ts` *(nuevo)*
- **Comportamiento cubierto**:
    - con `rootElement.dataset.endpointsConfig` presente y JSON válido conforme al schema: devuelve el
      objeto parseado (prioridad sobre `devEndpointsConfig`).
    - con `rootElement.dataset.endpointsConfig` presente pero JSON sintácticamente inválido
      (`JSON.parse` lanza): devuelve `undefined` sin caer al fallback (para no enmascarar un atributo
      declarado a propósito y roto).
    - con `rootElement.dataset.endpointsConfig` presente pero shape que no pasa
      `parseRuntimeEndpointsConfig`: devuelve `undefined`.
    - sin atributo y con `devEndpointsConfig` conforme al schema: devuelve el `devEndpointsConfig`
      parseado.
    - sin atributo y sin `devEndpointsConfig` (o con uno inválido de shape): devuelve `undefined`.
    - `rootElement` null: se comporta como "sin atributo".
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/read-runtime-endpoints-config.test.ts`
- **Restricciones**: `endpoints-config.json` no debe romper `readRuntimeConfig` ni el bundle de
  producción; se aísla en `src/dev/` como el resto de fixtures locales.

### Documentación afectada
Ninguna en la pasada de implementación.

### Criterios de finalización
`readRuntimeEndpointsConfig` cubre las tres ramas de FR1 (atributo, fichero local, ninguno) y trata
`invalid` igual que "no declarada" como exige FR3.

### Cierre de implementación
Test verde y `pnpm test` sin regresión.

---

## T3 — Cliente HTTP compartido `platages-http-client.ts` (extracción interna, sin cambio de firma pública)

### Objetivo
Extraer la lógica `fetch` + mapeo de errores hoy embebida en `translations-provider.ts`
(`postToPlatages`) a un módulo compartido reutilizable por `save-config-provider` (T4). Esta tarea
**no cambia la firma pública** de `createPlatagesTranslationsProvider`: el cambio a `baseUrl` + paths
obligatorios se ancla a T6/T7, donde los llamadores reales ya disponen de los valores resueltos y
pueden pasarlos sin romper la ejecución global de `pnpm test` a mitad de la migración.

Contenido:
- Nuevo `src/dev-runtime/platages-http-client.ts` que exporta `postToPlatages(url, body, token)` con la
  misma semántica actual: `fetch` POST + `Content-Type: application/json` + `Authorization: Bearer` +
  `JSON.stringify(body)`; mapa de errores 401/403 → `{ kind: 'auth' }` con mensaje fijo; resto de HTTP →
  `{ kind: 'integration' }` con `message` del body si lo trae y es no vacío o un genérico con el código;
  fallo de red / body no-JSON → `{ kind: 'integration' }` genérico. Se exportan también los tipos
  compartidos `PlatagesRequestError` y `PlatagesRequestOutcome<T>` (nombres finales a elegir en
  implementación; alternativa: re-exportarlos como los actuales
  `TranslationsProviderError`/`TranslationsProviderOutcome`). Ambos proveedores (T3 y T4) deben poder
  importar el tipo desde este módulo compartido.
- Refactor **mínimo** de `src/dev-runtime/translations-panel/translations-provider.ts`:
    - `postToPlatages` interno se sustituye por la importación desde `platages-http-client.ts` — la
      copia local se elimina.
    - `AUTH_ERROR_MESSAGE`/`NETWORK_ERROR_MESSAGE` y el `mapErrorResponse` se mueven al módulo
      compartido; el fichero de traducciones deja de definirlos.
    - **Se preservan**: `DEFAULT_BASE_URL`, `SEARCH_TEXTS_PATH`, `GET_TRANSLATIONS_BATCH_PATH`,
      `resolveBaseUrl` y la firma `createPlatagesTranslationsProvider(options?: { baseUrl?: string })`.
      No se toca ninguna referencia a `import.meta.env.VITE_PLATAGES_API_BASE_URL` en esta tarea —
      esas retiradas ocurren en T7 junto con el resto de la migración del panel, cuando el llamador
      (`DevEditorLayer`, T6) ya construye el provider a partir de la config de endpoints resuelta.
    - El mapeo raw→dominio (`BuscarTextosSalidaDTO.Textos`, `ObtenerTextosSalidaDTO.Textos`) queda
      idéntico.

### Fuera de alcance
- El nuevo `save-config-provider.ts` (T4).
- Cualquier cambio en `TranslationsConfigPanel` o `DevEditorLayer` (T6, T7).
- El cambio de firma pública de `createPlatagesTranslationsProvider` (queda pospuesto a T7).

### Fuera de alcance
- El nuevo `save-config-provider.ts` (T4).
- Cualquier cambio en `TranslationsConfigPanel` o `DevEditorLayer` (T6, T7). Aquí solo se actualiza el
  provider y los tests que lo cubren.

### Dependencias
Ninguna funcional (no depende de T1/T2 en código). Se ordena después de T1/T2 solo para agrupar el
trabajo, pero podría hacerse en paralelo.

### Impacto esperado en archivos
- Código a crear:
    - `src/dev-runtime/platages-http-client.ts`.
- Código a modificar:
    - `src/dev-runtime/translations-panel/translations-provider.ts` (solo delega en el módulo
      compartido; firma pública intacta).
- Tests a crear:
    - `src/tests/dev-runtime/platages-http-client.test.ts`.
- Tests a modificar:
    - `src/tests/dev-runtime/translations-provider.test.ts` (adaptar solo si el traslado de
      mensajes/`mapErrorResponse` requiere ajustar imports; los casos de comportamiento no cambian
      porque la firma pública no cambia).
- Documentación a revisar: ninguna en esta tarea.

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/platages-http-client.test.ts` *(nuevo)*
    - `src/tests/dev-runtime/translations-provider.test.ts` *(ampliación mínima — solo ajustes de
      imports si el traslado de constantes lo exige; los casos existentes se mantienen)*
- **Comportamiento cubierto**:
    - `postToPlatages`: URL usada tal cual (`fetch` mockeado, primer argumento verificado), método
      POST, headers `Content-Type` + `Authorization: Bearer <token>`, body = `JSON.stringify(body)`;
      respuesta 2xx con JSON válido → `{ status: 'ok', data }`; respuesta 401 y 403 → `{ status: 'error',
      error: { kind: 'auth', message: <mensaje fijo> } }`, sin leer el cuerpo; otra respuesta no-2xx
      con `message` string no vacío en el body → `{ kind: 'integration', message }`; con body
      `{}`/sin `message`/con `message` vacío → `{ kind: 'integration', message: <fallback genérico con código HTTP> }`;
      body no-JSON → mismo fallback; `fetch` que lanza (fallo de red) →
      `{ kind: 'integration', message: <fallback red genérico> }`.
    - `translations-provider.test.ts`: el fichero **debe seguir en verde íntegro tras esta tarea**
      (firma pública intacta); si algún test dependía de importar `AUTH_ERROR_MESSAGE`/
      `NETWORK_ERROR_MESSAGE` directamente del provider, se re-apuntan al nuevo módulo compartido.
      La reescritura pesada de este fichero (retirada de env, `baseUrl` obligatorio) se traslada
      íntegramente a T7.
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/platages-http-client.test.ts`
    - `pnpm test --run src/tests/dev-runtime/translations-provider.test.ts`
- **Restricciones**: el shape público (`TranslationsProvider`, tipos `Outcome`/`Error`) no debe romperse
  frente a los llamadores existentes salvo por el constructor. No introducir lógica de retry ni cache
  aquí — no está pedido por la spec y aumentaría la superficie de esta tarea.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Proveedor externo integrado
(PlataGes)") queda pendiente de actualización — se recoge en T7 (que retira el desplegable de token) y en
la pasada documental posterior a la feature. No modificarla en esta tarea.

### Criterios de finalización
Toda la integración HTTP de PlataGes vive en `platages-http-client`, reutilizable por T4.
`translations-provider` mantiene su firma pública, así que el resto del árbol de tests (incluidos
`dev-editor-layer.test.tsx` y `translations-config-panel.test.tsx`) no se ve afectado por esta tarea.

### Cierre de implementación
Los dos ficheros de test declarados en verde y `pnpm test` global también verde — sin regresión ni
tests temporalmente rotos.

---

## T4 — `save-config-provider.ts` (operación PlataGes de guardado)

### Objetivo
Añadir el cliente HTTP dedicado a la tercera operación de PlataGes
(`ActualizarJSONConfiguracionEnPlataGes`), reutilizando `postToPlatages` de T3, con el shape que exige
el contrato real aportado en `openapi-facade 1.json` y decidido en design D4.

Contenido:
- Nuevo `src/dev-runtime/endpoints-config/save-config-provider.ts` con:
    - `interface SaveConfigProvider { save(input: { url: string; token: string; idGestion: number; idSeccion: number; idObjetoOcurrencia: number; configJson: string }): Promise<SaveConfigOutcome> }`.
    - `type SaveConfigOutcome = { status: 'ok' } | { status: 'error'; error: { kind: 'auth' | 'integration'; message: string } }`.
    - `createPlatagesSaveConfigProvider(): SaveConfigProvider` que arma el payload
      `{ ActualizarJsonConfiguracionEntradaDTO: { IdGestion, IdSeccion, IdObjetoOcurrencia, Json: configJson } }`,
      llama a `postToPlatages`, y considera éxito solo si
      `response.ok && body.ActualizarJsonConfiguracionSalidaDTO?.Resultado === true`. Cualquier otro
      caso — incluida una respuesta 200 con `Resultado: false` — se traduce a error de integración con
      el mismo mensaje genérico ya usado en T3 (o el `message` del body si viniera envuelto igual que
      un `ErrorResponse`; el contrato lo permite en 400/401/403/404/500).

### Fuera de alcance
- Cualquier UI o wiring en `DevRuntime`/toolbar (T5, T6).
- Validación en el front de la regla "IdObjetoOcurrencia debe ser 267" — spec la marca fuera de alcance
  explícitamente.

### Dependencias
T3 (usa `postToPlatages` y los tipos compartidos).

### Impacto esperado en archivos
- Código a crear:
    - `src/dev-runtime/endpoints-config/save-config-provider.ts`.
- Tests a crear:
    - `src/tests/dev-runtime/save-config-provider.test.ts`.
- Documentación a revisar: ninguna en esta tarea.

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/save-config-provider.test.ts` *(nuevo)*
- **Comportamiento cubierto**:
    - construye el payload exacto `{ ActualizarJsonConfiguracionEntradaDTO: { IdGestion, IdSeccion, IdObjetoOcurrencia, Json: configJson } }`
      con los valores pasados como enteros (no strings) e invoca `fetch` en la `url` recibida con
      `Authorization: Bearer <token>`.
    - respuesta 200 con `ActualizarJsonConfiguracionSalidaDTO.Resultado === true` → `{ status: 'ok' }`.
    - respuesta 200 con `Resultado === false` → `{ status: 'error', error: { kind: 'integration', ... } }`.
    - respuesta 200 sin `ActualizarJsonConfiguracionSalidaDTO` o sin `Resultado` → error de integración.
    - 401/403 → `{ kind: 'auth', ... }` con el mismo mensaje fijo que T3 (delegando en el mapeo del
      client compartido).
    - otro HTTP con `message` → `{ kind: 'integration', message }`; sin `message` → fallback genérico.
    - fallo de red (`fetch` lanza) → `{ kind: 'integration', ... }` con el fallback genérico.
    - `configJson` se transmite tal cual como string (`Json: configJson`, no `JSON.parse(configJson)`)
      — es lo que exige el contrato: el backend recibe el JSON serializado dentro de una clave string.
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/save-config-provider.test.ts`
- **Restricciones**: no re-implementar el mapeo de errores; siempre delegar en `postToPlatages`.

### Documentación afectada
Ninguna en la pasada de implementación.

### Criterios de finalización
Un módulo aislado, sin dependencia de UI ni de config, cubre la operación de guardado. Puede consumirse
desde T5 sin más ajustes.

### Cierre de implementación
Test verde y `pnpm test` sin regresión.

---

## T5 — `DevRuntime`: pipeline de guardado + atajo Ctrl+S/Cmd+S + lectura de endpoints

### Objetivo
Integrar en `DevRuntimeReady` el pipeline completo de guardado hacia el backend externo y añadir el
atajo global de teclado, además de leer y propagar la config de endpoints al árbol de componentes del
editor.

Contenido:
- Leer `endpointsConfig` una sola vez en `DevRuntime` (mismo punto que hoy invoca `readRuntimeConfig` y
  `readRuntimeDataValues`) vía `readRuntimeEndpointsConfig` de T2, importando
  `src/dev/endpoints-config.json` como `devEndpointsConfig`. Pasarlo como prop nueva a
  `DevRuntimeReady`.
- En `DevRuntimeReady`:
    - Añadir estado `saveState: 'idle' | 'loading' | 'success' | 'error'` + `saveError:
      { kind: 'auth' | 'integration'; message: string } | null` (design D8). Vive junto al resto de
      estado de sesión del editor.
    - **Resolución de `saveConfig` centralizada en `DevRuntimeReady`** (aclaración al design D7): las
      3 resoluciones (`searchTexts`, `getTranslationsBatch`, `saveConfig`) se calculan aquí vía
      `useMemo(() => ({ search: resolveEndpointOperation(...), refresh: ..., save: ... }), [endpointsConfig, currentConfig.tokens])`,
      no en `DevEditorLayer`. Motivo: el listener global Ctrl+S y `handleSaveConfig` necesitan la
      resolución de `saveConfig` para decidir habilitación y para leer `url`/`token`. Duplicar la
      llamada en dos sitios (aquí y en `DevEditorLayer`) rompería el "único punto de resolución
      compartido" de D2. Las 3 resoluciones se propagan por props a `DevEditorLayer` (T6 las consume).
    - Añadir handler `handleSaveConfig()` **sin argumentos** (lee la resolución `save` desde el
      `useMemo` anterior; si `save.status !== 'ready'`, retorna sin hacer nada) que:
        1. Retorna sin hacer nada si `saveState === 'loading'` (evita doble envío por doble click /
           doble Ctrl+S, FR7 — mismo guard tanto para click como para atajo).
        2. Retorna sin hacer nada si `save.status !== 'ready'` (nunca envía cuando la resolución es
           `unavailable`, sea por `operation-not-declared` o `token-not-resolvable`).
        3. Setea `saveState: 'loading'`, `saveError: null`.
        4. Serializa `JSON.stringify(currentConfig)` (design D5, minificado; NO `lastValidConfigText`).
        5. Llama a `saveConfigProvider.save({ url: save.url, token: save.token, idGestion, idSeccion, idObjetoOcurrencia, configJson })`,
           con los tres IDs leídos de `endpointsConfig.operations.saveConfig` (garantizados existir
           cuando `save.status === 'ready'`).
        6. Al recibir la respuesta, transita `saveState` a `success` o `error` con `saveError` cuando
           aplique. `currentConfig` no se modifica en ningún caso.
    - Añadir listener global de teclado en `document` (mismo patrón ya usado hoy para `Esc`) que captura
      `keydown` con `event.key === 's'` y (`event.ctrlKey || event.metaKey`), llama `event.preventDefault()`
      siempre (para suprimir el diálogo "Guardar página" nativo — FR9, D6) y a continuación invoca
      `handleSaveConfig` (que aplica sus propios guards de habilitación/loading). El listener se
      registra mientras `DevRuntimeReady` está montado y usa el effect pattern ya establecido en el
      fichero.
    - Instanciar `saveConfigProvider = createPlatagesSaveConfigProvider()` a nivel de módulo,
      análogamente a como `dev-editor-layer.tsx` instancia `translationsProvider`.
    - Propagar `endpointsConfig`, las 3 resoluciones (`saveResolution`, `searchResolution`,
      `refreshResolution`), `saveState`, `saveError` y el handler `handleSaveConfig` a
      `DevEditorLayer` como props nuevas (contrato consumido en T6).

### Fuera de alcance
- La UI del botón "Guardar" y su estado visual (T6 — solo consume las props aquí definidas).
- La retirada del desplegable de token en `TranslationsConfigPanel` (T7).
- El cálculo del provider de Traducciones vía `useMemo` a partir de `endpointsConfig` (T6 — se hace en
  `DevEditorLayer`, que ya monta el panel de Traducciones y lo pasa vía prop).

### Dependencias
T2 (bootstrap), T4 (save provider).

### Impacto esperado en archivos
- Código a modificar:
    - `src/dev-runtime/dev-runtime.tsx`.
- Tests a modificar:
    - `src/tests/dev-runtime/dev-runtime.test.tsx`.
- Documentación a revisar: ninguna en esta tarea.

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/dev-runtime.test.tsx` *(ampliación)*
- **Comportamiento cubierto**:
    - `handleSaveConfig` con endpointsConfig y token resuelto: llama a `saveConfigProvider.save` con
      `configJson === JSON.stringify(currentConfig)` (minificado), transita `saveState` a `loading` →
      `success` sin tocar `currentConfig` ni `lastValidConfigText` ni `editorBuffer`. Los tres IDs
      (`idGestion`/`idSeccion`/`idObjetoOcurrencia`) enviados coinciden byte a byte con los declarados
      en `endpointsConfig.operations.saveConfig`.
    - fallo `auth` y fallo `integration`: transita a `error` con `saveError` correspondiente; no
      cambia `currentConfig`.
    - doble invocación simultánea desde click / prop: la segunda llamada durante `loading` no dispara
      un segundo `fetch` (mock inspeccionado con `toHaveBeenCalledTimes(1)`).
    - doble Ctrl+S durante `loading`: la segunda pulsación tampoco dispara un segundo `fetch`
      (mismo criterio, verificable disparando dos `keydown` seguidos y observando el mock).
    - listener Ctrl+S / Cmd+S: `keydown` con `s` + `ctrlKey` (o `metaKey`) dispara el mismo pipeline y
      llama a `event.preventDefault()`; sin la meta/ctrl no dispara nada.
    - Ctrl+S con `saveResolution.status === 'unavailable'` por `operation-not-declared`
      (endpointsConfig sin `operations.saveConfig`): sigue haciendo `preventDefault` pero no llama al
      provider (FR9 + FR5).
    - Ctrl+S con `saveResolution.status === 'unavailable'` por `token-not-resolvable`
      (endpointsConfig con `saveConfig` declarado pero `tokenId` que no existe en `currentConfig.tokens`):
      `preventDefault` sí, `fetch` no; regresión independiente respecto al caso `operation-not-declared`
      para dejar cubiertas las dos causas de FR5.
    - se serializa `currentConfig` (no `lastValidConfigText`) — verificable montando el editor,
      aplicando un cambio válido y comprobando que un segundo Ctrl+S envía el config normalizado.
    - `endpointsConfig` se lee al arranque y las 3 resoluciones se pasan a `DevEditorLayer`
      (verificable con un spy sobre las props del layer, o comprobando que `DevEditorLayer` recibe
      los objetos correctos tras montar).
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
- **Restricciones**: no duplicar la lógica de `Esc` ya existente para Monaco; añadir el listener de
  Ctrl+S como effect independiente. No tocar la migración de estado ni el resto del pipeline de
  commit ya establecido.

### Documentación afectada
Ninguna en la pasada de implementación.

### Criterios de finalización
El pipeline de guardado funciona end-to-end desde el effect de teclado y desde una función invocable
desde props, con los criterios de aceptación de la spec verificables (envío del JSON minificado con
`Authorization: Bearer`, no envío duplicado, no mutación de estado ante error).

### Cierre de implementación
Test verde, `pnpm test` sin regresión.

---

## T6 — Toolbar "Guardar" + `DevEditorLayer` consume resoluciones + construye provider de Traducciones

### Objetivo
Añadir el botón "Guardar" a la barra flotante con su feedback visual, y hacer que `DevEditorLayer`
consuma las 3 resoluciones ya calculadas en `DevRuntimeReady` (T5) para propagarlas al toolbar (Guardar)
y al panel de Traducciones (T7). Además, `DevEditorLayer` construye el `translationsProvider` vía
`useMemo` a partir de `endpointsConfig` con la firma actual del provider (sin cambio de contrato en
T6; el cambio de firma queda para T7).

Contenido:
- `DevEditorFloatingToolbar`:
    - Aceptar props nuevas: `saveResolution: ResolvedEndpointOperation`, `saveState`, `saveError`,
      `onSave: () => void`.
    - Renderizar botón "Guardar" siempre visible (FR4), en la barra junto al resto de controles.
    - Estado del botón según resolución + estado de guardado:
        - `saveResolution.status === 'unavailable'`: `disabled` + `aria-disabled` + `title` con un
          mensaje explicando la causa (`operation-not-declared` → "La operación de guardado no está
          declarada en la configuración de endpoints"; `token-not-resolvable` → "El token declarado
          para la operación de guardado no existe en `tokens`"). Ambos textos en español.
        - `saveState === 'loading'`: `disabled` + indicador `role="status"` con texto legible
          (`"Guardando..."`), impide reenvíos por doble click (FR7).
        - `saveState === 'error'`: aviso adjunto `role="alert"` con `saveError.message` (mismo criterio
          visual que en `TranslationsConfigPanel`, D8).
        - `saveState === 'success'`: mensaje inline `role="status"` con texto de confirmación
          ("Configuración guardada").
        - otro caso (resuelta + `idle`): habilitado, dispara `onSave` al hacer click.
- `DevEditorLayer`:
    - Aceptar props nuevas: `endpointsConfig: RuntimeEndpointsConfig | undefined`,
      `saveResolution: ResolvedEndpointOperation`, `searchResolution: ResolvedEndpointOperation`,
      `refreshResolution: ResolvedEndpointOperation`, `saveState`, `saveError`, `onSave: () => void`
      — todas vienen ya calculadas de `DevRuntimeReady` (T5), no se recalculan aquí.
    - Pasar `saveResolution`, `saveState`, `saveError`, `onSave` al toolbar.
    - Reemplazar la instancia a nivel de módulo `translationsProvider = createPlatagesTranslationsProvider()`
      por una construcción vía `useMemo` interna: se construye **siempre** (sin ramas condicionales
      undefined). Cuando `endpointsConfig?.baseUrl` está declarado, se pasa como opción; cuando no,
      se omite (`createPlatagesTranslationsProvider()` sin argumentos — misma firma actual del
      provider, no cambiada por T3). Como `searchResolution`/`refreshResolution` estarán
      `unavailable` en cualquier caso donde `baseUrl`/paths falten, el provider no se invoca. El
      provider recreado solo depende de `endpointsConfig?.baseUrl`, no de `currentConfig.tokens`, por
      lo que en la práctica se estabiliza tras el arranque.
    - **Nota**: la firma pública de `createPlatagesTranslationsProvider` sigue siendo la actual
      (`options?: { baseUrl?: string }`) hasta T7. Los paths por operación se seguirán resolviendo
      dentro del provider vía sus constantes internas, y solo se cambia el shape en T7 cuando el
      panel también migra.
    - Pasar `searchResolution` y `refreshResolution` al panel de Traducciones como props nuevas
      (contrato consumido en T7); mantener temporalmente la prop `tokens` mientras T7 no cierre la
      migración, para que el desplegable existente siga funcionando en el intermedio. En T7 se
      retira.

### Fuera de alcance
- El consumo real de las dos resoluciones dentro de `TranslationsConfigPanel` y la retirada del
  desplegable de token (T7).
- El estado del provider dentro de `DevRuntime` y el listener Ctrl+S (T5).

### Dependencias
T1 (para `resolveEndpointOperation`), T3 (constructor nuevo de `translations-provider`), T5 (props que
`DevRuntimeReady` empieza a exponer).

### Impacto esperado en archivos
- Código a modificar:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx`.
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`.
    - `src/dev-runtime/dev-runtime.tsx` (solo para pasar `endpointsConfig` a `DevEditorLayer`; si T5 ya
      lo hizo, ninguna edición adicional aquí).
- Tests a modificar:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`.
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx`.
- Documentación a revisar: ninguna en esta tarea (documentación se cierra tras T7).

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` *(ampliación)*
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` *(ampliación)*
- **Comportamiento cubierto**:
    - toolbar: botón "Guardar" siempre en el DOM (FR4). Con `saveResolution.status === 'ready'` y
      `saveState === 'idle'` → habilitado, `onClick` invoca `onSave`. Con
      `saveResolution.status === 'unavailable'` (dos causas) → `disabled` + `aria-disabled` + `title`
      con el mensaje correspondiente. Con `saveState === 'loading'` → `disabled` + `role="status"`
      con "Guardando..."; un doble click no dispara `onSave` dos veces. Con `saveState === 'error'` →
      `role="alert"` con `saveError.message` visible. Con `saveState === 'success'` → `role="status"`
      con mensaje de confirmación. Regresión: el resto de la toolbar (selector de página, dominios,
      Monaco, Visual/Editor) sigue funcionando idéntico.
    - `DevEditorLayer` (unit, recibe las resoluciones por props ya calculadas):
        - `saveResolution` recibida por prop se propaga tal cual al toolbar (mock del toolbar o
          assertion sobre la prop `saveResolution`);
        - `searchResolution`/`refreshResolution` recibidas por prop se propagan tal cual al panel de
          Traducciones (assertion sobre las props del panel);
        - el `translationsProvider` construido vía `useMemo` se pasa al panel como prop `provider` y
          se re-crea al cambiar `endpointsConfig.baseUrl` (assertion sobre identidad de la prop
          `provider` antes y después de re-renderizar con `baseUrl` distinto);
        - sin `endpointsConfig` (undefined), el provider se construye con la firma actual sin
          opciones — no hay assertion negativa (que "no se llame") aquí, porque las resoluciones
          `unavailable` ya lo impiden en el panel.
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
- **Restricciones**: no introducir un tercer estado local para el guardado en el toolbar — el estado
  vive en `DevRuntimeReady` (T5) y se recibe por props. Los mensajes deshabilitados deben ser
  literales en español, alineados con el resto del editor.

### Documentación afectada
Ninguna en la pasada de implementación.

### Criterios de finalización
El botón "Guardar" se comporta según todos los estados posibles y `DevEditorLayer` provee las 3
resoluciones sin tocar la habilitación real del panel de Traducciones todavía (T7).

### Cierre de implementación
Los dos ficheros de test verdes con los casos descritos. `translations-config-panel.test.tsx` puede
seguir roto hasta T7.

---

## T7 — Migración de `TranslationsConfigPanel`: retirada del desplegable de token, consumo de resoluciones

### Objetivo
Retirar por completo el desplegable de token del panel Traducciones y pasar a habilitar/deshabilitar
"Buscar y añadir" y "Refrescar todo" según las resoluciones por operación (FR10, FR11, D7).

Contenido:
- Cambiar el contrato del componente:
    - Retirar la prop `tokens`.
    - Añadir dos props: `searchResolution: ResolvedEndpointOperation` y
      `refreshResolution: ResolvedEndpointOperation`.
    - Mantener `provider?: TranslationsProvider` (creado ahora por `DevEditorLayer` desde la config de
      endpoints resuelta).
- Retirar el estado interno `selectedToken` / `selectedTokenValue` y el `<select>` HTML asociado
  (dev-runtime/translations-panel/translations-config-panel.tsx:109-111 y el `<select value={selectedToken}>`
  en el JSX). Reemplazar por texto explicativo colocalizado con cada acción cuando su resolución
  esté `unavailable`.
- "Buscar y añadir":
    - Habilitado solo si `searchResolution.status === 'ready'` (y sin búsqueda en curso, como hoy).
    - Al invocar `provider.searchTexts`, pasar `token: searchResolution.token` (ya no
      `selectedTokenValue`).
    - Deshabilitado con mensaje explicativo cuando `searchResolution.status === 'unavailable'`
      (`operation-not-declared` u `token-not-resolvable`), en español, coherente con el resto del
      editor.
- "Refrescar todo":
    - Análogo, consumiendo `refreshResolution`.
- El aviso local de commit rechazado ligado al cambio de token seleccionado (limpieza al cambiar de
  token, línea del contrato actual) desaparece con el desplegable — no aplica en el modelo nuevo, ya
  que no hay "cambio de token seleccionado".
- Los helpers puros ya existentes (`isNumericTranslationKey`, `computeColumns`, etc.) no cambian.

### Fuera de alcance
- Cualquier cambio a `search-add` / `refresh-all` más allá del origen del token/URL (FR12: el
  comportamiento observable de las dos acciones no cambia).
- Cambios en el shape de `TranslationsProvider` (ya definido en T3).

### Dependencias
T3 (nueva firma de `createPlatagesTranslationsProvider`), T6 (nuevas props del panel y provider
memoizado).

### Impacto esperado en archivos
- Código a modificar:
    - `src/dev-runtime/translations-panel/translations-config-panel.tsx`.
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (ajustar props pasadas al panel — puede
      cerrarse en T6 si el orden lo permite; en ese caso aquí solo queda coherencia final).
- Tests a modificar:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (reescribir todos los casos ligados al
      desplegable y al `selectedToken` para usar las nuevas props).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (regresión: la sub-integración con el panel
      sigue verde con las nuevas props).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (los tests de commit de Traducciones que hoy
      construyen `<TranslationsConfigPanel>` real deben adaptarse al nuevo contrato).
- Documentación a revisar: ninguna en la pasada de implementación (se recoge para
  `update-app-documentation`).

### Tests
- **Ficheros de test**:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` *(ampliación — reescribe la sección
      del desplegable y adapta los tests de "Buscar"/"Refrescar todo" al nuevo contrato de props)*
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` *(ampliación — retirar la prop `tokens` en
      la sub-integración con el panel; verificar que las dos resoluciones se propagan y que el
      `<select>` de token ya no existe cuando el layer monta el panel)*
    - `src/tests/dev-runtime/dev-runtime.test.tsx` *(ampliación — los tests de
      `commitTranslationsMutation` que hoy montan `TranslationsConfigPanel` real adaptan sus factories
      al nuevo contrato: pasan `searchResolution`/`refreshResolution` en lugar de `tokens`)*
- **Comportamiento cubierto**:
    - el `<select>` de token ya no existe en el DOM en ningún caso (regresión explícita, en
      `translations-config-panel.test.tsx` y en la sub-integración de `dev-editor-layer.test.tsx`).
    - "Buscar y añadir" habilitado solo con `searchResolution.status === 'ready'`; con
      `unavailable/operation-not-declared` deshabilitado + mensaje "operación no declarada"; con
      `unavailable/token-not-resolvable` deshabilitado + mensaje "token no encontrado". La llamada al
      provider usa `searchResolution.token`.
    - "Refrescar todo": análogo con `refreshResolution` — habilitación independiente de la de
      "Buscar" (una de las dos resuelta y la otra no habilita solo su acción).
    - "Buscar" con `searchResolution.status === 'ready'` sigue mostrando el mismo comportamiento
      observable que hoy (resultados mostrados, alta de seleccionados, "Sin resultados", errores de
      red/auth con `role="alert"`) — FR12; se puede cubrir reejecutando (con `describe.each` u otro
      patrón ligero) al menos un caso de éxito y un caso de error 401, verificando que ni la lógica de
      commit ni el mapeo de errores cambiaron.
    - "Refrescar todo" con `refreshResolution.status === 'ready'` mantiene la atomicidad ya cubierta
      hoy (fallo del proveedor → no aplica ningún cambio; sin claves numéricas → aviso informativo sin
      llamada al proveedor); mismo criterio de regresión ligera.
- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
- **Restricciones**: no reescribir toda la matriz de tests del panel — la mayoría no dependen del
  desplegable (alta manual, edición de celda, borrado, añadir idioma). Limitarse a la sección "token
  dropdown" y a los tests de "Buscar"/"Refrescar todo" ligados al token.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección "Sección Traducciones",
  bloques "Selección de token para el proveedor externo" y "Proveedor externo integrado (PlataGes)":
  ambos requieren reescritura por retirada del desplegable y por origen del token/URL desde la config
  de endpoints).
- `ai-workflow/docs/app-features/development/local-config.md` (soporte vigente: añadir el fallback
  local `src/dev/endpoints-config.json` y la prioridad atributo-de-host / fichero local /
  no-declarado).
- `ai-workflow/docs/app-features/development/index.md` (revisar el resumen si el cambio de sección
  Traducciones afecta a cuándo leerla).
- `ai-workflow/docs/current-state.md` (última feature relevante de "Desarrollo local").

Las actualizaciones documentales las realiza `update-app-documentation` en una pasada posterior a la
implementación, no en esta tarea.

### Criterios de finalización
El panel Traducciones habilita/deshabilita cada acción de forma independiente según su resolución, sin
desplegable de token ni dependencia de `VITE_PLATAGES_API_BASE_URL`. Todos los criterios de aceptación
funcionales de la spec quedan verificables end-to-end.

### Cierre de implementación
Todos los tests de dev-runtime en verde. `pnpm test` sin regresión y el umbral de cobertura del
proyecto se mantiene.

---

## Orden de ejecución recomendado
1. T1
2. T2
3. T3
4. T4
5. T5
6. T6
7. T7

T3 puede ejecutarse en paralelo con T1/T2 si un segundo agente está disponible; T4 depende de T3; T5
depende de T2+T4; T6 depende de T1+T3+T5; T7 cierra la migración y depende de T3+T6.

## Siguiente tarea a tomar
**T1** — sin dependencias, desbloquea el resto.
