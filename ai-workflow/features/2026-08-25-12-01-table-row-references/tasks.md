# Tasks: table-row-references

## Orden de ejecución
T1 → T2 → T3, estrictamente secuencial. Ninguna tarea es paralelizable con otra: T2 consume el contrato de sintaxis que produce T1, y T3 consume el `RuntimeIterationContext` ampliado que produce T2.

Siguiente tarea a escoger tras cerrar esta planificación: **T1**.

---

## T1. Registrar el namespace `row` en la sintaxis neutral de referencias

### Objetivo
Extender `src/config/runtime-reference-syntax.ts` para reconocer `row` como namespace de referencia, con el mismo patrón condicional que ya existe para `item` (`allowItemReference` → `allowRowReference`), y con una única forma sintética soportada: `row.$index` (sin equivalente a `item.$key`, decisión D3 de `design.md`).

Cambios exactos a introducir en el fichero:
- `RuntimeReferenceNamespace`: añadir `'row'` a la unión de tipos.
- `RuntimeSupportedReference['namespace']`: añadir `'row'`.
- `RuntimeUnsupportedReference['namespace']`: añadir `'row'`.
- `REFERENCE_PATTERN`: añadir `row` a la alternancia de namespaces reconocidos en el regex.
- Nueva constante `ROW_INDEX_SYNTHETIC_SEGMENT = '$index'`, análoga a `ITEM_INDEX_SYNTHETIC_SEGMENT` pero declarada por separado (no reutilizar la constante de `item`, son conceptos distintos aunque compartan el literal).
- `hasRecognizedNamespace`: añadir `namespace === 'row'` a la disyunción.
- `hasValidReferenceShape`:
  - añadir un pre-chequeo sintético análogo al de `item.$key`/`item.$index`, colocado en el mismo punto (antes del filtro genérico `path.some(...)` que rechaza segmentos con `$`): `if (namespace === 'row' && path.length === 1 && path[0] === ROW_INDEX_SYNTHETIC_SEGMENT) { return true }`.
  - añadir `case 'row': return path.length >= 0` al `switch`, en el mismo estilo que `case 'item'`.
- `ParseRuntimeReferenceOptions`: añadir `allowRowReference?: boolean`.
- `parseRuntimeReference`: añadir un bloque `if (namespace === 'row') { ... }` inmediatamente después del bloque existente `if (namespace === 'item') { ... }`, con la misma estructura: si `options.allowRowReference` es `true`, devolver `status: 'supported'`; si no, `status: 'unsupported'`. En ambos casos `namespace`/`path`/`source` se propagan igual que en el bloque de `item`.

### Fuera de alcance
- No se toca ningún validador de `src/config/` fuera de `runtime-reference-syntax.ts` (confirmado en `design.md`, decisión D5: ninguna celda de `table` pasa por `parseRuntimeReference` en bootstrap).
- No se añade `row.$key` ni ninguna otra forma sintética para `row` (decisión D3).
- No se modifica `src/runtime/runtime-references/runtime-reference-resolver.ts` (eso es T2).
- No se modifica ningún nodo del runtime.

### Dependencias
Ninguna. Es la tarea base de la feature.

### Interfaces
**Consume:** ninguno.

**Produce:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean }): RuntimeReferenceParseResult` — consumido por: T2

### Impacto esperado en archivos
- Código: `src/config/runtime-reference-syntax.ts` (modificación).
- Tests: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Documentación a revisar: `ai-workflow/docs/app-features/references/reference-resolution.md` (sección "Catálogo de referencias soportadas": añadir `row`, `row.{segmentosAnidados}`, `row.$index`; el detalle funcional completo de fronteras se documenta al cierre de T3, cuando el comportamiento observable ya existe).

### Tests
**Ficheros de test:**
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)

**Comportamiento cubierto:**
- `parseRuntimeReference('row')` y `parseRuntimeReference('row.slug')` sin `allowRowReference` clasifican como `status: 'unsupported'`, `namespace: 'row'`.
- `parseRuntimeReference('row', { allowRowReference: true })` clasifica como `status: 'supported'`, `namespace: 'row'`, `path: []`.
- `parseRuntimeReference('row.slug', { allowRowReference: true })`, `parseRuntimeReference('row.meta.author.name', { allowRowReference: true })` y `parseRuntimeReference('row.tags.0', { allowRowReference: true })` clasifican como `status: 'supported'` con el `path` de segmentos correspondiente.
- `parseRuntimeReference('row.$index', { allowRowReference: true })` clasifica como `status: 'supported'`, `path: ['$index']`.
- `parseRuntimeReference('row.$index')` (sin `allowRowReference`) clasifica como `status: 'unsupported'`.
- `parseRuntimeReference('row.$index.algo', { allowRowReference: true })`, `parseRuntimeReference('row.algo.$index', { allowRowReference: true })`, `parseRuntimeReference('row.$key', { allowRowReference: true })` y `parseRuntimeReference('row.$other', { allowRowReference: true })` clasifican todos como `status: 'invalid'` (ninguna variante con `$` distinta del literal exacto `$index` es válida; `row.$key` no existe como forma sintética por D3).
- `parseRuntimeReference('\\row.slug')` se conserva como literal escapado (`kind: 'literal'`, `value: 'row.slug'`).
- Un string sin `{{...}}` que no empieza por `row` (p. ej. `'User: row.slug'`) se clasifica como literal, no como referencia.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
```

