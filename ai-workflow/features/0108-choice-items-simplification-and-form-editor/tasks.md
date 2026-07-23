# Plan de implementación — Feature 0108

## Orden de ejecución
1. T1 — Contrato Zod, tipos públicos y validador imperativo de `props.items`
2. T2 — Limpieza de la resolución en `runtime-collection-sources`
3. T3 — Paleta: `items: []` por defecto para `select`, `radioGroup` y `checkboxGroup`
4. T4 — `ChoiceItemsPropertyField` y hook `x-widget` en `PropertyFieldDispatcher`
5. T5 — Adaptador `resolveChoiceLikePropsSchema` en el panel de propiedades

Cada tarea debe completarse y quedar con tests en verde antes de empezar la siguiente. Ninguna tarea es sólo documental; la actualización de fichas de producto se hace después con `update-app-documentation` sobre `documentación afectada`.

---

## T1 — Contrato Zod, tipos públicos y validador imperativo de `props.items`

### Estado
Completada

### Objetivo
Fijar los tres shapes objetivo del contrato `props.items` de `select`, `radioGroup` y `checkboxGroup` en el schema Zod y en los tipos públicos, y adelgazar `validateSelectItemsContract` para que delegue la forma estructural en Zod y sólo conserve las comprobaciones de dominio no expresables en el schema. Al terminar, cualquier config con manual objeto, dinámico sin `itemType`, `itemType: 'scalar'` con `label`/`value`, o `itemType: 'object'` sin `label`/`value` debe rechazarse en bootstrap con `code: invalid-layout` y ruta exacta del nodo.

### Fuera de alcance
- Cambios en `runtime-collection-sources.ts` (T2).
- Cambios en la paleta o la UI del panel de propiedades (T3–T5).
- Introducir un adaptador silencioso de compatibilidad para los shapes retirados.
- Añadir semántica nueva de `source`, `label` o `value`.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/runtime-config-zod.ts` — declarar y exportar `selectItemsSchema` según D1; cambiar `selectNodeSchema.props.items`, `radioGroupNodeSchema.props.items` y `checkboxGroupNodeSchema.props.items` de `z.unknown()` a `selectItemsSchema`.
  - `src/config/runtime-config-types.ts` — retirar `SelectManualObjectItemsSource`; convertir `SelectDynamicItemsSource` en la unión discriminada `SelectDynamicScalarItemsSource | SelectDynamicObjectItemsSource` según D3; conservar `SelectManualScalarItemsSource`; actualizar `SelectLayoutNodeItems` para reflejar los tres shapes supervivientes.
  - `src/config/runtime-config.ts` — retirar el re-export de `SelectManualObjectItemsSource`; mantener el resto alineado con los nuevos tipos.
  - `src/config/validate-form-nodes.ts` — reescribir `validateSelectItemsContract` para apoyarse en `selectItemsSchema` como fuente estructural y conservar únicamente:
    - la validez de `source` como referencia (`validateCollectionSource` con `allowItemReference: true`, ruta `${path}.source`),
    - la validez de `label` y `value` como projection path en dinámico objeto (`isValidCollectionProjectionPath`, rutas `${path}.label`/`${path}.value`),
    - la homogeneidad `string`/`number` de `value` en manual literal (`validateSelectScalarValues`).
    Mantener la firma pública y el retorno `{status: 'ready', items} | {status: 'error', error}`. Cualquier fallo estructural debe mapearse a `enrichedInvalidLayout` con `code: invalid-layout` y ruta canónica derivada del primer issue del `SafeParseError`.
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación) — migrar los casos existentes que usaban shapes retirados como válidos (por ejemplo el `select` con `source + label + value` sin `itemType`, o el `radioGroup` con `values: Array<object> + label + value`) para que declaren el nuevo contrato objetivo, y añadir casos negativos nuevos por los tres nodos afectados.
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación) — añadir `itemType: 'object'` explícito al `select` dinámico objeto ya existente (u otras variantes equivalentes) para que el renderer siga probando el shape ahora obligatorio.
- Documentación afectada (referencia para pasadas posteriores):
  - `ai-workflow/docs/app-features/nodes/select.md`
  - `ai-workflow/docs/app-features/nodes/choice-groups.md`
  - `ai-workflow/docs/app-features/references/reference-resolution.md`
  - `ai-workflow/docs/current-state.md`

### Tests

**Ficheros de test**
- `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación)

