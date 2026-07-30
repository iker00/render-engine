# Spec: shell de aplicación con cabecera configurable

## Objetivo

Permitir declarar un chrome de aplicación compartido y persistente entre páginas (el **shell**), empezando por una
cabecera (**header**) configurable con logo, título, menú de navegación (incluyendo un nivel de agrupación mediante
desplegables) y acciones de usuario. Resuelve la necesidad de apps de gestión que requieren navegación consistente
(marca, menú, acciones de usuario) sin repetir el mismo bloque de layout en cada página declarada.

Esta spec cubre únicamente el header. Un sidebar vertical con navegación jerárquica propia queda como feature futura
("Spec B"), que reutilizará el mismo contrato de item de menú ya anidado que fija esta spec.

## Alcance

- Nuevo bloque raíz opcional `shell`, hermano de `api`/`pages`/`initialPage`/`preloads`/`tokens`/`translations`.
- Ausencia del bloque `shell`, o `shell` sin `header`: el runtime se comporta exactamente igual que antes de esta
  feature, sin ningún cambio visual ni de validación.
- `shell.header`, objeto opcional con cuatro elementos, todos opcionales de forma independiente entre sí. Cualquier
  combinación es válida, incluida ninguna:
  - `logo`: imagen.
  - `title`: texto.
  - `menu`: lista de items de navegación (`menuItem`).
  - `actions`: lista de nodos libres, restringida a `link` y `button`.
- El header se renderiza una única vez por sesión de runtime, persistente entre navegaciones de página. No forma
  parte de `pages[].layout`.
- Disposición: flujo natural izquierda→derecha — `logo`, `title` y `menu` aparecen en ese orden si existen (omitiendo
  los ausentes); `actions` se empuja siempre al extremo derecho, independientemente de qué otros elementos existan.
  El menú no se centra matemáticamente respecto al ancho total.
- `menuItem = { label, icon?, href? | action?, visibility?, children? }`:
  - `label` obligatorio.
  - `icon` opcional, mismo catálogo Lucide ya usado por el resto del runtime (`button`, `link`, `input`, etc.).
  - `href` (enlace externo) y `action` (`navigateTo` o `goBack`) son mutuamente excluyentes entre sí. Mismo contrato
    ya validado de `link.props.href` / `link.props.action`, incluida la validación de `pageId` existente en `pages`
    para `navigateTo`.
  - `visibility` opcional, mismo contrato transversal estándar (`forms.*`, `queries.*`, `params.*`) — sin `item.*`, al
    no existir contexto de iteración a nivel de shell.
  - `children` opcional: lista de `menuItem` anidados, **un único nivel de profundidad** (los `menuItem` dentro de
    `children` no pueden declarar a su vez `children`). Un `menuItem` con `children` actúa como disparador de un
    desplegable y es **mutuamente excluyente con `href`/`action`**: no puede ser a la vez trigger de desplegable y
    destino navegable, para no crear ambigüedad sobre qué hace el click.
- Interacción del desplegable: se abre con click/tap sobre el `menuItem` padre y se cierra al hacer click fuera, al
  pulsar Esc, o al seleccionar uno de sus items hijos. No depende de hover, para mantener el mismo comportamiento en
  desktop, táctil y navegación por teclado/lector de pantalla.
- Estado activo automático: cuando un `menuItem` (de nivel raíz o dentro de `children`) con `action.navigateTo` tiene
  `pageId` igual al de la página actualmente visible, el runtime lo marca automáticamente como activo (visualmente
  distinguible), sin configuración adicional. Si el item activo es un hijo dentro de un desplegable, el `menuItem`
  padre que lo contiene también se marca como activo, aunque el padre no sea navegable directamente.
- `shell.header.actions` acepta nodos de tipo `link` y `button` únicamente, reutilizando el contrato ya validado de
  esos nodos en el catálogo existente. Se eligen ambos porque cubren los dos casos reales de "acciones de usuario":
  `link` para navegación/enlaces externos, `button` para acciones que no son navegación (por ejemplo, un logout real
  vía `executeOperation`, que `link` no soporta).
- Cuando `shell` declara `header`, este se aplica a **todas** las páginas de la app sin excepción. No existe opt-out
  por página en esta spec.
