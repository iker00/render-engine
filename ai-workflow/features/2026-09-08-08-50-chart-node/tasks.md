# Tasks — Nodo `chart` (feature 2026-09-08-08-50)

Contrato de ejecución basado en `spec.md` y `design.md` de esta misma feature.
El orden es estricto: cada tarea depende explícitamente de las anteriores.

Cierre documental: fuera del alcance de este `tasks.md`. Se ejecutará después con
`update-app-documentation`; cada tarea lista qué fichas se verán afectadas para
que esa pasada posterior las cubra.

---

## T01 — Tipos y schemas `Zod` del nodo `chart`

### Objetivo
Añadir el shape estructural completo del nodo `chart` al contrato del runtime:
tipos públicos (`ChartLayoutNode`, `ChartVariant`, `ChartHeight`, `ChartColor`,
`ChartStaticCategoricalPoint`, `ChartStaticNumericPoint`,
`ChartCategoricalDynamicSource`, `ChartNumericDynamicSource`) y schemas `Zod`
internos en `runtime-config-zod.ts`, con `type: 'chart'` incorporado al
`discriminatedUnion` de nodos del layout.

El shape debe cubrir literalmente lo fijado en D1 del design:
- `props.variant` obligatorio, cerrado a los seis literales.
- `props.data` (array de puntos) opcional, sin bifurcación de forma en este nivel:
  el schema acepta tanto la forma categórica (`{ category: string; value: number }`)
  como la numérica (`{ x: number; y: number }`) mediante una unión, y la validación
  cruzada por `variant` la aplica T02.
- `props.source` opcional, con dos sub-shapes también unidos: categórica
  (`{ source; category; value }`) y numérica (`{ source; x; y }`), delegando el
  match por variante a T02.
- `props.color` (`neutral|primary|success|warning|danger|info`), `props.height`
  (`sm|md|lg|xl`), `props.label`, `props.xAxisLabel`, `props.yAxisLabel` todos
  opcionales a nivel de schema.
- `children` no admitido a nivel de schema (mismo criterio que `map`/`gallery`).

Esta tarea NO decide reglas cruzadas (`data` xor `source`, familia por variante,
rechazo por variante); todas esas viven en T02.

### Fuera de alcance
- Cualquier regla cruzada entre `variant`/`data`/`source`/`color`/`label`/`xAxisLabel`/`yAxisLabel` (T02).
- Cualquier componente de render (T04).
- Cualquier integración con el editor visual (T05, T06, T07).
- Cualquier resolutor runtime de puntos (T03).

### Dependencias
Ninguna previa dentro de esta feature.

### Interfaces
- **Consume**: ninguno.
- **Produce**:
  - `` `type ChartVariant = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'` `` — consumido por: T02, T03, T04, T05, T06, T07.
  - `` `type ChartHeight = 'sm' | 'md' | 'lg' | 'xl'` `` — consumido por: T04, T07.
  - `` `type ChartColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'` `` — consumido por: T04, T07.
  - `` `type ChartStaticCategoricalPoint = { category: string; value: number }` `` — consumido por: T02, T03, T06, T07.
  - `` `type ChartStaticNumericPoint = { x: number; y: number }` `` — consumido por: T02, T03, T06, T07.
  - `` `type ChartCategoricalDynamicSource = { source: string; category: string; value: string }` `` — consumido por: T02, T03, T06, T07.
  - `` `type ChartNumericDynamicSource = { source: string; x: string; y: string }` `` — consumido por: T02, T03, T06, T07.
  - `` `type ChartLayoutNode = { type: 'chart'; props: { variant: ChartVariant; data?: Array<ChartStaticCategoricalPoint | ChartStaticNumericPoint>; source?: ChartCategoricalDynamicSource | ChartNumericDynamicSource; color?: ChartColor; label?: string; xAxisLabel?: string; yAxisLabel?: string; height?: ChartHeight }; visibility?: unknown; queryStateFeedback?: unknown; layout?: unknown }` `` — consumido por: T02, T03, T04, T05, T06, T07.
  - `` `const chartNodeSchema: ZodType<ChartLayoutNode>` `` (export desde `runtime-config-zod.ts`) — consumido por: T05, T07.

### Impacto esperado en archivos
- Código a crear: ninguno.
- Código a modificar:
  - `src/config/runtime-config-zod.ts` (añadir sub-schemas `chartStaticCategoricalPointSchema`, `chartStaticNumericPointSchema`, `chartCategoricalDynamicSourceSchema`, `chartNumericDynamicSourceSchema`, `chartPropsSchema`, `chartNodeSchema`; añadir `'chart'` al array de nodos soportados y al `discriminatedUnion`).
  - `src/config/runtime-config-types.ts` (exportar `ChartLayoutNode` y los alias asociados; añadir `'chart'` a las uniones existentes de tipos de nodo si aplica).
- Tests a modificar/crear:
  - `src/tests/config-validation/runtime-config-validation-chart.test.ts` (nuevo, cubre esta tarea y T02; en esta tarea solo se ejercen los rechazos de shape estructural).
- Documentación a revisar:
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `config-validation/`).

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-chart.test.ts` (nuevo)

#### Comportamiento cubierto
- `type: 'chart'` con `props.variant: 'bar'` y `props.data: [{ category: 'a', value: 1 }]` se acepta como nodo estructuralmente válido.
- `type: 'chart'` sin `props.variant` se rechaza con `invalid-layout` sobre `{path}.props.variant`.
- `type: 'chart'` con `props.variant` fuera de los seis literales (`'radar'`, `'BAR'`, `null`) se rechaza con `invalid-layout` sobre `{path}.props.variant`.
- `type: 'chart'` con `props.height` fuera de `sm|md|lg|xl` se rechaza sobre `{path}.props.height`.
- `type: 'chart'` con `props.color` fuera de la paleta cerrada de seis colores se rechaza sobre `{path}.props.color`.
- `type: 'chart'` con `children` declarado (`children: []`, o con un nodo dentro) se rechaza sobre `{path}.children`.
- `type: 'chart'` con `props.data[i]` con forma no reconocible (por ejemplo `{ foo: 1 }`) se rechaza sobre la ruta exacta del índice.
- `type: 'chart'` con `props.source.source` no string, o `source.category`/`.value`/`.x`/`.y` no string, se rechaza sobre la ruta exacta.
- `type: 'chart'` con `props.label`/`props.xAxisLabel`/`props.yAxisLabel` no string se rechaza sobre la ruta exacta.
- Un `type: 'chart'` con `variant: 'bar'` **sin** `data` ni `source` pasa esta capa (el shape lo permite); el rechazo cruzado lo cubre T02.
- Un `type: 'chart'` con `variant: 'bar'`, `data` categórico y `source` categórico declarados a la vez pasa esta capa; el rechazo cruzado lo cubre T02.
- `type: 'chart'` con `variant: 'scatter'` y `data: [{ x: 1, y: 2 }]` pasa esta capa (shape numérico aceptado por la unión).
- Un `type: 'chart'` con `variant: 'pie'` y `props.color`/`props.label` declarados pasa esta capa (el rechazo cruzado por variante lo cubre T02).

#### Comandos durante la implementación
- `pnpm test --run src/tests/config-validation/runtime-config-validation-chart.test.ts`

#### Restricciones
- Reutilizar la infraestructura de `runtime-config-zod.ts` ya vigente (`invalidLayoutError`, patrones existentes de `discriminatedUnion` de nodo, sub-schemas de `visibility`/`queryStateFeedback`/`layout` compartidos).
- No introducir un fichero paralelo de tipos: los tipos exportables van en `runtime-config-types.ts` y los schemas en `runtime-config-zod.ts`, mismo criterio que `gallery`/`map`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md` (nueva entrada `chart` en la sección "Nodos hoja visibles"; cierre documental posterior).
- `ai-workflow/docs/app-features/nodes/chart.md` (ficha nueva del nodo, en pasada documental posterior).
- `ai-workflow/docs/app-features/config/validation.md` (regla estructural del nodo `chart`; cierre documental posterior).
- `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `config-validation/`).

### Criterios de finalización
- El schema `chartNodeSchema` acepta y rechaza correctamente las formas listadas en "Comportamiento cubierto".
- Los tipos `ChartLayoutNode` y sus alias están disponibles para las tareas siguientes con las firmas literales del sub-bloque `Produce`.
- Ningún test previo de validación se rompe.

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-chart.test.ts` verde.
- `pnpm test` global sigue verde y no rompe el umbral de cobertura global (`≥ 80%` sobre `src/`).

