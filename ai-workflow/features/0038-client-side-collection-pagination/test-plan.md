# Test Plan: Client-side collection pagination

## Objetivo
Validar con enfoque tests-first que el runtime soporta paginación local de colecciones como capacidad reusable, estrenada en `repeater`, con contrato JSON validado, derivación cacheada de páginas, controles anterior/siguiente, reset predecible e independencia entre consumidores.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos con `Vitest`, pero ninguna tarea queda cerrada sin sus tests relevantes en verde.
- La pasada completa de implementación debe cerrar con `pnpm test`.

## Unit tests esperados

### 1. Contrato y validación de `repeater.props.pagination`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
- Comportamiento a validar:
  - aceptación del shape `pagination: { enabled: true, pageSize, controls: { variant: 'previousNext' } }`
  - aceptación de `pagination` sin `controls`, usando default efectivo de controles en runtime
  - aceptación de `pagination.controls: {}` como uso explícito del default efectivo de controles
  - compatibilidad de repeaters sin `pagination`
  - rechazo de `enabled` ausente o distinto de `true`
  - rechazo de `pageSize` ausente, no entero, no finito o menor que `1`
  - rechazo de variantes de controles distintas de `previousNext`
  - rechazo de claves no soportadas dentro de `props.pagination` o `props.pagination.controls`
  - rutas diagnósticas concretas para `props.pagination.enabled`, `props.pagination.pageSize` y `props.pagination.controls.variant`
  - convivencia con `queryStateFeedback`, `visibility`, `layout.span`, `items` y `template`
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`

### 2. Modelo reusable de paginación de colecciones
- Archivos principales esperados:
  - `src/tests/runtime-collection-pagination.test.ts`
- Comportamiento a validar:
  - cálculo de `totalItems`, `totalPages`, página normalizada, flags de anterior/siguiente y items visibles
  - colección vacía sin páginas navegables
  - colección menor que `pageSize`
  - colección con múltiplo exacto de `pageSize`
  - última página parcial
  - conservación del orden original
  - normalización segura de página fuera de rango
  - cache o materialización estable de páginas para no recalcular cortes al cambiar solo de página activa
  - independencia de React, DOM, `repeater`, `table` y queries
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts`

## Integration tests esperados

### 3. Render inicial de `repeater` paginado
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un `repeater` paginado con 5 items y `pageSize: 2` muestra inicialmente solo los 2 primeros items
  - un `repeater` sin `pagination` mantiene el comportamiento histórico y muestra toda la colección válida
  - `item.*` sigue resolviendo contra el item real de la colección origen para nodos descendientes visibles
  - items no visibles por página activa no renderizan headings, párrafos, listas, tablas, imágenes, botones ni campos descendientes
  - keys ausentes, no escalares o duplicadas siguen omitiéndose con la política vigente antes de paginar, sin contar para páginas, totales ni controles
  - query ausente, no array, error o colección vacía degradan a cero iteraciones sin romper el render
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 4. Controles anterior/siguiente e indicador
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - click en siguiente avanza de página y actualiza los items visibles
  - click en anterior retrocede de página y restaura los items esperados
  - siguiente no avanza más allá de la última página
  - anterior no retrocede antes de la primera página
  - el indicador textual muestra página activa y total derivado
  - colecciones vacías o de una sola página no muestran controles accionables inútiles
  - los controles usan botones accesibles `type="button"` y clases compactas coherentes
  - dentro de un grid efectivo, el bloque de controles ocupa una fila completa y no se confunde con una iteración más del template
  - después de cambiar de página, las acciones o nodos descendientes que usan `item.*` resuelven contra el item visible activo
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`

### 5. Reset, independencia y datos cambiantes
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-collection-pagination.test.ts`
  - `src/tests/runtime-state.test.tsx` solo si se toca `runtime-state/`
- Comportamiento a validar:
  - al reemplazar la colección origen por una nueva referencia, el `repeater` vuelve a la primera página
  - si la nueva colección reduce el total de páginas, no queda visible una página vacía artificial cuando existen resultados
  - al cambiar `pageSize`, la página activa vuelve a la primera página
  - dos repeaters paginados sobre la misma query mantienen página activa independiente
  - dos repeaters paginados sobre queries distintas mantienen página activa independiente
  - una recarga `loading` con último `data` válido no cambia la semántica de `queryStateFeedback`
  - un refetch o nueva `pageEntry` que reemplaza `data` invalida la caché local y muestra la nueva colección
  - navegar repetidamente entre páginas de la misma colección reutiliza el resultado derivado por colección y `pageSize`
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts src/tests/layout-renderer.test.tsx`
  - Si se toca `runtime-state/`: `pnpm exec vitest run src/tests/runtime-state.test.tsx`

### 6. Regresión coordinada del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-collection-pagination.test.ts`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-state.test.tsx` solo si se toca `runtime-state/`
- Comportamiento a validar:
  - coherencia entre contrato, utilidad reusable, renderer, controles visibles y reset
  - ausencia de regresiones en `repeater` sin paginación
  - mantenimiento de `item.*` en descendientes y acciones por item
  - ausencia de efectos sobre red, queries, formularios, navegación y `pageEntry`
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-collection-pagination.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El alcance vive dentro de contrato JSON, helpers puros de runtime, render React local y estado local de consumidor. La cobertura relevante queda en `Vitest` con unit tests e integration tests.
- No hay dependencia de backend real porque el cambio de página no dispara red ni consume metadatos remotos.

## Secuencia recomendada de validación por tareas
1. `T0038-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`
2. `T0038-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts`
3. `T0038-03`
   - Ejecutar `pnpm exec vitest run src/tests/layout-renderer.test.tsx`
4. `T0038-04`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
5. `T0038-05`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
   - Si se tocó `runtime-state/`, añadir `pnpm exec vitest run src/tests/runtime-state.test.tsx`
   - Cerrar la pasada completa con `pnpm test`
6. `T0038-06`
   - No añade tests nuevos.
   - Confirmar que la documentación no se marca como cerrada si `T0038-05` no dejó `pnpm test` en verde.

## Riesgos de validación a vigilar
- Aceptar un contrato ambiguo con `pagination: {}` o `enabled: false` que haga depender la semántica de defaults ocultos.
- Aceptar claves futuras como `remote`, `cursor` o variantes visuales no soportadas dentro de `pagination` y degradarlas silenciosamente a paginación local.
- Implementar la paginación dentro del template de `repeater` y bloquear la reutilización futura por `table`.
- Perder el contexto real de `item.*` al paginar sobre una estructura intermedia.
- Contar items que el `repeater` ya omite por key inválida o duplicada, creando páginas vacías o indicadores de total que no coinciden con las iteraciones renderizables.
- Compartir accidentalmente página activa entre dos consumidores que leen la misma query.
- Recalcular `slice` en cada click de anterior/siguiente aunque la colección y `pageSize` no hayan cambiado.
- Mantener una página fuera de rango tras refetch o reducción de resultados.
- Introducir red, cambios de `queries.*` o cambios de `pageEntry` al navegar localmente entre páginas.
- Renderizar controles accionables en colecciones vacías o de una sola página.
