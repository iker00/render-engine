# Spec: nodo `gallery`

## Objetivo
Añadir un nuevo nodo `gallery` al catálogo del runtime que muestre una colección de imágenes, con dos orígenes por instancia: manual (lista literal en el JSON) o dinámico (colección resuelta en tiempo de ejecución desde `queries.*` o `item.*`), y dentro del origen dinámico dos submodos de carga por foto: normal (URL directa extraída de cada elemento) o fetch (petición HTTP binaria por foto contra un endpoint configurado, igual que `image` en modo `fetch`, a partir de un id por elemento). El nodo admite dos formas de visualización configurables por instancia: paginada (todas las imágenes en una rejilla con paginación local) o carrusel (mostrando entre 1 y 3 imágenes visibles a la vez). Al pulsar una imagen se abre una vista ampliada (lightbox) que permite navegar entre el resto de imágenes de la galería. La configuración del nodo en el editor visual sigue el mismo patrón que el resto del catálogo, con un selector explícito de modo que muestra solo las propiedades relevantes del modo activo.

## Alcance
- Nuevo nodo `gallery` en el catálogo, hoja visible sin `children`, con contrato basado en `props` siguiendo el mismo patrón que el resto del catálogo.
- Dos orígenes de imágenes por instancia, mutuamente excluyentes (si se declaran ambos a la vez, se rechaza el config, igual que en `image`):
  - **Manual**: lista literal de imágenes en el JSON, cada una con `src` y `alt` siguiendo la misma convención de literal/referencia/interpolación que `image.props.src`/`image.props.alt`.
  - **Dinámico**: una única fuente que resuelve una colección en tiempo de ejecución, ya sea desde `queries.{queryName}.data` (o una ruta anidada bajo ella) o desde `item.*` (o una ruta anidada bajo `item`, cuando la galería vive dentro del `template` de un `repeater`), con una key de iteración con el mismo contrato que `repeater.props.items.key` (incluidos los literales reservados `$key`/`$index`). El origen dinámico tiene, a su vez, dos submodos de carga por foto, mutuamente excluyentes a nivel de instancia:
    - **Normal**: `src` extraído de cada elemento, misma semántica que `image.props.src`.
    - **Fetch**: cada elemento de la colección es un id primitivo directo, o un objeto del que se indica en qué propiedad está el id; se configura un endpoint (mismo contrato que `image.props.fetch`: `url`/`method`/`headers`/`body`) que se llama una vez por foto, con el id de cada elemento disponible para interpolarse dentro de esa configuración (igual mecanismo de referencia que el resto del runtime), para construir la petición binaria de cada foto.
- Dos modos de visualización por instancia, seleccionados explícitamente en el config (obligatorio elegir uno):
  - **Paginado**: todas las imágenes en una rejilla, con paginación local en cliente reutilizando el mismo modelo ya soportado por `repeater`/`table` (`pageSize`, variantes de controles `previousNext`/`numbered`/`scroll`).
  - **Carrusel**: entre 1 y 3 imágenes visibles simultáneamente, con navegación manual (flechas/dots), y avance automático (autoplay) y bucle (loop) configurables, ambos desactivados por defecto.
- Lightbox: al pulsar cualquier imagen visible (en modo paginado o carrusel) se abre una vista ampliada superpuesta con navegación (anterior/siguiente) entre todas las imágenes de la galería y cierre explícito (botón de cierre, clic fuera de la imagen, tecla Esc).
- Instalación de una librería externa gratuita y muy extendida para implementar la mecánica del carrusel (deslizamiento, navegación, autoplay, loop). Se evalúa y decide en `generate-feature-design`.
- Integración con las capacidades transversales ya soportadas por cualquier nodo del catálogo: `layout.span`, `visibility` y `queryStateFeedback` (aplicado cuando el origen es dinámico y depende de una query en `loading`/`error`/vacío).
- Soporte en el editor visual (`dev-editor`) para configurar el nodo `gallery` desde el panel de propiedades, siguiendo el mismo patrón ya usado por otros nodos con orígenes o modos mutuamente excluyentes: un selector explícito para elegir el modo activo (manual/dinámico, y dentro de dinámico, normal/fetch), mostrando en cada momento solo las propiedades de configuración del modo seleccionado.