**Comportamiento cubierto**
- `select.props.items` en modo manual literal `[{label, value}]` bien formado se acepta (regresión).
- `select.props.items` en modo manual escalar `{ values: [] }` con valores homogéneos string o number se acepta (regresión).
- `select.props.items` en modo dinámico escalar `{ source: 'queries.users.data', itemType: 'scalar' }` se acepta.
- `select.props.items` en modo dinámico objeto `{ source, itemType: 'object', label, value }` con rutas relativas y con interpolación `{{...}}` se acepta.
- Los mismos cuatro casos anteriores se aceptan también para `radioGroup.props.items` y `checkboxGroup.props.items`.
- `select.props.items` en manual objeto `{ values: [{...}], label, value }` se rechaza con `code: invalid-layout` y `message` que contenga la ruta exacta al `props.items` del nodo (por ejemplo `layout[0].children[0].props.items`). Ídem para `radioGroup` y `checkboxGroup`.
- `select.props.items` dinámico sin `itemType` (sólo `source`, o `source + label + value` sin `itemType: 'object'`) se rechaza con `code: invalid-layout` y ruta exacta al `props.items`. Ídem para `radioGroup` y `checkboxGroup`.
- `select.props.items` dinámico con `itemType: 'scalar'` y presencia de `label` o `value` se rechaza con `code: invalid-layout` y ruta exacta. Ídem para `radioGroup` y `checkboxGroup`.
- `select.props.items` dinámico con `itemType: 'object'` y ausencia de `label` o `value` se rechaza con `code: invalid-layout` y ruta exacta. Ídem para `radioGroup` y `checkboxGroup`.
- Un `source` inválido (por ejemplo `tokens.foo`) en dinámico objeto o dinámico escalar se rechaza con `code: invalid-layout` y ruta `${path}.source` (regresión de mensaje específico).
- Un `label` o `value` con projection path malformado en dinámico objeto se rechaza con `code: invalid-layout` y ruta `${path}.label` o `${path}.value` (regresión).
- El `select` dinámico objeto renderizado en el layout renderer sigue produciendo el listado esperado cuando el shape declara `itemType: 'object'` explícito.
- Todos los mensajes de error nuevos y migrados incluyen `code: 'invalid-layout'`, `displayMode: 'development-only'` y el `breadcrumb` enriquecido ya vigente (regresión mínima sobre un caso).

**Comandos durante la implementación**
- `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`

**Restricciones**
- No introducir un adaptador silencioso ni normalizar los shapes retirados: el rechazo debe ser directo.
- No introducir nuevas convenciones de referencia en `source`, `label` o `value`.
- La firma pública de `validateSelectItemsContract` debe mantenerse; sólo cambia su implementación interna.
- No añadir tests que dependan del texto libre del mensaje más allá del código, la ruta canónica y el breadcrumb existente.

