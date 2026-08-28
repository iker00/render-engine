# Spec: nodo `autocomplete`

## Objetivo
Añadir un nuevo nodo de formulario, `autocomplete`, que permita al usuario escribir texto para filtrar o buscar entre un conjunto de opciones (estático o resuelto dinámicamente contra backend) y seleccionar uno o varios valores. Cubre tanto el caso "campo de formulario con catálogo largo" (ej. país, categoría) como el caso "buscador" (ej. buscar un usuario o un producto por nombre), modelando ambos como el mismo nodo dentro de un `form`.

## Alcance

### Contrato (`props`)
- `props.fieldId`: string obligatorio y único dentro del `form` contenedor.
- `props.label`: string obligatorio, con la misma semántica (literal / referencia dinámica completa / interpolación `{{...}}`) que `select`.
- `props.placeholder`: string opcional, misma semántica visible que en `select`. No aplica cuando `props.multiple: true` (igual que en `select`).
- `props.tooltip`: string opcional, misma semántica que en `select`/`choice-groups`.
- `props.multiple`: boolean opcional; cuando vale `true`, el valor efectivo pasa a ser una colección ordenada representada como chips, con la misma semántica de selección múltiple que `select.multiple`.
- `props.allowFreeText`: boolean opcional, default `false`. Ver comportamiento detallado más abajo.
- `props.minChars`: número opcional, default `0`. Número mínimo de caracteres escritos antes de mostrar cualquier sugerencia (estática o dinámica) y, en el shape dinámico, antes de emitir cualquier petición.
- `props.searchParamName`: string opcional, default `'search'`. Solo tiene efecto en selección múltiple (`props.multiple: true`) con shape dinámico: nombre del parámetro (`query`/`body`, según el método de la operación) con el que se envía el texto de búsqueda en curso a la operación asociada. No aplica en selección simple, donde la operación referencia directamente `forms.{formId}.{fieldId}` sin ningún parámetro reservado (ver "Fuente de datos y filtrado").
- `props.validations`: objeto opcional y ordenado por declaración, con el mismo contrato que `select`:
  - `props.validations.required`: inválido `''` en selección simple, `[]` en selección múltiple.
  - `props.validations.minSelections` / `maxSelections`: solo cuando `props.multiple: true`, misma semántica que `select.multiple`.
- `props.defaultValue`: mismo contrato que `select` (literal escalar en simple, array escalar homogéneo en múltiple, o referencia dinámica completa).
- `props.items`: obligatorio, con exactamente los mismos tres shapes cerrados que `select`/`radioGroup`/`checkboxGroup` (manual literal, manual escalar, dinámico unificado `{source, itemType, label?, value?}`). No se añade ni se retira ningún shape.

### Fuente de datos y filtrado
- **Shape estático** (manual literal o manual escalar): el filtrado por lo escrito ocurre en cliente, por coincidencia de substring case-insensitive sobre el `label` efectivo de cada opción. Por debajo de `props.minChars` no se muestra ninguna sugerencia.
- **Shape dinámico** (`source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*' | 'item.*'`): al escribir, el propio nodo dispara la ejecución de la operación asociada a esa query (misma fachada de ejecución que ya usan botones y submit), incluyendo el texto escrito como parte de la request. La emisión de peticiones respeta:
  - **Debounce**: tecleo rápido consecutivo no debe traducirse en una petición de red por cada carácter; se agrupa en una única petición tras una pausa de escritura.
  - **`minChars`**: por debajo del mínimo configurado no se dispara ninguna petición.
  - El resultado se lee de `queries.{queryName}.data` con la misma proyección `label`/`value` ya usada por `select` en su shape dinámico.

### Selección simple vs. múltiple
- **Simple** (`multiple` ausente o `false`): un único valor efectivo, mismo valor vacío `''` que `select` simple.
- **Múltiple** (`multiple: true`): colección ordenada de valores mostrados como chips; añadir una opción (por selección de sugerencia o por texto libre confirmado) crea un nuevo chip, sin sustituir los ya existentes; el campo de texto permanece disponible tras cada chip añadido para seguir buscando. Quitar un chip es una acción explícita por chip. Una opción ya seleccionada (con chip) no vuelve a aparecer en la lista de sugerencias mientras siga seleccionada, tanto en shape estático como dinámico.

### Texto libre (`allowFreeText`)
- Aplica igual a selección simple y múltiple.
- **Desactivado (default)**: selección cerrada, misma semántica que `select`. El valor efectivo solo puede ser uno de los `item.value` disponibles en el catálogo actualmente resuelto; si el texto escrito no coincide con ninguna opción, no hay valor válido para ese intento (en simple, el valor efectivo es `''`; en múltiple, no se añade ningún chip).
- **Activado**:
  - En **selección simple**, el valor efectivo del campo es el texto tal cual se va escribiendo, actualizado en vivo con cada carácter (misma semántica que `input`/`textarea`) — sin paso de confirmación explícita. Elegir una sugerencia de la lista sustituye el texto actual por el `value` de esa opción.
  - En **selección múltiple**, cada chip es una unidad discreta (igual que en selección cerrada): un chip se añade explícitamente, ya sea seleccionando una sugerencia o confirmando el texto libre actual (Enter). El campo de texto en curso no es en sí mismo un valor del campo hasta que se confirma como chip.

