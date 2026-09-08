# Spec: nodo `chart`

## Objetivo
Añadir un nuevo nodo `chart` al catálogo del runtime que permita representar datos como gráfico, sobre `Recharts`, con seis tipos visuales disponibles como variantes de un mismo nodo (`bar`, `line`, `area`, `pie`, `donut`, `scatter`), datos declarados de forma estática en el JSON o alimentados dinámicamente desde `queries.*`, y soporte completo de configuración desde el panel de propiedades del editor visual (`dev-editor`) para cada tipo de chart.

## Alcance
- Nuevo nodo `chart` en el catálogo, hoja visible sin `children`, con contrato basado en `props` siguiendo el mismo patrón que el resto del catálogo.
- `props.variant` cerrado a seis valores: `bar`, `line`, `area`, `pie`, `donut`, `scatter`.
- Una única colección de datos por instancia (una única serie): el nodo no admite comparar varias series superpuestas o agrupadas (p. ej. no dos líneas o dos grupos de barras en el mismo `chart`). Esto no impide que un `bar`/`line`/`area`/`pie`/`donut` muestre varias categorías dentro de esa única serie (cada barra, punto o porción es una categoría) — es la misma distinción que "una fuente" vs "varios elementos de esa fuente" ya usada en `map`.
- Dos formas de datos según variante, coherentes con la naturaleza de cada tipo:
  - **Categórica** (`bar`, `line`, `area`, `pie`, `donut`): pares `categoría` (texto) + `valor` (número).
  - **Numérica de pares** (`scatter`): pares `x`/`y` (ambos números).
- Dos orígenes de datos por instancia, mutuamente excluyentes (exactamente uno declarado, igual que `gallery.props.images`/`props.source`):
  - **Estático**: lista literal de puntos en el JSON, con la forma (categórica o numérica) correspondiente a la variante activa.
  - **Dinámico**: una fuente sobre una colección resuelta desde `queries.*`, con rutas relativas para extraer categoría/valor (o `x`/`y`) de cada elemento, análogo al patrón `items.source`/`items.key` de `repeater` y a `markerSources.position.*` de `map`.
- Color:
  - `bar`/`line`/`area`/`scatter` (una sola serie visual): un único color semántico configurable, tomado de la paleta cerrada de seis colores ya usada por `badge`/`stat`/`alert`/`map`.
  - `pie`/`donut` (varias porciones dentro de la misma serie): color asignado automáticamente por ciclo sobre la misma paleta cerrada de seis colores, un color por porción, mismo criterio que la asignación cíclica de `map` para varias fuentes dinámicas — sin campo de color editable por porción.
- Leyenda, tooltip y título de eje configurables mediante texto opcional, sin un flag `enabled` independiente: la presencia de texto determina la visibilidad, mismo criterio en los tres casos:
  - `bar`/`line`/`area`/`scatter` (una serie): un texto opcional (`props.label`) que, si tiene contenido, se muestra como entrada de leyenda y como cabecera del tooltip junto a categoría/valor; vacío o ausente, no hay entrada de leyenda y el tooltip solo muestra categoría/valor. El tooltip en sí siempre se activa al pasar el cursor sobre un punto/barra, con o sin `label`.
  - `bar`/`line`/`area`/`scatter`: título de eje X e Y opcional (`props.xAxisLabel`/`props.yAxisLabel`), visible solo con contenido; las etiquetas de los propios valores/categorías sobre el eje (ticks) se muestran siempre, con independencia del título.
  - `pie`/`donut`: leyenda y tooltip muestran siempre la categoría de cada porción (dato obligatorio por punto), sin campo de texto adicional que configurar; sin ejes, por tanto sin título de eje aplicable — declarar `label`/`xAxisLabel`/`yAxisLabel` en estas variantes se rechaza en validación.
