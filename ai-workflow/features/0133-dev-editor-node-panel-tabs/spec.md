# 0133 — Panel de propiedades del editor visual en pestañas (F-A del rediseño)

## Objetivo
Reorganizar el panel de selección del modo Editor (breadcrumb + panel de propiedades del nodo seleccionado) en una estructura de pestañas con el lenguaje visual del diseño de referencia de Figma (`render-engine`, nodos `40:502`/`40:783`/`40:950`): cabecera compacta con breadcrumb y acciones, barra de pestañas, secciones con filas label-a-la-izquierda y controles con el estilo de tarjeta. No cambia el conjunto de campos editables, el contrato JSON ni el pipeline de commit/validación: es la primera entrega (estructura y estilo base) de un rediseño en tres features; los widgets complejos (F-B) y el editor por-estado de `queryStateFeedback` (F-C) quedan para entregas posteriores.

El diseño de Figma se toma como referencia de proporciones y ritmo visual, no como medidas literales: el panel real tiene otro ancho y las medidas deben ser relativas (ver requisitos no funcionales).

## Alcance
- Cabecera del panel de selección: breadcrumb de ancestros (segmentos atenuados, último segmento destacado), nombre del tipo de nodo en titular, y las acciones "Eliminar nodo" y "Cerrar" como botones-icono compactos alineados a la derecha.
- Fila de identidad con el `id` del nodo en modo solo lectura.
- Barra de pestañas con cuatro pestañas, en este orden y con estas etiquetas exactas: `Props`, `Diseño`, `Visibilidad`, `Queries`. Cada pestaña muestra el contenido de la subsección que hoy se apila verticalmente (`props`, `layout`, `visibility`, `queryStateFeedback` respectivamente).
- Reubicación de los bloques especiales que hoy se muestran fuera de las subsecciones, todos al principio de la pestaña `Props`: selector de modo de contenido de `link` ("Contenido"), selector de modo de `container` ("Modo") y bloque "Acción de envío" (`form.submitAction`).
- Estilo visual base del diseño de referencia: filas de campo con etiqueta a la izquierda y control a la derecha, headers de grupo en mayúsculas cuando el dispatcher ya genere agrupaciones anidadas, y re-estilado de los controles simples (inputs de texto y numéricos, selects, textareas, checkboxes) con bordes, radios y tipografía coherentes con el diseño.
- Semántica accesible de pestañas (tablist/tab/tabpanel con navegación por teclado).
- La reutilización del panel dentro de la sección `Shell` (lista de acciones del header) hereda la nueva estructura tal cual, sin trabajo específico.

## Fuera de alcance
- F-B: widgets dedicados con el estilo del diseño (segmented restilado, swatches de color, re-skin del widget `layout-span` y su vista previa de ocupación, icon picker restilado). Los widgets existentes se muestran dentro de las pestañas con su aspecto actual.
- F-C: editor por-estado tipo acordeón para `queryStateFeedback`. La pestaña `Queries` muestra el editor genérico actual.
- Cualquier campo nuevo o cambio de contrato JSON: nada del diseño de Figma que no exista en el modelo de datos actual (espaciado, alineación, tamaño, estado, datos/binding, accesibilidad, avanzado, "mostrar en", nombre del nodo, unidad, posición de icono, énfasis, radio…).
- Edición del `id` del nodo (solo lectura en esta entrega).
- Convertir el panel en una tarjeta flotante anclada al nodo: conserva su posición actual de panel fijo acoplado al borde derecho.
- Agrupaciones semánticas de props tipo "IDENTIDAD/CONTENIDO/APARIENCIA" del mock: exigirían metadatos por tipo de nodo que no existen; los campos siguen en el orden que declara el schema.
- Cambios en el runtime de producción, en Monaco, en la barra flotante o en el resto de paneles del editor (`Shell` como formulario propio, `Traducciones`).

## Requisitos funcionales

### FR1 — Barra de pestañas
Con un nodo seleccionado en modo Editor, el panel muestra una barra de pestañas bajo la cabecera con las pestañas `Props`, `Diseño`, `Visibilidad` y `Queries`, en ese orden. Solo una pestaña está activa a la vez y solo se renderiza el contenido de la pestaña activa. La pestaña activa se distingue visualmente (texto destacado y subrayado inferior, según el diseño de referencia).

