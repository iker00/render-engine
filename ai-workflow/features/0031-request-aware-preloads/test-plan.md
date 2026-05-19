# Test Plan: Request-aware preloads

## Objetivo
Validar con enfoque tests-first que `preloads` pasa a declarar requests efectivas por objeto, que la reejecución automática se decide por firma resuelta preload a preload y que la iteración conserva la superficie única `queries.{operationName}` sin introducir todavía caché histórica por request.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Validación y normalización del contrato de `preloads`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
- Comportamiento a validar:
  - aceptación de `[{ "loadUser": {} }]`
  - aceptación de overrides declarativos en `query`, `body` y `headers`
  - rechazo del shape histórico `preloads: ["loadUser"]`
  - rechazo de objetos con cero claves, varias claves o clave vacía
  - rechazo de payloads que no cumplen el contrato de `RuntimeApiRequestParams`
  - rechazo de duplicados por `operationName` dentro de la misma página
  - continuidad del error recuperable de runtime para operaciones inexistentes en `api`
  - fijación de la representación normalizada de `preloads` en la frontera pública del config ya validado
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`

### 2. Firma estable y metadatos de identidad de request
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - la request efectiva mantiene la semántica vigente de merge entre operación base y overrides
  - dos requests equivalentes con distinto orden de claves producen la misma firma
  - cambiar solo `query`, solo `headers` o solo una rama del `body` cambia la firma
  - `request-build-failed` y `operation-not-found` se mantienen en la misma frontera de errores
  - la firma asociada a una query se conserva en `loading`, `success` y `error`, y se limpia en `reset`
  - las ejecuciones manuales siguen dejando `queries.{operationName}` alineada con la firma efectiva del intento más reciente
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx`

## Integration tests esperados

### 3. Reejecución selectiva de `preloads` en el provider
- Archivos principales esperados:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - una página con firmas sin cambios no abre una nueva tanda `loading`
  - un cambio de firma relanza solo la query afectada
  - una página con varios preloads puede relanzar un subconjunto y mantener el resto sin recarga automática
  - el provider resetea a `loading` solo las queries realmente relanzadas
  - el agregado `pageEntry` refleja `loading` solo cuando hubo relanzamiento real
  - el agregado cierra en `success` o `error` según el subconjunto relanzado, no según una lista nominal estática
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-state.test.tsx`

### 4. Reentradas por params, formularios y queries que alteran la firma
- Archivos principales esperados:
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - `params.*` distintos relanzan la request automática cuando cambian la firma
  - reentrar a la misma página con params equivalentes sigue siendo no-op observable
  - cambios de `forms.*` que modifiquen el preload resuelto provocan una nueva carga solo del preload afectado
  - cambios de `queries.*` que modifiquen el preload resuelto provocan una nueva carga solo del preload afectado
  - una entrada con firma igual no relanza por rerender ni por cambios internos no relacionados
  - si otra entrada intermedia reutiliza el mismo `operationName` con firma distinta, volver a la anterior relanza porque la query visible ya no representa esa request
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 5. Compatibilidad de acciones manuales y errores recuperables
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-ui-actions.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si conviene fijar un caso real desde UI
- Comportamiento a validar:
  - `button.props.action.type: executeOperation` sigue usando la misma semántica de composición de request
  - `form.submitAction.type: executeOperation` sigue usando la misma semántica de composición de request
  - la adopción de la capa compartida de firma no altera mensajes ni códigos de error ya documentados
  - una ejecución manual posterior puede cambiar la firma vigente de una query y afectar correctamente la decisión de un preload futuro
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-ui-actions.test.tsx`

## Regresión final y gate global

### 6. Subconjunto afectado completo
- Tipo:
  - integración y regresión final del runtime afectado por la feature
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx`
- Comportamiento que valida:
  - coherencia entre contrato de config, firma efectiva, estado de queries y orquestación de `preloads`
  - mantenimiento de la superficie única `queries.{operationName}`
  - ausencia de relanzamientos espurios por diferencias no funcionales de orden
  - continuidad de errores recuperables y acciones manuales
  - cumplimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-ui-actions.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado vive íntegramente dentro del runtime React, su store compartido, la frontera de requests declarativas y la orquestación local de `preloads`, sin necesidad de navegador real ni backend real adicional.

## Secuencia recomendada de validación por tareas
1. `T0031-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`
2. `T0031-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx`
3. `T0031-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`
4. `T0031-04`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/runtime-page-entry-preloads.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-ui-actions.test.tsx`
   - Cerrar con `pnpm test`
5. `T0031-05`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a tocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0031-04`

## Riesgos de validación a vigilar
- Firmar una request distinta de la que realmente se ejecuta por duplicar lógica entre provider y `src/queries/`.
- Evitar relanzamientos mirando historial de `pageEntry` y asumir una caché que esta iteración todavía no tiene.
- Reabrir bucles de `loading` al no persistir la firma actual también durante tandas en curso.
- Mantener el agregado `pageEntry` atado a la lista nominal de preloads y no al subconjunto realmente relanzado.
- Cubrir solo cambios por `params.*` y dejar sin fijar regresiones por `forms.*` o `queries.*`.
