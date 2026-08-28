# Design: Feature 0123 - app-shell-sidebar

## Contexto

`spec.md` fija el contrato funcional de `shell.sidebar` (árbol de `sidebarItem` de profundidad arbitraria, modo
rail con flyouts, expansión inline en modo expandido, auto-expansión de ancestros, persistencia en memoria durante
la sesión) y deja explícitamente para este documento: la representación interna del árbol recursivo (tipo Zod,
módulo de validación) y, por extensión, el resto de decisiones técnicas que la spec no fija (arquitectura de render,
gestión de estado, reutilización de patrones ya existentes del header).

Puntos de partida relevantes del código y de `design.md` de `0122` (`shell.header`), ya cerrado e implementado:

- `shell.header.menu` **no** es un árbol recursivo real: son dos tipos Zod distintos (`menuItemSchema` para la
  raíz, `menuItemChildSchema` para `children`, que nunca vuelve a declarar `children`), decisión tomada
  precisamente para no acoplar el tipo de `header` a un futuro árbol recursivo de `sidebar` (`0122`, decisión 3).
  `sidebar` es esa feature futura y sí necesita recursión real, sin tope de profundidad (requisito 9 de esta spec).
- `AppShellHeader` se monta una única vez por sesión en `src/app/app-shell.tsx`, como hermano de `RuntimePage`
  dentro del mismo `RuntimeStateProvider`, fuera del ciclo de vida de `layout-renderer`/`pageEntry`. El estado
  "activo" del menú (`compute-active-menu-item-ids.ts`) se deriva en cada render comparando
  `menuItem.action.navigateTo.pageId` contra la página visible (`0122`, decisión 8); no hay dominio nuevo en
  `runtime-state/` para ello.
- El desplegable de `menuItem.children` (`MenuItemDropdown`) es un componente propio sin dependencia externa:
  estado local `open`, `position: absolute` anclado a un contenedor `relative`, `aria-haspopup="menu"`/
  `aria-expanded` en el trigger, `role="menu"`/`role="menuitem"` en el panel, cierre por click-fuera/Esc/selección,
  navegación por flechas con wraparound (`0122`, decisión 6). Es el patrón que esta spec pide reutilizar
  explícitamente para el flyout de modo rail.
- `src/config/validate-shell.ts` ya separa el shape (`shellSchema`, Zod) de las validaciones cruzadas que Zod no
  puede resolver (`pageId` contra `pages`, `operationName` contra `api`, referencias de `visibility` sin
  `item.*`), con mensajes propios `Shell configuration is invalid at "..."`. Las funciones de `visibility`
  (`validateShellVisibility`/`checkShellVisibilityReference`) ya son genéricas respecto a la profundidad del
  nodo que las invoca; solo el recorrido de `header.menu` está escrito como dos bucles fijos (raíz + un nivel de
  `children`), impropio para un árbol sin tope.
- El editor visual (`ShellConfigPanel`, sección "Shell" de la barra de dominio) ya tiene un patrón de lista
  editable con reordenación por `@dnd-kit/core` para `shell.header.menu`, pero está escrito como **dos componentes
  fijos**: `ShellMenuListEditor` (raíz) y `ShellMenuChildrenListEditor` (un nivel, con `allowChildren={false}`
  forzado en cada fila). No es un componente recursivo y no se puede extender a profundidad arbitraria sin
  reescritura.
- Dependencias actuales sin cambios desde `0122`: `@dnd-kit/core`, `lucide-react`, `zod`, `@monaco-editor/react`;
  ninguna librería de posicionamiento de popovers.
- Decisión de usuario ya cerrada para esta feature (ver pregunta de aclaración): en modo rail, un `sidebarItem`
  dentro de un flyout ya abierto cuyos propios hijos (rama de profundidad 3+) se expanden **inline dentro del
  mismo panel flotante**, reutilizando el mismo patrón de expansión in-place que en modo expandido. Nunca se abre
  una segunda capa flotante, sin importar la profundidad del árbol.

