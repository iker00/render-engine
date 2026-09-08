# Design: Feature 2026-09-08-08-50 - chart-node

## Contexto
`spec.md` fija el comportamiento de producto: nuevo nodo `chart` con seis variantes (`bar`/`line`/`area`/`pie`/`donut`/`scatter`), una única serie de datos por instancia, origen estático o dinámico mutuamente excluyente, color único configurable en variantes cartesianas frente a asignación cíclica automática en `pie`/`donut`, y textos opcionales (`label`, `xAxisLabel`, `yAxisLabel`) cuya visibilidad depende de si tienen contenido. La spec exige además soporte completo en el panel de propiedades del editor visual (`dev-editor`).

El catálogo ya resuelve, con precedentes directamente aplicables, cada eje de complejidad de esta feature:
- **Nodo pesado con librería externa y code-splitting propio**: `map` (Leaflet) y `gallery` (embla-carousel), registrados con el patrón dual `eagerMap`/`lazyMap` en `node-components-map.ts` y verificados por un test de gate de bundle.
- **Origen de datos estático/dinámico mutuamente excluyente**: `gallery.props.images`/`props.source` (rechazo si se declaran ambos o ninguno) y `map.props.markers`/`props.markerSources` (el dinámico prevalece sin rechazar). La spec de esta feature ya elige explícitamente el criterio de `gallery` (rechazo), alineado con la restricción de `architecture.md` de no aceptar en componentes visuales contratos que deberían rechazarse en `src/config/`.
- **Un nodo, varias variantes**: `badge`/`stat`/`divider`/`skeleton`, resueltas en runtime con un lookup `Record<Variant, ...>` (`conventions.md`, sección "Resolución de variantes visuales").
- **Panel de propiedades generado dinámicamente desde el schema Zod** (`toJSONSchema`), con un hook `x-widget` para widgets dedicados y un patrón `resolveXPropsSchema` (`resolveGalleryPropsSchema`, `resolveTablePropsSchema`, `resolveRepeaterPropsSchema`, `resolveContainerPropsSchema`) para ocultar del dispatcher genérico las claves que no aplican al modo activo de un nodo.
- **Swatches de color por convención de nombre**: cualquier campo `props.color` con `enum` recibe automáticamente el widget de muestras (`ColorSwatchPropertyField`), sin registro por tipo de nodo — ya cubre `badge`/`stat`.
- **Enum de 6+ valores en el panel**: cae fuera del rango 2-5 del toggle de segmentos y se muestra como `<select>` estándar sin que eso se considere un problema — precedente ya vigente en `repeater.props.justify` (6 opciones).

Investigación externa: `Recharts`, a diferencia de `Leaflet`, sí publica una build ESM pensada para tree-shaking, pero su propio repositorio mantiene abierto un issue de seguimiento sobre el peso real de bundle tras tree-shaking (`recharts/recharts#7018`, "Observe bundle size", 2026), es decir, el resultado no está garantizado ni documentado como resuelto al 100%. No requiere ningún CSS externo (es SVG puro, a diferencia de `leaflet.css`).

## Objetivos / No objetivos

### Objetivos
- Fijar el contrato técnico exacto de `props` de `chart` para las seis variantes, ambos orígenes de datos y los tres campos de texto opcionales.
- Fijar la estrategia de validación previa al render, reutilizando el máximo de infraestructura ya existente (`validateCollectionSource`, `isValidCollectionProjectionPath`).
- Fijar la estrategia de render en runtime sobre `Recharts`, coherente con `conventions.md`.
- Fijar la estrategia de code-splitting y su verificación de bundle.
- Fijar qué partes del panel de propiedades del editor visual necesitan widget dedicado y cuáles se resuelven con el mecanismo genérico ya existente.

### No objetivos
- No reabrir alcance ni comportamiento de producto ya cerrado en `spec.md`.
- No decidir el desglose de tareas de implementación (`generate-implementation-plan`).
- No evaluar librerías de chart alternativas a `Recharts`: la elección ya es una decisión de producto cerrada en `spec.md`.

## Decisiones

