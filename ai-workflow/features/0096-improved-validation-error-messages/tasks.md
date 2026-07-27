# 0096 — Improved validation error messages — Plan de implementación

## Resumen

Enriquecer los mensajes de error `invalid-layout` con dos líneas adicionales (breadcrumb legible y extracto del nodo) sin modificar la lógica de validación. El cambio es de formato de mensaje y afecta a todos los módulos que validan el layout tree.

Hay dos categorías de validadores que generan errores `invalid-layout` sobre el layout tree:

- **Primera pasada (raw nodes)**: `validateLayoutCollection` / `validateLayoutNode` en `validate-layout-nodes.ts`, los validadores de nodo específicos en el mismo fichero, y los validadores de nodo de formulario en `validate-form-nodes.ts`. Estos trabajan con nodos crudos (`Record<string, unknown>`) durante el parseo recursivo del layout tree.
- **Segunda pasada (validated nodes)**: `validateActionTargets` y `findInvalidActionTarget` en `validate-actions-visibility.ts`, `validateFormSemantics` en `validate-form-nodes.ts`, `validateFileManagerSemantics` en `validate-file-manager-nodes.ts`, `validateFileInputSemantics` en `validate-file-input-nodes.ts`, y `validateModalReferences` en `validate-runtime-config.ts`. Estos trabajan con objetos `LayoutNode` ya validados.

Los errores de `validate-preloads.ts`, `validate-api-config.ts` y `validate-tokens-config.ts` no tienen contexto de layout tree (no referencian nodos del árbol de layout), por lo que no reciben enriquecimiento. Lo mismo aplica a los errores de nivel superior en `validate-runtime-config.ts` que validan la shell del config (no nodos de layout).

---

## Tarea 1 — Módulo de utilidades de breadcrumb y extracto

### Estado
`completed`

### Objetivo
Crear el módulo `src/config/validation-breadcrumb.ts` con las funciones de construcción de segmentos de breadcrumb, formateo, extracto de nodo y enriquecimiento de mensajes de error. Este módulo es la base para todas las tareas posteriores.

### Fuera de alcance
- Modificar validadores existentes.
- Modificar tests existentes.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- `src/config/validation-breadcrumb.ts` (nuevo)
- `src/tests/config-validation/validation-breadcrumb.test.ts` (nuevo)

### Tests

#### Ficheros de test
- `src/tests/config-validation/validation-breadcrumb.test.ts` (nuevo)

