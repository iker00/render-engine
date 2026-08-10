# Plan — 0130 dev-editor-translations-panel

Contrato de ejecución para la feature. Alcance: una nueva sección de nivel superior "Traducciones"
en el editor visual, al mismo nivel que "Shell" (feature `0122`), que gestiona el bloque raíz
`translations` con un panel de formulario dedicado (alta/edición/borrado manuales, gestión de
columnas de idioma, "Buscar y añadir" y "Refrescar todo" contra un proveedor externo).

La fuente única de verdad funcional vive en [[spec.md]] y las decisiones técnicas en [[design.md]].

Todas las tareas comparten estos anclajes técnicos, tomados literalmente de `design.md`:

- **Ubicación**: todo el código nuevo vive bajo `src/dev-runtime/`. Nada toca `src/queries/`,
  `src/config/`, `validateRuntimeConfig` ni el runtime de producción.
- **Sin cambios de contrato de `translations`**: `RuntimeTranslationsConfig` (`Record<string,
  Record<string, string>>`, `src/config/runtime-config-types.ts:851`) sigue igual. La validación
  cruzada vive ya en `src/config/validate-translations.ts` y no se toca.
- **Patrón de sección de dominio a reutilizar**: la misma cadena de wiring que `Shell` (0122):
  - `ToolbarDomain` en `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` pasa de
    `'layout' | 'shell'` a `'layout' | 'shell' | 'translations'`. El botón "Tokens" sigue
    deshabilitado (`disabled`, `aria-disabled="true"`, `title="Próximamente"`); esta feature no
    lo activa.
  - `DevEditorLayer` (`src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`) sustituye el área
    central de canvas por `<TranslationsConfigPanel />` cuando `activeDomain === 'translations'`,
    exactamente igual que hace hoy con `<ShellConfigPanel />` para `activeDomain === 'shell'`.
    Entrar en `translations` limpia la selección de canvas (mismo criterio ya vigente para
    `shell`); salir no tiene nada que reconciliar (el panel se desmonta al cambiar de dominio).
- **Pipeline de commit**: `commitTranslationsMutation(mutate: (translations: RuntimeTranslationsConfig
  | undefined) => RuntimeTranslationsConfig | undefined): CommitCanvasMutationResult` en
  `src/dev-runtime/dev-runtime.tsx`, análogo simétrico de `commitShellMutation` (mismo fichero,
  líneas 359-412 al momento de planificar), usando `patchRootKey(lastValidConfigText,
  'translations', mutatedTranslations)` + `JSON.parse` + `validateRuntimeConfig` + `flushSync` +
  `migrateRuntimeStateAcrossConfig`. A diferencia de `shell`, `translations` no contiene subárboles
  de layout nodes, así que no hace falta `denormalizeFormNodesForSerialization` — se serializa el
  objeto tal cual. El resultado es indistinguible de editar la clave `translations` a mano en
  Monaco y pulsar "Aplicar".
- **Cliente HTTP del proveedor externo (PlataGes)**: nuevo módulo aislado dentro de
  `src/dev-runtime/translations-panel/`, no en `src/queries/` (Decisión D1). Interfaz mínima
  `TranslationsProvider` con dos métodos (`searchTexts`, `getTranslationsBatch`) que consumen los
  tipos ya alineados a lo que el panel necesita (Decisión D2). Una única implementación concreta
  `createPlatagesTranslationsProvider(baseUrl)` importada directamente por el panel; sin registro
  ni selector de proveedor en runtime.
- **`baseUrl` centralizada** (Decisión D4): constante única resuelta desde
  `import.meta.env.VITE_PLATAGES_API_BASE_URL` en el módulo de PlataGes, con valor por defecto
  `'https://pre-frontapi.entidad.es'` (host de pre-producción). Sin nuevo mecanismo genérico de
  configuración de entorno.
- **Autenticación**: header `Authorization: Bearer <valor de tokens.{tokenId}.value>` leído
  directamente del `RuntimeConfig` en memoria, sin interpolación `{{tokens.x.value}}` (esta
  llamada no es una operación `api` declarada). `Content-Type: application/json` en ambas
  operaciones.
- **Detección de claves numéricas** para "Refrescar todo" (Decisión D6): `/^\d+$/` (uno o más
  dígitos, sin signo ni separadores). Cualquier otra clave se excluye del envío.
- **Mapa fijo de códigos de idioma del proveedor** (spec, "Alcance"): `1 → 'es'`, `2 → 'eu'`. Un
  código de idioma numérico devuelto por el proveedor que no esté en el mapa se ignora
  silenciosamente para esa entrada (spec, "Casos límite"); el resto de idiomas mapeados de la
  misma entrada sí se aplican.
- **Idiomas como derivado de los datos** (Decisión D5): la lista de columnas de idioma es la unión
  de claves de idioma presentes en las entradas actuales de `translations`. Un idioma añadido con
  el control "Añadir idioma nuevo" que aún no tiene ningún valor vive como estado local del panel
  hasta que la primera edición de una celda de esa columna lo persista.
- **Atomicidad de "Refrescar todo"** (Decisión D7): se espera la respuesta completa de la
  operación de obtención por lote y solo entonces se construye el objeto `translations` parcheado
  y se invoca `commitTranslationsMutation` una única vez. Sin commits parciales ni rollback.
- **Feedback por rechazo del commit**: mismo patrón vigente en `ShellConfigPanel` /
  `LayoutCanvasPropertiesPanel` — el panel gestiona `pendingRejections` por clave de campo y
  muestra el aviso `role="alert"` con `CommitRejectionBanner`
  (`src/dev-runtime/commit-rejection-banner.tsx`), sin inventar un mecanismo nuevo.
- **Sin coste en el bundle de producción**: el panel y el cliente PlataGes viven en
  `src/dev-runtime/`, ya excluido del bundle de producción salvo activación explícita con
  `data-enable-dev-mode`.

El contrato técnico de PlataGes que consume T1 y usan T4/T5 queda cerrado por [[design.md]] § D3
contra el fichero `openapi-facade 1.json` (raíz del repo). No se genera código tipado desde
OpenAPI; los tipos TS del cliente se declaran a mano en T1 con la forma mínima que necesita el
panel.

Los tests de la fase de implementación deben cumplir además las reglas globales de
`ai-workflow/standards/testing-rules.md` (umbral mínimo global de cobertura del 80% sobre `src/`,
tests centrados en comportamiento observable, sin snapshots amplios ni mocks que oculten el
comportamiento real).

## Orden y dependencias

T1 → T2 → T3 → T4 → T5. Cada tarea deja el árbol de la app compilando y con `pnpm test` en verde
antes de la siguiente.

- T2 depende de T1 solo para el import type de `TranslationsProvider` en la firma del panel
  esqueleto; T2 no llama todavía a ninguna operación del cliente.
- T3 depende de T2 (panel montado con `translations` y `onCommitTranslationsMutation`
  disponibles).
- T4 depende de T1 (cliente PlataGes) y de T3 (estructura del panel, dropdown de token ya
  presente).
- T5 depende de T1 (cliente PlataGes), de T3 (estructura del panel) y de T4 solo por orden
  (ambas usan el mismo dropdown de token y comparten el helper de "sin tokens" — pero T5 podría
  implementarse antes que T4 sin bloqueo; se ordena así para cerrar primero el flujo de alta y
  luego el de refresco masivo).

## Siguiente tarea a escoger

`0130-T1` — todas las demás dependen de ella.

---

## Task 0130-T1 — Cliente HTTP `TranslationsProvider` y implementación PlataGes

