# Tasks: 0050 — i18n Translations

## Orden de ejecución

1. T01 — Contrato y validación del bloque `translations` (config layer)
2. T02 — Lectura de `data-lang` y propagación al estado del runtime
3. T03 — Familia `translations.*` en parser y tipos de referencia
4. T04 — Resolver de `translations.*` con cadena de fallback (idioma activo → `"es"` → clave en dev / vacío en prod)
5. T05 — Integración end-to-end en superficies textuales e interpolación `{{...}}`

Cada tarea debe completarse antes de iniciar la siguiente. T03 y T04 podrían ser tentadoras de mezclar, pero se mantienen separadas para acotar la pasada de implementación: T03 deja la familia reconocida y rechazada como inválida en shapes incorrectos sin estado, T04 introduce el estado de translations/lang y la resolución real.

---

## T01 — Contrato y validación del bloque `translations`

- **ID**: T01
- **Estado**: pending
- **Objetivo**: Añadir el bloque opcional `translations` al contrato `RuntimeConfig` y a la validación previa al render, rechazando shapes inválidos con diagnóstico de ruta exacta. La validación debe aceptar el bloque ausente, el bloque vacío y catálogos válidos, y rechazar valores no string en las hojas y slugs de idioma vacíos.

- **Fuera de alcance**:
  - Lectura de `data-lang` o cualquier propagación al runtime (entra en T02).
  - Cualquier resolución de referencias `translations.*` (entra en T03 y T04).
  - Validación de coherencia entre claves declaradas y referencias usadas en el layout.
  - Validación o rechazo del uso de `translations.*` en `api.body`, `api.query`, `api.headers`, `visibility.reference` u orígenes de colección: esas superficies ya tratan strings desconocidos como literales y mantienen esa semántica sin cambio en esta tarea.

- **Dependencias**: ninguna.

- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts` — añadir tipos `RuntimeTranslationsConfig` y campo opcional `translations?: RuntimeTranslationsConfig` en `RuntimeConfig`; reexportar desde `src/config/runtime-config.ts`.
    - `src/config/runtime-config.ts` — reexportar el nuevo tipo público.
    - `src/config/runtime-config-root-zod.ts` — extender `runtimeConfigRootSchema` con `translations` opcional (record de records de strings, con strict-strip) usando un nuevo esquema interno.
    - `src/config/runtime-config-zod.ts` — añadir esquema `runtimeTranslationsSchema` y, si procede, helpers de slug de idioma no vacío.
    - `src/config/validate-runtime-config.ts` — incorporar la validación específica del bloque `translations` (vía función auxiliar o módulo nuevo), preservar el bloque normalizado en el `RuntimeConfig` devuelto y mapear issues de Zod a `invalid-layout` con rutas canónicas (`translations.<key>.<lang>` o `translations.<key>`).
    - (Opcional) `src/config/validate-translations.ts` — extraer la validación a un módulo aparte si la lógica supera ~30 líneas o si reduce el coste cognitivo de `validate-runtime-config.ts`.
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-translations.test.ts` (nuevo).
  - Documentación:
    - Sin tocar; el impacto documental queda registrado en `documentación afectada` para la pasada posterior.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/runtime-config-validation-translations.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Un config sin clave `translations` es aceptado y conserva los demás campos sin cambios estructurales.
    - Un config con `translations: {}` es aceptado y normalizado a un objeto vacío en el resultado.
    - Un config con `translations` válido (varias claves, varios idiomas) es aceptado y el bloque normalizado contiene exactamente las mismas claves/valores que el input.
    - Un config con una hoja no string (p.ej. `{ "confirmBtn": { "es": 42 } }`) es rechazado como `invalid-layout` con mensaje que cite la ruta canónica `translations.confirmBtn.es`.
    - Un config con un slug de idioma vacío (`{ "confirmBtn": { "": "Confirmar" } }`) es rechazado como `invalid-layout` con mensaje que cite la ruta canónica `translations.confirmBtn`.
    - Un config con `translations` que no es objeto plano (array, string, number) es rechazado como `invalid-layout` citando la ruta `translations`.
    - Una entrada de traducción que no es objeto plano (p.ej. `{ "confirmBtn": "Confirmar" }`) es rechazada con ruta `translations.confirmBtn`.
    - Claves de traducción con valor objeto vacío (`{ "confirmBtn": {} }`) son aceptadas (las claves pueden ser incompletas entre idiomas).
    - El resultado normalizado preserva las hojas string tal cual (sin trims agresivos ni transformaciones).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-translations.test.ts`
  - **Restricciones**: reusar los helpers existentes de `src/tests/config-validation/helpers.ts` para construir configs base mínimos; no introducir un harness nuevo si el patrón actual de los otros `runtime-config-validation-*` ficheros ya sirve.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md` — nuevo bloque raíz `translations`.
  - `ai-workflow/docs/app-features/config/validation.md` — reglas de aceptación y rechazo del bloque.
  - `ai-workflow/docs/test-index.md` — entrada nueva para el fichero de test.

