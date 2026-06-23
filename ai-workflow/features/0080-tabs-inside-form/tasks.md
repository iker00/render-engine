# Tasks — Feature 0080 (Tabs como hijo de form)

> Este documento es contrato de ejecución para `implement-task-test-first`. Las tareas son secuenciales: T2 depende de T1 porque sin la nueva validación, los configs usados en sus tests serían rechazados antes de renderizarse.

## T1 — Validación previa al render: aceptar `tabs` en `form.children`

### Estado
completado

### Objetivo
Permitir `tabs` como hijo directo o transitivo de `form` en la fase de validación previa al render, manteniendo la deduplicación de `fieldId`, el bloqueo de `fileManager` y la regla de GET-con-body para `executeOperation`/`executeOperations`/`onSuccess`/`onError`. Tras esta tarea, un JSON con `tabs` dentro de `form` pasa la validación; un duplicado de `fieldId` entre dos tabs del mismo form se rechaza con `invalid-layout`; un `fileManager` dentro de un tab dentro de form se rechaza con `invalid-layout`.

### Fuera de alcance
- Comportamiento de runtime: descubrimiento de campos, validación de submit, ciclo de vida del store. Eso queda en T2.
- Cambio de cualquier regla del nodo `tabs` fuera de form.
- Allowlist o restricciones nuevas sobre los `children` admitidos dentro de cada item de tabs (sigue siendo el catálogo de form: `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `divider`, y ahora también `tabs`).

### Dependencias
Ninguna. T1 es el primer paso del plan.

### Impacto esperado en archivos
- Código:
  - `src/config/validate-form-nodes.ts` — cambiar `validateFormChildren` para aceptar `node.type === 'tabs'` en la allowlist y recursar en `node.props.items[N].children` para detectar `fieldId` duplicados y `fileManager` prohibido. Actualizar el literal del mensaje de error de la allowlist (en `src/config/validate-form-nodes.ts:1351` el texto vigente termina en `... container, accordion and divider descendants.`) al literal exacto: `... container, accordion, divider and tabs descendants.`. Cambiar `validateExecutionRequestParamsInCollection` para añadir una rama `node.type === 'tabs'` que recursa en `node.props.items[N].children`.
  - `src/config/runtime-config-zod.ts`: no requiere cambios. Verificado: `formNodeSchema` (línea 411 aprox.) declara `children: z.array(z.unknown()).optional()`, por lo que la allowlist sigue siendo puramente semántica. No tocar este fichero en T1.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-forms-tabs.test.ts` (nuevo).
  - `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación: actualizar el mensaje de error de la allowlist para que incluya `tabs`).
- Documentación: ninguna actualización en esta tarea (se trata en `update-app-documentation`). El campo "documentación afectada" más abajo lista las fichas a tocar en esa pasada posterior.

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-forms-tabs.test.ts` (nuevo)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)

**Comportamiento cubierto**
- Acepta un JSON con `form.children` que contiene un nodo `tabs` con dos items, cada uno con un `input` distinto (verifica que el config se valida sin error).
- Acepta un JSON anidado `form → container → tabs → container → input` (verifica que la validación cruza niveles intermedios).
- Acepta un JSON anidado `form → tabs → accordion → input` y `form → accordion → tabs → input` (verifica que la combinación de containers intermedios sigue funcionando).
- Rechaza con `invalid-layout` un JSON donde dos `input` con el mismo `fieldId` viven en items distintos del mismo `tabs` dentro del mismo form. El mensaje cita la ruta canónica del segundo input duplicado (`...props.items[1].children[0].props.fieldId`).
- Rechaza con `invalid-layout` un JSON donde dos `input` con el mismo `fieldId` viven uno fuera de tabs y otro dentro de un item de tabs en el mismo form (verifica que el conjunto compartido de `fieldIds` cruza la frontera de tabs).
- Rechaza con `invalid-layout` un JSON donde un `fileManager` aparece dentro de un item de tabs dentro de un form. El mensaje cita la ruta `...props.items[N].children[M]` y deja explícito que `fileManager` no se admite dentro de form.
- Rechaza con `invalid-layout` un JSON donde `form.submitAction.type: executeOperation` referencia una operación `GET` con `body` y el formulario contiene `tabs` (verifica que la regla GET-con-body sigue aplicando dentro de form que tiene tabs).
- Rechaza con `invalid-layout` un JSON donde un nodo `button` con `props.action.type: executeOperation` y `body` referenciando una operación `GET` aparece como hijo de un item de `tabs` dentro de un `form` (verifica que la rama nueva de `validateExecutionRequestParamsInCollection` para `tabs` se ejecuta y produce un mensaje cuya ruta incluye `...props.items[N].children[M].props.action.body`). Este escenario es declarativamente reproducible porque `button` es un hijo válido de `form` y por tanto de los items de tabs dentro de form.
- En `runtime-config-validation-forms-semantics.test.ts`: actualizar los dos casos que comprueban el mensaje de error de la allowlist (líneas 263 y 298 a la fecha) al literal exacto: `Page "home" has an invalid layout at "layout[0].children[0]": form nodes only accept input, textarea, select, radioGroup, checkboxGroup, button, heading, paragraph, image, table, container, accordion, divider and tabs descendants.`.

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-tabs.test.ts`
- `pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts`

**Restricciones**
- Reusar los helpers existentes de `src/tests/config-validation/helpers.ts` (incluido `createConfigWithFormLayout` si está disponible o el patrón equivalente ya usado en el fichero de semantics). No introducir un harness nuevo si el existente sirve.
- No snapshotear configs completos; comprobar solo `status`, `error.code` y la ruta dentro de `error.message` con `toEqual` o equivalente como ya se hace en los ficheros vecinos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/form.md` (ampliar allowlist de `children` con `tabs` en la pasada documental).
- `ai-workflow/docs/app-features/config/validation.md` (sección "Validación estructural global" y "Reglas de formularios" para reflejar el nuevo allowlist).

