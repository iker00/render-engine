> Cuándo leer: precargas declaradas por página, firma estable de request, comportamiento por `pageEntry`, snapshot común, latest-only, limpieza fresca selectiva, precargas globales de aplicación (`preloads` raíz), reintentos acotados.
> Tamaño: medio.
> Relacionados: [[state-model.md]], [[execution.md]], [[../navigation/navigate-actions.md]], [[../forms/defaults.md]], [[../config/structure.md]].

# Precargas (`preloads`)

Existen dos mecanismos de precarga, complementarios y con ciclos de vida distintos: precargas por página (`pages[].preloads`, descritas primero) y precargas globales de aplicación (`preloads` raíz, ver más abajo).

## Modelo declarativo
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.
- Cada preload declara su `operationName` y puede añadir `query`, `body` y `headers` con la misma semántica de `executeOperation`.
- Cada preload puede declarar opcionalmente `when` con el mismo shape que `visibility`: `{ reference, operator, value? }` para condicionarse y ejecutarse solo si se cumple la condición.
- Cada preload puede declarar opcionalmente `blocking: boolean` para indicar si debe retrasar el render de la página hasta que resuelva (ver más abajo).

## Tanda agregada y `pageEntry`
- Cada entrada de página crea una tanda agregada con `entryId`, `pageId`, `params`, `preloadNames` y `status`.
- El agregado distingue `idle | loading | success | error`.
- `idle` representa explícitamente la entrada actual sin precargas que ejecutar.
- Antes de ejecutar una tanda, el runtime resuelve cada preload contra un snapshot común del estado ya preparado para esa entrada y deriva una firma estable de request a partir del método, endpoint, `query`, `body` y `headers` efectivos.

## Evaluación condicional (`when`)
- Al entrar a una página, el runtime evalúa el predicado `when` de cada preload contra el estado activo en ese momento.
- Si la condición no se cumple, el preload se omite silenciosamente y no se ejecuta.
- Un preload omitido por su condición `when` no aparece en `pageEntry.preloadNames` ni contribuye a `pageEntry.status`.
- Si todos los preloads de una página son omitidos por sus condiciones `when`, `pageEntry.status` queda en `idle`.
- Las referencias válidas en `when` son: `forms.*`, `queries.*` y `params.*`.
- `item.*` no es una referencia válida en preloads (no existe contexto de item a nivel de página); el config se rechaza en bootstrap con ruta exacta.
- Los operadores y el shape de condición son idénticos a los de `visibility`: `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`.

## Bloqueo de renderizado por precargas (`blocking`)
- Cada preload puede declarar opcionalmente `blocking: true` (default `false`) para indicar que debe retrasar la visualización de contenido hasta que resuelva.
- Cuando al menos una preload no omitida por `when` de una tanda está marcada `blocking: true`, el runtime retrasa el render del layout de la página hasta que **todas** las precargas bloqueantes de esa tanda dejen de estar en `loading` (éxito o error).
- Mientras el render está retrasado, se muestra un indicador de carga genérico, fijo y no configurable, en el lugar del contenido retrasado. El indicador está marcado con `role="status"` para accesibilidad.
- Una preload bloqueante que termina en `error` desbloquea el render igual que si hubiera terminado en `éxito`: el contenido se renderiza y el error se refleja en `queryStateFeedback` del nodo que consuma esa query, sin bloquear indefinidamente.
- Las precargas no marcadas como bloqueantes de la misma tanda no retrasan el render, incluso coexistiendo con precargas bloqueantes. Siguen ejecutándose en paralelo y su estado se consume normalmente por `queryStateFeedback`.
- El bloqueo solo aplica en el momento de creación de la tanda (nueva `pageEntry` al entrar en la página). Reevaluaciones posteriores de una preload bloqueante ya visible dentro de la misma entrada (por cambios en `forms.*` o `queries.*` que alteren su request efectiva) no vuelven a ocultar contenido ya renderizado.
- Una preload bloqueante omitida por su condición `when` no bloquea el render (se trata como si no existiera para esa entrada).

## Reevaluación selectiva por firma
- Si una firma efectiva coincide con la firma ya visible en `queries.{operationName}`, ese preload no se relanza automáticamente ni abre una nueva carga artificial por sí solo.
- La evaluación del predicado `when` ocurre antes de derivar la firma de request; si la condición no se cumple, el preload se omite sin comparar firmas.
- El arranque de una tanda con `preloads` prepara primero la nueva `pageEntry` en un único paso observable: limpia solo las queries incluidas en el subconjunto realmente relanzado y las deja directamente en `loading`.
- Esa preparación ocurre antes del primer render útil de la nueva entrada, así que cualquier consumidor de `queries.*` ve estado limpio o `loading`, nunca el `data` exitoso de otra entrada previa para esas mismas precargas.
- La preparación previa no introduce un paso visible por `idle` para esa nueva tanda.