- Altura de renderizado configurable con el mismo catálogo cerrado que `map.props.height` (`sm`/`md`/`lg`/`xl`), con valor por defecto razonable cuando se omite.
- Sin interactividad más allá de tooltip/leyenda: pulsar un punto/barra/porción no dispara ninguna acción del catálogo (`navigateTo`, `openModal`, `executeOperation`, etc.) en v1.
- Integración con las capacidades transversales ya soportadas por cualquier nodo del catálogo: `layout.span`, `visibility` y `queryStateFeedback` (aplicado cuando el origen es dinámico y depende de una query en `loading`/`error`/vacío).
- Soporte completo en el editor visual (`dev-editor`): el nodo es seleccionable, insertable desde la paleta y editable desde el panel de propiedades igual que el resto del catálogo con soporte de editor, cubriendo como mínimo:
  - Selector de tipo de chart (`props.variant`) al principio de la pestaña `Props`.
  - Selector de origen (Estático/Dinámico), mismo patrón que el de `gallery`, visible tras el selector de tipo.
  - Edición de los datos estáticos o de los campos de la fuente dinámica (colección, rutas de categoría/valor o `x`/`y`) coherente con la forma de datos de la variante activa.
  - Edición del color único (`bar`/`line`/`area`/`scatter`) con el mismo widget de swatches de color ya usado por otros nodos con paleta cerrada; sin campo de color en `pie`/`donut` (asignación automática).
  - Edición de altura (`props.height`).
  - Edición de los textos opcionales `label` (leyenda/cabecera de tooltip) y `xAxisLabel`/`yAxisLabel` (título de eje) como campos de texto simples, visibles solo en `bar`/`line`/`area`/`scatter`.

## Fuera de alcance
- Varias series superpuestas o agrupadas en la misma instancia (comparar dos conjuntos de datos en un mismo `chart`).
- Interacciones que disparen acciones del catálogo al pulsar un punto/barra/porción (navegación, apertura de modal, ejecución de operación). Ver "Riesgos o preguntas abiertas" para su posible extensión futura.
- Combinar en la misma instancia origen estático y dinámico.
- Tipos de chart adicionales no listados (p. ej. radar, treemap, funnel, gauge, combinados de varios tipos en un mismo gráfico).
- Animaciones configurables, exportación de imagen/CSV, zoom o brushing sobre el propio chart.
- Edición visual desde `dev-editor` de un widget de swatches propio para el color cíclico de `pie`/`donut` (no aplica: no es editable).

## Requisitos funcionales
1. El runtime reconoce `chart` como tipo de nodo válido dentro del catálogo; no admite `children`.
2. `props.variant` es obligatorio y está cerrado a `bar | line | area | pie | donut | scatter`.
3. El nodo admite exactamente un origen de datos por instancia: estático o dinámico. Si el config declara ambos a la vez, o ninguno, la validación previa al render rechaza el config con diagnóstico sobre la ruta exacta (mismo criterio que `gallery.props.images`/`props.source`).
4. En variantes `bar`/`line`/`area`/`pie`/`donut`, cada punto de datos (estático o resuelto dinámicamente) declara una categoría (texto) y un valor (número).
5. En variante `scatter`, cada punto de datos (estático o resuelto dinámicamente) declara un par `x`/`y`, ambos numéricos.
6. En origen dinámico, la fuente declara una colección resuelta desde `queries.{queryName}.data` (o una ruta anidada bajo ella) y las rutas relativas para extraer categoría/valor o `x`/`y` de cada elemento, análogo al patrón `items.source`/`items.key` de `repeater` y `markerSources.position.*` de `map`.
7. En `bar`/`line`/`area`/`scatter`, el nodo admite un único color semántico configurable, tomado de la paleta cerrada de seis colores ya vigente en el proyecto; sin declararlo, se aplica un color por defecto de esa misma paleta.
8. En `pie`/`donut`, cada porción recibe un color de la paleta cerrada de seis colores asignado automáticamente por ciclo según su posición; no existe prop de color por porción.
9. Un punto de datos (estático o dinámico) cuya categoría/valor o `x`/`y` no resuelve a un tipo válido se omite silenciosamente del chart, sin romper el render del resto de puntos (degradación análoga a como `map` omite marcadores con posición inválida).
10. El nodo declara una altura de renderizado con el mismo catálogo cerrado que `map.props.height` (`sm`/`md`/`lg`/`xl`), con valor por defecto razonable cuando se omite.
11. En `bar`/`line`/`area`/`scatter`, la serie admite un texto opcional (`props.label`) sin flag de activación independiente: con contenido, se muestra como entrada de leyenda y como cabecera del tooltip junto a categoría/valor; vacío o ausente, no hay entrada de leyenda y el tooltip solo muestra categoría/valor. El tooltip en sí se activa siempre al pasar el cursor sobre un punto/barra, con o sin `label` declarado.
12. En `bar`/`line`/`area`/`scatter`, el eje X y el eje Y admiten cada uno un título opcional (`props.xAxisLabel`/`props.yAxisLabel`) visible solo con contenido, sin flag de activación independiente; las etiquetas de los propios valores/categorías sobre el eje (ticks) se muestran siempre, con independencia del título.
13. En `pie`/`donut`, la leyenda y el tooltip muestran siempre la categoría de cada porción (dato obligatorio de cada punto), sin campo de texto adicional que configurar; al no tener ejes, no aplica título de eje. Declarar `props.label`, `props.xAxisLabel` o `props.yAxisLabel` en una instancia `pie`/`donut` se rechaza en la validación previa al render, por no aplicar a esa variante.
14. Pulsar un punto/barra/porción no dispara ninguna acción del catálogo de acciones.
15. `chart` admite `layout.span`, `visibility` y `queryStateFeedback` siguiendo las reglas transversales ya vigentes para el resto del catálogo.
16. Cuando el origen es dinámico, la query subyacente está en `loading`, `error` o resuelve vacía, y el nodo declara `queryStateFeedback`, el runtime aplica el feedback declarado sobre el nodo `chart` igual que en el resto del catálogo.
17. El panel de propiedades del editor visual permite crear, seleccionar y configurar un `chart` sin recurrir a Monaco: tipo de chart, origen de datos, datos/fuente según el origen activo, color (cuando aplica), altura, y los textos opcionales de leyenda/tooltip (`label`) y de títulos de eje (`xAxisLabel`/`yAxisLabel`) como campos de texto simples.
18. Cambiar el tipo de chart (`props.variant`) desde el panel de propiedades reconstruye solo los campos que no son compatibles entre la forma de datos anterior y la nueva (p. ej. cambiar entre `bar`/`line`/`area`/`pie`/`donut`, todas de forma categórica, conserva los datos/fuente ya declarados; cambiar hacia o desde `scatter` los reinicia por tener forma numérica de pares distinta; los campos `label`/`xAxisLabel`/`yAxisLabel` se descartan al cambiar hacia/desde `pie`/`donut`, que no los admite), mismo criterio que el resto de selectores de variante del editor.
19. Cambiar el origen de datos (Estático/Dinámico) desde el panel de propiedades reconstruye el bloque de datos con una plantilla mínima válida del nuevo origen, mismo criterio que el selector de origen de `gallery`.

