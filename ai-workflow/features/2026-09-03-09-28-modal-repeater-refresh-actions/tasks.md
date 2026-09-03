# Tasks: modal-repeater-refresh-actions

Contrato de ejecución. Cada tarea se implementa aislada, con el bloque `tests` como
especificación tests-first. Orden recomendado: **T1 → T2 → T3 → T4 → T5 → T6** (T1 y T2 son
mutuamente independientes y podrían intercambiarse; T6 es independiente del bloque D2 completo
y podría implementarse en cualquier punto tras T1). Siguiente tarea a escoger: **T1**.

---

## T1 — Secuenciación por finalización de `onSuccess`/`onError` (D1)

### Objetivo
Hacer que `runRuntimeUiActionLifecycleList` espere la finalización de cada entrada asíncrona
(`executeOperation`, `executeOperations`) antes de continuar con la siguiente entrada de la
misma lista, sin introducir flag de activación. Corrige `button`, `link`, `form` y menú/sidebar
del shell a la vez porque todos comparten `runActionOutcomeWithLifecycle`/
`executeRuntimeUiAction` como único punto de orquestación (ver `conventions.md`).

### Fuera de alcance
- Cualquier cambio de qué acciones se ejecutan (semántica de `when` intacta).
- El disparo de la acción disparadora de primer nivel de un botón/link cuando NO forma parte de
  una lista `onSuccess`/`onError` (sigue fire-and-forget, sin cambios: los llamadores directos
  de `executeRuntimeUiAction` en `button-layout-node.tsx`, `link-layout-node.tsx`,
  `app-shell-header.tsx`, `app-shell-sidebar.tsx` y `runtime-navigation-action-executor.ts`
  descartan su valor de retorno hoy y lo seguirán haciendo; con el nuevo tipo de retorno
  `Promise<unknown> | void` eso sigue siendo válido en TypeScript sin cambios en esos ficheros).
- `downloadOperation` como entrada de una lista `onSuccess`/`onError`: el contrato de tipos ya lo
  excluye de `RuntimeUiActionListEntry` (decisión D7 preexistente); no hay caso de config real
  que ejercite esa rama.
- Auditoría de configs de producción existentes que puedan depender del timing anterior (riesgo
  ya aceptado en `spec.md`, a validar en el cierre de implementación de la feature, no de esta
  tarea).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `executeRuntimeUiAction(action: RuntimeUiAction, handlers: RuntimeUiActionHandlers, options?: { state?: RuntimeState; iterationContext?: RuntimeIterationContext }): Promise<unknown> | void` (de `src/runtime/runtime-actions/runtime-ui-action-executor.ts`) — sin consumidores directos en este plan (los llamadores existentes ya descartan el valor de retorno y no se modifican).
- `runRuntimeUiActionLifecycleList(actions: RuntimeUiActionListEntry[] | undefined, handlers: RuntimeUiActionHandlers, readState: () => RuntimeState, iterationContext?: RuntimeIterationContext): Promise<void>` (de `src/runtime/runtime-actions/runtime-ui-action-executor.ts`) — sin consumidores directos en este plan.
- `runActionOutcomeWithLifecycle<TResult extends { status: string }>(...): Promise<TResult>` (de `src/runtime/runtime-actions/runtime-ui-action-executor.ts`) — firma pública sin cambios; sin consumidores directos en este plan (ya consumida por `button-layout-node.tsx`, `form-layout-node.tsx`, `link-layout-node.tsx` fuera de este plan, sin cambios de uso).

### Impacto esperado en archivos
- Código: `src/runtime/runtime-actions/runtime-ui-action-executor.ts` — modificar `executeRuntimeUiAction` (los branches `executeOperation`/`executeOperations` devuelven la promesa en vez de descartarla con `void`; `executeOperations` recoge las promesas de las entradas cuyo `when` se cumple y devuelve `Promise.all(...)`), modificar `runRuntimeUiActionLifecycleList` (pasa a `async`, hace `await` de cada `executeRuntimeUiAction(...)` antes de continuar con la siguiente entrada del `for`), modificar `runActionOutcomeWithLifecycle` (hace `await` de la llamada a `runRuntimeUiActionLifecycleList`).
- Tests: `src/tests/runtime/runtime-ui-action-executor-sequencing.test.ts` (nuevo), `src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` (ampliación), `src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx` (ampliación).
- Documentación: ninguna a revisar en esta tarea (se revisa de forma agregada al final de la feature vía `documentación afectada` de la feature, no por tarea).

