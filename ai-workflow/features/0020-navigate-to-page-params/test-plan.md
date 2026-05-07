# Test Plan: NavigateTo page params

## Objetivo
Validar con enfoque tests-first que `navigateTo.params` amplía la navegación interna sin convertirla en un router general, preserva compatibilidad hacia atrás y hace observable `params.*` solo en las superficies acordadas.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, que debe mantener al menos el 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin ejecutar los bloques relevantes y sin pasar el gate global al final de la pasada.

## Unit tests esperados

### 1. Contrato y validación de `navigateTo.params`
- Archivo principal esperado:
  - `src/tests/runtime-config-validation.test.ts`
- Comportamiento a validar:
  - aceptación de `navigateTo` sin `params`
  - aceptación de `params` como objeto plano con escalares
  - rechazo de arrays, objetos anidados, claves vacías y valores fuera del catálogo permitido
  - rechazo de `params.*` en `visibility.reference`
  - rechazo de `params.*` en `list/select.props.items.source`
  - rechazo de rutas inválidas de `params.*` en las superficies semánticamente validadas por bootstrap
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-config-validation`

### 2. Parser y resolver de referencias `params.*`
- Archivo principal esperado:
  - `src/tests/runtime-reference-resolution.test.tsx`
- Comportamiento a validar:
  - `params.userId` se clasifica como referencia soportada
  - `params` y `params.user.id` siguen siendo inválidas
  - resolución desde la entrada activa del runtime
  - degradación a missing cuando la clave no existe
  - compatibilidad intacta de `forms.*` y `queries.*`
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-reference-resolution`

### 3. Reducer, selectors e historial parametrizado
- Archivo principal esperado:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - creación de la entrada inicial con params vacíos
  - historial con entradas completas `entryId/pageId/params`
  - no-op al navegar a la misma entrada visible
  - nueva entrada al navegar a la misma página con params distintos
  - restauración íntegra por `goBack`
  - coherencia entre `navigation` y `pageEntry`
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-state`

### 4. Mapeo de acciones UI para `navigateTo.params`
- Archivo principal esperado:
  - `src/tests/runtime-ui-actions.test.tsx`
- Comportamiento a validar:
  - la acción `navigateTo` reenvía `pageId` y `params`
  - la firma compartida de navegación no se rompe para `goBack`, `executeOperation` y `resetForm`
  - no aparece lógica de resolución de params dentro del nodo visual
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-ui-actions`

## Integration tests esperados

### 5. Navegación visible y restauración por `goBack`
- Archivo principal esperado:
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - navegación a otra página con params literales
  - navegación a la misma página con params distintos como entradas observables separadas
  - restauración de params previos por `goBack`
  - ausencia de duplicado cuando la navegación es idéntica a la entrada activa
  - uso de `params.*` en textos visibles de la página destino
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-button-navigation`

### 6. Requests y `preloads` dependientes de `params.*`
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Comportamiento a validar:
  - `api.query`, `api.body` y `api.headers` resuelven `params.*`
  - `button.props.action.*` y `form.submitAction.*` resuelven `params.*`
  - una nueva entrada a la misma página con params distintos relanza `preloads`
  - `goBack` restaura la entrada previa y relanza los `preloads` correspondientes
  - las precargas de una misma entrada siguen compartiendo un snapshot común que ya contiene los params activos
  - el agregado `pageEntry` mantiene `idle | loading | success | error` y cierre latest-only
- Comando sugerido durante la tarea:
  - `pnpm test -- runtime-api-execution`
  - `pnpm test -- runtime-page-entry-preloads`

### 7. Formularios y textos con `params.*`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - `heading.props.text` y `paragraph.props.text` consumen `params.*`
  - `defaultValue` de `input`, `textarea` y `select` puede inicializarse desde `params.*`
  - la semántica lazy de formularios no cambia: el valor por defecto se toma una vez al inicializar el campo
  - referencias ausentes en params degradan como missing según la política previa del consumidor
- Comando sugerido durante la tarea:
  - `pnpm test -- layout-renderer`
  - `pnpm test -- runtime-state`

## Tests e2e
- No se planifican tests e2e en esta feature.
- La cobertura necesaria queda contenida en unit e integration tests del runtime, porque el comportamiento vive íntegramente dentro del renderer declarativo y su store compartido.

## Secuencia recomendada de validación por tareas
1. `T0020-01`
   - Ejecutar `pnpm test -- runtime-config-validation`
2. `T0020-02`
   - Ejecutar `pnpm test -- runtime-state`
   - Ejecutar `pnpm test -- runtime-button-navigation`
3. `T0020-03`
   - Ejecutar `pnpm test -- runtime-reference-resolution`
   - Ejecutar `pnpm test -- runtime-ui-actions`
   - Ejecutar `pnpm test -- runtime-api-execution`
   - Ejecutar `pnpm test -- layout-renderer`
4. `T0020-04`
   - Ejecutar `pnpm test -- runtime-page-entry-preloads`
   - Repetir `pnpm test -- runtime-button-navigation`
   - Repetir `pnpm test -- runtime-state`
5. `T0020-05`
   - Ejecutar `pnpm test`

## Riesgos de validación a vigilar
- Regressión en la semántica actual de navegación a la misma página sin params nuevos.
- Regressión en `goBack` por el cambio de `history` de `string[]` a entradas completas.
- Apertura accidental de `params.*` en `visibility` o en fuentes dinámicas de colección.
- Regressión en `preloads` si el provider sigue observando solo `currentPageId` y no la entrada activa completa.
- Regressión en formularios si `defaultValue` desde params rehidrata campos ya inicializados.