### Persistencia de selecciones frente a datos dinámicos cambiantes
- En el shape dinámico, `queries.{queryName}.data` representa únicamente las sugerencias visibles de la búsqueda más reciente, no un catálogo completo y estable (a diferencia de `select`, donde la fuente dinámica sí es el catálogo completo).
- Por tanto, una vez que una opción queda seleccionada (chip añadido, o valor simple fijado), permanece seleccionada aunque una búsqueda posterior no la incluya en sus resultados. La regla de `select`/`radioGroup`/`checkboxGroup` de "limpiar el valor si ya no está en la colección resuelta" **no aplica** al shape dinámico de `autocomplete`.
- Esta regla de persistencia no aplica al shape estático (ahí la colección sí es estable y completa, y se mantiene el comportamiento ya vigente en `select`: si la colección cambia y el valor deja de existir, se limpia).

### Solo dentro de `form`
- `autocomplete` es válido únicamente como descendiente de un subárbol `form`, con las mismas reglas transversales que `input`, `select`, `radioGroup`, `checkboxGroup`, `toggle` y `hidden`. No existe un modo standalone fuera de `form`; un caso de "barra de búsqueda" se modela como un `form` de un único campo `autocomplete`.

### Submit y validación
- Participa en el payload de submit igual que cualquier otro campo (`forms.{formId}.{fieldId}`), incluida la omisión de campos ocultos por `visibility`/`queryStateFeedback`.
- `required`, `minSelections`, `maxSelections` siguen exactamente la misma semántica ya descrita para `select`/`checkboxGroup`.

## Fuera de alcance
- Modo standalone de `autocomplete` fuera de `form`.
- `props.emptySubmitValue` (equivalente al de `select`): no se incluye en esta primera entrega; puede añadirse después siguiendo el mismo patrón si se necesita.
- Resaltado (highlight) del texto coincidente dentro de las sugerencias.
- Paginación o scroll infinito de resultados de búsqueda dinámica.
- Widget dedicado de edición en el panel de propiedades del dev editor (equivalente al que ya tienen `select`/`choice-groups`); en esta entrega basta con que el nodo sea configurable, aunque sea con una experiencia de edición más genérica.
- Definir el mecanismo técnico exacto de disparo de la query por tecleo (duración de debounce, si es configurable por prop o fija, dónde vive el estado de disparo, convivencia de múltiples instancias del nodo — p. ej. dentro de un `repeater`). Queda para `design.md`.

## Requisitos funcionales
1. El nodo `autocomplete` se registra en el catálogo de nodos de formulario y se valida en bootstrap con las mismas reglas de "solo dentro de `form`" que el resto de campos.
2. `props.items` acepta exactamente los mismos tres shapes ya soportados por `select`; cualquier shape retirado o no reconocido rechaza el config completo en bootstrap con `code: invalid-layout` y ruta exacta, igual que `select`.
3. En shape estático, escribir texto filtra las sugerencias visibles por coincidencia de substring case-insensitive sobre el `label`, respetando `minChars`.
4. En shape dinámico, escribir texto (una vez alcanzado `minChars`) dispara, con debounce, la ejecución de la operación asociada, y las sugerencias visibles reflejan `queries.{queryName}.data` una vez resuelta.
5. Seleccionar una sugerencia fija el valor efectivo del campo (simple) o añade un chip (múltiple) con el `value` de la opción elegida.
6. En selección múltiple, una opción ya añadida como chip se excluye de la lista de sugerencias hasta que se quite el chip correspondiente.
7. Con `allowFreeText: false` (default), un texto que no coincide con ninguna opción no produce un valor efectivo válido.
8. Con `allowFreeText: true` en selección simple, el valor efectivo del campo es el texto escrito en cada momento, sin necesidad de que coincida con ninguna opción ni de confirmación explícita.
9. Con `allowFreeText: true` en selección múltiple, confirmar el texto escrito (Enter) añade un chip con ese texto como valor, aunque no coincida con ninguna opción.
10. En shape dinámico, una opción ya seleccionada no se elimina automáticamente cuando una búsqueda posterior no la incluye en sus resultados.
11. En selección múltiple con shape dinámico, el texto de búsqueda se envía a la operación asociada bajo el nombre de parámetro fijado por `props.searchParamName` (default `'search'`).
12. `required`, `minSelections` y `maxSelections` validan con la misma semántica y los mismos mensajes por defecto que `select`/`checkboxGroup`.
13. El campo participa en el payload de submit con la misma semántica de referencia (`forms.{formId}.{fieldId}`) y omisión por campo oculto que el resto de campos de formulario.

