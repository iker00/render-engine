# Spec: 0104 — Fix del panel flotante de selección del editor visual

## Objetivo

Corregir tres defectos del overlay flotante que muestra el breadcrumb y el panel de propiedades del nodo
seleccionado en modo Editor (introducido por `0103-dev-editor-floating-toolbar`):

1. El panel no tiene límite de altura, por lo que con un nodo con muchas propiedades (varias secciones
   `Props`/`Layout`/`Visibilidad`/`Estado de consulta` desplegadas) su contenido supera la altura del viewport y
   queda inaccesible: el `overflow-y-auto` ya declarado en el panel interno es inerte porque ni el panel ni su
   contenedor tienen una altura máxima que lo active.
2. El panel se ancla junto al nodo seleccionado (con clamping de viewport), lo que en muchos casos lo superpone
   directamente sobre el propio nodo que se está editando, impidiendo verlo mientras se edita.
3. El panel no tiene ningún botón de cierre explícito ni se cierra con `Esc`; solo desaparece si se borra el nodo,
   se cambia de página o el nodo deja de existir en el árbol.

## Contexto del problema

`FloatingSelectionOverlay` (`src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx`) se renderiza como
`position: fixed`, anclado mediante `useAnchoredPosition` (`overlay-anchor-position.ts`) a la posición del nodo
seleccionado (`getBoundingClientRect()` del elemento anclado, con clamping de `top`/`left` para no salirse del
viewport). Ni el contenedor del overlay ni `LayoutCanvasPropertiesPanel` (el panel interno con
`overflow-y-auto`) tienen `max-height` alguna, así que el panel crece a su altura de contenido natural sin límite.

Aparte, el panel flotante de Monaco (`FloatingMonacoPanel`) ya usa un patrón distinto y consolidado: panel fijo a
la derecha a pantalla completa (`fixed inset-y-0 right-0`, hasta `max-w-2xl`), con su propio botón "Cerrar" y
cierre por `Esc`. Hoy ese panel de Monaco y el overlay de selección no tienen ninguna exclusión mutua entre sí:
pueden estar visibles los dos a la vez, compitiendo por el lado derecho de la pantalla.

## Alcance

- Sustituir el anclaje del panel de selección (breadcrumb + propiedades) junto al nodo por un panel fijo acoplado
  al lado derecho de la pantalla, siguiendo el mismo patrón visual ya establecido por el panel de Monaco (panel
  `fixed` a la derecha, con altura próxima a la completa del viewport y scroll interno propio).
- Añadir un botón de cierre explícito al panel de selección, y extender el cierre por `Esc` (hoy solo ligado a
  Monaco) para que también cierre el panel de selección cuando esté abierto y Monaco no lo esté.
- Cerrar el panel de selección **limpia la selección del nodo** (mismo efecto que borrar el nodo o cambiar de
  página): al cerrar, deja de haber nodo seleccionado, el resaltado desaparece, y una nueva selección vuelve a
  abrir el panel con normalidad.
- Introducir exclusión mutua entre el panel de selección y el panel de Monaco: abrir uno cierra el otro si estaba
  abierto, de forma que el lado derecho de la pantalla muestre como máximo un panel a la vez. Concretamente:
  - Seleccionar un nodo en modo Editor mientras el panel de Monaco está abierto cierra el panel de Monaco.
  - Abrir el panel de Monaco desde la barra mientras hay un nodo seleccionado con su panel visible cierra el panel
    de selección (limpiando la selección, igual que el cierre explícito).

## Fuera de alcance

- Cualquier cambio en el contenido, campos o comportamiento del panel de propiedades en sí (secciones
  `Props`/`Layout`/`Visibilidad`/`Estado de consulta`, generación dinámica desde JSON Schema, edición en vivo).
- Cualquier cambio en el breadcrumb de ancestros (contenido, navegación por click).
- Cualquier cambio en el panel de Monaco más allá de la exclusión mutua descrita (su contenido, acciones
  Aplicar/Copiar, autocompletado, guardia de cambios aplicados siguen exactamente igual).
- Cualquier cambio en la lógica de selección/hover, en el motor de mutación del árbol, en el pipeline de commit o
  en las reglas de destino de arrastre — todo eso es responsabilidad ya cerrada de `0102`/`0103` y no se toca.
- Cualquier cambio en la paleta flotante de nodos ("Añadir elemento") o su relación con los otros paneles.
- Persistencia entre sesiones, deshacer/rehacer, selección múltiple — mismo alcance ya excluido en `0102`/`0103`.

## Requisitos funcionales

1. En modo Editor, con un nodo seleccionado, el panel de breadcrumb + propiedades se muestra como un panel fijo
   acoplado al borde derecho de la pantalla, con una altura entre el 90% y el 100% del alto del viewport y scroll
   vertical propio cuando su contenido excede esa altura.