### Tests

**Ficheros de test**:
- `src/tests/runtime/runtime-ui-action-executor-sequencing.test.ts` (nuevo) — test unitario de bajo nivel contra `runRuntimeUiActionLifecycleList`/`runActionOutcomeWithLifecycle` con handlers mockeados de resolución controlable (promesas diferidas), sin montar componentes.
- `src/tests/runtime/runtime-button-lifecycle-actions.test.tsx` (ampliación) — caso end-to-end sobre un botón real.
- `src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx` (ampliación) — caso end-to-end sobre `submitAction.onSuccess`/`onError` de un formulario real.

**Comportamiento cubierto**:
- Una lista `onSuccess` con dos entradas `executeOperation` consecutivas ejecuta la segunda solo después de que `handlers.executeQueryOperation` de la primera resuelve (verificar con una promesa diferida en el mock: la segunda entrada no se invoca hasta que se resuelve manualmente la promesa de la primera).
- El orden de resolución final de las dos entradas respeta el orden declarado en la lista, no el orden de resolución de las promesas si se invocaran en paralelo.
- Una entrada `executeOperations` (plural) intermedia bloquea la siguiente entrada de la lista hasta que **todas** las operaciones que cumplen `when` de esa entrada han resuelto (éxito o error), usando al menos dos operaciones con tiempos de resolución distintos.
- Las entradas síncronas (`navigateTo`, `goBack`, `resetForm`, `openModal`, `closeModal`) no introducen espera propia: tras ejecutarse, la siguiente entrada de la lista se evalúa en el siguiente turno sin esperar una promesa adicional.
- El `when` de una entrada posterior de la lista, cuando referencia `queries.{operationName}.status`/`.data` de una entrada `executeOperation` anterior de la MISMA lista, ya ve el resultado de esa entrada anterior (se resuelve `true`/`false` de forma coherente con el estado post-resolución, no con el estado previo a la ejecución).
- Con `submitAction.type: executeOperation` y `onSuccess: [executeOperation, openModal]` (end-to-end en `layout-renderer-forms-multi-operation.test.tsx`), el modal solo se abre (`role="dialog"` visible) después de que la segunda operación de la lista resuelve, nunca antes de que se dispare el `fetch` mockeado de esa segunda operación.
- Con `button.props.action.onSuccess: [executeOperation, executeOperation]` (end-to-end en `runtime-button-lifecycle-actions.test.tsx`), la segunda llamada de red mockeada no se dispara hasta que la primera ha resuelto (verificable contando invocaciones del mock de fetch en cada microtask/tick).
- Regresión: sin `onSuccess`/`onError` declarados, el comportamiento de un botón cuya propia operación falla sigue siendo fire-and-forget (test ya existente `'keeps the fire-and-forget regression behavior...'` en `runtime-button-lifecycle-actions.test.tsx` sigue en verde sin modificarlo).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime/runtime-ui-action-executor-sequencing.test.ts
pnpm test --run src/tests/runtime/runtime-button-lifecycle-actions.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-forms-multi-operation.test.tsx
```

**Restricciones**:
- El test unitario nuevo no debe montar componentes React ni usar Testing Library: usa directamente `runActionOutcomeWithLifecycle`/`runRuntimeUiActionLifecycleList` con un objeto `RuntimeUiActionHandlers` mockeado y promesas diferidas construidas a mano (patrón `new Promise((resolve) => { resolveRef = resolve })`) para controlar el orden de resolución de forma determinista.
- No añadir un test end-to-end nuevo para `executeOperations` como entrada de lista fuera del test unitario nuevo: el caso de negocio ya está cubierto a nivel de comportamiento por el test unitario; no dupliques el escenario completo en los ficheros end-to-end.

### Documentación afectada
- [`nodes/button.md`](../../docs/app-features/nodes/button.md) — la sección "Acciones post-ejecución (onSuccess/onError)" pasa a documentar espera secuencial en vez de disparo no bloqueante.
- [`forms/submit.md`](../../docs/app-features/forms/submit.md) — mismas secciones de `onSuccess`/`onError`.
- [`queries/execution.md`](../../docs/app-features/queries/execution.md) — sección "Refetch declarativo tras éxito/error".

### Criterios de finalización
- `executeRuntimeUiAction`, `runRuntimeUiActionLifecycleList` y `runActionOutcomeWithLifecycle` implementan la secuenciación descrita.
- Todos los tests del bloque `tests` en verde, sin regresión en los ficheros ampliados ni en el resto de la suite existente que ejercita botones, formularios y el shell (menú/sidebar, que también pasan por `executeRuntimeUiAction` sin cambio de comportamiento).

### Cierre de implementación
Código y tests de esta tarea completos y validados (`pnpm test` en verde, sin bajar el umbral de cobertura global).

---

## T2 — Módulo de propiedad de modal por repeater ancestro (base de D2)

### Objetivo
Crear un módulo neutral en `src/config/` que, dado el árbol `layout` de cada página, calcula
para cada `modal.id` la identidad de su `repeater` ancestro más cercano (o `null` si el modal
vive a nivel de página), identificada por path estructural cualificado por página. Este módulo
es la base compartida que consumen T3, T4 y T5 para decidir "¿la acción y el modal objetivo
están en el mismo repeater, en repeaters distintos, o el modal es de página?".

### Fuera de alcance
- Cualquier uso del resultado (validación o runtime): eso es T3, T4 y T5.
- Recorrer tipos de nodo que la infraestructura de modal ya existente (`collectModalIds` en
  `src/config/validate-runtime-config.ts`) no recorre hoy (por ejemplo `tabs`/`steps`/
  `accordion`): este módulo replica exactamente el mismo conjunto de tipos recorridos
  (`modal`, `container`, `form`, `repeater`, más los `fallback` de `queryStateFeedback`) para no
  introducir una discrepancia entre "qué modales existen" y "de quién son".

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**:
- `computeModalRepeaterOwnership(pages: readonly RuntimePageConfig[]): Map<string, string | null>` (de `src/config/runtime-modal-repeater-ownership.ts`) — consumido por: T3, T4, T5. La clave es `modal.id` (único en toda la configuración, ya garantizado por validación existente); el valor es `null` cuando el modal no tiene ningún `repeater` ancestro, o un identificador de repeater con forma `` `${pageId}::${nodePath}` `` (donde `nodePath` es el path estructural del propio nodo `repeater`, por ejemplo `layout[2].props.template[0]`) cuando sí lo tiene. Dos repeaters en páginas distintas con el mismo `nodePath` producen identificadores distintos por el prefijo `pageId`.

### Impacto esperado en archivos
- Código: `src/config/runtime-modal-repeater-ownership.ts` (nuevo) — exporta `computeModalRepeaterOwnership` más las funciones internas de recorrido recursivo (espejo de `collectModalIds`/`collectModalIdsInFallbacks` de `src/config/validate-runtime-config.ts`, pero acumulando el identificador de repeater ancestro en vez de solo detectar duplicados).
- Tests: `src/tests/config-validation/runtime-modal-repeater-ownership-config-validation.test.ts` (nuevo).
- Documentación: ninguna (módulo interno sin contrato JSON ni comportamiento observable propio).

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-modal-repeater-ownership-config-validation.test.ts` (nuevo).

