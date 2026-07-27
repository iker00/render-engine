# Spec: Editor visual directo del layout (modo desarrollo)

## Objetivo

Añadir al modo de desarrollo local una capa de edición visual del árbol `layout` de la página activa, mediante
manipulación directa sobre el propio preview ya renderizado, como alternativa a escribir JSON a mano en el editor
Monaco. El objetivo es que el flujo habitual para construir y ajustar un layout sea la UI, dejando Monaco como vía de
escape para casos puntuales (referencias, tipos de nodo o combinaciones que la UI todavía no cubra).

## Contexto

Hoy, `DevRuntime` (ver `ai-workflow/docs/app-features/development/dev-mode-editor.md`) ofrece un editor Monaco en un
drawer lateral, con autocompletado derivado del schema Zod raíz (`runtimeConfigRootSchema` en
`src/config/runtime-config-root-zod.ts` → `toJSONSchema`). Es funcional, pero exige escribir y mantener JSON a mano.

Esta feature es el primer punto de una hoja de ruta más amplia que cubrirá progresivamente edición visual de `layout`, `api`,
`pages`, `tokens` y `translations` en features independientes. Esta spec cubre únicamente el árbol
`layout` de una página.

Salió de una conversación de `explore-feature-scope` en la que se descartó explícitamente un panel de árbol tipo
"layers" (lista separada del render) en favor de manipulación directa sobre el propio contenido renderizado, al
estilo de builders visuales como Webflow o Framer.

## Alcance

- La capa de edición vive dentro del drawer existente de `DevRuntime`, junto a Monaco, no lo sustituye.
- **Sincronización en vivo bidireccional**: cualquier cambio hecho en el canvas visual se refleja de inmediato en el
  buffer de Monaco, y cualquier cambio aplicado desde Monaco se refleja de inmediato en el canvas visual. Ambas son
  vistas del mismo estado en memoria.
- **Ámbito por página**: el canvas edita el `layout` de una sola página a la vez — la página actualmente activa en el
  runtime. Se añade un **selector de página** para cambiar cuál se edita. Alta, baja o renombrado de páginas e
  `initialPage` quedan fuera de esta feature.
- **Selección por manipulación directa**: hacer hover o click sobre un nodo ya renderizado en el canvas lo resalta o
  selecciona respectivamente. No existe un panel de árbol/lista independiente del render para navegar la estructura.
- **Breadcrumb de ancestros**: al seleccionar un nodo, se muestra la cadena de ancestros (por ejemplo
  `Página > container > form > input`) hasta la raíz del `layout` de la página. Cada elemento del breadcrumb es
  clicable y selecciona ese nodo ancestro, permitiendo editar las propiedades de un `container` o `form` padre y no
  solo de las hojas.
- **Formulario de propiedades** del nodo seleccionado, generado a partir del mismo schema Zod que ya alimenta el
  autocompletado de Monaco, sin duplicar el contrato. Cubre `props`, `layout` (incluyendo `span`), `visibility` y
  `queryStateFeedback` según lo que admita el `type` del nodo seleccionado.
- **Reordenar y reanidar** nodos existentes arrastrándolos dentro del canvas, respetando las reglas estructurales ya
  vigentes del contrato (`ai-workflow/docs/app-features/config/structure.md`):
  - solo `container` y `form` aceptan `children`.
  - `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` solo son válidos como descendientes de un `form`.
  - `button` sin `action` solo es válido como descendiente de un `form`.
  - `repeater` no acepta `children` (ver más abajo su tratamiento específico).
  - un destino de drop que violaría alguna de estas reglas se señala como inválido y no se acepta el drop.
- **Insertar nodos nuevos** arrastrando desde una paleta con el catálogo completo de tipos de nodo soportados
  (`ai-workflow/docs/app-features/nodes/index.md`) hasta una posición concreta del canvas, respetando las mismas
  reglas estructurales de destino.
- **Eliminar un nodo seleccionado** (y sus `children`, si los tiene) directamente desde el canvas.
- **Contenedores vacíos con placeholder visible**: todo `container` o `form` sin `children` se renderiza en el canvas
  de edición con un marcador visual mínimo (por ejemplo, borde punteado con etiqueta), aunque en el render de
  producción no muestre nada. Ese placeholder es tanto seleccionable como destino válido de drop, para poder empezar
  una página desde cero o insertar el primer hijo de un contenedor vacío.
- **`repeater` como instancia representativa única**: el canvas muestra siempre exactamente una instancia de
  `props.template` (con datos de ejemplo si la colección resuelta no tiene datos reales disponibles en el momento de
  editar). Esa única instancia es la unidad seleccionable, editable y con la que se anida contenido; no se editan por
  separado instancias repetidas adicionales, y el resultado de edición se escribe siempre sobre `props.template`.
- **Persistencia sin cambios**: todo ocurre en memoria de sesión, igual que hoy con Monaco. El botón "Copiar" ya
  existente en el drawer sigue siendo el mecanismo para conservar el resultado.

## Fuera de alcance

