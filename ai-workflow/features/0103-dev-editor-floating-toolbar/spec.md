# Spec: Editor visual in-place con barra flotante (modo desarrollo)

## Objetivo

Sustituir la carcasa de edición visual introducida por `0102-dev-editor-visual-layout-canvas` — un drawer lateral
con pestañas Visual/JSON que monta un árbol de canvas duplicado, con su propia instancia aislada de
`RuntimeStateProvider` — por edición directamente sobre el propio contenido renderizado del runtime (el mismo árbol
real que ve el usuario final, no una copia), controlada por una **barra de herramientas flotante persistente** con
dos modos explícitos: **Visual** (interacción normal) y **Editor** (selección, edición y arrastre, con el
comportamiento propio de los nodos suprimido).

## Contexto

`0102` ya implementó y dejó en producción el "motor" de edición visual del árbol `layout`: modelo de direccionamiento
por `path` estructural, `LayoutEditModeContext` y su wrapper de selección/hover en el renderer de producción
(`layout-node-renderer.tsx`), funciones puras de mutación del árbol, un pipeline de commit que valida y migra estado
igual que el botón "Aplicar" y parchea solo la clave `layout` sobre el último texto crudo válido, un formulario de
propiedades generado desde el mismo schema Zod que ya alimenta el autocompletado de Monaco, breadcrumb de ancestros,
placeholders visibles para contenedores/formularios vacíos, tratamiento específico de `repeater`/`accordion`/`tabs`/
`modal` en modo edición, y arrastre completo (`@dnd-kit/core`) para reordenar, reanidar, insertar desde una paleta de
nodos y borrar (ver `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Editor visual del layout
(pestaña Visual)").

Ese motor vive hoy dentro de una pestaña "Visual" del drawer (`DevRuntimeDrawer`), que monta `LayoutCanvas` con su
propia instancia de `RuntimeStateProvider`, aislada del runtime real que se renderiza detrás del drawer — así puede
editar cualquier página sin depender de a qué página haya navegado el runtime visible, pero a costa de que el canvas
no es realmente "el sitio", sino una segunda copia renderizada aparte.

Salió de una conversación de `explore-feature-scope` la idea de que el editor visual debería ser el propio contenido
renderizado — sin árbol duplicado — con manipulación directa igual que builders como Webflow o Framer, sustituyendo
el punto de entrada actual (botón flotante + drawer) por una barra de herramientas flotante que además sienta la base
para las siguientes features de la hoja de ruta (`EDITOR-VISUAL-ROADMAP.md`): edición visual de `api`, `pages`,
`tokens` y `translations`, cada una como feature independiente posterior.

## Alcance

- **Barra de herramientas flotante persistente**: sustituye el botón flotante inferior derecho y el atajo de teclado
  `Ctrl/Cmd+Shift+J` actuales como único punto de entrada al editor. Se activa exactamente bajo las mismas
  condiciones que ya rigen `DevRuntime` hoy (`import.meta.env.DEV`, o `data-enable-dev-mode` en producción), y
  permanece visible en todo momento mientras `DevRuntime` esté montado, con independencia de la página activa del
  runtime.
- **Selector de página**: dropdown en la barra que cambia la página activa. A diferencia del selector aislado de
  `0102`, este selector pilota la **navegación real** del runtime (cambia el hash / `pageEntry` como lo haría
  cualquier navegación normal) — ya no existe una segunda instancia de `RuntimeStateProvider` para el canvas.
- **Selector de pestaña de dominio**: `Layout` / `Api` / `Páginas` / `Tokens`. En esta feature **solo `Layout` es
  funcional**; el resto aparecen visibles en la barra pero deshabilitadas o marcadas como "próximamente" — su
  contenido queda para las features ya previstas en `EDITOR-VISUAL-ROADMAP.md`, no se implementa aquí.
- **Botón "Añadir elemento"**: abre la paleta de nodos ya construida en `0102` como panel flotante lateral, con el
  mismo mecanismo de arrastre hacia el contenido para insertar un nodo nuevo, sin cambios en su lógica de inserción
  ni en el catálogo de tipos disponible.
- **Acceso a Monaco/JSON reubicado**: el editor Monaco, la acción "Aplicar", la acción "Copiar", el autocompletado
  JSON Schema, la recarga por HMR y la guardia de cambios aplicados siguen existiendo exactamente con el
  comportamiento ya vigente (ver `dev-mode-editor.md`), pero su punto de entrada pasa a ser un control dentro de la
  nueva barra flotante en vez del botón flotante independiente y el atajo de teclado actuales. Sigue sincronizado en
  vivo y bidireccionalmente con el contenido editado visualmente, igual que hoy.
- **Toggle Visual / Editor** (estado por defecto al montar: **Visual**):
  - **Modo Visual**: el contenido se comporta exactamente igual que en producción — navegación por `link`/`button`,
    envío de formularios, ejecución de queries, campos de formulario editables con normalidad. Sin selección ni
    edición posible.
  - **Modo Editor**: se activa la selección por click/hover sobre el contenido real (reutilizando el wrapper de
    `LayoutEditModeContext` ya construido en `0102`, ahora aplicado sobre el árbol real en vez de uno duplicado),
    arrastre para reordenar/reanidar/insertar, borrado de nodo, y edición de propiedades — reutilizando el motor
    completo de `0102` sin cambios de lógica. Mientras este modo está activo, **se suprime por completo el
    comportamiento propio de los nodos**: ninguna acción declarativa (`navigateTo`, `goBack`, `executeOperation(s)`,
    `openModal`/`closeModal` disparada por click, `resetForm`, envío de `form`) se ejecuta, y los campos de
    formulario (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`) quedan inertes a
    su propia interacción nativa (no se puede teclear ni marcar directamente sobre el campo renderizado); la única
    vía para cambiar cualquier valor de configuración en modo Editor es el canvas (arrastre, borrado) o el panel de
    propiedades del nodo seleccionado.
  - **Excepción explícita a la supresión**: la interactividad puramente local de cabecera de `accordion` (expandir/
    colapsar) y de `tabs` (cambiar de pestaña visible) sigue funcionando en modo Editor exactamente igual que ya
    documenta `0102` para su canvas — no es una acción de runtime ni navegación, y hace falta para poder alcanzar y
    seleccionar nodos anidados bajo cabeceras distintas. El cuerpo de `accordion` y el panel de `modal` siguen
    siempre presentes en el DOM en modo Editor con independencia de su estado, igual que ya hace `0102`.