- **Criterios de finalización**: el contrato público de `RuntimeConfig` admite `translations`, `validateRuntimeConfig` acepta los shapes válidos descritos y rechaza los inválidos con mensajes y rutas explícitos, y los tests definidos pasan.

- **Cierre de implementación**: código y tests de esta tarea completos y validados. No introduce comportamiento runtime visible.

---

## T02 — Lectura de `data-lang` y propagación al estado del runtime

- **ID**: T02
- **Estado**: pending
- **Objetivo**: Leer el atributo `data-lang` del elemento raíz una sola vez al arrancar, con default `"es"` cuando no está presente o vacío, y propagar tanto el idioma activo como el bloque `translations` ya validado al estado compartido del runtime, de modo que queden accesibles para el resolver de referencias sin acoplar los nodos visuales.

- **Fuera de alcance**:
  - Cualquier resolución de la nueva familia `translations.*` (entra en T03 y T04). En esta tarea los datos quedan disponibles en el estado pero no se usan todavía.
  - Reactividad a cambios posteriores de `data-lang`: la lectura es one-shot al bootstrap.
  - Diagnóstico cuando `data-lang` no coincide con ningún idioma declarado (la spec dice explícitamente que no es error).

- **Dependencias**: T01.

- **Impacto esperado en archivos**:
  - Código:
    - `src/app/bootstrap/read-runtime-active-language.ts` (nuevo) — función `readRuntimeActiveLanguage({ rootElement })` que devuelve un slug string; trata `undefined`, `null` y string vacío como ausente y devuelve `"es"`. No realiza validación contra el catálogo de translations.
    - `src/app/App.tsx` — invocar el nuevo lector y pasar el slug al `AppShell`.
    - `src/app/app-shell.tsx` — recibir el slug y pasarlo al `RuntimeStateProvider`.
    - `src/runtime/runtime-state/runtime-state-provider.tsx` — aceptar prop `activeLanguage?: string`, pasarla a `createRuntimeState` como parte de `options`.
    - `src/runtime/runtime-state/runtime-state-types.ts` — añadir sub-estado `i18n: { translations: RuntimeTranslationsConfig; activeLanguage: string }` (o equivalente) en `RuntimeState`; `activeLanguage` siempre es string; `translations` puede ser `{}`.
    - `src/runtime/runtime-state/runtime-state-reducer.ts` — `createRuntimeState` lee `config.translations ?? {}` y `options?.activeLanguage ?? 'es'`, los guarda en el nuevo sub-estado; ningún reducer modifica ese sub-estado posteriormente.
  - Tests:
    - `src/tests/app/app-bootstrap.test.tsx` (ampliación).
    - `src/tests/runtime-state/runtime-state-i18n.test.tsx` (nuevo) — semántica de inicialización del sub-estado `i18n`.
  - Documentación:
    - Sin tocar en esta tarea.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/app/app-bootstrap.test.tsx` (ampliación).
    - `src/tests/runtime-state/runtime-state-i18n.test.tsx` (nuevo).
  - **Comportamiento cubierto** (`app-bootstrap.test.tsx`):
    - Con `data-lang="en"` en el `rootElement`, el provider recibe `activeLanguage: "en"`.
    - Sin atributo `data-lang`, el provider recibe `activeLanguage: "es"`.
    - Con `data-lang=""` (string vacío), el provider recibe `activeLanguage: "es"`.
    - Un `data-lang` con slug arbitrario (p.ej. `"fr"`) se propaga sin alterarlo, incluso si no aparece en `translations`.
  - **Comportamiento cubierto** (`runtime-state-i18n.test.tsx`):
    - `createRuntimeState(config)` con `translations` ausente y sin `options.activeLanguage` produce `i18n: { translations: {}, activeLanguage: 'es' }`.
    - `createRuntimeState(config, { activeLanguage: 'en' })` con `config.translations` válido refleja exactamente el bloque y el slug en `state.i18n`.
    - Una acción `runtime/reset` con el `initialState` mantiene `state.i18n` intacto.
    - Acciones de dominios no relacionados (navegación, forms, queries) no alteran `state.i18n`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/app/app-bootstrap.test.tsx`
    - `pnpm test --run src/tests/runtime-state/runtime-state-i18n.test.tsx`
  - **Restricciones**: reusar el patrón de fixtures de `src/tests/app/app-bootstrap.test.tsx` (montaje con `render` y `rootElement` controlado); para `runtime-state-i18n.test.tsx` reusar los helpers de `src/tests/runtime-state/helpers.tsx` si fuera necesario, pero priorizar invocaciones directas a `createRuntimeState` para mantener tests unitarios pequeños.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/local-config.md` — mención de `data-lang` igual que `data-config` y `data-values`.
  - `ai-workflow/docs/test-index.md` — entradas nuevas o actualizadas.

- **Criterios de finalización**: `data-lang` se lee correctamente con default `"es"`, el sub-estado `i18n` queda construido al inicializar el runtime y los tests definidos pasan. La resolución de `translations.*` aún no funciona y eso es esperado.

- **Cierre de implementación**: código y tests de esta tarea completos y validados. El bloque `translations` queda accesible en el estado para la siguiente tarea.

---

## T03 — Familia `translations.*` en parser y tipos de referencia

- **ID**: T03
- **Estado**: pending
- **Objetivo**: Extender la capa central de referencias (`src/runtime/runtime-references/`) para reconocer `translations.{key}` como nueva familia soportada con exactamente un segmento dinámico tras el namespace, y para tratar `translations.group.key` (dos o más segmentos) como referencia inválida. En esta tarea el parser deja la referencia parseada como `supported`/`invalid`, pero la resolución de valor (lectura del catálogo y fallback) entra en T04.

- **Fuera de alcance**:
  - Resolución real del valor traducido y cadena de fallback (entra en T04).
  - Ampliación del catálogo de surfaces de diagnóstico más allá de las ya existentes; no se añade una surface específica de `translations`.
  - Cualquier cambio en el comportamiento histórico de namespaces existentes (`forms`, `queries`, `params`, `item`, `navigation`, `routeParams`).

- **Dependencias**: T02.

- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-references/runtime-reference-types.ts` — añadir `'translations'` a `RuntimeReferenceNamespace` y a la union `namespace` de `RuntimeSupportedReference`.
    - `src/runtime/runtime-references/runtime-reference-parser.ts` — añadir `translations` a `SUPPORTED_NAMESPACES`, al `REFERENCE_PATTERN`, a `hasRecognizedNamespace` y a `hasValidReferenceShape` (rama nueva que exige exactamente un segmento).
    - Posible ajuste menor en `runtime-reference-resolver.ts` solo si el flujo actual fuerza un cambio para mantener `translations` como `supported` sin valor todavía; la rama de lectura real del valor se introduce en T04.
  - Tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — bloques de parseo para `translations.*`.
  - Documentación:
    - Sin tocar.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - `parseRuntimeReference('translations.confirmBtn')` devuelve `{ kind: 'reference', status: 'supported', namespace: 'translations', path: ['confirmBtn'] }`.
    - `parseRuntimeReference('translations')` (sin segmento) se considera referencia inválida (`status: 'invalid'`).
    - `parseRuntimeReference('translations.group.key')` (dos segmentos) es inválida (`status: 'invalid'`).
    - `parseRuntimeReference('translations.with.too.many.segments')` también es inválida.
    - `parseRuntimeReference('translations.confirm-btn')` es válida (acepta guiones igual que los otros namespaces).
    - `parseRuntimeReference('translations.')` (segmento vacío) es inválida.
    - `parseRuntimeReference('\\translations.confirmBtn')` se trata como literal `"translations.confirmBtn"` (escape coherente con el resto de familias).
    - `parseRuntimeReference('translations.confirmBtn ')` con whitespace final no se considera referencia válida (sigue el comportamiento histórico de la regex; debe quedar como literal).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
  - **Restricciones**: no introducir un fichero nuevo de tests; la familia debe quedar cubierta dentro del fichero canónico de resolución de referencias para mantener la trazabilidad con las familias existentes.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/reference-resolution.md` — añadir `translations.{key}` al catálogo de formas soportadas y mencionar la frontera de un único segmento.

- **Criterios de finalización**: el parser reconoce `translations.{key}` como referencia soportada, rechaza shapes inválidas, y los tests definidos pasan. La resolución de valor aún devuelve estado `missing` para `translations.*` porque el resolver real no está implementado todavía: eso es esperado y se cierra en T04.

- **Cierre de implementación**: código y tests de esta tarea completos y validados.

---

## T04 — Resolver de `translations.*` con cadena de fallback

- **ID**: T04
- **Estado**: pending
- **Objetivo**: Implementar la rama del resolver para `translations.{key}` aplicando la cadena de fallback: idioma activo → `"es"` → nombre de la clave en desarrollo / string vacío en producción. El resolver debe leer translations y `activeLanguage` desde el estado del runtime ya inicializado en T02.

- **Fuera de alcance**:
  - Cambios en el parser (cerrados en T03).
  - Validación adicional del bloque `translations` (cerrada en T01).
  - Integración explícita en superficies textuales del renderer: las superficies ya pasan por `resolveRuntimeVisibleValue`, por lo que esta tarea no toca código de nodos. La verificación end-to-end por superficie queda para T05.

- **Dependencias**: T01, T02, T03.

- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-references/runtime-reference-resolver.ts` — añadir rama `namespace === 'translations'` en `resolveSupportedReferenceValue` que aplique la cadena de fallback. Cuando ninguna entrada exista, devolver:
      - en desarrollo (`import.meta.env.DEV`): `{ found: true, value: '<key>' }` para que la cadena visible muestre el nombre de la clave.
      - en producción: `{ found: true, value: '' }`.
      - Importante: la cadena de fallback debe garantizar que el resultado de `resolveRuntimeVisibleValue` para `translations.{key}` nunca sea `missing`/`unsupported` en producción; el valor degradado vacío se devuelve explícitamente.
    - `src/runtime/runtime-references/runtime-reference-diagnostics.ts` — sin cambio obligatorio. Si el equipo decide loguear claves no traducidas en dev, hacerlo a través del canal existente; no introducir surfaces nuevas.
  - Tests:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación) — casos de la cadena de fallback contra estados sintéticos.
  - Documentación:
    - Sin tocar.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - Con `state.i18n = { translations: { confirmBtn: { es: 'Confirmar', en: 'Confirm' } }, activeLanguage: 'en' }`, `resolveRuntimeReference('translations.confirmBtn', state)` devuelve `status: 'resolved'` con valor `'Confirm'`.
    - Con el mismo catálogo y `activeLanguage: 'es'`, el resolver devuelve `'Confirmar'`.
    - Con `activeLanguage: 'fr'` y la clave solo declarada en `es` y `en`, el resolver aplica el fallback al idioma por defecto y devuelve el valor de `es`.
    - Con `activeLanguage: 'es'` y una clave que solo tiene `en`, el resolver salta al fallback de clave/string-vacío porque `es` no existe.
    - Cuando la clave no existe en ningún idioma y el entorno es dev (`import.meta.env.DEV: true`, situación por defecto en Vitest), el resolver devuelve la propia clave (`'confirmBtn'`).
    - Cuando la clave no existe en ningún idioma y el entorno es prod (stub vía `vi.stubEnv('DEV', false)` o equivalente disponible en el proyecto), el resolver devuelve string vacío.
    - Con `translations` vacío (`{}`), cualquier referencia activa el fallback completo (clave en dev, vacío en prod).
    - La interpolación parcial `{{translations.confirmBtn}}` dentro de un string como `Texto: {{translations.confirmBtn}}` se sustituye por el valor resuelto y conserva el texto literal alrededor.
    - Una referencia con shape inválido (`translations.group.key`) se mantiene como `invalid` (no resoluble) y la superficie visible degrada según la semántica histórica (string vacío en interpolación, string vacío en referencia completa).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`
  - **Restricciones**: usar `vi.stubEnv` (o el helper que el proyecto ya utilice en otros tests) para conmutar `import.meta.env.DEV`; restaurar el valor al final del bloque para no contaminar al resto. No introducir mocks globales del módulo del resolver.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/references/reference-resolution.md` — describir la cadena de fallback y la frontera de un único segmento.
  - `ai-workflow/docs/app-features/references/dynamic-strings.md` — añadir `translations.*` al catálogo de placeholders soportados en interpolación.

