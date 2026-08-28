> Cuándo leer: shape de `shell.header`, contrato de `menuItem` (raíz y anidado), render y desplegable del menú, estado
> "activo" de navegación, y comportamiento de `shell.header.actions`.
> Tamaño: medio.
> Relacionados: [[sidebar.md]], [[../config/structure.md]], [[../config/validation.md]], [[../navigation/navigate-actions.md]],
> [[../nodes/link.md]], [[../nodes/button.md]], [[../nodes/image.md]], [[../references/visibility.md]],
> [[../development/dev-mode-editor.md]].

# `shell.header`

Cabecera de aplicación compartida y persistente entre páginas. Se monta una única vez por sesión de runtime, fuera
del árbol `pages[].layout` y de su ciclo de vida (no se remonta al navegar de página). Si `shell` no se declara, o
`shell.header` no se declara o es un objeto vacío `{}`, no se renderiza ninguna cabecera y el runtime se comporta
igual que antes de esta feature.

## Shape

```
shell?: {
  header?: {
    logo?: { src?, alt, fetch? }        // mismo contrato que las props del nodo image
    title?: string                       // referencia de texto dinámica, igual que link.props.label
    menu?: MenuItem[]
    actions?: (LinkNode | ButtonNode)[]  // subconjunto: solo type "link" | "button"
  }
}
```

`logo`, `title`, `menu` y `actions` son todos opcionales de forma independiente entre sí: cualquier combinación,
incluida ninguna, es válida. `menu: []` y `actions: []` son equivalentes a no declararlos.

### `logo`
Reutiliza literalmente el contrato de `props` del nodo [`image`](../nodes/image.md): modo `src`/`alt` o modo
`fetch`, mutuamente excluyentes, con las mismas reglas de validación y degradación.

### `title`
String que admite literal, referencia dinámica completa o interpolación `{{...}}`, resuelto con el mismo mecanismo
que el resto de texto visible del runtime (`resolveRuntimeTextReference`). Se renderiza como un `<span>`, no como un
encabezado (`<h1>`/`<h2>`), para no colisionar con el título propio de cada página.