**Comportamiento cubierto**:
- Un modal declarado directamente en `layout` (fuera de cualquier repeater) resuelve a `null`.
- Un modal declarado dentro de `container.children` que a su vez está fuera de cualquier repeater resuelve a `null`.
- Un modal declarado como raíz de `repeater.props.template` resuelve al identificador del propio nodo `repeater`.
- Un modal declarado dentro de `container.children` anidado dentro de `repeater.props.template` resuelve al mismo identificador que el caso anterior (el `container` intermedio no cambia el ancestro repeater más cercano).
- Un modal declarado dentro de `repeater.props.template` que a su vez contiene OTRO `repeater` anidado, con el modal dentro del template del repeater interno, resuelve al identificador del repeater interno (el más cercano), no del externo.
- Dos páginas distintas cuyo `repeater` respectivo ocupa la misma posición estructural (mismo `nodePath`, por ejemplo `layout[0]`) producen dos identificadores de repeater distintos en el mapa resultante (verificar que ambos modales, uno por página, no colisionan a la misma clave de repeater).
- Un modal dentro de `queryStateFeedback.states.{estado}.fallback` de un nodo que vive dentro de `repeater.props.template` resuelve al identificador de ese repeater (mismo tratamiento de fallback que `collectModalIds`).
- Una configuración sin ningún `repeater` produce un mapa donde todo modal resuelve a `null`.
- El tamaño del mapa resultante coincide con el número total de modales declarados en la configuración de prueba (ningún modal se pierde ni se duplica).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-modal-repeater-ownership-config-validation.test.ts
```

**Restricciones**:
- No validar aquí duplicados de `modal.id` ni referencias rotas: este módulo asume una configuración ya bien formada en ese sentido (esa validación ya existe en `validate-runtime-config.ts` y corre antes en el pipeline real; el test de este módulo puede construir directamente árboles `LayoutNodeCollection` sin pasar por `validateRuntimeConfig`).

### Documentación afectada
Ninguna.

### Criterios de finalización
- `computeModalRepeaterOwnership` exportado con la firma declarada, cubierto por los tests listados, en verde.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T3 — Rechazo cross-repeater en la acción de botón de primer nivel (D2, `checkModalRefs`)

### Objetivo
Extender `checkModalRefs` (en `src/config/validate-runtime-config.ts`) para rechazar en
bootstrap un `button.props.action` de tipo `openModal`/`closeModal` declarado dentro de
`repeater.props.template` cuando el `modal.id` objetivo pertenece a un `repeater` ancestro
distinto del que contiene al botón. Cubre el requisito 7 de la spec para el caso de acción de
botón de primer nivel (no dentro de una lista `onSuccess`/`onError`; eso es T4).

### Fuera de alcance
- Entradas `openModal`/`closeModal` dentro de una lista `onSuccess`/`onError` de botón o de
  `form.submitAction`: eso es T4, sobre `validateActionListTargets` en
  `src/config/validate-form-semantics.ts`.
- El caso "acción fuera de cualquier repeater apuntando a un modal.id dentro de un repeater": se
  deja con el comportamiento inerte actual (no se rechaza), tal como fija `design.md` como no
  objetivo.
- Cambios en `use-runtime-state.ts` (T5).

### Dependencias
T2 (usa `computeModalRepeaterOwnership`).

### Interfaces
**Consume**:
- `computeModalRepeaterOwnership(pages: readonly RuntimePageConfig[]): Map<string, string | null>` (de T2)

**Produce**: ninguno (función interna `checkModalRefs`, sin exportar, sin consumidores fuera de este fichero).

### Impacto esperado en archivos
- Código: `src/config/validate-runtime-config.ts` — en `validateModalReferences`, calcular `const modalOwnership = computeModalRepeaterOwnership(config.pages)` una vez y pasarlo a `checkModalRefs`; reemplazar el parámetro `insideRepeaterTemplate: boolean` de `checkModalRefs` (y de `checkModalRefsInFallbacks`) por `currentRepeaterPath: string | null` (el identificador `` `${pageId}::${nodePath}` `` del repeater ancestro más cercano de la posición actual del recorrido, o `null` si no hay ninguno); la comprobación existente `insideRepeaterTemplate && node.props?.defaultOpen === true` pasa a `currentRepeaterPath !== null && node.props?.defaultOpen === true` (comportamiento idéntico); al recursar en `repeater.props.template` (línea donde hoy se pasa `true`), pasar en su lugar `` `${pageId}::${nodePath}` `` (identificador del propio nodo `repeater` que se está atravesando); añadir la comprobación nueva: cuando `node.type === 'button'`, `action.type` es `openModal` o `closeModal`, `currentRepeaterPath !== null`, el modal existe (`modalIds.has(action.modalId)`) y `modalOwnership.get(action.modalId)` no es `null` ni igual a `currentRepeaterPath`, rechazar con el mensaje `` `Page "${pageId}" has an invalid layout at "${nodePath}.props.action.modalId": modal "${action.modalId}" belongs to a different repeater.` `` usando `enrichedInvalidLayoutFromNode`.
- Tests: `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación).
- Documentación: `nodes/modal.md`.

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación, bajo el describe `validateRuntimeConfig — modal cross-validation`).

