# Tasks: row-visibility-and-switch-checked

## Orden de ejecución
T1 → T2 → T3, estrictamente secuencial. T2 depende del shape aceptado por T1 (si T2 se implementa antes, sus tests de bootstrap-rejection no podrían distinguir shape inválido de contexto inválido). T3 depende de que T1+T2 hayan cerrado el contrato de bootstrap para poder cubrir el comportamiento runtime sin bloqueos de validación.

Siguiente tarea a escoger tras cerrar esta planificación: **T1**.

Nota transversal: esta feature no introduce namespace nuevo. `row.*`/`row.$index` ya están reconocidos por `parseRuntimeReference` con la opción `allowRowReference` (feature `2026-08-25-12-01-table-row-references`, T1) y ya se resuelven en runtime contra `iterationContext.row`/`iterationContext.rowIndex` en `resolveRuntimeReference` (misma feature, T2). El wiring de contexto de fila desde `table-layout-node.tsx` a nodos anidados dentro de celdas-nodo (incluida propagación del `iterationContext` ambiental de un `repeater` ancestro) también existe ya (misma feature, T3). Por tanto esta feature es fundamentalmente **ensanchar dos superficies de aceptación en bootstrap** y **verificar** que el comportamiento runtime esperado ya ocurre; ningún código de resolución de referencias en runtime se toca.

---

## T1. Aceptar `row`/`row.{segmentos}`/`row.$index` como shape válido en `visibility.reference`

### Objetivo
Extender la función interna `isValidVisibilityReference` en `src/config/validate-actions-visibility.ts` para que reconozca `row`, `row.{segmentosAnidados}` y `row.$index` como shape válido de referencia dentro de una condición `visibility` simple. Como esta misma función se usa para validar cada condición dentro de un grupo compuesto (`operator: 'and' | 'or'`) mediante `validateVisibilityGroupConditions`, la aceptación se propaga automáticamente a grupos sin cambios adicionales en ese helper.

Cambios exactos:

1. En `isValidVisibilityReference(reference: string): boolean`, añadir un bloque análogo al ya existente para `item.*`, colocado inmediatamente después del bloque de `item.*` y antes del bloque `params`:
   ```ts
   if (reference === 'row' || reference.startsWith('row.')) {
     const parsedReference = parseRuntimeReference(reference, { allowRowReference: true })
     return parsedReference.kind === 'reference' && parsedReference.status === 'supported'
   }
   ```
   Esto delega toda la validación de shape (segmentos anidados, `$index` exacto, rechazo de `$key`/`$otro`) a `parseRuntimeReference`, mismo criterio que ya usa `item.*` en la misma función.

2. Asegurar que la importación de `parseRuntimeReference` desde `./runtime-reference-syntax` esté presente al principio del fichero. Si ya existe, no duplicar.

3. No modificar `validateVisibilityGroupConditions` ni `validateVisibility`: ambos consumen `isValidVisibilityReference` a través del parámetro `isValidReference: (ref: string) => boolean` ya existente, así que reciben el shape ampliado sin cambios de firma.

Esta tarea introduce únicamente ampliación de shape aceptado; en este punto un `visibility.reference: 'row.status'` en un nodo fuera de cualquier celda de `table` **todavía se acepta en bootstrap** (rechazo lo aporta T2). Comportamiento intencionado y transitorio: T1 y T2 se implementan en secuencia sin release entre medias.

### Fuera de alcance
- No se rechaza en bootstrap `row.*` fuera de una celda de `table` (eso es T2).
- No se toca `isValidWhenReference` ni `validateWhenCondition`: la spec explícitamente excluye añadir `row.*` a `submitAction.onSuccess[*].when`, `pages[].preloads[*].when` y `button.props.action.operations[*].when`.
- No se modifica el shape aceptado en ninguna otra superficie de `visibility` (headers, dynamic strings, `defaultValue`, orígenes de colección, etc.).
- No se modifica `parseRuntimeReference` ni `RuntimeReferenceParseResult`: se consume tal cual lo dejó `table-row-references` T1.
- No se modifica `validate-button-node.ts`. El zod schema de `button.props.checked` ya es `z.union([z.boolean(), z.string()])` y no verifica el catálogo de referencias, así que `checked: 'row.isPrimary'` ya se acepta en bootstrap por shape (la única validación de contenido sobre `checked` es la de `switch.next`, que rechaza `checked` con esa forma sintética; `row.*` no coincide con esa forma).

