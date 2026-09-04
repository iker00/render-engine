# Tasks: Feature 2026-09-04-14-44 - reusable-node-groups

Plan de ejecución derivado de `spec.md` y `design.md`. Cada tarea es atómica, verificable
por sí misma y ordenada por dependencia. Las tareas T01–T05 forman el pre-incremento de
generalización del scoping (Decisión 5 del design, secuenciada primero por su recomendación
explícita); T06–T12 construyen el contrato de `groups` encima; T13–T15 cubren el nivel de
soporte en `dev-editor` v1.

Reglas globales de testing (no repetir por tarea): las convenciones vigentes viven en
`ai-workflow/standards/testing-rules.md` y aplican a todas las tareas de este plan. El
umbral de cobertura del proyecto es gate de la pasada completa, no de cada tarea.

---

## T01 — Introducir helper compartido de cadena de scope ambiente

### Objetivo
Introducir en `src/runtime/runtime-references/` un módulo puro que defina la cadena de
scope ambiente (`RuntimeInstanceScope`) y las primitivas para componerla y derivar la
clave efectiva de un `id` literal contra ella. Es la base sobre la que T02–T05 migran
modal, accordion, forms y acciones para dejar de compartir estado entre iteraciones/instancias.

### Fuera de alcance
- No thread aún la cadena por `LayoutRenderer` (T02).
- No migrar todavía ningún consumidor (modal/accordion/forms/acciones): T03–T05.
- No introducir el concepto en la validación de config; el helper es puramente runtime.

### Dependencias
- Ninguna.

### Interfaces
- Consume: ninguno.
- Produce:
  - `type RuntimeInstanceScopeToken = { kind: 'repeater'; key: string } | { kind: 'group'; token: string }` — consumido por: T02, T03, T04, T05.
  - `type RuntimeInstanceScope = readonly RuntimeInstanceScopeToken[]` — consumido por: T02, T03, T04, T05, T10, T12.
  - `pushRepeaterScopeToken(scope: RuntimeInstanceScope, key: string): RuntimeInstanceScope` — consumido por: T02.
  - `pushGroupScopeToken(scope: RuntimeInstanceScope, token: string): RuntimeInstanceScope` — consumido por: T12.
  - `deriveScopedStateKey(baseId: string, scope: RuntimeInstanceScope): string` — consumido por: T03, T04, T05.
  - `EMPTY_INSTANCE_SCOPE: RuntimeInstanceScope` — consumido por: T02, T03, T04, T05.

### Impacto esperado en archivos
- Código a crear: `src/runtime/runtime-references/runtime-instance-scope.ts`.
- Tests a crear: `src/tests/runtime/runtime-instance-scope.test.ts`.
- Documentación afectada: ninguna (helper interno).

### Tests
- Ficheros de test: `src/tests/runtime/runtime-instance-scope.test.ts` (nuevo).
- Comportamiento cubierto:
  - `EMPTY_INSTANCE_SCOPE` es una lista vacía inmutable.
  - `pushRepeaterScopeToken` devuelve una nueva cadena con el token de repeater al final (más interno primero cuando se derive la clave, ver bullet siguiente); no muta la entrada.
  - `pushGroupScopeToken` idem para tokens de grupo.
  - `deriveScopedStateKey` con `scope` vacío devuelve exactamente el `baseId` original (regresión cero para configs sin repeater ni groups).
  - `deriveScopedStateKey` con un token de repeater concatena de forma determinista `baseId` y `key` del repeater (formato estable documentado in-place).
  - `deriveScopedStateKey` con un token de grupo concatena de forma determinista `baseId` y `token` del grupo.
  - `deriveScopedStateKey` con cadena mixta (repeater ancestro + grupo interno, y viceversa) produce claves distintas para el mismo `baseId` según el orden de los tokens.
  - Dos `baseId` distintos bajo el mismo scope producen claves distintas.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/runtime/runtime-instance-scope.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- Ninguna en esta tarea. La cadena de scope se documentará al cerrar T05 y T12 en la pasada de `update-app-documentation`.

### Cierre de implementación
- Módulo `runtime-instance-scope.ts` creado y todos los tests del fichero en verde.

---

## T02 — Threading de `scopeChain` por `LayoutRenderer` / `LayoutNodeRenderer` y `repeater`

### Objetivo
Añadir un prop `scopeChain: RuntimeInstanceScope` como prop opcional adicional a
`LayoutRenderer`/`LayoutNodeRenderer`, propagado a los nodos hijos junto al ya existente
`iterationContext`. `RepeaterNode` pasa a construir la cadena hija empujando un token de
tipo `repeater` con la key de cada iteración. Sin consumidores todavía (los consumidores
migran en T03/T04/T05), la cadena viaja pero no cambia comportamiento.

### Fuera de alcance
- No migrar aún modal (T03), accordion (T04), forms (T05).
- No introducir tokens de grupo (T12).
- No sustituir `iterationContext` por la cadena: coexisten. `iterationContext` sigue siendo la única fuente para `item.*`/`item.$key`/`item.$index`.

### Dependencias
- T01.

### Interfaces
- Consume:
  - `type RuntimeInstanceScope = readonly RuntimeInstanceScopeToken[]` (de T01).
  - `pushRepeaterScopeToken(scope: RuntimeInstanceScope, key: string): RuntimeInstanceScope` (de T01).
  - `EMPTY_INSTANCE_SCOPE: RuntimeInstanceScope` (de T01).
- Produce:
  - Extensión del prop de `LayoutRenderer`/`LayoutNodeRenderer`: `scopeChain?: RuntimeInstanceScope` — consumido por: T03, T04, T05, T12.
  - Contrato de propagación: cuando `scopeChain` está ausente, los descendientes lo reciben como `EMPTY_INSTANCE_SCOPE` — consumido por: T03, T04, T05.

### Impacto esperado en archivos
- Código a modificar: `src/runtime/layout-renderer.tsx`, `src/runtime/layout-node-renderer.tsx`, `src/runtime/nodes/repeater-layout-node.tsx`.
- Tests a crear: `src/tests/layout-renderer/layout-renderer-scope-chain-threading.test.tsx`.
- Documentación afectada: ninguna (mecanismo interno de propagación; se documenta con los cierres funcionales en T05/T12).

