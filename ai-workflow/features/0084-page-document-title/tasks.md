# Tareas de implementación — Feature 0084

> Contrato de ejecución secuencial. Ejecutar tareas en orden. No reabrir alcance ni rediseñar durante la implementación.

## Resumen del alcance técnico

La feature `0084` añade una propiedad opcional `title: string` al modelo de página del JSON de configuración y un efecto runtime que actualiza `document.title` cuando se activa una página, con el formato `"{page.title} | {título inicial}"` cuando la página declara `title` no vacío y restauración al título inicial cuando no lo declara (o es `""`).

El cambio se reparte en dos puntos del código:

- **Capa de configuración (T1)**: ampliar el shape Zod de página en `runtime-config-zod.ts` y `runtime-config-root-zod.ts`, propagar el nuevo campo en `RuntimePageConfig` y en `validate-runtime-config.ts`, y añadir el branch de error correspondiente. El campo es opcional, debe ser string, y un string vacío `""` se acepta como ausencia funcional (no se rechaza en validación: la semántica de "restaura al título inicial" se aplica en runtime).
- **Capa runtime (T2)**: introducir un módulo dedicado `runtime-document-title.ts` con un hook `useRuntimeDocumentTitleEffect()` que captura una sola vez `document.title` al montar (vía lazy `useRef`) y aplica el formato declarado al cambio de página activa. El hook se invoca desde `RuntimeStateProvider` para mantenerse activo durante toda la vida del runtime.

Decisiones técnicas vinculantes:

- **D1** Punto único de declaración: `title` se añade tanto al `runtimePageShellSchema` de `runtime-config-zod.ts` (usado por la validación previa al render) como al `runtimePageRootSchema` de `runtime-config-root-zod.ts` (usado por el JSON schema del editor dev). Ambos esquemas mantienen `.strip()` para descartar claves no soportadas. El campo se declara como `z.string().optional()` (acepta `""`).
- **D2** Propagación del tipo: el campo se añade como `title?: string` en la interfaz `RuntimePageConfig` de `runtime-config-types.ts`. En `validate-runtime-config.ts`, el `pageShellResults.push(...)` y la construcción de `pageConfig` propagan `title` cuando esté presente y no añaden la clave cuando esté ausente (paridad con `preloads`).
- **D3** Mapeo de error: en `validate-runtime-config.ts` se añade un branch que detecta `pagePath === 'title'` y devuelve `invalidLayout('The page at "pages[<i>].title" must be a string.')`. Mantener el orden del switch coherente con los actuales (`id` → `preloads` → `layout` → nuevo `title` adicional).
- **D4** Semántica de string vacío en runtime: la validación acepta `""`. El runtime trata `""` exactamente igual que la ausencia de `title`: restaura `document.title` al título inicial sin componer `" | <inicial>"`.
- **D5** Captura del título inicial: se hace en `useRuntimeDocumentTitleEffect()` con `useRef<string | null>(null)` inicializado de forma perezosa en el primer render. El valor capturado es `document.title` tal cual (sin trim, sin normalización). No se reinicia ni durante navegación ni cuando `document.title` cambie externamente.
- **D6** Cuándo se invoca el efecto: el hook reacciona al cambio del id de la página activa (`state.pageEntry.pageId`) usando un `useEffect`. La página activa se resuelve con la misma lógica que `selectCurrentPage(config, state)` ya existente. Si no hay página activa (`page === null`), se restaura al título inicial.
- **D7** Política de escritura en montaje inicial: el efecto se ejecuta también en el primer mount; si la página inicial no declara `title`, el efecto escribe el título inicial (que es igual al valor actual de `document.title`), por lo que el efecto observable es el mismo que "no escribir nada" mencionado en el caso límite de la spec. No se introduce un guard especial para el primer render.
- **D8** Acoplamiento al árbol de render: el hook no expone valor y solo escribe `document.title` desde un `useEffect`. Se invoca desde un sub-componente interno `RuntimeDocumentTitleEffect` que se renderiza dentro del `<RuntimeStateContext.Provider>` del `RuntimeStateProvider`, en paralelo a `{children}`. Esto garantiza que `useRuntimeCurrentPage()` y `useRuntimeConfig()` (que leen el contexto vía `useContext(RuntimeStateContext)`) tengan el valor disponible. El sub-componente devuelve `null`, no añade nodos al DOM y vive durante toda la vida del runtime.
- **D9** Sin tocar el mecanismo de sincronización con el hash, ni el reducer, ni el contrato de `pageEntry`. La introducción del efecto es aditiva y no altera el flujo de navegación ni de preloads.
- **D10** Multi-instancia: queda fuera de alcance (la v1 ya restringe a una instancia por documento). Cada instancia que se monte captura su propio título inicial; el comportamiento al coexistir varias instancias no se valida y no se añade lógica defensiva.
- **D11** Sin abrir interpolación `{{...}}`: el contrato es string literal. La validación Zod no inspecciona el contenido; la implementación runtime tampoco resuelve referencias.