- **Breadcrumb y panel de propiedades del nodo seleccionado**: overlay flotante propio junto al nodo seleccionado,
  separado de la barra global de página/pestaña/modo, visible solo en modo Editor. Mismo contenido y comportamiento
  ya construido en `0102` (breadcrumb clicable, secciones `Props`/`Layout`/`Visibilidad`/`Estado de consulta` según
  el `type` del nodo).
- **Requisito de layout — los paneles flotantes no alteran el contenido**: la paleta de nodos, el overlay de
  breadcrumb+propiedades, y cualquier superficie flotante que introduzca esta feature deben superponerse (con
  sombra/elevación) sobre el contenido ya renderizado sin reducir su ancho disponible ni forzar su reflow. El
  contenido debe verse, en todo momento, con exactamente el mismo layout que en modo Visual o en producción — es
  la garantía de que editar en modo Editor muestra fielmente cómo se ve el resultado real. El comportamiento
  concreto cuando un panel flotante tapa visualmente al nodo seleccionado (reposicionamiento automático, colapsar,
  aceptar la superposición) queda como decisión técnica para `design.md`.
- **Persistencia sin cambios**: todo sigue ocurriendo en memoria de sesión, igual que hoy. El mecanismo de "Copiar"
  existente sigue siendo la vía para conservar el resultado.

## Fuera de alcance

- Implementar contenido funcional de las pestañas `Api`, `Páginas` o `Tokens` de la barra — quedan reservadas
  visualmente pero su edición real corresponde a sus propias features, ya previstas en `EDITOR-VISUAL-ROADMAP.md`.
