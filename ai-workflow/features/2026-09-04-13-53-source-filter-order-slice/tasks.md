# Tasks — Pipeline declarativo de filtro, orden y slice sobre colecciones de origen

Contrato de ejecución basado en `spec.md` y `design.md` de esta misma feature.
El orden es estricto: cada tarea depende explícitamente de las anteriores.

Cierre documental: fuera del alcance de este `tasks.md` (se ejecutará después con
`update-app-documentation`). Cada tarea lista qué fichas se verán afectadas para
que esa pasada posterior las cubra.

---

## T1 — Parser de sintaxis del pipeline (`runtime-collection-pipeline-syntax.ts`)

### Objetivo
Crear un módulo neutral en `src/config/` que separa la referencia base del sufijo
de pipeline y devuelve una estructura discriminada consumible tanto por la
validación de bootstrap (T2) como por la evaluación en runtime (T3).

Es solo parseo puro: no resuelve referencias dinámicas, no toca el store, no
emite errores con mensaje — el consumidor decide qué hacer ante `'malformed'`.

### Fuera de alcance
- Cualquier resolución contra estado (`queries.*`/`forms.*`/`params.*`).
- Cualquier cambio en validadores existentes (`validate-*.ts`) — es T2.
- Cualquier evaluación de operaciones sobre colecciones — es T3.
- Mensajes de error de validación (los construye T2 usando `invalidLayout`).

### Dependencias
Ninguna previa dentro de esta feature.

### Interfaces
- **Consume**: ninguno.
- **Produce**:
  - `` `parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource` `` — consumido por: T2, T3, T4, T5, T6.
  - `` `type CollectionPipelineFilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in'` `` — consumido por: T3.
  - `` `type CollectionPipelineFilterArgument = { kind: 'literal'; value: string | number } | { kind: 'reference'; reference: string } | { kind: 'list-literal'; values: Array<string | number | boolean> } | { kind: 'list-reference'; reference: string }` `` — consumido por: T3.
  - `` `type CollectionPipelineStage = { op: 'orderby'; path: string; dir: 'asc' | 'desc' } | { op: 'filter'; path: string; operator: CollectionPipelineFilterOperator; value: CollectionPipelineFilterArgument } | { op: 'slice'; start: number; end: number }` `` — consumido por: T2, T3, T4, T5, T6.
  - `` `type ParsedCollectionPipelineSource = { status: 'no-pipeline'; baseReference: string } | { status: 'ok'; baseReference: string; stages: CollectionPipelineStage[] } | { status: 'malformed' }` `` — consumido por: T2, T3, T4, T5, T6.

### Impacto esperado en archivos
- Código a crear:
  - `src/config/runtime-collection-pipeline-syntax.ts`
- Código a modificar: ninguno.
- Tests a crear:
  - `src/tests/runtime/runtime-collection-pipeline-syntax.test.ts`
