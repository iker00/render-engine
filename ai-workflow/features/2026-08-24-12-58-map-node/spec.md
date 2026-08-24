# Spec: nodo `map`

## Objetivo
Añadir un nuevo nodo `map` al catálogo del runtime que permita mostrar un mapa interactivo basado en OpenStreetMap, con un punto de vista inicial configurable (Pamplona como valor por defecto) y marcadores que pueden declararse de forma estática en el JSON de configuración o alimentarse dinámicamente desde una o varias `queries.*`.

## Alcance
- Nuevo nodo `map` en el catálogo, hoja visible sin `children`, con contrato basado en `props` siguiendo el mismo patrón que el resto del catálogo.
- Renderizado del mapa base con tiles de OpenStreetMap vía Leaflet/react-leaflet, sin necesidad de API key ni cuenta de pago.
- Configuración de centro inicial (`lat`/`lng`), con Pamplona como valor por defecto cuando no se declara.
- Configuración de nivel de zoom inicial, con un valor por defecto razonable de vista de ciudad cuando no se declara.
- Interacción estándar de pan y zoom habilitada por defecto (arrastre, rueda del ratón, controles +/-), como en cualquier visor de mapa embebido.
- Dos modos de origen de marcadores por instancia del nodo (si ambos se declaran a la vez, prevalece el dinámico):
  - **Estático**: lista literal de marcadores en el JSON, cada uno con posición y etiqueta.
  - **Dinámico**: una o varias fuentes simultáneas, cada una apuntando a una colección resuelta desde `queries.*`, análogo al patrón `items.source`/`items.key` de `repeater`, extrayendo posición y etiqueta de cada elemento.
- Diferenciación visual (color/icono) por fuente dinámica cuando hay más de una fuente activa en la misma instancia.
- Al pulsar un marcador se muestra un popup con su etiqueta/texto asociado; sin acciones del catálogo de acciones.
- Integración con las capacidades transversales ya soportadas por cualquier nodo del catálogo: `layout.span`, `visibility` y `queryStateFeedback` (aplicado cuando el origen es dinámico y depende de una query en `loading`/`error`/vacío).

## Fuera de alcance
- Marcadores interactivos añadidos, movidos o eliminados por el usuario en runtime.
- Combinar en la misma instancia marcadores estáticos y dinámicos.
- Acciones del catálogo (`navigateTo`, `openModal`, `executeOperation`, etc.) al pulsar un marcador.
- Clustering de marcadores, líneas, polígonos, capas adicionales, geolocalización del usuario, cálculo de rutas o distancias.
- Selección de un proveedor de tiles distinto de OpenStreetMap, estilos de mapa alternativos o soporte offline.
- Soporte en el editor visual (`dev-editor`) para configurar el nodo `map` desde un panel de propiedades. Se aborda, si se decide necesario, en una feature separada posterior, siguiendo el patrón ya usado para otros nodos y paneles del editor.

## Requisitos funcionales
1. El runtime reconoce `map` como tipo de nodo válido dentro del catálogo; no admite `children`.
2. `props.center` es opcional; cuando se omite, el runtime usa Pamplona como centro inicial.
3. `props.zoom` es opcional; cuando se omite, el runtime usa un nivel de zoom por defecto de vista de ciudad.
4. El nodo declara una altura de renderizado explícita (obligatoria o con valor por defecto razonable cuando se omite), dado que un mapa sin altura definida no es renderizable.
5. El mapa permite pan y zoom mediante interacción estándar del usuario, sin disparar red ni modificar `queries.*`, formularios ni navegación.
6. El nodo admite dos orígenes de marcadores por instancia: una lista estática literal, o una o varias fuentes dinámicas desde `queries.*`. Si el config declara ambos orígenes a la vez, prevalece el origen dinámico (`markerSources`) y la lista estática (`markers`) se ignora, sin rechazar el config.
7. Cada marcador estático declara posición (`lat`/`lng`) y una etiqueta de texto.
8. Cada fuente dinámica declara una colección resuelta desde `queries.{queryName}.data` (o una ruta anidada bajo ella), y cómo extraer posición y etiqueta de cada elemento de esa colección, análogo al patrón `items.source`/`items.key` de `repeater`.
9. Cuando hay más de una fuente dinámica activa en la misma instancia, cada fuente puede diferenciarse visualmente (color/icono) del resto.
10. Al pulsar un marcador se muestra un popup con su etiqueta/texto; no dispara ninguna acción del catálogo de acciones.
11. Un elemento de una fuente dinámica cuya posición no resuelve a coordenadas válidas se omite silenciosamente del mapa, sin romper el render del resto de marcadores (degradación análoga a como `repeater` omite iteraciones con key inválida).
12. `map` admite `layout.span`, `visibility` y `queryStateFeedback` siguiendo las reglas transversales ya vigentes para el resto del catálogo.
13. Cuando el origen es dinámico, la query subyacente está en `loading`, `error` o resuelve vacía, y el nodo declara `queryStateFeedback`, el runtime aplica el feedback declarado sobre el nodo `map` igual que en el resto del catálogo.