- **ID**: 0130-T1
- **Estado**: pending
- **Objetivo**: Crear el módulo aislado que abstrae las dos operaciones de solo lectura del
  proveedor externo, con:
  1. Una interfaz `TranslationsProvider` (Decisión D2) que expone exactamente los dos métodos
     que el panel consume, con tipos de entrada/salida alineados a lo que "Buscar y añadir" y
     "Refrescar todo" necesitan (no a la forma cruda del wire de PlataGes).
  2. Una implementación concreta `createPlatagesTranslationsProvider(options)` que hace las
     llamadas `fetch` a los dos endpoints de PlataGes fijados en `design.md` § D3, con `baseUrl`
     resuelto desde `import.meta.env.VITE_PLATAGES_API_BASE_URL` (default
     `'https://pre-frontapi.entidad.es'`, Decisión D4).
  3. Mapeo de errores (Decisión D3): distinguir `auth` (401/403) del resto (`integration` con
     `message` del payload si viene, o texto de fallback), y tratar fallos de red / parseo de
     JSON como `integration` con mensaje genérico.

  Contrato del módulo:

  - **Ubicación**: `src/dev-runtime/translations-panel/translations-provider.ts` (nuevo).
  - **Tipos exportados**:
    ```
    export interface TranslationsProviderSearchResult {
      idTexto: number
      texto: string
    }
    export interface TranslationsProviderBatchLanguage {
      idioma: number
      texto: string
    }
    export interface TranslationsProviderBatchResult {
      idTexto: number
      traducciones: TranslationsProviderBatchLanguage[]
    }
    export type TranslationsProviderError =
      | { kind: 'auth'; message: string }
      | { kind: 'integration'; message: string }
    export type TranslationsProviderOutcome<T> =
      | { status: 'ok'; data: T }
      | { status: 'error'; error: TranslationsProviderError }
    export interface TranslationsProvider {
      searchTexts(input: { text: string; token: string }): Promise<TranslationsProviderOutcome<TranslationsProviderSearchResult[]>>
      getTranslationsBatch(input: { ids: number[]; token: string }): Promise<TranslationsProviderOutcome<TranslationsProviderBatchResult[]>>
    }
    ```
    Los nombres preservan la ortografía del proveedor (`idTexto`, `traducciones`, `idioma`) para
    reducir traducciones intermedias. El panel es libre de mapearlos a nombres locales cuando le
    convenga.
  - **Función pública** (factory, mismo criterio que `createLucideReactMock` en tests): `export
    function createPlatagesTranslationsProvider(options?: { baseUrl?: string }):
    TranslationsProvider`. Sin `options` (o sin `baseUrl`), lee `import.meta.env.VITE_PLATAGES_API_BASE_URL`;
    si tampoco existe, cae a `'https://pre-frontapi.entidad.es'`.
  - **Endpoints exactos** (design.md § D3, verificados contra `openapi-facade 1.json`):
    - `searchTexts`: `POST {baseUrl}/platages/platages/v1/operations/6C1F94A2-3D57-4B08-9E62-1A70C58D34B1/buscartextos`
      - Headers: `Content-Type: application/json`, `Authorization: Bearer ${token}`.
      - Body: `{ "BuscarTextosEntradaDTO": { "ParteTexto": <text> } }`.
      - Respuesta 200: `{ "BuscarTextosSalidaDTO": { "Textos"?: Array<{ "IdTexto": number,
        "Texto": string }> | null } }`. El módulo mapea a
        `TranslationsProviderSearchResult[]` (`{ idTexto: IdTexto, texto: Texto }`); `Textos`
        ausente o `null` produce `[]` (spec, caso límite "sin resultados").
    - `getTranslationsBatch`: `POST {baseUrl}/platages/platages/v1/operations/0B48D3E7-92AC-4F51-8D06-5E9B27A4C6F3/obtenertextos`
      - Headers: idénticos a `searchTexts`.
      - Body: `{ "ObtenerTextosEntradaDTO": { "IdTextos": <ids> } }`. `ids` se envía tal cual
        (array de enteros; el panel lo construye desde las claves numéricas de `translations`).
      - Respuesta 200: `{ "ObtenerTextosSalidaDTO": { "Textos"?: Array<{ "IdTexto": number,
        "Traducciones": Array<{ "Idioma": number, "Texto": string }> }> | null } }`. El módulo
        mapea a `TranslationsProviderBatchResult[]` (`{ idTexto, traducciones: [{ idioma, texto }]
        }`); `Textos` ausente o `null` produce `[]`.
  - **Mapeo de errores** (Decisión D3):
    - HTTP 401 o 403 → `{ kind: 'auth', message: <mensaje humano fijo>: 'La autenticación con
      el proveedor externo falló. Revisa el token seleccionado.' }`. No se intenta parsear el
      body en este caso (el mensaje del proveedor no aporta al usuario del editor).
    - HTTP `!response.ok` distinto de 401/403 → intentar `await response.json()`. Si el body es
      `{ code, message }` con `message` string no vacía, `{ kind: 'integration', message }`.
      En cualquier otro caso (JSON no parseable, sin `message`, sin body), mensaje de fallback
      `'La llamada al proveedor externo falló (HTTP <status>).'`.
    - Cualquier `throw` del `fetch` (red caída, CORS, etc.) o del `response.json()` en el path
      exitoso → `{ kind: 'integration', message: 'No se pudo contactar con el proveedor externo.' }`.
  - **Sin efectos globales**: el módulo no lee ni escribe estado global fuera de
    `import.meta.env`; cada instancia es puramente una fachada sobre `fetch`.

- **Fuera de alcance**:
  - Cualquier UI o integración con el panel — todo eso es T2/T3/T4/T5.
  - Cualquier lectura de la tercera operación de PlataGes
    (`.../A5D20F63-.../actualizarjsonconfiguracionenplatages`, escritura de configuración): la
    spec la excluye explícitamente y este módulo no la implementa.
  - Cliente genérico configurable ("proveedores de traducción"): la spec lo excluye
    explícitamente para esta entrega (Decisión D2).
  - Reintentos, timeouts explícitos, cancelación por `AbortController`: la spec no los pide y
    este módulo no los introduce.
  - Tipos generados desde `openapi-facade 1.json`: se declaran a mano, tal como fija
    `design.md` § "Riesgos y trade-offs".

