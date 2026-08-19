# Design: Feature 0138 - dev-editor-table-cell-editing

## Contexto

> **Revisión post-implementación**: T1–T9 de esta feature ya se implementaron con la disposición
> `role="grid"` original de D5 (T7 `TableCellTypePropertyField`, T8 `TableRowsPropertyField`, T9
> wiring en el panel). El usuario validó el resultado real dentro del panel de propiedades (ancho
> fijo ~370px) y lo consideró inmanejable a ese ancho. Este documento revisa D5 y añade D8 para
> sustituir la cuadrícula por una disposición de secciones apiladas con acordeones y
> reordenamiento por arrastre, sobre dos patrones ya existentes en el propio panel — no se inventa
> mecanismo nuevo. D1–D4, D6 y D7 no cambian: son independientes de la representación visual del
> widget. `spec.md` no cambia: ya deja la disposición concreta abierta a esta fase ("Riesgos o
> preguntas abiertas"). Ver "Preguntas abiertas" sobre una capacidad nueva (reordenamiento) que
> esta revisión incorpora sin que estuviera en los criterios de aceptación originales.

El editor visual del `layout` (modo Editor) identifica y muta nodos mediante un `path` estructural
(`LayoutNodePath`, `src/runtime/layout-node-path.ts`), una secuencia de `LayoutPathStep`. Hoy solo existen tres
variantes de step, todas con forma fija (sin campos opcionales):

- `{ field: 'children', index }` — hijo genérico de `container`/`form`/`modal`/`link`/`accordion`.
- `{ field: 'template', index }` — celda... perdón, elemento de `repeater.props.template` (array plano de un
  único elemento repetido).
- `{ field: 'tabItem', itemIndex, index }` — hijo de una pestaña concreta de `tabs.props.items[itemIndex].children`.

`accordion` no tiene step propio: reenvía su propio `path` sin modificar a `LayoutRenderer`, que añade steps
`children` normales por debajo (mismo patrón que cualquier contenedor). La spec describe esto como precedente para
el nuevo step de celda de tabla, pero `accordion` no es en realidad un cuarto tipo de step — es una reutilización
de `children` con reenvío de path, y así se documenta correctamente en la spec como referencia de comportamiento,
no de forma de step.

El path se resuelve (`getNodeAtPath`), se busca por identidad de nodo (`findNodePath`/`findPathWithinNode` en
`src/dev-runtime/layout-tree-mutations.ts`), se serializa a string estable (`serializeLayoutNodePath`/
`deserializeLayoutNodePath`) para usarlo como key de React, id de arrastre (`@dnd-kit`), atributo `data-node-path`
y comparación de selección/hover, y se usa para aplicar mutaciones inmutables (`replaceNodeAt`, `removeNodeAt`,
`insertNodeAt`, `movePathTo`), todas construidas sobre un primitivo compartido de resolución/reconstrucción de
frames por step. Cada step nuevo debe darse de alta en **todos** estos puntos para no dejar una variante "muda"
que resuelva a `null` en unos flujos y funcione en otros.

`table-layout-node.tsx` renderiza hoy cada celda-nodo vía `LayoutNodeRenderer` sin pasarle `path` en absoluto
(tampoco pasa `path` al `LayoutRenderer` anidado que renderiza los hijos de una celda-`container`), y `TableNode`
ni siquiera recibe `path` como prop desde `layout-node-renderer.tsx`. Por eso todas las celdas-nodo de todas las
tablas de la página resuelven al mismo path vacío `[]` hoy.

El modo manual (`props.rows: TableCellValue[][]`) y el modo dinámico (`props.rows.cells: (string|TableCellNode)[]`)
tienen formas estructurales distintas: el manual es genuinamente 2D (fila × columna), el dinámico es un array plano
de plantillas por columna sin noción de fila real — misma semántica de plantilla compartida que
`repeater.props.template`. Esto hace que un único step no pueda representar ambos modos sin un campo opcional, algo
que el modelo actual evita deliberadamente (`tabItem` usa dos campos obligatorios en vez de uno opcional).

## Objetivos / No objetivos

### Objetivos
- Definir la forma técnica del nuevo step de path para celda de tabla, en ambos modos, coherente con el modelo
  existente.
- Definir cómo se conecta ese path desde `table-layout-node.tsx` hasta cada celda y sus posibles descendientes.
- Definir el mecanismo técnico del widget de filas/columnas/celdas dentro del panel de propiedades existente.
- Definir el tratamiento especial de "Eliminar nodo" sobre una celda y de arrastre de la celda misma (no de sus
  hijos), ambos casos límite ya fijados por la spec pero con impacto arquitectónico en capas compartidas.
- Señalar el punto de extensión de validación para añadir `link` al catálogo de celda.
- Redefinir la disposición visual/interacción del widget de filas/columnas/celdas (D5) ya
  implementado, sustituyendo la cuadrícula `role="grid"` original por secciones apiladas con
  acordeones y reordenamiento por arrastre, validada por el usuario contra el ancho real del panel
  (~370px).

### No objetivos
- No se diseña el detalle visual pixel a pixel del widget (colores, espaciados exactos) — ya cubierto por
  convenciones vigentes del panel.
- No se trocea el trabajo en tareas ni se listan archivos concretos a modificar.
- No se resuelve aquí el copy/etiquetado en español de cada control — detalle de implementación, no de diseño.
- No se resuelve el arrastre accesible por teclado como capacidad general de `@dnd-kit` para todo
  el proyecto — solo se añade un fallback de botones "Subir"/"Bajar" acotado a este widget (D5).

## Decisiones

### D1 — Dos steps nuevos, uno por modo, en vez de un step único con campo opcional
Se añaden dos variantes a `LayoutPathStep`:
- `{ field: 'row', rowIndex: number, index: number }` — celda de fila manual: `table.props.rows[rowIndex][index]`.
- `{ field: 'cells', index: number }` — celda de plantilla en modo dinámico: `table.props.rows.cells[index]`.

En ambos casos `index` identifica la **posición de columna**, no un `id` de `columns[]` — la correspondencia con
`headers` es siempre posicional (mismo criterio que ya usa la validación existente de `table`), y un `id` de
`columns[]` es una propiedad opcional y mutable por renombrado, no un identificador estable de columna.

**Por qué**: el modelo actual ya resuelve el mismo problema (una forma con fila+columna vs. una forma sin fila)
separando `template` de `tabItem` en dos variantes distintas con campos completamente obligatorios en cada una, en
vez de una variante con un campo opcional. Mantener esa convención evita introducir el primer step "parcialmente
opcional" del modelo y mantiene cada función de resolución (`getNodeAtPath`, `stepsEqual`,
`stepsReferenceSameCollection`) con un `switch` exhaustivo sin ramas condicionales internas por modo.