### D1. Contrato de `props`
- `props.variant: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter'`, obligatorio.
- Origen de datos, exactamente uno de los dos (rechazo si ambos o ninguno, criterio de `gallery`):
  - `props.data`: lista literal estática. Forma según familia de variante:
    - Categórica (`bar`/`line`/`area`/`pie`/`donut`): `{ category: string; value: number }[]`.
    - Numérica de pares (`scatter`): `{ x: number; y: number }[]`.
  - `props.source`: fuente dinámica sobre una colección `queries.{queryName}.data(.*)`, mismo contrato de `source` que `repeater.props.items.source`/`gallery.props.source.source`. Rutas relativas al item, sin prefijos reservados:
    - Categórica: `{ source: string; category: string; value: string }` — `category` admite ruta relativa o interpolación `{{...}}` (mismo criterio que `gallery.props.source.alt`); `value` es ruta relativa pura, sin interpolación (mismo criterio que `map.markerSources.position.lat`/`.lng`, porque debe resolver a un número).
    - Numérica de pares: `{ source: string; x: string; y: string }` — `x`/`y` rutas relativas puras, mismo criterio que `value`.
- `props.color`: enum semántico cerrado de seis colores (`neutral | primary | success | warning | danger | info`), opcional con default `primary`. **Solo válido en `bar`/`line`/`area`/`scatter`**; declarado en `pie`/`donut` se rechaza en validación. Nombrar el campo literalmente `color` es intencional: activa sin código nuevo la convención de swatches ya vigente en el editor (ver D5).
- `props.label`: string opcional. Solo válido en `bar`/`line`/`area`/`scatter`; rechazado en `pie`/`donut`. Presencia de texto no vacío controla si se muestra como entrada de leyenda y cabecera del tooltip (sin flag `enabled` independiente, según `spec.md`).
- `props.xAxisLabel`/`props.yAxisLabel`: string opcional cada uno. Solo válidos en `bar`/`line`/`area`/`scatter`; rechazados en `pie`/`donut`.
- `props.height: 'sm' | 'md' | 'lg' | 'xl'`, opcional, mismo catálogo y criterio de default que `map.props.height`.

**Alternativa descartada**: una única forma de dato `{ category, value, x, y }` con campos opcionales indistintos para las seis variantes, evitando la bifurcación categórica/numérica. Se descarta porque diluye la validación (¿qué combinación de campos es válida para cada variante?) y traslada al render la responsabilidad de interpretar campos ambiguos, en contra del principio de `architecture.md` de rechazar en `src/config/` lo que no debería llegar ambiguo al componente visual.

### D2. Validación previa al render
Nuevo módulo `src/config/validate-chart-node.ts` (`validateChartNode`), mismo patrón que `validate-gallery-node.ts`:
- Reutiliza sin modificar `validateCollectionSource` (con el mismo `source` que `repeater`/`select`/`map`/`gallery`) e `isValidCollectionProjectionPath` para las rutas de `category`/`value`/`x`/`y`.
- Reglas cruzadas nuevas de esta feature (sin precedente exacto, ver "Riesgos"): rechazo de `color`/`label`/`xAxisLabel`/`yAxisLabel` cuando `props.variant` es `pie`/`donut`, y selección de la forma de dato (categórica vs. numérica de pares) según `props.variant` antes de validar `data`/`source`.
- `children` declarado se rechaza igual que en `map`/`gallery`/`repeater`/`tabs`.