### Dependencias
Ninguna. `parseRuntimeReference` con `allowRowReference` ya está disponible.

### Interfaces
**Consume:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean; allowSwitchNextReference?: boolean }): RuntimeReferenceParseResult` (de la feature previa `table-row-references`, T1)

**Produce:** ninguno. `isValidVisibilityReference` es una función interna del módulo `validate-actions-visibility.ts`; su ampliación de comportamiento se observa desde T2 y desde los tests de esta tarea, pero no se exporta como interfaz reutilizable.

### Impacto esperado en archivos
- Código: `src/config/validate-actions-visibility.ts` (modificación).
- Tests: `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
- Documentación afectada: `ai-workflow/docs/app-features/references/visibility.md` (sección "Referencias admitidas": añadir `row`, `row.{segmentosAnidados}`, `row.$index`). El detalle funcional completo — frontera "solo dentro de celda de `table`" — se documenta al cierre de T2, cuando el comportamiento observable de rechazo ya existe.

### Tests
**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)

**Comportamiento cubierto:**
- Un layout con un nodo cualquiera y `visibility: { reference: 'row.status', operator: 'equals', value: 'active' }` pasa la validación de shape (no es rechazado por `isValidVisibilityReference`). En este punto pasa aunque el nodo no esté dentro de una celda de `table`; T2 restringirá esto. El test declara explícitamente en su descripción que valida shape, no scope.
- `visibility: { reference: 'row', operator: 'isTruthy' }` (sin segmentos) pasa la validación de shape.
- `visibility: { reference: 'row.meta.author.name', operator: 'equals', value: 'Ada' }` (segmentos anidados) pasa la validación de shape.
- `visibility: { reference: 'row.tags.0', operator: 'equals', value: 'x' }` (segmento numérico) pasa la validación de shape.
- `visibility: { reference: 'row.$index', operator: 'lessThan', value: 4 }` pasa la validación de shape.
- `visibility: { reference: 'row.$index.algo', operator: 'isTruthy' }` es rechazado (shape inválido) con el mismo criterio que `parseRuntimeReference` ya aplica a `item.$index.algo`; el mensaje señala la ruta exacta a `visibility.reference`.
- `visibility: { reference: 'row.algo.$index', operator: 'isTruthy' }` es rechazado (shape inválido) con ruta exacta.
- `visibility: { reference: 'row.$key', operator: 'isTruthy' }` es rechazado (shape inválido) — `row.$key` no existe como forma sintética.
- `visibility: { reference: 'row.$other', operator: 'isTruthy' }` es rechazado (shape inválido).
- Un grupo compuesto `visibility: { operator: 'and', conditions: [{ reference: 'row.status', operator: 'equals', value: 'active' }, { reference: 'forms.filters.active', operator: 'isTruthy' }] }` pasa la validación (T1 acepta `row.*` en cada condición del grupo, `forms.*` sigue aceptándose como antes). Igual test análogo con `operator: 'or'`.
- Un grupo compuesto donde una única condición interna es `row.$key.*` (shape inválido) es rechazado con la ruta exacta a `visibility.conditions[k].reference`.
- Regresión: los casos ya existentes de este mismo fichero (`item.*`, `params.*`, `forms.*`, `queries.*`, operadores, `negate`, grupos, `arrayContains`) siguen pasando sin modificación.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts
```

**Restricciones:**
- Añadir los casos nuevos en un `describe` propio (por ejemplo `'row.* references in visibility shape'`) sin reordenar ni modificar los bloques existentes de `item.*`, `forms.*`, `queries.*`, `params.*`, operadores, `negate`, `arrayContains`, grupos.
- Cada aserción debe apuntar contra el resultado de `validateRuntimeConfig` (extremo público del validador), no contra `isValidVisibilityReference` directamente, para que los tests sigan protegiendo el contrato aunque el nombre o firma interna del helper cambien.
- No añadir ningún caso que dependa de contexto de tabla (dentro/fuera de celda de `table`): esos escenarios pertenecen a T2. En este punto todos los casos válidos por shape se declaran fuera de cualquier `table` para que un futuro cambio de scope no oculte accidentalmente el fallo de shape.

---

## T2. Rechazar en bootstrap `visibility.reference: row.*` fuera del subárbol de una celda-nodo de `table`

### Objetivo
Añadir una pasada post-validación de layout que rechace en bootstrap cualquier `node.visibility` cuya `reference` (o cuya `conditions[k].reference`, en el caso de un grupo compuesto) tenga forma `row.*` (`row`, `row.{segmentos}`, `row.$index`) cuando el nodo no vive dentro del subárbol de una celda-nodo de `table` (celdas-nodo declaradas en `table.props.rows.cells[i]` o en `table.props.rows[j][i]` cuando esa celda es un `TableCellNode`).

Después de T2, el criterio de aceptación de la spec "El mismo nodo fuera de cualquier celda de `table` con `visibility.reference: 'row.status'` provoca que el config completo se rechace antes del render" queda cubierto.

Cambios exactos:

1. **Nuevo módulo** `src/config/validate-row-visibility-scope.ts` que exporte:
   ```ts
   export function validateRowVisibilityScope(
     config: RuntimeConfig,
   ): { status: 'error'; error: RuntimeConfigError } | null
   ```
   La función recorre `config.pages[*].layout` como bosque de `LayoutNode`. Propaga un flag booleano `insideTableCell` durante el recorrido, inicializado a `false` en la raíz de cada página, y devuelve el primer error encontrado (`invalidLayout` con ruta exacta al `.visibility.reference` o `.visibility.conditions[k].reference`) o `null` si no hay violación.

2. **Reglas de propagación de `insideTableCell`** al recorrer un nodo:
   - `container`, `form`, `link` con `children`, `accordion`, `modal`: `children` heredan el flag actual.
   - `repeater`: `props.template` hereda el flag actual (un `repeater` dentro de una celda de `table` mantiene el flag `true` para todos sus descendientes; un `repeater` fuera lo mantiene `false`).
   - `group` (instancia): `children` (contenido del slot) heredan el flag actual.
   - `tabs`, `steps`: cada `props.items[i].children` hereda el flag actual.
   - `queryStateFeedback.states.{estado}.fallback`: los nodos del fallback heredan el flag actual (viven en la misma posición del árbol que el nodo original).
   - `table`: para cada celda del bloque `props.rows`:
     - modo manual (`props.rows: TableCellValue[][]`): para cada `props.rows[j][i]`, si el valor es un `TableCellNode` (objeto con `type`), la validación de ese nodo y de todos sus descendientes se realiza con `insideTableCell = true`. Si el valor es primitivo (`string`/`number`/`boolean`), no hay recursión de nodos.
     - modo dinámico (`props.rows: { source; cells: (string | TableCellNode)[] }`): para cada `props.rows.cells[i]`, si es un `TableCellNode`, mismo tratamiento (`insideTableCell = true`). Si es `string`, no hay recursión de nodos.
     - la propia `table.visibility` se evalúa con el flag del contexto donde vive la `table`, no con `true` (la `table` no está dentro de sí misma).
   - El resto de tipos de nodo hoja (`heading`, `paragraph`, `list`, `image`, `button`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `hidden`, `badge`, `alert`, `stat`, `divider`, `skeleton`, `fileInput`, `fileManager`, `map`, `gallery`, `chart`, `autocomplete`, `slot`) no tienen subárbol; su `visibility` se evalúa con el flag heredado y no hay recursión adicional.

3. **Detección de referencia `row.*`** al evaluar la `visibility` de un nodo (`node.visibility` cuando existe): considerar todas las referencias declaradas por la `visibility`:
   - condición simple: una única referencia `visibility.reference`.
   - grupo compuesto: `visibility.conditions[k].reference` para cada `k`.
   Para cada referencia, si tiene forma `row.*` (`referencia === 'row' || referencia.startsWith('row.')`) y el flag actual es `false`, devolver `invalidLayout` con mensaje análogo al ya emitido por `isValidVisibilityReference` fuera de contrato, pero con motivo explícito de scope:
   ```
   Page "{pageId}" has an invalid layout at "{ruta a .visibility.reference | .visibility.conditions[k].reference}": row.* references are only supported inside a table cell subtree.
   ```
   La ruta exacta debe incluir el path del nodo (`layout[i].children[j]....visibility.reference` según recorrido) siguiendo el mismo estilo textual que el resto de errores del validador de layout.

4. **Integración** en `src/config/validate-runtime-config.ts`: llamar a `validateRowVisibilityScope(config)` inmediatamente después de `validateModalReferences(config)` y antes de `validateGroupsConfig`. Si devuelve error, propagarlo tal cual (mismo patrón que las llamadas vecinas).

5. **No** ampliar la firma de `LayoutValidationCtx`. La detección se hace en post-pass sobre el árbol ya validado (aprovechando la estructura tipada `LayoutNode`), no cableando un nuevo flag por cada validador de nodo. Este enfoque replica el patrón ya vigente de `validateModalReferences` en el mismo módulo.

### Fuera de alcance
- No se toca `parseRuntimeReference` ni la resolución runtime de `row.*`.
- No se toca ningún nodo del runtime (`src/runtime/`): la evaluación runtime de `row.*` en `visibility` ya funciona vía `matchesVisibilityRule` → `resolveRuntimeReference` desde la feature previa.
- No se rechaza `row.*` en ninguna otra superficie: `checked` de switch sigue aceptando cualquier string (misma frontera que hoy tienen `item.*`, `queries.*`, `forms.*`, `params.*` en `checked`), `submitAction.query`/`body`, `preloads[].when`, `submitAction.onSuccess[*].when`, `button.props.action.operations[*].when` se dejan intactos por decisión explícita de la spec.
- No se restringe el scope de `item.*` en `visibility.reference`: hoy `item.*` se acepta en `visibility` fuera de cualquier `repeater` y degrada a valor ausente en runtime; esta tarea no cambia ese comportamiento (la spec no lo pide y sería un cambio de contrato paralelo fuera de alcance).
- No se emite advertencia en desarrollo: rechazo duro en bootstrap, sin capa intermedia.
- No se toca `dev-editor`: la selección/edición visual del campo `visibility.reference` no verifica scope; si el usuario introduce `row.*` fuera de una celda de `table` desde el editor visual, el commit se rechazará como cualquier otro shape inválido a través del pipeline existente de commit (`layout-canvas-commit`) — este comportamiento cae ya cubierto por la pasada post-validación general.

### Dependencias
T1 (consume el shape ampliado aceptado por `isValidVisibilityReference`; si T2 se implementa antes, sus tests no podrían distinguir "rechazado por shape" de "rechazado por scope").

### Interfaces
**Consume:**
- Tipo `RuntimeConfig` con `pages[*].layout: LayoutNodeCollection` y estructura tipada de nodos (`LayoutNode`, `TableCellNode`, etc.) desde `./runtime-config-types`.
- Helper `invalidLayout(mensaje: string): { status: 'error'; error: RuntimeConfigError }` desde `./runtime-config-validation-errors` (ya usado en el módulo hermano `validate-runtime-config.ts`).

**Produce:**
- `validateRowVisibilityScope(config: RuntimeConfig): { status: 'error'; error: RuntimeConfigError } | null` — consumido por: `validateRuntimeConfig` (integración misma tarea, no otra tarea posterior).

### Impacto esperado en archivos
- Código:
  - `src/config/validate-row-visibility-scope.ts` (nuevo).
  - `src/config/validate-runtime-config.ts` (modificación: importación + llamada al pass justo tras `validateModalReferences`).
- Tests: `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación).
- Documentación afectada:
  - `ai-workflow/docs/app-features/references/visibility.md` (regla nueva: "una `visibility.reference` con forma `row.*` en un nodo fuera del subárbol de una celda de `table` se rechaza en bootstrap con ruta exacta"; aplicable a condición simple y a cada condición dentro de un grupo compuesto).
  - `ai-workflow/docs/app-features/references/reference-resolution.md` (ampliar "Frontera específica de `row.*`" para mencionar la superficie `visibility.reference` junto a celdas string y celdas-nodo).

