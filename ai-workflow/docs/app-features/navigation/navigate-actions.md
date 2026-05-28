> Cuándo leer: acciones declarativas `navigateTo` / `goBack`, transporte de params escalares por entrada, reevaluación de `preloads` por firma, `pageEntry`.
> Tamaño: medio.
> Relacionados: [[hash-navigation.md]], [[../queries/preloads.md]], [[../references/reference-resolution.md]].

# Acciones de navegación

## `navigateTo` y `goBack`
- `button.props.action` ya puede disparar `navigateTo` y `goBack` reutilizando el estado compartido del runtime.
- `navigateTo` puede declarar `params` como objeto plano y escalar; si un valor llega como referencia soportada, el runtime lo resuelve al hacer click y persiste el valor efectivo en la nueva entrada.
- Dentro de un `repeater`, `navigateTo.params` también puede resolver `item.*` contra la iteración activa y omite silenciosamente los params que acaben en valores no escalares.

## Reentrada
- Navegar a la misma página con los mismos params efectivos sigue siendo un no-op observable: no duplica historial ni relanza `preloads`.
- Navegar a la misma página con params efectivos distintos crea una entrada nueva del historial.

## Parámetros de navegación
- `routeParams` siguen fuera de alcance en la implementación actual.
- El runtime sí expone parámetros de navegación mediante la familia `params.{paramName}`.
- `params.*` representa los query params efectivos de la entrada activa normalizada, tanto si nacen de la URL directa como de una navegación declarativa interna.
- La familia `params.*` puede reutilizarse en texto visible, requests declarativos, `defaultValue` de campos y nuevas navegaciones originadas desde una página ya parametrizada.
- En texto visible puede usarse también dentro de placeholders `{{params.paramName}}`; en `navigateTo.params` sigue aplicando solo como referencia completa o literal escalar, sin interpolación parcial tipo `case-{{params.userId}}`.
- Si una navegación desmonta un `form` y luego lo vuelve a montar en otra entrada, los `defaultValue` basados en `params.*` se recalculan por defecto contra los params vigentes de esa nueva entrada.
- Si la nueva entrada además dispara `preloads`, cualquier `defaultValue` que dependa de esas queries precargadas se inicializa contra el estado limpio de la entrada nueva y ya no puede hidratarse con el dato de la visita anterior.
- `params.*` no forma parte todavía de `visibility` ni de las fuentes dinámicas de colección para `list` y `select`.

## `pageEntry` y `preloads`
- Cada entrada a una página con `preloads` dispara una nueva tanda automática de operaciones, también al volver a una página ya visitada o al reentrar en la misma página con params distintos.
- Cada preload se evalúa hoy por su request efectiva resuelta, no solo por `pageId` ni por `operationName`.
- Esa request efectiva reutiliza la misma semántica de composición que `executeOperation`, puede depender de `params.*`, `forms.*` y `queries.*`, y se compara mediante una firma estable derivada del request final.
- Esa nueva tanda prepara primero la `pageEntry` activa y resetea solo las queries cuyos preloads realmente necesitan relanzarse antes del primer render útil de la entrada reactivada.
- Durante esa preparación, la nueva entrada ve esas queries ya limpias y en `loading`, sin un paso visible intermedio por `idle` ni reutilización transitoria del `data` de otra entrada.
- La misma política se reaplica también cuando `goBack` reactiva una entrada histórica con `preloads`.
- La unidad observable de reentrada es `pageEntry`, que refleja `entryId`, `pageId`, `params`, `preloadNames` y el estado agregado `idle | loading | success | error`.
- La misma entrada de página no relanza sus `preloads` por mero rerender del provider, pero sí puede reevaluarlos y relanzar solo los afectados si cambia la firma efectiva de alguno de ellos dentro de esa entrada visible.

## Relación con futuras iteraciones
- El modelo actual ya separa `pages` e `initialPage`, resuelve la entrada visible desde una convención simple de hash y mantiene una traza interna mínima, de modo que futuras acciones declarativas podrán reutilizar ese mismo estado sin rehacer el contrato base.
- El alcance sigue intencionadamente acotado a hash routing simple; no introduce un router general por `pathname`.

## Límites de v1
- no existen políticas alternativas de reentrada, caché histórica por firma, secuencialidad ni dependencias entre `preloads`; la política vigente sigue siendo carga fresca selectiva por firma de request dentro de `pageEntry`
