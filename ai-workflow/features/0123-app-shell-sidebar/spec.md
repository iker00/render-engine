# Spec: `shell.sidebar` — menú lateral de navegación jerárquica

## Objetivo

Permitir declarar una navegación lateral persistente (`shell.sidebar`) como segunda sección del shell de aplicación
ya existente (junto a `shell.header`, feature `0122`), con un árbol de navegación de profundidad arbitraria y un
modo compacto ("rail", solo iconos) para apps de gestión con muchas secciones de navegación.

Esta spec construye sobre `shell` tal como quedó cerrado en `0122`: un objeto contenedor de secciones de chrome
compartido y persistente entre páginas. `sidebar` se añade como hermano aditivo de `header`, sin reestructurarlo.

## Alcance

- Nuevo campo opcional `sidebar` dentro del bloque raíz `shell` ya existente: `shell?: { header?: {...}, sidebar?:
  {...} }`.
- Ausencia de `shell.sidebar` (con o sin `shell.header` declarado): el runtime se comporta exactamente igual que
  hoy, sin ningún cambio.
- `shell.sidebar`, objeto opcional con:
  - `items`: array opcional de `sidebarItem` (árbol de navegación).
  - `defaultCollapsed`: boolean opcional, default `false` — estado inicial (expandido/rail) del sidebar al montar
    la sesión.
- `sidebarItem = { label, icon?, href? | action?, visibility?, children? }`:
  - Misma base de campos que `menuItem` del header (`label` obligatorio, `icon` opcional, `href`/`action`
    mutuamente excluyentes con el mismo contrato de `link`, `visibility` opcional sin `item.*`).
  - `children` opcional: array de `sidebarItem`, **recursivo y sin límite de profundidad** (a diferencia de
    `menuItem`, capado a un nivel por ser un dropdown horizontal; el sidebar es un árbol vertical indentado sin esa
    restricción de UX).
  - Es un tipo propio, no una reutilización literal de `menuItem`/`menuItemChild` del header — decisión ya
    anticipada en el `design.md` de `0122`: ambos comparten solo los campos base de "leaf item", no la estructura
    de árbol.
  - Un `sidebarItem` con `children` es disparador de expansión de rama y es mutuamente excluyente con `href`/
    `action`, igual regla que en el header.
- Composición cuando coexisten `header` y `sidebar`: el header ocupa el ancho completo en la parte superior (sin
  cambios respecto a `0122`); el sidebar arranca debajo y ocupa la altura restante del viewport, anclado a la
  izquierda. Con `sidebar` sin `header`, el sidebar ocupa toda la altura del viewport desde arriba.
- El sidebar se monta una única vez por sesión de runtime y persiste entre navegaciones de página, igual que
  `shell.header` (no se remonta por `pageEntry`).
- Expansión de rama: inline, empujando el resto del contenido del sidebar hacia abajo. Varias ramas pueden estar
  expandidas simultáneamente, en cualquier combinación (sin exclusión tipo `groupId`).
- Auto-expansión: cuando la página activa coincide con el `sidebarItem` activo y este está anidado, todas sus ramas
  ancestro se expanden automáticamente para mantenerlo visible.
- Modo rail: control propio dentro del sidebar (no en el header) que colapsa toda la barra a una franja estrecha
  con solo iconos (labels ocultos, con tooltip accesible). En modo rail, un `sidebarItem` con `children` muestra sus
  hijos como un desplegable flotante (flyout) al hacer click/tap sobre su icono, reutilizando el mismo patrón de
  apertura/cierre/accesibilidad ya implementado para el dropdown de `shell.header.menu`.
- El estado de colapso (rail) y el estado de expansión de cada rama se conservan en memoria durante toda la sesión
  del runtime; no se reinician al navegar entre páginas.
- Estado activo automático: igual mecanismo que `shell.header` (comparación de `action.navigateTo.pageId` contra la
  página visible), pero propagado a **todos** los ancestros de cualquier profundidad, no solo a un nivel.
- `shell.sidebar`, cuando está declarado, se aplica a todas las páginas de la app sin excepción — misma política
  "todo o nada" ya fijada para `shell.header`.
- Editor visual: extiende la sección "Shell" ya existente del editor (mismo `ShellConfigPanel`) con un nuevo toggle
  "Sidebar activo", junto al toggle "Header activo" ya existente. El formulario permite alta, edición y borrado de
  `sidebarItem` a cualquier profundidad, expandiendo/colapsando la rama correspondiente dentro del propio formulario
  para editar sus hijos anidados. La reordenación por arrastre está limitada al mismo nivel/mismo padre, igual
  patrón que ya usa `shell.header.menu`.

## Fuera de alcance

- Cambios al contrato o comportamiento de `shell.header` cerrado en `0122`, salvo la composición conjunta ya
  descrita (posición relativa cuando ambos existen).
- Comportamiento responsive/mobile real (breakpoints, overlay a pantalla completa en móvil). El modo rail es una
  capacidad de escritorio para ganar espacio horizontal, no una solución mobile-first.
