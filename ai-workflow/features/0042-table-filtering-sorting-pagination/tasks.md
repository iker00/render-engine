# Tasks: Table filtering, sorting and pagination

## Orden de ejecucion
Implementar las tareas en orden estricto: `T0042-01` -> `T0042-02` -> `T0042-03` -> `T0042-04` -> `T0042-05` -> `T0042-06` -> `T0042-07` -> `T0042-08`.

`T0042-01` y `T0042-02` cierran el contrato validado. `T0042-03` crea la logica pura reusable de procesamiento local. `T0042-04` y `T0042-05` conectan filtros y ordenacion. `T0042-06` y `T0042-07` conectan las variantes de paginacion local. `T0042-08` queda para la pasada documental posterior.

No quedan tareas pendientes dentro del alcance de la feature.

## T0042-01 - Contrato y validacion de `table.props.columns`

### ID
T0042-01

### Estado
Completada.

### Objetivo
Ampliar el contrato de `table` para aceptar `props.columns` como lista parcial de columnas configuradas por `id`, validando filtros y ordenacion opt-in antes del render.

### Fuera de alcance
- No renderizar filtros ni controles de ordenacion.
- No implementar procesamiento local de filas.
- No anadir paginacion de tabla.
- No cambiar el comportamiento de tablas sin `props.columns`.
- No aceptar metadatos remotos ni campos de comparadores, operadores, tipos o transformaciones avanzadas.

### Dependencias
- `spec.md` listo.
- `design.md` listo.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/config/runtime-config-types.ts`: anadir tipos para `TableColumnConfig` y extender `TableLayoutNode.props.columns`, incluyendo `filterPlaceholder?: string` para filtros.
  - `src/config/runtime-config-zod.ts`: anadir schema cerrado para `columns` con `id`, `filterable?: true`, `filterPlaceholder?: string` y `sortable?: true`.
  - `src/config/validate-runtime-config.ts`: validar lista parcial por `id`, ids duplicados, ids inexistentes, ids que coinciden con cabeceras duplicadas, flags distintos de `true`, placeholder no vacio solo en columnas filtrables, entradas sin capacidad activa y claves extra con diagnostico trazable.
  - `src/config/runtime-config.ts`: revisar reexport si la fachada publica necesita exponer tipos nuevos.
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Aceptar una tabla con `headers` de varias columnas y `columns` declarando solo una columna filtrable.
- Aceptar una columna con `filterable: true`, una con `sortable: true` y una con ambas capacidades.
- Aceptar `filterPlaceholder` no vacio en una columna con `filterable: true`.
- Confirmar que las cabeceras no declaradas en `columns` siguen presentes en el config normalizado sin metadata artificial.
- Rechazar `columns[].id` vacio, inexistente en `headers`, duplicado dentro de `columns` o ambiguo por coincidir con mas de una cabecera visible.
- Rechazar `filterable: false`, `sortable: false` y cualquier valor distinto de `true`.
- Rechazar `filterPlaceholder` vacio o declarado en una columna que no sea filtrable.
- Rechazar una entrada de `columns` que declare solo `id` sin `filterable: true` ni `sortable: true`.
- Rechazar claves extra dentro de `columns[]`, incluidas claves con apariencia remota como `mode`, `remote`, `query`, `params`, `request`, `sort`, `order`, `filters`, `total`, `cursor`, `limit`, `offset`, `page` y `hasNext`.
- Mantener validas y sin cambios observables las tablas existentes sin `props.columns`.

### Documentacion afectada
Cerrado en `T0042-08`: documentar `props.columns` como lista parcial por `id`, las capacidades `filterable`, `filterPlaceholder` y `sortable`, y las reglas de rechazo.

### Criterios de finalizacion
- El contrato tipado representa `columns` como opcional y parcial.
- La validacion previa al render rechaza configuraciones ambiguas o remotas con rutas concretas.
- Una tabla sin `columns` conserva el resultado normalizado historico.
- Los tests de validacion cubren aceptacion, rechazo y compatibilidad hacia atras.

### Cierre de implementacion
Completado cuando pasan los tests enfocados de contrato con:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-02 - Contrato y validacion de `table.props.pagination`

### ID
T0042-02

### Estado
Completada.

### Objetivo
Permitir `props.pagination` en `table` con el mismo shape local ya soportado por `repeater`: `enabled: true`, `pageSize` entero positivo y `controls.variant?: 'previousNext' | 'numbered' | 'scroll'`.

### Fuera de alcance
- No renderizar controles de paginacion.
- No paginar filas todavia.
- No modificar el contrato de `repeater`.
- No aceptar paginacion remota, cursores, totales de servidor, selector de tamano ni salto directo.

### Dependencias
- `T0042-01` completada.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/config/runtime-config-types.ts`: reutilizar `RuntimeCollectionPaginationConfig` en `TableLayoutNode.props.pagination`.
  - `src/config/runtime-config-zod.ts`: aceptar `props.pagination` en `table` reutilizando el schema local cerrado.
  - `src/config/validate-runtime-config.ts`: mapear errores de paginacion de tabla con rutas enfocadas equivalentes a `repeater`.
  - `src/config/runtime-config.ts`: revisar reexport si aplica.
