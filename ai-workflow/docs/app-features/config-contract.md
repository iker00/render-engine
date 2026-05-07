# Contrato de configuración

## Objetivo
Definir la estructura funcional mínima del JSON que el runtime interpreta hoy para resolver y renderizar la UI configurable ya disponible, incluidas las referencias dinámicas textuales soportadas por el runtime.

## Estructura vigente
La configuración parte de tres bloques principales:
- `api`: objeto requerido que define un catálogo declarativo de operaciones remotas nombradas
- `pages`: array requerido de páginas declaradas
- `initialPage`: identificador requerido de la página de entrada

## Modelo de `api`
Cada operación declarada dentro de `api` debe incluir:
- `method`: `GET | POST | PUT | PATCH | DELETE`
- `endpoint`: string no vacío
- `query`: objeto plano opcional con valores finales `string | number | boolean`
- `body`: payload JSON opcional para métodos distintos de `GET`
- `headers`: objeto plano opcional con claves no vacías y valores string

Reglas funcionales vigentes:
- `GET` no admite `body`.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`.
- `query` se mantiene plano; no existe soporte estable para nested params, claves repetidas ni arrays serializados en query string.
- `body` puede contener objetos, arrays, strings, números, booleanos y `null` siempre que el árbol completo siga siendo JSON serializable.
- `body: null` en la raíz es válido para métodos con body y significa petición explícita sin body JSON serializado.
- `headers` se mantiene plano y solo admite valores string finales.
- varias operaciones pueden reutilizar el mismo `endpoint` con distinto nombre o método sin colisionar.

## Modelo de página
Cada página debe incluir:
- `id`: string no vacío y único dentro de `pages`
- `preloads`: array opcional y ordenado de nombres de operación declarados en `api`
- `layout`: array ordenado obligatorio de elementos declarativos

La página ya no depende de `title` ni `description` fuera del árbol `layout`.

## Shape del layout
`layout` ya no usa un nodo raíz artificial. La colección puede empezar directamente con varios bloques hermanos y su orden define el orden visible de renderizado.

Cada elemento de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado
- `id`: opcional
- `props`: opcional según el tipo
- `queryStateFeedback`: opcional para condicionar la salida visible del nodo según el estado de una query
- `visibility`: opcional para mostrar u ocultar el nodo según un valor ya disponible en `forms.*` o `queries.*`
- `children`: opcional, pero solo interpretado en `container` y `form`

Reglas estructurales vigentes:
- `layout` debe ser siempre un array.
- `layout: []` es válido y produce una página sin contenido inventado.
- El shape antiguo con `layout` como objeto único ya no forma parte del contrato estable y se rechaza como error de configuración.
- `container.children` reutiliza el mismo modelo de colección ordenada y puede ser `[]` o no declararse.

Nodos soportados hoy:
- `container`
  - `props.direction`: string opcional, con soporte visual actual para `row` y fallback a columna
  - `props.gap`: string opcional, con aliases como `sm`, `md` y `lg` o cualquier valor CSS válido
- `heading`
  - `props.text`: string obligatorio, literal o referencia dinámica completa soportada por el runtime
  - `props.level`: número entero obligatorio
- `paragraph`
  - `props.text`: string obligatorio, literal o referencia dinámica completa soportada por el runtime
- `list`
  - `props.items`: obligatorio
  - shape histórico: array de strings
  - shape manual escalar: `{ values: Array<string> }`
  - shape manual objeto: `{ values: Array<object>, itemText: string }`
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', itemType: 'scalar' }`
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', itemText: string }`
- `button`
  - `props.label`: string obligatorio
  - `props.action`: opcional; sin `action` solo es válido dentro del subárbol de un `form` y actúa como submit implícito
  - `props.action.type`: `navigateTo | goBack | executeOperation | resetForm`
  - `props.action.pageId`: string obligatorio y no vacío cuando `type` es `navigateTo`
  - `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null` cuando `type` es `navigateTo`
  - `props.action.operationName`: string obligatorio y no vacío cuando `type` es `executeOperation`
  - `props.action.query`: objeto plano opcional con valores `string | number | boolean` cuando `type` es `executeOperation`
  - `props.action.body`: payload JSON opcional cuando `type` es `executeOperation`
  - `props.action.headers`: objeto plano opcional con valores string cuando `type` es `executeOperation`
  - `props.action.formId`: string obligatorio y no vacío cuando `type` es `resetForm`