- Opt-out de `shell.sidebar` por página.
- El gap ya identificado y ajeno a esta feature del editor drag-and-drop de `link.children` en el canvas de Layout.
- Decisión de representación interna del árbol recursivo (tipo Zod exacto, módulo de validación). Se resuelve en
  `generate-feature-design`.
- Cualquier slot de nodos libres dentro de `shell.sidebar` (a diferencia de `shell.header.actions`): en esta spec el
  sidebar solo admite el árbol de `sidebarItem`, sin un equivalente a `actions`.
- Ancho configurable o personalización visual del sidebar (expandido o en rail) más allá de las utilidades Tailwind
  ya usadas por el resto del runtime; theming declarativo sigue fuera de v1.
- Deshacer/rehacer o selección múltiple de `sidebarItem` en el editor visual (mismos límites ya documentados para el
  resto del editor).

## Requisitos funcionales

1. `shell.sidebar` es un objeto opcional, hermano de `shell.header` dentro del bloque raíz `shell`.
2. Si `shell.sidebar` no se declara, el comportamiento del runtime es idéntico al actual (con o sin `shell.header`).
3. `shell.sidebar.items` es un array opcional de `sidebarItem`. Ausente o `[]`: no se renderiza ningún sidebar.
4. `shell.sidebar.defaultCollapsed` es un boolean opcional, default `false`, que fija el estado inicial (expandido o
   rail) del sidebar al montar la sesión de runtime.
5. Cada `sidebarItem` declara `label` (obligatorio), `icon` (opcional), `visibility` (opcional), y exactamente uno
   de estos dos casos: (a) exactamente uno de `href`/`action`, item navegable de hoja; o (b) `children` (no vacío),
   disparador de una rama.
6. `sidebarItem.action` solo admite `navigateTo` o `goBack`, mismo contrato de validación que `link.props.action`
   (incluida la comprobación de `pageId` existente en `pages`).
7. `sidebarItem.href` admite el mismo contrato que `link.props.href`.
8. `sidebarItem.visibility` sigue el contrato transversal estándar de `visibility`, sin soporte de `item.*`.
9. `sidebarItem.children` es un array de `sidebarItem`, sin límite de profundidad: cada item dentro de `children`
   puede a su vez declarar sus propios `children`.
10. Un `sidebarItem` con `children` no puede declarar `href` ni `action`.
11. Cuando coexisten `shell.header` y `shell.sidebar`: el header ocupa el ancho completo en la parte superior; el
    sidebar se renderiza debajo, ocupando la altura restante del viewport, anclado a la izquierda.
12. Cuando existe `shell.sidebar` sin `shell.header`: el sidebar ocupa toda la altura del viewport desde arriba.
13. El sidebar se monta una única vez por sesión de runtime y persiste visualmente entre navegaciones de página.
14. Expandir un `sidebarItem` con `children` muestra sus hijos inline, debajo del item, empujando el resto del
    contenido del sidebar. Varias ramas pueden estar expandidas simultáneamente sin restricción.
15. Cuando la página activa coincide con el `pageId` de un `sidebarItem` anidado, todas las ramas ancestro de ese
    item se expanden automáticamente si no lo estaban, de forma que el item activo quede visible.
16. El sidebar expone, dentro de sí mismo, un control para colapsar/expandir toda la barra a modo rail (solo
    iconos, labels ocultos con tooltip accesible).
17. En modo rail, un `sidebarItem` con `children` muestra sus hijos como un desplegable flotante (flyout) al hacer
    click/tap sobre su icono, con el mismo patrón de apertura/cierre/accesibilidad ya implementado para el
    desplegable de `shell.header.menu`.
18. El estado de colapso (rail) y el estado de expansión de cada rama se conservan en memoria durante toda la
    sesión del runtime; no se reinician al navegar entre páginas.
19. Un `sidebarItem` (de cualquier profundidad) con `action.navigateTo.pageId` igual al de la página actualmente
    visible se marca automáticamente como activo.
20. Todos los `sidebarItem` ancestro de un item activo se marcan también como activos, sin ser ellos mismos
    navegables.
21. `shell.sidebar`, cuando está declarado, se aplica a todas las páginas de la app sin excepción.
22. El editor visual añade un toggle "Sidebar activo" en la sección "Shell" ya existente, junto a "Header activo".
23. El formulario de Shell permite alta, edición y borrado de `sidebarItem` a cualquier profundidad, con
    expandir/colapsar la rama correspondiente dentro del propio formulario para editar sus hijos.
24. La reordenación por arrastre de `sidebarItem` en el formulario de Shell está limitada al mismo nivel/mismo
    padre, igual que ya ocurre con `shell.header.menu`.

## Requisitos no funcionales

- Retrocompatibilidad total: cualquier configuración existente sin `shell.sidebar` (con o sin `shell.header`) se
  comporta exactamente igual que hoy.
- Reutilizar los contratos de validación ya existentes (`link.props.action`, `link.props.href`, `visibility`) para
  los campos base de `sidebarItem`, con el mismo criterio ya aplicado a `menuItem`.
