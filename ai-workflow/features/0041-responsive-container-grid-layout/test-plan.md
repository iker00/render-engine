# Test plan: Responsive container grid layout

## Objetivo de verificación
Validar con enfoque tests-first que `container.props.columns` y `node.layout.span` aceptan valores fijos o mapas responsive cerrados, que el runtime genera clases Tailwind deterministas, que el clamp de span se calcula por breakpoint y que las configuraciones existentes con enteros fijos no cambian su comportamiento observable.

El cierre de implementación exige ejecutar `pnpm test` y mantener el umbral global vigente del 80% en `functions`, `lines` y `statements` sobre `src/`.

## Unit tests esperados

### Contrato y validación de configuración
Archivo principal: `src/tests/runtime-config-validation.test.ts`.

Comando de iteración:
```sh
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `container.props.columns` acepta enteros `1..12` como antes.
- `container.props.columns` acepta mapas con claves `base`, `sm`, `md`, `lg`, `xl` y `2xl`.
- `node.layout.span` acepta enteros `1..12` como antes.
- `node.layout.span` acepta mapas con las mismas claves cerradas.
- Los mapas pueden omitir `base` sin ser inválidos.
- `columns` responsive activa la misma regla cruzada que `columns` fijo: no puede coexistir con `wrap`.
- Breakpoints desconocidos en `columns` y `layout.span` se rechazan antes del render.
- Valores de mapa menores que `1`, mayores que `12`, no enteros o no numéricos se rechazan antes del render.
- Las rutas diagnósticas siguen apuntando a `layout[...].props.columns`, `layout[...].props.wrap` o `layout[...].layout.span` según corresponda.

### Styling y resolución de clases
Archivo principal: `src/tests/runtime-node-styling.test.ts`.

Comando de iteración:
```sh
pnpm exec vitest run src/tests/runtime-node-styling.test.ts
```

Debe validar:
- `getContainerNodeStyling` mantiene `grid w-full grid-cols-4 ...` para `columns: 4`.
- `getContainerNodeStyling` genera `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` para `columns: { base: 1, md: 2, lg: 4 }`.
- `columns: { md: 2, lg: 4 }` genera fallback base `grid-cols-1`.
- Los mapas de clases no dependen de strings Tailwind dinámicos no enumerados.
- `getGridChildSpanClassName` mantiene `col-span-2` para span fijo dentro de padre fijo compatible.
- `getGridChildSpanClassName` genera clases responsive para span responsive.
- El span se clampa por breakpoint contra columnas efectivas del padre.
- Si el padre cambia columnas en un breakpoint no declarado por el `span` hijo, el clamp se recalcula igualmente y se emite la clase responsive necesaria cuando cambia el resultado efectivo.
- Un padre que reduce columnas en un breakpoint mayor produce un clamp independiente en ese breakpoint.
- `getRepeaterPaginationControlsClassName` ocupa todas las columnas efectivas del grid padre, fijo o responsive.

## Integration tests esperados

### Renderer de layout
Archivo principal: `src/tests/layout-renderer.test.tsx`.

Comando de iteración:
```sh
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

Debe validar:
- Un `container` con `columns: 4` conserva las clases visibles actuales de grid fijo.
- Un `container` con `columns: { base: 1, md: 2, lg: 4 }` renderiza como grid y emite las clases responsive esperadas.
- Un hijo con `layout.span: 2` dentro de grid fijo conserva `col-span-2`.
- Un hijo con `layout.span: { base: 1, md: 2 }` dentro de grid responsive recibe wrapper con `col-span-1 md:col-span-2`.
- Un hijo con `layout.span: { base: 2, lg: 4 }` dentro de padre `columns: { base: 1, lg: 3 }` se clampa a `col-span-1 lg:col-span-3`.
- Un hijo con `layout.span: { lg: 2 }` conserva `col-span-1` antes de `lg`.
- Un hijo con `layout.span: { md: 2 }` dentro de padre `columns: { base: 1, lg: 3 }` conserva una columna en `md` por clamp y pasa a dos columnas desde `lg` por recalculo contra el padre efectivo.
- `layout.span` responsive fuera de un grid efectivo no genera wrapper de span ni rompe el render.
- Un `container` responsive vacío renderiza sin inventar contenido ni fallar.
- Un `repeater` dentro de grid responsive sigue sin wrapper propio por `layout.span`, mientras que los nodos visibles de `props.template` aplican su propio span fijo o responsive.
- Los controles de paginación de `repeater` ocupan fila completa dentro de grids responsive.
- Un fallback de `queryStateFeedback` renderizado dentro de un grid responsive aplica su `layout.span` contra el contexto del padre.

## Tests e2e
No aplican para esta feature. El comportamiento observable se valida con tests de contrato, unit tests de styling e integration tests de renderer porque la feature no depende de navegación real, red, viewport runtime ni interacción de usuario fuera de clases CSS emitidas.

## Validación final

Comando obligatorio de cierre:
```sh
pnpm test
```

El cierre de implementación solo es válido si:
- todos los tests relevantes están en verde;
- `pnpm test` pasa con cobertura global mínima del 80% en `functions`, `lines` y `statements`;
- no se introducen tests frágiles basados en snapshots de pantalla completa;
- no queda comportamiento responsive sin cobertura entre los criterios de aceptación de `spec.md`.