- Edición visual de `api`, `pages` (alta/baja/`initialPage`), `tokens` o `translations`. Son features independientes
  posteriores en la misma hoja de ruta.
- Deshacer/rehacer (undo/redo) de las operaciones hechas en el canvas. Se deja explícitamente fuera de esta primera
  entrega; Monaco sigue disponible como red de seguridad manual.
- Selección múltiple de nodos, duplicar/copiar un nodo, o atajos de teclado dedicados (por ejemplo, borrar con la
  tecla `Supr`).
- Pickers específicos conscientes de contexto para referencias string (`queries.x`, `forms.x`, `params.x`,
  `{{...}}`); el formulario de propiedades expone esos campos como el resto de propiedades del schema, sin un
  selector contextual dedicado. Puede abordarse en una iteración posterior si se detecta que limita la utilidad real
  del formulario.
- Persistencia entre sesiones del navegador o escritura a disco; sigue exactamente el límite ya vigente de
  `dev-mode-editor.md`.
- Cambiar la frontera de activación del editor (`import.meta.env.DEV` o `data-enable-dev-mode`); la capa visual se
  activa exactamente en las mismas condiciones que ya activan `DevRuntime` hoy.
- Cualquier cambio en el contrato observable del runtime en producción o en su schema Zod; esta feature es
  exclusivamente una superficie de edición sobre el mismo contrato ya existente.

## Requisitos funcionales

1. El drawer de `DevRuntime` muestra, junto al editor Monaco existente, un canvas que renderiza la página activa con
   una capa de edición visual superpuesta.
2. Un selector de página permite cambiar qué página del array `pages` se muestra y edita en el canvas, sin necesidad
   de navegar el runtime para cambiar de página.
3. Al hacer click sobre un nodo renderizado en el canvas, ese nodo queda seleccionado; al hacer hover sobre un nodo,
   se resalta visualmente sin cambiar la selección.
4. El nodo seleccionado muestra un breadcrumb con la cadena completa de ancestros hasta la raíz del `layout` de la
   página; cada elemento del breadcrumb, al ser clicado, selecciona ese nodo ancestro.
5. El nodo seleccionado muestra un formulario de propiedades generado desde el schema Zod correspondiente a su
   `type`, cubriendo `props`, `layout`, `visibility` y `queryStateFeedback` según lo que ese `type` admita. Editar un
   campo del formulario actualiza el estado en memoria y se refleja de inmediato en el canvas y en Monaco.
6. Arrastrar un nodo existente dentro del canvas permite reordenarlo entre hermanos o reanidarlo bajo un `container`
   o `form` distinto, sujeto a las reglas estructurales del catálogo.
7. Un intento de drop que violaría una regla estructural (por ejemplo, un `input` fuera de un `form`, o cualquier
   nodo dentro de un `repeater`) se señala visualmente como inválido durante el arrastre y no se ejecuta al soltar.
8. La paleta de nodos permite arrastrar un tipo nuevo del catálogo hasta una posición del canvas para insertarlo ahí,
   sujeto a las mismas reglas estructurales de destino que el punto 7.
9. Seleccionar un nodo y disparar la acción de borrado lo elimina del `layout`, junto con todos sus `children` si los
   tiene, y actualiza el canvas y Monaco de inmediato.
10. Un `container` o `form` sin `children` se renderiza en el canvas de edición con un placeholder visible,
    seleccionable y válido como destino de drop; ese placeholder no aparece en el render de producción del mismo
    `layout`.
11. Un nodo `repeater` se renderiza en el canvas de edición como exactamente una instancia de `props.template`
    (con datos de ejemplo si no hay datos reales resueltos); las operaciones de selección, edición de propiedades,
    reordenar/reanidar hijos e inserción desde la paleta dentro de esa instancia actúan sobre `props.template`.
12. Cualquier cambio hecho en el canvas (mover, insertar, borrar, editar props) se refleja en el buffer de Monaco de
    forma inmediata y consistente con el estado resultante en memoria.
13. Cualquier cambio aplicado desde Monaco (tras validación exitosa) se refleja de inmediato en el canvas, incluyendo
    selección, breadcrumb y formulario de propiedades del nodo que estuviera seleccionado si sigue existiendo en el
    nuevo árbol.
14. El botón "Copiar" existente en el drawer sigue copiando el JSON completo vigente, incluyendo los cambios hechos
    desde el canvas visual.

## Requisitos no funcionales

- La capa de edición visual solo debe existir bajo las mismas condiciones de activación que ya rigen `DevRuntime`
  (`import.meta.env.DEV`, o `data-enable-dev-mode` en producción); no debe aparecer código de esta feature en el
  bundle de producción fuera de esas condiciones.
- La generación del formulario de propiedades debe derivarse del mismo schema Zod raíz que ya usa el autocompletado
  de Monaco, sin introducir un segundo contrato de UI que pueda desincronizarse del schema real.
- Las operaciones de arrastre (reordenar, reanidar, insertar) no deben degradar perceptiblemente la fluidez del
  canvas en páginas con una cantidad de nodos representativa del uso real del proyecto.
