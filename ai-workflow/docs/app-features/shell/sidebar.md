> Cuándo leer: shape de `shell.sidebar`, contrato recursivo de `sidebarItem`, composición con `shell.header`,
> expansión de ramas, auto-expansión de ancestros, modo rail y su flyout, estado "activo" de navegación, y la
> sección "Shell" del editor visual para sidebar.
> Tamaño: medio.
> Relacionados: [[header.md]], [[../config/structure.md]], [[../config/validation.md]],
> [[../navigation/navigate-actions.md]], [[../references/visibility.md]], [[../development/dev-mode-editor.md]].

# `shell.sidebar`

Navegación lateral jerárquica compartida y persistente entre páginas, hermana aditiva de `shell.header` (feature
`0122`) dentro del mismo bloque raíz `shell`. Se monta una única vez por sesión de runtime, fuera del ciclo de vida
de `pages[].layout`/`pageEntry` (no se remonta al navegar de página). Si `shell` no se declara, o `shell.sidebar`
no se declara, o `shell.sidebar.items` está ausente o es `[]`, no se renderiza ningún sidebar y el runtime se
comporta igual que antes de esta feature.

## Shape

```
shell?: {
  header?: { ... }              // ver header.md — sin cambios de contrato
  sidebar?: {
    items?: SidebarItem[]
    defaultCollapsed?: boolean  // default false
  }
}

SidebarItem = {
  label: string                 // referencia de texto dinámica, igual que menuItem.label
  icon?: string                 // catálogo Lucide; si no resuelve, se ignora en silencio
  visibility?: Visibility       // contrato transversal, sin item.*
  href?: string                 // mismo contrato que link.props.href
  action?: NavigateTo | GoBack  // mismo contrato que link.props.action
  children?: SidebarItem[]      // recursivo, no vacío, sin límite de profundidad
}
```

`header` y `sidebar` son opcionales de forma independiente entre sí: cualquier combinación, incluida ninguna, es
válida. `shell.sidebar.items: []` es equivalente a no declarar `sidebar`.

## Contrato de `sidebarItem`

A diferencia de `menuItem`/`menuItemChild` del header (dos tipos Zod fijos, capados a un nivel de anidamiento por
ser un dropdown horizontal — ver [[header.md]]), `sidebarItem` es un único tipo genuinamente recursivo: cualquier
nodo del árbol, a cualquier profundidad, admite los mismos campos, incluidos sus propios `children`, sin tope.

Cada `sidebarItem` declara:
- `label`: string obligatorio, resuelto como referencia de texto dinámica (literal, referencia completa o
  interpolación `{{...}}`).
- `icon`: opcional, mismo catálogo Lucide del resto del runtime.
- `visibility`: opcional — mismo contrato transversal de [`visibility`](../references/visibility.md), **sin
  soporte de `item.*`** (no existe contexto de iteración a nivel de shell). Un item oculto por `visibility` no deja
  hueco en su fila; si todos los `children` de un padre quedan ocultos, el padre sigue siendo un disparador de
  rama válido — la rama se expandiría vacía.
- exactamente uno de estos dos casos, mutuamente excluyentes:
  - `href`/`action` (`navigateTo` o `goBack`, mismo contrato que `link.props.action`, incluida la comprobación de
    `pageId` existente en `pages`): item navegable de hoja.
  - `children` (array no vacío de `sidebarItem`): disparador de una rama; no puede combinarse con `href` ni
    `action`.

