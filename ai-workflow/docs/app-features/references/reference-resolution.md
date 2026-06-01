> Cuándo leer: familias soportadas de referencias (`queries.*`, `forms.*`, `params.*`, `item.*`), superficies donde aplican, reglas de navegación anidada y fronteras por familia.
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
- `forms.{formId}.{fieldId}`
- `params.{paramName}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

## Reglas funcionales generales
- la navegación anidada adicional solo se admite bajo `queries.{queryName}.data`
- los segmentos anidados pueden recorrer objetos y arrays
- un segmento numérico se interpreta como índice solo cuando el valor actual es un array; sobre objetos se trata como clave literal
- `queries.{queryName}.status.*` y `queries.{queryName}.error.*` siguen fuera del contrato y se consideran rutas inválidas
- `routeParams.*` y `navigation.*` siguen reservadas pero no soportadas
- una referencia bien formada cuyo dato no existe todavía se degrada según la política visible del consumidor; en superficies textuales actuales eso significa string vacío

## Superficies que admiten referencias completas en requests y valores
La misma convención de referencias completas se reutiliza dentro de `api.query`, en cualquier hoja string de `api.body` y en `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, con la siguiente semántica:
- un string literal se conserva como literal
- un string escapado con `\` se conserva sin el prefijo de escape
- una referencia soportada se resuelve contra el estado actual del runtime en el momento de invocación
- una referencia soportada pero sin valor disponible no invalida el config en bootstrap; produce un error de construcción del request al ejecutar la operación

Esa misma convención se reutiliza también en:
- `api.headers`
- `button.props.action.query`
- `button.props.action.body`
- `button.props.action.headers`
- `button.props.action.params`
- `form.submitAction.query`
- `form.submitAction.body`
- `form.submitAction.headers`
- `image.props.src`
- `image.props.alt`
- celdas string manuales de `table`
- `table.props.rows.cells`
- `repeater.props.items.source`
- `visibility.reference`

Consumidores adicionales con la misma frontera:
- `list.props.items.source`
- `select.props.items.source`
- `radioGroup.props.items.source`
- `checkboxGroup.props.items.source`

Estas superficies siguen fuera del catálogo de interpolación parcial: si declaran `prefix-{{params.userId}}`, se tratan como literales o como contratos inválidos según la semántica histórica de cada consumidor.

## Frontera específica de `params.*`
- `params.{paramName}` solo admite un segmento dinámico después del namespace.
- `params.userId` es válido; `params`, `params.user.id` y segmentos vacíos siguen siendo inválidos.
- `params.*` puede usarse en las superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers` y `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- `params.*` también puede usarse como origen dentro de `navigateTo.params` para construir la siguiente navegación a partir de la entrada activa.
- Cuando el runtime hidrata `params.*` desde la URL, todos sus valores llegan como string.
- `params.*` sigue fuera de alcance en `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`, aunque esas superficies reutilicen la misma familia general de referencias runtime.

## Frontera específica de `item.*`
- `item` e `item.*` son válidos cuando el consumidor vive dentro del subárbol iterado de un `repeater` o cuando la referencia se evalúa como proyección local de un item de colección.
- `item`, `item.slug`, `item.meta.author.name` o `item.tags.0` son ejemplos válidos dentro de ese contexto.
- `item.*` puede usarse en las superficies visibles interpolables, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `defaultValue` de campos, `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`.
- Fuera de un `repeater`, `item.*` no forma parte del contrato soportado aunque el shape del string siga siendo reconocible.

## Frontera específica de `item.$key`
- `item.$key` es una referencia sintética soportada, distinta de la navegación genérica `item.{ruta}`. Expone la clave del diccionario de la entrada actual cuando el `repeater` itera un objeto plano.
- Solo está disponible dentro del subárbol iterado de un `repeater` cuya fuente resuelta es un objeto plano. En cualquier otro contexto (fuente array, fuera de un repeater) `item.$key` no forma parte del contrato soportado y degrada a string vacío en superficies textuales.
- `item.$key` es la forma exacta soportada. Variantes como `item.$key.algo`, `item.algo.$key`, `item.$key.$key` u otras formas con `$` distintas del literal exacto son rutas inválidas.
- Cuando el valor de la entrada contiene una propiedad literal `$key`, `item.$key` devuelve siempre la clave del diccionario, nunca esa propiedad interna: la propiedad sintética tiene precedencia sobre la navegación dentro del valor.
- Las mismas superficies donde aplica `item.*` admiten también `item.$key`.