## Objetivos / No objetivos

### Objetivos
- Fijar la representación Zod recursiva de `sidebarItem` y el módulo de validación cruzada correspondiente,
  reutilizando sin duplicar la lógica ya genérica de acción/visibilidad.
- Fijar dónde y cómo se renderiza el sidebar dentro de la composición existente de `src/app/app-shell.tsx`, junto a
  `AppShellHeader`, sin alterar el ciclo de vida de `layout-renderer` ni de `pageEntry`.
- Fijar dónde vive el estado de colapso (rail) y de expansión de ramas, y cómo se reconcilia con la
  auto-expansión de ancestros al navegar.
- Fijar el enfoque técnico del flyout de modo rail (incluida su resolución para ramas de profundidad 3+, ya
  cerrada arriba) y cuánto reutiliza literalmente de `MenuItemDropdown`.
- Fijar cómo se deriva el estado "activo" del árbol sin tope de profundidad, análogo a `0122` pero generalizado.
- Fijar el enfoque del editor visual para alta/edición/borrado/reordenación de `sidebarItem` a profundidad
  arbitraria, y cómo se integra en `ShellConfigPanel` junto al toggle ya existente de header.
- Cerrar un fallback razonable para `sidebarItem` sin `icon` en modo rail (riesgo señalado en spec).

### No objetivos
- No define comportamiento responsive/mobile del sidebar (fuera de alcance de spec).
- No define theming ni anchos configurables por JSON; solo fija los valores Tailwind concretos que usará esta
  implementación.
- No resuelve el gap ya identificado del canvas de `link.children` en Layout (ajeno a esta feature).
- No trocea el trabajo en tareas (corresponde a `generate-implementation-plan`).

## Decisiones

### 1. `sidebarItem` como tipo Zod genuinamente recursivo (`z.lazy`), a diferencia de `menuItem`/`menuItemChild`
```
const sidebarItemBaseFieldsSchema = z.object({
  label: /* mismo contrato de texto dinámico que menuItem.label */,
  icon: /* mismo catálogo lucide, opcional */,
  visibility: /* mismo contrato ya usado por menuItem.visibility, sin item.* */,
  href: /* mismo contrato que link.props.href / menuItem.href */,
  action: /* mismo discriminated union navigateToButtonActionSchema | goBackButtonActionSchema */,
})

export const sidebarItemSchema: z.ZodType<SidebarItemConfig> = z.lazy(() =>
  sidebarItemBaseFieldsSchema
    .extend({ children: z.array(sidebarItemSchema).nonempty().optional() })
    .superRefine(refineSidebarItemShape), // exactamente uno de href/action/children, igual regla que menuItem
)
```
A diferencia de `menuItem` (dos tipos fijos, decisión deliberada de `0122` para no acoplar `header` a la
recursión de `sidebar`), aquí no hay "tipo raíz" y "tipo hijo" separados: cualquier nodo del árbol admite los
mismos campos, incluidos sus propios `children`, sin tope. No hace falta el `.extend()` de mitigación que sí
necesitaba `menuItem`/`menuItemChild` (duplicación entre dos tipos): aquí solo existe un tipo.

**Alternativa descartada**: replicar el patrón de `header` con N tipos Zod fijos (uno por nivel máximo soportado).
Se descarta directamente porque la spec fija profundidad sin límite (requisito 9); un tope fijo, por alto que
fuera, contradiría el contrato funcional ya cerrado.

**Riesgo residual**: ninguno relevante a nivel de tipos; Zod soporta recursión con `z.lazy` de forma estándar. El
riesgo real de árboles muy profundos/anchos (rendimiento, usabilidad) ya está anotado como riesgo no bloqueante en
`spec.md` y se hereda aquí sin resolverlo.

