# Tasks: edición visual de `steps` en dev-editor y gating de avance por API

Contrato de ejecución para la feature descrita en `spec.md` y `design.md` (decisiones D1-D8). Cada tarea debe implementarse en el orden indicado. Los sub-bloques `Interfaces` declaran los contratos exactos que unas tareas exponen a otras; no inventar firmas distintas de las aquí declaradas.

Siguiente tarea a escoger: **T1**.

---

## T1 — Modelo de path `stepItem` en `layout-node-path.ts`

### Objetivo
Añadir el paso de path `stepItem` como paralelo estructural de `tabItem` (design D1): nueva variante de `LayoutPathStep`, resolución en `getNodeAtPath`, serialización/deserialización de `LayoutNodePath`, y el campo `stepItemIndex` en `LayoutCanvasDropZone` con su serialización de id de drop zone.

### Fuera de alcance
- Cualquier cambio en el comportamiento o los tests de `tabItem` (deben seguir pasando sin modificación).
- Mutaciones de árbol (`insertNodeAt`/`movePathTo`) — eso es T2.
- Validez de drop (`isValidDropTarget`) — eso es T3.
- Cualquier cambio en `StepsNode` o en componentes de render — eso es T4.

### Dependencias
Ninguna. Es la tarea base de la que dependen T2, T3 (indirectamente, vía el nuevo campo `stepItemIndex`) y T4.

### Interfaces

**Consume**: ninguno.

**Produce**:
- `LayoutPathStep` (unión, en `src/runtime/layout-node-path.ts`) gana el miembro `{ field: 'stepItem'; itemIndex: number; index: number }` — consumido por: T2, T4.
- `getNodeAtPath(rootNodes: readonly LayoutNode[], path: LayoutNodePath): LayoutNode | null` — comportamiento ampliado (misma firma) para resolver el paso `stepItem` leyendo `currentNode.type === 'steps'` y `props.items[itemIndex].children` — sin consumidores directos declarados en este plan (uso transversal ya existente del símbolo).
- `serializeLayoutNodePath(path: LayoutNodePath): string` / `deserializeLayoutNodePath(serialized: string): LayoutNodePath | null` — comportamiento ampliado (misma firma) para el token `stepItem.{itemIndex}.{index}` — sin consumidores directos declarados en este plan.
- `LayoutCanvasDropZone` (interfaz, mismo fichero) gana `stepItemIndex?: number`, paralelo y mutuamente excluyente en la práctica con `tabItemIndex?: number` — consumido por: T5 (vía `parseDropZoneId`).
- `serializeDropZoneId(zone: LayoutCanvasDropZone): string` / `parseDropZoneId(id: string): LayoutCanvasDropZone | null` — comportamiento ampliado (misma firma) para soportar el sufijo `:stepItem.{n}` simétrico al ya existente `:tabItem.{n}` — consumido por: T5.

### Impacto esperado en archivos
- Código: `src/runtime/layout-node-path.ts`.
- Tests: `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (ampliación).
- Documentación: ninguna directamente (el impacto documental de la capacidad completa se registra en T4/T5).

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (ampliación).

**Comportamiento cubierto**:
- `getNodeAtPath` resuelve un nodo bajo un paso `stepItem` válido (`currentNode.type === 'steps'`, `itemIndex` en rango).
- `getNodeAtPath` devuelve `null` si el paso `stepItem` apunta a un nodo que no es `steps`.
- `getNodeAtPath` devuelve `null` si `itemIndex` o `index` del paso `stepItem` están fuera de rango.
- `serializeLayoutNodePath`/`deserializeLayoutNodePath` hacen round-trip con un path que incluye un paso `stepItem`, produciendo el token `stepItem.{itemIndex}.{index}`.
- Un path con `tabItem` sigue serializando/deserializando exactamente igual que antes (regresión explícita, mismo test file, para blindar que la discriminación por `step.field` no rompe el caso `tabItem`).
- `serializeDropZoneId`/`parseDropZoneId` hacen round-trip con `stepItemIndex` definido, produciendo/leyendo el sufijo `:stepItem.{n}`.
- `parseDropZoneId` sobre un id con sufijo `:tabItem.{n}` sigue devolviendo `tabItemIndex` (no `stepItemIndex`) — regresión explícita.

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`

**Restricciones**:
- La resolución en `getNodeAtPath` deja de poder usar `tabItem` como rama final por descarte implícito, porque ahora hay dos variantes finales (`tabItem` y `stepItem`): discriminar explícitamente por `step.field` en vez de añadir un segundo fallback implícito.

### Documentación afectada
Ninguna en esta tarea (módulo interno sin superficie funcional propia).