**Alternativa descartada**: un único step `{ field: 'tableCell', rowIndex: number | null, index: number }`, con
`rowIndex: null` en modo dinámico. Se descarta porque introduce el primer campo semánticamente opcional del
modelo, obliga a cada consumidor de `LayoutPathStep` a interpretar `null` como "no aplica" en vez de que la propia
variante lo exprese, y no tiene precedente en el código existente.

**Coste asumido**: dos variantes nuevas en vez de una — más superficie en el `switch` de cada función, pero cada
rama es más simple al no manejar un campo condicional.

### D2 — `path` se propaga desde `table` hasta cada celda y sus descendientes, igual que `accordion`
`layout-node-renderer.tsx` empieza a pasar `path` a `TableNode` (hoy no lo recibe). `table-layout-node.tsx` calcula,
por cada celda-nodo, el path hijo (`{ field: 'row', rowIndex, index }` o `{ field: 'cells', index }` según el modo)
y lo pasa a `LayoutNodeRenderer`; si la celda es un `container` con `children`, el `LayoutRenderer` anidado que ya
existe para renderizar esos hijos recibe ese mismo path de celda como base, exactamente igual que `accordion`
reenvía su propio path hoy — sin mecanismo nuevo, reutilizando el `resolveChildPath` por defecto de `LayoutRenderer`
que ya añade steps `children` por debajo de cualquier path base.

**Por qué**: es la extensión mínima y ya precedentada (mismo patrón que `repeater`/`tabs`/`accordion`, que ya
reciben y propagan `path`) — no hace falta un mecanismo de propagación nuevo, solo dejar de omitir el paso del
prop en `table`.

