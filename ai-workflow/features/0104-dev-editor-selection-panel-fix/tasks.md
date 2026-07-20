# Tasks: 0104 — Fix del panel flotante de selección del editor visual

Contrato de ejecución secuencial de la feature. Cada tarea es atómica, revisable de forma
independiente y se cierra con sus tests en verde antes de pasar a la siguiente.

Orden recomendado: T1 → T2 → T3.

Referencias transversales:

- `ai-workflow/standards/testing-rules.md` fija el umbral global de cobertura (80% sobre `src/`)
  y las reglas de nombrado/organización de tests. No se repite por tarea.
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` es el documento funcional
  afectado por todas las tareas; su actualización real se hace fuera de este plan, invocando
  `update-app-documentation` una vez cerrada la implementación.

---

## T1 — Rediseñar `FloatingSelectionOverlay` como panel lateral derecho fijo con scroll interno y botón de cierre

### Estado

completada

### Objetivo

Sustituir el anclaje del overlay junto al nodo por un panel `position: fixed` acoplado al borde
derecho del viewport, con altura próxima a la completa del viewport, scroll vertical interno
propio cuando su contenido excede esa altura, y un botón de cierre visible que limpia la
selección al pulsarse.

Concretamente:

- El contenedor externo del overlay pasa a usar clases análogas a `FloatingMonacoPanel`
  (`fixed inset-y-0 right-0 z-[9999]`, columna flex, con `max-h`/altura que cubra el 90–100%
  del viewport y `overflow-y-auto` en la zona de contenido) manteniendo los mismos
  `data-testid` y estructura interna reutilizada (breadcrumb + panel de propiedades ya
  existentes, sin tocar su contenido).
- La cabecera del panel muestra un botón "Cerrar" (icono `✕`, `aria-label` explícito,
  `data-testid` propio del panel de selección) que invoca `onSelectNode(null)` al pulsarse.
  Esto reutiliza la vía ya existente para limpiar la selección (borrar nodo, cambiar de página):
  no se introduce un segundo canal.
- Se elimina toda la lógica de anclaje al `data-node-path` del nodo: `useLayoutEffect` que
  busca el `anchorElement`, `ResizeObserver` que mide el propio panel, `useAnchoredPosition` y
  el `style` calculado en runtime. El panel deja de necesitar el atributo `data-node-path`
  del nodo seleccionado para colocarse.
- La condición de renderizado se simplifica a "hay `selectedPath` y `selectedNode` resuelve";
  la degradación segura cuando el nodo desaparece del árbol (ya cubierta por `DevEditorLayer`
  vía `useEffect` sobre `activePageLayout`, ver `dev-editor-layer.tsx:96-103`) sigue siendo
  responsable de limpiar `selectedPath`.
- Al quedar `overlay-anchor-position.ts` sin consumidores (solo lo importa este componente),
  se elimina el módulo y su fichero de test asociado, y se actualiza `test-index.md`
  quitando la entrada de `overlay-anchor-position.test.ts`.

### Fuera de alcance

- Cambiar el contenido del breadcrumb o del panel de propiedades (secciones, campos,
  dispatcher de schema, botón "Eliminar nodo", edición en vivo).
- Añadir manejo de `Esc` (T3) o exclusión mutua con Monaco (T2).
- Tocar el pipeline de commit (`onCommitNodeUpdate`, `onDeleteNode`, `onCommitCanvasMutation`)
  o la resolución de `selectedPath` en `DevEditorLayer`.
- Persistencia de estado del panel entre modos o entre sesiones.

### Dependencias

Ninguna. Punto de entrada de la feature.

### Impacto esperado en archivos

- Código:
  - `src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx` (modificar): reescritura
    del contenedor visual, cabecera con botón "Cerrar", eliminación de `useAnchoredPosition`,
    `ResizeObserver`, búsqueda por `data-node-path` y `style` dinámico. Se conserva la
    identidad de props (`pageLayout`, `selectedPath`, `onSelectNode`, `onCommitNodeUpdate`,
    `onDeleteNode`); no se añaden props nuevas en esta tarea.
  - `src/dev-runtime/floating-toolbar/overlay-anchor-position.ts` (eliminar): módulo sin uso
    tras la eliminación de la lógica de anclaje.
- Tests:
  - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (ampliación): reemplazar los
    casos basados en anclaje/`ResizeObserver`/clamping por casos de panel lateral derecho,
    scroll interno y botón de cierre.
  - `src/tests/dev-runtime/overlay-anchor-position.test.ts` (eliminar): sin código fuente que
    cubrir.
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (sin cambios en esta tarea):
    los tests existentes que solo comprueban visibilidad del overlay por modo
    (`renders FloatingSelectionOverlay anchored to the selected node once in editor mode`,
    `hides the overlay when switching back to visual`) deben seguir en verde tras el rediseño
    porque siguen leyendo por `data-testid="dev-editor-selection-overlay"`.
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: la sección
    "Overlay flotante de selección" deja de ser exacta (el panel ya no se ancla junto al
    nodo). Se actualiza en la fase documental posterior con `update-app-documentation`.
  - `ai-workflow/docs/test-index.md`: quitar la entrada de `overlay-anchor-position.test.ts`.

### Tests

- **Ficheros de test**:
  - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (ampliación).
  - `src/tests/dev-runtime/overlay-anchor-position.test.ts` (eliminado; tras la tarea no
    debe existir).
- **Comportamiento cubierto**:
  - No renderiza nada cuando `selectedPath` es `null` (regresión ya cubierta que debe
    conservarse).
  - No renderiza nada cuando `selectedPath` no resuelve a un nodo dentro de `pageLayout`
    (regresión ya cubierta que debe conservarse; degradación segura si el árbol cambió por
    debajo).
  - Con `selectedPath` válido, renderiza un contenedor con `data-testid="dev-editor-selection-overlay"`
    que tiene `position: fixed` acoplado al borde derecho (verificable por clases Tailwind
    `fixed`, `right-0` e `inset-y-0` o equivalente) y no depende de la presencia de un
    elemento con `data-node-path`.
  - La zona de contenido del panel expone `overflow-y-auto` de manera que el scroll interno
    quede habilitado cuando el contenido excede la altura del panel (verificable por clase
    Tailwind en el subárbol del contenido, sin depender del layout real de jsdom).
  - Renderiza el breadcrumb (`data-testid="layout-canvas-breadcrumb"`) y el panel de
    propiedades (`data-testid="layout-canvas-properties-panel"`) sin cambios de contrato
    respecto a los tests actuales de forwarding de ediciones y borrado.
  - Renderiza un botón de cierre visible con `data-testid` propio del panel de selección y
    `aria-label` explícito; al pulsarlo, invoca `onSelectNode` con `null` exactamente una vez.
  - Ya no ejerce las expectativas actuales de posicionamiento anclado (`top`/`left`
    calculados desde el rect del anchor, clamping en la esquina inferior derecha,
    reposicionamiento al cambiar de anchor); esos casos se eliminan porque el comportamiento
    ha desaparecido.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
- **Restricciones**:
  - No introducir mocks de `ResizeObserver`: el nuevo componente no debe depender de él.
  - Reusar los helpers ya presentes en el fichero (`buildLayout`, `HEADING_PATH`,
    `renderOverlay`) para minimizar el diff; solo eliminar los específicos de anclaje
    (`AnchorFixture`, `setViewport`, `MockResizeObserver`) si dejan de tener consumidores tras
    la reescritura.

### Documentación afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Overlay flotante
  de selección" (queda desactualizada; se resuelve en la pasada documental posterior).
- `ai-workflow/docs/test-index.md` — quitar entrada de `overlay-anchor-position.test.ts`.

### Criterios de finalización

- `FloatingSelectionOverlay` renderiza un panel `fixed` acoplado al borde derecho, con scroll
  interno propio y botón "Cerrar" que limpia la selección vía `onSelectNode(null)`.
- `overlay-anchor-position.ts` y su fichero de test han desaparecido del repositorio.
- Tests del punto anterior en verde. `pnpm test` global en verde con cobertura ≥ 80%.

### Cierre de implementación

Código y tests de T1 completos y validados con `pnpm test --run` sobre los ficheros
indicados y `pnpm test` global en verde.

---

## T2 — Introducir exclusión mutua entre panel de selección y panel de Monaco en `DevEditorLayer`

### Estado

completada

### Objetivo

Garantizar que el lado derecho de la pantalla muestra como máximo un panel a la vez (panel de
selección o panel de Monaco), añadiendo la exclusión mutua bidireccional en `DevEditorLayer`
sin tocar el motor de commit ni el estado de Monaco fuera de `DevRuntimeReady`.

Concretamente:

- Cuando el usuario selecciona un nodo en modo Editor mientras `monacoOpen` es `true`,
  `DevEditorLayer` invoca `onMonacoOpenChange(false)` antes o junto con la actualización de
  `selectedPath`. El nodo queda seleccionado y el panel de Monaco desaparece.
- Cuando el usuario abre Monaco desde el botón de la barra flotante mientras existe una
  selección activa, `DevEditorLayer` limpia la selección (`setSelectedPath(null)` y
  `setHoveredPath(null)`) antes o junto con la propagación de `onMonacoOpenChange(true)`. El
  panel de Monaco aparece y el panel de selección desaparece con el resaltado eliminado.
- Ambas transiciones se hacen en el mismo commit de React (usar un handler compuesto en
  `DevEditorLayer`; no se requiere `flushSync` porque los setters son de React 18 y el batching
  los coalesce automáticamente).

Interfaz de props del componente:

- Se conserva la firma actual (`monacoOpen`, `onMonacoOpenChange`). No hace falta pasar
  ninguna prop nueva desde `DevRuntimeReady`; solo cambia el punto en que `DevEditorLayer`
  invoca a `onMonacoOpenChange` y a los setters internos.
- El `onSelectNode` que se pasa a `FloatingSelectionOverlay` y a `LayoutEditModeProvider`
  ya no es directamente `setSelectedPath`, sino un handler que además invoca
  `onMonacoOpenChange(false)` cuando corresponda.
- El `onOpenMonaco` que se pasa a `DevEditorFloatingToolbar` ya no es
  `() => onMonacoOpenChange(true)`, sino un handler que además limpia la selección cuando
  corresponda.

### Fuera de alcance

- Manejo de `Esc` (T3).
- Modificar el contenido del panel de Monaco o su gestión de estado en `DevRuntimeReady`
  (`monacoOpen`, `editorBuffer`, `handleApply`, HMR, guardia de cambios aplicados).
- Cambios en la paleta flotante de nodos o en su relación con los otros paneles.
- Reordenar la mounting jerarquía de paneles.

### Dependencias

Debe hacerse después de T1 para que los tests del panel lateral y el botón de cierre estén
ya en su forma final; T2 no reescribe `FloatingSelectionOverlay` pero sus tests observan el
mismo `data-testid` que T1 establece.

### Impacto esperado en archivos

- Código:
  - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar): introducir el
    handler compuesto de selección (`handleSelectNode`) que invoca `onMonacoOpenChange(false)`
    cuando el nuevo `path !== null` y `monacoOpen` es `true`; introducir el handler compuesto
    de apertura de Monaco (`handleOpenMonaco`) que llama a `setSelectedPath(null)` y
    `setHoveredPath(null)` antes de `onMonacoOpenChange(true)`. Ajustar las props que se
    pasan a `LayoutEditModeProvider`, a `FloatingSelectionOverlay` y a
    `DevEditorFloatingToolbar` (`onOpenMonaco`).
- Tests:
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación): nuevo `describe` que
    cubre las dos direcciones de exclusión mutua.
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: se actualiza en la fase
    documental posterior para reflejar la exclusión mutua.

### Tests

- **Ficheros de test**:
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Con `monacoOpen: true` en el harness, seleccionar un nodo (click sobre `probe-node-a`)
    provoca que la prop `onMonacoOpenChange` se invoque con `false` exactamente una vez y
    que el harness actualice su estado local `monacoOpen` a `false`; `selectedPath` termina
    apuntando al nodo clicado. `DevEditorLayer` no renderiza `FloatingMonacoPanel` (vive en
    `DevRuntimeReady`, ver comentario de contrato en `dev-editor-layer.tsx:22-25`), así que
    el efecto observable es la invocación de la prop, no la ausencia de un DOM ajeno al
    componente bajo prueba.
  - Con una selección activa y `monacoOpen: false`, clicar el botón de apertura de Monaco
    de la barra (`dev-editor-toolbar-monaco-toggle`) provoca que `onMonacoOpenChange` se
    invoque con `true` exactamente una vez y que `selectedPath` quede a `null` en el mismo
    commit. En el DOM: no queda ningún elemento con
    `data-testid="dev-editor-selection-overlay"`.
  - Sin selección activa y con `monacoOpen: false`, seleccionar un nodo no invoca a
    `onMonacoOpenChange` (regresión: la exclusión mutua no dispara cuando ya está en el
    estado correcto).
  - Con `monacoOpen: true` y sin selección activa, abrir Monaco desde la barra no invoca a
    `setSelectedPath`/`setHoveredPath` con valores distintos de `null`, ni resetea otros
    estados observables del harness (regresión mínima de ruido).
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
- **Restricciones**:
  - Reusar el `DevEditorLayerHarness` ya existente y extenderlo con un contador o `spy`
    sobre `onMonacoOpenChange` (envolviendo `setMonacoOpen`); no crear un segundo harness
    paralelo.
  - No cambiar la semántica de los describes ya en verde en este fichero; añadir un
    describe nuevo agrupando los casos de exclusión mutua.

### Documentación afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — se actualiza en la pasada
  documental posterior.

### Criterios de finalización

- Seleccionar un nodo con Monaco abierto cierra Monaco y muestra el panel de selección del
  nodo elegido.
- Abrir Monaco con panel de selección visible cierra la selección y muestra Monaco.
- Los describes existentes del fichero de test siguen en verde.
- `pnpm test` global en verde con cobertura ≥ 80%.

### Cierre de implementación

Código y tests de T2 completos y validados con `pnpm test --run` sobre los ficheros
indicados y `pnpm test` global en verde.

---

## T3 — Extender el manejo de `Esc` para cerrar el panel de selección cuando Monaco no está abierto

### Estado

completada

### Objetivo

Ampliar el manejador de teclado global para que, con el panel de selección visible y el
panel de Monaco cerrado, pulsar `Esc` cierre el panel de selección con el mismo efecto que
el botón de cierre añadido en T1 (limpia la selección). Preservar el comportamiento vigente
para Monaco: si Monaco está abierto, `Esc` sigue cerrando Monaco y no toca la selección.

Concretamente:

- El manejador `Esc` vive hoy en `dev-runtime.tsx` (ver `dev-runtime.tsx:246-257`) pero solo
  tiene visibilidad del estado de Monaco. Como el estado de la selección vive en
  `DevEditorLayer`, el nuevo comportamiento se implementa dentro de `DevEditorLayer`
  añadiendo un `useEffect` propio que registra un listener global de `keydown` en `document`,
  invocando `setSelectedPath(null)` y `setHoveredPath(null)` cuando: `event.key === 'Escape'`
  y `selectedPath !== null` y `monacoOpen === false`. El listener actual de Monaco en
  `dev-runtime.tsx` se conserva intacto.
- Convivencia de listeners: ambos escuchan `keydown` en `document` de forma independiente.
  Cuando Monaco está abierto, la guarda `selectedPath !== null && monacoOpen === false` deja
  que solo el listener de Monaco actúe. Cuando Monaco está cerrado y hay selección, solo el
  listener de `DevEditorLayer` actúa. Cuando ninguno está activo, `Esc` no produce efecto
  (regresión ya vigente).
- No se introduce shortcut adicional ni se reintroduce el toggle global `Ctrl/Cmd+Shift+J`
  eliminado en 0103.

### Fuera de alcance

- Fusionar los dos listeners en uno solo (queda como refactor opcional futuro; T3 no toca
  el fichero de Monaco para minimizar riesgo de regresión en el flujo de Aplicar/HMR).
- Añadir un shortcut alternativo (p. ej. `Supr`) para eliminar el nodo seleccionado o para
  otras acciones — expresamente excluido por spec de 0102/0103.
- Cambiar el comportamiento del botón "Cerrar" añadido en T1.

### Dependencias

Debe hacerse después de T1 (la vía `onSelectNode(null)` que el botón "Cerrar" instala se
reutiliza como referencia mental del comportamiento esperado) y de T2 (el mismo componente
`DevEditorLayer` recibe cambios en T2; hacerlo después evita conflictos en el mismo
`useEffect`/handler).

### Impacto esperado en archivos

- Código:
  - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar): añadir un
    `useEffect` que registra el listener `keydown` en `document` con la guarda descrita y
    lo desregistra en el cleanup. Dependencias del effect: `selectedPath`, `monacoOpen`.
- Tests:
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación): nuevo `describe` que
    cubre el nuevo comportamiento de `Esc`.
  - `src/tests/dev-runtime/dev-runtime.test.tsx` (revisión, sin ampliación esperada): el
    describe existente que cubre "`Esc` cierra Monaco" (ver
    `dev-runtime.tsx:246-257`) debe seguir en verde tras el cambio; si no hay describe
    dedicado, dejarlo cubierto exclusivamente por el describe existente que ya verificaba
    el comportamiento de Monaco.
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: se actualiza en la pasada
    documental posterior para reflejar el nuevo cierre por `Esc` del panel de selección.

### Tests

- **Ficheros de test**:
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
- **Comportamiento cubierto**:
  - Con `monacoOpen: false` y una selección activa, disparar `keydown` con `key: 'Escape'`
    en `document` limpia la selección: el overlay
    (`data-testid="dev-editor-selection-overlay"`) desaparece y la lectura del contexto
    `selectedPath` a través del `EditModeProbe` pasa a `null`.
  - Con `monacoOpen: true` y una selección activa, disparar `keydown` con `key: 'Escape'`
    no limpia la selección: el overlay sigue en el DOM y `selectedPath` sigue apuntando al
    mismo nodo (la responsabilidad de reaccionar a `Esc` en ese estado sigue siendo del
    listener de Monaco, que no vive en este componente).
  - Con `monacoOpen: false` y sin selección activa, disparar `keydown` con `key: 'Escape'`
    no produce ningún efecto observable (los setters no se invocan; el estado del harness
    no cambia). Este caso puede verificarse con una lectura estable del contexto tras el
    evento.
  - Al desmontar `DevEditorLayer` (o el harness que lo renderiza), el listener queda
    desregistrado: un `keydown` posterior no toca el estado del harness (verificable
    disparando el evento tras un `unmount`).
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
- **Restricciones**:
  - Usar `fireEvent.keyDown(document, { key: 'Escape' })` para disparar el evento, mismo
    patrón que el resto de la carpeta.
  - No introducir un hook nuevo tipo `useDevRuntimeKeyboard`; el listener vive inline en
    `DevEditorLayer` como un `useEffect` autocontenido, coherente con el patrón ya usado
    en `dev-runtime.tsx` para `Esc` de Monaco.

### Documentación afectada

- `ai-workflow/docs/app-features/development/dev-mode-editor.md` — se actualiza en la pasada
  documental posterior.

### Criterios de finalización

- Con el panel de selección visible y Monaco cerrado, `Esc` cierra el panel de selección y
  limpia la selección.
- Con Monaco abierto, `Esc` sigue cerrando Monaco sin afectar a la selección.
- Sin ningún panel abierto, `Esc` no produce efecto.
- `pnpm test` global en verde con cobertura ≥ 80%.

### Cierre de implementación

Código y tests de T3 completos y validados con `pnpm test --run` sobre los ficheros
indicados y `pnpm test` global en verde.

---

## Siguiente tarea

T1 — Rediseñar `FloatingSelectionOverlay` como panel lateral derecho fijo con scroll interno
y botón de cierre.
