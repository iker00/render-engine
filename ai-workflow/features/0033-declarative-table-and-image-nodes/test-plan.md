# Test Plan: Declarative table and image nodes

## Objetivo
Validar con enfoque tests-first que el runtime incorpora `image` y `table` sin romper el catálogo actual, que ambos nodos reutilizan la frontera existente de referencias, `queryStateFeedback` y `visibility`, y que la tabla mantiene una semántica de lectura básica con degradación segura ante colecciones ausentes o datos parciales.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación puede iterarse con subconjuntos más pequeños, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Unit tests esperados

### 1. Validación y normalización del contrato de `image` y `table`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si se fija el shape normalizado desde la fachada pública
- Comportamiento a validar:
  - aceptación de `image` con `src` y `alt`
  - aceptación de `table` con `headers` y modo manual válido limitado a celdas `string | number | boolean`
  - aceptación de `table` con `headers` y modo dinámico válido
  - rechazo de `image` sin `src` o sin `alt`
  - rechazo de tablas sin `headers`, sin `rows`, con filas de longitud incorrecta, con `cells` dinámicas de longitud incorrecta o con celdas manuales fuera del catálogo escalar soportado
  - rechazo de `source` fuera de `queries.{queryName}.data`, `queries.{queryName}.data.*` o `item.*`
  - compatibilidad hacia atrás de configuraciones que no usan `image` ni `table`
  - continuidad de `queryStateFeedback` y `visibility` como campos transversales del catálogo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`

## Integration tests esperados

### 2. Render y degradación segura del nodo `image`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la resolución visible queda formalizada con contrato compartido
- Comportamiento a validar:
  - render de `<img>` con `src` y `alt` literales válidos
  - resolución de `src` y `alt` desde referencias completas soportadas
  - soporte de `item.*` cuando `image` vive dentro de un `repeater`
  - degradación a no render cuando `src` no resuelve un string utilizable
  - degradación de `alt` a string vacío cuando el valor no está disponible
  - continuidad de `queryStateFeedback` y `visibility` sobre `image`
  - estabilidad de las clases base del runtime para el nodo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`

### 3. Render manual del nodo `table`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - render de cabeceras, filas y celdas en el orden declarado
  - preservación de la correspondencia semántica entre `th` y `td`
  - soporte de valores literales visibles en celdas manuales, incluidos `number` y `boolean`
  - soporte de referencias runtime completas en celdas manuales string con la misma semántica visible compartida que `image`
  - degradación segura a vacío de celdas manuales no resolubles o no renderizables como texto visible
  - continuidad de `queryStateFeedback` y `visibility` sobre la tabla manual
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`

### 4. Render dinámico del nodo `table`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la proyección visible por celda comparte helpers con contrato verificable
- Comportamiento a validar:
  - una fila por cada item de la colección dinámica en `queries.*`
  - proyección correcta de `item` e `item.*` por cada columna
  - soporte combinado de referencias globales y referencias al item actual en la misma fila
  - degradación a cero filas cuando la colección está ausente, falla o no es array
  - conservación de la fila y vaciado solo de celdas no resolubles cuando hay items parciales
  - soporte de arrays de escalares usando `item` completo como celda
  - continuidad de la semántica dentro de un `repeater`, consumiendo `item.*` del contexto iterado exterior cuando aplique
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 5. Compatibilidad transversal del catálogo ampliado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la nueva resolución visible quedó formalizada
- Comportamiento a validar:
  - continuidad del renderer para pantallas existentes sin `image` ni `table`
  - continuidad de `queryStateFeedback` y `visibility` sobre el resto del catálogo
  - continuidad de `item.*`, `queries.*` y `params.*` fuera de los nuevos nodos
  - ausencia de regresiones en el dispatcher central al ampliar `LayoutNodeType`
  - mantenimiento del gate global de coverage
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`

## Regresión final y gate global

### 6. Subconjunto afectado completo
- Tipo:
  - integración y regresión final del runtime afectado por `image` y `table`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/read-runtime-config.test.ts` solo si forma parte del contrato cerrado
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-reference-resolution.test.tsx` solo si la resolución visible quedó con contrato directo
- Comportamiento que valida:
  - coherencia entre contrato de config, resolución visible y renderer de los nuevos nodos
  - mantenimiento del catálogo histórico sin regresiones
  - degradación segura de `image` y `table` ante datos ausentes o parciales
  - compatibilidad con `repeater`, `queryStateFeedback` y `visibility`
  - cumplimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El comportamiento afectado vive íntegramente dentro del contrato JSON, el renderer React, la capa de referencias y la resolución local de colecciones del runtime, sin necesidad de navegador real ni backend real adicional.

## Secuencia recomendada de validación por tareas
1. `T0033-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts`
2. `T0033-02`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`
3. `T0033-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`
4. `T0033-04`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/read-runtime-config.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`
   - Cerrar con `pnpm test`
5. `T0033-05`
   - No exige tests nuevos si solo actualiza documentación y `status.yaml`
   - Si la pasada documental obliga a tocar código o tests, volver a ejecutar como mínimo el subconjunto cerrado en `T0033-04`

## Riesgos de validación a vigilar
- Abrir un shape ambiguo de `table` que obligue al renderer a decidir si está en modo manual o dinámico sobre la marcha.
- Duplicar la lógica de literal vs referencia en `image`, celdas de tabla y superficies textuales ya existentes.
- Dejar ambiguo si las celdas manuales admiten referencias completas o escalares no string y acabar con dos semánticas distintas entre tabla manual y tabla dinámica.
- Tratar filas parciales como fallo global de render en lugar de degradar solo las celdas afectadas.
- Dejar sin fijar el soporte de `item.*` dentro de tablas dinámicas y dentro de `repeater`.
- Añadir estilos o wrappers que rompan la semántica HTML básica de tabla o introduzcan una API visual paralela fuera de alcance.
