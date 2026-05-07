# Spec: Reusable form field expansion

## Objetivo
Ampliar el catálogo declarativo de formularios con un primer conjunto más útil de campos reutilizables para búsqueda, edición y captura básica de datos, reforzando `input` con los tipos nativos más usados y añadiendo `radioGroup`, `checkboxGroup` y `select` multiselección con una semántica declarativa coherente de extracción de opciones.

## Alcance
- Ampliar el alcance funcional de `input` a un conjunto inicial más útil de variantes nativas para captura básica, partiendo del catálogo ya vigente y completándolo con los tipos adicionales mínimos que permitan datos numéricos y fechas simples.
- Mantener `textarea` dentro del catálogo estable de campos reutilizables sin abrir todavía variantes avanzadas ni rich text.
- Añadir `radioGroup` como campo declarativo de selección única entre varias opciones.
- Añadir `checkboxGroup` como campo declarativo de selección múltiple entre varias opciones.
- Añadir soporte de multiselección a `select` mediante una prop explícita del propio campo, sin abrir un tipo de nodo independiente.
- Hacer que `radioGroup`, `checkboxGroup` y `select` puedan obtener sus opciones desde exactamente las mismas familias de origen: catálogo histórico de opciones, colecciones manuales declarativas y colecciones dinámicas resueltas desde `queries.*`.
- Mantener una semántica coherente entre render, estado local del formulario, `defaultValue`, validación `required` y submit para los campos nuevos o ampliados de esta feature.
- Reutilizar el dominio `forms.{formId}.{fieldId}` como única fuente de verdad para los valores y errores de todos los campos añadidos por esta feature.
- Mantener la compatibilidad funcional con configuraciones actuales que ya usan `input`, `textarea` y `select`.

## Fuera de alcance
- Añadir subida de archivos, autocompletado, búsqueda remota de opciones o carga incremental.
- Introducir validaciones declarativas avanzadas como `min`, `max`, patrones, cardinalidad mínima/máxima o validaciones cruzadas.
- Soportar expresiones arbitrarias, transformaciones declarativas, agrupación visual compleja de opciones o layout específico por campo.
- Abrir nuevas fuentes dinámicas de opciones fuera de colecciones manuales y de `queries.{queryName}.data` o sus ramas anidadas.
- Añadir semántica nueva de limpieza global de formularios al navegar.
- Introducir una capa de theming, personalización visual declarativa o variantes de diseño específicas por tipo de campo.

## Requisitos funcionales
- El catálogo declarativo de formularios debe seguir incluyendo `input`, `textarea` y `select`, y debe ampliarse con `radioGroup` y `checkboxGroup`.
- La feature debe tratar como punto de partida real que `input` ya soporta `text`, `email`, `password`, `search`, `tel` y `url`; la ampliación de esta iteración debe añadir también los tipos nativos más usados para captura y edición básica, incluyendo como mínimo `number`, `date` y `datetime-local`.
- `textarea` debe conservar la semántica vigente de entrada multilínea y no debe requerir migraciones de configuraciones actuales.
- `radioGroup` y `checkboxGroup` solo deben ser válidos como descendientes de un `form`, igual que el resto de campos declarativos.
- `radioGroup` y `checkboxGroup` deben declarar como base común `fieldId`, `label`, `required` y `defaultValue`.
- `radioGroup` debe representar una selección única y almacenar un único valor efectivo del mismo modo que un campo de una sola elección.
- `checkboxGroup` debe representar una selección múltiple y almacenar una colección ordenada de valores efectivos seleccionados.
- `select` debe poder declarar una prop explícita de multiselección; cuando esa prop esté activa, el campo debe comportarse como un selector de varias opciones en vez de una selección única.
- `radioGroup`, `checkboxGroup` y `select` deben aceptar `items` con la misma semántica estructural, incluyendo:
  - array histórico de opciones `{ label, value }`
  - colección manual escalar `{ values: [...] }`
  - colección manual de objetos `{ values: [...], label, value }`
  - colección dinámica escalar `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', itemType: 'scalar' }`
  - colección dinámica de objetos `{ source: 'queries.{queryName}.data' | 'queries.{queryName}.data.*', label, value }`
- Los campos de elección basados en opciones (`select`, `radioGroup` y `checkboxGroup`) deben compartir una semántica estable de opción efectiva:
  - cada opción visible debe resolver un `label` y un `value`
  - los valores declarados o resueltos pueden ser `string` o `number`
  - el runtime debe normalizar esos valores a string para compararlos, almacenarlos, validarlos y enviarlos