## Fuera de alcance
- Subida, edición o eliminación de imágenes por el usuario en runtime.
- Combinar en la misma instancia imágenes de origen manual y dinámico.
- Múltiples fuentes dinámicas simultáneas en la misma instancia (a diferencia de `map`, `gallery` admite una única fuente dinámica).
- Mezclar, dentro de la misma fuente dinámica, fotos cargadas en submodo normal y fotos cargadas en submodo fetch: el submodo de carga se decide una única vez por instancia, igual que `image` decide entre `src`/`fetch` para todo el nodo.
- Mezclar, dentro de la misma colección en submodo fetch, elementos que son ids primitivos con elementos que son objetos: el shape de los elementos de la colección es homogéneo por instancia.
- Deshabilitar el lightbox por instancia: en v1 el click sobre una imagen siempre abre el lightbox, no es configurable.
- Zoom dentro del lightbox, gestos táctiles avanzados (pinch-to-zoom), descarga de imagen desde el lightbox.
- Acciones del catálogo (`navigateTo`, `openModal`, `executeOperation`, etc.) al pulsar una imagen; el lightbox es un comportamiento propio del nodo `gallery`, no una acción configurable.
- Paginación remota o cursor-based; la paginación del modo paginado es local en cliente, igual que en `repeater`/`table`.
- Un campo estructurado dedicado (p. ej. nombre de query param) que construya automáticamente la petición del modo `fetch`; el id de cada elemento se pone a disposición como valor referenciable y se interpola donde haga falta dentro de `url`/`headers`/`body`, igual que el resto de campos de `image.props.fetch`.

## Requisitos funcionales
1. El runtime reconoce `gallery` como tipo de nodo válido dentro del catálogo; no admite `children`.
2. Un nodo `gallery` debe declarar exactamente un origen de imágenes: manual o dinámico. Si declara ambos o ninguno, el config se rechaza antes del render sobre la ruta exacta.
3. En origen manual, cada entrada de la lista declara `src` y `alt` obligatorios, con la misma semántica de literal, referencia dinámica completa o interpolación `{{...}}` que `image.props.src`/`image.props.alt`.
4. En origen dinámico, la fuente declara la colección resuelta desde `queries.{queryName}.data` (o ruta anidada bajo ella) o desde `item.*` (o ruta anidada bajo `item`, cuando la galería vive dentro del `template` de un `repeater`), junto con la key de iteración (mismo contrato que `repeater.props.items.key`, incluidos los literales reservados `$key`/`$index`).
5. En origen dinámico, el nodo declara exactamente un submodo de carga por foto para toda la colección: normal o fetch. Si declara ambos submodos o ninguno, el config se rechaza antes del render.
6. En submodo normal, `src` se extrae de cada elemento con la misma semántica de literal/referencia/interpolación que `image.props.src`.
7. En submodo fetch, cada elemento de la colección resuelta es un id primitivo directo, o un objeto del que el config declara en qué propiedad está el id.
8. En submodo fetch, el nodo declara un endpoint con el mismo contrato que `image.props.fetch` (`url`/`method`/`headers`/`body`), llamado una vez por foto; el id de cada elemento está disponible para interpolarse dentro de esa configuración con el mismo mecanismo de referencias que el resto del runtime, de forma que cada foto puede construir una petición distinta.
9. En origen dinámico, `alt` es obligatorio y se extrae de cada elemento con la misma semántica que en origen manual, tanto en submodo normal como en submodo fetch.
10. Un nodo `gallery` debe declarar exactamente un modo de visualización: paginado o carrusel. Si lo omite, el config se rechaza antes del render.
11. En modo paginado, el nodo admite el mismo contrato de paginación local que `repeater.props.pagination` (`pageSize` obligatorio, `controls.variant` opcional entre `previousNext`/`numbered`/`scroll`), aplicado sobre la colección de imágenes resuelta.
12. En modo carrusel, el nodo admite un número de imágenes visibles simultáneamente configurable entre 1 y 3 (inclusive); valores fuera de ese rango se rechazan antes del render.
13. En modo carrusel, el autoplay es opcional y desactivado por defecto; cuando se activa, declara un intervalo de avance configurable.
14. En modo carrusel, el bucle (loop) es opcional y desactivado por defecto; cuando se activa, al llegar al final la navegación vuelve al principio (y viceversa navegando hacia atrás desde el principio).
15. En modo carrusel, el usuario puede navegar manualmente hacia adelante/atrás mediante controles visibles (flechas y/o indicadores), con independencia de si el autoplay está activo.
16. Al pulsar cualquier imagen renderizada (en modo paginado o carrusel) se abre un lightbox con esa imagen ampliada.
17. Dentro del lightbox, el usuario puede navegar a la imagen anterior/siguiente dentro del conjunto completo de imágenes de la galería (no solo las visibles en la página o el tramo de carrusel activo en ese momento).
18. El lightbox se cierra mediante un control explícito de cierre, al pulsar fuera de la imagen ampliada, o con la tecla Esc.
19. En submodo normal, un elemento cuyo `src` no resuelve a un string no vacío se omite silenciosamente de la galería, sin romper el render del resto, análogo a como `image` degrada a no render.
20. En submodo fetch, un elemento cuya petición está en curso, ha fallado (red, HTTP, blob inválido) o cuya respuesta no es un binario utilizable se omite silenciosamente de la galería, sin romper el render del resto, análogo a como `image` no renderiza ningún `<img>` en esos casos. Dentro de un `repeater`, cada iteración dispara sus propias peticiones `fetch` independientes con su contexto `item.*` resuelto.
21. `gallery` admite `layout.span`, `visibility` y `queryStateFeedback` siguiendo las reglas transversales ya vigentes para el resto del catálogo.
22. Cuando el origen es dinámico, la query subyacente (cuando la fuente es `queries.*`) está en `loading`, `error` o resuelve vacía, y el nodo declara `queryStateFeedback`, el runtime aplica el feedback declarado sobre el nodo `gallery` igual que en el resto del catálogo.
23. El editor visual expone un selector explícito para el modo de origen (manual/dinámico) y, dentro de dinámico, para el submodo de carga (normal/fetch); al cambiar de modo o submodo solo son visibles las propiedades de configuración correspondientes al modo/submodo seleccionado, siguiendo el mismo patrón visual que ya usan otros nodos del catálogo con orígenes o modos mutuamente excluyentes.

