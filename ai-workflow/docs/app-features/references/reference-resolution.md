> Cuándo leer: familias soportadas de referencias (`queries.*`, `forms.*`, `params.*`, `item.*`, `row.*`, `switch.next`), superficies donde aplican, reglas de navegación anidada y fronteras por familia.
> Tamaño: medio.
> Relacionados: [[dynamic-strings.md]], [[visibility.md]], [[../queries/state-model.md]], [[../forms/lifecycle.md]].

# Resolución de referencias

## Formas soportadas
Las referencias dinámicas tienen dos formas acotadas:
- **referencia completa**: el string completo coincide con una referencia soportada, por ejemplo `queries.searchUsers.data.results.0.name`.
- **interpolación parcial visible**: el string contiene uno o varios placeholders `{{referencia}}`, por ejemplo `Expediente {{params.caseId}}`. Detalle en [`dynamic-strings.md`](./dynamic-strings.md).

El escape literal con `\` permite mostrar una referencia completa tal cual, por ejemplo `\queries.searchUsers.data.results.0.name`. No actúa como mecanismo de escape de delimitadores `{{` o `}}`.

## Catálogo de referencias soportadas
- `item`
- `item.{segmentosAnidados}`
- `item.$key`
- `item.$index`
- `row`
- `row.{segmentosAnidados}`
- `row.$index`
- `forms.{formId}.{fieldId}`
- `params.{paramName}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.error.message`
- `queries.{queryName}.error.code`
- `queries.{queryName}.data.{segmentosAnidados}`
- `group.{paramName}`
- `t.{key}`
- `tokens.{tokenId}.value`
- `switch.next`

## Reglas funcionales generales
- la navegación anidada adicional solo se admite bajo `queries.{queryName}.data` y bajo `queries.{queryName}.error` (limitada a `.message` y `.code`)
- los segmentos anidados pueden recorrer objetos y arrays
- un segmento numérico se interpreta como índice solo cuando el valor actual es un array; sobre objetos se trata como clave literal
- `queries.{queryName}.status.*` siguen fuera del contrato y se consideran rutas inválidas
- `queries.{queryName}.error.{segmento}` solo es válido cuando `{segmento}` es exactamente `message` o `code`; otras subrutas bajo `.error` siguen siendo inválidas
- `routeParams.*` y `navigation.*` siguen reservadas pero no soportadas
- una referencia bien formada cuyo dato no existe todavía se degrada según la política visible del consumidor; en superficies textuales actuales eso significa string vacío

## Superficies que admiten referencias completas en requests y valores
La misma convención de referencias completas se reutiliza dentro de `api.query`, en cualquier hoja string de `api.body` y en `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, con la siguiente semántica:
- un string literal se conserva como literal
- un string escapado con `\` se conserva sin el prefijo de escape
- una referencia soportada se resuelve contra el estado actual del runtime en el momento de invocación
- una referencia soportada pero sin valor disponible no invalida el config en bootstrap; produce un error de construcción del request al ejecutar la operación

Esa misma convención se reutiliza también en:
- `button.props.checked` (solo válido cuando `button.props.variant: 'switch'`)
- `button.props.action.query`
- `button.props.action.body`
- `button.props.action.params`
- `form.submitAction.query`
- `form.submitAction.body`
- `image.props.src`
- `image.props.alt`
- celdas string manuales de `table`
- `table.props.rows.cells`
- `repeater.props.items.source`
- `visibility.reference`
- `shell.header.title`
- `shell.header.menu.item.label`
- `shell.header.menu.item.href`

Superficies de headers (referencias completas + interpolación parcial):
- `api.headers`
- `button.props.action.headers`
- `form.submitAction.headers`
- `preloads[].headers`

En headers, los valores admiten tanto referencias completas como interpolación parcial `{{...}}`. Detalle en [[dynamic-strings.md]].

Consumidores adicionales con la misma frontera (referencias completas):
- `list.props.items.source`
- `select.props.items.source`
- `radioGroup.props.items.source`
- `checkboxGroup.props.items.source`

Las superficies de `query`, `body`, `params` y otras no listadas siguen fuera del catálogo de interpolación parcial: si declaran `prefix-{{params.userId}}`, se tratan como literales o como contratos inválidos según la semántica histórica de cada consumidor.

## Frontera específica de `params.*`
- `params.{paramName}` solo admite un segmento dinámico después del namespace.
- `params.userId` es válido; `params`, `params.user.id` y segmentos vacíos siguen siendo inválidos.
- `params.*` puede usarse en las superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `visibility.reference` y `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- `params.*` también puede usarse como origen dentro de `navigateTo.params` para construir la siguiente navegación a partir de la entrada activa.
- Cuando el runtime hidrata `params.*` desde la URL, todos sus valores llegan como string.
- `params.*` sigue fuera de alcance en `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`, aunque esas superficies reutilicen la misma familia general de referencias runtime.