### Tests
**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-visibility.test.ts` (ampliación)

**Comportamiento cubierto:**
- Un layout raíz con un `container` cuyo hijo declara `visibility: { reference: 'row.status', operator: 'equals', value: 'active' }` es rechazado por bootstrap; el mensaje señala la ruta exacta al `.visibility.reference` de ese hijo. El motivo textual del error incluye la frase discriminadora `row.* references are only supported inside a table cell subtree.` (o textualmente equivalente al mensaje exacto emitido por `validateRowVisibilityScope`, si el implementador elige otro fraseado; el test debe fijar el mensaje literal para bloquear regresiones de wording sutiles).
- Un layout con una `table` en modo dinámico donde una celda-nodo (`table.props.rows.cells[i]` de tipo `container`/`button`/`badge`/etc.) declara `visibility: { reference: 'row.status', operator: 'equals', value: 'active' }` se acepta en bootstrap (dentro del subárbol de la celda-nodo).
- Un layout con una `table` en modo dinámico donde un nodo profundamente anidado (`container > container > button`) dentro de una celda-nodo declara `visibility` con `row.*` se acepta en bootstrap (recursión bien propagada).
- Un layout con una `table` en modo manual donde una celda-nodo (`table.props.rows[j][i]` de tipo nodo) declara `visibility` con `row.$index` se acepta en bootstrap.
- Un layout con una `table` en modo manual cuya celda es un valor primitivo (`string`/`number`/`boolean`) no dispara ninguna evaluación de `visibility` (no hay nodo con `visibility` en esa celda), y otro nodo hermano fuera de la `table` con `visibility` `row.*` sigue siendo rechazado.
- Un layout con una `table` dinámica anidada dentro de un `repeater`: dentro de una celda-nodo, un nodo con `visibility: 'row.status'` se acepta (`insideTableCell: true` sobrevive al `repeater`). Fuera de la celda pero dentro del `repeater`, un nodo con `visibility: 'row.status'` se rechaza (`insideTableCell: false`).
- Grupo compuesto: un nodo fuera de celda-nodo con `visibility: { operator: 'and', conditions: [{ reference: 'row.status', operator: 'equals', value: 'active' }, { reference: 'forms.filters.active', operator: 'isTruthy' }] }` es rechazado por bootstrap y la ruta señala `visibility.conditions[0].reference`. Un test simétrico donde `row.*` está en `conditions[1]` señala `visibility.conditions[1].reference`.
- Grupo compuesto dentro de una celda-nodo con dos condiciones ambas `row.*` (`row.status`, `row.priority`) se acepta en bootstrap.
- La propia `table.visibility` con `reference: 'row.status'` declarada en el nodo `table` (no en una de sus celdas) se rechaza en bootstrap: la `table` misma no está dentro de sí misma. Cubre el criterio de que `table.visibility` toma el flag del contexto padre.
- `queryStateFeedback.states.error.fallback[0]` de un nodo fuera de cualquier `table`: si un nodo del fallback declara `visibility: 'row.status'`, se rechaza (el fallback vive fuera de una celda de `table`). Simétrico dentro de una celda-nodo: se acepta.
- Regresión: casos existentes en el fichero con `item.*`, `forms.*`, `queries.*`, `params.*` en `visibility` fuera de `table` siguen aceptándose (T2 no restringe otras familias).
- Regresión: los casos de T1 sobre shape de `row.*` (ejemplos ya cubiertos por T1 pero declarados fuera de una `table`) ahora deben resultar en rechazo por scope; T1 los declaraba explícitamente como "shape válido"; T2 refactoriza aquellos casos que estaban aceptándose por shape y ahora deben rechazarse por scope, y los tests que en T1 verificaban aceptación fuera de `table` **deben moverse a esta tarea T2** y actualizarse para verificar rechazo por scope. Los casos T1 que ya declaraban shape inválido (`row.$key`, `row.$index.algo`, etc.) siguen igual.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-visibility.test.ts
```

