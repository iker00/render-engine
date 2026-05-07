# Formularios y validación

## Objetivo
Soportar formularios declarativos con estado interno, campos reutilizables y validación básica, cubriendo ya selección simple y múltiple sobre una semántica compartida de opciones.

## Encaje actual en el contrato de páginas
- El runtime ya implementa `form` como nodo contenedor real dentro de `pages[].layout`.
- La raíz de `pages[].layout` sigue siendo una colección ordenada, así que un formulario puede convivir con otros bloques hermanos sin wrapper sintético.
- `form.children` reutiliza el árbol declarativo existente y admite `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph` y `container`.
- El dominio compartido `forms` del store sigue siendo la única fuente de verdad para valores y errores de formulario.

## Modelo de formulario
- Cada formulario tiene `id`.
- `form.id` debe ser único dentro de toda la configuración.
- Los campos heredan siempre el `formId` desde el contenedor; no lo declaran en su propio shape.
- Los campos escriben en un estado interno por `forms.{formId}.{fieldId}`.
- Cada campo mantiene como base `value`, `error`, `touched`, `dirty` y `defaultValue`.
- La inicialización de campos es lazy: solo se crea estado para un campo cuando aparece visible por primera vez y todavía no existe en la instancia activa.
- Si un campo ya tiene estado porque el usuario escribió o volvió a la página, el runtime conserva ese valor y no rehidrata el `defaultValue`.
- El cambio de página dentro de la misma instancia conserva por defecto el estado de formularios.

## Catálogo implementado en v1
- `input`
- `textarea`
- `select`
- `radioGroup`
- `checkboxGroup`

Reglas estables del catálogo:
- `input` cubre entrada de una sola línea con `inputType` acotado y ya soporta `text`, `email`, `password`, `search`, `tel`, `url`, `number`, `date` y `datetime-local`.
- `textarea` cubre entrada multilínea.
- `select` acepta tanto items históricos estáticos `{ label, value }` como colecciones manuales o dinámicas declaradas desde `queries.*`.
- `select.props.multiple` convierte el campo en selección múltiple y hace que su valor efectivo sea `string[]`.
- `radioGroup` acepta exactamente los mismos shapes de `items` que `select` y conserva una única selección efectiva como `string`.
- `checkboxGroup` acepta exactamente los mismos shapes de `items` que `select` y conserva una selección múltiple efectiva como `string[]`.
- Dentro de un mismo `select`, todos los `value` efectivos deben ser homogéneos en origen (`string` o `number`) aunque en runtime se normalicen a string.
- Dentro de un mismo `radioGroup` o `checkboxGroup`, todos los `value` efectivos también deben ser homogéneos en origen (`string` o `number`).
- Los valores numéricos de `select`, `radioGroup` y `checkboxGroup` se normalizan a string en runtime para compararse, almacenarse, renderizarse y enviarse.
- `select` simple y `radioGroup` comparten la misma semántica de valor vacío `''`.
- `select.multiple` y `checkboxGroup` comparten la misma semántica de valor vacío `[]` y el mismo orden estable según el catálogo efectivo visible.

## Valores por defecto
- Los campos pueden declarar `defaultValue`.
- Ese valor puede ser literal o dinámico.
- La familia `params.*` ya forma parte de las referencias dinámicas soportadas para `defaultValue`.
- Si `defaultValue` es una referencia dinámica, se resuelve una sola vez en el momento de la primera inicialización efectiva del campo.
- Si el dato dinámico aparece más tarde, el runtime no rehidrata automáticamente el campo.
- En `select` simple y en `radioGroup`, si el valor efectivo no coincide con ninguna opción disponible en la colección resuelta, el campo queda vacío.
- En `select.multiple` y en `checkboxGroup`, solo se conservan seleccionados los valores que sigan existiendo en la colección efectiva disponible.
- El reset por formulario restaura el estado inicial efectivo de cada campo usando ese `defaultValue` cuando exista.

## Validación básica de v1
- `required`
- mensaje de error simple por campo (`Required`)