**Restricciones:**
- Añadir los casos nuevos como un `describe` propio (p. ej. `'row reference parser contract'`) siguiendo el mismo estilo que el bloque existente `'T0024-02 item reference parser contract'`, sin modificar los casos existentes de `item`, `forms`, `queries`, `params`, `translations`, `tokens`.

---

## T2. Ampliar `RuntimeIterationContext` y resolver `row`/`row.$index` contra el estado en vivo

### Objetivo
En `src/runtime/runtime-references/runtime-reference-resolver.ts`:
1. Ampliar la interfaz `RuntimeIterationContext` para que `item`, `key` e `itemIndex` pasen de obligatorios a opcionales, y añadir dos campos hermanos nuevos:
   ```
   export interface RuntimeIterationContext {
     item?: unknown
     key?: string
     itemKey?: string
     itemIndex?: number
     row?: unknown
     rowIndex?: number
   }
   ```
2. En `resolveRuntimeReference`, actualizar la llamada a `parseRuntimeReference` para pasar también `allowRowReference`, con la misma condición que ya usa `allowItemReference`:
   ```
   const parsedReference = parseRuntimeReference(value, {
     allowItemReference: options.iterationContext !== undefined,
     allowRowReference: options.iterationContext !== undefined,
   })
   ```
3. En `resolveSupportedReferenceValue`, añadir un nuevo bloque `if (reference.namespace === 'row') { ... }`, colocado inmediatamente después del bloque existente `if (reference.namespace === 'item') { ... }`, con la misma estructura que ese bloque:
   - si `reference.path.length === 1 && reference.path[0] === '$index'`: devolver `{ found: true, value: iterationContext.rowIndex }` cuando `iterationContext?.rowIndex !== undefined`, si no `{ found: false }`.
   - en cualquier otro caso: `return resolveNestedReferenceValue(iterationContext?.row, reference.path)`.

No es necesario modificar `resolveRuntimeVisibleValue`, `resolveRuntimeInterpolatedVisibleValue` ni ninguna otra función pública del fichero: todas ya operan sobre `resolveRuntimeReference`/`resolveSupportedReferenceValue` de forma genérica por `status`, sin ramificar por namespace.

### Fuera de alcance
- No se modifica ningún nodo del runtime (`src/runtime/nodes/`); eso es T3.
- No se modifica `runtime-reference-diagnostics.ts` (no distingue por namespace, solo por `status`; confirmado en `design.md`).
- No se decide aquí cómo `table-layout-node.tsx` construye el contexto compuesto; solo se deja disponible el tipo y la resolución que T3 va a consumir.

### Dependencias
T1 (consume `parseRuntimeReference` con la opción `allowRowReference` y el namespace `'row'` ya reconocido).

### Interfaces
**Consume:**
- `parseRuntimeReference(value: string, options?: { allowItemReference?: boolean; allowRowReference?: boolean }): RuntimeReferenceParseResult` (de T1)

**Produce:**
- `interface RuntimeIterationContext { item?: unknown; key?: string; itemKey?: string; itemIndex?: number; row?: unknown; rowIndex?: number }` — consumido por: T3