---

## T02 — Validador `validate-chart-node.ts` (reglas cruzadas)

### Objetivo
Crear el módulo `src/config/validate-chart-node.ts` (`validateChartNode`) e
integrarlo en el switch de `validateLayoutNode` dentro de
`src/config/validate-layout-nodes-core.ts` para el `type: 'chart'` (mismo
call site que ya usan `case 'gallery'`/`case 'map'`; `src/config/validate-layout-nodes.ts`
es solo un barrel de re-exports y no contiene el switch de dispatch),
aplicando en este orden las reglas cruzadas fijadas por el design (D2):

1. Selección de familia de forma de dato por `variant`:
   - `bar`/`line`/`area`/`pie`/`donut` → familia **categórica** (`{ category, value }` en `data`; `{ source, category, value }` en `source`).
   - `scatter` → familia **numérica** (`{ x, y }` en `data`; `{ source, x, y }` en `source`).
2. Exclusión mutua estricta: exactamente uno de `props.data`/`props.source` (rechazo si ambos declarados o ninguno; criterio de `gallery`).
3. Match de forma de dato con la familia elegida: si la variante es categórica y `props.data`/`props.source` tiene shape numérico (o viceversa), rechazo sobre la ruta exacta del campo desalineado.
4. Rechazo de `props.color`/`props.label`/`props.xAxisLabel`/`props.yAxisLabel` cuando `variant` es `pie`/`donut`, con diagnóstico sobre la ruta exacta del campo rechazado.
5. Validación de `source.source` reutilizando `validateCollectionSource` con la misma firma que `repeater`/`map`/`gallery` (sin `allowItemReference`, mismo criterio que `map`).
6. Validación de `source.category`/`source.value` (categórica) y `source.x`/`source.y` (numérica) como rutas de proyección relativa al item, reutilizando `isValidCollectionProjectionPath`. `source.category` admite interpolación `{{...}}` como excepción; `source.value`/`source.x`/`source.y` son rutas relativas puras (mismo criterio que `map.markerSources.position.lat`/`.lng`).
7. Rechazo de `children` con `invalid-layout` sobre `{path}.children` (aunque el shape ya lo rechace en T01, mantener el rechazo explícito por si la ruta llega vía cross-check).

### Fuera de alcance
- Cualquier resolución runtime (T03).
- Cualquier render o code-splitting (T04).
- Cualquier integración con el editor visual (T05, T06, T07).
- Cambios sobre `validateCollectionSource` o `isValidCollectionProjectionPath`: se consumen tal cual.

### Dependencias
- T01 completa.

### Interfaces
- **Consume** (de T01):
  - `` `type ChartVariant = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'` ``
  - `` `type ChartLayoutNode = { type: 'chart'; props: { variant: ChartVariant; data?: Array<ChartStaticCategoricalPoint | ChartStaticNumericPoint>; source?: ChartCategoricalDynamicSource | ChartNumericDynamicSource; color?: ChartColor; label?: string; xAxisLabel?: string; yAxisLabel?: string; height?: ChartHeight }; visibility?: unknown; queryStateFeedback?: unknown; layout?: unknown }` ``
- **Produce**:
  - `` `validateChartNode(rawNode: Record<string, unknown>, path: string, pageId: string, breadcrumb: BreadcrumbSegment[] = []): { status: 'ready'; node: ChartLayoutNode } | { status: 'error'; error: RuntimeConfigError }` `` (misma firma posicional que `validateGalleryNode`/`validateMapNode`) — consumido por: `validate-layout-nodes-core.ts` (dentro de esta misma tarea; no consumido por otras tareas de esta feature).

### Impacto esperado en archivos
- Código a crear:
  - `src/config/validate-chart-node.ts`
- Código a modificar:
  - `src/config/validate-layout-nodes-core.ts` (registrar `validateChartNode` en el switch de `validateLayoutNode` para `type: 'chart'`, mismo patrón que las entradas existentes de `case 'gallery'`/`case 'map'`).
- Tests a modificar:
  - `src/tests/config-validation/runtime-config-validation-chart.test.ts` (ampliación: añadir los casos de "Comportamiento cubierto" de esta tarea sobre el mismo fichero creado en T01).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/config/validation.md` (reglas cruzadas de `chart`; cierre documental posterior).
  - `ai-workflow/docs/app-features/nodes/chart.md` (ficha nueva; cierre documental posterior).

### Tests

#### Ficheros de test
- `src/tests/config-validation/runtime-config-validation-chart.test.ts` (ampliación)

#### Comportamiento cubierto
- Un `chart` con `variant: 'bar'` sin `data` ni `source` se rechaza con `invalid-layout` sobre `{path}.props`.
- Un `chart` con `variant: 'bar'` que declara `data` y `source` a la vez se rechaza con `invalid-layout` sobre `{path}.props`.
- Un `chart` con `variant: 'scatter'` y `data: [{ x: 1, y: 2 }]` se acepta; con `data: [{ category: 'a', value: 1 }]` se rechaza sobre la ruta exacta del punto (familia incompatible).
- Un `chart` con `variant: 'bar'` y `data: [{ category: 'a', value: 1 }]` se acepta; con `data: [{ x: 1, y: 2 }]` se rechaza sobre la ruta exacta del punto (familia incompatible).
- Un `chart` con `variant: 'scatter'` y `source: { source: 'queries.q.data', x: 'a', y: 'b' }` se acepta; el mismo `source` con forma categórica (`{ source, category, value }`) se rechaza sobre `{path}.props.source` por familia incompatible.
- Un `chart` con `variant: 'pie'` que declara `props.color` se rechaza con `invalid-layout` sobre `{path}.props.color`.
- Un `chart` con `variant: 'donut'` que declara `props.label` se rechaza con `invalid-layout` sobre `{path}.props.label`.
- Un `chart` con `variant: 'pie'` que declara `props.xAxisLabel` o `props.yAxisLabel` se rechaza sobre la ruta exacta del campo declarado.
- Un `chart` con `variant: 'bar'` que declara `props.color`, `props.label`, `props.xAxisLabel` y `props.yAxisLabel` se acepta.
- Un `chart` con `source.source` fuera del patrón `queries.{queryName}.data(.*)` se rechaza sobre `{path}.props.source.source` (mismo diagnóstico que produce `validateCollectionSource`).
- Un `chart` con `source.category` como interpolación `{{item.name}}` se acepta; el mismo campo vacío o mal formado se rechaza sobre la ruta exacta.
- Un `chart` con `source.value` (o `.x`/`.y`) declarado como interpolación `{{...}}` (no como ruta relativa pura) se rechaza sobre la ruta exacta.
- Un `chart` con `source.value` (o `.x`/`.y`) como ruta relativa vacía o con formato inválido se rechaza sobre la ruta exacta.
- Un `chart` con `children: []` se rechaza sobre `{path}.children`.
- El resto de casos ya cubiertos en T01 (shape puro) sigue pasando (regresión estructural).

#### Comandos durante la implementación
- `pnpm test --run src/tests/config-validation/runtime-config-validation-chart.test.ts`

#### Restricciones
- Reutilizar `validateCollectionSource` sin modificarlo (mismo call site que `validate-map-node.ts`/`validate-gallery-node.ts`).
- Reutilizar `isValidCollectionProjectionPath` sin modificarlo.
- Reutilizar la fachada `invalidLayout(...)` con la ruta canónica exacta descrita por caso; no introducir un formato de mensaje nuevo.
- No añadir claves nuevas al shape de `ChartLayoutNode`: los tipos ya cubren todos los campos.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/chart.md` (ficha nueva; cierre documental posterior).
- `ai-workflow/docs/app-features/config/validation.md` (reglas cruzadas; cierre documental posterior).