## Frontera específica de `item.*`
- `item` e `item.*` son válidos cuando el consumidor vive dentro del subárbol iterado de un `repeater` o cuando la referencia se evalúa como proyección local de un item de colección.
- `item`, `item.slug`, `item.meta.author.name` o `item.tags.0` son ejemplos válidos dentro de ese contexto.
- `item.*` puede usarse en las superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `defaultValue` de campos, `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`.
- Fuera de un `repeater`, `item.*` no forma parte del contrato soportado aunque el shape del string siga siendo reconocible.
- Dentro de las celdas de una `table` (cualquier modo), `item.*` ya no resuelve nunca como contexto de fila propio de la tabla: solo puede resolver contra el item del `repeater` ancestro más cercano cuando la `table` vive dentro de su subárbol iterado, o degradar a vacío si no hay ningún `repeater` ancestro. El contexto de fila propio de `table` usa el namespace `row.*` (ver "Frontera específica de `row.*`").
- `table.props.rows.source` mantiene sin cambios su forma literal `'item.*'`: sigue refiriéndose al item del `repeater` ambiental que provee el array de filas de la tabla, una familia de referencia distinta del contexto de fila (`row.*`).

## Frontera específica de `item.$key`
- `item.$key` es una referencia sintética soportada, distinta de la navegación genérica `item.{ruta}`. Expone la clave del diccionario de la entrada actual cuando el `repeater` itera un objeto plano.
- Solo está disponible dentro del subárbol iterado de un `repeater` cuya fuente resuelta es un objeto plano. En cualquier otro contexto (fuente array, fuera de un repeater) `item.$key` no forma parte del contrato soportado y degrada a string vacío en superficies textuales.
- `item.$key` es la forma exacta soportada. Variantes como `item.$key.algo`, `item.algo.$key`, `item.$key.$key` u otras formas con `$` distintas del literal exacto son rutas inválidas.
- Cuando el valor de la entrada contiene una propiedad literal `$key`, `item.$key` devuelve siempre la clave del diccionario, nunca esa propiedad interna: la propiedad sintética tiene precedencia sobre la navegación dentro del valor.
- Las mismas superficies donde aplica `item.*` admiten también `item.$key`.

## Frontera específica de `item.$index`
- `item.$index` es una referencia sintética soportada, distinta de la navegación genérica `item.{ruta}`. Expone el índice numérico (0, 1, 2…) de la iteración actual como número dentro del subárbol iterado de cualquier `repeater`, con independencia del valor de `props.items.key`.
- Funciona tanto con fuentes array como con fuentes objeto plano. En ambos casos expone la posición ordinal dentro de la secuencia iterada.
- `item.$index` tiene precedencia sobre cualquier propiedad literal `$index` que pudiera existir dentro del valor del item, de forma análoga a la precedencia de `item.$key`.
- `item.$index` es la forma exacta soportada. Variantes como `item.$index.algo`, `item.algo.$index` u otras formas con `$` distintas del literal exacto son rutas inválidas.
- Las mismas superficies donde aplica `item.*` e `item.$key` admiten también `item.$index`.

