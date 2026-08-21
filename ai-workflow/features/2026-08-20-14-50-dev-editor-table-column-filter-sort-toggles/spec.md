# Spec — dev-editor-table-column-filter-sort-toggles

## Objetivo
El widget dedicado "Filas y columnas" del panel de propiedades de `table` en modo Editor (ver
[[../../docs/app-features/development/dev-mode-editor.md#selección-de-celdas-nodo-y-widget-de-filascolumnas-de-table-modo-editor]])
permite hoy dar de alta/baja columnas y filas y fijar el tipo de cada celda, pero `table.props.columns[].filterable`
y `table.props.columns[].sortable` (ver [[../../docs/app-features/nodes/table.md]]) quedaron explícitamente fuera de
esa entrega (feature 0138) y hoy solo son editables desde Monaco.

Esta feature añade, dentro del propio widget "Filas y columnas", dos controles por columna para activar/desactivar
esas dos capacidades sin depender de Monaco: un check "Ordenable" (`sortable`) y un check "Filtrable"
(`filterable`); al activar "Filtrable" aparece además el campo de texto "Placeholder del filtro"
(`filterPlaceholder`). Los nuevos controles siguen exactamente las convenciones visuales ya vigentes del editor de
nodos (panel de propiedades del modo Editor): interruptor `role="switch"` para booleanos, fila
label-izquierda/control-derecha, sin caja con borde ni fondo, y el mismo pipeline de commit/validación
(`validateRuntimeConfig`) con el mismo criterio de aviso `role="alert"` ante un commit rechazado.

## Alcance

### Ubicación de los nuevos controles
- **Modo Manual**: en la sección "Columnas" del widget (lista de headers con alta/renombrado/baja ya existente),
  cada entrada de header gana, junto a su input de nombre, los dos checks "Ordenable" y "Filtrable".
- **Modo Dinámico**: en la lista reordenable de columnas-plantilla (header + tipo de celda), cada entrada gana los
  mismos dos checks, en el mismo lugar relativo que en modo Manual.
- Ambos checks conviven en la misma columna del `props.headers`/`columns[]` con independencia del tipo de celda
  (texto o nodo) que tenga esa columna en cada fila; el contrato de `filterable`/`sortable` ya es independiente del
  contenido de celda (ver [[../../docs/app-features/nodes/table.md#pipeline-de-procesamiento]]).

### Check "Ordenable" (`sortable`)
- Refleja y edita `table.props.columns[].sortable` para el `id` de esa columna.
- Marcarlo crea la entrada de `columns[]` para ese `id` si no existía (`{ id, sortable: true }`), o añade
  `sortable: true` a una entrada ya existente (por ejemplo, una que ya tuviera `filterable: true`).
- Desmarcarlo quita la clave `sortable` de la entrada; si tras quitarla la entrada ya no declara `filterable: true`
  tampoco, la entrada completa se elimina de `columns[]` (la columna vuelve a ser pasiva).
- No expone ningún campo adicional: `sortable` en el contrato es un booleano puro sin acompañante.

### Check "Filtrable" (`filterable`) y campo "Placeholder del filtro" (`filterPlaceholder`)
- El check refleja y edita `table.props.columns[].filterable` para el `id` de esa columna, con la misma semántica de
  alta/baja de entrada que "Ordenable" (crea la entrada si hace falta; si tras desmarcar tampoco queda
  `sortable: true`, se elimina la entrada completa).
- Mientras el check "Filtrable" está activo, aparece debajo un campo de texto libre "Placeholder del filtro" que
  edita `filterPlaceholder` (literal, sin validación adicional de formato). El campo es opcional: dejarlo vacío no
  añade la clave `filterPlaceholder` a la entrada.
- **Desactivar "Filtrable" descarta el texto ya escrito en `filterPlaceholder`**: la clave se quita del config junto
  con `filterable`. Si el usuario vuelve a marcar "Filtrable" en la misma columna, el campo aparece vacío, sin
  recordar el texto anterior (sin caché de sesión). Decisión confirmada explícitamente para esta feature.

### Independencia entre los dos checks
Los dos checks son independientes entre sí: activar o desactivar uno no modifica el estado del otro dentro de la
misma entrada de `columns[]`. Una columna puede ser solo ordenable, solo filtrable, ambas cosas o ninguna (columna
pasiva, sin entrada en `columns[]`).

### Coherencia con el resto del widget y del panel
- Sin caja con borde ni fondo alrededor de los nuevos controles, coherente con el resto de "Filas y columnas" y del
  panel de propiedades en general.
- El interruptor booleano reutiliza el mismo control ya establecido para campos booleanos genéricos del panel
  (`role="switch"`, `aria-checked`), no un checkbox nativo.
- El campo "Placeholder del filtro" sigue el mismo patrón de fila label-izquierda/control-derecha que cualquier otro
  campo de texto simple del panel.
- Cada cambio (marcar/desmarcar un check, editar el placeholder) pasa por el mismo pipeline de commit/validación
  (`validateRuntimeConfig`) que el resto del widget; un commit rechazado deja el valor tal cual lo dejó el usuario y
  muestra un aviso `role="alert"`, con el mismo criterio de limpieza ya vigente en el resto del panel.

### Comportamiento heredado sin cambios (0138)
- Renombrar un header con una entrada de `columns[]` asociada sigue sincronizando el `id` de esa entrada sin alterar
  `sortable`, `filterable` ni `filterPlaceholder` ya fijados.
- Quitar una columna (header) sigue eliminando su entrada completa de `columns[]`, incluidos `sortable`,
  `filterable` y `filterPlaceholder` si los tenía.
- Añadir una columna nueva sigue sin crear entrada en `columns[]` por defecto (columna pasiva, ambos checks
  desmarcados) hasta que el usuario active alguno de los dos.

## Fuera de alcance
- Filtros globales, por tipo/rango/operador, multiselección de filtros, ordenación múltiple o comparadores
  configurables — ya fuera de v1 según [[../../docs/current-state.md]] y
  [[../../docs/app-features/nodes/table.md#límites-del-nodo]]; esta feature no cambia el comportamiento de runtime
  de filtros/ordenación, solo añade la vía de edición en el panel de desarrollo.
- Edición de `props.pagination` — sin cambios respecto a su comportamiento actual.
- Caché de `filterPlaceholder` al desmarcar "Filtrable" — descartada explícitamente (ver decisión arriba).
- Cualquier cambio de comportamiento del nodo `table` en producción o fuera de modo desarrollo.
- Reordenar columnas por arrastre a partir de estos nuevos controles — el reordenamiento de columnas en modo Manual
  sigue sin soportarse (ya documentado como límite del widget "Filas y columnas").
- Deshacer/rehacer para estas operaciones — mismos límites generales ya documentados para el resto del editor
  visual.

## Requisitos no funcionales
- Sin cambios de comportamiento observable en producción ni en el runtime fuera de modo desarrollo.
- El pipeline de commit/validación (`validateRuntimeConfig`) sigue siendo la única vía de verdad: los nuevos
  controles nunca aplican en memoria un estado que no pase esa validación.
- Los dos checks y el campo de placeholder deben ser operables por teclado y con semántica ARIA adecuada,
  reutilizando los patrones ya establecidos (`role="switch"`/`aria-checked` para booleanos) en vez de introducir un
  patrón nuevo.
- Debe mantenerse el umbral mínimo global de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.

## Criterios de aceptación
1. En modo Manual, cada entrada de la sección "Columnas" muestra los checks "Ordenable" y "Filtrable" junto a su
   input de nombre.
2. En modo Dinámico, cada entrada de la lista de columnas-plantilla muestra los mismos dos checks.
3. Marcar "Ordenable" en una columna sin entrada previa en `columns[]` crea `{ id, sortable: true }`.
4. Marcar "Ordenable" en una columna que ya tenía `{ id, filterable: true }` añade `sortable: true` a la misma
   entrada sin alterar `filterable` ni `filterPlaceholder`.
5. Desmarcar "Ordenable" quita `sortable` de la entrada; si la entrada no declara `filterable: true`, se elimina de
   `columns[]` por completo.
6. Marcar "Filtrable" en una columna sin entrada previa crea `{ id, filterable: true }` y muestra el campo
   "Placeholder del filtro" vacío.
7. Escribir texto en "Placeholder del filtro" mientras "Filtrable" está activo añade `filterPlaceholder` con ese
   texto a la entrada.
8. Desmarcar "Filtrable" oculta el campo "Placeholder del filtro", quita `filterable` y `filterPlaceholder` de la
   entrada (si lo tenía), y conserva `sortable` si estaba marcado; si tampoco queda `sortable: true`, la entrada se
   elimina de `columns[]` por completo.
9. Volver a marcar "Filtrable" tras haberlo desmarcado muestra el campo "Placeholder del filtro" vacío, sin el texto
   escrito anteriormente.
10. Un commit rechazado por validación desde cualquiera de los dos checks o el campo de placeholder deja el valor
    tal cual lo dejó el usuario y muestra un aviso `role="alert"`, con el mismo criterio de limpieza que el resto
    del panel.
11. Renombrar un header con una entrada de `columns[]` asociada sigue sincronizando el `id` sin alterar `sortable`,
    `filterable` ni `filterPlaceholder` ya fijados en esa entrada.
12. Quitar una columna elimina su entrada completa de `columns[]`, incluidos `sortable`, `filterable` y
    `filterPlaceholder` si los tenía.
13. Ningún control nuevo introduce una caja con borde o fondo, y el interruptor booleano usa el mismo control
    `role="switch"` ya vigente para campos booleanos genéricos del panel, no un checkbox nativo.

## Casos límite
- Columna con ambos checks activos (`{ id, filterable: true, sortable: true }`): desmarcar uno de los dos conserva
  el otro en la misma entrada; solo desmarcar ambos elimina la entrada.
- Columna pasiva (sin entrada en `columns[]`) con ambos checks desmarcados por defecto: es el estado inicial normal
  de cualquier columna nueva o no configurada.
- Marcar "Filtrable", escribir un placeholder, desmarcar y volver a marcar "Filtrable" en la misma sesión de edición
  del nodo: el campo aparece vacío (sin recordar el texto previo), coherente con la decisión de no cachear.
- Cambiar el modo de tabla (Manual ⇄ Dinámico) reconstruye `props.rows` desde cero según el comportamiento ya
  vigente del widget (0138); si `props.columns` no depende de `rows` en el schema, las entradas de `columns[]` ya
  fijadas (incluidas las creadas por esta feature) no se ven forzadas a desaparecer solo por el cambio de modo, salvo
  que el propio cambio de modo ya las invalide por otro motivo (por ejemplo, headers que desaparecen).
- Renombrar un header a un texto que coincide con otro header ya existente, cuando ambos tienen entradas en
  `columns[]`: aplica el mismo criterio ya vigente en 0138 (la operación sobre `headers` se acepta, pero un commit
  que produzca ambigüedad sobre `columns[]` se rechaza con el mismo aviso `role="alert"`) — esta feature no introduce
  una validación nueva ni más permisiva.

## Riesgos o preguntas abiertas
Ninguna. El alcance reutiliza en su totalidad el widget, el pipeline de commit/validación y los patrones visuales ya
vigentes (interruptor booleano, fila label-izquierda/control-derecha); no hay decisión arquitectónica ni técnica
pendiente para planificar la implementación.