- El modo rail y la expansión de ramas deben ser operables por teclado y anunciar su estado (`aria-expanded` en
  cada trigger de rama, indicación accesible del item activo), consistente con los patrones de accesibilidad ya
  usados por `accordion`, `tabs` y el desplegable de `shell.header`.
- La nueva funcionalidad de sidebar en el editor no debe alterar el comportamiento de la sección Layout ni de la
  edición ya existente de `shell.header`.

## Criterios de aceptación

- Dado un config con `shell.header` pero sin `shell.sidebar`, el runtime renderiza exactamente igual que en la
  feature `0122`, sin sidebar.
- Dado `shell.sidebar.items` con al menos un item, se renderiza el sidebar anclado a la izquierda del viewport.
- Dado `shell.header` y `shell.sidebar` declarados a la vez, el header ocupa el ancho completo arriba y el sidebar
  arranca debajo, ocupando la altura restante.
- Dado solo `shell.sidebar` (sin `shell.header`), el sidebar ocupa toda la altura del viewport.
- Dado un `sidebarItem` con `href` y `action` simultáneos, el config se rechaza en validación previa con
  diagnóstico de ruta exacta.
- Dado un `sidebarItem` con `children` y además `href`/`action` declarados, el config se rechaza.
- Dado un `sidebarItem` sin `href`, `action` ni `children`, el config se rechaza.
- Dado un `sidebarItem.children: []` (vacío explícito), el config se rechaza.
- Dado un árbol de `sidebarItem` con cuatro niveles de profundidad, el config es válido y cada nivel se renderiza
  correctamente al expandir sus ramas.
- Dado un click sobre un `sidebarItem` con `children` estando el sidebar expandido, sus hijos se muestran inline
  sin colapsar ninguna otra rama ya abierta.
- Dado el control de modo rail, activarlo colapsa el sidebar a iconos con tooltip accesible; los labels dejan de
  mostrarse como texto.
- Dado un `sidebarItem` con `children` en modo rail, hacer click sobre su icono abre un flyout mostrando sus hijos.
- Dado un `sidebarItem` anidado en tercer nivel cuyo `pageId` coincide con la página visible, tanto el item como
  sus dos ancestros se marcan como activos y sus ramas aparecen expandidas automáticamente.
- Dado el sidebar colapsado a rail, navegar a otra página mantiene el sidebar colapsado tras la navegación.
- Dado una rama expandida manualmente, navegar a otra página no relacionada mantiene la rama expandida tras la
  navegación.
- En el editor visual, activar el toggle "Sidebar activo" en la sección Shell crea `shell.sidebar: { items: [] }`
  sin afectar la configuración de `shell.header` ya existente.

## Casos límite

- `shell.sidebar` declarado pero `items` ausente o `[]`: no se renderiza ningún sidebar, equivalente a no declarar
  `shell.sidebar`.
- `shell.sidebar.defaultCollapsed: true`: el sidebar arranca en modo rail al montar la sesión.
- Un `sidebarItem` con `children` cuyos hijos quedan todos ocultos por `visibility`: sigue siendo un disparador de
  rama válido (misma regla ya definida para `menuItem` del header); la rama se expandiría vacía.
- Dos `sidebarItem` en ramas distintas navegan al mismo `pageId`: ambos se marcan activos simultáneamente cuando
  esa página está visible, junto con sus respectivos ancestros.
- Un `sidebarItem` activo está dentro de una rama que el usuario había colapsado manualmente antes de navegar: la
  auto-expansión de ancestros (requisito 15) la vuelve a abrir igualmente.
- Modo rail con un `sidebarItem` de hoja cuyo `label` es muy largo: solo se muestra el icono; el `label` completo
  queda disponible como tooltip/nombre accesible.
- Un `sidebarItem` sin `icon` declarado, en modo rail: comportamiento visual no especificado en esta spec (ver
  riesgos).

## Riesgos o preguntas abiertas

- Representación visual de un `sidebarItem` sin `icon` cuando el sidebar está en modo rail: no resuelto en esta
  spec; queda para `design.md` o para una decisión de fallback razonable durante implementación (por ejemplo,
  iniciales del `label`).
- Ancho fijo o configurable del sidebar en modo expandido y en modo rail: no se fija en esta spec; queda como
  decisión de diseño visual acotada a utilidades Tailwind ya usadas por el resto del runtime, sin abrir theming.
- Representación interna del árbol recursivo (tipo Zod exacto, módulo de validación — posible extensión de
  `src/config/validate-shell.ts` o módulo propio) se decide en `generate-feature-design`. Esta feature dispara
  `requires_design: true` por reutilizar patrones existentes (dropdown de header, `accordion`) en una combinación
  nueva (árbol recursivo + rail + flyouts anidados) con más de una estrategia técnica razonable.
- Rendimiento o usabilidad de árboles muy profundos o muy anchos no está acotado en esta spec (sin límite de
  profundidad declarado); si se detecta necesidad real de un límite práctico, se revisará en `design.md` o en una
  spec de ajuste posterior.