## Frontera específica de `row.*`
- `row` e `row.*` son válidos dentro de las celdas de una `table` (celdas-nodo en modo dinámico, y celdas string manuales y dinámicas), como namespace propio del contexto de fila de la tabla — distinto de `item.*`, que dentro de esas mismas celdas solo puede referirse al `repeater` ancestro.
- `row`, `row.slug`, `row.meta.author.name` o `row.tags.0` son ejemplos válidos dentro de ese contexto, con la misma semántica de segmentos anidados que `item.*` (numérico como índice solo si el valor actual es array, clave literal si es objeto).
- En modo dinámico, `row.*` navega el dato de la fila actual. En modo manual, `row.*` sin `.$index` no resuelve — no existe un dato subyacente que navegar, solo valores literales por celda (ver "Frontera específica de `row.$index`" para la excepción sintética).
- Una `table` dinámica anidada dentro de un `repeater` puede combinar en el mismo string interpolado `item.algo` (del `repeater` ancestro) y `row.algo` (de la fila propia de la tabla) sin que uno sombree al otro.
- Fuera de las celdas de una `table`, `row.*` no forma parte del contrato soportado aunque el shape del string siga siendo reconocible.

## Frontera específica de `row.$index`
- `row.$index` es una referencia sintética soportada, distinta de la navegación genérica `row.{ruta}`. Expone un entero 1-based con la posición de la fila dentro de la vista actualmente visible de la `table` (tras aplicar filtros, ordenación y paginación local).
- Disponible en celdas-nodo y celdas string de `table`, tanto en modo dinámico como en modo manual — es la única forma de `row.*` accesible en modo manual.
- `row.$index` se recalcula de forma contigua (1, 2, 3…) sobre las filas restantes cuando cambia la vista visible (filtro, orden o página), sin huecos.
- `row.$index` tiene precedencia sobre cualquier propiedad literal `$index` que pudiera existir dentro del valor de la fila, de forma análoga a la precedencia de `item.$index`.
- `row.$index` es la forma exacta soportada. No existe `row.$key` (a diferencia de `item.$key`): `table` no itera un diccionario, sus filas siempre tienen una posición ordinal en la vista visible.
- Las mismas superficies donde aplica `row.*` admiten también `row.$index`.

## Frontera específica de `t.*`
- `t.{key}` resuelve valores desde el catálogo de traducciones declarado en la raíz del JSON de configuración, aplicando una cadena de fallback por idioma.
- El idioma activo se declara mediante el atributo `data-lang` del elemento raíz; si no está presente o es vacío, el runtime usa `"es"` por defecto.
- `t.{key}` admite exactamente un segmento dinámico tras el namespace. `t.group.key` (dos segmentos) no se reconoce como referencia válida.
- La cadena de fallback es: idioma activo → idioma por defecto (`"es"`) → en desarrollo: nombre de la clave; en producción: string vacío.
- `t.{key}` puede usarse en todas las superficies visibles interpolables que ya admiten referencias completas: `heading.props.text`, `paragraph.props.text`, `button.props.label`, `input.props.label`, `input.props.placeholder`, `textarea.props.label`, `textarea.props.placeholder`, `select.props.label`, `radioGroup.props.label`, `checkboxGroup.props.label`, elementos de `list.props.items`, celdas de `table`, `image.props.alt`, y dentro de placeholders `{{t.key}}` en cualquiera de las anteriores.
- `t.*` queda fuera de alcance en `api.query`, `api.body`, `api.headers`, `visibility.reference`, orígenes de colección (`repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source`) y en `defaultValue` de campos de formulario; en esas superficies se trata como string literal.

## Frontera específica de `tokens.*`
- `tokens.{tokenId}.value` es la única forma soportada de referencia a tokens. Variantes como `tokens.{tokenId}` (sin `.value`), `tokens.{tokenId}.status` u otras rutas adicionales no forman parte del contrato válido y se tratan como referencias inválidas.
- `tokens.{tokenId}.value` resuelve el valor actual de un token declarado en el bloque raíz `tokens` del JSON de configuración. Si el token no existe, la operación falla con `code: request-build-failed`.
- Cuando un token está en estado de refresco (`status: refreshing`), su valor actual se sigue sirviendo sin bloqueo; cuando está en estado de error (`status: error`), cualquier operación que lo referencie en sus headers falla con `code: token-refresh-failed` sin emitir red.
- `tokens.{tokenId}.value` **solo** está soportada en superficies de headers: `api.{op}.headers`, `button.props.action.headers`, `form.submitAction.headers`, `preloads[].headers` e incluidas dentro de `executeOperations[].headers`. Usarla en cualquier otra superficie (`query`, `body`, `params`, `visibility`, `defaultValue`, orígenes de colección) provoca error de bootstrap `invalid-layout`.
- `tokens.*` no se puede interpolar en superficies visibles ni en placeholders `{{tokens...}}`; cualquier intento causa que el placeholder se degrade a string vacío sin exponerse el valor del token.
- Los valores de tokens no aparecen en logs ni en diagnósticos de error expuestos al usuario (criterio de seguridad).