- Documentación a revisar:
  - `ai-workflow/docs/test-index.md` (añadir entrada del nuevo fichero de test bajo `runtime/`).

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-collection-pipeline-syntax.test.ts` (nuevo)

#### Comportamiento cubierto
- Un `raw` sin `|` (por ejemplo `"queries.products.data"`) devuelve `{ status: 'no-pipeline', baseReference: 'queries.products.data' }` verbatim, sin normalizar espacios ni tocar la referencia.
- Un `raw` con un único stage `orderby:price,desc` devuelve `status: 'ok'`, `baseReference` correcto y un solo `stage` con `op: 'orderby'`, `path: 'price'`, `dir: 'desc'`.
- Un `raw` con `orderby:price,asc` o `orderby:price,desc` acepta ambos valores; cualquier otro `dir` (`ASC`, `up`, ausente) devuelve `status: 'malformed'`.
- Un `raw` con `filter:status,eq,"pending"` devuelve un stage con `operator: 'eq'` y `value: { kind: 'literal', value: 'pending' }`.
- Un `raw` con `filter:price,gt,10` devuelve `value: { kind: 'literal', value: 10 }` (numérico, no string).
- Un `raw` con `filter:status,eq,forms.searchForm.status` devuelve `value: { kind: 'reference', reference: 'forms.searchForm.status' }`.
- Un `raw` con `filter:role,in,["admin","editor"]` devuelve `value: { kind: 'list-literal', values: ['admin','editor'] }`.
- Un `raw` con `filter:priority,in,[1,2,3]` devuelve `value: { kind: 'list-literal', values: [1,2,3] }` (numéricos).
- Un `raw` con `filter:role,in,forms.filters.selectedRoles` devuelve `value: { kind: 'list-reference', reference: 'forms.filters.selectedRoles' }`.
- Los ocho operadores del catálogo (`eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`) se reconocen; cualquier otro (`equals`, `==`, `like`, `regex`) devuelve `status: 'malformed'`.
- Un `raw` con `slice:0,10` devuelve un stage con `op: 'slice'`, `start: 0`, `end: 10`. Índices negativos (`slice:-5,-1`) se admiten como enteros negativos.
- Un `raw` con varios `|` (`queries.products.data | orderby:price,desc | slice:0,10 | filter:status,eq,"pending"`) devuelve los stages en el mismo orden en que aparecen.
- Los espacios alrededor de `|` y `,` fuera de literales entrecomillados se ignoran (mismo criterio que `runtime-formatter-parser`).
- Los caracteres `|` y `,` dentro de un literal string entre comillas dobles (`filter:name,eq,"a|b,c"`) no rompen el tokenizado.
- Los caracteres `|` y `,` dentro de una lista literal `[...]` (`filter:role,in,["a|b","c,d"]`) no rompen el tokenizado.
- Una lista literal `[...]` como tercer argumento de un operador distinto de `in` (`filter:role,eq,["a","b"]`) devuelve `status: 'malformed'`.
- Un operador `in` sin lista (`filter:role,in,"admin"`) es válido y produce `value: { kind: 'literal', value: 'admin' }` (una referencia string se trata como candidato único; ver semántica de evaluación en T3).
- Una lista literal mal formada (sin cerrar `[`, coma final, `[,]`) devuelve `status: 'malformed'`.
- Un nombre de operación desconocido (`sort:...`, `where:...`) devuelve `status: 'malformed'`.
- Un número incorrecto de argumentos por operación (`orderby:price`, `filter:status,eq`, `slice:0`, `slice:0,10,20`) devuelve `status: 'malformed'`.
- Un argumento sin cerrar comillas (`filter:name,eq,"unfinished`) devuelve `status: 'malformed'`.
- Un `slice` con argumentos no numéricos (`slice:a,b`, `slice:"0","10"`) devuelve `status: 'malformed'`.
- Un `raw` que empieza directamente por `|` (`| orderby:price,asc`) devuelve `status: 'malformed'` (falta `baseReference`).
- Un `raw` vacío o solo espacios devuelve `status: 'malformed'`.

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline-syntax.test.ts`

#### Restricciones
- No importar nada de `src/runtime/`: el módulo vive en `src/config/` y debe ser puramente neutral (mismo criterio que `runtime-reference-syntax.ts`).
- No usar `Zod`: el parser expone su unión discriminada directamente.

### Documentación afectada
- `ai-workflow/docs/app-features/references/index.md` (añadir referencia al nuevo sub-doc del pipeline; cierre documental posterior).
- `ai-workflow/docs/app-features/references/` — sub-documento nuevo a crear en pasada documental posterior.
- `ai-workflow/docs/architecture.md` (posible mención al nuevo módulo `src/config/runtime-collection-pipeline-syntax.ts` como punto de extensión; cierre documental posterior).
- `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `runtime/`).

### Criterios de finalización
- `parseCollectionPipelineSource` cubre los tres estados del contrato (`no-pipeline`, `ok`, `malformed`) sin sesgo hacia ninguno.
- La firma exportada y las cuatro type-aliases quedan disponibles para T2 y T3 sin ajustes adicionales.
- Todos los tests del fichero pasan en verde.

