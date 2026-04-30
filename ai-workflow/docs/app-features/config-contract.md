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

Reglas funcionales vigentes:
- `GET` no admite `body`.
- `POST`, `PUT`, `PATCH` y `DELETE` pueden declarar `body`.
- `query` se mantiene plano; no existe soporte estable para nested params, claves repetidas ni arrays serializados en query string.
- `body` puede contener objetos, arrays, strings, números, booleanos y `null` siempre que el árbol completo siga siendo JSON serializable.
- `body: null` en la raíz es válido para métodos con body y significa petición explícita sin body JSON serializado.
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
- `children`: opcional, pero solo interpretado en `container`

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
  - `props.items`: array obligatorio de strings
- `button`
  - `props.label`: string obligatorio
  - `props.action.type`: `navigateTo | goBack`
  - `props.action.pageId`: string obligatorio y no vacío cuando `type` es `navigateTo`

Reglas estructurales adicionales del catálogo actual:
- `heading`, `paragraph`, `list` y `button` siguen tratándose como nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- las claves extra no soportadas se descartan del objeto validado final sin convertir por sí solas la configuración en inválida.

## `queryStateFeedback`
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `query`: nombre no vacío de la query observada
- `states`: mapa opcional con claves limitadas a `loading`, `error`, `empty` y `success`

Cada regla de `states` admite exactamente uno de estos modos:
- `mode: show`
- `mode: hide`
- `mode: fallback`, que exige `fallback` como colección ordenada de `LayoutNode[]`

Reglas funcionales vigentes:
- `queryStateFeedback` es transversal a `container`, `heading`, `paragraph`, `list` y `button`.
- `fallback` reutiliza el mismo catálogo de nodos soportados por `layout`; no introduce un dialecto paralelo ni un wrapper sintético obligatorio.
- un fallback puede contener varios nodos hermanos y conserva su orden declarado.
- si un estado visible no tiene regla explícita, el runtime aplica `success -> show` y `loading/error/empty -> hide`.
- `idle` se proyecta como `loading` para esta capacidad.
- una query ausente del store también se interpreta como `loading`.

## Resolución inicial
- El runtime valida toda la configuración antes de renderizar.
- Tras validar `pages`, resuelve la página cuyo `id` coincide con `initialPage`.
- Si `initialPage` no existe dentro de `pages`, el arranque falla con un error explícito.

## Referencias dinámicas
Las referencias dinámicas ya forman parte del contrato visible actual, pero con un alcance intencionadamente acotado:
- solo se interpretan cuando el string completo de `heading.props.text` o `paragraph.props.text` coincide con una referencia soportada
- el escape literal con `\` permite mostrar una referencia tal cual, por ejemplo `\queries.searchUsers.data.results.0.name`
- no existe interpolación parcial dentro de strings

Además, la misma convención de referencias completas se reutiliza dentro de `api.query` y en cualquier hoja string de `api.body`:
- un string literal se conserva como literal
- un string escapado con `\` se conserva sin el prefijo de escape
- una referencia soportada se resuelve contra el estado actual del runtime en el momento de invocación
- una referencia soportada pero sin valor disponible no invalida el config en bootstrap; produce un error de construcción del request al ejecutar la operación

Referencias soportadas hoy:
- `forms.{formId}.{fieldId}`
- `queries.{queryName}`
- `queries.{queryName}.data`
- `queries.{queryName}.status`
- `queries.{queryName}.error`
- `queries.{queryName}.data.{segmentosAnidados}`

Reglas funcionales vigentes:
- la navegación anidada adicional solo se admite bajo `queries.{queryName}.data`
- los segmentos anidados pueden recorrer objetos y arrays
- un segmento numérico se interpreta como índice solo cuando el valor actual es un array; sobre objetos se trata como clave literal
- `queries.{queryName}.status.*` y `queries.{queryName}.error.*` siguen fuera del contrato y se consideran rutas inválidas
- `routeParams.*`, `params.*` y `navigation.*` siguen reservadas pero no soportadas
- una referencia bien formada cuyo dato no existe todavía se degrada según la política visible del consumidor; en superficies textuales actuales eso significa string vacío

## Validación
- La configuración debe validarse antes de renderizarse.
- La validación estructural del contrato se apoya ahora en esquemas `Zod`, manteniendo una única fachada pública estable en `validateRuntimeConfig`.
- La validación comprueba estructura general, shape de `api`, `pages`, `preloads`, colección `layout` y shape de los nodos soportados.
- Si `layout` no es un array válido, el arranque falla con un error explícito sobre la ruta afectada.
- Si aparece un nodo no soportado en la raíz o dentro de `children`, el runtime lo trata como error de configuración y no lo reinterpreta.
- Si `queryStateFeedback.states` contiene una clave fuera de `loading | error | empty | success`, el config completo se rechaza con error de layout sobre esa ruta exacta.
- Si una regla usa `mode: fallback` sin `fallback`, el config completo se rechaza antes del render.
- Si cualquier nodo dentro de `queryStateFeedback.states.{estado}.fallback` es inválido o usa un `type` no soportado, el config completo se rechaza antes del render sobre la ruta afectada.
- Si `initialPage` no existe dentro de `pages`, el runtime sigue fallando antes del render con `initial-page-not-found`.
- Si un `button.props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render aunque el shape estructural sea válido.
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
- `api` no tiene todavía disparadores declarativos visuales desde el árbol `layout`; la ejecución activa hoy ocurre mediante la fachada imperativa del provider y por `preloads` de página al entrar en ella.
- `preloads` solo admite una lista plana de strings; no hay condiciones, prioridades, secuencialidad, dependencias ni políticas de caché.
- No hay interpolación compleja dentro de strings.
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `heading`, `paragraph`, `list` y `button`.
- No hay consumidores declarativos de referencias fuera de `heading.props.text`, `paragraph.props.text` y `queryStateFeedback`.
