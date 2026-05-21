# Spec: Image node API source

## Objetivo
Permitir que el nodo `image` pueda obtener su contenido a través de una llamada API declarativa propia, sin depender de un preload externo o de una acción manual previa, y manteniendo una configuración pequeña y familiar para el producto al reutilizar una gramática similar a la de los formularios.

La feature debe cubrir el caso de una imagen cuyo `src` y `alt` dependen de una petición remota que debe lanzarse automáticamente cuando el nodo entra en render visible, incluyendo la posibilidad de extraer esos valores desde rutas concretas de la respuesta cuando la API no devuelve directamente el shape final consumible por `image`.

## Alcance
- Ampliar el nodo `image` para que pueda declarar una llamada API propia.
- Hacer que esa llamada se ejecute automáticamente cuando el nodo `image` pase a renderizarse de forma visible.
- Mantener la nueva configuración alineada conceptualmente con la semántica ya existente de `form.submitAction`, reutilizando la misma idea de `operationName` más parámetros variables por ejecución.
- Permitir que la request declarada del `image` aporte `query`, `body` y `headers` con la misma familia de valores y referencias que hoy usan formularios y acciones.
- Permitir que el nodo declare de qué ruta de la respuesta remota debe salir el valor final de `src`.
- Permitir que el nodo declare de qué ruta de la respuesta remota debe salir el valor final de `alt` cuando no quiera usar un literal fijo.
- Mantener compatibilidad con `queryStateFeedback` y `visibility`, de modo que el disparo automático ocurra solo cuando el nodo realmente quede visible.
- Mantener la posibilidad actual de usar `image` sin llamada API propia, con `src` y `alt` literales o ligados a referencias ya existentes en el runtime.

## Fuera de alcance
- Convertir `image` en un nodo interactivo con acciones de click, submit, refresh manual o eventos arbitrarios.
- Introducir un sistema general de polling, refetch automático, caché histórica, cancelación configurable o reintentos específicos para imágenes.
- Añadir galerías, carruseles, crop, zoom, lightbox, placeholders visuales sofisticados o manejo avanzado de errores de carga del recurso de imagen en navegador.
- Abrir un mini lenguaje de transformación de respuestas, mapeos complejos por expresiones o plantillas parciales dentro de strings.
- Generalizar esta capacidad a todos los nodos del catálogo en la misma feature.
- Sustituir el papel de `pages[].preloads` cuando una pantalla completa ya necesita compartir los mismos datos entre varios nodos.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Queries y feedback.
- Catálogo declarativo de nodos.

## Requisitos funcionales
- El nodo `image` debe poder seguir funcionando en su modo actual sin llamada API propia.
- El nodo `image` debe poder declarar opcionalmente una configuración de carga remota propia para obtener sus datos.
- Esa configuración debe ser reconocible para quien ya configura formularios: una operación declarada por nombre y parámetros variables por ejecución, sin exigir una gramática nueva e independiente.
- La carga remota del nodo `image` debe ejecutarse automáticamente cuando el nodo entre en render visible por primera vez dentro de la entrada actual.
- Si el nodo deja de estar oculto por `visibility` o por `queryStateFeedback` y pasa a ser visible, la carga automática debe poder producirse en ese momento aunque antes no se hubiera disparado.
- La request declarada del nodo debe poder reutilizar `query`, `body` y `headers` con la misma semántica general ya soportada para `form.submitAction`, incluidas referencias completas del runtime donde ya apliquen.
- Dentro de un `repeater`, la request declarada del `image` también debe poder resolver `item.*` igual que hoy ocurre en otras superficies declarativas.
- La respuesta de la llamada remota debe quedar disponible de forma consistente en el dominio compartido de queries del runtime, sin crear un subsistema paralelo solo para imágenes.
- Varias instancias visibles de `image` deben poder lanzar la misma operación remota o reutilizar el mismo endpoint sin pisarse entre sí, incluso cuando existan varias imágenes simultáneas en pantalla.
- Si varias imágenes comparten operación base pero cambian sus parámetros efectivos por iteración, por `item.*` o por otra fuente declarativa, cada instancia debe poder resolver su propio resultado final sin sobrescribir el de otra instancia visible.
- Si varias imágenes comparten exactamente la misma request efectiva dentro de la misma entrada, la implementación posterior podrá optimizar ese caso, pero el comportamiento funcional observable debe seguir siendo estable y consistente para todas las instancias.
- El nodo `image` debe poder declarar una ruta de extracción para `src` dentro del resultado de la operación remota cuando la respuesta no exponga el valor directamente en la raíz útil.
- El nodo `image` debe poder declarar una ruta de extracción para `alt` dentro del resultado de la operación remota o, alternativamente, conservar un `alt` literal fijo cuando eso sea suficiente.
- Si la ruta declarada para `src` no resuelve un string utilizable, el nodo debe degradar de forma segura a no render de la imagen, sin romper el resto de la pantalla.
- Si la ruta declarada para `alt` no resuelve un string utilizable, el nodo debe degradar a `alt=""` o al literal fijo declarado, sin romper el render global.
- La validación previa al render debe rechazar configuraciones incoherentes del nuevo modo remoto del nodo `image`, incluyendo como mínimo:
  - una configuración remota sin `operationName`
  - una configuración remota que no defina de dónde sale el `src` final
  - combinaciones ambiguas donde no quede claro si `src` debe resolverse por la vía remota nueva o por la vía literal/dinámica existente
