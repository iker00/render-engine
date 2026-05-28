# Test plan: Table filtering, sorting and pagination

## Gate general
- Ejecutar tests enfocados durante cada tarea para mantener feedback corto.
- Ejecutar `pnpm test` antes de cerrar `T0042-07`.
- El umbral global vigente sigue siendo minimo 80% en `functions`, `lines` y `statements` sobre `src/`.
- No se requieren tests e2e para esta feature: el comportamiento principal se cubre con unit tests puros y tests de integracion del runtime en jsdom, incluyendo mocks de `IntersectionObserver`.

## Unit tests esperados

### Contrato de configuracion: `props.columns`
Archivo: `src/tests/runtime-config-validation.test.ts`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `table.props.columns` es opcional y una tabla sin nuevas props conserva el config normalizado actual.
- `columns` acepta una lista parcial por `id` contra `headers`.
- `filterable` y `sortable` solo son validos cuando valen exactamente `true`.
- `filterPlaceholder` acepta un string no vacio solo en columnas con `filterable: true`.
- Una entrada de `columns` debe activar al menos una capacidad local.
- Ids inexistentes, duplicados o ambiguos por cabeceras duplicadas se rechazan antes del render.
- `filterPlaceholder` vacio o declarado en una columna no filtrable se rechaza con ruta diagnostica concreta.
- Claves extra en `columns[]`, especialmente claves con apariencia remota, se rechazan con ruta diagnostica concreta.

### Contrato de configuracion: `props.pagination`
Archivo: `src/tests/runtime-config-validation.test.ts`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

Debe validar:
- `table.props.pagination.enabled` debe ser exactamente `true`.
- `pageSize` debe ser entero, finito y mayor o igual que `1`.
- `controls.variant` acepta solo `previousNext`, `numbered` y `scroll`.
- Omitir `controls` o declarar `controls: {}` conserva default efectivo `previousNext`.
- Claves extra en `pagination` o `pagination.controls`, incluidas `remote`, `cursor`, `total`, `page`, `limit`, `offset` y `hasNext`, se rechazan con ruta enfocada.
- El contrato de `repeater.props.pagination` no cambia por esta feature.

### Modelo local de tabla
Archivo: `src/tests/runtime-table-processing.test.ts`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts
```

Debe validar:
- Resolucion de columnas configuradas por `id` contra `headers` sin asumir posicion de `columns`.
- Normalizacion de filtros por texto visible: coincidencia parcial, insensible a mayusculas, minusculas y tildes.
- Filtros vacios no excluyen filas.
- Varios filtros activos se combinan con semantica `AND`.
- Ordenacion ascendente y descendente por una sola columna activa.
- Tercer cambio sobre la misma columna limpia la ordenacion activa.
- Cambio de columna ordenada sustituye la ordenacion anterior.
- Sin ordenacion activa se conserva el orden original.
- Empates, celdas vacias o ausentes y valores visibles mezclados mantienen orden estable.
- Los helpers no mutan las filas de entrada.

### Paginacion compartida
Archivo: `src/tests/runtime-collection-pagination.test.ts`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/runtime-collection-pagination.test.ts
```

Debe validar:
- Las regresiones existentes de `createCollectionPaginationModel`, `createNumberedPaginationWindow` y `createCollectionScrollWindow` siguen en verde.
- Solo se anaden tests nuevos si la integracion de tabla exige ajustar la API compartida.
- Cualquier ajuste debe conservar el comportamiento de `repeater`.