### Criterios de finalización
- El schema Zod acepta exclusivamente los tres shapes objetivo para `select`, `radioGroup` y `checkboxGroup`.
- El validador imperativo devuelve `SelectLayoutNode['props']['items']` alineado con los nuevos tipos, sin la variante manual objeto.
- Todos los tests declarados arriba pasan en verde.
- La ejecución de `pnpm test` no rompe el umbral global de cobertura (`ai-workflow/standards/testing-rules.md`).

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` en `status.yaml` incluye `T1`.

---

## T2 — Limpieza de la resolución en `runtime-collection-sources`

### Estado
Completada

### Objetivo
Adaptar `runtime-collection-sources.ts` al catálogo recortado por T1, retirando las ramas dinámicas o manuales que sólo existían para servir el shape manual objeto. La semántica visible para los consumidores debe seguir igual en los casos que sobreviven al contrato objetivo, tal como fija D4.

### Fuera de alcance
- Cambios en el schema Zod, tipos o validador (T1).
- Cambios en la paleta o en la UI (T3–T5).
- Cambios en `ListLayoutNodeItems` o en la resolución de items de `list` (fuera de la spec).

### Dependencias
- T1 completa: los tipos y la validación deben rechazar manual objeto para que la eliminación de la rama muerta sea correcta.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-collection-sources.ts` — mantener `resolveCollectionSource` con la comprobación `'values' in items` sólo para manual escalar; mantener `resolveChoiceCollectionItems` proyectando objeto cuando `'label' in items && 'value' in items` (ahora sólo alcanzable por dinámico objeto). Eliminar cualquier rama muerta específica de manual objeto de choice (por ejemplo, ajustar la firma `Exclude<...>` de `resolveCollectionSource` para reflejar el nuevo catálogo). Si `projectObjectCollectionToSelectItems` deja de tener llamadores propios de choice manual objeto, mantenerlo únicamente si sigue sirviendo la rama dinámica objeto; no crear un helper nuevo.
- Tests a modificar:
  - `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación) — regresión positiva sobre la resolución `select` dinámico escalar y dinámico objeto tras la limpieza; no ampliar la superficie más allá de lo que ya cubría T1 sobre este mismo fichero.

### Documentación afectada
- `ai-workflow/docs/app-features/references/reference-resolution.md` (sólo si la ficha enumera hoy shapes ahora inexistentes).

### Tests

**Ficheros de test**
- `src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (ampliación)

**Comportamiento cubierto**
- `select` dinámico escalar (`itemType: 'scalar'`) sigue renderizando el listado normalizado esperado tras la limpieza.
- `select` dinámico objeto (`itemType: 'object'`) sigue proyectando `label` y `value` sin regresión, incluyendo interpolación `{{...}}` en `label` y en `value`.
- `radioGroup` y `checkboxGroup` conservan la misma resolución que `select` para dinámico escalar y dinámico objeto (regresión mínima por nodo).
- Un `source` que resuelve a colección vacía degrada como hoy a listado vacío, sin cambios respecto al estado previo.

**Comandos durante la implementación**
- `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx`

**Restricciones**
- No cambiar el contrato observable de `resolveChoiceCollectionItems` ni de `resolveSelectCollectionItems`.
- No modificar la lógica de resolución de `list.props.items`.

### Criterios de finalización
- `runtime-collection-sources.ts` no contiene ramas específicas de manual objeto para choice ni ramas inalcanzables tras T1.
- Los tests declarados pasan en verde.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` incluye `T2`.

---

## T3 — Paleta: `items: []` por defecto para `select`, `radioGroup` y `checkboxGroup`

### Estado
Completada

### Objetivo
Adaptar `buildDefaultNodeInstance` para que insertar `select`, `radioGroup` o `checkboxGroup` desde la paleta produzca `props.items: []` (modo manual literal vacío), cumpliendo el RF10 de la spec y evitando el valor placeholder `[{ label: 'Opción 1', value: 'opcion-1' }]` actual.

### Fuera de alcance
- Cambios en el catálogo de nodos, en el shape de otros defaults o en el resto de `props` iniciales.
- Cambios en la UI del panel (T4–T5).

### Dependencias
- T1 completa: el schema Zod ya debe aceptar `[]` como manual literal válido (era el caso antes de la feature; se comprueba tras T1).

### Impacto esperado en archivos
- Código a modificar:
  - `src/dev-runtime/layout-canvas/layout-canvas-node-palette-defaults.ts` — cambiar `items` de `select`, `radioGroup` y `checkboxGroup` a `[]`, manteniendo `fieldId` generado y `label` placeholder ya existentes.
- Tests a modificar:
  - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación) — verificar que la inserción de los tres tipos produce `props.items` como array vacío y sigue pasando validación de config al montar.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección paleta).

### Tests

**Ficheros de test**
- `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación)

