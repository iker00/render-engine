# Contrato de configuración

## Objetivo
Definir la estructura funcional mínima del JSON que el runtime interpreta hoy para resolver y renderizar la UI configurable ya disponible, incluidas las referencias dinámicas soportadas por el runtime en texto, formularios y colecciones declarativas.

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
- `preloads`: array opcional y ordenado de objetos declarativos de una sola clave
- `layout`: array ordenado obligatorio de elementos declarativos

La página ya no depende de `title` ni `description` fuera del árbol `layout`.

Contrato estable de `preloads`:
- cada entrada debe ser un objeto con exactamente una clave no vacía cuyo nombre actúa como `operationName`
- el valor de esa clave debe ser `{}` o un objeto con `query`, `body` y/o `headers`
- `query`, `body` y `headers` reutilizan exactamente el mismo contrato de `RuntimeApiRequestParams` ya soportado por `executeOperation`
- el runtime normaliza internamente cada entrada a `{ operationName, requestParams }`
- dentro de una misma página no se admite repetir el mismo `operationName`, aunque las requests declaradas fueran distintas
- el shape histórico `preloads: ["loadUsers"]` ya no forma parte del contrato soportado y se rechaza antes del render

## Shape del layout
`layout` ya no usa un nodo raíz artificial. La colección puede empezar directamente con varios bloques hermanos y su orden define el orden visible de renderizado.

Cada elemento de layout usa un shape homogéneo basado en:
- `type`: tipo de nodo soportado
- `id`: opcional
- `props`: opcional según el tipo
- `queryStateFeedback`: opcional para condicionar la salida visible del nodo según el estado de una query
- `visibility`: opcional para mostrar u ocultar el nodo según un valor ya disponible en `forms.*`, `queries.*` o `item.*` cuando exista contexto de iteración
- `children`: opcional, pero solo interpretado en `container` y `form`

Reglas estructurales vigentes:
- `layout` debe ser siempre un array.
- `layout: []` es válido y produce una página sin contenido inventado.
- El shape antiguo con `layout` como objeto único ya no forma parte del contrato estable y se rechaza como error de configuración.
- `container.children` reutiliza el mismo modelo de colección ordenada y puede ser `[]` o no declararse.

Nodos soportados hoy:
- `container`
  - `props.direction`: string opcional, con soporte visual actual para `row` y fallback a columna cuando `columns` no está presente
  - `props.gap`: string opcional; la escala recomendada y estable hoy es `sm | md | lg | xl | 2xl`, pero cualquier valor CSS string sigue admitiéndose como compatibilidad heredada
  - `props.columns`: entero opcional entre `1` y `12`
  - `props.align`: opcional, con catálogo cerrado `start | center | end | stretch`
  - `props.justify`: opcional, con catálogo cerrado `start | center | end | between | around | evenly`
  - `props.wrap`: opcional, con catálogo cerrado `nowrap | wrap | wrap-reverse`
- `repeater`
  - `props.items.source`: obligatorio y limitado a `queries.{queryName}.data` o `queries.{queryName}.data.*`
  - `props.items.key`: obligatorio; ruta relativa no vacía al item actual, por ejemplo `id` o `meta.slug`
  - `props.template`: colección ordenada obligatoria de `LayoutNode[]`
  - no admite `children`
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
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemType: 'scalar' }`
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemText: string }`
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
  - `persistOnUnmount`: boolean opcional; cuando vale `true`, el formulario conserva su estado local al desmontarse, y cuando no existe o vale `false` el runtime lo elimina por defecto
  - `submitAction.type`: solo `executeOperation`
  - `submitAction.operationName`: string obligatorio y no vacío cuando existe `submitAction`
  - `submitAction.query`: objeto plano opcional con valores `string | number | boolean`
  - `submitAction.body`: payload JSON opcional
  - `submitAction.headers`: objeto plano opcional con valores string
  - `resetOnSuccess`: boolean opcional, válido solo cuando existe `submitAction`
  - `children`: colección ordenada con soporte para `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph` y `container`