### Criterios de finalización
`LayoutPathStep`, `getNodeAtPath`, `serializeLayoutNodePath`/`deserializeLayoutNodePath` y `LayoutCanvasDropZone`/`serializeDropZoneId`/`parseDropZoneId` soportan `stepItem` de forma simétrica a `tabItem`, sin regresión en el comportamiento de `tabItem`.

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test --run` del fichero anterior en verde).

---

## T2 — Mutaciones de árbol: `withStepItemChildren` y `stepItemIndex`/`toStepItemIndex`

### Objetivo
Añadir a `layout-tree-mutations.ts` el helper `withStepItemChildren` (espejo de `withTabItemChildren`) y las opciones `stepItemIndex`/`toStepItemIndex` en `insertNodeAt`/`movePathTo`, con una rama `parentNode.type === 'steps'` estructuralmente idéntica a la ya existente para `'tabs'` (design D2).

### Fuera de alcance
- Cualquier cambio en el comportamiento o los tests de la rama `tabs` existente.
- Validez de drop (`isValidDropTarget`) — T3.
- El wiring real de drag&drop del dev-editor que invoca estas funciones — T5.

### Dependencias
T1 (usa la variante `stepItem` de `LayoutPathStep`).

### Interfaces

**Consume**:
- `LayoutPathStep` variante `{ field: 'stepItem'; itemIndex: number; index: number }` (de T1).

**Produce**:
- `withStepItemChildren(node: LayoutNode, itemIndex: number, children: LayoutNode[]): LayoutNode` (privada, no exportada, espejo de `withTabItemChildren`) — sin consumidores directos declarados (uso interno del módulo).
- `InsertNodeAtOptions` gana `stepItemIndex?: number` — consumido por: T5.
- `MovePathToOptions` gana `toStepItemIndex?: number` — consumido por: T5.
- `insertNodeAt(rootNodes: readonly LayoutNode[], parentPath: LayoutNodePath, index: number, newNode: LayoutNode, options?: InsertNodeAtOptions): LayoutNode[]` — comportamiento ampliado (misma firma) — consumido por: T5.
- `movePathTo(rootNodes: readonly LayoutNode[], fromPath: LayoutNodePath, toParentPath: LayoutNodePath, toIndex: number, options?: MovePathToOptions): LayoutNode[]` — comportamiento ampliado (misma firma) — consumido por: T5.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-tree-mutations.ts`.
- Tests: `src/tests/dev-runtime/layout-tree-mutations.test.ts` (ampliación).
- Documentación: ninguna directamente.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-tree-mutations.test.ts` (ampliación).

**Comportamiento cubierto**:
- `replaceNodeAt` reemplaza un nodo localizado con un paso `stepItem` (paralelo al caso existente de `tabItem`).
- `replaceNodeAt` lanza si un paso `stepItem` apunta a un nodo que no es `steps`.
- `insertNodeAt` inserta en `items[stepItemIndex].children`, creando el array si no existe.
- `insertNodeAt` lanza si el nodo destino es `steps` y no se pasa `options.stepItemIndex`.
- `insertNodeAt` lanza si se pasa `options.stepItemIndex` sobre un nodo destino que no es `steps`.
- `insertNodeAt` lanza si `options.stepItemIndex` está fuera de rango de `props.items`.
- `movePathTo` mueve un nodo desde dentro de un panel de `steps` hacia un container hermano fuera de `steps`.
- `movePathTo` reanida un nodo raíz dentro del panel activo (por índice) de un `steps` que ya tiene un hijo.
- `movePathTo` mueve un nodo entre dos paneles del mismo `steps` (de `items[0].children` a `items[1].children`).
- Los casos de `tabItem` ya existentes en el fichero siguen pasando sin modificación (regresión).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-tree-mutations.test.ts`

**Restricciones**:
- Seguir la misma organización en 4 grupos (`replaceNodeAt`, `insertNodeAt`, `removeNodeAt`, `movePathTo`) que ya usa el fichero para los casos de `tabItem`, añadiendo los casos de `stepItem` como bloques hermanos dentro de esos mismos `describe`, no como un fichero o `describe` raíz nuevo.

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
`insertNodeAt`/`movePathTo` soportan `stepItemIndex`/`toStepItemIndex` de forma simétrica a `tabItemIndex`/`toTabItemIndex`, sin regresión en el comportamiento de `tabs`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3 — Validez de drop: rama `steps` en `isValidDropTarget`

### Objetivo
Añadir la opción `targetStepItemIndex` y una rama `targetParentNode.type === 'steps'` en `layout-drop-validity.ts`, estructuralmente idéntica a la ya existente para `'tabs'` (design D3): exige el índice, valida rango, y trata el destino como aceptador sin restricción de tipo (como `container`).