### Impacto esperado en archivos
- Código: `src/runtime/runtime-references/runtime-reference-resolver.ts` (modificación).
- Tests: `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación).
- Documentación a revisar: `ai-workflow/docs/app-features/references/reference-resolution.md` (aún no la frontera completa; solo si esta tarea, aislada, cambia algo observable — no lo hace hasta que T3 exista, así que en la práctica el contenido documental real se escribe al cierre de T3; declarar aquí `ninguno` sería inexacto porque el tipo es público dentro del dominio runtime, así que se deja listado por completitud sin exigir edición efectiva en esta tarea).

### Tests
**Ficheros de test:**
- `src/tests/runtime/runtime-reference-resolution.test.tsx` (ampliación)

**Comportamiento cubierto:**
- `resolveRuntimeReference('row.slug', state, { iterationContext: { row: { slug: 'abc' } } })` resuelve `status: 'resolved'`, `value: 'abc'`.
- `resolveRuntimeReference('row.meta.author.name', state, { iterationContext: { row: { meta: { author: { name: 'Ada' } } } } })` navega segmentos anidados igual que `item.*` (objetos y arrays, índice numérico solo sobre array).
- `resolveRuntimeReference('row.$index', state, { iterationContext: { rowIndex: 3 } })` resuelve `status: 'resolved'`, `value: 3`.
- `resolveRuntimeReference('row.$index', state, { iterationContext: { row: {} } })` (sin `rowIndex`) resuelve `status: 'missing'`.
- `resolveRuntimeReference('row', state)` (sin `iterationContext`) resuelve `status: 'unsupported'`.
- Con un `iterationContext` que combina ambos grupos — `{ item: { name: 'Repeater item' }, key: 'k', itemIndex: 0, row: { name: 'Row data' }, rowIndex: 1 }` — `resolveRuntimeReference('item.name', ...)` y `resolveRuntimeReference('row.name', ...)` resuelven cada uno su propio valor sin que ninguno sombree al otro (prueba directa del criterio de aceptación de composición simultánea).
- `row.$index` tiene precedencia sobre una propiedad literal `$index` dentro del valor de `row`: con `iterationContext: { row: { $index: 'internal' }, rowIndex: 5 }`, `row.$index` resuelve a `5`, y `row.name`/navegación normal sigue accediendo al valor interno del objeto `row` sin interferencia (test análogo al existente de precedencia de `item.$key`/`item.$index`).
- `resolveRuntimeVisibleValue('Fila {{row.$index}}: {{row.name}}', state, 'table.cell', { iterationContext: { row: { name: 'Ada' }, rowIndex: 2 } })` interpola ambos placeholders en el mismo string.
- Un `iterationContext` que solo trae `rowIndex` (sin `row`, representando modo manual): `row.$index` resuelve correctamente y `row.algo` (navegación de datos) resuelve `status: 'missing'` y degrada a `''` en `resolveRuntimeVisibleValue`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-reference-resolution.test.tsx
```

**Restricciones:**
- Añadir los casos nuevos en un `describe` propio de resolución de `row` (paralelo al bloque `'T0007-02 store-backed resolution'`/al bloque de resolución de `item.$key`/`item.$index`), sin tocar los casos existentes.
- Tras el cambio de tipo de `RuntimeIterationContext` (campos `item`/`key`/`itemIndex` ahora opcionales), ejecutar también como regresión — sin modificarlos — los siguientes ficheros de test, que son los consumidores existentes más expuestos al ensanchamiento del tipo: `src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx`, `src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx`, `src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx`, `src/tests/layout-renderer/layout-renderer-modal-repeater.test.tsx`, `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx`, `src/tests/runtime-state/runtime-state-modal.test.tsx`. Si alguno falla por el ensanchamiento de tipo, es una regresión real de esta tarea y debe corregirse aquí, no diferirse a T3.

---

## T3. Componer el contexto de fila de `table` en vez de sustituirlo, y exponer `row`/`row.$index`

### Objetivo
Modificar `src/runtime/nodes/table-layout-node.tsx` para que, en los tres puntos donde hoy se construye o usa un contexto de iteración para resolver celdas, el contexto ambiental recibido como prop (`iterationContext`) se **componga** (spread) en vez de **sustituirse**, añadiendo `row` (solo en modo dinámico) y `rowIndex` (siempre, 1-based, derivado de la posición final dentro de `visibleRows`).