- `input`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.validations`: objeto opcional y ordenado por declaración
  - `props.validations.required`: `true` o `{ value: true, message?: string }`
  - `props.validations.minLength`: número o `{ value: number, message?: string }`, solo para `input` textuales
  - `props.validations.maxLength`: número o `{ value: number, message?: string }`, solo para `input` textuales
  - `props.validations.min`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`
  - `props.validations.max`: número o `{ value: number, message?: string }`, solo para `inputType: 'number'`
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
  - `props.inputType`: `text | email | password | search | tel | url | number | date | datetime-local`
- `textarea`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.validations`: objeto opcional y ordenado por declaración
  - `props.validations.required`: `true` o `{ value: true, message?: string }`
  - `props.validations.minLength`: número o `{ value: number, message?: string }`
  - `props.validations.maxLength`: número o `{ value: number, message?: string }`
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
- `select`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.validations`: objeto opcional y ordenado por declaración
  - `props.validations.required`: `true` o `{ value: true, message?: string }`
  - `props.validations.minSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`
  - `props.validations.maxSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`
  - `props.defaultValue`: literal escalar para selección simple, array escalar homogéneo para selección múltiple o referencia dinámica completa soportada por el runtime
  - `props.items`: obligatorio
  - `props.multiple`: boolean opcional; cuando vale `true`, el valor efectivo del campo pasa a ser una colección ordenada
  - shape histórico: array de `{ label, value }`, con `value` homogéneo `string` o `number` dentro del mismo campo
  - shape manual escalar: `{ values: Array<string | number> }`
  - shape manual objeto: `{ values: Array<object>, label: string, value: string }`
  - shape dinámico escalar: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', itemType: 'scalar' }`
  - shape dinámico objeto: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*', label: string, value: string }`
- `radioGroup`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.validations`: objeto opcional y ordenado por declaración
  - `props.validations.required`: `true` o `{ value: true, message?: string }`
  - `props.defaultValue`: literal JSON simple o referencia dinámica completa soportada por el runtime
  - `props.items`: obligatorio con exactamente los mismos shapes soportados por `select`
- `checkboxGroup`
  - `props.fieldId`: string obligatorio y único dentro del `form` contenedor
  - `props.label`: string obligatorio
  - `props.validations`: objeto opcional y ordenado por declaración
  - `props.validations.required`: `true` o `{ value: true, message?: string }`
  - `props.validations.minSelections`: número o `{ value: number, message?: string }`
  - `props.validations.maxSelections`: número o `{ value: number, message?: string }`
  - `props.defaultValue`: array escalar homogéneo o referencia dinámica completa soportada por el runtime
  - `props.items`: obligatorio con exactamente los mismos shapes soportados por `select`

Reglas estructurales adicionales del catálogo actual:
- `heading`, `paragraph`, `list` y `button` siguen tratándose como nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- `repeater` rechaza `children` y solo admite repetición a través de `props.template`.
- `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` solo son válidos como descendientes de un `form`.
- `button` sin `action` solo es válido como descendiente de un `form`.
- `container.props.columns` solo admite enteros entre `1` y `12`.
- `container.props.align`, `container.props.justify` y `container.props.wrap` se validan contra catálogos cerrados y se rechazan con ruta diagnóstica explícita cuando reciben valores fuera de contrato.
- `container.props.wrap` no puede coexistir con `container.props.columns`; esa combinación se rechaza antes del render.
- Si `container` declara `direction` y `columns` a la vez, ambas props siguen siendo válidas en el contrato, pero `columns` pasa a ser el modo de layout efectivo.
- las claves extra no soportadas se descartan del objeto validado final sin convertir por sí solas la configuración en inválida.
- `props.required` deja de formar parte del contrato soportado; la obligatoriedad solo se declara desde `props.validations.required`.

## `queryStateFeedback`
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `query`: nombre no vacío de la query observada
- `states`: mapa opcional con claves limitadas a `idle`, `loading`, `error`, `empty` y `success`

Cada regla de `states` admite exactamente uno de estos modos:
- `mode: show`
- `mode: hide`
- `mode: fallback`, que exige `fallback` como colección ordenada de `LayoutNode[]`

Reglas funcionales vigentes:
- `queryStateFeedback` es transversal a `container`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
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
- `item`
- `item.{segmentosAnidados}`
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.data.{segmentosAnidados}`
- `queries.{queryName}.status`
- `queries.{queryName}.error`

Reglas funcionales vigentes:
- `visibility` es transversal a `container`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
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