Un `sidebarItem` sin ninguno de `href`/`action`/`children`, o con más de uno de los tres, se rechaza en validación
previa; ver [`../config/validation.md`](../config/validation.md#reglas-de-shellsidebar) para los mensajes exactos.

## Composición con `shell.header`

- `shell.header` y `shell.sidebar` declarados a la vez: el header ocupa el ancho completo en la parte superior (sin
  cambios respecto a `0122`); el sidebar arranca debajo, anclado a la izquierda, ocupando la altura restante del
  viewport junto al contenido de la página.
- Solo `shell.sidebar` (sin `shell.header`): el sidebar ocupa toda la altura del viewport desde arriba.
- El contenedor de fila (sidebar + contenido de página) solo se introduce cuando `shell.sidebar.items` es
  no-vacío; sin sidebar, la estructura previa (columna simple) se mantiene sin cambios, en modo desarrollo y en
  producción.

## Expansión de ramas

- Click sobre un `sidebarItem` con `children` expande sus hijos inline, indentados debajo del propio item,
  empujando el resto del contenido del sidebar. El trigger declara `aria-expanded` reflejando su estado.
- Varias ramas pueden estar expandidas simultáneamente en cualquier combinación, sin exclusión tipo `groupId`.
- El estado de expansión de cada rama es estado local del componente del sidebar (no un dominio nuevo en el store
  de runtime): como el sidebar se monta una única vez por sesión y nunca se desmonta al navegar, este estado
  sobrevive a la navegación sin persistencia explícita.

### Auto-expansión de ancestros

Cuando la página activa coincide con el `pageId` de un `sidebarItem` anidado, todas sus ramas ancestro se expanden
automáticamente para mantenerlo visible. Esta auto-expansión **une** paths al conjunto de ramas ya expandidas, sin
reemplazarlo nunca: una rama expandida manualmente por razones ajenas al item activo no se colapsa al navegar, y
una rama que el usuario había colapsado manualmente se reabre igualmente si pasa a contener al nuevo item activo.

## Modo rail

- El sidebar expone, dentro de sí mismo (antes de la lista de items), un control propio de colapsar/expandir toda
  la barra a modo rail: solo iconos, labels ocultos y disponibles como nombre accesible (`aria-label`/`title`).
- `shell.sidebar.defaultCollapsed` fija el estado inicial (`true` arranca en rail) al montar la sesión;
  `defaultCollapsed` ausente equivale a `false` (sidebar expandido).
- El estado de colapso es estado local del mismo componente que el de expansión de ramas, y por el mismo motivo
  (montaje estable por sesión) se conserva sin cambios al navegar entre páginas.
- Un `sidebarItem` sin `icon`, en modo rail, muestra como glifo la primera letra (mayúscula) de su `label` ya
  resuelto, conservando el `label` completo como nombre accesible. Este fallback solo aplica en rail (barra
  colapsada o dentro de su flyout); el sidebar expandido no muestra ningún sustituto cuando falta `icon`.

### Flyout de rama en rail

En modo rail, un `sidebarItem` con `children` muestra sus hijos como un desplegable flotante (flyout) al hacer
click/tap sobre su icono, reutilizando el mismo patrón de accesibilidad ya implementado para el desplegable de
`shell.header.menu` (ver [[header.md#desplegable-de-menuitemchildren]]):
- El trigger declara `aria-haspopup="menu"`/`aria-expanded`; el panel usa `role="menu"`, anclado con
  `position: absolute` a la derecha del trigger (el rail vive en el borde izquierdo del shell).
- Se cierra al hacer click fuera, al pulsar `Esc` (con retorno de foco al trigger), o al seleccionar un hijo
  navegable. Al abrirse, el foco se mueve al primer item visible del panel.
- Un hijo dentro del flyout que a su vez declara `children` (rama de profundidad 3+) **no** abre un segundo
  flyout anidado: se expande inline dentro del mismo panel, con el mismo mecanismo de expansión que usa el modo
  expandido. El panel flotante es siempre una única capa, sin importar la profundidad del árbol.

## Estado activo de navegación

Igual mecanismo que `shell.header` pero propagado a todos los ancestros de cualquier profundidad, no solo a un
nivel:
- Un `sidebarItem` (de cualquier profundidad) con `action.navigateTo.pageId` igual al `pageId` de la página
  visible se marca automáticamente como activo.
- Todos sus `sidebarItem` ancestro se marcan también como activos, sin ser ellos mismos navegables.
- `sidebarItem.action: goBack` y los items con `href` nunca participan en el resaltado automático.
- Si dos `sidebarItem` distintos (de cualquier profundidad) navegan al mismo `pageId`, ambos se marcan activos
  simultáneamente cuando esa página está visible, junto con sus respectivos ancestros.
- Es un valor derivado en cada render (no un estado persistido), igual criterio que `shell.header`.

## Ámbito por página

Cuando `shell.sidebar` está declarado, se aplica a **todas** las páginas de la app sin excepción; no existe opt-out
por página — misma política "todo o nada" ya fijada para `shell.header`.

## Fuera de alcance (v1)

- Comportamiento responsive/mobile (breakpoints, overlay a pantalla completa en móvil). El modo rail es una
  capacidad de escritorio para ganar espacio horizontal, no una solución mobile-first.
- Opt-out de `shell.sidebar` por página.
- Ancho configurable o theming del sidebar (expandido o en rail) más allá de las utilidades Tailwind ya usadas por
  el resto del runtime.
- Cualquier slot de nodos libres dentro de `shell.sidebar` (a diferencia de `shell.header.actions`): el sidebar
  solo admite el árbol de `sidebarItem`.
- Límite práctico de profundidad o anchura del árbol: no está acotado en v1; si aparece necesidad real, se
  revisará en una spec de ajuste posterior.
- Deshacer/rehacer o selección múltiple de `sidebarItem` en el editor visual (ver
  [`dev-mode-editor.md`](../development/dev-mode-editor.md) para los límites de esa superficie).

## Editor visual

La edición de `shell.sidebar` en modo desarrollo (toggle "Sidebar activo" en la sección "Shell" de la barra de
dominio, formulario recursivo de alta/edición/borrado/reordenación de `sidebarItem` a cualquier profundidad) está
documentada en
[`dev-mode-editor.md`](../development/dev-mode-editor.md#sección-shell-dominio-de-configuración).