## Requisitos no funcionales
- El shape dinámico no debe emitir una petición de red por cada pulsación de tecla; el tecleo rápido se agrupa mediante debounce en una única petición.
- El nodo debe seguir el umbral mínimo de cobertura de tests ya vigente en el proyecto (80% sobre `src/`).
- El nodo debe seguir el mismo nivel de accesibilidad ya vigente en `select`/`choice-groups` (label asociado, `aria-describedby` hacia el error cuando hay error activo), adaptado a los roles ARIA propios de un combobox con sugerencias.

## Criterios de aceptación
- Dado un `autocomplete` con items manual literal y `minChars: 2`, cuando el usuario escribe 1 carácter, no se muestra ninguna sugerencia; al escribir el 2º carácter, se muestran las opciones cuyo label contiene el texto (case-insensitive).
- Dado un `autocomplete` con items dinámico y `minChars: 0` (default), cuando el usuario escribe y dispara varias teclas seguidas en menos tiempo que el debounce, solo se emite una petición de red, no una por tecla.
- Dado un `autocomplete` simple con `allowFreeText: false`, cuando el usuario escribe un texto que no coincide con ninguna opción y pierde el foco, el valor efectivo del campo queda vacío (`''`).
- Dado un `autocomplete` simple con `allowFreeText: true`, cuando el usuario escribe un texto que no coincide con ninguna opción, el valor efectivo del campo es ese texto en todo momento, sin necesidad de perder el foco.
- Dado un `autocomplete` múltiple con items dinámico, cuando el usuario selecciona una opción de una búsqueda y después escribe una segunda búsqueda cuyos resultados no incluyen la primera opción, el chip de la primera opción sigue presente.
- Dado un `autocomplete` múltiple con una opción ya seleccionada (con chip), la lista de sugerencias no vuelve a mostrar esa opción mientras el texto escrito siga coincidiendo con ella, tanto en shape estático como dinámico.
- Dado un `autocomplete` múltiple con shape dinámico y `props.searchParamName: 'q'`, cuando el usuario escribe texto, la petición emitida a la operación asociada lleva el texto bajo la clave `q`, no bajo `search`.
- Dado un `autocomplete` múltiple con `props.validations.required: true`, cuando no hay ningún chip añadido, el submit se bloquea igual que `checkboxGroup` con `[]`.
- Dado un `autocomplete` fuera de un subárbol `form`, el config completo se rechaza en bootstrap.
- Dado un `autocomplete` con `props.items` en un shape retirado (p. ej. manual objeto), el config completo se rechaza en bootstrap con `code: invalid-layout` y ruta exacta al nodo.

## Casos límite
- `props.defaultValue` en shape dinámico apunta a un valor que aún no está entre las sugerencias visibles (porque todavía no se ha buscado nada): el valor por defecto se fija igualmente, siguiendo la misma regla de persistencia de selecciones frente a datos dinámicos cambiantes.
- Backend de búsqueda dinámica responde sin ningún resultado: el campo queda sin sugerencias visibles, sin bloquear el resto del formulario (mismo tratamiento de error/empty que cualquier otra query, vía `queryStateFeedback` si se declara).
- `allowFreeText: true` y el texto escrito coincide exactamente con el `value` (no solo el `label`) de una opción del catálogo: se trata igual que si el usuario hubiese seleccionado esa opción explícitamente.
- Campo `autocomplete` oculto por `visibility`/`queryStateFeedback` en el momento del submit con selección ya hecha: se omite del payload igual que el resto de campos ocultos, sin excepción.
- `autocomplete` dentro de un `repeater`: cada iteración mantiene su propio estado de búsqueda y selección de forma independiente, sin interferir entre iteraciones (mismo principio que cualquier otro campo de formulario dentro de `repeater`).

## Riesgos o preguntas abiertas
- El mecanismo técnico exacto de disparo de la query por tecleo es una capacidad nueva del runtime (hoy solo existen disparos por entrada a página, acción de botón y submit de formulario); su diseño concreto —incluida la duración del debounce y si es configurable— queda delegado a `design.md`.
- Cómo conviven varias instancias del mismo nodo `autocomplete` ejecutando su propia query de forma independiente (en particular dentro de `repeater`, con `item.*` como fuente) sin pisarse entre sí es una decisión técnica pendiente de `design.md`.

## Áreas de producto afectadas (alto nivel)
- Catálogo de nodos de formulario (`ai-workflow/docs/app-features/nodes/`): nuevo `autocomplete.md`.
- Ejecución de queries (`ai-workflow/docs/app-features/queries/`): nueva superficie de disparo de operación (además de `preloads`, acción de botón y submit).
- Formularios (`ai-workflow/docs/app-features/forms/`): el nodo se integra en el ciclo de vida, `defaultValue`, validación y submit ya documentados, sin cambiar sus reglas transversales.
