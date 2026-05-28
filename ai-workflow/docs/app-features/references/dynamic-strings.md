> Cuándo leer: interpolación parcial `{{...}}` en strings visibles, catálogo cerrado de superficies, semántica de placeholders no resolubles.
> Tamaño: medio.
> Relacionados: [[reference-resolution.md]], [[../nodes/index.md]].

# Strings dinámicas con `{{...}}`

## Superficies que admiten interpolación parcial
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
- strings visibles de `list.props.items`
- `list.props.items.itemText` en colecciones manuales o dinámicas de objetos
- `select.props.items.label` y `select.props.items.value` en colecciones manuales o dinámicas de objetos
- `radioGroup.props.items.label` y `radioGroup.props.items.value` en colecciones manuales o dinámicas de objetos
- `checkboxGroup.props.items.label` y `checkboxGroup.props.items.value` en colecciones manuales o dinámicas de objetos
- celdas string de `table` manual
- `table.props.rows.cells` en modo dinámico

## Semántica de placeholders
- cada placeholder se resuelve con la misma capa central que las referencias completas
- espacios alrededor de la referencia dentro del placeholder se ignoran
- `string`, `number`, `boolean`, `0` y `false` producen texto visible
- objetos, arrays, `null`, `undefined`, referencias ausentes, inválidas, no soportadas o fuera de contrato producen string vacío solo para ese placeholder
- delimitadores no emparejados no rompen el render y conservan una salida estable
- `item` e `item.*` se resuelven contra la iteración de `repeater` cuando existe, o contra el item local de la proyección de colección que se está materializando
- `params.*` conserva la frontera `params.{paramName}`; `params.user.id` queda fuera de contrato y produce string vacío dentro de un placeholder

## Superficies fuera de interpolación parcial
Las siguientes superficies usan solo referencias completas o literales y NO aplican interpolación parcial. Un string como `prefix-{{params.userId}}` se conserva como literal o queda sometido a la validación histórica del consumidor, pero no se reinterpreta como plantilla:
- `api.query`, `api.body`, `api.headers`
- `button.props.action.query`, `button.props.action.body`, `button.props.action.headers`, `button.props.action.params`
- `form.submitAction.query`, `form.submitAction.body`, `form.submitAction.headers`
- `navigateTo.params`
- `defaultValue` de campos de formulario
- `visibility.reference`
- `queryStateFeedback`
- `repeater.props.items.source` y `repeater.props.items.key`
- `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source`
- cabeceras de `table`

## Reglas de placeholder vacío
- la interpolación parcial solo existe en el catálogo visible anterior y usa placeholders `{{referencia}}`
- cada placeholder no resoluble, inválido, ausente o no renderizable se sustituye por string vacío, conservando el texto literal que lo rodea
- objetos y arrays pueden recorrerse de izquierda a derecha con una única semántica central
- las referencias textuales no resolubles degradan a string vacío y mantienen diagnóstico de desarrollo coherente con la referencia original