## Requisitos no funcionales
- La librería de charts debe integrarse siguiendo el mismo patrón de code-splitting por nodo ya vigente en el catálogo (carga diferida, chunk propio, sin peso añadido al bundle inicial para páginas que no usan `chart`), con gate de bundle equivalente al ya existente para `map`/`gallery`.
- El nodo debe convivir con el resto del catálogo sin romper el umbral mínimo de cobertura del 80% sobre `src/` que exige el proyecto.
- El panel de propiedades del editor visual debe generarse, en la medida de lo posible, desde el mismo mecanismo dinámico basado en el schema Zod del nodo que usa el resto del catálogo, añadiendo únicamente los widgets dedicados estrictamente necesarios (selector de tipo, selector de origen, edición de datos/fuente), sin un segundo contrato de UI hardcodeado paralelo al schema.

## Criterios de aceptación
- Dado un config con `props.variant: 'bar'` y datos estáticos, el chart renderiza una barra por cada punto declarado, con la altura, categoría y valor indicados.
- Dado un config con `props.variant: 'pie'` y datos estáticos con tres categorías, el chart renderiza tres porciones, cada una con un color distinto de la paleta cerrada de seis colores, asignado por ciclo según su posición.
- Dado un config con `props.variant: 'scatter'` y datos estáticos, el chart renderiza un punto por cada par `x`/`y` declarado.
- Dado un config con origen dinámico apuntando a una query con datos, el chart renderiza un punto/barra/porción por cada elemento de la colección resuelta, con categoría/valor (o `x`/`y`) extraídos según lo declarado.
- Dado un config que declara `props.data` y `props.source` a la vez, o ninguno de los dos, la validación previa al render rechaza el config completo con diagnóstico sobre la ruta exacta.
- Dado un elemento de una fuente dinámica sin categoría/valor (o `x`/`y`) válidos, ese elemento no se renderiza como punto y el resto del chart se renderiza con normalidad.
- Al pasar el cursor sobre un punto/barra/porción se muestra su tooltip con categoría/valor (o `x`/`y`); no se dispara ninguna acción de navegación, apertura de modal ni ejecución de operación.
- Dado un `bar` con `props.label` declarado con texto, la leyenda muestra ese texto y el tooltip lo incluye como cabecera junto a categoría/valor.
- Dado un `bar` sin `props.label` (ausente o cadena vacía), no se muestra leyenda y el tooltip solo muestra categoría/valor, sin cabecera.
- Dado un `line` con `props.xAxisLabel`/`props.yAxisLabel` declarados, ambos títulos se muestran junto a sus ejes; sin declararlos, los ejes se renderizan sin título pero con sus ticks de valores/categorías con normalidad.
- Dado un `pie` con varias categorías, la leyenda y el tooltip muestran siempre el nombre de cada categoría, sin necesidad de declarar ningún campo de texto adicional.
- Dado un `pie`/`donut` que declara `props.label`, `props.xAxisLabel` o `props.yAxisLabel`, la validación previa al render rechaza el config con diagnóstico sobre la ruta exacta.
- Desde el editor visual, insertar un `chart` desde la paleta, cambiar su tipo entre las seis variantes y configurar sus datos/fuente y color (cuando aplica) sin necesidad de editar Monaco produce un config válido y un render coherente con lo configurado.