### Cierre de implementación
- `src/config/runtime-collection-pipeline-syntax.ts` creado con las exports firmadas.
- `src/tests/runtime/runtime-collection-pipeline-syntax.test.ts` creado y en verde.
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline-syntax.test.ts` verde.
- `pnpm test` global sigue verde y no rompe el umbral de cobertura global (`≥ 80%` sobre `src/`).

---

## T2 — Validación de bootstrap con `allowPipeline` opt-in

### Objetivo
Extender `validateCollectionSource` con una opción `allowPipeline?: boolean`
(default `false`) que, cuando está activa, parsea el `source` completo con
`parseCollectionPipelineSource`, valida la `baseReference` con la lógica ya
existente (`isValidCollectionSourceReference`) y valida la forma de cada
`stage` (nombre de operación, número/shape de argumentos, `dir`, operadores del
catálogo de `filter`, lista literal solo en `filter:...,in,...`).

Activar `allowPipeline: true` exclusivamente en los cuatro call sites de las
seis superficies en alcance de esta feature:
- `validate-repeater-node.ts` (repeater)
- `validate-heading-paragraph-list-nodes.ts` (list)
- `validate-table-node.ts` (rows dinámico)
- `validate-form-choice-items.ts` (select/radioGroup/checkboxGroup)

Los call sites de `validate-gallery-node.ts`, `validate-map-node.ts` y
`validate-form-nodes.ts` (autocomplete) **no** activan la opción y siguen
validando solo la referencia completa, sin aceptar `|`.

### Fuera de alcance
- Evaluación del pipeline en runtime (es T3).
- Integración en `resolveCollectionSourceItems` o `resolveRepeaterSourceItems` (es T4/T5/T6).
- Modificar el shape de los tipos de nodo (`RepeaterLayoutNode`, `TableLayoutNode`, etc.): `source` sigue siendo `string`. El AST parseado no se persiste (D1 del design).
- Cambiar el shape aceptado por `validateCollectionSource` para las tres superficies fuera de alcance (gallery, map, autocomplete).

### Dependencias
- T1 completa.

### Interfaces
- **Consume** (de T1):
  - `` `parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource` ``
  - `` `type ParsedCollectionPipelineSource = { status: 'no-pipeline'; baseReference: string } | { status: 'ok'; baseReference: string; stages: CollectionPipelineStage[] } | { status: 'malformed' }` ``
  - `` `type CollectionPipelineStage = { op: 'orderby'; path: string; dir: 'asc' | 'desc' } | { op: 'filter'; path: string; operator: CollectionPipelineFilterOperator; value: CollectionPipelineFilterArgument } | { op: 'slice'; start: number; end: number }` ``
- **Produce**: ninguna firma reutilizada por otras tareas (los cambios son internos a la validación de bootstrap).

### Impacto esperado en archivos
- Código a modificar:
  - `src/config/validate-collection-source.ts` (añade opción `allowPipeline`; nueva rama que llama a `parseCollectionPipelineSource` y valida stages).
  - `src/config/validate-repeater-node.ts` (pasar `allowPipeline: true` al llamar a `validateCollectionSource` sobre `props.items.source`).
  - `src/config/validate-heading-paragraph-list-nodes.ts` (pasar `allowPipeline: true` sobre `list.props.items.source`).
  - `src/config/validate-table-node.ts` (pasar `allowPipeline: true` sobre `props.rows.source` en modo dinámico).
  - `src/config/validate-form-choice-items.ts` (pasar `allowPipeline: true` sobre `select`/`radioGroup`/`checkboxGroup` `props.items.source`).
- Código a NO modificar (verificar explícitamente):
  - `src/config/validate-gallery-node.ts`
  - `src/config/validate-map-node.ts`
  - `src/config/validate-form-nodes.ts` (la parte que valida `autocomplete.props.items.source`).
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación: aceptación de `source` con pipeline en las cuatro superficies; rechazo en gallery/map/autocomplete; rechazo de errores de forma).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/config/validation.md` (nueva regla sobre `|` en las seis superficies en alcance; cierre documental posterior).
  - `ai-workflow/docs/app-features/references/index.md` (referencia al nuevo sub-doc; cierre documental posterior).
  - `ai-workflow/docs/app-features/nodes/repeater.md`, `nodes/table.md`, `nodes/select.md`, `nodes/choice-groups.md`, `nodes/heading-paragraph-list.md` (cierre documental posterior).

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-collections.test.ts` (ampliación)

#### Comportamiento cubierto
- Con `allowPipeline: false` (default), un `source` con `|` sigue rechazándose exactamente como hoy (regresión: el comportamiento previo no cambia).
- Con `allowPipeline: true` en las cuatro superficies del alcance:
  - Un `source` sin `|` (`queries.products.data`) sigue aceptándose (regresión).
  - Un `source` con pipeline bien formado (`queries.products.data | orderby:price,desc | slice:0,10`) se acepta.
  - Un `source` con `baseReference` inválida para la superficie (por ejemplo `params.something | orderby:x,asc` en `repeater.props.items.source`, donde `params.*` sigue fuera de alcance) se rechaza con `invalid-layout` y ruta al `source` afectado — el pipeline no amplía qué `baseReference` es válida por superficie.
  - Un `source` con `status: 'malformed'` se rechaza con `invalid-layout` y ruta al `source` afectado, cubriendo al menos: operación desconocida (`| sort:x`), `dir` inválido (`orderby:x,up`), número de args incorrecto (`filter:status,eq`), operador desconocido (`filter:status,unknown-op,"x"`), lista literal fuera de `in` (`filter:role,eq,["a","b"]`), lista mal formada (`filter:role,in,[`).
  - El mensaje de error para stages malformados incluye la misma ruta base (`path`) que ya emite `validateCollectionSource` para `baseReference` inválida, sin introducir una ruta JSON más profunda.
- En las tres superficies fuera del alcance (gallery, map, autocomplete):
  - Un `source` con `|` se rechaza con el mismo error que produce hoy `validateCollectionSource` para un shape no reconocido; el pipeline no se acepta silenciosamente.
- Aceptación de argumentos de `filter`:
  - Literal escalar entrecomillado (`filter:status,eq,"pending"`) — válido.
  - Literal numérico (`filter:price,gt,10`) — válido.
  - Referencia dinámica completa a `forms.*`/`params.*`/`queries.*` como valor (`filter:status,eq,forms.searchForm.status`) — válida como forma; la resolución en runtime se cubre en T3.
  - Referencia con `item.*`/`row.*` como valor (`filter:status,eq,item.currentStatus`) — la validación de bootstrap la deja pasar como shape "referencia completa"; el bloqueo semántico se produce en runtime al no pasar `iterationContext` al resolver (ver T3). Esta tarea solo debe cubrir shape, no bloqueo semántico de familia.
  - Lista literal (`filter:role,in,["admin","editor"]`) — válida solo con `in`.
  - Referencia a array (`filter:role,in,forms.filters.selectedRoles`) — válida solo con `in`.

#### Comandos durante la implementación
- `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts`
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline-syntax.test.ts` (regresión de T1 al añadir tests que ejerciten el parser desde bootstrap)

#### Restricciones
- Reutilizar `invalidLayout(...)` con la misma ruta que ya recibe `validateCollectionSource`. No introducir un formato de mensaje nuevo.
- No añadir claves nuevas al shape de los tipos de nodo (`source` sigue siendo `string`).

### Documentación afectada
- `ai-workflow/docs/app-features/config/validation.md`
- `ai-workflow/docs/app-features/references/` (sub-doc nuevo del pipeline en pasada documental posterior)
- `ai-workflow/docs/app-features/nodes/repeater.md`
- `ai-workflow/docs/app-features/nodes/table.md`
- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`
- `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`

### Criterios de finalización
- `validateCollectionSource` acepta la nueva opción `allowPipeline` con default `false`/ausente.
- Los cuatro call sites en alcance la pasan explícitamente; los tres fuera de alcance no.
- Todos los tests ampliados en `runtime-config-validation-collections.test.ts` pasan en verde.
- Ningún test previo de validación se rompe (regresión).

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts` verde.
- `pnpm test` global verde con cobertura global `≥ 80%`.

---

## T3 — Evaluador `runtime-collection-pipeline.ts`

### Objetivo
Crear un módulo runtime que evalúa el pipeline sobre una colección ya
resuelta a array: aplica en orden cada `stage` (`orderby`, `filter`, `slice`),
resolviendo referencias dinámicas de argumentos vía `resolveRuntimeReference`
**sin pasar `iterationContext`** (bloquea `item.*`/`row.*` automáticamente
degradándolos a `unsupported`, según el propio resolver).

Incluye la semántica de degradación runtime exigida por la spec:
- valor dinámico ausente en un `filter` → ese `filter` no se aplica (pasa todo).
- `path` inexistente o tipo incompatible en un `filter` → item excluido.
- `path` inexistente o tipo incompatible en `orderby` → valor mínimo estable.
- `contains` sobre string usa `normalizeTableSearchText` (case/tilde-insensitive).
- `contains` sobre array usa igualdad estricta contra elementos.
- `Array.prototype.sort` nativo (estable) para encadenar `orderby` (D5).
- `slice` con semántica de `Array.prototype.slice`.

### Fuera de alcance
- Cualquier parseo de sintaxis: T1 ya devuelve `CollectionPipelineStage[]`.
- Cualquier consumidor concreto (`resolveCollectionSourceItems` en T4/T5,
  `resolveRepeaterSourceItems` en T6).
- Diagnóstico visible al usuario: la degradación es silenciosa por diseño (spec).

### Dependencias
- T1 completa (necesita las type-aliases del stage).

### Interfaces
- **Consume** (de T1):
  - `` `type CollectionPipelineStage = { op: 'orderby'; path: string; dir: 'asc' | 'desc' } | { op: 'filter'; path: string; operator: CollectionPipelineFilterOperator; value: CollectionPipelineFilterArgument } | { op: 'slice'; start: number; end: number }` ``
  - `` `type CollectionPipelineFilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in'` ``
  - `` `type CollectionPipelineFilterArgument = { kind: 'literal'; value: string | number } | { kind: 'reference'; reference: string } | { kind: 'list-literal'; values: Array<string | number | boolean> } | { kind: 'list-reference'; reference: string }` ``
- **Produce**:
  - `` `evaluateCollectionPipeline(items: unknown[], stages: CollectionPipelineStage[], state: RuntimeState): unknown[]` `` — consumido por: T4, T5, T6.

### Impacto esperado en archivos
- Código a crear:
  - `src/runtime/runtime-references/runtime-collection-pipeline.ts`
- Código a modificar: ninguno.
- Tests a crear:
  - `src/tests/runtime/runtime-collection-pipeline.test.ts`
- Documentación a revisar:
  - `ai-workflow/docs/test-index.md` (añadir entrada del nuevo fichero de test).

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-collection-pipeline.test.ts` (nuevo)

#### Comportamiento cubierto
- `stages: []` devuelve el mismo array de entrada sin mutarlo.
- Entrada no-array (aunque la firma sea `unknown[]`, comprobar defensivamente `null`/`undefined`) devuelve `[]` (mismo criterio que ya aplica `resolveCollectionSourceItems`).
- `orderby:price,asc` sobre objetos con `price` numérico ordena ascendente estable.
- `orderby:price,desc` invierte el orden.
- `orderby:nested.field,asc` navega segmentos anidados con la misma semántica que el resto del runtime (segmento numérico = índice solo si valor actual es array).
- `orderby:missing,asc` — items sin ese campo aparecen primero en `asc` (valor mínimo estable), al final en `desc`, y su orden relativo entre sí se preserva.
- Cadena `orderby:a,asc | orderby:b,desc` produce ordenación multi-clave estable: `b desc` como criterio principal, `a asc` como desempate — apoyándose en la estabilidad garantizada por `Array.prototype.sort` (D5).
- `filter:status,eq,"pending"` con literal string conserva solo los items con `status === 'pending'`.
- `filter:price,gt,10` compara numéricamente; un item con `price` no numérico se excluye (no-match, no rompe la ejecución).
- `filter:name,contains,"al"` (case/tilde-insensitive) matchea `"Álvaro"`, `"alba"`, `"CÁRDENAS"` sin distinción de mayúsculas ni tildes — reutiliza `normalizeTableSearchText` verbatim y no re-implementa la normalización NFD.
- `filter:tags,contains,"news"` con `tags` array matchea items que contienen el elemento `"news"`.
- `filter:role,in,["admin","editor"]` conserva items con `role` en el conjunto.
- `filter:role,in,forms.filters.selectedRoles` con un `state` que resuelve `forms.filters.selectedRoles` a `["admin"]` filtra usando ese conjunto reactivo.
- `filter:role,in,forms.filters.selectedRoles` con `forms.filters.selectedRoles` no resuelto o no-array se trata como conjunto vacío (ningún item coincide, todos excluidos).
- `filter:role,in,"admin"` (literal escalar único, sin forma de lista, como permite T1 para `in`) se trata como candidato único: conserva solo los items con `role === 'admin'`.
- `filter:status,eq,forms.searchForm.status` con `forms.searchForm.status = ''` (o `undefined`, o la referencia sin resolver) **no aplica el filtro**: todos los items pasan (spec: "valor dinámico ausente").
- `filter:status,eq,item.currentStatus` (referencia con `item.*` como valor) se trata como no resoluble (`item.*` está bloqueado al no pasar `iterationContext`) y por tanto ese `filter` no aplica (mismo camino que "valor dinámico ausente").
- `filter:missing,eq,"x"` — item cuyo `missing` no existe queda excluido (no-match).
- Varios `filter` encadenados combinan en `AND`: un item debe pasar todos.
- `slice:0,10` recorta los primeros 10; con menos de 10 items devuelve la colección entera sin lanzar.
- `slice:-3,-1` con semántica `Array.prototype.slice`: penúltimos dos items.
- `slice:100,200` fuera de rango devuelve `[]` sin lanzar.
- Cadena mixta `orderby:price,desc | filter:status,eq,"pending" | slice:0,5` aplica los tres en el orden declarado.
- Cada operación se aplica exactamente una vez (asegurar que no hay pasos redundantes; el requisito no funcional de la spec exige coste proporcional).
- El evaluador no muta la colección de entrada (comprobar identidad del array recibido tras la llamada).

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline.test.ts`

#### Restricciones
- Reutilizar `resolveRuntimeReference` de `src/runtime/runtime-references/runtime-reference-resolver.ts` para resolver args dinámicos (`kind: 'reference'` y `kind: 'list-reference'`), invocado **sin `iterationContext`**.
- Reutilizar `normalizeTableSearchText` de `src/runtime/runtime-table-processing.ts` para `contains` sobre string — no reimplementar la normalización.
- No introducir listeners, efectos ni cache: función pura sobre `(items, stages, state)`.

### Documentación afectada
- `ai-workflow/docs/app-features/references/` (sub-doc nuevo del pipeline; cierre documental posterior).
- `ai-workflow/docs/test-index.md` (añadir el fichero nuevo).

### Criterios de finalización
- `evaluateCollectionPipeline` cubre los tres tipos de stage con la semántica de degradación completa exigida por la spec.
- Todos los tests del fichero pasan en verde.

### Cierre de implementación
- `src/runtime/runtime-references/runtime-collection-pipeline.ts` creado y con la export firmada.
- `src/tests/runtime/runtime-collection-pipeline.test.ts` creado y en verde.
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline.test.ts` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T4 — Integración en `resolveCollectionSourceItems` (list / select / radioGroup / checkboxGroup)

### Objetivo
Extender `resolveCollectionSourceItems` (`src/runtime/runtime-collection-sources.ts`)
para que:
1. parsee el `source` con `parseCollectionPipelineSource`;
2. resuelva `baseReference` con `resolveRuntimeReference` exactamente como hoy;
3. si el estado del parser es `'ok'`, pase el array resuelto por
   `evaluateCollectionPipeline` antes de devolverlo;
4. si el estado es `'no-pipeline'`, mantenga literalmente el camino previo
   (regresión: comportamiento observablemente idéntico al actual).

Cubre `list`, `select`, `radioGroup` y `checkboxGroup`. `table` también atraviesa
este mismo camino, pero la integración específica con su pipeline nativo se
cubre y verifica en T5. `repeater` no pasa por aquí y se cubre en T6.

### Fuera de alcance
- Cambios en `table-layout-node.tsx` o `runtime-table-processing.ts` (T5).
- Cambios en `repeater-layout-node.tsx` (T6).
- Cambios en validación de bootstrap (T2).

### Dependencias
- T1 completa.
- T2 completa (sin validación de forma en bootstrap, un pipeline malformado nunca debería llegar a runtime; aun así, la rama defensiva `'malformed'` del evaluador degrada a `[]`).
- T3 completa.

### Interfaces
- **Consume** (de T1):
  - `` `parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource` ``
  - `` `type ParsedCollectionPipelineSource = { status: 'no-pipeline'; baseReference: string } | { status: 'ok'; baseReference: string; stages: CollectionPipelineStage[] } | { status: 'malformed' }` ``
- **Consume** (de T3):
  - `` `evaluateCollectionPipeline(items: unknown[], stages: CollectionPipelineStage[], state: RuntimeState): unknown[]` ``
- **Produce**: ninguna firma reutilizada por otras tareas (los cambios son internos al camino de resolución compartido).

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-collection-sources.ts`
- Tests a crear:
  - `src/tests/layout-renderer/layout-renderer-collection-pipeline-shared.test.tsx`
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/select.md`
  - `ai-workflow/docs/app-features/nodes/choice-groups.md`
  - `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `layout-renderer/`).

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-collection-pipeline-shared.test.tsx` (nuevo)

#### Comportamiento cubierto
- **Regresión sin `|`**: un `list.props.items.source` sin pipeline (`queries.items.data`) renderiza exactamente los mismos items que antes de la feature.
- **`list` shape objeto (`itemText`)** con pipeline `queries.orders.data | filter:status,eq,"pending" | orderby:total,desc` renderiza solo los items con `status = 'pending'`, ordenados por `total` descendente.
- **`list` shape escalar** (`itemType: 'scalar'`) con pipeline `queries.tags.data | slice:0,3` renderiza los 3 primeros.
- **`select` dinámico** con `source: 'queries.users.data | filter:role,in,["admin","editor"]'` muestra solo las opciones cuyo `role` está en la lista literal (criterio de aceptación literal de la spec).
- **`radioGroup` dinámico** con pipeline `queries.categories.data | orderby:name,asc` muestra opciones ordenadas alfabéticamente.
- **`checkboxGroup` dinámico** con pipeline `queries.tags.data | filter:featured,eq,true` (donde `true` llega como literal string `"true"` o número; si el operador exige tipo, comprobar el comportamiento de degradación) muestra solo los tags que matchean.
- **Reactividad de arg dinámico** (criterio de aceptación de la spec): un `select` con pipeline `queries.users.data | filter:role,eq,forms.filterForm.role` cambia sus opciones visibles cuando `forms.filterForm.role` cambia, sin acción explícita.
- **Valor dinámico ausente** (criterio de aceptación de la spec): con `forms.filterForm.role = ''`, el filtro no se aplica y se muestran todos los usuarios (el resto del pipeline sigue evaluándose).
- **`baseReference` no-array** (query aún cargando, `null`): la colección devuelta es `[]` y el nodo consumidor degrada silenciosamente (mismo criterio actual del proyecto).
- **Rama defensiva `'malformed'`**: si por alguna vía se cuela un source malformado al runtime (test forzado inyectando en state, no vía config real), degrada a `[]` sin lanzar.

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-shared.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-collection-pipeline.test.ts` (regresión de T3)
- `pnpm test --run src/tests/config-validation/runtime-config-validation-collections.test.ts` (regresión de T2)