### Tests
- Ficheros de test: `src/tests/layout-renderer/layout-renderer-scope-chain-threading.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Un nodo consumidor (helper de test que expone la `scopeChain` recibida) renderizado fuera de todo `repeater` recibe una cadena vacía.
  - El mismo nodo dentro de `repeater.props.template` recibe una cadena con exactamente un token `{ kind: 'repeater', key: <key de la iteración> }` por iteración, distinta por iteración.
  - Un `repeater` anidado dentro de otro `repeater.props.template` produce una cadena de longitud 2, con la iteración exterior primero según el orden definido por `deriveScopedStateKey` (fijado en T01).
  - Ninguna regresión visible en render actual: un layout sin repeater se renderiza exactamente igual que antes (comparación de estructura de render con y sin la nueva prop declarada explícitamente por el consumidor de prueba).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-scope-chain-threading.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- Ninguna en esta tarea; el mecanismo de propagación queda documentado con la publicación funcional del scope en T05.

### Cierre de implementación
- Prop `scopeChain` propagado por `LayoutRenderer`/`LayoutNodeRenderer`, poblado por `repeater`, todos los tests del fichero de esta tarea en verde y suite existente relacionada (`layout-renderer-basic-nodes`, `layout-renderer-repeater-basic`, `layout-renderer-repeater-state`) sin regresiones.

---

## T03 — Migrar `modal` y `openModal`/`closeModal` a scope-chain

### Objetivo
Sustituir el keying actual de `modal` (por `iterationKey` singular) por keying basado en
`deriveScopedStateKey` sobre el `scopeChain` ambiente. Migrar los actions
`openModal`/`closeModal` en `runtime-actions/` para que resuelvan la clave efectiva a
partir de la cadena en vez de un único `iterationContext.key`. Preservar exactamente el
comportamiento actual cuando la cadena tiene 0 o 1 token de repeater (cero regresión).

### Fuera de alcance
- No cambia la regla global "solo un modal abierto a la vez".
- No cambia el comportamiento de `defaultOpen: true` fuera de `repeater.props.template` (ya rechazado dentro; no se toca).
- Accordion y forms se migran en T04/T05.

### Dependencias
- T01, T02.

### Interfaces
- Consume:
  - `type RuntimeInstanceScope` (de T01).
  - `deriveScopedStateKey(baseId: string, scope: RuntimeInstanceScope): string` (de T01).
  - `EMPTY_INSTANCE_SCOPE: RuntimeInstanceScope` (de T01).
  - Prop `scopeChain?: RuntimeInstanceScope` propagado por `LayoutRenderer` (de T02).
- Produce:
  - Firma actualizada: `openModal(modalId: string, opts: { scopeChain: RuntimeInstanceScope }): void` — consumido por: T05 (indirecto vía runtime-actions), T12 (`GroupLayoutNode` puede contener un `modal` en su template; misma resolución de clave).
  - Firma actualizada: `closeModal(modalId: string, opts: { scopeChain: RuntimeInstanceScope }): void` — consumido por: T12.
  - Selector `isModalOpen(state, modalId: string, scope: RuntimeInstanceScope): boolean` — consumido por: T12.

### Impacto esperado en archivos
- Código a modificar: `src/runtime/nodes/modal-layout-node.tsx`, `src/runtime/runtime-state/runtime-state-selectors.ts`, `src/runtime/runtime-state/runtime-state-reducer.ts`, `src/runtime/runtime-actions/runtime-ui-action-executor.ts` (resolución de `openModal`/`closeModal`).
- Tests a modificar: `src/tests/runtime-state/runtime-state-modal.test.tsx` (ampliación de casos con cadena de repeater anidado), `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación para dos `repeater` anidados con el mismo `modal.id` en el interior sin colisión de estado).
- Documentación afectada: `ai-workflow/docs/app-features/nodes/modal.md` (sección "Comportamiento en `repeater.props.template`" se generaliza a "en cadenas de scope"; no se edita en este plan, sí en `update-app-documentation`).

### Tests
- Ficheros de test:
  - `src/tests/runtime-state/runtime-state-modal.test.tsx` (ampliación).
  - `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx` (ampliación).
- Comportamiento cubierto:
  - Cero regresión: un `modal` fuera de todo `repeater` sigue teniendo la misma clave efectiva de store que antes (cadena vacía → `baseId` literal). Los tests existentes de `runtime-state-modal.test.tsx` siguen en verde.
  - Un `modal` dentro de `repeater.props.template` sigue teniendo estado por iteración (mismo comportamiento visible que antes) pero la clave se deriva de la cadena, no de `iterationContext.key`.
  - Dos `repeater` anidados con un `modal` con el mismo `id` en el interior: abrir el modal de la iteración `(A,1)` no cambia el estado del modal de la iteración `(A,2)` ni de `(B,1)`. Un `openModal` desde un botón del subárbol de `(A,1)` abre exactamente esa instancia.
  - `openModal` disparado dentro de un `repeater.props.template` sobre un `modalId` declarado a nivel de página (fuera de todo repeater) sigue abriendo esa instancia global: la resolución del closest declaration mantiene su semántica anterior — la cadena de scope no se propaga a modales declarados fuera de ella (regla ya vigente para el caso singular, generalizada aquí).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/runtime-state/runtime-state-modal.test.tsx`
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/modal.md`.

### Cierre de implementación
- Modal, sus acciones y su store keyed por scope-chain; los dos ficheros de test de esta tarea en verde, sin regresión en la suite de modal existente.

---

## T04 — Migrar coordinación de `accordion.props.groupId` a scope-chain

### Objetivo
Extender `AccordionGroupProvider` para que la coordinación por `groupId` se aísle por
cadena de scope: dos instancias de accordion con el mismo `groupId` en iteraciones
distintas del mismo `repeater` (o en instancias distintas de un mismo grupo en el futuro,
por T12) no se coordinan entre sí. Cero regresión para accordions sin `groupId` o fuera
de todo `repeater`/`group`.

### Fuera de alcance
- No cambia el contrato de `props.groupId` en el JSON (sigue siendo string opcional).
- No cambia el resto de comportamientos del accordion (defaultOpen, chevron, transiciones, iconos): fuera de alcance.

### Dependencias
- T01, T02.

### Interfaces
- Consume:
  - `type RuntimeInstanceScope` (de T01).
  - `deriveScopedStateKey(baseId: string, scope: RuntimeInstanceScope): string` (de T01).
  - Prop `scopeChain?: RuntimeInstanceScope` propagado por `LayoutRenderer` (de T02).
- Produce:
  - Firma actualizada del contexto: `openInGroup(groupId: string, instanceId: string, scope: RuntimeInstanceScope): void` — consumido por: T12 (accordion dentro de `groups.*.template`).
  - `closeInGroup(groupId: string, scope: RuntimeInstanceScope): void` — consumido por: T12.
  - `getActiveInstanceId(groupId: string, scope: RuntimeInstanceScope): string | null` — consumido por: T12.
  - `claimDefaultOpen(groupId: string, instanceId: string, scope: RuntimeInstanceScope): boolean` — consumido por: T12.

