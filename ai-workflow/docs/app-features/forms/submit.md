> Cuándo leer: `submitAction.type: executeOperation`, payload efectivo, resolución de `forms.*`/`item.*` en submit, `resetOnSuccess`, semántica de `resetForm`.
> Tamaño: corto.
> Relacionados: [[../queries/execution.md]], [[validation-rules.md]], [[../references/reference-resolution.md]].

# Submit y reseteo

## Submit
- `form` renderiza un `<form>` real y maneja submit nativo.
- `submitAction` soporta `type: executeOperation` (singular) para una sola operación, o `type: executeOperations` (plural) para lanzar varias operaciones en paralelo.
- El submit puede activarse con Enter cuando aplica o con un `button` sin `action` dentro del subárbol del formulario.
- Un `button` con `action` explícita dentro del formulario sigue siendo auxiliar y no dispara submit implícito.
- `submitAction` puede añadir `query`, `body` y `headers` por ejecución sobre la operación `api` base sin duplicar operaciones casi idénticas.
- En `executeOperations` (plural), cada entrada de la lista declara `operationName` y puede aportar overrides propios de `query`, `body` y `headers`. Las operaciones se lanzan en paralelo; no existe orden garantizado entre ellas.
- El payload efectivo del submit reutiliza referencias `forms.{formId}.{fieldId}` ya soportadas en `api.query`, `api.body`, `api.headers` y en los canales equivalentes de `submitAction`.
- Cuando un campo del formulario está oculto en el momento del submit, cualquier clave del payload cuya referencia apunte a ese campo se omite del wire format final (ver [[lifecycle.md#Campos ocultos]]).
- Dentro de un `repeater`, `submitAction.query`, `submitAction.body` y `submitAction.headers` también pueden resolver `item.*` contra el item actual sin abrir una semántica distinta por formulario.
- El resultado visible del submit vive solo en `queries.{operationName}`; no existe un dominio paralelo de `submitting`, `submitSuccess` o `submitError`.
- El submit resuelve sus referencias contra el snapshot más reciente del runtime tras la validación local del formulario.
- Si `submitAction` y la operación base aportan request params a la vez, `query` y `headers` combinan por clave con precedencia del submit, y `body` sigue la misma semántica limitada de merge superficial o sustitución total que usa el dominio `queries`.

### Serialización multipart/form-data

Cuando un formulario contiene campos `fileInput` con al menos un fichero seleccionado:
- El payload se serializa como `multipart/form-data` en lugar de JSON o query params.
- Los ficheros del campo `fileInput` se incluyen como partes binary: cada fichero ocupa una entrada con nombre `{fieldId}` en el FormData.
- Si un campo `fileInput` tiene múltiples ficheros seleccionados (`multiple: true`), cada fichero se envía como una entrada separada con el mismo nombre de campo.
- Los campos de texto del mismo formulario se incluyen como partes de texto del mismo FormData, manteniendo sus nombres de campo.
- Un formulario sin `fileInput` con ficheros seleccionados sigue usando la serialización habitual (JSON o query params), sin regresión.

## Acciones post-éxito (`onSuccess`)
- `submitAction` acepta opcionalmente `onSuccess`: una lista ordenada de acciones a ejecutar tras un submit exitoso.
- Las acciones de `onSuccess` pueden ser cualquiera del catálogo de botón: `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`.
- Cada acción en `onSuccess` puede declarar opcionalmente `when` con el mismo shape que `visibility`: `{ reference, operator, value? }`.
- Las acciones se evalúan y ejecutan en orden declarado; todas las que cumplan su condición `when` se ejecutan sin semántica de "primera coincidencia".
- Una acción sin `when` siempre se ejecuta.
- Si la condición `when` no se cumple, la acción se omite silenciosamente.
- Si el submit falla, no se ejecuta ninguna acción de `onSuccess`.
- Con `submitAction.type: executeOperations` (plural), `onSuccess` se ejecuta solo si **todas** las operaciones de la lista terminan en éxito.
- Las referencias `queries.{operationName}.*` ya reflejan el estado `success` y sus datos antes de que se evalúen los `when` de las acciones `onSuccess`.

## Acciones post-fallo (`onError`)
- `submitAction` acepta opcionalmente `onError`: una lista ordenada de acciones a ejecutar tras un submit fallido.
- Las acciones de `onError` pueden ser cualquiera del catálogo de botón: `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`.
- Cada acción en `onError` puede declarar opcionalmente `when` con el mismo shape que `visibility`: `{ reference, operator, value? }`.
- Las acciones se evalúan y ejecutan en orden declarado; todas las que cumplan su condición `when` se ejecutan sin semántica de "primera coincidencia".
- Una acción sin `when` siempre se ejecuta.
- Si la condición `when` no se cumple, la acción se omite silenciosamente.
- `onError` se ejecuta cuando el submit termina en error HTTP o error de negocio vía `errorCondition`.
- `onError` **no** se ejecuta cuando el submit tiene éxito.
- `onError` **no** se ejecuta cuando el submit falla por validación local de campos; esa situación se resuelve exclusivamente con mensajes de validación inline.
- Con `submitAction.type: executeOperations` (plural), `onError` se ejecuta si **alguna** de las operaciones de la lista termina en error, aunque otras tengan éxito.
- Las referencias `queries.{operationName}.*` ya reflejan el estado `error` (incluyendo `error.message` y `error.code`) antes de que se evalúen los `when` de las acciones `onError`.
- `onSuccess` y `onError` pueden coexistir en el mismo `submitAction`; se ejecuta únicamente el bloque que corresponda al resultado del submit.
- `onError` es terminal: si una acción dentro de `onError` falla, ese fallo no dispara recursivamente otro ciclo de `onError`.

## Reseteo
- `resetForm` restaura el estado inicial efectivo de cada campo del formulario objetivo.
- `resetForm` no borra `forms.{formId}` ni sustituye la limpieza por desmontaje; solo restaura el estado inicial efectivo del formulario actualmente presente en store.
- Si `form.resetOnSuccess` es `true`, el comportamiento depende del tipo de `submitAction`:
  - Con `submitAction.type: executeOperation` (singular): un submit exitoso dispara el reset.
  - Con `submitAction.type: executeOperations` (plural): el reset solo se dispara si **todas** las operaciones de la lista terminan en `status: success`. Si alguna operación falla, el formulario conserva sus valores actuales.
- Si existe `onSuccess`, el reset se ejecuta **después** de todas las acciones de `onSuccess`.
- Si el submit falla, el runtime conserva los valores actuales del usuario y no resetea automáticamente.
- `resetOnSuccess` no interacciona con `onError`; su ejecución sigue siendo posterior a `onSuccess` y no se ve afectada por la presencia de `onError`.
- El shape se valida en bootstrap, pero `formId` no se comprueba contra un catálogo semántico global inexistente.
- Si el formulario todavía no está inicializado en el store, la pantalla se mantiene estable y no aparece una semántica nueva de error.
- `resetOnSuccess: true` coexiste con `onSuccess`; ambos pueden estar presentes a la vez.
