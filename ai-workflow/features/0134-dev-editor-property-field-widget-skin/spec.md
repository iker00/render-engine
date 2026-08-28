# 0134 — Re-skin de widgets genéricos y del widget de columnas (F-B del rediseño)

## Objetivo
Segunda entrega del rediseño del panel de propiedades del editor visual (F-B, sucesora de `0133-dev-editor-node-panel-tabs`): llevar el lenguaje visual del diseño de referencia de Figma a los controles genéricos que F-A dejó con su aspecto anterior — enums con catálogo cerrado pequeño, campos `color`, campos booleanos — y restilar el widget dedicado `layout.span` ("Columnas"), añadiendo su barra de vista previa de ocupación. No cambia el conjunto de campos editables, el contrato JSON, el pipeline de commit/validación ni la organización en pestañas ya introducida por F-A.

### Referencia visual
Figma, archivo "render-engine": https://www.figma.com/design/HWPhfM5JqJovx8wyFTqaMY/render-engine (mismo archivo que 0127/0128/0133; nodos de referencia de la pestaña de propiedades ya citados en `0133-dev-editor-node-panel-tabs/spec.md`: `40:502`/`40:783`/`40:950`).

Confirmado contra una captura del mock para el nodo `stat` (pestaña `Props`) compartida por el usuario — la API de Figma no estaba disponible en el momento de esta redacción (rate limit), así que lo siguiente se basa en esa captura estática, no en una inspección completa del archivo:
- Los controles restilados por esta feature (segmented genérico de FR1, swatches de color de FR3) se muestran en la misma fila label-izquierda/control-derecha que ya usa cualquier campo genérico de texto/número/enum/booleano — no como un bloque suelto sin label visible. Esto es distinto de los tres usos ya existentes y fijos de `SegmentedTogglePropertyField` de `0128` (`container` "Modo", `heading` "Nivel", `tabs` "Orientación"), que siguen sin fila y sin label visible por ser bloques especiales fuera de la iteración genérica de campos — esos tres no cambian.
- Junto a la fila de swatches de color, el mock muestra el nombre semántico del color actualmente seleccionado como texto junto a las muestras (por ejemplo "primary").
- El panel del mock no tiene ninguna caja con borde/fondo alrededor de ningún grupo de campos (ni alrededor del contenido completo de una pestaña, ni alrededor de un grupo anidado como el bloque de "Acción" o un campo de tipo mapa por breakpoint): los campos quedan en lista plana, sin líneas divisorias — ver FR8.
- El mock agrupa además los campos de `stat` bajo cabeceras de sección (`IDENTIDAD`, `CONTENIDO`, `APARIENCIA`, `ESTADO`, `DATOS`, `ENLACE Y ACCIÓN`, `ACCESIBILIDAD`, `AVANZADO`) con muchos más campos de los que declara hoy el schema real de `stat` (`ayuda`, `posición`, `tamaño`, `alineación`, `énfasis`, `radio`, `Cargando`, `origen`, `binding`, `aria-label`, `role`, `tabIndex`, `data-*`, entre otros). Esa agrupación por categoría es un mock ilustrativo con un catálogo de campos más amplio que el real y queda **fuera de alcance** de esta entrega (ver Fuera de alcance): la organización en pestañas y la lista plana de campos por pestaña ya introducida por F-A no cambia.
- El campo `variant` se ve en la captura como una caja de texto simple con el valor actual (`accent`), no como un grupo de botones segmentados visible — a diferencia de otros campos del mismo mock que sí se ven como grupos de botones (`tamaño`, `alineación`, `radio`, `posición`). No está confirmado si es una particularidad de esa captura o el tratamiento real pretendido; se deja como riesgo abierto (ver Riesgos) sin cambiar el criterio de aceptación de FR1, que sigue exigiendo segmented para `stat.props.variant`.