#### Restricciones
- Reutilizar el harness de tests de renderer ya usado por `layout-renderer-forms-fields.test.tsx` y `layout-renderer-basic-nodes.test.tsx` para montar `select`/`radioGroup`/`checkboxGroup`/`list` con provider de estado.
- No introducir snapshots (mismo criterio del resto de ficheros de `layout-renderer/`).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/select.md`
- `ai-workflow/docs/app-features/nodes/choice-groups.md`
- `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`
- `ai-workflow/docs/app-features/references/` (sub-doc nuevo del pipeline; cierre documental posterior)
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- `resolveCollectionSourceItems` aplica el pipeline cuando el parser devuelve `'ok'` y conserva la ruta original cuando devuelve `'no-pipeline'`.
- Todos los tests del fichero nuevo pasan en verde.
- Ningún test existente de `list`/`select`/`radioGroup`/`checkboxGroup` se rompe.

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-shared.test.tsx` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T5 — Verificación e integración en `table` (pipeline declarativo + pipeline nativo)

### Objetivo
Habilitar en la práctica el pipeline declarativo en `table.props.rows.source`
(que ya recorre `resolveCollectionSourceItems` en su rama dinámica, línea ~467
de `table-layout-node.tsx` según el design D4) y verificar mediante tests
end-to-end que se cumple el requisito 7 de la spec:

- el pipeline declarativo corre en la Fase A de `resolveTableRows`, antes de
  que `processTableRows` (filtros de columna → orden → paginación) reciba las
  filas;
- los filtros declarativos se combinan en `AND` con los filtros nativos de
  columna;
- el `orderby` declarativo fija el orden por defecto de las filas mientras
  ninguna columna `sortable` tiene un orden activo, y al ciclar la ordenación
  nativa al tercer estado ("sin ordenación") las filas vuelven a mostrarse en
  el orden fijado por el `orderby` declarativo, sin mecanismo adicional de
  memoria.

Tras T4, `table` ya obtiene el pipeline "gratis" en runtime. Esta tarea NO añade
código nuevo en `table-layout-node.tsx` ni en `runtime-table-processing.ts`; su
valor está en fijar el contrato observable con tests explícitos que otras
tareas y features futuras no puedan romper por accidente.

### Fuera de alcance
- Cambiar `runtime-table-processing.ts`.
- Cambiar `table-layout-node.tsx` más allá de lo estrictamente necesario si
  aparece un ajuste puntual imprevisto (documentar en el diff si aparece).
- Cambios sobre `list`/`select`/`radioGroup`/`checkboxGroup` (T4).
- Cambios sobre `repeater` (T6).

### Dependencias
- T1, T2, T3, T4 completas.