**Restricciones:**
- Añadir los casos nuevos en un `describe` propio (`'row.* visibility scope'` o análogo), separado del bloque de shape (`'row.* references in visibility shape'`) que aportó T1. La refactorización descrita en el último bullet de "Comportamiento cubierto" — mover los casos "aceptado por shape fuera de `table`" de T1 al bloque de scope de T2 y convertirlos en "rechazado por scope" — debe hacerse en un único commit junto al cambio de código de T2, para no dejar un estado intermedio con tests inconsistentes con la implementación real.
- Los tests deben ejercitar `validateRuntimeConfig` como extremo público, no llamar directamente a `validateRowVisibilityScope`. Esto garantiza que el orden y la integración con las demás pasadas (`validateModalReferences`, `validateGroupsConfig`, etc.) también se ejercita.
- No añadir tests que verifiquen el comportamiento en `dev-editor` (fuera de alcance según la spec y esta tarea).
- No añadir tests de comportamiento runtime en este fichero: la resolución de `row.*` en `visibility` en runtime la valida T3 desde `src/tests/runtime/runtime-layout-visibility.test.ts` y desde `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx`.

---

## T3. Verificar en runtime el comportamiento de `row.*` en `visibility` y en `button.props.checked` (variante `switch`) dentro de celdas-nodo de `table`