### Criterios de finalización
- `validateChartNode` cubre las siete reglas cruzadas listadas en el objetivo.
- La integración con `validate-layout-nodes.ts` dispara el validador para `type: 'chart'` y no altera el flujo del resto de nodos.
- Todos los tests ampliados pasan en verde.

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-chart.test.ts` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T03 — Resolutores runtime de puntos (`runtime-collection-sources.ts`)

### Objetivo
Añadir a `src/runtime/runtime-collection-sources.ts` dos funciones puras
paralelas a `resolveMapMarkerSourceItems`/`resolveGalleryPhotos`:

- `resolveChartCategoricalPoints(source, state, options?)`: consume un
  `ChartCategoricalDynamicSource` ya validado, resuelve la colección con
  `resolveCollectionSourceItems`, navega `source.category`/`source.value` por
  item y devuelve `Array<{ category: string; value: number }>`.
  `category` admite interpolación (mismo mecanismo que `map.markerSources.label`);
  `value` es ruta relativa pura y debe resolver a `number` finito.
- `resolveChartNumericPoints(source, state, options?)`: consume un
  `ChartNumericDynamicSource` ya validado, navega `source.x`/`source.y` por
  item y devuelve `Array<{ x: number; y: number }>`. Ambos son rutas relativas
  puras y ambos deben resolver a `number` finito.

Semántica de degradación exigida por la spec:
- Un item cuyo `category`/`value` (o `x`/`y`) no resuelve a un tipo válido se
  omite en silencio del resultado (sin excepción, sin diagnóstico en producción;
  `console.warn` solo en DEV, mismo criterio que `resolveMapMarkerSourceItems`).
- La colección base no resuelta a array degrada a `[]` sin error (herencia de
  `resolveCollectionSourceItems`).

Las funciones son puras: no mutan la entrada ni el estado; llamadas repetidas
con el mismo estado devuelven resultados equivalentes.

### Fuera de alcance
- Cualquier render (T04).
- Cualquier lógica del origen estático (`props.data`): T04 la consume tal cual
  desde el nodo ya normalizado, sin pasar por esta capa.
- Cualquier integración con el editor visual (T05, T06, T07).

### Dependencias
- T01 completa (tipos de `ChartCategoricalDynamicSource`/`ChartNumericDynamicSource`).

### Interfaces
- **Consume** (de T01):
  - `` `type ChartCategoricalDynamicSource = { source: string; category: string; value: string }` ``
  - `` `type ChartNumericDynamicSource = { source: string; x: string; y: string }` ``
- **Produce**:
  - `` `resolveChartCategoricalPoints(source: ChartCategoricalDynamicSource, state: RuntimeState, options?: { iterationContext?: unknown }): Array<{ category: string; value: number }>` `` — consumido por: T04.
  - `` `resolveChartNumericPoints(source: ChartNumericDynamicSource, state: RuntimeState, options?: { iterationContext?: unknown }): Array<{ x: number; y: number }>` `` — consumido por: T04.

### Impacto esperado en archivos
- Código a modificar:
  - `src/runtime/runtime-collection-sources.ts` (añadir las dos funciones y sus exports).
- Tests a crear:
  - `src/tests/runtime/runtime-chart-collection-sources.test.ts`
- Documentación a revisar:
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `runtime/`).
  - `ai-workflow/docs/architecture.md` (posible mención al nuevo par de resolutores dentro de `runtime-collection-sources`; cierre documental posterior).

### Tests

#### Ficheros de test
- `src/tests/runtime/runtime-chart-collection-sources.test.ts` (nuevo)

#### Comportamiento cubierto
- `resolveChartCategoricalPoints` con `source.source = 'queries.q.data'` que resuelve a `[{ label: 'A', total: 10 }, { label: 'B', total: 5 }]`, `category: 'label'`, `value: 'total'` devuelve `[{ category: 'A', value: 10 }, { category: 'B', value: 5 }]` en el mismo orden.
- `resolveChartCategoricalPoints` con un item cuyo `value` no es numérico (`{ label: 'X', total: 'oops' }`) omite ese item del resultado; el resto se conserva.
- `resolveChartCategoricalPoints` con un item cuyo `category` no resuelve a string omite ese item.
- `resolveChartCategoricalPoints` con `category` como interpolación (`'{{label}}: {{total}}'`) resuelve la interpolación con `item` como `iterationContext` y produce el string interpolado como `category`.
- `resolveChartCategoricalPoints` con `value` declarado como interpolación (`'{{total}}'`) NO admite interpolación: la resolución numérica sigue el patrón puro; comportamiento observable: el item se omite (misma degradación que `map.markerSources.position.lat`). Este caso es un guardarraíl runtime; la validación de bootstrap ya lo rechaza en T02.
- `resolveChartCategoricalPoints` con la colección resuelta a `null`/`undefined`/no-array devuelve `[]` sin lanzar.
- `resolveChartCategoricalPoints` con `NaN`/`Infinity` como `value` omite el item (ninguno es número finito).
- `resolveChartNumericPoints` con colección `[{ a: 1, b: 2 }, { a: 3, b: 4 }]`, `x: 'a'`, `y: 'b'` devuelve `[{ x: 1, y: 2 }, { x: 3, y: 4 }]`.
- `resolveChartNumericPoints` con un item cuyo `x` no es numérico omite el item; el resto se conserva.
- `resolveChartNumericPoints` con un item cuyo `y` es `NaN`/`Infinity` omite el item.
- Ambas funciones no mutan la colección de entrada (comprobar identidad del array devuelto por `state`).
- Ambas funciones, invocadas dos veces con el mismo `state`, devuelven arrays con el mismo contenido.

#### Comandos durante la implementación
- `pnpm test --run src/tests/runtime/runtime-chart-collection-sources.test.ts`

#### Restricciones
- Reutilizar `resolveCollectionSourceItems` para resolver la colección base (mismo patrón que `resolveMapMarkerSourceItems`).
- Reutilizar la utilidad de interpolación ya usada por `resolveMapMarkerSourceItems` para `category` (misma superficie: interpolación con `item` como `iterationContext`), sin re-implementarla localmente.
- No introducir listeners, efectos ni cache: funciones puras sobre `(source, state, options?)`.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/chart.md` (cierre documental posterior).
- `ai-workflow/docs/test-index.md`.
- `ai-workflow/docs/architecture.md` (posible mención al nuevo par de resolutores).

