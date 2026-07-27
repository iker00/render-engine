# Tasks: 0105 — Corrección de bugs del editor visual (canvas) en modo Editor

## Contexto

Tres bugs independientes del modo Editor introducidos entre 0102 y 0103. Cada tarea aborda un
requisito funcional de `spec.md` (RF1, RF2, RF3), es atómica, tiene su contrato de tests propio y
puede completarse sin bloquear las demás. El orden recomendado es T1 → T2 → T3, pero las tareas no
tienen dependencia entre sí.

Los tres bugs son exclusivos del modo Editor: ningún cambio debe alterar el render del modo Visual
ni la validación previa al render (ver "Fuera de alcance" en `spec.md`).

---

## T1 — Preservar el orden visual de hijos de `container` en modo grid dentro del modo Editor (RF1)

### Estado
completada

### Objetivo
Evitar que los `LayoutCanvasDropZoneGap` insertados por `LayoutRenderer` en modo Editor consuman
celdas del grid cuando el `container` padre está en modo `columns`. Los hijos reales deben mantener
la misma posición de columna/fila que en modo Visual, tanto en `columns` fija como responsive, y
tanto vacío como con 0/1/varios hijos ya presentes.

### Fuera de alcance
- Cualquier cambio en el render en modo Visual/producción del `container` o de cualquier otro nodo
  con `props.columns`.
- Cambios en `container-layout-node.tsx` o en las utilidades de styling de grid.
- Cambios en el `EmptyContainerPlaceholder` (ya cubre el caso de contenedor vacío).
- Cambios en las reglas de destino de drop (`isValidDropTarget`) o en la mecánica del commit del
  canvas.
- Añadir/soportar drop-zones entre hijos del grid con posiciones intermedias por drag (queda como
  limitación conocida; el spec sólo exige que el orden visual se preserve, no que exista drop-zone
  entre cada par de hijos del grid).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
    - `src/runtime/layout-renderer.tsx` (modificar): consumir `useRuntimeLayoutContext()` para
      detectar si el `LayoutRenderer` está iterando la colección de hijos de un padre en modo grid
      (`parentGridColumns !== null`) y, en ese caso, cambiar el render de los
      `LayoutCanvasDropZoneGap` para que no ocupen celdas del grid. Estrategia: en modo grid,
      renderizar únicamente el gap de posición `0` (antes de todos los hijos) y el gap de posición
      `N` (tras el último hijo), aplicándoles `style={{ gridColumn: '1 / -1' }}` para que cada uno
      ocupe su propia fila completa sin desplazar la distribución de columnas de los hijos reales.
      Los gaps intermedios (entre hijos) no se renderizan en modo grid.
- Tests:
    - `src/tests/layout-renderer/layout-renderer-container.test.tsx` (ampliación): añadir casos
      específicos del render de `container` con `columns` en modo Editor.
    - `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx` (nuevo): test dedicado al
      contrato de drop-zones dentro de `LayoutRenderer` cuando el padre está en modo grid.
- Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Contenedores y
      formularios vacíos" y/o "Reordenar y reanidar por arrastre" — añadir nota sobre la ausencia
      de drop-zones intermedias en modo grid (misma clase de limitación conocida que la de
      `tabItem`/`accordion` vacíos ya documentada).

### Tests

- **Ficheros de test**:
    - `src/tests/layout-renderer/layout-renderer-container.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx` (nuevo).

- **Comportamiento cubierto**:
    - Con un `container` de `props.columns: 3` y 5 hijos heterogéneos, montado bajo
      `LayoutEditModeProvider` con `active: true`, el orden de los hijos reales en el DOM y las
      clases Tailwind de span/columna coinciden con el mismo `container` renderizado en modo Visual
      (sin provider o con `active: false`). Los hijos reales conservan su posición de columna/fila
      esperada.
    - En modo Editor, dentro de un `container` con `columns`, el DOM contiene exactamente 2
      elementos con `data-drop-zone` como hijos directos del `<section data-layout-node="container">`:
      el de índice `0` y el de índice `N`, y no existen `data-drop-zone` intermedios entre hijos
      reales. Cada uno lleva la clase/estilo que garantiza `grid-column: 1 / -1`.
    - En modo Editor, dentro de un `container` sin `props.columns` (modo flex/row/column), el DOM
      sigue conteniendo `N+1` `data-drop-zone` (los mismos de hoy), sin regresión respecto al
      comportamiento actual.
    - Insertar un hijo nuevo desde el commit del canvas dentro de un `container` con `columns` en
      modo Editor no altera el orden ni la clase de span de los hijos ya presentes.
    - `container` en modo grid con `columns` responsive (mapa por breakpoint) conserva el orden
      visual correcto de los hijos reales en modo Editor.
    - Regresión: en modo Visual (sin provider o con `active: false`) el `container` con `columns`
      renderiza exactamente los mismos elementos hijos que ya renderizaba (sin `data-drop-zone`
      añadidos, sin cambios visuales).

- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-container.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-grid-drop-zones.test.tsx`

- **Restricciones**:
    - Reusar los helpers ya establecidos en `src/tests/layout-renderer/` para render de nodos.
    - Reusar el patrón de mount con `LayoutEditModeProvider` ya usado por
      `layout-node-renderer-edit-mode.test.tsx` y `layout-renderer-edit-mode-placeholders.test.tsx`.
    - No introducir un nuevo mock de `@dnd-kit/core`: `useDroppable` sin `DndContext` ancestro es
      un no-op seguro (misma nota que `layout-renderer.tsx` ya asume para el modo producción).

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Criterios de finalización
- Los tests listados están en verde.
- Los tests preexistentes de `layout-renderer/` y `dev-runtime/` siguen en verde sin
  modificaciones adicionales.
- Se ha verificado manualmente (o mediante test) que los criterios de aceptación 1 y 2 de
  `spec.md` se cumplen.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` sobre los ficheros listados en verde, y
sin regresiones en la suite ampliada.

---

## T2 — Corregir el editor de propiedades del nodo `tabs` (RF2)

### Estado
completada

### Objetivo
Reparar el panel de propiedades del nodo `tabs` para que la gestión de `props.items` funcione:
"Añadir" crea una pestaña válida con etiqueta por defecto, "Quitar" respeta el mínimo de una
pestaña, y el campo `children` de cada item deja de exponerse como campo editable dentro del
editor genérico. El resto del panel (campos `label`, `visibility` de cada item, y las secciones
`Props`/`Layout`/`Visibilidad`/`Estado de consulta` del propio nodo `tabs`) se mantiene igual que
hoy.

### Fuera de alcance
- Cualquier control visual nuevo sobre la barra de pestañas del canvas (botones "+"/"x" en la
  propia barra). Se descarta explícitamente en el spec.
- Cambios en `tabs-layout-node.tsx` o en su semántica de pestaña activa: el fallback a la primera
  pestaña visible tras eliminar la activa ya está resuelto por el patrón "adjusting state during
  render" existente y no requiere modificaciones (queda cubierto por test de regresión).
- Cambios en la validación estructural de `tabs.props.items` (ya vigente `min(1)` en el schema
  Zod).
- Refactor amplio del sistema de property fields.
- Cambios de comportamiento del panel de propiedades para otros arrays u otros nodos (los cambios
  deben quedar localizados a la sección `props.items` del nodo `tabs`, o expresarse como
  primitivas neutras — `minItems` y omisión de propiedades — que sólo se activan cuando el schema
  lo dice).

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar): pre-procesar
      el schema JSON derivado del nodo `tabs` antes de pasarlo al `PropertyFieldDispatcher` para
      (a) eliminar `children` del `properties` del item schema de `props.items[]`, (b) garantizar
      que el array `props.items` conserve/reciba `minItems: 1` explícito.
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (modificar):
        - `ArrayPropertyField`: leer `schema.minItems` (por defecto `0`) y ocultar/deshabilitar el
          botón "Quitar" para cada item cuando la longitud actual del array iguale `minItems`.
        - Extender el builder de default de item para arrays de objetos: cuando `itemsSchema.type`
          es `'object'`, generar un objeto que satisfaga los campos `required` del sub-schema
          (llamando recursivamente al builder de default por cada propiedad requerida), en lugar
          de devolver `{}`. Para `string`, el default sigue siendo `''` salvo que el sub-schema
          declare un `default` explícito, en cuyo caso se usa ese valor (permite inyectar la
          etiqueta por defecto no vacía desde el pre-procesado del panel).
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (continuación): al
      pre-procesar el schema de `tabs.props.items[]`, inyectar `default: 'Nueva pestaña'` en el
      sub-schema de la propiedad `label`, de modo que el builder anterior lo use al añadir una
      pestaña nueva.