- Tests a crear o modificar:
  - `src/tests/runtime-config-validation.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Aceptar `table.props.pagination` con `controls.variant: 'previousNext'`, `numbered` y `scroll`.
- Aceptar `pagination.controls` omitido y `controls: {}` como default efectivo compatible con `previousNext`.
- Rechazar `enabled: false`, ausencia de `enabled`, ausencia de `pageSize`, `pageSize` no entero, `pageSize <= 0` y `pageSize` no finito.
- Rechazar variantes desconocidas con ruta `props.pagination.controls.variant`.
- Rechazar claves extra dentro de `props.pagination` y `props.pagination.controls`, incluidas `remote`, `cursor`, `total`, `page`, `limit`, `offset` y `hasNext`.
- Confirmar que una tabla sin `props.pagination` conserva el resultado normalizado historico.

### Documentacion afectada
Cerrado en `T0042-08`: documentar `table.props.pagination` como paginacion local opt-in y separada de paginacion remota futura.

### Criterios de finalizacion
- `table` acepta el mismo vocabulario local que `repeater` sin duplicar un shape incompatible.
- La ausencia de `props.pagination` sigue siendo el unico modo de no paginar.
- La validacion rechaza cualquier configuracion inerte, ambigua o con apariencia remota.
- Los diagnosticos apuntan a la propiedad concreta que falla.

### Cierre de implementacion
Completado cuando pasan los tests enfocados de contrato con:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-03 - Modelo puro de procesamiento local de tabla

### ID
T0042-03

### Estado
Completada.

### Objetivo
Crear una capa pura y testeable para procesar filas de tabla ya materializadas como valores visibles: resolver columnas configuradas a indices, aplicar filtros locales por columna y aplicar ordenacion local estable por una unica columna activa.

### Fuera de alcance
- No renderizar controles React.
- No leer directamente de `RuntimeState`, `queries.*`, `forms.*` ni DOM.
- No implementar paginacion.
- No cambiar la resolucion central de referencias ni crear un motor general de transformaciones de coleccion.
- No introducir comparadores por tipo, operadores configurables ni ordenacion multiple.

### Dependencias
- `T0042-01` completada.

### Impacto esperado en archivos
- Codigo a crear o modificar:
  - `src/runtime/runtime-table-processing.ts`: helper puro para normalizacion de busqueda, resolucion de columnas configuradas, filtros `AND` y ordenacion estable.
  - `src/runtime/nodes/table-layout-node.tsx`: solo si conviene mover la normalizacion visible actual para consumir el helper en tareas posteriores.
  - `src/config/runtime-config-types.ts`: solo si hacen falta tipos internos compartidos para estado de filtros u ordenacion.
- Tests a crear o modificar:
  - `src/tests/runtime-table-processing.test.ts`
- Documentacion a revisar o actualizar:
  - Ninguna directa en esta tarea.

### Tests requeridos
- Resolver `columns[].id` contra `headers` sin asumir que `columns[index]` corresponde a `headers[index]`.
- Filtrar por coincidencia parcial sobre la celda visible final.
- Comparar filtros sin sensibilidad a mayusculas, minusculas ni tildes.
- Tratar filtros vacios como no restrictivos.
- Combinar varios filtros activos con semantica `AND`.
- Devolver cero filas cuando ningun filtro coincide sin lanzar errores.
- Ordenar ascendente y descendente por una sola columna activa.
- Limpiar la ordenacion activa al pedir por tercera vez la misma columna.
- Sustituir la columna activa cuando se pide ordenar por otra columna.
- Mantener el orden original cuando no hay ordenacion activa.
- Mantener orden estable en empates y con celdas ausentes o vacias.
- No mutar la coleccion de filas de entrada.

### Documentacion afectada
Ninguna en esta tarea. El comportamiento estable se documentara al cierre de la feature.

### Criterios de finalizacion
- La logica de filtros y ordenacion vive fuera del componente visual.
- El helper opera sobre strings visibles ya materializados y no reimplementa resolucion de referencias.
- La normalizacion de texto usada por filtros queda centralizada y probada.
- La ordenacion es determinista y estable.

### Cierre de implementacion
Completado cuando pasan los unit tests del helper con:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts
```

