> Cuándo leer: nodo `autocomplete`, campo de texto que filtra o busca entre opciones (estáticas o dinámicas) para seleccionar uno o varios valores, texto libre, persistencia de selección frente a resultados de búsqueda cambiantes, disparo de búsqueda por tecleo.
> Tamaño: largo.
> Relacionados: [[select.md]], [[../forms/defaults.md]], [[../forms/validation-rules.md]], [[../forms/submit.md]], [[../queries/execution.md]], [[../queries/state-model.md]], [[../references/dynamic-strings.md]].

# `autocomplete`

Campo de formulario que combina un `input` de texto con una lista de sugerencias filtrada mientras el usuario escribe. Cubre tanto "campo con catálogo largo" (ej. país) como "buscador" (ej. buscar un usuario por nombre), modelando ambos casos como el mismo nodo.

## Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, misma semántica (literal / referencia dinámica completa / interpolación `{{...}}`) que `select`.
- `props.placeholder`: string opcional, misma semántica visible que en `select`. No aplica cuando `props.multiple: true`.
- `props.tooltip`: string opcional, misma semántica que `select`/`choice-groups` (icono de información con tooltip accesible).
- `props.multiple`: boolean opcional; con `true`, el valor efectivo pasa a ser una colección ordenada mostrada como chips.
- `props.allowFreeText`: boolean opcional, default `false`. Ver [Texto libre](#texto-libre-allowfreetext).
- `props.minChars`: número entero opcional (`>= 0`), default `0`. Mínimo de caracteres escritos antes de mostrar cualquier sugerencia y, en shape dinámico, antes de disparar cualquier petición.
- `props.searchParamName`: string opcional (no vacío), default `'search'`. Solo tiene efecto en selección múltiple (`props.multiple: true`) con shape dinámico: nombre del parámetro (`query`/`body`) con el que se envía el texto de búsqueda a la operación asociada. En selección simple no aplica: la operación referencia directamente `forms.{formId}.{fieldId}` (ver [Disparo de búsqueda dinámica](#disparo-de-búsqueda-dinámica)).
- `props.validations`: mismo contrato que `select` — `required` (inválido `''` en simple, `[]` en múltiple), `minSelections`/`maxSelections` (solo con `multiple: true`).
- `props.defaultValue`: mismo contrato que `select` (literal escalar en simple, array escalar homogéneo en múltiple, o referencia dinámica completa).
- `props.items`: obligatorio, con exactamente los mismos tres shapes cerrados que `select` (manual literal, manual escalar, dinámico unificado `{source, itemType, label?, value?}`). Contrato y reglas de rechazo idénticos a [[select.md#Shapes de items]] — no se añade ni retira ningún shape.

## Fuente de datos y filtrado
- **Shape estático** (manual literal o manual escalar) y **`source: 'item.*'`**: el filtrado ocurre en cliente, por coincidencia de substring case-insensitive sobre el `label` efectivo de cada opción. Por debajo de `props.minChars` no se muestra ninguna sugerencia. `item.*` se trata como estático a efectos de filtrado porque es dato ya resuelto de la iteración del `repeater` (típicamente un catálogo predefinido embebido por item), sin ninguna operación de backend asociada.
- **Shape dinámico con operación** (`source: 'queries.{queryName}.data'` o `'queries.{queryName}.data.*'`): al escribir, el propio nodo dispara la ejecución de la operación asociada a esa query (misma fachada `executeQueryOperation` que ya usan botones y submit), con debounce. El resultado de sugerencias se lee de `queries.{queryName}.data` con la misma proyección `label`/`value` que usa `select` en su shape dinámico.

## Disparo de búsqueda dinámica
Cuarta superficie de disparo de operaciones del runtime, junto a `preloads`, `button.props.action` y `form.submitAction` (ver [[../queries/execution.md]]).
- Solo dispara petición el shape con `source: 'queries.{queryName}.data'`/`'.data.*'`. Debounce fijo de `300ms`, no configurable por prop.
- Por debajo de `props.minChars` no se dispara ninguna petición, aunque el debounce ya haya transcurrido.
- **Inyección del texto escrito**: dos mecanismos según el modo de selección, sin ampliar ningún contrato declarativo:
  - **Selección simple**: `forms.{formId}.{fieldId}` mantiene siempre el texto tal cual se escribe mientras el usuario interactúa (con o sin `allowFreeText`); la operación de búsqueda referencia ese campo directamente como cualquier otra referencia completa (p. ej. `{ body: { search: "forms.{formId}.{fieldId}" } }`), sin mecanismo nuevo. Al perder foco o construir el payload de submit, el valor se normaliza (ver [Texto libre](#texto-libre-allowfreetext)).
  - **Selección múltiple**: el valor efectivo del campo sigue siendo la colección de chips (contrato ya cerrado), así que el texto en curso no puede vivir en `forms.*` sin romper ese tipo. El módulo de disparo pasa el texto en curso vía `requestParams.query`/`requestParams.body` bajo la clave `props.searchParamName` (default `'search'`) al invocar `executeQueryOperation`.
- **Frescura de resultados**: cada instancia de `autocomplete` recuerda localmente la `requestSignature` de la última búsqueda que ella misma disparó; solo pinta `queries.{queryName}.data` como sugerencias cuando la `requestSignature` global de esa query coincide con la suya. Esto es una limitación de producto aceptada, no un defecto: dos instancias de `autocomplete` que comparten el mismo `queryName` (p. ej. dentro de un `repeater` sin `item.*`) **no pueden buscar de forma verdaderamente independiente y simultánea** — la instancia cuya ejecución no fue la última en resolver deja de pintar sugerencias hasta que ella misma dispare una nueva búsqueda. Recomendación: declarar un `queryName` distinto por instancia cuando se necesite búsqueda dinámica realmente independiente y concurrente, o resolver el catálogo por `item.*` si el dato ya está embebido y no requiere backend.
- Backend de búsqueda sin resultados: el campo queda sin sugerencias visibles, sin bloquear el resto del formulario (mismo tratamiento de error/empty que cualquier otra query, vía `queryStateFeedback` si se declara).

## Selección simple vs. múltiple
- **Simple** (`multiple` ausente o `false`): un único valor efectivo, mismo valor vacío `''` que `select` simple.
- **Múltiple** (`multiple: true`): colección ordenada de valores mostrados como chips. Añadir una opción (por sugerencia o por texto libre confirmado) crea un chip nuevo sin sustituir los existentes; el campo de texto permanece disponible tras cada chip para seguir buscando. Quitar un chip es una acción explícita por chip (botón "Quitar" en cada chip). Una opción ya seleccionada no vuelve a aparecer en la lista de sugerencias mientras siga seleccionada, tanto en shape estático como dinámico.

## Texto libre (`allowFreeText`)
Aplica igual a selección simple y múltiple.
- **Desactivado (default)**: selección cerrada, misma semántica que `select`. El valor efectivo solo puede ser uno de los `item.value` disponibles en el catálogo actualmente resuelto; si el texto escrito no coincide con ninguna opción al perder foco (simple) o al confirmar (múltiple), no hay valor válido para ese intento — en simple el valor efectivo queda `''`, en múltiple no se añade ningún chip.
- **Activado**:
  - En **selección simple**, el valor efectivo del campo es el texto tal cual se va escribiendo, actualizado en vivo con cada carácter (misma semántica que `input`/`textarea`), sin paso de confirmación explícita. Elegir una sugerencia sustituye el texto actual por el `value` de esa opción.
  - En **selección múltiple**, cada chip es una unidad discreta: se añade explícitamente seleccionando una sugerencia o confirmando el texto libre actual con Enter. El texto en curso no es en sí mismo un valor del campo hasta que se confirma como chip.
- Si el texto escrito coincide exactamente con el `value` (no solo el `label`) de una opción del catálogo, se trata igual que si el usuario hubiese seleccionado esa opción explícitamente.

## Persistencia de selecciones frente a datos dinámicos cambiantes
A diferencia de `select`/`radioGroup`/`checkboxGroup`, `autocomplete` **no** limpia el valor efectivo cuando la colección resuelta deja de incluirlo:
- En el shape dinámico, `queries.{queryName}.data` representa solo las sugerencias visibles de la búsqueda más reciente, no un catálogo completo y estable. Una vez que una opción queda seleccionada (chip añadido, o valor simple fijado), permanece seleccionada aunque una búsqueda posterior no la incluya en sus resultados — incluye el caso de `props.defaultValue` apuntando a un valor todavía no presente entre las sugerencias visibles porque aún no se ha buscado nada.
- Esta regla de persistencia aplica también al shape estático con `source: 'item.*'` (tratado como dinámico a efectos de esta regla, no de filtrado).
- El shape estático manual (literal o escalar) mantiene el comportamiento ya vigente en `select`: si la colección cambia y el valor deja de existir, se limpia.

## Submit y validación
- Participa en el payload de submit igual que cualquier otro campo (`forms.{formId}.{fieldId}`), incluida la omisión de campos ocultos por `visibility`/`queryStateFeedback` (ver [[../queries/execution.md]]).
- `required`, `minSelections`, `maxSelections` siguen exactamente la misma semántica y mensajes por defecto que `select`/`checkboxGroup` (ver [[../forms/validation-rules.md]]).
- En selección simple con shape dinámico y `allowFreeText: false`, si el usuario deja texto no confirmado en el campo y pulsa Enter (sin ninguna sugerencia resaltada), el runtime resuelve el texto contra el catálogo ya resuelto en ese render antes de dejar continuar el submit nativo: si coincide con una opción, la selecciona; si no, vacía el campo. Esto evita que texto de búsqueda sin confirmar llegue al payload solo porque, en shape dinámico, `forms.{formId}.{fieldId}` refleja el texto en curso para que la operación de búsqueda pueda referenciarlo.

## Solo dentro de `form`
`autocomplete` es válido únicamente como descendiente de un subárbol `form`, con las mismas reglas transversales que `input`, `select`, `radioGroup`, `checkboxGroup`, `toggle` y `hidden`. No existe modo standalone fuera de `form`; una "barra de búsqueda" se modela como un `form` de un único campo `autocomplete`.

## Accesibilidad
Sigue el patrón ARIA de combobox con sugerencias: `role="combobox"` en el input, `aria-expanded`, `aria-controls` hacia la lista, `role="listbox"`/`role="option"` en la lista y sus opciones, `aria-activedescendant` para el resaltado por teclado (flechas arriba/abajo, Enter para confirmar, Escape para cerrar sin cambiar el valor). Asociación label↔control vía `htmlFor` explícito (no wrapper implícito, para no interferir con los botones "Quitar" de los chips) y `aria-describedby` hacia el error cuando hay error activo, igual que `select`/`choice-groups`.

## Estado local de interacción
Texto en curso (modo múltiple), temporizador de debounce, apertura/cierre de la lista de sugerencias e índice resaltado por teclado son estado local del componente, no del store compartido `forms.*` (salvo el texto en curso de selección simple, que sí vive en `forms.{formId}.{fieldId}` — ver [Disparo de búsqueda dinámica](#disparo-de-búsqueda-dinámica)). Dentro de un `repeater`, cada iteración mantiene su propio estado de búsqueda y selección de forma independiente.

## Fuera de alcance
- Modo standalone de `autocomplete` fuera de `form`.
- `props.emptySubmitValue` (equivalente al de `select`, ver [[select.md#Comportamiento-de-emptysubmitvalue-en-selección-simple]]): no incluido en esta entrega.
- Resaltado (highlight) del texto coincidente dentro de las sugerencias.
- Paginación o scroll infinito de resultados de búsqueda dinámica.
- Widget dedicado de edición en el panel de propiedades del dev editor (equivalente al de `select`/`choice-groups`); el nodo es configurable con una experiencia de edición más genérica.