Notas:

- El JSON schema del editor dev se regenera automáticamente desde `runtimeConfigRootSchema`; la actualización del schema en consumidores dev no requiere tarea aparte. Los tests existentes en `dev-runtime/dev-runtime-json-schema.test.ts` deberían seguir verdes; si la suite snapshotea el schema, esa actualización vive dentro de T1.

---

## T1 — Soporte de `title` opcional en el modelo de página (Zod + tipos + validación)

- **ID**: T1
- **Estado**: completed
- **Objetivo**: Añadir el campo opcional `title: string` al shape de página en ambos esquemas Zod (shell y root), propagarlo en el tipo `RuntimePageConfig` y en el flujo de `validate-runtime-config.ts`, y mapear el error específico cuando `title` no sea string. La validación debe aceptar páginas sin `title`, páginas con `title` no vacío y páginas con `title: ""` sin emitir errores ni advertencias, y rechazar valores no string (por ejemplo, `title: 42`).
- **Fuera de alcance**:
  - Cualquier escritura sobre `document.title` (vive en T2).
  - Validación cruzada o checks adicionales sobre la longitud o el contenido de `title`.
  - Interpolación o resolución de referencias en `title`.
  - Cambios en `runtime-config-validation-errors.ts` (se reutiliza `invalidLayout`).
  - Cambios sobre el resto del shape de página (`id`, `preloads`, `layout`).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/runtime-config-zod.ts` (modificar): extender `runtimePageShellSchema` añadiendo `title: z.string().optional()` antes de `.strip()`.
    - `src/config/runtime-config-root-zod.ts` (modificar): extender `runtimePageRootSchema` añadiendo `title: z.string().optional()` antes de `.strip()`.
    - `src/config/runtime-config-types.ts` (modificar): añadir `title?: string` a `interface RuntimePageConfig`.
    - `src/config/validate-runtime-config.ts` (modificar):
      - ampliar la lista intermedia `pageShellResults` para incluir `title?: string`.
      - propagar `title` desde `pageShellResult.data.title` cuando esté presente (no añadir la clave cuando sea `undefined`, paridad con `preloads`).
      - propagar `title` desde `pageShell.title` al objeto `RuntimePageConfig` final cuando esté presente.
      - añadir el branch de mapeo de error: si `pagePath === 'title'` devolver `invalidLayout('The page at "pages[<index>].title" must be a string.')`.
  - tests:
    - `src/tests/config-validation/runtime-config-validation-page-title.test.ts` (nuevo).
  - documentación: ninguna en esta tarea (la actualización vive en `update-app-documentation` posterior).
- **Cambios concretos**:
  - El orden de checks dentro de `runtimePageShellSchema` no es relevante para Zod, pero declarar `title` junto al resto de propiedades opcionales (`preloads`) mejora la legibilidad.
  - En `validate-runtime-config.ts`, mantener el orden de checks de `pagePath`: `id` → `preloads` → `layout` → `title`. Si `title` no es string, Zod produce un issue con `path[0] === 'title'`; al ser un campo opcional, una entrada sin `title` no produce issue.
  - No exportar nada nuevo desde los módulos de config; el campo se accede vía el tipo `RuntimePageConfig`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-page-title.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Página sin `title` produce un `RuntimePageConfig` sin la clave `title` (`Object.hasOwn(page, 'title') === false`) y `validateRuntimeConfig` devuelve `status: 'ready'`.
    - Página con `title: "Alta de usuario"` produce un `RuntimePageConfig` con `title === "Alta de usuario"` y `validateRuntimeConfig` devuelve `status: 'ready'`.
    - Página con `title: ""` produce un `RuntimePageConfig` con `title === ""` y `validateRuntimeConfig` devuelve `status: 'ready'` (no se trata como error; la semántica de restauración se aplica en runtime).
    - Página con `title: 42` produce `status: 'error'` con `code: 'invalid-layout'` y `message` que cita la ruta `pages[<index>].title`.
    - Página con `title: null` produce `status: 'error'` con `code: 'invalid-layout'` y mismo mensaje.
    - Página con `title: ["x"]` produce `status: 'error'` con `code: 'invalid-layout'` y mismo mensaje.
    - El error de `title` no enmascara errores previos: una página con `id` no válido y `title` también no válido falla con el mensaje de `id` (orden actual del check).
    - Páginas con varias claves opcionales combinadas (`title` + `preloads`) se aceptan y propagan ambas correctamente.
    - Una clave extra no soportada en la página (por ejemplo, `description`) sigue siendo descartada silenciosamente por `.strip()` sin afectar a la aceptación de `title`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-page-title.test.ts`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime-json-schema.test.ts` (verificar que el JSON schema sigue verde tras el cambio en `runtime-config-root-zod.ts`; si snapshotea, regenerar el snapshot dentro de esta tarea).
  - **Restricciones**:
    - Reusar el patrón de fixtures de `src/tests/config-validation/helpers.ts` para construir configs mínimas; no introducir un harness nuevo.
    - No mockear `runtimeConfigShellSchema` ni `runtimePageShellSchema`; los tests deben ejercitar `validateRuntimeConfig` real.
    - No introducir snapshots nuevos para los mensajes de error; afirmar con coincidencia textual o `toContain`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md` (la actualizará `update-app-documentation`): añadir `title` como campo opcional del modelo de página; retirar la afirmación de que la página "ya no depende de `title`" o reformularla para reflejar el nuevo soporte.
  - `ai-workflow/docs/app-features/navigation/page-model.md` (la actualizará `update-app-documentation`): mencionar `title` como propiedad opcional de la página y enlazar al comportamiento runtime introducido en T2.