**Comportamiento cubierto**
- Insertar `select` desde la paleta produce un nodo con `props.items` estrictamente igual a `[]`.
- Insertar `radioGroup` desde la paleta produce un nodo con `props.items` estrictamente igual a `[]`.
- Insertar `checkboxGroup` desde la paleta produce un nodo con `props.items` estrictamente igual a `[]`.
- La config resultante tras la inserción no rompe la validación completa (`validateRuntimeConfig`) más allá de lo que ya se toleraba con `items: []` en el shape manual literal.

**Comandos durante la implementación**
- `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`

**Restricciones**
- No introducir `label`/`value` placeholder por ítem: el default es exactamente `[]`.
- No cambiar la generación de `fieldId` ni otras `props` de estos nodos.

### Criterios de finalización
- Los defaults de la paleta cumplen el contrato objetivo.
- Los tests declarados pasan en verde.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` incluye `T3`.

---

## T4 — `ChoiceItemsPropertyField` y hook `x-widget` en `PropertyFieldDispatcher`

### Estado
Completada

### Objetivo
Introducir el widget dedicado que edita `props.items` desde el panel de propiedades del modo Editor (`ChoiceItemsPropertyField`) y el hook `x-widget` que le permite al dispatcher delegar en un registro cerrado antes de aplicar sus patrones genéricos, tal como fija D5. El widget cubre el selector de modo (manual literal, manual escalar, dinámico), el sub-editor por modo y, dentro del dinámico, el sub-selector `itemType` con visibilidad condicional de `label` y `value`.

### Fuera de alcance
- Wiring del widget en el schema efectivo del panel (T5).
- Cambios en el schema Zod o en el resto de widgets del dispatcher.
- Autocompletado de `source` u otros pickers contextuales.

### Dependencias
- T1 completa: el widget se apoya en el nuevo contrato (`itemType` obligatorio en dinámico, sin manual objeto).

### Impacto esperado en archivos
- Código a crear:
  - `src/dev-runtime/layout-canvas/property-fields/choice-items-property-field.tsx` — nuevo componente `ChoiceItemsPropertyField`. Detecta el modo a partir del valor (array → `manualLiteral`; objeto con `values` → `manualScalar`; objeto con `source` → `dynamic`; cualquier otro valor no reconocible → `manualLiteral` vacío). Renderiza:
    - un `EnumPropertyField` como selector de modo con etiquetas legibles en español (`Manual — literal`, `Manual — escalar`, `Dinámico`),
    - en `manualLiteral`, un editor de lista con controles Añadir/Quitar por entrada, cada entrada con dos `TextPropertyField` (`label`, `value`),
    - en `manualScalar`, un editor de lista con controles Añadir/Quitar por entrada, cada entrada con un `TextPropertyField` (`value`),
    - en `dynamic`, `TextPropertyField` para `source`, `EnumPropertyField` para `itemType` con opciones `scalar` y `object`, y `TextPropertyField` para `label` y `value` sólo cuando `itemType === 'object'`.
    Cambiar de modo reemplaza el valor por la plantilla mínima del nuevo modo (`[]`, `{ values: [] }` o `{ source: '', itemType: 'scalar' }`). Cambiar `itemType` de `object` a `scalar` retira `label` y `value` del valor; cambiar de `scalar` a `object` los reintroduce como strings vacíos. Puede reutilizar internamente `ArrayPropertyField` o su patrón, siempre y cuando el resultado emita al `onChange` los valores planos declarados por el contrato objetivo.
- Código a modificar:
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` — antes de aplicar los patrones genéricos, si el fragmento de schema declara `x-widget: '<clave>'`, buscar el componente en un registro cerrado `{ 'choice-items': ChoiceItemsPropertyField }` y delegar la edición ahí. El hook se limita al registro declarado y no admite widgets ad-hoc.
- Tests a crear:
  - `src/tests/dev-runtime/layout-canvas-property-field-choice-items.test.tsx` (nuevo) — cubre el comportamiento del widget aislado.
