> Cuándo leer: `submitAction.type: executeOperation`, payload efectivo, resolución de `forms.*`/`item.*` en submit, `resetOnSuccess`, semántica de `resetForm`.
> Tamaño: corto.
> Relacionados: [[../queries/execution.md]], [[validation-rules.md]], [[../references/reference-resolution.md]], [[../nodes/file-input.md]].

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

### `fileInput` como campo estándar referenciable

`fileInput` no es un caso especial de serialización: se comporta como cualquier otro campo del formulario respecto al payload de submit.
- Un `fileInput` con ficheros seleccionados solo aporta clave al body si `submitAction.body`/`api.body` lo referencia explícitamente con `forms.{formId}.{fieldId}`, igual que el resto de campos. Sin esa referencia, no aporta ninguna clave.
- Cuando está referenciado, la referencia resuelve a un array de objetos `{ name, size, mime, data }` (uno por fichero seleccionado, `data` en base64 estándar sin prefijo), con independencia de `props.multiple`. Sin ficheros seleccionados, resuelve a `[]`.
- La codificación a base64 ocurre de forma asíncrona en el momento del submit, antes de emitir la llamada de red. El submit sigue usando la serialización habitual de la operación (`content-type: application/json` o query params) — nunca `multipart/form-data` — con independencia de si el formulario contiene `fileInput`.
- Si la codificación de algún fichero falla (fallo de lectura del navegador), la query transita a `status: error` con `code: request-build-failed`, sin emitir red, siguiendo la misma semántica que otros fallos de construcción de request.
- Un `fileInput` oculto por `visibility` en el momento del submit sigue la misma semántica de omisión de campos ocultos que el resto de campos: se omite del payload sin producir `request-build-failed`.
- Un formulario sin ningún `fileInput` referenciado mantiene exactamente el mismo comportamiento de submit que un formulario sin `fileInput`, sin regresión.
- Este comportamiento aplica únicamente a `fileInput`. El nodo `fileManager` (subida standalone fuera de formulario) sigue enviando `multipart/form-data` por fichero contra sus operaciones configuradas, sin cambios; ver [[../nodes/file-input.md]] y [[../nodes/file-manager.md]].

### `emptySubmitValue` en `select` de selección simple

Un `select` de selección simple puede declarar `props.emptySubmitValue` (literal escalar `string | number`) para sustituir el `''` que se enviaría en el payload cuando el campo está vacío en el momento del submit.
- La sustitución solo afecta a la resolución de `forms.{formId}.{fieldId}` dentro del payload de submit (`body`, `query`, `headers` de la operación base o de `submitAction`, normalizada a string); el store y la UI del campo no cambian.
- Si el campo tiene un valor efectivo distinto de `''`, `emptySubmitValue` no tiene ningún efecto.
- `emptySubmitValue` no exime la validación `required`: un campo vacío con `required` activo sigue bloqueando el submit.
- Si el campo está oculto en el momento del submit, se aplica la omisión de campos ocultos ya descrita arriba; `emptySubmitValue` nunca reintroduce una clave omitida.
- Contrato completo y ejemplos en [[../nodes/select.md]]; detalle a nivel de resolución de payload en [[../queries/execution.md]].

## Acciones post-éxito (`onSuccess`)
- Esta capacidad ya no es exclusiva de `submitAction`: `button.props.action.type: executeOperation`/`executeOperations` acepta la misma pareja `onSuccess`/`onError` con idéntica semántica, ver [[../nodes/button.md#Acciones post-ejecución onSuccess onError]].
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