### D3. Render en runtime
- `ChartNode` (`src/runtime/nodes/chart-layout-node.tsx`) resuelve los puntos de datos con una de dos funciones puras compartidas entre variantes de la misma familia (`resolveChartCategoricalPoints`/`resolveChartNumericPoints`, en `src/runtime/runtime-collection-sources.ts`, junto a `resolveMapMarkerSourceItems`/`resolveGalleryPhotos`), reutilizando `resolveCollectionSourceItems`. Un punto cuya categoría/valor (o `x`/`y`) no resuelve a un tipo válido se omite en silencio, mismo criterio de degradación que `map`.
- La elección del componente Recharts por variante se resuelve con un lookup `Record<ChartVariant, ChartVariantRenderer>` (`runtime-node-styling-chart.ts` o módulo equivalente), siguiendo el patrón de "lookup map o helper único" de `conventions.md`. A diferencia de `divider` (donde el lookup resuelve a una clase CSS), aquí cada entrada resuelve a un pequeño componente que envuelve el par `<XChart>`/`<X>` de `Recharts` correspondiente (`BarChart`+`Bar`, `LineChart`+`Line`, `AreaChart`+`Area`, `PieChart`+`Pie`, `ScatterChart`+`Scatter`); `donut` reutiliza el mismo renderer que `pie` con `innerRadius` fijo distinto de `0`. Esto no es una excepción al principio de "esqueleto único" de `conventions.md` (a diferencia del precedente documentado de `button-switch-variant`): el lookup sigue siendo el único punto de resolución por variante, simplemente cada entrada es un componente en vez de una cadena de clases, generalización ya implícita en la propia redacción de la convención ("lookup map ... o delegando en un único helper").
- `visibility`/`queryStateFeedback`/`layout.span` se resuelven de forma genérica en `LayoutNodeRenderer`, sin lógica propia en `ChartNode`, igual que el resto del catálogo.

### D4. Integración de `Recharts` y code-splitting
- `chart` se registra en `node-components-map.ts` con el mismo patrón dual `eagerMap` (tests) / `lazyMap` (`React.lazy`, dev/prod) que el resto del catálogo, para que solo las páginas con `chart` paguen su peso de bundle.
- A diferencia de `leaflet`, `Recharts` no requiere un import de CSS como side-effect (es SVG puro).
- No se asume a priori que `Recharts` necesite el mismo ajuste de `build.rollupOptions.treeshake.moduleSideEffects` que `leaflet` en `vite.config.ts`: su build ESM está pensada para tree-shaking, pero el propio repositorio de `Recharts` mantiene abierto (2026) un issue de seguimiento sobre el peso real tras tree-shaking, así que el resultado no está garantizado. La decisión concreta (si hace falta el mismo ajuste o no) se toma con una medición real de bundle durante la implementación, no en este documento — ver "Riesgos".
- El gate de bundle (`runtime-nodes-bundle.test.ts`) se amplía para verificar que ningún marcador exclusivo de `Recharts` en el DOM (p. ej. la clase raíz `recharts-wrapper`) aparece en el chunk inicial, mismo criterio que ya usa para `leaflet-container`.

### D5. Panel de propiedades del editor visual (`dev-editor`)
- **Bloque especial "Tipo de chart"** (`props.variant`): al principio de la pestaña `Props`, mismo lugar y mismo criterio de "reconstrucción del nodo completo al cambiar" que el resto de bloques especiales ya listados (selector de modo de `container`, selector de origen de `gallery`, selector de contenido de `link`). Se muestra como `<select>` estándar, no como toggle de segmentos: con seis opciones queda fuera del rango 2-5 del segmented genérico, mismo caso ya aceptado sin excepción para `repeater.props.justify`.
- **Bloque especial "Origen"** (Estático/Dinámico): mismo componente y patrón que el selector de origen de `gallery` (`GalleryOriginModePropertyField`, generalizado o replicado para `chart`), mostrado justo debajo del selector de tipo, condicionado por la variante activa solo en la forma de los campos que construye al cambiar de modo (categórica vs. numérica de pares).
- **Datos estáticos y fuente dinámica sin widget dedicado**: a diferencia de `gallery.props.source` (que necesita un widget propio por su sub-discriminador `mode: 'src' | 'fetch'`) o de `table` (que necesita un widget propio por el acoplamiento `headers`/`rows`/`columns`), tanto `props.data` (array de objetos de dos campos) como `props.source` (objeto plano de 2-3 campos de texto) no tienen un sub-discriminador adicional ni una restricción de forma cruzada entre entradas — se editan con el editor genérico ya existente de array-de-objetos y de objeto-de-campos-simples del dispatcher, sin código de widget nuevo. Esta es una simplificación deliberada frente a construir un widget "editor de puntos" a medida: reduce el alcance de implementación del editor a los dos bloques especiales de arriba.
- **Color, sin código nuevo**: al nombrarse literalmente `color` con un `enum` de seis valores (D1), el dispatcher genérico ya lo resuelve como `ColorSwatchPropertyField` por convención de nombre, sin registrar `chart` en ninguna lista. El campo desaparece del panel en `pie`/`donut` por el mismo mecanismo de ocultación condicional que el resto de campos exclusivos de variante (ver más abajo).
- **`resolveChartPropsSchema`**: nuevo resolver de schema efectivo para la pestaña `Props` de `chart`, mismo precedente que `resolveGalleryPropsSchema`/`resolveTablePropsSchema`/`resolveRepeaterPropsSchema`/`resolveContainerPropsSchema`, con dos condicionamientos aplicados en pasos secuenciales explícitos (no una única función monolítica, ver "Riesgos"):
  1. Por `props.variant`: excluye `color`/`label`/`xAxisLabel`/`yAxisLabel` cuando la variante es `pie`/`donut`.
  2. Por origen activo (detectado por presencia de `props.data` vs. `props.source`, mismo criterio que `gallery`): excluye la clave del origen inactivo.
