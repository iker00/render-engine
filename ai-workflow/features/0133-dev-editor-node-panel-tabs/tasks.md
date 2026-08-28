# 0133 — Plan de implementación: panel de propiedades en pestañas

## Contexto de ejecución
- Contrato funcional: `spec.md` de esta carpeta (F-A del rediseño en tres features; F-B y F-C fuera de alcance).
- No hay `design.md` (`requires_design: false`): las decisiones técnicas necesarias están fijadas tarea a tarea en este plan.
- Componentes afectados hoy: `FloatingSelectionOverlay` (cabecera propia + breadcrumb + panel), `LayoutCanvasPropertiesPanel` (bloques especiales + subsecciones apiladas `SUBSECTIONS` + `submitAction` al final), `LayoutCanvasBreadcrumb`, controles simples de `property-fields/`. `ShellActionsListEditor` monta el mismo panel por fila sin `pageLayout` (FR10: hereda sin trabajo específico).
- Orden estricto: T1 → T2 → T3 → T4 → T5 → T6 → T7. Cada tarea deja la suite en verde y un estado intermedio funcional.
- Siguiente tarea a ejecutar: **T1**.

Decisiones transversales fijadas por este plan (no reabrir durante la implementación):
1. La cabecera (breadcrumb + titular + botones-icono), la fila de identidad y las pestañas viven dentro de `LayoutCanvasPropertiesPanel`, no en `FloatingSelectionOverlay`, para que `Shell` las herede sin trabajo específico (FR10). El overlay queda como contenedor posicional (`fixed inset-y-0 right-0`) que delega en el panel.
2. El breadcrumb se renderiza solo cuando el panel recibe `pageLayout` (en `Shell` no lo recibe → no hay breadcrumb, coherente con FR10). El botón "Cerrar" solo se renderiza cuando el panel recibe el nuevo prop opcional `onClose` (solo lo pasa el overlay). El botón "Eliminar nodo" conserva su condición actual (`onDeleteNode` presente).
3. La disponibilidad de pestañas se calcula en una función pura nueva (`resolveNodePanelTabs`, T1) con los mismos criterios vigentes: presencia de la subsección en `getNodeTypeJsonSchema(node.type).properties` para `Props`/`Visibilidad`/`Queries`, y `resolveAncestorContainerColumns` ≠ `null` (con `pageLayout` disponible) para `Diseño`.
4. Solo se renderiza el contenido de la pestaña activa (FR1 literal). La persistencia de valores rechazados entre pestañas (FR7) se apoya en que el estado `pendingRejections` ya vive en el panel (que no se desmonta al cambiar de pestaña); el único estado que hoy viviría dentro de un tabpanel desmontable son los avisos por fila de `LayoutSpanPropertyField`, cuyo hospedaje se sube al panel en T6.
5. La supresión del título repetido dentro de cada pestaña (FR6) se implementa con un prop opcional `hideRootLegend` que el panel pasa al despachar cada subsección: `PropertyFieldDispatcher` lo aplica solo a su nivel raíz (legend del `ObjectPropertyField` raíz en `sr-only`/omitido, sin propagarlo a la recursión) y lo reenvía al widget raíz cuando la subsección resuelve por `x-widget` (solo `ConditionGroupPropertyField` lo consume, para su propio legend raíz). Los legends anidados no cambian en T4 (su estilo se toca en T7).
6. Navegación de teclado de la barra de pestañas: flecha izquierda/derecha mueve el foco y activa la pestaña a la vez, con ajuste circular en los extremos — mismo patrón que `SegmentedTogglePropertyField` (referencia explícita de la spec, FR9).
7. Se conservan los `data-testid` existentes (`layout-canvas-properties-panel`, `layout-canvas-delete-node-button`, `dev-editor-selection-overlay-close`, `dev-editor-selection-overlay`, `layout-canvas-breadcrumb`, banners `layout-canvas-properties-panel-*-error`) aunque el elemento cambie de forma o de dueño, para acotar la migración de tests a lo estructural.
8. Medidas relativas (requisito no funcional): filas de campo con etiqueta ≈ un tercio del ancho (`w-1/3`) con mínimo en píxeles (`min-w-24`), control `flex-1 min-w-0`. Sin scroll horizontal: ningún contenedor del panel introduce `overflow-x` ni anchos fijos mayores que `max-w-sm`.

---

## T1 — Modelo puro de pestañas disponibles (`resolveNodePanelTabs`)

- **Estado**: pendiente