- Cualquier cambio de comportamiento o de contrato del motor de edición visual ya construido en `0102`: modelo de
  `path`, reglas de destino de drop, tratamiento de `repeater`/contenedores vacíos, formulario de propiedades por
  JSON Schema, pipeline de commit/validación. Esta feature reutiliza ese motor tal cual; solo cambia dónde vive el
  árbol editado (el real, no uno duplicado), cómo se llega a él (barra flotante en vez de drawer con pestañas) y
  añade la supresión de comportamiento propio de los nodos en modo Editor.
- Deshacer/rehacer, selección múltiple, duplicar/copiar un nodo o atajos de teclado dedicados — mismo alcance ya
  excluido en `0102`.
- Pickers contextuales para referencias string (`queries.x`, `forms.x`, `params.x`, `{{...}}`) — mismo alcance ya
  excluido en `0102`.
- Persistencia entre sesiones del navegador o escritura a disco.
- Cambiar la frontera de activación de `DevRuntime` (`import.meta.env.DEV` o `data-enable-dev-mode`).
- Cualquier cambio en el contrato observable del runtime en producción o en su schema Zod.
- Composición visual exacta de dónde vive Monaco dentro de la barra flotante (panel propio, drawer reubicado u otro
  mecanismo) — se deja como decisión técnica explícita para `design.md`.

## Requisitos funcionales

1. Mientras `DevRuntime` esté montado, una barra de herramientas flotante permanece visible en todo momento, con
   independencia de la página activa del runtime y del modo (Visual/Editor) vigente.
2. La barra incluye un selector de página que, al cambiar de valor, navega realmente el runtime a la página
   seleccionada (mismo mecanismo que una navegación interna por hash), en cualquiera de los dos modos.
3. La barra incluye un selector de pestaña con al menos `Layout`, `Api`, `Páginas` y `Tokens`. Solo `Layout` es
   seleccionable y funcional; las demás se muestran deshabilitadas o con indicación de "próximamente", sin acción al
   interactuar con ellas.
4. La barra incluye un botón "Añadir elemento" que, al activarse, muestra la paleta de nodos del catálogo completo
   como panel flotante superpuesto sobre el contenido, sin alterar su ancho ni su layout, desde el que se puede
   arrastrar un tipo de nodo hasta una posición válida del contenido para insertarlo.
5. La barra incluye un control de acceso a Monaco/JSON que sustituye al botón flotante y atajo de teclado
   independientes actuales; al activarlo, se muestra el mismo editor Monaco ya existente (autocompletado JSON
   Schema, acciones Aplicar/Copiar, panel de errores) sincronizado en vivo con el estado en memoria.
6. La barra incluye un control Visual/Editor con estado inicial **Visual** al montar `DevRuntime`.
7. En modo Visual, el contenido renderizado se comporta exactamente igual que en producción: navegación por
   `link`/`button`, envío de `form`, ejecución de queries, e interacción nativa de campos de formulario funcionan sin
   restricciones. No hay selección, breadcrumb, panel de propiedades ni indicadores de arrastre visibles.
8. En modo Editor, hacer click sobre un nodo renderizado del contenido real lo selecciona; hacer hover lo resalta sin
   cambiar la selección — mismo comportamiento de `path` estructural ya construido en `0102`, ahora aplicado sobre el
   árbol real.
9. En modo Editor, el nodo seleccionado muestra un overlay flotante propio (separado de la barra global) con el
   breadcrumb de ancestros y el formulario de propiedades ya construidos en `0102`, superpuesto sobre el contenido
   sin alterar su ancho ni su layout.
10. En modo Editor, ningún nodo ejecuta su comportamiento propio: ni acciones declarativas (`navigateTo`, `goBack`,
    `executeOperation`/`executeOperations`, `openModal`/`closeModal`, `resetForm`, envío de `form`) ni la interacción
    nativa nativa de campos de formulario (teclear, marcar, seleccionar opciones). La única forma de modificar
    configuración en modo Editor es a través del canvas (arrastrar, borrar) o del panel de propiedades del nodo
    seleccionado.