Además, la misma convención de referencias completas se reutiliza dentro de `api.query`, en cualquier hoja string de `api.body` y en `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`:
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
- `repeater.props.items.source`
- `visibility.reference`

Referencias soportadas hoy:
- `item`
- `item.{segmentosAnidados}`
- `forms.{formId}.{fieldId}`
- `params.{paramName}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Consumidores adicionales ya soportados con esa misma frontera:
- `repeater.props.items.source`
- `list.props.items.source`
- `select.props.items.source`
- `radioGroup.props.items.source`
- `checkboxGroup.props.items.source`
- `visibility`

Frontera específica de `params.*`:
- `params.{paramName}` solo admite un segmento dinámico después del namespace.
- `params.userId` es válido; `params`, `params.user.id` y segmentos vacíos siguen siendo inválidos.
- `params.*` puede usarse en `heading.props.text`, `paragraph.props.text`, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers` y `defaultValue` de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- `params.*` también puede usarse como origen dentro de `navigateTo.params` para construir la siguiente navegación a partir de la entrada activa.
- Cuando el runtime hidrata `params.*` desde la URL, todos sus valores llegan como string.
- `params.*` sigue fuera de alcance en `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`, aunque esas superficies reutilicen la misma familia general de referencias runtime.

Frontera específica de `item.*`:
- `item` e `item.*` solo son válidos cuando el consumidor vive dentro del subárbol iterado de un `repeater`.
- `item`, `item.slug`, `item.meta.author.name` o `item.tags.0` son ejemplos válidos dentro de ese contexto.
- `item.*` puede usarse en `heading.props.text`, `paragraph.props.text`, `api.query`, `api.body`, `api.headers`, `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`, `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`, `defaultValue` de campos, `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` y `checkboxGroup.props.items.source`.
- Fuera de un `repeater`, `item.*` no forma parte del contrato soportado aunque el shape del string siga siendo reconocible.

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
- Si un `repeater` omite `props.items.source`, `props.items.key` o `props.template`, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `repeater.props.items.key` está vacío, usa una referencia global como `item.id` o `queries.posts.data.0.id`, o contiene una ruta relativa mal formada, el config completo se rechaza antes del render.
- Si `queryStateFeedback.states` contiene una clave fuera de `idle | loading | error | empty | success`, el config completo se rechaza con error de layout sobre esa ruta exacta.
- Si una regla usa `mode: fallback` sin `fallback`, el config completo se rechaza antes del render.
- Si cualquier nodo dentro de `queryStateFeedback.states.{estado}.fallback` es inválido o usa un `type` no soportado, el config completo se rechaza antes del render sobre la ruta afectada.
- Si `visibility.reference` sale del alcance `item.*`, `forms.*` o `queries.*` soportado, el config completo se rechaza antes del render sobre la ruta exacta.
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
- `form.persistOnUnmount` sigue siendo opcional; si aparece con un valor no booleano, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `form.id` se repite en cualquier página, el config completo se rechaza antes del render.
- Si un `fieldId` se repite dentro del mismo `form`, el config completo se rechaza antes del render.
- Si `props.validations` declara una regla desconocida, un shape inválido o una combinación incompatible con el tipo de campo, el config completo se rechaza antes del render sobre la ruta exacta.
- `props.validations.required` solo admite `true` y `{ value: true, message?: string }`; `false` o `{ value: false }` no son contratos válidos.
- `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections` solo admiten número o `{ value: number, message?: string }`.
- `minLength`, `maxLength`, `minSelections` y `maxSelections` deben usar enteros no negativos.
- `min`, `max` y cualquier otro umbral numérico deben ser finitos y no negativos.
- El bootstrap rechaza rangos contradictorios dentro del mismo campo: `minLength > maxLength`, `min > max` y `minSelections > maxSelections`.
- El orden declarado de `props.validations` se conserva en el config normalizado y pasa a ser la prioridad efectiva de evaluación en runtime.
- Si un `form.children` contiene nodos fuera de `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph` y `container`, el config completo se rechaza antes del render.
- Si `input`, `textarea`, `select`, `radioGroup` o `checkboxGroup` aparecen fuera de un subárbol `form`, el config completo se rechaza antes del render.
- Si un `button` sin `action` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
- Si `form.submitAction.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render.
- Si una operación `GET` declara `body`, el config completo se rechaza antes del render.
- Si `button.props.action.type: executeOperation` o `form.submitAction` declaran `body` sobre una operación `GET`, el config completo se rechaza antes del render.
- Si `api.headers`, `button.props.action.headers` o `form.submitAction.headers` usan valores no string, el config completo se rechaza antes del render.
- Si `api.query`, `api.headers`, `button.props.action.query`, `button.props.action.headers`, `form.submitAction.query` o `form.submitAction.headers` contienen claves vacías, el config completo se rechaza antes del render.
- Si `form.resetOnSuccess: true` aparece sin `submitAction`, el config completo se rechaza antes del render.
- Si `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` mezclan `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Si `repeater.props.items.source` declara un origen dinámico, este debe apuntar exactamente a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`.
- Si `list.props.items`, `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` declaran un `source`, este debe apuntar exactamente a `queries.{queryName}.data`, a una ruta anidada bajo `queries.{queryName}.data.*` o a `item.*` cuando el nodo viva dentro de un `repeater`.
- Si `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` o `checkboxGroup.props.items.source` intentan usar `params.*`, el config completo se rechaza antes del render porque esa familia sigue fuera de alcance en esas superficies.
- Si `list.props.items`, `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` mezclan familias incompatibles de origen histórico, manual declarativo y dinámico, el config completo se rechaza antes del render.
- Si un origen dinámico de escalares omite `itemType: 'scalar'`, el config completo se rechaza antes del render.
- Si un origen dinámico u objeto manual omite los mapeos mínimos del consumidor (`itemText` para `list`; `label` y `value` para `select`, `radioGroup` y `checkboxGroup`), el config completo se rechaza antes del render.
- Si un campo de selección múltiple (`select.props.multiple: true` o `checkboxGroup`) declara un `defaultValue` literal no array, el config completo se rechaza antes del render.
- Si un campo de selección simple (`select` simple o `radioGroup`) declara un `defaultValue` literal array, el config completo se rechaza antes del render.
- Si un `defaultValue` literal múltiple contiene miembros no escalares o mezcla strings y números, el config completo se rechaza antes del render.
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
- `navigateTo` ya puede transportar `params` efectivos entre páginas y reflejarlos en el hash canónico del navegador, pero esos params siguen siendo escalares y no abren arrays, objetos, subrutas ni otro namespace distinto de `params.*`.
- `repeater` ya puede expandir un subárbol completo por item de una colección remota, pero sigue fuera de alcance cualquier DSL de templates, filtros cliente, ordenación, paginación o fuentes de colección ajenas a `queries.*`.
- `action` sigue siendo una sola operación por trigger; no hay arrays, secuencias ni callbacks declarativos.
- El trigger sigue siendo implícito por tipo de nodo; el contrato no abre todavía un bloque general de `events`.
- Los formularios declarativos ya soportan `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`, con validación local declarativa ya ampliada a `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections`.
- `visibility` ya cubre show/hide simple por valor runtime, incluido `item.*` dentro de `repeater`, pero no abre branching, `fallback`, arrays de reglas ni expresiones compuestas.
- `list`, `select`, `radioGroup` y `checkboxGroup` ya pueden reutilizar datos de `queries.*` y, dentro de `repeater`, datos de `item.*` como colecciones, pero siguen fuera de alcance filtros cliente, ordenación declarativa, transformaciones arbitrarias, búsqueda remota y carga incremental.
- No hay todavía validaciones declarativas avanzadas (`min`, `max`, patrones o validaciones cruzadas).
- `preloads` ya puede declarar `query`, `body` y `headers` por entrada, pero no admite condiciones, prioridades, secuencialidad, dependencias, múltiples instancias simultáneas del mismo `operationName` ni una caché histórica reutilizable por firma.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `repeater`, `heading`, `paragraph`, `list`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- No hay consumidores declarativos de referencias fuera de `heading.props.text`, `paragraph.props.text`, `queryStateFeedback`, `visibility`, `api.query`, `api.body`, `defaultValue` de campos de formulario, `navigateTo.params`, `repeater.props.items.source` y `source` de colecciones para `list`, `select`, `radioGroup` y `checkboxGroup`.