### `menu`
Array de `menuItem`. Ver [Contrato de `menuItem`](#contrato-de-menuitem) más abajo.

### `actions`
Array opcional de nodos restringido a `link` y `button`, reutilizando sin modificar el contrato ya validado de
[`link`](../nodes/link.md) y [`button`](../nodes/button.md), incluida su propia `visibility` y sus propios
contratos de acción (`link` solo `navigateTo`/`goBack`; `button` las 7 variantes soportadas, incluida
`executeOperation`, útil para un logout real).

## Contrato de `menuItem`

Un `menuItem` de nivel raíz declara:
- `label`: string obligatorio, resuelto como referencia de texto dinámica (literal, referencia completa o
  interpolación `{{...}}`).
- `icon`: opcional, mismo catálogo Lucide del resto del runtime; si el nombre no resuelve, se ignora en silencio.
- `visibility`: opcional — ver [Visibilidad de `menuItem`](#visibilidad-de-menuitem).
- exactamente uno de estos tres casos, mutuamente excluyentes:
  - `href`: mismo contrato que `link.props.href` (literal o referencia dinámica completa).
  - `action`: `navigateTo` o `goBack`, mismo contrato de validación que `link.props.action` (incluida la
    comprobación de `pageId` existente en `pages`).
  - `children`: array no vacío de `menuItem` anidados (máximo un nivel de profundidad: un `menuItem` dentro de
    `children` no puede volver a declarar `children`). Convierte el item en disparador de un desplegable; no puede
    combinarse con `href` ni `action`.

Un `menuItem` dentro de `children` acepta los mismos campos (`label`, `icon`, `visibility`, `href`/`action`) pero
nunca `children` — la profundidad máxima es un nivel.

Un `menuItem` sin ninguno de `href`/`action`/`children` se rechaza en validación previa; ver
[`../config/validation.md`](../config/validation.md#reglas-del-bloque-shell) para los mensajes exactos.

### Visibilidad de `menuItem`
`menuItem.visibility` reutiliza el mismo contrato transversal de [`visibility`](../references/visibility.md)
(condición simple u operador `and`/`or`), con las mismas familias de referencia admitidas salvo una: **no admite
`item.*`**, al no existir contexto de iteración a nivel de shell. Admite `params.*`, `forms.{formId}.{fieldId}` y
`queries.{queryName}` (incluidas sus proyecciones `.data`, `.status`, `.error.message`, `.error.code`).

Un `menuItem` de cualquier nivel oculto por `visibility` no deja hueco en su fila; el resto de items de su mismo
nivel se recalcula igual que cualquier otro nodo oculto por `visibility` en el runtime. Si todos los `children` de
un padre quedan ocultos, el padre sigue siendo un disparador de desplegable válido — el desplegable se abriría
vacío; no hay ocultación automática del padre en ese caso.

## Disposición y render

- Flujo natural izquierda→derecha: `logo`, `title` y `menu` aparecen en ese orden si existen (omitiendo los
  ausentes). `actions` se empuja siempre al extremo derecho, con independencia de qué otros elementos existan. El
  menú no se centra matemáticamente respecto al ancho total.
- La fila interna de la cabecera ocupa el ancho completo del contenedor de montaje, sin límite de ancho centrado
  propio — consistente con el resto del chrome y del contenido.
- La cabecera es `sticky` en la parte superior del viewport cuando `shell.scrollBehavior` es `"page"` (default); con
  `"fixed"` deja de ser pegajosa, porque el confinamiento de scroll pasa a resolverlo el propio frame fijo — ver
  [`shell.scrollBehavior`](#shellscrollbehavior).
- Un `menuItem` de hoja (con `href` o `action`) se renderiza como `<a>` (modo `href`) o `<button type="button">`
  (modo `action`), con el mismo ejecutor común de acciones del runtime (`executeRuntimeUiAction`) que ya usan
  `button`/`link` del catálogo de layout.

## Desplegable de `menuItem.children`

- Se abre con click/tap sobre el propio `menuItem` padre; el trigger declara `aria-haspopup="menu"` y
  `aria-expanded` reflejando su estado.
- El desplegable renderizado usa `role="menu"` con cada hijo visible como `role="menuitem"`; los hijos ocultos por
  `visibility` nunca llegan a estar en el DOM del desplegable.
- Se cierra al hacer click fuera del desplegable, al pulsar `Esc` (que además devuelve el foco al trigger), o al
  seleccionar uno de sus items hijos.
- No depende de hover: el comportamiento es idéntico en desktop, táctil y navegación por teclado o lector de
  pantalla.
- Navegación por teclado dentro del desplegable abierto: `ArrowUp`/`ArrowDown` mueven el foco entre los items
  visibles con wraparound; `Home`/`End` saltan al primero/último item visible; `Enter`/`Espacio` sobre un item
  ejecuta su acción (o resuelve su `href`) y cierra el desplegable.
- Se posiciona con `position: absolute` anclado a un contenedor `relative`, sin depender de ninguna librería externa
  de posicionamiento de popovers.

## Estado activo de navegación

El resaltado de "activo" es un valor derivado en cada render, no un estado persistido:
- Un `menuItem` (de nivel raíz o dentro de `children`) con `action.navigateTo.pageId` igual al `pageId` de la
  página actualmente visible se marca automáticamente como activo, sin configuración adicional.
- Si el item activo está dentro de `children`, su `menuItem` padre (el disparador del desplegable) también se marca
  como activo, aunque el padre no sea navegable directamente.
- `menuItem.action: goBack` y los items con `href` nunca participan en el resaltado automático de "activo".
- Si ningún `menuItem.action.navigateTo.pageId` coincide con la página visible, ningún item se marca como activo.
- Si dos `menuItem` distintos (de cualquier nivel) navegan al mismo `pageId`, ambos se marcan como activos
  simultáneamente cuando esa página está visible, junto con sus respectivos padres si aplica.

## `shell.scrollBehavior`

Campo opcional del bloque raíz `shell`, hermano de `header` y `sidebar`, con dos valores admitidos:

- `"page"` (default si se omite, o si `shell` no se declara): comportamiento clásico — la página completa hace
  scroll; `shell.header`, si existe, permanece fijado arriba mediante scroll pegajoso (`sticky`).
- `"fixed"`: `shell.header` y `shell.sidebar` (los que estén declarados) permanecen fijos y visibles ocupando el
  alto disponible del contenedor de montaje; solo el área de contenido de la página activa hace scroll interno
  cuando su contenido excede el alto disponible.

Un valor fuera de `"page"`/`"fixed"` se rechaza en validación previa con diagnóstico de ruta exacta — ver
[[../config/validation.md#reglas-del-bloque-shell]].

Con `scrollBehavior: "fixed"` declarado pero sin que el contenedor de montaje tenga una altura acotada real (por
ejemplo, un `<div>` embebido con alto `auto` dentro de una página que crece con el contenido), el confinamiento del
área de contenido no tiene un límite de alto del que recortar, por lo que ese aspecto concreto degrada visualmente a
un comportamiento equivalente a `"page"`; es responsabilidad de quien integra la app dar una altura acotada al
contenedor de montaje si quiere ese confinamiento real. El posicionamiento pegajoso del chrome no depende de esa
altura acotada — sigue funcionando igual, con o sin ella.

Ver [[sidebar.md#scroll-propio-del-sidebar]] para el scroll propio de `shell.sidebar`, que es independiente de este
campo.

## Ámbito por página

Cuando `shell.header` está declarado, se aplica a **todas** las páginas de la app sin excepción; no existe opt-out
por página.

## Composición con `shell.sidebar`

`shell.header` y `shell.sidebar` (ver [[sidebar.md]]) son secciones independientes y aditivas de `shell`: cualquier
combinación de ambas, incluida ninguna, es válida. Cuando coexisten, el header sigue ocupando el ancho completo en
la parte superior sin cambios respecto a lo descrito aquí; el sidebar arranca debajo, ocupando la altura restante
del viewport.

## Fuera de alcance (v1)

- Comportamiento responsive/mobile del header y de sus desplegables (colapso, menú hamburguesa, wrapping ante
  título/menú largos).
- Theming o estilos visuales configurables del shell más allá de las utilidades Tailwind ya usadas por el resto del
  runtime.
- Cualquier tipo de nodo en `actions` distinto de `link`/`button`.
- Deshacer/rehacer o selección múltiple de `menuItem` en el editor visual (ver
  [`dev-mode-editor.md`](../development/dev-mode-editor.md) para los límites de esa superficie).

## Editor visual

La edición de `shell.header` en modo desarrollo (sección "Shell" de la barra de dominio, formulario dedicado, alta
y reordenación de `menuItem`) está documentada en
[`dev-mode-editor.md`](../development/dev-mode-editor.md#sección-shell-dominio-de-configuración).