### Objetivo
Crear el módulo puro que decide qué pestañas existen para un nodo y en qué orden, con etiquetas exactas, como única fuente de verdad para la barra de pestañas (FR2).

Contrato a implementar en `src/dev-runtime/layout-canvas/node-panel-tabs.ts`:
- `type NodePanelTabKey = 'props' | 'layout' | 'visibility' | 'queryStateFeedback'`
- `interface NodePanelTab { key: NodePanelTabKey; label: string }`
- `resolveNodePanelTabs(node: LayoutNode, context: { pageLayout?: readonly LayoutNode[]; path: LayoutNodePath }): NodePanelTab[]`
- Etiquetas exactas por clave: `props` → `Props`, `layout` → `Diseño`, `visibility` → `Visibilidad`, `queryStateFeedback` → `Queries`. Orden fijo: `Props`, `Diseño`, `Visibilidad`, `Queries` (omitiendo las inexistentes).
- `props`/`visibility`/`queryStateFeedback` existen si `getNodeTypeJsonSchema(node.type).properties` declara esa clave como objeto (mismo criterio que el filtro actual de `SUBSECTIONS` en el panel).
- `layout` existe solo si `context.pageLayout` está definido y `resolveAncestorContainerColumns(context.pageLayout, context.path) !== null`. Sin `pageLayout` (caso `Shell`), `Diseño` no existe nunca.
- Función pura: sin estado, sin React, sin mutar `node`/`pageLayout`/`path`.

### Fuera de alcance
- Ningún componente React ni cambio en el panel (T2–T4).
- No re-testear la casuística interna de `resolveAncestorContainerColumns` (ya cubierta en `layout-canvas-ancestor-container-columns.test.ts`); aquí solo se cubre la delegación.

### Dependencias
- Ninguna. Habilita T4.