**Comportamiento cubierto**:
- Un `button` dentro de `repeaterA.props.template` con `action: { type: 'openModal', modalId: 'modalInRepeaterB' }`, donde `modalInRepeaterB` está declarado dentro de `repeaterB.props.template` (repeater hermano distinto), rechaza el config completo con el mensaje exacto especificado arriba y ruta `layout[...].props.action.modalId` sobre el botón.
- El mismo caso con `action.type: 'closeModal'` también rechaza.
- Un `button` dentro de `repeaterA.props.template` con `openModal` hacia un `modal.id` declarado dentro del MISMO `repeaterA.props.template` (a cualquier profundidad vía `container` intermedio) sigue aceptándose (regresión explícita, no solo ausencia de rechazo).
- Un `button` dentro de `repeaterA.props.template` con `openModal` hacia un `modal.id` declarado a nivel de página (fuera de cualquier repeater) sigue aceptándose (no lo rechaza esta tarea; T5 se encarga de que además abra correctamente en runtime).
- Un `button` FUERA de cualquier repeater con `openModal` hacia un `modal.id` declarado dentro de un repeater sigue aceptándose (comportamiento inerte, fuera de alcance, sin cambios).
- Cross-repeater ANIDADO: un `button` dentro de `repeaterOuter.props.template > repeaterInner.props.template` con `openModal` hacia un modal declarado directamente en `repeaterOuter.props.template` (fuera de `repeaterInner`) se rechaza (el repeater ancestro más cercano del botón es el interno, distinto del propietario del modal).
- El mensaje de error incluye el breadcrumb enriquecido estándar (mismo patrón que el resto de errores `invalid-layout` de este fichero).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts
```

**Restricciones**:
- Reutilizar el helper `enrichedInvalidLayoutFromNode` ya usado por el resto de `checkModalRefs`, no introducir un formato de error alternativo.

### Documentación afectada
- [`nodes/modal.md`](../../docs/app-features/nodes/modal.md) — nueva regla en "Validación específica": rechazo de `openModal`/`closeModal` cross-repeater.

### Criterios de finalización
- `checkModalRefs` aplica el rechazo cross-repeater descrito, todos los tests del bloque en verde, sin regresión en el resto de `runtime-config-validation-modal.test.ts`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T4 — Rechazo cross-repeater en listas `onSuccess`/`onError` (D2, `validateActionListTargets`)

### Objetivo
Extender `validateActionListTargets` (en `src/config/validate-form-semantics.ts`) para aplicar
el mismo rechazo cross-repeater que T3, pero para entradas `openModal`/`closeModal` dentro de una
lista `onSuccess`/`onError` de `button.props.action` o de `form.submitAction`. Cubre el
requisito 7 de la spec para las cuatro superficies ya validadas por esta función (`form`
`onSuccess`/`onError` y `button` `onSuccess`/`onError`, ver líneas 118-146 y 266-296 de
`validate-form-semantics.ts`).

### Fuera de alcance
- La acción de botón de primer nivel (T3).
- Auxiliar buttons declarados dentro de `form.children` (validados por `validateFormChildren`,
  no por `validateFormNodesInCollection`): hoy esa ruta no valida targets de `onSuccess`/`onError`
  en absoluto (gap preexistente, no introducido ni corregido por esta feature); no ampliar ese
  alcance aquí.

### Dependencias
T2 (usa `computeModalRepeaterOwnership`).

### Interfaces
**Consume**:
- `computeModalRepeaterOwnership(pages: readonly RuntimePageConfig[]): Map<string, string | null>` (de T2)

**Produce**: ninguno (`validateActionListTargets` ya está exportada hoy; su firma cambia pero no gana consumidores nuevos dentro de este plan).

### Impacto esperado en archivos
- Código: `src/config/validate-form-semantics.ts` — en `validateFormSemantics`, calcular `const modalOwnership = computeModalRepeaterOwnership(config.pages)` una vez y añadirlo a `FormValidationContext`; añadir el campo `currentRepeaterPath: string | null` a `FormValidationContext` (inicializado a `null` en el `context` construido en `validateFormSemantics`); en `validateFormNodesInCollection`, en la rama `node.type === 'repeater'`, construir `` `${pageId}::${nodePath}` `` y pasarlo como `currentRepeaterPath` al recursar sobre `node.props.template` (en vez de propagar el mismo `context` sin cambios); extender la firma de `validateActionListTargets` para aceptar dos parámetros nuevos, `modalOwnership: ReadonlyMap<string, string | null>` y `currentRepeaterPath: string | null`, y pasarlos desde las 4 llamadas existentes (`context.modalOwnership`, `context.currentRepeaterPath`); dentro de `validateActionListTargets`, cuando `action.type` es `openModal` o `closeModal`, el modal existe (`modalIds.has(action.modalId)`), `currentRepeaterPath !== null` y `modalOwnership.get(action.modalId)` no es `null` ni igual a `currentRepeaterPath`, rechazar con el mensaje `` `Page "${pageId}" has an invalid layout at "${actionPath}.modalId": modal "${action.modalId}" belongs to a different repeater.` `` usando `invalidLayout` (mismo patrón que el rechazo de modal inexistente ya presente en esa función).
- Tests: `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación, describe `validateRuntimeConfig — button.props.action.onSuccess/onError target validation`).
- Documentación: `nodes/button.md`, `forms/submit.md`.

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación) — casos sobre `form.submitAction.onSuccess`/`onError`.
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación) — casos sobre `button.props.action.onSuccess`/`onError`.