### Fuera de alcance
- Cualquier cambio en el comportamiento o los tests de la rama `tabs` existente.
- Cambios en `hasFormAncestor` (design D3: no requiere cambios, el recorrido de ancestros ya vigente encuentra el `form` porque `steps` solo existe dentro de `form`).
- El wiring real de drag&drop del dev-editor que invoca `isValidDropTarget` — T5.

### Dependencias
Ninguna dependencia técnica de T1/T2 (esta rama no consume ninguna firma producida por ellas, solo añade una opción y una rama de tipo). Se secuencia después de T1/T2 por continuidad temática del mecanismo `stepItem`.

### Interfaces

**Consume**: ninguno.

**Produce**:
- `IsValidDropTargetOptions` gana `targetStepItemIndex?: number` — consumido por: T5.
- `isValidDropTarget(pageLayout: readonly LayoutNode[], draggedPath: LayoutNodePath | null, targetParentPath: LayoutNodePath, targetIndex: number, options?: IsValidDropTargetOptions): boolean` — comportamiento ampliado (misma firma) — consumido por: T5.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-drop-validity.ts`.
- Tests: `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación).
- Documentación: ninguna directamente.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación).

**Comportamiento cubierto**:
- Rechaza un drop sobre un `steps` sin `targetStepItemIndex`.
- Rechaza un drop con `targetStepItemIndex` fuera de rango de `props.items`.
- Acepta un drop de un nodo cualquiera (p. ej. `heading`) con `targetStepItemIndex` válido sobre un `steps` que vive dentro de `form`.
- Rechaza un drop con `targetStepItemIndex` definido sobre un nodo destino que no es `steps`.
- Acepta un drop de un nodo exclusivo de formulario (p. ej. `input`) con `targetStepItemIndex` válido, ya que el `steps` destino vive dentro de `form` (a diferencia del caso de `tabs`, no hace falta un caso "sin ancestro form" porque `steps` fuera de `form` no es un config válido).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts`

**Restricciones**:
- Añadir los casos como un nuevo `describe('isValidDropTarget: steps target disambiguation', ...)` hermano del ya existente `'isValidDropTarget: tabs target disambiguation'`, replicando su estructura de casos.

### Documentación afectada
Ninguna en esta tarea.

### Criterios de finalización
`isValidDropTarget` acepta/rechaza destinos `steps` de forma simétrica a `tabs`, sin regresión en el comportamiento de `tabs`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4 — `StepsNode` gana `path` y lo propaga con `stepItem` (selección de hijos)

### Objetivo
Dar a `StepsNode` un `path` propio y propagarlo al panel activo con un paso `stepItem`, igual que `TabsNode` (design D4): `layout-node-renderer.tsx` pasa `path` en su rama `steps`; `StepsNode`/`StepsNodeContent` ganan la prop `path?: LayoutNodePath`; el panel activo se renderiza con `LayoutRenderer` pasando `buildChildPath` (que añade el paso `stepItem` con `itemIndex: effectiveActiveIndex`) y `parentStepItemIndex`; `layout-renderer.tsx` reenvía ese índice como `stepItemIndex` a las drop zones generadas alrededor de cada hijo. Esto resuelve la selección individual de hijos exigida por el requisito 3 de la spec.

### Fuera de alcance
- El wiring de mutación real de drag&drop (`insertNodeAt`/`movePathTo` desde el dev-editor) — T5.
- Cualquier cambio en el comportamiento de `TabsNode`/`AccordionNode`.
- Detección de modo Editor para navegación libre / gating de `handleNext` — T6.

### Dependencias
T1 (usa la variante `stepItem` de `LayoutPathStep`).

### Interfaces

**Consume**:
- `LayoutPathStep` variante `{ field: 'stepItem'; itemIndex: number; index: number }` (de T1).

**Produce**:
- `StepsNodeProps` (en `src/runtime/nodes/steps-layout-node.tsx`) gana `path?: LayoutNodePath` — consumido por: T6 (mismo componente, prop ya disponible), T8, T9 (indirectamente, mismo componente).
- `StepsNodeContentProps` (mismo fichero) gana `path?: LayoutNodePath` — mismos consumidores.
- `LayoutRendererProps` (en `src/runtime/layout-renderer.tsx`) gana `parentStepItemIndex?: number`, paralelo a `parentTabItemIndex` — sin consumidores directos declarados en este plan más allá de esta misma tarea.
- El componente interno que genera las drop zones alrededor de cada hijo en `layout-renderer.tsx` reenvía `parentStepItemIndex` como `stepItemIndex` en cada `LayoutCanvasDropZone` que construye — sin firma pública nueva (comportamiento del mismo módulo).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/steps-layout-node.tsx`, `src/runtime/layout-node-renderer.tsx`, `src/runtime/layout-renderer.tsx`.
- Tests: `src/tests/layout-renderer/layout-renderer-steps-edit-mode.test.tsx` (nuevo).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-steps-edit-mode.test.tsx` (nuevo).

**Comportamiento cubierto**:
- Bajo `LayoutEditModeProvider`, un nodo dentro de `items[0].children` del paso activo (paso 1) expone un `data-node-path` cuyo último tramo es `stepItem` con `itemIndex: 0`.
- Tras cambiar el paso activo al paso 2 (por el indicador clicable o por "Siguiente" con campos válidos), un nodo dentro de `items[1].children` expone `data-node-path` con `itemIndex: 1`.
- Sin `LayoutEditModeProvider`, el `steps` cambia de paso con normalidad pero ningún hijo expone `data-node-path` en ningún paso.
- Un click sobre un hijo del panel activo lo selecciona (mismo mecanismo de wrapper ya testeado genéricamente para `tabItem`).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-steps-edit-mode.test.tsx`