#### Comportamiento cubierto
- `buildBreadcrumbSegment` con nodo que tiene `id` → segmento con qualifier `form("user")`.
- `buildBreadcrumbSegment` con nodo que tiene `props.fieldId` → segmento `input(fieldId: "name")`.
- `buildBreadcrumbSegment` con nodo que tiene `props.label` (button, accordion, badge, link) → segmento `button("Submit")`.
- `buildBreadcrumbSegment` con nodo que tiene `props.text` (heading, paragraph) → segmento `heading("Datos personales")`.
- `buildBreadcrumbSegment` con nodo `fileManager` que tiene `props.operationName` → segmento `fileManager(operationName: "uploadFiles")`.
- `buildBreadcrumbSegment` con nodo sin identificador (container, divider, repeater) → segmento `container[3]` usando índice posicional.
- `buildBreadcrumbSegment` con nodo cuyo tipo no está en la heurística → segmento `unknownType[0]` usando índice.
- `buildBreadcrumbSegment` con identificador que excede 30 caracteres → truncado con `...`.
- `buildBreadcrumbSegmentFromNode` con `LayoutNode` tipado → misma lógica que con nodo crudo.
- `formatBreadcrumb` con un solo segmento → string sin separador.
- `formatBreadcrumb` con múltiples segmentos → separados por ` > `.
- `formatBreadcrumb` con array vacío → string vacío.
- `buildNodeExcerpt` con nodo que tiene `type` + `fieldId` + `label` → JSON reducido con esas tres props.
- `buildNodeExcerpt` con nodo que tiene `type` + `id` → JSON con `type` e `id`.
- `buildNodeExcerpt` con nodo que tiene `type` + `props.text` → JSON con `type` y `props.text`.
- `buildNodeExcerpt` con nodo sin props de identificación → JSON solo con `type`.
- `buildNodeExcerpt` no incluye `children`, `visibility`, `queryStateFeedback`, `layout` ni el contenido completo de `props`.
- `buildNodeExcerptFromNode` con `LayoutNode` tipado → misma lógica.
- `enrichErrorMessage` con breadcrumb no vacío → mensaje original + línea `  → breadcrumb` + línea `  Node: excerpt`.
- `enrichErrorMessage` con breadcrumb vacío → devuelve el mensaje original sin cambios.
- `enrichedInvalidLayout` devuelve el mismo shape `{ status: 'error'; error: RuntimeConfigError }` con `message` enriquecido.
- `enrichErrorResult` toma un resultado de error existente y enriquece su `message`.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/validation-breadcrumb.test.ts
```

#### Restricciones
- Las funciones deben soportar tanto nodos crudos (`Record<string, unknown>`) como nodos tipados (`LayoutNode`) para cubrir primera y segunda pasada.
- El módulo no debe importar lógica de validación; es puramente de formateo.
- La heurística de identificación debe seguir exactamente el orden de prioridad de la spec: `id` > `props.fieldId` > `props.label` > `props.text` > `props.operationName` > índice posicional.
- Los tipos de nodo que usan cada identificador están definidos en la spec: `id` para `form`, `modal` y cualquier nodo con `id`; `props.fieldId` para `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`; `props.label` para `button`, `accordion`, `badge`, `link`; `props.text` para `heading`, `paragraph`; `props.operationName` para `fileManager`.
- La prioridad real es: primero comprobar si el nodo tiene `id` (cualquier tipo); luego aplicar la heurística por tipo de nodo para la prop específica; si el tipo no tiene heurística o la prop está ausente, usar índice posicional.
- El extracto del nodo debe serializarse en una sola línea JSON.
- `enrichErrorMessage` y `enrichedInvalidLayout` deben ser las funciones que usen las tareas posteriores para enriquecer errores. `enrichErrorResult` debe aceptar un `{ status: 'error'; error: RuntimeConfigError }` y devolver la misma estructura con el mensaje enriquecido.

### Documentación afectada
Ninguna.

### Criterios de finalización

#### Cierre de implementación
- `validation-breadcrumb.ts` exporta `buildBreadcrumbSegment`, `buildBreadcrumbSegmentFromNode`, `formatBreadcrumb`, `buildNodeExcerpt`, `buildNodeExcerptFromNode`, `enrichErrorMessage`, `enrichedInvalidLayout`, `enrichErrorResult` y el tipo `BreadcrumbSegment`.
- Todos los tests del fichero pasan.
- `pnpm test` pasa sin regresiones.

---

## Tarea 2 — Breadcrumb en primera pasada: `validate-layout-nodes.ts`

### Estado
`completed`

### Objetivo
Enhebrar el parámetro `breadcrumb` a través de la recursión de primera pasada en `validate-layout-nodes.ts` y enriquecer todos los mensajes `invalidLayout()` generados por los validadores de nodo no-formulario de ese fichero. También actualizar el punto de llamada en `validate-runtime-config.ts` y las funciones auxiliares de `validate-actions-visibility.ts` que se invocan desde validadores de primera pasada (`mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateRuntimeUiAction`, `validateVisibility`, `validateFormSubmitAction`).

### Fuera de alcance
- Modificar validadores de nodo de formulario en `validate-form-nodes.ts` (tarea 3).
- Modificar validadores de segunda pasada (tarea 4).
- Los validadores de `validate-form-nodes.ts` llamados desde `validateLayoutNode` (`validateFormNode`, `validateInputNode`, etc.) necesitarán recibir el `breadcrumb` como parámetro para que compile, pero su enriquecimiento interno se hace en la tarea 3. En esta tarea se les pasa `breadcrumb` y ellos lo usan para enriquecer los errores que generan directamente (ya que reciben la dependencia); si alguno genera `invalidLayout()` sin aún consumir breadcrumb, la tarea 3 se encargará de los restantes.

### Dependencias
Tarea 1.

### Impacto esperado en archivos

- `src/config/validate-layout-nodes.ts` (modificación): añadir `breadcrumb` a `validateLayoutCollection`, `validateLayoutNode`, `validateQueryStateFeedback`, y a todos los validadores de nodo específicos del fichero. Construir segmento en `validateLayoutCollection` antes de llamar a `validateLayoutNode`. Enriquecer todos los `invalidLayout()` del fichero con `enrichedInvalidLayout` o `enrichErrorResult`.
- `src/config/validate-runtime-config.ts` (modificación): pasar `[]` al llamar a `validateLayoutCollection` en el bucle de páginas (o usar el default `[]`).
- `src/config/validate-actions-visibility.ts` (modificación): añadir `breadcrumb` opcional (default `[]`) y `rawNode` opcional a `mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, `validateRuntimeUiAction`, `validateVisibility`, `validateFormSubmitAction`. Enriquecer sus `invalidLayout()` calls. Las funciones de segunda pasada de este fichero no se tocan aquí.
- `src/config/validate-form-nodes.ts` (modificación mínima): añadir `breadcrumb` como parámetro a las funciones exportadas de primera pasada (`validateFormNode`, `validateInputNode`, `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`, `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`, `validateCollectionSource`) para que `validateLayoutNode` pueda pasarles el breadcrumb. La tarea 3 se encarga de enhebrar y enriquecer internamente.
- `src/tests/config-validation/runtime-config-validation-containers.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-qsf.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-navigate-params.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-modal.test.ts` (modificación — solo errores de primera pasada)
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-stat.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-divider.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-skeleton.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (modificación — solo errores de primera pasada del nodo `fileInput` en `validate-layout-nodes.ts`)
- `src/tests/config-validation/runtime-config-validation-image-fetch.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (modificación — solo errores de primera pasada del nodo `fileManager` en `validate-layout-nodes.ts`)
- `src/tests/config-validation/runtime-config-validation-toggle.test.ts` (modificación — solo errores cuyo `invalidLayout` se genera en `validate-layout-nodes.ts`, si los hay)
- `src/tests/config-validation/runtime-config-validation-hidden.test.ts` (modificación — ídem)
- `src/tests/config-validation/runtime-config-validation-preloads.test.ts` (sin cambios: sus errores no tienen contexto de layout tree)

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-containers.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-qsf.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-navigate-params.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-image-table.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-alert.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-stat.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-divider.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-skeleton.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (ampliación — errores de primera pasada)
- `src/tests/config-validation/runtime-config-validation-image-fetch.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación)