- **Criterios de finalización**: los esquemas Zod aceptan y propagan `title`, el tipo `RuntimePageConfig` lo refleja, el flujo de `validate-runtime-config.ts` lo conserva en la salida, el mapeo de error específico funciona, y los tests del nuevo fichero pasan en verde.
- **Cierre de implementación**: código modificado, todos los tests del nuevo fichero verdes, `pnpm test` global cumple el umbral del 80% y no hay regresiones en otros ficheros de test.

---

## T2 — Efecto runtime sobre `document.title` al cambio de página

- **ID**: T2
- **Estado**: completed
- **Objetivo**: Implementar el efecto runtime que captura `document.title` una vez al montar y lo actualiza al cambio de página activa según el contrato: página con `title` no vacío → `"{page.title} | {título inicial}"`; página sin `title` o con `title === ""` → título inicial. El efecto se aplica también al primer mount.
- **Fuera de alcance**:
  - Cambios en la validación Zod o en `RuntimePageConfig` (viven en T1).
  - Interpolación o resolución de referencias en `title`.
  - Modificación del separador `|` o del formato.
  - Lógica defensiva para múltiples instancias del runtime en el mismo documento.
  - Persistencia o restauración de título al recargar.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-document-title.tsx` (nuevo):
      - exporta el sub-componente `RuntimeDocumentTitleEffect` (sin props) que devuelve `null`.
      - dentro del sub-componente:
        - captura el título inicial con un `useRef<string | null>(null)` cuyo valor se inicializa de forma perezosa en el primer render (patrón `if (ref.current === null) ref.current = document.title`).
        - usa `useRuntimeCurrentPage()` para resolver la página activa.
        - declara un `useEffect` cuyas dependencias son exactamente `[page?.id, page?.title]` (ambas primitivas) y aplica la regla:
          - si `page` es `null` o no declara `title` o `title === ""` → `document.title = initialTitle`.
          - si `page.title` es string no vacío → `document.title = ` `${page.title} | ${initialTitle}`.
      - opcionalmente exporta también el hook interno `useRuntimeDocumentTitleEffect()` que aplica la misma lógica, si la implementación prefiere separar hook y componente; en ese caso el componente se limita a invocar el hook y devolver `null`. No exportar ambas vías al exterior si genera confusión: basta con el componente.
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar):
      - importar `RuntimeDocumentTitleEffect` desde `../runtime-document-title`.
      - renderizarlo dentro del `<RuntimeStateContext.Provider value={contextValue}>` en paralelo a `{children}`, por ejemplo:

        ```
        return (
          <RuntimeStateContext.Provider value={contextValue}>
            <RuntimeDocumentTitleEffect />
            {children}
          </RuntimeStateContext.Provider>
        )
        ```

      - no invocar el hook directamente en el cuerpo de `RuntimeStateProvider`; el contexto aún no está disponible en ese punto.
      - el sub-componente devuelve `null` y no añade nodos al DOM.
  - tests:
    - `src/tests/runtime/runtime-page-document-title.test.tsx` (nuevo).
  - documentación: ninguna en esta tarea (la actualización vive en `update-app-documentation` posterior).
- **Cambios concretos**:
  - El sub-componente no debe leer `document.title` en cada render: solo una vez en la inicialización perezosa del ref.
  - El sub-componente no debe escribir `document.title` durante el render; solo desde el cuerpo del `useEffect`.
  - El `useEffect` no debe declarar función de cleanup que restaure el título inicial al desmontar; la spec no exige cleanup y un cleanup restauraría el título al desmontar el runtime, lo cual no es comportamiento descrito.
  - La selección de página activa debe usar el hook existente `useRuntimeCurrentPage()` para no duplicar la lógica de `selectCurrentPage`. La lista de dependencias del `useEffect` es exactamente `[page?.id, page?.title]`.
  - El módulo `runtime-document-title.tsx` no introduce barrel exports nuevos; se importa directamente desde `runtime-state-provider.tsx`.
  - El sub-componente devuelve `null` y se renderiza dentro del `<RuntimeStateContext.Provider>` para tener acceso al contexto.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-page-document-title.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Al montar el runtime con `document.title === "Mi App"` y página inicial sin `title`, `document.title` sigue siendo `"Mi App"` tras el montaje.
    - Al montar con `document.title === "Mi App"` y página inicial con `title: "Inicio"`, `document.title` pasa a `"Inicio | Mi App"` tras el montaje.
    - Al navegar desde una página con `title: "Inicio"` a una página con `title: "Alta de usuario"`, `document.title` pasa a `"Alta de usuario | Mi App"`.
    - Al navegar desde una página con `title: "Alta de usuario"` a una página sin `title`, `document.title` vuelve a `"Mi App"`.
    - Al navegar desde una página con `title: "Alta de usuario"` a una página con `title: ""`, `document.title` vuelve a `"Mi App"` (string vacío equivale a ausencia).
    - El título inicial se captura una sola vez: si el runtime monta con `"Mi App"`, navega a una página con `title: "X"` (que sobrescribe `document.title` a `"X | Mi App"`) y luego navega a una página sin `title`, `document.title` vuelve a `"Mi App"`, no a `"X | Mi App"`.
    - Si el código de test modifica externamente `document.title` después del mount, el siguiente cambio de página sigue componiendo el formato sobre el título inicial original capturado, no sobre el valor manipulado externamente.
    - Si `document.title` es `""` al montar el runtime (caso límite de la spec), una página con `title: "Alta de usuario"` produce `document.title === "Alta de usuario | "` y una página sin `title` produce `document.title === ""`.
    - Navegación en cualquier orden entre tres páginas (con title, sin title, con otro title) deja `document.title` en el valor esperado tras cada transición.
    - El efecto no añade renders adicionales observables al árbol (afirmar usando un contador de renders dentro de un componente fixture que cuenta sus propios renders).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-page-document-title.test.tsx`
    - `pnpm test --run src/tests/runtime-state/runtime-state-navigation.test.tsx` (sanity check: la navegación no se rompe por el efecto añadido al provider).
  - **Restricciones**:
    - Reusar el patrón de `RuntimeStateProvider` + `RuntimePage` ya establecido en `runtime-state-navigation.test.tsx` para construir el harness. El sub-componente `RuntimeDocumentTitleEffect` se monta automáticamente dentro del `RuntimeStateProvider`, por lo que los tests no necesitan montarlo a mano; basta con renderizar `<RuntimeStateProvider config={...}><NavigationControls /></RuntimeStateProvider>` y observar `document.title`. Copiar el patrón si la duplicación es menor de ~50 líneas, o extraer un helper local si supera ese umbral.
    - Antes de cada test, fijar `document.title` al valor que el test necesita como "título inicial" (por defecto algo como `"Mi App"`); restaurar `document.title` en `afterEach` para evitar fugas entre tests.
    - Restaurar el `window.history` con el patrón ya usado en `runtime-state-navigation.test.tsx` (`window.history.replaceState(null, '', window.location.pathname + window.location.search)`).
    - No mockear `useRuntimeCurrentPage` ni `useRuntimeConfig`; los tests deben ejercitar el flujo real.
    - No introducir snapshots.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/navigation/page-model.md` (la actualizará `update-app-documentation`): describir el efecto sobre `document.title` al cambio de página.
  - `ai-workflow/docs/app-features/config/structure.md` (la actualizará `update-app-documentation`): la referencia a `title` añadida en T1 puede enlazar aquí; revisar coherencia.
- **Criterios de finalización**: el hook captura el título inicial una sola vez, aplica el formato correcto en cada transición de página (incluyendo el primer mount), restaura el título inicial cuando la página no declara `title` o lo declara como `""`, y los tests del nuevo fichero pasan en verde sin regresiones en `runtime-state-navigation.test.tsx`.
- **Cierre de implementación**: código modificado, todos los tests del nuevo fichero verdes, `pnpm test` global cumple el umbral del 80% y no hay regresiones en otros ficheros de test.

---

## Orden de ejecución

1. T1 — extender el shape Zod, el tipo y el flujo de validación para aceptar y propagar `title`.
2. T2 — implementar el efecto runtime sobre `document.title` consumiendo el nuevo campo.

Tras cerrar ambas tareas, la feature queda lista para `update-app-documentation`, que actualizará las fichas declaradas en el bloque "Documentación afectada" de cada tarea.
