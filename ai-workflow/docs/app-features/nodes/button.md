> Cuándo leer: nodo `button`, catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `downloadOperation`, `resetForm`, `openModal`, `closeModal`), submit implícito dentro de `form`, `onSuccess`/`onError` encadenados tras `executeOperation`/`executeOperations`/`downloadOperation` de un botón.
> Tamaño: medio.
> Relacionados: [[../navigation/navigate-actions.md]], [[../queries/execution.md]], [[../forms/submit.md]], [[modal.md]].

# `button`

## Contrato (`props`)
- `props.label`: string obligatorio, literal, referencia dinámica completa o string visible interpolado con `{{...}}`.
- `props.icon`: string opcional, nombre del icono Lucide React (ej. `"Search"`, `"User"`, `"ArrowRight"`). Se renderiza a la izquierda del label por defecto. Si el nombre no resuelve a un icono conocido, se ignora silenciosamente.
- `props.iconPosition`: string opcional, enum cerrado `"left" | "right"`, default `"left"`. Controla el posicionamiento del icono declarado con `props.icon`. Solo tiene efecto cuando `props.icon` está declarado y resuelve a un icono conocido; en caso contrario se ignora silenciosamente.
- `props.action`: opcional; sin `action` solo es válido dentro del subárbol de un `form` y actúa como submit implícito.
- `props.action.type`: `navigateTo | goBack | executeOperation | executeOperations | downloadOperation | resetForm | openModal | closeModal`.
- `props.color`: opcional, enum cerrado de seis valores semánticos: `neutral | primary | success | warning | danger | info`, default `primary`.
- `props.variant`: opcional, enum cerrado de cinco variantes visuales: `solid | outline | ghost | link | switch`, default `solid`.
- `props.fullWidth`: opcional, boolean que, cuando es `true`, hace que el botón ocupe el 100% del ancho del contenedor padre, default `false`.
- `props.checked`: boolean literal o referencia dinámica completa (misma frontera que `defaultValue` de campos de formulario: `item.*`, `row.*`, `queries.*`, `forms.*`, `params.*`). Obligatorio cuando `props.variant: 'switch'`; no válido (config rechazado) en cualquier otro `variant`.
- `props.labelVisible`: boolean opcional, default `true`. Solo válido cuando `props.variant: 'switch'`; no válido (config rechazado) en cualquier otro `variant`. Cuando es `false`, `label` deja de renderizarse como texto visible y pasa a usarse como `aria-label` del control.
- `props.icon`/`props.iconPosition` no son válidos cuando `props.variant: 'switch'` (config rechazado): la variante switch no admite icono.

### `navigateTo`
- `props.action.pageId`: string obligatorio y no vacío.
- `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null`.