### Impacto esperado en archivos
- Código a modificar: `src/runtime/runtime-accordion-group.tsx`, `src/runtime/runtime-accordion-group-value.ts`, `src/runtime/nodes/accordion-layout-node.tsx`, `src/runtime/use-accordion-group.ts`.
- Tests a modificar: `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación con casos de repeater anidado y groupId compartido).
- Documentación afectada: `ai-workflow/docs/app-features/nodes/accordion.md` (sección "Uso dentro de `repeater.props.template`" cambia de "todas las instancias participan en el mismo grupo" a "coordinación por scope-chain"; se actualiza en `update-app-documentation`, no aquí).

### Tests
- Ficheros de test: `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación).
- Comportamiento cubierto:
  - Cero regresión: dos accordions con el mismo `groupId` en la misma página (sin `repeater` ancestro) siguen coordinándose exactamente igual que antes.
  - Dos accordions con el mismo `groupId` dentro de `repeater.props.template` en iteraciones distintas ya NO se coordinan entre sí: abrir el de la fila 1 no cierra el de la fila 2. Este es un cambio de comportamiento respecto a la doc previa, alineado con la Decisión 5 del design y homólogo al comportamiento previo de `modal`.
  - Dos accordions con el mismo `groupId` dentro de la misma iteración (por ejemplo hermanos en `template`) siguen coordinándose entre sí (misma clave efectiva).
  - Un accordion con `groupId` dentro de `repeater.props.template` y otro accordion con el mismo `groupId` fuera del repeater: no se coordinan entre sí (cadenas de scope distintas).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/accordion.md`.

### Cierre de implementación
- Coordinación por `groupId` scopeada por cadena de scope; tests del fichero en verde, sin regresión en la suite de accordion existente ni en `layout-renderer-accordion-edit-mode.test.tsx`.

---

## T05 — Migrar `forms.{formId}.{fieldId}` y `resetForm` a scope-chain

### Objetivo
Migrar el dominio de formularios del store (`runtime-state/`) para que la clave efectiva
de cada campo sea `deriveScopedStateKey(formId, scope)` seguida del `fieldId`. Migrar la
resolución de referencias `forms.{formId}.{fieldId}` en `runtime-references/` para que
consulte la clave efectiva a partir de la cadena de scope ambiente. Migrar el action
`resetForm` en `runtime-actions/` para que resuelva la clave efectiva de forma análoga.
Cero regresión para formularios fuera de todo `repeater`/`group`.

### Fuera de alcance
- No implementa `direccionamiento explícito cross-instancia` (por diseño, ver No objetivo del design).
- No cambia el contrato público de `form.id` ni de `fieldId`.
- No toca el submit ni sus validaciones; solo cambia la clave de acceso al store.

### Dependencias
- T01, T02.

### Interfaces
- Consume:
  - `type RuntimeInstanceScope` (de T01).
  - `deriveScopedStateKey(baseId: string, scope: RuntimeInstanceScope): string` (de T01).
  - Prop `scopeChain?: RuntimeInstanceScope` propagado por `LayoutRenderer` (de T02).
- Produce:
  - Selector `getFormFieldValue(state, formId: string, fieldId: string, scope: RuntimeInstanceScope): unknown` — consumido por: resolvers de `runtime-references/`; T12 (form dentro de `groups.*.template`).
  - Selector `getFormFieldError(state, formId: string, fieldId: string, scope: RuntimeInstanceScope): string | null` — consumido por: los mismos.
  - Reducer accept: `SET_FORM_FIELD_VALUE` acepta ahora `{ scopeKey: string, fieldId: string, value: unknown }` en lugar de `{ formId, fieldId, value }` — consumido internamente por T05.
  - Firma actualizada: `resetForm(formId: string, opts: { scopeChain: RuntimeInstanceScope }): void` — consumido por: T12.
  - Resolución de referencias: `forms.{formId}.{fieldId}` acepta un `scope: RuntimeInstanceScope` como opción del resolver — sin consumidores directos adicionales fuera de esta tarea (uso interno del propio resolver de `forms.*`; `group.*` en T09/T10 resuelve contra su propio contexto de grupo, no contra esta opción).

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-state/runtime-state-reducer.ts`, `runtime-state-selectors.ts`, `runtime-state-types.ts`, `runtime-state-provider.tsx`, `use-runtime-state.ts`.
  - `src/runtime/runtime-references/runtime-reference-resolver.ts` (aceptar `scope` como opción; resolver `forms.*` con clave efectiva).
  - `src/runtime/nodes/form-layout-node.tsx` (usar `scopeChain` ambiente al leer/escribir campos y al ensamblar el snapshot de submit).
  - `src/runtime/nodes/input-layout-node.tsx`, `textarea-layout-node.tsx`, `select-layout-node.tsx`, `radio-group-layout-node.tsx`, `checkbox-group-layout-node.tsx`, `toggle-layout-node.tsx`, `hidden-layout-node.tsx`, `autocomplete-layout-node.tsx`, `file-input-layout-node.tsx` (pasar `scopeChain` a los helpers del store).
  - `src/runtime/runtime-actions/runtime-ui-action-executor.ts` (`resetForm` resuelve `scopeChain`).
- Tests a crear: `src/tests/runtime-state/runtime-state-forms-scope-chain.test.tsx`.
- Tests a modificar: `src/tests/runtime-state/runtime-state-forms-queries.test.tsx`, `src/tests/runtime-state/runtime-state-form-lifecycle.test.tsx`, `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación de casos con `forms.*` bajo `repeater`).
- Documentación afectada: `ai-workflow/docs/app-features/forms/lifecycle.md` (sección "Modelo" y "Encaje en el contrato de páginas" para reflejar el keying por scope-chain), `ai-workflow/docs/app-features/references/reference-resolution.md` (nota sobre `forms.*` y cadena de scope). No se editan aquí.

### Tests
- Ficheros de test:
  - `src/tests/runtime-state/runtime-state-forms-scope-chain.test.tsx` (nuevo).
  - `src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (ampliación).
  - `src/tests/runtime-state/runtime-state-form-lifecycle.test.tsx` (ampliación).
  - `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Comportamiento cubierto:
  - Cero regresión: un formulario fuera de todo `repeater`/`group` produce la misma clave efectiva de store que antes (cadena vacía → `formId` literal); todos los tests existentes siguen en verde.
  - Un `form` con el mismo `formId` en dos iteraciones distintas de un mismo `repeater.props.template` mantiene valor, error, `touched`, `dirty` y `defaultValue` independientes por iteración; editar el campo de la iteración 1 no afecta al de la iteración 2.
  - `forms.{formId}.{fieldId}` referenciado desde dentro del subárbol iterado resuelve el valor de la iteración en curso (misma cadena de scope); desde fuera de la cadena (por ejemplo un `paragraph` fuera del `repeater`) degrada a "no encontrado" en vez de leer accidentalmente el de una iteración concreta.
  - `resetForm({ formId })` disparado desde un botón dentro de una iteración resetea solo el formulario de esa iteración; el mismo action fuera del `repeater` no afecta a los formularios internos.
  - Submit del formulario de una iteración ensambla el payload solo con los campos de esa iteración; no mezcla campos de otra iteración con el mismo `formId`.
  - `form.persistOnUnmount: true` en un `form` dentro de `repeater.props.template` preserva el estado por iteración (mismo criterio que antes, comprobado ahora con dos iteraciones simultáneas).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/runtime-state/runtime-state-forms-scope-chain.test.tsx`
  - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx`
  - `pnpm test --run src/tests/runtime-state/runtime-state-form-lifecycle.test.tsx`
  - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/forms/lifecycle.md`.
- `ai-workflow/docs/app-features/references/reference-resolution.md`.

### Cierre de implementación
- Dominio de forms keyed por scope-chain, `resetForm` migrado, resolver de `forms.*` acepta `scope`; los cuatro ficheros de test en verde y suite de forms existente (validations, submit, tabs, steps) sin regresiones.

---

## T06 — Contrato Zod y tipos del bloque raíz `groups`, nodos `group` y `slot`

### Objetivo
Añadir el bloque raíz opcional `groups` a `runtime-config-root-zod.ts`/`runtime-config-types.ts`
y los tipos de nodo `group` y `slot` a la unión discriminada del catálogo en
`runtime-config-zod.ts`. Solo shape estructural (contratos individuales de cada campo); las
validaciones cruzadas y contextuales viven en T07/T08.

