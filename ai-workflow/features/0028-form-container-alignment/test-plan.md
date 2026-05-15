# Test Plan: Form container alignment

## Objetivo
Validar con enfoque tests-first que los `container` dentro de `form` dejan de usar sangrado lateral implícito, conservan la separación visual de sección y no rompen ni el contrato existente de `container` ni los flujos reales del catálogo de formularios.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Helper visual central de `container`
- Archivos principales esperados:
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - la superficie `form-section` mantiene `border-t` y padding vertical útil
  - la superficie `form-section` no añade padding horizontal implícito
  - la superficie `form-section` deja de incluir `-mx-*` o cualquier compensación lateral equivalente
  - un `container` de formulario sin `direction` explícita sigue resolviendo la superficie `form-section`
  - un `container` con `direction: row` y sin `columns` resuelve superficie `plain`
  - el default `gap: md` sigue intacto tras el ajuste
  - los aliases y el fallback con variable CSS para `gap` arbitrario siguen funcionando igual
  - `columns` sigue prevaleciendo sobre `direction: row` también para resolver la superficie visible y el modo `grid`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts`

## Integration tests esperados

### 2. Render visible de `container` dentro de `form`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un `container` de formulario sin props especiales sigue renderizando como `section`
  - ese `container` mantiene `border-t` y padding vertical, pero ya no aplica `padding` horizontal ni `-mx-5` ni `sm:-mx-6`
  - un `container` con `columns` conserva `grid`, `grid-cols-*`, alineación declarativa y separación visual sin desbordar lateralmente
  - un `container` con `direction: row` y sin `columns` sigue siendo lineal y no recibe sangrado lateral por el mero contexto de formulario
  - el resto de campos y labels dentro del bloque mantienen sus valores, roles y semántica visible
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 3. Regresión visible del shell y formularios reales
- Archivos principales esperados:
  - `src/tests/app-shell.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - la configuración de desarrollo representativa mantiene alineación horizontal consistente en el formulario principal
  - los contenedores de formulario visibles en el shell ya no dependen de clases de margen negativo
  - un submit implícito dentro de un `container` descendiente de `form` sigue funcionando igual que antes del ajuste
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/app-shell.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 4. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/app-shell.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx`
- Comportamiento a validar:
  - coherencia entre helper visual, renderer visible y configuración representativa del runtime
  - ausencia de regresión en `container` fuera de `form`
  - mantenimiento de la gramática visual de formularios salvo la eliminación deliberada del sangrado lateral
  - cumplimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx src/tests/app-shell.test.tsx src/tests/runtime-button-navigation.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El alcance está completamente localizado en helpers de styling y render React ya cubiertos por tests locales, sin una dependencia necesaria de navegador real o backend real.

## Secuencia recomendada de validación por tareas
1. `T0028-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
2. `T0028-02`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/app-shell.test.tsx src/tests/runtime-button-navigation.test.tsx`
   - Cerrar con `pnpm test`
3. `T0028-03`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a retocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0028-02`

## Riesgos de validación a vigilar
- Mantener `border-t` pero perder demasiado espaciado vertical, dejando bloques visualmente pegados.
- Corregir el sangrado lateral en `form-section` y romper accidentalmente `container` fuera de formularios.
- Dejar clases viejas como `sm:-mx-6` en tests o ejemplos de desarrollo y documentar un comportamiento que ya no existe.
- Romper la integración de submit implícito o de layouts en columnas al tocar la heurística de `container` en contexto de formulario.
