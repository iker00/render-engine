# Spec — 0138 dev-editor-table-cell-editing

## Objetivo
Cerrar el hueco de paridad que dejó el editor visual del `layout` (ver
[[../../docs/app-features/development/dev-mode-editor.md#editor-visual-del-layout]]) frente al nodo `table`: hoy
ninguna celda-nodo (`image`, `list`, `button`, `container`, `heading`, `paragraph` — ver
[[../../docs/app-features/nodes/table.md]]) es seleccionable ni editable en modo Editor, y la forma misma de una
tabla (número de filas/columnas, qué celda es texto y cuál es un nodo) solo puede definirse desde Monaco, sin ningún
widget dedicado en el panel — al contrario que el resto del `layout`, donde el objetivo declarado del editor visual
es permitir construir y editar sin depender del editor de texto.

Esta feature entrega dos capacidades relacionadas y dependientes entre sí:
1. Selección y edición de celdas-nodo ya existentes en modo Editor, con paridad completa con cualquier otro nodo del
   `layout` (panel de propiedades, breadcrumb, arrastre dentro de containers-celda).
2. Un widget dedicado en el panel de propiedades de `table` para definir la forma de la tabla (alta/baja de
   columnas y filas, y el tipo de contenido de cada celda) sin tocar Monaco, incluyendo la posibilidad de que una
   celda contenga un `link` — tipo hoy explícitamente prohibido como celda (ver
   [[../../docs/app-features/nodes/link.md]]).

## Alcance

### 1. Selección de celdas-nodo (fix de path)
- `table-layout-node.tsx` renderiza hoy cada celda-nodo vía `LayoutNodeRenderer` sin `path`, por lo que todas las
  celdas-nodo de todas las tablas de la página comparten el path vacío `[]`: un click no selecciona nada (el panel
  de propiedades no se abre) y el hover resalta simultáneamente todas las celdas-nodo de todas las tablas.
- El modelo de `path` estructural gana un step propio para "celda de tabla" (con identificación de fila y columna),
  al mismo nivel que ya tienen `template` de `repeater`, `tabItem` de `tabs` y `children.N` de `accordion` — todos
  ellos ya seleccionables hoy.
- Una vez resuelto, seleccionar una celda-nodo en el canvas abre el mismo panel de propiedades (pestañas `Props`,
  `Diseño`, `Visibilidad`, `Queries` según aplique) que cualquier otro nodo del `layout`, reutilizando el dispatcher
  genérico existente sin lógica de edición duplicada.
- El breadcrumb de ancestros del panel incluye la tabla y la posición de la celda en la cadena, igual que ya ocurre
  con cualquier otro ancestro (`container > form > heading`).
- Un `container` anidado dentro de una celda-nodo mantiene seleccionables a sus propios hijos a cualquier
  profundidad, reutilizando la resolución de path por `children.N` ya existente a partir del nuevo step de celda
  como ancla.
- El hover y la selección quedan acotados a la celda concreta señalada, sin afectar a otras celdas de la misma
  tabla ni de otras tablas de la página.

### 2. Widget dedicado de filas/columnas/celdas
`props.headers`, `props.rows` y `props.columns` se editan como una unidad coordinada por un widget dedicado, no
mediante los campos genéricos del dispatcher: están acoplados por contrato (cada fila debe corresponder
exactamente con `headers`; `columns[].id` debe existir en `headers`) y editarlos por separado con los widgets
genéricos de array produciría con facilidad commits rechazados o un config estructuralmente inconsistente.

- **Alta de columna**: añade un header nuevo y, en la misma operación, una celda de texto vacío en esa posición en
  cada fila manual existente (o en la plantilla `cells` en modo dinámico), para no romper la correspondencia
  exigida por el contrato.
- **Baja de columna**: quita el header y la celda correspondiente de cada fila (o de la plantilla `cells`); si
  existía una entrada de `columns[]` referenciando ese header por `id`, se quita también. Quitar la última columna
  restante no está permitido (una tabla sin `headers` no es un config válido).
- **Renombrar un header**: si existe una entrada de `columns[]` cuyo `id` coincide con el nombre anterior, se
  renombra en la misma operación para seguir referenciando la misma columna.
- **Alta/baja de fila** (modo manual): añade o quita una fila completa (una celda por columna, con el mismo valor
  por defecto de celda de texto vacío al añadir).
- **Selector de tipo por celda**: cada celda individual (de cada fila en modo manual, o de la plantilla `cells` en
  modo dinámico) expone un selector "Texto" / tipo de nodo, limitado al catálogo permitido para celda de tabla
  (ver punto 4), con el mismo patrón visual y de reconstrucción-desde-cero que ya usa el selector de variante de
  `button.props.action`/`link.props.action`. El tipo se elige libremente por celda individual — el widget no fuerza
  un tipo único por columna, coherente con que el schema tampoco lo exige.
  - Mientras una celda es "Texto", el propio selector expone un campo de texto libre para su valor literal (mismo
    patrón que el resto de strings del panel: literal, referencia dinámica completa o interpolación `{{...}}`).
  - Al convertir una celda a un tipo de nodo, el widget de filas solo fija el `type` y sus valores por defecto
    mínimos; la edición de las props propias de ese nodo (incluidas las de cualquier `container` anidado) ocurre
    seleccionándolo en el canvas renderizado (punto 1), no dentro del propio widget de filas — evita duplicar el
    editor de propiedades en dos sitios distintos.
- **Selector de modo de tabla**: "Manual" / "Dinámico", con el mismo patrón de selector de modo ya usado en
  `container` (Grid/Columnas) y en el selector de contenido de `link`. Cambiar de modo reconstruye `props.rows`
  desde cero con la forma mínima válida del nuevo modo; no se conserva contenido del modo anterior.
- **Modo dinámico**: expone el campo `source` como texto libre y una fila de celdas-plantilla `cells`, una por
  columna, con el mismo selector de tipo por celda que en modo manual. Estas celdas-plantilla son las mismas que
  edita el punto 3 (semántica de plantilla compartida).

### 3. Semántica de plantilla en modo dinámico
Una celda-nodo de `rows.cells` en modo dinámico es una plantilla compartida por todas las filas que genera la
query — mismo comportamiento que `repeater.props.template`. Seleccionar y editar esa celda-nodo (en el widget para
su tipo, o en el canvas para sus props) edita la plantilla completa; no existe edición de una fila generada
individual.

### 4. Catálogo de celda ampliado con `link`
- `link` se añade al catálogo de tipos permitidos como celda de tabla (hoy explícitamente prohibido junto a
  `modal`, formularios, `repeater` y `table`), tanto en la validación de configuración como en el selector de tipo
  del widget del punto 2.
- El contrato de un `link` como celda es idéntico al que ya tiene fuera de tabla (`props.href`/`props.action`,
  `props.label`/`children`, etc. — ver [[../../docs/app-features/nodes/link.md]]), sin restricciones adicionales
  por estar dentro de una celda.
- En modo dinámico, un `link` de celda accede a `item.*` de la fila correspondiente exactamente igual que ya lo
  hace hoy cualquier otra celda-nodo.

### 5. Arrastre en celdas
- Un `container` que ya vive dentro de una celda-nodo gana las mismas reglas de destino de drop que cualquier otro
  `container` del `layout` (insertar desde la paleta, reordenar o reanidar hijos), en cuanto tiene un `path` real
  por el punto 1. No es un mecanismo nuevo: es la extensión natural de reglas ya vigentes.
- La paleta flotante de nodos no gana ninguna capacidad nueva de soltar directamente sobre una celda para asignarle
  tipo: esa asignación es exclusiva del selector del punto 2.
- Una celda en modo "Texto" nunca es destino de drop.

### 6. Coherencia visual con el panel existente
El widget de filas/columnas/celdas sigue las convenciones ya vigentes del panel de propiedades: mismo patrón de
selector de variante para los selectores de tipo/modo, sin caja con borde ni fondo agrupando el widget o sus
secciones, cabeceras de texto simple en mayúsculas pequeñas y grises, fila label-izquierda/control-derecha para los
campos simples (valor literal de una celda de texto, `source` del modo dinámico), y el mismo pipeline de
commit/validación (`validateRuntimeConfig`) con el mismo criterio de aviso `role="alert"` ante un commit rechazado
que ya usa el resto del panel. No se introduce un lenguaje visual propio para este widget.

## Fuera de alcance
- Procesamiento remoto de tablas, selección de filas, agrupación o virtualización — ya fuera de v1 según
  [[../../docs/current-state.md]] y [[../../docs/app-features/nodes/table.md#límites-del-nodo]].
- Forzar un tipo de celda único por columna.
- Cualquier interacción de drop nueva para asignar o cambiar el tipo de una celda desde el canvas (arrastrar un
  tipo de la paleta directamente sobre una celda) — se hace exclusivamente desde el selector del panel (punto 2).
- Edición de `props.pagination`, `props.columns[].filterable`/`sortable`/`filterPlaceholder` — sin cambios respecto
  a su comportamiento actual en el panel; esta feature no los toca.
- Ampliar el catálogo de celda con tipos de nodo distintos de `link` (por ejemplo `badge`, `alert`, `stat`,
  `divider`, `skeleton`) — fuera de esta entrega.
- Cualquier cambio de comportamiento del nodo `table` en producción o fuera de modo desarrollo, salvo el propio
  soporte de `link` como celda válida (que hoy se rechaza en validación).
- Deshacer/rehacer para las operaciones del widget de filas — mismos límites generales ya documentados para el
  resto del editor visual.

## Requisitos no funcionales
- Sin cambios de comportamiento observable en producción ni en el runtime fuera de modo desarrollo, salvo la
  ampliación de validación que permite `link` como celda.
- El pipeline de commit/validación (`validateRuntimeConfig`) sigue siendo la única vía de verdad: el widget nunca
  aplica en memoria un estado que no pase esa validación.
- Los controles nuevos (selectores de tipo/modo por celda, alta/baja de filas y columnas) deben ser operables por
  teclado y con semántica ARIA adecuada, reutilizando los patrones ya establecidos (selector de variante,
  `role="grid"` si aplica a la disposición tabular del widget) en vez de introducir un patrón nuevo.
- Debe mantenerse el umbral mínimo global de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.

## Criterios de aceptación
1. Hacer click en modo Editor sobre una celda-nodo (`button`, `image`, `list`, `container`, `heading` o
   `paragraph`) de una `table` la selecciona de forma unívoca y abre su panel de propiedades con las pestañas que
   correspondan a su schema.
2. El hover sobre una celda-nodo resalta únicamente esa celda, sin afectar a otras celdas de la misma tabla ni de
   otras tablas de la página.
3. El breadcrumb del panel de propiedades de una celda-nodo seleccionada incluye la tabla como ancestro.
4. Un `container` anidado dentro de una celda-nodo permite seleccionar a sus hijos a cualquier profundidad.
5. En el panel de propiedades de `table`, un widget dedicado permite añadir y quitar columnas y filas sin usar
   Monaco; añadir una columna añade una celda de texto vacío en cada fila existente, y quitarla elimina la celda
   correspondiente de cada fila.
6. Quitar la última columna restante de una tabla no está permitido desde el widget.
7. Renombrar un header que tiene una entrada de `columns[]` asociada por `id` actualiza esa entrada para seguir
   apuntando al mismo header.
8. Cada celda de cada fila (modo manual) o de la plantilla `cells` (modo dinámico) expone un selector de tipo con
   "Texto" y el catálogo de nodos permitido para celda; elegir un tipo distinto de texto reconstruye la celda desde
   cero con los valores por defecto mínimos de ese tipo.
9. El tipo de celda se elige de forma libre por celda individual; dos celdas de la misma columna en filas distintas
   pueden tener tipos distintos sin que el widget lo impida.
10. Cambiar el selector de modo de tabla entre "Manual" y "Dinámico" reconstruye `props.rows` con la forma mínima
    válida del nuevo modo.
11. En modo dinámico, editar una celda-nodo de la plantilla `cells` (tipo o props) se refleja en todas las filas
    que la query genera; no existe forma de editar una fila generada de forma individual.
12. `link` aparece como opción en el selector de tipo de celda y, una vez elegido, se valida y renderiza con el
    mismo contrato que un `link` fuera de tabla (`props.href`/`props.action`, `props.label`/`children`).
13. Un config con `link` como celda de tabla, que hoy se rechaza en validación, pasa a aceptarse.
14. Un `container` ya existente dentro de una celda-nodo acepta insertar nodos nuevos desde la paleta flotante y
    reordenar sus hijos existentes, con las mismas reglas de destino de drop que cualquier otro `container` del
    `layout`.
15. Arrastrar un tipo de nodo desde la paleta flotante directamente sobre una celda en modo "Texto" no produce
    ningún cambio en el config.
16. El widget de filas/columnas/celdas no introduce ninguna caja con borde o fondo, ni labels con prefijo de
    contexto, y usa el mismo patrón de fila label-izquierda/control-derecha que el resto del panel para sus campos
    simples.
17. Un commit rechazado por validación desde cualquier control del widget (por ejemplo, un `href` inválido en una
    celda `link`) deja el valor tecleado visible y muestra un aviso `role="alert"`, con el mismo criterio de
    limpieza que el resto del panel.

## Casos límite
- Tabla sin filas (`headers` con al menos una entrada, `rows: []` en modo manual): el widget muestra su estado
  vacío con la opción de añadir la primera fila.
- Renombrar un header a un texto que coincide con otro header ya existente: la operación sobre `headers` en sí se
  acepta (el schema no prohíbe headers duplicados), pero si esa duplicidad hace ambigua una entrada de `columns[]`
  ya existente, el commit correspondiente se rechaza con el mismo criterio de aviso que el resto del panel — no se
  introduce una validación nueva más permisiva que la ya vigente.
- Usar el botón "Eliminar nodo" del panel de propiedades sobre una celda-nodo seleccionada: a diferencia del
  comportamiento general (borrar el nodo y sacarlo del array de su padre), una celda no puede desaparecer de su
  fila sin romper la correspondencia con `headers` — "Eliminar nodo" sobre una celda-nodo la revierte a una celda
  de texto vacío en vez de eliminar la posición.
- Cambiar de modo Manual → Dinámico con filas que ya contienen celdas-nodo con contenido editado: se pierde ese
  contenido al reconstruirse `props.rows` desde cero, igual que ya ocurre con cualquier otro selector de modo del
  panel (`container`, `link`).
- Quitar una columna que tiene celdas-nodo con subárboles propios (por ejemplo un `container` con varios hijos) en
  varias filas: todas esas celdas se eliminan junto con la columna, sin aviso de confirmación adicional distinto
  del ya existente para borrar un nodo con subárbol.
- Una celda-nodo `container` sin hijos dentro de una tabla se comporta igual que un `container` vacío en cualquier
  otro punto del `layout`: placeholder visible y seleccionable en modo Editor, destino de drop válido para su
  primer hijo.

## Riesgos o preguntas abiertas
- La estrategia técnica concreta para el nuevo step de `path` de celda de tabla (qué identifica la celda de forma
  estable — índice de fila más índice/`id` de columna, o solo índice de columna en modo dinámico donde no hay una
  fila real que direccionar) es una decisión de diseño con más de una alternativa razonable, con impacto en la
  resolución/serialización de `path` usada transversalmente por la selección en todo el editor. Se marca
  `requires_design: true` para resolverla en `generate-feature-design` antes de planificar tareas.
- La representación concreta del widget de filas/columnas/celdas (disposición tabular con `role="grid"` frente a
  una lista de filas expandibles, por ejemplo) se deja abierta a `generate-feature-design`/
  `generate-implementation-plan`; el requisito de producto (alta/baja de filas y columnas, selector de tipo libre
  por celda, sin caja ni lenguaje visual propio) ya queda fijado en esta spec.
