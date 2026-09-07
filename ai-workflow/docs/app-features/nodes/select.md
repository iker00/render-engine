> Cuándo leer: nodo `select`, selección simple o múltiple, shapes de `items` manuales o dinámicos, semántica de valor efectivo cuando cambia la colección, valor de sustitución en submit para selección vacía.
> Tamaño: medio.
> Relacionados: [[choice-groups.md]], [[../forms/defaults.md]], [[../forms/validation-rules.md]], [[../forms/submit.md]], [[../references/dynamic-strings.md]], [[../references/collection-pipeline.md]].

# `select`

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.placeholder`: string opcional, literal o string visible interpolado con `{{...}}`. Solo aplica a selección simple (`multiple` ausente o `false`); se renderiza como opción deshabilitada al inicio del listado cuando el campo está vacío. No aplica a selección múltiple (`multiple: true`).
- `props.tooltip`: string opcional, literal, referencia dinámica completa o string visible interpolado con `{{...}}`. Cuando resuelve a un string no vacío, se renderiza un icono de información (`HelpCircle`) junto al texto del label con un tooltip flotante accesible (hover y focus). Cuando está ausente o resuelve a vacío, no se renderiza nada adicional.
- `props.validations`: objeto opcional y ordenado por declaración.
  - `props.validations.required`: `true` o `{ value: true, message?: string }`.
  - `props.validations.minSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`.
  - `props.validations.maxSelections`: número o `{ value: number, message?: string }`, solo cuando `props.multiple: true`.
- `props.defaultValue`: literal escalar para selección simple, array escalar homogéneo para selección múltiple o referencia dinámica completa soportada por el runtime.
- `props.items`: obligatorio.
- `props.multiple`: boolean opcional; cuando vale `true`, el valor efectivo del campo pasa a ser una colección ordenada.
- `props.emptySubmitValue`: literal escalar (`string | number`) opcional, exclusivo de selección simple (`multiple` ausente o `false`). No necesita coincidir con ningún `value` de `props.items`. Ver comportamiento completo más abajo y en [[../forms/submit.md]].

## Shapes de `items`
Contrato cerrado a exactamente tres shapes; cualquier otro shape rechaza el config completo en bootstrap con `code: invalid-layout` y ruta exacta al `props.items` del nodo.
- **manual literal**: array de `{ label, value }`, con `value` homogéneo `string` o `number` dentro del mismo campo.
- **manual escalar**: `{ values: Array<string | number> }`.
- **dinámico unificado**: `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*' [| pipeline], itemType: 'scalar' | 'object', label?, value? }`, donde `itemType` es obligatorio. El `source` puede incluir opcionalmente un pipeline declarativo (ver [[../references/collection-pipeline.md]]) para filtrar, ordenar o recortar los items antes de presentarlos:
  - `itemType: 'scalar'`: ni `label` ni `value` pueden declararse.
  - `itemType: 'object'`: `label` y `value` son obligatorios y aceptan ruta relativa histórica o interpolación parcial con `{{...}}`.

El shape manual objeto (`{ values: Array<object>, label, value }`) y los dos shapes dinámicos separados anteriores (`{ source, itemType: 'scalar' }` opcional sin restricción, y `{ source, label, value }` sin `itemType`) ya no forman parte del contrato: se rechazan explícitamente, sin adaptador de compatibilidad silencioso.

## Reglas de render
- `select` acepta tanto items históricos estáticos `{ label, value }` como colecciones manuales o dinámicas declaradas desde `queries.*`.
- `select.props.multiple` activa una semántica de selección múltiple basada en `string[]`, con el mismo orden estable del catálogo efectivo visible y la misma limpieza automática de valores ya inválidos.
- `select.props.multiple` mantiene una altura mínima suficiente para uso real, pero también más contenida que en la baseline previa.
- Sus labels y values string de opción pueden interpolarse parcialmente, se normalizan internamente a string los valores efectivos y el valor vigente queda vacío cuando ya no coincide con ninguna opción disponible.
- El control `<select>` renderiza un `id` estable con el patrón `${formId}-${fieldId}`. La asociación label↔control se realiza vía `<label>` wrapper implícito; el `<select>` no incluye `aria-label` redundante. Cuando hay error activo, incluye `aria-describedby="${formId}-${fieldId}-error"` apuntando al span de error, que lleva el mismo `id`. Cuando no hay error, el atributo `aria-describedby` no está presente.

## Semántica de valores
- Dentro de un mismo `select`, todos los `value` efectivos no interpolados deben ser homogéneos en origen (`string` o `number`) aunque en runtime se normalicen a string; cuando un `value` string se interpola, el resultado final entra como string efectivo.
- Los valores numéricos de `select` se normalizan a string en runtime para compararse, almacenarse, renderizarse y enviarse.
- Los valores interpolados de opción se normalizan como strings finales; `0` y `false` se conservan como `0` y `false`, y un placeholder no resoluble solo vacía su parte del string.
- `select` simple comparte la semántica de valor vacío `''` con `radioGroup`.
- `select.multiple` comparte la semántica de valor vacío `[]` y el mismo orden estable según el catálogo efectivo visible con `checkboxGroup`.