## Frontera específica de `switch.next`
- `switch.next` es una referencia sintética, no una navegación genérica sobre un namespace de datos: expone el booleano contrario al `props.checked` resuelto de la propia instancia de `button` con `variant: 'switch'`, en el momento del click que dispara su `action`.
- `switch.next` es la única forma soportada de este namespace (mismo criterio de forma exacta que `item.$key`/`item.$index`/`row.$index`): variantes como `switch`, `switch.nextx` o `switch.next.extra` son rutas inválidas.
- Solo está soportada dentro de `props.action.query`/`body`/`headers` del propio `button` que declara `variant: 'switch'`, y dentro de cada entrada de `props.action.operations[].query`/`body`/`headers` cuando `action.type: executeOperations` (misma extensión singular/plural que ya aplica `item.*`).
- Un `switch.next` en cualquier otra superficie —`props.checked` del mismo botón, `visibility.reference`, la `action` de otro nodo, o un `button` cuyo `variant` no es `switch`— es rechazado en bootstrap, no degradado en runtime.
- Se resuelve como campo hermano de `iterationContext` en las opciones que ya transporta el pipeline de referencias (no forma parte de `RuntimeIterationContext`, que es conceptual y funcionalmente el contexto de iteración de `repeater`/`table`), por lo que convive sin conflicto con `item.*`/`row.*` en el mismo `body`/`query`/`headers` cuando el `button` vive dentro de un `repeater`.
- Con `checked` literal fijo (sin referencia dinámica), `switch.next` sigue resolviendo la negación de ese literal en cada click; como `checked` nunca cambia por sí solo, todos los clicks sucesivos envían el mismo valor negado.

## Frontera específica de `group.*`
- `group.{paramName}` resuelve, dentro del `template` de una definición de grupo, el valor pasado en `props.params.{paramName}` por la instancia `group` que está expandiéndose en ese momento.
- `group.{paramName}` es válido cuando el consumidor vive dentro del `template` declarado en un `groups.{groupId}`.
- `group.*` solo admite un segmento dinámico tras el namespace. `group.param.extra` (dos segmentos) no se reconoce como referencia válida.
- Variantes como `group`, `group.{paramName}.extra` u otras formas con múltiples segmentos son rutas inválidas.
- `group.*` puede usarse en las mismas superficies donde hoy es utilizable `item.*` dentro de un `repeater`: referencias completas e interpolación parcial en strings visibles, `api.query`, `api.body`, `api.headers`, `button.props.action.query`/`body`/`headers`, `form.submitAction.query`/`body`/`headers`, `defaultValue` de campos, `visibility.reference`, y orígenes de colección (`repeater.props.items.source`, `list.props.items.source`, etc.), siempre que se encuentre dentro del contexto del template del grupo.
- Fuera del `template` de una definición de grupo, `group.*` no forma parte del contrato soportado y degrada a string vacío en superficies textuales.
- Un `group` instanciado dentro de `repeater.props.template` puede usar `item.*` en sus `props.params` e `children` del mismo modo que cualquier otro nodo dentro del template; ambos namespaces coexisten sin conflicto, resolviendo cada uno desde su contexto correspondiente (iteración del `repeater` e iteración del `group`, respectivamente).
- `group.*` tiene precedencia sobre cualquier propiedad literal de ese nombre dentro del valor del parámetro, de forma análoga a la precedencia de `item.$key` y `item.$index`.