- **Reconstrucción al cambiar de tipo o de origen**: cambiar `props.variant` conserva `data`/`source` cuando la familia de forma de dato no cambia (entre `bar`/`line`/`area`/`pie`/`donut`, todas categóricas) y los reinicia con una plantilla mínima al cruzar hacia/desde `scatter`; además descarta `color`/`label`/`xAxisLabel`/`yAxisLabel` al entrar en `pie`/`donut` y los reintroduce vacíos al salir. Cambiar el origen reconstruye solo el bloque de datos con la plantilla mínima válida del nuevo origen, sin tocar `variant`/`color`/`label`/`xAxisLabel`/`yAxisLabel`. Mismo criterio de "sustitución completa, sin recordar el valor anterior" que el resto de selectores de esta familia.

### D6. Selector de tipo de chart: `<select>` estándar, sin excepción
Se descarta declarar `chart.props.variant` como excepción explícita al rango 2-5 del toggle de segmentos (lo que exigiría ampliar el propio componente genérico o su umbral). Se opta por dejarlo caer al `<select>` estándar ya previsto por el dispatcher para enums de 6+ valores, mismo comportamiento ya aceptado sin fricción para `repeater.props.justify`. Coste asumido: menor vistosidad que el resto de nodos con variante (`badge`/`stat`/`divider`/`skeleton`), compensado por no tocar un componente compartido por todo el catálogo para un caso aislado.

## Riesgos y trade-offs
- **Doble condicionamiento en `resolveChartPropsSchema`** (por `variant` y por origen a la vez): primera vez que un resolver de este tipo combina dos ejes; los precedentes existentes (`gallery`, `table`, `repeater`, `container`) condicionan sobre un único eje. Mitigación: aplicar los dos condicionamientos como pasos secuenciales y testeables por separado, no como una única función monolítica (ver D5).
- **Peso real de `Recharts` en el bundle final**: no verificable en este documento; el propio proyecto `Recharts` no garantiza el resultado de tree-shaking. Mitigación: gate de bundle desde la primera tarea de implementación que toque render, igual que `map`/`gallery`; si la medición muestra que `Recharts` no se elimina de páginas sin `chart`, se aplica el mismo ajuste de `moduleSideEffects` que ya existe para `leaflet` en `vite.config.ts`, sin cambiar el contrato de producto.
- **Reglas de validación cruzadas variante↔campo** (`color`/`label`/`xAxisLabel`/`yAxisLabel` rechazados en `pie`/`donut`): sin precedente exacto en el catálogo actual (los rechazos cruzados existentes, como `mode: 'src'` con `fetch` declarado en `gallery`, son entre dos campos del mismo bloque, no entre la variante raíz del nodo y varios campos de nivel superior). Riesgo bajo, acotado a una superficie de tests explícita por combinación variante × campo.

## Migración o despliegue
No aplica: nodo nuevo sin datos existentes que migrar. No modifica el contrato ni el comportamiento de ningún nodo ya soportado; un config existente sin `chart` no se ve afectado.

## Preguntas abiertas
- Ninguna bloqueante para planificar. El único punto no cerrado en este documento (si `vite.config.ts` necesita el mismo ajuste de `moduleSideEffects` que `leaflet` para `recharts`) tiene un camino de resolución explícito basado en medición durante la implementación (ver "Riesgos"), no una decisión de producto o arquitectura pendiente.