## Paralelismo y latest-only
- Las operaciones de una misma tanda se lanzan en paralelo.
- Si al menos una precarga falla, el agregado final queda en `error`, pero las queries exitosas conservan sus datos.
- El agregado es latest-only: una tanda antigua puede seguir cerrando sus queries individuales, pero no puede reescribir el resultado agregado de una entrada más reciente.

## Snapshot común
- Todas las precargas de una misma tanda resuelven sus referencias contra un snapshot común del estado ya preparado para esa entrada.
- Ese snapshot ya incluye los params efectivos de la entrada activa, leídos desde la URL canónica o desde navegación interna equivalente, por lo que una precarga puede reutilizar `params.*` sin lógica imperativa adicional.
- La comparación automática también puede reaccionar a cambios de `forms.*` o `queries.*` si esos valores alteran la request efectiva de un preload ya visible en la misma entrada.
- Esta política de limpieza fresca queda limitada al mecanismo automático de `pages[].preloads`; una ejecución manual de la misma operación sigue pudiendo recargar en `loading` conservando su último `data` válido.

## Precargas globales de aplicación (`preloads` raíz)

- La configuración admite un bloque raíz opcional `preloads`, hermano de `api`/`pages`/`initialPage`, con el shape descrito en [[../config/structure.md]] (sin `when`, sin `item.*`).
- Se dispara en paralelo exactamente una vez por instancia de runtime montada (una carga de la SPA en memoria): no depende de `initialPage`, no se liga a ninguna `pageEntry` y no se relanza al navegar internamente entre páginas dentro de la misma carga. Recargar el navegador o abrir una pestaña nueva es una instancia nueva y vuelve a dispararlo; no hay persistencia entre recargas ni entre sesiones.
- **Comportamiento sin bloqueo (default)**: la página inicial se renderiza de inmediato. Antes de que se emita ninguna request, el runtime siembra `queries.{operationName}` en `status: 'loading'` para cada entrada del bloque raíz, así que cualquier `queryStateFeedback` sobre esas queries ya refleja `loading` desde el primer render.
- **Comportamiento con bloqueo**: si al menos una preload del bloque raíz está marcada `blocking: true`, el runtime retrasa el render inicial de la aplicación hasta que todas las precargas bloqueantes de ese bloque resuelvan (éxito o error), mostrando un indicador de carga genérico en su lugar. Las precargas no bloqueantes siguen ejecutándose en paralelo y su estado se consume normalmente por `queryStateFeedback`.
- Cada operación referenciada actualiza `queries.{operationName}` con la misma semántica de estado (`status`, `data`, `error`, `requestSignature`) que cualquier otra ejecución de operación; cualquier página o nodo puede consumirla con las referencias `queries.*` ya soportadas.
- **Reintentos acotados**: si una operación del `preloads` global falla, el runtime la reintenta automáticamente sin espera entre intentos, hasta un máximo de 3 intentos totales (intento inicial + 2 reintentos). La política se aplica de forma uniforme a cualquier `code` de error, incluidos los deterministas (`operation-not-found`, `request-build-failed`): no existe una categoría separada de errores "reintentables". Si tras el tercer intento la operación sigue en error, la query queda en `status: 'error'` con el `code` del último fallo y no se reintenta más durante esa misma carga. Una operación que tiene éxito en cualquier intento no continúa reintentándose. Esta política de reintentos es exclusiva del `preloads` global: `pages[].preloads`, `executeOperation` y `executeOperations` siguen haciendo un único intento por disparo.
- **Dedup con `pages[].preloads`**: un mismo `operationName` puede aparecer a la vez en el `preloads` global y en `pages[].preloads` de una página. Si la request efectiva coincide (misma firma), no se dispara una segunda request en la primera carga; ambas rutas comparten el mismo `queries.{operationName}` y siguen la política ya vigente de reevaluación selectiva por firma. Si las requests efectivas divergen, sí se emiten ambas. El retraso de render de cada bloque (aplicación y página) se evalúa de forma independiente según su propia declaración de `blocking`: si la raíz tiene `blocking: true` pero la página no, el indicador de carga genérico de la aplicación aparecerá antes que el de la página.
- **Ejecución manual concurrente**: las operaciones también declaradas en el `preloads` global siguen siendo relanzables manualmente (`executeOperation`/`executeOperations` desde botón o submit) sin restricción adicional. Ambas ejecuciones conviven sin coordinación nueva; la que complete último es la que queda reflejada en `queries.{operationName}` (latest-only, igual que el resto del runtime).
- No introduce ninguna pantalla de carga ni de error a nivel de aplicación distinta de la ya existente por query: es puramente un mecanismo de datos, consumido con el feedback ya existente por query, más un indicador de carga genérico temporal cuando hay bloqueo.