- **Criterios de finalización**: la resolución de `translations.{key}` produce los valores correctos según la cadena de fallback, tanto como referencia completa como dentro de interpolaciones `{{...}}`, y los tests definidos pasan.

- **Cierre de implementación**: código y tests de esta tarea completos y validados. La resolución es funcional en cualquier surface textual que ya use `resolveRuntimeVisibleValue` o `resolveRuntimeTextReference`.

---

## T05 — Integración end-to-end en superficies textuales e interpolación

- **ID**: T05
- **Estado**: pending
- **Objetivo**: Comprobar de extremo a extremo que `translations.*` rinde correctamente en una muestra representativa de superficies textuales del renderer (referencia completa e interpolación) y confirmar que las superficies fuera de alcance (`api.body`, `visibility.reference`) siguen tratando `translations.*` como literal sin reinterpretarlo como referencia.

- **Fuera de alcance**:
  - Cobertura exhaustiva nodo por nodo. Las superficies textuales ya delegan en el resolver central, por lo que basta con un conjunto representativo: una superficie de referencia completa (`button.props.label`), una con interpolación (`heading.props.text`) y una sobre atributo accesible (`image.props.alt`).
  - Refactor de cualquier nodo: si un nodo no consume `resolveRuntimeVisibleValue` y por tanto no soporta `translations.*`, no es responsabilidad de esta feature ampliarlo; se documenta como límite.
  - Cambios en lógica de validación o resolución (cerrados en T01–T04).