- Dentro de un mismo campo de opciones (`select`, `radioGroup` o `checkboxGroup`), los valores efectivos deben ser homogéneos en origen (`string` o `number`) para evitar configuraciones ambiguas.
- `defaultValue` debe seguir admitiendo literal o referencia dinámica completa soportada por el runtime.
- En cualquier campo de selección múltiple (`checkboxGroup` o `select` con multiselección), el `defaultValue` debe seguir una única semántica: colección ordenada de valores escalares (`string[]` o `number[]` en el origen declarativo), que el runtime normaliza internamente a strings y filtra contra las opciones efectivamente disponibles.
- En `radioGroup`, si el `defaultValue` efectivo no coincide con ninguna opción disponible, el campo debe quedar vacío.
- En `checkboxGroup` o en `select` multiselección, el `defaultValue` efectivo debe poder representar varias selecciones iniciales; solo deben conservarse como seleccionadas las opciones cuyo valor exista realmente en la colección efectiva disponible.
- Si un `radioGroup` o `checkboxGroup` ya tiene estado porque el usuario interactuó con él, el runtime debe conservar ese estado y no rehidratarlo con `defaultValue` en rerenders o reentradas dentro de la misma instancia.
- Si un `select` multiselección ya tiene estado porque el usuario interactuó con él, el runtime debe conservar ese estado y no rehidratarlo con `defaultValue` en rerenders o reentradas dentro de la misma instancia.
- Si cambia la colección efectiva de opciones y una selección ya no existe:
  - `radioGroup` debe limpiarse a vacío
  - `checkboxGroup` y `select` multiselección deben eliminar de su selección los valores que ya no existan y conservar solo los todavía válidos
- `required` debe seguir siendo una validación declarativa mínima y coherente por tipo de campo:
  - `input` y `textarea` siguen siendo inválidos con `''` o solo espacios
  - `select` y `radioGroup` son inválidos cuando no tienen una opción efectiva seleccionada
  - `checkboxGroup` y `select` multiselección son inválidos cuando no tienen ninguna opción efectiva seleccionada
- Cuando un campo añadido por esta feature quede oculto por `queryStateFeedback` o `visibility`, debe conservar su estado local pero no bloquear el submit mientras permanezca oculto.
- El submit declarativo del formulario debe poder seguir reutilizando `forms.{formId}.{fieldId}` sin exigir un adaptador específico para `radioGroup`, `checkboxGroup` o `select` multiselección.
- En el payload efectivo del submit:
  - `radioGroup` debe exponerse como un valor único
  - `checkboxGroup` y `select` multiselección deben exponerse como una colección de valores seleccionados
- Las configuraciones ambiguas o incoherentes deben seguir rechazándose antes del render, incluyendo como mínimo:
  - usar un origen de `items` incompatible con la semántica ya soportada por `select`
  - omitir mapeos obligatorios para colecciones de objetos
  - mezclar valores `string` y `number` dentro del mismo campo de opciones
  - usar `radioGroup` o `checkboxGroup` fuera de un `form`
- Una configuración que siga usando solo `input`, `textarea` y `select` debe conservar el mismo comportamiento observable.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance acotado de v1 y resolver formularios de búsqueda, edición y captura básica sin convertirse en un motor completo de formularios avanzados.
- La terminología debe mantenerse alineada con el proyecto actual: `form`, `fieldId`, `defaultValue`, `required`, `items`, `queries.*`, `forms.*` y `select`.
- La semántica de extracción de opciones debe ser suficientemente uniforme para reutilizarse en futuras ampliaciones del catálogo sin redefinir otra vez el contrato de colecciones.
- La semántica de selección múltiple debe ser uniforme entre `checkboxGroup` y `select` multiselección para no abrir dos contratos distintos sobre el mismo problema funcional.
- La validación del config debe seguir siendo previa al render, diagnóstica en desarrollo y trazable mediante rutas canónicas del JSON.
- El comportamiento debe seguir siendo coherente entre contrato JSON, renderer, estado compartido, validación del formulario y submit.
- La solución debe seguir siendo producible desde backend legacy con estructuras declarativas simples y sin exigir lógica React específica por pantalla.