**Riesgo residual**: `table` se renderiza también en producción (fuera de modo Editor). Pasar `path` no debe
cambiar ningún comportamiento observable fuera de modo Editor — `path` ya tiene default `[]` en
`LayoutNodeRenderer` y hoy no se usa fuera de la capa de selección/arrastre/serialización del editor visual, así
que este cambio es seguro respecto al requisito no funcional de la spec. Debe verificarse explícitamente en
implementación que ningún otro consumidor de `path` en el árbol de render de producción cambia de comportamiento.

### D3 — Las celdas-nodo no son fuente ni destino de arrastre para reordenarse a sí mismas
Un path cuyo último step es `row` o `cells` puede seleccionarse (click) y, si el nodo resuelto es un `container`,
sus **hijos** pueden participar en arrastre (insertar, reordenar) con las reglas ya vigentes de cualquier
`container`. Pero el nodo de la celda en sí — el step `row`/`cells` como último step de su propio path — no se
ofrece como fuente de arrastre para reordenarse entre columnas o filas, ni como destino para que otro nodo se
suelte "sobre" la celda sustituyendo su tipo.

**Por qué**: la correspondencia fila↔`headers` y columna↔`headers` es un contrato estructural (spec, sección 2);
mover una celda por arrastre rompería esa correspondencia sin pasar por el widget dedicado, que es la única vía de
alta/baja/cambio de tipo según la propia spec (sección 5: "la paleta flotante de nodos no gana ninguna capacidad
nueva de soltar directamente sobre una celda"). Esto es la misma restricción que ya existe hoy para la instancia
única de `repeater.props.template`, que tampoco acepta arrastre de sí misma fuera de sus propios hijos.

**Coste asumido**: la capa de arrastre (`useDraggable`/validación de destino en `layout-node-renderer.tsx` y
`layout-canvas-dnd-context.tsx`) necesita una condición explícita de exclusión por tipo de step terminal, análoga a
la que ya debe existir para `template`. Si esta condición se omite, un usuario podría en teoría arrastrar una celda
y desalinear `rows`/`headers` sin que la validación de commit lo detecte necesariamvente como error de forma
inmediata — se marca como riesgo a cubrir explícitamente con tests en la fase de planificación.

### D4 — El widget de filas/columnas/celdas es un bloque especial al inicio de `Props`, no un `x-widget` de campo único
`props.headers`, `props.rows` y `props.columns` se editan mediante un bloque que se muestra al principio de la
pestaña `Props` de `table`, antes de los campos generados por el dispatcher — mismo lugar y mismo alcance de
escritura de nodo completo que ya usan el selector "Modo" (Grid/Columnas) de `container`, el selector de contenido
de `link` y el selector "Acción de envío" de `form`. El bloque escribe `props.headers`, `props.rows` y
`props.columns` como una única mutación coordinada a través del mismo pipeline de commit/validación
(`validateRuntimeConfig`) que el resto del panel, y el dispatcher genérico deja de iterar esas tres claves como
campos independientes de `props` para `table` (mismo criterio ya aplicado a `tabs.props.items.children`, excluido
del editor genérico de arrays de objetos).

**Por qué**: el mecanismo `x-widget` existente (`WIDGET_REGISTRY`, usado por `choice-items`, `layout-span`,
`condition-group`, etc.) sustituye el sub-schema de **una** propiedad. Aquí el contrato acopla **tres** propiedades
hermanas (`headers`, `rows`, `columns`) que deben commitear juntas para no producir un config estructuralmente
inconsistente a medio camino (la propia spec lo señala explícitamente en la sección 2). El patrón de "bloque
especial al inicio de `Props` que escribe el nodo/props completos" ya existe en el panel para exactamente este
tipo de caso (acoplamiento entre campos que no se resuelve campo a campo) — se reutiliza en vez de forzar el
mecanismo de campo único a un caso que no encaja.

**Alternativa descartada**: tres widgets `x-widget` independientes, uno por propiedad, sincronizados por un estado
compartido fuera del dispatcher. Se descarta por duplicar la coordinación que el propio commit ya debería
garantizar de forma atómica, y por no tener precedente en el panel.

### D5 — Secciones apiladas con acordeones ordenables por arrastre, sustituye la disposición `role="grid"`
**Revisión post-implementación** (ver nota en Contexto): el panel de propiedades tiene un ancho fijo de ~370px;
una cuadrícula fila×columna con un selector de 8 opciones por celda resultó inmanejable a ese ancho — cada celda
necesita espacio vertical propio para el selector y, condicionalmente, un campo de texto, que en una `gridcell`
estrecha se comprime. Se sustituye por una disposición de secciones apiladas verticalmente, sobre dos patrones ya
existentes en el propio panel — ninguno de los dos es un mecanismo nuevo:

- **Columnas** (ambos modos): lista vertical de headers editables — un input de texto por header con botón
  "Quitar" en línea (deshabilitado con una única columna restante, AC6) y botón "Añadir columna" al final. Mismo
  patrón exacto que `ManualLiteralItemsEditor`/`ManualScalarItemsEditor`
  (`src/dev-runtime/layout-canvas/property-fields/choice-items-property-field.tsx`) ya usan para listas de
  alta/baja sin reordenamiento. Sin cambio funcional sobre AC7 (renombrar un header con `columns[].id` asociado
  sigue sincronizando esa entrada). Sin reordenamiento: el usuario no lo pide para columnas en modo manual, y
  reordenar una columna manual movería la misma posición en `headers` **y** en cada fila de `props.rows`
  simultáneamente — una mutación de mayor superficie que no está motivada por ningún caso de uso descrito.
- **Filas** (modo manual): lista ordenable por arrastre de un ítem-acordeón por elemento de `props.rows`.
  Colapsado: handle de arrastre + índice de fila (posición 1-based) y, si la primera celda de la fila es de tipo
  texto, su valor como preview corto — sin replicar la heurística de "segunda columna como label, tercera como
  badge" de la maqueta de referencia del usuario, que no generaliza a un número de columnas arbitrario y el
  usuario no pidió como requisito. Expandido: un `TableCellTypePropertyField` (T7, sin cambios) por columna
  existente, en el mismo orden que `headers`. Botón "Quitar fila" (sin mínimo, AC "Tabla sin filas") y "+ Añadir
  fila" al final.
- **Dinámico**: campo `source` sin cambios (texto libre). Lista ordenable por arrastre de un ítem-acordeón por
  columna-plantilla de `rows.cells`. Colapsado: handle + texto del header + badge del tipo activo (reutiliza
  `CELL_TYPE_LABELS`, ya definida en T7). Expandido: input de renombrado de header (mismo comportamiento AC7 que
  en Columnas) + `TableCellTypePropertyField` (T7, sin cambios) para esa celda-plantilla. Ver D8 para el campo de
  referencia de datos cuando el tipo activo es texto.

**Mecanismo de arrastre**: se reutiliza la arquitectura ya construida para el panel de configuración de Shell
(`src/dev-runtime/shell-config-panel/shell-config-panel-dnd.tsx`, feature 0125) — `@dnd-kit/core` puro (el
proyecto no tiene `@dnd-kit/sortable` y esta revisión no añade ninguna dependencia nueva), sensor de puntero, y
zonas `gap` finas entre ítems para reordenar. A diferencia del árbol de Shell, ni las filas de una tabla ni las
columnas-plantilla anidan entre sí, así que **no hacen falta zonas `nest`**: es un subconjunto más simple del
mismo mecanismo (solo reordenamiento de una lista plana), no una reimplementación paralela. Si al implementarlo la
superficie compartida entre Shell y este widget resulta idéntica (`DndContext` + zona `gap` + fila arrastrable con
handle), se recomienda extraerla a un módulo común — sería ya la segunda superficie del panel con este mecanismo —
pero esa extracción es una decisión de implementación menor que no condiciona la planificación.

**Reordenamiento por teclado**: ninguna superficie de arrastre existente en el proyecto (canvas de `layout`, árbol
de Shell) implementa `KeyboardSensor` de `@dnd-kit` — el reordenamiento hoy solo es operable con puntero en todo
el proyecto. El requisito no funcional de la spec exige que los controles **nuevos** sean operables por teclado.
Se añade, junto al handle de arrastre de cada ítem-acordeón (fila manual o columna-plantilla dinámica), un par de
botones "Subir"/"Bajar" que mueven el ítem una posición sin arrastre — mismo criterio de accesibilidad que
cualquier botón del panel, sin necesidad de resolver el arrastre por teclado como capacidad general de `@dnd-kit`
en esta feature (ver "No objetivos").

**Por qué**: la spec deja la disposición abierta explícitamente ("disposición tabular con `role="grid"` frente a
una lista de filas expandibles, por ejemplo"); la maqueta de referencia del usuario confirma que una lista de
secciones apiladas con acordeones resuelve mejor la restricción real de ancho que una cuadrícula bidimensional, y
ya existen dos patrones directamente reutilizables en el propio código del panel — ninguno es un patrón nuevo que
inventar.

**Alternativa descartada**: mantener `role="grid"` con scroll horizontal dentro del panel para las columnas. Se
descarta porque el resto del panel de propiedades no tiene precedente de contenido con scroll horizontal propio
(rompe la convención de panel vertical de una sola columna) y no resuelve el problema de fondo (un selector de 8
opciones sigue necesitando su propio espacio vertical dentro de cada celda).

**Coste asumido**: T7 (`TableCellTypePropertyField`) se reutiliza sin cambios — ya es un `<fieldset>` de layout
vertical propio, sin acoplamiento a `role="gridcell"`. T8 (`TableRowsPropertyField`) se reescribe por completo: la
estructura interna pasa de una matriz `role="grid"`/`row`/`gridcell` a listas de ítems-acordeón con estado de
expansión (local al componente — se acepta que se colapse al cambiar de pestaña o de nodo seleccionado, mismo
criterio de simplicidad que el resto de "bloques especiales" de D4, que no usan un contexto de widget persistente
como sí hace `query-state-feedback-accordion-widget-context.ts` para su propio caso) y wiring de arrastre nuevo.
T9 no cambia de mecanismo (sigue montando el mismo componente con la misma firma `{ label, node, onChange }`),
pero sus tests de integración que verifican estructura `role="grid"` quedan obsoletos y deben reescribirse contra
la nueva estructura.

**Revisión 2 (post-implementación de la revisión 1, feedback adicional del usuario)**: en modo dinámico, mostrar
la sección "Columnas" (lista de headers editable, alta/baja/renombrado) por encima de la lista de acordeones
"Columnas-plantilla" (que también permite renombrar el header de cada ítem, D5 revisión 1) es redundante. A
diferencia del modo manual — donde `headers` es una entidad genuinamente compartida por varias filas y por tanto
distinta de cualquier fila individual, con derecho propio a su propia sección sin reordenamiento —, en modo
dinámico hay una correspondencia 1:1 entre header y columna-plantilla: no existe ningún caso de uso descrito donde
gestionarlos como dos superficies separadas aporte algo. Se elimina la sección "Columnas" para modo dinámico; la
lista de acordeones (renombrada de "Columnas-plantilla" a "Columnas") pasa a ser la única superficie de gestión de
columnas en ese modo: cada ítem gana un botón "Quitar columna" (mismo criterio de deshabilitado con una única
columna restante, AC6) y se añade un botón "Añadir columna" al final de la lista — misma `commitAddColumn`/
`commitRemoveColumn` ya existentes desde la revisión 1, solo reubicadas de la sección "Columnas" (que deja de
existir en este modo) a la lista de acordeones. El renombrado de header sigue viviendo dentro del ítem expandido,
sin cambio de comportamiento. Los `aria-label` que hoy dicen "columna-plantilla" (reordenar/Subir/Bajar/Expandir/
Colapsar/Cabecera de) se simplifican a "columna" — ya no hace falta distinguirla de una entidad "Columnas"
separada que ha dejado de existir en este modo. Modo manual no cambia: conserva su sección "Columnas" propia sin
reordenamiento, tal como ya fijaba la revisión 1.

**Coste asumido (revisión 2)**: cambio acotado a `TableRowsPropertyField` (T8) — la sección "Columnas" pasa a
renderizarse solo cuando `isManualTableMode`; el bloque dinámico gana un botón "Añadir columna" y cada
`DynamicColumnAccordionItem` gana un botón "Quitar columna"; sin cambio de mecanismo de commit
(`commitAddColumn`/`commitRemoveColumn` no cambian de firma ni de lógica interna). T9 no cambia: el widget se
sigue localizando por `role="group"`/`name: 'Filas y columnas'`, ajeno a esta reorganización interna.

### D8 — Campo de valor de una celda-plantilla de texto en modo dinámico: reutiliza el campo libre de T7, sin
control compuesto nuevo
La maqueta de referencia del usuario muestra, para una celda-plantilla de texto en modo dinámico, un campo "Valor"
compuesto por un prefijo fijo `item.` más un nombre de campo. El propio usuario aclara explícitamente que esta
parte no tiene que ser fiel al mockup. `table.md` ya documenta que una celda de texto (manual o dinámica)
"reutiliza la misma semántica de literal, referencia dinámica completa o string visible interpolado con `{{...}}`"
— el valor que produce el mockup (`item.name`) no es más que el contenido de una interpolación `{{item.name}}` ya
soportada hoy por el campo de texto libre condicional que T7 ya expone cuando el tipo activo es "Texto". No se
introduce ningún control compuesto nuevo: el campo de T7 sigue editando el literal completo tal cual (incluida la
sintaxis `{{...}}` si el usuario la teclea), igual que ya hace en modo manual y que ya hace cualquier otro campo
de texto del panel para una referencia dinámica.

**Por qué**: un control compuesto ("prefijo `item.` + nombre de campo") sería azúcar sintáctico sobre algo que el
campo de texto libre ya resuelve por completo hoy, y su alcance real (qué pasa si el usuario ya había tecleado una
interpolación más compleja, con más de una referencia o texto alrededor de `{{...}}`) no está acotado por ningún
criterio de aceptación de la spec ni mencionado como requisito funcional — construirlo sería alcance nuevo no
pedido.

**Alternativa descartada**: campo compuesto `item.` + input de nombre de campo, como en la maqueta. Se descarta
por las razones de arriba; puede reconsiderarse como una feature propia y acotada en el futuro si el uso real
revela que teclear `{{item.x}}` a mano es una fricción relevante.

**Coste asumido**: ninguno nuevo — T7 no cambia.

### D6 — "Eliminar nodo" sobre una celda no usa `removeNodeAt`
El botón "Eliminar nodo" del panel de propiedades, cuando el path seleccionado termina en un step `row` o `cells`,
no invoca la mutación genérica de borrado (`removeNodeAt`, que saca la posición del array padre). En su lugar
aplica `replaceNodeAt` con una celda de texto vacío (mismo valor por defecto que "Alta de columna"/"Alta de fila"),
conservando la posición y la longitud del array. La selección se limpia igual que en el borrado genérico.

**Por qué**: ya fijado como caso límite explícito en la spec — una celda no puede desaparecer de su fila sin romper
la correspondencia con `headers`. Es una decisión de diseño necesaria porque el punto de bifurcación (qué mutación
aplica el botón "Eliminar nodo") vive en una capa compartida por todos los tipos de nodo del panel, así que debe
quedar explícita para no tratarse como un detalle de implementación silencioso.

### D7 — Ampliación del catálogo de celda con `link`
`link` se añade al conjunto cerrado de tipos permitidos como celda de tabla en la capa de validación de
`src/config/` (el mismo punto que hoy rechaza `modal`/formularios/`repeater`/`table` como celda) y en el catálogo
que alimenta el selector de tipo del widget (D4/D5) — un único catálogo fuente, sin lista paralela en el editor,
mismo criterio que ya sigue el selector de variante de acciones para no duplicar el catálogo de `button.props.action`.

**Por qué**: es una ampliación de enum cerrado sin implicaciones estructurales — `link` no introduce un contrato
nuevo (usa exactamente su contrato ya documentado en `link.md`), y la frontera de validación en `src/config/` ya
tiene el punto de extensión adecuado para esto sin tocar `src/runtime/`.

## Riesgos y trade-offs
- **Superficie transversal amplia**: el nuevo par de steps toca `layout-node-path.ts` (tipo, resolución,
  serialización) y `layout-tree-mutations.ts` (búsqueda inversa por identidad, dispatch de escritura, igualdad de
  steps, comparación de "misma colección") de forma simétrica a como ya lo hacen `template`/`tabItem`. El riesgo no
  es conceptual sino de completitud: omitir uno de estos puntos deja la variante nueva "muda" en un flujo concreto
  (por ejemplo, resuelve pero no serializa, o serializa pero no compara igualdad correctamente). Se mitiga en la
  fase de planificación con un contrato de tests explícito por cada función tocada.
- **`table` se renderiza también en producción**: cualquier cambio en `table-layout-node.tsx` que toque cómo se
  invoca `LayoutNodeRenderer`/`LayoutRenderer` para las celdas debe verificarse que no altera el árbol renderizado
  fuera de modo Editor (ver D2). El riesgo es bajo porque `path` ya es opcional con default seguro, pero es el
  único punto de este diseño con contacto directo con el runtime de producción.
- **Gating de arrastre (D3) es una exclusión nueva, no una ausencia**: a diferencia de `repeater.props.template`
  (que nunca tuvo mecanismo de arrastre de sí mismo porque siempre fue una instancia sintética), aquí el nodo de la
  celda si existe como nodo real seleccionable y potencialmente ya "parece" arrastrable por tener path — la
  exclusión debe ser una condición explícita, con riesgo real de omitirse si no se cubre con un test dedicado.
- **Bloque especial de `table` en `Props` (D4) reduce la genericidad del dispatcher para este nodo**: mismo
  trade-off ya aceptado para `container`/`link`/`form` — no es un patrón nuevo, pero suma un cuarto caso donde
  "editar el nodo" no es "editar un campo", lo cual aumenta el número de sitios que hay que revisar si el
  dispatcher genérico cambia en el futuro.
- **Reordenamiento por arrastre (D5) es una capacidad nueva no listada en los criterios de aceptación 1–17 de
  `spec.md`**: la spec deja abierta la disposición visual del widget, pero ninguno de sus 17 criterios de
  aceptación menciona reordenar filas o columnas-plantilla. Esta revisión de diseño la incorpora porque el
  usuario la pidió explícitamente al validar la nueva disposición, no porque la spec ya la exigiera — ver
  "Preguntas abiertas".
- **Reordenar una columna-plantilla en modo dinámico es una mutación acoplada de dos arrays, no de uno**: a
  diferencia de reordenar una fila en modo manual (mueve una posición dentro de `props.rows`, sin afectar a nada
  más), reordenar una columna-plantilla en modo dinámico debe mover la misma posición en `headers` y en
  `rows.cells` de forma atómica en la misma operación, para no romper la correspondencia posicional que ya exige
  la validación existente (`table.md`: "cada... colección `cells` dinámica debe mantener correspondencia exacta
  con `headers`"). Riesgo de completitud si la implementación mueve un array sin el otro; se mitiga con un test
  dedicado que verifique ambos arrays tras un reorder.

## Migración o despliegue
No aplica. No hay migración de datos ni de config existente: un `table` sin `link` en celdas sigue siendo válido
igual que antes, y un `layout` ya guardado no cambia de forma al aplicar esta feature (los nuevos steps de path son
puramente una capa de direccionamiento en memoria del editor, no se serializan en el config JSON).

## Preguntas abiertas
- **Reordenamiento por arrastre no está en los criterios de aceptación 1–17 de `spec.md`** (ver "Riesgos y
  trade-offs"): esta revisión de diseño lo incorpora porque el usuario lo pidió explícitamente al validar la
  nueva disposición del widget, pero no es una decisión que este documento pueda tomar por la spec. Recomendación:
  añadir a `spec.md`, antes de `generate-implementation-plan`, dos criterios de aceptación nuevos — "reordenar una
  fila en modo manual (por arrastre o con los botones Subir/Bajar) actualiza `props.rows` en la posición
  correspondiente" y "reordenar una columna-plantilla en modo dinámico mueve la misma posición en `headers` y en
  `rows.cells` de forma atómica" — para que quede como contrato funcional cerrado y no como un comportamiento que
  solo describe el design. No es bloqueante para avanzar a planificación si se prefiere tratarlo como implícito en
  "widget dedicado... sin usar Monaco", pero debe quedar decidido explícitamente antes de trocear tareas.

El resto de decisiones (D1–D4, D6–D8) no dejan preguntas bloqueantes: cubren la totalidad de la pregunta técnica
marcada como `requires_design` en la spec (estrategia de path de celda) y el resto de puntos que quedaban abiertos
a esta fase (disposición del widget, mecanismo de commit acoplado, campo de valor en modo dinámico). No quedan
riesgos residuales externos ni dependencias no resolubles ahora, salvo el punto de arriba.