- **Dependencias**: ninguna previa dentro de esta feature. Depende únicamente de que
  `openapi-facade 1.json` esté disponible como fuente documental (no se importa en tiempo de
  ejecución) y de las decisiones de `design.md` § D3/D4.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/translations-panel/translations-provider.ts` (nuevo: interfaz, tipos,
      `createPlatagesTranslationsProvider`).
  - Tests:
    - `src/tests/dev-runtime/translations-provider.test.ts` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: añadir la línea del nuevo fichero de test bajo
      `dev-runtime/`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: en la pasada global
      posterior con `update-app-documentation`, se documentará la sección Traducciones completa
      (T3+T4+T5); esta tarea por sí sola no habilita ninguna funcionalidad visible.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/translations-provider.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - `createPlatagesTranslationsProvider()` sin opciones y sin `import.meta.env.VITE_PLATAGES_API_BASE_URL`
      resuelve el host a `'https://pre-frontapi.entidad.es'` — verificable inspeccionando el
      argumento URL del `fetch` mockeado en una llamada de prueba a `searchTexts`.
    - `createPlatagesTranslationsProvider({ baseUrl: 'https://custom.example' })` usa ese
      `baseUrl` en las dos operaciones (una aserción sobre la URL de `fetch` por operación).
    - `searchTexts({ text: 'foo', token: 'abc' })`:
      - Invoca `fetch` con URL exacta terminada en
        `/platages/platages/v1/operations/6C1F94A2-3D57-4B08-9E62-1A70C58D34B1/buscartextos`.
      - Body JSON exacto: `{"BuscarTextosEntradaDTO":{"ParteTexto":"foo"}}`.
      - Headers: `Content-Type: application/json` y `Authorization: Bearer abc`.
      - Respuesta 200 con `{"BuscarTextosSalidaDTO":{"Textos":[{"IdTexto":42,"Texto":"Hola"}]}}`
        produce `{ status: 'ok', data: [{ idTexto: 42, texto: 'Hola' }] }`.
      - Respuesta 200 con `{"BuscarTextosSalidaDTO":{}}` (o `Textos: null`) produce
        `{ status: 'ok', data: [] }`.
    - `getTranslationsBatch({ ids: [1, 2], token: 'abc' })`:
      - URL exacta terminada en `.../0B48D3E7-92AC-4F51-8D06-5E9B27A4C6F3/obtenertextos`.
      - Body JSON exacto: `{"ObtenerTextosEntradaDTO":{"IdTextos":[1,2]}}`.
      - Respuesta 200 con `{"ObtenerTextosSalidaDTO":{"Textos":[{"IdTexto":1,"Traducciones":[{"Idioma":1,"Texto":"Hola"},{"Idioma":2,"Texto":"Kaixo"}]}]}}`
        produce `{ status: 'ok', data: [{ idTexto: 1, traducciones: [{ idioma: 1, texto: 'Hola' },
        { idioma: 2, texto: 'Kaixo' }] }] }`.
      - Respuesta 200 con `{"ObtenerTextosSalidaDTO":{}}` produce `{ status: 'ok', data: [] }`.
    - **Mapeo de errores** (parametrizable con `describe.each` sobre `searchTexts` y
      `getTranslationsBatch` para cubrir los dos métodos con las mismas ramas):
      - HTTP 401 → `{ status: 'error', error: { kind: 'auth', message: /autenticación/i } }`; el
        body de la respuesta no se lee (no se invoca `response.json()` en esta rama —
        verificable por un `json: vi.fn()` que no se llama, o comprobando el mensaje fijo).
      - HTTP 403 → mismo resultado que 401.
      - HTTP 500 con body `{"code":"X","message":"algo fallo"}` → `{ status: 'error', error:
        { kind: 'integration', message: 'algo fallo' } }`.
      - HTTP 500 con body sin `message` (`{"code":"X"}`) → mensaje de fallback
        `'La llamada al proveedor externo falló (HTTP 500).'`.
      - HTTP 500 con body no-JSON (p. ej. `response.json` que lanza) → mismo mensaje de
        fallback.
      - `fetch` que lanza (red caída) → `{ status: 'error', error: { kind: 'integration',
        message: 'No se pudo contactar con el proveedor externo.' } }`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/translations-provider.test.ts`
  - **Restricciones**:
    - Mockear el `fetch` global con `vi.stubGlobal('fetch', ...)` o
      `globalThis.fetch = vi.fn(...)` según el patrón que ya usen otros ficheros de
      `src/tests/dev-runtime/` (p. ej. la suite de `runtime-api-*` en `src/tests/runtime/` puede
      servir de referencia si no hay precedente directo en `dev-runtime/`). Restaurar el mock
      global en `afterEach` para no filtrar entre tests.
    - No importar el módulo real de `runtime-api-request`/`src/queries/`; el cliente de esta
      feature vive aparte por decisión de diseño (Decisión D1).
    - No introducir dependencias nuevas.
    - No cubrir la operación `actualizarjsonconfiguracionenplatages` (fuera de alcance de la
      spec y de esta tarea).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/test-index.md`: nueva línea para
    `translations-provider.test.ts` bajo `dev-runtime/`.

- **Criterios de finalización**:
  - El módulo existe, está tipado y su suite de test está en verde.
  - Ningún consumidor del proyecto lo importa todavía (T4 y T5 lo importarán más tarde).

- **Cierre de implementación**:
  - Fichero nuevo creado, importable desde `src/dev-runtime/translations-panel/translations-provider`.
  - Suite `pnpm test --run src/tests/dev-runtime/translations-provider.test.ts` en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0130-T2 — Wiring del dominio `translations`: toolbar, layer, pipeline y esqueleto de panel

- **ID**: 0130-T2
- **Estado**: pending
- **Objetivo**: Conectar la infraestructura mínima necesaria para que la nueva sección exista y
  reciba mutaciones a nivel de config, sin funcionalidad de edición todavía:
  1. Ampliar `ToolbarDomain` a `'layout' | 'shell' | 'translations'` y añadir el botón
     "Traducciones" en `DevEditorFloatingToolbar`, entre "Tokens" y "Shell", habilitado (mismo
     patrón `aria-pressed`/`buttonClasses` que `Shell`). Elegir un icono Lucide coherente con la
     línea del resto (p. ej. `Languages` o `Globe`).
  2. Ampliar `DevEditorLayer` para que, cuando `activeDomain === 'translations'`, el área
     central renderice `<TranslationsConfigPanel />` en vez del canvas (mismo `if/else` que hoy
     tiene para `shell`). Entrar en `translations` limpia `selectedPath`/`hoveredPath` con la
     misma política que `shell`. La firma del panel esperada es
     `{ translations, tokens, onCommitTranslationsMutation }`.
  3. Añadir `commitTranslationsMutation` en `DevRuntimeReady`
     (`src/dev-runtime/dev-runtime.tsx`) simétrico a `commitShellMutation` (líneas 359-412 al
     momento de planificar): mutar `currentConfig.translations`, `patchRootKey(lastValidConfigText,
     'translations', mutated)`, `JSON.parse` + `validateRuntimeConfig`,
     `migrateRuntimeStateAcrossConfig` si aplica, `flushSync` de los mismos setters.
     Cablearlo como `onCommitTranslationsMutation` en `<DevEditorLayer />`.
  4. Crear `TranslationsConfigPanel` en su forma esqueleto:
     `src/dev-runtime/translations-panel/translations-config-panel.tsx`. Firma pública:
     `{ translations: RuntimeTranslationsConfig | undefined, tokens: RuntimeTokensConfig |
     undefined, onCommitTranslationsMutation: (mutate: (prev: RuntimeTranslationsConfig |
     undefined) => RuntimeTranslationsConfig | undefined) => CommitCanvasMutationResult }`.
     En esta tarea el panel renderiza un contenedor mínimo con `data-testid="translations-config-panel"`,
     un heading visible "Traducciones", un mensaje de estado vacío cuando `translations` es
     `undefined` o `{}`, y una tabla vacía o una tabla con las filas presentes (solo lectura,
     una fila por clave, una columna "Clave" y una por cada idioma de la unión). Sin controles
     de edición ni de proveedor externo — esos se añaden en T3/T4/T5.

  Con esto, cambiar la pestaña "Traducciones" en la barra ya sustituye el canvas por el panel; el
  contrato de commit ya está probado end-to-end (aunque el panel todavía no lo invoque desde ningún
  botón); la wiring completa queda cerrada antes de meter lógica de UI compleja.

- **Fuera de alcance**:
  - Cualquier control de edición manual (alta, edición, borrado, columna de idioma nueva) — T3.
  - Cualquier llamada al `TranslationsProvider` de T1 — T4/T5.
  - Cambios en `src/config/` o en el runtime de producción.
  - Cambios en la ubicación del panel dentro del árbol (`DevEditorLayer` decide dónde va, mismo
    lugar exacto que `ShellConfigPanel`).
  - Tests exhaustivos de la tabla vacía / con filas: en esta tarea la tabla no tiene
    interacción, solo estructura mínima; los tests exhaustivos de render llegan en T3 cuando
    ya haya controles reales que probar.

- **Dependencias**: T1 solo para el import type del provider si se decide dejarlo cableado
  como prop desde ahora — recomendado **no** hacerlo en T2: el provider se inyecta desde T4
  cuando aparecen "Buscar" y "Refrescar todo". T2 no necesita T1 en tiempo de compilación.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` (modificar: extender
      `ToolbarDomain`, añadir el botón "Traducciones" y su `isTranslationsActive` local).
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar: extender la rama del
      dominio activo, importar `TranslationsConfigPanel`, aceptar y reenviar
      `onCommitTranslationsMutation`; extender `handleDomainSelected` para limpiar selección al
      entrar en `translations`).
    - `src/dev-runtime/dev-runtime.tsx` (modificar: `commitTranslationsMutation` nueva, cablearlo
      en la prop del `<DevEditorLayer />`).
    - `src/dev-runtime/translations-panel/translations-config-panel.tsx` (nuevo: esqueleto).
  - Tests:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliar: existencia y estado
      del botón "Traducciones", `aria-pressed` alternando con Layout/Shell).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliar: al pulsar
      "Traducciones", el canvas desaparece del área central y aparece el panel; entrar en
      `translations` desde `layout` con un nodo seleccionado limpia la selección; entrar en
      `translations` desde `shell` no rompe nada; la selección/hover se limpian).
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (nuevo: render del esqueleto —
      `data-testid` presente, mensaje vacío con `translations: undefined` o `{}`, tabla con las
      claves y columnas de idioma correctas cuando `translations` trae contenido).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliar: existencia del wiring end-to-end
      mínimo — al invocar programáticamente `onCommitTranslationsMutation` desde el panel a
      través de un mock del propio panel, o vía un helper existente en el fichero, el config en
      memoria refleja el cambio y el buffer de Monaco queda actualizado; también un caso de
      commit rechazado por `validateRuntimeConfig` mockeada). Reutilizar el patrón ya vigente en
      `dev-runtime.test.tsx` para `commitShellMutation`; si ese fichero no tuviera cobertura
      directa del pipeline shell, hacer la cobertura equivalente aquí para
      `commitTranslationsMutation` sin ampliar el fichero más de lo estrictamente necesario.
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: nuevas líneas para `translations-config-panel.test.tsx`;
      ampliación de las líneas de `dev-editor-floating-toolbar.test.tsx` y
      `dev-editor-layer.test.tsx`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: en `update-app-documentation`,
      mención al nuevo botón "Traducciones" y al hecho de que el área central se sustituye por un
      panel dedicado (mismo patrón que Shell).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (nuevo).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación).
  - **Comportamiento cubierto** (toolbar, ampliación):
    - El botón `data-testid="dev-editor-toolbar-domain-translations"` existe, está habilitado
      (no `disabled`, no `aria-disabled`) y tiene el texto "Traducciones".
    - Con `activeDomain='translations'`, `aria-pressed="true"` en el botón "Traducciones" y
      `aria-pressed="false"` en "Layout" y "Shell"; con `activeDomain='layout'`,
      `aria-pressed="false"` en "Traducciones".
    - Pulsar el botón invoca `onDomainSelected('translations')` con el argumento exacto.
    - Regresión: los botones "Api", "Páginas" y "Tokens" siguen `disabled` con
      `aria-disabled="true"` y `title="Próximamente"`.
  - **Comportamiento cubierto** (layer, ampliación):
    - Con `activeDomain` inicial `'layout'`, el canvas está presente y el panel de traducciones
      no (verificable por la ausencia de `data-testid="translations-config-panel"`); pulsar el
      botón "Traducciones" invierte esos dos hechos (el canvas ya no está y el panel aparece).
    - Volver a "Layout" restaura el canvas y desmonta el panel de traducciones.
    - Cambiar de "Layout" con un nodo seleccionado a "Traducciones" limpia la selección: no se
      renderiza el `FloatingSelectionOverlay` tras el cambio, y volver a "Layout" no lo re-monta
      con selección heredada (mismo criterio que ya cubre para `shell`).
    - Con Monaco abierto (`monacoOpen=true`), pulsar "Traducciones" no afecta al panel de
      Monaco (regresión: los dominios `shell`/`translations` no participan en la exclusión
      mutua con Monaco, que solo aplica al panel de selección del canvas).
  - **Comportamiento cubierto** (panel, nuevo):
    - Con `translations: undefined`, se renderiza `data-testid="translations-config-panel"` y un
      mensaje visible (texto explícito, p. ej. "Sin traducciones definidas"); no aparece ninguna
      fila de tabla.
    - Con `translations: {}`, mismo resultado.
    - Con `translations: { hola: { es: 'Hola', eu: 'Kaixo' } }`, aparece una tabla con una fila
      por clave (`hola`) y las columnas `es` y `eu` en el orden estable definido por el
      implementador (aserción por `getAllByRole('row')` y presencia de los textos "Hola" y
      "Kaixo").
    - Con `translations: { a: { es: 'A' }, b: { eu: 'B' } }`, la unión de idiomas produce dos
      columnas (`es` y `eu`); una celda vacía es representable (aserción por conteo de columnas
      en el `thead` y ausencia de "A" en la fila de `b`).
    - `onCommitTranslationsMutation` recibida como prop no se invoca en el render inicial
      (regresión: T2 no dispara mutaciones).
  - **Comportamiento cubierto** (dev-runtime.test.tsx, ampliación mínima):
    - `commitTranslationsMutation` aplicada con un mutador que devuelve `{ hola: { es: 'Hola' } }`
      sobre un config que no declaraba `translations` actualiza `currentConfig.translations` en
      memoria y añade la clave `translations` al buffer de Monaco (aserción sobre el nuevo
      valor tras `JSON.parse` del buffer emitido a `onEditorChange` o vía la superficie que ya
      use el fichero para inspeccionar `editorBuffer`).
    - `commitTranslationsMutation` que introduce un valor inválido (p. ej. `{ hola: { es: 42 as
      any } }`, número en lugar de string) devuelve `{ status: 'rejected', error: ... }` con el
      código del validador y **no** modifica `currentConfig` ni el buffer.
    - Regresión: el commit exitoso desde este pipeline no toca ninguna otra clave raíz (`layout`,
      `api`, `initialPage`, `tokens`, `shell`, `preloads`) — aserción análoga a las ya presentes
      para `commitShellMutation`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
  - **Restricciones**:
    - Reutilizar los harness y fixtures ya vigentes en cada fichero; el patrón de wiring y de
      commit end-to-end lo fija `ShellConfigPanel` en los mismos ficheros, no se introduce uno
      paralelo.
    - No mockear `TranslationsConfigPanel` en el fichero del layer: el panel real es un
      esqueleto minúsculo y montarlo es más barato que mockearlo. En `dev-runtime.test.tsx`, si
      hace falta simular una invocación de `onCommitTranslationsMutation` sin toda la UI real,
      se acepta obtener la prop pasada al panel vía `vi.mock` **puntual** de
      `../../dev-runtime/translations-panel/translations-config-panel` que capture las props;
      mismo patrón que ya use el fichero si lo tiene para `ShellConfigPanel`; si no lo tiene,
      exponer la superficie por otro medio ya vigente (p. ej. un ref/handle ya presente).
    - No introducir aún el dropdown de tokens ni ningún botón de "Buscar" / "Refrescar todo"
      dentro del panel — esos elementos son de T3/T4/T5 y confundirían la lectura de esta
      tarea si aparecen antes.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nuevo botón "Traducciones"
    en la barra flotante y sustitución del área central por un panel dedicado con la misma UX
    que Shell.
  - `ai-workflow/docs/test-index.md`: entradas nuevas/ampliadas para los cuatro ficheros
    tocados.