### Cierre documental
Ninguno.

## T0042-04 - Filtros locales por columna en `TableNode`

### ID
T0042-04

### Estado
Completada.

### Objetivo
Integrar filtros locales por columna en `TableNode`, usando estado local por instancia y el helper de `T0042-03` sobre las filas ya resueltas por la tabla.

### Fuera de alcance
- No implementar ordenacion interactiva.
- No implementar paginacion.
- No disparar red ni modificar `queries.*`, navegacion, formularios o `pageEntry`.
- No anadir filtro global, operadores, rangos, tipos, multiseleccion ni personalizacion visual declarativa.

### Dependencias
- `T0042-03` completada.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/table-layout-node.tsx`: materializar filas visibles, mantener `filterValues` locales por `columns[].id`, renderizar la barra superior de filtros con placeholders y reset, y aplicar filtros antes de renderizar el `tbody`.
  - `src/runtime/runtime-table-processing.ts`: ajustes menores si la integracion revela un caso no cubierto.
  - `src/runtime/runtime-node-styling.ts`: helpers de clases para barra superior de filtros, campos, labels ocultas, inputs compactos y boton de reset de tabla.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-table-processing.test.ts` solo si falta algun borde del helper.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Una tabla sin `columns` renderiza las mismas cabeceras y filas que antes y no muestra controles de filtro.
- Una tabla con una sola columna filtrable muestra un control nativo `type="search"` encima de la tabla, alineado a la izquierda, con nombre accesible `Filtrar {header}` solo para esa columna.
- Los filtros no se renderizan como fila dentro de `thead`.
- El placeholder efectivo usa el nombre de columna por defecto y respeta `filterPlaceholder` cuando se declara.
- El boton `Reiniciar filtros` aparece solo con filtros activos y limpia todos los filtros al activarse.
- Escribir un filtro reduce las filas visibles por coincidencia parcial sobre esa columna.
- El filtrado funciona con distinta capitalizacion y con tildes.
- Dos filtros activos en columnas distintas se combinan con semantica `AND`.
- Un filtro sin coincidencias deja la tabla con cero filas de cuerpo sin romper cabeceras ni pantalla.
- Las celdas dinamicas interpoladas se filtran por el valor visible final.
- Varias tablas en la misma pagina no comparten valores de filtro.
- Cambiar filtros no llama a `fetch`, no despacha acciones de query y no modifica navegacion ni formularios.

### Documentacion afectada
Cerrado en `T0042-08`: documentar filtros locales por columna, semantica `AND`, normalizacion de texto y ausencia de red.

### Criterios de finalizacion
- Los filtros solo aparecen en columnas declaradas con `filterable: true` y en una barra superior a la tabla.
- Las columnas no filtrables no ofrecen control interactivo de filtro.
- El estado de filtro pertenece a cada instancia de tabla.
- El procesamiento se aplica despues de resolver filas y antes de cualquier ordenacion o paginacion futura.
- La UI usa controles nativos accesibles, labels independientes del placeholder, reset condicionado y clases centralizadas.

### Cierre de implementacion
Completado cuando pasan los tests enfocados de helper, renderer y styling con:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-05 - Ordenacion local por columna en `TableNode`

### ID
T0042-05

### Estado
Completada.

### Objetivo
Integrar ordenacion local interactiva por una unica columna activa en `TableNode`, habilitada solo para columnas con `sortable: true` y aplicada sobre los valores visibles finales.