### Criterios de finalización
- `resolveChartCategoricalPoints` y `resolveChartNumericPoints` cubren las semánticas de degradación descritas en el objetivo.
- Todos los tests del fichero pasan en verde.

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/runtime/runtime-chart-collection-sources.test.ts` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T04 — `ChartNode` (render, styling, code-splitting, gate de bundle)

### Objetivo
Materializar el nodo `chart` end-to-end en el runtime real:

1. **Render** — `src/runtime/nodes/chart-layout-node.tsx` (`ChartNode`):
   - Consume el nodo ya validado (`ChartLayoutNode`).
   - Resuelve los puntos:
     - Origen estático (`props.data` presente): consume el array literal ya normalizado; en variantes categóricas devuelve `[{ category, value }]`; en `scatter` devuelve `[{ x, y }]`. Sin filtrado adicional (el shape ya lo garantiza la validación).
     - Origen dinámico (`props.source` presente): en variantes categóricas llama a `resolveChartCategoricalPoints`; en `scatter` llama a `resolveChartNumericPoints` (T03). Ambos con `iterationContext` heredado igual que `map`.
   - Selecciona el renderer por variante mediante un lookup `Record<ChartVariant, ChartVariantRenderer>` en `src/runtime/runtime-node-styling-chart.ts`. `donut` reutiliza el renderer de `pie` con `innerRadius` distinto de `0`.
   - Aplica el color efectivo: en `bar`/`line`/`area`/`scatter`, `props.color` o default `primary`, resuelto a la clase/color CSS a través del helper compartido de la paleta de seis colores. En `pie`/`donut`, asigna un color por porción por ciclo sobre la misma paleta cerrada de seis colores (mismo criterio y mismo orden que `map.markerSources` sin `color` declarado).
   - Aplica la altura: `props.height` o default `md` (mismo catálogo cerrado y misma cascada que `map.props.height`).
   - Muestra `label` como entrada de leyenda y cabecera de tooltip solo si tiene contenido no vacío; muestra `xAxisLabel`/`yAxisLabel` solo si tienen contenido no vacío (todos solo en variantes `bar`/`line`/`area`/`scatter`).
   - Nunca dispara ninguna acción del catálogo al pulsar un punto/barra/porción; tooltip nativo de Recharts activo siempre.
   - `visibility`, `queryStateFeedback` y `layout.span` se resuelven de forma genérica en `LayoutNodeRenderer`, sin lógica propia en `ChartNode`.

2. **Styling helpers** — `src/runtime/runtime-node-styling-chart.ts`:
   - `getChartHeightClassName(height: ChartHeight | undefined): string` (mismo criterio que `getMapHeightClassName`).
   - `getChartSeriesColor(color: ChartColor | undefined): { fill: string; stroke: string }` (o forma equivalente coherente con Recharts) resuelto contra los mismos tokens semánticos que `runtime-node-styling-map.ts`.
   - `getChartCyclicPieColors(count: number): string[]` (paleta cíclica de seis colores).
   - Lookup `chartVariantRenderers: Record<ChartVariant, ChartVariantRenderer>` donde cada entrada resuelve al par `<XChart>`/`<X>` de Recharts correspondiente.

3. **Code-splitting** — `src/runtime/nodes/node-components-map.ts`:
   - Registro dual `eagerMap.chart = ChartNode` (tests) / `lazyMap.chart = React.lazy(() => import('./chart-layout-node').then((m) => ({ default: m.ChartNode })))` (dev/prod), mismo patrón que `map`/`gallery`.
   - Recharts se importa desde `chart-layout-node.tsx` (y solo desde ahí), para que el chunk de `chart` sea el único portador de la dependencia.

4. **Gate de bundle** — ampliar `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` para verificar que un marcador exclusivo de Recharts en el DOM (por ejemplo la clase raíz `recharts-wrapper` o `recharts-responsive-container`) no aparece en el bundle inicial de producción, mismo criterio con el que ya se verifica `leaflet-container`.

5. **Ajuste de `vite.config.ts` — condicional**: como establece D4 y "Riesgos" del design, no se asume a priori que Recharts necesite el mismo ajuste de `build.rollupOptions.treeshake.moduleSideEffects` que `leaflet`. La secuencia de implementación es:
   - Aplicar los pasos 1-4 y ejecutar el gate de bundle.
   - Si el gate pasa sin tocar `vite.config.ts`, dejar la configuración de tree-shaking igual y hacerlo explícito en el commit (una línea de nota).
   - Si el gate falla, añadir `'recharts'` al mismo bloque `treeshake.moduleSideEffects` que ya usa `'leaflet'`, sin cambiar el contrato del gate ni el resto del ajuste. Volver a ejecutar el gate.
   - En ambos casos, dejar solo una de las dos ramas efectiva; no dejar el ajuste "por si acaso" si el gate pasa sin él.

### Fuera de alcance
- Integración con el editor visual (T05, T06, T07).
- Widgets del panel de propiedades (T05, T06, T07).
- Cualquier interactividad de acciones al pulsar puntos (fuera de v1, spec).

### Dependencias
- T01 completa (tipos).
- T02 completa (el render asume un nodo ya validado).
- T03 completa (resolutores dinámicos).

### Interfaces
- **Consume** (de T01):
  - `` `type ChartVariant = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'` ``
  - `` `type ChartHeight = 'sm' | 'md' | 'lg' | 'xl'` ``
  - `` `type ChartColor = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'` ``
  - `` `type ChartLayoutNode = { type: 'chart'; props: { variant: ChartVariant; data?: Array<ChartStaticCategoricalPoint | ChartStaticNumericPoint>; source?: ChartCategoricalDynamicSource | ChartNumericDynamicSource; color?: ChartColor; label?: string; xAxisLabel?: string; yAxisLabel?: string; height?: ChartHeight }; visibility?: unknown; queryStateFeedback?: unknown; layout?: unknown }` ``
- **Consume** (de T03):
  - `` `resolveChartCategoricalPoints(source: ChartCategoricalDynamicSource, state: RuntimeState, options?: { iterationContext?: unknown }): Array<{ category: string; value: number }>` ``
  - `` `resolveChartNumericPoints(source: ChartNumericDynamicSource, state: RuntimeState, options?: { iterationContext?: unknown }): Array<{ x: number; y: number }>` ``
- **Produce**:
  - `` `ChartNode: React.ComponentType<{ node: ChartLayoutNode; iterationContext?: unknown }>` `` — consumido por: T05, T07 (a través del registro central de nodos).
  - `` `getChartHeightClassName(height: ChartHeight | undefined): string` `` — consumido por: sin consumidores directos (interno a la capa de render).
  - `` `getChartSeriesColor(color: ChartColor | undefined): { fill: string; stroke: string }` `` — consumido por: sin consumidores directos.
  - `` `getChartCyclicPieColors(count: number): string[]` `` — consumido por: sin consumidores directos.

### Impacto esperado en archivos
- Código a crear:
  - `src/runtime/nodes/chart-layout-node.tsx`
  - `src/runtime/runtime-node-styling-chart.ts`
- Código a modificar:
  - `src/runtime/nodes/node-components-map.ts` (registro dual `eagerMap`/`lazyMap` para `chart`).
  - `vite.config.ts` — solo si el gate de bundle así lo exige (ver paso 5 del objetivo).
- Tests a crear:
  - `src/tests/layout-renderer/layout-renderer-chart.test.tsx`
  - `src/tests/runtime/runtime-node-styling-chart.test.ts`
