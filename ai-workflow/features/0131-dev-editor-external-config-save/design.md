# Design: Feature 0131 - dev-editor-external-config-save

## Contexto

Hoy el editor de desarrollo (`DevRuntime`) no tiene ninguna vía de persistencia real: "Aplicar" solo actualiza
`currentConfig` en memoria de sesión, y la única integración con un backend externo es la sección Traducciones
(`0130`), que llama a dos operaciones de PlataGes (`buscartextos`, `obtenertextos`) contra un host y unos paths
**hardcodeados** en `src/dev-runtime/translations-panel/translations-provider.ts`
(`DEFAULT_BASE_URL = 'https://pre-frontapi.pamplona.es'`, sobreescribible solo por `VITE_PLATAGES_API_BASE_URL`), con
el token elegido manualmente desde un desplegable en `TranslationsConfigPanel`.

Esta feature añade una tercera operación de PlataGes — `ActualizarJSONConfiguracionEnPlataGes` — para guardar el
config activo, y generaliza el origen de URL/path/token de las tres operaciones (guardar + las dos de Traducciones)
a un nuevo bloque de config declarado en runtime, con el mismo patrón atributo-de-host + fallback local que ya usa
`data-config` (`readRuntimeConfig` en `src/app/bootstrap/read-runtime-config.ts`) y `data-values`
(`readRuntimeDataValues` en `src/app/bootstrap/read-runtime-data-values.ts`).

El contrato real de la operación de guardado (aportado por el usuario, `openapi-facade 1.json`) es:

- `POST /platages/platages/v1/operations/A5D20F63-7E14-48CB-B39A-C86F015D7E24/actualizarjsonconfiguracionenplatages`
- Request: `{ "ActualizarJsonConfiguracionEntradaDTO": { "IdGestion": integer, "IdSeccion": integer, "IdObjetoOcurrencia": integer, "Json": string } }`
- Response 200: `{ "ActualizarJsonConfiguracionSalidaDTO": { "Resultado": boolean } }`
- Errores (400/401/403/404/500): `{ "code": string, "message": string }` — mismo shape `ErrorResponse` que ya
  mapea `translations-provider.ts` para las otras dos operaciones.
- La descripción de la operación documenta la regla de negocio "solo si el `IdObjetoOcurrencia` de la ocurrencia es
  267", que la spec ya marca como fuera de alcance validar en el front (FR de "Fuera de alcance").

`IdGestion`/`IdSeccion`/`IdObjetoOcurrencia` son **enteros** en el contrato real, no strings.

## Objetivos / No objetivos

### Objetivos
- Declarar un bloque de config de endpoints externos (URL base + path/`tokenId` por operación + IDs de negocio de
  guardado), con el mismo patrón de prioridad atributo-de-host → fichero local → no declarado que `data-config`.
- Añadir el botón "Guardar" + atajo Ctrl+S/Cmd+S en la barra flotante, que serializa `currentConfig` y lo envía a la
  operación de guardado configurada.
- Migrar las dos operaciones de Traducciones para que resuelvan URL/path/token desde ese mismo bloque de config, en
  vez del host hardcodeado + `VITE_PLATAGES_API_BASE_URL` + desplegable manual de token.
- Retirar el desplegable de selección de token de la sección Traducciones.

### No objetivos
- No se define un mapeo de campos genérico ni soporte multi-backend; el shape de los tres payloads sigue codificado
  tal cual el contrato de PlataGes.
- No se implementa la regla de negocio "`IdObjetoOcurrencia` debe ser 267" en el front.
- No hay UI de edición de la config de endpoints; se declara solo por atributo o fichero local.
- No se trocea el trabajo en tareas (eso pertenece a `generate-implementation-plan`).

## Decisiones

### D1 — Shape de la config de endpoints
Nombre de atributo de host: `data-endpoints-config` (ya sugerido en la spec). Fallback local versionado:
`src/dev/endpoints-config.json`, mismo criterio que `src/dev/config.json`/`src/dev/data-values.json`.

