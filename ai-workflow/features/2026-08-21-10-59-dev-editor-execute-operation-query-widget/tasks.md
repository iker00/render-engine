# Tareas: dev-editor-execute-operation-query-widget

## Resumen del plan
Una única tarea. La causa raíz está acotada a una función de detección dentro del dispatcher genérico de campos de propiedades (`PropertyFieldDispatcher`) y es compartida por todos los puntos de montaje descritos en la spec (`button.props.action`, `form.submitAction`, sus ramas `onSuccess`/`onError`, y cada entrada de `executeOperations.operations[]`): todos ellos generan sus pestañas del panel de propiedades a partir del mismo JSON Schema derivado y pasan por el mismo dispatcher. Corregir la detección en un solo lugar corrige los cinco puntos de montaje a la vez sin tocar el widget visual (`KeyValuePropertyField`) ni el camino bespoke del panel "Api" (fuera de alcance).

No se necesita `design.md`: `risk_level: low`, cambio de una sola función pura más su punto de consumo, sin decisión arquitectónica.

## T1 — Detectar `query` (`additionalProperties` como unión de tipos primitivos) en el dispatcher genérico y enrutarlo al editor clave-valor

### Objetivo
Hacer que `PropertyFieldDispatcher` reconozca como mapa clave-valor editable un campo `type: 'object'` sin `properties` declaradas cuyo `additionalProperties` sea una unión (`anyOf`) de ramas primitivas (`string`/`number`/`boolean`) — la forma exacta que produce `toJSONSchema` de Zod v4 para `runtimeApiQuerySchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))` (`src/config/runtime-config-zod.ts:85`) — además del caso ya soportado de `additionalProperties: { type: 'string' }` (`headers`). El campo debe enrutarse a `KeyValuePropertyField` exactamente igual que `headers` hoy: mismo componente, misma criterio de fila editable por defecto (`isNestedValue`, sin pasar `isValueEditable`), mismo pipeline de commit.

Esto habilita, sin ningún cambio adicional de código, la edición visual de `query` en los cinco puntos de montaje descritos en la spec, porque todos comparten el mismo JSON Schema derivado y el mismo dispatcher: `button.props.action` (`executeOperation`), `button.props.action` (`executeOperations.operations[]`), `form.submitAction` (`executeOperation`), `form.submitAction` (`executeOperations.operations[]`), y las entradas `onSuccess[]`/`onError[]` de `form.submitAction` (que reutilizan el mismo contrato de acción).

### Fuera de alcance
- `query` de las operaciones del bloque raíz `api` y de `preloads`: se editan por un camino bespoke (`src/dev-runtime/api-config-panel/api-operation-fields-editor.tsx`, `src/dev-runtime/api-config-panel/preload-entry-fields-editor.tsx`) que ya monta `KeyValuePropertyField` directamente, sin pasar por este dispatcher. No se toca.
- `navigateTo.params` (`NavigateParamsPropertyField`): usa su propio criterio de editabilidad por fila (`isValueEditable`) y su propio hook `x-widget: 'navigate-params'`. No se toca.
- `headers`: su comportamiento actual ya es correcto y no cambia. `headers`/`body` no pasan por la función de detección que se añade en esta tarea (`isPrimitiveValueMapAdditionalProperties`).
- `body`: se resuelve antes, vía `isBareRefSchema` (líneas 115-127 de `property-field-dispatcher.tsx`), no por la función que añade esta tarea. Durante la implementación se detectó que esa rama, a diferencia de `query`/`headers`, no enrutaba al editor visual cuando `body` no estaba declarado (`value === undefined`) — sin alta posible desde el panel para un `body` nuevo, contradiciendo la asunción ya escrita en FR5 de la spec. Se corrige ese caso puntual en la misma rama `isBareRefSchema` como parte de esta tarea, sin tocar `KeyValuePropertyField` ni el resto del comportamiento ya correcto de `body`.
- Cualquier cambio visual o de interacción en `KeyValuePropertyField` o `KeyValueRow`: no se modifican: la degradación a solo lectura de una fila con valor objeto/array ya funciona como exige FR4 sin cambios, una vez el campo llega al componente correcto.
- Ampliar la detección a otras formas de unión no vistas hoy en el proyecto (por ejemplo con una rama `null` o `object`/`array` dentro del `anyOf`): la nueva función de detección debe devolver `false` para cualquier unión que no sea exclusivamente de ramas primitivas (`string`/`number`/`boolean`), dejando esos casos en el camino genérico ya existente (fallback a `ObjectPropertyField` o al escape hatch de JSON crudo, sin cambio de comportamiento respecto a hoy).