**Restricciones**:
- Modelar el fichero como paralelo directo de `src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx` (mismos tres casos base: paso activo con `stepItem`, cambio de paso expone `stepItem` distinto, sin provider no hay `data-node-path`).

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md`: la ficha del nodo `steps` en la sección de dominio `Layout` gana selección individual de hijos, como ya tiene `tabs`.

### Criterios de finalización
Los hijos del panel activo de un `steps` son seleccionables individualmente en modo Editor con un `path` resuelto correctamente, sin afectar al comportamiento de `tabs`/`accordion`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5 — Wiring de drag&drop del dev-editor para `steps`

### Objetivo
Completar el drag&drop end-to-end sobre paneles de `steps`: `layout-canvas-dnd-context.tsx` gana `targetStepItemIndex` en `LayoutCanvasDropAttempt`, poblado desde `zone.stepItemIndex` en `parseDropAttempt`, y lo pasa a `isValidDropTarget` en `handleDragOver`; `dev-editor-layer.tsx` lee `targetStepItemIndex` del attempt y lo pasa como `stepItemIndex`/`toStepItemIndex` a `insertNodeAt`/`movePathTo` en `handleDropAttempt`. Cubre los requisitos 1 y 2 de la spec (insertar desde la paleta en un panel concreto; reordenar/reanidar dentro y entre paneles del mismo `steps`, y desde/hacia otros contenedores).

### Fuera de alcance
- Cualquier cambio en el comportamiento de drag&drop de `tabs`.
- Selección de hijos (ya resuelta en T4).

### Dependencias
T2 (`insertNodeAt`/`movePathTo` con `stepItemIndex`/`toStepItemIndex`), T3 (`isValidDropTarget` con `targetStepItemIndex`), T4 (las drop zones con `stepItemIndex` deben existir en el DOM renderizado para que haya un destino real sobre el que soltar).

### Interfaces

**Consume**:
- `LayoutCanvasDropZone.stepItemIndex` / `parseDropZoneId(id: string): LayoutCanvasDropZone | null` (de T1).
- `insertNodeAt(rootNodes, parentPath, index, newNode, options?: InsertNodeAtOptions)` con `options.stepItemIndex` (de T2).
- `movePathTo(rootNodes, fromPath, toParentPath, toIndex, options?: MovePathToOptions)` con `options.toStepItemIndex` (de T2).
- `isValidDropTarget(pageLayout, draggedPath, targetParentPath, targetIndex, options?: IsValidDropTargetOptions)` con `options.targetStepItemIndex` (de T3).
- Drop zones renderizadas con `stepItemIndex` alrededor de los hijos del panel activo de `steps` (de T4).

**Produce**:
- `LayoutCanvasDropAttempt` (en `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx`) gana `targetStepItemIndex?: number` — sin consumidores directos declarados en este plan (consumido internamente por `handleDragOver`/`handleDropAttempt` del propio flujo).

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-dnd-context.tsx`, `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`.
- Tests: `src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` (ampliación), `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación), `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx` (ampliación).
- `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación).
- `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Arrastrar un nodo `input` desde la paleta hasta el panel de un paso de un `steps` dentro de `form` lo inserta en `props.items[i].children` de ese paso (paralelo al caso de inserción en panel de `tabs`, si existe, o como caso nuevo análogo a la inserción en `container`/`form`).
- Reanidar un nodo raíz dentro del panel activo de un `steps` que ya tiene un hijo deja ese panel con 2 hijos (paralelo exacto al caso ya existente de `tabs`).
- Arrastrar un nodo entre dos paneles de un mismo `steps` (de `items[0].children` a `items[1].children`) lo mueve correctamente (paralelo exacto al caso ya existente de `tabs`, "reanida entre items de un mismo tabs").
- Un drop attempt sobre un `steps` sin `targetStepItemIndex` resuelto no aplica ninguna mutación (regresión de la validez ya cubierta en T3, verificada aquí a nivel de wiring end-to-end).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/dev-runtime/layout-canvas-dnd-wiring.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`

