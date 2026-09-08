> Cuándo leer: si la tarea toca el nodo `chart` — gráfico con seis tipos visuales sobre datos estáticos o dinámicos.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[./repeater.md]], [[../config/validation.md]], [[../development/dev-mode-editor.md#selector-de-origen-y-widget-dedicado-para-props-de-chart]].

# Nodo `chart`

Nodo hoja que declara un gráfico con seis tipos visuales disponibles (`bar`, `line`, `area`, `pie`, `donut`, `scatter`), renderizado sobre `Recharts`, con datos declarados de forma estática en el JSON o alimentados dinámicamente desde `queries.*`. Estado actual: feature completa (T1–T7) — el nodo se renderiza de punta a punta a través de `LayoutRenderer`, con code-splitting propio.

## Contrato (`props`)

`props` es obligatorio y debe declarar exactamente un origen de datos (estático o dinámico) según lo especificado abajo. Si se omite completamente, o si declara ambos orígenes o ninguno, la validación previa al render rechaza el config.

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.variant` | `"bar" \| "line" \| "area" \| "pie" \| "donut" \| "scatter"` | sí | Tipo de gráfico. |
| `props.data` | `ChartStaticDataPoint[]` | uno de `data`/`source`, exactamente uno | Datos estáticos. Se ignora si `props.source` también está declarado. |
| `props.source` | `ChartDynamicSource` | uno de `data`/`source`, exactamente uno | Datos derivados de una colección `queries.*`. Si está declarado, prevalece sobre `props.data`. |
| `props.height` | `"sm" \| "md" \| "lg" \| "xl"` | no | Altura del contenedor del gráfico. Default efectivo resuelto en render. |
| `props.color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | Color semántico para variantes de una sola serie (`bar`, `line`, `area`, `scatter`). No aplica a `pie`/`donut` (asignación automática cíclica). |
| `props.label` | `string` | no | Texto de leyenda y cabecera de tooltip en `bar`/`line`/`area`/`scatter`. Rechazado en `pie`/`donut`. |
| `props.xAxisLabel` | `string` | no | Título del eje X en `bar`/`line`/`area`/`scatter`. Rechazado en `pie`/`donut`. |
| `props.yAxisLabel` | `string` | no | Título del eje Y en `bar`/`line`/`area`/`scatter`. Rechazado en `pie`/`donut`. |

### Origen estático (`props.data`)

Forma según `props.variant`:

**Variantes categóricas** (`bar`, `line`, `area`, `pie`, `donut`) — `props.data[i]` (`ChartStaticCategoryDataPoint`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `category` | `string` | sí | Categoría (etiqueta del punto). |
| `value` | `number` | sí | Valor numérico del punto. |

**Variante numérica** (`scatter`) — `props.data[i]` (`ChartStaticScatterDataPoint`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `x` | `number` | sí | Coordenada X (numérica). |
| `y` | `number` | sí | Coordenada Y (numérica). |

### Origen dinámico (`props.source`)

`props.source` (`ChartDynamicSource`):

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `source` | `string` | sí | Fuente de colección: `queries.{queryName}.data` o `queries.{queryName}.data.*`. |
| `categoryPath` | `string` | sí si `variant` es categórica, no si es `scatter` | Ruta relativa al item para extraer categoría. Rechazado si `variant: 'scatter'`. |
| `valuePath` | `string` | sí si `variant` es categórica, no si es `scatter` | Ruta relativa al item para extraer valor numérico. Rechazado si `variant: 'scatter'`. |
| `xPath` | `string` | sí si `variant: 'scatter'`, no si es categórica | Ruta relativa al item para extraer coordenada X. Rechazado en variantes categóricas. |
| `yPath` | `string` | sí si `variant: 'scatter'`, no si es categórica | Ruta relativa al item para extraer coordenada Y. Rechazado en variantes categóricas. |

Mismo patrón que `map.props.markerSources`, sin admitir interpolación en las rutas — solo rutas relativas simples.

No admite `children` (nodo hoja): si el config declara `children` en un nodo `chart`, se rechaza antes del render con `invalid-layout` sobre `{path}.children`, igual que `repeater`/`tabs`.

## Normalización

- Sin `props.data` ni `props.source` declarados, o ambos declarados: invalidación en la fase de validación previa (no hay normalización, config rechazado).
- Con `props.data` declarado (incluido `[]`) y `props.source` ausente: `data` se conserva con la forma apropiada según `variant` (categórica o numérica).
- Con `props.source` declarado: se conserva `source` con cada ruta de extracción ya normalizada; `props.data` queda `undefined` (se ignora aunque el config la hubiera declarado). `source` prevalece siempre.
- `props.variant`, `props.height`, `props.color` se copian tal cual si están presentes. `props.label`, `xAxisLabel`, `yAxisLabel` se normalizan al subconjunto relevante según `variant`: en categóricas (`bar`/`line`/`area`/`pie`/`donut`) y `scatter` se admiten todos; en `pie`/`donut` se rechazan `label`, `xAxisLabel`, `yAxisLabel`.

## Validación previa al render

Vive en `src/config/validate-chart-node.ts` (`validateChartNode`).

- `props.variant` ausente o fuera de `bar | line | area | pie | donut | scatter`: `invalid-layout` sobre `{path}.props.variant`.
- `props.data` y `props.source` declarados a la vez, o ninguno de los dos: `invalid-layout` sobre `{path}.props`.
- En variantes categóricas (`bar`, `line`, `area`, `pie`, `donut`):
  - `props.source.categoryPath` o `props.source.valuePath` vacíos o mal formados (sin ser rutas relativas válidas): `invalid-layout` sobre `{path}.props.source.categoryPath` / `.valuePath`.
  - `props.source.xPath` o `props.source.yPath` declarados: `invalid-layout` sobre la ruta exacta (no aplican a forma categórica).
  - `props.data[i]` sin `category` válida (string) o sin `value` válido (número): `invalid-layout` sobre la ruta exacta del índice.
- En variante `scatter`:
  - `props.source.xPath` o `props.source.yPath` vacíos o mal formados: `invalid-layout` sobre la ruta exacta.
  - `props.source.categoryPath` o `props.source.valuePath` declarados: `invalid-layout` (no aplican a forma numérica).
  - `props.data[i]` sin `x` válido (número) o sin `y` válido (número): `invalid-layout` sobre la ruta exacta del índice.
- `props.height` fuera de `sm|md|lg|xl`: `invalid-layout` sobre `{path}.props.height`.
- `props.color` fuera de la paleta semántica de seis colores: `invalid-layout` sobre `{path}.props.color`.
- `props.label`, `props.xAxisLabel`, `props.yAxisLabel` declarados en `pie`/`donut`: `invalid-layout` sobre la ruta exacta (no aplican a esas variantes).
- `props.source.source` fuera del patrón `queries.{queryName}.data(.*)`: `invalid-layout` sobre la ruta exacta.
- `children` declarado: `invalid-layout` sobre `{path}.children`.
- `visibility` y `queryStateFeedback` siguen el contrato transversal estándar.

## Resolución en runtime de `source` (T2)

`resolveChartDataPoints(source, variant, state, options?)` (en `src/runtime/runtime-collection-sources.ts`) toma un `ChartDynamicSource` ya validado, la variante activa y el `RuntimeState`, y devuelve un array de puntos tipado según la forma de datos de la variante:

- Resuelve la colección de `source.source` reutilizando `resolveCollectionSourceItems` (mismo contrato que `repeater`/`list`/`select`: colección vacía o valor no-colección degrada a `[]` sin error).
- **Forma categórica** (`bar`, `line`, `area`, `pie`, `donut`): por cada item, navega `categoryPath` y `valuePath` como rutas relativas al item (sin interpolación, sin rutas globales). `category` es válida si es `typeof 'string'`; `value` es válido si es `typeof 'number'` y finito. Un item con `category` o `value` inválido se omite en silencio (sin excepción, sin diagnóstico en producción, con `console.warn` en DEV).
- **Forma numérica** (`scatter`): por cada item, navega `xPath` y `yPath` como rutas relativas. `x` e `y` son válidos si son `typeof 'number'`, finitos. Un item con `x` o `y` inválido se omite en silencio.
- Es una función pura: no muta la colección de entrada ni el estado; llamadas repetidas con el mismo estado devuelven resultados equivalentes.

## Render (`ChartNode`, `src/runtime/nodes/chart-layout-node.tsx`)

- Valores por defecto cuando no se declaran: `height` = `md` (clase `h-80`, ver `getChartHeightClassName` en `runtime-node-styling-chart.ts`), `color` = `primary`.
- Se renderiza `<ResponsiveContainer width="100%" height={heightPx}>` con el componente de gráfico apropiado (`BarChart`, `LineChart`, `AreaChart`, `PieChart`, `ScatterChart`, etc. de Recharts).
- **Variantes categóricas** (`bar`, `line`, `area`):
  - Eje X con etiquetas de categorías (ticks).
  - Eje Y con etiquetas numéricas.
  - Un único `<Bar>`, `<Line>`, o `<Area>` con color de `props.color` (default `primary`), o del siguiente en la paleta cíclica si no se declara.
  - Si `props.label` tiene contenido, se muestra una `<Legend>` con esa etiqueta; sin contenido, sin leyenda (pero tooltip sigue visible).
  - Si `props.xAxisLabel` o `props.yAxisLabel` tienen contenido, se muestran como títulos de ejes; sin contenido, solo los ticks se renderizan.
- **Variante `pie`/`donut`**:
  - Un `<Cell>` por punto, cada uno con un color de la paleta cíclica de seis colores semánticos indexada por posición (`['primary', 'success', 'warning', 'danger', 'info', 'neutral']`).
  - Leyenda siempre visible mostrando `category` de cada porción.
  - Tooltip siempre visible mostrando `category` y `value` de cada porción.
  - `props.label`, `props.xAxisLabel`, `props.yAxisLabel` se rechazan en validación (no aplican).
- **Variante `scatter`**:
  - Eje X con etiquetas numéricas.
  - Eje Y con etiquetas numéricas.
  - Un único `<Scatter>` con color de `props.color` (default `primary`).
  - Si `props.label` tiene contenido, se muestra una `<Legend>` con esa etiqueta; sin contenido, sin leyenda.
  - Si `props.xAxisLabel` o `props.yAxisLabel` tienen contenido, se muestran como títulos de ejes.
- **Tooltip**: siempre se muestra al pasar el cursor sobre un punto/barra/porción, sin necesidad de `props.label`. El contenido incluye `category`/`value` (o `x`/`y` en `scatter`); si `props.label` está declarado con contenido, se añade como cabecera.
- `visibility` y `queryStateFeedback` se resuelven de forma genérica en `LayoutNodeRenderer` antes de llegar al componente, igual que el resto del catálogo; `chart` participa de `layout.span` como cualquier nodo hoja estándar.
- Pulsar un punto/barra/porción no dispara ninguna acción del catálogo (navegación, apertura de modal, ejecución de operación). No hay interactividad adicional en v1 más allá de tooltip/leyenda.

## Code-splitting y peso de bundle

- `chart` está registrado en `src/runtime/nodes/node-components-map.ts` con el mismo patrón dual que el resto del catálogo: import estático en `eagerMap` (usado solo en modo test) e import diferido `React.lazy(...)` en `lazyMap` (usado en dev/prod).
- `Recharts` se carga bajo demanda; el peso de la librería solo se descarga cuando una página realmente usa `chart`. El gate `src/tests/dev-runtime/runtime-nodes-bundle.test.ts` verifica esto comprobando que ningún símbolo exportado por `recharts` aparece en el bundle inicial cuando no hay `chart` en la página.

## Límites (v1)

- Sin varias series superpuestas o agrupadas en la misma instancia.
- Sin interactividad más allá de tooltip/leyenda (no se puede clickar un punto para disparar una acción del catálogo).
- Sin animaciones configurables, zoom, brushing, exportación de imagen/CSV.
- Sin edición visual desde `dev-editor` inicialmente (añadida como parte de la feature completa en T4–T7).