## Requisitos no funcionales
- La librería usada para el carrusel debe ser gratuita, sin necesidad de licencia de pago ni cuenta externa, y muy extendida en el ecosistema React. Elección concreta y estrategia de carga pendientes de `generate-feature-design`.
- El nodo debe convivir con el resto del catálogo sin romper el umbral mínimo de cobertura del 80% sobre `src/` que exige el proyecto.
- El peso añadido al bundle por la nueva dependencia del carrusel debe evaluarse y, si es significativo, considerarse una estrategia de carga acotada (por ejemplo code-splitting), igual que se hizo para `map`; el detalle técnico se resuelve en `design.md`.
- El lightbox debe ser accesible por teclado como mínimo para su cierre (tecla Esc).

## Criterios de aceptación
- Dado un config con lista manual de imágenes, la galería renderiza una imagen por cada entrada declarada, con el `src`/`alt` indicados.
- Dado un config con fuente dinámica en submodo normal apuntando a una query con datos, la galería renderiza una imagen por cada elemento de la colección resuelta, con `src`/`alt` extraídos según lo declarado.
- Dado un config que combina origen manual y dinámico en la misma instancia, la validación previa al render rechaza el config completo con diagnóstico sobre la ruta exacta.
- Dado un modo paginado con `pageSize` declarado, la galería muestra como máximo `pageSize` imágenes por página y expone los controles de paginación de la variante configurada.
- Dado un modo carrusel con número de imágenes visibles entre 1 y 3, la galería muestra ese número de imágenes simultáneamente y permite navegar manualmente entre el resto.
- Dado un modo carrusel con autoplay activado, las imágenes avanzan automáticamente según el intervalo configurado, sin bloquear la navegación manual.
- Dado un modo carrusel con loop activado, al llegar a la última imagen la navegación hacia adelante vuelve a la primera.
- Dado un modo carrusel sin loop, al llegar a la última imagen no hay avance adicional posible hacia adelante (o los controles de avance quedan deshabilitados).
- Al pulsar cualquier imagen, se abre el lightbox mostrando esa imagen ampliada.
- Dentro del lightbox, el usuario puede navegar a la imagen anterior/siguiente del conjunto completo de la galería.
- El lightbox se cierra con el control de cierre, con clic fuera de la imagen, o con la tecla Esc.
- Dado un origen dinámico en submodo normal, un elemento sin `src` resoluble no se renderiza como imagen y el resto de la galería (incluida su paginación o su carrusel) se renderiza con normalidad.
- Dado un origen dinámico en submodo fetch con una colección de ids primitivos, la galería dispara una petición HTTP binaria por cada id, usándolo para construir la petición al endpoint configurado.
- Dado un origen dinámico en submodo fetch con una colección de objetos y una propiedad de id declarada, la galería extrae el id de esa propiedad en cada elemento y dispara una petición HTTP binaria por elemento, renderizando la imagen resultante cuando la respuesta es un binario utilizable.
- Dado un origen dinámico en submodo fetch, un elemento cuya petición está en curso, ha fallado o no es un binario utilizable no se renderiza como imagen y el resto de la galería se renderiza con normalidad.
- Dado un config que combina submodo normal y submodo fetch en el mismo origen dinámico (o ninguno de los dos), la validación previa al render rechaza el config completo con diagnóstico sobre la ruta exacta.
- Dado un nodo `gallery` con origen dinámico `item.*` dentro del `template` de un `repeater`, cada iteración del `repeater` renderiza su propia galería usando la colección de fotos de su propio item.
- Dado un nodo `gallery` abierto en el editor visual, cambiar el selector de modo de origen (manual/dinámico) o de submodo (normal/fetch) muestra únicamente las propiedades de configuración del modo/submodo recién seleccionado.