**Restricciones**:
- Modelar los casos de `layout-canvas-reorder-reinsert.test.tsx` como paralelos directos de los dos casos ya existentes de `tabs` en ese mismo fichero (reanidar 1 hijo existente, mover entre dos items), usando `stepItemIndex` en vez de `tabItemIndex` en el helper de arrastre del test.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Reglas de destino de drop (modo Editor)" gana `steps` junto a `tabs` como aceptador de hijos condicionado a un índice de item.

### Criterios de finalización
Insertar desde la paleta y reordenar/reanidar nodos dentro y entre paneles de un `steps` funciona end-to-end en el dev-editor, sin regresión en `tabs`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6 — Detección de modo Editor y gating de navegación suspendido en `StepsNode`

### Objetivo
`StepsNode` detecta el modo Editor con `useLayoutEditModeContext()` (mismo patrón que `AccordionNode`) y suspende dos gatings mientras está activo (design D5): el indicador clicable deja de exigir `position <= maxVisitedPosition`, y `handleNext` deja de ejecutar `validateFormFields` (y no ejecuta `onNext`, ver T8), avanzando `activeIndex` directamente al siguiente paso visible sin tocar `maxVisitedIndex`. Cubre los requisitos 4, 6 y 7 de la spec.

### Fuera de alcance
- Cualquier cambio en el comportamiento de `handleBack` (ya es libre, sin gating, sin cambios).
- Cualquier cambio en el gating de modo Visual (requisito 5 de la spec: sin cambios, cubierto ya por los tests existentes de `layout-renderer-steps.test.tsx`).
- Ejecución real de `onNext` — T7/T8/T9.

### Dependencias
Ninguna dependencia técnica de T1-T5 (usa exclusivamente `useLayoutEditModeContext()`, ya existente, y estado local del propio componente). Se secuencia después de T4 por continuidad de edición del mismo fichero (`steps-layout-node.tsx`), sin consumir ninguna firma que T4 produzca.

### Interfaces

**Consume**: ninguno (usa `useLayoutEditModeContext(): LayoutEditModeContextValue | null`, ya existente en `src/runtime/use-layout-edit-mode-context.ts`, no producido por ninguna tarea de este plan).

**Produce**: ninguno reutilizable por firma explícita. `handleNext` gana una rama de retorno anticipado para modo Editor (antes de la validación de campos); T8 depende de que esta rama ya exista antes de añadir el flujo async de `onNext` a la rama de modo Visual, como dependencia de continuidad de edición, no de firma.