### Fuera de alcance
- No implementar ordenacion multiple.
- No anadir comparadores configurables, ordenacion por expresiones ni ordenacion tipada.
- No implementar paginacion.
- No anadir controles separados para limpiar la ordenacion activa; v1 limpia la ordenacion con el tercer click sobre la misma columna.
- No disparar red ni modificar `queries.*`.

### Dependencias
- `T0042-04` completada.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/table-layout-node.tsx`: estado local de ordenacion `{ columnId, direction }`, botones de cabecera y aplicacion de ordenacion despues de filtros.
  - `src/runtime/runtime-table-processing.ts`: consumir o ajustar helper de ordenacion estable.
  - `src/runtime/runtime-node-styling.ts`: helpers de clases para cabecera ordenable, boton de cabecera e indicador compacto.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-table-processing.test.ts`
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Una columna no marcada como ordenable no renderiza boton de ordenacion.
- Una columna ordenable renderiza un control accesible con nombre `Ordenar {header}`.
- El primer click sobre una columna ordenable ordena ascendente.
- El segundo click sobre la misma columna ordena descendente.
- El tercer click sobre la misma columna elimina la ordenacion activa y restaura el orden resuelto original.
- Al ordenar otra columna, la ordenacion anterior deja de aplicar y la nueva columna empieza en ascendente.
- `aria-sort` queda en `ascending` o `descending` en la cabecera activa, `none` en cabeceras ordenables inactivas y ausente en cabeceras no ordenables.
- La ordenacion usa el valor visible final de celdas manuales y dinamicas.
- Valores vacios, booleanos, numeros y strings visibles mezclados no rompen el render y mantienen orden estable en empates.
- Filtrar y ordenar juntos respeta el orden de procesamiento: filas resueltas -> filtros -> ordenacion.
- Varias tablas en la misma pagina no comparten estado de ordenacion.
- Cambiar ordenacion no llama a `fetch`, no despacha acciones de query y no modifica navegacion ni formularios.

### Documentacion afectada
Cerrado en `T0042-08`: documentar ordenacion local por una unica columna, ciclo ascendente/descendente/sin ordenacion, estado inicial sin ordenacion y ausencia de red.

### Criterios de finalizacion
- Solo las columnas `sortable: true` permiten activar ordenacion.
- La ordenacion activa es unica por tabla.
- El orden original se conserva mientras no exista ordenacion activa.
- La ordenacion se aplica despues de filtros y antes de paginacion futura.
- La UI de cabecera sigue siendo semantica y accesible.

### Cierre de implementacion
Completado cuando pasan los tests enfocados con:

