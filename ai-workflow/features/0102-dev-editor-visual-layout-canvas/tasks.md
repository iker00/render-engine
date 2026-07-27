# Tasks: 0102 — Editor visual directo del layout (modo desarrollo)

Contrato de ejecución para la implementación de la feature. Cada tarea es atómica, secuencial, y su cierre habilita
la siguiente. Las decisiones de arquitectura se cierran en `design.md` (Decisiones 1–11); esta lista no las reabre,
salvo donde se indica explícitamente que un detalle se resuelve aquí porque `design.md` lo dejó abierto a propósito
para el plan de implementación.

Decisión de UI resuelta en esta planificación (no fijada por `spec.md` ni `design.md`): el drawer existente gana dos
pestañas, **Visual** y **JSON**. Solo una vista está montada en DOM a la vez; ambas leen y escriben el mismo estado
(`currentConfig` / `editorBuffer`), así que la sincronización sigue siendo inmediata al cambiar de pestaña. Esto
determina el diseño de `DevRuntimeDrawer` y de `DevRuntimeReady` en las tareas T5 en adelante.

Convenciones:
- Orden estricto: las tareas se ejecutan en el orden en que aparecen. Cada dependencia declarada apunta hacia arriba.
- "cierre de implementación": código y tests de la tarea completos, `pnpm test --run <ruta>` en verde para cada
  fichero declarado en el sub-bloque `tests` de la tarea.
- Cobertura global (`pnpm test`) se comprueba una única vez al final de la fase de implementación, no por tarea
  (regla global recogida en `ai-workflow/standards/testing-rules.md`).
- Todas las tareas que tocan `src/runtime/` (código compartido con producción) deben dejar el comportamiento de
  producción bit a bit idéntico cuando `LayoutEditModeContext` no está presente. Esto se verifica con un test de
  regresión explícito en la tarea que lo introduce (T2) y se preserva en las tareas posteriores que también tocan
  ficheros de `src/runtime/` (T10, T11).

---

## T1 — Predicados puros de colocación estructural (`src/config/layout-placement-rules.ts`)