- La lógica de validación de destino de drop (qué nodo puede ir dentro de qué) debe reutilizar las mismas reglas
  estructurales ya definidas en `src/config/` para la validación del contrato, sin duplicarlas de forma divergente.
- Cobertura de tests debe mantener el umbral mínimo global del 80% sobre `src/`.

## Criterios de aceptación

- Con una página con `layout: []`, el canvas muestra un estado editable (por ejemplo, un placeholder de nivel
  página) desde el que se puede insertar el primer nodo arrastrando desde la paleta.
- Seleccionar un `heading` anidado dentro de `container > form` muestra un breadcrumb de 3 niveles; clicar el
  elemento `container` del breadcrumb selecciona ese `container` y muestra su propio formulario de propiedades.
- Arrastrar un `input` existente desde dentro de un `form` hacia un `container` hermano (sin `form`) no se permite:
  se señala como destino inválido durante el arrastre y el `layout` no cambia al soltar.
- Arrastrar un `input` existente desde un `form` hacia otro `form` distinto de la misma página lo reanida
  correctamente, y el nuevo JSON resultante sigue siendo válido contra `validateRuntimeConfig`.
- Insertar un `button` sin `action` fuera de un `form` (por ejemplo, directamente en el `layout` raíz) no se permite.
- Eliminar un `container` con dos hijos elimina también esos dos hijos del `layout` resultante.
- Un `container` vacío insertado desde la paleta aparece en el canvas con un placeholder visible; el mismo `layout`
  renderizado como preview de producción no muestra ningún rastro visual de ese `container`.
- Un `repeater` cuya colección resuelta está vacía sigue mostrando en el canvas una instancia editable de su
  `props.template`; editar una propiedad de un nodo dentro de esa instancia actualiza `props.template` en el JSON
  resultante, no una instancia repetida inexistente.
- Cambiar el valor de un campo de texto en el formulario de propiedades de un nodo seleccionado actualiza el
  contenido del editor Monaco sin necesidad de pulsar ningún botón "Aplicar" adicional (misma fuente de estado).
- Editar directamente el JSON en Monaco y validar correctamente (acción "Aplicar" ya existente) actualiza el canvas
  visual, conservando la selección si el nodo seleccionado sigue existiendo en el árbol resultante.
- Cambiar de página mediante el selector de página muestra el `layout` de la nueva página seleccionada en el canvas,
  sin alterar el `layout` de la página anterior.

## Casos límite

- Seleccionar un nodo y luego, desde Monaco, eliminar ese mismo nodo del JSON y aplicar: la selección y el
  breadcrumb del canvas deben degradar de forma segura (por ejemplo, deseleccionar) en vez de referenciar un nodo que
  ya no existe.
- Arrastrar un nodo sobre sí mismo, o sobre uno de sus propios descendientes, no debe producir un árbol inconsistente
  ni un ciclo; debe tratarse como drop inválido.
- Insertar un nodo dentro de un `repeater` (en cualquier punto que no sea la instancia de `props.template`) no debe
  ser un destino de drop válido, consistente con que `repeater` rechaza `children` en el contrato existente.
- Cambiar de página mientras hay un nodo seleccionado y su formulario de propiedades abierto debe limpiar esa
  selección, ya que pertenece al `layout` de la página anterior.
- Un `container` con `layout.span` como mapa responsive por breakpoint debe seguir siendo editable desde el
  formulario de propiedades sin perder los breakpoints no visibles en el viewport actual del canvas.

## Riesgos o preguntas abiertas

- **Comportamiento ante JSON de Monaco momentáneamente inválido**: mientras el usuario edita texto en Monaco a mitad
  de una edición (JSON sintácticamente incompleto, o que no valida contra `validateRuntimeConfig`), queda abierto qué
  debe mostrar el canvas — por ejemplo, mantener el último estado válido conocido (congelado) hasta que Monaco vuelva
  a validar, frente a mostrar un estado de error explícito que oculte el canvas temporalmente. Esta decisión tiene
  componente técnica relevante (qué estado intermedio mantener y cómo) y debe resolverse en `design.md`.
- **Estrategia técnica de manipulación directa sobre el DOM renderizado**: no hay decisión tomada sobre cómo
  interceptar drag/drop y calcular zonas de drop contra el layout real (con `span` responsive, tamaños variables,
  placeholders de contenedores vacíos) sin romper el comportamiento propio de nodos como `table`, `image` o
  `repeater`. Incluye si `dnd-kit` (mencionado en la hoja de ruta original) sigue siendo el mejor fit para este
  modelo de interacción o si hace falta una estrategia distinta. Debe resolverse en `design.md`.
- **Generación de formularios desde el schema Zod**: no hay decisión tomada sobre qué mecanismo o librería genera el
  formulario de propiedades a partir de `runtimeConfigRootSchema` de forma mantenible para el catálogo completo de
  nodos. Debe resolverse en `design.md`.