### Interfaces
- **Consume** (transitivamente vía T4, sin llamadas directas nuevas):
  - `` `parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource` ``
  - `` `evaluateCollectionPipeline(items: unknown[], stages: CollectionPipelineStage[], state: RuntimeState): unknown[]` ``
- **Produce**: ninguna.

### Impacto esperado en archivos
- Código a modificar: en principio ninguno (verificación). Si aparece un ajuste puntual imprevisto en `src/runtime/nodes/table-layout-node.tsx`, documentarlo en la implementación y limitarlo al mínimo.
- Tests a crear:
  - `src/tests/layout-renderer/layout-renderer-collection-pipeline-table.test.tsx`
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/table.md` (cierre documental posterior)
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `layout-renderer/`)

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-collection-pipeline-table.test.tsx` (nuevo)

#### Comportamiento cubierto
- **Regresión sin `|`**: un `table.props.rows.source` sin pipeline (`queries.orders.data`) renderiza las mismas filas que antes.
- **Pipeline declarativo antes del pipeline nativo**: `queries.orders.data | filter:status,eq,"pending"` muestra solo las filas con `status = 'pending'`, incluso sin filtros ni orden nativos activos (criterio de aceptación literal de la spec).
- **Combinación `AND` con filtro nativo de columna**: con pipeline `filter:status,eq,"pending"` y un filtro nativo activo sobre otra columna (`customerName contains "ana"`), solo se muestran las filas que satisfacen ambos.
- **Orden por defecto por `orderby` declarativo**: con pipeline `orderby:createdAt,desc` y ninguna columna `sortable` activa, las filas visibles respetan ese orden.
- **Ciclo del orden nativo**: activar el orden nativo de una columna `sortable` sustituye el orden visible; ciclar hasta el tercer estado ("sin ordenación") devuelve las filas al orden fijado por `orderby` declarativo, sin necesidad de mecanismo adicional de "recordar" el orden previo.
- **Interacción con paginación local**: pipeline `orderby:total,desc | slice:0,20` combinado con `props.pagination.pageSize: 5` produce 4 páginas de 5 filas (20 filas recortadas por el pipeline), no páginas de la colección completa.
- **`slice` declarativo antes de la paginación nativa** (regresión de la interacción documentada en la spec): la paginación local recibe el resultado ya recortado por `slice`.

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-table.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx` (regresión de paginación)
- `pnpm test --run src/tests/layout-renderer/layout-renderer-table-rich-cells.test.tsx` (regresión de filtros/orden nativos y celdas ricas)

#### Restricciones
- Reutilizar el harness de tests de tabla ya usado por `layout-renderer-table-*.test.tsx` (mismo provider, mismo config helper).
- No añadir mocks del pipeline nativo: el test debe ejercer el flujo real Fase A → Fase B.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/table.md`
- `ai-workflow/docs/app-features/references/` (sub-doc nuevo del pipeline; cierre documental posterior)
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- Los criterios de aceptación relacionados con `table` en la spec quedan cubiertos por tests explícitos.
- No hay ninguna regresión en los ficheros de test previos de `table`.