### Objetivo
Cubrir con tests el comportamiento observable ya habilitado por la combinación de T1+T2 (aceptación bootstrap) y la feature previa `table-row-references` T2/T3 (resolución runtime de `row.*`/`row.$index` contra `iterationContext.row`/`iterationContext.rowIndex` ya propagado por `table-layout-node.tsx`). Esta tarea no espera modificaciones de código en `src/runtime/`: si durante la implementación se descubre un hueco de wiring runtime (extremadamente improbable dado el precedente), se corrige aquí y se anota como hallazgo, pero el punto de partida es que:
- `matchesVisibilityRule` (`src/runtime/runtime-layout-visibility.ts`) ya usa `resolveRuntimeReference` con `iterationContext`, así que `visibility.reference: 'row.*'` resuelve sin cambios adicionales una vez el shape se acepta en bootstrap.
- `resolveButtonSwitchChecked` (`src/runtime/nodes/button-layout-node.tsx`) ya usa `resolveRuntimeValueWithOptions(checkedProp, state, { iterationContext })`, que internamente delega en `resolveRuntimeReference` con la misma habilitación de `allowRowReference` cuando `iterationContext !== undefined`; por tanto `checked: 'row.*'` resuelve el dato de fila sin cambios.
- `table-layout-node.tsx` ya construye `rowIterationContext` con `row` (solo en modo dinámico) y `rowIndex` 1-based (siempre en Fase B), y lo propaga a los nodos anidados de cada celda-nodo, incluida la propagación del `iterationContext` ambiental de un `repeater` ancestro.