- **ID**: T1
- **Estado**: completado
- **Objetivo**: crear `src/config/layout-placement-rules.ts` con:
  - `export const FORM_ONLY_LEAF_NODE_TYPES: ReadonlySet<LayoutNodeType>` con exactamente
    `{'input', 'textarea', 'select', 'radioGroup', 'checkboxGroup', 'fileInput', 'toggle', 'hidden'}` — los tipos que
    hoy exigen un ancestro `form` según las dos comprobaciones inline en
    `src/config/validate-form-nodes.ts` (`validateFormNodesInCollection` y `validateFormChildren`, ambas alrededor de
    la lista `input/textarea/select/radioGroup/checkboxGroup/fileInput/toggle/hidden`).
  - `export function buttonRequiresFormAncestor(node: { props?: { action?: unknown } }): boolean` que devuelve
    `node.props?.action === undefined` (con optional chaining, no `node.props.action`). **Precisión respecto a la
    condición original citada literalmente en una versión anterior de esta tarea** (detectada en
    `review-implementation-plan`, cuarta pasada): la condición ya existente en
    `src/config/validate-form-nodes.ts` es `node.type === 'button' && node.props.action === undefined` sin
    optional chaining, pero ahí nunca falla porque todo nodo `button` ya pasó por `buttonNodeSchema`
    (`runtime-config-zod.ts`), que exige `props` como objeto obligatorio — así que `node.props` nunca es
    `undefined` en ese punto de la validación. El nodo sintético que T13 construye para un drag originado en la
    paleta (`draggedNode = { type: options.draggedNodeType }`, sin `props`) sí puede llegar sin `props`, así que el
    predicado reutilizable debe tolerarlo con `?.`; el resultado (`undefined === undefined` → `true`, "requiere
    ancestro `form`") es exactamente la semántica correcta para ese caso. El comportamiento sobre nodos reales ya
    validados no cambia.
  - `export const FORM_ALLOWED_DESCENDANT_TYPES: ReadonlySet<LayoutNodeType>` con exactamente el catálogo cerrado
    que hoy usa `validateFormChildren` para rechazar cualquier otro tipo dentro de un `form` (incluyendo anidado vía
    `container`/`accordion`/`tabs`):
    `input, textarea, select, radioGroup, checkboxGroup, fileInput, toggle, hidden, button, heading, paragraph,
    image, table, container, accordion, divider, tabs`. Nota explícita: esta lista excluye `list`, `link`, `modal`,
    `badge`, `alert`, `stat`, `skeleton`, `repeater` y `fileManager` — ninguno de estos es válido dentro de un `form`
    hoy, y el nuevo predicado debe preservar exactamente ese rechazo.
  - `export function nodeTypeAcceptsChildren(type: LayoutNodeType): boolean` que devuelve `true` para `'container'`,
    `'form'`, `'modal'`, `'link'` y `'accordion'`. **Corrección respecto a una lectura inicial de la spec**: la spec
    resume "solo container y form aceptan children", pero esa frase resume de forma incompleta
    `config/structure.md` (que no cubre `modal`/`link`/`accordion`, documentados en sus propias fichas de
    `nodes/`). El contrato real ya vigente, verificable en `hasChildren()` de `src/runtime/layout-renderer.tsx`
    (línea con `node.type === 'container' || node.type === 'form' || node.type === 'modal' || node.type === 'link'`)
    y en el manejo de `node.children` dentro de `src/runtime/nodes/accordion-layout-node.tsx`, incluye estos cinco
    tipos. Excluir `modal`/`link`/`accordion` de este predicado violaría el requisito no funcional de la spec de
    "reutilizar las mismas reglas estructurales ya definidas en `src/config/`, sin duplicarlas de forma divergente":
    un canvas que reutiliza el renderer de producción (Decisión 1 de `design.md`) pero rechaza como destino de drop
    algo que la propia producción renderiza sería una regla divergente, no una reutilizada. `'tabs'` queda **fuera**
    de este predicado a propósito: un nodo `tabs` no acepta children directamente en su raíz — solo
    `props.items[i].children`, una colección por pestaña — y se trata como caso especial en T13, no aquí.
    `repeater` también queda fuera a propósito (solo admite `props.template`, tratado en T3/T11).
  - `export const MODAL_ALLOWED_CHILD_TYPES: ReadonlySet<LayoutNodeType>` y
    `export const LINK_ALLOWED_CHILD_TYPES: ReadonlySet<LayoutNodeType>`: mover aquí (no duplicar) los Sets
    `modalAllowedChildTypes`/`linkAllowedChildTypes` hoy declarados sin exportar en
    `src/config/validate-layout-nodes.ts` (líneas 85-86), y hacer que ese fichero los importe de vuelta desde
    `layout-placement-rules.ts` en vez de declararlos localmente. Es una relocalización pura, sin cambio de
    contenido ni de comportamiento — la validación de `modal`/`link` ya existente es la red de seguridad de
    regresión.
  - Refactorizar `validateFormNodesInCollection` y `validateFormChildren` en `src/config/validate-form-nodes.ts` para
    que consuman `FORM_ONLY_LEAF_NODE_TYPES`, `buttonRequiresFormAncestor` y `FORM_ALLOWED_DESCENDANT_TYPES` en vez de
    repetir las listas de tipos inline. Es una extracción pura: el resultado observable (mensajes de error, éxito y
    fallo) debe ser idéntico al actual.
- **Fuera de alcance**:
  - cualquier cambio de comportamiento de validación observable (mensajes, códigos de error, aceptación/rechazo).
  - el motor de validez de drop del canvas que consumirá estos predicados (T13).
  - tocar `validate-layout-nodes.ts` más allá de lo estrictamente necesario para importar los predicados si aplica.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/config/layout-placement-rules.ts` (nuevo)
    - `src/config/validate-form-nodes.ts` (modificar: consumir los predicados nuevos en las dos funciones citadas)
    - `src/config/validate-layout-nodes.ts` (modificar: eliminar las declaraciones locales de
      `modalAllowedChildTypes`/`linkAllowedChildTypes` e importar `MODAL_ALLOWED_CHILD_TYPES`/`LINK_ALLOWED_CHILD_TYPES`
      desde `layout-placement-rules.ts`)
  - tests:
    - `src/tests/config-validation/layout-placement-rules.test.ts` (nuevo)
  - documentación: `ai-workflow/docs/app-features/config/structure.md` (la línea "`children`: opcional, pero solo
    interpretado en `container` y `form`" queda desactualizada frente al comportamiento real ya vigente que esta
    misma tarea documenta con precisión — ver objetivo; referencia para `update-app-documentation`, no se corrige
    inline aquí).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/config-validation/layout-placement-rules.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `nodeTypeAcceptsChildren('container')`, `nodeTypeAcceptsChildren('form')`, `nodeTypeAcceptsChildren('modal')`,
      `nodeTypeAcceptsChildren('link')` y `nodeTypeAcceptsChildren('accordion')` devuelven `true`.
    - `nodeTypeAcceptsChildren('repeater')`, `nodeTypeAcceptsChildren('tabs')` y `nodeTypeAcceptsChildren('heading')`
      devuelven `false`.
    - `MODAL_ALLOWED_CHILD_TYPES` y `LINK_ALLOWED_CHILD_TYPES` contienen exactamente los mismos tipos que hoy
      `modalAllowedChildTypes`/`linkAllowedChildTypes` en `validate-layout-nodes.ts` (comparación por contenido, no
      solo por tamaño).
    - `FORM_ONLY_LEAF_NODE_TYPES` contiene exactamente los ocho tipos listados, ni uno más ni uno menos.
    - `buttonRequiresFormAncestor({ props: {} })` devuelve `true`; `buttonRequiresFormAncestor({ props: { action: { type: 'navigateTo', pageId: 'x' } } })` devuelve `false`.
    - `buttonRequiresFormAncestor({ type: 'button' })` (sin `props` en absoluto, como el nodo sintético que T13
      construye para un drag originado en la paleta) devuelve `true` sin lanzar ninguna excepción.
    - `FORM_ALLOWED_DESCENDANT_TYPES.has('repeater')`, `.has('fileManager')`, `.has('list')`, `.has('link')`,
      `.has('modal')`, `.has('badge')`, `.has('alert')`, `.has('stat')` y `.has('skeleton')` devuelven `false`.
    - `FORM_ALLOWED_DESCENDANT_TYPES.has(...)` devuelve `true` para cada uno de los 17 tipos listados en el
      objetivo.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/config-validation/layout-placement-rules.test.ts`
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (regresión: no
      debe cambiar ningún resultado tras el refactor)
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (regresión)
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts` (regresión: la
      relocalización de `modalAllowedChildTypes` no debe cambiar ningún resultado)
    - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts` (regresión: incluye la
      validación estructural y cruzada del nodo `link`; la relocalización de `linkAllowedChildTypes` no debe cambiar
      ningún resultado)
  - **Restricciones**:
    - No modificar ningún caso existente en `runtime-config-validation-forms-semantics.test.ts`,
      `runtime-config-validation-form-fields.test.ts`, `runtime-config-validation-modal.test.ts` ni en el fichero de
      `link`; deben seguir en verde sin tocar sus expectativas. Son la red de seguridad de esta extracción, tal como
      fija `design.md` (Decisión 6, mitigación de riesgo).
    - No cambiar ningún mensaje de error existente.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/config/structure.md`: corregir la línea sobre qué tipos aceptan `children` para
    incluir `modal`/`link`/`accordion` (referencia; corrección real diferida a `update-app-documentation`).
- **Criterios de finalización**:
  - Los predicados existen con la forma exacta descrita (incluyendo `modal`/`link`/`accordion` en
    `nodeTypeAcceptsChildren` y los dos Sets relocalizados y exportados) y son consumidos por
    `validate-form-nodes.ts`/`validate-layout-nodes.ts`.
  - La suite completa de validación de formularios, modal y link (ficheros de regresión listados) sigue en verde sin
    modificaciones.
  - Tests nuevos del fichero en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/config-validation/layout-placement-rules.test.ts` y los
  cuatro ficheros de regresión listados, todos en verde.

---

## T2 — Modelo de `path`, `LayoutEditModeContext` y wrapper de selección/hover en el renderer de producción

- **ID**: T2
- **Estado**: completado
- **Nota de corrección post-cierre (encontrada durante T6, autorizada por el usuario, aplicada antes de T7)**: el
  wrapper de selección de esta tarea, sin `stopPropagation`, dejaba que un click sobre un nodo anidado burbujeara
  por todos sus ancestros seleccionables, y el ancestro más externo (último en dispararse) acababa ganando la
  selección final — el click en un nodo profundo terminaba seleccionando siempre la raíz de la página. Corregido en
  `src/runtime/layout-node-renderer.tsx` con un marcador en `event.nativeEvent` para que el wrapper más interno
  (el nodo realmente clicado) gane, sin usar `stopPropagation`. `onMouseEnter`/`onMouseLeave` no tenían este bug
  (React dispara la cascada de `mouseenter` outside-in, orden inverso al de `click`, así que "última escritura gana"
  ya resolvía correctamente al nodo más interno) y se dejaron intactos, con un test de regresión que fija ese
  comportamiento correcto. Tests ampliados en
  `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`.
- **Objetivo**: introducir la infraestructura de direccionamiento y el punto de extensión central (Decisiones 2 y 3
  de `design.md`), sin ninguna funcionalidad de mutación todavía:
  1. `src/runtime/layout-node-path.ts` (nuevo): tipo
     `LayoutPathStep = { field: 'children' | 'template'; index: number } | { field: 'tabItem'; itemIndex: number; index: number }`
     y `LayoutNodePath = LayoutPathStep[]`. El tercer variante (`'tabItem'`) direcciona un hijo dentro de
     `tabsNode.props.items[itemIndex].children[index]`: `tabs` es el único tipo cuya colección de hijos no cuelga
     directamente de `node.children`/`node.props.template`, sino de una colección por pestaña — ver Nota de alcance
     más abajo. Función pura `getNodeAtPath(rootNodes: readonly LayoutNode[], path: LayoutNodePath): LayoutNode | null`
     que navega el árbol siguiendo cada paso (`'children'` entra en `node.children`; `'template'` entra en
     `node.props.template`, solo válido cuando el nodo en ese punto es `repeater`; `'tabItem'` entra en
     `node.props.items[itemIndex].children`, solo válido cuando el nodo en ese punto es `tabs`) y devuelve `null` si
     el path deja de resolver (índice fuera de rango, o tipo de nodo incompatible con el paso); función pura
     `serializeLayoutNodePath(path: LayoutNodePath): string` que produce una representación estable para el
     atributo `data-node-path` (por ejemplo `"children.0.children.2"` o `"children.0.tabItem.1.3"` para un paso
     `tabItem`).
     **Nota de alcance (origen: hallazgo de `review-implementation-plan` sobre esta misma planificación)**: esta
     tarea solo define el modelo de datos del path y su resolución genérica. El threading real de `path` dentro de
     las llamadas internas a `LayoutRenderer` que hacen `repeater-layout-node.tsx`, `accordion-layout-node.tsx` y
     `tabs-layout-node.tsx` (cada uno gestiona su propio subárbol sin pasar por la recursión de nivel superior de
     `layout-renderer.tsx`, a diferencia de `container`/`form`/`modal`/`link`, que sí quedan cubiertos por el paso 3
     de este objetivo) se implementa en T11, no aquí.
  2. `src/runtime/layout-edit-mode-context.tsx` (nuevo, sigue el patrón ya existente de
     `runtime-layout-context.tsx`): `LayoutEditModeContext` con valor
     `{ selectedPath: LayoutNodePath | null; hoveredPath: LayoutNodePath | null; onSelectNode: (path: LayoutNodePath) => void; onHoverNode: (path: LayoutNodePath | null) => void } | null`
     (el contexto por defecto es `null`, no un objeto con campos vacíos, para que el wrapper distinga de forma
     inequívoca "sin proveedor" de "proveedor con selección vacía"); `LayoutEditModeProvider` (componente con JSX que
     envuelve `children` en `.Provider`) y hook `useLayoutEditModeContext()` que devuelve el valor o `null`.
  3. Modificar `src/runtime/layout-renderer.tsx` para aceptar dos props opcionales en `LayoutRendererProps`:
     `path?: LayoutNodePath` (por defecto `[]` en la raíz) y
     `buildChildPath?: (index: number) => LayoutNodePath` (por defecto
     `(index) => [...path, { field: 'children', index }]`, el comportamiento ya usado hoy por la recursión de nivel
     superior sobre `node.children` de `container`/`form`/`modal`/`link`). Para cada nodo de `nodes` en el `.map()`
     ya existente, `LayoutRenderer` calcula `childPath = buildChildPath(index)` una única vez y lo usa en **dos**
     sitios, no solo uno:
     - lo pasa a `LayoutNodeRenderer` como su prop `path` (esto es lo que permite que el propio nodo se identifique
       y se seleccione).
     - **lo pasa también como prop `path={childPath}` a la llamada recursiva interna**
       `<LayoutRenderer nodes={node.children ?? []} iterationContext={iterationContext} />` que ya existe hoy
       (dentro del propio `.map()`, para construir `renderedChildren` cuando `hasChildren(node)` es `true` —
       `container`/`form`/`modal`/`link`). **Precisión bloqueante corregida tras `review-implementation-plan`,
       octava pasada**: sin este segundo uso explícito, la llamada recursiva recibiría `path` por defecto (`[]`), y
       su propio `buildChildPath` por defecto generaría siempre `[{field:'children', index}]` en cada nivel en vez
       de acumular la profundidad real (`[...childPath, {field:'children', index}]`) — colapsando a un solo nivel
       el `path` de cualquier nodo anidado a más de un nivel bajo `container`/`form`/`modal`/`link` (por ejemplo el
       `heading` de `container > form > heading`, el escenario central de breadcrumb de la spec), produciendo paths
       colisionantes entre nodos de posiciones distintas del árbol. Los dos usos de `childPath` (como `path` de
       `LayoutNodeRenderer` y como `path` de la `<LayoutRenderer>` recursiva) deben coexistir en la misma iteración
       del `.map()`.
     **Motivo del parámetro `buildChildPath` (corrige un hueco detectado en `review-implementation-plan`, séptima
     pasada)**: `repeater`/`accordion`/`tabs` (T11) invocan su propio `<LayoutRenderer>` internamente sobre una
     colección que no cuelga de `field: 'children'` del nodo que las contiene (`props.template` para `repeater`,
     `props.items[itemIndex].children` para `tabs`) — sin este parámetro, `LayoutRenderer` no tendría forma de
     construir un paso `{field:'template', index}` o `{field:'tabItem', itemIndex, index}` en vez de
     `{field:'children', index}` hardcodeado. `accordion` sí reutiliza el `buildChildPath` por defecto (su colección
     cuelga de `node.children`, igual que `container`), pero necesita que se le pase explícitamente como base
     `path` el path del propio nodo `accordion` — ver T11 para el detalle de cada uno de los tres casos.
  4. Modificar `src/runtime/layout-node-renderer.tsx` para aceptar la prop `path?: LayoutNodePath` y, inmediatamente
     después del `switch (node.type)` existente (mismo punto donde hoy se aplica `<LazyNode>` y el `div` de
     grid-span), leer `useLayoutEditModeContext()`:
     - si es `null` (sin proveedor, incluye toda la producción y cualquier test que no lo monte explícitamente): el
       output es exactamente el actual, sin ningún elemento ni atributo añadido.
     - si no es `null`: envolver `renderedNode` en un elemento que añade `data-node-path={serializeLayoutNodePath(path)}`,
       `onClick` (llama a `onSelectNode(path)`, sin `stopPropagation`) y `onMouseEnter`/`onMouseLeave` (llaman a
       `onHoverNode(path)` / `onHoverNode(null)`), y añade una clase visual (Tailwind, por ejemplo un `outline`
       distintivo) cuando `serializeLayoutNodePath(selectedPath) === serializeLayoutNodePath(path)` (seleccionado) o
       igual para `hoveredPath` (hover), sin interferir con la clase de grid-span ya existente.
- **Fuera de alcance**:
  - mutaciones del árbol (T3), commit (T4), montaje del canvas en el drawer (T5), breadcrumb (T6), formulario de
    propiedades (T7–T9), placeholders vacíos (T10), `repeater` en modo edición (T11), drag-and-drop (T12–T15),
    borrado (T16).
  - cualquier cambio de comportamiento quando `LayoutEditModeContext` está ausente.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-node-path.ts` (nuevo)
    - `src/runtime/layout-edit-mode-context.tsx` (nuevo)
    - `src/runtime/layout-renderer.tsx` (modificar: threading de `path`)
    - `src/runtime/layout-node-renderer.tsx` (modificar: wrapper post-switch condicional al contexto)
  - tests:
    - `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (nuevo)
  - documentación: ninguna en esta tarea (sin funcionalidad observable para el usuario todavía).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - `getNodeAtPath` sobre un árbol con `container > form > input` devuelve el nodo correcto para el path completo,
      y `null` para un path que referencia un índice fuera de rango o un `field: 'template'` sobre un nodo que no es
      `repeater`.
    - `getNodeAtPath` sobre un árbol con un `tabs` de dos `items`, cada uno con su propio `children`, devuelve el
      nodo correcto para un path que termina en `{field:'tabItem', itemIndex:1, index:0}` (segundo tab, primer
      hijo), y `null` para un `field: 'tabItem'` sobre un nodo que no es `tabs`, o para un `itemIndex`/`index` fuera
      de rango.
    - `serializeLayoutNodePath([])`, `serializeLayoutNodePath([{field:'children',index:0},{field:'template',index:1}])`
      y `serializeLayoutNodePath([{field:'children',index:0},{field:'tabItem',itemIndex:1,index:0}])` producen
      strings estables y distintos entre sí para paths distintos.
    - `LayoutRenderer` sin `buildChildPath` (comportamiento por defecto) construye el path de cada hijo con
      `{field:'children', index}`, igual que antes de este parámetro.
    - `LayoutRenderer` con un `buildChildPath` personalizado (por ejemplo
      `(index) => [...path, {field:'template', index}]`) usa ese resultado como `path` de cada
      `LayoutNodeRenderer` hijo en vez del comportamiento por defecto — verificable comprobando el
      `data-node-path` resultante de cada hijo con `LayoutEditModeProvider` montado.
    - **Path compuesto en render real de al menos 3 niveles** (caso que habría detectado el hueco de la octava
      pasada de `review-implementation-plan`): montar con `LayoutEditModeProvider` un árbol real
      `container > form > heading` (sin construir ningún `path` a mano) y verificar que el `heading` expone
      `data-node-path="children.0.children.0"` (o el valor equivalente de `serializeLayoutNodePath` para ese path
      de 3 niveles), no un path colapsado a un solo nivel. Click sobre ese `heading` invoca `onSelectNode` con el
      path completo de 3 niveles. Este test ejercita la recursión real de `LayoutRenderer` (`container` → `form` →
      `heading`), no `getNodeAtPath` con un path escrito a mano, y cubre explícitamente que la llamada recursiva
      interna de `renderedChildren` (no solo la prop pasada a `LayoutNodeRenderer`) recibe el `path` correcto en
      cada nivel.
    - **Regresión byte a byte**: renderizar un layout representativo (container con hijos, form con input, repeater,
      button) sin `LayoutEditModeProvider` produce exactamente el mismo HTML (mismas clases, mismos atributos, sin
      `data-node-path`, sin `onClick`/`onMouseEnter` añadidos) que el mismo render antes de esta tarea. Se verifica
      comparando el `container.innerHTML` esperado literal o, si es más robusto, comprobando ausencia explícita del
      atributo `data-node-path` y de handlers en cualquier nodo del árbol.
    - Con `LayoutEditModeProvider` montado y `selectedPath: null`, cada nodo de nivel superior expone
      `data-node-path` con el valor esperado según su posición.
    - Click sobre un nodo renderizado invoca `onSelectNode` con el `path` exacto de ese nodo (no el de un ancestro ni
      un hijo).
    - `mouseEnter`/`mouseLeave` sobre un nodo invocan `onHoverNode(path)` / `onHoverNode(null)` respectivamente, sin
      alterar `selectedPath`.
    - Un nodo cuyo path coincide con `selectedPath` recibe la clase de selección; un nodo cuyo path coincide con
      `hoveredPath` (y no con `selectedPath`) recibe la clase de hover, no la de selección.
    - Click sobre un control interno de un nodo interactivo (por ejemplo un botón dentro de un `form` en el árbol de
      prueba) también dispara `onSelectNode` para el nodo contenedor más cercano con `data-node-path` (verifica que
      no se usa `stopPropagation` y que la burbuja normal es la esperada), sin romper el `onClick` propio del control
      interno (el test verifica que ambos handlers se ejecutan).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (regresión: sin
      `LayoutEditModeProvider`, debe seguir en verde sin cambios)
  - **Restricciones**:
    - No usar `stopPropagation` en los handlers añadidos (mitigación explícita de `design.md`, Decisión 2, para no
      romper controles interactivos internos).
    - El wrapper no debe reemplazar ni envolver de forma distinta el `div` de grid-span ya existente; debe
      componerse con él, no sustituirlo.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - `layout-node-renderer.tsx` produce output idéntico sin `LayoutEditModeContext` (test de regresión en verde).
  - Selección y hover funcionan correctamente con el contexto presente, con paths exactos por nodo.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`
  y `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` en verde.

---

## T3 — Funciones puras de mutación del árbol por `path` (`src/dev-runtime/layout-tree-mutations.ts`)

- **ID**: T3
- **Estado**: completado
- **Objetivo**: crear `src/dev-runtime/layout-tree-mutations.ts` con funciones puras que operan sobre
  `readonly LayoutNode[]` (el array `layout` de una página, o un `props.template` de `repeater`) usando
  `LayoutNodePath`/`LayoutPathStep` de `src/runtime/layout-node-path.ts`, devolviendo siempre un array nuevo sin
  mutar el original:
  - `getNodeAtPath` se reexporta desde `layout-node-path.ts` (no se duplica).
  - `replaceNodeAt(rootNodes, path, updater: (node: LayoutNode) => LayoutNode): LayoutNode[]` — sustituye el nodo en
    `path` por el resultado de `updater(nodoActual)`, reconstruyendo los arrays ancestros por el camino sin mutar los
    originales. Lanza si `path` no resuelve.
  - **Nota de diseño sobre `parentPath` y `tabs` (corrige una ambigüedad detectada en `review-implementation-plan`,
    segunda pasada)**: `LayoutNodePath` (el tipo de T2) direcciona siempre un **nodo existente** — cada paso,
    incluido `tabItem`, resuelve a un elemento concreto de una colección (`getNodeAtPath` nunca devuelve "una
    colección", solo un nodo o `null`). Esto es correcto y suficiente para `draggedPath`/`fromPath`/`selectedPath`
    (siempre apuntan a un nodo ya existente, incluso dentro de un `tabs`). Pero un destino de **inserción** no
    siempre es un nodo existente — es "la colección de hijos de tal nodo, en tal posición". Para
    `container`/`form`/`modal`/`link`/`accordion`/`repeater`, `parentPath` resuelve (vía `getNodeAtPath`) al nodo
    padre existente, y su tipo determina sin ambigüedad cuál es su colección (`children` o `template`). `tabs` es
    distinto: un mismo nodo `tabs` tiene **N colecciones** (`props.items[0].children`, `props.items[1].children`,
    …), así que resolver `parentPath` al nodo `tabs` no basta para saber en cuál de sus colecciones insertar — hace
    falta un dato adicional, no forzar que ese dato viva codificado como un paso más de `parentPath` (eso es lo que
    causaba la ambigüedad: un paso `tabItem` al final de un path ya significa "resuelve a un hijo concreto ya
    existente", no "esta es la colección vacía de destino"). La solución: **`parentPath` para destinos de inserción
    resuelve siempre a un nodo existente** (nunca a un `tabItem` terminal usado como marcador de colección); cuando
    ese nodo resuelto es de tipo `tabs`, la colección concreta se identifica con un parámetro adicional explícito
    `tabItemIndex`, nunca embebido en `parentPath`.
  - `insertNodeAt(rootNodes, parentPath: LayoutNodePath, index: number, newNode: LayoutNode, options?: { tabItemIndex?: number }): LayoutNode[]`
    — inserta `newNode` en la posición `index` de la colección de hijos del nodo en `parentPath`, o en el array raíz
    si `parentPath` es `[]`. `getNodeAtPath(rootNodes, parentPath)` (o `rootNodes` directamente si `parentPath` es
    `[]`) debe resolver siempre a un nodo existente (nunca `null`, salvo el caso raíz) cuyo tipo determina la
    colección de destino:
    - `container`/`form`/`modal`/`link`/`accordion`: inserta en `children` (creándolo si es `undefined`).
      `options.tabItemIndex` debe estar ausente; si se proporciona, lanza.
    - `repeater`: inserta en `props.template`. `options.tabItemIndex` debe estar ausente; si se proporciona, lanza.
    - `tabs`: `options.tabItemIndex` es **obligatorio**; inserta en `props.items[tabItemIndex].children` (creándolo
      si es `undefined`). Si `options.tabItemIndex` está ausente, o el nodo resuelto no es `tabs` y sí se
      proporciona `options.tabItemIndex`, lanza.
    - cualquier otro tipo resuelto (nodo hoja): lanza, porque no acepta hijos.
    `index` puede igualar la longitud actual de la colección (inserción al final).
  - `removeNodeAt(rootNodes, path): LayoutNode[]` — elimina el nodo en `path` (y con él, todo su subárbol, por ser
    simplemente la eliminación de esa entrada del array de su padre). `path` siempre direcciona un nodo existente
    (incluyendo un paso `tabItem` terminal, que resuelve al hijo concreto dentro de esa pestaña) — no aplica aquí la
    distinción de `parentPath`/`tabItemIndex` de `insertNodeAt`, porque borrar no necesita identificar una colección
    vacía de destino.
  - `movePathTo(rootNodes, fromPath: LayoutNodePath, toParentPath: LayoutNodePath, toIndex: number, options?: { toTabItemIndex?: number }): LayoutNode[]`
    — combina `removeNodeAt(fromPath)` seguido de `insertNodeAt` del nodo removido en `(toParentPath, toIndex,
    { tabItemIndex: options?.toTabItemIndex })`, ajustando `toIndex` si `fromPath` y el destino comparten la misma
    colección padre y el índice de origen es menor que `toIndex` (para que el resultado final coloque el nodo
    exactamente en la posición visual pretendida tras el desplazamiento). Lanza si `toParentPath` apunta a un
    descendiente de `fromPath` (evita ciclos) o si `fromPath` no resuelve.
  - Todas las funciones son agnósticas a reglas de negocio (no validan tipos permitidos ni contra el schema): esa
    responsabilidad vive en el pipeline de commit (T4) y en el motor de validez de drop (T13), reutilizando T1.
- **Fuera de alcance**:
  - validación de reglas estructurales antes de aceptar una mutación (T4, T13).
  - integración con `currentConfig` / `editorBuffer` / el bridge de estado (T4).
  - cualquier UI.
- **Dependencias**: T2 (usa `LayoutNodePath`/`getNodeAtPath`).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-tree-mutations.ts` (nuevo)
  - tests:
    - `src/tests/dev-runtime/layout-tree-mutations.test.ts` (nuevo)
  - documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-tree-mutations.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `replaceNodeAt` sobre un nodo de primer nivel y sobre un nodo anidado (`container > form > input`) sustituye
      únicamente el nodo objetivo; el array original pasado como argumento no se modifica (comprobado comparando
      referencia e igualdad profunda antes/después).
    - `insertNodeAt` con `parentPath: []` inserta en la raíz en el índice dado, desplazando los hermanos posteriores.
    - `insertNodeAt` con `parentPath` apuntando a un `container` inserta dentro de `children` de ese container,
      incluso cuando `children` era `undefined` (debe crear el array).
    - `insertNodeAt` con `parentPath` apuntando a un `repeater` inserta dentro de `props.template`.
    - `insertNodeAt` con `parentPath` apuntando a un `tabs` y `options: { tabItemIndex: 1 }` inserta dentro de la
      colección `children` de `items[1]`, sin afectar a los `children` de `items[0]` ni de otros items del mismo
      `tabs`, incluso cuando `items[1].children` era `undefined` (debe crear el array).
    - `insertNodeAt` con `parentPath` apuntando a un `tabs` sin `options.tabItemIndex` lanza un error explícito (el
      destino es ambiguo sin ese dato).
    - `insertNodeAt` con `parentPath` apuntando a un `container` (no `tabs`) y `options: { tabItemIndex: 0 }` lanza
      un error explícito (el parámetro no aplica fuera de `tabs`).
    - `removeNodeAt` sobre un `container` con dos hijos elimina el container y ambos hijos del resultado (ya no
      aparecen en ningún nivel del árbol resultante).
    - `movePathTo` reordena dos hermanos dentro del mismo array padre en ambas direcciones (mover hacia adelante y
      hacia atrás), y el resultado no contiene duplicados ni pierde ningún nodo hermano no afectado.
    - `movePathTo` reanida un nodo desde un `form` hacia otro `form` distinto de la misma página: el nodo desaparece
      del `form` origen y aparece en la posición pedida del `form` destino.
    - `movePathTo` con `toParentPath` igual a un descendiente de `fromPath` (mover un `container` dentro de uno de
      sus propios hijos) lanza un error explícito y no devuelve un árbol parcial.
    - `movePathTo` con `fromPath` igual a `toParentPath` (mover un nodo dentro de sí mismo como su propio hijo)
      lanza el mismo error.
    - Ninguna de las cuatro funciones muta el array de entrada (verificado con snapshot de referencia/contenido
      antes y después de cada llamada).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-tree-mutations.test.ts`
  - **Restricciones**:
    - No importar nada de `src/config/` en este módulo: es agnóstico al contrato de validación (esa frontera se
      cruza en T4/T13, no aquí).
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - Las cuatro funciones existen con la firma descrita, son puras (no mutan entrada) y cubren los casos de ciclo.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-tree-mutations.test.ts` en verde.

---

## T4 — Pipeline de commit del canvas (valida/migra igual que "Aplicar"; parchea `layout` sobre el texto crudo)

- **ID**: T4
- **Estado**: completado
- **Objetivo**: implementar la Decisión 5 de `design.md` (versión revisada tras `review-implementation-plan`: el
  commit del canvas **no** reserializa el `RuntimeConfig` completo — parchea solo la clave `layout` de la página
  activa sobre el último texto crudo válido conocido, con una denormalización acotada para `form.onSuccess`/
  `form.onError`). Concretamente:
  1. Introducir `src/dev-runtime/layout-canvas/layout-canvas-commit.ts` (nuevo) con:
     - `buildCommitCandidateConfig(currentConfig: RuntimeConfig, activePageId: string, mutate: (pageLayout: LayoutNode[]) => LayoutNode[]): RuntimeConfig`
       — igual que antes: localiza la página `activePageId` dentro de `currentConfig.pages`, aplica `mutate` a su
       `layout` y devuelve un `RuntimeConfig` nuevo con esa página sustituida (sin mutar `currentConfig`). Se sigue
       usando únicamente para los pasos de validación/migración en memoria (pasos 2-3 más abajo), nunca para
       serializar a texto.
     - `denormalizeFormNodesForSerialization(nodes: readonly LayoutNode[]): unknown[]` — recorre el árbol
       recursivamente (incluyendo `children` de `container`/`form`/`modal`/`link`/`accordion`, `props.template` de
       `repeater`, y `props.items[].children` de `tabs`) y, para cada nodo `form` que declare `onSuccess` y/o
       `onError` como campos de nivel superior (forma interna de `FormLayoutNode` en `runtime-config-types.ts`),
       produce un objeto plano equivalente con esos dos campos movidos dentro de `submitAction`
       (`{ ...restoDelNodo, submitAction: { ...submitAction, onSuccess, onError }, onSuccess: undefined, onError: undefined }`,
       omitiendo `onSuccess`/`onError` de nivel superior en el resultado) — es la única transformación de
       denormalización necesaria; el resto del catálogo de `layout` son puntos fijos confirmados en `design.md`
       (Contexto) y no requieren tratamiento especial. Un nodo `form` sin `onSuccess`/`onError` se serializa tal
       cual (paso identidad).
     - `patchRawConfigTextWithLayout(rawConfigText: string, activePageId: string, mutatedLayout: readonly LayoutNode[]): string`
       — `JSON.parse(rawConfigText)`, localiza la página con `id === activePageId` dentro de `rawConfigObject.pages`
       y sustituye únicamente su clave `layout` por `denormalizeFormNodesForSerialization(mutatedLayout)`, deja el
       resto del objeto (`api`, `initialPage`, `tokens`, `translations`, `preloads`/`title` de cualquier página,
       incluida la propia página activa) exactamente como estaba en el texto crudo, y devuelve
       `JSON.stringify(rawConfigObject, null, 2)`.
  2. Introducir un nuevo estado `lastValidConfigText: string` en `DevRuntimeReady`
     (`src/dev-runtime/dev-runtime.tsx`), con el invariante "es el texto crudo exacto que, al parsear y validar,
     produce el `currentConfig` vigente". Inicializado a `initialConfigText`. Actualizarlo en los tres puntos donde
     hoy se actualiza `currentConfig` con el mismo valor de texto que ya se acaba de validar en ese punto (no hay
     reserialización nueva en ninguno de estos tres): el efecto de cambio de `initialConfig` (usar el nuevo
     `initialConfigText`), el `import.meta.hot.accept` de HMR (usar el texto del módulo recargado), y `handleApply`
     (usar el `editorBuffer`/texto que se acaba de validar con éxito — el mismo valor que hoy ya deja intacto en
     `editorBuffer`).
     **Precisión sobre el punto de HMR (corrige una ambigüedad detectada en `review-implementation-plan`, sexta
     pasada)**: el código actual de `activeConfigHmrApply` actualiza `currentConfig` de forma **incondicional**
     dentro del `flushSync`, pero solo actualiza `editorBuffer` cuando `!hasPendingChangesRef.current` (para no
     pisar una edición sin aplicar del usuario). Como el invariante de `lastValidConfigText` está atado a
     `currentConfig` (no a `editorBuffer`), su actualización en este punto debe ser también **incondicional**,
     colocada **fuera** del `if (!hasPendingChangesRef.current)` que sigue gobernando solo `editorBuffer` — nunca
     dentro del mismo `if`. Si se actualizara solo condicionalmente, un HMR con cambios pendientes en Monaco
     seguido de una mutación del canvas parchearía el nuevo `layout` sobre un texto crudo pre-HMR obsoleto,
     reintroduciendo exactamente la clase de divergencia raw/normalizado que esta decisión existe para evitar.
  3. Exponer una función `commitCanvasMutation(mutate)` en `DevRuntimeReady` con estos pasos:
     1. construir el config candidato con `buildCommitCandidateConfig(currentConfig, activeCanvasPageId, mutate)`.
     2. validar el candidato con `validateRuntimeConfig` (mismo validador que "Aplicar"; ninguna validación
        paralela). Si no es válido, la mutación se descarta silenciosamente para el llamante (devuelve
        `{status:'rejected'}`) sin tocar ningún estado — el motor de validez de drop (T13) y las reglas de T1 son
        responsables de que esto no ocurra en el flujo normal de drag-and-drop, pero el pipeline de commit es la
        última barrera de seguridad.
     3. si es válido: `migrateRuntimeStateAcrossConfig` + `bridgeRef.current.dispatchAndSyncState` +
        `flushSync(() => setCurrentConfig(...))`, idéntico al bloque ya existente en `handleApply`.
     4. calcular `nextText = patchRawConfigTextWithLayout(lastValidConfigText, activeCanvasPageId, mutatedLayout)`
        (donde `mutatedLayout` es el `layout` ya mutado de la página activa dentro del candidato validado del paso
        1), y dentro del mismo `flushSync` del paso 3: `setEditorBuffer(nextText)`, `setLastValidConfigText(nextText)`,
        `setHasPendingChanges(false)` (el commit del canvas sobrescribe deliberadamente cualquier cambio pendiente
        sin aplicar en Monaco — ver Decisión 5, "Edición concurrente en Monaco"), `setHasAppliedChanges(true)`
        (activa la misma guardia de `beforeunload` que "Aplicar"), y limpiar `parseError`/`validationError` si los
        hubiera.
  `commitCanvasMutation` devuelve `{status:'applied'}` o `{status:'rejected', error: RuntimeConfigError}` para que
  la UI que lo invoque (tareas posteriores) pueda reaccionar si hiciera falta.
- **Fuera de alcance**:
  - cualquier UI que invoque `commitCanvasMutation` (T9, T14, T15, T16).
  - el propio motor de validez de drop de T13 (T4 solo reutiliza `validateRuntimeConfig` como red de seguridad
    final, no sustituye la validación previa de destino).
  - cualquier otra divergencia raw/normalizado fuera de `form.onSuccess`/`form.onError`: la auditoría de
    `design.md` (Contexto) confirma que es la única dentro de `layout`; si una feature futura introduce una nueva,
    `denormalizeFormNodesForSerialization` necesitará ampliarse — riesgo ya documentado en `design.md` (Riesgos),
    no responsabilidad de esta tarea.
- **Dependencias**: T1 (dependencia documental de orden, igual que antes), T3 (las funciones de mutación son las
  que se pasarán como `mutate`).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-commit.ts` (nuevo)
    - `src/dev-runtime/dev-runtime.tsx` (modificar: añadir `lastValidConfigText` y `commitCanvasMutation` en
      `DevRuntimeReady`, y actualizar `lastValidConfigText` en los tres puntos existentes de commit de
      `currentConfig`)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (nuevo)
  - documentación: ninguna en esta tarea (sin UI todavía que lo dispare).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - `buildCommitCandidateConfig` sustituye únicamente el `layout` de la página indicada por `activePageId`,
      dejando el resto de `pages`, `api`, `initialPage`, `translations` y `tokens` intactos, sin mutar el
      `currentConfig` recibido (verificado por referencia/contenido).
    - `denormalizeFormNodesForSerialization` sobre un árbol con un `form` cuyo `onSuccess`/`onError` están
      declarados como campos de nivel superior (forma interna) produce un nodo equivalente con esos campos anidados
      dentro de `submitAction`, sin campos `onSuccess`/`onError` de nivel superior en el resultado.
    - `denormalizeFormNodesForSerialization` sobre un `form` sin `onSuccess`/`onError` lo deja sin cambios
      observables (paso identidad).
    - `denormalizeFormNodesForSerialization` aplica la misma transformación a un `form` anidado dentro de un
      `container`, directamente dentro de los `children` de un `modal`, dentro de `props.template` de un
      `repeater`, y dentro de `props.items[].children` de un `tabs`.
    - `patchRawConfigTextWithLayout` sobre un texto crudo cuya página activa declara `preloads` en forma cruda
      (`[{ "loadUsers": {} }]`) produce un texto donde `preloads` sigue exactamente en esa misma forma cruda tras el
      parcheo (no se toca), mientras que `layout` refleja el nuevo árbol mutado.
    - `patchRawConfigTextWithLayout` no modifica ninguna otra página del documento ni los bloques `api`/`tokens`/
      `translations`/`initialPage`.
    - Montando `DevRuntimeReady` con un config de prueba cuya página activa declara `preloads`: invocar
      `commitCanvasMutation` con una mutación que produce un `layout` válido actualiza `currentConfig` (verificable
      porque el runtime re-renderiza con el nuevo árbol), actualiza `editorBuffer` con el texto parcheado (no con un
      `JSON.stringify` del `RuntimeConfig` normalizado completo), y ese `editorBuffer` resultante sigue validando
      correctamente con `validateRuntimeConfig` tras un `JSON.parse` (regresión explícita del hallazgo original:
      `preloads` no se rompe).
    - Montando `DevRuntimeReady` con un config de prueba cuya página activa contiene un `form` con `onSuccess`/
      `onError` fuera del subárbol mutado por el canvas: invocar `commitCanvasMutation` con una mutación que no
      toca ese `form` produce un `editorBuffer` donde ese `form` conserva `onSuccess`/`onError` correctamente
      anidados dentro de `submitAction` (no se pierden por el parcheo de otra parte del árbol, porque
      `denormalizeFormNodesForSerialization` se aplica al árbol `layout` completo de la página, no solo al
      subárbol tocado).
    - Invocar `commitCanvasMutation` con una mutación que produce un `layout` inválido (por ejemplo un `input` fuera
      de un `form`) no cambia `currentConfig`, `editorBuffer` ni `lastValidConfigText`, y devuelve
      `{status:'rejected', error}`.
    - Con `hasPendingChanges: true` (el usuario tiene texto sin aplicar en Monaco): invocar `commitCanvasMutation`
      con una mutación válida sobrescribe `editorBuffer` con el texto parcheado y deja `hasPendingChanges: false`
      (comportamiento deliberado de Decisión 5, distinto del de HMR).
    - Con `hasPendingChanges: true` en el momento de un HMR válido (simulando `activeConfigHmrApply` con un nuevo
      config): `lastValidConfigText` se actualiza al texto del módulo recargado aunque `editorBuffer` conserve el
      texto pendiente sin cambios (regresión del comportamiento actual de HMR sobre `editorBuffer`, y verificación
      explícita de que `lastValidConfigText` no queda atado a esa misma condición). Un `commitCanvasMutation`
      posterior en ese estado produce un `editorBuffer` parcheado sobre el `lastValidConfigText` ya actualizado
      (post-HMR), no sobre el texto pre-HMR obsoleto — este es el caso concreto que motiva la precisión del
      objetivo sobre el punto de HMR.
    - Tras un commit exitoso desde el canvas, el estado de formularios/queries/navegación se preserva según la misma
      semántica que ya cubre `dev-runtime-state-migration.test.ts` para "Aplicar" (reutiliza el mismo mecanismo, no
      se duplican aquí todos los casos de migración; un test de humo verificando que se invoca
      `migrateRuntimeStateAcrossConfig` con los argumentos esperados es suficiente).
    - Tras un commit exitoso desde el canvas, la guardia de cambios aplicados (`beforeunload`) se activa igual que
      con "Aplicar" (reutiliza `hasAppliedChanges`; un test verifica que pasa a `true`).
    - Tras un "Aplicar" manual exitoso en Monaco, `lastValidConfigText` queda igual al texto que se acaba de
      aplicar (regresión: verifica que el nuevo estado se mantiene sincronizado en el punto de commit ya existente).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-commit.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx` (regresión: "Aplicar" manual no debe cambiar de
      comportamiento)
  - **Restricciones**:
    - No introducir un segundo mecanismo de migración de estado: `commitCanvasMutation` debe llamar exactamente a
      `migrateRuntimeStateAcrossConfig` con la misma forma de argumentos que `handleApply`.
    - No reserializar `currentConfig` ni el candidato validado a texto en ningún punto de esta tarea; el único
      texto que se escribe en `editorBuffer` proviene de `patchRawConfigTextWithLayout` sobre `lastValidConfigText`.
    - Reusar el harness de montaje de `DevRuntimeReady` ya presente en `dev-runtime.test.tsx` si existe uno
      reutilizable; si no, seguir su mismo patrón de configuración de props/mocks.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - `commitCanvasMutation` valida y migra estado igual que "Aplicar", y actualiza el texto de Monaco parcheando
    solo `layout` sobre el último texto crudo válido, preservando `preloads` en forma cruda y `form.onSuccess`/
    `form.onError` correctamente anidados en cualquier parte del árbol no tocada por la mutación.
  - "Aplicar" manual (Monaco) sigue funcionando exactamente igual (regresión en verde).
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-commit.test.tsx` y
  `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx` en verde.

---

## T5 — Shell del canvas: pestañas Visual/JSON, selector de página, selección y hover

- **ID**: T5
- **Estado**: completado
- **Objetivo**: dar forma al FR1, FR2 y FR3 de la spec:
  1. Modificar `src/dev-runtime/dev-runtime-drawer.tsx` para añadir un selector de pestañas (`Visual` / `JSON`) en la
     cabecera del drawer, con una prop controlada `activeTab: 'visual' | 'json'` y `onTabChange`. El slot de
     children existente pasa a renderizarse solo cuando `activeTab === 'json'`; se añade un nuevo slot
     `visualContent: ReactNode` que se renderiza solo cuando `activeTab === 'visual'`. El panel de errores y la barra
     de acciones (Copiar/Aplicar) permanecen visibles en ambas pestañas sin cambios.
  2. Introducir `src/dev-runtime/layout-canvas/layout-canvas.tsx` (nuevo): componente `LayoutCanvas` que recibe
     `config: RuntimeConfig`, `activePageId: string`, `onActivePageIdChange: (id: string) => void`, y renderiza:
     - un selector de página (`<select>` con las `id` de `config.pages`) que invoca `onActivePageIdChange`.
     - `selectedPath`/`hoveredPath` como estado local (`useState<LayoutNodePath | null>`).
     - `<LayoutEditModeProvider value={{ selectedPath, hoveredPath, onSelectNode: setSelectedPath, onHoverNode: setHoveredPath }}>`
       envolviendo `<RuntimeStateProvider config={config} ...><LayoutRenderer nodes={activePage.layout} /></RuntimeStateProvider>`
       — el canvas monta su propia instancia aislada de `RuntimeStateProvider` (no comparte estado de navegación con
       el runtime de preview de fondo) para poder editar cualquier página sin depender de a qué página haya navegado
       el runtime de producción visible detrás del drawer.
  3. `useEffect` que limpia `selectedPath`/`hoveredPath` (a `null`) cuando cambia `activePageId` (caso límite de la
     spec: cambiar de página con un nodo seleccionado limpia la selección).
  4. `useEffect` que, tras cada cambio de `config` (por ejemplo tras un "Aplicar" exitoso desde Monaco), comprueba con
     `getNodeAtPath` si `selectedPath` sigue resolviendo sobre `activePage.layout`; si no resuelve, limpia
     `selectedPath` a `null` (caso límite de la spec: eliminar desde Monaco el nodo seleccionado en el canvas
     degrada la selección de forma segura).
  5. Wiring en `DevRuntimeReady` (`src/dev-runtime/dev-runtime.tsx`): estado `activeTab` y `activeCanvasPageId`
     (inicializado a `currentConfig.pages[0].id`), pasados a `DevRuntimeDrawer` y `LayoutCanvas` respectivamente.
- **Fuera de alcance**:
  - breadcrumb (T6), formulario de propiedades (T7–T9), placeholders vacíos (T10), `repeater` en modo edición (T11),
    drag-and-drop (T12–T15), borrado (T16).
  - persistir la pestaña activa o la página activa del canvas entre sesiones (no forma parte de la spec).
- **Dependencias**: T2 (contexto y wrapper de selección/hover).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/dev-runtime-drawer.tsx` (modificar: pestañas Visual/JSON)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (nuevo)
    - `src/dev-runtime/dev-runtime.tsx` (modificar: wiring de `activeTab`/`activeCanvasPageId`/`LayoutCanvas`)
  - tests:
    - `src/tests/dev-runtime/dev-runtime-drawer.test.tsx` (ampliación: pestañas)
    - `src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva sección: pestañas
    Visual/JSON, selector de página del canvas).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-runtime-drawer.test.tsx` (ampliación)
    - `src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - El drawer muestra dos pestañas; por defecto la pestaña `JSON` está activa (preserva el comportamiento actual
      de apertura del drawer sin cambios visibles de golpe).
    - Cambiar a la pestaña `Visual` oculta el editor Monaco y muestra `visualContent`; el panel de errores y la
      barra Copiar/Aplicar siguen visibles.
    - Volver a la pestaña `JSON` restaura Monaco con el mismo `editorBuffer` (no se pierde el texto en curso).
    - `LayoutCanvas` con una config de dos páginas muestra un selector con ambos `id`; cambiar el selector invoca
      `onActivePageIdChange` con el `id` correcto.
    - `LayoutCanvas` renderiza el `layout` de `activePageId`, no el de otra página.
    - Click sobre un nodo del canvas actualiza la selección interna (verificable por la clase de selección aplicada,
      reusando el mecanismo de T2).
    - Cambiar `activePageId` mientras hay un nodo seleccionado limpia la selección (ya no hay ningún nodo con la
      clase de selección tras el cambio).
    - Tras cambiar `config` (simulando una nueva referencia de config, como ocurriría tras "Aplicar" en Monaco) de
      forma que el nodo antes seleccionado ya no exista en `activePage.layout`, la selección se limpia sin lanzar
      ningún error.
    - Tras cambiar `config` de forma que el nodo antes seleccionado siga existiendo en la misma posición, la
      selección se conserva (no se limpia innecesariamente).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-runtime-drawer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx`
  - **Restricciones**:
    - El canvas monta su propia instancia de `RuntimeStateProvider`; no debe leer ni escribir el estado del
      `RuntimeStateProvider` de fondo que usa el preview del runtime detrás del drawer.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: documentar las pestañas Visual/JSON y el
    selector de página del canvas (referencia; la actualización real se hace en un pase de
    `update-app-documentation` posterior).
- **Criterios de finalización**:
  - El drawer alterna correctamente entre Visual y JSON sin perder el estado de ninguna de las dos vistas.
  - El canvas muestra y permite seleccionar nodos de la página activa, con los dos casos límite de limpieza de
    selección cubiertos.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/dev-runtime-drawer.test.tsx` y
  `pnpm test --run src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx` en verde.

---

## T6 — Breadcrumb de ancestros

- **ID**: T6
- **Estado**: completado
- **Objetivo**: implementar el FR4 de la spec. Crear `src/dev-runtime/layout-canvas/layout-canvas-breadcrumb.tsx`
  (nuevo): componente `LayoutCanvasBreadcrumb` que recibe `pageLayout: readonly LayoutNode[]`,
  `selectedPath: LayoutNodePath | null`, `onSelectNode: (path: LayoutNodePath) => void`, y:
  - si `selectedPath` es `null`, no renderiza nada (o un estado vacío mínimo).
  - si no, calcula la cadena de ancestros recorriendo `pageLayout` con cada prefijo de `selectedPath` (usando
    `getNodeAtPath` de `layout-node-path.ts` sobre cada prefijo, desde `[]` hasta `selectedPath` completo), y
    renderiza un elemento clicable por cada nivel con una etiqueta legible (`node.type`, o `node.id` si existe, por
    ejemplo `"container"` o `"form (checkout)"`), separados visualmente (por ejemplo con `>`).
  - click sobre cualquier segmento (excepto el último, que representa el nodo ya seleccionado) invoca
    `onSelectNode` con el path de ese ancestro.
  Integrar `LayoutCanvasBreadcrumb` dentro de `LayoutCanvas` (T5), mostrado por encima del árbol renderizado,
  alimentado por el `selectedPath`/`onSelectNode` ya existentes en el estado del canvas.
- **Fuera de alcance**:
  - formulario de propiedades (T7–T9).
  - estilos visuales más allá de la separación legible entre niveles (Tailwind básico, sin diseño elaborado).
- **Dependencias**: T5.
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-breadcrumb.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (modificar: integrar el breadcrumb)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: breadcrumb de
    ancestros).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Con `selectedPath: null`, el componente no renderiza ningún segmento.
    - Seleccionar un `heading` anidado en `container > form` produce exactamente 3 segmentos en orden
      (`container`, `form`, `heading`), replicando el criterio de aceptación de la spec.
    - Click en el segmento `container` (no el último) invoca `onSelectNode` con el path del `container`, no con el
      del `form` ni el del `heading`.
    - El último segmento (el nodo ya seleccionado) no dispara `onSelectNode` al clicarlo (o, si lo hace, es un no-op
      equivalente porque ya está seleccionado — se acepta cualquiera de las dos siempre que no cambie el
      comportamiento observable de selección).
    - Un nodo con `id` declarado muestra el `id` en su etiqueta; un nodo sin `id` muestra solo `type`.
    - Integración en `LayoutCanvas`: seleccionar un nodo en el canvas actualiza el breadcrumb mostrado; clicar un
      segmento del breadcrumb cambia la selección del canvas al nodo ancestro correspondiente (verificable por la
      clase de selección de T2 aplicada al ancestro).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx`
  - **Restricciones**: ninguna específica más allá de las globales.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - El breadcrumb refleja fielmente la cadena de ancestros y permite navegar la selección hacia arriba.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` en verde.

---

## T7 — Derivación de JSON Schema por tipo de nodo

- **ID**: T7
- **Estado**: completado
- **Objetivo**: implementar la parte de esquema de la Decisión 8 de `design.md`. Crear
  `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` (nuevo) con:
  - un mapa interno `type -> ZodType` que referencia directamente los schemas individuales ya exportados de
    `src/config/runtime-config-zod.ts` (`containerNodeSchema`, `buttonNodeSchema`, `inputNodeSchema`, etc., una
    entrada por cada uno de los tipos en `supportedNodeTypes`).
  - `export function getNodeTypeJsonSchema(type: LayoutNodeType): Record<string, unknown>` que, con cache en memoria
    por `type` (mismo patrón de `cachedSchema` que ya usa `dev-runtime-json-schema.ts`), invoca `toJSONSchema` (la
    misma API de Zod v4 ya usada para el autocompletado de Monaco, sin librería externa nueva) sobre el schema
    individual correspondiente y devuelve el resultado.
  - `export function getSupportedNodeTypesCatalog(): LayoutNodeType[]` que devuelve `supportedNodeTypes` tal cual
    (reexportado, no reinventado), para que la paleta de nodos (T15) tenga una única fuente del catálogo completo.
- **Fuera de alcance**:
  - el dispatcher de campos que consume este JSON Schema (T8).
  - cualquier UI.
- **Dependencias**: ninguna (usa exports ya existentes de `runtime-config-zod.ts`).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` (nuevo)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (nuevo)
  - documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `getNodeTypeJsonSchema('container')` devuelve un objeto JSON Schema con una propiedad `props` que refleja
      `direction`/`gap`/`columns`/`variant`/`align`/`justify`/`wrap` según `containerNodeSchema`.
    - `getNodeTypeJsonSchema('button')` refleja el contrato de `buttonNodeSchema` (incluyendo la unión de acciones).
    - Dos llamadas consecutivas a `getNodeTypeJsonSchema('container')` devuelven el mismo objeto por referencia
      (verifica el cache, mismo patrón que `dev-runtime-json-schema.test.ts` ya verifica para el schema raíz).
    - `getSupportedNodeTypesCatalog()` incluye los ~26 tipos del catálogo (mismo conteo que ya verifica
      `runtime-node-components-map.test.tsx` para `NodeComponents`, evitando que ambos catálogos diverjan).
    - `getNodeTypeJsonSchema` invocado para cada tipo del catálogo completo no lanza ninguna excepción (test
      parametrizado sobre `getSupportedNodeTypesCatalog()`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
  - **Restricciones**:
    - No introducir `zod-to-json-schema`: usar exclusivamente `toJSONSchema` de `zod`, igual que
      `dev-runtime-json-schema.ts`.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - `getNodeTypeJsonSchema` funciona para el catálogo completo sin excepciones, con cache verificado.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts` en verde.

---

## T8 — Dispatcher genérico de campos de propiedades

- **ID**: T8
- **Estado**: completado
- **Objetivo**: implementar la parte de renderizado de la Decisión 8 de `design.md`, de forma agnóstica a nodos
  concretos (opera sobre cualquier fragmento de JSON Schema + valor actual, sin conocer `LayoutNode`). Crear
  `src/dev-runtime/layout-canvas/property-fields/` (nuevo directorio) con:
  - `property-field-dispatcher.tsx`: componente `PropertyFieldDispatcher` que recibe `schema: Record<string, unknown>`
    (un fragmento JSON Schema, por ejemplo la sub-propiedad de un `properties.props`), `value: unknown`,
    `onChange: (value: unknown) => void`, `label: string`, y despacha por `schema.type`/`schema.enum` al componente
    de campo correspondiente:
    - `string` sin `enum`: campo de texto (`<input type="text">`).
    - `number`: campo numérico (`<input type="number">`).
    - `boolean`: checkbox.
    - `string`/`number` con `enum`: `<select>` con las opciones de `schema.enum`.
    - `array`: sección repetible que renderiza `PropertyFieldDispatcher` recursivamente para cada elemento según
      `schema.items`, con botones para añadir/quitar entradas.
    - `object`: sección que renderiza `PropertyFieldDispatcher` recursivamente para cada propiedad de
      `schema.properties`, respetando `schema.required` para marcar campos obligatorios visualmente (sin bloquear
      el guardado; la validación real la hace `validateRuntimeConfig` en el commit).
    - cualquier otro caso (`schema` ausente, unión no soportada, etc.): campo de texto JSON crudo como vía de escape
      (textarea con el valor serializado, deshabilitado si no es editable de forma segura como string), documentando
      que sigue siendo editable desde Monaco si el formulario no lo cubre bien.
  - Los componentes de campo primitivos (texto, numérico, checkbox, select) en ficheros propios dentro del mismo
    directorio (`text-property-field.tsx`, `number-property-field.tsx`, `boolean-property-field.tsx`,
    `enum-property-field.tsx`), cada uno con `className` de Tailwind consistente con `conventions.md` (sin estilos
    inline).
- **Fuera de alcance**:
  - conexión con nodos concretos del `layout` o con el commit del canvas (T9).
  - pickers contextuales para referencias string (fuera de alcance de la spec completa).
- **Dependencias**: T7 (consumirá los fragmentos de JSON Schema que produce, aunque el dispatcher en sí es
  agnóstico y se puede testear con schemas sintéticos).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/property-fields/text-property-field.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/property-fields/number-property-field.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/property-fields/boolean-property-field.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/property-fields/enum-property-field.tsx` (nuevo)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (nuevo)
  - documentación: ninguna en esta tarea.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Schema `{type:'string'}` renderiza un input de texto; escribir en él invoca `onChange` con el nuevo string.
    - Schema `{type:'number'}` renderiza un input numérico; escribir invoca `onChange` con un número (no un string).
    - Schema `{type:'boolean'}` renderiza un checkbox; clicarlo invoca `onChange` con el boolean invertido.
    - Schema `{type:'string', enum:['a','b','c']}` renderiza un `<select>` con esas tres opciones; seleccionar `'b'`
      invoca `onChange('b')`.
    - Schema `{type:'array', items:{type:'string'}}` con valor `['x','y']` renderiza dos campos de texto; añadir una
      entrada invoca `onChange` con un array de tres elementos (el tercero con un valor por defecto razonable, por
      ejemplo `''`); quitar la primera invoca `onChange` con `['y']`.
    - Schema `{type:'object', properties:{a:{type:'string'}, b:{type:'number'}}}` con valor `{a:'x', b:1}` renderiza
      dos campos (uno de texto, uno numérico) con sus valores actuales; cambiar `a` invoca `onChange` con
      `{a:'nuevo', b:1}` (preserva `b`).
    - Un array anidado dentro de un objeto (por ejemplo emulando `table.props.columns`) se renderiza recursivamente
      sin errores y permite editar un campo de un elemento interno sin afectar a los demás.
    - Un schema sin `type` reconocible cae en el campo de vía de escape (texto/JSON crudo) sin lanzar ninguna
      excepción.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
  - **Restricciones**:
    - No introducir `react-jsonschema-form`/`@rjsf/core` ni ninguna librería de formularios externa (Decisión 8 de
      `design.md`, alternativa descartada explícitamente).
    - Todos los componentes de campo usan `className` con utilidades de Tailwind; ningún `style` inline.
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - El dispatcher cubre las seis primitivas (`string`, `number`, `boolean`, `enum`, `array`, `object`) y la vía de
    escape, de forma recursiva y sin librería externa.
  - Tests en verde.
- **Cierre de implementación**:
  `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` en verde.

---

## T9 — Panel de propiedades del nodo seleccionado

- **ID**: T9
- **Estado**: completado
- **Objetivo**: implementar el FR5 y el criterio de aceptación de sincronización inmediata canvas→Monaco. Crear
  `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (nuevo): componente
  `LayoutCanvasPropertiesPanel` que recibe `node: LayoutNode`, `path: LayoutNodePath`,
  `onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void`, y:
  - obtiene `getNodeTypeJsonSchema(node.type)` (T7) y localiza dentro de él las subsecciones `properties.props`,
    `properties.layout`, `properties.visibility` y `properties.queryStateFeedback` (las que existan para ese tipo;
    no todos los tipos declaran las cuatro).
  - renderiza, para cada subsección presente, un bloque encabezado con su nombre y un `PropertyFieldDispatcher` (T8)
    por cada propiedad de esa subsección, alimentado con el valor actual leído de `node` y con `onChange` que llama
    a `onCommitNodeUpdate(path, (nodoActual) => ({ ...nodoActual, [subseccion]: { ...nodoActual[subseccion], [campo]: nuevoValor } }))`.
  - el campo `layout.span`, cuando su valor actual es un mapa responsive por breakpoint (no un entero), se edita
    preservando las claves de breakpoint no visibles en el viewport actual del canvas: el `updater` debe hacer merge
    superficial sobre el objeto `span` existente, nunca sustituirlo entero, de forma que editar (por ejemplo) el
    breakpoint `md` no borre `lg`/`xl` si estaban declarados (cubre el caso límite de la spec).
  - Integrar `LayoutCanvasPropertiesPanel` en `LayoutCanvas` (T5): visible cuando `selectedPath !== null`, resolviendo
    `node` con `getNodeAtPath(activePage.layout, selectedPath)`, y `onCommitNodeUpdate` delegando en
    `commitCanvasMutation` (T4) con una mutación construida sobre `replaceNodeAt` (T3) para ese `path`.
- **Fuera de alcance**:
  - drag-and-drop (T12–T15), borrado (T16).
  - pickers contextuales para referencias string (fuera de alcance de la spec).
- **Dependencias**: T5 (selección activa), T4 (commit), T8 (dispatcher de campos). T7 se usa transitivamente vía T8.
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (modificar: integrar el panel)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: formulario de
    propiedades).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Seleccionar un `heading` muestra un campo editable para `props.text` (o el campo correspondiente según su
      schema) y no muestra secciones de `props` que ese tipo no declare.
    - Cambiar el valor de un campo de texto de `props` en el panel invoca `onCommitNodeUpdate` con un `updater` que,
      aplicado al nodo, produce el nuevo valor en la propiedad correcta sin alterar el resto de `props`.
    - Editar `visibility` de un nodo que la admite actualiza únicamente `node.visibility`, dejando `props` intacto.
    - Un `container` con `layout.span = { sm: 6, lg: 4 }`: editar solo el valor de `sm` desde el panel produce un
      `node.layout.span` resultante que conserva `lg: 4` (no lo pierde), cubriendo explícitamente el caso límite de
      la spec.
    - Integración end-to-end con `LayoutCanvas` + `commitCanvasMutation`: cambiar un campo de texto en el panel
      actualiza `editorBuffer` (visible al cambiar a la pestaña JSON) sin pulsar ningún botón adicional, replicando
      el criterio de aceptación de la spec.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - **Restricciones**:
    - No introducir un segundo contrato de props derivado a mano: todas las propiedades editables deben provenir de
      `getNodeTypeJsonSchema` (T7), no de una lista propia hardcodeada por tipo.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - El panel de propiedades edita `props`, `layout`, `visibility` y `queryStateFeedback` según lo que admita cada
    tipo, con sincronización inmediata a Monaco vía el pipeline de commit.
  - El caso límite de `layout.span` responsive está cubierto.
  - Tests en verde.
- **Cierre de implementación**:
  `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` en verde.

---

## T10 — Placeholder de contenedores/forms vacíos en modo edición

- **ID**: T10
- **Estado**: completado
- **Objetivo**: implementar el FR10 (Decisión 9 de `design.md`). Modificar `src/runtime/layout-renderer.tsx` para
  que, al calcular `renderedChildren` para un nodo `container` o `form` cuyo `children` es `undefined` o `[]`, y
  cuando `useLayoutEditModeContext()` no es `null`, renderice un elemento placeholder (`data-empty-placeholder`,
  borde punteado vía Tailwind, etiqueta breve como "Contenedor vacío" / "Formulario vacío") en vez de nada. Cuando el
  contexto es `null` (producción y cualquier render sin `LayoutEditModeProvider`), el comportamiento es exactamente
  el actual: `renderedChildren` es `undefined`/vacío y no se renderiza nada. El placeholder debe:
  - recibir el mismo tratamiento de `data-node-path`/`onClick`/hover que cualquier otro nodo vía el wrapper de T2
    (es decir, el propio `container`/`form` vacío sigue siendo seleccionable con su placeholder visible dentro).
  - quedar preparado como destino droppable para T12/T13 (un `data-node-path` propio y distinguible del nodo
    contenedor, para que el motor de drop de T13 lo reconozca como "insertar como primer hijo").
- **Fuera de alcance**:
  - la propia mecánica de drag-and-drop (T12–T15): esta tarea solo deja el placeholder renderizado y direccionable;
    no lo hace todavía droppable de forma funcional.
- **Dependencias**: T2 (wrapper y contexto), T5 (para verificar la integración visual dentro del canvas montado).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-renderer.tsx` (modificar)
  - tests:
    - `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: placeholders de
    contenedores vacíos).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Un `container` con `children: []` renderizado sin `LayoutEditModeProvider` no produce ningún elemento visible
      (regresión del comportamiento actual de producción).
    - El mismo `container` renderizado con `LayoutEditModeProvider` produce un elemento con
      `data-empty-placeholder` y una etiqueta visible.
    - Un `form` sin `children` se comporta igual que el `container` (placeholder propio con etiqueta distinta).
    - Un `container` con `children` no vacío nunca muestra el placeholder, con o sin contexto.
    - El placeholder tiene su propio `data-node-path` (distinto del `data-node-path` del `container`/`form` que lo
      contiene) y responde a click seleccionándose a sí mismo (mismo mecanismo de T2).
    - El mismo `layout` renderizado como preview de producción (sin proveedor) para un `container` vacío insertado
      no muestra ningún rastro visual, replicando el criterio de aceptación de la spec.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (regresión: `layout: []`
      sigue sin renderizar nada en producción)
  - **Restricciones**:
    - El placeholder debe vivir enteramente dentro de la rama condicional al contexto; no debe existir ninguna rama
      de código nueva alcanzable cuando el contexto está ausente (mitigación explícita de la Decisión 9 de
      `design.md`).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - Placeholders visibles y seleccionables en modo edición para `container`/`form` vacíos, sin ningún rastro en
    producción.
  - Tests en verde.
- **Cierre de implementación**:
  `pnpm test --run src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` y
  `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` en verde.

---

## T11 — Nodos con render anidado propio en modo edición: `repeater`, `accordion`, `tabs`, `modal`

- **ID**: T11
- **Estado**: completado
- **Objetivo**: implementar el FR11 de la spec (Decisión 10 de `design.md`, `repeater`) y cerrar dos huecos
  detectados por `review-implementation-plan` sobre esta misma planificación: `accordion-layout-node.tsx` y
  `tabs-layout-node.tsx` invocan `<LayoutRenderer>` desde dentro de su propio componente (igual que `repeater`),
  sin pasar por la recursión de nivel superior de `layout-renderer.tsx` que ya threadea `path` (T2) — así que, sin
  esta tarea, cualquier nodo dentro de un `accordion` o de la pestaña activa de un `tabs` recibiría un `path`
  incorrecto, y una mutación del canvas (T3) podría aplicarse sobre un nodo distinto del seleccionado. Además,
  `accordion` (colapsado por defecto, `defaultOpen: false`) y `modal` (cerrado por defecto, `open` controlado por
  estado de runtime) no renderizan su contenido en absoluto cuando están cerrados/colapsados — igual que un
  `repeater` con colección vacía no rendería nada sin el tratamiento de la Decisión 10 — dejando su contenido
  inseleccionable, no editable y no droppable en el canvas si no se fuerza su visibilidad en modo edición. `tabs` no
  tiene este problema de visibilidad (el usuario ya puede clicar la cabecera de cada pestaña para ver y editar su
  contenido; ningún panel queda permanentemente oculto sin interacción), así que para `tabs` esta tarea solo cubre
  el path threading, no un forzado de visibilidad.
  0. **`src/runtime/layout-node-renderer.tsx`** (corrige un hueco detectado en `review-implementation-plan`,
     séptima pasada): hoy el `switch (node.type)` invoca `<RepeaterNode node={node} />`,
     `<AccordionNode node={node} iterationContext={...} />` y `<TabsNode node={node} iterationContext={...} />`
     sin pasarles ningún `path`, aunque `LayoutNodeRenderer` ya recibe su propio `path` como prop desde T2. Añadir
     `path={path}` a los tres casos del switch (`repeater`, `accordion`, `tabs`), y añadir la prop opcional
     `path?: LayoutNodePath` a `RepeaterNodeProps`, `AccordionNodeProps` y `TabsNodeProps` (hoy ninguna de las tres
     la declara), para que cada componente reciba el path de sí mismo y pueda usarlo como base al invocar su propio
     `<LayoutRenderer>` interno con el `buildChildPath` correspondiente (puntos 1-3 más abajo). Este cambio es
     inerte cuando `path` es `undefined` (producción, y cualquier render sin `LayoutEditModeProvider`): los tres
     componentes solo lo usan dentro de la rama condicionada a `useLayoutEditModeContext()` de los puntos 1-3.
  1. **`src/runtime/nodes/repeater-layout-node.tsx`** (como ya preveía el plan original): cuando
     `useLayoutEditModeContext()` no es `null`, `RepeaterNode` omite por completo la resolución de la colección real
     (`resolveRepeaterSourceItems`/`resolveRepeaterIterations`/paginación) y renderiza `LayoutRenderer` exactamente
     una vez sobre `node.props.template`, con un `iterationContext` sintético (`item`: el primer elemento real si la
     colección resuelta tiene datos, o `{}` si está vacía — limitación conocida y aceptada por `design.md`: el
     template no podrá previsualizar interpolaciones `item.*` en ese caso; `key`: un valor sintético estable como
     `'__edit-mode-instance__'`; `itemIndex`: `0`), y pasando a ese `LayoutRenderer` el `path` del propio `repeater`
     extendido con `{field:'template', index}` por cada hijo. Cuando el contexto es `null`, el comportamiento es
     exactamente el actual (sin cambios en la resolución de colección ni en paginación).
  2. **`src/runtime/nodes/accordion-layout-node.tsx`**: cuando `useLayoutEditModeContext()` no es `null`,
     `AccordionNode` ignora `isOpen`/`isClosing` para decidir si renderiza el cuerpo (`showContent` se fuerza a
     `true`) — el cuerpo y sus `children` siempre están presentes en el DOM en modo edición, con independencia de
     `defaultOpen` o de si el usuario ha clicado la cabecera. El encabezado (`handleToggle`, `aria-expanded`) sigue
     funcionando igual (no se desactiva el toggle, solo deja de condicionar la presencia del contenido). Cuando el
     contexto es `null`, el comportamiento es exactamente el actual. Además, el `LayoutRenderer` interno para
     `node.children` recibe el `path` del propio `accordion` extendido con `{field:'children', index}` por cada
     hijo (mismo paso que usan `container`/`form`, ya que la colección de `accordion` cuelga igual de
     `node.children`).
  3. **`src/runtime/nodes/tabs-layout-node.tsx`**: sin cambio de visibilidad (el usuario cambia de pestaña con la
     cabecera ya interactiva, que sigue funcionando igual con o sin contexto). Único cambio: el `LayoutRenderer`
     interno para `activeItem.children` recibe el `path` del propio `tabs` extendido con
     `{field:'tabItem', itemIndex: effectiveActiveTab, index}` por cada hijo.
  4. **`src/runtime/nodes/modal-layout-node.tsx`**: cuando `useLayoutEditModeContext()` no es `null`, `ModalNode`
     ignora el resultado de `isModalOpen`/`open` para decidir si renderiza (`if (!open) return null` deja de
     aplicarse; el panel y sus `children` siempre están presentes en el DOM en modo edición, con independencia de
     `defaultOpen` o de si se ha disparado `openModal`/`closeModal`). El resto de comportamiento (foco, `Escape`,
     overlay) puede desactivarse en modo edición si simplifica la implementación, ya que no es relevante para
     edición de propiedades/estructura (el criterio de aceptación es únicamente que `children` esté presente,
     seleccionable y editable). Cuando el contexto es `null`, el comportamiento es exactamente el actual. `modal`
     no necesita cambio de path threading: sus `children` ya se calculan en la recursión de nivel superior de
     `layout-renderer.tsx` (cubierta por T2), porque `hasChildren()` en ese fichero ya incluye `'modal'`.
- **Fuera de alcance**:
  - drag-and-drop dentro de cualquiera de estos cuatro nodos (T12–T15): esta tarea solo deja el contenido
    renderizado, direccionable y (donde aplica) forzado a visible.
  - cualquier cambio en el comportamiento de paginación/colección de `repeater`, de agrupación (`groupId`) de
    `accordion`, de navegación entre pestañas de `tabs`, o de foco/teclado/overlay de `modal` **en producción**
    (contexto ausente).
  - permitir seleccionar/editar más de una pestaña de `tabs` a la vez (queda fuera; el usuario cambia de pestaña
    para editar cada una, comportamiento ya nativo del componente).
- **Dependencias**: T2 (contexto y modelo de `path`, incluyendo el paso `tabItem`), T5 (integración visual en el
  canvas montado).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-node-renderer.tsx` (modificar: pasar `path` a los casos `repeater`/`accordion`/`tabs`
      del switch, punto 0)
    - `src/runtime/nodes/repeater-layout-node.tsx` (modificar)
    - `src/runtime/nodes/accordion-layout-node.tsx` (modificar)
    - `src/runtime/nodes/tabs-layout-node.tsx` (modificar)
    - `src/runtime/nodes/modal-layout-node.tsx` (modificar)
  - tests:
    - `src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-accordion-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-modal-edit-mode.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: comportamiento de
    `repeater`/`accordion`/`tabs`/`modal` en modo edición).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-accordion-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx` (nuevo)
    - `src/tests/layout-renderer/layout-renderer-modal-edit-mode.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Un `repeater` con una colección resuelta de 5 elementos, renderizado sin `LayoutEditModeProvider`, sigue
      mostrando las 5 iteraciones (regresión: sin cambios en producción).
    - El mismo `repeater` renderizado con `LayoutEditModeProvider` muestra exactamente una instancia del `template`.
    - Un `repeater` cuya colección resuelta está vacía sigue mostrando, en modo edición, exactamente una instancia
      editable del `template` (no `null`/nada), replicando el criterio de aceptación de la spec.
    - Dentro de esa única instancia, un nodo del `template` es seleccionable (mismo mecanismo de T2) con un
      `data-node-path` que incluye un tramo `template`.
    - Ningún control de paginación se renderiza en modo edición del `repeater`, con independencia de si declara
      `props.pagination`.
    - Un `accordion` con `defaultOpen: false` (o sin declarar), renderizado sin `LayoutEditModeProvider`, no
      renderiza sus `children` hasta que se clica la cabecera (regresión: sin cambios en producción).
    - El mismo `accordion` renderizado con `LayoutEditModeProvider` muestra sus `children` desde el primer render,
      sin necesidad de clicar la cabecera.
    - Un nodo dentro del cuerpo de ese `accordion` es seleccionable con un `data-node-path` que incluye el tramo
      `children` correcto relativo al `accordion` (no un path por defecto ni colisionando con otro nodo del árbol).
    - La cabecera del `accordion` sigue alternando `aria-expanded` correctamente en modo edición (no se ha roto el
      toggle, solo ha dejado de condicionar la presencia del contenido).
    - Un `tabs` con dos `items`, renderizado con `LayoutEditModeProvider`: un nodo dentro de `items[0].children`
      tiene un `data-node-path` que termina en un tramo `tabItem` con `itemIndex: 0`; tras clicar la cabecera de la
      segunda pestaña, un nodo de `items[1].children` tiene un `data-node-path` con `itemIndex: 1`.
    - Sin `LayoutEditModeProvider`, el comportamiento de cambio de pestaña de `tabs` es exactamente el actual
      (regresión).
    - Un `modal` con `defaultOpen: false` (o sin declarar) y sin haberse abierto vía `openModal`, renderizado sin
      `LayoutEditModeProvider`, no renderiza sus `children` (`ModalNode` devuelve `null`) — regresión: sin cambios
      en producción.
    - El mismo `modal` renderizado con `LayoutEditModeProvider` muestra sus `children` desde el primer render, sin
      haberse abierto.
    - Un nodo dentro del `modal` es seleccionable con su `data-node-path` correcto en modo edición.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (regresión)
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal.test.tsx` (regresión)
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (regresión)
  - **Restricciones**:
    - No modificar `resolveRepeaterIterations`, `resolveRepeaterSourceItems`, la lógica de `groupId` de `accordion`
      ni el selector `isModalOpen`/las acciones `openModal`/`closeModal`: en los cuatro nodos, la rama de modo
      edición es un camino de presentación adicional condicionado al contexto, no una variante de la lógica de
      estado ya existente.
    - No introducir en estos ficheros ninguna dependencia nueva de `src/dev-runtime/`: solo consumen
      `useLayoutEditModeContext()` de `src/runtime/layout-edit-mode-context.tsx`, ya introducido en T2.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - `repeater` en modo edición muestra siempre exactamente una instancia editable de `template`.
  - `accordion` y `modal` en modo edición muestran siempre su contenido, con independencia de su estado
    abierto/cerrado, sin afectar a su comportamiento en producción.
  - `tabs` threadea correctamente el `path` de los hijos de la pestaña activa, sin cambio de comportamiento visual.
  - Los cuatro ficheros de regresión de producción (sin contexto) siguen en verde sin modificaciones.
  - Tests en verde.
- **Cierre de implementación**: los siete comandos de test listados arriba, todos en verde.

---

## T12 — Integración de `@dnd-kit/core`: draggable/droppable sobre el canvas

- **ID**: T12
- **Estado**: completado
- **Nota post-cierre**: limitación conocida y deliberadamente diferida — un `tabItem` de `tabs` o un body de
  `accordion` completamente vacíos todavía no exponen zona droppable propia (`TabsNodeContent`/`AccordionNode`
  cortocircuitan a `null` sin children, sin un placeholder equivalente al de T10). Queda para T13/T14 decidir si se
  resuelve dentro de esta feature o se documenta como limitación conocida.
- **Objetivo**: implementar la infraestructura de arrastre de la Decisión 7 de `design.md`, sin lógica de negocio de
  destino válido todavía (eso es T13) ni de commit (eso es T14/T15). Añadir la dependencia `@dnd-kit/core` al
  proyecto (`pnpm add @dnd-kit/core`). Crear `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx` (nuevo):
  - envuelve el árbol renderizado de `LayoutCanvas` en un `DndContext` de `@dnd-kit/core` con sensores de puntero.
  - cada nodo existente del canvas (identificado por su `data-node-path` ya expuesto por T2) se hace arrastrable con
    `useDraggable({ id: serializeLayoutNodePath(path) })`.
  - cada posición droppable (el propio `container`/`form`/placeholder para "insertar dentro", y una zona entre cada
    par de hermanos consecutivos para "insertar en esta posición del array") se hace droppable con
    `useDroppable({ id: <identificador de la zona> })`. El identificador de zona codifica de forma no ambigua
    `{ parentPath: LayoutNodePath; index: number; tabItemIndex?: number }` (por ejemplo serializado como
    `"drop:children.0:2"` para "insertar en el índice 2 de los hijos del nodo en `children.0`" (`parentPath`
    resuelve a ese nodo; la colección de destino — `children` o `template` — la decide su tipo, no la
    codificación), o `"drop:children.0:1:tabItem.0"` para "insertar en el índice 1 de `items[0].children` del
    `tabs` en `children.0`" (mismo `parentPath`, con el segmento final `tabItem.0` codificando
    `tabItemIndex: 0`). `parentPath` en esta codificación **siempre** resuelve a un nodo existente (nunca a un paso
    `tabItem` terminal usado como marcador de colección — ver la nota de diseño de T3 sobre por qué esa forma es
    ambigua); `tabItemIndex` es el disambiguador explícito, presente únicamente cuando el nodo en `parentPath` es de
    tipo `tabs`. Las zonas de "entre hermanos" se calculan por posición ordinal en el array (`index`), no por
    geometría de columnas: dado que el DOM sigue el orden real del array independientemente de cómo se distribuya
    visualmente en un grid con `columns`, la colisión se resuelve comparando el centro del elemento arrastrado
    contra el centro de cada droppable de nivel hermano (`closestCenter` de `@dnd-kit/core` o equivalente), sin
    necesitar un algoritmo distinto para grids vs listas verticales. Esto resuelve de forma concreta la pregunta
    abierta que `design.md` dejaba para el plan de implementación (Decisión 7, riesgo residual).
  - en `onDragOver`/`onDragEnd`, el contexto expone al componente padre (`LayoutCanvas`) únicamente los datos crudos
    del intento (`draggedPath`, `targetParentPath`, `targetIndex`, `targetTabItemIndex?`), sin decidir todavía si es
    válido — eso es T13.
- **Fuera de alcance**:
  - resolución de validez de destino (T13).
  - commit de movimiento/inserción (T14, T15).
  - la paleta de nodos como origen de drag (T15 la añade sobre esta misma infraestructura).
- **Dependencias**: T2, T5, T10 (las zonas droppable deben incluir los placeholders vacíos ya expuestos por T10),
  T11 (el `path` de los nodos dentro de `accordion`/`tabs`/`repeater`/`modal` debe ser correcto antes de hacerlos
  arrastrables/droppable; sin T11, cualquier nodo dentro de esos cuatro tipos tendría un `data-node-path`
  incorrecto).
- **Impacto esperado en archivos**:
  - código:
    - `package.json` / `pnpm-lock.yaml` (añadir `@dnd-kit/core`)
    - `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (modificar: envolver en el contexto dnd)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` (nuevo)
  - documentación: ninguna en esta tarea (sin comportamiento de negocio observable todavía; T14/T15 documentan el
    resultado final).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Cada nodo renderizado dentro de `LayoutCanvas` expone los atributos/handlers que `@dnd-kit/core` necesita para
      ser arrastrable (verificable indirectamente disparando los eventos sintéticos que `@dnd-kit` engancha, o
      verificando que `useDraggable`/`useDroppable` se invocan con los `id` esperados mediante un mock ligero de
      `@dnd-kit/core` si el test de integración real de puntero es poco práctico en `jsdom`).
    - Un `dragEnd` simulado entre dos hermanos conocidos produce en el callback expuesto exactamente
      `{ draggedPath, targetParentPath, targetIndex }` con los valores esperados para ese par.
    - Un `dragEnd` simulado sobre un placeholder de contenedor vacío produce `targetParentPath` igual al path del
      contenedor y `targetIndex: 0`.
    - Un `dragEnd` cancelado (soltado fuera de cualquier droppable) no invoca el callback de intento de drop.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx`
  - **Restricciones**:
    - Usar únicamente las primitivas de `@dnd-kit/core` (`useDraggable`, `useDroppable`, `DndContext`, sensores); no
      añadir `@dnd-kit/sortable` (Decisión 7 de `design.md`: el modelo de árbol con anidamiento no encaja con las
      asunciones de lista plana de `sortable`).
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - El árbol del canvas es arrastrable/droppable de extremo a extremo, exponiendo intentos de drop crudos sin
    decidir validez.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` en verde.

---

## T13 — Resolución de validez de destino de drop

- **ID**: T13
- **Estado**: completado
- **Nota de corrección post-cierre (encontrada durante T13, aplicada antes de T14)**: `pnpm build` reveló tres
  errores de tipos en `src/dev-runtime/layout-tree-mutations.ts` (T3) que `pnpm test`/vitest no detectaba por no
  type-checkar estrictamente. Corregido sin cambio de comportamiento (fix de tipos puro): anotaciones explícitas en
  `resolvePathFrames` para romper un ciclo de inferencia (`TS7022` en `template`/`candidate`) y tipo de retorno
  corregido a `LayoutNode | null` para `targetNode` (`TS2322`). `pnpm build` compila limpio; tests de T3 y T13 en
  verde sin cambios de expectativas.
- **Objetivo**: implementar el FR7 y los casos límite de ciclo de la spec. Crear
  `src/dev-runtime/layout-canvas/layout-drop-validity.ts` (nuevo) con
  `export function isValidDropTarget(pageLayout: readonly LayoutNode[], draggedPath: LayoutNodePath | null, targetParentPath: LayoutNodePath, targetIndex: number, options?: { targetTabItemIndex?: number; draggedNodeType?: LayoutNodeType }): boolean`
  que, siguiendo el mismo modelo de `parentPath` que fija T3 (`targetParentPath` resuelve siempre a un nodo
  existente; `tabs` se disambigua con `options.targetTabItemIndex`, nunca con un paso `tabItem` embebido en
  `targetParentPath`), y con `draggedPath`/`options.draggedNodeType` mutuamente excluyentes según el origen del
  drag (**corrección de una ambigüedad detectada en `review-implementation-plan`, tercera pasada**: un drag
  originado en un nodo ya existente del canvas siempre tiene un `draggedPath` real; un drag originado en la
  paleta de nodos (T15) no tiene ningún `draggedPath` — el nodo todavía no existe en el árbol — así que
  `draggedPath` debe declararse `LayoutNodePath | null`, y el llamante desde la paleta pasa explícitamente `null`
  como `draggedPath` junto con `options.draggedNodeType` presente; nunca `[]` como sustituto de "no hay path", ya
  que `[]` es un valor de path válido — la raíz — y confundirlo con "ausente" rompería el chequeo de ciclo del
  paso 9):
  1. si `draggedPath === null`: `options.draggedNodeType` debe estar presente (si no, devuelve `false`, llamada mal
     formada); se usa un `draggedNode` sintético `{ type: options.draggedNodeType }` únicamente para los pasos 5-8
     (comprobaciones de tipo), y el paso 9 (chequeo de ciclo) se **omite** por completo — un nodo que todavía no
     existe en el árbol no puede ser ancestro ni descendiente de ningún destino, así que la comprobación no aplica
     y no debe evaluarse contra ningún valor sustituto de `draggedPath`.
  2. si `draggedPath` no es `null`: resuelve `draggedNode = getNodeAtPath(pageLayout, draggedPath)`; si es `null`,
     devuelve `false`. `options.draggedNodeType`, si se proporciona junto con un `draggedPath` no nulo, se ignora
     (el `draggedPath` real siempre tiene prioridad); en la práctica los llamantes de T14 nunca pasan
     `draggedNodeType` y los de T15 siempre pasan `draggedPath: null`, así que esta combinación no debería darse,
     pero la función no lanza por ello.
  3. resuelve `targetParentNode = targetParentPath.length === 0 ? null : getNodeAtPath(pageLayout, targetParentPath)`;
     si `targetParentPath` no está vacío y no resuelve, devuelve `false`.
  4. si `targetParentNode` no es `null` y su tipo es `'tabs'`: `options.targetTabItemIndex` debe estar presente y
     ser un índice válido de `targetParentNode.props.items`; si está ausente o fuera de rango, devuelve `false`. Si
     está presente y es válido, este destino se trata como aceptador sin restricción propia de tipo (equivalente a
     `container`) y se salta el paso 5. Si `targetParentNode` no es `null`, su tipo **no** es `'tabs'` y
     `options.targetTabItemIndex` sí está presente, devuelve `false` (el parámetro no aplica fuera de `tabs`, mismo
     criterio de rechazo que fija T3 para `insertNodeAt`).
  5. si no es el caso anterior (destino `tabs` válido) y `targetParentNode` no es `null`, comprueba
     `nodeTypeAcceptsChildren(targetParentNode.type)` (T1); si es `false`, devuelve `false` (cubre que `repeater` y
     `tabs` sin `targetTabItemIndex` válido nunca sean destino directo, y que un nodo hoja nunca lo sea).
  6. si `targetParentNode` no es `null` y su tipo es `'modal'`, comprueba `MODAL_ALLOWED_CHILD_TYPES.has(draggedNode.type)`
     (T1); si es `'link'`, comprueba `LINK_ALLOWED_CHILD_TYPES.has(draggedNode.type)` (T1); si no cumple, devuelve
     `false` (cubre que `modal`/`link` mantengan su catálogo cerrado de descendientes ya vigente en producción, no
     el catálogo abierto de `container`).
  7. si `draggedNode.type` está en `FORM_ONLY_LEAF_NODE_TYPES` (T1), o es un `button` sin `action` para el que
     `buttonRequiresFormAncestor` es `true` (T1), comprueba que el destino tenga un ancestro `form` recorriendo
     `targetParentPath` hacia la raíz con `getNodeAtPath` sobre cada prefijo (el recorrido de prefijos es agnóstico
     al tipo de paso — `children`, `template` o `tabItem` — porque `getNodeAtPath` ya resuelve cualquiera de los
     tres; si `targetParentNode` es el propio `tabs` disambiguado por `options.targetTabItemIndex`, el ancestro
     `form` se busca igual sobre los prefijos de `targetParentPath`, ya que el `tabs` en sí puede estar anidado
     dentro de un `form`); si no hay ningún ancestro `form`, devuelve `false`.
  8. si el destino sí tiene un ancestro `form` (el propio `targetParentNode` es `form`, o alguno de sus ancestros lo
     es), comprueba `FORM_ALLOWED_DESCENDANT_TYPES.has(draggedNode.type)` (T1); si es `false`, devuelve `false`
     (cubre que `list`/`link`/`modal`/`badge`/`alert`/`stat`/`skeleton`/`repeater`/`fileManager` nunca sean válidos
     dentro de un `form`, aunque el destino inmediato sea un `container` anidado dentro del `form`).
  9. si `draggedPath` no es `null`, comprueba que `targetParentPath` no sea igual a `draggedPath` ni un descendiente
     de `draggedPath` (mismo criterio de ciclo que ya usa `movePathTo` en T3; reutilizar la misma comprobación, no
     reimplementarla) — cubre el caso límite "arrastrar un nodo sobre sí mismo o sobre un descendiente". Si
     `draggedPath` es `null` (origen paleta, ver paso 1), este paso se omite y se considera trivialmente superado.
  10. si todas las comprobaciones pasan, devuelve `true`.
  Integrar `isValidDropTarget` en `layout-canvas-dnd-context.tsx` (T12) para que, durante `onDragOver`, la zona bajo
  el puntero reciba una clase visual de "destino inválido" (Tailwind, por ejemplo borde rojo) cuando la función
  devuelve `false`, y de "destino válido" en caso contrario.
- **Fuera de alcance**:
  - el commit real del movimiento/inserción (T14, T15): esta tarea solo determina si un destino es aceptable
    visualmente durante el arrastre.
- **Dependencias**: T1 (predicados), T12 (wiring de drag para poder mostrar el indicador visual).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-drop-validity.ts` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx` (modificar: indicador visual según validez)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (nuevo)
  - documentación: ninguna en esta tarea (el comportamiento observable completo de drop se documenta en T14/T15).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - Arrastrar un `input` (dentro de un `form`) hacia un `container` hermano sin `form` ancestro: `false`,
      replicando el criterio de aceptación de la spec.
    - Arrastrar un `input` de un `form` hacia otro `form` distinto de la misma página: `true`.
    - Arrastrar un `button` sin `action` hacia el `layout` raíz (fuera de cualquier `form`): `false`, replicando el
      criterio de aceptación de la spec.
    - Arrastrar un `button` sin `action` hacia dentro de un `form`: `true`.
    - Arrastrar cualquier nodo hacia dentro de un `repeater` (fuera de la instancia de `template`, que en modo
      edición es la única representada): `false` (repeater nunca acepta children).
    - Arrastrar un `list`/`link`/`modal`/`badge`/`alert`/`stat`/`skeleton` hacia dentro de un `form` (directamente o
      dentro de un `container` anidado en ese `form`): `false` para cada uno.
    - Arrastrar un `container` hacia dentro de uno de sus propios hijos: `false` (ciclo).
    - Arrastrar un `container` hacia sí mismo como destino (`targetParentPath === draggedPath`): `false`.
    - Arrastrar un `heading` hacia un `container` cualquiera (sin restricciones de `form`): `true`.
    - Arrastrar un `input` hacia el placeholder vacío de un `form` recién insertado (destino con
      `nodeTypeAcceptsChildren(type) === true` y sin hijos): `true`.
    - Arrastrar un `heading` hacia dentro de un `modal`: `true` (está en `MODAL_ALLOWED_CHILD_TYPES`); arrastrar un
      `input` hacia dentro de ese mismo `modal`: `false` (no está en `MODAL_ALLOWED_CHILD_TYPES`, con independencia
      de que hubiera un `form` en algún otro punto del árbol).
    - Arrastrar un `badge` hacia dentro de un `link`: `true` (está en `LINK_ALLOWED_CHILD_TYPES`); arrastrar un
      `table` hacia dentro de ese mismo `link`: `false`.
    - Arrastrar cualquier nodo hacia un `targetParentPath` que resuelve a un `tabs`, sin pasar
      `options.targetTabItemIndex`: `false` (destino ambiguo).
    - Arrastrar cualquier nodo hacia un `targetParentPath` que resuelve a un `tabs`, con
      `options: { targetTabItemIndex: 5 }` cuando ese `tabs` solo declara dos `items`: `false` (índice fuera de
      rango).
    - Arrastrar un `heading` hacia un `targetParentPath` que resuelve a un `tabs` con
      `options: { targetTabItemIndex: 0 }` válido: `true` (destino sin restricción propia de tipo, análogo a
      `container`).
    - Arrastrar cualquier nodo hacia un `targetParentPath` que resuelve a un `container` (no `tabs`) pasando
      `options: { targetTabItemIndex: 0 }`: `false` (el parámetro no aplica fuera de `tabs`).
    - Arrastrar un `input` hacia un `targetParentPath` que resuelve a un `tabs` (con `targetTabItemIndex` válido)
      cuando ese `tabs` no cuelga de ningún `form` ancestro: `false` (la restricción de ancestro `form` se aplica
      igual cuando el destino inmediato es un `tabs` disambiguado).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts`
  - **Restricciones**:
    - Reutilizar exclusivamente los predicados de T1 (`FORM_ONLY_LEAF_NODE_TYPES`, `buttonRequiresFormAncestor`,
      `FORM_ALLOWED_DESCENDANT_TYPES`, `nodeTypeAcceptsChildren`, `MODAL_ALLOWED_CHILD_TYPES`,
      `LINK_ALLOWED_CHILD_TYPES`); no reintroducir listas de tipos propias en este módulo (requisito no funcional
      explícito de la spec: reutilizar las mismas reglas ya definidas en `src/config/`).
- **Documentación afectada**: ninguna.
- **Criterios de finalización**:
  - `isValidDropTarget` cubre todos los casos límite y criterios de aceptación de la spec relativos a destino de
    drop, reutilizando únicamente T1.
  - El indicador visual de validez funciona durante el arrastre.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` en
  verde.

---

## T14 — Reordenar y reanidar nodos existentes vía drag

- **ID**: T14
- **Estado**: completado
- **Objetivo**: implementar el FR6 y FR7 (commit) de la spec. Conectar el resultado de `onDragEnd` de T12 con T13 y
  T4/T3: en `LayoutCanvas` (o en `layout-canvas-dnd-context.tsx`), cuando `onDragEnd` produce
  `{ draggedPath, targetParentPath, targetIndex, targetTabItemIndex? }` y
  `isValidDropTarget(pageLayout, draggedPath, targetParentPath, targetIndex, { targetTabItemIndex })` (T13) es
  `true`, invocar
  `commitCanvasMutation((pageLayout) => movePathTo(pageLayout, draggedPath, targetParentPath, targetIndex, { toTabItemIndex: targetTabItemIndex }))`
  (T3). Si `isValidDropTarget` es `false`, no se invoca ningún commit y el árbol permanece sin cambios (el
  indicador visual de T13 ya habrá comunicado la invalidez durante el arrastre). Tras un commit exitoso, si el nodo
  movido era el seleccionado, la selección se actualiza al nuevo `path` resultante (el path cambia porque la
  posición en el árbol cambió); si el commit es rechazado por el pipeline de T4 (última barrera de seguridad), la
  selección no cambia.
- **Fuera de alcance**:
  - inserción de nodos nuevos desde la paleta (T15).
  - borrado (T16).
- **Dependencias**: T3 (`movePathTo`), T4 (commit), T12 (wiring), T13 (validez).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (modificar: wiring de `onDragEnd` → commit)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: reordenar/reanidar
    por arrastre).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Arrastrar un `input` existente desde un `form` hacia otro `form` distinto de la misma página lo reanida
      correctamente; el `editorBuffer` resultante (visible en la pestaña JSON) sigue siendo válido contra
      `validateRuntimeConfig`, replicando el criterio de aceptación de la spec.
    - Arrastrar un `input` desde dentro de un `form` hacia un `container` hermano sin `form` no cambia el `layout`
      resultante (el commit no se invoca en absoluto), replicando el criterio de aceptación de la spec.
    - Reordenar dos hermanos dentro del mismo `container` (arrastrar el segundo antes del primero) produce el nuevo
      orden esperado en el árbol renderizado tras el commit.
    - Arrastrar un `heading` existente de `items[0].children` de un `tabs` hacia `items[1].children` de ese mismo
      `tabs` (soltando sobre la pestaña ya cambiada a la segunda) lo reanida correctamente en `items[1]`,
      desapareciendo de `items[0]`.
    - Tras mover el nodo actualmente seleccionado, la selección sigue apuntando al mismo nodo lógico en su nueva
      posición (verificable porque el panel de propiedades — si ya montado por T9 en el mismo árbol de tests — sigue
      mostrando los datos del mismo nodo, o comprobando el nuevo `data-node-path` seleccionado).
    - Un intento de drop inválido no dispara ningún cambio de estado de React observable (ni re-render con árbol
      distinto, ni cambio de `editorBuffer`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
  - **Restricciones**:
    - No introducir un segundo camino de commit: la única vía para que un drag válido llegue a `currentConfig` es
      `commitCanvasMutation` (T4).
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - Reordenar y reanidar nodos existentes funciona end-to-end con validación y sincronización a Monaco.
  - Tests en verde.
- **Cierre de implementación**:
  `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` en verde.

---

## T15 — Paleta de nodos + inserción vía drag

- **ID**: T15
- **Estado**: completado
- **Objetivo**: implementar el FR8 de la spec. Crear:
  - `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts` (nuevo): función
    `buildDefaultNodeInstance(type: LayoutNodeType): LayoutNode` que produce, para cada tipo de
    `getSupportedNodeTypesCatalog()` (T7), una instancia mínimamente válida capaz de pasar `validateRuntimeConfig`
    dentro de un `layout` que ya cumpla sus propios requisitos de contexto (por ejemplo, un `input` de la paleta se
    inserta con un `fieldId` generado único dentro del `form` destino). Los valores concretos por campo requerido de
    cada tipo deben consultarse en su schema (`runtime-config-zod.ts`) y en su ficha de
    `ai-workflow/docs/app-features/nodes/`; deben ser literales estáticos (no referencias dinámicas) para no
    depender de estado del runtime en el momento de insertar.
  - `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx` (nuevo): componente `LayoutCanvasNodePalette` que
    lista `getSupportedNodeTypesCatalog()` con una etiqueta legible por tipo, cada entrada arrastrable (`useDraggable`
    de `@dnd-kit/core`, mismo mecanismo de T12) con un `id` que codifica `{ kind: 'palette'; type: LayoutNodeType }`.
  - Extender `onDragEnd` (T12/T14) para distinguir un drag originado en la paleta (por el `id` codificado) de un
    drag de un nodo existente: cuando el origen es la paleta, se invoca
    `isValidDropTarget(pageLayout, null, targetParentPath, targetIndex, { targetTabItemIndex, draggedNodeType: type })`
    (T13 ya admite `draggedPath: LayoutNodePath | null` y `options.draggedNodeType` exactamente para este caso —
    pasar `null`, nunca `[]`, como `draggedPath` cuando el origen es la paleta, según fija T13). Si el resultado es
    `true`, invocar
    `commitCanvasMutation((pageLayout) => insertNodeAt(pageLayout, targetParentPath, targetIndex, buildDefaultNodeInstance(type), { tabItemIndex: targetTabItemIndex }))`.
  Integrar `LayoutCanvasNodePalette` en `LayoutCanvas`, visible en todo momento dentro de la pestaña Visual (no
  condicionada a que haya un nodo seleccionado).
- **Fuera de alcance**:
  - borrado (T16).
- **Dependencias**: T3 (`insertNodeAt`), T4 (commit), T7 (catálogo de tipos), T12 (wiring dnd), T13 (validez, con la
  extensión descrita).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-canvas-node-palette.tsx` (nuevo)
    - `src/dev-runtime/layout-canvas/layout-drop-validity.ts` (modificar: soporte de `draggedNodeType` hipotético)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (modificar: integrar la paleta y su rama de `onDragEnd`)
  - tests:
    - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (nuevo)
    - `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación: casos con `draggedNodeType`
      hipotético)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: paleta de nodos e
    inserción).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (nuevo)
    - `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación)
  - **Comportamiento cubierto**:
    - `buildDefaultNodeInstance(type)` para cada tipo del catálogo completo produce una instancia que, insertada en
      un `layout` mínimo compatible (por ejemplo dentro de un `form` para los tipos que lo requieren), pasa
      `validateRuntimeConfig` sin error (test parametrizado sobre el catálogo completo).
    - La paleta lista todos los tipos del catálogo con una entrada arrastrable por tipo.
    - Arrastrar `container` desde la paleta hasta el `layout` raíz lo inserta como nuevo hijo en la posición
      soltada; el `container` insertado aparece vacío con su placeholder (T10) visible.
    - Arrastrar `input` desde la paleta hasta un destino sin `form` ancestro no inserta nada (destino inválido según
      T13 extendido).
    - Arrastrar `input` desde la paleta hasta dentro de un `form` existente lo inserta correctamente, con un
      `fieldId` que no colisiona con los ya existentes en ese `form`.
    - `isValidDropTarget` con `options: { draggedNodeType: 'button' }` (sin nodo real arrastrado) y destino fuera de
      cualquier `form` es `false`; con destino dentro de un `form`, `true` — mismos casos que T13 pero para el
      origen paleta.
    - `isValidDropTarget` con `options: { draggedNodeType: 'heading', targetTabItemIndex: 0 }` y destino que resuelve
      a un `tabs`: `true` — confirma que `draggedNodeType` y `targetTabItemIndex` componen correctamente dentro del
      mismo objeto `options`.
    - `isValidDropTarget(pageLayout, null, [], 0, { draggedNodeType: 'container' })` (origen paleta, destino el
      `layout` raíz de la página) devuelve `true` — caso explícito que fija que `draggedPath: null` con
      `targetParentPath: []` no dispara el chequeo de ciclo del paso 9 de T13 (que sí se aplicaría si, por error,
      `draggedPath` se hubiera pasado como `[]` en vez de `null`). Este es el caso que corrobora el primer criterio
      de aceptación de esta misma tarea ("Arrastrar `container` desde la paleta hasta el `layout` raíz lo
      inserta").
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts`
  - **Restricciones**:
    - `buildDefaultNodeInstance` no debe usar referencias dinámicas (`queries.*`, `forms.*`, `{{...}}`) en ningún
      valor por defecto: solo literales, para que el nodo insertado sea válido de inmediato sin depender de que
      exista una query o formulario concretos en la config activa.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - La paleta cubre el catálogo completo de tipos soportados y la inserción respeta las mismas reglas de destino que
    el reordenamiento.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` y
  `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` en verde.

---

## T16 — Eliminar nodo seleccionado

- **ID**: T16
- **Estado**: completado
- **Objetivo**: implementar el FR9 de la spec. Añadir en `LayoutCanvas` (o en `LayoutCanvasPropertiesPanel`, como
  parte de la cabecera del panel cuando hay un nodo seleccionado) una acción de borrado (botón visible solo con
  `selectedPath !== null`) que invoque
  `commitCanvasMutation((pageLayout) => removeNodeAt(pageLayout, selectedPath))` (T3/T4) y, tras un commit exitoso,
  limpie `selectedPath`/`hoveredPath` a `null`.
- **Fuera de alcance**:
  - confirmación modal o deshacer (fuera de alcance de la spec completa).
  - atajos de teclado (`Supr`), explícitamente fuera de alcance de la spec.
- **Dependencias**: T3 (`removeNodeAt`), T4 (commit), T5 (estado de selección).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar: botón de borrado) — o
      `src/dev-runtime/layout-canvas/layout-canvas.tsx` si se decide colocar el control fuera del panel de
      propiedades; la ubicación exacta es un detalle de UI sin ambigüedad funcional (el criterio de aceptación es
      que exista una acción de borrado visible junto a la selección activa).
  - tests:
    - `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia: borrado de nodo
    seleccionado).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Seleccionar un `container` con dos hijos y disparar el borrado elimina el `container` y ambos hijos del
      `layout` resultante (visible en `editorBuffer`), replicando el criterio de aceptación de la spec.
    - Tras el borrado, la selección queda limpia (ningún nodo con la clase de selección, panel de propiedades y
      breadcrumb ya no visibles).
    - Sin ningún nodo seleccionado, no existe ninguna acción de borrado disponible (o está deshabilitada).
    - El borrado actualiza Monaco de inmediato (visible al cambiar a la pestaña JSON), sin necesidad de pulsar
      "Aplicar".
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx`
  - **Restricciones**: ninguna específica más allá de las globales.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (referencia; actualización real diferida a
    `update-app-documentation`).
- **Criterios de finalización**:
  - Borrar el nodo seleccionado (y su subárbol) funciona end-to-end con limpieza de selección y sincronización a
    Monaco.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` en
  verde.

---

## Orden y siguiente tarea recomendada

1. T1 — Predicados puros de colocación estructural
2. T2 — Modelo de `path` + `LayoutEditModeContext` + wrapper de selección/hover
3. T3 — Mutaciones puras del árbol por `path`
4. T4 — Pipeline de commit del canvas
5. T5 — Shell del canvas: pestañas, selector de página, selección/hover
6. T6 — Breadcrumb de ancestros
7. T7 — JSON Schema por tipo de nodo
8. T8 — Dispatcher genérico de campos de propiedades
9. T9 — Panel de propiedades del nodo seleccionado
10. T10 — Placeholder de contenedores/forms vacíos
11. T11 — Nodos con render anidado propio en modo edición (`repeater`, `accordion`, `tabs`, `modal`)
12. T12 — Integración de `@dnd-kit/core`
13. T13 — Resolución de validez de destino de drop
14. T14 — Reordenar y reanidar vía drag
15. T15 — Paleta de nodos + inserción vía drag
16. T16 — Eliminar nodo seleccionado

Siguiente tarea a tomar: **T1**.