### Fuera de alcance
- No implementa render (T11/T12).
- No añade validación cruzada de `props.params` vs `groups.{groupId}.params` ni del `slot` (T08).
- No modifica el resolver de referencias (T09/T10).

### Dependencias
- Ninguna estructural (puede ir en paralelo a T01–T05).

### Interfaces
- Consume: ninguno.
- Produce:
  - Type `RuntimeGroupsConfig = Record<string, { params: string[]; template: RuntimeLayoutNode[] }>` — consumido por: T07, T08, T09, T10, T12, T13, T14, T15.
  - Type `RuntimeGroupInstanceNode = { type: 'group'; id?: string; layout?: NodeLayout; visibility?: NodeVisibility; queryStateFeedback?: NodeQueryStateFeedback; props: { groupId: string; params: Record<string, unknown> }; children?: RuntimeLayoutNode[] }` — consumido por: T08, T11, T12, T15.
  - Type `RuntimeSlotNode = { type: 'slot' }` — consumido por: T07, T11.
  - Extensión de `RuntimeConfig`: campo opcional `groups?: RuntimeGroupsConfig` en el shape público del config — consumido por: T08, T12, T13, T14.

### Impacto esperado en archivos
- Código a modificar: `src/config/runtime-config-root-zod.ts`, `src/config/runtime-config-zod.ts`, `src/config/runtime-config-types.ts`.
- Tests a crear: `src/tests/config-validation/runtime-config-validation-groups-shape.test.ts`.
- Documentación afectada: `ai-workflow/docs/app-features/config/structure.md` (bloque raíz `groups`), `ai-workflow/docs/app-features/nodes/index.md` (entradas de `group` y `slot`). No se editan aquí.

### Tests
- Ficheros de test: `src/tests/config-validation/runtime-config-validation-groups-shape.test.ts` (nuevo).
- Comportamiento cubierto:
  - Un config sin bloque `groups` se acepta exactamente igual que hoy (regresión cero).
  - Un config con `groups: {}` se acepta.
  - Un config con `groups.card.params = ['title']` y `groups.card.template = []` se acepta.
  - Rechazo con ruta canónica cuando `groups` no es objeto plano.
  - Rechazo con ruta canónica cuando algún `groupId` es string vacío, cuando algún `params[i]` no es string no vacío, o cuando aparecen `params` duplicados.
  - Rechazo con ruta canónica cuando `template` no es array.
  - Un nodo `{ type: 'group', props: { groupId: 'x', params: { title: 'y' } } }` es aceptado por el shape estructural (validación cruzada de `groupId`/`params` es de T08).
  - Un nodo `{ type: 'slot' }` es aceptado por shape estructural aislado (la restricción de contexto es de T07).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-groups-shape.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/config/structure.md`.
- `ai-workflow/docs/app-features/nodes/index.md`.

### Cierre de implementación
- Tipos y schemas Zod añadidos; test del fichero en verde; ningún test existente en `config-validation/` regresa.

---

## T07 — Flag `insideGroupTemplate` en el validador recursivo de layout

### Objetivo
Extender el validador recursivo de `validate-layout-nodes.ts`/`validate-layout-nodes-core.ts`
con un parámetro de contexto `insideGroupTemplate: boolean` (default `false` en cualquier
llamada existente). Con el flag activo, `type: 'slot'` es un discriminante válido en la
posición actual; con el flag inactivo, `slot` se rechaza como `unsupported-node-type`.
Con el flag activo, `type: 'group'` se rechaza como `invalid-layout` (anidamiento de
grupos fuera de alcance v1).

### Fuera de alcance
- No cuenta cuántos `slot` hay en un template (T08).
- No valida `props.params` de la instancia `group` (T08).
- No cambia el resto de reglas del validador recursivo.

### Dependencias
- T06.

### Interfaces
- Consume:
  - `type RuntimeSlotNode = { type: 'slot' }` (de T06).
- Produce:
  - Firma actualizada del validador recursivo: `validateLayoutNodesRecursive(nodes: unknown[], ctx: { insideGroupTemplate: boolean, ...ctxExistente }): ValidationResult` — consumido por: T08 (llamada desde `validate-groups.ts` con `insideGroupTemplate: true`).

### Impacto esperado en archivos
- Código a modificar: `src/config/validate-layout-nodes.ts`, `src/config/validate-layout-nodes-core.ts` (y llamadas existentes con `insideGroupTemplate: false` por defecto explícito para no cambiar semántica).
- Tests a modificar: `src/tests/config-validation/runtime-config-validation-groups-shape.test.ts` (añadir casos de rechazo de `slot`/`group` según contexto).
- Documentación afectada: `ai-workflow/docs/app-features/config/validation.md` (nota sobre la validación contextual de `slot`/`group`). No se edita aquí.

### Tests
- Ficheros de test: `src/tests/config-validation/runtime-config-validation-groups-shape.test.ts` (ampliación).
- Comportamiento cubierto:
  - Un `{ type: 'slot' }` en `pages[].layout` (fuera de `groups.*.template`) se rechaza con `unsupported-node-type` y ruta canónica.
  - Un `{ type: 'slot' }` dentro de cualquier `container.children`/`repeater.props.template` normal (no de grupo) se rechaza igual.
  - Un `{ type: 'group', ... }` dentro de `groups.card.template` se rechaza con `invalid-layout` (anidamiento no soportado v1) con ruta canónica que incluye `groups.card.template[i]`.
  - Un `{ type: 'slot' }` dentro de `groups.card.template` (a cualquier profundidad estructural) se acepta a este nivel (el conteo de duplicados es de T08).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-groups-shape.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/config/validation.md`.

### Cierre de implementación
- Validador recursivo acepta `insideGroupTemplate`, todos los casos añadidos al fichero de test en verde, sin regresión en el resto de la suite de `config-validation/`.

---

## T08 — Validador dedicado `validate-groups.ts`

### Objetivo
Añadir `src/config/validate-groups.ts` como módulo dedicado, invocado desde
`validate-runtime-config.ts` como validación cruzada previa al render. Cubre:
- Recuento recursivo de `slot` por definición (`> 1` rechaza).
- Validación cruzada de cada instancia `group` encontrada en cualquier layout: `props.groupId`
  existe en `groups`; `keys(props.params)` coincide exactamente con `groups[groupId].params`;
  `children` solo si el `template` declara exactamente un `slot`.

### Fuera de alcance
- Contrato Zod del shape (ya en T06).
- Bloqueo estructural de `slot`/`group` en contexto incorrecto (ya en T07).
- Resolución de referencias (T09/T10).
- Render (T11/T12).

### Dependencias
- T06, T07.

### Interfaces
- Consume:
  - `type RuntimeGroupsConfig` (de T06).
  - `type RuntimeGroupInstanceNode` (de T06).
  - Validador recursivo con `insideGroupTemplate: true` (de T07).
- Produce:
  - `validateGroupsConfig(config: RuntimeConfig): ValidationResult` — consumido por: `validate-runtime-config.ts` (mismo patrón que `validatePreloads` o `validateShell`).

