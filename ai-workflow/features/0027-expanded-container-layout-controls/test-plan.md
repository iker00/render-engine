# Test Plan: Expanded container layout controls

## Objetivo
Validar con enfoque tests-first que `container` amplía su contrato de layout sin abrir una API general de estilos, manteniendo compatibilidad con configuraciones existentes, integrándose de forma estable con formularios y cerrando la ambigüedad entre modo lineal y modo columnas.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Contrato y validación previa al render de `container`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si hace falta fijar la lectura pública del contrato ampliado
- Comportamiento a validar:
  - aceptación de `gap: sm | md | lg | xl | 2xl`
  - continuidad de aceptación de `gap` arbitrario como compatibilidad heredada
  - aceptación de `columns` solo como entero entre `1` y `12`
  - aceptación de `align`, `justify` y `wrap` solo dentro del catálogo cerrado acordado
  - rechazo explícito de `columns + wrap`
  - aceptación de `direction + columns` en el contrato, dejando la precedencia al runtime
  - compatibilidad intacta de configuraciones históricas de `container`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

### 2. Helper visual central de `container`
- Archivos principales esperados:
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - default efectivo `gap: md` cuando no se declara `gap`
  - mapeo estable de alias `sm | md | lg | xl | 2xl`
  - continuidad del fallback con variable CSS para `gap` arbitrario
  - resolución de modo `flex` frente a modo `grid`
  - precedencia visual de `columns` sobre `direction`
  - mapeo estable de `align`, `justify` y `wrap` según el modo activo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts`

## Integration tests esperados

### 3. Render visible de `container` fuera de formularios
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un `container` sin `gap` renderiza la separación equivalente a `md`
  - un `container` con alias de `gap` aplica la clase esperada
  - un `container` con `columns` renderiza `grid` y la clase `grid-cols-*` correcta
  - `columns` prevalece sobre `direction` cuando ambas props existen
  - `align` y `justify` modifican la alineación visible según el modo activo
  - `gap` arbitrario sigue funcionando mediante la variable CSS local ya existente
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 4. Integración de `container` dentro de `form`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si las aserciones de formularios visibles se endurecen ahí
- Comportamiento a validar:
  - un `container` de formulario sin props nuevas conserva su semántica actual de sección vertical
  - un `container` de formulario con `columns` puede agrupar campos sin perder wrapper semántico ni separación visual estable
  - `align`, `justify` y `gap` ampliado no alteran el comportamiento funcional de campos o botones descendientes
  - la combinación `direction + columns` dentro de formulario sigue usando el modo columnas efectivo
  - los formularios previos continúan renderizando sin regresión observable salvo el nuevo default de espaciado
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx`

### 5. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-button-navigation.test.tsx` solo si quedó afectado por la integración final
- Comportamiento a validar:
  - coherencia entre bootstrap, helper visual y renderer visible
  - continuidad de `container` lineal existente
  - integración estable de columnas y defaults nuevos
  - mantenimiento de la compatibilidad con `gap` arbitrario
  - ausencia de ambigüedad observable entre `columns` y `wrap`
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El alcance vive dentro de validación previa al render, helper visual central y renderer React ya cubiertos por tests locales, sin introducir una dependencia necesaria de navegador real o backend real.

## Secuencia recomendada de validación por tareas
1. `T0027-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
2. `T0027-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
3. `T0027-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-button-navigation.test.tsx`
4. `T0027-04`
   - Repetir la regresión del subconjunto completo y cerrar con `pnpm test`

## Riesgos de validación a vigilar
- Regresión silenciosa de `container` históricos que hoy dependían de no tener `gap` por defecto.
- Divergencia entre el contrato validado y el helper visual al resolver `columns` frente a `direction`.
- Pérdida accidental de la semántica de sección dentro de `form` cuando un `container` usa columnas.
- Rotura del escape acotado para `gap` arbitrario al ampliar la escala cerrada recomendada.