### Styling estable
Archivo: `src/tests/runtime-node-styling.test.ts`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/runtime-node-styling.test.ts
```

Debe validar:
- Clases base de tabla existentes no cambian para tablas sin capacidades nuevas.
- Clases de la barra superior de filtros, campos, labels ocultas, inputs y boton `Reiniciar filtros` mantienen baseline compacta y foco accesible.
- Clases de cabecera ordenable y boton activo/inactivo son estables.
- Clases de controles de paginacion de tabla, boton normal, boton actual y accion fallback de scroll son estables.
- No se reintroducen estilos inline ni API visual declarativa para esta feature.

## Integration tests esperados

### Regresion de tablas existentes
Archivo: `src/tests/layout-renderer.test.tsx`.

Comando enfocado:

```bash
pnpm exec vitest run src/tests/layout-renderer.test.tsx
```

Debe validar:
- Tablas manuales sin nuevas props renderizan las mismas cabeceras, filas y valores visibles normalizados que antes.
- Cabeceras siguen siendo literales aunque contengan delimitadores `{{...}}`.
- Tablas dinamicas desde `queries.*` e `item.*` siguen degradando a cero filas o celdas vacias cuando faltan datos.
- `queryStateFeedback` y `visibility` conservan su precedencia actual sobre el nodo `table`.

### Filtros locales
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Solo columnas `filterable: true` muestran control de filtro.
- Los filtros se renderizan encima de la tabla, alineados a la izquierda, fuera de `thead` y sin anadir filas de cabecera.
- El control de filtro es nativo, tiene label accesible `Filtrar {header}` y no depende del placeholder como nombre accesible.
- El placeholder efectivo es el nombre de la columna por defecto y puede sobrescribirse con `filterPlaceholder`.
- `Reiniciar filtros` no aparece sin filtros activos, aparece cuando cualquier filtro tiene valor efectivo y limpia todos los filtros de la tabla al activarse.
- El filtro actua sobre el valor visible final de celdas manuales y dinamicas.
- Coincidencias parciales, diferencias de capitalizacion y tildes funcionan.
- Dos filtros activos en columnas distintas aplican `AND`.
- Cero coincidencias deja tabla sin filas de cuerpo, sin romper cabeceras.
- Dos tablas en la misma pagina no comparten filtros.
- Escribir filtros no dispara red ni muta dominios del runtime ajenos a la tabla.

### Ordenacion local
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Solo columnas `sortable: true` muestran control `Ordenar {header}`.
- Una columna no sortable no permite activar ordenacion.
- Primer click ordena ascendente; segundo click en la misma columna ordena descendente; tercer click limpia la ordenacion.
- Click en otra columna sortable sustituye la ordenacion anterior.
- La cabecera activa expone `aria-sort="ascending"` o `aria-sort="descending"`; tras limpiar o en cabeceras ordenables inactivas expone `aria-sort="none"` y las no ordenables no declaran `aria-sort`.
- La ordenacion usa valores visibles finales, incluidas celdas interpoladas.
- Valores vacios o mixtos no rompen render y mantienen orden estable.
- Filtrado y ordenacion juntos respetan el orden de procesamiento: resolver filas -> filtrar -> ordenar.
- Dos tablas en la misma pagina no comparten ordenacion.
- Ordenar no dispara red ni muta dominios del runtime ajenos a la tabla.

### Paginacion `previousNext`
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Con 5 filas y `pageSize: 2`, la tabla muestra inicialmente las 2 primeras filas.
- `Siguiente` muestra filas 3 y 4 y despues la fila 5.
- `Anterior` y `Siguiente` respetan limites de primera y ultima pagina.
- Omitir `controls` o declarar `controls: {}` conserva default `previousNext`.
- Con cero filas o una sola pagina efectiva no hay controles accionables.
- Los controles no son filas del `tbody`.
- Cambiar filtros, ordenacion, filas o `pageSize` reinicia a una pagina valida.
- Dos tablas paginadas no comparten pagina activa.
- Cambiar pagina no dispara red ni muta queries, navegacion o formularios.

### Paginacion `numbered`
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Con 5 filas y `pageSize: 2`, se renderizan `Primera`, `Anterior`, paginas concretas, `Siguiente` y `Última`.
- La pagina activa queda identificada con `aria-current="page"`.
- Seleccionar pagina 2 muestra filas 3 y 4.
- `Última` muestra la ultima pagina parcial.
- Con mas de cinco paginas se renderiza la ventana compacta esperada.
- En primera y ultima pagina los controles de limite quedan deshabilitados.
- La paginacion se aplica despues de filtros y ordenacion.
- Cambiar filtros u ordenacion reinicia a pagina inicial valida.

### Paginacion `scroll`
Archivo: `src/tests/layout-renderer.test.tsx`.

Debe validar:
- Con 5 filas y `pageSize: 2`, el primer render muestra 2 filas.
- Con `IntersectionObserver` mockeado, cada interseccion amplia la ventana por bloques hasta mostrar todas las filas.
- Al llegar al final desaparece el sentinel o accion local.
- Sin `IntersectionObserver`, aparece `Mostrar más`, incrementa localmente y desaparece al final.
- Cambiar filtros, ordenacion, filas, `pageSize` o variante reinicia la cantidad visible.
- Dos tablas `scroll` no comparten ventana visible.
- Una tabla dentro de `repeater` que usa `item.*` mantiene estado local por instancia renderizada.
- Avanzar por scroll no dispara red ni muta queries, navegacion o formularios.

## E2E
No aplican tests e2e para esta entrega. No hay backend real, routing externo ni comportamiento de navegador que no pueda cubrirse con jsdom, estado controlado y mocks de `IntersectionObserver`.

## Secuencia recomendada tests-first
1. En `T0042-01`, escribir primero tests de aceptacion y rechazo de `props.columns`; despues ajustar tipos, schema y validacion.
2. En `T0042-02`, escribir primero tests de aceptacion y rechazo de `props.pagination` en `table`; despues reutilizar el contrato local existente.
3. En `T0042-03`, escribir unit tests del helper puro antes de tocar `TableNode`.
4. En `T0042-04`, escribir tests de renderer de filtros con una tabla manual, una dinamica y dos tablas independientes, cubriendo ubicacion superior, placeholders, reset y accesibilidad; despues conectar UI y estado local.
5. En `T0042-05`, escribir tests de ordenacion y accesibilidad de cabecera; despues conectar botones y `aria-sort`.
6. En `T0042-06`, escribir tests de `previousNext` y `numbered`; despues conectar paginacion sobre filas ya filtradas y ordenadas.
7. En `T0042-07`, escribir tests de `scroll`, reset, independencia y regresion final; despues cerrar con suite enfocada y `pnpm test`.
8. En `T0042-08`, no escribir tests nuevos; actualizar documentacion solo despues de confirmar que `pnpm test` paso con coverage.

## Comandos de cierre por tarea

`T0042-01` y `T0042-02`:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

`T0042-03`:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts
```

`T0042-04` y `T0042-05`:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

`T0042-06`:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-table-processing.test.ts src/tests/runtime-collection-pagination.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

`T0042-07` y cierre de implementacion:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-table-processing.test.ts src/tests/runtime-collection-pagination.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
pnpm test
```