```bash
pnpm exec vitest run src/tests/runtime-table-processing.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-06 - Paginacion local `previousNext` y `numbered` en `TableNode`

### ID
T0042-06

### Estado
Completada.

### Objetivo
Integrar paginacion local por paginas en `TableNode` para las variantes `previousNext` y `numbered`, usando `runtime-collection-pagination` sobre el resultado ya filtrado y ordenado.

### Fuera de alcance
- No implementar todavia la variante `scroll`.
- No anadir selector de `pageSize`, salto directo por input, seleccion de filas ni acciones por fila.
- No mover pagina activa a `runtime-state`, hash, URL ni query params.
- No disparar red ni modificar `queries.*`.

### Dependencias
- `T0042-05` completada.
- `T0042-02` completada.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/table-layout-node.tsx`: estado local de pagina activa, derivacion de pagina visible, render de controles `previousNext` y `numbered`, reset por filtros, ordenacion, filas o configuracion efectiva.
  - `src/runtime/runtime-collection-pagination.ts`: solo si hace falta una API menor ya cubierta por tests.
  - `src/runtime/runtime-node-styling.ts`: helpers de clases para controles de paginacion de tabla, boton normal y boton actual.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-collection-pagination.test.ts` solo si se modifica el helper compartido.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Tabla paginada con 5 filas y `pageSize: 2`: render inicial de las 2 primeras filas.
- Con default efectivo `previousNext`, `Siguiente` muestra filas 3 y 4, otro click muestra fila 5 y los limites quedan deshabilitados.
- `Anterior` no retrocede desde la primera pagina y `Siguiente` no avanza desde la ultima.
- Omitir `controls` o declarar `controls: {}` conserva comportamiento `previousNext`.
- Variante `numbered` muestra `Primera`, `Anterior`, ventana compacta de paginas, `Siguiente` y `Última`.
- En `numbered`, la pagina activa usa `aria-current="page"` y permite seleccionar una pagina concreta.
- Con una sola pagina efectiva o cero filas tras filtros no se renderizan controles accionables.
- La paginacion se aplica despues de filtros y ordenacion.
- Cambiar filtros u ordenacion reinicia a la primera pagina.
- Reemplazar la coleccion origen por refetch o rerender deja la pagina activa en una posicion valida.
- Dos tablas paginadas en la misma pantalla mantienen paginas activas independientes aunque lean la misma query.
- Los controles de paginacion se renderizan fuera del `tbody`, no como filas adicionales.
- Avanzar pagina no llama a `fetch`, no despacha acciones de query y no modifica navegacion ni formularios.

### Documentacion afectada
Cerrado en `T0042-08`: documentar `previousNext`, `numbered`, orden de procesamiento, reset y controles propios de tabla.

### Criterios de finalizacion
- `table.props.pagination` limita filas visibles solo cuando esta declarado.
- `previousNext` es el default efectivo cuando `controls` o `controls.variant` se omiten.
- `numbered` reutiliza la ventana compacta del helper compartido.
- La paginacion cuenta filas ya filtradas y ordenadas.
- Los controles no forman parte de las filas de datos.
- El estado de pagina es local e independiente por instancia.

### Cierre de implementacion
Completado cuando pasan los tests enfocados con:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-table-processing.test.ts src/tests/runtime-collection-pagination.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-07 - Variante `scroll` y regresion final de runtime

### ID
T0042-07

### Estado
Completada.

### Objetivo
Implementar la variante `scroll` de paginacion local de tabla y cerrar las regresiones integradas de aislamiento, degradacion segura, `queryStateFeedback`, `item.*` dentro de `repeater` y ausencia de efectos remotos.

### Fuera de alcance
- No implementar infinite scroll remoto, cursores, refetch, virtualizacion ni cache remota.
- No cambiar la variante `scroll` de `repeater`.
- No cambiar la semantica de `queryStateFeedback`, `visibility`, `preloads` ni ejecucion remota.
- No anadir personalizacion visual declarativa.

### Dependencias
- `T0042-06` completada.

### Impacto esperado en archivos
- Codigo a modificar:
  - `src/runtime/nodes/table-layout-node.tsx`: ventana local acumulada, sentinel con `IntersectionObserver`, fallback `Mostrar más`, reset de cantidad visible y limpieza de observer.
  - `src/runtime/runtime-node-styling.ts`: helpers de clases para sentinel o accion fallback de tabla si no quedaron cubiertos en `T0042-06`.
  - `src/runtime/runtime-collection-pagination.ts`: solo si se necesita ajustar `createCollectionScrollWindow` sin cambiar su contrato para `repeater`.
- Tests a crear o modificar:
  - `src/tests/layout-renderer.test.tsx`
  - `src/tests/runtime-node-styling.test.ts`
  - `src/tests/runtime-collection-pagination.test.ts` solo si se modifica el helper compartido.
  - `src/tests/runtime-config-validation.test.ts` solo si aparece un hueco de validacion al integrar.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/docs/current-state.md`

### Tests requeridos
- Con 5 filas y `pageSize: 2`, `scroll` muestra inicialmente 2 filas.
- Con `IntersectionObserver` mockeado, una interseccion muestra 4 filas y otra muestra las 5.
- Cuando todas las filas locales estan visibles desaparece el sentinel o accion que sugiera mas resultados.
- Sin `IntersectionObserver`, se renderiza el boton `Mostrar más`, aumenta por bloques de `pageSize` y desaparece al llegar al final.
- Cambiar filtros, ordenacion, filas resueltas, `pageSize` o variante reinicia la ventana visible a la posicion inicial valida.
- Varias tablas `scroll` mantienen ventanas visibles independientes aunque lean la misma query.
- Tabla dinamica en `loading`, `error`, `idle`, con datos no coleccionables o con `queryStateFeedback` conserva la degradacion actual y no rompe la pantalla.
- Tabla dentro de un `repeater` puede paginar localmente filas alimentadas por `item.*` sin compartir estado entre iteraciones.
- Refetch que conserva `loading` con ultimo `data` valido no deja pagina o ventana fuera de rango cuando luego se reemplaza la coleccion.
- Avanzar por scroll no llama a `fetch`, no despacha acciones de query y no modifica navegacion, formularios ni URL.
- Ejecutar la regresion enfocada de tablas existentes confirma que tablas sin nuevas props mantienen cabeceras, filas y normalizacion visible historicas.

