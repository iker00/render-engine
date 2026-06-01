# `0044-modal-node` — Plan de tareas

> Contrato de ejecución secuencial. Cada tarea es una unidad atómica, verificable, y describe explícitamente su alcance, archivos impactados, tests y cierre. La implementación debe abordar las tareas en orden; no avanzar a la siguiente sin cerrar la implementación de la anterior. La actualización documental se concentra en una pasada posterior (`update-app-documentation`) usando las anotaciones de impacto documental que cada tarea deja registradas.

## Siguiente tarea recomendada
`T1` — Contrato Zod y tipos públicos del nodo `modal` y de las acciones `openModal` y `closeModal`.

---

## T1. Contrato Zod, tipos y dispatcher para `modal`, `openModal` y `closeModal`

- **Estado**: done
- **Objetivo**: Extender el contrato estructural del runtime config con el nuevo nodo `modal` y con las acciones `openModal` y `closeModal`, sin abrir todavía validaciones cruzadas ni render. Mantener la frontera de `src/config/` intacta como punto único de validación de shape.
- **Fuera de alcance**:
  - Validaciones cruzadas (unicidad de `modal.id`, referencias `modalId`, prohibición de `defaultOpen: true` dentro de `repeater.props.template`).
  - Tipos de runtime-state, ejecutor de acciones, renderer ni utilidades de estilo.
  - Cualquier cambio en documentación funcional o en `current-state.md`.
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/runtime-config-types.ts`: añadir `ModalLayoutNode`, `ModalLayoutNodeProps`, `ModalSize` (`'sm' | 'md' | 'lg'`), `OpenModalRuntimeUiAction`, `CloseModalRuntimeUiAction`. Extender `LayoutNode`, `LayoutNodeType`, `RuntimeUiAction` y `RuntimeUiActionType`.
    - `src/config/runtime-config-zod.ts`: añadir `modalNodeSchema` (con `id`, `props.size` opcional dentro de catálogo cerrado, `props.defaultOpen` opcional booleano, `children` opcional), `openModalRuntimeUiActionSchema` y `closeModalRuntimeUiActionSchema` (ambos con `modalId` string no vacío). Incluir `modal` en `supportedNodeTypes`.
    - `src/config/runtime-config.ts` (o equivalente de re-exports): exponer los nuevos tipos y schemas en la superficie pública del módulo, manteniendo compatibilidad con los re-exports actuales.
  - Tests:
    - `src/tests/config-validation/runtime-config-root-zod.test.ts`: ampliar con casos de aceptación del shape mínimo de `modal` y de las dos nuevas acciones a nivel de schema raíz.
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - Schema acepta nodo `modal` con `id` válido y sin `props`.
  - Schema acepta `modal` con `props.size` en `sm | md | lg` y con `defaultOpen` booleano.
  - Schema rechaza `modal` sin `id` o con `id` no string.
  - Schema rechaza `props.size` fuera del catálogo y `props.defaultOpen` no booleano (sin examinar todavía el mensaje exacto de la validación cruzada).
  - Schema acepta `openModalRuntimeUiActionSchema` y `closeModalRuntimeUiActionSchema` con `modalId` no vacío, y los rechaza si `modalId` falta o está vacío.
- **Documentación afectada**: ninguna en esta tarea. Las fichas funcionales se actualizan en la pasada de `update-app-documentation`.
- **Criterios de finalización**:
  - El runtime config compila con los nuevos tipos y schemas.
  - Los tests del schema raíz pasan.
  - `pnpm test` no introduce regresiones.
- **Cierre de implementación**: tipos + schemas + entradas en `supportedNodeTypes` + tests de schema en verde.
- **Cierre documental**: ninguno.

---

## T2. Validación estática de layout y validaciones cruzadas para `modal`

- **Estado**: done
- **Objetivo**: Hacer que el runtime config valide el shape del nodo `modal` con sus reglas (`id`, `size`, `defaultOpen`, hijos permitidos, `visibility`, `queryStateFeedback`), las nuevas acciones `openModal` y `closeModal` (shape), y las reglas cruzadas: unicidad de `modal.id` en toda la configuración, validez de referencias `modalId` desde botones, y prohibición de `defaultOpen: true` dentro de `repeater.props.template`. Mantener todo error con la ruta diagnóstica esperada.
- **Fuera de alcance**:
  - Estado runtime, ejecutor de acciones, renderer.
  - Cambios en otros catálogos no relacionados con la feature.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/config/validate-layout-nodes.ts`: añadir `validateModalNode` (parse vía `modalNodeSchema`, validación de `children` permitidos —`container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater`—, validación de `visibility` y `queryStateFeedback` con sus helpers existentes); enchufar `modal` al `switch` principal de `validateLayoutNode`; aceptar `modal` como hijo válido en las colecciones que ya aceptan otros nodos visibles (root layout, `container.children`, `repeater.props.template`); incluir `modal` en cualquier set/array de tipos válidos que se use al describir hijos.
    - `src/config/validate-actions-visibility.ts`: aceptar `openModal` y `closeModal` en `validateRuntimeUiAction`, devolver el shape ya tipado y producir errores con `${path}.modalId` o `${path}.type` según corresponda.
    - `src/config/validate-runtime-config.ts`: nueva pasada cruzada `validateModalReferences` que:
      - recolecta todos los `modal.id` declarados en el árbol layout (incluyendo dentro de `repeater.props.template`),
      - rechaza ids duplicados en toda la configuración con `Page "X" has an invalid layout at "<path>.id"`,
      - rechaza acciones `openModal`/`closeModal` cuyo `modalId` no exista, con error en `<path>.modalId`,
      - rechaza `modal.defaultOpen: true` cuando el nodo se declara en cualquier descendiente de `repeater.props.template`, con error en `<path>.props.defaultOpen`.
    - `src/config/runtime-config-validation-errors.ts`: si hace falta un helper específico para el mensaje, añadirlo aquí. No introducir mensajes ad hoc fuera del módulo.
  - Tests:
    - `src/tests/config-validation/runtime-config-validation-modal.test.ts` (nuevo, área temática propia): aceptación y rechazo de shape, `children` permitidos/no permitidos, `visibility` y `queryStateFeedback` sobre `modal`, unicidad de `modal.id`, referencias `modalId` válidas e inválidas, prohibición de `defaultOpen: true` dentro de `repeater.props.template`, y aceptación de `defaultOpen: true` fuera del repeater.
    - `src/tests/config-validation/runtime-config-validation-buttons.test.ts`: ampliar con aceptación/rechazo del shape de las nuevas acciones a nivel de validación de botón.
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - Acepta `modal` declarado a nivel raíz de la página, como hijo de `container` y como raíz dentro de `repeater.props.template`. (`modal` no es hijo válido de `modal`; los hijos admitidos son los listados en la spec: `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `repeater`.)
  - Rechaza `modal.id` ausente, vacío o no string, con la ruta exacta.
  - Rechaza `modal.props.size` fuera del catálogo `sm | md | lg` y `modal.props.defaultOpen` no booleano.
  - Rechaza `modal.children` que contenga nodos no permitidos (por ejemplo `input` suelto fuera de `form`).
  - Acepta `modal.children` vacío (panel vacío).
  - Rechaza ids `modal.id` duplicados a través de páginas distintas en la misma configuración.
  - Rechaza `openModal.modalId` y `closeModal.modalId` que apunten a un id inexistente.
  - Rechaza `modal.props.defaultOpen: true` cuando el `modal` se declara dentro de `repeater.props.template` (a cualquier profundidad).
  - Acepta `modal.props.defaultOpen: true` fuera del repeater.
  - Acepta `modal.visibility` y `modal.queryStateFeedback` con shape válido y los rechaza con la ruta exacta cuando son inválidos.
  - Acepta un botón fuera del modal que llama `closeModal` con `modalId` válido.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - `pnpm test` pasa, incluido el nuevo fichero de tests.
  - Mensajes de error usan rutas idénticas al estilo del resto del módulo (`Page "X" has an invalid layout at "<path>"...`).
- **Cierre de implementación**: validación completa de `modal` y de las acciones, con tests directos sobre `validateRuntimeConfig` (no sobre los schemas Zod aislados).
- **Cierre documental**: ninguno.

---

## T3. Dominio de estado de runtime para apertura de modal

- **Estado**: done
- **Objetivo**: Añadir al store runtime el dominio mínimo necesario para representar un único modal abierto a la vez, con identidad por `modalId` y, cuando proceda, contexto de iteración del repeater. Implementar las acciones del reducer y los selectores; integrar el cierre automático en transiciones de `pageEntry`/navegación y la apertura inicial de modales con `defaultOpen: true`.
- **Fuera de alcance**:
  - Ejecutor de acciones UI (T4).
  - Renderer del nodo (T5).
  - Trampa de foco, ESC ni click en overlay (T5).
- **Dependencias**: T1, T2.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-references/runtime-reference-resolver.ts`: extender `RuntimeIterationContext` para incluir `key: string` (el `iteration.key` ya calculado por el repeater) además del `item` actual. Sin este cambio, ni T4 ni T6 pueden derivar una `iterationKey` estable.
    - `src/runtime/nodes/repeater-layout-node.tsx`: al construir el `iterationContext` que se propaga al subárbol, incluir `key` además de `item`, reutilizando la `iteration.key` ya calculada por `resolveRepeaterIterations`. Mantener intacta la semántica existente de `item.*`.
    - `src/runtime/runtime-state/runtime-state-types.ts`: añadir `RuntimeModalState` con `activeModalId: string | null` y `activeIterationKey: string | null`. Incorporarlo al `RuntimeState`. Añadir acciones `modal/open` (`{ modalId, iterationKey?: string }`), `modal/close` (`{ modalId, iterationKey?: string }`) y `modal/close-all`.
    - `src/runtime/runtime-state/runtime-state-reducer.ts`:
      - `modal/open`: si ya hay un modal activo (cualquier id/iteración), lo cierra antes de abrir el nuevo.
      - `modal/close`: si el modal activo coincide con `modalId` (y, cuando aplica, `iterationKey`), lo cierra; si no coincide, no-op.
      - `modal/close-all`: limpia el estado.
      - `navigation/navigate` y `navigation/sync-from-browser`: limpian el estado del modal.
      - `page-entry/set-idle` y `page-entry/start-preload-batch`: limpian el estado del modal en el punto de entrada inicial de página.
    - `src/runtime/runtime-state/runtime-state-selectors.ts`: añadir `selectActiveModal(state)` y `isModalOpen(state, modalId, iterationKey?)`.
    - `src/runtime/runtime-state/runtime-state-provider.tsx`: si el `initialState` necesita ajuste, exponerlo aquí. No abrir modales `defaultOpen: true` desde aquí: la apertura inicial se dispara desde el renderer del nodo en T5 al detectar primer montaje útil en la página.
  - Tests:
    - `src/tests/runtime-state/runtime-state-modal.test.tsx` (nuevo): reducer, selectores, regla "uno a la vez", cierre por navegación y por entrada de página, identidad por iteración (`{ modalId: 'a', iterationKey: 'i1' }` distinto de `{ modalId: 'a', iterationKey: 'i2' }`).
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - Abrir un modal y leerlo con `selectActiveModal`.
  - Abrir `B` cuando `A` ya está abierto deja `B` activo y `A` cerrado.
  - `modal/close` con `modalId` distinto del activo no muta el estado.
  - `modal/close` con `modalId` igual al activo limpia el estado.
  - `navigation/navigate`, `navigation/sync-from-browser` y la transición de `pageEntry` cierran cualquier modal activo.
  - `isModalOpen` distingue iteraciones distintas para el mismo `modalId`.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - Tests del store en verde.
  - Sin regresiones en `src/tests/runtime-state/`.
- **Cierre de implementación**: dominio de estado completo y observable mediante selectores.
- **Cierre documental**: ninguno.

---

## T4. Ejecutor de acciones `openModal` y `closeModal`

- **Estado**: done
- **Objetivo**: Traducir las acciones declarativas `openModal` y `closeModal` a operaciones del store, propagando el contexto de iteración del repeater para resolver identidad correcta. Mantener el contrato del ejecutor (`executeRuntimeUiAction`) como único punto de delegación; los nodos visuales no deben acceder al store por su cuenta.
- **Fuera de alcance**:
  - Renderer del nodo `modal` (T5).
  - Apertura inicial por `defaultOpen` (T5).
- **Dependencias**: T1, T3.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/runtime-actions/runtime-ui-action-executor.ts`: extender `RuntimeUiActionHandlers` con `openModal(modalId: string, options?: { iterationContext?: RuntimeIterationContext })` y `closeModal(modalId: string, options?: { iterationContext?: RuntimeIterationContext })`. Añadir los casos correspondientes al `switch` de `executeRuntimeUiAction`, propagando `iterationContext` cuando lo recibe.
    - `src/runtime/runtime-state/runtime-state-provider.tsx`: implementar los nuevos handlers dentro de `useRuntimeStateActions` y exponerlos en el objeto memorizado de actions del provider. Cada handler despacha `modal/open` o `modal/close` derivando `iterationKey` directamente de `iterationContext?.key` (sin serializaciones ad hoc del `item`); cuando no hay `iterationContext`, `iterationKey` se omite (`undefined`).
  - Tests:
    - `src/tests/runtime/runtime-ui-actions.test.tsx`: ampliar con casos de `openModal` y `closeModal` (con y sin `iterationContext`), incluida la regla "abrir cierra el anterior" y "closeModal no-op si ya cerrado".
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - `openModal` invocado con `modalId` válido cambia el estado del store a "abierto".
  - `closeModal` con el modal activo lo cierra; con un modal distinto del activo, no muta el store.
  - `openModal` cuando hay otro modal activo lo cierra primero.
  - `openModal`/`closeModal` propagan `iterationContext` y producen `iterationKey` distinta por iteración.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - Tests del executor en verde.
  - Sin regresiones en acciones existentes.
- **Cierre de implementación**: handlers cableados, contrato del ejecutor cerrado.
- **Cierre documental**: ninguno.

---

## T5. Renderer del nodo `modal` (panel, overlay, ESC, focus trap, tamaños, `defaultOpen`)

- **Estado**: done
- **Objetivo**: Implementar el nodo visual `modal` con render condicional según el store, overlay clic-cerrar, cierre por ESC, trampa de foco accesible, catálogo de tamaños `sm | md | lg` con `md` como default, bloqueo de interacción de fondo y apertura automática cuando `defaultOpen: true` se vuelve visible por primera vez en la entrada de página. Integrarlo en el dispatcher central (`LayoutNodeRenderer`) y respetar `visibility` y `queryStateFeedback` mediante el borde central existente.
- **Fuera de alcance**:
  - Comportamiento dentro de `repeater.props.template` (T6).
  - Cualquier cambio en documentación funcional.
  - Theming o variantes visuales fuera del catálogo de tamaño.
- **Dependencias**: T1, T2, T3, T4.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/modal-layout-node.tsx` (nuevo):
      - lee el estado del store con los selectores de T3,
      - cuando el modal está abierto, renderiza overlay + panel con utilidades Tailwind (sin estilos inline),
      - aplica clases de tamaño según `props.size` usando el módulo común de estilos,
      - cierra por click en overlay y por tecla `Escape`,
      - atrapa el foco dentro del panel mientras está abierto y restaura el foco al cerrar,
      - bloquea la interacción con el contenido de fondo (por ejemplo `aria-hidden` en el resto o por estructura del overlay),
      - si `props.defaultOpen: true`, despacha `openModal` en `useEffect` la primera vez que el nodo se renderiza dentro de una `pageEntry` concreta. El guard concreto: un `useRef<string | null>` con la última `pageEntry.entryId` en la que ya se disparó la auto-apertura para este `modalId`; al detectar un `entryId` distinto, se vuelve a permitir auto-apertura una sola vez. Esto evita bucles de re-apertura si el usuario cierra el modal manualmente o si `visibility` lo oculta y vuelve a mostrarlo dentro de la misma entrada de página.
    - `src/runtime/runtime-node-styling.ts`: añadir helpers `getModalOverlayClassName`, `getModalPanelClassName(size)` y la traducción de los tres tamaños a clases Tailwind estables.
    - `src/runtime/layout-node-renderer.tsx`: enchufar `case 'modal'` al `switch`, delegando en `ModalNode` y propagando `renderedChildren` e `iterationContext`. `modal` debe respetar las reglas transversales de `visibility` y `queryStateFeedback` que ya gestiona el borde central.
    - `src/runtime/layout-renderer.tsx`: aceptar `modal` como nodo con hijos para que el árbol expanda sus `children` con el mismo flujo que `container`. No introducir lógica nueva fuera del dispatcher.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (nuevo):
      - render condicional según estado del store,
      - apertura por botón `openModal` y cierre por botón `closeModal`, ESC y click en overlay,
      - tres tamaños generan clases visibles diferenciadas,
      - `defaultOpen: true` abre el modal en el primer render útil de la página,
      - `visibility: false` impide render y apertura,
      - `queryStateFeedback` muestra los fallbacks habituales sin renderizar el panel del modal,
      - foco atrapado dentro del panel mientras está abierto,
      - cierre por navegación a otra página (interacción con T3).
    - `src/tests/runtime/runtime-ui-actions.test.tsx`: si procede, añadir ya algún assertion mínimo de integración renderer↔executor en modales fuera de repeater (deja el caso de repeater para T6).
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - Criterios de aceptación 1–9, 12–15 de `spec.md` cubiertos a nivel de renderer/integración runtime.
  - Caso límite "modal sin children" renderiza panel vacío sin errores.
  - Caso límite "`closeModal` sobre un modal ya cerrado" no produce error visible.
  - Caso límite "`defaultOpen: true` + `visibility: false`" no renderiza el modal.
  - Caso límite "botón con `closeModal` declarado fuera del modal que referencia" funciona como cierre.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - `pnpm test` pasa, incluido el nuevo fichero.
  - Estilos del modal implementados con utilidades Tailwind y sin estilos inline.
  - Cobertura global de `src/` se mantiene en ≥ 80%.
- **Cierre de implementación**: renderer del modal accesible, con tamaños, defaults y cierres cubiertos.
- **Cierre documental**: ninguno.

---

## T6. `modal` dentro de `repeater.props.template` con identidad por iteración

- **Estado**: done
- **Objetivo**: Asegurar que un `modal` declarado dentro de `repeater.props.template` se comporta como una instancia por iteración: cada iteración tiene su propio estado de apertura, un botón dentro del template abre la instancia de su iteración, las referencias `item.*` dentro de los `children` resuelven el item correcto, y la regla global "solo un modal abierto a la vez" se sigue cumpliendo a través de iteraciones. Los modales dentro del template no soportan `defaultOpen: true` (la validación ya lo rechaza en T2; aquí basta con que el runtime no abra ninguno automáticamente).
- **Fuera de alcance**:
  - Stack de varios modales abiertos.
  - `defaultOpen` dentro del template (rechazado por validación en T2).
- **Dependencias**: T3, T4, T5.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/repeater-layout-node.tsx`: validar que la `iterationContext` propagada al árbol del template ya incluye `key` (cambio introducido en T3) y alcanza tanto al render de `modal` como a los botones que disparan `openModal`/`closeModal`. No introducir aquí lógica de identidad propia: la `iterationKey` viaja como parte del `iterationContext`.
    - `src/runtime/runtime-state/runtime-state-provider.tsx`: verificar que los handlers definidos en T4 mantienen la `iterationKey` estable entre re-renders mientras la colección y el item no cambian, y la limpian cuando la iteración deja de existir (caso "cambio de colección no deja modales colgados"). Si hace falta, complementar con un selector que reconcilie estado huérfano del modal al recalcular iteraciones del repeater.
    - `src/runtime/nodes/modal-layout-node.tsx`: leer el `iterationContext` cuando el modal se monta dentro de un template, para decidir si la instancia local es la activa (`activeModalId` + `activeIterationKey === iterationContext.key`). Sin `iterationContext`, comparar solo por `modalId`.
  - Tests:
    - `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (nuevo):
      - dos iteraciones del repeater abren modales independientes,
      - abrir el modal de la iteración N cierra el modal de la iteración M (regla global),
      - referencias `item.*` dentro de los `children` del modal resuelven el item de la iteración correspondiente,
      - el botón `closeModal` dentro del template cierra solo la instancia local cuando esa es la activa.
  - Documentación:
    - ninguna en esta tarea.
- **Tests requeridos**:
  - Criterios de aceptación 16, 17 y 18 de `spec.md` cubiertos.
  - Cambio de colección del repeater no deja modales colgados (al recomputar iteraciones, cualquier modal activo asociado a una iteración ya inexistente queda cerrado).
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - `pnpm test` pasa, incluido el nuevo fichero.
  - Cobertura ≥ 80% sigue cumpliéndose globalmente.
- **Cierre de implementación**: integración con repeater verificada; comportamiento de identidad por iteración estable.
- **Cierre documental**: ninguno.

---

## Resumen de impacto documental diferido

La pasada posterior `update-app-documentation` deberá actualizar al menos:
- `ai-workflow/docs/app-features/nodes/index.md`: añadir fila `modal.md`.
- `ai-workflow/docs/app-features/nodes/modal.md` (nuevo): ficha funcional del nodo `modal` (contrato, reglas de render, `defaultOpen`, tamaños, `children` permitidos, comportamiento en `repeater.props.template`, validaciones específicas).
- `ai-workflow/docs/app-features/nodes/button.md`: añadir acciones `openModal` y `closeModal` al catálogo.
- `ai-workflow/docs/current-state.md`: actualizar columna "Última feature relevante" de `Catálogo de nodos` a `0044`.
- `ai-workflow/features/index.md`: mover `0044-modal-node` de Planificadas a Completadas y redactar su entrada de cierre.
- `ai-workflow/docs/test-index.md`: registrar los ficheros de test nuevos (`runtime-config-validation-modal.test.ts`, `runtime-state-modal.test.tsx`, `layout-renderer-modal.test.tsx`, `layout-renderer-modal-repeater.test.tsx`).

Esta lista no es una tarea de implementación: queda explícita aquí para que la skill documental encuentre el contrato sin reinterpretar la feature.