### FR2 — Pestañas sin contenido se ocultan
Una pestaña solo existe si el nodo seleccionado tiene contenido para ella:
- `Props`, `Visibilidad` y `Queries` existen cuando el schema del tipo de nodo declara la subsección correspondiente (mismo criterio con el que hoy se omiten subsecciones no declaradas).
- `Diseño` existe solo cuando hoy se mostraría la subsección `Layout`: nodo con al menos un `container` ancestro con `props.columns` declarado. En contextos sin árbol de página (p. ej. la lista de acciones de `Shell`), `Diseño` no existe nunca.
La barra se muestra aunque solo exista una pestaña.

### FR3 — Pestaña activa al cambiar la selección
Cada cambio de nodo seleccionado (click en el canvas, click en un segmento del breadcrumb, selección tras insertar desde la paleta) activa siempre la primera pestaña disponible del nuevo nodo (normalmente `Props`). No se conserva la pestaña activa del nodo anterior.

### FR4 — Cabecera del panel
La cabecera del panel muestra, de arriba abajo: el breadcrumb de ancestros en una línea (segmentos ancestros atenuados y clicables con el mismo comportamiento actual; el último segmento, el nodo seleccionado, destacado y no clicable) y el `type` del nodo como titular destacado. A la derecha, dos botones-icono compactos con el comportamiento actual sin cambios: eliminar nodo (borra el nodo y su subárbol y limpia la selección; solo visible cuando el borrado está disponible, igual que hoy) y cerrar (oculta el panel y limpia la selección). `Esc` conserva su comportamiento actual. Ambos botones mantienen un nombre accesible explícito.

### FR5 — Fila de identidad
Bajo la cabecera (fuera de las pestañas, visible con cualquier pestaña activa) se muestra una fila "id" en modo solo lectura con estilo de campo deshabilitado: el `id` del nodo si lo declara, o un placeholder atenuado si no. No es editable ni enfocable como campo de formulario.

### FR6 — Contenido de las pestañas
- `Props`: primero los bloques especiales cuando apliquen al tipo de nodo (selector "Contenido" de `link`, selector "Modo" de `container`, bloque "Acción de envío" de `form`), después los campos de la subsección `props` generados por el dispatcher, igual que hoy.
- `Diseño`: la subsección `layout` actual (widget `layout-span` incluido, con su aspecto vigente).
- `Visibilidad`: la subsección `visibility` actual (widget de condición/grupo incluido).
- `Queries`: la subsección `queryStateFeedback` actual con el editor genérico.
Dentro de una pestaña no se repite el título de la subsección como encabezado propio (la pestaña ya lo nombra).

### FR7 — Comportamiento de edición sin cambios
Editar cualquier campo desde cualquier pestaña sigue el mismo flujo actual: commit inmediato con validación del config completo, reflejo en el contenido renderizado y en el buffer de Monaco, y aviso `role="alert"` bajo el campo ante un commit rechazado, conservando el valor tecleado. Cambiar de pestaña dentro del mismo nodo no descarta valores rechazados pendientes ni sus avisos: al volver a la pestaña siguen visibles. Cambiar de nodo seleccionado los limpia, igual que hoy.

### FR8 — Estilo base de filas y controles
Dentro de las pestañas, cada campo simple se presenta como fila con la etiqueta a la izquierda y el control a la derecha. Los controles simples (input de texto, input numérico, select, textarea, checkbox) adoptan el estilo del diseño de referencia (fondo blanco, borde sutil, esquinas redondeadas, tipografía compacta). Los widgets dedicados existentes (`layout-span`, `choice-items`, icon picker, segmented, condición/grupo, clave-valor) se muestran dentro de su pestaña sin re-estilado propio en esta entrega.

### FR9 — Accesibilidad de la barra de pestañas
La barra implementa semántica `tablist`/`tab`/`tabpanel`: `aria-selected` en la pestaña activa, panel asociado a su pestaña, y navegación por teclado con flecha izquierda/derecha entre pestañas (activación al mover el foco, con ajuste en los extremos coherente con los patrones ya usados en el editor).

### FR10 — Reutilización en Shell
La lista de acciones del header en la sección `Shell`, que monta el panel de propiedades completo, hereda automáticamente la nueva estructura: mismas pestañas y estilo, sin pestaña `Diseño` (no hay árbol de página). Sin ningún comportamiento específico adicional para `Shell`.