#### Comportamiento cubierto
- Todos los tests existentes que verifican mensajes de error `invalid-layout` generados por validadores de `validate-layout-nodes.ts` incluyen ahora las dos líneas adicionales (breadcrumb + extracto) en el `message` esperado.
- Un error en un nodo hoja directo en `layout[0]` muestra breadcrumb de un solo segmento (e.g., `container[0]`).
- Un error en un nodo anidado en `layout[0].children[1]` muestra breadcrumb de dos segmentos (e.g., `container[0] > heading("Title")`).
- Un error en nodo dentro de repeater template muestra breadcrumb que incluye el repeater como ancestro.
- Un error en nodo dentro de tabs muestra breadcrumb que incluye el tab con su label.
- Un error en nodo dentro de modal muestra breadcrumb que incluye el modal con su id.
- El extracto del nodo muestra solo `type` + props de identificación, no el nodo completo.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-qsf.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-navigate-params.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-image-table.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-alert.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-stat.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-divider.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-skeleton.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-file-input.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-image-fetch.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts
```

#### Restricciones
- El parámetro `breadcrumb` debe ser opcional con default `[]` en `validateLayoutCollection` y `validateLayoutNode` para no romper llamadas desde otros módulos que aún no pasan breadcrumb.
- El segmento de breadcrumb se construye en `validateLayoutCollection` (donde el índice es conocido) a partir del nodo crudo, y se pasa como parte del array a `validateLayoutNode`.
- Las funciones auxiliares de `validate-actions-visibility.ts` (`mapQueryStateFeedbackIssue`, `mapVisibilityIssue`, etc.) reciben breadcrumb y rawNode como parámetros opcionales. El enriquecimiento se aplica cuando hay breadcrumb disponible. Como alternativa equivalente, el caller puede enriquecer el resultado devuelto por estas funciones usando `enrichErrorResult` en lugar de pasarles breadcrumb.
- No modificar la firma de `invalidLayout()` en `runtime-config-validation-errors.ts`; la función original se mantiene como factory base y el enriquecimiento se aplica en los callers.
- Los errores de `validate-runtime-config.ts` que no tienen contexto de layout tree (errores de shell del config, errores de pages) NO se enriquecen.
- Los validadores de nodo de formulario de `validate-form-nodes.ts` reciben `breadcrumb` en esta tarea pero el enriquecimiento de sus `invalidLayout()` internos se completa en la tarea 3. Los tests de formularios que solo verifican errores generados por `validate-form-nodes.ts` no se adaptan aquí.

### Documentación afectada
Ninguna.

### Criterios de finalización

#### Cierre de implementación
- `validateLayoutCollection` y `validateLayoutNode` aceptan `breadcrumb` opcional.
- Todos los validadores de nodo en `validate-layout-nodes.ts` reciben y usan breadcrumb para enriquecer sus errores.
- Los tests de los ficheros listados pasan con los mensajes enriquecidos.
- `pnpm test` pasa sin regresiones.

---

## Tarea 3 — Breadcrumb en primera pasada: `validate-form-nodes.ts`

### Estado
`completed`

### Objetivo
Completar el enriquecimiento de errores de primera pasada en `validate-form-nodes.ts`. Los validadores ya reciben `breadcrumb` desde la tarea 2; esta tarea enhebra el breadcrumb internamente y enriquece todos los `invalidLayout()` de primera pasada del fichero: `validateFormNode`, `validateInputNode`, `validateTextareaNode`, `validateSelectNode`, `validateRadioGroupNode`, `validateCheckboxGroupNode`, `validateToggleNode`, `validateHiddenNode`, `validateCollectionSource`, y las funciones de validación de reglas (`validateRequiredRule`, `validateLengthRule`, `validateMinMaxRule`, `validatePatternRule`, `validateMinMaxSelectionsRule`, etc.).

### Fuera de alcance
- Modificar validadores de segunda pasada en `validate-form-nodes.ts` (`validateFormSemantics`, `validateFormNodesInCollection`, `validateExecutionRequestParams`) — tarea 4.
- Modificar otros módulos de validación.

### Dependencias
Tarea 2.

### Impacto esperado en archivos

- `src/config/validate-form-nodes.ts` (modificación): enhebrar breadcrumb internamente en validadores de primera pasada. Cuando `validateFormNode` recurre en `children` vía `validateLayoutCollection`, pasa el breadcrumb actualizado. Enriquecer todos los `invalidLayout()` de primera pasada.
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (modificación — solo assertions de errores de primera pasada, e.g., shape inválido del nodo form)
- `src/tests/config-validation/runtime-config-validation-collections.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-toggle.test.ts` (modificación)
- `src/tests/config-validation/runtime-config-validation-hidden.test.ts` (modificación)

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-forms-validations.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-form-fields.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-toggle.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-hidden.test.ts` (ampliación)