## Alcance
- **Enums acotados → segmented control**: cualquier campo de tipo enum en las pestañas `Props`/`Diseño`, en cualquier tipo de nodo, cuyo catálogo tenga entre 2 y 5 valores (ambos inclusive) y no esté ya cubierto por un widget dedicado del `WIDGET_REGISTRY` ni por la regla de swatches (siguiente punto), pasa a mostrarse como el mismo control de segmentos (`SegmentedTogglePropertyField`) que ya usan `container` "Modo", `heading` "Nivel" y `tabs` "Orientación", en vez del `<select>` genérico actual.
- **Campos `color` → swatches**: cualquier campo `props.color` cuyo nombre sea literalmente `color` (convención de nombre, mismo precedente que el widget de icono de `0129`) pasa a mostrarse como una fila de muestras de color en vez de `<select>` o segmented, con independencia de su número de opciones.
- **Campos booleanos → interruptor tipo píldora**: todo campo booleano genérico (hoy checkbox vía `BooleanPropertyField`) pasa a un control de interruptor on/off con el estilo del diseño de referencia.
- **Widget `layout.span` ("Columnas")**: re-skin de las seis filas fijas (contenedor tipo tarjeta, tipografía, indicador `/ N`, botón "Quitar") y nueva barra de vista previa de ocupación bajo las filas.
- **Eliminación de la caja con borde/fondo de los grupos de campos genéricos** (ver FR8): tanto el contenido raíz de cada pestaña (`Props`/`Diseño`/`Visibilidad`/`Queries`) como cualquier grupo anidado generado por el editor genérico de objetos o de arrays (por ejemplo un campo de tipo mapa por breakpoint, o una lista de objetos) pierden la caja; un grupo que ya tiene hoy un título visible lo conserva como texto de cabecera simple, sin caja.
- Ningún otro widget cambia de aspecto en esta entrega más allá de la eliminación de caja de FR8 donde aplique: `choice-items`, icon picker, condición/grupo, editor clave-valor, el selector "Contenido" de `link` y los tres usos ya existentes de segmented conservan su presentación actual de F-A. El selector de variante de acciones (`DiscriminatedUnionPropertyField`, bloques "Acción"/"Acción de envío") pierde su caja con borde/fondo por FR8 pero conserva su título como cabecera de texto y no cambia ningún otro aspecto de su interacción.

## Fuera de alcance
- Cualquier campo nuevo o cambio de contrato JSON.
- F-C: editor por-estado tipo acordeón para `queryStateFeedback` (pestaña `Queries`).
- Traducción al español de las etiquetas de segmento/opción: los valores literales del enum (`'solid'`, `'ghost'`, `'start'`…) se muestran tal cual, igual que hoy en el `<select>` genérico.
- Restilar el `<select>` genérico de enums con 6 o más opciones (por ejemplo `container.props.justify` con 6 valores, o `alert.props.type` con 6 valores y nombre `type`, no `color`): quedan como `<select>` con el estilo base ya aplicado por F-A, sin cambios adicionales en esta entrega.
- Agrupar los campos de cada pestaña en subsecciones con cabecera por categoría (tipo `IDENTIDAD`/`CONTENIDO`/`APARIENCIA` del mock de Figma): la organización en pestañas y la lista plana de campos por pestaña ya introducida por F-A no cambia en esta entrega; FR8 solo retira la caja visual, no reestructura ni clasifica los campos.
- Cambios en el runtime de producción, en Monaco o en el resto de paneles del editor.

## Requisitos funcionales

### FR1 — Segmented control para enums acotados
El dispatcher genérico de propiedades, al resolver un campo cuyo JSON Schema declara un `enum` con entre 2 y 5 valores, renderiza `SegmentedTogglePropertyField` en vez de `EnumPropertyField` (select nativo), reutilizando el mismo componente ya usado por los tres widgets fijos existentes — sin una segunda implementación de segmented. Un campo con 1 o con 6+ valores no se ve afectado por esta regla y sigue como `<select>`. Esta regla aplica de forma uniforme en cualquier tipo de nodo y en cualquier subsección (`Props`, `Diseño`), sin lista explícita de campos que mantener.