### 2. Validación cruzada recursiva en `validate-shell.ts`, reutilizando la lógica de visibilidad ya genérica
Se añade a `validate-shell.ts` un recorrido recursivo (`validateSidebarItemCrossRefs(item, path, pageIds,
operationNames)`) que se llama a sí mismo por cada `children[i]` con el `path` extendido
(`shell.sidebar.items[i].children[j]...`), en vez de los dos bucles fijos que ya existen para
`header.menu`/`menu[].children`. Reutiliza literalmente `validateShellVisibility`/`checkShellVisibilityReference`
sin modificarlos: ya son agnósticas a la profundidad del nodo que las invoca (reciben condición + path +
`operationNames`), por lo que sirven igual para un árbol sin tope.

**Alternativa descartada**: generalizar el propio bucle de `header.menu` para que acepte una profundidad
parametrizable y reutilizarlo también para `sidebar`. Se descarta porque el bucle de `header` está escrito
asumiendo exactamente dos niveles con tipos distintos (`MenuItemConfig`/`MenuItemChildConfig`); forzarlo a
generalizarse complicaría el caso ya estable de `header` para ganar una reutilización que en la práctica se reduce
a "es un `for` que se llama a sí mismo", sin beneficio real sobre escribir el recorrido recursivo directamente
para `sidebar`.

### 3. Render del sidebar como nuevo componente `AppShellSidebar`, hermano de `AppShellHeader`
Nuevo componente (p. ej. `AppShellSidebar`, en `src/runtime/runtime-shell/`) montado en `src/app/app-shell.tsx`
junto a `AppShellHeader`, dentro del mismo `RuntimeStateProvider`, con el mismo ciclo de vida "una vez por sesión,
nunca por `pageEntry`". Reutiliza sin reimplementar los mismos mecanismos que ya usa `AppShellHeader`:
`runtime-references` para `label`/`icon`, `runtime-actions` (`executeRuntimeUiAction`) para `navigateTo`/`goBack`,
`matchesVisibilityRule` para `visibility`, y el mismo componente `MenuItemLeaf`-equivalente para renderizar hojas
(nuevo, ya que `sidebarItem` no comparte tipo Zod con `menuItem`/`menuItemChild`, pero sí la misma forma de
"leaf": label + icon + href/action).

Composición en `app-shell.tsx`: hoy el frame es una columna simple (`AppShellHeader` seguido de `RuntimePage`).
Se introduce un nuevo contenedor flex-row debajo del header (`getAppShellBodyClassName()` o similar, nuevo helper
en `runtime-node-styling`), con `AppShellSidebar` como columna de ancho fijo (`flex-shrink-0`) y `RuntimePage`
como `flex-1 min-w-0` a su derecha. Cuando no hay `header`, el sidebar ocupa la altura completa del viewport
(requisito 12) porque simplemente no hay elemento por encima suyo en la columna raíz. Este contenedor solo se
introduce cuando `shell.sidebar` está declarado y no vacío; sin él, la estructura actual (columna simple) se
mantiene byte a byte para no alterar el layout de apps sin sidebar.

**Alternativa descartada**: renderizar el sidebar como parte de `AppShellHeader` (un único componente
`AppShellChrome`). Se descarta porque header y sidebar son secciones independientes de `shell` (aditivas entre
sí, ninguna depende de la otra) y ya se validan/configuran por separado; fusionarlos en un componente obligaría a
ese componente a conocer ambos contratos aunque solo uno de los dos esté declarado, sin ganar nada a cambio.

