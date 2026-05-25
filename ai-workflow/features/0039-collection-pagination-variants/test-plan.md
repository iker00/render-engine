# Test plan: Collection pagination variants

## Gate general
- Ejecutar tests enfocados durante cada tarea para mantener feedback corto.
- Ejecutar `pnpm test` antes de cerrar la implementacion de T04 para validar la suite completa con cobertura.
- El umbral global vigente sigue siendo minimo 80% en `functions`, `lines` y `statements` sobre `src/`.
- No se requieren tests e2e en esta feature: el comportamiento se cubre con unit tests de derivacion y tests de integracion del runtime en jsdom.

## Unit tests esperados

### Contrato de configuracion
Archivo: `src/tests/runtime-config-validation.test.ts`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `previousNext`, `numbered` y `scroll` son las unicas variantes aceptadas para `repeater.props.pagination.controls.variant`.
- La ausencia de `controls` y `controls: {}` conserva el default efectivo compatible con `previousNext`.
- Variantes desconocidas fallan antes del render con ruta diagnostica enfocada en `props.pagination.controls.variant`.
- Claves extra en `props.pagination` y `props.pagination.controls`, incluidas al menos `remote`, `cursor`, `total`, `page`, `limit`, `offset` y `hasNext`, se rechazan con ruta diagnostica enfocada.

### Modelo de paginacion local
Archivo: `src/tests/runtime-collection-pagination.test.ts`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts
```

Debe validar:
- Regresion de paginas actuales: total, pagina normalizada, limites de anterior/siguiente y slices por `pageSize`.
- Ventana numerada completa cuando `totalPages <= 5`.
- Ventana numerada de cinco paginas centrada y clampada cuando `totalPages > 5`.
- Normalizacion de paginas fuera de rango y coleccion vacia.
- Scroll incremental local: cantidad inicial `pageSize`, incrementos acumulados por bloque, clamp al total y estado final sin mas items.
- Ningun helper muta la coleccion original.

### Styling estable
Archivo: `src/tests/runtime-node-styling.test.ts`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts
```

Debe validar:
- Clases actuales de controles `previousNext` siguen estables.
- Clases nuevas para boton numerado normal, boton numerado actual y accion fallback de scroll.
- La superficie de controles conserva `col-span-{n}` cuando vive dentro de un grid efectivo.

## Integration tests esperados

### Repeater previousNext
Archivo: `src/tests/layout-renderer.test.tsx`.

Comando enfocado:
```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

Debe validar:
- La variante existente conserva labels `Anterior` y `Siguiente`, limites y navegacion local sin renderizar texto auxiliar `Página n de m`.
- Si `controls` se omite, el comportamiento sigue siendo equivalente al actual.
- Si `controls: {}` se declara sin `variant`, el comportamiento sigue siendo equivalente al actual.
- La paginacion se aplica despues de filtrar keys invalidas o duplicadas.
- `item.*` sigue apuntando al item original visible.
- Varios repeaters paginados mantienen estado independiente.

### Repeater numbered
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Con 5 items y `pageSize: 2`, el primer render muestra items 1 y 2 y marca la pagina 1 como actual.
- Seleccionar pagina 2 muestra items 3 y 4.
- Pulsar `Ultima` muestra el item 5.
- `Primera` y `Anterior` estan deshabilitados en la primera pagina.
- `Siguiente` y `Ultima` estan deshabilitados en la ultima pagina.
- La pagina activa expone `aria-current="page"`.
- Con una sola pagina efectiva no se renderizan controles accionables innecesarios.
- Con mas de cinco paginas se renderiza la ventana compacta esperada y los controles extremos siguen funcionando.
- Cambiar coleccion, `pageSize` o `controls.variant` reinicia a pagina 1.
- Navegar entre paginas no dispara red, no despacha cambios de query y no modifica navegacion, formularios ni URL.

### Repeater scroll
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Con 5 items y `pageSize: 2`, el primer render muestra items 1 y 2.
- Con `IntersectionObserver` mockeado, la primera interseccion muestra items 1 a 4 y la segunda muestra los 5.
- Al mostrarse todos los items desaparece cualquier sentinel visible o accion que sugiera mas resultados locales.
- Sin `IntersectionObserver`, aparece `Mostrar mas`, aumenta por bloques de `pageSize` y desaparece al llegar al final.
- El observer se desconecta al desmontar o al cambiar coleccion, `pageSize` o `controls.variant`, y callbacks repetidos no incrementan la ventana visible mas alla del total.
- Cambiar coleccion, `pageSize` o `controls.variant` reinicia la cantidad visible a `pageSize`.
- Varios repeaters `scroll` mantienen ventanas visibles independientes.
- Keys invalidas o duplicadas se filtran antes de calcular bloques.
- Avanzar por scroll no dispara `fetch`, no despacha cambios de query y no modifica navegacion, formularios ni URL.

## E2E
No aplican tests e2e para esta entrega. No hay integracion real con backend, routing externo ni comportamiento de navegador que no pueda cubrirse con jsdom y mocks de `IntersectionObserver`.

## Comandos de cierre
Durante la implementacion:
```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts
pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

Antes de dar por cerrada la pasada de implementacion:
```bash
pnpm test
```
