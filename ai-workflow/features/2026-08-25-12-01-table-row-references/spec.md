# Spec: table-row-references

## Objetivo
Eliminar la ambigüedad de `item.*` en `table`: hoy ese namespace significa dos cosas distintas (el item ambiental de un `repeater` exterior en `props.rows.source`, y el dato de la fila actual dentro de las celdas dinámicas), y cuando una `table` dinámica vive dentro de un `repeater`, el `item.*` de la fila sombrea por completo el `item.*` del `repeater` exterior. Se introduce un namespace propio `row.*` para el contexto de fila de `table`, de forma que una `table` anidada pueda referenciar simultáneamente el item del `repeater` ancestro y su propia fila sin que uno pise al otro. Se añade además `row.$index`, un índice de fila hoy inexistente en el contrato.

## Alcance
- Nuevo namespace de referencia `row.*`, disponible en las mismas superficies donde hoy aplica `item.*` para el contexto de fila de `table`: celdas-nodo en modo dinámico (`rows.cells`), y celdas string manuales y dinámicas (forma de referencia completa e interpolación parcial `{{row...}}`).
- `row.*` navega los datos de la fila actual con la misma semántica de segmentos anidados que hoy usa `item.*` (numérico como índice solo si el valor actual es array, clave literal si es objeto).
- Nueva referencia sintética `row.$index`: entero **1-based** que expone la posición de la fila dentro de la vista actualmente visible de la tabla (tras aplicar filtros, ordenación y paginación local). Disponible en celdas-nodo y celdas string, tanto en modo dinámico como en modo manual.
- En modo manual, las celdas ganan acceso a `row.$index` (numeración de fila) pero no a ningún otro segmento de `row.*`, porque en modo manual no existe una fuente de datos subyacente que navegar — solo valores literales por celda.
- `table.props.rows.source` mantiene sin cambios su forma literal `'item.*'`: sigue refiriéndose al item del `repeater` ambiental que provee el array de filas, no a la fila propia de la tabla. Es una familia de referencia distinta de `row.*` y no se ve afectada por este cambio.
- Dentro de las celdas de una `table` (cualquier modo), `item.*` deja de resolver como contexto de fila. Cuando la `table` está anidada dentro de un `repeater`, `item`/`item.*`/`item.$key`/`item.$index` dentro de sus celdas pasan a resolver contra el item del `repeater` ancestro más cercano, sin ser sombreados por la fila de la tabla.
- Actualización de la documentación funcional afectada (ver sección dedicada más abajo).

## Fuera de alcance
- `list`, `select`, `radioGroup`, `checkboxGroup`: su uso de `item.*` como valor de `source` (fuente de colección tomada del item de un `repeater` ambiental) no cambia. Ninguno de estos nodos gana `row.*` ni ningún índice sintético nuevo — no tienen un contexto de "fila propia" equivalente al de `table`.
- No se introduce compatibilidad retroactiva, alias ni modo dual `item.*`/`row.*` para el contexto de fila de `table`. Es un cambio de comportamiento intencional y definitivo.
- No se modifica el pipeline local de `table` (orden filas → filtros → ordenación → paginación se mantiene igual); `row.$index` solo se calcula sobre el resultado ya existente de ese pipeline, sin alterarlo.
- No se añade ningún índice equivalente a nivel de `repeater`: `item.$index` ya existe y no cambia.
- No se resuelve procesamiento remoto de tablas ni edición avanzada de tablas — siguen fuera de v1 según `current-state.md`.
- No se garantiza estabilidad de `row.$index` entre vistas distintas: cambia cuando cambia la vista (filtro, orden o página), por diseño — no es un identificador estable de fila.

## Requisitos funcionales
1. Dentro de celdas-nodo en modo dinámico de `table` (`rows.cells`), el subárbol de nodos accede a los datos de la fila actual mediante `row` en vez de `item`.
2. Dentro de celdas string (manual y dinámico) de `table`, tanto la forma de referencia completa como la interpolación parcial `{{row...}}` resuelven contra los datos de la fila actual.
3. `row` admite navegación anidada (`row.slug`, `row.meta.author.name`, `row.tags.0`) con la misma semántica de segmentos que `item` hoy.
4. `row.$index` expone un entero 1-based con la posición de la fila dentro de la vista actualmente visible (tras filtros, ordenación y paginación local), disponible en celdas-nodo y celdas string, en modo dinámico y en modo manual.
5. En modo manual, las celdas-nodo y celdas string ganan acceso a `row.$index`, pero no a ningún otro segmento de `row.*` (sin dato subyacente que navegar).
6. Cuando una `table` vive dentro del subárbol iterado de un `repeater`, `item` (e `item.*`, `item.$key`, `item.$index`) dentro de las celdas de esa `table` sigue resolviendo contra el item del `repeater` ancestro más cercano, sin ser sombreado por `row`.
7. Dentro de una celda de `table`, `item` ya no resuelve nunca como contexto de fila propio de la tabla — su único significado posible ahí es el del `repeater` ancestro (o queda sin resolver si no hay `repeater` ancestro).
8. `table.props.rows.source` mantiene sin cambios su forma literal `'item.*'` como origen del array de filas desde el item del `repeater` ambiental.
9. Un config existente que use `item.*` como contexto de fila dentro de celdas de `table` degrada silenciosamente (string vacío en superficies visibles) — mismo comportamiento que ya aplica hoy a cualquier referencia reconocida pero fuera de contrato (por ejemplo `item.*` fuera de un `repeater`). No se rechaza el config en bootstrap.

