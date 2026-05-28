> Cuándo leer: precargas declaradas por página, firma estable de request, comportamiento por `pageEntry`, snapshot común, latest-only, limpieza fresca selectiva.
> Tamaño: medio.
> Relacionados: [[state-model.md]], [[execution.md]], [[../navigation/navigate-actions.md]], [[../forms/defaults.md]], [[../config/structure.md]].

# Precargas (`preloads`)

## Modelo declarativo
- Las precargas se declaran a nivel de página.
- Se ejecutan al entrar en la página.
- La página puede depender de esos datos para mostrar su layout o bloques concretos.
- Cada preload declara hoy su `operationName` y puede añadir `query`, `body` y `headers` con la misma semántica de `executeOperation`.

## Tanda agregada y `pageEntry`
- Cada entrada de página crea una tanda agregada con `entryId`, `pageId`, `params`, `preloadNames` y `status`.
- El agregado distingue `idle | loading | success | error`.
- `idle` representa explícitamente la entrada actual sin precargas que ejecutar.
- Antes de ejecutar una tanda, el runtime resuelve cada preload contra un snapshot común del estado ya preparado para esa entrada y deriva una firma estable de request a partir del método, endpoint, `query`, `body` y `headers` efectivos.

## Reevaluación selectiva por firma
- Si una firma efectiva coincide con la firma ya visible en `queries.{operationName}`, ese preload no se relanza automáticamente ni abre una nueva carga artificial por sí solo.
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