### Impacto esperado en archivos
- Código: crear `src/dev-runtime/layout-canvas/node-panel-tabs.ts`.
- Tests: crear `src/tests/dev-runtime/node-panel-tabs.test.ts`.
- Documentación: revisar `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/node-panel-tabs.test.ts` (nuevo)
- **Comportamiento cubierto**:
  - Un nodo cuyo schema declara `props`, `visibility` y `queryStateFeedback` (p. ej. `stat`), con `pageLayout` que contiene un `container` ancestro con `props.columns` en su `path`, devuelve las cuatro pestañas en orden `Props`, `Diseño`, `Visibilidad`, `Queries` con esas etiquetas literales.
  - El mismo nodo con un `pageLayout` sin ningún `container` ancestro con `columns` devuelve tres pestañas (sin `Diseño`), conservando el orden relativo.
  - El mismo nodo sin `pageLayout` en el contexto (caso `Shell`) nunca incluye `Diseño`.
  - Un nodo `hidden` devuelve exactamente `[{ key: 'props', label: 'Props' }]` (su schema no declara `layout`, `visibility` ni `queryStateFeedback`).
  - La función no muta `node`, `pageLayout` ni `path` (comparación por copia profunda antes/después).
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/node-panel-tabs.test.ts`
- **Restricciones**:
  - Sin `@testing-library/react` ni render alguno: tests de función pura.

### Documentación afectada
- `ai-workflow/docs/test-index.md` (alta del fichero nuevo).

### Criterios de finalización
- El módulo existe con el contrato literal de arriba y los tests del sub-bloque pasan.
- Ningún otro fichero de `src/` importa todavía el módulo (no hay integración en esta tarea).

### Cierre de implementación
- Código y tests de T1 completos, `pnpm test --run src/tests/dev-runtime/node-panel-tabs.test.ts` en verde.

---

## T2 — Barra de pestañas accesible (`NodePanelTabBar`)

- **Estado**: pendiente

### Objetivo
Crear el componente presentacional de la barra de pestañas con semántica `tablist`/`tab` y navegación por teclado (FR1 visual, FR9), sin integrarlo aún en el panel.

Contrato a implementar en `src/dev-runtime/layout-canvas/node-panel-tab-bar.tsx`:
- Props: `{ tabs: NodePanelTab[]; activeKey: NodePanelTabKey; onSelectTab: (key: NodePanelTabKey) => void; idPrefix: string }`.
- Contenedor `role="tablist"` con `aria-label="Secciones del nodo"`.
- Un `<button role="tab">` por pestaña, en el orden recibido, con: `id` = `` `${idPrefix}-tab-${key}` ``, `aria-controls` = `` `${idPrefix}-panel-${key}` ``, `aria-selected` según `activeKey`, roving tabindex (`tabIndex 0` solo la activa, `-1` el resto).
- Click sobre una pestaña no activa invoca `onSelectTab(key)`; sobre la ya activa, no invoca nada (idempotente).
- `ArrowRight`/`ArrowLeft` mueven el foco a la pestaña adyacente y la seleccionan a la vez (activación al mover el foco), con ajuste circular en ambos extremos — mismo patrón de teclado que `SegmentedTogglePropertyField`.
- Estilo Tailwind del diseño de referencia: pestaña activa con texto destacado y subrayado inferior (`border-b-2` o equivalente); inactivas atenuadas. Solo utilidades Tailwind.
- La barra se renderiza igual con una única pestaña.

### Fuera de alcance
- Renderizado de tabpanels y estado de pestaña activa (viven en el panel, T4).
- Cualquier lógica de disponibilidad de pestañas (T1).

### Dependencias
- T1 (tipos `NodePanelTab`/`NodePanelTabKey`). Habilita T4.

### Impacto esperado en archivos
- Código: crear `src/dev-runtime/layout-canvas/node-panel-tab-bar.tsx`.
- Tests: crear `src/tests/dev-runtime/node-panel-tab-bar.test.tsx`.
- Documentación: revisar `ai-workflow/docs/test-index.md` (fichero de test nuevo).

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/node-panel-tab-bar.test.tsx` (nuevo)
- **Comportamiento cubierto**:
  - Con cuatro pestañas: `role="tablist"` con nombre accesible, cuatro `role="tab"` en orden con sus etiquetas, `aria-selected="true"` solo en la activa, `id`/`aria-controls` con el patrón `` `${idPrefix}-tab-${key}` ``/`` `${idPrefix}-panel-${key}` ``.
  - Roving tabindex: solo la pestaña activa tiene `tabIndex 0`.
  - Click en una pestaña no activa invoca `onSelectTab` con su clave; click en la activa no invoca `onSelectTab`.
  - `ArrowRight` desde la última pestaña selecciona y enfoca la primera; `ArrowLeft` desde la primera selecciona y enfoca la última (ajuste circular); en posiciones intermedias mueve a la adyacente.
  - La pestaña activa lleva la clase de subrayado/destacado y las inactivas no.
  - Con una única pestaña, la barra se renderiza con esa pestaña activa.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/node-panel-tab-bar.test.tsx`
- **Restricciones**:
  - Componente montado aislado (sin panel ni pipeline); `onSelectTab` como spy.

### Documentación afectada
- `ai-workflow/docs/test-index.md` (alta del fichero nuevo).

### Criterios de finalización
- Componente con el contrato literal de arriba y tests en verde.
- Todavía sin uso en el panel (la integración es T4).

### Cierre de implementación
- Código y tests de T2 completos, `pnpm test --run src/tests/dev-runtime/node-panel-tab-bar.test.tsx` en verde.

---

## T3 — Cabecera del panel y fila de identidad

- **Estado**: pendiente

### Objetivo
Mover la cabecera al interior de `LayoutCanvasPropertiesPanel` (breadcrumb + titular `type` + botones-icono "Eliminar nodo" y "Cerrar") y añadir la fila de identidad `id` en solo lectura (FR4, FR5, criterios 5 y 11), dejando `FloatingSelectionOverlay` como contenedor posicional que delega.

Contrato:
- `LayoutCanvasPropertiesPanel` gana dos props opcionales: `onClose?: () => void` y `onSelectAncestor?: (path: LayoutNodePath) => void`.
- Cabecera del panel (primer bloque), de arriba abajo:
  - Línea de breadcrumb: se renderiza solo si `pageLayout !== undefined`, montando `LayoutCanvasBreadcrumb` con `pageLayout`, `path` y `onSelectAncestor` como `onSelectNode`. Comportamiento actual intacto: segmentos ancestros clicables, último segmento (nodo seleccionado) no clicable.
  - Titular: `node.type` como texto destacado (sustituye al `span` pequeño actual).
  - A la derecha, alineados: botón-icono "Eliminar nodo" (solo si `onDeleteNode`; conserva `data-testid="layout-canvas-delete-node-button"` y nombre accesible explícito `aria-label="Eliminar nodo"`; comportamiento sin cambios) y botón-icono "Cerrar" (solo si `onClose`; conserva `data-testid="dev-editor-selection-overlay-close"` y `aria-label="Cerrar panel de selección"`). Iconos compactos (texto/glifo o icono Lucide ya disponible; sin dependencia nueva).
- Fila de identidad bajo la cabecera: etiqueta "id" y el valor `('id' in node ? node.id : undefined)`; si no hay `id`, placeholder atenuado con el texto literal `Sin id`. Se renderiza con elementos no enfocables (sin `<input>`/`<button>`), con estilo de campo deshabilitado (fondo gris suave, texto atenuado).
- Restyle del breadcrumb según el diseño: segmentos ancestros atenuados, último destacado; mismos comportamientos y `data-testid`.
- `FloatingSelectionOverlay`: elimina su cabecera propia ("Selección" + botón cerrar) y su montaje directo del breadcrumb; pasa al panel `pageLayout`, `onClose={() => onSelectNode(null)}` y `onSelectAncestor={onSelectNode}`. Conserva `data-testid="dev-editor-selection-overlay"`, clases de posicionamiento (`fixed inset-y-0 right-0 … max-w-sm`) y la zona de scroll interna.
- En `Shell` (`ShellActionsListEditor`) no se pasa `pageLayout` ni `onClose`: cada fila muestra cabecera con titular + botón "Eliminar nodo", sin breadcrumb ni cerrar, sin ningún cambio en ese fichero.

### Fuera de alcance
- Barra de pestañas y tabpanels (T4); los `SUBSECTIONS` siguen apilados en esta tarea.
- Reubicación de bloques especiales (T5).
- Estilo de filas de campos y controles (T7).
- Edición del `id` (solo lectura por spec).

### Dependencias
- Ninguna sobre T1/T2 (puede implementarse tras ellas por orden del plan). Habilita T4.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`, `src/dev-runtime/layout-canvas/layout-canvas-breadcrumb.tsx`, `src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx`.
- Tests: `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (migración), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación), `src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` (ampliación), `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (regresión, posibles ajustes de selector), `src/tests/dev-runtime/shell-config-panel.test.tsx` (regresión, posibles ajustes de selector), `src/tests/dev-runtime/dev-editor-layer.test.tsx` (regresión de cierre por Esc/exclusión mutua, sin casos nuevos).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/test-index.md`.

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
  - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (ampliación/migración)
  - `src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (ampliación mínima/regresión)
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (regresión; solo ajustes de selector si aplica)
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (regresión; solo ajustes de selector si aplica)
- **Comportamiento cubierto**:
  - El panel muestra el `type` del nodo como titular destacado y el botón-icono "Eliminar nodo" con nombre accesible; sin `onDeleteNode` no hay botón (regresión del contrato actual).
  - Con `onClose`, el panel muestra el botón-icono "Cerrar" con `aria-label="Cerrar panel de selección"` que invoca `onClose`; sin `onClose` no se renderiza.
  - Con `pageLayout`, el breadcrumb se renderiza dentro del panel; clicar un segmento ancestro invoca `onSelectAncestor` con ese path; el último segmento no es clicable. Sin `pageLayout`, no hay breadcrumb.
  - Fila de identidad: nodo con `id` muestra su valor; nodo sin `id` muestra el placeholder `Sin id` atenuado; la fila no contiene ningún elemento enfocable como campo (ni `input` ni `textbox`) (criterio 5).
  - `FloatingSelectionOverlay` ya no renderiza su cabecera "Selección": el cierre se hace desde el botón del panel (mismo `data-testid`), que limpia la selección (`onSelectNode(null)`) (criterio 11).
  - Regresión: borrar el nodo desde el nuevo botón-icono sigue borrando el subárbol y limpiando la selección end-to-end (`layout-canvas-delete-node.test.tsx`).
  - Regresión `Shell`: las filas de acciones muestran el panel con titular + "Eliminar nodo" sin breadcrumb ni botón cerrar.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