- Tests:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación): casos
      específicos del nodo `tabs`.
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación): casos
      de `minItems` y de default por objeto-con-required.
- Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Panel de
      propiedades (modo Editor)" — nota aclaratoria sobre la exclusión de `props.items[].children`
      en el editor genérico del nodo `tabs` y sobre el bloqueo del "Quitar" cuando el array está
      en su mínimo.

### Tests

- **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).

- **Comportamiento cubierto**:
    - En `layout-canvas-property-field-dispatcher.test.tsx`:
        - `ArrayPropertyField` con `schema.minItems: 1` y un único item: el botón "Quitar" no
          aparece o se muestra deshabilitado, y pulsarlo no invoca `onChange`.
        - `ArrayPropertyField` con `schema.minItems: 1` y dos items: ambos "Quitar" activos; al
          quitar uno, queda un solo item y el "Quitar" restante deja de estar disponible.
        - `ArrayPropertyField` sin `minItems` mantiene el comportamiento actual (no restricción).
        - `ArrayPropertyField` sobre un `itemsSchema` de tipo `object` con `required: ['label']`
          y sub-schema `{ label: { type: 'string', default: 'Nueva pestaña' } }`: pulsar "Añadir"
          invoca `onChange` con un nuevo item `{ label: 'Nueva pestaña' }` (no con `{}`).
        - `ArrayPropertyField` sobre un `itemsSchema` de tipo `object` con `required: ['label']`
          y sin `default` en `label`: el nuevo item incluye `label: ''` (o el default por tipo),
          nunca omite la clave `label`.
    - En `layout-canvas-properties-panel.test.tsx`:
        - Panel del nodo `tabs`: la sección `Props` incluye el editor de `items` (array), y cada
          entrada del array expone únicamente los campos `label` y `visibility` (o los campos del
          sub-schema del item excluyendo `children`). En el DOM del panel no existe ningún campo
          etiquetado como `children` dentro del editor de un item de `props.items`.
        - Panel del nodo `tabs`: pulsar "Añadir" en `props.items` invoca `onCommitNodeUpdate` con
          un nuevo item `{ label: 'Nueva pestaña' }` como último elemento; el `label` es
          exactamente la cadena por defecto acordada, no vacía.
        - Panel del nodo `tabs` con `props.items` de longitud 1: el botón "Quitar" del único item
          no está disponible o está deshabilitado, y su interacción no dispara
          `onCommitNodeUpdate`.
        - Panel del nodo `tabs` con `props.items` de longitud 2: pulsar "Quitar" en el primer
          item invoca `onCommitNodeUpdate` con un `props.items` de longitud 1, conservando el
          segundo item original.
        - Regresión: el panel de un nodo no-`tabs` con arrays (ej. cualquier nodo cuyo schema
          tenga un array sin `minItems`) conserva su comportamiento actual respecto a "Añadir" y
          "Quitar".

- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`

- **Restricciones**:
    - Reusar los harness ya presentes en ambos ficheros de test (no introducir un tercer patrón
      de render del panel).
    - El pre-procesado del schema en `layout-canvas-properties-panel.tsx` debe seguir el mismo
      patrón que `resolveLayoutSubsectionSchema`/`resolveUnionBranch` ya existentes (funciones
      puras que devuelven un schema nuevo sin mutar el cacheado).
    - La cadena literal de la etiqueta por defecto (`'Nueva pestaña'`) debe declararse como
      constante local nombrada para que un futuro cambio sea trivial y localizable.
    - No introducir lógica hardcodeada por tipo de nodo dentro de
      `property-field-dispatcher.tsx`: cualquier cambio del dispatcher debe expresarse como
      soporte genérico a atributos del JSON Schema (`minItems`, `default`, `required`), y la
      especialización de `tabs` vive únicamente en el panel.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Criterios de finalización
- Los tests listados están en verde.
- Se cumplen los criterios de aceptación 3 a 8 de `spec.md`.
- El panel del nodo `tabs` no expone ningún campo editable etiquetado como `children` dentro de
  cada item de `props.items`.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` sobre los ficheros listados en verde, y
sin regresiones en la suite ampliada.

---

## T3 — Corregir la reanidación por drag de un nodo existente hacia un destino con contenido (RF3)

