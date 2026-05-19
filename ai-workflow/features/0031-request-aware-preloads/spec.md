# Spec: Request-aware preloads

## Objetivo
Rediseñar `preloads` para que cada carga automática de página pueda declarar la request efectiva que debe ejecutar y para que la política de reejecución se decida por la identidad resuelta de esa request, no solo por el nombre de la operación declarada en `api`.

## Alcance
- Redefinir el contrato de `pages[].preloads` para que cada entrada sea siempre un objeto declarativo cuyo nombre identifica la operación base y cuyo valor puede declarar explícitamente `query`, `body` y `headers`.
- Hacer que la request efectiva de un preload se construya con la misma semántica base ya vigente para `executeOperation`: combinación entre operación `api` y parámetros por ejecución, seguida de resolución de referencias contra un snapshot único de la `pageEntry`.
- Definir una identidad observable de request para cada preload a partir de la request efectiva ya resuelta, de modo que el runtime pueda comparar si una reentrada está pidiendo realmente la misma carga o una distinta.
- Cambiar la política funcional de reejecución de `preloads` para que una misma entrada visible no relance automáticamente cargas cuyo request efectivo no cambió, y sí relance aquellas cuyo request efectivo cambió.
- Dejar explícitamente preparado el terreno para una futura caché por request, sin introducirla todavía en esta iteración.

## Fuera de alcance
- Permitir varias instancias simultáneas del mismo `operationName` dentro de una misma página o una misma tanda de `preloads` con firmas distintas.
- Introducir una caché reutilizable por firma de request, persistencia de resultados históricos o lectura directa de datos viejos cuando la firma coincida.
- Exponer todavía un nuevo namespace declarativo de referencias para leer la firma de request, la caché o un estado agregado por preload.
- Cambiar la superficie visible principal de resultados de query: `queries.{operationName}` sigue siendo el único punto de lectura declarativo de `status`, `data` y `error`.
- Añadir políticas declarativas avanzadas de concurrencia, cancelación, prioridades, dependencias, secuencialidad o deduplicación global fuera del ciclo de `preloads`.
- Cambiar la semántica de ejecuciones manuales disparadas desde `button.props.action` o `form.submitAction`, salvo donde compartan la misma lógica de composición de request.

## Requisitos funcionales
- Cada página puede declarar `preloads` solo como una lista ordenada de objetos.
- Cada objeto de `preloads` debe contener exactamente una clave no vacía que identifica el `operationName` a ejecutar.
- El valor asociado a esa clave puede ser:
  - un objeto vacío `{}` cuando el preload no necesita parámetros adicionales
  - un objeto con `query`, `body` y/o `headers` cuando el preload sí necesita ajustar la request efectiva
- El nombre de la clave del preload actúa como vínculo obligatorio con una operación existente en `api`.
- El shape funcional de `query`, `body` y `headers` dentro de un preload debe seguir exactamente las mismas reglas ya soportadas para una operación `executeOperation`:
  - `query` admite solo valores finales `string | number | boolean`
  - `body` admite cualquier árbol JSON serializable
  - `headers` admite solo valores finales string
  - referencias completas y strings escapados reutilizan la convención central del runtime
- La combinación entre la operación base declarada en `api` y los parámetros del preload debe seguir la misma semántica estable ya documentada:
  - `query` combina por clave con precedencia del preload
  - `headers` combina por clave con precedencia del preload
  - `body` conserva el body base si el preload no aporta otro; si ambos son objetos en raíz, el merge es superficial con precedencia del preload; si alguna capa usa raíz no objeto, el body del preload sustituye al body base completo
- Todas las referencias dinámicas dentro de un preload deben resolverse contra un snapshot único y común de la `pageEntry` activa, igual para toda la tanda automática de esa entrada.
- El runtime debe derivar una firma estable de request por cada preload a partir de su request efectiva resuelta, incluyendo como mínimo:
  - `operationName` derivado de la clave del objeto declarativo
  - método efectivo
  - endpoint efectivo
  - `query` efectivo
  - `body` efectivo
  - `headers` efectivos