### Dependencias
Ninguna. Primera y única tarea del plan.

### Interfaces
**Consume**: ninguno.

**Produce**: `isPrimitiveValueMapAdditionalProperties(additionalProperties: unknown): boolean` (de T1) — sin consumidores directos fuera de esta tarea (no hay tareas posteriores en este plan).

Contrato de la función (a implementar en `src/dev-runtime/layout-canvas/property-fields/property-field-schema-resolution.ts`, junto a `resolvePrimarySchemaType`/`isPlainObject` ya existentes):
- Recibe el valor crudo de `schema.additionalProperties` de un fragmento de JSON Schema (puede ser `undefined`, `boolean`, o un objeto).
- Devuelve `true` si:
  - `additionalProperties` es un objeto plano (`isPlainObject`) y `resolvePrimarySchemaType(additionalProperties) === 'string'` (caso ya soportado hoy, `headers`), **o**
  - `additionalProperties` es un objeto plano cuyo `anyOf` es un array no vacío y **todas** sus ramas son objetos planos cuyo `resolvePrimarySchemaType(rama)` resuelve a uno de `'string' | 'number' | 'boolean'` (caso nuevo, `query`).
- Devuelve `false` en cualquier otro caso (incluida una rama de `anyOf` que sea `object`, `array`, `null`, o que no resuelva ningún tipo primitivo; y el caso `additionalProperties` ausente, `boolean`, o sin forma reconocible).

### Impacto esperado en archivos
Código:
- `src/dev-runtime/layout-canvas/property-fields/property-field-schema-resolution.ts`: añadir la función `isPrimitiveValueMapAdditionalProperties` descrita arriba, exportada junto a las demás funciones puras del módulo.
- `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: en la rama `schemaType === 'object'` (alrededor de las líneas 214-224 actuales), sustituir la condición actual de `isStringKeyValueMap` (que solo comprueba `resolvePrimarySchemaType(additionalProperties) === 'string'`) por una llamada a `isPrimitiveValueMapAdditionalProperties(schema.additionalProperties)`, manteniendo intacta la condición `!propertiesSchema` y el resto de la rama (renderizado de `KeyValuePropertyField` sin `isValueEditable`, igual que hoy). Actualizar el comentario adyacente para describir también el caso `query`/`anyOf` primitivo, no solo `additionalProperties: { type: 'string' }`.

Tests:
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).

Documentación:
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Editor clave-valor (`params`, `query`, `headers`, `body`)" — solo a revisar (no editar aquí): la spec ya señala que el texto describe el comportamiento que esta tarea implementa; verificar en la pasada documental posterior que no requiere cambios.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación) — nuevo `describe` a continuación del bloque existente `PropertyFieldDispatcher object schema with additionalProperties: string (T6)` (línea ~550), cubriendo la nueva función de detección de forma aislada del panel.
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación) — nuevo `describe` a continuación del bloque `LayoutCanvasPropertiesPanel body override for KV editor (T7)` (línea ~1105), cubriendo el comportamiento end-to-end en los puntos de montaje reales de la spec.

**Comportamiento cubierto**:
- (dispatcher) Un schema `{ type: 'object', additionalProperties: { anyOf: [{type:'string'},{type:'number'},{type:'boolean'}] } }` (la forma real de `query` tras `toJSONSchema`) se enruta a `KeyValuePropertyField`: aparecen las filas `<label> clave #n`/`<label> valor #n` para un valor inicial con entradas string/number/boolean, y pulsar "Añadir" invoca `onChange` con una entrada nueva de clave y valor vacíos — mismo patrón de aserción que el test ya existente para `additionalProperties: { type: 'string' }` (línea 551-567).
- (dispatcher) Un valor number/boolean en una fila se muestra en el input de texto editable (no en el textarea de solo lectura): monta el schema anterior con un valor inicial `{ a: 1, b: true }` y comprueba que ambas filas usan `<input>`, no `<textarea disabled>`.
- (dispatcher, regresión de seguridad de la nueva función) Un schema `{ type: 'object', additionalProperties: { anyOf: [{type:'string'}, {type:'object'}] } }` (una unión que mezcla un tipo primitivo con uno no primitivo, forma que hoy no produce ningún schema real del proyecto pero que la función de detección debe rechazar explícitamente) NO se enruta a `KeyValuePropertyField`: cae al camino genérico existente (sin `properties` declaradas → `ObjectPropertyField` con `propertiesSchema: undefined`, mismo resultado que produce hoy el bug para `query` — no se afirma nada nuevo sobre ese fallback, solo que la nueva función no lo intercepta indebidamente).
- (panel, `button.props.action` tipo `executeOperation`) Un botón con `action: { type: 'executeOperation', operationName: 'save', query: { page: '1', limit: 10 } }` muestra el grupo `query` con filas clave-valor editables (no un grupo vacío sin filas ni botón "Añadir"); editar el valor de una fila y pulsar "Añadir" siguen el mismo patrón de aserción que los tests ya existentes para `body` en este mismo fichero (líneas 1110-1137: `onCommitNodeUpdate` invocado con un updater que produce el `action` esperado).
- (panel, alta desde cero) Un botón con `action: { type: 'executeOperation', operationName: 'save' }` sin `query` declarado muestra el botón "Añadir query" (grupo `query` presente con cero filas); pulsarlo commitea `query: { '': '' }`.
- (panel, FR4) Un `query` con un valor number (`{ limit: 10 }`) y otro boolean (`{ active: true }`) ya declarado muestra ambas filas como `<input>` editable (no degradadas a solo lectura) — a diferencia de un valor anidado objeto/array en la misma fila, que sí degrada (caso ya cubierto por el comportamiento por defecto de `KeyValuePropertyField`/`isNestedValue`; no requiere test nuevo aquí más allá de confirmar que number/boolean no activan esa degradación).
- (panel, FR2) El mismo comportamiento (filas editables para `query` ya declarado, alta desde cero) se observa para una entrada de `submitAction.operations[]` de tipo `executeOperations`, siguiendo el mismo patrón de aserción por-entrada que el test ya existente para `body` en `executeOperations.operations` (líneas 1154 en adelante).
- (panel, criterio de aceptación de la spec) El mismo comportamiento se observa para `form.submitAction` de tipo `executeOperation` directamente (no solo para `button.props.action`), y para una entrada de la lista `onSuccess` de un `submitAction` de tipo `executeOperations` — confirma que el editor visual de `query` funciona igual en las ramas anidadas descritas por FR1/FR2 y los criterios de aceptación de la spec, sin una implementación paralela por punto de montaje.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones**:
- No añadir un tercer fichero de test: la lógica pura de detección se cubre en `layout-canvas-property-field-dispatcher.test.tsx` (ya ejercita `PropertyFieldDispatcher` de forma aislada con schemas sintéticos) y el comportamiento end-to-end por punto de montaje en `layout-canvas-properties-panel.test.tsx` (ya tiene la infraestructura `buttonNode`/`somePath`/`onCommitNodeUpdate` reutilizable de los tests de `body`).
- Reutilizar el helper local `buttonNode` ya definido dentro de `describe('LayoutCanvasPropertiesPanel body override for KV editor (T7)', ...)` en `layout-canvas-properties-panel.test.tsx` si el nuevo `describe` se coloca en el mismo ámbito de módulo; si se declara en un `describe` hermano fuera de ese alcance, redeclarar un helper equivalente en vez de exportar uno nuevo desde el fichero de producción.
- No añadir snapshots.
- No modificar ni añadir tests para el panel "Api" (root `api`/`preloads`): ya cubierto por `api-config-panel.test.tsx`, fuera de alcance de esta tarea.

