# Spec: Dynamic strings

## Objetivo
Permitir interpolacion parcial dentro de strings visibles y de proyeccion del JSON mediante placeholders `{{referencia.runtime}}`, combinando texto literal con valores ya disponibles en el runtime sin abrir expresiones arbitrarias, formateadores ni una capa de plantillas compleja.

## Alcance
- Anadir una sintaxis de interpolacion parcial `{{...}}` para superficies visibles concretas.
- Resolver cada placeholder con la misma familia de referencias runtime ya soportada: `queries.*`, `forms.*`, `params.*` e `item.*` cuando exista contexto de `repeater`.
- Mantener las referencias completas existentes en las superficies que ya las soportan.
- Aplicar la interpolacion parcial a superficies visibles directas:
  - `heading.props.text`
  - `paragraph.props.text`
  - `button.props.label`
  - `input.props.label`
  - `textarea.props.label`
  - `select.props.label`
  - `radioGroup.props.label`
  - `checkboxGroup.props.label`
  - `image.props.src`
  - `image.props.alt`
- Aplicar la interpolacion parcial a superficies de render y proyeccion de colecciones:
  - strings visibles de `list.props.items` cuando el shape renderiza valores declarados como texto
  - `list.props.items.itemText` en colecciones manuales o dinamicas de objetos
  - `select.props.items.label` y `select.props.items.value` en colecciones manuales o dinamicas de objetos
  - `radioGroup.props.items.label` y `radioGroup.props.items.value` en colecciones manuales o dinamicas de objetos
  - `checkboxGroup.props.items.label` y `checkboxGroup.props.items.value` en colecciones manuales o dinamicas de objetos
  - celdas string de `table` en modo manual
  - `table.props.rows.cells` en modo dinamico
- Sustituir cada placeholder no resoluble o no renderizable por string vacio en estas superficies visibles.
- Conservar el comportamiento actual de string literal cuando no aparecen delimitadores `{{` y `}}`.
- Mantener la semantica de `item.*` dentro del subarbol iterado de un `repeater` y anadirla como contexto local para cada item evaluado por proyecciones de `list`, opciones de `select`/`radioGroup`/`checkboxGroup` y filas dinamicas de `table`.
- Mantener la frontera vigente de `params.*`: solo `params.{paramName}`, sin navegacion anidada adicional.

## Fuera de alcance
- Aplicar interpolacion parcial a `api.query`, `api.body`, `api.headers`, `preloads`, `executeOperation`, `form.submitAction` o `navigateTo.params`.
- Cambiar la semantica actual de construccion de requests cuando faltan datos para referencias completas.
- Anadir expresiones, operadores, filtros, pipes, funciones, formateadores, condicionales o transformaciones de datos dentro de `{{...}}`.
- Anadir escape especifico para mostrar `{{` o `}}` como texto literal.
- Anadir interpolacion parcial a `visibility.reference`, `visibility.value`, `queryStateFeedback`, fuentes de coleccion, `repeater.props.items.key`, `repeater.props.items.source` o cabeceras de tabla.
- Cambiar `defaultValue`, el estado almacenado de formularios o el payload enviado por submit salvo por el valor efectivo seleccionado cuando una opcion declare `props.items.value` interpolado.
- Anadir busqueda remota de opciones, paginacion de opciones, paginacion de `table` o carga incremental remota de colecciones.
- Cambiar el soporte actual de referencias completas fuera de las superficies afectadas por esta feature.
- Introducir i18n, pluralizacion, formatos de fecha/numero o composicion de mensajes localizada.

