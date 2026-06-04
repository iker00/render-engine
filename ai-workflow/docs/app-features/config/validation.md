> Cuándo leer: validación previa al render, fachada pública del validador, política de errores estructurales, comportamiento dev/prod, frontera de `src/config/`.
> Tamaño: largo.
> Relacionados: [[../runtime/error-behavior.md]], [[../runtime/organization.md]], [[structure.md]].

# Validación del runtime config

## Política general
- La configuración debe validarse antes de renderizarse.
- La validación estructural del contrato se apoya en esquemas `Zod`, manteniendo una única fachada pública estable en `validateRuntimeConfig`.
- La validación comprueba estructura general, shape de `api`, `pages`, `preloads`, colección `layout` y shape de los nodos soportados.

## Frontera estable
- `src/config/runtime-config.ts`: fachada pública para consumidores como bootstrap y tests.
- `src/config/runtime-config-types.ts`: tipos del contrato y shape del resultado de validación.
- `src/config/runtime-config-zod.ts`: esquemas `Zod` internos del contrato estructural y helpers de shape.
- `src/config/runtime-config-validation-errors.ts`: adaptador interno para construir errores públicos coherentes.
- `src/config/validate-runtime-config.ts`: orquestación de parseo estructural, adaptación diagnóstica y validaciones cruzadas previas al render.

## Validación estructural global
- Si `layout` no es un array válido, el arranque falla con un error explícito sobre la ruta afectada.
- Si aparece un nodo no soportado en la raíz o dentro de `children`, el runtime lo trata como error de configuración y no lo reinterpreta.
- Si `form.children` contiene nodos fuera de `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph`, `image`, `table` y `container`, el config completo se rechaza antes del render.
- Si `input`, `textarea`, `select`, `radioGroup` o `checkboxGroup` aparecen fuera de un subárbol `form`, el config completo se rechaza antes del render.
- Si un `button` sin `action` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.

## Reglas cruzadas de páginas y acciones
- Si `initialPage` no existe dentro de `pages`, el runtime falla antes del render con `initial-page-not-found`.
- Si un `button.props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `button.props.action.params` existe en `navigateTo`, debe ser un objeto plano con claves no vacías y valores escalares `string | number | boolean | null`.
- Si `button.props.action.params` incluye arrays, objetos anidados o rutas `params.*` mal formadas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si un `button.props.action.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `form.submitAction.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render.
- `resetForm` valida shape y `formId` no vacío, pero no intenta cerrar en bootstrap un catálogo semántico adicional de formularios.

## Reglas de `api` y headers
- Si una operación `GET` declara `body`, el config completo se rechaza antes del render.
- Si `button.props.action.type: executeOperation` o `form.submitAction` declaran `body` sobre una operación `GET`, el config completo se rechaza antes del render.
- Si `api.headers`, `button.props.action.headers` o `form.submitAction.headers` usan valores no string, el config completo se rechaza antes del render.
- Si `api.query`, `api.headers`, `button.props.action.query`, `button.props.action.headers`, `form.submitAction.query` o `form.submitAction.headers` contienen claves vacías, el config completo se rechaza antes del render.

## Reglas de formularios
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
- Si `form.resetOnSuccess: true` aparece sin `submitAction`, el config completo se rechaza antes del render.

## Reglas de items y colecciones
- Si `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` mezclan `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Si `list.props.items.itemText`, `select.props.items.label`, `select.props.items.value`, `radioGroup.props.items.label`, `radioGroup.props.items.value`, `checkboxGroup.props.items.label` o `checkboxGroup.props.items.value` contienen delimitadores `{{` o `}}`, la validación los acepta como proyecciones interpolables del catálogo cerrado y deja la degradación de placeholders al runtime.
- Si esas mismas proyecciones no contienen delimitadores de plantilla, conservan la validación histórica de ruta relativa al item.
- Si `repeater.props.items.source` declara un origen dinámico, este debe apuntar exactamente a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`.
- Si `list.props.items`, `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` declaran un `source`, este debe apuntar exactamente a `queries.{queryName}.data`, a una ruta anidada bajo `queries.{queryName}.data.*` o a `item.*` cuando el nodo viva dentro de un `repeater`.
- Si `list.props.items`, `select.props.items`, `radioGroup.props.items` o `checkboxGroup.props.items` mezclan familias incompatibles de origen histórico, manual declarativo y dinámico, el config completo se rechaza antes del render.
- Si un origen dinámico de escalares omite `itemType: 'scalar'`, el config completo se rechaza antes del render.
- Si un origen dinámico u objeto manual omite los mapeos mínimos del consumidor (`itemText` para `list`; `label` y `value` para `select`, `radioGroup` y `checkboxGroup`), el config completo se rechaza antes del render.
- Si `visibility.reference`, `repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source` o `checkboxGroup.props.items.source` intentan usar `params.*`, el config completo se rechaza antes del render porque esa familia sigue fuera de alcance en esas superficies.
- Si `repeater.props.items.key`, `props.items.source`, `visibility.reference`, `queryStateFeedback`, `navigateTo.params`, requests, `defaultValue` o cabeceras de `table` intentan usar templates parciales, no se amplía su contrato por esta capacidad.
- Si un campo de selección múltiple (`select.props.multiple: true` o `checkboxGroup`) declara un `defaultValue` literal no array, el config completo se rechaza antes del render.
- Si un campo de selección simple (`select` simple o `radioGroup`) declara un `defaultValue` literal array, el config completo se rechaza antes del render.
- Si un `defaultValue` literal múltiple contiene miembros no escalares o mezcla strings y números, el config completo se rechaza antes del render.

## Reglas del nodo `tabs`

- `props.items` es obligatorio y debe ser un array con al menos un elemento; si está ausente o vacío, el config completo se rechaza con código `invalid-layout` y ruta que incluye `props.items`.
- Cada item de `props.items` debe declarar `label` como string; si falta, el config se rechaza con código `invalid-layout` y ruta que incluye el índice del item y `.label` (p. ej. `props.items[0].label`).
- `props.orientation` solo acepta `"horizontal"` o `"vertical"` si se declara; cualquier otro valor rechaza el config con código `invalid-layout` y ruta que incluye `props.orientation`.
- Los `children` de cada item se validan recursivamente como colección de nodos del catálogo, con la misma semántica que los `children` de `container`: tipos desconocidos producen `unsupported-node-type`; contratos inválidos producen `invalid-layout`.
- No existe un allowlist de tipos de `children` para `tabs`: admite cualquier nodo válido del catálogo, incluidos `form`, `repeater`, `container` y todos los nodos hoja.
- La ruta diagnóstica de errores dentro de los `children` sigue el patrón `props.items[N].children`.

## Reglas del nodo `badge`

- `props.label` es obligatorio y debe ser string; si está ausente o no es string, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.label`.
- `props.variant` solo acepta `"pill"` o `"circle"` si se declara; cualquier otro valor rechaza el config con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `props.color` solo acepta `"neutral"`, `"primary"`, `"success"`, `"warning"`, `"danger"` o `"info"` si se declara; cualquier otro valor rechaza el config con `invalid-layout` y diagnóstico de ruta `{path}.props.color`.
- `badge` no acepta `children`; si se declaran, no pasan al resultado normalizado (nodo hoja).
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Reglas del nodo `link`