**Comportamiento cubierto**:
- Un `form` dentro de `repeaterA.props.template` con `submitAction.onSuccess: [{ type: 'openModal', modalId: 'modalInRepeaterB' }]`, donde el modal pertenece a `repeaterB` (hermano distinto), rechaza el config con el mensaje exacto especificado y ruta `...submitAction.onSuccess[0].modalId`.
- El mismo caso con `submitAction.onError` y con `action.type: 'closeModal'` también rechaza.
- Un `form` dentro de `repeaterA.props.template` con `submitAction.onSuccess` apuntando a un modal del MISMO `repeaterA` sigue aceptándose (regresión).
- Un `form` dentro de `repeaterA.props.template` con `submitAction.onSuccess` apuntando a un modal de página sigue aceptándose (T5 se encarga del runtime).
- Un `button` (con `action.type: executeOperation`) dentro de `repeaterA.props.template` cuyo `onSuccess`/`onError` incluye una entrada `openModal`/`closeModal` hacia un modal de `repeaterB` distinto rechaza, con el mismo mensaje, sobre `...props.action.onSuccess[i].modalId` / `...props.action.onError[i].modalId`.
- El caso anterior con el modal en el MISMO repeater sigue aceptándose (regresión).
- Un `button`/`form` fuera de cualquier repeater con una entrada `openModal`/`closeModal` en su lista `onSuccess`/`onError` apuntando a un modal dentro de un repeater sigue aceptándose (comportamiento inerte, fuera de alcance).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
```

**Restricciones**:
- El mensaje de rechazo debe usar literalmente el mismo sufijo (`modal "${modalId}" belongs to a different repeater.`) que T3, para mantener consistencia de mensajes entre las dos superficies de validación de la misma regla.
- No tocar `validate-runtime-config.ts` en esta tarea: es responsabilidad exclusiva de T3.

### Documentación afectada
- [`nodes/button.md`](../../docs/app-features/nodes/button.md) — nueva regla en "Validación específica" sobre `onSuccess`/`onError` cross-repeater.
- [`forms/submit.md`](../../docs/app-features/forms/submit.md) — mismo caso para `submitAction.onSuccess`/`onError`.

### Criterios de finalización
- `validateActionListTargets` aplica el rechazo cross-repeater descrito para ambas superficies (`form`, `button`), todos los tests del bloque en verde, sin regresión en el resto de ambos ficheros de test.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T5 — Runtime: `openModal`/`closeModal` despacha la key de iteración correcta hacia modal de página (D2)

### Objetivo
Corregir `openModal`/`closeModal` en `src/runtime/runtime-state/use-runtime-state.ts` para que,
cuando el `modalId` objetivo es un modal de página (sin repeater ancestro), el despacho use
`iterationKey: undefined` con independencia del `iterationContext` de quien dispara la acción, en
vez de reenviar ciegamente la key de iteración del disparador. Cubre el requisito 2 de la spec:
abrir/cerrar correctamente un modal de página desde un `form`/nodo dentro de
`repeater.props.template`.

### Fuera de alcance
- El caso modal-dentro-del-mismo-repeater: sigue reenviando `options?.iterationContext?.key` sin
  cambios (ya garantizado correcto por la validación de T3/T4, que rechaza el caso cross-repeater
  antes de llegar aquí).
- Cualquier cambio en el reducer de modal (`modal/open`, `modal/close`) o en
  `RuntimeModalState`/`selectActiveModal`/`isModalOpen`: su contrato no cambia.

### Dependencias
T2 (usa `computeModalRepeaterOwnership`). No depende de T3/T4 para funcionar correctamente en
runtime, pero la corrección solo es segura en conjunto con el rechazo de validación de T3/T4 (que
garantiza que, si el modal no es de página, pertenece al mismo repeater que el disparador).

### Interfaces
**Consume**:
- `computeModalRepeaterOwnership(pages: readonly RuntimePageConfig[]): Map<string, string | null>` (de T2)

**Produce**: ninguno (`openModal`/`closeModal` ya forman parte de `RuntimeUiActionHandlers`, su firma pública no cambia).

### Impacto esperado en archivos
- Código: `src/runtime/runtime-state/use-runtime-state.ts` — en `useRuntimeStateActions`, añadir `const modalOwnership = useMemo(() => computeModalRepeaterOwnership(config.pages), [config.pages])`; en los callbacks `openModal` y `closeModal`, calcular `const isPageLevelModal = modalOwnership.get(modalId) === null` y despachar `iterationKey: isPageLevelModal ? undefined : options?.iterationContext?.key` en vez de `iterationKey: options?.iterationContext?.key`; añadir `modalOwnership` a los arrays de dependencias de ambos `useCallback`.
- Tests: `src/tests/runtime-state/runtime-state-modal.test.tsx` (ampliación), `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación).
- Documentación: `nodes/modal.md`.