### Estado
completada

### Objetivo
Garantizar que arrastrar un nodo ya existente del árbol y soltarlo dentro de un `container`,
`form`, `accordion` o pestaña activa de un `tabs` con contenido (0, 1 o varios hijos) reanide el
nodo correctamente. El resultado debe ser equivalente en fiabilidad al de insertar un nodo nuevo
desde la paleta en el mismo destino, con independencia de la posición relativa del nodo arrastrado
respecto al destino en el árbol original.

### Fuera de alcance
- Cambios en `isValidDropTarget` (`layout-drop-validity.ts`) o en las reglas estructurales de
  destino de drop.
- Cambios en el commit del canvas (`layout-canvas-commit.ts`) o en la mecánica de sincronización
  con Monaco.
- Cambios en `insertNodeAt`, `removeNodeAt` o `replaceNodeAt` (el bug está en `movePathTo`, que
  compone las dos anteriores; no en las primitivas).
- Cambios en `adjustIndexForSiblingMove` (mantiene su contrato actual para el caso "mismo
  padre/misma colección").
- Deshacer/rehacer.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
    - `src/dev-runtime/layout-tree-mutations.ts` (modificar): dentro de `movePathTo`, ajustar
      `toParentPath` antes del `insertNodeAt(afterRemoval, toParentPath, ...)` para compensar el
      desplazamiento de índices provocado por `removeNodeAt(rootNodes, fromPath)` en la colección
      donde se elimina el nodo. Añadir un helper puro `adjustParentPathForRemoval(fromPath,
      toParentPath, toTabItemIndex)` con este contrato:
        - Si `fromPath` está vacío, devolver `toParentPath` tal cual.
        - Sea `sourceParentPath = fromPath.slice(0, -1)` y `lastFromStep = fromPath[fromPath.length - 1]`.
          El removal ocurre en la colección identificada por `(sourceParentPath, lastFromStep.field,
          lastFromStep.itemIndex si aplica)`.
        - Caso A — `toParentPath` es exactamente `sourceParentPath` y el `toTabItemIndex` coincide
          con `lastFromStep.itemIndex` (o ambos son `undefined`): la eliminación y la inserción
          ocurren en la misma colección. En este caso `toParentPath` no cambia; el ajuste de
          `toIndex` lo sigue haciendo `adjustIndexForSiblingMove`.
        - Caso B — `toParentPath` empieza por `sourceParentPath` como prefijo estricto y en la
          posición `sourceParentPath.length` el `step` de `toParentPath` referencia la misma
          colección que `lastFromStep` (mismo `field`; para `tabItem`, mismo `itemIndex`), con
          `stepDivergente.index > lastFromStep.index`: devolver una copia de `toParentPath` con
          el `index` de ese step decrementado en 1. Si `stepDivergente.index < lastFromStep.index`,
          `toParentPath` no cambia. Si son iguales, se trata de un intento de mover un nodo dentro
          de sí mismo o sus descendientes, ya rechazado por `isSameOrDescendantPath` al principio
          de `movePathTo`.
        - Caso C — cualquier otra situación (rutas no relacionadas, `toParentPath` más corto que
          `sourceParentPath`, colecciones distintas en el step de divergencia): `toParentPath` no
          cambia.
    - `src/dev-runtime/layout-tree-mutations.ts` (continuación): usar el helper en `movePathTo`
      justo después de calcular `adjustedToIndex` y antes de invocar `insertNodeAt`.
- Tests:
    - `src/tests/dev-runtime/layout-tree-mutations.test.ts` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación).
- Documentación:
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Reordenar y
      reanidar por arrastre (modo Editor)" — si actualmente insinúa una limitación en este caso,
      eliminarla; en caso contrario, no requiere cambio.

### Tests

- **Ficheros de test**:
    - `src/tests/dev-runtime/layout-tree-mutations.test.ts` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación).

