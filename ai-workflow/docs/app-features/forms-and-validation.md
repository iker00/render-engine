# Formularios y validación

## Objetivo
Soportar formularios declarativos con estado interno, campos reutilizables y validación básica.

## Encaje actual en el contrato de páginas
- El runtime ya implementa `form` como nodo contenedor real dentro de `pages[].layout`.
- La raíz de `pages[].layout` sigue siendo una colección ordenada, así que un formulario puede convivir con otros bloques hermanos sin wrapper sintético.
- `form.children` reutiliza el árbol declarativo existente y admite `input`, `textarea`, `select`, `button`, `heading`, `paragraph` y `container`.
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

Reglas estables del catálogo:
- `input` cubre entrada textual de una sola línea con `inputType` acotado.
- `textarea` cubre entrada multilínea.
- `select` acepta solo items estáticos `{ label, value }`.
- Dentro de un mismo `select`, todos los `value` deben ser `string` o todos `number`.
- Los valores numéricos de `select` se normalizan a string en runtime para compararse, almacenarse y renderizarse.

## Valores por defecto
- Los campos pueden declarar `defaultValue`.
- Ese valor puede ser literal o dinámico.
- Si `defaultValue` es una referencia dinámica, se resuelve una sola vez en el momento de la primera inicialización efectiva del campo.
- Si el dato dinámico aparece más tarde, el runtime no rehidrata automáticamente el campo.
- En `select`, si el valor efectivo no coincide con ninguna opción declarada, el campo queda vacío.
- El reset por formulario restaura el estado inicial efectivo de cada campo usando ese `defaultValue` cuando exista.

## Validación básica de v1
- `required`
- mensaje de error simple por campo (`Required`)

Semántica estable vigente:
- `input` y `textarea` `required` consideran inválidos `''` y strings compuestos solo por espacios.
- `select` `required` considera inválido `''` aunque exista una opción placeholder visible.
- Los errores viven solo en `forms.{formId}.{fieldId}.error`.
- Cuando un campo con error vuelve a un valor válido, el error se limpia al cambiar sin exigir un nuevo submit.
- Un campo oculto por `queryStateFeedback` conserva su valor y su error, pero no bloquea el submit mientras siga oculto.

## Submit y reseteo
- `form` renderiza un `<form>` real y maneja submit nativo.
- `submitAction` soporta en esta iteración solo `type: executeOperation`.
- El submit puede activarse con Enter cuando aplica o con un `button` sin `action` dentro del subárbol del formulario.
- Un `button` con `action` explícita dentro del formulario sigue siendo auxiliar y no dispara submit implícito.
- El payload del submit reutiliza referencias `forms.{formId}.{fieldId}` ya soportadas en `api.body`.
- El resultado visible del submit vive solo en `queries.{operationName}`; no existe un dominio paralelo de `submitting`, `submitSuccess` o `submitError`.

Semántica estable vigente del reset:
- `resetForm` restaura el estado inicial efectivo de cada campo del formulario objetivo.
- Si `form.resetOnSuccess` es `true`, un submit exitoso dispara ese mismo reset estable.
- Si el submit falla, el runtime conserva los valores actuales del usuario y no resetea automáticamente.
- El shape se valida en bootstrap, pero `formId` no se comprueba contra un catálogo semántico global inexistente.
- Si el formulario todavía no está inicializado en el store, la pantalla se mantiene estable y no aparece una semántica nueva de error.

## Casos funcionales soportados hoy
- formulario de búsqueda con resultados
- formulario de edición con datos iniciales
- formulario simple de alta o edición con submit declarativo vía `api`
- campos condicionales ocultables por `queryStateFeedback` sin perder su estado local

## Límites actuales
- No existen todavía `radioGroup`, `checkboxGroup`, subida de archivos ni otros tipos de campo.
- `select` no soporta items dinámicos.
- No existen todavía validaciones declarativas avanzadas, mensajes personalizados complejos ni validaciones cruzadas.
- No existe todavía una política nueva de limpieza global de formularios al cambiar de página.