### Fuera de alcance
- No se toca `parseRuntimeReference`, `resolveRuntimeReference`, `resolveRuntimeValueWithOptions`, `matchesVisibilityRule`, `resolveButtonSwitchChecked` ni `table-layout-node.tsx`, salvo el escenario improbable de descubrir un bug de wiring durante la implementación.
- No se toca el editor de desarrollo.
- No se modifican tests de la feature previa `table-row-references`.
- No se cubren aquí escenarios de `submitAction.onSuccess[*].when`, `pages[].preloads[*].when` ni `button.props.action.operations[*].when` con `row.*`: la spec los excluye explícitamente.

### Dependencias
T1 y T2 (sin las dos, un layout de test con `row.*` fuera/dentro de celda de `table` no llegaría al render).

### Interfaces
**Consume:**
- `validateRowVisibilityScope(config: RuntimeConfig): { status: 'error'; error: RuntimeConfigError } | null` (de T2, indirectamente vía `validateRuntimeConfig`).
- Ampliación de shape aceptado por `isValidVisibilityReference` (de T1, indirectamente vía `validateRuntimeConfig`).

**Produce:** ninguno.

### Impacto esperado en archivos
- Código: ninguno esperado. Si durante la implementación se detecta un bug de wiring, corregirlo en el fichero afectado (`src/runtime/nodes/button-layout-node.tsx` o `src/runtime/nodes/table-layout-node.tsx`) es aceptable como parte del cierre de esta tarea; documentar el hallazgo brevemente en el commit.
- Tests:
  - `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
  - `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (ampliación)
  - `src/tests/runtime/runtime-switch-control.test.tsx` (ampliación)
- Documentación afectada:
  - `ai-workflow/docs/app-features/references/visibility.md` (recogida final del catálogo de referencias admitidas por `visibility` con `row.*`/`row.$index` y su frontera de scope — puede coordinarse con T2, pero el comportamiento observable end-to-end queda cubierto solo tras T3).
  - `ai-workflow/docs/app-features/references/reference-resolution.md` (revisión final de "Frontera específica de `row.*`" para incluir `visibility.reference` y `button.props.checked` con `variant: 'switch'` como superficies admitidas; ajuste puntual de "Frontera específica de `row.$index`" para las mismas dos superficies).
  - `ai-workflow/docs/app-features/nodes/button.md` (ampliar la frontera de `props.checked` en variante `switch` de `item.*, queries.*, forms.*, params.*` a `item.*, queries.*, forms.*, params.*, row.*` cuando el `button` vive dentro de una celda-nodo de `table`; incluir la nota de degradación en modo manual para `row.*` sin `.$index`).