### Tests

**Ficheros de test**:
- `src/tests/runtime-state/runtime-state-modal.test.tsx` (ampliación).
- `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Llamar a `openModal(modalId, { iterationContext: { key: 'row-3', ... } })` cuando `modalId` corresponde a un modal declarado a nivel de página despacha `modal/open` con `iterationKey: undefined`, no `'row-3'` (test directo sobre el hook/reducer con una config de prueba que declara el modal a nivel de página).
- El mismo caso con `closeModal` despacha `modal/close` con `iterationKey: undefined`.
- Llamar a `openModal(modalId, { iterationContext: { key: 'row-3', ... } })` cuando `modalId` corresponde a un modal declarado dentro del mismo repeater que el disparador sigue despachando `iterationKey: 'row-3'` (regresión explícita, no solo ausencia de cambio).
- End-to-end (`layout-renderer-modal-repeater.test.tsx`): un `form` dentro de `repeater.props.template` con `submitAction.onSuccess: [{ type: 'openModal', modalId: 'pageModal' }]`, donde `pageModal` está declarado en `layout` a nivel de página, abre visualmente el modal (`role="dialog"` visible) tras un submit disparado desde cualquier fila del repeater.
- End-to-end: el mismo modal de página, una vez abierto desde una fila del repeater, se cierra correctamente con un `closeModal` disparado desde un botón declarado fuera del repeater (regresión del comportamiento ya documentado "botón fuera del modal que cierra ese modal").
- End-to-end: `isModalOpen` para el modal de página devuelve `true` con independencia de desde qué fila del repeater se disparó `openModal` (no queda "atado" a la key de esa fila).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/runtime-state/runtime-state-modal.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx
```