## Requisitos no funcionales
- La librería de mapas debe ser 100% gratuita y no requerir API key ni cuenta de pago: Leaflet + tiles de OpenStreetMap.
- El uso de tiles de OpenStreetMap debe respetar la política de uso razonable del proyecto OSM (sin volumen ni patrón de tráfico que la incumpla).
- El nodo debe convivir con el resto del catálogo sin romper el umbral mínimo de cobertura del 80% sobre `src/` que exige el proyecto.
- El peso añadido al bundle por la nueva dependencia debe evaluarse y, si es significativo, considerarse una estrategia de carga acotada; el detalle técnico se resuelve en `design.md`.

## Criterios de aceptación
- Dado un config sin `props.center`, el mapa se centra inicialmente en Pamplona.
- Dado un config con `props.center` explícito, el mapa se centra en esas coordenadas.
- Dado un config con marcadores estáticos, el mapa renderiza un marcador por cada entrada declarada, en la posición y con la etiqueta indicadas.
- Dado un config con una fuente dinámica apuntando a una query con datos, el mapa renderiza un marcador por cada elemento de la colección resuelta, con la posición y etiqueta extraídas según lo declarado.
- Dado un config con dos fuentes dinámicas simultáneas, los marcadores de cada fuente son visualmente distinguibles entre sí.
- Dado un config que combina marcadores estáticos y dinámicos en la misma instancia de `map`, la validación previa al render rechaza el config completo con diagnóstico sobre la ruta exacta.
- Dado un elemento de una fuente dinámica sin coordenadas válidas, ese elemento no se renderiza como marcador y el resto del mapa se renderiza con normalidad.
- Al pulsar un marcador se muestra su etiqueta en un popup; no se dispara ninguna acción de navegación, apertura de modal ni ejecución de operación.
- El usuario puede desplazar (pan) y hacer zoom sobre el mapa mediante las interacciones estándar del navegador/librería.

## Casos límite
- Fuente dinámica cuya query aún no se ha ejecutado o no tiene datos: cero marcadores, sin error.
- Fuente dinámica cuya query resuelve en estado `error`: comportamiento gobernado por `queryStateFeedback` si el nodo lo declara; si no lo declara, degrada a cero marcadores de esa fuente sin romper el render del resto del mapa.
- Lista estática vacía (`[]`): el mapa se renderiza sin marcadores.
- Coordenadas fuera de rango válido (`lat` fuera de -90/90, `lng` fuera de -180/180): tratadas como inválidas, marcador omitido.
- Varios marcadores en la misma posición exacta: se renderizan superpuestos sin clustering ni agrupación (fuera de alcance de v1 resolverlo visualmente).
- `props.zoom` fuera de los límites soportados por la librería: comportamiento exacto (clamp vs rechazo en validación) pendiente de definir en `design.md`.

## Riesgos o preguntas abiertas
- Contrato técnico exacto de `props` para declarar el centro, el origen estático, las fuentes dinámicas múltiples y su estilo por fuente (nombres de campos, shape de `icon`/`color`, altura del nodo) — pendiente de `generate-feature-design`.
- Estrategia de carga de la dependencia Leaflet (bundle síncrono vs carga diferida) y su impacto en el bundle del runtime — pendiente de `generate-feature-design`.
- Comportamiento exacto ante `error` de query en una fuente dinámica cuando el nodo no declara `queryStateFeedback`: confirmar en diseño si sigue el patrón de degradación silenciosa de `repeater` o necesita uno propio.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): nuevo nodo `map`.
- Config (`config/`): nuevo tipo de nodo soportado en el schema y su validación previa al render.
- Queries (`queries/`): consumo de `queries.*` como origen dinámico de marcadores, reutilizando el modelo de estado existente.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva entrada en el catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/map.md`.
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" si cambia la última feature relevante del área.
