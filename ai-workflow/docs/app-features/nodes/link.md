> Cuándo leer: si la tarea toca el nodo `link` — enlace declarativo que navega a URLs externas, inicia descargas de documentos vía `downloadOperation` o ejecuta navegación interna del runtime (`navigateTo`/`goBack`).
> Tamaño: medio.
> Relacionados: [[button.md]], [[../navigation/navigate-actions.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `link`

Nodo que se renderiza siempre como un elemento `<a>` HTML semántico. Permite enlazar a URLs externas, iniciar descargas de documentos, o ejecutar navegación interna entre páginas del runtime mediante acciones declarativas. El destino se declara con `props.href` o con `props.action`; ambas formas son mutuamente excluyentes. El contenido del anchor puede ser texto simple (`props.label`) o un árbol de nodos (`children`).

## Props

| Prop | Tipo | Requerido | Descripción |
|---|---|---|---|
| `props.label` | `string` | condicional | Texto visible del enlace. Obligatorio si no hay `children`. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.icon` | `string` | no | Nombre del icono Lucide React (ej. `"ExternalLink"`). Se renderiza a la izquierda del label por defecto. Solo aplicable cuando se usa `props.label`. Si el nombre no resuelve, se ignora silenciosamente. |
| `props.iconPosition` | `string` | no | Enum cerrado `"left" | "right"`, default `"left"`. Controla el posicionamiento del icono declarado con `props.icon`. Solo aplicable en modo `props.label`. Sin efecto en modo `children`. |
| `props.href` | `string` | condicional | URL de destino. Obligatorio si no hay `props.action`. Admite literal o referencia dinámica completa (`queries.*`, `item.*`, etc.). |
| `props.download` | `string` | no | Nombre de fichero sugerido al navegador. Activa el atributo `download` del anchor. Solo aplicable junto a `props.href`. |
| `props.target` | `string` | no | Valor del atributo `target` del anchor (p.ej. `"_blank"`). Solo aplicable junto a `props.href`. Sin valor, el anchor no lleva atributo `target`. |
| `props.action` | objeto | condicional | Acción de navegación interna o de descarga. Obligatorio si no hay `props.href`. Acepta `navigateTo`, `goBack` o `downloadOperation`. |
| `children` | array de nodos | condicional | Nodos del anchor alternativos a `props.label`. Obligatorio si no hay `props.label`. Tipos permitidos: `container`, `heading`, `paragraph`, `list`, `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`. La restricción es recursiva. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el anchor no se renderiza.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Contratos de acción

Se permiten tres tipos de acción en `props.action`: `navigateTo`, `goBack` y `downloadOperation`.

### `navigateTo`
- `props.action.pageId`: string obligatorio y no vacío. Debe apuntar a una página existente en `pages`.
- `props.action.params`: objeto plano opcional con claves no vacías y valores `string | number | boolean | null`.

### `goBack`
Sin parámetros adicionales. Ejecuta navegación hacia atrás del runtime.

### `downloadOperation`
- `props.action.operationName`: string obligatorio y no vacío, referencia a una operación de `api`.
- `props.action.query`/`props.action.body`/`props.action.headers`: opcionales, misma semántica de resolución que en `button` (incluida la resolución de `item.*` dentro de un `repeater`).
- `props.action.filename`: opcional, referencia de texto dinámica que resuelve el nombre de fichero del `download` cuando la respuesta no trae `Content-Disposition` con `filename`. Si tampoco resuelve a un valor no vacío, se usa el literal genérico `download`.
- Al pulsar el link: se deshabilita mediante `aria-disabled="true"` (el `<a>` no tiene `disabled` nativo) mientras la descarga está en curso, ejecuta la operación vía `queries.{operationName}` (que refleja `loading` → `success`/`error` como cualquier otra operación) y dispara la descarga real del navegador (`Blob` + enlace temporal) solo en éxito.
- Mientras `aria-disabled="true"`, un click adicional no dispara una segunda descarga.
- Al terminar (éxito o error) el atributo `aria-disabled` desaparece.
- `props.action.onSuccess`/`props.action.onError`: opcionales, misma semántica que en `button` (listas ordenadas de acciones con `when` opcional); primera capacidad de lifecycle post-ejecución del nodo `link`. No son obligatorios para que la descarga se dispare.
- Un error de red o una respuesta HTTP no-ok no dispara la descarga del navegador ni ejecuta `onSuccess`; ejecuta `onError` si está declarado.
- El anchor no lleva atributo `href` decorativo cuando `action.type: downloadOperation` (a diferencia de `navigateTo`/`goBack`): al no resolver a una URL de navegación real, no aplica el cálculo de href estable descrito más abajo.

## Comportamiento de render

- El nodo se renderiza siempre como `<a data-layout-node="link">`.
- Si `children` está presente: el contenido del anchor son los nodos hijos renderizados. El nodo ignorará `props.label` e `props.icon`.
- Si `props.label` está presente (sin `children`): el contenido del anchor es el label resuelto como referencia dinámina. Si `props.icon` está declarado, se renderiza el icono a la izquierda del label.
- Si `props.href` está presente: el anchor usa el valor resuelto como atributo `href`. Si `props.download` está declarado, se añade el atributo `download` con el nombre de fichero. Si `props.target` está declarado, se añade el atributo `target`. Este comportamiento es idéntico independientemente de si el contenido es `children` o `props.label`.
- Si `props.action` es `navigateTo` o `goBack`: el anchor lleva un atributo `href` decorativo que permite al navegador mostrar el destino en la barra de estado y cambiar el cursor a puntero de enlace. El href se calcula de forma estable y no interfiere con el comportamiento de clic: el anchor sigue previniendo el comportamiento por defecto del navegador al hacer clic y delega en el ejecutor común de acciones del runtime (`executeRuntimeUiAction`), sin lifecycle. Este comportamiento es idéntico independientemente de si el contenido es `children` o `props.label`.
  - Para `navigateTo`: el `href` es siempre `#/{pageId}` (literal).
  - Para `goBack`: el `href` se resuelve desde el historial previo del runtime usando su función de canonicalización (`createBrowserHashNavigationHash`). Si no hay entrada previa, el `href` es `"#"`.
- Si `props.action` es `downloadOperation`: el anchor no lleva atributo `href` (queda `undefined`). El clic previene el comportamiento por defecto del navegador y, si no hay una descarga en curso para esta instancia, dispara `runDownloadAction` orquestado con `onSuccess`/`onError` (`runActionOutcomeWithLifecycle`). Mientras la descarga está en curso, el anchor lleva `aria-disabled="true"` y un segundo clic no dispara una segunda descarga; al terminar (éxito o error), el atributo desaparece.
- `props.label` y `props.href` se resuelven como referencias de texto dinámicas con el mismo mecanismo que el resto del runtime (`resolveRuntimeTextReference`).

## Casos límite

- **`children` vacío** (`children: []`): se acepta; el anchor se renderiza sin contenido interior (`<a></a>` vacío), con `href`/`action` funcionando igual que con cualquier otro contenido.
- **`children` con un único nodo `divider`**: se acepta; el anchor renderiza solo el divisor.
- **`children` con un `container` sin hijos propios**: se acepta; el anchor renderiza un contenedor vacío.
- **`children` con `skeleton`**: se acepta; el placeholder de carga se renderiza como contenido del anchor.
- **`container` dentro de `children` con `variant: card`**: se acepta; `variant` es una propiedad de presentación del `container`, no modifica las restricciones de tipos.
- **`repeater` dentro de `children`**: se rechaza en validación previa (tipo no permitido).
- **`link` dentro de `children` de otro `link`**: se rechaza en validación previa (no se pueden anidar anchors en HTML).
- **`props.download` con `children`**: se acepta si `props.href` está declarado; el comportamiento de `download` es independiente del contenido del anchor.
- **`props.target: "_blank"` con `children`**: se acepta; el comportamiento es idéntico al caso con `label`.
- **`props.href` resuelto a referencia no disponible o vacía**: el anchor se renderiza con `href=""`. La degradación es segura y no produce error de render.
- **`props.download` con `props.href` vacío resuelto**: el atributo `download` se incluye igualmente; la degradación es responsabilidad del navegador.
- **`props.action: navigateTo` con `pageId` igual a `initialPage`**: el `href` renderizado sigue siendo `#/{initialPageId}` literal; no se normaliza a `#/` en el atributo (esa normalización ocurre en tiempo de navegación dentro del runtime).
- **`props.action: navigateTo` con `params` declarados**: los params se ignoran en el cálculo del `href`. El atributo `href` solo refleja la ruta de página (`#/{pageId}`).
- **`props.action: goBack` en la primera página del historial del runtime**: el `href` es `"#"` como fallback; el comportamiento de clic sigue previniendo el comportamiento nativo del navegador.
- **`props.action: goBack` con entrada previa cuyo `pageId` coincide con `initialPage`**: el `href` se normaliza canónicamente a `#/` (no `#/{initialPageId}`).
- **`props.action: goBack` con entrada previa que contiene `params`**: el `href` incluye los params como query string, normalizados según la función canónica del runtime.
- **`props.label` interpolado con referencia no disponible**: el placeholder se vacía, igual que en el resto de strings interpolados del runtime.
- **`target: "_blank"` sin `rel`**: en v1 el runtime no inyecta automáticamente `rel="noopener noreferrer"`.
- **`props.action: downloadOperation` dentro de un `repeater`**: `item.*` en `query`/`body`/`headers`/`filename`/`onSuccess`/`onError` se resuelve contra el item de la iteración que disparó el link, igual que en `button`.
- **`props.action: downloadOperation` sin `onSuccess`/`onError` declarados**: la descarga se dispara igualmente; el lifecycle post-ejecución es opcional.
- **Dos instancias de `link` que comparten el mismo `operationName` de `downloadOperation`**: mantienen su propio estado `aria-disabled` de forma independiente, aunque ambas lean el mismo `queries.{operationName}`.

## Validación previa al render

- Debe declararse exactamente uno de `props.label` o `children`. Si se declaran ambos, el config se rechaza con diagnóstico `link nodes cannot have both props.label and children.` Si ninguno está presente, el config se rechaza con diagnóstico `link nodes must have either props.label or children.`
- `props.icon` sin `props.label` rechaza el config con diagnóstico `link nodes cannot have both props.icon and children.` (cuando `children` está presente).
- `props.iconPosition` declarado junto con `children` rechaza el config con el mismo diagnóstico que la restricción existente `icon + children`: `link nodes cannot have both props.icon and children.` (la restricción se aplica a ambas propiedades de forma conjunta).
- Si `children` está presente, todos los nodos dentro (en cualquier profundidad) deben pertenecer al subconjunto cerrado: `container`, `heading`, `paragraph`, `list`, `image`, `badge`, `alert`, `stat`, `divider`, `skeleton`. Cualquier otro tipo rechaza el config con diagnóstico exacto incluyendo la ruta del nodo prohibido, p.ej. `link children may only be container, heading, paragraph, list, image, badge, alert, stat, divider or skeleton nodes.`
- `props.href` y `props.action` son mutuamente excluyentes. Si se declaran ambos, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}`.
- Debe declararse al menos uno de `props.href` o `props.action`. Si ninguno está presente, el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}`.
- `props.download` sin `props.href` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.download`. Esta regla aplica independientemente de si el contenido es `children` o `props.label`.
- `props.target` sin `props.href` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.target`. Esta regla aplica independientemente de si el contenido es `children` o `props.label`.
- `props.action.type` distinto de `navigateTo`, `goBack` o `downloadOperation` rechaza el config con `invalid-layout` y diagnóstico `{path}.props.action.type`.
- `props.action.pageId` apuntando a una página inexistente rechaza el config con `invalid-layout`, igual que en `button`.
- `props.action` de tipo `navigateTo` sin `pageId` rechaza el config con `invalid-layout`.
- `props.action` de tipo `downloadOperation` sigue el mismo contrato de validación que en `button` (`operationName` obligatorio, referencia válida a `api`, shapes de `query`/`body`/`headers`/`filename`/`onSuccess`/`onError`).
- Si `link.props.iconPosition` toma un valor fuera del enum cerrado (`"left" | "right"`), el config completo se rechaza antes del render con código `invalid-layout` y ruta exacta.
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Acciones `executeOperation`, `executeOperations`, `resetForm`, `openModal`, `closeModal`: no aplican a `link`.
- Estilos visuales del estado deshabilitado de `downloadOperation` en `link`: solo se aplica `aria-disabled`, sin cambio visual asociado.
- `link` sin `action` no actúa como submit implícito dentro de `form`.
- `link` no puede ser nodo raíz de `form.submitAction`.
- Inyección automática de `rel="noopener noreferrer"` cuando `target="_blank"`.
- Theming o variantes visuales configurables en el propio anchor (con o sin `children`).
- Configuración avanzada de `rel` u otros atributos del anchor.
- Nodos interactivos o estructurales dentro de `children`: `button`, `form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `modal`, `file-manager`, `tabs`, `accordion`, `repeater`, o anidamiento de `link`.