Shape propuesto:

```json
{
  "baseUrl": "https://pre-frontapi.example.com",
  "operations": {
    "searchTexts": { "path": "/platages/.../buscartextos", "tokenId": "sessionToken" },
    "getTranslationsBatch": { "path": "/platages/.../obtenertextos", "tokenId": "sessionToken" },
    "saveConfig": {
      "path": "/platages/.../actualizarjsonconfiguracionenplatages",
      "tokenId": "sessionToken",
      "idGestion": 123,
      "idSeccion": 55,
      "idObjetoOcurrencia": 267
    }
  }
}
```

`operations.*` son todas opcionales de forma independiente (FR2). `idGestion`/`idSeccion`/`idObjetoOcurrencia` se
tipan como enteros, alineados con el contrato real (`ActualizarJsonConfiguracionEntradaDTO`), no como strings.

Trade-off aceptado: el nombre de cada operación (`searchTexts`, `getTranslationsBatch`, `saveConfig`) es una
convención propia del editor, no un identificador de PlataGes — evita atar el shape de la config a los GUIDs de
operación de PlataGes, que ya viven dentro de `path`.

### D2 — Ubicación del nuevo módulo de config de endpoints
`src/dev-runtime/endpoints-config/` (no `src/config/`). `architecture.md` reserva `src/config/` al contrato del
runtime config que se valida y se renderiza; la config de endpoints nunca llega al intérprete del runtime — es
exclusiva de tooling de desarrollo, igual que `translations-panel/`. Alternativa descartada: colocarlo junto al
resto de esquemas Zod en `src/config/` — se descarta por mezclar una frontera de arquitectura (contrato renderizable)
con una de tooling (solo editor).

Contenido del módulo:
- `runtime-endpoints-config-schema.ts`: schema `Zod` + `parseRuntimeEndpointsConfig(raw: unknown): RuntimeEndpointsConfig | undefined`.
  A diferencia de `validateRuntimeConfig`, no devuelve un resultado `ready | error` — FR3 exige que un JSON
  sintáctica o estructuralmente inválido se trate exactamente igual que ausente, sin bloquear el arranque ni superficie
  de error propia; `undefined` ya representa ambos casos sin necesidad de un tercer estado.
- `resolve-endpoint-operation.ts`: helper puro `resolveEndpointOperation(endpointsConfig, operationKey, tokens)` que
  devuelve `{ status: 'ready', url, token }` o `{ status: 'unavailable', reason: 'operation-not-declared' | 'token-not-resolvable' }`.
  Único punto de resolución compartido por Guardar y las dos acciones de Traducciones (evita reimplementar la
  búsqueda de `tokenId` en `tokens.*` tres veces).
- `save-config-provider.ts`: cliente HTTP de la operación de guardado (ver D4).

### D3 — Lectura en bootstrap
Nueva función `readRuntimeEndpointsConfig` en `src/app/bootstrap/read-runtime-endpoints-config.ts`, mismo patrón que
`readRuntimeDataValues`: prioriza `rootElement.dataset.endpointsConfig`; si no existe, usa el JSON importado de
`src/dev/endpoints-config.json` en desarrollo; si ninguno resuelve o no pasa `parseRuntimeEndpointsConfig`, devuelve
`undefined`. Se invoca una sola vez en `DevRuntime` (mismo momento que `readRuntimeConfig`/`readRuntimeDataValues`),
no es reactivo a HMR — coherente con que la config de endpoints no forma parte del documento que edita Monaco/el
canvas.