- Tests a modificar:
  - `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (ampliación: marcador exclusivo de Recharts fuera del bundle inicial).
  - `src/tests/runtime/runtime-node-components-map.test.tsx` (asegurar que la clave `chart` está en ambos maps).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/index.md` (nueva entrada).
  - `ai-workflow/docs/app-features/nodes/chart.md` (ficha nueva; cierre documental posterior).
  - `ai-workflow/docs/test-index.md` (dos ficheros nuevos: uno bajo `layout-renderer/`, otro bajo `runtime/`).
  - `ai-workflow/docs/app-features/runtime/overview.md` (si menciona la lista de nodos con code-splitting propio; cierre documental posterior).

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-chart.test.tsx` (nuevo)
- `src/tests/runtime/runtime-node-styling-chart.test.ts` (nuevo)
- `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` (ampliación)
- `src/tests/runtime/runtime-node-components-map.test.tsx` (ampliación)

#### Comportamiento cubierto
- **`layout-renderer-chart.test.tsx`**:
  - Un `chart` con `variant: 'bar'` y `props.data: [{ category: 'A', value: 10 }, { category: 'B', value: 5 }]` renderiza dos barras y sus categorías asociadas (verificar por marcador de Recharts en el DOM o por texto de la etiqueta).
  - Un `chart` con `variant: 'pie'` y tres puntos categóricos renderiza tres porciones, cada una con un color distinto tomado por ciclo de la paleta cerrada (verificar por `fill` de cada `<path>` de porción contra los tres primeros tokens del ciclo).
  - Un `chart` con `variant: 'scatter'` y `props.data: [{ x: 1, y: 2 }, { x: 3, y: 4 }]` renderiza dos puntos en el plano.
  - Un `chart` con origen dinámico y una query con datos renderiza un punto/barra/porción por cada elemento de la colección (delega en `resolveChartCategoricalPoints`/`resolveChartNumericPoints`).
  - Un `chart` con origen dinámico cuyo item tiene un `value`/`x`/`y` no numérico omite ese punto y renderiza el resto con normalidad.
  - Un `chart` con `variant: 'bar'` y `props.label: 'Ventas'` muestra "Ventas" como entrada de leyenda; sin `label`, la leyenda no se renderiza.
  - Un `chart` con `variant: 'line'` y `props.xAxisLabel: 'Mes'`/`props.yAxisLabel: 'Ingresos'` muestra ambos títulos junto a sus ejes; sin declararlos, los ejes se renderizan sin título pero con ticks.
  - Un `chart` con `variant: 'pie'` no renderiza título de eje ni leyenda de serie basada en `label` (fuera de contrato para esta variante); la leyenda por categoría de porción sí aparece con o sin ningún prop textual (categoría siempre presente en cada punto).
  - Un `chart` con `props.color: 'success'` en `variant: 'bar'` pinta las barras con el token semántico `success`; sin `color`, se aplica `primary` por defecto.
  - Un `chart` con `props.height: 'lg'` aplica la clase de altura correspondiente al contenedor; sin declararla, se aplica la clase de `md`.
  - Un `chart` con origen dinámico y query en `loading` que declara `queryStateFeedback` degrada al feedback declarado (delegación transversal, mismo comportamiento que el resto del catálogo — verificar mediante el aserto ya usado por `map`/`gallery` en su suite).
  - Un `chart` dentro de un `repeater` recibe correctamente `iterationContext` para resolver `props.source` con rutas `item.*` (regresión de resolución dinámica en contexto de iteración).
  - Pulsar sobre una barra/punto/porción del chart no dispara ninguna acción del catálogo (verificar que ni `navigateTo`, ni `openModal`, ni `executeOperation` se disparan; el tooltip nativo de Recharts sí aparece).
- **`runtime-node-styling-chart.test.ts`**:
  - `getChartHeightClassName('sm'|'md'|'lg'|'xl')` devuelve la clase Tailwind correspondiente; `undefined` devuelve la clase de `md`.
  - `getChartSeriesColor` devuelve la pareja `{fill, stroke}` correspondiente a cada uno de los seis tokens y a `undefined` (fallback `primary`).
  - `getChartCyclicPieColors(1..7)` devuelve un array de la longitud pedida ciclando los seis tokens (`7` recicla el primero en la séptima posición).
  - `chartVariantRenderers` expone las seis claves exactas de `ChartVariant`.
- **`runtime-nodes-bundle.test.ts`** (ampliación):
  - El bundle inicial de producción no contiene la cadena `recharts-wrapper` (u otra clase raíz exclusiva de Recharts elegida por el test) — mismo estilo de aserto que ya se usa para `leaflet-container`.
- **`runtime-node-components-map.test.tsx`** (ampliación):
  - `eagerMap.chart` y `lazyMap.chart` existen y son coherentes (mismo aserto de cobertura de claves ya usado para `gallery`/`map`).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-chart.test.tsx`
- `pnpm test --run src/tests/runtime/runtime-node-styling-chart.test.ts`
- `pnpm test --run src/tests/runtime/runtime-node-components-map.test.tsx`
- `pnpm test --run src/tests/dev-runtime/runtime-nodes-bundle.test.ts`