### Cierre de implementación
- Tests creados y en verde.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-table.test.tsx` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T6 — Integración en `resolveRepeaterSourceItems` (repeater)

### Objetivo
Modificar `resolveRepeaterSourceItems` (en `src/runtime/nodes/repeater-layout-node.tsx`)
para reutilizar la misma orquestación de tres pasos que la del camino compartido
sin pasar por `resolveCollectionSourceItems` (que no distingue shape
array/objeto):

1. parsear el `source` con `parseCollectionPipelineSource`;
2. resolver `baseReference` con `resolveRuntimeReference` exactamente como hoy;
3. si el parser devuelve `'ok'` y la referencia base resuelve a array,
   pasar el array por `evaluateCollectionPipeline` antes de devolverlo;
4. si el parser devuelve `'no-pipeline'`, mantener literalmente el camino actual
   (incluyendo la rama de iteración por objeto plano/diccionario);
5. si el parser devuelve `'ok'` y la referencia base **no** resuelve a array
   (por ejemplo un objeto plano de diccionario), degradar a `[]` — coherente
   con la propia spec: la iteración por diccionario deja de ser alcanzable
   cuando se declara pipeline (D3 del design).

### Fuera de alcance
- Cambios sobre `resolveCollectionSourceItems` (T4).
- Cambios sobre `table` (T5).
- Cambios sobre la validación de bootstrap (T2).

### Dependencias
- T1, T2, T3, T4 completas (T4 no es una dependencia funcional dura, pero
  garantiza que el resto de superficies ya está estabilizado antes de tocar
  `repeater`, que es el nodo con mayor superficie de tests existentes).

### Interfaces
- **Consume** (de T1):
  - `` `parseCollectionPipelineSource(raw: string): ParsedCollectionPipelineSource` ``
  - `` `type ParsedCollectionPipelineSource = { status: 'no-pipeline'; baseReference: string } | { status: 'ok'; baseReference: string; stages: CollectionPipelineStage[] } | { status: 'malformed' }` ``
- **Consume** (de T3):
  - `` `evaluateCollectionPipeline(items: unknown[], stages: CollectionPipelineStage[], state: RuntimeState): unknown[]` ``
- **Produce**: ninguna firma reutilizada por otras tareas.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/nodes/repeater-layout-node.tsx` (`resolveRepeaterSourceItems`)
- Tests a crear:
  - `src/tests/layout-renderer/layout-renderer-collection-pipeline-repeater.test.tsx`
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/repeater.md` (cierre documental posterior)
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `layout-renderer/`)

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-collection-pipeline-repeater.test.tsx` (nuevo)