## Requisitos funcionales
- Un string visible con texto literal y uno o varios placeholders `{{...}}` debe renderizarse sustituyendo cada placeholder por el valor runtime correspondiente.
- Un mismo string debe poder combinar varios placeholders y conservar el texto literal que los rodea.
- Los placeholders deben reutilizar la resolucion central de referencias del runtime, sin parsers locales por nodo.
- Las referencias `queries.{queryName}`, `queries.{queryName}.data`, `queries.{queryName}.status`, `queries.{queryName}.error` y `queries.{queryName}.data.*` deben conservar sus restricciones vigentes.
- Las referencias `forms.{formId}.{fieldId}` deben leerse desde el estado compartido de formularios de la instancia activa.
- Las referencias `params.{paramName}` deben leerse desde la entrada de pagina activa y no deben admitir subrutas.
- Las referencias `item` e `item.*` deben resolverse cuando el nodo vive dentro de una iteracion de `repeater`.
- En proyecciones de colecciones, `item` e `item.*` deben resolver contra el item que se esta materializando en esa lista, opcion o fila, incluso cuando el consumidor no vive dentro de un `repeater`.
- Si una referencia dentro de un placeholder no existe, apunta a un dato ausente, intenta navegar fuera de contrato o resuelve a objeto, array, `null` o `undefined`, el placeholder debe producir string vacio.
- Los valores escalares `string`, `number` y `boolean` deben convertirse a texto visible estable.
- En `image.props.src`, el resultado interpolado completo debe tratarse como el `src` efectivo: si queda string no vacio, el nodo puede renderizar; si queda vacio, conserva la degradacion actual a no render.
- En `image.props.alt`, el resultado interpolado completo debe tratarse como texto alternativo efectivo y degradar a string vacio cuando no haya valor visible.
- En labels de campos y botones, una referencia ausente debe vaciar solo el placeholder afectado, no ocultar el control ni bloquear su interaccion.
- En `list`, los strings historicos y los `itemText` interpolados deben producir el texto visible de cada item; si una interpolacion no resuelve, solo se vacia el placeholder afectado.
- En `select`, `radioGroup` y `checkboxGroup`, los `label` interpolados deben producir el texto visible de cada opcion.
- En `select`, `radioGroup` y `checkboxGroup`, los `value` interpolados deben producir el valor efectivo de la opcion como string final, manteniendo la normalizacion vigente de valores de seleccion.
- Si una interpolacion en `value` de opcion produce string vacio, esa opcion debe seguir la politica vigente de opcion con valor vacio o invalido del consumidor, sin introducir un error de request ni bloquear el render del formulario completo.
- Si dos opciones acaban produciendo el mismo `value` efectivo por interpolacion, el runtime debe aplicar la misma politica defensiva que ya use para catalogos de opciones duplicados o degradar de forma estable sin crear estado ambiguo.
- En `table`, cada celda string interpolada debe renderizar el texto efectivo de la celda; los placeholders ausentes deben vaciar solo esa parte de la celda y no eliminar la fila.
- La interpolacion parcial debe convivir con updates del runtime: cuando cambien formularios, queries, params efectivos o contexto `item`, los strings visibles afectados deben reflejar el valor vigente igual que ocurre hoy con referencias completas visibles.
- Los strings sin delimitadores de plantilla deben preservar su comportamiento actual, incluidos los literales que contienen puntos.
- El escape historico con `\` para referencias completas debe conservarse para las superficies donde ya aplica, pero no debe convertirse en un mecanismo nuevo para escapar delimitadores de plantilla.

## Requisitos no funcionales
- La feature debe mantener el contrato producible desde backend legacy con strings simples.
- La sintaxis debe ser pequena, explicita y facil de validar visualmente en JSON.
- La resolucion debe vivir en la capa central de `runtime-references` para evitar semanticas divergentes entre nodos.
- La implementacion no debe introducir una dependencia externa de templating.
- El comportamiento debe ser determinista y defensivo ante datos remotos no confiables.
- La validacion previa al render no debe exigir que los datos runtime existan en bootstrap.
- La feature debe preservar la compatibilidad de configuraciones existentes que no usan `{{...}}`.

## Criterios de aceptacion
- Dado `heading.props.text: "Hola {{queries.user.data.name}}"` y una query con `data.name = "Ana"`, se renderiza `Hola Ana`.
- Dado un `paragraph` con dos placeholders validos, ambos se sustituyen y el texto literal intermedio se conserva.
- Dado un placeholder que resuelve a `0` o `false`, se muestra `0` o `false` en vez de tratarlo como ausencia.
- Dado un placeholder que resuelve a objeto, array, `null`, `undefined` o ruta ausente, se sustituye por string vacio.
- Dado un string sin `{{...}}`, el runtime conserva el comportamiento anterior de literal o referencia completa segun la superficie.
- Dado `button.props.label: "Ver expediente {{item.id}}"` dentro de un `repeater`, cada boton muestra el identificador del item de su iteracion.
- Dado el mismo `button.props.label` fuera de un `repeater`, el placeholder `{{item.id}}` se vacia sin romper el render del boton.
- Dado `input.props.label: "Nombre de {{forms.request.type}}"`, el label se actualiza cuando cambia el campo observado.
- Dado `image.props.src: "/avatars/{{queries.user.data.avatar}}"`, el `src` efectivo combina el literal con el valor resuelto.
- Dado `image.props.src: "{{queries.user.data.avatar}}"` sin dato disponible, el nodo conserva la degradacion actual a no render por `src` vacio.
- Dado `image.props.alt: "Avatar de {{queries.user.data.name}}"` sin `name`, el `alt` efectivo es `Avatar de `.
- Dado `list.props.items.itemText: "{{item.code}} - {{item.title}}"` sobre una coleccion de objetos, cada item muestra un texto compuesto con los campos de su propio objeto.
- Dado un `select` dinamico con `label: "{{item.code}} - {{item.name}}"`, cada opcion muestra una etiqueta compuesta por el item correspondiente.
- Dado un `select` dinamico con `value: "{{item.type}}:{{item.id}}"`, seleccionar una opcion guarda como valor efectivo el string compuesto resultante.
- Dado un `radioGroup` o `checkboxGroup` con `label` interpolado, las opciones visibles usan la misma semantica que `select`.
- Dado un `table` dinamico con `cells: ["{{item.code}}", "{{item.name}} ({{item.status}})"]`, cada fila renderiza celdas compuestas a partir del item de esa fila.
- Dada una tabla manual con una celda string que contiene `{{queries.summary.data.total}}`, la celda renderiza el valor actual o string vacio si no esta disponible.
- Dado un placeholder `{{params.userId}}`, se resuelve contra el param activo de navegacion.
- Dado un placeholder `{{params.user.id}}`, se trata como fuera de contrato para `params.*` y produce string vacio en la superficie visible.
- Dada una configuracion que usa referencias completas en requests, `navigateTo.params` o `defaultValue`, su comportamiento actual no cambia.
- Dada una configuracion que intenta usar interpolacion parcial en requests o `navigateTo.params`, esos strings no se reinterpretan como plantillas en esta feature.
- Dado texto literal con `{{` o `}}` que no forma un placeholder usable, el runtime no debe romper el render; el resultado visible debe ser estable y defensivo.

## Casos limite
- String con varios placeholders consecutivos.
- String con placeholder al principio o al final.
- Placeholder con espacios alrededor de la referencia.
- Placeholder vacio.
- Delimitador de apertura sin cierre o cierre sin apertura.
- Referencia a query en `idle`, `loading`, `error` o sin `data`.
- Referencia a un campo de formulario todavia no inicializado.
- Referencia `item.*` en nodos anidados dentro de `container` o `form` bajo un `repeater`.
- Referencia `item.*` dentro de una proyeccion de lista, opcion o fila dinamica sin `repeater` alrededor.
- Dos opciones cuyo `value` interpolado acaba siendo igual.
- Opcion cuyo `value` interpolado acaba siendo string vacio.
- Coleccion dinamica que cambia y altera labels o values interpolados mientras existe una seleccion activa.
- Interpolacion en labels de campos ocultos por `queryStateFeedback` o `visibility`.
- `image.props.src` que queda parcialmente construido pero no corresponde a una URL valida.

## Riesgos o preguntas abiertas
- No quedan preguntas abiertas de producto tras discovery.
- El principal riesgo es ampliar demasiadas superficies string de forma implicita; esta entrega lo evita con un catalogo cerrado de superficies visibles y de proyeccion de colecciones.
- Los `value` interpolados de opciones pueden afectar seleccion, limpieza de valores invalidos y submit; deben mantenerse como strings finales y conservar la normalizacion defensiva vigente de opciones.
- Si en el futuro se aplica interpolacion parcial a requests, habra que decidir una semantica distinta para datos ausentes, porque vaciar placeholders silenciosamente podria ocultar errores de construccion de request.
- La ausencia de escape para `{{` y `}}` puede limitar algunos literales raros, pero se acepta para mantener la v1 simple.

## Areas de producto afectadas
- Runtime UI configurable.
- Contrato de configuracion.
- Formularios y validacion.
- Queries y feedback.

## Documentacion probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