- Tests a modificar:
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación) — cubre el hook `x-widget` en el dispatcher y su prioridad frente al resto de detectores.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (Panel de propiedades, selector de variante).

### Tests

**Ficheros de test**
- `src/tests/dev-runtime/layout-canvas-property-field-choice-items.test.tsx` (nuevo)
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)

**Comportamiento cubierto**
- El dispatcher, ante un schema `{ 'x-widget': 'choice-items' }`, delega en `ChoiceItemsPropertyField` en lugar de caer al escape hatch de solo lectura o a otro patrón genérico.
- El dispatcher, ante un schema con `x-widget` sin entrada en el registro cerrado, ignora el hook y aplica los patrones genéricos (comportamiento previo).
- El dispatcher, ante un schema sin `x-widget`, aplica los patrones genéricos ya existentes (regresión mínima).
- `ChoiceItemsPropertyField` con valor `[]` renderiza el selector en modo `manualLiteral` y una lista vacía; Añadir inserta una entrada `{ label: '', value: '' }` y Quitar la retira.
- `ChoiceItemsPropertyField` con valor `{ values: [] }` renderiza el selector en modo `manualScalar` y una lista vacía; Añadir inserta una entrada `''` y Quitar la retira.
- `ChoiceItemsPropertyField` con valor `{ source: 'queries.foo.data', itemType: 'scalar' }` renderiza el modo `dynamic` con `itemType: 'scalar'`, no muestra `label` ni `value` y permite editar `source`.
- `ChoiceItemsPropertyField` con valor `{ source: 'queries.foo.data', itemType: 'object', label: 'name', value: 'id' }` renderiza el modo `dynamic` con `itemType: 'object'`, muestra los campos `label` y `value` y permite editarlos.
- Cambiar el selector de modo emite un `onChange` con el valor por defecto del nuevo modo (`[]`, `{ values: [] }` o `{ source: '', itemType: 'scalar' }`), descartando el valor anterior.
- Cambiar `itemType` de `object` a `scalar` emite un `onChange` que retira `label` y `value` del valor.
- Cambiar `itemType` de `scalar` a `object` emite un `onChange` que reintroduce `label: ''` y `value: ''`.
- Editar `source`, `label`, `value`, un item de manual literal o un item de manual escalar emite el `onChange` con el valor plano y sin campos residuales del otro modo.
- Un valor no reconocible (por ejemplo `null` o un objeto sin `values`/`source`) cae a modo `manualLiteral` vacío sin lanzar.

**Comandos durante la implementación**
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-choice-items.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`

**Restricciones**
- El hook `x-widget` debe ser un registro cerrado en el propio dispatcher, sin API pública para inyectar widgets desde fuera del módulo.
- El widget no debe introducir un contrato UI paralelo hardcodeado por tipo de nodo: no lee `node.type`; el schema efectivo es quien lo activa vía `x-widget`.
- No introducir pickers contextuales para `source`; se edita como `TextPropertyField`.
- El widget no impone longitud mínima al manual literal ni al manual escalar.

### Criterios de finalización
- Los tests declarados pasan en verde y el widget cubre las tres modalidades y sus transiciones.
- El dispatcher aplica el hook `x-widget` sólo para el registro cerrado.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` incluye `T4`.

---

## T5 — Adaptador `resolveChoiceLikePropsSchema` en el panel de propiedades

### Estado
Completada

### Objetivo
Sustituir el sub-schema de `props.items` derivado de Zod por el sentinel `{ 'x-widget': 'choice-items' }` en el schema efectivo que el panel de propiedades pasa a `PropertyFieldDispatcher` para `select`, `radioGroup` y `checkboxGroup`, siguiendo el precedente `resolveTabsPropsSchema` (D6). El schema que se pasa a Monaco no cambia y sigue siendo el Zod real. Al terminar, el panel de propiedades edita `props.items` íntegramente desde el formulario para los tres nodos, cualquier cambio se refleja en el runtime y en el buffer de Monaco, y no aparece el fallback de solo lectura sobre `items`.