**Restricciones**:
- No introducir un segundo modo de cálculo de propiedad de modal en runtime: reutilizar literalmente `computeModalRepeaterOwnership` de T2, no reimplementar el recorrido del árbol.

### Documentación afectada
- [`nodes/modal.md`](../../docs/app-features/nodes/modal.md) — sección "Comportamiento en `repeater.props.template`": documentar que `openModal`/`closeModal` hacia un modal de página funciona correctamente desde dentro de un `repeater.props.template`.

### Criterios de finalización
- `openModal`/`closeModal` despachan la `iterationKey` correcta en ambos casos (modal de página, modal del mismo repeater), todos los tests del bloque en verde, sin regresión en el resto de ambos ficheros de test.

### Cierre de implementación
Código y tests de esta tarea completos y validados.

---

## T6 — Repeater: desacoplar el reseteo de paginación del remount del subárbol (D3)

### Objetivo
Eliminar el uso de `paginationStateKey` como `key` de `<RepeaterNodeContent>` en
`src/runtime/nodes/repeater-layout-node.tsx`, sustituyéndolo por un `useEffect` interno de
`RepeaterNodeContent` que observa esa misma señal derivada (variante de controles + `pageSize` +
keys de iteración concatenadas, ya calculada como `paginationStateKey` en `RepeaterNode`) y
llama a `setActivePage(1)`/`setScrollVisibleCount(pageSize ?? 0)` cuando cambia, sin desmontar el
componente. Cubre los requisitos 3 y 4 de la spec: una modal abierta en una fila no afectada por
un refresco de colección permanece abierta sin remontarse, y su contenido interpolado refleja los
datos actualizados.