#### Comportamiento cubierto
- Un error de shape inválido en un nodo `form` (e.g., `id` faltante) incluye breadcrumb con `form[N]` y extracto.
- Un error en un nodo `input` dentro de un `form` incluye breadcrumb `form("user-form") > input(fieldId: "name")` y extracto con `type`, `fieldId`, `label`.
- Un error de validación de regla (e.g., `props.validations.required` inválido) incluye breadcrumb del nodo de campo y extracto del nodo.
- Un error de `defaultValue` inválido en un campo de formulario incluye breadcrumb y extracto.
- Un error en `select.props.items` incluye breadcrumb del nodo `select` y extracto.
- Un error en nodo `toggle` incluye breadcrumb con `toggle(fieldId: "x")`.
- Un error en nodo `hidden` incluye breadcrumb con `hidden(fieldId: "x")`.
- Todos los tests existentes que verifican errores de primera pasada de `validate-form-nodes.ts` pasan con mensajes enriquecidos.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-validations.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-form-fields.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-toggle.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-hidden.test.ts
```

#### Restricciones
- Los validadores de reglas de validación (`validateRequiredRule`, etc.) son funciones internas que reciben un `path` parcial. Deben recibir breadcrumb y rawNode para poder enriquecer sus errores. Breadcrumb y rawNode son los del nodo de campo padre, no de la regla.
- `validateCollectionSource` puede recibir breadcrumb y rawNode del nodo padre.
- No tocar las funciones de segunda pasada del fichero.

### Documentación afectada
Ninguna.

### Criterios de finalización

#### Cierre de implementación
- Todos los `invalidLayout()` de primera pasada en `validate-form-nodes.ts` producen mensajes enriquecidos con breadcrumb y extracto.
- Los tests de los ficheros listados pasan con los mensajes enriquecidos.
- `pnpm test` pasa sin regresiones.

---

## Tarea 4 — Breadcrumb en segunda pasada: todos los validadores

### Estado
`completed`

### Objetivo
Enhebrar breadcrumb a través de todos los validadores de segunda pasada que recorren el árbol de layout validado y enriquecer sus errores `invalidLayout()`. Estos validadores trabajan con objetos `LayoutNode` tipados, no con nodos crudos, por lo que usan `buildBreadcrumbSegmentFromNode` y `buildNodeExcerptFromNode` de la tarea 1.

Módulos afectados:
- `validate-actions-visibility.ts`: `validateActionTargets`, `findInvalidActionTarget`, `findInvalidTargetInFallbackCollections`.
- `validate-form-nodes.ts`: `validateFormSemantics`, `validateFormNodesInCollection`, `validateExecutionRequestParams`, `validateExecutionRequestParamsInCollection`, `validateFallbackCollections`.
- `validate-file-manager-nodes.ts`: `validateFileManagerSemantics`, `validateFileManagerNodesInCollection`, `visitNodeChildren`, `validateFileManagerNodeCrossChecks`.
- `validate-file-input-nodes.ts`: `validateFileInputSemantics`, `validateFileInputNodesInCollection`, `visitNodeChildren`.
- `validate-runtime-config.ts`: `validateModalReferences`, `collectModalIds`, `checkModalRefs`, `collectModalIdsInFallbacks`, `checkModalRefsInFallbacks`.

### Fuera de alcance
- Modificar validadores de primera pasada (ya cubiertos en tareas 2 y 3).
- Enriquecer errores que no son de layout tree (errores de API config, preloads, tokens, etc.).

### Dependencias
Tareas 1, 2 y 3.

### Impacto esperado en archivos

- `src/config/validate-actions-visibility.ts` (modificación): `findInvalidActionTarget` y `findInvalidTargetInFallbackCollections` construyen breadcrumb incrementalmente desde nodos validados. `validateActionTargets` pasa breadcrumb a `findInvalidActionTarget` y enriquece el error resultante.
- `src/config/validate-form-nodes.ts` (modificación): `validateFormNodesInCollection` construye breadcrumb desde nodos validados y lo pasa a la recursión. `validateExecutionRequestParamsInCollection` hace lo mismo. Enriquecer los `invalidLayout()` de segunda pasada.
- `src/config/validate-file-manager-nodes.ts` (modificación): `validateFileManagerNodesInCollection` y `visitNodeChildren` construyen breadcrumb desde nodos validados. `validateFileManagerNodeCrossChecks` recibe breadcrumb y enriquece sus errores.
- `src/config/validate-file-input-nodes.ts` (modificación): `validateFileInputNodesInCollection` y `visitNodeChildren` construyen breadcrumb. `validateFileInputCaptureAccept` recibe breadcrumb y enriquece.
- `src/config/validate-runtime-config.ts` (modificación): `collectModalIds` y `checkModalRefs` construyen breadcrumb desde nodos validados. Los errores de `checkModalRefs` (referencia a modal inexistente, defaultOpen en repeater) y `collectModalIds` (id de modal duplicado) se enriquecen.
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación — errores de segunda pasada: navigateTo a página inexistente, executeOperation a operación inexistente)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación — errores de segunda pasada: form id duplicado, submitAction.operationName inexistente, fieldId duplicado, placement errors)
- `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación — errores de segunda pasada: modal id duplicado, referencia a modal inexistente, defaultOpen en repeater)
- `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación — errores de segunda pasada: operaciones inexistentes)
- `src/tests/config-validation/runtime-config-validation-navigate-params.test.ts` (ampliación — si hay errores de segunda pasada sobre action targets)
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (ampliación — errores de segunda pasada: capture + accept cross-check)

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-buttons.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-modal.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-file-manager.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-navigate-params.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-file-input.test.ts` (ampliación)