### Impacto esperado en archivos
- Código a crear: `src/config/validate-groups.ts`.
- Código a modificar: `src/config/validate-runtime-config.ts` (llamada a `validateGroupsConfig`).
- Tests a crear: `src/tests/config-validation/runtime-config-validation-groups.test.ts`.
- Documentación afectada: `ai-workflow/docs/app-features/config/validation.md`, `ai-workflow/docs/app-features/config/structure.md`. No se editan aquí.

### Tests
- Ficheros de test: `src/tests/config-validation/runtime-config-validation-groups.test.ts` (nuevo).
- Comportamiento cubierto:
  - `groups.card.template` con dos nodos `slot` a cualquier profundidad rechaza el config con ruta que identifique `groups.card`.
  - `groups.card.template` con un nodo `group` anidado rechaza el config (delegación en T07 pero cobertura de extremo a extremo aquí).
  - Instancia `{ type: 'group', props: { groupId: 'missing' } }` en un `pages[].layout` rechaza con ruta sobre la instancia y motivo "groupId inexistente".
  - Instancia con `props.params` que omite un nombre declarado por el grupo rechaza con ruta sobre la instancia.
  - Instancia con `props.params` que añade claves no declaradas rechaza con ruta sobre la instancia.
  - Instancia con `children` no vacío sobre un grupo cuyo `template` no declara `slot` rechaza con ruta sobre la instancia.
  - Instancia con `children` sobre un grupo con `slot` es aceptada.
  - Instancia con `groupId` válido, `params` que coincide exactamente y sin `children` sobre un grupo sin `slot` es aceptada.
  - Cobertura de detección recursiva: instancia `group` dentro de `container.children`, dentro de `repeater.props.template`, dentro de `modal.children`, dentro de `tabs.props.items[i].children`, dentro de `steps.props.items[i].children`, dentro de `accordion` — el validador cruzado la encuentra en todos esos contextos.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-groups.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/config/validation.md`.
- `ai-workflow/docs/app-features/config/structure.md`.

### Cierre de implementación
- `validate-groups.ts` creado y wired en `validate-runtime-config.ts`; todos los casos del fichero en verde; sin regresión en el resto de `config-validation/`.

---

## T09 — Namespace `group.*` en la sintaxis de referencias y superficies admitidas

### Objetivo
Añadir `group.{paramName}` como namespace reconocido en
`src/config/runtime-reference-syntax.ts` (parseo neutral: un segmento tras el namespace,
mismo shape estricto que `params.*`). Extender las mismas tablas/listas de superficies
que hoy comprueban `params.*` para aceptar también `group.*`. No es un shape nuevo: el
runtime lo trata literalmente igual salvo por la fuente contra la que resuelve (T10).

### Fuera de alcance
- Resolver en runtime (T10).
- Cualquier cambio en la validación de instancias `group` (ya en T08).

### Dependencias
- T06.

### Interfaces
- Consume:
  - `type RuntimeGroupsConfig` (de T06) — solo para el cross-check opcional de que el `paramName` referenciado existe en el grupo si el contexto lo permite (nota: la spec fija que `group.*` fuera del template no es soportado, y dentro del template no hay forma estática de saber en qué template está esa referencia si se comparten sub-schemas; por lo tanto este cross-check se hace al recorrer `groups.*.template` en T08 y no aquí; T09 solo añade el parseo).
- Produce:
  - `parseGroupReference(raw: string): { paramName: string } | null` — consumido por: T10.
  - Extensión de las tablas de superficies admitidas de `params.*` para incluir literalmente `group.*` — consumido por: T10 y por el pipeline de validación de referencias en cada superficie afectada (interpolables visibles, `api.query/body/headers`, `button.props.action.query/body/headers`, `form.submitAction.query/body/headers`, `visibility.reference`, `defaultValue` de campos).

### Impacto esperado en archivos
- Código a modificar: `src/config/runtime-reference-syntax.ts`, `src/config/runtime-reference-namespace-guards.ts` y los sitios donde se enumeran las superficies admitidas de `params.*` (búsqueda por patrón `params.` en `src/config/`).
- Tests a crear: `src/tests/config-validation/runtime-config-validation-group-reference-syntax.test.ts`.
- Documentación afectada: `ai-workflow/docs/app-features/references/reference-resolution.md`. No se edita aquí.

### Tests
- Ficheros de test: `src/tests/config-validation/runtime-config-validation-group-reference-syntax.test.ts` (nuevo).
- Comportamiento cubierto:
  - `group.title`, `group.userId` parsean como referencia válida `{ paramName }`.
  - `group`, `group.` , `group.a.b`, `group..x`, `group.$key` no parsean (misma frontera estricta que `params.*`).
  - En cada superficie donde hoy se acepta `params.*` (según la lista de la sección "Frontera específica de `params.*`" de `reference-resolution.md`), un string igual con `group.*` se acepta con el mismo criterio (no se rechaza en bootstrap, no invalida el config); un `group.*` en una superficie donde `params.*` está fuera de alcance (por ejemplo `repeater.props.items.source`) se sigue rechazando con el mismo mensaje.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/config-validation/runtime-config-validation-group-reference-syntax.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`.

### Cierre de implementación
- Parser y superficies extendidos; test del fichero en verde; suite de `runtime-config-validation-navigate-params.test.ts` y `runtime-config-validation-visibility.test.ts` sin regresión.

---

## T10 — Resolver de `group.*` contra el contexto de grupo ambiente

### Objetivo
Añadir el resolver de `group.{paramName}` en `runtime-references/`. Lee del contexto de
grupo ambiente introducido por `GroupLayoutNode` en T12 (declarado como shape mínimo por
esta tarea para no forzar ordenación) o degrada a "no encontrado" fuera de él. No accede
al store global; el contexto es puramente de render.

### Fuera de alcance
- El componente `GroupLayoutNode` que crea el contexto (T12).
- El componente `SlotLayoutNode` (T11).

### Dependencias
- T09, T02.

### Interfaces
- Consume:
  - `parseGroupReference(raw: string): { paramName: string } | null` (de T09).
  - `type RuntimeInstanceScope` (de T01) — para coexistir con otras familias en el pipeline sin colisión.
- Produce:
  - Type `RuntimeGroupContext = { paramValues: Record<string, unknown> } | null` — consumido por: T12.
  - React context: `RuntimeGroupContextProvider` (misma frontera de `runtime-references/`) con default `null` — consumido por: T12.
  - Extensión del resolver de referencias: opción `groupContext?: RuntimeGroupContext` en las opciones del pipeline de resolución — consumido por: T12 (que provee el contexto activo al recorrer el `template`).
  - Semántica: `group.{paramName}` con `groupContext` presente devuelve `paramValues[paramName]` (o el mismo criterio de "no encontrado" si el nombre no existe, aunque T08 garantiza que no puede pasar si el config es válido); con `groupContext` nulo degrada al mismo criterio de degradación ya vigente para referencias sin dato (string vacío en superficies textuales).

### Impacto esperado en archivos
- Código a crear: `src/runtime/runtime-references/runtime-group-context.tsx`, ampliación de `runtime-reference-resolver.ts`, `runtime-reference-types.ts`.
- Tests a modificar: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación con casos de `group.*` con y sin contexto).
- Documentación afectada: `ai-workflow/docs/app-features/references/reference-resolution.md`. No se edita aquí.