## Requisitos no funcionales
- `row.*` se documenta con el mismo nivel de detalle y estructura ya usado para `item.*` en `reference-resolution.md` (secciones "Frontera específica de `row.*`" y "Frontera específica de `row.$index`").
- El cambio no altera el comportamiento observable de `repeater`, `list`, `select`, `radioGroup`, `checkboxGroup`.
- El cambio no altera el pipeline local de filtros/ordenación/paginación de `table` más allá de exponer `row.$index` sobre su resultado ya calculado.
- Se mantiene el umbral global de cobertura del 80% sobre `src/`.

## Criterios de aceptación
- Una `table` dinámica anidada dentro de un `repeater`, con una celda que referencia simultáneamente `item.algo` (del `repeater`) y `row.algo` (de la fila de la tabla) en el mismo string interpolado, muestra ambos valores correctamente a la vez.
- Una `table` dinámica NO anidada en `repeater`, con celdas que antes usaban `item.*` para acceder a la fila, deja de mostrar ese valor (degrada a vacío) tras el cambio si no se migra a `row.*`; al migrar la celda a `row.*`, vuelve a mostrar el valor correcto.
- Una `table` con paginación local activa muestra `row.$index` como la posición 1-based dentro de la página actualmente visible, no la posición en el array completo de filas.
- Cambiar de página, aplicar un filtro o cambiar la ordenación de una `table` recalcula `row.$index` para reflejar la nueva vista, de forma contigua sobre las filas visibles.
- Una `table` en modo manual con una celda-nodo que interpola `{{row.$index}}` muestra el número de fila 1-based correcto; una celda-nodo en modo manual que intente navegar `row.algo` (dato) degrada a vacío, ya que no existe dato subyacente que navegar en modo manual.
- `table.props.rows.source: 'item.*'` sigue funcionando exactamente igual que antes del cambio.

## Casos límite
- `table` dinámica sin `repeater` ancestro: `item` dentro de sus celdas no resuelve nada (comportamiento ya existente para `item.*` fuera de un `repeater`); `row.*` sigue resolviendo con normalidad contra la fila.
- `table` anidada en un `repeater` cuya fuente es un objeto plano (con `item.$key` disponible): `item.$key` sigue accesible sin cambios dentro de las celdas de la `table` anidada.
- `container` anidado recursivamente dentro de una celda: `row` (y `row.$index`) se propaga tan profundo como hoy se propaga `item`.
- Filtros que excluyen filas: `row.$index` de las filas restantes se recalcula de forma contigua (1, 2, 3…) sobre el subconjunto visible, sin huecos.
- Paginación tipo `scroll` (ventana acumulada): `row.$index` refleja la posición dentro de la ventana acumulada visible en cada momento, no solo la de la última página cargada.
- Celda-nodo con `visibility` oculta o `queryStateFeedback` en estado oculto: sigue renderizando vacía sin romper la fila, con independencia de si referencia `row` o `item`.
- `row.$index` nunca colisiona con una propiedad literal llamada `$index` dentro del dato de la fila — misma precedencia de propiedad sintética que ya aplica a `item.$index`.

## Áreas de producto afectadas
- Catálogo de nodos: [`table.md`](../../docs/app-features/nodes/table.md).
- Referencias y reactividad declarativa: [`reference-resolution.md`](../../docs/app-features/references/reference-resolution.md), [`dynamic-strings.md`](../../docs/app-features/references/dynamic-strings.md).
- Queries: [`state-model.md`](../../docs/app-features/queries/state-model.md) (mención genérica de `item.*` en proyecciones de colección).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/table.md`: contrato de celdas, reglas de render, pipeline de procesamiento, degradación.
- `ai-workflow/docs/app-features/references/reference-resolution.md`: nueva familia `row.*`/`row.$index`, ajuste de la frontera de `item.*`.
- `ai-workflow/docs/app-features/references/dynamic-strings.md`: superficies de interpolación parcial de `table`, semántica de placeholders.
- `ai-workflow/docs/app-features/queries/state-model.md`: ajustar la mención de `item.*` en "proyecciones interpoladas de colecciones" para diferenciar `row.*` en el caso de `table`.

## Riesgos o preguntas abiertas
- Resuelto en `design.md` (decisión D1): `RuntimeIterationContext` se extiende con slots hermanos `row`/`rowIndex` junto a `item`/`key`/`itemKey`/`itemIndex`, en vez de anidar el contexto padre en una pila; el caso real de composición está acotado a dos roles fijos (item del `repeater` ancestro más cercano + row de la `table` propia), ya que una `table` no puede anidar otra `table` ni un `repeater` dentro de una celda.
- Resuelto en `design.md` (decisión D2): `row` se registra como namespace de primera clase en `src/config/runtime-reference-syntax.ts` junto a `item`, con el mismo patrón condicional (`allowRowReference` análogo a `allowItemReference`), para mantener un único punto de verdad de sintaxis de referencias tal y como exige `architecture.md`.
- No quedan preguntas de producto abiertas: alcance del rename, compatibilidad, semántica de `row.$index` (base numérica, posición visible vs. estable, disponibilidad en modo manual) y comportamiento ante `item.*` legacy quedaron cerrados en la conversación de exploración previa y en esta fase de spec.