### D4 — Cliente HTTP de guardado y reutilización con Traducciones
Se extrae un helper HTTP compartido (`src/dev-runtime/platages-http-client.ts`) con la lógica ya existente en
`translations-provider.ts` (`postToPlatages`: `fetch` POST + `Authorization: Bearer`, mapeo 401/403 → mensaje de
autenticación fijo, resto de fallos HTTP → `message` del cuerpo o mensaje genérico con el código, fallo de red →
mensaje genérico), parametrizado por `url` en vez de construir `baseUrl + path` internamente. `translations-provider.ts`
pasa a consumir este helper y **deja de tener `DEFAULT_BASE_URL`/paths hardcodeados ni leer `VITE_PLATAGES_API_BASE_URL`**:
`createPlatagesTranslationsProvider` pasa a requerir `baseUrl` y los paths de sus dos operaciones como opciones
(resueltos desde la config de endpoints antes de construir la instancia), ya que FR10 retira explícitamente esa
dependencia.

`save-config-provider.ts` expone `createPlatagesSaveConfigProvider(): SaveConfigProvider` con:

```ts
interface SaveConfigProvider {
  save(input: {
    url: string
    token: string
    idGestion: number
    idSeccion: number
    idObjetoOcurrencia: number
    configJson: string
  }): Promise<{ status: 'ok' } | { status: 'error'; error: { kind: 'auth' | 'integration'; message: string } }>
}
```

Payload enviado: `{ ActualizarJsonConfiguracionEntradaDTO: { IdGestion, IdSeccion, IdObjetoOcurrencia, Json: configJson } }`.
Éxito = `response.ok && body.ActualizarJsonConfiguracionSalidaDTO?.Resultado === true`; cualquier otro caso
(incluida una respuesta 200 con `Resultado: false`, que el contrato deja abierta como resultado válido de un rechazo
de negocio) se trata como error, reutilizando el mismo mapeo de mensajes que las otras dos operaciones.

### D5 — Serialización de `currentConfig` en Guardar
**Corrección post-implementación (detectada al probar Guardar contra `preloads` reales):** la decisión original de
este documento — serializar `JSON.stringify(currentConfig)` — era errónea y se ha revertido en el código. Guardar
serializa `JSON.parse(lastValidConfigText)` reserializado minificado (`JSON.stringify(JSON.parse(lastValidConfigText))`),
no `currentConfig` directamente.

Motivo: `currentConfig` es la representación **normalizada** en memoria, que diverge del shape crudo del documento
para `preloads` — el validador normaliza `{ "opName": {...}, when? }` (crudo) a `{ operationName, requestParams, when? }`
(normalizado) — y para `form.onSuccess`/`onError`. Enviar la forma normalizada produce un documento que ya **no es
válido** como entrada de `validateRuntimeConfig` si se recarga después (por ejemplo, si el mismo backend lo sirve de
vuelta vía `data-config`), contradiciendo la premisa "el config activo ya aplicado y válido" que exige la spec: válido
significa válido como documento reintroducible, no solo como estructura en memoria del runtime.

`lastValidConfigText` es, por invariante ya documentado en `dev-runtime.tsx`, el texto crudo que produce `currentConfig`
exactamente al parsear+validar — es decir, siempre está sincronizado con el config activo aplicado. Parsearlo y
reminificarlo preserva el shape crudo de `preloads`/`onSuccess`/`onError` sin reintroducir la divergencia que el
pipeline de commit del canvas/Monaco ya evita por el mismo motivo (parcheo sobre texto crudo, nunca reserialización de
`currentConfig`). No hay trade-off nuevo: es el mismo criterio ya vigente en el resto del editor, que esta decisión
original pasó por alto.

### D6 — Alcance del atajo Ctrl+S/Cmd+S
Listener global en `document` (`keydown`), activo mientras `DevRuntimeReady` está montado — mismo patrón ya usado
hoy para `Esc` (cierre de Monaco) en `dev-runtime.tsx`. No se acota a que un panel concreto tenga el foco: no hay
precedente de atajos scoped a foco en este editor, y FR4 ya establece que "Guardar" es visible con independencia del
dominio/modo activo, por lo que tampoco tendría sentido condicionar el atajo a un panel concreto.