#### Restricciones
- Reutilizar el harness de tests de renderer ya usado por `layout-renderer-map.test.tsx` y `layout-renderer-gallery.test.tsx` para montar el nodo con provider de estado y queries falsas.
- No introducir snapshots (mismo criterio del resto de ficheros de `layout-renderer/`).
- Reutilizar la infraestructura de code-splitting existente en `node-components-map.ts`: no crear un segundo mapa.
- No modificar el gate `runtime-nodes-bundle.test.ts` más allá de añadir el marcador de Recharts.
- El ajuste de `vite.config.ts` solo se aplica si el gate lo exige (paso 5 del objetivo). No hacer commit de la línea sin justificación observable del gate.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/index.md`
- `ai-workflow/docs/app-features/nodes/chart.md` (ficha nueva; cierre documental posterior)
- `ai-workflow/docs/app-features/runtime/overview.md`
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- El nodo `chart` se renderiza end-to-end para las seis variantes y para los dos orígenes.
- El gate de bundle verifica que Recharts no aparece en el bundle inicial.
- Todos los tests nuevos y ampliados pasan en verde.
- Ningún test existente de otros nodos se rompe.

### Cierre de implementación
- Cambios de código y tests aplicados.
- Los cuatro comandos de test de la tarea en verde.
- `pnpm test` global verde con cobertura `≥ 80%`.
- `pnpm build` completa sin errores (necesario para que el gate de bundle sea legítimo).

---

## T05 — Registro del tipo `chart` en el catálogo del editor visual

### Objetivo
Habilitar la inserción y selección del nodo `chart` desde el editor visual
(`dev-editor`) reutilizando la infraestructura genérica ya vigente para
`gallery`/`map`/otros nodos:

1. Añadir `chart` al catálogo de tipos soportados por el canvas
   (`layout-canvas-node-schema.ts` — derivación cacheada de JSON Schema por
   tipo y catálogo de tipos soportados).
2. Añadir `chart` a la paleta flotante de nodos (`floating-node-palette`),
   con etiqueta legible y valor de inserción por defecto: `{ type: 'chart',
   props: { variant: 'bar', data: [{ category: 'Ejemplo', value: 1 }] } }`
   — mínimo válido para pasar `validateChartNode` sin acciones adicionales del
   usuario (variante categórica por defecto, origen estático mínimo).
3. Verificar que las reglas de destino de drop existentes (colocación del
   nodo dentro de `container`/`form`/`repeater.template`, etc.) ya cubren
   `chart` como nodo hoja, sin adaptaciones específicas.
4. Verificar mediante test que el panel de propiedades genérico ya monta las
   pestañas `Props`/`Diseño`/`Visibilidad`/`Queries` para `chart` de la misma
   forma que para el resto de nodos, sin modificar código del panel en esta
   tarea (los widgets específicos de `Props` — bloque "Tipo de chart", bloque
   "Origen" y `resolveChartPropsSchema` — se cablean en T06 y T07). Si el test
   revela que el dispatcher genérico no monta correctamente las pestañas para
   `chart`, esta tarea se detiene sin tocar código de panel y el hueco se
   traslada como bloqueo explícito a T07.

Esta tarea NO incluye ningún widget dedicado ni ningún resolver de schema:
solo integra `chart` en la maquinaria genérica del editor visual y verifica
que el flujo de inserción/selección funciona con el editor genérico de
propiedades disponible hoy.

### Fuera de alcance
- Selector "Origen" (T06).
- `resolveChartPropsSchema` y bloque especial "Tipo de chart" al principio de la
  pestaña `Props` (T07).
- Widgets dedicados para editar `props.data` o `props.source` (no aplican por
  D5: se usa el dispatcher genérico).
- Cualquier modificación de código de `layout-canvas-properties-panel.tsx` más
  allá de la verificación por test descrita en el paso 4 del objetivo; si esa
  verificación falla, el ajuste correspondiente se traslada a T07.

### Dependencias
- T01 completa (tipos y schema Zod usados por `layout-canvas-node-schema`).
- T04 completa (el componente `ChartNode` debe existir para que la inserción
  desde la paleta pueda renderizar el nodo tras el commit).

### Interfaces
- **Consume** (de T01):
  - `` `const chartNodeSchema: ZodType<ChartLayoutNode>` ``
  - `` `type ChartLayoutNode` ``
- **Consume** (de T04):
  - `` `ChartNode: React.ComponentType<{ node: ChartLayoutNode; iterationContext?: unknown }>` ``
- **Produce**: ninguna firma reutilizada por otras tareas.

### Impacto esperado en archivos
- Código a modificar:
  - `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` (añadir `chart` al catálogo de tipos soportados, para que la derivación cacheada de JSON Schema y la selección del nodo lo reconozcan).
  - `src/dev-runtime/floating-toolbar/` (fichero de la paleta flotante de nodos; añadir entrada `chart` con etiqueta legible y valor de inserción por defecto).
- Tests a modificar:
  - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación: `chart` presente en el catálogo derivado).
  - `src/tests/dev-runtime/floating-node-palette.test.tsx` (ampliación: `chart` insertable desde la paleta con su valor por defecto).
  - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación: insertar `chart` produce un nodo válido en el config).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (mencionar `chart` como tipo soportado por la paleta; cierre documental posterior).

### Tests

#### Ficheros de test
- `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación)
- `src/tests/dev-runtime/floating-node-palette.test.tsx` (ampliación)
- `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación)

#### Comportamiento cubierto
- El catálogo derivado desde `layout-canvas-node-schema.ts` incluye `chart` con el mismo shape de entrada que el resto de tipos soportados.
- La paleta flotante de nodos incluye la entrada `chart` con etiqueta legible; su valor de inserción por defecto es `{ type: 'chart', props: { variant: 'bar', data: [{ category: 'Ejemplo', value: 1 }] } }`.
- Insertar `chart` desde la paleta en un destino válido (dentro de un `container` de una página vacía) produce un nuevo config que pasa `validateRuntimeConfig` sin errores y donde el árbol resultante contiene el nodo `chart` insertado.
- Insertar `chart` fuera de un destino válido (por ejemplo dentro de un nodo hoja) sigue rechazándose por las reglas genéricas de destino de drop, sin adaptaciones específicas para `chart` (regresión).
- Seleccionar el `chart` recién insertado en modo Editor muestra las pestañas `Props`/`Diseño`/`Visibilidad`/`Queries` habituales, generadas por el dispatcher genérico (comprobar existencia de la barra de pestañas, sin exigir todavía los widgets dedicados de T06/T07).

#### Comandos durante la implementación
- `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
- `pnpm test --run src/tests/dev-runtime/floating-node-palette.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`

#### Restricciones
- Reutilizar el catálogo cacheado y el patrón de entrada de paleta existentes; no crear un mapa paralelo específico para `chart`.
- No introducir en esta tarea ningún widget dedicado ni ningún resolver de schema: el panel de propiedades debe funcionar con el dispatcher genérico.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- `ai-workflow/docs/app-features/nodes/chart.md`

### Criterios de finalización
- `chart` aparece en la paleta y puede insertarse desde ella con un valor por defecto válido.
- El nodo insertado renderiza en el canvas gracias al componente registrado en T04.
- Todos los tests ampliados pasan en verde.

### Cierre de implementación
- Cambios de código y tests aplicados.
- Los tres comandos de test de la tarea en verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T06 — `ChartOriginModePropertyField` (widget dedicado del origen)

### Objetivo
Crear un widget dedicado análogo a `GalleryOriginModePropertyField` que se
mostrará al principio de la pestaña `Props` del panel de propiedades de
`chart` (integrado por T07), con dos segmentos: "Estático" y "Dinámico".

Comportamiento:
- Detección del modo activo por la forma del nodo: presencia de `props.data` → "Estático"; ausencia → "Dinámico" (mismo criterio que usa el runtime para elegir rama).
- Alternar "Estático" → "Dinámico" reconstruye el bloque de datos con una plantilla mínima válida coherente con la variante activa del nodo (que el widget recibe como input):
  - Variantes categóricas (`bar`/`line`/`area`/`pie`/`donut`): siembra `props.source = { source: 'queries.query.data', category: 'category', value: 'value' }` y retira `props.data`.
  - Variante `scatter`: siembra `props.source = { source: 'queries.query.data', x: 'x', y: 'y' }` y retira `props.data`.
- Alternar "Dinámico" → "Estático" reconstruye el bloque con una plantilla mínima válida coherente con la variante activa:
  - Variantes categóricas: siembra `props.data = [{ category: 'Ejemplo', value: 1 }]` y retira `props.source`.
  - Variante `scatter`: siembra `props.data = [{ x: 0, y: 0 }]` y retira `props.source`.
- El resto de `props` (`variant`, `color`, `label`, `xAxisLabel`, `yAxisLabel`, `height`) sobrevive sin cambios.
- Un `data` o `source` editado previamente no se recuerda al alternar y volver (mismo criterio de "sustitución completa al cambiar de modo" que `gallery`).
- Idempotencia: pulsar el segmento ya activo no dispara ningún commit.
- Semántica ARIA: `radiogroup`/`radio`, roving tabindex, flecha izquierda/derecha, ajuste circular (mismo componente base `SegmentedTogglePropertyField`).

### Fuera de alcance
- Bloque especial "Tipo de chart" al principio de la pestaña `Props` (T07).
- `resolveChartPropsSchema` (T07).
- Montaje del widget dentro del panel de propiedades real (T07).
- Cualquier widget para editar el contenido de `props.data` o `props.source` (se usa el dispatcher genérico, D5).

### Dependencias
- T01 completa (tipos: `ChartVariant`, `ChartLayoutNode`).

### Interfaces
- **Consume** (de T01):
  - `` `type ChartVariant = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'` ``
  - `` `type ChartStaticCategoricalPoint = { category: string; value: number }` ``
  - `` `type ChartStaticNumericPoint = { x: number; y: number }` ``
  - `` `type ChartCategoricalDynamicSource = { source: string; category: string; value: string }` ``
  - `` `type ChartNumericDynamicSource = { source: string; x: string; y: string }` ``
- **Produce**:
  - `` `ChartOriginModePropertyField: React.ComponentType<{ label: string; node: ChartLayoutNode; onChange: (node: ChartLayoutNode) => void }>` `` (mismo patrón full-node in/out que `GalleryOriginModePropertyField`) — consumido por: T07.

### Impacto esperado en archivos
- Código a crear:
  - `src/dev-runtime/layout-canvas/property-fields/chart-origin-mode-property-field.tsx`
- Tests a crear:
  - `src/tests/dev-runtime/layout-canvas-property-field-chart-origin-mode.test.tsx`
- Documentación a revisar:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva sub-sección con el selector Origen de `chart`; cierre documental posterior).
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `dev-runtime/`).

### Tests

#### Ficheros de test
- `src/tests/dev-runtime/layout-canvas-property-field-chart-origin-mode.test.tsx` (nuevo)