11. Como excepción explícita al punto 10, la cabecera interactiva de `accordion` (expandir/colapsar) y de `tabs`
    (cambiar pestaña visible) sigue funcionando en modo Editor; el cuerpo de `accordion` y el panel de `modal` se
    mantienen siempre presentes en el DOM en modo Editor con independencia de su estado, igual que ya documenta
    `0102`.
12. En modo Editor, arrastrar un nodo existente permite reordenarlo o reanidarlo, y arrastrar desde la paleta abierta
    con "Añadir elemento" inserta un nodo nuevo, ambos sujetos a las mismas reglas de destino ya vigentes en `0102`
    (reutilizadas sin duplicar).
13. En modo Editor, con un nodo seleccionado, la acción de borrado ya construida en `0102` lo elimina junto con su
    subárbol y limpia la selección.
14. Cualquier mutación confirmada desde el canvas en modo Editor (mover, insertar, borrar, editar propiedades) se
    valida y aplica mediante el mismo pipeline de commit ya construido en `0102` (mismo validador, misma migración de
    estado, mismo parcheo del texto de Monaco), y se refleja de inmediato en el contenido real y en Monaco.
15. Cambiar de página mediante el selector de la barra mientras hay un nodo seleccionado en modo Editor limpia esa
    selección y su overlay de breadcrumb/propiedades.
16. Alternar de Editor a Visual oculta el overlay de breadcrumb/propiedades y la paleta si estuviera abierta, y
    restaura toda la interactividad nativa de los nodos (navegación, envío, campos de formulario) sin necesidad de
    recargar la página.

## Requisitos no funcionales

- Los paneles flotantes introducidos por esta feature (paleta, overlay de breadcrumb+propiedades) no deben reducir
  el ancho disponible del contenido renderizado ni forzar su reflow en ningún viewport soportado; deben superponerse
  visualmente sobre él.
- La supresión de comportamiento propio de los nodos en modo Editor no debe introducir un segundo mecanismo de
  reglas de acción divergente del ya existente en `src/runtime/runtime-actions/`; debe interceptar sobre el mismo
  punto de disparo ya centralizado, sin reimplementar por nodo qué acciones existen.
- La eliminación del árbol de canvas duplicado no debe modificar el comportamiento observable de `layout-node-renderer.tsx`
  ni de ningún nodo cuando `LayoutEditModeContext` está ausente (producción, y cualquier consumo fuera de
  `DevRuntime`) — mismo requisito ya vigente desde `0102`.
- La capa de edición visual y la barra flotante solo deben existir bajo las mismas condiciones de activación que ya
  rigen `DevRuntime` hoy; no debe aparecer código de esta feature en el bundle de producción fuera de esas
  condiciones.
- Cobertura de tests debe mantener el umbral mínimo global del 80% sobre `src/`.

## Criterios de aceptación

- Al montar `DevRuntime` con la barra flotante visible, el modo activo por defecto es Visual: click en un `link` con
  `action.navigateTo` navega con normalidad.
- Activar el modo Editor desde la barra y hacer click sobre un `heading` anidado dentro de `container > form` muestra
  el overlay con breadcrumb de 3 niveles y su panel de propiedades, sin que el ancho del `form` renderizado cambie
  respecto al que tenía en modo Visual.
- En modo Editor, hacer click en un `button` cuya `props.action` es `navigateTo` no navega ni ejecuta la acción; el
  nodo queda seleccionado.
- En modo Editor, escribir en un campo `input` renderizado directamente (sin pasar por el panel de propiedades) no
  modifica `forms.{formId}.{fieldId}`; cambiar `props.defaultValue` desde el panel de propiedades sí lo hace y se
  refleja en el campo.
- En modo Editor, la cabecera de un `accordion` sigue alternando `aria-expanded` al clicarla, y sus `children` siguen
  visibles en el DOM tanto expandido como colapsado.
