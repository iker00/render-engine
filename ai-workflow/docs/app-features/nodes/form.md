> Cuándo leer: `form` como contenedor, `id`, `submitAction`, `persistOnUnmount`, `resetOnSuccess`, niños permitidos, gramática visual dentro del runtime.
> Tamaño: medio.
> Relacionados: [[../forms/lifecycle.md]], [[../forms/submit.md]], [[input.md]], [[textarea.md]], [[select.md]], [[choice-groups.md]], [[button.md]].

# `form`

## Contrato (props del nodo)
- `id`: string obligatorio, estable y único dentro de toda la configuración.
- `persistOnUnmount`: boolean opcional; cuando vale `true`, el formulario conserva su estado local al desmontarse, y cuando no existe o vale `false` el runtime lo elimina por defecto.
- `submitAction.type`: `executeOperation` o `executeOperations`.
- `submitAction.operationName`: string obligatorio y no vacío cuando existe `submitAction` y `type` es `executeOperation`.
- `submitAction.operations`: array no vacío de operaciones cuando `type` es `executeOperations`.
- `submitAction.query`: objeto plano opcional con valores `string | number | boolean`.
- `submitAction.body`: payload JSON opcional.
- `submitAction.headers`: objeto plano opcional con valores string.
- `submitAction.onSuccess`: lista opcional de acciones a ejecutar tras un submit exitoso (cada una puede ser `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal` o `closeModal`, y cada una puede declarar opcionalmente `when` con el mismo shape que `visibility`).
- `submitAction.onError`: lista opcional de acciones a ejecutar tras un submit fallido (cada una puede ser `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal` o `closeModal`, y cada una puede declarar opcionalmente `when` con el mismo shape que `visibility`).
- `resetOnSuccess`: boolean opcional, válido solo cuando existe `submitAction`; se ejecuta después de `onSuccess` si está activo.
- `children`: colección ordenada con soporte para `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `tabs` y `divider`.

## Reglas de render
- `form` renderiza un `<form>` real, hereda un contexto estable de `formId` a sus descendientes, inicializa solo los campos todavía ausentes en el store, elimina por defecto `forms.{formId}` al desmontarse realmente y puede ejecutar `submitAction.type: executeOperation` con `query`, `body` y `headers` por envío.
- `form.persistOnUnmount: true` convierte esa limpieza por desmontaje en una excepción opt-in para conservar la persistencia histórica de un formulario concreto dentro de la misma instancia del runtime.

## Gramática visual
- `form` funciona hoy como layout principal del trámite, no como una tarjeta adicional que envuelva otras tarjetas internas.
- La baseline visual vigente del formulario es deliberadamente compacta: el bloque introductorio, las secciones, los campos y el cierre de acciones ocupan menos altura total que en la baseline institucional inicial, sin abandonar su gramática administrativa.
- La jerarquía visual de acciones sigue distinguiendo CTA principal y acciones secundarias sin alterar su semántica funcional actual, pero ambas reducen padding y altura percibida respecto a la baseline previa.
- A partir de la feature `0057`, los `container` dentro de `form` con `surface: form-section` ya **no** reciben automáticamente el separador superior `border-t`. La separación visual entre secciones de formulario debe declararse explícitamente con un nodo `{ "type": "divider" }` antes del `container` que actúa como sección. Los JSON de configuración que dependieran del separador automático deben actualizarse añadiendo nodos `divider` explícitos.

## Validación específica
- `form.persistOnUnmount` sigue siendo opcional; si aparece con un valor no booleano, el config completo se rechaza antes del render sobre la ruta exacta.
- Si `form.id` se repite en cualquier página, el config completo se rechaza antes del render.
- Si un `fieldId` se repite dentro del mismo `form`, el config completo se rechaza antes del render.
- Si `form.submitAction.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render.
- Si `form.resetOnSuccess: true` aparece sin `submitAction`, el config completo se rechaza antes del render.
- Si un `form.children` contiene nodos fuera de `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `button`, `heading`, `paragraph`, `image`, `table`, `container`, `accordion`, `tabs` y `divider`, el config completo se rechaza antes del render.

## Sub-temas relacionados
El ciclo de vida del estado, la validación de los campos hijos, los valores por defecto y la semántica de submit/reset viven en [`../forms/`](../forms/index.md):
- [lifecycle](../forms/lifecycle.md)
- [defaults](../forms/defaults.md)
- [validation-rules](../forms/validation-rules.md)
- [submit](../forms/submit.md)