- Una imagen con carga remota propia debe poder convivir con `queryStateFeedback` para mostrar, ocultar o sustituir el nodo según el estado observable de la query implicada.
- Una configuración existente que no use esta nueva capacidad debe conservar el comportamiento observable actual del runtime.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance acotado de la v1: una imagen simple con carga automática declarativa, no un subsistema general de media remota.
- La terminología debe mantenerse alineada con la documentación vigente del runtime: `image`, `queries.*`, `queryStateFeedback`, `visibility`, `form.submitAction`, `operationName`, `query`, `body`, `headers` e `item.*`.
- La nueva capacidad debe seguir siendo producible desde backend con JSON simple, pequeño y revisable.
- La validación debe seguir ocurriendo antes del render y fallar con diagnósticos trazables cuando el shape sea incoherente.
- La documentación funcional debe dejar claro cuándo conviene usar esta carga propia de `image` y cuándo sigue encajando mejor resolver los datos mediante `preloads` compartidos.
- La semántica de extracción de `src` y `alt` debe ser explícita y acotada; no debe depender de heurísticas opacas sobre el shape de la respuesta.

## Criterios de aceptación
- Dada una imagen configurada sin llamada API propia, el runtime conserva el comportamiento actual de `src` y `alt`.
- Dada una imagen con configuración remota propia y visible al entrar en página, el runtime lanza automáticamente la operación declarada sin requerir un botón ni un submit previo.
- Dada una imagen inicialmente oculta que pasa a ser visible más tarde, la operación se dispara cuando el nodo queda visible por primera vez en esa entrada.
- Dada una imagen cuya request usa `query`, `body` o `headers` declarativos, el runtime los resuelve con la misma familia de referencias ya soportada por formularios y acciones.
- Dada una imagen dentro de un `repeater`, la request puede usar `item.*` para resolver parámetros distintos por iteración.
- Dadas varias imágenes visibles que usan el mismo endpoint u operación base al mismo tiempo, cada una conserva su resultado observable correcto y ninguna imagen deja a otra con un `src` o `alt` incorrecto por colisión de estado.
- Dada una respuesta remota donde la URL útil de la imagen vive en una ruta anidada, el nodo extrae el `src` desde la ruta declarada y renderiza la imagen resultante.
- Dada una respuesta remota donde el texto alternativo vive en otra ruta anidada, el nodo extrae el `alt` desde la ruta declarada; si no existe valor textual utilizable, degrada de forma segura.
- Dada una configuración remota incoherente del nodo `image`, el runtime rechaza el config antes del render con diagnóstico trazable.
- Dada una pantalla existente que no usa esta capacidad, su comportamiento observable no cambia.

## Casos límite
- Una imagen puede declarar carga remota propia y a la vez estar envuelta en `queryStateFeedback` basado en esa misma operación.
- Una imagen puede necesitar solo extraer `src` desde la respuesta y mantener `alt` como literal fijo.
- Una imagen puede vivir dentro de un `repeater` y disparar varias requests homónimas con parámetros efectivos distintos entre iteraciones.
- Una página puede mostrar diez o más imágenes que reutilizan el mismo endpoint al mismo tiempo, con o sin parámetros distintos por instancia.
- Una imagen puede pasar de oculta a visible varias veces dentro de la misma entrada; la implementación posterior deberá preservar una política estable y no sorprender con relanzamientos redundantes.
- La respuesta remota puede resolver correctamente la operación pero no contener una URL utilizable en la ruta declarada para `src`.
- Una pantalla puede mezclar imágenes con carga propia y otras imágenes alimentadas por `preloads` compartidos sin abrir dos semánticas incompatibles.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes: la imagen debe cargar automáticamente al hacerse visible y debe poder extraer `src` y `alt` desde rutas explícitas de la respuesta.
- La planificación debe resolver explícitamente cómo convivirá esta feature con el modelo actual de queries compartidas por nombre de operación para que varias imágenes simultáneas no colisionen aunque reutilicen el mismo endpoint.
- También conviene vigilar que la nueva superficie no duplique innecesariamente casos donde un `preload` compartido sigue siendo la opción más estable para varios consumidores de la misma respuesta.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
