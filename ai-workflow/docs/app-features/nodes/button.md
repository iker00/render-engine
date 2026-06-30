> Cuándo leer: nodo `button`, catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`), submit implícito dentro de `form`.
> Tamaño: medio.
> Relacionados: [[../navigation/navigate-actions.md]], [[../queries/execution.md]], [[../forms/submit.md]], [[modal.md]].

# `button`

## Contrato (`props`)
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.icon`: string opcional, nombre del icono Lucide React (ej. `"Search"`, `"User"`, `"ArrowRight"`). Se renderiza a la izquierda del label por defecto. Si el nombre no resuelve a un icono conocido, se ignora silenciosamente.
- `props.iconPosition`: string opcional, enum cerrado `"left" | "right"`, default `"left"`. Controla el posicionamiento del icono declarado con `props.icon`. Solo tiene efecto cuando `props.icon` está declarado y resuelve a un icono conocido; en caso contrario se ignora silenciosamente.
- `props.action`: opcional; sin `action` solo es válido dentro del subárbol de un `form` y actúa como submit implícito.
- `props.action.type`: `navigateTo | goBack | executeOperation | executeOperations | resetForm | openModal | closeModal`.
- `props.color`: opcional, enum cerrado de seis valores semánticos: `neutral | primary | success | warning | danger | info`, default `primary`.
- `props.variant`: opcional, enum cerrado de cuatro variantes visuales: `solid | outline | ghost | link`, default `solid`.
- `props.fullWidth`: opcional, boolean que, cuando es `true`, hace que el botón ocupe el 100% del ancho del contenedor padre, default `false`.

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
  - `when`: objeto opcional con shape idéntico a `visibility` (`reference`, `operator`, `value?`) para condicionar la ejecución de esa operación individual
- Las N operaciones cuya condición `when` se cumple se lanzan en paralelo; cada una actualiza `queries.{operationName}` de forma independiente.
- Una operación sin `when` siempre se lanza.
- Si la condición `when` de una operación no se cumple, esa operación se omite silenciosamente.
- Si todas las operaciones son omitidas por sus condiciones `when`, la acción completa sin lanzar ninguna query; esto se trata como éxito.
- Overrides por operación siguen la misma semántica de merge que `executeOperation` singular.

### `resetForm`
- `props.action.formId`: string obligatorio y no vacío.

### `openModal`
- `props.action.modalId`: string obligatorio y no vacío, referencia a un `modal.id` declarado en la configuración.
- Abre el modal referenciado. Si ya hay otro modal abierto, lo cierra antes de abrir el nuevo.

### `closeModal`
- `props.action.modalId`: string obligatorio y no vacío, referencia a un `modal.id` declarado en la configuración.
- Cierra el modal referenciado si está abierto. Si el modal ya está cerrado, la acción no produce efecto ni error visible.

## Variantes de estilo

Los estilos del botón se controlan mediante `props.color` y `props.variant`. Las combinaciones producen los siguientes efectos visuales:

### Variante `solid` (default)
Botón con fondo sólido del color semántico y texto en contraste blanco o oscuro según el color.

### Variante `outline`
Botón con fondo transparente, borde del color semántico y texto del color semántico. Al hacer hover, aparece un fondo muy suave del mismo color.

### Variante `ghost`
Botón sin borde ni fondo visible en estado normal, solo texto con el color semántico. Al hacer hover, aparece un fondo muy suave del mismo color (similar a `badge` con variant `pill`).

### Variante `link`
Botón que se renderiza visualmente como un enlace de texto (sin fondo ni borde), con texto de color semántico. Al hacer hover, aparece un subrayado. Útil para acciones incrustadas en texto corrido o tablas.

### Paleta de colores semánticos
Idéntica a la establecida en `badge`, `alert` y `stat`:
- `neutral`: Sin connotación semántica específica.
- `primary`: Acción principal de la pantalla.
- `success`: Confirmación, aprobación o estado positivo.
- `warning`: Advertencia o acción que requiere atención.
- `danger`: Acción destructiva, error o estado crítico.
- `info`: Información adicional o acción informativa.

## Reglas de render
- `button.props` soporta `label`, `action`, `color`, `variant` y `fullWidth`; `label` admite literal, referencia completa o interpolación parcial visible, y `action` cubre `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal` y `closeModal`.
- `navigateTo` puede añadir `params` escalares por entrada y escribirlos en `#/pageId?...` o `#/?...` para la home funcional.
- `executeOperation` puede aportar `query`, `body` y `headers` por ejecución.
- `executeOperations` lanza un array de operaciones en paralelo, cada una con overrides opcionales de `query`, `body` y `headers`.
- Dentro de un `form`, un botón sin `action` actúa como submit implícito. Los botones submit implícitos también aceptan `color`, `variant` y `fullWidth`.
- `color` y `variant` son propiedades estilísticas opcionales que no afectan la semántica de la acción del botón. Combinadas determinan la apariencia visual dentro de los cuatro patrones visuales documentados.
- `fullWidth` hace que el botón ocupe el 100% del ancho de su contenedor padre cuando es `true`; es independiente de la paleta o variante.
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
- Si `button.props.color` toma un valor fuera del enum cerrado (`neutral | primary | success | warning | danger | info`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.variant` toma un valor fuera del enum cerrado (`solid | outline | ghost | link`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.fullWidth` no es un valor booleano, el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.iconPosition` toma un valor fuera del enum cerrado (`"left" | "right"`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Un botón sin `color` ni `variant` explícitos se comporta como `color: primary` y `variant: solid`.