### Impacto esperado en archivos
- Código: `src/runtime/nodes/steps-layout-node.tsx`.
- Tests: `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/app-features/nodes/steps.md`.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Bajo `LayoutEditModeProvider`, en un `steps` de 3 pasos sin haber avanzado nunca por "Siguiente", pulsar el paso 3 en el indicador (`horizontal`/`vertical`) lo activa inmediatamente, sin exigir validación de los pasos 1 y 2.
- Bajo `LayoutEditModeProvider`, pulsar "Siguiente" en un paso con campos inválidos avanza igualmente al siguiente paso visible (sin mostrar errores de validación).
- Bajo `LayoutEditModeProvider`, pulsar "Siguiente" en un paso con `onNext` declarado no dispara ninguna llamada real (verificación de que `executeQueryOperation` no se invoca; puede aserirse aquí con un mock incluso antes de que T7/T8 añadan el campo `onNext` al schema, usando un nodo construido directamente en el test sin pasar por validación, o diferirse a T8 si resulta más simple con el schema ya disponible — decisión de implementación, no bloqueante).
- El comportamiento de modo Visual (gating de indicador por `maxVisitedIndex`, bloqueo de "Siguiente" con campos inválidos) sigue exactamente igual (regresión ya cubierta por los tests existentes del fichero, sin necesidad de duplicarla).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-steps.test.tsx`

**Restricciones**:
- Añadir los casos como un nuevo `describe('Edit mode', ...)` dentro del fichero existente, reutilizando el mismo patrón de montaje con `LayoutEditModeProvider` que ya usan `layout-renderer-accordion-edit-mode.test.tsx`/`layout-renderer-tabs-edit-mode.test.tsx` para otros nodos.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Excepción explícita: interactividad local de `accordion` y `tabs`" gana `steps` (navegación libre entre pasos en modo Editor).
- `ai-workflow/docs/app-features/nodes/steps.md`: sección de comportamiento en modo Editor.

### Criterios de finalización
En modo Editor, cualquier paso visible de un `steps` es alcanzable sin gating de validación ni de `maxVisitedIndex`, sin cambiar el comportamiento en modo Visual.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T7 — Contrato de validación de `onNext`

### Objetivo
Añadir `props.items[i].onNext` al contrato de `steps`, con el mismo shape de campos que ya usa `executeOperation` (design D6): schema Zod, tipos TS, normalización en el validador narrativo, y las dos comprobaciones cruzadas ya existentes para otros consumidores de `executeOperation` (`operationName` debe existir en `api`; si la operación es `GET`, `onNext` no puede declarar `body`).

### Fuera de alcance
- Ejecución real de `onNext` en runtime — T8/T9.
- Corregir el gap preexistente de `findInvalidActionTarget`/`validateExecutionRequestParamsInCollection` que no recorre `tabs.props.items[i].children`/`steps.props.items[i].children` (riesgo residual ya señalado por el design; `onNext` no depende de ese recorrido porque cuelga de `props.items[i]`, no de `children`).

### Dependencias
Ninguna.

### Interfaces

**Consume**: ninguno.

**Produce**:
- `StepOnNextAction` (nueva interfaz en `src/config/runtime-config-types.ts`, junto a `StepsItem`): `{ operationName: string; query?: RuntimeApiQuery; body?: RuntimeApiBodyValue; headers?: RuntimeApiHeaders }` (mismo shape que `ExecuteOperationRuntimeUiAction` sin el campo `type`) — consumido por: T8, T9.
- `StepsItem.onNext?: StepOnNextAction` (campo nuevo en la interfaz `StepsItem` ya existente, mismo fichero) — consumido por: T8, T9.
- `stepOnNextActionSchema` (nuevo export Zod en `src/config/runtime-config-zod.ts`, reutilizando los mismos schemas de campo que ya usa `executeOperationRuntimeUiActionSchema`: `nonEmptyStringSchema`, `runtimeApiQuerySchema`, `runtimeApiBodySchema`, `runtimeApiHeadersSchema`) — sin consumidores directos declarados (uso interno de `stepsItemSchema`).

### Impacto esperado en archivos
- Código: `src/config/runtime-config-zod.ts` (schema `stepOnNextActionSchema` + campo `onNext` en `stepsItemSchema`), `src/config/runtime-config-types.ts` (tipo `StepOnNextAction` + campo `onNext` en `StepsItem`), `src/config/validate-steps-node.ts` (normalización de `rawItem.onNext` y mapeo de errores de shape con ruta `props.items[N].onNext...`), `src/config/validate-actions-visibility.ts` (nueva rama `node.type === 'steps'` en `findInvalidActionTarget` que valida `item.onNext.operationName` contra `operationNames` para cada item, sin recorrer `item.children`), `src/config/validate-form-request-params.ts` (nueva rama `node.type === 'steps'` en `validateExecutionRequestParamsInCollection` que valida GET+body para cada `item.onNext`).
- Tests: `src/tests/config-validation/runtime-config-validation-steps.test.ts` (ampliación).
- Documentación: `ai-workflow/docs/app-features/config/validation.md`, `ai-workflow/docs/app-features/nodes/steps.md`.

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-steps.test.ts` (ampliación).