Punto de partida técnico obligatorio — el pipeline local de `table` (`processTableRows` en `runtime-table-processing.ts`) filtra y ordena sobre el **valor de celda ya resuelto como string**, y ese pipeline no se modifica (fuera de alcance de la spec). Esto significa que la resolución de celdas string ocurre hoy en dos momentos lógicos distintos que hay que mantener separados:
- **Fase A** (dentro de `resolveTableRows`, antes de filtrar/ordenar/paginar): produce el valor usado como clave de comparación de filtro/orden. No conoce todavía la posición final visible de la fila.
- **Fase B** (dentro del `.map` sobre `visibleRows`, ya después de aplicar filtro + orden + paginación): es el único punto donde se conoce la posición final 1-based de cada fila.

`row.$index` solo puede ser correcto si se resuelve en Fase B. Por tanto, las celdas string deben **resolverse dos veces**: una en Fase A (con `row.$index` degradando a vacío, usada solo como clave de filtro/orden — comportamiento no cubierto por los criterios de aceptación de la spec y aceptado como está) y otra en Fase B (con el `rowIndex` final correcto, usada para lo que realmente se renderiza). Las celdas-nodo no necesitan doble resolución: ya se renderizan de forma perezosa en Fase B a través de `LayoutNodeRenderer`.

Cambios exactos:

1. **Modo dinámico, Fase A** (`resolveTableRows`, rama dinámica, dentro de `dynamicRows.cells.map`): sustituir
   ```
   iterationContext: {
     item,
     key: String(rowIndex),
     itemIndex: rowIndex,
   },
   ```
   por
   ```
   iterationContext: {
     ...iterationContext,
     row: item,
   },
   ```
   (`iterationContext` aquí es el parámetro ambiental recibido por `resolveTableRows`, no una variable nueva). No se añade `rowIndex` en esta fase.

2. **Modo manual, Fase A**: no requiere cambio de código — la llamada actual `resolveRuntimeVisibleValue(cell, state, 'table.cell', { iterationContext })` ya reenvía el contexto ambiental sin sustituirlo. Verificar que sigue así (no tocar).

3. **Fase B** (dentro del `.map` sobre `visibleRows`, construcción de `rowIterationContext`): sustituir
   ```
   const rowItem = rowItemMap.get(row)
   const rowIterationContext: RuntimeIterationContext | undefined =
     rowItem !== undefined ? { item: rowItem, key: String(rowIndex), itemIndex: rowIndex } : undefined
   ```
   por
   ```
   const rowItem = rowItemMap.get(row)
   const rowIterationContext: RuntimeIterationContext = {
     ...iterationContext,
     ...(rowItem !== undefined ? { row: rowItem } : {}),
     rowIndex: rowIndex + 1,
   }
   ```
   `rowIterationContext` deja de ser `| undefined`: ahora siempre existe (aunque `iterationContext` ambiental sea `undefined`, el spread produce como mínimo `{ rowIndex }`). `row` solo está presente cuando `rowItemMap` tiene entrada para esa fila (modo dinámico); en modo manual `rowItemMap` sigue vacío, así que `row` está ausente y solo viaja `rowIndex` (más el resto del contexto ambiental heredado, que ahora sí llega también a las celdas-nodo en modo manual).

4. **Fase B, celdas string**: la rama actual que renderiza directamente `cell` (el valor ya resuelto en Fase A) para celdas que no son `TableCellNode` debe sustituirse por una resolución adicional que use `rowIterationContext` (el de Fase B, con `rowIndex` correcto):
   - obtener la plantilla cruda de la celda (no el valor ya resuelto en Fase A):
     - modo manual: `(node.props.rows as TableCellValue[][])[rowOriginalIndexMap.get(row)!][cellIndex]`.
     - modo dinámico: `(node.props.rows as TableDynamicRows).cells[cellIndex]`.
   - si esa plantilla cruda es un `string`, resolverla con `resolveRuntimeVisibleValue(rawCell, state, 'table.cell', { iterationContext: rowIterationContext })` y normalizar con `normalizeTableCellValue`, exactamente igual que en Fase A.
   - si la plantilla cruda no es `string` (`number`/`boolean`, solo posible en modo manual), no hay referencia que resolver: mantener el valor ya normalizado de Fase A (`cell`) sin cambios.
   - el resultado sustituye a `cell` como contenido a renderizar en la celda de texto.

5. No se modifica `src/runtime/runtime-table-processing.ts` bajo ningún concepto: `filterTableRows`, `sortTableRows` y `processTableRows` siguen operando exactamente igual que hoy, sobre los valores resueltos en Fase A.

