# `0044-modal-node` — Plan de tests

> Contrato de verificación esperado para la implementación de `0044-modal-node`. Cada bloque indica qué comportamiento valida, dónde vive el fichero de test y qué comandos debe ejecutar la skill de implementación durante la pasada test-first. El umbral global mínimo de cobertura del proyecto (80% sobre `src/` en `functions`, `lines`, `statements`) sigue actuando como gate de cierre.

## Estrategia general

- Enfoque **tests-first**: cada tarea declara su fichero de test esperado en `tasks.md`; la implementación debe escribir primero los tests con el comportamiento deseado (rojos) y después implementar hasta dejarlos verdes.
- Sin tests e2e: no aplican en este proyecto y la feature no introduce flujos nuevos que justifiquen e2e.
- Unit tests para reducer/selectores/ejecutor; integration tests para validación cruzada y para el renderer (que combina dispatcher, store y nodos).
- Reutilizar los helpers y fixtures existentes en cada carpeta de tests (`src/tests/<área>/helpers.ts(x)`); no duplicar utilidades.

## Bloque A — Validación estática y cruzada del contrato (T1, T2)

- Ficheros:
  - `src/tests/config-validation/runtime-config-root-zod.test.ts` (ampliación): cobertura de schema raíz para el nuevo nodo y las nuevas acciones.
  - `src/tests/config-validation/runtime-config-validation-modal.test.ts` (nuevo): validación de `modal` end-to-end vía `validateRuntimeConfig`.
  - `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación): shape de `openModal`/`closeModal` en botones.
- Comportamiento cubierto:
  - Aceptación del shape mínimo de `modal` (con/sin `props`, con/sin `children`).
  - Catálogo cerrado de `props.size` (`sm | md | lg`), default `md` no necesita declararse.
  - `props.defaultOpen` solo acepta booleano.
  - `children` admite `container`, `form`, `heading`, `paragraph`, `list`, `image`, `table`, `button` y `repeater`, y rechaza otros (por ejemplo `input` suelto).
  - `modal` puede declararse en root layout, dentro de `container.children`, anidado dentro de otro `modal`, y como raíz del `repeater.props.template`.
  - Validación cruzada: `modal.id` único en toda la configuración.
  - Validación cruzada: `openModal.modalId` y `closeModal.modalId` referencian un `modal.id` existente.
  - Validación cruzada: `modal.props.defaultOpen: true` queda rechazado en cualquier descendiente de `repeater.props.template`.
  - `visibility` y `queryStateFeedback` sobre `modal` aceptan shape válido y producen mensajes de error con la ruta exacta para shape inválido.
  - Casos límite: `closeModal` puede declararse fuera del modal que referencia.
- Comandos durante implementación:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts`
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts`
  - `pnpm test --run src/tests/config-validation/runtime-config-root-zod.test.ts`

## Bloque B — Estado de runtime de modal (T3)

- Fichero:
  - `src/tests/runtime-state/runtime-state-modal.test.tsx` (nuevo).
- Comportamiento cubierto:
  - `modal/open` deja `selectActiveModal` con la identidad correcta.
  - `modal/open` cuando hay otro modal activo lo cierra primero (regla global "uno a la vez").
  - `modal/close` con `modalId` distinto del activo no muta el estado.
  - `modal/close` con `modalId` igual al activo limpia el estado.
  - `navigation/navigate` y `navigation/sync-from-browser` cierran el modal activo.
  - Transición de `pageEntry` (`page-entry/set-idle`, `page-entry/start-preload-batch`) cierra el modal activo.
  - `isModalOpen` distingue iteraciones por `iterationKey` para el mismo `modalId`.
  - Extensión de `RuntimeIterationContext`: tests del repeater existentes siguen verdes tras añadir `key` al context; al menos un caso nuevo comprueba que un consumidor descendiente del template puede leer `iterationContext.key` y que ese valor coincide con el `iteration.key` que ya emite `RepeaterNode`.
- Comandos:
  - `pnpm test --run src/tests/runtime-state/runtime-state-modal.test.tsx`

## Bloque C — Ejecutor de acciones (T4)

- Fichero:
  - `src/tests/runtime/runtime-ui-actions.test.tsx` (ampliación).
- Comportamiento cubierto:
  - `openModal` invocado con `modalId` válido actualiza el store a "abierto".
  - `closeModal` con el modal activo lo cierra; con otro `modalId`, no-op.
  - `openModal` con otro modal activo cierra el anterior antes de abrir.
  - `iterationContext` se propaga del ejecutor al store y produce `iterationKey` distinta por iteración.
- Comandos:
  - `pnpm test --run src/tests/runtime/runtime-ui-actions.test.tsx`

## Bloque D — Renderer del nodo `modal` (T5)

- Fichero:
  - `src/tests/layout-renderer/layout-renderer-modal.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Render condicional según estado del store.
  - Botón `openModal` abre, botón `closeModal` cierra.
  - Tecla `Escape` cierra el modal activo.
  - Click en overlay cierra el modal activo.
  - `props.size` `sm | md | lg` produce clases visibles diferenciadas.
  - `props.defaultOpen: true` abre el modal una sola vez por `pageEntry.entryId`: incluir un caso donde el usuario cierra el modal manualmente dentro de la misma entrada de página y verificar que NO se vuelve a auto-abrir, y otro caso donde una nueva entrada (`entryId` distinto) sí lo abre de nuevo.
  - `visibility: false` impide tanto el render como la apertura.
  - `queryStateFeedback` renderiza fallbacks sin abrir el panel del modal.
  - Foco atrapado dentro del panel mientras está abierto y restaurado al cerrar.
  - Navegar a otra página cierra el modal (interacción con T3).
  - Caso límite: `closeModal` sobre un modal ya cerrado no rompe el render.
  - Caso límite: `modal` sin `children` renderiza un panel vacío sin errores.
  - Caso límite: botón con `closeModal` declarado fuera del modal referenciado lo cierra correctamente.
  - Form dentro de modal: criterio de aceptación 9, comprobar que un `<form>` interno se submita correctamente sin diferencia respecto a estar fuera del modal. Reutilizar el patrón `renderRuntimePage` / `RuntimeStateProvider` que ya usan los demás ficheros de `src/tests/layout-renderer/` (por ejemplo el harness local de `layout-renderer-buttons-text.test.tsx`) y la operación de `api` mockeada habitual de la suite; no inventar harness nuevo.