**Comportamiento cubierto**:
- Acepta un item de `steps` con `onNext` declarando solo `operationName` (obligatorio).
- Acepta un item de `steps` con `onNext` declarando `operationName`, `query`, `body` y `headers`.
- Rechaza un `onNext` sin `operationName` o con `operationName` vacío.
- Rechaza un `onNext.operationName` que no existe en `api`.
- Rechaza un `onNext` con `body` cuando la operación referenciada es `GET`.
- Acepta un `onNext` sin `body` cuando la operación referenciada es `GET`.
- Un item de `steps` sin `onNext` sigue validando exactamente igual que antes (regresión, ya cubierta por los casos existentes del fichero).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/config-validation/runtime-config-validation-steps.test.ts`

**Restricciones**:
- Reutilizar literalmente los schemas de campo ya factorizados (`nonEmptyStringSchema`, `runtimeApiQuerySchema`, `runtimeApiBodySchema`, `runtimeApiHeadersSchema`) en vez de declarar un shape nuevo o duplicado para `onNext`.
- La nueva rama en `validateExecutionRequestParamsInCollection` (`validate-form-request-params.ts`) debe seguir exactamente el mismo patrón que las ramas ya existentes de `button`/`form` en ese fichero: early return con `enrichedInvalidLayoutFromNode(mensaje, nodeBreadcrumb, node)` y mensaje `Page "{pageId}" has an invalid layout at "{path}.props.items[{itemIndex}].onNext.body": GET operations do not support body.`.
- La nueva rama en `findInvalidActionTarget` (`validate-actions-visibility.ts`) sigue un patrón distinto, propio de esa función: **no** construye ningún mensaje de texto. Debe devolver early return el mismo objeto estructurado que ya devuelven las ramas de `button`/`link` — `{ path: string; type: 'navigateTo' | 'executeOperation'; target: string; breadcrumb: BreadcrumbSegment[]; node: LayoutNode }` — con `path: `${nodePath}.props.items[${itemIndex}].onNext``, `type: 'executeOperation'` (sin necesidad de un tercer valor de `type`, ya que el mensaje final que compone su único llamador `validateActionTargets` para `'executeOperation'` — "unknown operation" — ya es válido para `onNext`) y `target: item.onNext.operationName`. No construir el mensaje dentro de `findInvalidActionTarget`.

### Documentación afectada
- `ai-workflow/docs/app-features/config/validation.md`: nueva sección de reglas de `onNext` en `steps`.
- `ai-workflow/docs/app-features/nodes/steps.md`: contrato de `props.items[i].onNext`.

### Criterios de finalización
`onNext` es un campo opcional válido, tipado y cross-validado en `steps.props.items[i]`, sin afectar al comportamiento de un item sin `onNext`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T8 — Ejecución de `onNext` en paso intermedio (`handleNext` async)

### Objetivo
`handleNext` (rama de modo Visual, tras superar la validación de campos ya existente) ejecuta `onNext` cuando el item activo lo declara, con estado de carga, bloqueo de avance en error, mensaje de error inline, y guard de respuesta obsoleta (design D7).

### Fuera de alcance
- El botón del último paso (`type="submit"` vs `type="button"` con `onNext` + `requestSubmit()`) — T9.
- Cualquier cambio en el comportamiento de un item sin `onNext` (debe seguir exactamente igual).
- Reintento automático (fuera de alcance de la spec): el usuario debe volver a pulsar "Siguiente".

### Dependencias
T6 (la rama de modo Editor de `handleNext` ya debe existir con su retorno anticipado antes de añadir el flujo async de `onNext` a la rama de modo Visual), T7 (`StepsItem.onNext?: StepOnNextAction`), T4 (`StepsNodeContentProps` ya tiene `path` — sin relación directa de firma, pero es el mismo componente ya modificado).

### Interfaces

**Consume**:
- `StepsItem.onNext?: StepOnNextAction` (de T7).

**Produce**:
- `runStepOnNextGate(targetIndex: number, onNext: StepOnNextAction): Promise<{ status: 'success' } | { status: 'blocked' }>` — función interna de `StepsNodeContent` (no exportada del módulo, pero con firma estable dentro del componente) que encapsula: marcar `isOnNextPending = true`, llamar a `executeQueryOperation(onNext.operationName, { snapshotState: readRuntimeState(), requestParams: { query: onNext.query, body: onNext.body, headers: onNext.headers }, iterationContext })`, comparar `targetIndex` contra una ref que siempre refleja el paso activo vigente (si difieren, descartar el resultado sin tocar `onNextError` ni el paso — devolver `{ status: 'blocked' }`), fijar `onNextError` con `result.error.message` y devolver `{ status: 'blocked' }` si `result.status === 'error'`, limpiar `onNextError` y devolver `{ status: 'success' }` si `result.status === 'success'`, y volver a `isOnNextPending = false` en cualquier desenlace no descartado — consumido por: T9.
- `StepsNodeContentProps` gana `executeQueryOperation: ReturnType<typeof useRuntimeStateActions>['executeQueryOperation']` y `readRuntimeState: ReturnType<typeof useRuntimeStateActions>['readRuntimeState']`, hilvanados desde `StepsNode` igual que ya se hace con `initializeForm`/`setFormFieldError` — consumido por: T9 (mismo componente).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/steps-layout-node.tsx`.
- Tests: `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/nodes/steps.md`, `ai-workflow/docs/app-features/queries/execution.md`.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Un paso con `onNext` apuntando a una operación que responde con éxito: al pulsar "Siguiente" con campos válidos, el paso avanza tras la respuesta (no antes, mientras está `loading` el botón permanece deshabilitado).
- Un paso con `onNext` apuntando a una operación que responde `http-error`: el paso no avanza y aparece un mensaje de error inline junto a los botones de navegación con `error.message`.
- Un paso con `onNext` apuntando a una operación `api` con `errorCondition` que se cumple: el paso no avanza y se muestra el error de negocio (`business-error-condition`) correspondiente.
- Mientras `onNext` está `loading`, el botón "Siguiente" está deshabilitado y muestra un indicador de carga.
- Reintentar `onNext` tras un error (pulsar "Siguiente" de nuevo sin cambiar de paso) relanza la operación y reemplaza el mensaje de error anterior por el resultado del nuevo intento, sin acumular mensajes.
- Un paso con campos inválidos bloquea antes de disparar `onNext` (la validación de campos sigue teniendo prioridad; puede verificarse con un mock de `executeQueryOperation` no invocado).
- Guard de respuesta obsoleta: si el usuario navega a otro paso (por ejemplo "Atrás", que la spec no bloquea durante `loading`) mientras `onNext` del paso anterior sigue en vuelo, la respuesta tardía no avanza ningún paso ni muestra ningún error.
- Un item de `steps` sin `onNext` no ejecuta ninguna llamada al pulsar "Siguiente" (regresión, ya cubierta por los casos existentes del fichero, sin necesidad de duplicarla).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-steps.test.tsx`

**Restricciones**:
- Añadir los casos como un nuevo `describe('onNext (intermediate step)', ...)` dentro del fichero existente.
- Mockear `fetch`/la capa de red igual que ya hace el resto del fichero para las operaciones `api`, sin introducir un mecanismo de mock paralelo.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/steps.md`: comportamiento de `onNext` en paso intermedio, estados de carga/error.
- `ai-workflow/docs/app-features/queries/execution.md`: mención de `steps.props.items[i].onNext` como nuevo disparador de `executeQueryOperation`.