#### Comportamiento cubierto
- Un error de `navigateTo` a página inexistente en un botón anidado en `container > form` incluye breadcrumb con ancestros completos hasta el botón.
- Un error de `executeOperation` a operación inexistente incluye breadcrumb del botón y extracto.
- Un error de form id duplicado incluye breadcrumb del nodo `form` con su `id`.
- Un error de fieldId duplicado incluye breadcrumb `form("user") > input(fieldId: "name")`.
- Un error de modal id duplicado incluye breadcrumb del nodo `modal` con su `id`.
- Un error de referencia a modal inexistente incluye breadcrumb del botón que referencia el modal.
- Un error de `defaultOpen` en repeater incluye breadcrumb con `repeater[N] > modal("id")`.
- Un error de operación inexistente en `fileManager` incluye breadcrumb con `fileManager(operationName: "x")`.
- Un error de `fileInput` dentro de form con `capture` + `accept` inválidos incluye breadcrumb.
- Errores de segunda pasada en nodos dentro de repeater templates, tabs children y modal children muestran breadcrumb con ancestros correctos.
- Todos los tests existentes para errores de segunda pasada pasan con mensajes enriquecidos.

#### Comandos durante la implementación
```
pnpm test --run src/tests/config-validation/runtime-config-validation-buttons.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-forms-semantics.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-modal.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-file-manager.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-navigate-params.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-file-input.test.ts
```