- `form`
  - `id`: string obligatorio, estable y único dentro de toda la configuración
  - `submitAction.type`: solo `executeOperation`
  - `submitAction.operationName`: string obligatorio y no vacío cuando existe `submitAction`
  - `submitAction.query`: objeto plano opcional con valores `string | number | boolean`
  - `submitAction.body`: payload JSON opcional
  - `submitAction.headers`: objeto plano opcional con valores string
  - `resetOnSuccess`: boolean opcional, válido solo cuando existe `submitAction`
  - `children`: colección ordenada con soporte para `input`, `textarea`, `select`, `button`, `heading`, `paragraph` y `container`
- `input`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.required`: boolean opcional
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
  - `props.inputType`: `text | email | password | search | tel | url`
- `textarea`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.required`: boolean opcional
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
- `select`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.required`: boolean opcional
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
  - `props.items`: obligatorio
  - shape histórico: array de `{ label, value }`, con `value` homogéneo `string` o `number` dentro del mismo campo
  - shape manual escalar: `{ values: Array<string | number> }`
  - shape manual objeto: `{ values: Array<object>, label: string, value: string }`
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', itemType: 'scalar' }`
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', label: string, value: string }`

Reglas estructurales adicionales del catálogo actual:
- `heading`, `paragraph`, `list` y `button` siguen tratándose como nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- `input`, `textarea` y `select` solo son válidos como descendientes de un `form`.
- `button` sin `action` solo es válido como descendiente de un `form`.
- las claves extra no soportadas se descartan del objeto validado final sin convertir por sí solas la configuración en inválida.

## `queryStateFeedback`
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `query`: nombre no vacío de la query observada
- `states`: mapa opcional con claves limitadas a `idle`, `loading`, `error`, `empty` y `success`

Cada regla de `states` admite exactamente uno de estos modos:
- `mode: show`
- `mode: hide`
- `mode: fallback`, que exige `fallback` como colección ordenada de `LayoutNode[]`

Reglas funcionales vigentes:
- `queryStateFeedback` es transversal a `container`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea` y `select`.
- `fallback` reutiliza el mismo catálogo de nodos soportados por `layout`; no introduce un dialecto paralelo ni un wrapper sintético obligatorio.
- un fallback puede contener varios nodos hermanos y conserva su orden declarado.
- si un estado visible no tiene regla explícita, el runtime aplica `success -> show` y `idle/loading/error/empty -> hide`.
- `idle` es un estado visible soportado de primera clase para esta capacidad.
- una query ausente del store también se interpreta como `idle`.
- `loading` representa solo una ejecución real en curso; no cubre el estado previo a la primera ejecución.

## `visibility`
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `reference`: referencia runtime completa no vacía
- `operator`: `equals | notEquals | isTruthy | isFalsy | greaterThan | lessThan`
- `value`: obligatorio solo para `equals`, `notEquals`, `greaterThan` y `lessThan`

Referencias admitidas en `visibility`:
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentosAnidados}`
- `queries.{queryName}.status`
- `queries.{queryName}.error`

Reglas funcionales vigentes:
- `visibility` es transversal a `container`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea` y `select`.
- si un nodo no declara `visibility`, conserva su comportamiento visible previo.
- `equals` y `notEquals` comparan contra un literal declarado ya validado, sin reinterpretar strings con forma de referencia runtime.
- `equals` y `notEquals` solo aceptan `string`, `number`, `boolean` o `null` como `value`.
- `isTruthy` e `isFalsy` no aceptan `value`.
- `greaterThan` y `lessThan` solo aceptan umbrales numéricos.
- `greaterThan` y `lessThan` comparan directamente números; si el valor observado es un array, usan `length`.
- strings, objetos, `null` y otros valores no comparables para `greaterThan` y `lessThan` degradan a no match en vez de abrir coerciones implícitas.
- una referencia válida pero ausente se trata como valor ausente: `isFalsy` la considera falsa, `isTruthy` no hace match y el resto de operadores no hace match.
- si un nodo declara a la vez `queryStateFeedback` y `visibility`, primero se resuelve `queryStateFeedback`; `visibility` solo se evalúa cuando el resultado visible restante sigue siendo el nodo original.
- `visibility` no introduce `fallback`, condiciones múltiples ni composición booleana en esta versión.

## Resolución inicial
- El runtime valida toda la configuración antes de renderizar.
- Tras validar `pages`, resuelve la página cuyo `id` coincide con `initialPage`.
- Si `initialPage` no existe dentro de `pages`, el arranque falla con un error explícito.

## Referencias dinámicas
Las referencias dinámicas ya forman parte del contrato visible actual, pero con un alcance intencionadamente acotado:
- solo se interpretan cuando el string completo de `heading.props.text` o `paragraph.props.text` coincide con una referencia soportada
- el escape literal con `\` permite mostrar una referencia tal cual, por ejemplo `\queries.searchUsers.data.results.0.name`
- no existe interpolación parcial dentro de strings

Además, la misma convención de referencias completas se reutiliza dentro de `api.query`, en cualquier hoja string de `api.body` y en `defaultValue` de `input`, `textarea` y `select`:
- un string literal se conserva como literal
- un string escapado con `\` se conserva sin el prefijo de escape
- una referencia soportada se resuelve contra el estado actual del runtime en el momento de invocación
- una referencia soportada pero sin valor disponible no invalida el config en bootstrap; produce un error de construcción del request al ejecutar la operación

Esa misma convención se reutiliza también en:
- `api.headers`
- `button.props.action.query`
- `button.props.action.body`
- `button.props.action.headers`
- `form.submitAction.query`
- `form.submitAction.body`
- `form.submitAction.headers`
- `visibility.reference`

Referencias soportadas hoy:
- `forms.{formId}.{fieldId}`
- `params.{paramName}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Consumidores adicionales ya soportados con esa misma frontera:
- `list.props.items.source`
- `select.props.items.source`
- `visibility`