- **Dependencias**: T01, T02, T03, T04.

- **Impacto esperado en archivos**:
  - Código:
    - Ninguno esperado. Si durante la verificación se detecta que algún nodo de la lista de superficies declaradas en la spec no pasa por el resolver central, abrir un ajuste mínimo en ese nodo dentro de esta tarea y registrarlo en el commit. Si requiere más de un retoque puntual, parar y escalar al usuario antes de continuar.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-translations.test.tsx` (nuevo).
  - Documentación:
    - Sin tocar (queda pendiente para la pasada documental posterior, no para `tasks.md`).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-translations.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Con un layout que contiene `{ type: 'button', props: { label: 'translations.confirmBtn' } }` y `translations: { confirmBtn: { es: 'Confirmar', en: 'Confirm' } }`, el render con `activeLanguage: 'es'` muestra `Confirmar` y con `activeLanguage: 'en'` muestra `Confirm`.
    - Con un `heading.props.text: 'Hola, {{translations.greeting}}'` y `translations.greeting.es: 'mundo'`, el render con `activeLanguage: 'es'` muestra `Hola, mundo`.
    - Con `data-lang="fr"` y una clave solo declarada en `es`/`en`, el render aplica el fallback al `es` (la spec, criterio 5).
    - Sin `data-lang`, el render usa `"es"` y resuelve correctamente claves en español (la spec, criterio 4).
    - Con una clave inexistente, el render muestra el nombre de la clave en dev y string vacío en prod (test con stub de `import.meta.env.DEV`).
    - `image.props.alt: 'translations.searchIcon'` con `searchIcon.es: 'Buscar'` produce un `alt="Buscar"` en el `<img>` renderizado.
    - Una referencia con shape `translations.group.key` se mantiene como literal/invalid en la superficie visible (degrada a string vacío) y no genera throw ni romper el render.
    - Una `visibility.reference: 'translations.flag'` no se reinterpreta como traducción y la regla de visibilidad sigue tratando el string como referencia desconocida (comportamiento histórico de esa superficie). Para la suite basta confirmar que el render no falla con assert sencillo de no-throw y de visibilidad efectiva equivalente al comportamiento previo a esta feature (asumir falsy/oculto según la regla existente).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-translations.test.tsx`
  - **Restricciones**: reusar los helpers ya existentes en `src/tests/layout-renderer/` (si existen) para montar el runtime con un config y un `activeLanguage` controlados; no duplicar harness con el fixture de `runtime-state-i18n.test.tsx`. Cada test debe ser pequeño: un layout mínimo con uno o dos nodos.

- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md` — confirmar el bloque `translations` ya descrito en T01.
  - `ai-workflow/docs/app-features/references/reference-resolution.md` — confirmar familia documentada en T03/T04.
  - `ai-workflow/docs/app-features/references/dynamic-strings.md` — confirmar superficies interpolables.
  - `ai-workflow/docs/app-features/development/local-config.md` — confirmar `data-lang` documentado en T02.
  - `ai-workflow/docs/current-state.md` — actualizar el área de referencias si su estado cambió.
  - `ai-workflow/features/index.md` — mover `0050-i18n-translations` a la sección de completadas tras la pasada documental (responsabilidad de `update-app-documentation`).
  - `ai-workflow/docs/test-index.md` — confirmar entrada para el nuevo fichero de test.

- **Criterios de finalización**: los tests definidos pasan, el render produce el texto traducido según `activeLanguage` en las superficies declaradas, y la suite global del proyecto (`pnpm test`) sigue en verde sin romper el umbral de cobertura.

- **Cierre de implementación**: feature funcional end-to-end. La actualización documental queda pendiente para la skill `update-app-documentation`, fuera del alcance de `tasks.md`.