### Criterios de finalización
Un paso intermedio con `onNext` gatea correctamente el avance según el resultado de la query, sin afectar a un paso sin `onNext`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T9 — Ejecución de `onNext` en el último paso (`requestSubmit()`)

### Objetivo
Cuando el item del último paso declara `onNext`, el botón de envío se renderiza como `type="button"` con un `onClick` que valida los campos del paso, ejecuta `onNext` con el mismo gating de T8, y si resuelve en éxito dispara `event.currentTarget.form?.requestSubmit()` para reutilizar sin modificar el pipeline de submit ya existente de `form-layout-node.tsx` (design D8). Cuando el item no declara `onNext`, el botón sigue siendo exactamente `type="submit"` sin `onClick` interceptor.

### Fuera de alcance
- Cualquier cambio en `form-layout-node.tsx`/`handleSubmit` (el pipeline de submit no se modifica; solo se dispara desde un punto distinto cuando hay `onNext`).
- Cualquier mecanismo de merge entre el resultado de `onNext` y el payload del submit final del `form`.

### Dependencias
T8 (`runStepOnNextGate`, `StepsNodeContentProps.executeQueryOperation`/`.readRuntimeState`).

### Interfaces

**Consume**:
- `runStepOnNextGate(targetIndex: number, onNext: StepOnNextAction): Promise<{ status: 'success' } | { status: 'blocked' }>` (de T8).

**Produce**: ninguno (punto final de integración; no expone ninguna firma reutilizable por tareas posteriores).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/steps-layout-node.tsx`.
- Tests: `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/nodes/steps.md`.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-steps.test.tsx` (ampliación).

**Comportamiento cubierto**:
- El último paso de un `steps` con `onNext` resolviendo en error: `submitAction` del `form` padre no se dispara (mock de `fetch` no invocado para la operación de submit).
- El mismo caso con `onNext` resolviendo en éxito: `submitAction` se dispara a continuación con el payload agregado habitual (mismo comportamiento que sin `onNext`).
- Mientras `onNext` del último paso está `loading`, el botón de envío está deshabilitado.
- Un último paso sin `onNext` sigue siendo `type="submit"` sin interceptor y dispara `submitAction` exactamente igual que antes (regresión, ya cubierta por el caso existente "submit (payload agregado)" del fichero, sin necesidad de duplicarla).
- El botón "Atrás" nunca dispara `onNext`, ni en el paso intermedio ni en el último paso (regresión explícita).

**Comandos durante la implementación**:
- `pnpm test --run src/tests/layout-renderer/layout-renderer-steps.test.tsx`

**Restricciones**:
- Añadir los casos como un nuevo `describe('onNext (last step submit)', ...)` dentro del fichero existente.
- No introducir un segundo pipeline de submit: el único punto de disparo real hacia `queries.{submitOperationName}` sigue siendo `form-layout-node.tsx` vía `requestSubmit()`.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/steps.md`: comportamiento de `onNext` en el último paso, integración con `submitAction` del `form` padre.

### Criterios de finalización
El botón del último paso gatea el submit real del `form` según el resultado de `onNext` cuando está declarado, sin cambiar el comportamiento de un último paso sin `onNext`.

### Cierre de implementación
Código y tests de esta tarea completos y validados. Cierre de la feature a nivel de implementación: con T9 cerrada, los tres bloques de requisitos funcionales de la spec (drag&drop/selección, navegación libre en modo Editor, gating de avance por `onNext`) quedan completos.
