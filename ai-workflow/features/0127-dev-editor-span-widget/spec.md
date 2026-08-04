# Spec — 0127 dev-editor-span-widget

## Objetivo
Sustituir el editor genérico de `layout.span` en el panel de propiedades del editor visual (dev mode) por un
widget dedicado y más visual, siguiendo el patrón `x-widget` ya usado por `ChoiceItemsPropertyField` (ver
[[../../docs/app-features/development/dev-mode-editor.md#widget-dedicado-para-propsitems-de-select-radiogroup-y-checkboxgroup]]),
tomando como referencia el diseño "widget columnas" de Figma. El objetivo es una edición más intuitiva y moderna
de la ocupación de grid por breakpoint, mostrando en cada fila el número de columnas disponibles del contenedor
padre real y el valor efectivo que aplicará el runtime, sin cambiar el contrato JSON existente.

Esta es la primera de una posible serie de widgets dedicados para el editor de nodos; se trata deliberadamente
como un piloto acotado a un solo campo.

### Referencia visual
Figma, archivo "render-engine", frame "widget columnas": https://www.figma.com/design/HWPhfM5JqJovx8wyFTqaMY/render-engine?node-id=1-28

El mock fija el lenguaje visual base (título, cajas de valor por fila, indicador "/ N") pero no el comportamiento
exacto: difiere de esta spec en que el mock no incluye la fila `base`, usa un denominador fijo `/ 12` en vez del
`N` dinámico por contenedor, no distingue visualmente un valor heredado de uno explícito, y no muestra un botón
de "Quitar" por fila. Estas divergencias son intencionadas (ver requisitos funcionales) y priman sobre el mock
en caso de conflicto.

## Alcance
- Nuevo widget dedicado registrado en `WIDGET_REGISTRY` vía `x-widget`, que sustituye el editor genérico de
  `layout.span` cuando el nodo seleccionado tiene un `container` ancestro en modo grid.
- Una fila por cada uno de los seis breakpoints del schema: `base`, `sm`, `md`, `lg`, `xl`, `2xl`.
- Cada fila muestra: etiqueta del breakpoint, input numérico editable con el valor, e indicador "/ N" con el
  número de columnas efectivo del contenedor ancestro en ese mismo breakpoint.
- Fila sin valor explícito: se muestra en estilo visual atenuado el valor efectivo resultante de la cascada
  mobile-first del propio `layout.span` (heredado del breakpoint declarado anterior más cercano, o `1` si ninguno
  está declarado).
- Botón "Quitar" por fila, visible solo cuando esa fila tiene un valor explícito, que elimina esa clave del mapa
  y la devuelve a estado heredado.
- El widget siempre trabaja en la forma de mapa responsive: si el valor actual de `layout.span` es un entero
  plano, la primera edición desde el widget lo convierte a `{ base: N }` antes de aplicar el cambio del usuario.
- El widget completo se oculta (sin campo de respaldo para `layout.span` en el panel) cuando el nodo seleccionado
  no tiene ningún `container` ancestro, a cualquier profundidad, con `props.columns` declarado.

## Fuera de alcance
- Icon picker para `props.icon` y builder visual para `visibility` — candidatos identificados durante la
  exploración previa, pospuestos a features futuras independientes.
- Cualquier cambio al contrato JSON de `layout.span`, `container.props.columns` o su validación
  (`runtime-config-zod.ts`) — el widget solo cambia cómo se edita visualmente un valor ya válido en el schema
  existente.
- Cualquier cambio de comportamiento en producción o en modo Visual del editor — exclusivo del panel de
  propiedades en modo Editor.
- Selector de modo "entero fijo" vs. "mapa responsive": el widget nunca vuelve a presentar un `layout.span` ya
  convertido a mapa como un único campo entero, ni ofrece un control explícito para "simplificar" de vuelta a
  entero. Un `layout.span` como entero plano sigue siendo editable como tal solo desde Monaco.
- Otros widgets dedicados adicionales del mismo patrón — esto es un piloto de un único widget.
- Pickers contextuales para referencias `{{...}}`/`queries.x`/`forms.x`/`params.x` — el input numérico del widget
  sigue siendo un valor literal, sin cambiar la política ya vigente descrita en
  [[../../docs/app-features/development/dev-mode-editor.md#límites-del-editor-visual]].

## Requisitos funcionales

### Visibilidad del widget
- El widget de `layout.span` se muestra en la subsección `Layout` del panel de propiedades solo cuando el nodo
  seleccionado tiene al menos un `container` ancestro, a cualquier profundidad, con `props.columns` declarado
  (fijo o responsive).
- Si no existe tal ancestro, la subsección `Layout` no muestra ningún campo para editar `layout.span` — ni el
  widget ni el editor genérico de respaldo.

### Filas por breakpoint
- El widget muestra siempre las seis filas `base`, `sm`, `md`, `lg`, `xl`, `2xl`, en ese orden, independientemente
  de cuáles tengan valor explícito.
- Cada fila resuelve su denominador `N` a partir de las columnas efectivas del `container` ancestro relevante en
  ese mismo breakpoint, aplicando la misma cascada mobile-first que usa el runtime para resolver
  `container.props.columns` responsive (ver [[../../docs/app-features/nodes/container.md#reglas-de-render]]).
- El valor mostrado en una fila sin valor explícito es el resultado de aplicar al propio `layout.span` la cascada
  mobile-first ya documentada (heredar el valor del breakpoint declarado anterior más cercano; `1` si ninguno
  anterior está declarado), mostrado en estilo visual atenuado para diferenciarlo de un valor explícito.
- Editar el input numérico de una fila fija el valor explícito de ese breakpoint en el mapa de `layout.span`,
  mediante el mismo merge superficial (`{ ...value, [breakpoint]: n }`) ya usado por el editor genérico actual.
- Cada fila con valor explícito muestra un botón "Quitar" que elimina esa clave del mapa; la fila vuelve a mostrar
  su valor heredado en gris. Una fila sin valor explícito no muestra este botón.

### Conversión entero → mapa
- Si `layout.span` es un entero plano al montar el widget, la primera edición de cualquier fila (fijar o quitar
  un valor) convierte el valor completo a la forma de mapa responsive, sembrando `{ base: N }` con el entero
  previo antes de aplicar el cambio del usuario sobre esa base.

### Validación
- Cada valor introducido se valida contra el mismo pipeline ya vigente (`validateRuntimeConfig`) antes de
  aplicarse al config real.
- Un commit rechazado (por ejemplo, un valor fuera de rango `1..N` para ese breakpoint) sigue el mismo patrón ya
  documentado en
  [[../../docs/app-features/development/dev-mode-editor.md#feedback-cuando-un-cambio-del-panel-de-propiedades-no-se-puede-guardar]]:
  el input conserva el valor introducido por el usuario y se muestra un aviso (`role="alert"`) con el código y
  mensaje del error, hasta que un cambio posterior de esa misma fila se guarde correctamente o se seleccione otro
  nodo.

## Requisitos no funcionales
- El widget se registra en `WIDGET_REGISTRY` mediante el mismo mecanismo `x-widget` ya usado por `choice-items`,
  sin introducir un segundo mecanismo de extensión.
- La resolución de columnas efectivas del contenedor ancestro por breakpoint no debe duplicar de forma divergente
  la lógica ya usada por el runtime para resolver `container.props.columns` responsive; debe reutilizar o derivar
  de esa misma resolución en vez de mantener dos implementaciones de la cascada mobile-first que puedan
  desincronizarse.
- Sin cambios en el contrato JSON de `layout.span` ni `container.props.columns`, ni en su validación.
- Sin cambios de comportamiento observable en producción ni en modo Visual del editor.
- Debe mantenerse el umbral mínimo global de cobertura de tests del 80% sobre `src/` ya exigido por el proyecto.
- Los controles nuevos (inputs por fila, botón "Quitar") deben ser operables por teclado y con semántica
  accesible adecuada, reutilizando patrones ya establecidos en el panel (etiquetas asociadas a inputs,
  `aria-label` en botones de acción, como ya hace el `ArrayPropertyField` genérico).

## Criterios de aceptación
1. Seleccionar un nodo sin ningún `container` ancestro con `columns` declarado no muestra ningún campo de
   `layout.span` en la subsección `Layout`.
2. Seleccionar un nodo con un `container` ancestro con `columns` declarado muestra el widget con las seis filas
   `base`/`sm`/`md`/`lg`/`xl`/`2xl`.
3. Cada fila muestra su denominador `N` igual al número de columnas efectivo del contenedor ancestro en ese
   breakpoint, incluso cuando `columns` del contenedor es responsive con valores distintos por breakpoint.
4. Una fila sin valor explícito muestra en estilo atenuado el valor heredado según la cascada mobile-first de
   `layout.span` (del breakpoint declarado anterior, o `1` si no hay ninguno), y no muestra el botón "Quitar".
5. Escribir un número en una fila fija ese valor como explícito en el mapa de `layout.span` y hace aparecer el
   botón "Quitar" en esa fila.
6. Pulsar "Quitar" en una fila con valor explícito borra esa clave del mapa; la fila pasa a mostrar de nuevo su
   valor heredado en gris y el botón desaparece.
7. Con `layout.span` como entero plano, editar cualquier fila del widget convierte el valor a mapa responsive
   sembrado con `{ base: <entero previo> }` antes de aplicar el cambio del usuario.
8. Un valor introducido fuera de rango `1..N` para su breakpoint se rechaza en el commit: el input conserva el
   valor tecleado y aparece un aviso `role="alert"` con el error, sin modificar el config aplicado.
9. El resto del comportamiento ya documentado del panel de propiedades (sincronización con Monaco, guardia de
   cambios aplicados, exclusión mutua con el panel de Monaco) sigue funcionando sin regresión al usar este
   widget.

## Casos límite
- Un `container` ancestro con `columns` responsive donde algún breakpoint no declara valor: el `N` de esa fila
  hereda la misma cascada mobile-first ya usada para `columns` (documentada en `container.md`), degradando a `1`
  columna si tampoco hay ninguno anterior declarado.
- Varios `container` ancestros anidados con `columns` declarado a distintos niveles: el contenedor de referencia
  para el `N` de cada fila es el `container` padre inmediato en el árbol (el más cercano ascendiendo), no el
  primero encontrado en cualquier nivel superior.
- Quitar el valor explícito del breakpoint `base` cuando no hay ningún otro breakpoint anterior: la fila `base`
  muestra `1` en gris, igual que degrada el runtime cuando falta `base` sin declarar nada más.
- Cambiar de nodo seleccionado mientras hay un aviso de commit rechazado pendiente en una fila: el aviso se
  descarta al cambiar de selección, igual que ya ocurre hoy para el resto de campos del panel.
- El `container` ancestro pierde su `columns` (por ejemplo, se edita desde Monaco mientras el nodo hijo sigue
  seleccionado): el widget deja de mostrarse en el siguiente render que resuelva la selección, igual que
  cualquier otro cambio de forma del árbol que invalide el panel actual.

## Riesgos o preguntas abiertas
- Redacción exacta del título/subtítulo del widget en el panel: se decide durante la implementación (por
  ejemplo, "Columnas" como título, sin un subtítulo que asuma una rejilla fija de 12 como en el mock de
  referencia), sin que esto cambie ningún comportamiento ya fijado en esta spec.
- La estrategia técnica concreta para reutilizar o derivar la resolución de columnas del contenedor ancestro (en
  vez de duplicarla) se deja a `generate-implementation-plan`; no se considera un riesgo arquitectónico que
  bloquee la spec, dado que ya existe precedente de reutilizar reglas de render ya vigentes desde el editor (por
  ejemplo, las reglas de destino de drop reutilizan las reglas estructurales del contrato JSON).