### Tests
- Ficheros de test: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Comportamiento cubierto:
  - `group.title` con `groupContext = { paramValues: { title: 'Hola' } }` resuelve `'Hola'`.
  - `group.title` sin `groupContext` degrada a string vacío en superficie textual.
  - `group.title` con `groupContext = { paramValues: {} }` degrada a string vacío (dato no disponible).
  - `group.title` como interpolación parcial dentro de `"Hola {{group.title}}"` produce `"Hola Hola"` en la superficie visible.
  - Coexistencia con `item.*` y `params.*` en el mismo string: `"{{params.section}} — {{item.name}} — {{group.title}}"` resuelve las tres familias sin colisión.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md`.

### Cierre de implementación
- Resolver `group.*` operativo con contexto de render; test del fichero en verde; sin regresión en el resto de la suite de referencias.

---

## T11 — `SlotLayoutNode` y contexto de contenido de slot

### Objetivo
Introducir un componente `SlotLayoutNode` mínimo y un React context de "contenido de slot"
(alojado en `src/runtime/nodes/` junto al resto de nodos). El componente no recurse sobre
props/children propios (no los tiene): lee del contexto de slot el ReactNode ya renderizado
por `GroupLayoutNode` en T12 y lo pinta en su posición.

### Fuera de alcance
- El componente `GroupLayoutNode` que proporciona el contexto (T12).
- Reglas estructurales de children (T07 ya reserva `slot` para dentro de `groups.*.template`).

### Dependencias
- T06.

### Interfaces
- Consume:
  - `type RuntimeSlotNode` (de T06).
- Produce:
  - Type `RuntimeSlotContent = ReactNode | null` — consumido por: T12.
  - React context: `SlotContentProvider` con default `null` — consumido por: T12.
  - Componente `SlotLayoutNode({ node }: { node: RuntimeSlotNode })` — registrado en `node-components-map.ts` en esta tarea.

### Impacto esperado en archivos
- Código a crear: `src/runtime/nodes/slot-layout-node.tsx`, `src/runtime/nodes/slot-content-context.tsx` (o co-ubicado con el propio nodo).
- Código a modificar: `src/runtime/nodes/node-components-map.ts`.
- Tests a crear: `src/tests/layout-renderer/layout-renderer-slot.test.tsx`.
- Documentación afectada: `ai-workflow/docs/app-features/nodes/group.md` (ficha nueva, cubre `group` + `slot` juntos). No se edita aquí.

### Tests
- Ficheros de test: `src/tests/layout-renderer/layout-renderer-slot.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Un `SlotLayoutNode` renderizado sin `SlotContentProvider` (contexto por defecto `null`) no renderiza nada al DOM (rama de slot vacío soportada por spec: "Una instancia sin `children` sobre un grupo con `slot` renderiza el slot vacío").
  - Un `SlotLayoutNode` renderizado dentro de un `SlotContentProvider` con un ReactNode concreto (por ejemplo `<span>hola</span>`) renderiza exactamente ese ReactNode en su posición.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-slot.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/group.md` (ficha nueva; se crea en `update-app-documentation`).

### Cierre de implementación
- `SlotLayoutNode` + `SlotContentProvider` creados y wired en el mapa central de nodos; test del fichero en verde.

---

## T12 — `GroupLayoutNode`: expansión de `template`, contexto de grupo y scope-chain

### Objetivo
Implementar `GroupLayoutNode` en `src/runtime/nodes/`, wired al mapa central y a la lista
de nodos cuyo `children` sí se interpreta (junto a `container`, `form`, `modal`, `link`,
`accordion`). En cada render:
1. Resuelve `props.params.{name}` contra el contexto ambiente actual (mismo pipeline de
   referencias que cualquier otro consumidor).
2. Renderiza `props.children` (el slot) contra ese mismo contexto ambiente, produciendo
   un ReactNode que capturará el `SlotContentProvider` de T11.
3. Empuja un token de grupo derivado de la posición estructural del árbol renderizado a
   la `scopeChain` (`pushGroupScopeToken` de T01) y renderiza `groups[groupId].template`
   envuelto en `RuntimeGroupContextProvider` (de T10) con los `paramValues` resueltos, en
   `SlotContentProvider` con el slot capturado, y con la nueva `scopeChain` propagada por
   `LayoutRenderer`.
4. El slot render nunca ve `group.*`: se renderiza antes de entrar en el provider (paso 2).

### Fuera de alcance
- Anidamiento de grupos (rechazado en T08).
- Soporte en `dev-editor` (T13–T15).

### Dependencias
- T02, T03, T04, T05, T06, T08, T10, T11.

### Interfaces
- Consume:
  - `type RuntimeGroupInstanceNode` (de T06).
  - `type RuntimeGroupsConfig` (de T06).
  - `type RuntimeInstanceScope` (de T01).
  - `pushGroupScopeToken(scope: RuntimeInstanceScope, token: string): RuntimeInstanceScope` (de T01).
  - `RuntimeGroupContext` y su provider (de T10).
  - `RuntimeSlotContent` y su provider (de T11).
  - Prop `scopeChain?: RuntimeInstanceScope` de `LayoutRenderer` (de T02).
  - Actions `openModal(modalId, { scopeChain })`, `closeModal(modalId, { scopeChain })` (de T03) — activos indirectamente al renderizar un `modal` dentro del `template`.
  - Selector `getFormFieldValue(state, formId, fieldId, scope)` (de T05) — idem para `form`.
  - Coordinación de accordion por scope (de T04) — idem para `accordion`.
- Produce:
  - Componente `GroupLayoutNode({ node, iterationContext, scopeChain }: { node: RuntimeGroupInstanceNode, iterationContext?: RuntimeIterationContext, scopeChain?: RuntimeInstanceScope })` — registrado en `node-components-map.ts`.
  - Extensión de la lista de nodos cuyo `children` sí se interpreta en `layout-node-children.ts` (o donde viva esa lista): añadir `'group'` — consumido por: T15.

### Impacto esperado en archivos
- Código a crear: `src/runtime/nodes/group-layout-node.tsx`.
- Código a modificar: `src/runtime/nodes/node-components-map.ts`, `src/runtime/layout-node-children.ts` (añadir `group`), `src/config/layout-placement-rules.ts` si esa lista se refleja allí para reglas de dev-editor (verificar).
- Tests a crear: `src/tests/layout-renderer/layout-renderer-groups.test.tsx`.
- Documentación afectada: `ai-workflow/docs/app-features/nodes/group.md` (ficha nueva), `ai-workflow/docs/app-features/nodes/index.md` (entrada `group`/`slot`), `ai-workflow/docs/app-features/nodes/repeater.md` (nota "combinación con `group`"), `ai-workflow/docs/app-features/references/reference-resolution.md` (frontera de `group.*`), `ai-workflow/docs/current-state.md` (consolidación del estado del área). No se editan aquí.

### Tests
- Ficheros de test: `src/tests/layout-renderer/layout-renderer-groups.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Un grupo con un parámetro de texto (`params: ['title']`) y sin slot, instanciado dos veces con `title` distinto en la misma página, renderiza ambos textos correctamente y de forma independiente (criterio de aceptación 1 de la spec).
  - Un grupo con `slot`, instanciado con `children` distinto en dos puntos de la misma página, renderiza cada contenido en el punto correspondiente (criterio 2).
  - Un grupo instanciado dentro de `repeater.props.template`, con `props.params.foo = 'item.name'` y un `children` que también referencia `item.name`, resuelve ambos contra el item de cada iteración (criterio 3).
  - Una instancia sin `children` sobre un grupo con `slot` renderiza el slot vacío sin romper el árbol.
  - Dos instancias del mismo `groupId` con distinto `props.params` que contienen un `form` con el mismo `formId` en su `template` no comparten estado de formulario (integración con T05 via scope-chain de grupo).
  - Dos instancias del mismo `groupId` que contienen un `modal` con el mismo `id` en su `template` no comparten estado de apertura (integración con T03).
  - Dos instancias del mismo `groupId` que contienen accordions con el mismo `groupId` interno no se coordinan entre sí (integración con T04).
  - El contenido del slot no ve `group.*` aunque el `template` sí (validación de la separación de contextos): un `paragraph.props.text = "{{group.title}}"` dentro del slot degrada a vacío; el mismo string dentro del `template` resuelve.
  - Referencias `queries.*`, `t.*`, `forms.*` (de otro `formId` fuera del template) dentro del `template` se resuelven exactamente igual que si estuvieran escritas inline (regla de "sin scope aislado de referencias").
