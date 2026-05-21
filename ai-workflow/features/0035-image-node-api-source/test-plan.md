# Test Plan: Image node API source

## Objetivo
Validar con enfoque tests-first que `image` incorpora un modo remoto declarativo con auto-carga propia, que esa carga reutiliza el dominio compartido `queries` sin colisiones entre instancias visibles y que `src` / `alt` se proyectan desde rutas explícitas de respuesta sin romper el modo local histórico del nodo.

## Bloqueo de planificación
- Este plan de tests no debe darse por ejecutable todavía.
- Antes de empezar `T0035-01`, el diseño debe cerrar cómo se identifica una query remota de `image` por instancia renderizada dentro de `repeater` y cómo se recuerda su activación por `pageEntry` cuando la instancia se desmonta y remonta.
- Sin esa decisión, los tests de colisión entre instancias, `queryStateFeedback` sobre la misma imagen y relanzamiento controlado por `pageEntry` admiten implementaciones incompatibles entre sí.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Validación y normalización del contrato remoto de `image`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si se fija el shape normalizado desde la fachada pública
- Comportamiento a validar:
  - aceptación del modo local histórico de `image`
  - aceptación del modo remoto con `loadFromApi.queryName`, `operationName`, request params opcionales y `response.srcPath`
  - aceptación de `props.alt` literal fijo o `response.altPath` en modo remoto
  - rechazo de `src` junto con `loadFromApi`
  - rechazo de imágenes sin `src` ni `loadFromApi`
  - rechazo de `loadFromApi` incompleto
  - rechazo de `props.alt` junto con `response.altPath`
  - rechazo de `queryName` duplicado entre imágenes remotas
  - compatibilidad hacia atrás de configuraciones que usan solo el modo local actual
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

### 2. Separación entre `queryName` visible y `operationName` base
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si conviene fijar la compatibilidad desde el ejecutor común
- Comportamiento a validar:
  - una ejecución sin `queryName` explícito sigue escribiendo en `queries.{operationName}`
  - una ejecución con `queryName` explícito escribe en `queries.{queryName}`
  - la request efectiva sigue construyéndose desde la misma `operationName`
  - la semántica de merge, errores y `requestSignature` no cambia al separar identidad visible y operación base
  - dos queries visibles distintas sobre la misma operación no pisan su estado
  - `preloads`, botón y submit históricos siguen funcionando sin adoptar el nuevo parámetro
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx`

## Integration tests esperados

### 3. Activación automática y política entry-aware del modo remoto
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - auto-carga de una imagen remota visible al entrar en página
  - auto-carga diferida cuando la imagen pasa de oculta por `visibility` a visible
  - ausencia de relanzamiento redundante por rerender o por toggles repetidos dentro de la misma `pageEntry`
  - relanzamiento permitido al entrar en una nueva `pageEntry` aunque la request efectiva coincida con otra entrada anterior
  - escritura exclusiva de errores y estados en `queries.{queryName}`
  - continuidad de la semántica histórica del resto del runtime
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx`

### 4. Convivencia con `queryStateFeedback`, `visibility` y `repeater`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - una imagen remota con `queryStateFeedback.query === loadFromApi.queryName` puede arrancar aunque el estado `idle` o `loading` la oculte o muestre un fallback
  - `queryStateFeedback` basado en otra query distinta sí puede seguir impidiendo la activación cuando el nodo todavía no es visible de verdad
  - una imagen remota dentro de `repeater` resuelve `item.*` en `query`, `body` y `headers` para cada iteración correcta
  - varias imágenes simultáneas con la misma `operationName` base y distinto `queryName` mantienen resultados independientes
  - una mezcla de imágenes remotas y locales convive sin abrir dos semánticas incompatibles
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 5. Proyección de `src` y `alt` desde la respuesta remota
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Comportamiento a validar:
  - extracción correcta de `srcPath` desde rutas anidadas de objetos y arrays
  - extracción correcta de `altPath` desde una ruta distinta
  - fallback a `props.alt` literal cuando no existe `altPath`
  - fallback a `''` cuando no existe valor textual utilizable para `alt`
  - degradación a no render cuando `srcPath` no resuelve un string utilizable
  - continuidad del modo local histórico de `image`
  - disponibilidad de la respuesta bruta en `queries.{queryName}.data` para otros consumidores
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-reference-resolution.test.tsx`

### 6. Compatibilidad transversal de requests manuales y `preloads`
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - `preloads` históricos siguen escribiendo en `queries.{operationName}`
  - `button.props.action.type: executeOperation` y `form.submitAction.type: executeOperation` siguen escribiendo en `queries.{operationName}` cuando no usan `queryName` explícito
  - la separación entre `queryName` y `operationName` no altera errores ni `requestSignature`
  - una imagen remota no rompe la lógica selectiva de `preloads` ya implementada por firma
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-ui-actions.test.tsx src/tests/runtime-button-navigation.test.tsx`

## Regresión final y gate global

### 7. Subconjunto afectado completo
- Tipo:
  - integración y regresión final del runtime afectado por la feature
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx`
- Comportamiento que valida:
  - coherencia entre contrato remoto de `image`, separación `queryName`/`operationName`, store compartido y renderer visible
  - continuidad de `preloads`, botones, submits y modo local histórico de `image`
  - ausencia de colisiones entre imágenes simultáneas que reutilizan la misma operación base
  - mantenimiento de la semántica de `item.*`, `visibility` y `queryStateFeedback`
  - cumplimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-reference-resolution.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado vive dentro del contrato JSON, el renderer React, el store compartido y la capa local de requests del runtime, por lo que la verificación relevante queda cubierta con `Vitest`, renderer y `fetch` controlado.

## Secuencia recomendada de validación por tareas
1. Refinar antes el diseño bloqueante sobre identidad por instancia y memoria de activación.
2. `T0035-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
3. `T0035-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx`
4. `T0035-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx`
5. `T0035-04`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-reference-resolution.test.tsx`
6. `T0035-05`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-reference-resolution.test.tsx`
   - Cerrar con `pnpm test`
7. `T0035-06`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a tocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0035-05`

## Riesgos de validación a vigilar
- Reutilizar `operationName` como única identidad visible y seguir permitiendo colisiones entre imágenes simultáneas.
- Resolver el auto-load solo por montaje visible final y dejar un deadlock cuando la propia query controla `queryStateFeedback`.
- Bloquear relanzamientos mirando solo `requestSignature` actual de la query y olvidar el cambio de `pageEntry`.
- Proyectar `src` y `alt` en el store en vez de dejar la respuesta bruta en `queries.{queryName}.data`.
- Mezclar en silencio `props.alt` y `response.altPath`, dejando dos fuentes funcionales distintas para el texto alternativo.
- Romper `preloads`, botones o submits históricos al introducir `queryName` explícito en la capa compartida de ejecución.