### Tests
**Ficheros de test:**
- `src/tests/runtime/runtime-layout-visibility.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (ampliación)
- `src/tests/runtime/runtime-switch-control.test.tsx` (ampliación)

**Comportamiento cubierto:**

Los casos siguientes se distribuyen por fichero según cercanía temática: `runtime-layout-visibility.test.ts` para la unidad de evaluación (`matchesVisibilityRule` sobre condiciones aisladas con `iterationContext`), `layout-renderer-table-rich-cells.test.tsx` para escenarios end-to-end de tabla con visibility declarada en nodos de celdas, `runtime-switch-control.test.tsx` para el switch con `checked: 'row.*'`.

En `src/tests/runtime/runtime-layout-visibility.test.ts` (unidad de evaluación con `iterationContext` que incluye `row`/`rowIndex`):
- Condición simple `{ reference: 'row.status', operator: 'equals', value: 'active' }` evaluada con `iterationContext: { row: { status: 'active' }, rowIndex: 1 }` coincide (mostrar).
- La misma condición evaluada con `iterationContext: { row: { status: 'archived' }, rowIndex: 1 }` no coincide (ocultar).
- La misma condición evaluada con `iterationContext: undefined` degrada a "referencia ausente" (`isFalsy` verdadero, resto sin match) — mismo criterio que ya cubre `item.*` sin `repeater` en este fichero.
- Condición `{ reference: 'row.$index', operator: 'lessThan', value: 4 }` con `iterationContext: { row: {}, rowIndex: 3 }` coincide.
- Grupo `{ operator: 'and', conditions: [{ reference: 'row.status', operator: 'equals', value: 'active' }, { reference: 'forms.filters.active', operator: 'isTruthy' }] }` con `iterationContext: { row: { status: 'active' } }` y `state.forms.filters.active === true`, coincide.
- Grupo `{ operator: 'or', conditions: [{ reference: 'row.priority', operator: 'greaterThan', value: 3 }, { reference: 'queries.overrideVisible.data', operator: 'isTruthy' }] }` con `row.priority === 5` y `queries.overrideVisible.data` ausente, coincide.
- Condición con `iterationContext` mixto `{ item: { name: 'Repeater item' }, itemIndex: 0, row: { name: 'Row data' }, rowIndex: 2 }`: `reference: 'row.name'` coincide con `'Row data'` y `reference: 'item.name'` coincide con `'Repeater item'`, sin sombra mutua (test simétrico ya cubierto a nivel de resolver por la feature previa; aquí se valida a nivel de `matchesVisibilityRule` para blindar la composición en la superficie de visibility).

En `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (end-to-end):
- Una `table` dinámica sirviendo tres filas con `status: 'active' | 'archived' | 'active'` y una celda-nodo `container` con hijos donde uno de los hijos declara `visibility: { reference: 'row.status', operator: 'equals', value: 'active' }`: el nodo aparece en las filas 1 y 3, no en la 2. Renderizar y verificar por `screen.getAllByText`/`queryAllByText` u homólogo ya usado en este fichero.
- La misma `table` con una celda-nodo declarando `visibility: { reference: 'row.$index', operator: 'lessThan', value: 3 }`: el nodo aparece en las filas 1 y 2, no en la 3.
- Aplicar filtro por columna sobre la misma tabla: `row.$index` se recontabiliza de forma contigua sobre las filas restantes (mismo criterio ya cubierto por la feature previa a nivel de `table-layout-node.tsx`; aquí se verifica desde la superficie `visibility`).
- Una `table` dinámica anidada dentro de un `repeater` con dos filas y `item.ownerName` interpolado en una celda string: dentro de una celda-nodo, un nodo con grupo `visibility: { operator: 'and', conditions: [{ reference: 'row.status', operator: 'equals', value: 'active' }, { reference: 'item.canEdit', operator: 'isTruthy' }] }` aparece solo cuando la fila propia está `active` **y** el `item` del `repeater` tiene `canEdit: true`, sin sombra mutua entre `row.*` e `item.*`.
- Una `table` dinámica en la que la propia `table` declara `visibility: { reference: 'queries.tableVisible.data', operator: 'isTruthy' }` sigue funcionando (la `table.visibility` no depende de contexto de fila; regresión positiva).
- En modo manual, una celda-nodo con `visibility: { reference: 'row.$index', operator: 'equals', value: 1 }` aparece solo en la primera fila renderizada. La misma celda-nodo con `visibility: { reference: 'row.status', operator: 'equals', value: 'active' }` no aparece en ninguna fila (en modo manual `row` sin `.$index` degrada a ausente, coincide con `isFalsy` verdadero pero no con `equals`).