### Criterios de finalización
- `validateFormChildren` acepta `tabs` como hijo y recurre en `props.items[N].children` reutilizando el mismo contexto (`currentFormId`, `fieldIds`).
- `validateExecutionRequestParamsInCollection` cubre tabs como rama recursiva, alineada con el tratamiento de container/form/modal/repeater.
- Todos los tests de T1 verdes localmente.

### Cierre de implementación
Código y tests de T1 mergeables: la validación previa al render acepta tabs dentro de form, deduplica `fieldId` entre tabs, rechaza `fileManager` dentro de tabs en form y cubre GET-con-body en el subárbol del form que incluye tabs.

---

## T2 — Recorrido de campos del form a través de tabs para validación y submit

### Estado
completado

### Objetivo
Hacer que `collectResolvedFormFieldDefinitions` y `collectAllFormFieldIds` (en `src/runtime/nodes/form-layout-node.tsx`) recorran los `tabs` para que todos los campos de todos los items con `item.visibility` verdadera participen en validación, inicialización y submit, independientemente del tab activo. Los items con `item.visibility` falsa se tratan como ocultos (sus campos quedan en el universo configurado pero se omiten del payload, igual que cualquier campo oculto por `visibility`).

### Fuera de alcance
- Modificar el render de `tabs` (`src/runtime/nodes/tabs-layout-node.tsx`). Sigue habiendo un único panel en el DOM.
- Cambiar la semántica de `accordion` dentro de form (sigue sin recorrerse en estas funciones).
- Mostrar errores visuales en la barra de tabs o saltar automáticamente al tab con error.
- Cambiar el comportamiento de `tabs` fuera de form.