Semántica estable vigente:
- `input` y `textarea` `required` consideran inválidos `''` y strings compuestos solo por espacios.
- `select` simple y `radioGroup` `required` consideran inválido `''` aunque exista una opción placeholder visible en el caso de `select`.
- `select.multiple` y `checkboxGroup` `required` consideran inválido `[]`.
- Si un `select` simple o un `radioGroup` pierde la opción correspondiente a su valor almacenado tras cambiar la colección efectiva, el runtime limpia ese valor a `''` y reutiliza ese mismo estado vacío para render, `required` y submit.
- Si un `select.multiple` o un `checkboxGroup` pierde parte de sus opciones seleccionadas al cambiar la colección efectiva, el runtime elimina solo los valores ya inválidos y reutiliza la colección restante en render, `required` y submit.
- Los errores viven solo en `forms.{formId}.{fieldId}.error`.
- Cuando un campo con error vuelve a un valor válido, el error se limpia al cambiar sin exigir un nuevo submit.
- Un campo oculto por `queryStateFeedback` conserva su valor y su error, pero no bloquea el submit mientras siga oculto.
- Un campo oculto por `visibility` también conserva `value`, `error`, `dirty`, `touched` y `defaultValue`, pero no bloquea el submit mientras siga oculto.
- La visibilidad efectiva de esos campos reutiliza exactamente la misma utilidad compartida que usa el renderer central para combinar `queryStateFeedback` y `visibility`.
- Un campo oculto por `queryStateFeedback.states.idle` no bloquea el submit antes de la primera ejecución de la query observada y vuelve a validarse cuando la query abandona `idle`.
- Si un campo vuelve a hacerse visible tras una regla `visibility`, el runtime reutiliza su estado local existente y vuelve a incluirlo en la validación normal.
- Un campo controlado por `visibility` puede inicializarse lazy la primera vez que llegue a mostrarse, aunque el resto del formulario ya exista en store.

## Submit y reseteo
- `form` renderiza un `<form>` real y maneja submit nativo.
- `submitAction` soporta en esta iteración solo `type: executeOperation`.
- El submit puede activarse con Enter cuando aplica o con un `button` sin `action` dentro del subárbol del formulario.
- Un `button` con `action` explícita dentro del formulario sigue siendo auxiliar y no dispara submit implícito.
- `submitAction` puede añadir `query`, `body` y `headers` por ejecución sobre la operación `api` base sin duplicar operaciones casi idénticas.
- El payload efectivo del submit reutiliza referencias `forms.{formId}.{fieldId}` ya soportadas en `api.query`, `api.body`, `api.headers` y en los canales equivalentes de `submitAction`.
- El resultado visible del submit vive solo en `queries.{operationName}`; no existe un dominio paralelo de `submitting`, `submitSuccess` o `submitError`.
- El submit resuelve sus referencias contra el snapshot más reciente del runtime tras la validación local del formulario.
- Si `submitAction` y la operación base aportan request params a la vez, `query` y `headers` combinan por clave con precedencia del submit, y `body` sigue la misma semántica limitada de merge superficial o sustitución total que usa el dominio `queries`.

Semántica estable vigente del reset:
- `resetForm` restaura el estado inicial efectivo de cada campo del formulario objetivo.
- Si `form.resetOnSuccess` es `true`, un submit exitoso dispara ese mismo reset estable.
- Si el submit falla, el runtime conserva los valores actuales del usuario y no resetea automáticamente.
- El shape se valida en bootstrap, pero `formId` no se comprueba contra un catálogo semántico global inexistente.
- Si el formulario todavía no está inicializado en el store, la pantalla se mantiene estable y no aparece una semántica nueva de error.

## Casos funcionales soportados hoy
- formulario de búsqueda con resultados
- formulario de edición con datos iniciales cargados por `preloads` o recibidos por `params.*`
- formulario simple de alta o edición con submit declarativo vía `api`
- campos condicionales ocultables por `queryStateFeedback` sin perder su estado local
- campos condicionales ocultables por `visibility` según `forms.*` o `queries.*`, sin perder su estado local ni bloquear el submit mientras siguen ocultos
- `select` simple o múltiple dependiente de catálogos remotos ya cargados en `queries.*`, sin lógica React específica por pantalla
- grupos `radioGroup` y `checkboxGroup` alimentados por colecciones manuales o por `queries.*`, compartiendo la misma semántica de opciones que `select`

## Límites actuales
- No existen todavía subida de archivos ni otros tipos de campo fuera de `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- No existen todavía búsqueda remota, paginación ni carga incremental de opciones para los campos de selección.
- No existen todavía validaciones declarativas avanzadas, mensajes personalizados complejos ni validaciones cruzadas.
- No existe todavía una política nueva de limpieza global de formularios al cambiar de página.