- Cambiar de página desde el selector de la barra en modo Editor navega el runtime a la nueva página (cambia el hash
  visible) y limpia cualquier selección previa.
- Pulsar "Añadir elemento" y arrastrar un `input` hasta dentro de un `form` existente lo inserta ahí; el ancho del
  contenido no cambia al abrir la paleta.
- Volver a modo Visual tras haber seleccionado un nodo oculta el overlay de breadcrumb/propiedades y restaura la
  interactividad nativa de todos los nodos, incluidos los campos de formulario.
- Abrir el acceso a Monaco desde la barra flotante, editar el JSON y pulsar "Aplicar" actualiza el contenido
  renderizado con la misma migración de estado ya vigente hoy.
- Interactuar con la pestaña "Api" (o "Páginas"/"Tokens") de la barra no produce ningún cambio de contenido ni
  navegación — se muestra deshabilitada o con indicación de no disponible.

## Casos límite

- Seleccionar un nodo en modo Editor y, sin cambiar de página, alternar a modo Visual y volver a Editor: la selección
  no se restaura automáticamente (se trata como una nueva entrada a modo Editor sin selección previa), salvo que se
  decida lo contrario en `design.md` por motivos técnicos — comportamiento por defecto: sin selección.
- Eliminar desde Monaco, en modo Editor, el nodo actualmente seleccionado y aplicar: la selección y el overlay
  degradan de forma segura (se limpian) en vez de referenciar un nodo inexistente — mismo comportamiento ya
  garantizado por `0102`.
- Arrastrar un nodo sobre sí mismo o sobre uno de sus propios descendientes en modo Editor: destino inválido, sin
  cambios en el `layout` — mismo comportamiento ya garantizado por `0102`.
- Activar el commit de una mutación del canvas mientras hay cambios sin aplicar en Monaco: el commit sobrescribe
  deliberadamente el texto pendiente de Monaco — mismo comportamiento ya garantizado por `0102`.
- Un overlay de breadcrumb/propiedades o la paleta que, por la posición del nodo seleccionado, quedarían fuera del
  viewport o solaparían por completo al propio nodo seleccionado: el comportamiento exacto (reposicionamiento,
  scroll, u otro) queda como decisión técnica abierta para `design.md`, no bloqueante para esta spec.
- Cambiar la pestaña de dominio a `Api`/`Páginas`/`Tokens` estando en modo Editor con un nodo de `layout`
  seleccionado: la selección y su overlay se limpian, ya que esas pestañas no tienen contenido de `layout` que
  editar en esta feature.

## Riesgos o preguntas abiertas

- **Estrategia técnica para eliminar el árbol de canvas duplicado**: cómo se envuelve condicionalmente el árbol real
  de `DevRuntime` (hoy montado sin `LayoutEditModeContext`) para que el modo Editor actúe sobre él en vez de sobre
  una instancia aislada de `RuntimeStateProvider`, sin duplicar renderers ni introducir una segunda fuente de verdad.
  Debe resolverse en `design.md`.
- **Mecanismo de supresión de comportamiento propio de los nodos en modo Editor**: dónde se intercepta de forma
  centralizada la ejecución de acciones declarativas y de la interacción nativa de campos de formulario sin
  reimplementar la lógica por cada tipo de nodo, y sin duplicar el catálogo de acciones ya existente en
  `runtime-actions/`. Debe resolverse en `design.md`.
- **Composición visual exacta de los paneles flotantes**: dónde vive Monaco dentro de la barra (panel propio, drawer
  reubicado u otro mecanismo), y qué ocurre cuando un panel flotante tapa al nodo seleccionado. Debe resolverse en
  `design.md`.
- **Persistencia de la selección al alternar entre modos**: si técnicamente es sencillo conservar la selección al
  volver de Visual a Editor sin cambiar de página, `design.md` puede proponerlo como mejora sobre el comportamiento
  por defecto fijado en Casos límite (sin selección), siempre que no complique la supresión de acciones.
