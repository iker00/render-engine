# Test Plan: Form page-entry invalidation

## Objetivo
Validar con enfoque tests-first que la persistencia por defecto de los formularios queda ligada a la `pageEntry` activa, que la reentrada a la misma página con params distintos reconstruye el estado local del formulario sin reutilizar datos obsoletos y que `persistOnUnmount: true` sigue siendo la excepción explícita.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Lifecycle del formulario frente a `pageEntry`
- Archivo principal esperado:
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - un formulario sin `persistOnUnmount` elimina `forms.{formId}` al cambiar la `pageEntry` aunque la `pageId` siga siendo la misma
  - un rerender sin cambio de `pageEntry` no toca `forms.{formId}`
  - la persistencia explícita con `persistOnUnmount: true` sigue preservando el estado entre entradas distintas de la misma página
  - la navegación no-op a la misma página con los mismos params efectivos no invalida el formulario
  - la prueba fija el estado observable del store y no depende solo de detectar que hubo remount del árbol
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx`

## Integration tests esperados

### 2. Navegación parametrizada y defaults basados en `params.*`
- Archivo principal esperado:
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - reentrada a la misma `pageId` con params distintos reconstruye el formulario y pierde el valor manual previo
  - un `defaultValue: "params.userId"` refleja el param de la nueva entrada
  - una navegación a la misma página con params equivalentes sigue siendo no-op observable
  - `persistOnUnmount: true` conserva el valor manual dentro de la misma instancia del runtime
  - los asserts principales comprueban el valor visible y el estado reconstruido del formulario, no solo el ciclo de montaje de React
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx`

### 3. Reentrada con `preloads` y defaults basados en `queries.*`
- Archivos principales esperados:
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Comportamiento a validar:
  - durante la nueva `pageEntry`, un campo con `defaultValue` derivado de `queries.*` no reutiliza el dato de la entrada anterior
  - el formulario ve el estado limpio durante `loading`
  - cuando llega el primer dato fresco de la nueva tanda y el campo sigue prístino, puede absorberlo con la semántica vigente
  - `goBack` hacia una entrada previa con `preloads` reaplica la misma reconstrucción del formulario
  - la cobertura demuestra explícitamente la invalidez por `pageEntry` aunque la implementación concreta siga usando el remount actual del árbol
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx`

### 4. Regresión integrada de varios formularios y operaciones del formulario
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - en una página con varios formularios, solo se invalida por defecto el formulario sin `persistOnUnmount: true`
  - `resetForm` opera sobre el estado reconstruido de la nueva entrada
  - la validación local sigue escribiendo errores sobre el estado vigente de la nueva entrada
  - el submit declarativo sigue resolviendo referencias contra el snapshot reconstruido correcto
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`

## Regresión final y gate global

### 5. Subconjunto afectado completo
- Tipo:
  - integración y regresión final del runtime afectado por la feature
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-page-entry-preloads.test.tsx`
- Comportamiento que valida:
  - coherencia entre `RuntimePage`, lifecycle de `form`, navegación parametrizada, `pageEntry` y `preloads`
  - mantenimiento de la excepción `persistOnUnmount: true`
  - ausencia de rehidratación accidental durante la misma `pageEntry`
  - cumplimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado vive íntegramente dentro del runtime React, su store compartido, el hash navigation ya abstraído por tests de integración y la orquestación local de `preloads`, sin necesidad de navegador real ni backend real adicional.

## Secuencia recomendada de validación por tareas
1. `T0030-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx`
2. `T0030-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx`
3. `T0030-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-page-entry-preloads.test.tsx`
   - Cerrar con `pnpm test`
4. `T0030-04`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a retocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0030-03`

## Riesgos de validación a vigilar
- Corregir la limpieza por `pageEntry` y romper la estabilidad del formulario durante la misma entrada.
- Resolver la reentrada con un workaround específico para `params.*` pero dejar fuera `queries.*` o `goBack`.
- Perder la excepción `persistOnUnmount: true` al mover la frontera de persistencia.
- Mantener tests que solo verifican remontaje visual, pero no el contenido real de `forms.{formId}` en el store.