### Dependencias
T1 cerrado. Sin la nueva allowlist, los configs declarativos usados en los tests de T2 serían rechazados antes de llegar al runtime.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/form-layout-node.tsx` — añadir caso `node.type === 'tabs'` en `collectResolvedFormFieldDefinitions`: iterar `node.props.items`, filtrar por `matchesVisibilityRule(item.visibility, state, iterationContext)` (ya importado desde `../runtime-layout-visibility`) y recursar en `item.children`. Añadir caso `node.type === 'tabs'` en `collectAllFormFieldIds`: iterar todos los items sin filtrar y recursar en `item.children`.
- Tests:
  - `src/tests/runtime/runtime-form-tabs.test.tsx` (nuevo). Único hogar del comportamiento de "campos en tabs dentro de form". El fichero `runtime-state-validations-visibility.test.tsx` no se amplía en esta tarea para evitar duplicar casos.
- Documentación: ninguna actualización en esta tarea (se trata en `update-app-documentation`).

### Tests

**Ficheros de test**
- `src/tests/runtime/runtime-form-tabs.test.tsx` (nuevo). Concentra todos los casos de comportamiento de "campos en tabs dentro de form" para evitar duplicación con otros ficheros.

**Comportamiento cubierto**
- Submit de un form con dos tabs, cada uno con un `input`. Al pulsar submit con el tab 0 activo y el tab 1 nunca visitado, el payload incluye los `fieldId` de ambos tabs con los valores actuales del store (vacíos si no se editaron).
- Un campo `required` declarado en un tab inactivo bloquea el submit con error de validación (en el store del campo) aunque el usuario no haya cambiado nunca al tab 1; el handler de submit no llama a `executeQueryOperation`.
- Al cambiar al tab 1 tras un submit fallido por `required`, el input muestra el error existente del store (verifica que el error persistió en el campo aunque el panel no estaba montado).
- Inicialización al montar el form con tabs: los campos del tab inactivo se inicializan en el store con sus `defaultValue` resueltos antes de que el usuario active el tab. Verificable leyendo `forms.{formId}.{fieldId}` con un snapshot del state antes de interactuar con la barra de tabs.
- `defaultValue` con referencia a `queries.*` para un campo en un tab inactivo se resuelve correctamente contra el estado vigente del store. Sembrar la query usando el patrón de `FormRuntimeFixture` en `src/tests/runtime-state/helpers.tsx` (`initializeQuery` + `setQuerySuccess` desde `useRuntimeStateActions`) dentro del propio fixture del test antes del primer render observable del form. No usar `preloads` ni interceptar fetch.
- `resetOnSuccess: true` tras un submit exitoso limpia el estado de campos en todos los tabs, incluido el tab inactivo (verificable inspeccionando el store tras el submit).
- `resetForm` (vía botón `action.type: resetForm`) limpia el estado de campos en todos los tabs.
- Item de tabs con `visibility` que evalúa como oculto: sus campos no aparecen en el payload del submit (entran en `hiddenFieldIds` porque están en `collectAllFormFieldIds` pero no en `collectResolvedFormFieldDefinitions` filtrado por visibilidad).
- Item de tabs sin `visibility` declarada y no activo: sus campos sí participan en el payload y en validación.
- Anidamiento `form → container → tabs → container → input`: el input dentro del subárbol participa en validación y submit.
- Guard de asimetría con `accordion`: añadir un caso explícito en este mismo fichero (verificado que no existe equivalente en `runtime-state-validations-visibility.test.tsx`, `runtime-state-form-lifecycle.test.tsx` ni `runtime-form-submit-hidden-fields.test.tsx`). El caso declara un form con un `accordion` cerrado que contiene un campo `required` y comprueba que el submit NO se bloquea por ese campo (sigue siendo la semántica de accordion: campos no descubiertos hasta montaje). Sirve como regresión para confirmar que el cambio en `collectResolvedFormFieldDefinitions`/`collectAllFormFieldIds` solo afecta a `tabs`, no a `accordion`.

**Comandos durante la implementación**
- `pnpm test --run src/tests/runtime/runtime-form-tabs.test.tsx`

**Restricciones**
- Reusar `FormRuntimeFixture` u otros fixtures ya disponibles en `src/tests/runtime-state/helpers.tsx` y en los harnesses de `src/tests/runtime/runtime-form-submit-hidden-fields.test.tsx` (que ya cubre escenarios cercanos de campos ocultos en submit). No duplicar harness si el patrón existente cubre el caso.
- No introducir cambios en `tabs-layout-node.tsx`: toda la lógica nueva vive en `form-layout-node.tsx`.
- No añadir cobertura de comportamiento visual de la barra de tabs en estos ficheros (queda en `layout-renderer-tabs.test.tsx`, fuera de alcance de esta feature).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/tabs.md` (clarificar comportamiento de campos dentro de tabs cuando viven en form en la pasada documental).
- `ai-workflow/docs/app-features/forms/lifecycle.md` (clarificar que los campos en tabs inactivos participan en validación y submit, a diferencia de accordion).

### Criterios de finalización
- `collectResolvedFormFieldDefinitions` recurre en `tabs.props.items[N].children` filtrando por `matchesVisibilityRule` para `item.visibility`.
- `collectAllFormFieldIds` recurre en `tabs.props.items[N].children` sin filtrar por visibilidad.
- Todos los tests de T2 verdes localmente.
- `pnpm test` completo verde y umbral global de cobertura ≥ 80% en `src/`.

### Cierre de implementación
Código y tests de T2 mergeables: los campos de todos los items con visibility verdadera de un `tabs` dentro de un `form` participan en validación, inicialización, submit y reset igual que si vivieran directamente dentro del `form` o de un `container`, manteniendo la asimetría con `accordion`.

---

## Siguiente tarea a escoger
T1.