Frontera específica de `params.*`:
- `params.{paramName}` solo admite un segmento dinámico después del namespace.
- `params.userId` es válido; `params`, `params.user.id` y segmentos vacíos siguen siendo inválidos.
- `params.*` puede usarse en `heading.props.text`, `paragraph.props.text`, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers` y `defaultValue` de `input`, `textarea` y `select`.
- `params.*` también puede usarse como origen dentro de `navigateTo.params` para construir la siguiente navegación a partir de la entrada activa.
- `params.*` sigue fuera de alcance en `visibility.reference`, `list.props.items.source` y `select.props.items.source`, aunque esas superficies reutilicen la misma familia general de referencias runtime.

Reglas funcionales vigentes:
- la navegación anidada adicional solo se admite bajo `queries.{queryName}.data`
- los segmentos anidados pueden recorrer objetos y arrays
- un segmento numérico se interpreta como índice solo cuando el valor actual es un array; sobre objetos se trata como clave literal
- `queries.{queryName}.status.*` y `queries.{queryName}.error.*` siguen fuera del contrato y se consideran rutas inválidas
- `routeParams.*` y `navigation.*` siguen reservadas pero no soportadas
- una referencia bien formada cuyo dato no existe todavía se degrada según la política visible del consumidor; en superficies textuales actuales eso significa string vacío

## Validación
- La configuración debe validarse antes de renderizarse.
- La validación estructural del contrato se apoya ahora en esquemas `Zod`, manteniendo una única fachada pública estable en `validateRuntimeConfig`.
- La validación comprueba estructura general, shape de `api`, `pages`, `preloads`, colección `layout` y shape de los nodos soportados.
- Si `layout` no es un array válido, el arranque falla con un error explícito sobre la ruta afectada.
- Si aparece un nodo no soportado en la raíz o dentro de `children`, el runtime lo trata como error de configuración y no lo reinterpreta.
- Si `queryStateFeedback.states` contiene una clave fuera de `idle | loading | error | empty | success`, el config completo se rechaza con error de layout sobre esa ruta exacta.
- Si una regla usa `mode: fallback` sin `fallback`, el config completo se rechaza antes del render.
- Si cualquier nodo dentro de `queryStateFeedback.states.{estado}.fallback` es inválido o usa un `type` no soportado, el config completo se rechaza antes del render sobre la ruta afectada.
- Si `visibility.reference` sale del alcance `forms.*` o `queries.*` soportado, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `visibility.operator` usa un valor fuera del catálogo soportado, el config completo se rechaza antes del render.
- Si `visibility.operator` es `isTruthy` o `isFalsy` y declara `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals`, `notEquals`, `greaterThan` o `lessThan` y omite `value`, el config completo se rechaza antes del render.
- Si `visibility.operator` es `equals` o `notEquals` y `value` no es un literal escalar (`string | number | boolean | null`), el config completo se rechaza antes del render.
- Si `visibility.operator` es `greaterThan` o `lessThan` y `value` no es numérico, el config completo se rechaza antes del render.
- Si `initialPage` no existe dentro de `pages`, el runtime sigue fallando antes del render con `initial-page-not-found`.
- Si un `button.props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `button.props.action.params` existe en `navigateTo`, debe ser un objeto plano con claves no vacías y valores escalares `string | number | boolean | null`.
- Si `button.props.action.params` incluye arrays, objetos anidados o rutas `params.*` mal formadas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si un `button.props.action.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- `resetForm` valida shape y `formId` no vacío, pero no intenta cerrar en bootstrap un catálogo semántico adicional de formularios.
- Si `form.id` se repite en cualquier página, el config completo se rechaza antes del render.
- Si un `fieldId` se repite dentro del mismo `form`, el config completo se rechaza antes del render.
- Si un `form.children` contiene nodos fuera de `input`, `textarea`, `select`, `button`, `heading`, `paragraph` y `container`, el config completo se rechaza antes del render.
- Si `input`, `textarea` o `select` aparecen fuera de un subárbol `form`, el config completo se rechaza antes del render.
- Si un `button` sin `action` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
- Si `form.submitAction.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render.
- Si una operación `GET` declara `body`, el config completo se rechaza antes del render.
- Si `button.props.action.type: executeOperation` o `form.submitAction` declaran `body` sobre una operación `GET`, el config completo se rechaza antes del render.
- Si `api.headers`, `button.props.action.headers` o `form.submitAction.headers` usan valores no string, el config completo se rechaza antes del render.
- Si `api.query`, `api.headers`, `button.props.action.query`, `button.props.action.headers`, `form.submitAction.query` o `form.submitAction.headers` contienen claves vacías, el config completo se rechaza antes del render.
- Si `form.resetOnSuccess: true` aparece sin `submitAction`, el config completo se rechaza antes del render.
- Si `select.props.items` mezcla `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Si `list.props.items` o `select.props.items` declaran un `source`, este debe apuntar exactamente a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`.
- Si `visibility.reference`, `list.props.items.source` o `select.props.items.source` intentan usar `params.*`, el config completo se rechaza antes del render porque esa familia sigue fuera de alcance en esas superficies.
- Si `list.props.items` o `select.props.items` mezclan familias incompatibles de origen histórico, manual declarativo y dinámico, el config completo se rechaza antes del render.
- Si un origen dinámico de escalares omite `itemType: 'scalar'`, el config completo se rechaza antes del render.
- Si un origen dinámico u objeto manual omite los mapeos mínimos del consumidor (`itemText` para `list`; `label` y `value` para `select`), el config completo se rechaza antes del render.
- Los errores estructurales conservan la semántica pública actual (`invalid-layout` o `unsupported-node-type`) y ahora incluyen rutas canónicas del JSON cuando aplica, por ejemplo `layout[0].props.items[1]` o `searchUsers.query.filters`.
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores `development-only` degradan sin mostrar mensaje genérico visible.