- **Comportamiento cubierto**:
    - En `layout-tree-mutations.test.ts` (unit sobre `movePathTo`):
        - Root layout `[X, containerA[Y]]`, drag `X` (fromPath `[{children,0}]`) hacia
          `containerA` (toParentPath `[{children,1}]`, toIndex `1`): el resultado es
          `[containerA[Y, X]]`, sin excepciones y con `containerA` en la posición esperada.
        - Root layout `[X, containerA[Y, Z]]`, drag `X` a `containerA` en `toIndex: 0`: el
          resultado es `[containerA[X, Y, Z]]`.
        - Root layout `[containerA[Y, Z], X]`, drag `X` (fromPath `[{children,1}]`) a `containerA`
          (toParentPath `[{children,0}]`, toIndex `1`): el resultado es `[containerA[Y, X, Z]]`
          (el índice del container no se desplaza porque el nodo eliminado estaba después).
        - Root layout `[X, tabs[items[0].children=[Y], items[1].children=[Z]]]`, drag `X` a la
          primera pestaña (toParentPath `[{children,1}]`, `toTabItemIndex: 0`, toIndex `1`): el
          resultado tiene `tabs` como único hijo raíz, con `items[0].children` = `[Y, X]` e
          `items[1].children` = `[Z]`.
        - Root layout `[X, form[Y]]`, drag `X` hacia `form` (toParentPath `[{children,1}]`,
          toIndex `1`): el resultado es `[form[Y, X]]`.
        - Root layout `[X, accordion[Y]]`, drag `X` hacia `accordion` (toParentPath
          `[{children,1}]`, toIndex `1`): el resultado es `[accordion[Y, X]]`.
        - Regresión: el caso ya existente "renests a node from source form to target form"
          (source y target hermanos en raíz, source índice `0`, target índice `1`, con el nodo
          arrastrado en el interior del source) sigue produciendo el mismo resultado que hoy.
        - Regresión: los casos "reorders two siblings forward/backward within the same parent
          array" siguen en verde sin cambios de expectativa.
        - Regresión: los rechazos por `isSameOrDescendantPath` (mover un nodo dentro de sí
          mismo o de un descendiente) siguen lanzando.
        - Un caso donde `fromPath` no está relacionado con `toParentPath` (subárboles disjuntos)
          y `movePathTo` no altera `toParentPath` ni `toIndex`.
    - En `layout-canvas-reorder-reinsert.test.tsx` (integración end-to-end con el commit del
      canvas y el buffer de Monaco):
        - Reanidar un nodo hoja raíz `X` (a la izquierda de un `container` en el árbol) dentro
          del `container` que ya contiene 1 hijo: el `container` queda con 2 hijos en el orden
          esperado, `X` desaparece del root, y el JSON del buffer de Monaco resultante sigue
          validando.
        - Reanidar un nodo raíz `X` dentro de la pestaña activa de un `tabs` que ya contiene 1
          hijo: la pestaña activa queda con 2 hijos, y el JSON sigue validando.
        - Reanidar un nodo raíz `X` dentro de un `accordion` que ya contiene 1 hijo: el
          `accordion` queda con 2 hijos, y el JSON sigue validando.
        - Reordenar dentro del mismo `container`: mover el primer hermano al final produce el
          nuevo orden esperado, sin duplicar ni perder nodos (regresión del caso ya existente).
        - Mover un nodo hacia un destino inválido (ej. un `input` fuera de un `form`): el layout
          no cambia (regresión).

- **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-tree-mutations.test.ts`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`

- **Restricciones**:
    - Reusar los helpers `heading`, `container`, `form`, `tabs`, `inputNode`, `repeater` ya
      presentes en `layout-tree-mutations.test.ts` para las fixtures unitarias.
    - Reusar el harness `renderCanvas` + `dragEnd` + `getMonacoJson` ya establecido en
      `layout-canvas-reorder-reinsert.test.tsx` para las pruebas end-to-end.
    - El helper `adjustParentPathForRemoval` debe permanecer privado al módulo
      `layout-tree-mutations.ts` (no se exporta); si el test unitario necesita ejercitarlo
      directamente, hacerlo a través de `movePathTo`.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (solo si la redacción actual
  contradice el comportamiento correcto; el spec sugiere que puede no requerir cambios).

### Criterios de finalización
- Los tests listados están en verde.
- Se cumplen los criterios de aceptación 9 a 13 de `spec.md`.
- No se han modificado `isValidDropTarget`, `insertNodeAt`, `removeNodeAt` ni el commit del
  canvas.

### Cierre de implementación
Código y tests de la tarea completos, `pnpm test --run` sobre los ficheros listados en verde, y
sin regresiones en la suite ampliada.

---

## Próxima tarea a escoger
T1 — Preservar el orden visual de hijos de `container` en modo grid dentro del modo Editor (RF1).