## Casos límite
- Colección de imágenes vacía (lista manual `[]`, o fuente dinámica sin datos): la galería se renderiza sin imágenes, sin controles de paginación ni de carrusel, y sin posibilidad de abrir lightbox.
- Fuente dinámica `queries.*` cuya query aún no se ha ejecutado o no tiene datos: cero imágenes, sin error.
- Fuente dinámica `queries.*` cuya query resuelve en estado `error`: comportamiento gobernado por `queryStateFeedback` si el nodo lo declara; si no lo declara, degrada a cero imágenes sin romper el render del resto del nodo.
- Fuente dinámica `item.*` usada fuera del subárbol de un `repeater`: degrada a cero fotos, sin error, igual que el resto de usos de `item.*` fuera de un `repeater`.
- Submodo fetch con un elemento objeto cuya propiedad de id declarada no resuelve a un valor utilizable: ese elemento se omite silenciosamente, sin disparar petición, igual que el resto de degradaciones por elemento inválido.
- Origen dinámico en submodo fetch con una colección grande: cada elemento dispara su propia petición independiente; el detalle de límite de concurrencia (si existe) se resuelve en `generate-feature-design`.
- Galería con una única imagen en modo carrusel: se renderiza esa imagen sin controles de navegación operativos (o deshabilitados), sin loop aplicable.
- Número de imágenes visibles configurado mayor que el número de imágenes disponibles: se muestran todas las disponibles sin espacios vacíos artificiales; comportamiento exacto (relleno vs recentrado) pendiente de `generate-feature-design`.
- Cambio de la colección resuelta en origen dinámico (por ejemplo tras refetch de la query o cambio de item): la posición del carrusel o de la paginación vuelve a su estado inicial, igual que en `repeater` paginado.
- Cambio de modo de origen o de submodo en el editor visual: la propiedad inactiva no se conserva; al volver al modo/submodo anterior, sus valores previamente editados no se recuperan (mismo comportamiento de "sustitución completa al cambiar de modo" que ya usan otros nodos del catálogo con selectores equivalentes).

## Riesgos o preguntas abiertas
- Contrato técnico exacto de `props` (nombres de campos, shape de origen manual/dinámico, shape de los submodos normal/fetch, shape de configuración de paginación/carrusel/lightbox) — pendiente de `generate-feature-design`.
- Elección concreta de librería de carrusel, evaluación de peso en bundle y estrategia de carga (síncrona vs diferida) — pendiente de `generate-feature-design`.
- Comportamiento exacto de accesibilidad por teclado dentro del carrusel y del lightbox más allá del cierre con Esc (navegación con flechas del teclado, foco atrapado) — pendiente de `generate-feature-design`.
- Comportamiento exacto cuando el número de imágenes visibles configurado supera el número de imágenes disponibles (relleno vs recentrado del carrusel) — pendiente de `generate-feature-design`.
- Estrategia de concurrencia/rendimiento cuando el origen dinámico usa submodo fetch con colecciones grandes (nº de peticiones HTTP simultáneas, si hay límite) — pendiente de `generate-feature-design`.

## Áreas de producto afectadas
- Catálogo de nodos (`nodes/`): nuevo nodo `gallery`.
- Config (`config/`): nuevo tipo de nodo soportado en el schema y su validación previa al render.
- Queries (`queries/`): consumo de `queries.*` como origen dinámico de imágenes, reutilizando el modelo de estado existente.
- Referencias (`references/`): uso de `item.*` como origen dinámico cuando `gallery` vive dentro del `template` de un `repeater`.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/nodes/index.md`: nueva entrada en el catálogo.
- Nueva ficha `ai-workflow/docs/app-features/nodes/gallery.md`.
- `ai-workflow/docs/app-features/nodes/repeater.md`: posible nota de cross-reference si `gallery` con origen `item.*` dentro de un `repeater` introduce algún matiz no cubierto ya por el contrato general de `item.*`.
- `ai-workflow/docs/current-state.md`: posible actualización de la fila de "Catálogo de nodos" si cambia la última feature relevante del área.