### Fuera de alcance
- Cambios en el schema Zod global o en el bundle que consume Monaco.
- Cambios en la paleta (T3) o en el widget (T4).
- Adaptaciones para nodos distintos de `select`, `radioGroup` y `checkboxGroup`.

### Dependencias
- T1, T3 y T4 completas: el contrato, los defaults y el widget deben estar en su sitio antes de enchufar el adaptador.

### Impacto esperado en archivos
- Código a modificar:
  - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` — añadir `resolveChoiceLikePropsSchema(propsSchema)` junto a `resolveTabsPropsSchema`, aplicada al `props` de `select`, `radioGroup` y `checkboxGroup`. La función reemplaza el sub-schema `items` derivado de Zod por `{ 'x-widget': 'choice-items' }` (sin `oneOf`/`anyOf` residual), preservando el resto de `props`. Wire en el `SUBSECTIONS.map` para que se aplique sólo cuando `key === 'props'` y `node.type` pertenece al conjunto. `resolveUnionBranch` sobre el sentinel debe devolver el propio sentinel (no hay `oneOf`/`anyOf`), por lo que la propagación a través de `ObjectPropertyField` no lo pierde; comprobarlo con test específico.
- Tests a modificar:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación) — cubrir el flujo end-to-end en el panel para los tres nodos.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md` (panel de propiedades para `select`, `radioGroup`, `checkboxGroup`).
- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`

### Tests

**Ficheros de test**
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto**
- El panel de propiedades de un `select` seleccionado renderiza el selector de modo del widget para `props.items` y no cae al escape hatch de solo lectura.
- El panel de propiedades de un `radioGroup` seleccionado renderiza el selector de modo del widget para `props.items` y no cae al escape hatch.
- El panel de propiedades de un `checkboxGroup` seleccionado renderiza el selector de modo del widget para `props.items` y no cae al escape hatch.
- Editar un ítem manual literal desde el widget invoca `onCommitNodeUpdate` con el `props.items` actualizado como array plano `[{label, value}, ...]`.
- Cambiar el modo a `manualScalar` invoca `onCommitNodeUpdate` con `props.items` como `{ values: [] }`.
- Cambiar el modo a `dynamic` invoca `onCommitNodeUpdate` con `props.items` como `{ source: '', itemType: 'scalar' }`; editar `source` y cambiar `itemType` a `object` invoca `onCommitNodeUpdate` con `label: ''`/`value: ''` añadidos.
- Los cambios anteriores se propagan al buffer de Monaco por el mismo mecanismo que el resto de campos del panel (regresión sobre la sincronización canvas ↔ Monaco).
- El schema pasado al dispatcher para la subsección `props` de `select` no contiene `oneOf`/`anyOf` remanente sobre `items` (regresión estructural sobre `resolveChoiceLikePropsSchema`).
- Un tipo de nodo distinto (por ejemplo `input`) no se ve afectado y sigue renderizando su `props` como antes (regresión mínima).

**Comandos durante la implementación**
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`

**Restricciones**
- No modificar `PropertyFieldDispatcher` en esta tarea: el widget ya se resuelve por `x-widget` desde T4.
- No introducir dependencias de `node.type` dentro de los componentes de campo; toda la especialización vive en el adaptador del panel.
- El schema que consume Monaco (`runtimeConfigRootSchema` → `toJSONSchema`) no debe cambiar.

### Criterios de finalización
- El panel de propiedades edita `props.items` íntegramente en los tres modos para los tres nodos sin abrir Monaco, cumpliendo los criterios de aceptación de la spec.
- Los tests declarados pasan en verde.
- `pnpm test` no rompe el umbral global de cobertura.

### Cierre de implementación
Código y tests de la tarea completos y validados. `implementation.completed_task_ids` incluye `T5` y `implementation.ready` refleja el fin del alcance planificado.