## Requisitos no funcionales
- Solo utilidades de Tailwind CSS; sin dependencias nuevas ni estilos inline.
- Medidas relativas, no píxel-perfect: la etiqueta de una fila ocupa aproximadamente un tercio del ancho disponible con un ancho mínimo en píxeles para anchos pequeños; el control ocupa el resto. Paddings, radios y tamaños tipográficos se aproximan a los tokens de Tailwind más cercanos al diseño. Sin scroll horizontal en el panel en ningún caso.
- El panel conserva su posición, ancho y comportamiento de scroll actuales (fijo al borde derecho, 90–100% de la altura del viewport, scroll vertical interno).
- Cambios acotados al editor de desarrollo (`src/dev-runtime/`); cero impacto en el runtime de producción y en el modo Visual.
- Se mantiene el umbral global de cobertura del 80%.

## Criterios de aceptación
1. Seleccionar un nodo `stat` dentro de un `container` con `columns` muestra la cabecera (breadcrumb + titular + botones-icono de eliminar y cerrar), la fila `id` y las pestañas `Props`, `Diseño`, `Visibilidad`, `Queries`, con `Props` activa y solo su contenido renderizado.
2. Seleccionar el mismo nodo sin ningún `container` ancestro con `columns` no muestra la pestaña `Diseño`; las otras tres sí.
3. Seleccionar un nodo `hidden` muestra únicamente la pestaña `Props` (su schema no declara `layout`, `visibility` ni `queryStateFeedback`), con la barra de pestañas visible.
4. Con la pestaña `Visibilidad` activa, seleccionar otro nodo (por canvas o breadcrumb) muestra el nuevo nodo con su primera pestaña disponible activa.
5. Un nodo sin `id` muestra la fila de identidad con placeholder atenuado; un nodo con `id` muestra su valor; en ningún caso el campo es editable.
6. En un nodo `form`, el bloque "Acción de envío" aparece al principio de la pestaña `Props`; en un `link`, el selector "Contenido"; en un `container`, el selector "Modo". Ninguno aparece fuera de `Props`.
7. Un commit rechazado en la pestaña `Visibilidad` mantiene el valor editado y su aviso `role="alert"`; cambiar a `Props` y volver a `Visibilidad` conserva ambos; seleccionar otro nodo los limpia.
8. Editar un campo de `Props` de un nodo actualiza el contenido renderizado y el buffer de Monaco igual que antes del cambio (mismo pipeline, misma guardia de cambios aplicados).
9. La barra de pestañas expone `role="tablist"` con `role="tab"`/`aria-selected` y paneles `role="tabpanel"`; las flechas izquierda/derecha mueven la pestaña activa.
10. El editor de una acción del header en la sección `Shell` muestra el panel con pestañas (sin `Diseño`) y permite editar props y visibilidad con el mismo pipeline de commit de `Shell`.
11. Los botones de eliminar y cerrar conservan su función actual (borrado de subárbol + limpieza de selección; cierre + limpieza de selección) y un nombre accesible.
12. En un ancho de panel pequeño, las filas mantienen etiqueta y control sin scroll horizontal (etiqueta con ancho mínimo, control flexible).

## Casos límite
- Nodo con una única pestaña disponible (`hidden`): la barra se muestra igualmente con esa única pestaña activa.
- Contexto sin árbol de página (lista de acciones de `Shell`): `Diseño` nunca existe; el resto de pestañas siguen el schema del nodo.
- Eliminar el nodo con una pestaña distinta de `Props` activa: el panel se cierra y la selección se limpia, sin errores por contenido desmontado.
- La disponibilidad de pestañas es estable mientras no cambia la selección (deriva del schema del tipo y del ancestro `container`, no del valor editado): ninguna edición dentro del panel puede hacer desaparecer la pestaña activa.
- Un nodo `link` reutilizado en `Shell` muestra su selector "Contenido" al principio de `Props`, igual que en `Layout`.

## Riesgos o preguntas abiertas
- Consistencia visual intermedia: hasta F-B, los widgets dedicados conservan su aspecto actual dentro de pestañas ya restiladas. Aceptado deliberadamente como estado transitorio de la serie.
- El reseteo de pestaña activa en cada selección (FR3) puede resultar repetitivo al editar la misma faceta en varios nodos seguidos; decisión de producto explícita, revisable en una feature posterior si molesta en el uso real.
- La suite actual de tests del panel y de `Shell` referencia la estructura apilada (headings de subsección); la migración de esos tests es amplia pero mecánica.

## Áreas de producto afectadas (alto nivel)
- Editor visual del `layout` en modo Editor: panel de selección (cabecera, breadcrumb, panel de propiedades).
- Sección `Shell`: editor de acciones del header (herencia del mismo panel).

## Documentación probablemente afectada (alto nivel)
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (secciones del panel de selección y panel de propiedades).