- La firma debe ser sensible a cambios reales de request y estable ante diferencias no funcionales de orden en objetos equivalentes, para que dos requests iguales produzcan la misma identidad observable.
- La política de reejecución automática de `preloads` debe compararse por firma resuelta de request y no solo por `operationName` ni por `pageId`.
- Si la `pageEntry` activa vuelve a evaluarse y un preload conserva la misma firma efectiva que en la última ejecución automática aplicable de esa misma entrada observable, el runtime no debe relanzar esa carga por mero rerender o por cambios internos no relacionados.
- Si la `pageEntry` activa genera una firma distinta para un preload previamente observado, el runtime debe tratarlo como una carga nueva y relanzarlo automáticamente.
- La comparación por firma debe cubrir especialmente los cambios de `params.*`, `forms.*`, `queries.*` o `item.*` que afecten al request resuelto de ese preload.
- Una navegación a la misma página con los mismos params efectivos debe seguir siendo un no-op observable y no debe relanzar `preloads`.
- Una navegación a la misma página o a otra distinta cuyo preload resuelva ahora una request efectiva diferente debe relanzar la carga aunque el `operationName` sea el mismo.
- Si una página declara varios preloads, la comparación y la decisión de reejecución deben aplicarse preload a preload dentro de la tanda, no solo como decisión global de toda la página.
- Dentro de una misma página o tanda de `preloads`, un mismo `operationName` no puede aparecer varias veces, ni siquiera si las firmas declaradas o resueltas serían distintas.
- Si un preload declara una clave cuyo `operationName` no existe en `api`, el runtime debe mantener el comportamiento de error recuperable para `queries.{operationName}` y para el agregado `pageEntry`.
- Si faltan datos para resolver referencias de `query`, `body` o `headers` en un preload, debe mantenerse la semántica estable de `request-build-failed` sin emitir red.
- Cuando un preload sí deba relanzarse porque su firma cambió, la política actual de carga fresca por `pageEntry` debe seguir aplicando a esa carga: la query correspondiente se limpia antes del primer render útil de la nueva entrada y pasa directamente a `loading`.
- Cuando un preload no deba relanzarse porque su firma no cambió, esta iteración no obliga todavía a reutilizar activamente un dato cacheado por firma; solo fija la comparación por identidad como contrato necesario para soportar esa capacidad después.
- El estado agregado `pageEntry` debe seguir representando la tanda automática visible con `idle | loading | success | error`, pero su transición debe quedar alineada con las cargas efectivamente relanzadas según firma, no con una simple lista nominal por operación.
- La validación del config debe rechazar la forma histórica de `preloads` como lista de strings y exigir siempre el shape objeto acordado.

