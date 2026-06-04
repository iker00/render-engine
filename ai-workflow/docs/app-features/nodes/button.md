> Cuándo leer: nodo `button`, catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`), submit implícito dentro de `form`.
> Tamaño: medio.
> Relacionados: [[../navigation/navigate-actions.md]], [[../queries/execution.md]], [[../forms/submit.md]], [[modal.md]].

# `button`

## Contrato (`props`)
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.action`: opcional; sin `action` solo es válido dentro del subárbol de un `form` y actúa como submit implícito.
- `props.action.type`: `navigateTo | goBack | executeOperation | executeOperations | resetForm | openModal | closeModal`.

### `navigateTo`
- `props.action.pageId`: string obligatorio y no vacío.
- `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null`.

### `executeOperation`
- `props.action.operationName`: string obligatorio y no vacío.
- `props.action.query`: objeto plano opcional con valores `string | number | boolean`.
- `props.action.body`: payload JSON opcional.
- `props.action.headers`: objeto plano opcional con valores string.

### `executeOperations`
- `props.action.operations`: array no vacío de objetos, cada uno con:
  - `operationName`: string obligatorio y no vacío
  - `query`: objeto plano opcional con valores `string | number | boolean`
  - `body`: payload JSON opcional
  - `headers`: objeto plano opcional con valores string
- Las N operaciones se lanzan en paralelo; cada una actualiza `queries.{operationName}` de forma independiente.
- Overrides por operación siguen la misma semántica de merge que `executeOperation` singular.

### `resetForm`
- `props.action.formId`: string obligatorio y no vacío.

### `openModal`
- `props.action.modalId`: string obligatorio y no vacío, referencia a un `modal.id` declarado en la configuración.
- Abre el modal referenciado. Si ya hay otro modal abierto, lo cierra antes de abrir el nuevo.

### `closeModal`
- `props.action.modalId`: string obligatorio y no vacío, referencia a un `modal.id` declarado en la configuración.
- Cierra el modal referenciado si está abierto. Si el modal ya está cerrado, la acción no produce efecto ni error visible.

## Reglas de render
- `button.props` soporta `label` y `action`; `label` admite literal, referencia completa o interpolación parcial visible, y `action` cubre `navigateTo`, `goBack`, `executeOperation`, `executeOperations` y `resetForm`.
- `navigateTo` puede añadir `params` escalares por entrada y escribirlos en `#/pageId?...` o `#/?...` para la home funcional.
- `executeOperation` puede aportar `query`, `body` y `headers` por ejecución.
- `executeOperations` lanza un array de operaciones en paralelo, cada una con overrides opcionales de `query`, `body` y `headers`.
- Dentro de un `form`, un botón sin `action` actúa como submit implícito.
- `button` se renderiza como control accesible y delega sus acciones al ejecutor común del runtime, manteniendo los efectos visibles dentro de los dominios compartidos de navegación, queries y formularios.

## Validación específica
- Si un `button.props.action.pageId` apunta a una página inexistente, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `button.props.action.params` existe en `navigateTo`, debe ser un objeto plano con claves no vacías y valores escalares `string | number | boolean | null`.
- Si `button.props.action.params` incluye arrays, objetos anidados o rutas `params.*` mal formadas, el config completo se rechaza antes del render sobre la ruta exacta.
- Si un `button.props.action.operationName` apunta a una operación inexistente en `api`, el config completo se rechaza antes del render aunque el shape estructural sea válido.
- Si `button.props.action.type: executeOperations` y alguna entrada lleva `body` pero `api[entry.operationName].method === 'GET'`, el config se rechaza antes del render con el error `GET operations do not support body.`
- Si `button.props.action.type: executeOperations`, las entradas con `operationName` inexistente en `api` se aceptan en bootstrap (la validación no rechaza por adelantado); el error se reporta en runtime por operación con `code: operation-not-found`.
- Si `button.props.action.type: executeOperations` y `operations` está ausente o vacío, el config completo se rechaza antes del render.
- Si `button.props.action.type: executeOperations` y alguna entrada no declara `operationName` o lo declara vacío, el config completo se rechaza antes del render.
- `resetForm` valida shape y `formId` no vacío, pero no intenta cerrar en bootstrap un catálogo semántico adicional de formularios.
- Si `button.props.action.modalId` en `openModal` o `closeModal` apunta a un `id` inexistente o no corresponde a ningún `modal.id`, el config completo se rechaza antes del render.
- Si un `button` sin `action` aparece fuera de un subárbol `form`, el config completo se rechaza antes del render.