### Fuera de alcance
- Cualquier cambio en el cierre automático de la modal de una fila que deja de existir en la
  colección resuelta (ya vive en el `useEffect` de `RepeaterNode`, el componente padre, no en
  `RepeaterNodeContent`; no se toca).
- Preservar cualquier otro estado local de `repeater.props.template` distinto de modal (tabs,
  accordions, formularios sin guardar): la spec lo marca explícitamente fuera de alcance; el
  efecto colateral de que también se preserve como consecuencia de esta tarea es aceptado por
  `design.md` pero no se prueba ni se documenta activamente como capacidad nueva.
- El modo grid del repeater (`props.columns`): sin cambios, la preservación aplica igual sin
  relación con el wrapper de grid (regresión a cubrir con los tests existentes, no requiere caso
  nuevo dedicado).

### Dependencias
Ninguna.

### Interfaces
**Consume**: ninguno.

**Produce**: ninguno (`RepeaterNodeContent` es un componente interno no exportado).

### Impacto esperado en archivos
- Código: `src/runtime/nodes/repeater-layout-node.tsx` — quitar `key={paginationStateKey}` de la instanciación de `<RepeaterNodeContent>` en `RepeaterNode` (pasar `paginationStateKey` como prop normal en su lugar); añadir la prop `paginationStateKey: string` a `RepeaterNodeContentProps`; dentro de `RepeaterNodeContent`, añadir `useEffect(() => { setActivePage(1); setScrollVisibleCount(pageSize ?? 0) }, [paginationStateKey])` (con `pageSize` en la lista de dependencias también, ya que se lee dentro del efecto).
- Tests: `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación).
- Documentación: `nodes/repeater.md`.

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación).

**Comportamiento cubierto**:
- Con una modal abierta en la fila N (key estable) de un `repeater`, refrescar la colección de forma que la fila M ≠ N se elimine (la fila N sigue presente) mantiene el modal de la fila N abierta, y el nodo DOM del panel (`role="dialog"`, obtenido con `screen.getByRole('dialog')`) es exactamente el mismo objeto (`toBe`, no `toEqual`) antes y después del refresco.
- El mismo caso con la fila M añadida (fila nueva) en vez de eliminada.
- El mismo caso con las filas reordenadas (fila N cambia de posición dentro de la colección resuelta, pero conserva su key).
- Tras el refresco de cualquiera de los tres casos anteriores, el contenido interpolado (`item.*`) dentro de la modal de la fila N refleja el valor actualizado de esa fila en la nueva colección (por ejemplo un `heading`/`paragraph` con `item.name` cambia de texto si el mock de datos actualiza el nombre de esa fila).
- Regresión: el test ya existente `'changing the collection closes any modal whose iteration no longer exists'` sigue en verde sin modificarlo.
- Regresión: los tests existentes de reseteo de paginación en `layout-renderer-repeater-state.test.tsx` (vuelta a página 1 al cambiar colección, `pageSize` o shape array/objeto) siguen en verde sin modificarlos.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx
```

**Restricciones**:
- La comprobación de "no remontado" debe hacerse comparando identidad de nodo DOM (`toBe`) capturado antes y después del refresco, no solo comprobando que el modal sigue con `role="dialog"` visible (eso no distingue remount de no-remount).
- No añadir un mecanismo de conteo de montajes (spy en `useEffect`/`componentDidMount`) como técnica principal de aserción: la comparación de identidad de nodo DOM ya es suficiente y más directa; puede usarse como complemento si aporta claridad, no como sustituto.

### Documentación afectada
- [`nodes/repeater.md`](../../docs/app-features/nodes/repeater.md) — nueva nota sobre reconciliación por fila: un refresco de colección ya no remonta el subárbol completo del repeater, solo añade/quita/reordena filas según su key, preservando el estado local (incluida una modal abierta) de las filas no afectadas.

### Criterios de finalización
- `RepeaterNodeContent` deja de remontarse por cambio de colección/`pageSize`/variante, conservando el reseteo de paginación observable; todos los tests del bloque en verde, sin regresión en `layout-renderer-repeater-state.test.tsx` ni en `layout-renderer-repeater-pagination.test.tsx`.

### Cierre de implementación
Código y tests de esta tarea completos y validados.