### `executeOperation`
- `props.action.operationName`: string obligatorio y no vacío.
- `props.action.query`: objeto plano opcional con valores `string | number | boolean`.
- `props.action.body`: payload JSON opcional.
- `props.action.headers`: objeto plano opcional con valores string.
- `props.action.onSuccess`/`props.action.onError`: opcionales, ver [Acciones post-ejecución](#acciones-post-ejecución-onsuccess-onerror) más abajo.

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
- `props.action.onSuccess`/`props.action.onError`: opcionales, a nivel de la acción completa (no por operación individual); ver [Acciones post-ejecución](#acciones-post-ejecución-onsuccess-onerror) más abajo.

### `downloadOperation`
- `props.action.operationName`: string obligatorio y no vacío, referencia a una operación de `api`.
- `props.action.query`/`props.action.body`/`props.action.headers`: opcionales, misma semántica de resolución que `executeOperation` (incluida la resolución de `item.*` dentro de un `repeater`).
- `props.action.filename`: opcional, referencia de texto dinámica que resuelve el nombre de fichero del `download` cuando la respuesta no trae `Content-Disposition` con `filename`. Si tampoco resuelve a un valor no vacío, se usa el literal genérico `download`.
- Al pulsar el botón: se deshabilita (`disabled` nativo) mientras la descarga está en curso, ejecuta la operación vía `queries.{operationName}` (que refleja `loading` → `success`/`error` como cualquier otra operación) y dispara la descarga real del navegador (`Blob` + enlace temporal) solo en éxito.
- Mientras el botón está deshabilitado, un click adicional no dispara una segunda descarga.
- Al terminar (éxito o error) el botón vuelve a estar habilitado.
- `props.action.onSuccess`/`props.action.onError`: opcionales, misma semántica que en `executeOperation` (ver [Acciones post-ejecución](#acciones-post-ejecución-onsuccess-onerror)); no son obligatorios para que la descarga se dispare.
- Un error de red o una respuesta HTTP no-ok no dispara la descarga del navegador ni ejecuta `onSuccess`; ejecuta `onError` si está declarado.
- Dos instancias de `button` que comparten el mismo `operationName` mantienen su propio estado `disabled` de forma independiente, aunque ambas lean el mismo `queries.{operationName}`.

## Acciones post-ejecución (`onSuccess`/`onError`)
- Un botón con `props.action.type: executeOperation`, `executeOperations` o `downloadOperation` puede declarar `onSuccess`/`onError`: listas ordenadas de acciones del mismo catálogo de botón (`navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`), cada una con `when` opcional (mismo shape que `visibility`).
- La semántica de ejecución es idéntica a `form.submitAction.onSuccess`/`onError` (ver [[../forms/submit.md#Acciones post-éxito onSuccess]]): orden declarado, todas las entradas cuyo `when` se cumple se ejecutan, `onSuccess` solo tras éxito y `onError` solo tras fallo, nunca ambos para la misma ejecución.
- Con `executeOperation` (singular), éxito/error de esa única operación decide el bloque. Con `executeOperations` (plural), `onSuccess` requiere que **todas** las operaciones de la lista terminen en éxito; `onError` se dispara si **alguna** termina en error.
- Las referencias `queries.{operationName}.*` usadas por los `when` de `onSuccess`/`onError` ya reflejan el estado y los datos de la ejecución que disparó el bloque.
- Dentro de un `repeater`, las acciones de `onSuccess`/`onError` (y sus overrides `query`/`body`/`headers`/`params`) resuelven `item.*` contra el item de la iteración que disparó el botón.
- Un botón auxiliar (`action` explícita) dentro de un `form` puede usar `onSuccess`/`onError` sobre su propia operación, de forma independiente al `submitAction` del formulario que lo contiene.
- Anidamiento limitado a un solo nivel: una entrada dentro de una lista `onSuccess`/`onError` no admite su propio `onSuccess`/`onError`.
- Sin `onSuccess`/`onError` declarados, el comportamiento del botón es exactamente el mismo que antes de esta capacidad.

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

### Variante `switch`
Se renderiza como `<button type="button" role="switch" aria-checked={checked}>`, misma semántica de accesibilidad que ya usa `toggle` (comparten el mismo componente presentacional del control), en vez del esqueleto rectangular de las otras cuatro variantes.

- El estado visual marcado/no marcado se recalcula en cada render a partir del valor resuelto de `props.checked`; un click no lo cambia de forma local ni optimista. Una referencia bien formada cuyo dato aún no existe degrada a `false` (no marcado), consistente con la política general de degradación segura del runtime. Un `checked` literal fijo mantiene siempre ese estado visual.
- `props.color` tiñe el track solo cuando `checked` resuelve `true`, con el color semántico configurado; con `checked: false` el track usa siempre el mismo tratamiento neutro, sin variación por `color`.
- `props.labelVisible: false` oculta el texto de `label` en el DOM visible pero lo expone como `aria-label` del control; con `labelVisible` ausente o `true`, `label` se renderiza como texto visible junto al control y el control no añade `aria-label` propio.
- Un click siempre dispara la `action` configurada, con el mismo catálogo y resolución de `item.*`/`query`/`body`/`headers` que el resto de variantes de `button` (incluida dentro de `repeater`, `table`, `modal` o como botón auxiliar de `form`); la variante switch no introduce ningún estado `disabled` — el click dispara la `action` incluso con el switch ya `checked: true`.
- `props.action` es obligatorio con `variant: 'switch'` (config rechazado sin él), incluso fuera de un `form`: sin `action` el control no tendría ningún efecto observable.
- `props.action.query`/`body`/`headers` (y cada entrada de `props.action.operations[]` cuando `action.type: executeOperations`) puede referenciar la referencia sintética `switch.next`, que resuelve al booleano contrario al `checked` resuelto de esa misma instancia en el momento del click (p. ej. `body: { isPrimary: "switch.next" }`). Frontera y detalle en [[../references/reference-resolution.md#Frontera específica de switch.next]]. `switch.next` fuera de esa superficie (`props.checked`, `visibility.reference`, la `action` de otro nodo, o un `button` cuyo `variant` no es `switch`) se rechaza en bootstrap.
- La variante no gestiona exclusividad entre switches ("solo un item principal a la vez"): se asume resuelta en backend y reflejada en la siguiente lectura del dato de origen de `checked`, típicamente tras el refetch encadenado en `onSuccess` de la propia `action`.

### Paleta de colores semánticos
Idéntica a la establecida en `badge`, `alert` y `stat`:
- `neutral`: Sin connotación semántica específica.
- `primary`: Acción principal de la pantalla.
- `success`: Confirmación, aprobación o estado positivo.
- `warning`: Advertencia o acción que requiere atención.
- `danger`: Acción destructiva, error o estado crítico.
- `info`: Información adicional o acción informativa.

## Reglas de render
- `button.props` soporta `label`, `action`, `color`, `variant`, `fullWidth`, y — solo con `variant: 'switch'` — `checked`/`labelVisible`; `label` admite literal, referencia completa o interpolación parcial visible, y `action` cubre `navigateTo`, `goBack`, `executeOperation`, `executeOperations`, `downloadOperation`, `resetForm`, `openModal` y `closeModal`.
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
- Si una entrada de `props.action.onSuccess`/`onError` referencia un `operationName`, `pageId` o `modalId` inexistente (`executeOperation`, `navigateTo`, `openModal`/`closeModal` respectivamente), el config completo se rechaza antes del render.
- Si una entrada `executeOperation` de `props.action.onSuccess`/`onError` lleva `body` pero `api[operationName].method === 'GET'`, el config se rechaza antes del render con el error `GET operations do not support body.`
- Una entrada dentro de `props.action.onSuccess`/`onError` que declare su propio `onSuccess`/`onError` se rechaza en bootstrap (anidamiento no soportado).
- Si `button.props.color` toma un valor fuera del enum cerrado (`neutral | primary | success | warning | danger | info`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.variant` toma un valor fuera del enum cerrado (`solid | outline | ghost | link | switch`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.fullWidth` no es un valor booleano, el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Si `button.props.iconPosition` toma un valor fuera del enum cerrado (`"left" | "right"`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- Un botón sin `color` ni `variant` explícitos se comporta como `color: primary` y `variant: solid`.
- Si `button.props.variant: 'switch'` y `checked` está ausente, el config completo se rechaza antes del render.
- Si `button.props.checked` o `button.props.labelVisible` están presentes con `variant` distinto de `switch` (incluido `variant` ausente), el config completo se rechaza antes del render.
- Si `button.props.variant: 'switch'` y `props.icon` está declarado, el config completo se rechaza antes del render.
- Si `button.props.variant: 'switch'` y `props.action` está ausente, el config completo se rechaza antes del render — sustituye, para esta variante, a la regla genérica de "botón sin `action` fuera de `form`": un `switch` con `action` se acepta con normalidad fuera de un `form`.
- Si `switch.next` aparece en `props.action.query`/`body`/`headers` (o en `operations[].query`/`body`/`headers` con `action.type: executeOperations`) de un `button` cuyo `variant` no es `switch`, el config completo se rechaza antes del render.
- Si `switch.next` aparece en cualquier superficie distinta de `props.action.query`/`body`/`headers`/`operations[].*` del propio `button` con `variant: 'switch'` (por ejemplo `props.checked`, `visibility.reference`, o la `action` de otro nodo), el config completo se rechaza antes del render.