- **Restricciones**:
  - No añadir dependencias nuevas para iconos: usar glifos o iconos Lucide ya presentes en el proyecto.
  - Conservar los `data-testid` listados en la decisión transversal 7.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (cabecera del panel de selección, botón cerrar, breadcrumb).
- `ai-workflow/docs/test-index.md` (descripciones de ficheros ampliados).

### Criterios de finalización
- Cabecera y fila de identidad dentro del panel con el contrato de arriba; overlay delegando; suite `dev-runtime` en verde.
- Las subsecciones siguen apiladas (sin pestañas): estado intermedio deliberado.

### Cierre de implementación
- Código y tests de T3 completos y validados con los comandos del sub-bloque en verde.

---

## T4 — Reestructuración del contenido en pestañas

- **Estado**: pendiente

### Objetivo
Sustituir el apilado vertical de `SUBSECTIONS` por la barra de pestañas + tabpanels (FR1, FR2, FR3, FR6 parcial, FR7, FR9; criterios 1–4, 7, 9 y parte del 10), migrando los tests existentes que asumen la estructura apilada.

Contrato:
- El panel calcula `tabs = resolveNodePanelTabs(node, { pageLayout, path })` (T1) y renderiza `NodePanelTabBar` (T2) bajo la fila de identidad, con `idPrefix` derivado de `useId()`.
- Estado de pestaña activa en el panel (`useState<NodePanelTabKey>`), inicial y reseteado a `tabs[0].key` cuando cambia `serializeLayoutNodePath(path)` — mismo guard render-time que ya usa `pendingRejections` (FR3). Fallback defensivo: si la clave activa no está en `tabs`, se renderiza `tabs[0]`.
- Solo se renderiza el contenido de la pestaña activa, envuelto en `<div role="tabpanel" id={`${idPrefix}-panel-${key}`} aria-labelledby={`${idPrefix}-tab-${key}`}>` (FR1, FR9).
- Mapeo de contenido por pestaña (mismo render que hoy, adaptadores de schema incluidos):
  - `props` → subsección `props` (con `resolveTabsPropsSchema`/`resolveHeadingPropsSchema`/`resolveContainerPropsSchema`/`resolveChoiceLikePropsSchema`/`resolveIconPropsSchema` intactos).
  - `layout` → subsección `layout` con `resolveLayoutSubsectionSchema` y `LayoutSpanWidgetContext.Provider` exactamente como hoy (incluida la key por `serializedPath`); `parentColumns` se sigue resolviendo con `resolveAncestorContainerColumns` en el panel.
  - `visibility` → subsección `visibility` (widget condición/grupo vía sentinel, sin cambios).
  - `queryStateFeedback` → subsección `queryStateFeedback`.