### Fuera de alcance
- No se modifica `runtime-table-processing.ts`, `runtime-collection-sources.ts` ni `runtime-collection-pagination.ts`.
- No se modifica `props.rows.source` ni su resolución (`resolveCollectionSourceItems` sigue recibiendo el `iterationContext` ambiental de `TableNode`, sin cambios — sigue resolviendo `item.*` como el item del `repeater` ambiental).
- No se modifica `repeater-layout-node.tsx`, `layout-renderer.tsx`, `layout-node-renderer.tsx` ni ningún otro nodo del runtime: todos siguen reenviando `iterationContext` sin cambios porque `item` y `row` ahora conviven en el mismo objeto.
- No se modifica el editor de desarrollo (selección/edición visual de celdas de tabla) más allá de lo que ya funciona hoy con `iterationContext`/paths; si algún test de `layout-canvas`/`layout-node-renderer-edit-mode` falla por el ensanchamiento de tipo, es responsabilidad de T2, no de esta tarea (ya cubierto como regresión en T2).

### Dependencias
T2 (consume `RuntimeIterationContext` con los campos `row`/`rowIndex` y `item`/`key`/`itemIndex` opcionales).

### Interfaces
**Consume:**
- `interface RuntimeIterationContext { item?: unknown; key?: string; itemKey?: string; itemIndex?: number; row?: unknown; rowIndex?: number }` (de T2)

**Produce:** ninguno.

### Impacto esperado en archivos
- Código: `src/runtime/nodes/table-layout-node.tsx` (modificación).
- Tests:
  - `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (ampliación)
  - `src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx` (ampliación)
  - `src/tests/layout-renderer/layout-renderer-image-table.test.tsx` (ampliación)
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/table.md` (contrato de celdas, "Reglas de render": `item.*` deja de ser contexto de fila; se documenta `row.*`/`row.$index`; ambiente `item.*` del `repeater` ancestro preservado en ambos modos).
  - `ai-workflow/docs/app-features/references/reference-resolution.md` (secciones nuevas "Frontera específica de `row.*`" y "Frontera específica de `row.$index`"; ajuste de "Frontera específica de `item.*`" para excluir el contexto de fila de `table`).
  - `ai-workflow/docs/app-features/references/dynamic-strings.md` (superficies de celdas de `table`: mencionar `row.*`/`row.$index` junto a `item.*`).
  - `ai-workflow/docs/app-features/queries/state-model.md` (ajustar la frase "en proyecciones interpoladas de colecciones, `item.*` apunta al item local de cada entrada, opción o fila" para diferenciar el caso de `table`, donde el contexto de fila propio es `row.*`).