## Requisitos no funcionales
- El contrato ampliado de `preloads` debe seguir siendo generable desde backend legacy sin exigir un DSL nuevo de expresiones; un caso sin parámetros debe poder expresarse de forma compacta como `{ "loadUser": {} }`.
- La semántica debe ser coherente con las features ya cerradas de `0010`, `0018`, `0025`, `0029` y `0030`, reutilizando `pageEntry`, `params.*`, composición de request y carga fresca por reentrada cuando aplique.
- La identidad de request debe ser determinista, revisable y suficientemente estable como para convertirse en base de una futura caché por request sin redefinir de nuevo el contrato funcional.
- La feature debe mantener el alcance acotado: cerrar la comparación por firma y la declaración explícita de request en `preloads` sin convertir esta iteración en un subsistema completo de caché o de orquestación remota avanzada.
- La documentación y la validación del contrato deben dejar claro que `queries.{operationName}` sigue siendo una superficie única por nombre; por eso la multiplicidad simultánea del mismo `operationName` queda fuera de alcance.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Páginas y navegación.
- Queries y feedback.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/pages-and-navigation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`

## Criterios de aceptación
- Dada una página con `preloads: [{ "loadUser": {} }]`, la configuración es válida y el runtime dispara `loadUser` con la request efectiva derivada solo de `api.loadUser`.
- Dada una página con `preloads: [{ "loadUser": { "query": { "id": "params.userId" } } }]`, al entrar con `#/page?userId=1` el runtime construye la request efectiva combinando `api.loadUser` con ese `query` y dispara la carga automática correspondiente.
- Dada esa misma página, si el usuario reentra con `#/page?userId=2`, el runtime detecta que la firma efectiva cambió y relanza la carga automática.
- Dada esa misma página, si el usuario vuelve a una entrada con los mismos params efectivos y el preload resuelve exactamente la misma request, el runtime no debe relanzar la carga solo por rerender o reactivación no observable de la misma entrada.
- Dado un preload cuyo `query`, `body` o `headers` dependen de referencias ya soportadas, el runtime resuelve esas referencias con un snapshot único de la entrada activa antes de decidir su firma y su ejecución.
- Dado un preload que cambia solo un header efectivo, una clave de query efectiva o una rama del body efectivo, el runtime trata ese cambio como firma distinta y relanza la carga.
- Dado un preload que no cambia funcionalmente su request aunque el orden declarado de las claves del objeto sea diferente, el runtime conserva la misma firma observable y no relanza la carga por esa diferencia no funcional.
- Dada una página que declara dos preloads distintos, si solo cambia la firma efectiva de uno de ellos, el runtime relanza solo esa carga y mantiene la otra sin reejecución automática.
- Dada una página que declara dos veces la misma clave de `operationName` en `preloads`, aunque sea con distinto payload declarado, la validación rechaza esa configuración antes del render.
- Dado un preload con una clave de `operationName` inexistente, la query correspondiente termina en `error` con la semántica estable ya documentada y el agregado `pageEntry` refleja error de la tanda.
- Dado un preload con referencias no resolubles en `query`, `body` o `headers`, la ejecución falla con `request-build-failed` y no emite red.
- Dado un config que siga usando `preloads: ["loadUser"]`, la validación lo rechaza antes del render por usar el shape histórico ya retirado.
- Dado un preload cuya firma cambió entre dos entradas, la nueva entrada no expone transitoriamente el dato exitoso de la entrada anterior para esa query mientras la nueva carga está en curso.

## Casos límite
- Un preload puede no declarar ningún override y seguir dependiendo solo de la operación base en `api`; su firma sigue existiendo y se deriva igualmente de la request efectiva final.
- Un preload puede depender de `params.*` y de datos ya presentes en `forms.*` o `queries.*`; la identidad debe reflejar el valor realmente resuelto, no la referencia literal.
- Dos páginas distintas pueden reutilizar el mismo `operationName` con firmas de request distintas; siguen siendo entradas válidas siempre que no convivan duplicadas dentro de la misma tanda de `preloads`.
- Una página sin `preloads` o con `preloads: []` sigue sin disparar cargas automáticas.
- Si varias cargas de una tanda tienen firmas nuevas, pueden seguir ejecutándose en paralelo.
- Si ninguna firma efectiva requiere reejecución automática en la entrada observada, el runtime no debe inventar una tanda `loading` artificial solo por reevaluar la página.

## Riesgos o preguntas abiertas
- La feature deja intencionadamente pendiente la política exacta de reutilización de resultados cuando la firma coincida; esta iteración fija la comparación por identidad, no una caché funcional completa.
- El contrato deberá vigilar con claridad la convivencia entre la semántica de `pageEntry` y la comparación por firma para no reintroducir ambigüedad entre “misma entrada” y “misma request”.
- La futura caché por request tendrá que decidir si vive solo detrás de `preloads` o si amplía también ejecuciones manuales, pero esa decisión queda fuera de esta spec.