- Comandos durante la implementación:
  - `pnpm test --run src/tests/layout-renderer/layout-renderer-groups.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/group.md` (nueva).
- `ai-workflow/docs/app-features/nodes/index.md`.
- `ai-workflow/docs/app-features/nodes/repeater.md`.
- `ai-workflow/docs/app-features/references/reference-resolution.md`.
- `ai-workflow/docs/current-state.md`.

### Cierre de implementación
- `GroupLayoutNode` operativo, todos los criterios de aceptación 1–7 de la spec cubiertos por tests, test del fichero en verde, suite de layout-renderer sin regresiones.

---

## T13 — Canvas de `dev-editor` retargeteable a `groups.{groupId}.template`

### Objetivo
Generalizar el concepto de "raíz editable" del canvas de `dev-editor` (hoy implícitamente
fijo a `pages[activePage].layout`) a un target parametrizable con dos variantes iniciales:
`{ kind: 'page-layout'; pageId: string }` (comportamiento actual) y
`{ kind: 'group-template'; groupId: string }` (nuevo). El pipeline de commit del canvas
patchea la ruta correspondiente a la variante activa. Esta tarea NO añade todavía la
pestaña `Grupos` ni la autoría de una instancia `group` (T14, T15); solo prepara el canvas.

### Fuera de alcance
- Pestaña `Grupos` (T14).
- Autoría de instancia `group` en Layout (T15).
- Vista de muestra con valores mock para `group.*` (parte de T14/T15).

### Dependencias
- T06.

### Interfaces
- Consume:
  - `type RuntimeGroupsConfig` (de T06).
- Produce:
  - Type `LayoutCanvasTarget = { kind: 'page-layout'; pageId: string } | { kind: 'group-template'; groupId: string }` — consumido por: T14, T15.
  - Firma de commit del canvas: `commitLayoutMutation(target: LayoutCanvasTarget, patch: LayoutTreeMutation): CommitResult` (nombre existente, firma extendida) — consumido por: T14.
  - Selector: `resolveLayoutForTarget(config: RuntimeConfig, target: LayoutCanvasTarget): RuntimeLayoutNode[]` — consumido por: T14, T15.

### Impacto esperado en archivos
- Código a modificar: pipeline de commit del canvas (`src/dev-runtime/` — inspeccionar `layout-canvas-commit`, `dev-runtime-state-bridge` y helpers relacionados; no leer aquí, es responsabilidad de la implementación identificar los archivos exactos con base en el índice de tests dev-runtime).
- Tests a modificar: `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (ampliación con caso de target `group-template`).
- Tests a crear: `src/tests/dev-runtime/layout-canvas-target-retarget.test.tsx`.
- Documentación afectada: `ai-workflow/docs/app-features/development/dev-mode-editor.md`. No se edita aquí.

### Tests
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-target-retarget.test.tsx` (nuevo).
  - `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (ampliación).
- Comportamiento cubierto:
  - Con `target = { kind: 'page-layout', pageId: 'p1' }`, el commit sigue patcheando `pages[p1].layout` exactamente como antes (regresión cero para el pipeline existente).
  - Con `target = { kind: 'group-template', groupId: 'card' }`, el commit patchea `groups.card.template` sin tocar ninguna otra rama del config.
  - `resolveLayoutForTarget` devuelve la colección correcta para cada variante y devuelve `[]` (sin lanzar) para un target cuyo `pageId`/`groupId` no existe en el config, alineado con el comportamiento vigente del canvas cuando la página activa desaparece del config.
  - Un commit contra un `group-template` inexistente en `groups` se rechaza con la misma semántica que un commit contra una página inexistente (no aplica, no rompe).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-target-retarget.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-commit.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Cierre de implementación
- Canvas retargeteable, ambos ficheros de test en verde, suite de dev-runtime sin regresión (`dev-editor-floating-toolbar`, `dev-editor-layer`, `layout-canvas-*`).

---

## T14 — Pestaña `Grupos` de dominio: lista, CRUD y edición de `template`

### Objetivo
Añadir la pestaña `Grupos` como séptima pestaña de dominio del `DevRuntime` (después de
`Shell`), con:
- Un panel de lista + CRUD (alta/baja/renombrado de `groupId`, alta/baja de `params`) siguiendo el mismo patrón de commit de clave raíz única (`commitGroupsMutation` parcheando solo `groups`) que ya usan `Api`/`Tokens`/`Traducciones`/`Páginas`.
- Cuando se selecciona un `groupId`, el canvas de layout se retargetea al `template` de ese grupo (usando la infraestructura de T13) con vista de muestra alimentada por valores placeholder para `group.*` en `RuntimeGroupContextProvider` (mismo precedente conceptual que la instancia representativa única del `repeater` en modo Editor).

### Fuera de alcance
- Autoría de una instancia `group` en Layout (T15).

### Dependencias
- T10, T12, T13.

### Interfaces
- Consume:
  - `type RuntimeGroupsConfig` (de T06).
  - `type LayoutCanvasTarget` (de T13).
  - `commitLayoutMutation` con target parametrizable (de T13).
  - `RuntimeGroupContext` y provider (de T10) para alimentar valores mock.
- Produce:
  - `commitGroupsMutation(config: RuntimeConfig, patch: GroupsMutation): CommitResult` — consumido por: T15 (para poder leer `groups` al pintar el selector de `groupId` en la paleta).
  - Type `GroupsMutation = { kind: 'add-group'; groupId: string } | { kind: 'rename-group'; from: string; to: string } | { kind: 'remove-group'; groupId: string } | { kind: 'add-param'; groupId: string; paramName: string } | { kind: 'remove-param'; groupId: string; paramName: string }` — consumido por: T15 (solo lectura del set de `params` de un grupo).

### Impacto esperado en archivos
- Código a crear: `src/dev-runtime/groups-config-panel.tsx` (o naming equivalente al vigente para `tokens-config-panel`), helpers de mutación de `groups`.
- Código a modificar: barra flotante del `dev-runtime` para añadir la pestaña `Grupos`, `dev-editor-layer` para montarla, `dev-runtime-state-bridge` si el estado de "grupo seleccionado" vive allí (inspección en implementación).
- Tests a crear: `src/tests/dev-runtime/groups-config-panel.test.tsx`, `src/tests/dev-runtime/groups-config-panel-mutations.test.ts`, `src/tests/dev-runtime/dev-editor-groups-canvas.test.tsx` (integración canvas retargeteado con valores mock).
- Documentación afectada: `ai-workflow/docs/app-features/development/dev-mode-editor.md`. No se edita aquí.

### Tests
- Ficheros de test:
  - `src/tests/dev-runtime/groups-config-panel.test.tsx` (nuevo).
  - `src/tests/dev-runtime/groups-config-panel-mutations.test.ts` (nuevo).
  - `src/tests/dev-runtime/dev-editor-groups-canvas.test.tsx` (nuevo).
- Comportamiento cubierto:
  - `groups-config-panel`: la pestaña lista los `groupId` declarados en `config.groups` (o mensaje vacío), permite crear un `groupId` con normalización de nombre (kebab-case o el criterio que ya usa `pages-config-panel`), renombrarlo (todos los `params` sobreviven), eliminarlo con confirmación, y añadir/eliminar `params` de un grupo seleccionado. Un feedback `role="alert"` visible cuando un commit se rechaza (formato de error idéntico al de `pages-config-panel-commit-feedback.test.tsx`).
  - `groups-config-panel-mutations`: cada variante de `GroupsMutation` produce el patch correcto sobre `config.groups` y solo sobre él (no toca `pages`, `api`, `tokens`, etc.), y `rename-group` rechaza el commit si el nuevo id ya existe.
  - `dev-editor-groups-canvas`: seleccionar un `groupId` del panel muestra el canvas retargeteado a `groups.{groupId}.template` (T13); el canvas alimenta un `RuntimeGroupContextProvider` con valores mock por cada `paramName` declarado (formato explícito documentado in-code, p. ej. `"{{groupId}}.{{paramName}}"`), de modo que un `{{group.paramName}}` dentro del `template` se renderiza con el mock; cambiar de `groupId` conmuta el target del canvas sin remontar el DevRuntime.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/groups-config-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/groups-config-panel-mutations.test.ts`
  - `pnpm test --run src/tests/dev-runtime/dev-editor-groups-canvas.test.tsx`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.