### 4. Estado de colapso (rail) y de expansión de ramas como estado local de React, no un nuevo dominio en `runtime-state/`
`AppShellSidebar` mantiene dos piezas de estado local (`useState`): `collapsed: boolean` (inicializado desde
`sidebar.defaultCollapsed ?? false`) y `expandedPaths: Set<string>` (paths de nodos con `children` actualmente
expandidos, en modo expandido o dentro de un flyout de rail). Como el componente se monta una única vez por
sesión y nunca se desmonta al navegar entre páginas (mismo punto de montaje estable que `AppShellHeader`, fuera
del ciclo de `pageEntry`), este estado local ya sobrevive a la navegación sin necesitar persistencia explícita ni
un dominio nuevo en el store compartido — satisface directamente el requisito 18 ("se conservan en memoria
durante toda la sesión... no se reinician al navegar").

**Alternativa descartada**: añadir un dominio `shell` a `runtime-state/` para guardar `collapsed`/`expandedPaths`.
Se descarta porque sería el primer dominio del store dedicado a estado de interacción de chrome puramente visual
(no a datos de negocio ni a navegación/formularios/queries, que es lo que hoy modela `runtime-state/`), y porque
es innecesario: el punto de montaje del sidebar ya es estable durante toda la sesión, así que no hay pérdida de
estado que un dominio de store estuviera resolviendo. Riesgo residual: si en el futuro el sidebar necesitara
sobrevivir a un remount del propio `AppShellSidebar` (hoy no ocurre en ningún flujo), habría que revisar esta
decisión.

### 5. Auto-expansión de ancestros como efecto que **une** paths al set existente, nunca lo reemplaza
Un `useEffect` con dependencia en el `pageId` de la página activa recalcula, en cada navegación, los paths
ancestro del `sidebarItem` activo (vía la misma función recursiva de la decisión 6) y los añade (unión) a
`expandedPaths` con `setExpandedPaths(prev => new Set([...prev, ...activeAncestorPaths]))`. Nunca se recalcula
`expandedPaths` desde cero ni se eliminan paths ya presentes por otras razones (expansión manual del usuario).
Esto satisface directamente el caso límite de spec: una rama expandida manualmente que ya no está en el camino
activo no se colapsa al navegar, y una rama colapsada manualmente que sí contiene al nuevo item activo se
reabre igualmente.

**Riesgo residual**: `expandedPaths` crece de forma monótona durante la sesión (nunca se colapsan ramas
automáticamente); es el comportamiento que pide la spec (persistencia de expansión manual), pero implica que en
sesiones muy largas con mucha navegación por árboles anchos, el conjunto de ramas expandidas por defecto puede
crecer. Aceptable: coincide con el comportamiento ya fijado explícitamente por los requisitos 15/18 y por los
casos límite de la spec; no es una regresión introducida por esta decisión.

### 6. Estado "activo" derivado recursivamente en cada render, sin tope de profundidad
Nueva función `computeActiveSidebarItemIds(items, activePageId)` análoga a `compute-active-menu-item-ids.ts` de
`0122` pero recursiva: recorre el árbol completo, compara `action.navigateTo.pageId` de cada hoja contra la
página activa, y devuelve el conjunto de *paths* (codificados como `"0.children.2.children.1"` o equivalente)
tanto del item activo como de **todos** sus ancestros de cualquier profundidad (a diferencia de `0122`, que solo
propagaba a un padre porque el header no admite más de un nivel). Se recalcula en cada render igual que en
`0122` (decisión 8): no se persiste, es un valor derivado puro a partir de `shell.sidebar.items` + página activa.

### 7. Flyout de modo rail como componente propio, con expansión inline recursiva dentro del propio panel
Nuevo componente (p. ej. `SidebarRailFlyout`) que reutiliza el mismo patrón de accesibilidad ya establecido por
`MenuItemDropdown` (`0122`, decisión 6): estado local `open` por trigger, `position: absolute` anclado a un
contenedor `relative`, `aria-haspopup="menu"`/`aria-expanded` en el trigger, `role="menu"` en el panel, cierre por
click-fuera/Esc (con retorno de foco al trigger)/selección de un hijo navegable, flechas con wraparound,
`Home`/`End`. No reutiliza literalmente `MenuItemDropdown` como componente (ese componente asume la forma fija
de `menuItem`/`menuItemChild` de header, sin recursión), pero sí su mismo patrón de interacción, reimplementado
sobre `sidebarItem`.

Decisión ya cerrada con el usuario para la profundidad dentro del flyout: un `sidebarItem` hijo dentro del panel
flotante que a su vez tiene `children` **no** abre un segundo flyout anidado; en su lugar, se expande inline
dentro del mismo panel (mismo mecanismo de `expandedPaths`/toggle que ya usa el modo expandido), dejando el panel
flotante como una única capa siempre, sin importar la profundidad del árbol.

**Alternativa descartada**: flyouts anidados en cascada (cada nivel adicional abre un nuevo panel flotante
anclado a su propio trigger, como menús contextuales de escritorio). Descartada explícitamente por el usuario:
exigiría gestionar N capas simultáneas de foco/click-outside/Esc y un posicionamiento más complejo sin librería
externa (`@floating-ui`/`radix` siguen fuera de alcance, igual que en `0122`), para un beneficio visual menor
frente a la expansión inline dentro de un único panel.

**Riesgo residual**: un panel de flyout con una rama muy profunda expandida inline puede crecer verticalmente
más de lo que cabe en el viewport sin overflow explícito; se resuelve con `overflow-y-auto` en el panel del
flyout (mismo criterio de riesgo ya aceptado en spec para árboles muy profundos/anchos, no acotado en v1).

### 8. Fallback visual para `sidebarItem` sin `icon` en modo rail: inicial del label
Cuando un `sidebarItem` sin `icon` se renderiza en modo rail (barra colapsada o dentro de un flyout), se muestra
la primera letra (mayúscula) del `label` ya resuelto como glifo visual en el lugar del icono, manteniendo el
`label` completo como nombre accesible (`aria-label`/tooltip) igual que cualquier otro item en rail. Reutiliza el
mismo mecanismo de `resolveRuntimeTextReference` ya usado para `label`; no introduce una nueva fuente de datos.

**Alternativa descartada**: reutilizar un icono genérico fijo (p. ej. un placeholder tipo "circle") para todo
`sidebarItem` sin `icon`. Se descarta porque distingue peor visualmente entre distintos items sin icono que la
inicial del label, con el mismo coste de implementación.

### 9. Ancho del sidebar: valores Tailwind fijos, sin nuevo token global
Ancho expandido `w-64` (16rem, consistente con anchos de panel ya usados en el editor visual) y ancho en modo
rail `w-16` (4rem, suficiente para un icono de `size-4`/`size-5` centrado con padding). Son clases Tailwind
locales al nuevo componente, no tokens `@theme` nuevos, coherente con que el proyecto no introduce theming
declarativo (`conventions.md`).

**Riesgo residual**: ninguno; son valores puramente visuales, ajustables sin impacto de contrato si una revisión
visual futura los cambia.

### 10. Editor visual: nuevo componente de lista recursivo, no una extensión de los editores de dos niveles de header
Los editores existentes de `shell.header.menu` (`ShellMenuListEditor` para la raíz, `ShellMenuChildrenListEditor`
para un nivel, con `allowChildren={false}` forzado en cada fila) están escritos para exactamente dos niveles
fijos y no generalizan a profundidad arbitraria. Para `sidebar` se introduce un componente propio y
genuinamente recursivo (p. ej. `SidebarItemListEditor`, que se renderiza a sí mismo para los `children` de
cualquier item expandido dentro del formulario), con un `SortableContext` de `@dnd-kit/core` por cada nivel
actualmente abierto en el formulario — generalización real de lo que `0122` (decisión 7) ya dejó anotado como
"uno por cada padre con `children` abierto en el formulario", pero limitado en la práctica a un único nivel
anidado porque `menuItem` no admite más profundidad. Se integra en `ShellConfigPanel` como nueva subsección junto
al toggle "Sidebar activo", reutilizando los mismos widgets genéricos ya usados por el header
(`DiscriminatedUnionPropertyField` para `href`/`action`, editor de `visibility` ya existente en el panel de
propiedades) y el mismo pipeline de commit (`onCommitShellMutation` parcheando la clave `shell`).

**Alternativa descartada**: generalizar `ShellMenuListEditor`/`ShellMenuChildrenListEditor` para que acepten una
profundidad arbitraria mediante un flag o parámetro de nivel. Se descarta porque esos componentes ya están
acoplados al tipo `MenuItemConfig`/`MenuItemChildConfig` (dos tipos Zod distintos, decisión 1); forzarlos a
soportar también `SidebarItemConfig` (un único tipo recursivo) mezclaría dos contratos de datos distintos en un
mismo componente genérico, con más complejidad condicional que construir un componente recursivo dedicado a
`sidebarItem`.

**Riesgo anotado, no bloqueante**: un `SortableContext` por nivel abierto es un patrón ya usado (parcialmente)
por `0122`, pero aquí se generaliza a N niveles reales en vez de 2 fijos. Riesgo medio de fricción de integración
con `@dnd-kit/core` a mayor profundidad (por ejemplo, anidar contextos varias veces); queda para validar
temprano en la tarea de implementación correspondiente, no bloquea la planificación.

## Riesgos y trade-offs

- **`expandedPaths` de crecimiento monótono** (decisión 5): riesgo bajo, es el comportamiento que la spec pide
  explícitamente; anotado por completitud, no requiere mitigación adicional.
- **Estado de sidebar como estado local, no en `runtime-state/`** (decisión 4): riesgo bajo hoy porque el punto de
  montaje es estable; si una feature futura obligara a remontar el shell dentro de una sesión, esta decisión
  debería revisarse.
- **Flyout de rail sin librería de posicionamiento** (decisión 7, heredado de `0122` decisión 6): mismo riesgo
  medio de bugs de accesibilidad (foco, click-outside, Esc) que ya asumió `0122`; mitigación igual: exigir tests
  explícitos de teclado y `aria-expanded` en la tarea de implementación correspondiente.
- **`SortableContext` recursivo en el editor** (decisión 10): riesgo medio de fricción con `@dnd-kit/core` a
  mayor profundidad que la ya probada por `0122` (un solo nivel anidado); no bloqueante para planificar, pero debe
  validarse temprano en la tarea de implementación de esa subsección.
- **Rendimiento/usabilidad de árboles muy profundos o anchos**: riesgo ya señalado como no acotado en `spec.md`;
  se hereda aquí sin resolverlo. Si aparece necesidad real de un límite práctico, se revisará en una spec de
  ajuste posterior, no en esta feature.
- **Mensajes de error de `shell.sidebar`**: seguirán el mismo prefijo propio `Shell configuration is invalid at
  "..."` ya usado por `header` (decisión 4 de `0122`, heredada aquí sin reabrirla); no se generaliza el formato de
  `pages[].layout`, mismo trade-off ya aceptado.

## Migración o despliegue

No aplica. `shell.sidebar` es un campo opcional aditivo dentro de `shell`, ya validado como hermano de `header`.
Su ausencia reproduce exactamente el comportamiento actual del runtime (con o sin `shell.header`); no hay datos ni
configuración existente que migrar.

## Preguntas abiertas

Ninguna bloqueante para planificar. La única decisión técnica genuinamente abierta al cerrar `spec.md` (el
comportamiento del flyout de modo rail ante ramas de profundidad 3+) ya quedó resuelta con el usuario y recogida
en la decisión 7: expansión inline dentro del propio panel, sin flyouts anidados. Las incertidumbres restantes
(ancho fijo vs. configurable, rendimiento de árboles muy profundos/anchos) ya están recogidas como riesgos
residuales no bloqueantes en `spec.md` y en la sección "Riesgos y trade-offs" de este documento; no introducen
ninguna decisión técnica pendiente para `generate-implementation-plan`.