#### Comportamiento cubierto
- Un `chart` con `variant: 'bar'` y `props.data` declarado muestra el segmento "Estático" activo.
- El mismo `chart` con `props.source` declarado (y `props.data` ausente) muestra el segmento "Dinámico" activo.
- Pulsar "Dinámico" desde "Estático" en `variant: 'bar'` invoca `onChange` con un nodo cuyo `props` no tiene `data` y sí `source = { source: 'queries.query.data', category: 'category', value: 'value' }`, preservando el resto (`variant`, `color`, `label`, `xAxisLabel`, `yAxisLabel`, `height`).
- Pulsar "Estático" desde "Dinámico" en `variant: 'bar'` invoca `onChange` con un nodo cuyo `props` no tiene `source` y sí `data = [{ category: 'Ejemplo', value: 1 }]`.
- Pulsar "Dinámico" desde "Estático" en `variant: 'scatter'` invoca `onChange` con un nodo cuyo `props` tiene `source = { source: 'queries.query.data', x: 'x', y: 'y' }` (plantilla numérica).
- Pulsar "Estático" desde "Dinámico" en `variant: 'scatter'` invoca `onChange` con un nodo cuyo `props` tiene `data = [{ x: 0, y: 0 }]` (plantilla numérica).
- Pulsar el segmento ya activo no dispara ninguna llamada a `onChange` (idempotencia).
- Alternar "Estático" → "Dinámico" → "Estático" no restaura el `data` editado previamente: siempre siembra la plantilla mínima (mismo criterio que `gallery`).
- Roving tabindex y navegación por flechas: `Tab` entra en el segmento activo; flecha izquierda/derecha mueve y activa el segmento adyacente con ajuste circular.

#### Comandos durante la implementación
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-chart-origin-mode.test.tsx`

#### Restricciones
- Reutilizar `SegmentedTogglePropertyField` sin duplicar su implementación (mismo criterio que `GalleryOriginModePropertyField`, `ContainerColumnsModePropertyField`, etc.).
- El widget sigue el patrón real y verificado de `GalleryOriginModePropertyField` (props `label`, `node`, `onChange`): recibe el nodo `chart` completo y devuelve el nodo completo reconstruido a través de `onChange`, no un objeto `props` parcial. El panel, al integrarse en T07, se limita a cablear `onChange` con el pipeline de commit existente (mismo patrón que su montaje actual para `gallery`).
- No introducir mocks del pipeline de commit: los tests aíslan el widget y verifican por callback.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- El widget aislado cubre los seis comportamientos de conmutación (dos modos × tres familias de plantilla: `bar`↔`data`/`source` categórico, `scatter`↔`data`/`source` numérico).
- Todos los tests del fichero pasan en verde.

### Cierre de implementación
- Cambios de código y tests aplicados.
- `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-chart-origin-mode.test.tsx` verde.
- `pnpm test` global verde con cobertura `≥ 80%`.

---

## T07 — `resolveChartPropsSchema` + integración panel + bloque "Tipo de chart"

### Objetivo
Cerrar la integración completa del nodo `chart` en el panel de propiedades del
editor visual, siguiendo D5 del design:

1. **`resolveChartPropsSchema`** (nuevo, en `layout-canvas-properties-panel.tsx`
   junto a `resolveGalleryPropsSchema`) — dos condicionamientos secuenciales
   sobre el schema efectivo de `props`:
   - Por `props.variant`: excluye las claves `color`, `label`, `xAxisLabel`, `yAxisLabel` cuando `variant` es `pie` o `donut`.
   - Por origen activo (detectado por presencia de `props.data` vs. `props.source`, mismo criterio que `gallery`): excluye la clave del origen inactivo (`source` en modo estático, `data` en modo dinámico).
   - Los dos pasos se aplican en orden como dos funciones puras independientes (no una única función monolítica), tal como fija D5 y "Riesgos" del design.
   - Cablear la ruta que consume `layout-canvas-properties-panel.tsx` para que llame a `resolveChartPropsSchema` cuando el `type` del nodo seleccionado es `'chart'`, mismo patrón que la llamada existente a `resolveGalleryPropsSchema`.

2. **Bloque especial "Tipo de chart"** al principio de la pestaña `Props`:
   - Mostrar un `<select>` estándar (D6 del design: sin excepción al toggle segmentado por tener seis valores) con las seis variantes como opciones (etiquetas literales del enum, sin traducción).
   - Cambiar la variante desde el bloque especial reconstruye el nodo con las siguientes reglas:
     - Si la familia de forma de dato de la nueva variante coincide con la anterior (`bar`/`line`/`area`/`pie`/`donut` entre sí, o `scatter` a `scatter`), se conserva `data`/`source` tal cual.
     - Si la familia cambia (cruzando hacia o desde `scatter`), se reinicia el bloque de datos con la plantilla mínima coherente con la nueva familia (misma plantilla que usa `ChartOriginModePropertyField` en T06 para el modo activo).
     - Al entrar en `pie`/`donut`, se descartan las claves `color`/`label`/`xAxisLabel`/`yAxisLabel`.
     - Al salir de `pie`/`donut` hacia una variante que sí las admite, no se re-siembran (quedan ausentes hasta que el usuario las declare).
   - El bloque ocupa el mismo lugar y aplica el mismo patrón de "escritura del nodo completo" que el resto de bloques especiales listados en la sección "Barra de pestañas del panel de propiedades" de `dev-mode-editor.md`.

3. **Bloque especial "Origen"** (justo debajo del selector de tipo):
   - Montar `ChartOriginModePropertyField` (T06) en la pestaña `Props`, pasándole `node` (el nodo `chart` seleccionado) y cableando `onChange` al pipeline de commit del panel — mismo patrón de integración que el montaje existente de `GalleryOriginModePropertyField` en la ruta de `gallery`.

4. **Color, label, xAxisLabel, yAxisLabel, height**: no se cablean widgets dedicados nuevos:
   - `props.color` (enum de seis valores literalmente llamado `color`) ya cae en la convención de swatches (`ColorSwatchPropertyField`) sin registro adicional.
   - `props.label`, `props.xAxisLabel`, `props.yAxisLabel` son strings y se editan como campos de texto simples del dispatcher genérico.
   - `props.height` (enum de cuatro valores) cae en el rango 2-5 del `SegmentedTogglePropertyField` genérico automáticamente.
   - `resolveChartPropsSchema` (paso 1) se encarga de que en `pie`/`donut` desaparezcan `color`/`label`/`xAxisLabel`/`yAxisLabel` del panel sin código propio adicional.

### Fuera de alcance
- Cualquier widget dedicado nuevo más allá de "Tipo de chart" (bloque especial) y del selector "Origen" ya creado en T06.
- Cualquier cambio en el schema Zod raíz (T01 ya lo dejó cerrado).
- Cualquier cambio en la validación cruzada (T02).

### Dependencias
- T01 completa (tipos y `chartNodeSchema`).
- T04 completa (el componente ya se monta desde la paleta y el canvas).
- T05 completa (el catálogo del editor visual reconoce `chart`).
- T06 completa (`ChartOriginModePropertyField`).

### Interfaces
- **Consume** (de T01):
  - `` `type ChartVariant = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'` ``
  - `` `type ChartLayoutNode = { type: 'chart'; props: { variant: ChartVariant; data?: Array<ChartStaticCategoricalPoint | ChartStaticNumericPoint>; source?: ChartCategoricalDynamicSource | ChartNumericDynamicSource; color?: ChartColor; label?: string; xAxisLabel?: string; yAxisLabel?: string; height?: ChartHeight }; visibility?: unknown; queryStateFeedback?: unknown; layout?: unknown }` ``
  - `` `type ChartStaticCategoricalPoint = { category: string; value: number }` ``
  - `` `type ChartStaticNumericPoint = { x: number; y: number }` ``
  - `` `type ChartCategoricalDynamicSource = { source: string; category: string; value: string }` ``
  - `` `type ChartNumericDynamicSource = { source: string; x: string; y: string }` ``