El control resultante se presenta dentro de la misma fila label-izquierda/control-derecha que ya usan los campos de texto/número/enum/booleano genéricos (nombre del campo a la izquierda, segmentos a la derecha) — a diferencia de los tres usos ya existentes y fijos de `SegmentedTogglePropertyField` (`container` "Modo", `heading` "Nivel", `tabs` "Orientación"), que no van en fila y no muestran ningún label visible por tratarse de bloques especiales fuera de la iteración genérica de campos (ver [[#Referencia visual]]). Esos tres usos fijos no cambian.

### FR2 — Exclusión de campos ya cubiertos por un widget dedicado o por FR3
Un campo que ya resuelve a un widget del `WIDGET_REGISTRY` (`layout-span`, `choice-items`, `icon`, `heading-level`, `tabs-orientation`, `condition-group`) o que cumple la convención de nombre de FR3 (swatches) nunca pasa por la regla de FR1, aunque su enum tenga entre 2 y 5 valores — esas rutas de resolución tienen prioridad y son mutuamente excluyentes con el segmented genérico.

### FR3 — Swatches de color por convención de nombre
Cualquier propiedad cuyo nombre de campo sea literalmente `color` dentro de `props`, con un enum como schema, se muestra como una fila de muestras de color (una por valor del enum) en vez de `<select>` o segmented, con independencia de su número de opciones. Cada muestra usa un color sólido de una paleta fija propia del editor (una entrada por nombre semántico del catálogo compartido `neutral/primary/success/warning/danger/info` ya usado por `stat.props.color`/`badge.props.color`/`button.props.color`), visualmente coherente con — pero no acoplada en código a — la paleta que usa el runtime de producción para renderizar esos mismos nodos. Un nombre de color fuera de ese catálogo fijo no bloquea el resto del panel: se degrada sin ninguna muestra marcada como activa.

Igual que FR1, el widget se presenta dentro de la misma fila label-izquierda/control-derecha que el resto de campos genéricos (nombre del campo, p. ej. "color", a la izquierda; fila de muestras a la derecha) — ver [[#Referencia visual]].

### FR4 — Selección e interacción de swatches
Seleccionar una muestra aplica su valor con el mismo pipeline de commit/validación que el resto del panel. La muestra activa se distingue visualmente (anillo o borde). El control implementa semántica `radiogroup`/`radio` equivalente a `SegmentedTogglePropertyField` (roving tabindex, flecha izquierda/derecha entre muestras, nombre accesible por muestra igual al nombre semántico del color, no solo el color visual).

Junto a la fila de muestras se muestra, como texto, el nombre semántico del color actualmente seleccionado (por ejemplo "primary"). Si el valor actual está fuera del catálogo fijo (mismo caso límite de FR3, ninguna muestra activa), ese texto no se muestra — coherente con "ninguna muestra marcada como activa": no hay ningún nombre semántico que mostrar.

### FR5 — Interruptor tipo píldora para booleanos
Todo campo booleano resuelto por el dispatcher genérico (`BooleanPropertyField`) se muestra como un interruptor on/off con el estilo del diseño de referencia (`role="switch"`, `aria-checked`) en vez del checkbox actual. El comportamiento de commit, la fila label-control y el criterio de aviso ante commit rechazado no cambian.

### FR6 — Re-skin de las filas del widget `layout.span`
Las seis filas fijas (`base`/`sm`/`md`/`lg`/`xl`/`2xl`) del widget "Columnas" adoptan el estilo del diseño de referencia: contenedor tipo tarjeta en vez del `fieldset` actual, tipografía y espaciados coherentes con el resto del panel ya restilado por F-A, mismo indicador `/ N` y mismo botón "Quitar" con el nuevo estilo. El comportamiento (valor heredado en gris, clave explícita, conversión entero→mapa, validación por fila) no cambia.

### FR7 — Barra de vista previa de ocupación
Bajo las seis filas, el widget muestra una barra horizontal de vista previa dividida en `N` segmentos (el denominador resuelto del `container` ancestro) con los segmentos correspondientes al valor de span resuelto del nodo destacados, y una leyenda de texto ("Vista previa en {breakpoint}: ocupa {span} de {N}."). El breakpoint que se previsualiza es, por defecto, `base`; recibir foco en el input de otra fila cambia la vista previa al breakpoint de esa fila mientras el foco permanezca ahí, y vuelve a `base` al perderlo si ninguna otra fila lo captura. Un span resuelto mayor que `N` (estado ya posible hoy si el container reduce sus columnas en un breakpoint superior sin que `layout.span` se haya ajustado) no rompe la barra: se recorta visualmente al ancho completo sin desbordar el contenedor.

### FR8 — Eliminación de la caja con borde/fondo de los grupos de campos genéricos
El panel de propiedades hoy envuelve en una caja con borde y fondo (`fieldset` con `border`/`bg-white`/padding) tres tipos de grupo: el contenido raíz de cada pestaña (`Props`/`Diseño`/`Visibilidad`/`Queries`), cualquier grupo anidado generado por el editor genérico de objetos o de arrays (por ejemplo un campo de tipo mapa por breakpoint como `container.props.columns` responsive, o una lista de objetos como `tabs.props.items`/`executeOperations.operations`), y el bloque del selector de variante de acciones (`DiscriminatedUnionPropertyField`: "Acción"/"Acción de envío" y, dentro de él, el sub-grupo de campos propios de la variante activa). Esta regla retira esa caja (borde y fondo) de los tres, quedando los campos en lista plana sin ninguna línea divisoria — sin excepción de nivel: aplica tanto al grupo raíz de una pestaña como a cualquier grupo anidado dentro de ella, y a cualquier uso del selector de variante de acciones (`button.props.action`, `link.props.action`, `form.submitAction` y sus listas `onSuccess`/`onError`/`operations`).

Un grupo que hoy ya tiene un título (`legend`) visible (no oculto) conserva ese título como texto de cabecera simple (mismo estilo tipográfico ya usado para las etiquetas de subsección — mayúsculas pequeñas, gris, sin fondo ni caja), sin caja alrededor de sus campos. El contenido raíz de cada pestaña, cuyo título va oculto hoy porque la pestaña activa ya cumple ese rol, no gana ningún título nuevo: solo pierde la caja. Esta regla no introduce ninguna clasificación o agrupación nueva de campos por categoría (ver Fuera de alcance) — cada grupo conserva exactamente los campos y el título que ya tiene hoy, solo cambia si se envuelve o no en una caja visual.

Los widgets dedicados con presentación propia (`choice-items`, icon picker, condición/grupo, editor clave-valor, `layout-span`) no se ven afectados por esta regla en su propia estructura interna — su presentación actual de F-A no cambia — salvo que, dentro de su propia implementación, deleguen en el dispatcher genérico para alguno de sus propios sub-campos; en ese caso, ese sub-campo delegado sigue la misma regla que cualquier otro grupo genérico.

## Requisitos no funcionales
- Solo utilidades de Tailwind CSS; sin dependencias nuevas ni estilos inline.
- Sin cambios de comportamiento de commit, validación o accesibilidad de foco más allá de lo descrito (roving tabindex, ARIA) en cada FR.
- Cambios acotados al editor de desarrollo (`src/dev-runtime/`); cero impacto en el runtime de producción y en el modo Visual.
- Se mantiene el umbral global de cobertura del 80%.

## Criterios de aceptación
1. `stat.props.variant` (`accent`/`tinted`/`plain`, 3 opciones) se muestra como segmented en la pestaña `Props`, dentro de una fila label-izquierda ("variant") / control-derecha (segmentos), igual que cualquier otro campo genérico de esa pestaña.
2. `container.props.justify` (6 opciones) permanece como `<select>` con el estilo base ya vigente; no se ve afectado por FR1.
3. `stat.props.color` y `badge.props.color` (mismo catálogo de 6 nombres semánticos) se muestran como fila de swatches, no como segmented ni `<select>`, pese a tener 6 opciones, dentro de una fila label-izquierda ("color") / control-derecha (swatches).
4. `alert.props.type` (mismo catálogo de 6 nombres, pero campo llamado `type`, no `color`) permanece como `<select>` restilado: no cumple ni la regla de swatches (nombre) ni la de segmented (cardinalidad).
5. Un campo booleano genérico de cualquier nodo se muestra como interruptor on/off, no como checkbox, y sigue commiteando igual que antes.
6. El widget "Columnas" de un nodo con `layout.span` de tres claves explícitas (`base`, `md`, `xl`) muestra las seis filas con el nuevo estilo y, bajo ellas, la barra de vista previa reflejando `base` por defecto.
7. Dar foco al input de la fila `md` cambia la vista previa a mostrar la ocupación resuelta en `md`; perder el foco (sin mover a otra fila) la devuelve a `base`.
8. Elegir una muestra de color distinta en `stat.props.color` commitea el cambio, se refleja en el contenido renderizado y en Monaco, actualiza la muestra activa y el texto con el nombre semántico junto a las muestras pasa a mostrar el nuevo nombre.
9. Un commit rechazado en cualquiera de los controles restilados (segmented, swatch, interruptor, fila de "Columnas") conserva el valor elegido y muestra el aviso `role="alert"` existente, sin regresión respecto al comportamiento de F-A.
10. Los widgets `choice-items`, icon picker, condición/grupo, editor clave-valor, selector "Contenido" de `link` y los tres usos ya existentes y fijos de segmented no cambian de aspecto respecto al estado dejado por F-A.
11. El contenido raíz de cada pestaña (`Props`/`Diseño`/`Visibilidad`/`Queries`) se muestra sin ninguna caja con borde/fondo alrededor, en cualquier tipo de nodo.
12. Un grupo anidado con título visible hoy (por ejemplo un campo de tipo mapa por breakpoint como `container.props.columns` responsive, o el bloque "Acción de envío" de `form`) pierde la caja con borde/fondo pero conserva su título como texto de cabecera simple, sin caja.
13. El selector de variante de acciones (`button.props.action` con la variante "Ejecutar operación", por ejemplo) pierde la caja con borde/fondo tanto en el bloque "Acción" como en el sub-grupo de campos propios de la variante activa, conservando ambos títulos como texto y sin cambiar ninguna otra interacción (selector de variante, reconstrucción de valor por defecto, opción "Sin acción").
14. Los campos de `stat` en la pestaña `Props` no se agrupan bajo cabeceras de categoría (tipo `IDENTIDAD`/`CONTENIDO`/`APARIENCIA`): siguen en la misma lista plana de F-A, solo sin caja.

## Casos límite
- Un enum con exactamente 1 valor declarado (caso degenerado no usado hoy en el catálogo real) no cumple el mínimo de 2 de `SegmentedTogglePropertyField` y permanece como `<select>`.
- Un valor de `color` presente en el config pero fuera del catálogo semántico fijo (por ejemplo editado a mano en Monaco con un nombre inválido) no bloquea el panel: la fila de swatches se muestra sin ninguna marcada activa y sin ningún texto de nombre semántico junto a ella.
- Un nodo `layout.span` como entero plano (sin mapa por breakpoint) sigue mostrando la vista previa para `base`, coherente con el valor uniforme heredado en las seis filas.
- Cambiar de pestaña o de nodo seleccionado con una fila de "Columnas" enfocada no dispara ningún commit adicional: el cambio de breakpoint previsualizado es un estado puramente visual, no persistido.
- Una lista de objetos vacía o con un único elemento (por ejemplo `tabs.props.items` en su mínimo de una pestaña) pierde la caja igual que con varios elementos: FR8 no depende de la cantidad de elementos del grupo.

## Riesgos o preguntas abiertas
- FR1 tiene alcance amplio: convierte a segmented una decena de campos ya existentes en varios tipos de nodo (`container.props.align`, `container.props.wrap`, `container.props.variant`, `modal.props.size`, `button.props.variant`, `badge.props.variant`, `stat.props.variant`, `divider.props.variant`, `skeleton.props.variant`, `toggle.props.labelPosition`, entre otros). Es un cambio visual amplio pero mecánico y reversible; conviene una pasada de QA visual sobre varios tipos de nodo durante la implementación, no solo sobre `stat`.
- La paleta fija de swatches (FR3) vive en el editor, no reutiliza en código la resolución de estilos del runtime de producción (`runtime-node-styling-*.ts`) para mantener la frontera entre editor y runtime; si en el futuro cambia la paleta semántica de producción, alguien deberá recordar sincronizar manualmente la paleta del editor.
- El campo `variant` del mock de Figma (ver [[#Referencia visual]]) se ve como una caja de texto simple, no como un grupo de segmentos — inconsistente con el resto de campos segmented del mismo mock y con el resto de esta spec, que exige segmented para cualquier enum de 2-5 valores (FR1) sin excepción por nombre de campo. No se ha podido confirmar contra el archivo de Figma completo (API no disponible al escribir esto). Se asume que es una particularidad de esa captura concreta y FR1/el criterio de aceptación 1 se mantienen sin cambios; si al reintentar el acceso a Figma se confirma que `variant` tiene un tratamiento distinto y deliberado, esta spec necesitará una revisión adicional antes de planificar esa parte.
- El resto de detalles finos del mock (tipografía exacta, espaciados, color de las cabeceras de sección que si existieran) no se han podido verificar contra el archivo de Figma completo por el mismo motivo (rate limit de la API); `generate-implementation-plan` puede fijarlos con criterio propio dentro del lenguaje visual ya vigente en el panel restilado por F-A, sin que eso cambie el comportamiento fijado en esta spec.

## Áreas de producto afectadas (alto nivel)
- Editor visual del `layout` en modo Editor: dispatcher genérico de campos del panel de propiedades, widget `layout.span`.

## Documentación probablemente afectada (alto nivel)
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (secciones del dispatcher genérico y del widget de `layout.span`).