- El shape del bloque `shell` se diseña (en `design.md`) sabiendo que una feature futura añadirá `sidebar` junto a
  `header`, reutilizando el mismo `menuItem` (ya anidado a un nivel). El sidebar podrá necesitar más de un nivel de
  profundidad al ser una navegación vertical tipo árbol; esta spec no amplía la profundidad más allá de un nivel para
  el header, pero el contrato de `shell` no debe forzar una reestructuración cuando esa ampliación llegue.
- Editor visual: nueva sección de nivel superior **"Shell"**, al mismo nivel que las secciones existentes
  Layout/Páginas/API/Tokens. Al seleccionarla, el área donde normalmente se renderiza el canvas se sustituye por un
  formulario de configuración: toggle para activar/desactivar el header, y campos para logo, título, lista de menú
  (incluyendo alta/edición de `children` por item) y lista de acciones. La única interacción drag-and-drop disponible
  en esta sección es reordenar los items de `shell.header.menu` dentro de su mismo nivel (raíz o dentro de los
  `children` de un mismo padre); el resto de edición (añadir, quitar, editar campos) usa controles de formulario
  estándar.

## Fuera de alcance

- Sidebar vertical con navegación jerárquica propia (feature futura, "Spec B"), que reutilizará el `menuItem` ya
  anidado que fija esta spec y podrá ampliar su profundidad más allá de un nivel.
- Opt-out del shell por página (por ejemplo, una página de login sin chrome). No se ve necesidad real todavía; se
  evaluará como feature aparte si surge.
- El gap ya identificado de que el editor drag-and-drop del canvas no expone hoy la zona de `children` de un nodo
  `link` (causa localizada en `src/runtime/nodes/link-layout-node.tsx` y en `EmptyPlaceholderNodeType` de
  `src/runtime/layout-renderer.tsx`). Es un bug/feature independiente, no parte de esta spec.
- Decisión de representación interna del shell en el runtime (nodos dedicados nuevos vs. reutilización de piezas del
  catálogo existente). Se resuelve en `generate-feature-design`, no se fija aquí.
- Comportamiento responsive/mobile del header y de sus desplegables (colapso, menú tipo hamburguesa, wrapping ante
  título/menú largos, posicionamiento del desplegable en viewport estrecho).
- Theming o estilos visuales configurables del shell más allá de las utilidades de Tailwind ya usadas por el resto
  del runtime; theming declarativo sigue fuera de v1 en todo el proyecto.
- Cualquier tipo de nodo en `actions` distinto de `link` y `button` (por ejemplo, `table`, `repeater`, `tabs`).
- Más de un nivel de anidamiento en `shell.header.menu` (un `menuItem` dentro de `children` no puede tener a su vez
  `children`).
- Cambios en el contrato o comportamiento de `link` como nodo de `layout` normal; esta spec solo reutiliza su
  contrato de acción/href para `menuItem` y como tipo permitido en `actions`.

## Requisitos funcionales

1. El JSON de configuración acepta un bloque raíz opcional `shell`.
2. Si `shell` no se declara, el comportamiento del runtime es idéntico al actual antes de esta feature.
3. `shell.header` es un objeto opcional. Si `shell` no declara `header` (o no declara `shell`), no se renderiza
   ninguna cabecera de shell.
4. `shell.header.logo`, `.title`, `.menu` y `.actions` son todos opcionales de forma independiente. Cualquier
   combinación, incluida ninguna, es válida.
5. El header se renderiza una sola vez por sesión de runtime y persiste visualmente entre navegaciones de página.
6. Disposición: `logo`, `title` y `menu` se renderizan en ese orden de izquierda a derecha, omitiendo los ausentes;
   `actions` se renderiza siempre en el extremo derecho, con independencia de qué otros elementos existan.
7. `shell.header.menu` es un array de `menuItem`. Cada `menuItem` declara `label` (obligatorio), `icon` (opcional),
   `visibility` (opcional), y exactamente uno de estos dos casos: (a) exactamente uno de `href`/`action`, actuando
   como item navegable de hoja; o (b) `children` (no vacío), actuando como disparador de un desplegable sin ser él
   mismo navegable.