- Supresión del título repetido (FR6, decisión transversal 5): nuevo prop opcional `hideRootLegend?: boolean` en `PropertyFieldDispatcher`, aplicado solo al nivel raíz: el `ObjectPropertyField` raíz renderiza su `legend` con `sr-only` (se conserva para nombre accesible del `fieldset`), sin propagarse a la recursión; cuando la subsección resuelve a un widget por `x-widget`, el flag se reenvía al widget y solo `ConditionGroupPropertyField` lo consume (su `legend` raíz pasa a `sr-only`; el resto de widgets lo ignoran). Los nombres accesibles derivados de `label` (p. ej. `"Visibilidad — Forma"`) no cambian.
- `pendingRejections` (por subsección, `submitAction` y `containerColumnsMode`) siguen viviendo en el panel: cambiar de pestaña no los descarta ni descarta el valor mostrado; cambiar de nodo los limpia por el guard existente (FR7, criterio 7).
- Estado intermedio explícito de esta tarea: los tres bloques especiales (selector "Contenido" de `link`, selector "Modo" de `container` con su banner, bloque "Acción de envío" de `form`) se renderizan entre la fila de identidad y la barra de pestañas (visibles con cualquier pestaña). Su reubicación al principio de `Props` es T5.
- Migración mecánica de las suites que localizan subsecciones apiladas por legend: activar la pestaña correspondiente (click) antes de las aserciones existentes.

### Fuera de alcance
- Reubicación de los bloques especiales dentro de `Props` (T5).
- Persistencia de los avisos por fila internos de `LayoutSpanPropertyField` entre pestañas (T6): en esta tarea se acepta que al salir de `Diseño` ese estado interno del widget se pierde (los `pendingRejections` de subsección del panel sí persisten).
- Estilo de filas y controles (T7).
- Cualquier cambio en el pipeline de commit, en widgets dedicados (más allá del `legend` raíz de condición/grupo) o en Monaco.

### Dependencias
- T1, T2, T3. Habilita T5 y T6. Bloquea el resto del plan hasta quedar cerrada.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`, `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (prop `hideRootLegend` en el dispatcher y en `ObjectPropertyField`), `src/dev-runtime/layout-canvas/property-fields/condition-group-property-field.tsx` (prop opcional `hideRootLegend` sobre su legend raíz).
- Tests: `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (migración amplia + casos nuevos), `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (migración + FR7), `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (ampliación), `src/tests/dev-runtime/dev-editor-layer.test.tsx` (migración/regresión), `src/tests/dev-runtime/shell-config-panel.test.tsx` (migración + criterio 10), `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (ampliación), `src/tests/dev-runtime/condition-group-property-field.test.tsx` (regresión aislada: el nuevo prop opcional no altera el comportamiento por defecto).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/test-index.md`.

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación; además migración mecánica de los casos existentes a "activar pestaña antes de asertar")
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación + migración)
  - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (ampliación)
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (regresión + migración)
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación + migración)
  - `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (ampliación)
  - `src/tests/dev-runtime/condition-group-property-field.test.tsx` (ampliación mínima: regresión del legend por defecto)