- `props.label` es obligatorio; si está ausente o vacío, el config se rechaza con `invalid-layout` y ruta `{path}.props.label`.
- `props.href` y `props.action` son mutuamente excluyentes; si se declaran simultáneamente, el config se rechaza con `invalid-layout` y ruta `{path}`.
- Debe declararse exactamente uno de `props.href` o `props.action`; si ninguno está presente, el config se rechaza con `invalid-layout` y ruta `{path}`.
- `props.download` sin `props.href` rechaza el config con `invalid-layout` y ruta `{path}.props.download`.
- `props.target` sin `props.href` rechaza el config con `invalid-layout` y ruta `{path}.props.target`.
- `props.action.type` solo acepta `"navigateTo"` o `"goBack"`; cualquier otro valor rechaza el config con `invalid-layout` y ruta `{path}.props.action.type`.
- Si `props.action.type` es `"navigateTo"`, se aplican las mismas reglas de `pageId` y `params` que en `button`: `pageId` es obligatorio, debe existir en `pages`, y `params` si se declara debe ser objeto plano con claves no vacías y valores escalares.
- Si `props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render con `invalid-layout`.

## Reglas del nodo `alert`

- `props.message` es obligatorio y debe ser string; si está ausente o no es string, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.message`.
- `props.type` solo acepta `"neutral"`, `"primary"`, `"success"`, `"warning"`, `"danger"` o `"info"` si se declara; cualquier otro valor rechaza el config con `invalid-layout` y diagnóstico de ruta `{path}.props.type`.
- `props.title` es opcional; si se declara y no es string, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.title`.
- `alert` no acepta `children`; si se declaran, no pasan al resultado normalizado (nodo hoja).
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Reglas del nodo `stat`

- `props.label` es obligatorio y debe ser string; si está ausente o no es string, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.label`.
- `props.value` es obligatorio y debe ser string; si está ausente o no es string, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.value`.
- `props.variant` solo acepta `"accent"` o `"tinted"` si se declara; cualquier otro valor rechaza el config con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `props.color` solo acepta `"neutral"`, `"primary"`, `"success"`, `"warning"`, `"danger"` o `"info"` si se declara; cualquier otro valor rechaza el config con `invalid-layout` y diagnóstico de ruta `{path}.props.color`.
- `stat` no acepta `children`; si se declaran, no pasan al resultado normalizado (nodo hoja).
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Política de errores
- Los errores estructurales conservan la semántica pública actual (`invalid-layout` o `unsupported-node-type`) y ahora incluyen rutas canónicas del JSON cuando aplica, por ejemplo `layout[0].props.items[1]` o `searchUsers.query.filters`.
- En desarrollo, los errores de configuración deben ser diagnósticos y visibles.
- En producción, los errores `development-only` degradan sin mostrar mensaje genérico visible.

Las reglas de validación específicas por nodo viven en sus respectivos sub-documentos bajo [`../nodes/`](../nodes/index.md). Las reglas específicas de `queryStateFeedback` y `visibility` viven en [`../references/query-state-feedback.md`](../references/query-state-feedback.md) y [`../references/visibility.md`](../references/visibility.md).