## Comportamiento del `placeholder` en selección simple
- Cuando `props.placeholder` está declarado con valor no vacío y el campo tiene valor `''`, se renderiza una opción `<option value="" disabled>` con el texto del placeholder al inicio del listado.
- La opción placeholder es visible para el usuario pero no seleccionable (atributo `disabled`).
- Cuando hay un valor seleccionado que coincide con una opción real, la opción placeholder sigue presente en el DOM pero no aparece como selección activa.
- La opción placeholder mantiene valor `''` y participa en la validación `required` como cualquier otro valor vacío.
- Si `props.placeholder` está ausente o resuelve a string vacío, la opción placeholder no se inserta y se preserva el comportamiento previo (primera opción vacía sin etiqueta).
- En `select.multiple`, `props.placeholder` se ignora completamente aunque esté declarado.

## Comportamiento de `emptySubmitValue` en selección simple
- Cuando el valor efectivo del campo es `''` en el momento del submit, cualquier referencia `forms.{formId}.{fieldId}` de este campo usada en el payload (`body`/`query`/`headers` de la operación `api` base o de `submitAction`) resuelve al valor configurado en `emptySubmitValue`, normalizado a string, en vez de `''`.
- Si el campo tiene un valor efectivo distinto de `''` en el momento del submit, `emptySubmitValue` no tiene ningún efecto: se envía el valor seleccionado real.
- El store y la UI del campo no cambian: sigue almacenando `''` y mostrando el placeholder/estado vacío; la sustitución ocurre únicamente al construir el payload de submit.
- `emptySubmitValue` no participa en `visibility`, `queryStateFeedback` ni en referencias `defaultValue` de otros campos: esas superficies siguen viendo `''` mientras el campo esté vacío.
- `emptySubmitValue` no exime la validación `required`: un campo vacío con `props.validations.required` activo sigue bloqueando el submit aunque tenga `emptySubmitValue` configurado.
- Un `emptySubmitValue: 0` se envía como `"0"`, sin omitirse ni tratarse como falsy. Un `emptySubmitValue: ''` declarado explícitamente equivale a no declarar el prop.
- Si el campo está oculto por `visibility`/`queryStateFeedback` en el momento del submit, se aplica la omisión de campos ocultos del payload; `emptySubmitValue` nunca reintroduce una clave ya omitida (ver [[../queries/execution.md]]).

## Comportamiento ante opciones que cambian
- En `select` simple, si el valor efectivo no coincide con ninguna opción disponible en la colección resuelta, el campo queda vacío.
- En `select.multiple`, solo se conservan seleccionados los valores que sigan existiendo en la colección efectiva disponible.

## Comportamiento por validación
- `select` simple `required` considera inválido `''` aunque exista una opción placeholder visible.
- `select.multiple` `required` considera inválido `[]`.
- `minSelections` y `maxSelections` solo aplican a `select.multiple`, contando la selección efectiva después de normalizar el catálogo visible.

## Validación específica
- Si `select.props.items` mezclan `value` string y number dentro del mismo campo, el config completo se rechaza antes del render.
- Un `select.props.items` con un shape retirado (manual objeto, o dinámico sin `itemType` explícito) se rechaza con `code: invalid-layout` y ruta exacta al `props.items` del nodo.
- Un `select.props.items` dinámico con `itemType: 'scalar'` y `label`/`value` presentes, o con `itemType: 'object'` sin `label`/`value`, se rechaza con `code: invalid-layout` y ruta exacta.
- Si un campo de selección múltiple (`select.props.multiple: true`) declara un `defaultValue` literal no array, el config completo se rechaza antes del render.
- Si un campo de selección simple declara un `defaultValue` literal array, el config completo se rechaza antes del render.
- Si un `defaultValue` literal múltiple contiene miembros no escalares o mezcla strings y números, el config completo se rechaza antes del render.
- Si `select.props.multiple: true` declara `props.emptySubmitValue`, el config completo se rechaza antes del render (el prop es exclusivo de selección simple).

## Solo dentro de `form`
- Si `select` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.

## Edición desde el dev editor
El panel de propiedades del modo Editor (ver [[../development/dev-mode-editor.md]]) permite configurar `props.items` íntegramente desde el formulario, sin depender de Monaco, mediante un widget dedicado con selector de modo (manual literal, manual escalar, dinámico) y, en modo dinámico, un sub-selector `itemType`. Un `select`/`radioGroup`/`checkboxGroup` insertado desde la paleta arranca con `props.items: []` (manual literal vacío).