## Criterios de aceptación
- Dado un formulario con `inputType: 'number'`, el runtime permite capturar un valor numérico simple manteniendo el mismo ciclo estable de estado local, `required` y submit que el resto de inputs.
- Dado un formulario con `inputType: 'date'`, el runtime permite capturar una fecha simple sin requerir un componente visual específico de la pantalla.
- Dado un formulario con `inputType: 'datetime-local'`, el runtime permite capturar fecha y hora simples sin requerir un componente visual específico de la pantalla.
- Dada una configuración existente que usa `inputType: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url'`, el comportamiento observable del campo no cambia.
- Dado un `radioGroup` con opciones manuales, el runtime renderiza una sola opción seleccionable a la vez, guarda un único valor efectivo y lo expone en `forms.{formId}.{fieldId}`.
- Dado un `checkboxGroup` con opciones manuales, el runtime permite marcar varias opciones a la vez y guarda la colección efectiva de valores seleccionados en `forms.{formId}.{fieldId}`.
- Dado un `select` con la prop de multiselección activa, el runtime permite seleccionar varias opciones y guarda la colección efectiva de valores seleccionados en `forms.{formId}.{fieldId}`.
- Dado un `radioGroup` configurado con una colección dinámica de escalares o de objetos, el runtime resuelve sus opciones con la misma semántica estable que `select`.
- Dado un `checkboxGroup` configurado con una colección dinámica de escalares o de objetos, el runtime resuelve sus opciones con la misma semántica estable que `select`.
- Dado un `select` multiselección configurado con una colección dinámica de escalares o de objetos, el runtime resuelve sus opciones con la misma semántica estable compartida.
- Dado un `radioGroup` `required` sin selección efectiva, el submit se bloquea y el error queda reflejado en el campo.
- Dado un `checkboxGroup` `required` sin ninguna selección efectiva, el submit se bloquea y el error queda reflejado en el campo.
- Dado un `select` multiselección `required` sin ninguna selección efectiva, el submit se bloquea y el error queda reflejado en el campo.
- Dado un `radioGroup` o `checkboxGroup` con `defaultValue` válido, el campo se inicializa con esa selección efectiva la primera vez que aparece.
- Dado un `checkboxGroup` o un `select` multiselección con `defaultValue` parcialmente inválido respecto a las opciones disponibles, el runtime conserva solo las selecciones válidas y no rompe el render.
- Dado un cambio en la colección efectiva de opciones que invalida parte o toda la selección actual, el runtime limpia únicamente los valores ya no válidos y mantiene coherencia entre render, validación y submit.
- Dado un campo de opciones oculto por `queryStateFeedback` o `visibility`, su estado persiste pero no bloquea el submit mientras siga oculto.
- Dado un submit cuyo payload referencia `forms.{formId}.{fieldId}` de un `checkboxGroup`, la operación recibe la colección actual de valores seleccionados sin transformación adicional fuera del contrato declarativo.
- Dada una configuración que usa `radioGroup` o `checkboxGroup` con un shape de `items` incompatible con el soportado por `select`, el config completo falla antes del render con diagnóstico trazable.

## Casos límite
- La query que alimenta un `radioGroup` o `checkboxGroup` todavía no se ha ejecutado y el campo se renderiza por primera vez.
- La colección dinámica de opciones devuelve `null`, un objeto no coleccionable o una ruta ausente; el campo debe degradar a “sin opciones” sin romper el formulario.
- Un `checkboxGroup` se inicializa antes de que exista la colección dinámica y las opciones llegan más tarde; el runtime debe respetar la semántica vigente de inicialización lazy.
- Un `select` multiselección se inicializa antes de que exista la colección dinámica y las opciones llegan más tarde; el runtime debe respetar la semántica vigente de inicialización lazy.
- Una colección dinámica cambia tras una búsqueda o un refetch y deja inválida una parte de la selección actual del usuario.
- Dos campos distintos reutilizan la misma colección dinámica pero con distintos `fieldId` y distinto estado local.
- Un formulario de edición vuelve a abrirse con estado previo en la misma instancia y sus valores no deben rehidratarse automáticamente aunque el `defaultValue` configurado sea distinto.

## Riesgos o preguntas abiertas
- La feature es transversal entre contrato JSON, validación, renderer de campos, estado compartido y reutilización de la semántica multi-valor ya existente, por lo que requiere `design.md` antes de implementarse.
- Debe cerrarse en diseño si el contrato expone la multiselección de `select` con una prop booleana simple o con un nombre algo más semántico, manteniendo la compatibilidad con el shape actual del campo.
- Debe cerrarse en diseño cómo se representa el valor vacío y cómo se resuelve el orden estable de las selecciones múltiples para `checkboxGroup` y `select` multiselección.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Formularios y validación
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