2. El panel de selección incluye un botón de cierre visible. Al pulsarlo, el panel se oculta y la selección del
   nodo se limpia (el resaltado de selección desaparece del contenido).
3. Mientras el panel de selección está abierto y el panel de Monaco no lo está, pulsar `Esc` cierra el panel de
   selección con el mismo efecto que el botón de cierre (limpia la selección).
4. Si el panel de Monaco está abierto, `Esc` sigue cerrando el panel de Monaco (comportamiento ya vigente, sin
   cambios) y no afecta a la selección del nodo si la hubiera.
5. Seleccionar un nodo en modo Editor mientras el panel de Monaco está abierto cierra automáticamente el panel de
   Monaco y muestra el panel de selección del nodo recién seleccionado.
6. Abrir el panel de Monaco desde el botón de la barra flotante mientras el panel de selección está visible cierra
   el panel de selección (limpiando la selección) y muestra el panel de Monaco.
7. El panel de selección, al mostrarse a la derecha, no reduce el ancho disponible del contenido renderizado ni
   fuerza su reflow — mismo requisito transversal ya vigente para todos los paneles flotantes desde `0103`.
8. El resto de comportamiento del panel de selección (contenido de las secciones, edición en vivo de campos,
   breadcrumb clicable, botón "Eliminar nodo") permanece exactamente igual que hoy.

## Requisitos no funcionales

- El nuevo posicionamiento del panel de selección debe reutilizar, en la medida de lo razonable, el mismo patrón
  visual ya usado por el panel de Monaco (panel `fixed` a la derecha), evitando introducir un segundo mecanismo de
  panel lateral divergente.
- Cobertura de tests debe mantener el umbral mínimo global del 80% sobre `src/`.

## Criterios de aceptación

- Seleccionar en modo Editor un nodo con varias secciones de propiedades desplegadas (suficientes para superar la
  altura del viewport) muestra el panel con scroll vertical interno, permitiendo llegar a todos los campos y
  botones (incluido "Eliminar nodo") sin que ningún contenido quede fuera de alcance.
- El panel de selección aparece acoplado al borde derecho de la pantalla, sin superponerse directamente sobre el
  nodo seleccionado en el contenido renderizado.
- El panel de selección muestra un botón de cierre; al pulsarlo, el panel desaparece y el nodo deja de estar
  seleccionado (sin resaltado visible en el contenido).
- Con el panel de selección abierto y el de Monaco cerrado, pulsar `Esc` cierra el panel de selección y limpia la
  selección.
- Con un nodo seleccionado y su panel visible, abrir Monaco desde la barra cierra el panel de selección (limpia la
  selección) y muestra el panel de Monaco a la derecha.
- Con el panel de Monaco abierto, seleccionar un nodo en el contenido cierra el panel de Monaco y muestra el panel
  de selección del nodo elegido.
- Con el panel de Monaco abierto, pulsar `Esc` sigue cerrando el panel de Monaco exactamente igual que hoy.
- Abrir el panel de selección no reduce el ancho del contenido renderizado respecto al que tenía sin el panel
  abierto.

## Casos límite

- **Nodo seleccionado con muy pocas propiedades** (panel más bajo que el viewport): el panel no debe mostrar una
  barra de scroll vacía ni comportarse de forma distinta a un panel con contenido más largo; simplemente no hay
  overflow.
- **Cerrar el panel de selección y volver a seleccionar el mismo nodo**: se trata como una nueva selección; el
  panel se vuelve a abrir con normalidad (mismo comportamiento que ya existe hoy al deseleccionar por otras vías,
  p. ej. cambio de página).
- **Cambiar de página mientras el panel de selección está abierto**: sigue limpiando la selección y cerrando el
  panel, comportamiento ya vigente sin cambios por este fix.
- **Borrar el nodo seleccionado desde su propio panel** ("Eliminar nodo"): sigue limpiando la selección y cerrando
  el panel, comportamiento ya vigente sin cambios por este fix.
- **`Esc` sin ningún panel abierto**: no produce ningún efecto, igual que hoy.

## Riesgos o preguntas abiertas

Ninguno bloqueante. El cambio está acotado a reposicionamiento CSS, un botón de cierre y una exclusión mutua entre
dos paneles ya existentes, sin tocar el motor de edición ni el contrato de datos.

## Documentación afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: actualizar la sección "Overlay flotante de
  selección" (y cualquier referencia cruzada a su anclaje junto al nodo) para reflejar el panel acoplado a la
  derecha, el botón de cierre, el cierre por `Esc` y la exclusión mutua con el panel de Monaco.
