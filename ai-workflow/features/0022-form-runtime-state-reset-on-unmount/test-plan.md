# Test Plan: Form runtime state reset on unmount

## Objetivo
Validar con enfoque tests-first que el runtime deja de persistir por defecto el estado de `form` tras un desmontaje real, que `persistOnUnmount` recupera la persistencia histórica solo cuando se declara de forma explícita y que la semántica lazy, `resetForm`, submit y defaults dinámicos siguen siendo coherentes.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, que debe mantener al menos el 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin ejecutar sus bloques relevantes y sin pasar `pnpm test` al final de la pasada.

## Unit tests esperados

### 1. Contrato y validación de `form.persistOnUnmount`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar el borde de bootstrap con el shape ampliado
- Comportamiento a validar:
  - aceptación de `form` sin `persistOnUnmount`
  - aceptación de `persistOnUnmount: true | false`
  - rechazo de tipos inválidos para `persistOnUnmount`
  - compatibilidad intacta de `submitAction` y `resetOnSuccess` cuando la nueva propiedad no existe
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

### 2. Reducer y provider del dominio `forms` para borrado total por `formId`
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/runtime-ui-actions.test.tsx` solo si la nueva primitiva queda expuesta en una firma compartida
- Comportamiento a validar:
  - borrado completo de `forms.{formId}` sin afectar otros formularios
  - estabilidad al pedir borrado de un formulario inexistente
  - continuidad de `resetForm` como restauración del estado inicial efectivo, no como borrado
  - ausencia de impacto colateral sobre navegación, queries y aislamiento entre instancias
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx`

## Integration tests esperados

### 3. Limpieza por desmontaje y remontaje con defaults literales
- Archivos principales esperados:
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un formulario sin `persistOnUnmount` desaparece del store al desmontarse
  - un rerender del mismo formulario montado no borra su estado ni reinyecta `defaultValue`
  - el siguiente montaje reinicializa los campos desde `defaultValue` o desde el valor vacío propio del tipo
  - los valores escritos en una visita previa no reaparecen tras desmontaje real
  - ocultación por `visibility` o `queryStateFeedback` sin desmontaje real no dispara limpieza
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`

### 4. Reentrada con `params.*` y navegación interna
- Archivos principales esperados:
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-state.test.tsx`
- Comportamiento a validar:
  - un `defaultValue` basado en `params.*` se recalcula en un nuevo montaje tras cambiar la entrada activa
  - la reentrada a la misma página con otro contexto después de pasar por una página intermedia no reutiliza el estado previo por defecto
  - `persistOnUnmount: true` sí conserva el valor del usuario dentro de la misma instancia cuando el formulario se desmonta y vuelve a montarse
  - varios formularios mantienen aislamiento cuando solo uno se desmonta
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx`

### 5. Defaults desde `queries.*`, submit y reset después del remontaje
- Archivos principales esperados:
  - `src/tests/runtime-api-execution.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un formulario de edición hidratado desde `queries.*` se reconstruye con los datos externos vigentes tras desmontaje y remontaje
  - la feature no rehidrata campos ya montados cuando cambian los datos externos sin desmontaje real
  - `required`, submit declarativo y payloads `forms.*` siguen usando el estado local vigente tras el nuevo montaje
  - `resetForm` sigue restaurando el estado inicial efectivo del montaje actual
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`

### 6. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-state.test.tsx`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
  - `src/tests/runtime-api-execution.test.ts`
- Comportamiento a validar:
  - coherencia entre contrato, lifecycle real del nodo `form`, store compartido y submit
  - compatibilidad hacia atrás de formularios existentes que no dependían de persistencia explícita
  - recuperación explícita de la persistencia histórica solo con `persistOnUnmount: true`
  - mantenimiento del gate global de coverage
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento vive íntegramente dentro del runtime declarativo, su store compartido y su ciclo de vida React, y puede validarse con unit e integration tests del repositorio sin requerir navegador real ni backend real.

## Secuencia recomendada de validación por tareas
1. `T0022-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
2. `T0022-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/runtime-ui-actions.test.tsx`
3. `T0022-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-button-navigation.test.tsx src/tests/runtime-state.test.tsx`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-api-execution.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx`
4. `T0022-04`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-state.test.tsx src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx src/tests/runtime-api-execution.test.ts`
   - Ejecutar `pnpm test`
5. `T0022-05`
   - No requiere nuevos comandos de test.
   - Verificar que la documentación actualizada no contradice el comportamiento validado en `T0022-04`.

## Riesgos de validación a vigilar
- Regressión accidental de `resetForm` si se reutiliza la misma primitiva para resetear y para borrar.
- Limpieza accidental disparada por el cleanup de un efecto demasiado amplio, por ejemplo en rerenders del mismo `form` o en cambios internos de estado.
- Falsos positivos de limpieza en formularios solo ocultos pero todavía montados.
- Rehidratación indebida de defaults dinámicos cuando cambian `params.*` o `queries.*` sin desmontaje real.
- Persistencia involuntaria de un formulario distinto al desmontado por compartir `formId` o por borrar el dominio `forms` completo.
- Divergencia entre el estado visible tras remontaje y el payload real enviado por submit.