#### Comportamiento cubierto
- **Regresión sin `|`**: un `repeater.props.items.source` sin pipeline (`queries.products.data`) renderiza exactamente las mismas iteraciones que antes de la feature, incluyendo el caso de fuente objeto plano (iteración por diccionario) y el caso de fuente array (iteración por array).
- **Pipeline sobre fuente array**: `queries.products.data | orderby:price,desc | slice:0,10` renderiza como máximo 10 iteraciones, ordenadas de mayor a menor `price` (criterio de aceptación literal de la spec).
- **Pipeline con `filter`**: `queries.orders.data | filter:status,eq,"pending"` renderiza solo las iteraciones cuyo `status` es `'pending'`.
- **Reactividad de arg dinámico**: `queries.orders.data | filter:status,eq,forms.filterForm.status` re-renderiza el `repeater` cuando `forms.filterForm.status` cambia, sin acción explícita.
- **Valor dinámico ausente**: con `forms.filterForm.status = ''`, el `filter` no se aplica y todas las iteraciones se renderizan.
- **`orderby` con campo inexistente (typo)**: `queries.products.data | orderby:precio,asc` (donde `precio` no existe en algunos items) no rompe el render; los items sin ese campo se ordenan de forma estable como valor mínimo (criterio de aceptación literal de la spec).
- **Pipeline sobre fuente objeto plano**: `queries.registry.data | filter:role,eq,"admin"` con `registry.data` como objeto plano de diccionario degrada a `[]` (la iteración por diccionario ya no es alcanzable cuando se declara pipeline, D3).
- **`baseReference` no-array o no resuelta**: query aún cargando, `null` o `undefined` producen cero iteraciones sin romper el render.
- **Paginación local de `repeater` sobre resultado del pipeline**: `orderby:price,desc | slice:0,20` combinado con `props.pagination.pageSize: 5` produce 4 páginas de 5 iteraciones.
- **`item.$index` sobre resultado del pipeline**: expone la posición dentro de la colección **ya procesada por el pipeline** (no de la colección original antes del pipeline), consistente con el patrón actual (`item.$index` sobre la colección completa que llega al `repeater`).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-repeater.test.tsx`
- `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx` (regresión de iteración básica)
- `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx` (regresión de paginación)
- `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-state.test.tsx` (regresión de resets por colección)

#### Restricciones
- Reutilizar el harness de tests de repeater ya usado por `layout-renderer-repeater-*.test.tsx` (mismo provider, mismo config helper, mismos fixtures de queries).
- No introducir mocks de `resolveRuntimeReference` ni de `evaluateCollectionPipeline`: los tests deben ejercer el flujo real end-to-end.
- No romper la reconciliación por fila del `repeater` (`layout-renderer-repeater-state.test.tsx` cubre esa regresión).

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/repeater.md`
- `ai-workflow/docs/app-features/references/` (sub-doc nuevo del pipeline; cierre documental posterior)
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- `resolveRepeaterSourceItems` aplica el pipeline cuando el parser devuelve `'ok'` y conserva el camino previo (incluida la rama de diccionario) cuando devuelve `'no-pipeline'`.
- Todos los tests del fichero nuevo pasan en verde.
- Ningún test previo de `repeater` se rompe (regresión).

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-collection-pipeline-repeater.test.tsx` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## Orden y siguiente tarea
1. **T1 — Parser** (bloquea T2 y T3).
2. **T2 — Validación bootstrap** (bloquea todo el runtime; un pipeline válido en runtime debe pasar antes por el bootstrap).
3. **T3 — Evaluador** (bloquea T4/T5/T6).
4. **T4 — Integración runtime en superficies compartidas** (`list`/`select`/`radioGroup`/`checkboxGroup`).
5. **T5 — Verificación en `table`** (aprovecha T4; no añade código nuevo salvo ajuste imprevisto).
6. **T6 — Integración runtime en `repeater`** (última porque toca el nodo con mayor superficie de tests existentes y conviene tener el resto de superficies estabilizadas antes).

La siguiente tarea a escoger es **T1**.
