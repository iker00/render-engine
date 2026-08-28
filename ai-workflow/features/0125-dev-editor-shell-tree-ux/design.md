# Design: Feature 0125 — dev-editor-shell-tree-ux

## Contexto

- La sección "Shell" del editor visual (`ShellConfigPanel` y sus editores hijos, ver
  [[../../docs/app-features/development/dev-mode-editor.md#sección-shell-dominio-de-configuración]]) hoy renderiza
  `shell.header` y `shell.sidebar` como un único scroll continuo (`shell-config-panel.tsx`), y solo permite
  reordenar por arrastre dentro del mismo nivel: cada lista (raíz de `menu`, `children` de un `menuItem`, y cada
  nivel de la lista recursiva de `sidebarItem`) monta su **propio** `DndContext` de `@dnd-kit/core`
  (`shell-config-panel-dnd.tsx`, componentes `ShellDndSortableList`/`ShellDndSortableRow`). Esto hace que "no se
  pueda arrastrar entre niveles" sea hoy una garantía estructural (un drag iniciado en un `DndContext` nunca puede
  resolverse contra una zona `droppable` de otro `DndContext`), pero es precisamente la garantía que esta feature
  tiene que romper de forma controlada para permitir reanidar/mover entre niveles.
- El precedente arquitectónico más cercano para "geometría de zonas de drop" es la feature `0106`
  (`ai-workflow/features/0106-dev-editor-grid-canvas-drop-zones/design.md`), que resolvió zonas de inserción
  intermedias para el canvas de `Layout` en modo grid mediante una capa overlay medida con `getBoundingClientRect`.
  Ese enfoque de medición existe porque los hijos de un grid **no pueden** desplazarse de su celda CSS. Las listas
  de `menuItem`/`sidebarItem` son listas apiladas verticalmente (flex/columna), no un grid: el precedente relevante
  aquí no es la variante "overlay medido" de `0106`, sino la variante **anterior** y más simple que `0106` mismo
  documenta como ya vigente para contenedores no-grid: franjas de gap de ancho completo en el flujo normal del
  documento (`LayoutCanvasDropZoneGap` en `src/runtime/layout-renderer.tsx`), sin medición ni overlay.
- `LayoutCanvasDndContext` (`src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx`) ya modela, para el árbol
  de `Layout`, el patrón que esta feature necesita replicar para los árboles de Shell: **un único `DndContext`
  compartido para todo el árbol**, identidad de destino estructurada (`{parentPath, index}`, más aquí un caso de
  "anidar en el cuerpo de un nodo" que Layout no necesita porque ya tiene contenedores explícitos), validez
  calculada en `onDragOver` y aplicada imperativamente vía `[data-drop-zone]` con clases Tailwind de outline
  verde/rojo, y un `onDragEnd` que traduce el id de destino en una mutación pura sobre el árbol de datos.
- `menuItem`/`menuItemChild` (ver [[../../docs/app-features/shell/header.md#contrato-de-menuitem]]) y
  `sidebarItem` (ver [[../../docs/app-features/shell/sidebar.md#contrato-de-sidebaritem]]) comparten la misma forma
  estructural relevante para el árbol (`children?: T[]`, no vacío cuando existe), difieren solo en: (a) el header
  tiene un tope duro de profundidad 1 (un `menuItemChild` nunca declara `children`), el sidebar no tiene tope; (b)
  ambos exigen exactamente uno de `href`/`action`/`children` (validación `refineMenuItemShape`/
  `refineSidebarItemShape`, fuera de alcance de esta feature). Esta simetría es lo que permite compartir una única
  pieza de lógica de árbol parametrizada por un `maxDepth` opcional, en vez de dos implementaciones paralelas.
- `SidebarItemListEditor` ya usa una convención de `path` posicional en notación de puntos (`"root"`, `"root.0"`,
  `"root.0.2"`, …) para identificar cada nivel recursivo. Esta feature reutiliza literalmente esa convención (sin
  el prefijo `"root."` inicial la trato como cadena vacía) también para el header, que hoy no la necesita por ser
  de solo 2 niveles fijos (`ShellMenuListEditor` + `ShellMenuChildrenListEditor` como dos componentes distintos,
  cada uno indexando por separado).
- El pipeline de commit (`onCommitMenu`/`onCommitItems` → `onCommitShellMutation` → `commitCanvasMutation` →
  `validateRuntimeConfig` → patch de la clave raíz `shell`) no cambia: todas las mutaciones nuevas (anidar, mover
  entre niveles) siguen produciendo un array/árbol completo que se pasa por el mismo callback ya cableado, igual
  que hoy hace `reorder()`.

## Objetivos / No objetivos

### Objetivos
- Definir la estrategia técnica de geometría de zonas de drop para permitir, dentro del mismo árbol (`menu`
  completo del header incluidos sus `children`; `sidebar.items` completo a cualquier profundidad): reanidar un item
  existente como hijo de otro, y moverlo a una posición ordinal de cualquier lista de hermanos del mismo árbol
  (incluida la raíz), respetando el tope de profundidad 1 del header y la ausencia de tope del sidebar.
- Definir cómo se preserva el estado de colapso por item (incluido el de todo un subárbol movido) a través de
  reordenar, reanidar y mover entre niveles, sin cambiar el contrato JSON ni introducir un campo `id`.
- Definir el mecanismo técnico de las dos sub-vistas "Header"/"Sidebar" sin perder estado de la sub-vista no
  visible.
- Señalar qué módulos existentes se extienden y cuáles son nuevos, sin trocear en tareas.

### No objetivos
- No se resuelve el shape exacto de cada mensaje de commit rechazado ni el catálogo de tests por archivo — eso
  pertenece a `generate-implementation-plan`.
- No se toca `validate-shell.ts`, `runtime-config-zod.ts`, ni ningún otro punto de validación del contrato JSON.
- No se resuelve aquí el icono exacto del indicador de rama ni el valor exacto en píxeles del espacio antes del
  primer hijo — son ajustes visuales menores sin impacto arquitectónico, análogos a los "ajustes visuales menores"
  que `0106` dejó abiertos a la fase de tareas.
- No se rediseña `LayoutCanvasDndContext` ni el árbol de `Layout`; solo se sigue su patrón como precedente.

## Decisiones

### Decisión 1 — Un único `DndContext` por árbol, no uno por nivel

Cada árbol (`shell.header.menu` con todos sus `children`; `shell.sidebar.items` con toda su recursión) se envuelve
en un **único** `DndContext` de `@dnd-kit/core`, reemplazando el patrón actual de "un `DndContext` por nivel"
(`ShellDndSortableList` instanciado una vez por lista). El header y el sidebar mantienen `DndContext`s
**separados** entre sí (dos árboles de datos distintos): esto es lo que hace que arrastrar entre el menú del header
y el árbol del sidebar siga siendo estructuralmente imposible (ni siquiera hay un `over.id` que resolver contra el
otro árbol), sin necesidad de una regla de validación explícita para ese caso — igual que hoy garantiza "no
cross-nivel" con contexts por nivel.

**Alternativa descartada:** mantener contexts por nivel y coordinarlos con un `DndContext` padre compartido a nivel
de toda la sección Shell (usando `DragOverlay`/eventos globales). Rechazada porque reintroduce exactamente la
complejidad de coordinación entre contexts que un único context ya resuelve gratis, y no aporta ningún beneficio
sobre separar únicamente por árbol de datos (header vs sidebar).

### Decisión 2 — Dos categorías de zona droppable dentro del mismo árbol: `gap` (reordenar/mover) y `nest` (anidar)

Hoy cada fila (`ShellDndSortableRow`) es a la vez *draggable* (su asa) y *droppable* en su propio índice, y soltar
sobre una fila intercambia posiciones dentro de la misma lista. Para poder distinguir "quiero que este item pase a
ser hermano en esta posición" de "quiero que este item pase a ser hijo de este otro item", se introducen dos
identidades droppable distintas dentro del mismo `DndContext`:

- **Zona `gap`**: franja de ancho completo en el flujo normal (mismo patrón ya vigente para contenedores no-grid en
  `src/runtime/layout-renderer.tsx`/`LayoutCanvasDropZoneGap`: un `<div>` de bajo alto, sin medición ni overlay,
  simplemente intercalado en el flujo vertical). Para una lista de `N` items se emiten `N+1` zonas `gap` (antes del
  primero, entre cada par, después del último), igual convención ordinal que ya usa Layout. Soltar sobre una zona
  `gap` inserta el item arrastrado en esa posición ordinal exacta de esa lista de hermanos (que puede ser la lista
  raíz o la de `children` de cualquier item, a cualquier profundidad).
- **Zona `nest`**: el cuerpo entero de la fila de un item (el mismo elemento que ya es droppable hoy) pasa a
  representar "anidar como hijo de este item" en vez de "intercambiar posición". Esta es la extensión conceptual
  nueva: hoy el cuerpo de la fila ya es droppable pero solo para el intercambio de posición; con zonas `gap`
  explícitas asumiendo ese rol, el cuerpo de la fila queda libre para significar "anidar dentro de mí".

Identidad serializada (strings simples, sin necesidad de JSON.stringify): `nest:{path}` para anidar en el item de
ese `path`; `gap:{parentPath}:{index}` para insertar en la posición `index` de la lista de hermanos identificada
por `parentPath` (`""` para la lista raíz). `path`/`parentPath` reutilizan literalmente la convención ya vigente de
`SidebarItemListEditor` (`"0"`, `"0.2"`, …), extendida sin cambios al header.

**Alternativa descartada:** reutilizar el mismo `id` de fila para ambas señales y decidir `gap` vs `nest` según la
posición del cursor dentro del bounding box de la fila (mitad superior/inferior = gap, centro = nest, al estilo de
algunos editores de árbol tipo "outliner"). Rechazada por requerir medición geométrica en tiempo de arrastre
(`onDragOver` con `getBoundingClientRect` del elemento sobrevolado) para una feature que puede resolverse sin
medición alguna con dos elementos droppable ya distintos; añade complejidad y superficie de test sin necesidad real
dado que las listas de Shell son cortas y verticales, no un grid denso.

### Decisión 3 — Módulo de mutación de árbol genérico, parametrizado por `maxDepth`

Se introduce un módulo nuevo de funciones puras sobre árboles con forma `{ children?: T[] }`, compartido por header
y sidebar (área nueva dentro de `shell-config-panel/`, sin necesidad de tocar `src/runtime/` ni `src/config/`: es
edición de formulario, no árbol renderizado real). Responsabilidades:

- `getAtPath` / `removeAtPath` / `insertAtPath(parentPath, index, node)` / `appendChildAtPath(targetPath, node)`:
  primitivas de lectura/escritura por `path` posicional en notación de puntos.
- `isSelfOrDescendantPath(candidatePath, ofPath)`: previene ciclos — un destino igual al propio `path` del item
  arrastrado o que empiece por `${path}.` es siempre inválido, en ambos árboles.
- `subtreeHeight(node)`: `0` si el nodo no tiene `children` (u otro caso hoja), `1 + max(subtreeHeight(child))` en
  otro caso. Para el header esto es como mucho `1` (un `menuItemChild` nunca tiene `children`); para el sidebar no
  tiene cota.
- Validez de profundidad, uniforme para `gap` y `nest`: sea `targetDepth` la profundidad del destino (profundidad
  del `parentPath` para una zona `gap`; profundidad de `path + 1` para una zona `nest`). El destino es inválido si
  `maxDepth !== null && targetDepth + subtreeHeight(draggedNode) > maxDepth`. Con `maxDepth = 1` (header) esto
  reproduce exactamente el criterio de aceptación 5 de la spec (anidar un item de profundidad 1 dentro de otro de
  profundidad 1 da `targetDepth=2`, `subtreeHeight=0`, `2 > 1` → inválido) y además cubre el caso no probado
  explícitamente mencionado en el objetivo pero derivable de la misma regla general de la spec ("profundidad mayor
  a 1"): mover un item de profundidad 0 que **ya tiene** `children` (`subtreeHeight=1`) hasta el cuerpo de otro item
  de profundidad 0 (`targetDepth=1`) también sería `1+1=2 > 1` → inválido, coherente con que esos hijos de segundo
  nivel violarían el tope igual que si se anidaran directamente. Con `maxDepth = null` (sidebar) esta comprobación
  se omite siempre.
- `moveSubtree(tree, sourcePath, destination)`: combina remove + insert/append y devuelve tanto el árbol resultante
  como un `pathRemap: Map<string, string>` — el mapeo de todo `path` bajo el subárbol movido (el propio nodo y cada
  descendiente) desde su `path` antiguo a su `path` nuevo. Este remap es el mecanismo que permite preservar estado
  externo indexado por `path` (ver Decisión 4) sin que esa lógica tenga que conocer nada de "colapso": es una
  utilidad neutra de reescritura de claves.
- Reordenar dentro del mismo nivel (comportamiento ya existente) se modela como el caso particular
  `moveSubtree(tree, path, {parentPath: parentOf(path), index: targetIndex})` con `parentPath` igual al actual — el
  código de reordenamiento ya existente puede expresarse con esta misma primitiva en vez de mantener una función
  `reorder()` paralela, evitando divergencia entre "mover dentro del nivel" y "mover entre niveles".

**Alternativa descartada:** mantener `reorder()` (intercambio de índices dentro de un array plano, ya existente)
sin tocar, y añadir por separado funciones de reanidado solo para los casos nuevos. Rechazada porque duplicaría la
lógica de ajuste de índice tras una extracción (mover un item hacia adelante en su propia lista exige restar 1 al
índice destino tras el `splice` de extracción — detalle ya resuelto hoy dentro de `reorder()`) en dos sitios en vez
de uno, y porque el estado de colapso (Decisión 4) necesita un `pathRemap` también para el reordenamiento simple,
no solo para mover entre niveles: sin unificar, habría que construir ese remap dos veces con dos formas de
detectarlo.

### Decisión 4 — Estado de colapso indexado por `path`, con reescritura vía `pathRemap`

El estado expandido/colapsado de cada item se guarda en un `Map<string, boolean>` por árbol (uno para el menú del
header, uno para el sidebar), poseído por un hook dedicado a nivel de `ShellConfigPanel` (o de cada sub-vista), no
por cada fila individualmente. La clave es el `path` posicional del item (misma cadena que ya identifica su
posición en el árbol de datos); ausencia de entrada equivale a colapsado (default revisado durante la
implementación — ver spec: el expandido-por-defecto original reproducía, con todas las filas abiertas desde el
primer render, la misma dificultad de lectura de árboles con varias ramas que esta feature busca resolver).

Se descartó deliberadamente indexar por identidad de objeto (`WeakMap` sobre la referencia `MenuItemConfig`/
`SidebarItemConfig` del propio item) tras revisar cómo `shell-menu-list-editor.tsx`/`sidebar-item-list-editor.tsx`
ya committean hoy una edición: cualquier edición de un campo reconstruye con spread (`{ ...next[parentIndex],
children: nextChildren }`) **todos los ancestros directos** del nodo editado hasta la raíz de esa rama, no solo el
propio nodo. Si el colapso se indexara por referencia de objeto, colapsar un padre y luego editar cualquier campo
de un hijo suyo (aunque el hijo esté expandido y el padre colapsado) invalidaría silenciosamente la entrada del
padre en el mapa (su objeto cambia de referencia) y lo re-expandiría en el siguiente render sin que el usuario
tocara su control de colapso — una regresión de UX no cubierta explícitamente por un criterio de aceptación, pero
que contradice el requisito general "colapsar un item no deshabilita ninguna interacción sobre él ni sobre su
subárbol". Indexar por `path` evita este problema por construcción: una edición de campo nunca cambia el `path` de
ningún nodo, sólo `moveSubtree` lo hace, y `moveSubtree` ya produce el `pathRemap` necesario para reescribir las
claves del mapa de colapso exactamente para los nodos que de verdad cambiaron de posición — incluido el caso límite
de la spec ("mover un item con hijos en distintos estados de colapso: el subárbol completo, incluido el estado de
colapso de cada descendiente, viaja con él sin alterarse"), que se resuelve aplicando el mismo `pathRemap` a todas
las entradas del mapa cuya clave estaba bajo el `path` movido.

**Coste asumido:** cada operación de mover/reanidar/reordenar debe, además de committear el árbol de datos, aplicar
el `pathRemap` correspondiente al mapa de colapso de ese árbol. Es un paso mecánico adicional en el mismo punto de
la mutación, sin lógica de negocio propia.

### Decisión 5 — Anidar sobre el cuerpo de cualquier item (incluido uno en modo hoja) lo convierte en modo "con hijos"

Los criterios de aceptación 3 y 4 de la spec ("arrastrar... hasta el cuerpo de **otro** `sidebarItem`"/"...de **otro**
`menuItem` de profundidad 0") no restringen el destino a items que ya estén en modo "Con hijos"/"Con submenú". Dado
que el schema exige exactamente uno de `href`/`action`/`children` (invariante fuera de alcance de esta feature),
soltar sobre el cuerpo de un item en modo hoja (`href`/`action`) para anidarle un hijo **sustituye** su
`href`/`action` por un array `children` que contiene únicamente el item arrastrado — no hay otra forma de que el
resultado siga siendo un `menuItem`/`sidebarItem` válido. Anidar sobre un item que ya está en modo "Con hijos"
añade el item arrastrado como **último** elemento de su `children` existente (mismo criterio de "añadir al final"
que ya usa hoy el botón "Añadir elemento de menú/sidebar"), no como primero — consistencia con la única convención
de inserción manual que ya existe, y coherente con que las zonas `gap` explícitas dentro de ese mismo `children`
(Decisión 2) ya cubren la necesidad de insertar en una posición intermedia concreta tras el reanidado.

### Decisión 6 — Sub-vistas Header/Sidebar: `role="tablist"`, ambos paneles siempre montados

`ShellConfigPanel` introduce un `role="tablist"` con dos `role="tab"` ("Header", "Sidebar") controlando un
`aria-selected`/`aria-controls` hacia dos `role="tabpanel"`, reutilizando el mismo patrón de accesibilidad que la
spec pide (ver spec, "Requisitos no funcionales"). La restricción funcional clave — "cambiar de sub-vista no
descarta ni desmonta el estado de la otra" — se resuelve manteniendo **ambos** `tabpanel` montados en todo momento
y alternando su visibilidad con una clase Tailwind (`hidden`) según la sub-vista activa, en vez de renderizado
condicional (`{activeTab === 'header' && <...>}`). Esto es exactamente el mismo precedente ya documentado para
`accordion`/`modal` en modo Editor ("su cuerpo... están siempre presentes en el DOM con independencia de..."), y
evita tener que levantar el estado de colapso/rechazos pendientes/`DndContext` de cada sub-vista fuera de su propio
árbol de componentes: como nunca se desmontan, ese estado sobrevive al cambio de sub-vista sin ningún mecanismo
adicional de preservación.

**Cambiar de sub-vista con un arrastre en curso:** con el único sensor configurado hoy (`PointerSensor`, sin
`KeyboardSensor`), un arrastre en curso captura el puntero sobre el árbol de la sub-vista activa; no existe una
secuencia de interacción real por la que el usuario pueda hacer click en el tab de la otra sub-vista mientras el
puntero sigue capturado por un drag. El caso límite de la spec queda satisfecho por esta razón estructural, sin
necesidad de lógica de cancelación explícita ni de remontar el `DndContext` al cambiar de tab.

### Decisión 7 — Ubicación del código

- Módulo de mutación de árbol (Decisión 3): pieza nueva dentro de `src/dev-runtime/shell-config-panel/` (no toca
  `src/runtime/` ni `src/config/` — es edición de formulario sobre JSON, no el árbol real renderizado, a
  diferencia del canvas de `Layout`). Testeable como funciones puras sin DOM, mismo criterio que
  `computeGridDropZoneRects` en `0106`.
- Extensión del módulo de DnD de Shell (`shell-config-panel-dnd.tsx`): pasa de exponer una lista ordenable de un
  nivel a exponer el `DndContext` compartido por árbol más los dos tipos de zona (`gap`/`nest`) y la traducción de
  `onDragEnd` a una llamada a `moveSubtree`, con el mismo patrón de indicador visual verde/rojo por `[data-drop-
  zone]`/clases Tailwind que ya usa `LayoutCanvasDndContext`.
- Hook de estado de colapso (Decisión 4): pieza nueva, consumida desde los editores de lista existentes
  (`ShellMenuListEditor`/`ShellMenuChildrenListEditor` para el header, `SidebarItemListEditor` para el sidebar).
- Los editores de lista existentes se extienden (no se reescriben desde cero) para: montar el nuevo wrapper de DnD
  compartido en vez de `ShellDndSortableList` por nivel, renderizar el control de colapso y la fila resumen por
  item, y renderizar el icono indicador de rama y el espacio antes del primer hijo.
- `ShellConfigPanel` se extiende con la sub-navegación (Decisión 6), envolviendo el bloque ya existente de Header y
  el bloque ya existente de Sidebar cada uno en su propio `tabpanel`, sin cambiar el pipeline de commit de ninguno
  de los dos.

## Riesgos y trade-offs

- **Superficie nueva de bugs de geometría de árbol:** mover/reanidar entre niveles con `path` posicional es más
  propenso a errores de índice off-by-one que el `reorder()` plano actual (ya lo es hoy en Layout con
  `movePathTo`). Mitigación: centralizar toda la aritmética de `path` en el módulo puro de la Decisión 3, con tests
  unitarios exhaustivos de esa función antes de integrarla en los editores (mismo criterio que `0106` aplicó a
  `computeGridDropZoneRects`).
- **Mapa de colapso indexado por `path` puede quedar inconsistente si una mutación de árbol no pasa por
  `moveSubtree`:** cualquier código nuevo que reordene/reanide sin usar la primitiva compartida rompería la
  sincronía entre el árbol de datos y el mapa de colapso. Mitigación: no dejar ninguna ruta alternativa de mutación
  estructural fuera del módulo de la Decisión 3 — el reordenamiento simple también se expresa con `moveSubtree`
  (ver Decisión 3), así que hay una única puerta de entrada.
  Este riesgo requiere que la fase de tareas trate el módulo de la Decisión 3 como dependencia bloqueante de
  cualquier tarea que toque `ShellMenuListEditor`/`SidebarItemListEditor`.
- **Reanidar sobre un item hoja descarta su `href`/`action` (Decisión 5):** es una pérdida de dato silenciosa desde
  la perspectiva de quien arrastra sobre el item (no desde la del item arrastrado). Mitigación: ninguna adicional
  más allá de lo ya decidido — es la única resolución consistente con el schema, y la spec ya trata el resto de
  transiciones de modo (por ejemplo cambiar el selector de modo de un item de `href` a `action`) sin confirmación
  ni deshacer, así que no introduce un patrón de pérdida de datos nuevo respecto al resto del panel.
- **Dos `DndContext` completos de árbol montados simultáneamente (uno por sub-vista, Decisión 6) más el propio de
  Layout cuando el usuario ha visitado esa pestaña:** coste de memoria/render despreciable para el tamaño esperado
  de estos árboles (navegación de aplicación, no datos de negocio), mismo orden de magnitud ya asumido por `0106`
  para contenedores grid.

## Migración o despliegue

No aplica: cambio exclusivo del editor en modo desarrollo (`src/dev-runtime/`), sin cambios de contrato JSON, sin
migración de datos, sin flags de despliegue. Compatible en caliente con cualquier `config.json` existente.

## Preguntas abiertas

Ninguna bloqueante. Los ajustes visuales menores (icono exacto del indicador de rama, ancho de las zonas `gap` en
píxeles) quedan como decisión de implementación acotada para la fase de tareas, igual criterio que `0106` dejó para
sus propios ajustes visuales menores.

---

**Siguiente paso del flujo:** `generate-implementation-plan`.