- **Comportamiento cubierto**:
  - Criterio 1: nodo `stat` dentro de `container` con `columns` → cabecera + fila `id` + pestañas `Props`, `Diseño`, `Visibilidad`, `Queries`; `Props` activa (`aria-selected`) y solo su tabpanel renderizado (el contenido de las otras pestañas no está en el DOM).
  - Criterio 2: mismo nodo sin `container` ancestro con `columns` → sin pestaña `Diseño`, las otras tres presentes.
  - Criterio 3: nodo `hidden` → barra visible con solo `Props`, activa.
  - Criterio 4 / FR3: con `Visibilidad` activa, cambiar la selección a otro nodo (nuevo `path`) muestra la primera pestaña disponible del nuevo nodo activa.
  - Criterio 7 / FR7: un commit rechazado en `Visibilidad` conserva valor y aviso `role="alert"`; cambiar a `Props` y volver a `Visibilidad` conserva ambos; cambiar de nodo los limpia. Mismo criterio para un rechazo en `Props`.
  - Criterio 9 / FR9: `role="tablist"`, `role="tab"`/`aria-selected`, tabpanel con `role="tabpanel"` y `aria-labelledby` correcto; flechas izquierda/derecha mueven la pestaña activa (smoke en el panel; la matriz completa de teclado vive en `node-panel-tab-bar.test.tsx`).
  - FR6 parcial: dentro de una pestaña no se repite el título de la subsección como encabezado visible (legend raíz `sr-only` en `Props`/`Queries`/`Diseño` y en el widget de `Visibilidad`); regresión de que los nombres accesibles internos del widget de condición/grupo no cambian.
  - FR8/edición sin cambios (criterio 8, regresión): editar un campo de `Props` sigue actualizando contenido renderizado y buffer de Monaco por el pipeline actual (migración de los casos e2e existentes).
  - Caso límite: eliminar el nodo con una pestaña distinta de `Props` activa cierra el panel y limpia la selección sin errores.
  - Criterio 10 parcial: una fila de acción en `Shell` muestra la barra de pestañas sin `Diseño` y permite editar `props` y `visibility` por el pipeline de commit de `Shell`.
  - Estado intermedio: los bloques especiales (`link`/`container`/`form`) siguen visibles y operativos por encima de la barra de pestañas (se reubicarán en T5).
  - Regresión aislada: `ConditionGroupPropertyField` sin `hideRootLegend` renderiza su legend visible como hasta ahora.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/condition-group-property-field.test.tsx`
- **Restricciones**:
  - La migración de casos existentes debe limitarse a activar la pestaña pertinente y ajustar selectores; no reescribir la intención de los tests migrados.
  - "Solo su contenido renderizado" se asierta por ausencia en el DOM (`queryBy* === null`), no por visibilidad CSS.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (panel de propiedades: pestañas, FR1–FR3, FR6–FR7, FR9; sección `Shell`).
- `ai-workflow/docs/test-index.md` (descripciones de ficheros migrados/ampliados).

### Criterios de finalización
- Panel en pestañas con el contrato de arriba; toda la suite del proyecto en verde (la migración de tests queda incluida en esta tarea).
- Los bloques especiales permanecen sobre la barra (estado intermedio documentado).

### Cierre de implementación
- Código y tests de T4 completos; comandos del sub-bloque y `pnpm test` global en verde.

---

## T5 — Bloques especiales al principio de la pestaña `Props`

- **Estado**: pendiente

### Objetivo
Reubicar los tres bloques especiales dentro del tabpanel de `Props`, antes de los campos generados por el dispatcher (FR6, criterio 6; caso límite `link` en `Shell`).

Contrato:
- Dentro del tabpanel `Props`, en este orden: (1) selector "Contenido" de `link`, (2) selector "Modo" de `container` con su `CommitRejectionBanner`, (3) bloque "Acción de envío" de `form` (con su banner), y después los campos de la subsección `props` del dispatcher. Cada bloque solo existe para su tipo de nodo, igual que hoy.
- El bloque "Acción de envío" deja de renderizarse al final del panel; conserva su clave de rechazo `submitAction`, su `data-testid` de banner y su edición completa vía selector de variante.
- Ningún bloque especial se renderiza fuera del tabpanel `Props` ni con otra pestaña activa.
- Sin cambios de comportamiento en los propios bloques (mismos componentes, mismas mutaciones de nodo completo).

### Fuera de alcance
- Cualquier cambio en `LinkContentModePropertyField`, `ContainerColumnsModePropertyField` o el schema de `submitAction`.
- Estilo de los bloques (T7 no los toca tampoco: conservan su aspecto actual, F-B).

### Dependencias
- T4. Habilita T6/T7 (por orden; no hay dependencia técnica dura con T6).

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`.
- Tests: `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación), `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación), `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/test-index.md`.

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)
  - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación)
