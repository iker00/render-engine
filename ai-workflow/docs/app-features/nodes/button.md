> Cuándo leer: nodo `button`, catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `resetForm`), submit implícito dentro de `form`.
> Tamaño: medio.
> Relacionados: [[../navigation/navigate-actions.md]], [[../queries/execution.md]], [[../forms/submit.md]].

# `button`

## Contrato (`props`)
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.action`: opcional; sin `action` solo es válido dentro del subárbol de un `form` y actúa como submit implícito.
- `props.action.type`: `navigateTo | goBack | executeOperation | resetForm`.

### `navigateTo`
- `props.action.pageId`: string obligatorio y no vacío.
- `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null`.

### `executeOperation`
- `props.action.operationName`: string obligatorio y no vacío.
- `props.action.query`: objeto plano opcional con valores `string | number | boolean`.
- `props.action.body`: payload JSON opcional.
- `props.action.headers`: objeto plano opcional con valores string.

### `resetForm`
- `props.action.formId`: string obligatorio y no vacío.

## Reglas de render
- `button.props` soporta `label` y `action`; `label` admite literal, referencia completa o interpolación parcial visible, y `action` cubre `navigateTo`, `goBack`, `executeOperation` y `resetForm`.
- `navigateTo` puede añadir `params` escalares por entrada y escribirlos en `#/pageId?...` o `#/?...` para la home funcional.
- `executeOperation` puede aportar `query`, `body` y `headers` por ejecución.
- Dentro de un `form`, un botón sin `action` actúa como submit implícito.
- `button` se renderiza como control accesible y delega sus acciones al ejecutor común del runtime, manteniendo los efectos visibles dentro de los dominios compartidos de navegación, queries y formularios.

## Validación específica
- Si un `button.props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `button.props.action.params` existe en `navigateTo`, debe ser un objeto plano con claves no vacías y valores escalares `string | number | boolean | null`.
- Si `button.props.action.params` incluye arrays, objetos anidados o rutas `params.*` mal formadas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si un `button.props.action.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- `resetForm` valida shape y `formId` no vacío, pero no intenta cerrar en bootstrap un catálogo semántico adicional de formularios.
- Si un `button` sin `action` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