- Comandos:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal.test.tsx`

## Bloque E — `modal` dentro de `repeater.props.template` (T6)

- Fichero:
  - `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Dos iteraciones distintas abren modales independientes (regla por iteración).
  - Abrir el modal de la iteración N cierra el modal de la iteración M (regla global).
  - Referencias `item.*` dentro de los `children` del modal resuelven el item de la iteración correcta.
  - Botón `closeModal` dentro del template cierra solo la instancia local si esa es la activa.
  - Cambio de colección del repeater no deja modales colgados.
- Comandos:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx`

## Comandos de cierre

- Antes de declarar cerrada la pasada de implementación de cualquier tarea, ejecutar al menos el bloque de tests correspondiente más una corrida completa final con cobertura:
  - `pnpm test`
- `pnpm test` ya ejerce el gate de cobertura del 80% sobre `src/` en `functions`, `lines` y `statements`. La pasada de implementación se da por cerrada solo cuando la corrida completa pasa con cobertura sobre el umbral.

## Decisiones explícitas

- No se introducen snapshots de componentes completos: los criterios de aceptación validan estructura y atributos concretos (clases de tamaño, presencia de overlay, foco activo).
- No se hacen mocks de `requestAnimationFrame`/timers innecesarios: el render del modal debe ser controlable por estado del store y por eventos DOM (`keydown`, `mousedown`/`click`) directamente.
- Los tests no deben observar implementación interna del focus trap; basta con que el foco final, tras abrir y tabular, permanezca dentro del panel y se restaure al cerrar.