## Casos límite
- Fuente dinámica cuya query aún no se ha ejecutado o no tiene datos: cero puntos, sin error.
- Fuente dinámica cuya query resuelve en estado `error`: comportamiento gobernado por `queryStateFeedback` si el nodo lo declara; si no lo declara, degrada a cero puntos sin romper el render del resto del chart.
- Lista estática vacía (`[]`): el chart se renderiza sin puntos.
- `pie`/`donut` con más de seis categorías: la paleta cerrada de seis colores se repite por ciclo, mismo criterio que la asignación cíclica de `map` para más de seis fuentes.
- `props.label` declarado como cadena vacía (`''`): se trata igual que ausente — sin entrada de leyenda, tooltip sin cabecera.
- `props.xAxisLabel` declarado sin `props.yAxisLabel` (o viceversa): cada título se evalúa de forma independiente; el eje sin título declarado se renderiza sin título propio, con normalidad.
- Cambiar el tipo de chart en el editor visual entre una variante categórica y `scatter` descarta los datos/fuente ya declarados por tener forma incompatible, en vez de intentar convertirlos.
- Selector de tipo de chart en el editor visual: al ser un enum de seis valores, por encima del umbral de cinco que activa el toggle de segmentos ya usado por `badge`/`stat`/`divider`/`skeleton`, se muestra como `<select>` estándar salvo que se decida una excepción explícita en `design.md`.

## Riesgos o preguntas abiertas
- Contrato técnico exacto de `props` (nombres de campos, shape de los puntos estáticos, shape de la fuente dinámica y sus rutas de categoría/valor/`x`/`y`, valor por defecto de altura y de color) — pendiente de `generate-feature-design`.
- Estrategia de carga de `Recharts` (peso real de bundle, si necesita el mismo tipo de ajuste de tree-shaking que `leaflet`) — pendiente de `generate-feature-design`.
- Diseño exacto de los widgets dedicados del editor visual para el bloque de datos estáticos y la fuente dinámica (p. ej. tabla editable de puntos vs. editor genérico de array de objetos) — pendiente de `generate-feature-design`.
- Si conviene declarar el selector de tipo de chart como excepción al umbral de cinco valores del toggle de segmentos (mostrarlo igualmente como segmentos pese a tener seis) o dejarlo como `<select>` estándar — pendiente de `generate-feature-design`.
- Extender la interactividad más allá de tooltip/leyenda (click en un punto/barra/porción disparando una acción del catálogo) queda deliberadamente fuera de v1, pero no descartado: si se retoma, requiere una feature separada que amplíe el contrato de acciones del nodo.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): nuevo nodo `chart`.
- Config (`config/`): nuevo tipo de nodo soportado en el schema y su validación previa al render.
- Queries (`queries/`): consumo de `queries.*` como origen dinámico de datos, reutilizando el modelo de estado existente.
- Desarrollo local (`development/`): panel de propiedades del editor visual (`dev-mode-editor.md`), con soporte completo para `chart`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva entrada en el catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/chart.md`.
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nueva sección describiendo el soporte de `chart` en el panel de propiedades (selector de tipo, selector de origen, widgets de datos/fuente).
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" si cambia la última feature relevante del área.