- **Criterios de finalización**:
  - Pulsar "Traducciones" en la barra sustituye el canvas por el panel esqueleto en el editor
    real (verificable manualmente en `pnpm dev` y por los tests del layer).
  - `commitTranslationsMutation` está cableado extremo a extremo (pipeline validado en tests) y
    listo para ser invocado desde T3/T4/T5.

- **Cierre de implementación**:
  - Los cuatro ficheros de test afectados en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0130-T3 — Edición manual: tabla, alta/edición/borrado, columna de idioma, dropdown de token

- **ID**: 0130-T3
- **Estado**: pending
- **Objetivo**: Convertir el esqueleto del panel (T2) en un editor manual completo del bloque
  `translations`, cubriendo los criterios de aceptación 1–5, 8 y 15/16 de la spec (todo lo que
  no depende del proveedor externo):
  1. **Tabla de entradas**: una fila por cada clave de `translations`, una columna "Clave"
     seguida de una columna por cada código de idioma presente en la unión de todas las
     entradas. Cada celda de idioma es un input de texto editable enlazado al valor actual; una
     entrada sin ese idioma muestra el input vacío.
  2. **Alta manual**: formulario "Añadir entrada" con un input "Clave" (string) y, junto a él, un
     input por cada idioma conocido en ese momento; botón "Añadir". Validación local previa a
     commit: clave vacía o duplicada de una existente se rechaza con mensaje inline
     (`role="alert"`) sin invocar `onCommitTranslationsMutation`. Cualquier idioma puede quedar
     vacío; los idiomas vacíos no se incluyen en el nuevo objeto (el valor commiteado es
     `{ [key]: {} }` si todos los idiomas quedan vacíos, o `{ [key]: { es: '...' } }` según
     corresponda).
  3. **Edición de celda**: `onBlur` (o botón "Guardar" por fila; el implementador elige uno
     estable, sin mezclar) commitea el cambio de esa celda con
     `commitTranslationsMutation((prev) => ({ ...(prev ?? {}), [key]: { ...(prev?.[key] ?? {}), [lang]: value } }))`.
     Un valor vacío en una celda que sí tenía valor elimina la clave de idioma de esa entrada
     (`{ [key]: { ...rest } }` sin `[lang]`) — mismo criterio de que "vacío no se persiste".
  4. **Borrado de entrada**: botón "Borrar" por fila que commitea la eliminación de esa clave del
     objeto `translations`. Sin confirmación modal (mismo criterio que "Eliminar nodo" en el
     canvas). La última entrada eliminada deja `translations: {}` (spec, caso límite "borrar la
     última entrada"), sin eliminar la clave raíz.
  5. **Añadir idioma nuevo**: control a nivel de panel con un input "Código de idioma" y botón
     "Añadir idioma"; añade una columna nueva vacía. Esa columna vive como estado local del
     panel hasta que la primera edición de una celda la persista (Decisión D5). Un código
     duplicado (ya presente en la unión actual o ya presente como columna local pendiente) se
     rechaza con mensaje inline sin ampliar la lista.
  6. **Dropdown de token**: campo `<select>` con una opción por cada clave de `tokens.*` del
     config actual. El valor elegido se mantiene como estado local del panel (no commiteado a
     `translations`) para uso posterior de T4/T5. Si `tokens` es `undefined` o `{}`, el
     dropdown no se renderiza y en su lugar aparece el mensaje explícito exigido por la spec
     (spec, FR16 y criterio de aceptación "sin ningún `tokens.*`"), con un enlace/texto que
     explique que hace falta declarar un token primero. En esta tarea, los botones "Buscar" y
     "Refrescar todo" **no existen aún**; el dropdown se cablea listo para T4/T5.

  Reglas transversales de esta tarea:
  - Todo cambio commiteado pasa exclusivamente por `onCommitTranslationsMutation`. Un commit
    rechazado (`status: 'rejected'`) se traduce en el patrón vigente
    `CommitRejectionBanner` con `role="alert"` por campo, mismo criterio que `ShellConfigPanel`.
    El panel gestiona `pendingRejections` con las claves `'add'`, `'add-language'`, y por celda
    editada (clave compuesta `edit:${entryKey}:${lang}`) y por fila borrada
    (`delete:${entryKey}`). El estado se limpia al cambiar el campo objetivo o al recibir un
    commit exitoso posterior sobre el mismo campo.
  - La accesibilidad de la tabla (roles `table`/`row`/`cell`, labels de inputs) sigue el
    criterio general del proyecto y de `ShellConfigPanel`: cada input tiene un label accesible
    (`aria-label` derivado de la clave y del idioma, p. ej. "Traducción de <clave> en <idioma>").
  - La única superficie de edición cubierta por esta tarea es manual; nada de T3 llama a
    `TranslationsProvider`.

- **Fuera de alcance**:
  - Cualquier llamada al `TranslationsProvider` (Buscar / Refrescar todo) — T4/T5.
  - Renombrar la clave de una entrada existente (spec, "Fuera de alcance").
  - Validación cruzada de referencias `{{translations.clave}}` antes de borrar (spec, "Fuera
    de alcance").
  - Ampliar el mapa fijo de códigos de idioma del proveedor — sigue en T5.
  - Persistencia en disco o mecanismo de guardado adicional; el pipeline de commit ya cubre lo
    exigido por la spec.
  - Añadir un botón de "Cancelar edición" por celda: `onBlur`/`Guardar` es suficiente para el
    flujo actual y la restauración se hace escribiendo el valor original.

- **Dependencias**: T2 (`TranslationsConfigPanel` esqueleto, wiring del pipeline de commit).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/translations-panel/translations-config-panel.tsx` (modificar: convertir
      el esqueleto en el editor manual completo; añadir estado local para "idiomas pendientes",
      "token elegido" y `pendingRejections`; añadir controles de alta/edición/borrado; formulario
      de idioma nuevo; dropdown de token).
    - Opcional: extraer helpers puros a `src/dev-runtime/translations-panel/translations-panel-helpers.ts`
      si el componente supera un tamaño razonable (p. ej. detección de idiomas de la unión, gestión
      de columnas pendientes). Esta extracción es válida solo si genuinamente reduce complejidad;
      no forzarla.
  - Tests:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliar sustancialmente: la
      mayor parte de los casos nuevos viven aquí, aislados del pipeline real vía
      `vi.fn()` para `onCommitTranslationsMutation`).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (opcional/mínimo: un caso end-to-end sobre
      el pipeline real que confirma que alta manual + edición de celda + borrado dejan el config
      en el estado esperado y no tocan otras claves — bastan 1 o 2 aserciones, no repetir toda
      la matriz cubierta arriba).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de la línea de
      `translations-config-panel.test.tsx`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: en la pasada global,
      documentar la sección Traducciones (tabla, alta manual, edición, borrado, columna de
      idioma, dropdown de token).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación mínima end-to-end).
  - **Comportamiento cubierto** (aislado, `translations-config-panel.test.tsx`):
    - **Alta manual**:
      - Rellenar la clave `hola` y `es` con `'Hola'`, sin tocar el resto de idiomas, y pulsar
        "Añadir" invoca `onCommitTranslationsMutation` una única vez con un mutator cuya
        aplicación sobre `undefined` produce `{ hola: { es: 'Hola' } }` (verificable llamando
        al mutator capturado).
      - Rellenar la clave con `''` y pulsar "Añadir" **no** invoca
        `onCommitTranslationsMutation` y muestra un `role="alert"` con mensaje explícito de
        clave vacía.
      - Pulsar "Añadir" con una clave que ya existe (`hola` cuando `translations` ya trae `hola`)
        **no** invoca `onCommitTranslationsMutation` y muestra un `role="alert"` con mensaje
        explícito de clave duplicada.
    - **Edición de celda**:
      - En una tabla con `translations: { hola: { es: 'Hola' } }`, editar la celda `es` a
        `'Hola!'` y hacer `blur` (o pulsar "Guardar" si el implementador eligió esa vía) invoca
        `onCommitTranslationsMutation` una única vez; el mutator aplicado sobre `{ hola: { es:
        'Hola' } }` devuelve `{ hola: { es: 'Hola!' } }`.
      - Editar una celda vacía (`eu` en la fila `hola`) a `'Kaixo'` y confirmar produce
        `{ hola: { es: 'Hola', eu: 'Kaixo' } }`.
      - Vaciar una celda existente (`es` en `{ hola: { es: 'Hola' } }`) y confirmar elimina la
        clave `es` de esa entrada; el mutator aplicado devuelve `{ hola: {} }`.
      - Cambiar la celda al mismo valor previo (no cambio) no invoca
        `onCommitTranslationsMutation` (regresión de idempotencia).
    - **Borrado de entrada**:
      - Pulsar "Borrar" en la fila `hola` (con `translations: { hola: { es: 'Hola' }, adios: {
        es: 'Adiós' } }`) invoca `onCommitTranslationsMutation`; el mutator produce
        `{ adios: { es: 'Adiós' } }`.
      - Borrar la última entrada deja `{}` (no `undefined`) — el mutator devuelve `{}`.
    - **Añadir idioma nuevo**:
      - Añadir `fr` cuando la unión actual era `['es']` renderiza una columna nueva `fr` con
        input vacío en todas las filas existentes; **no** invoca
        `onCommitTranslationsMutation` (Decisión D5: la columna vive local hasta la primera
        edición).
      - Rellenar la celda `fr` de una fila e ir commit sí invoca
        `onCommitTranslationsMutation`; a partir de ese momento, "eliminar" la columna `fr`
        pendiente local ya no aplica porque `translations` ya la contiene.
      - Intentar añadir un idioma duplicado (ya presente en la unión o ya en la lista pendiente
        local) muestra un `role="alert"` de código duplicado y no amplía la lista.
    - **Dropdown de token**:
      - Con `tokens: { primary: { value: 'abc' }, secondary: { value: 'xyz' } }`, el `<select>`
        renderiza dos opciones (`primary`, `secondary`), la primera seleccionada por defecto.
      - Cambiar la selección actualiza el estado local (verificable indirectamente por futuras
        interacciones — o directamente por `data-testid` con `value` reflejado en el DOM);
        `onCommitTranslationsMutation` **no** se invoca (el token no se persiste en `translations`).
      - Con `tokens: undefined` o `tokens: {}`, el dropdown no está en el DOM y en su lugar
        aparece un mensaje visible cuya cadena incluye referencia explícita a que hace falta
        declarar un token en la sección Tokens (aserción por `screen.getByText(/token/i)` +
        `queryByRole('combobox')` devolviendo `null`).
      - Regresión: los botones "Buscar" y "Refrescar todo" **no** existen aún en el DOM
        (`queryByRole('button', { name: /Buscar|Refrescar/i })` devuelve `null` en cualquier
        estado de esta tarea).
    - **Feedback de commit rechazado**:
      - Cuando `onCommitTranslationsMutation` devuelve `{ status: 'rejected', error }`, el aviso
        `role="alert"` aparece junto al control que lo disparó (fila editada, alta, columna
        añadida) con el `error.code`/`error.message`. Un commit exitoso posterior sobre el mismo
        control limpia el aviso.
      - Mismo tratamiento en `add`, `edit:<key>:<lang>` y `delete:<key>`; independencia por
        clave (un aviso en la fila `hola` no oculta un aviso en la fila `adios`).
  - **Comportamiento cubierto** (end-to-end, `dev-runtime.test.tsx`):
    - Alta manual de una clave con dos idiomas (`es`, `eu`) desde el panel real recorre el
      pipeline; tras el commit, `currentConfig.translations` refleja la nueva entrada y el
      buffer de Monaco contiene `"translations": { "hola": { "es": "Hola", "eu": "Kaixo" } }`;
      `layout`/`api`/`initialPage`/`tokens`/`shell`/`preloads` intactos (aserción análoga a las
      ya vigentes para `commitShellMutation`).
    - Un commit inválido simulado (mockear `validateRuntimeConfig` para rechazar por una vez o
      forzar el input a un valor no válido) muestra el aviso `role="alert"` en el control
      correspondiente sin tocar `currentConfig` ni el buffer.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
  - **Restricciones**:
    - No introducir `TranslationsProvider` ni el módulo PlataGes en esta tarea: T3 debe
      compilarse y correr sus tests sin importarlos (regresión de encapsulación).
    - Reutilizar `CommitRejectionBanner` para todo aviso `role="alert"`; no inventar un
      componente de aviso propio.
    - El componente puede usar `useState` para el token elegido y para la lista de idiomas
      pendientes; no hace falta reducer.
    - La aserción sobre `dev-runtime.test.tsx` debe reutilizar el mecanismo ya usado por los
      tests de `commitShellMutation` para inspeccionar `currentConfig` y `editorBuffer`; no
      duplicar helpers.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección Traducciones —
    tabla, alta manual, edición de celdas, borrado, columna de idioma nueva como estado local
    hasta primera edición, dropdown de tokens, mensaje explicativo cuando no hay tokens.
  - `ai-workflow/docs/test-index.md`: ampliación de la línea de
    `translations-config-panel.test.tsx`.

- **Criterios de finalización**:
  - Cubiertos los criterios de aceptación 1–5, 8 y 15/16 de la spec (todos los que no dependen
    del proveedor externo).
  - Todo commit al `translations` root pasa por `onCommitTranslationsMutation` (una sola vía).

- **Cierre de implementación**:
  - `translations-config-panel.test.tsx` en verde con la ampliación.
  - `dev-runtime.test.tsx` en verde con la ampliación mínima.
  - `pnpm test` completo en verde y cobertura ≥ 80 %.

---

## Task 0130-T4 — Acción "Buscar y añadir" contra el proveedor externo

- **ID**: 0130-T4
- **Estado**: pending
- **Objetivo**: Añadir al `TranslationsConfigPanel` la superficie de búsqueda y alta por lote
  contra `TranslationsProvider.searchTexts`, cubriendo criterios de aceptación 6, 7 y
  parcialmente 9–11 de la spec:
  1. Input de búsqueda + botón "Buscar" en la barra superior del panel (junto al dropdown de
     token de T3). El botón queda deshabilitado (`disabled`) cuando el dropdown de token está
     ausente o vacío (spec, FR16), o mientras una llamada previa a `searchTexts` sigue en curso.
  2. Al pulsar "Buscar" con texto no vacío, se invoca `provider.searchTexts({ text, token })`
     con el valor del input y el token seleccionado. Durante la espera se muestra un indicador
     de carga (texto o icono; no bloqueante del resto del panel).
  3. La respuesta exitosa muestra la lista de resultados. Cada resultado es una fila con:
     - checkbox de selección,
     - identificador (`idTexto`, convertido a string para display),
     - texto devuelto por el proveedor (idioma por defecto del proveedor).
     Un resultado cuyo `String(idTexto)` ya existe como clave en el `translations` actual se
     muestra marcado como "ya existe" (etiqueta visible y `disabled` en su checkbox), no
     seleccionable.
  4. Botón "Añadir seleccionados" debajo de la lista. Al pulsarlo:
     - Si no hay ningún resultado seleccionado, no hace nada (idempotencia; también podría
       quedar `disabled`; el implementador elige uno estable).
     - Si hay resultados seleccionados, invoca `onCommitTranslationsMutation` **una sola vez**
       con un mutator que añade todas las entradas seleccionadas a la vez. Cada entrada nueva
       tiene clave `String(idTexto)` y el idioma por defecto del proveedor
       poblado con el `texto` devuelto (idioma por defecto: la spec fija que las claves
       creadas quedan con el idioma por defecto del proveedor únicamente; los demás idiomas
       quedan vacíos — no se persisten claves de idioma con string vacío). Elegir qué código
       de idioma de la app corresponde al "idioma por defecto del proveedor" se fija a `'es'`
       (mismo criterio que la tabla fija `1 → 'es'`, `2 → 'eu'` — el idioma por defecto
       corresponde al valor 1 según el contrato de PlataGes; ver Decisión D3 e implicaciones).
     - Tras un commit exitoso, la lista de resultados y las selecciones se limpian; el input de
       búsqueda se conserva (así el usuario puede corregirlo si necesita, sin tener que
       reescribir).
  5. Errores del proveedor (`kind: 'auth'` o `kind: 'integration'`) muestran un mensaje visible
     en el panel — junto al botón "Buscar" — con el `message` correspondiente. El error se
     limpia al reintentar con éxito o al cambiar el texto de búsqueda.
  6. Caso "sin resultados": una respuesta con `data: []` muestra un estado explícito
     ("Sin resultados") en lugar de la lista; no error, no bloqueo del input.

  El `TranslationsProvider` se inyecta como prop opcional del panel
  (`provider?: TranslationsProvider`) con default a
  `createPlatagesTranslationsProvider()` resuelto en `DevEditorLayer` (o directamente en
  `DevRuntimeReady`, según encaje mejor). En tests, la inyección permite pasar un mock que no
  toca `fetch`. La prop se añade al contrato del panel en esta tarea; T3 no la necesitaba.

- **Fuera de alcance**:
  - Paginación de resultados o control de volumen adicional (spec, "Fuera de alcance").
  - Persistir la selección entre búsquedas.
  - Autocomplete o búsqueda incremental mientras se teclea; la acción es explícita al pulsar
    "Buscar".
  - Cambiar el mapa fijo de idiomas o convertir el "idioma por defecto del proveedor" en un
    campo configurable — se fija a `'es'` en código.
  - Cambios en `TranslationsProvider` (T1) o en su implementación PlataGes.
  - "Refrescar todo" — T5.

- **Dependencias**: T1 (`TranslationsProvider`), T3 (estructura del panel y dropdown de token).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/translations-panel/translations-config-panel.tsx` (modificar: añadir
      input de búsqueda, botón, lista de resultados con checkboxes, botón "Añadir
      seleccionados", estado local de carga/error/resultados/selección; inyección de
      `provider`).
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar: pasar `provider` al
      `<TranslationsConfigPanel />`; el default `createPlatagesTranslationsProvider()` puede
      vivir aquí o subir a `DevRuntimeReady` — el implementador elige uno estable). Si el layer
      hoy no importa nada de `translations-panel/`, se acepta añadir el default aquí para
      evitar un tercer archivo de wiring.
    - Nada más.
  - Tests:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliar: los nuevos casos
      viven aquí, con un `TranslationsProvider` mockeado inyectado por prop).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de la línea de
      `translations-config-panel.test.tsx`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: en la pasada global,
      documentar "Buscar y añadir" (input, resultados, checkbox, "ya existe", commit por lote,
      manejo de errores).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - **Precondición de token**: con `tokens: undefined` o `{}`, el botón "Buscar" está
      `disabled`; el mensaje de "sin tokens" ya cubierto en T3 sigue visible.
    - **Búsqueda con éxito**:
      - Provider mock cuyo `searchTexts` devuelve
        `{ status: 'ok', data: [{ idTexto: 42, texto: 'Hola' }, { idTexto: 43, texto: 'Adiós' }] }`
        para un input `'ho'`. Tras pulsar "Buscar", aparecen dos filas de resultado con los
        textos y los ids visibles y checkboxes desmarcados.
      - Provider mock invocado con `{ text: 'ho', token: 'abc' }` (el token elegido del
        dropdown) — aserción sobre el argumento del `vi.fn()`.
    - **Estado de carga**: mientras la promesa está pendiente, un indicador visible (texto
      "Buscando..." o similar, verificable por `getByText` o `getByRole('status')`) aparece; el
      botón "Buscar" queda `disabled` durante ese lapso (regresión: la spec exige no bloquear
      el resto del panel, pero sí evitar disparar dos búsquedas simultáneas).
    - **Sin resultados**: provider mock devuelve `data: []`; el panel muestra "Sin resultados"
      (aserción por `getByText`) y no muestra ninguna fila; no aparece error `role="alert"`.
    - **"Ya existe"**: con `translations: { '42': { es: 'Hola' } }` y un resultado
      `{ idTexto: 42, texto: 'Hola' }`, la fila del `42` renderiza una etiqueta "ya existe"
      (verificable por texto) y su checkbox está `disabled`; marcar por click no cambia el
      estado.
    - **Añadir seleccionados**:
      - Marcar el checkbox de `43` y pulsar "Añadir seleccionados" invoca
        `onCommitTranslationsMutation` una única vez con un mutator que, aplicado a
        `{ '42': { es: 'Hola' } }`, produce `{ '42': { es: 'Hola' }, '43': { es: 'Adiós' } }`.
      - Marcar dos checkboxes en una sola búsqueda (`43` y `44`) y pulsar añade ambas en un
        único commit; el mutator aplicado añade las dos claves.
      - Después de un commit exitoso, la lista de resultados y las selecciones se limpian
        (`queryAllByRole('checkbox')` sin las filas previas); el input de búsqueda conserva su
        texto.
      - Pulsar "Añadir seleccionados" sin selección no invoca `onCommitTranslationsMutation`.
    - **Errores del proveedor**:
      - `{ status: 'error', error: { kind: 'auth', message: 'La autenticación...' } }` produce
        un `role="alert"` visible con esa cadena junto al botón "Buscar"; no cambia
        `translations`.
      - `{ status: 'error', error: { kind: 'integration', message: 'algo' } }` produce
        `role="alert"` con esa cadena.
      - Después de un error, teclear un texto nuevo en el input de búsqueda limpia el aviso.
      - Después de un error, una segunda búsqueda con éxito también limpia el aviso.
    - **Rechazo de commit**: si `onCommitTranslationsMutation` devuelve `{ status: 'rejected',
      error }` al pulsar "Añadir seleccionados", aparece el `role="alert"`
      (`CommitRejectionBanner`) junto al botón, análogo al del alta manual de T3, y las
      selecciones **no** se limpian (el usuario ve qué intentó añadir).
    - **Regresión T3**: alta manual, edición de celda, borrado, añadir idioma nuevo, dropdown
      de token siguen funcionando exactamente igual que en T3.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx` (regresión de wiring
      del layer; solo si el layer se toca).
  - **Restricciones**:
    - Mockear `TranslationsProvider` como un objeto plano con `vi.fn()` en cada método
      (`{ searchTexts: vi.fn().mockResolvedValue(...), getTranslationsBatch: vi.fn() }`);
      inyectarlo por la prop `provider` del panel. No mockear el módulo entero de
      `translations-provider.ts` (esa cobertura vive en T1).
    - El estado de carga y los cierres asíncronos deben respetar el patrón vigente de tests
      asíncronos en `src/tests/dev-runtime/` (uso de `await` sobre `findBy*` o
      `waitFor`); no introducir un patrón nuevo.
    - No introducir dependencias nuevas.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección Traducciones —
    "Buscar y añadir" (input, botón, lista de resultados con checkboxes, "ya existe", commit
    por lote, manejo de errores, estado "sin resultados").
  - `ai-workflow/docs/test-index.md`: ampliación de la línea de
    `translations-config-panel.test.tsx`.

- **Criterios de finalización**:
  - Cubiertos los criterios de aceptación 6, 7 y 10–11 de la spec, más las NFR relacionadas con
    estado de carga y manejo de errores para esta acción.
  - "Buscar" queda deshabilitado en ausencia de tokens (FR16 para esta acción).

- **Cierre de implementación**:
  - `translations-config-panel.test.tsx` en verde con la ampliación de T4.
  - `pnpm test` completo en verde y cobertura ≥ 80 %.

---

## Task 0130-T5 — Acción "Refrescar todo" (batch atómico contra el proveedor)

- **ID**: 0130-T5
- **Estado**: pending
- **Objetivo**: Añadir al `TranslationsConfigPanel` la acción "Refrescar todo" contra
  `TranslationsProvider.getTranslationsBatch`, cubriendo criterios de aceptación 12–14 y
  restantes NFR de la spec:
  1. Botón "Refrescar todo" en la barra superior del panel (junto al botón "Buscar" de T4).
     `disabled` cuando:
     - no hay tokens declarados en el config (mismo criterio que "Buscar"), o
     - una llamada previa a `getTranslationsBatch` sigue en curso (spec, caso límite doble clic).
  2. Al pulsar, el panel:
     - Recopila las claves de `translations` que casan con `/^\d+$/` (Decisión D6).
     - Si no hay ninguna clave numérica, no invoca al provider ni al pipeline de commit (spec,
       caso límite "sin ninguna clave numérica"); opcionalmente muestra un aviso "Sin claves
       refrescables" (no error).
     - En caso contrario, invoca `provider.getTranslationsBatch({ ids: <claves como
       enteros>, token })` con el token elegido en el dropdown.
     - Espera la respuesta completa **antes** de mutar (Decisión D7, atomicidad).
  3. Al recibir una respuesta exitosa, construye el objeto `translations` parcheado:
     - Por cada `IdTexto` devuelto, encuentra la entrada correspondiente en `translations`
       (clave = `String(idTexto)`).
     - Para cada `Traducciones[i]`:
       - Si `Idioma` está en el mapa fijo `{ 1: 'es', 2: 'eu' }`, sobrescribe la clave de
         idioma de esa entrada con el texto devuelto.
       - Si `Idioma` no está en el mapa, se ignora silenciosamente (spec, caso límite "código
         de idioma no mapeado"); las demás traducciones mapeadas de la misma entrada sí se
         aplican.
     - Las entradas cuyo `IdTexto` fue enviado pero no aparece en la respuesta se dejan
       intactas (spec, criterio de aceptación "identificador no devuelto").
     - Las claves no numéricas de `translations` (creadas a mano) se dejan intactas por
       construcción — nunca se enviaron.
     - Se emite **un único** `onCommitTranslationsMutation(mutator)` con el objeto parcheado
       completo.
  4. Errores del proveedor (`kind: 'auth'` o `kind: 'integration'`) muestran un mensaje visible
     junto al botón "Refrescar todo" — mismo tratamiento que en T4 —, **no** se invoca ningún
     commit y `translations` queda intacto (spec, NFR de atomicidad y de fallo de red/auth).
  5. Un rechazo del commit por `validateRuntimeConfig` muestra el aviso `role="alert"` con
     `CommitRejectionBanner`; misma política del resto del panel.

  Notas de implementación:
  - El mapa fijo de idiomas vive como constante privada del módulo del panel
    (`PROVIDER_LANGUAGE_MAP: Record<number, string> = { 1: 'es', 2: 'eu' }`), con un comentario
    breve explicando que ampliarlo es cambio de código y no configuración (Decisión D5 / spec,
    riesgos). Nada de esto se hace configurable en esta feature.
  - La detección de claves numéricas se implementa con `/^\d+$/`, expuesta como helper puro
    interno testable (p. ej. `isNumericTranslationKey(key: string): boolean`).

- **Fuera de alcance**:
  - Batching manual del envío en varios lotes (spec: asume un único envío).
  - Configurar el mapa fijo de idiomas.
  - Cambiar la política de fallback ante idioma no mapeado.
  - "Buscar y añadir" — T4.
  - Cambios en `TranslationsProvider` (T1) o en su implementación PlataGes.

- **Dependencias**: T1 (`TranslationsProvider`), T3 (estructura del panel), T4 (dropdown de
  token y disciplina de `disabled` compartida con "Buscar").

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/translations-panel/translations-config-panel.tsx` (modificar: añadir
      botón "Refrescar todo", constante `PROVIDER_LANGUAGE_MAP`, helper puro
      `isNumericTranslationKey`, estado local de carga/error propios de la acción, ensamblaje
      atómico del objeto parcheado y commit único).
  - Tests:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliar: los casos nuevos
      viven aquí, con `TranslationsProvider` mockeado inyectado por prop).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de la línea de
      `translations-config-panel.test.tsx`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: en la pasada global,
      documentar "Refrescar todo" (recopilación de claves numéricas, mapeo fijo de idiomas,
      commit único, manejo de errores, comportamiento con claves manuales, caso "sin claves
      refrescables", doble clic protegido).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/translations-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - **Precondición de token**: con `tokens: undefined` o `{}`, el botón "Refrescar todo"
      está `disabled` (mismo criterio que "Buscar").
    - **Sin claves numéricas**:
      - Con `translations: { hola: { es: 'Hola' } }` (clave manual, no numérica), pulsar
        "Refrescar todo" no invoca `provider.getTranslationsBatch` (aserción por
        `provider.getTranslationsBatch` sin llamadas) ni `onCommitTranslationsMutation`.
      - Con `translations` sin clave numérica, el panel puede mostrar un aviso informativo
        ("Sin claves refrescables") — verificable por texto — pero no un `role="alert"`.
    - **Refresco exitoso**:
      - Con `translations: { '42': { es: 'Hola', eu: '' }, '43': { es: 'Adiós' }, manual: { es:
        'Manual' } }` y `provider.getTranslationsBatch` devolviendo
        `{ status: 'ok', data: [{ idTexto: 42, traducciones: [{ idioma: 1, texto: 'Hola!' },
        { idioma: 2, texto: 'Kaixo' }] }] }`, pulsar "Refrescar todo":
        - Invoca `getTranslationsBatch` con `{ ids: [42, 43], token: <token elegido> }` (enteros,
          `manual` excluida — spec, criterio de aceptación 14).
        - Invoca `onCommitTranslationsMutation` **exactamente una vez** con un mutator que,
          aplicado a la entrada, produce
          `{ '42': { es: 'Hola!', eu: 'Kaixo' }, '43': { es: 'Adiós' }, manual: { es: 'Manual' } }`:
          `42` actualizado con las dos claves mapeadas; `43` intacto porque el proveedor no lo
          devolvió (criterio de aceptación 13); `manual` intacto porque nunca se envió (criterio
          14).
      - Regresión de commit único: `onCommitTranslationsMutation.mock.calls.length === 1`.
    - **Código de idioma no mapeado**:
      - Provider devuelve `{ idTexto: 42, traducciones: [{ idioma: 1, texto: 'Hola!' }, { idioma:
        99, texto: 'foo' }] }`. El mutator aplicado produce `{ '42': { es: 'Hola!', eu: '' } }`
        (mantiene `eu` como estaba, ignora `idioma: 99` silenciosamente); no se crea ninguna clave
        `'99'` ni ninguna clave desconocida en la entrada.
    - **Atomicidad ante fallo del provider**:
      - `provider.getTranslationsBatch` devuelve `{ status: 'error', error: { kind: 'auth',
        message: '...' } }`. Aparece un `role="alert"` visible junto al botón "Refrescar todo"
        con el `message`; `onCommitTranslationsMutation` **no** se invoca (aserción por
        `.mock.calls.length === 0`); `translations` queda intacto.
      - Mismo resultado para `kind: 'integration'`.
    - **Rechazo de commit por validación**:
      - `onCommitTranslationsMutation` devuelve `{ status: 'rejected', error }`. Aparece el
        `CommitRejectionBanner` con `role="alert"` junto al botón "Refrescar todo". Un commit
        posterior exitoso o un cambio de token elegido limpia el aviso.
    - **Estado de carga y doble clic**:
      - Mientras la promesa de `getTranslationsBatch` está pendiente, el botón "Refrescar todo"
        está `disabled` y aparece un indicador de carga visible; un segundo clic durante ese
        lapso no dispara una segunda llamada (aserción por `getTranslationsBatch.mock.calls.length
        === 1`).
    - **Helper puro `isNumericTranslationKey`** (test aislado dentro del mismo fichero):
      - `'0'`, `'1'`, `'42'` → `true`.
      - `''`, `'abc'`, `'12abc'`, `' 42'`, `'-1'`, `'1.5'` → `false`.
    - **Regresión T3/T4**: alta manual, edición, borrado, columna nueva, dropdown de token,
      Buscar-y-añadir siguen funcionando exactamente como quedaron.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/translations-config-panel.test.tsx`
  - **Restricciones**:
    - Mockear `TranslationsProvider` como en T4 (objeto con `vi.fn()`), inyectado por prop.
    - El helper `isNumericTranslationKey` puede vivir como export nombrado del propio panel o
      como módulo separado en `src/dev-runtime/translations-panel/`; en cualquier caso, debe ser
      importable por el test para probar su comportamiento aislado.
    - No mockear `getTranslationsBatch` con una promesa que nunca resuelve: el ciclo asíncrono
      de los tests debe seguir el patrón vigente (`await waitFor`/`findBy`) y ninguno debe
      quedar colgado.
    - No introducir dependencias nuevas.
    - No introducir batching manual, cancelación por `AbortController` ni reintentos.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección Traducciones —
    "Refrescar todo" (recopilación de claves numéricas, mapa fijo `1 → es`, `2 → eu`, commit
    único, comportamiento con claves manuales, "sin claves refrescables", doble clic protegido,
    manejo de errores).
  - `ai-workflow/docs/test-index.md`: ampliación de la línea de
    `translations-config-panel.test.tsx`.

- **Criterios de finalización**:
  - Cubiertos los criterios de aceptación 12–14 y las NFR restantes de la spec (atomicidad,
    estado de carga, manejo de errores) para esta acción.
  - Todos los criterios de aceptación de la spec (1–16) quedan cubiertos entre T3 (1–5, 8,
    15–16), T4 (6–7, 10–11) y T5 (12–14), más los transversales (9, restantes NFR) cubiertos
    en T4 y T5.

- **Cierre de implementación**:
  - `translations-config-panel.test.tsx` en verde con la ampliación completa (T3+T4+T5).
  - `pnpm test` completo en verde y cobertura ≥ 80 %.