8. `menuItem.action` solo admite `navigateTo` o `goBack`, con el mismo contrato de validación que
   `link.props.action` (incluida la comprobación de `pageId` existente en `pages`).
9. `menuItem.href` admite el mismo contrato que `link.props.href` (literal o referencia dinámica completa).
10. `menuItem.visibility` es opcional y sigue el contrato transversal estándar de `visibility`, sin soporte de
    `item.*`.
11. `menuItem.children` es un array opcional de `menuItem`. Los `menuItem` dentro de `children` siguen las mismas
    reglas 7-10, pero no pueden declarar a su vez `children` (máximo un nivel de profundidad).
12. Un `menuItem` con `children` no puede declarar `href` ni `action`; es exclusivamente disparador de desplegable.
13. El desplegable de un `menuItem` con `children` se abre con click/tap sobre el propio item, y se cierra al hacer
    click fuera del desplegable, al pulsar Esc, o al seleccionar uno de sus items hijos.
14. Cuando un `menuItem` (de nivel raíz o dentro de `children`) con `action.navigateTo.pageId` coincide con la
    página actualmente visible, el runtime lo marca automáticamente como activo, sin configuración adicional.
15. Si el `menuItem` marcado como activo está dentro de `children`, su `menuItem` padre también se marca como
    activo, sin que el padre sea navegable directamente.
16. `shell.header.actions` es un array opcional de nodos restringido a los tipos `link` y `button`, reutilizando el
    contrato ya validado de cada uno.
17. El editor visual añade una nueva sección de nivel superior "Shell", junto a Layout/Páginas/API/Tokens.
18. Al seleccionar "Shell", el área de render habitual se sustituye por un formulario de configuración: toggle de
    activación del header, y campos para logo, título, lista de menú (con alta/edición de `children` por item) y
    lista de acciones.
19. La única interacción drag-and-drop disponible en la sección "Shell" es reordenar items de `shell.header.menu`
    dentro de su mismo nivel (raíz, o dentro de los `children` de un mismo padre). El resto de edición usa controles
    de formulario estándar (inputs, toggles, selects).

## Requisitos no funcionales

- Retrocompatibilidad total: cualquier configuración existente sin `shell` sigue funcionando exactamente igual, sin
  cambios visuales ni de validación.
- Reutilizar los contratos de validación ya existentes (`link.props.action`, `link.props.href`, `visibility`) en vez
  de duplicar reglas divergentes para `menuItem`.
- El shape de `shell` debe permitir añadir `sidebar` en una feature futura sin romper compatibilidad hacia atrás ni
  requerir reestructurar `shell.header`.
- El desplegable de un `menuItem` con `children` debe ser operable por teclado (foco, apertura/cierre, navegación
  entre items hijos) y anunciar su estado (`aria-expanded`) para lectores de pantalla, consistente con los patrones
  de accesibilidad ya usados por `accordion` y `tabs` en el resto del runtime.
- La nueva sección "Shell" del editor no debe alterar el comportamiento ni el estado de la sección Layout existente.

## Criterios de aceptación

- Dado un config sin bloque `shell`, el runtime renderiza exactamente igual que antes de esta feature.
- Dado `shell.header` con solo `logo` declarado, se renderiza únicamente el logo (sin título, menú ni acciones) en
  todas las páginas.
- Dado `shell.header` con solo `menu` declarado, el menú se renderiza en flujo natural sin logo ni título
  precediéndolo.
- Dado un `menuItem` con `href` y `action` declarados simultáneamente, el config se rechaza en validación previa con
  diagnóstico de ruta exacta.
- Dado un `menuItem` sin `href`, `action` ni `children`, el config se rechaza en validación previa.
- Dado un `menuItem` con `children` y además `href` o `action` declarados, el config se rechaza en validación previa
  con diagnóstico de ruta exacta.
- Dado un `menuItem` dentro de `children` que a su vez declara `children` (segundo nivel de anidamiento), el config
  se rechaza en validación previa con diagnóstico de ruta exacta.
- Dado un `menuItem.action.navigateTo.pageId` que no existe en `pages`, el config se rechaza, igual que en `link`.
- Dado un `menuItem` con `children` no vacío, al hacer click/tap sobre él se abre el desplegable mostrando sus items
  hijos; un click fuera, Esc, o seleccionar un item hijo lo cierra.
