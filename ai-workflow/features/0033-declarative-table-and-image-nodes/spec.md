# Spec: Declarative table and image nodes

## Objetivo
Ampliar el catálogo declarativo del runtime con un nodo `table` y un nodo `image` para cubrir dos necesidades frecuentes de lectura sin obligar a construir React específico por pantalla: mostrar tablas simples con cabeceras y filas declaradas, y mostrar imágenes con texto alternativo reutilizando la misma frontera de referencias dinámicas ya soportada por el runtime.

## Alcance
- Añadir un nodo `table` orientado a tablas básicas de lectura dentro del árbol `layout`.
- Permitir que `table` declare sus cabeceras y sus filas de forma completamente manual o a partir de una colección dinámica ya disponible en el runtime.
- Mantener la tabla como una superficie de lectura estructurada, pensada para mostrar datos tabulares simples con varias columnas.
- Añadir un nodo `image` orientado a mostrar una imagen única con `src` y `alt`.
- Permitir que `image` use valores literales o referencias completas ya soportadas por el runtime cuando el origen del dato dependa del estado actual.
- Mantener compatibilidad con las capacidades transversales ya existentes del runtime, como `queryStateFeedback` y `visibility`.

## Fuera de alcance
- Convertir `table` en una tabla avanzada con ordenación, paginación, filtros, búsqueda, selección de filas, acciones por fila, edición inline, agrupación o virtualización.
- Introducir plantillas arbitrarias por celda, componentes enriquecidos dentro de celdas o un mini lenguaje de render específico para tablas.
- Añadir carga remota propia para `image`, galerías, carruseles, zoom, crop, lightbox, lazy loading configurable o gestión de fallos visuales avanzada.
- Abrir theming declarativo, alineaciones visuales configurables por celda o una API visual paralela para estas nuevas piezas.
- Sustituir casos donde ya encajan mejor otros nodos existentes, como `list` para colecciones de una sola dimensión o `repeater` para composiciones ricas por item.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Queries y feedback.

## Requisitos funcionales
- El runtime debe incorporar un nodo `image` dentro del catálogo estable de layout.
- `image` debe permitir declarar, como mínimo:
  - una fuente `src`
  - un texto alternativo `alt`
- `image.src` y `image.alt` deben admitir tanto valores literales como referencias runtime completas ya soportadas en otras superficies textuales del sistema.
- Si una referencia válida usada por `image` no resuelve valor utilizable en tiempo de render, el comportamiento debe degradar de forma segura sin romper la pantalla completa.
- El runtime debe incorporar un nodo `table` dentro del catálogo estable de layout.
- `table` debe permitir declarar explícitamente un conjunto ordenado de cabeceras de columna.
- `table` debe permitir un modo manual donde las filas queden definidas íntegramente en la configuración.
- `table` debe permitir un modo dinámico donde las filas se obtengan desde una colección ya disponible en `queries.{queryName}.data`, una ruta anidada bajo `queries.{queryName}.data.*` o `item.*` cuando la tabla viva dentro de un `repeater`.
- En el modo dinámico, cada fila debe poder proyectar sus columnas a partir del item actual de la colección usando la misma familia de referencias ya documentada por el runtime.
- La tabla debe respetar el orden declarado de las cabeceras y el orden efectivo de las filas resueltas.
- La tabla debe renderizar una estructura semántica de lectura por filas y columnas, manteniendo correspondencia clara entre cabeceras y celdas.
- Si la colección dinámica aún no existe, falla, no resuelve un array o contiene elementos parciales, la tabla no debe romper el render global; debe degradar a cero filas visibles o a celdas vacías según el dato disponible.
- La validación previa al render debe rechazar configuraciones incoherentes, incluyendo como mínimo:
  - nodos `image` sin `src` o sin `alt`
  - tablas sin cabeceras
  - tablas sin definición de filas
  - tablas que mezclen simultáneamente un modo manual y uno dinámico
  - tablas cuya definición de fila no conserve correspondencia estructural con las cabeceras declaradas