En `src/tests/runtime/runtime-switch-control.test.tsx` (switch con checked dinámico):
- Un `button` con `variant: 'switch'`, `checked: 'row.isPrimary'`, en una celda-nodo de una `table` dinámica de tres filas con `isPrimary: true | false | true` refleja `aria-checked` según cada fila y recalcula tras cambios de fuente (mismo criterio de recalculo por render ya cubierto para `item.*`).
- El mismo botón dentro de una `table` en modo manual con `checked: 'row.$index'`: `aria-checked` toma el valor boolean derivado del entero de fila (`row.$index === 1` es truthy, valor no estrictamente `true`/`false`, mismo criterio ya vigente para cualquier valor no boolean resuelto por una referencia en `checked`).
- El mismo botón dentro de una `table` en modo manual con `checked: 'row.isPrimary'` (sin `.$index`): `aria-checked="false"` en todas las filas (degradación a `false` documentada por la spec).
- Un `button` switch con `checked: 'row.isPrimary'` y `action: { type: 'executeOperation', operationName: X, body: { isPrimary: 'switch.next' } }` en una celda-nodo dinámica: un click envía en el body la negación del valor de fila (`switch.next` sigue funcionando sin cambios cuando `checked` usa `row.*`). El test mockea el fetch y comprueba el body de la petición.
- Un `button` switch con `checked: 'row.isPrimary'` en una celda-nodo de una `table` dinámica anidada dentro de un `repeater`, cuya celda hermana tiene un nodo texto que interpola `{{item.ownerName}}`: la fila resuelve `row.isPrimary` contra la fila propia y `item.ownerName` contra el item del `repeater` ancestro sin sombra mutua (criterio de composición principal de la spec, verificado desde la superficie `checked`).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-layout-visibility.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx
pnpm test --run src/tests/runtime/runtime-switch-control.test.tsx
```

**Restricciones:**
- Añadir los casos nuevos como `describe` propios (`'row.* references'` en `runtime-layout-visibility.test.ts`; `'visibility with row.* in table cells'` en `layout-renderer-table-rich-cells.test.tsx`; `'switch checked with row.*'` en `runtime-switch-control.test.tsx`) sin modificar los bloques existentes.
- Reutilizar los helpers y fixtures ya existentes en cada fichero (constructor de `iterationContext`, builders de `table` dinámicos/manuales, wrappers de renderizado) — no introducir un harness paralelo.
- Al cerrar la tarea, ejecutar además la suite completa (`pnpm test`) para confirmar que el umbral global de cobertura del 80% sobre `src/` se mantiene y que ningún test pre-existente regresa.
- Si durante la implementación se detecta que el switch no propaga correctamente `iterationContext` con `row` en algún camino (extremadamente improbable dado el precedente cerrado por `table-row-references` T3), corregir directamente en el fichero afectado como parte de esta tarea y añadir el test que lo demuestra; no crear una tarea T4 para ese ajuste.

---

## Cierre de implementación (cada tarea)
Cada tarea (T1, T2, T3) se considera cerrada en su implementación cuando:
- el código descrito en su "Objetivo" está implementado literalmente como se describe (o de forma funcionalmente equivalente si el subagente encuentra una formulación más idiomática del mismo comportamiento, sin desviarse del contrato de Interfaces),
- todos los tests listados en su sub-bloque `tests` están escritos y en verde,
- los comandos de test de la tarea (y, en T3, la suite completa `pnpm test`) pasan sin regresiones,
- no queda ningún test antiguo de la feature ejercitando `row.*` en `visibility` fuera de una celda de `table` con expectativa de aceptación (los movidos de T1 a T2 pasan a esperar rechazo por scope; ninguno permanece en un limbo).