### D7 — Resolución de disponibilidad por operación (Guardar y Traducciones)
`DevEditorLayer` calcula, a partir de `config.tokens` (reactivo, cambia con cada Aplicar) y la config de endpoints
(estática, leída una vez en bootstrap), el resultado de `resolveEndpointOperation` para las 3 operaciones, y lo
pasa hacia abajo:
- a `DevEditorFloatingToolbar`, para habilitar/deshabilitar "Guardar" con su mensaje de causa (FR5);
- a `TranslationsConfigPanel`, reemplazando su prop `tokens` + estado interno `selectedToken`/desplegable por dos
  resultados de resolución independientes (uno por acción), consumidos igual que hoy consume `selectedTokenValue`
  para habilitar/deshabilitar "Buscar"/"Refrescar todo" (FR11).

El proveedor de Traducciones deja de crearse una única vez a nivel de módulo (`translationsProvider` en
`dev-editor-layer.tsx` hoy) y pasa a construirse vía `useMemo` a partir de la `baseUrl`/paths resueltos de la config
de endpoints, recreándose solo si esos valores cambian (en la práctica, nunca durante una sesión, ya que la config de
endpoints no es reactiva — ver D3).

### D8 — Feedback de Guardar
Mismo patrón visual que ya usan "Buscar y añadir"/"Refrescar todo" en `TranslationsConfigPanel`: un indicador
`role="status"` mientras la petición está en curso, un mensaje de confirmación `role="status"` tras éxito, y un
aviso `role="alert"` tras error — como texto/`<span>` inline junto al botón "Guardar" en la barra flotante, no
reutilizando `CommitRejectionBanner` (ese componente está tipado específicamente para `RuntimeConfigError` de
rechazos de validación local, no para errores de red/HTTP de un proveedor externo). El estado de guardado
(`idle | loading | success | error`) vive en `DevRuntimeReady`, igual que el resto del estado de sesión del editor.

## Riesgos y trade-offs

- **Cambio disruptivo sobre UI ya entregada (`0130`)**: retirar el desplegable de token de Traducciones invalida los
  tests existentes que lo ejercitan; deberán reescribirse en la fase de implementación, no es responsabilidad de
  este design.
- **Superficie ampliada**: la feature toca bootstrap (`src/app/bootstrap/`), `dev-runtime.tsx`, la barra flotante y
  el panel de Traducciones a la vez — coherente con `risk_level: high` ya fijado en `status.yaml`.
- **Duplicación potencial entre `save-config-provider.ts` y `translations-provider.ts`**: mitigado extrayendo el
  helper HTTP compartido (D4) en vez de repetir `fetch`/mapeo de errores en dos módulos.
- **Regla de negocio "`IdObjetoOcurrencia` = 267" no verificada en front**: un desarrollador que configure otro
  valor solo lo descubrirá vía el mensaje de error que devuelva PlataGes al guardar — comportamiento explícitamente
  aceptado por la spec ("Fuera de alcance").
- **El host real de PlataGes usado hoy en código (`pre-frontapi.pamplona.es`) no coincide con el dominio de ejemplo
  del OpenAPI aportado (`frontapi.entidad.es`, genérico)**: irrelevante para esta feature, ya que `baseUrl` pasa a
  declararse en la config de endpoints por instalación en vez de hardcodearse.

## Migración o despliegue

No hay migración de datos ni de contrato persistido: `currentConfig` sigue viviendo solo en memoria de sesión, y la
config de endpoints es un bloque nuevo, aditivo, sin precedente que migrar. No se requiere flag de despliegue; el
cambio es exclusivo de `DevRuntime` (dev/`data-enable-dev-mode`), sin impacto en el bundle de producción fuera de
ese modo.

## Preguntas abiertas

Ninguna bloqueante. El texto exacto del mensaje de confirmación de "Guardar" (ver spec, "Riesgos o preguntas
abiertas") queda como detalle de UI a resolver en implementación, siguiendo el patrón visual ya fijado en D8.