- **Consume** (de T06):
  - `` `ChartOriginModePropertyField: React.ComponentType<{ label: string; node: ChartLayoutNode; onChange: (node: ChartLayoutNode) => void }>` ``
- **Produce**:
  - `` `resolveChartPropsSchema(propsSchema: Record<string, unknown>, propsValue: unknown): Record<string, unknown>` `` — consumido por: `layout-canvas-properties-panel.tsx` en la misma tarea; sin consumidores directos en otras tareas.

### Impacto esperado en archivos
- Código a modificar:
  - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (añadir `resolveChartPropsSchema` — función local, mismo patrón que `resolveGalleryPropsSchema` — y cablearla para `type: 'chart'`; añadir el bloque especial "Tipo de chart" y el montaje de `ChartOriginModePropertyField` al principio de la pestaña `Props` para `chart`).
- Tests a crear:
  - `src/tests/dev-runtime/layout-canvas-properties-panel-chart.test.tsx`
- Documentación a revisar:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nuevas sub-secciones: selector de tipo de chart, selector de origen de chart, `resolveChartPropsSchema`; cierre documental posterior).
  - `ai-workflow/docs/app-features/nodes/chart.md` (bloque de "Editor visual"; cierre documental posterior).
  - `ai-workflow/docs/test-index.md` (añadir el fichero nuevo bajo `dev-runtime/`).

### Tests

#### Ficheros de test
- `src/tests/dev-runtime/layout-canvas-properties-panel-chart.test.tsx` (nuevo)

#### Comportamiento cubierto
- **Resolver de schema**:
  - `resolveChartPropsSchema` con un nodo `variant: 'bar'` conserva `color`, `label`, `xAxisLabel`, `yAxisLabel` en el schema efectivo.
  - `resolveChartPropsSchema` con `variant: 'pie'` retira `color`, `label`, `xAxisLabel`, `yAxisLabel` del schema efectivo.
  - `resolveChartPropsSchema` con `variant: 'donut'` retira los mismos cuatro campos.
  - `resolveChartPropsSchema` con `props.data` declarado retira `source` del schema efectivo (y no toca `data`).
  - `resolveChartPropsSchema` con `props.source` declarado retira `data` del schema efectivo.
  - Los dos condicionamientos se aplican en orden y de forma componible: `variant: 'pie'` + `props.source` declarado retira `color`/`label`/`xAxisLabel`/`yAxisLabel` **y** `data`.
- **Panel de propiedades end-to-end** (montando el panel real con un nodo `chart` seleccionado):
  - El bloque "Tipo de chart" se muestra al principio de la pestaña `Props` como `<select>` con las seis opciones.
  - Cambiar `variant` de `bar` a `line` (misma familia categórica) conserva `data` y `source` tal cual.
  - Cambiar `variant` de `bar` a `scatter` (familia cambia) reinicia `data`/`source` con la plantilla mínima numérica (categórica → numérica: el nodo pasa de `data: [{category, value}]` a `data: [{x: 0, y: 0}]` si estaba en estático, o de `source: {..., category, value}` a `source: {..., x, y}` si estaba en dinámico).
  - Cambiar `variant` de `scatter` a `bar` reinicia el bloque con la plantilla mínima categórica.
  - Cambiar `variant` a `pie` desde `bar` descarta `color`, `label`, `xAxisLabel`, `yAxisLabel` del nodo (si estaban declarados) y los oculta del panel; volver a `bar` los deja ausentes (no reintroducidos) pero visibles en el panel como campos opcionales editables.
  - El bloque "Origen" se muestra debajo de "Tipo de chart" y refleja el modo activo detectado por la forma del nodo; alternar de modo desde ese bloque escribe el nodo con la plantilla mínima correspondiente (comportamiento delegado a T06, verificar solo la integración).
  - `props.color` en `variant: 'bar'` se edita con `ColorSwatchPropertyField` (convención de nombre `color`), sin código propio.
  - `props.height` se edita con `SegmentedTogglePropertyField` (enum de cuatro valores, regla genérica del rango 2-5).
  - `props.label`, `props.xAxisLabel`, `props.yAxisLabel` en `variant: 'bar'` se editan como campos de texto simples del dispatcher genérico.
  - `props.data` en modo estático se edita con el editor genérico de array-de-objetos del dispatcher; añadir/quitar filas produce commits válidos.
  - `props.source` en modo dinámico se edita con el editor genérico de objeto-de-campos-simples del dispatcher (sin widget dedicado, por D5).

#### Comandos durante la implementación
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-chart.test.tsx`
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (regresión del panel general)
- `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-gallery.test.tsx` (regresión de la ruta análoga de `gallery`, para asegurar que `resolveChartPropsSchema` no rompe `resolveGalleryPropsSchema`)

#### Restricciones
- Reutilizar el mismo mecanismo por el que `layout-canvas-properties-panel.tsx` ya monta `resolveGalleryPropsSchema`: no introducir un tercer patrón para condicionar el schema.
- Los dos condicionamientos de `resolveChartPropsSchema` deben ser dos funciones puras internas (una por variante, otra por origen), componibles como `resolveChartPropsSchema(schema, value) = byOrigin(byVariant(schema, value), value)`; testear cada una por separado en las aserciones del sub-bloque "Resolver de schema".
- No cablear un widget dedicado para editar `props.data` ni `props.source`: el dispatcher genérico debe cubrirlos.
- No añadir `chart` al catálogo de nombres reservados para el `SegmentedTogglePropertyField` con excepción al rango 2-5: el bloque "Tipo de chart" es un `<select>` estándar (D6).

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`
- `ai-workflow/docs/app-features/nodes/chart.md`
- `ai-workflow/docs/test-index.md`

### Criterios de finalización
- `resolveChartPropsSchema` cubre las cuatro combinaciones de `variant` × origen enumeradas.
- El bloque "Tipo de chart" y el bloque "Origen" se muestran al principio de la pestaña `Props` y aplican las reglas de reconstrucción descritas.
- Los widgets genéricos (swatches de color, segmented, texto simple, array/objeto) cubren el resto de la superficie de edición sin código propio adicional.
- Todos los tests del fichero pasan en verde y las regresiones ejecutadas siguen verdes.

### Cierre de implementación
- Cambios de código y tests aplicados.
- Los tres comandos de test de la tarea en verde.
- `pnpm test` global verde con cobertura `≥ 80%`.
- Un flujo manual mínimo (insertar `chart` desde la paleta, alternar sus seis variantes, alternar entre estático y dinámico, editar color/label/altura) queda validado por el test end-to-end del panel.

---

## Orden y siguiente tarea

1. **T01 — Tipos y schemas Zod** (bloquea todas las demás).
2. **T02 — Validador cruzado** (bloquea T04 y toda la superficie de dev-editor porque un `chart` no válido no llega a render).
3. **T03 — Resolutores runtime de puntos** (bloquea T04).
4. **T04 — `ChartNode`, code-splitting y gate de bundle** (bloquea la aparición del nodo en el canvas — T05 depende del componente registrado).
5. **T05 — Registro en el catálogo del editor visual** (paleta y `layout-canvas-node-schema`).
6. **T06 — `ChartOriginModePropertyField`** (widget aislado; se testea sin depender del panel real).
7. **T07 — `resolveChartPropsSchema` + integración panel + bloque "Tipo de chart"** (cierra el ciclo).

La siguiente tarea a escoger es **T01**.