- `queryStateFeedback` debe poder seguir envolviendo o condicionando ambos nodos igual que el resto del catálogo soportado.
- `visibility` debe poder seguir mostrándolos u ocultándolos con la misma semántica ya existente.
- Una configuración que no use `table` ni `image` debe conservar el mismo comportamiento observable actual del runtime.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance acotado de la v1 y respetar que solo se incorporan tablas básicas, no tablas avanzadas.
- La terminología debe alinearse con la documentación vigente del runtime: `layout`, `queries.*`, `item.*`, `queryStateFeedback`, `visibility` y referencias completas.
- La solución debe seguir siendo producible desde backend con JSON simple y revisable, sin exigir componentes React específicos por pantalla.
- La validación debe seguir ocurriendo antes del render, con diagnósticos trazables del JSON en desarrollo.
- La capa visual de ambos nodos debe poder resolverse dentro de la baseline institucional actual del runtime y de la convención de `Tailwind CSS` ya vigente.
- La incorporación de `table` no debe convertirse implícitamente en un sistema paralelo de composición rica por fila; para ese caso debe seguir existiendo `repeater`.
- La incorporación de `image` no debe abrir una semántica nueva de interpolación parcial ni de resolución dinámica diferente a la ya establecida en el runtime.

## Criterios de aceptación
- Dada una página que declara un nodo `image` con `src` y `alt` literales válidos, el runtime renderiza la imagen dentro del flujo normal del layout.
- Dada una página que declara un nodo `image` con `src` o `alt` basados en una referencia completa soportada, el runtime resuelve esos valores contra el estado actual igual que en otras superficies equivalentes.
- Dada una tabla manual con cabeceras y filas fijas, el runtime renderiza todas las columnas y filas en el orden declarado.
- Dada una tabla dinámica alimentada por una colección de `queries.*`, el runtime renderiza una fila por cada item disponible y proyecta en cada columna el dato correspondiente al item de su fila.
- Dada una tabla dentro de un `repeater`, la definición dinámica puede consumir `item.*` del contexto iterado sin romper la semántica existente del runtime.
- Dada una colección dinámica ausente, no ejecutada o no coleccionable, la tabla no rompe la pantalla y se comporta como tabla sin filas visibles.
- Dada una colección con items parciales, la tabla conserva las filas resolubles y degrada solo las celdas cuyo valor no esté disponible.
- Dada una configuración inválida de `table` o `image`, el runtime rechaza el config antes del render con diagnóstico trazable.
- Dada una pantalla existente que no usa los nuevos nodos, su comportamiento observable no cambia.

## Casos límite
- Una tabla puede declarar cabeceras válidas pero resolver cero filas dinámicas.
- Una tabla dinámica puede recibir arrays de escalares o arrays de objetos; el contrato funcional debe seguir dejando claro cómo se proyecta cada celda sin exigir lógica arbitraria al consumidor.
- Una tabla puede vivir dentro de contenido condicionado por `queryStateFeedback` y mostrarse solo cuando la query origen ya está en `success`.
- Una tabla puede vivir dentro de un `repeater` y depender a la vez de `item.*` y de referencias globales del runtime.
- Una imagen puede depender de una referencia que todavía no tiene valor disponible cuando la pantalla empieza a renderizar.
- Una imagen puede declararse dentro de un bloque hoy oculto por `visibility` o sustituido por un `fallback` de `queryStateFeedback`.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes sobre el alcance: la tabla se limita a lectura básica y la imagen a representación simple con `src` y `alt`.
- La planificación deberá cerrar el shape exacto del contrato JSON de `table` para que el modo manual y el dinámico sean explícitos, pequeños y fáciles de validar sin abrir plantillas arbitrarias por celda.
- Conviene vigilar que la nueva tabla no invada el terreno de `list` ni de `repeater`; la implementación deberá preservar una frontera clara entre lista simple, tabla simple y composición rica por item.
- Conviene vigilar que `image` mantenga un comportamiento seguro cuando `src` no resuelva un valor final utilizable, evitando roturas globales de render o diagnósticos poco claros.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
