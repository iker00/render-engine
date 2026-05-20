# Test Plan: Container variants and responsive grid span

## Objetivo
Validar con enfoque tests-first que el runtime amplía `container` con una variante visual cerrada `card` y añade `layout.span` como semántica transversal de grid sin abrir theming libre ni widths arbitrarios, manteniendo compatibilidad con configuraciones existentes y una degradación segura fuera de contexto.

## Cobertura y gate de cierre
- El gate global del proyecto sigue siendo `pnpm test`, con mínimo del 80% de coverage en `functions`, `lines` y `statements` sobre `src/`.
- Durante la implementación pueden ejecutarse subconjuntos más pequeños para iterar, pero ninguna tarea queda cerrada sin sus tests relevantes en verde y sin pasar `pnpm test` al cierre de la pasada final.

## Precondición pendiente del plan
- Resuelta: `repeater` queda fuera del alcance visible de `layout.span`.
- Si una repetición necesita ocupar columnas, el test debe construir ese caso con un nodo raíz visible en `props.template` y aplicar ahí `layout.span`, por ejemplo sobre un `container`.

## Unit tests esperados

### 1. Contrato y validación previa al render para `variant` y `layout.span`
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
- Comportamiento a validar:
  - aceptación de `container.props.variant: default | card`
  - compatibilidad con `container` sin `variant`
  - aceptación de `layout.span` como entero de `1` a `12`
  - carácter transversal de `layout.span` sobre nodos hoja, `container` y `form`
  - exclusión explícita de `repeater` del alcance visible de `layout.span`
  - rechazo de valores inválidos de `variant`, `layout` o `layout.span`
  - continuidad de configuraciones históricas sin las nuevas superficies
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`

### 2. Helper visual central de `container` y wrapper de span
- Archivos principales esperados:
  - `src/tests/runtime-node-styling.test.ts`
- Comportamiento a validar:
  - igualdad entre ausencia de `variant` y `variant: default`
  - clases estables y cerradas de `variant: card`
  - convivencia de `card` con `columns`
  - precedencia visual de `card` frente a la superficie implícita de `form-section`
  - mapeo estable del wrapper de span a `col-span-*`
  - clamp del span efectivo al número de columnas del grid padre
  - ausencia de efecto visible cuando no existe contexto de grid
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-node-styling.test.ts`

## Integration tests esperados

### 3. Render visible de `container` con variante `card`
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - un `container` sin `variant` conserva la apariencia previa
  - `variant: default` no cambia el render respecto al default implícito
  - `variant: card` renderiza una agrupación visual cerrada alineada con la baseline institucional
  - `variant: card` puede convivir con `columns` sin perder el grid del contenedor
  - `variant: card` dentro de `form` no genera una doble superficie ambigua
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 4. Integración de `layout.span` en grids efectivos
- Archivos principales esperados:
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - nodos hoja con `layout.span` ocupan el número de columnas declarado dentro de un padre con `columns`
  - nodos compuestos con `layout.span` también ocupan el ancho esperado
  - un `repeater` dentro de grid no recibe wrapper de span propio y la ocupación debe declararse en el nodo raíz visible del `template`
  - un nodo con `layout.span` fuera de grid sigue renderizando sin clases residuales de span
  - un span mayor que las columnas del padre se degrada a todo el ancho disponible del grid
  - varios hermanos con spans distintos conservan una colocación estable sin romper el contenedor
  - un nodo oculto por `queryStateFeedback` o `visibility` no reserva hueco de grid
- Comando sugerido durante la tarea:
  - `pnpm exec vitest run src/tests/layout-renderer.test.tsx`

### 5. Regresión final del subconjunto afectado
- Archivos principales esperados:
  - `src/tests/runtime-config-validation.test.ts`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/layout-renderer.test.tsx`
- Comportamiento a validar:
  - coherencia entre contrato, helper visual y renderer visible
  - continuidad del comportamiento histórico de `container`
  - integración estable de `card` y `layout.span`
  - degradación segura fuera de grid o ante spans sobredimensionados
  - mantenimiento del gate global de coverage
- Comandos sugeridos durante la tarea:
  - `pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
  - `pnpm test`

## Tests e2e
- No se planifican tests e2e en esta feature.
- El alcance vive dentro de validación previa al render, helper visual central, renderer React y composición de layout ya cubiertos por tests locales, sin introducir una dependencia necesaria de navegador real o backend real.

## Secuencia recomendada de validación por tareas
1. `T0034-01`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-config-validation.test.ts`
2. `T0034-02`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
3. `T0034-03`
   - Ejecutar `pnpm exec vitest run src/tests/runtime-node-styling.test.ts src/tests/layout-renderer.test.tsx`
4. `T0034-04`
   - Repetir la regresión del subconjunto completo y cerrar con `pnpm test`

## Riesgos de validación a vigilar
- Regresión silenciosa del aspecto por defecto de `container` al introducir `variant`.
- Introducción accidental de una tarjeta demasiado ornamental o ajena al lenguaje institucional vigente.
- Aplicación de `span` antes de resolver visibilidad, dejando wrappers vacíos que alteren el grid.
- Uso de `col-span-*` mayor que el grid padre sin clamp, generando columnas implícitas o layouts inestables.
- Fuga de la semántica de `span` hacia layouts lineales `flex` por una integración demasiado genérica.
- Reintroducir por accidente un wrapper propio en `repeater`, rompiendo su contrato actual de expansión estructural sin markup propio.