### Documentacion afectada
Cerrado en `T0042-08`: documentar `scroll` como incremento local, su fallback, su diferencia frente a paginacion remota y los limites de query feedback.

### Criterios de finalizacion
- `scroll` opera sobre filas ya filtradas y ordenadas.
- La cantidad visible crece de forma acumulada por bloques de `pageSize`.
- No existe accion visible cuando ya no quedan filas locales ocultas.
- El observer se crea y limpia sin conservar callbacks obsoletos tras reset o desmontaje.
- La degradacion segura de tablas manuales y dinamicas se conserva.
- La suite enfocada de runtime cubre el comportamiento final de la feature.

### Cierre de implementacion
Completado cuando pasan los tests enfocados y el gate global de coverage con:

```bash
pnpm exec vitest run src/tests/runtime-config-validation.test.ts src/tests/runtime-table-processing.test.ts src/tests/runtime-collection-pagination.test.ts src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts
pnpm test
```

### Cierre documental
Cerrado en `T0042-08`.

## T0042-08 - Documentacion funcional y estado de feature

### ID
T0042-08

### Estado
Completada.

### Objetivo
Actualizar la documentacion estable del producto y el estado del workflow para reflejar filtros, ordenacion y paginacion local de `table` una vez que `T0042-01` a `T0042-07` esten implementadas y validadas.

### Fuera de alcance
- No modificar codigo de producto.
- No modificar tests salvo que la documentacion revele una inconsistencia ya implementada y deba corregirse en otra tarea.
- No documentar paginacion remota, cursores, filtros avanzados, ordenacion multiple ni capacidades fuera de la spec.
- No convertir `README.md` en changelog.

### Dependencias
- `T0042-01` a `T0042-07` con cierre de implementacion.
- `pnpm test` en verde y coverage gate superado.

### Impacto esperado en archivos
- Codigo a modificar:
  - Ninguno.
- Tests a modificar:
  - Ninguno.
- Documentacion a revisar o actualizar:
  - `ai-workflow/docs/current-state.md`
  - `ai-workflow/docs/app-features/index.md`
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
  - `ai-workflow/docs/app-features/config-contract.md`
  - `ai-workflow/docs/app-features/queries-and-feedback.md`
  - `ai-workflow/features/index.md`
  - `ai-workflow/features/0042-table-filtering-sorting-pagination/status.yaml`

### Tests requeridos
- No requiere tests nuevos.
- Antes de cerrar la documentacion debe constar que la implementacion se valido con `pnpm test` y que el umbral global de coverage sigue superado.

### Documentacion afectada
- `current-state.md`: mover `table` desde limite vigente a capacidad disponible con filtros, ordenacion y paginacion local.
- `config-driven-ui-runtime.md`: describir comportamiento visible de filtros, ordenacion y paginacion de tabla.
- `config-contract.md`: documentar shape de `props.columns` y `props.pagination`, validaciones y limites remotos.
- `queries-and-feedback.md`: aclarar que la tabla procesa localmente datos ya cargados y no modifica `queries.*`.
- `app-features/index.md`: actualizar resumen de fichas si queda desactualizado.
- `features/index.md`: mover o actualizar el estado historico de 0042 cuando corresponda.
- `status.yaml`: reflejar fase documental o cierre completo segun el flujo aplicado.

### Criterios de finalizacion
- La documentacion funcional estable coincide con el comportamiento implementado.
- Los limites fuera de alcance siguen explicitados, especialmente procesamiento remoto, cursores y filtros avanzados.
- El estado vigente deja de afirmar que `table` no pagina.
- El workflow de la feature refleja tareas cerradas, tests en verde, coverage gate y documentacion actualizada.

### Cierre de implementacion
No aplica; esta tarea no modifica codigo.

### Cierre documental
Completado cuando la documentacion listada queda actualizada y `status.yaml` refleja el estado final correspondiente.