### Tests
**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx` (ampliación)
- `src/tests/layout-renderer/layout-renderer-image-table.test.tsx` (ampliación)

**Comportamiento cubierto:**
- Migración obligatoria de fixtures existentes que usaban `item.*` como contexto de fila propio de `table` (comportamiento retirado intencionalmente, sin retrocompatibilidad):
  - en `layout-renderer-table-rich-cells.test.tsx`: los tests que usan `'item.name'`, `'item.avatar'`, `'item.id'` como celda de `rows.cells` (dynamic mode, fuera de un `repeater`) deben renombrarse a `'row.name'`, `'row.avatar'`, `'row.id'` para seguir aportando cobertura real (con el código nuevo, dejarlos como `item.*` haría que esas celdas degradasen a vacío y el test dejaría de validar nada).
  - en `layout-renderer-table-pagination.test.tsx`: en las dos tablas dinámicas anidadas en `repeater` con `cells: ['item.name']` / `cells: ['item.name', 'item.role']`, renombrar esas entradas de `cells` a `row.name`/`row.role` (el `source: 'item.members'` de esas mismas tablas NO se toca: sigue siendo la familia `item.*` de `rows.source`, no de fila).
- Una `table` dinámica anidada dentro de un `repeater`, con una celda-nodo y una celda string que referencian en el mismo string interpolado `item.algo` (del `repeater` ancestro) y `row.algo` (de la fila de la tabla), muestra ambos valores correctamente a la vez (criterio de aceptación principal de la spec).
- Una `table` dinámica sin `repeater` ancestro: una celda que referencia `item.algo` degrada a vacío; una celda que referencia `row.algo` en la misma tabla resuelve con normalidad.
- Una `table` anidada en un `repeater` cuya fuente es un objeto plano: `item.$key` sigue accesible sin cambios dentro de las celdas de esa `table`.
- Un `container` anidado recursivamente dentro de una celda-nodo propaga tanto `row` como `row.$index` a la misma profundidad que hoy propaga `item`.
- Una celda-nodo con `visibility` oculta o `queryStateFeedback` en estado oculto renderiza vacía sin romper la fila, tanto si referencia `row.*` como si referencia `item.*` del `repeater` ancestro.
- En modo manual, dentro de un `repeater`, una celda-nodo (p. ej. `button`) que referencia `item.*` del `repeater` ancestro lo resuelve correctamente (regresión positiva del efecto colateral necesario descrito en `design.md` D4: hoy se pierde, con este cambio debe mantenerse) — en `layout-renderer-table-rich-cells.test.tsx`.
- Una `table` en modo manual con una celda-nodo que interpola `{{row.$index}}` muestra el número de fila 1-based correcto; una celda-nodo en modo manual que intente navegar `row.algo` degrada a vacío — en `layout-renderer-image-table.test.tsx`.
- Una `table` en modo manual con una celda string literal que interpola `{{row.$index}}` (sin `repeater` ancestro) muestra el número de fila 1-based correcto — en `layout-renderer-image-table.test.tsx`.
- `table.props.rows.source: 'item.*'` sigue funcionando exactamente igual que antes del cambio (verificar sobre un test ya existente en `layout-renderer-table-pagination.test.tsx`, sin necesidad de un caso nuevo si la migración de `cells` de esa tarea ya lo ejercita).
- Con paginación local activa (`previousNext`/`numbered`), `row.$index` en una celda string y en una celda-nodo muestra la posición 1-based dentro de la página actualmente visible, no la posición en el array completo de filas — en `layout-renderer-table-pagination.test.tsx`.
- Con paginación `scroll` (ventana acumulada), `row.$index` refleja la posición dentro de la ventana acumulada visible en cada momento, no solo la de la última página cargada — en `layout-renderer-table-pagination.test.tsx`.
- Aplicar un filtro que excluye filas recalcula `row.$index` de las filas restantes de forma contigua (1, 2, 3…) sobre el subconjunto visible, sin huecos — en `layout-renderer-table-rich-cells.test.tsx` (fichero que ya cubre filtros/ordenación de `table`).
- Cambiar la ordenación de una columna `sortable` recalcula `row.$index` reflejando el nuevo orden visible — en `layout-renderer-table-rich-cells.test.tsx`.
- `row.$index` no colisiona con una propiedad literal `$index` dentro del dato de la fila (mismo criterio de precedencia que `item.$index`; puede reutilizar el caso ya cubierto a nivel de resolver en T2, aquí basta con una verificación end-to-end mínima si no está ya cubierta indirectamente por otro caso de esta lista).

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-image-table.test.tsx
```

**Restricciones:**
- No modificar `src/tests/layout-renderer/layout-renderer-table-edit-mode.test.tsx`: sus aserciones actuales sobre `data-node-path` no dependen del valor resuelto de la celda string `'item.name'` de su fixture `buildDynamicTableNode`, así que no hay assertion que romper: no es necesario tocarlo para esta tarea, aunque su fixture reutilice literalmente el string `'item.name'` como contenido de celda no verificado.
- No introducir memoización adicional (`useMemo`) para la resolución de Fase B: el `.map` sobre `visibleRows` en el JSX ya se recalcula en cada render igual que hoy: mantener el mismo estilo.
- Al cerrar esta tarea, ejecutar además la suite completa (`pnpm test`) para confirmar que el umbral global de cobertura del 80% sobre `src/` se mantiene, dado que esta tarea concentra la mayor superficie de comportamiento nuevo de la feature.

---

## Cierre de implementación (cada tarea)
Cada tarea (T1, T2, T3) se considera cerrada en su implementación cuando:
- el código descrito en su "Objetivo" está implementado literalmente como se describe (o de forma funcionalmente equivalente si el subagente de implementación encuentra una formulación más idiomática del mismo comportamiento, sin desviarse del contrato de Interfaces),
- todos los tests listados en su sub-bloque `tests` están escritos y en verde,
- los comandos de test de la tarea (y, en T3, la suite completa `pnpm test`) pasan sin regresiones en los ficheros de regresión señalados,
- no queda ninguna referencia a `item.*` como contexto de fila propio de `table` en los ficheros de test tocados por la feature (salvo el caso explícitamente excluido en las restricciones de T3).