#### Restricciones
- Los validadores de segunda pasada trabajan con `LayoutNode` tipados, no con nodos crudos. Usar `buildBreadcrumbSegmentFromNode` y `buildNodeExcerptFromNode`.
- En `findInvalidActionTarget`, la función devuelve un objeto intermedio `{ path, type, target }`, no un error directamente. El breadcrumb debe construirse durante la recursión y devolverse junto con el resultado para que `validateActionTargets` pueda enriquecer el error final. Alternativa: `findInvalidActionTarget` devuelve también el `breadcrumb` y el `node` del nodo problemático.
- Los errores que genera `validateActionTargets` en `validate-actions-visibility.ts` se construyen en el caller a partir del resultado de `findInvalidActionTarget`, por lo que el enriquecimiento se aplica en el caller.
- Para `collectModalIds` y `checkModalRefs`, el breadcrumb se construye incrementalmente en la recursión.
- Los errores de la shell del config en `validate-runtime-config.ts` (pages, initialPage) NO se enriquecen: no tienen nodo de layout como contexto.

### Documentación afectada
Ninguna.

### Criterios de finalización

#### Cierre de implementación
- Todos los `invalidLayout()` de segunda pasada en los cinco módulos producen mensajes enriquecidos con breadcrumb y extracto.
- Los tests de los ficheros listados pasan con mensajes enriquecidos.
- `pnpm test` pasa globalmente sin regresiones.
- El umbral de cobertura del 80% se mantiene.