### Documentación afectada
`ai-workflow/docs/app-features/development/dev-mode-editor.md`, sección "Editor clave-valor (`params`, `query`, `headers`, `body`)" — revisar en la pasada de `update-app-documentation` si el texto actual (que ya describe `query` como cubierto) necesita algún ajuste; probablemente ninguno.

### Criterios de finalización
- `isPrimitiveValueMapAdditionalProperties` existe en `property-field-schema-resolution.ts` con el contrato descrito arriba y está cubierta por los tests del dispatcher.
- `PropertyFieldDispatcher` usa esa función en la rama `schemaType === 'object'` y enruta `query` de `executeOperation`/`executeOperations` a `KeyValuePropertyField` en los cinco puntos de montaje de la spec.
- `headers`, `body` y `navigateTo.params` no cambian de comportamiento (regresión cubierta por los tests ya existentes, que deben seguir en verde sin modificación).
- Todos los tests nuevos y existentes de ambos ficheros pasan (`pnpm test --run` de ambos ficheros en verde).
- El umbral global de cobertura del proyecto (`pnpm test`) se mantiene.

### Cierre de implementación
Código y tests de esta tarea completos y validados: los dos comandos de test de la sección anterior en verde, sin romper ningún test preexistente en esos ficheros ni en el resto de la suite (`pnpm test`), y sin bajar el umbral de cobertura del proyecto.

## Siguiente tarea
No hay más tareas: T1 es la única y cierra el plan. Al completarse, la feature pasa a `phase: documentation` con `update-app-documentation` para verificar (sin editar previsiblemente) `dev-mode-editor.md`.