### Cierre de implementación
- Pestaña `Grupos` operativa con CRUD y edición de `template`; los tres ficheros de test en verde; sin regresión en la suite dev-runtime existente (barra flotante, pestañas actuales, canvas de `Layout`).

---

## T15 — Inserción y edición de instancia `group` en `Layout`

### Objetivo
Añadir el tipo `group` a la paleta de nodos ya existente del canvas de `Layout` con:
- Selector de `groupId` (deshabilitado con motivo explícito si `groups` está vacío, siguiendo el patrón del interruptor de refresco de `Tokens`).
- Los `props.params` se editan como campos de texto libre por cada nombre declarado por el grupo elegido (sin picker dedicado, coherente con el límite ya documentado del panel).
- `children` (slot) se edita con el mismo mecanismo de arrastre que `container.children`, visible solo si el grupo elegido declara `slot` (información derivada del `template` almacenado).
- Cambiar el `groupId` de una instancia reconstruye `props.params`/`children` desde cero.

### Fuera de alcance
- Cualquier cambio en la vista de muestra del `template` del propio grupo (T14).

### Dependencias
- T12, T14.

### Interfaces
- Consume:
  - `type RuntimeGroupsConfig` (de T06).
  - `type RuntimeGroupInstanceNode` (de T06).
  - Reglas de children interpretados en el canvas (de T12).
  - `type GroupsMutation` (de T14, solo lectura sobre `params`).
- Produce: ninguno (última tarea del plan).

### Impacto esperado en archivos
- Código a modificar: paleta de nodos del canvas (`src/dev-runtime/floating-node-palette.*`), dispatcher de widgets del panel de propiedades para el tipo `group` (`src/dev-runtime/layout-canvas-property-field-*` — un widget nuevo probable: `group-instance-property-field.tsx`), reglas de validez de destino (`layout-canvas-drop-validity.ts`) para el drop dentro de `children` de `group` cuando el `template` declara `slot`.
- Tests a crear: `src/tests/dev-runtime/layout-canvas-property-field-group-instance.test.tsx`, `src/tests/dev-runtime/layout-canvas-palette-insert-group.test.tsx`.
- Tests a modificar: `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación con reglas de children de `group`).
- Documentación afectada: `ai-workflow/docs/app-features/development/dev-mode-editor.md`, `ai-workflow/docs/app-features/nodes/group.md`. No se editan aquí.

### Tests
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-property-field-group-instance.test.tsx` (nuevo).
  - `src/tests/dev-runtime/layout-canvas-palette-insert-group.test.tsx` (nuevo).
  - `src/tests/dev-runtime/layout-canvas-drop-validity.test.ts` (ampliación).
- Comportamiento cubierto:
  - `layout-canvas-property-field-group-instance`:
    - Selector de `groupId` deshabilitado con `title` explícito cuando `config.groups` está vacío o ausente; habilitado con las opciones existentes en caso contrario.
    - Al elegir un `groupId`, `props.params` se pre-rellena con un campo de texto vacío por cada `paramName` declarado por el grupo; editar el texto commitea `props.params.{paramName}`.
    - Cambiar el `groupId` de una instancia reconstruye `props.params` desde cero (los valores previos se descartan) y descarta `children`.
    - Un `props.params` con un nombre extra o faltante respecto a `groups.{groupId}.params` genera aviso `role="alert"` con el mismo criterio del resto del panel (feedback del commit rechazado por `validateGroupsConfig`).
  - `layout-canvas-palette-insert-group`: arrastrar `group` desde la paleta al canvas inserta un nodo `{ type: 'group', props: { groupId: '', params: {} } }` con `groupId` vacío y `params: {}` (el commit no falla la validación completa mientras `groupId` esté vacío gracias al mismo criterio que ya usan otras plantillas placeholder del canvas — verificar la política vigente).
  - `layout-canvas-drop-validity` (ampliación): el drop dentro de `children` de una instancia `group` solo es válido si `groups[groupId].template` declara `slot`; en caso contrario el destino se marca como inválido.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-group-instance.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert-group.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-drop-validity.test.ts`

- Restricciones: ninguna específica; aplican las reglas globales de testing.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
- `ai-workflow/docs/app-features/nodes/group.md`.

### Cierre de implementación
- Instancia `group` autorizable desde la paleta con selector de `groupId`, panel de `params` y `children` (slot) editable cuando corresponde; los tres ficheros de test en verde; suite dev-runtime sin regresión y criterio de aceptación 8 de la spec cubierto por tests de integración.

---

## Siguiente tarea a escoger
- T01. El plan es lineal salvo por T06 (contrato Zod), que puede solaparse con Phase A si dos agentes trabajan en paralelo; en pasada single-thread mantener el orden estricto T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 → T12 → T13 → T14 → T15.