- **Comportamiento cubierto**:
  - Criterio 6: en un `form`, "Acción de envío" aparece dentro del tabpanel `Props` y antes de los campos del dispatcher; en un `link`, el selector "Contenido"; en un `container`, el selector "Modo". Con una pestaña distinta de `Props` activa, ninguno de los tres está en el DOM.
  - Orden en el DOM: bloque especial antes que el primer campo de `props` del dispatcher.
  - Regresión de feedback: un commit rechazado del selector "Modo" o de "Acción de envío" muestra su aviso dentro de `Props`, persiste al cambiar de pestaña y volver, y se limpia al cambiar de nodo (mismo mecanismo `pendingRejections` de T4).
  - Caso límite `Shell`: un `link` en la lista de acciones del header muestra el selector "Contenido" al principio de su pestaña `Props`, editable por el pipeline de `Shell`.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
- **Restricciones**:
  - Reusar los harnesses/fixtures ya existentes de esos ficheros; no crear fichero de test nuevo.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (ubicación de los selectores "Contenido"/"Modo" y "Acción de envío").
- `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- Los tres bloques viven al principio del tabpanel `Props` y solo ahí; suite en verde.

### Cierre de implementación
- Código y tests de T5 completos; comandos del sub-bloque en verde.

---

## T6 — Persistencia entre pestañas de los avisos por fila de `layout.span`

- **Estado**: pendiente

### Objetivo
Cumplir FR7 también en la pestaña `Diseño`: los avisos de commit rechazado por fila del widget `layout-span` (y el valor tecleado) deben sobrevivir a un cambio de pestaña dentro del mismo nodo, subiendo la propiedad del estado del widget al panel.

Contrato:
- `LayoutSpanWidgetContext` amplía su valor con: `rowRejections: Partial<Record<RuntimeLayoutBreakpoint | 'base', { value: string; error: RuntimeConfigError }>>` y `onRowCommitResult(breakpoint, attemptedValue, result)` (nombres exactos ajustables al vocabulario ya usado por el widget, manteniendo la semántica: el estado vive fuera del widget).
- `LayoutSpanPropertyField` deja de mantener su mapa interno de rechazos con `useState` y pasa a leer/escribir por el contexto. Comportamiento observable por fila sin cambios (aviso con código/mensaje, valor tecleado conservado, independencia entre filas).
- `LayoutCanvasPropertiesPanel` hospeda ese estado y lo limpia cuando cambia `serializeLayoutNodePath(path)` (mismo guard que `pendingRejections`), de modo que cambiar de nodo limpia los avisos (FR7) y cambiar de pestaña no. La key de remount del provider por `serializedPath` puede conservarse: el estado ya no vive en el widget.
- Aspecto visual del widget intacto (F-B fuera de alcance).

### Fuera de alcance
- Cualquier otro cambio en el widget `layout-span` (filas, cascada, denominadores).
- Persistencia de estado interno de otros widgets (ninguno más mantiene rechazos internos).

### Dependencias
- T4. Independiente de T5.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/property-fields/layout-span-widget-context.ts`, `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx`, `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`.
- Tests: `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (migración del harness al contexto ampliado + regresión completa), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/test-index.md`.

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (ampliación/migración del harness)
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- **Comportamiento cubierto**:
  - Regresión completa del widget aislado con el harness migrado: aviso `role="alert"` por fila con código/mensaje al rechazar, valor tecleado conservado, independencia entre filas, limpieza al commitear con éxito esa fila.
  - End-to-end en el panel: un commit de `span` rechazado en `Diseño` muestra su aviso; cambiar a `Props` y volver a `Diseño` conserva el aviso y el valor tecleado de esa fila; cambiar de nodo seleccionado lo limpia.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
- **Restricciones**:
  - Migrar el harness existente del fichero del widget (provee `LayoutSpanWidgetContext`) sin reescribir la intención de sus casos.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nota sobre persistencia del aviso por fila entre pestañas).