- Dado un `menuItem.action.navigateTo.pageId` igual al de la página actualmente visible, ese item se muestra
  visualmente distinguido como activo.
- Dado un item hijo dentro de `children` marcado como activo, su `menuItem` padre también se muestra visualmente
  distinguido como activo.
- Dado un `menuItem.action: goBack`, ese item nunca participa en el resaltado automático de "activo".
- Dado `shell.header.actions` con un nodo de tipo distinto de `link`/`button` (por ejemplo `table`), el config se
  rechaza con diagnóstico de ruta exacta.
- Dado `shell.header.actions` con un `button` cuya `action` sea `executeOperation`, el config es válido y la acción
  se ejecuta con normalidad al interactuar.
- En el editor visual, seleccionar la sección "Shell" sustituye el área de render por el formulario de configuración
  sin alterar el estado de la sección Layout.
- Reordenar un `menuItem` mediante drag-and-drop en el formulario de Shell persiste el nuevo orden en
  `shell.header.menu`, respetando el nivel (raíz o dentro de los `children` del mismo padre) en el que se reordena.

## Casos límite

- `shell` declarado pero sin `header` (o `header` vacío `{}`): no se renderiza ninguna cabecera, equivalente a no
  declarar `shell`.
- `shell.header.menu: []`: header sin sección de menú; el resto de elementos declarados se renderiza con normalidad.
- `shell.header.actions: []`: equivalente a no declarar `actions`.
- `menuItem.children: []` (array vacío declarado explícitamente): se rechaza en validación previa, igual que
  `link.children: []` se rechaza hoy — un desplegable sin ningún item no tiene sentido funcional.
- La página activa no coincide con ningún `menuItem.action.navigateTo.pageId` (ni de nivel raíz ni dentro de
  `children`): ningún item del menú se marca como activo.
- Dos `menuItem` distintos (de cualquier nivel) navegan al mismo `pageId`: ambos se marcan como activos
  simultáneamente cuando esa página está visible, junto con sus respectivos padres si aplica.
- Un `menuItem` de nivel raíz o dentro de `children` queda oculto por `visibility`: el resto de items de su mismo
  nivel se recalcula sin dejar hueco, igual que cualquier otro nodo oculto por `visibility` en el runtime. Si todos
  los `children` de un padre quedan ocultos, el padre sigue siendo un disparador de desplegable válido (el
  desplegable se abriría vacío); no se define en esta spec si el padre debería ocultarse automáticamente en ese caso
  — queda anotado en riesgos.
- Título largo combinado con menú largo (con o sin desplegables) en un viewport estrecho: comportamiento no
  especificado en esta spec (ver riesgos/preguntas abiertas).
- `shell.header.actions` con un único `link` sin `children` ni `props.label`: se rechaza igual que hoy rechaza
  `link` como nodo de layout normal (regla ya existente, no nueva).

## Riesgos o preguntas abiertas

- Comportamiento responsive/mobile del header y de sus desplegables (colapso, menú hamburguesa, wrapping,
  posicionamiento del desplegable en viewport estrecho) no está definido en esta spec. Queda como decisión pendiente
  para `design.md` o para una spec de ajuste posterior si se detecta necesidad real de uso en pantallas estrechas.
- La representación interna del shell en el runtime (nodos dedicados nuevos vs. reutilización de piezas del catálogo
  existente) se decide en `generate-feature-design`. Esta feature dispara `requires_design: true` por ser transversal
  (nuevo bloque raíz, motor de render y editor visual a la vez) y por tener más de una estrategia técnica razonable.
- El shape exacto de `shell` debe quedar diseñado en `design.md` de forma que la futura Spec B (sidebar vertical) no
  requiera romper compatibilidad ni reestructurar lo que fije esta spec, incluida una eventual ampliación de
  `menuItem.children` más allá de un nivel para ese contexto vertical.
- No se define si un `menuItem` padre cuyo `children` queda completamente oculto por `visibility` debe ocultarse él
  mismo automáticamente o seguir mostrándose como disparador de un desplegable vacío. Se deja como pregunta abierta
  no bloqueante; el comportamiento por defecto asumido hasta resolverlo es que el padre sigue visible.