La frontera estable de esta validación queda organizada así:
- `src/config/runtime-config.ts`: fachada pública para consumidores como bootstrap y tests.
- `src/config/runtime-config-types.ts`: tipos del contrato y shape del resultado de validación.
- `src/config/runtime-config-zod.ts`: esquemas `Zod` internos del contrato estructural y helpers de shape.
- `src/config/runtime-config-validation-errors.ts`: adaptador interno para construir errores públicos coherentes.
- `src/config/validate-runtime-config.ts`: orquestación de parseo estructural, adaptación diagnóstica y validaciones cruzadas previas al render.

## Límites de v1
- `api` ya puede dispararse declarativamente desde `button.props.action` usando `executeOperation`, además de por la fachada imperativa del provider y por `preloads` de página al entrar en ella.
- `executeOperation` y `submitAction` ya pueden añadir `query`, `body` y `headers` por ejecución, pero siguen dependiendo de `operationName` como vínculo obligatorio con una operación existente de `api`.
- `navigateTo` ya puede transportar `params` efectivos entre páginas, pero esos params siguen siendo escalares, internos al historial del runtime y sin sincronización con la URL del navegador.
- `action` sigue siendo una sola operación por trigger; no hay arrays, secuencias ni callbacks declarativos.
- El trigger sigue siendo implícito por tipo de nodo; el contrato no abre todavía un bloque general de `events`.
- Los formularios declarativos ya soportan solo el catálogo mínimo `form`, `input`, `textarea` y `select`, con validación limitada a `required`.
- `visibility` ya cubre show/hide simple por valor runtime, pero no abre branching, `fallback`, arrays de reglas ni expresiones compuestas.
- `list` y `select` ya pueden reutilizar datos de `queries.*` como colecciones, pero siguen fuera de alcance filtros cliente, ordenación declarativa, transformaciones arbitrarias, búsqueda remota y carga incremental.
- No hay todavía validaciones declarativas avanzadas (`min`, `max`, patrones o validaciones cruzadas).
- `preloads` solo admite una lista plana de strings; no hay condiciones, prioridades, secuencialidad, dependencias ni políticas de caché.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea` y `select`.
- No hay consumidores declarativos de referencias fuera de `heading.props.text`, `paragraph.props.text`, `queryStateFeedback`, `visibility`, `api.query`, `api.body`, `defaultValue` de campos de formulario y `source` de colecciones para `list` y `select`, salvo la ampliación acotada de `params.*` en texto, requests, `defaultValue` y `navigateTo.params`.