- `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- Estado de rechazos por fila hospedado en el panel; FR7 cumplido también para `Diseño`; suite en verde.

### Cierre de implementación
- Código y tests de T6 completos; comandos del sub-bloque en verde.

---

## T7 — Estilo base de filas y controles simples

- **Estado**: pendiente

### Objetivo
Aplicar el lenguaje visual base del diseño de referencia a las filas de campo y a los controles simples del panel (FR8, criterio 12, requisitos no funcionales), sin tocar los widgets dedicados.

Contrato:
- Crear un wrapper de fila compartido `src/dev-runtime/layout-canvas/property-fields/property-field-row.tsx`: `label` a la izquierda con `w-1/3 min-w-24 shrink-0` (aprox. un tercio, mínimo en píxeles) y el control a la derecha con `flex-1 min-w-0`; alineación vertical centrada para controles de una línea y al inicio para `textarea`.
- Migrar a ese wrapper los cinco controles simples: `TextPropertyField` (input texto), `NumberPropertyField` (input numérico), `EnumPropertyField` (select), `RawJsonPropertyField` (textarea), `BooleanPropertyField` (checkbox a la derecha de la etiqueta-izquierda, sin invertir el binding `htmlFor`).
- Re-estilar los controles con el estilo de tarjeta del diseño: fondo blanco, borde sutil (`border-gray-200`/`300`), esquinas redondeadas (`rounded-md`), tipografía compacta (`text-xs`/`text-sm`), estados `focus` coherentes. Solo utilidades Tailwind, sin estilos inline ni tokens nuevos.
- Headers de grupo en mayúsculas: los `legend` de `ObjectPropertyField` y `ArrayPropertyField` anidados (los raíz están en `sr-only` desde T4) pasan a estilo de header de grupo (`uppercase tracking-wide text-[11px] text-gray-500` o tokens Tailwind equivalentes).
- Sin scroll horizontal en el panel: ninguna fila introduce anchos fijos que excedan el contenedor; los indicadores `*` de requerido se mantienen.
- Los widgets dedicados (`layout-span`, `choice-items`, icon picker, segmented, condición/grupo, clave-valor) y los bloques especiales conservan su aspecto actual (F-B): esta tarea no toca sus ficheros.

### Fuera de alcance
- Re-skin de widgets dedicados y bloques especiales (F-B).
- Cambios de comportamiento en cualquier control (solo presentación y estructura de fila).
- Theming/tokes globales nuevos en `src/app/index.css`.

### Dependencias
- T4 (los legends raíz ya están suprimidos; los anidados quedan como únicos legends visibles). Última tarea del plan.

### Impacto esperado en archivos
- Código: crear `src/dev-runtime/layout-canvas/property-fields/property-field-row.tsx`; modificar `text-property-field.tsx`, `number-property-field.tsx`, `enum-property-field.tsx`, `boolean-property-field.tsx`, `raw-json-property-field.tsx`, `property-field-dispatcher.tsx` (clases de legends anidados en `ObjectPropertyField`/`ArrayPropertyField`), todos bajo `src/dev-runtime/layout-canvas/property-fields/`.
- Tests: `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación), regresión del resto de suites de `dev-runtime` que montan estos controles (solo ajustes de selector si alguno asertaba clases).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/test-index.md`.

### Tests
- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
- **Comportamiento cubierto**:
  - Cada control simple (string, number, enum, boolean, textarea de respaldo) renderiza la estructura de fila: etiqueta a la izquierda con las clases de ancho (`w-1/3` y mínimo en píxeles) y control con `flex-1 min-w-0` (criterio 12: etiqueta con ancho mínimo, control flexible, sin desbordamiento).
  - La asociación `label`/control (`htmlFor`/`id`) y los comportamientos de edición existentes no cambian (regresión sobre los casos ya presentes del fichero).
  - Un `legend` de grupo anidado (objeto dentro de una subsección) lleva las clases de header en mayúsculas.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (regresión)
- **Restricciones**:
  - Aserciones de estilo limitadas a las clases estructurales de la fila y del legend (no capturar la lista completa de clases decorativas, que quedaría frágil).
  - No añadir snapshots.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (estilo base de filas/controles del panel).
- `ai-workflow/docs/test-index.md`.

### Criterios de finalización
- Filas etiqueta-izquierda y controles re-estilados en todo el panel (y por herencia en los formularios de `Shell` que reutilizan estos controles), sin scroll horizontal; widgets dedicados intactos; suite completa en verde con el umbral de cobertura del 80%.

### Cierre de implementación
- Código y tests de T7 completos; comandos del sub-bloque y `pnpm test` global en verde.
