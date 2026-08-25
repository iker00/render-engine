> Cuándo leer: si la tarea toca un nodo concreto del catálogo. Carga solo la ficha del nodo afectado, no este índice entero.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../runtime/design-tokens.md]].

# Catálogo de nodos

Una ficha por nodo soportado. Cada ficha cubre contrato (props), reglas de render, validación específica y límites del nodo.

Los conceptos transversales (`visibility`, `queryStateFeedback`, referencias dinámicas, interpolación `{{...}}`) viven en [`../references/`](../references/index.md).

## Nodos estructurales

| Nodo | Cuándo leer la ficha |
|---|---|
| [container.md](./container.md) | Layouts con `direction`, `gap`, `columns` fijo o responsive, `variant: card`, `align`, `justify`, `wrap`, `layout.span`. |
| [repeater.md](./repeater.md) | Repetición de subárbol por item de colección, `props.items.source`, `props.items.key`, paginación local con variantes `previousNext`/`numbered`/`scroll`, modo grid propio (`props.columns`/`gap`/`align`/`justify`). |
| [tabs.md](./tabs.md) | Paneles navegables por pestañas, `props.items` (label + children + visibilidad por item), `props.orientation` (`horizontal\|vertical`), `props.defaultTab`, estado local del tab activo, selección automática de primer tab visible. |
| [accordion.md](./accordion.md) | Sección colapsable con cabecera interactiva, `props.label`, `props.defaultOpen`, `props.groupId` para coordinación de grupos, children libres, accesibilidad ARIA. |

## Nodos hoja visibles

| Nodo | Cuándo leer la ficha |
|---|---|
| [heading-paragraph-list.md](./heading-paragraph-list.md) | `heading`, `paragraph`, `list` — nodos visuales simples con texto e items. |
| [image.md](./image.md) | `<img>` declarativo, degradación cuando `src` o `alt` no resuelven. |
| [table.md](./table.md) | Tablas semánticas de lectura, `headers`/`rows`/`columns`, filtros locales por columna, ordenación local, paginación local. |
| [button.md](./button.md) | `button` y catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `resetForm`, `openModal`, `closeModal`). |
| [link.md](./link.md) | `link` — enlace declarativo como `<a>`, con `props.href` para URLs externas/descargas o `props.action` (`navigateTo`/`goBack`) para navegación interna. Contenido: texto simple (`props.label`) o árbol de nodos (`children`). |
| [badge.md](./badge.md) | `badge` — etiqueta visual compacta con variante `pill` o `circle` y paleta semántica cerrada de seis colores. |
| [alert.md](./alert.md) | `alert` — bloque de aviso semántico con icono placeholder, cabecera opcional (`props.title`) y mensaje obligatorio (`props.message`), paleta semántica de seis tipos. |
| [stat.md](./stat.md) | `stat` — métrica o KPI con cabecera descriptiva (`props.label`) y valor principal (`props.value`), tres variantes: `accent` (borde lateral de color), `tinted` (fondo suave) y `plain` (sin borde ni fondo, texto neutro), paleta semántica de seis colores. |
| [divider.md](./divider.md) | `divider` — separador visual horizontal con cuatro variantes: `solid` (línea continua), `dashed` (línea discontinua), `dotted` (línea punteada), `invisible` (espaciador sin línea). No acepta `children` ni etiqueta. |
| [skeleton.md](./skeleton.md) | `skeleton` — placeholder de carga con forma de silueta, tres variantes: `rect` (rectángulo), `text` (líneas apiladas), `circle` (círculo). Soporta animación pulse y uso primario en `queryStateFeedback.states.loading.fallback`. |
| [map.md](./map.md) | `map` — mapa `Leaflet` con centro/zoom/altura configurables, marcadores estáticos (`props.markers`) o derivados de una colección `queries.*` (`props.markerSources`) con paleta cíclica de color por fuente, popup por marcador. Componente cargado de forma diferida (code-splitting propio). |

## Nodos modales

| Nodo | Cuándo leer la ficha |
|---|---|
| [modal.md](./modal.md) | `modal` como ventana flotante, `props.size`, `props.defaultOpen`, acciones `openModal`/`closeModal`, comportamiento en `repeater.props.template`. |

## Nodos de formulario

| Nodo | Cuándo leer la ficha |
|---|---|
| [form.md](./form.md) | `form` como contenedor, `submitAction`, `persistOnUnmount`, `resetOnSuccess`, niños permitidos. |
| [steps.md](./steps.md) | `steps` — formulario en pasos secuenciales (wizard), exclusivo dentro de `form`, navegación gateada por validación al pulsar "Siguiente", retroceso libre, tres variantes visuales (`horizontal`/`vertical`/`progress`), inicialización lazy por paso, botones de navegación autogenerados. |
| [input.md](./input.md) | `input` con catálogo de `inputType`, validaciones aplicables, `defaultValue`. |
| [textarea.md](./textarea.md) | Entrada multilínea. |
| [select.md](./select.md) | Selección simple o múltiple, shapes de `items` manuales o dinámicos. |
| [choice-groups.md](./choice-groups.md) | `radioGroup` y `checkboxGroup`, `optionLayout: vertical | inline`. |
| [toggle.md](./toggle.md) | `toggle` — interruptor booleano on/off con `labelPosition` (`top`/`inline`), `required` exige `true`, valor boolean en store y payload. |
| [hidden.md](./hidden.md) | `hidden` — campo sin render que aporta un valor fijo o dinámico al payload del submit, inicialización no lazy, no participa en validación ni en `visibility`. |
| [file-input.md](./file-input.md) | Selector de ficheros dentro de formulario, preview inmediata, validaciones client-side, serialización JSON+base64 en submit como campo referenciable. |

## Nodos de gestión de ficheros

| Nodo | Cuándo leer la ficha |
|---|---|
| [file-manager.md](./file-manager.md) | Subida DnD o selector nativo, lista paginada, operaciones configurables (`getOperation`, `uploadOperation`, `deleteOperation`, `viewOperation`, `downloadOperation`), validaciones client-side de ficheros, normalización de nombre. |

## Reglas estructurales transversales del catálogo
- `heading`, `paragraph`, `list`, `image`, `table`, `button`, `badge`, `alert`, `stat` y `divider` son nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- `link` acepta `children` como alternativa a `props.label`: ambos campos son mutuamente excluyentes y obligatorio declarar uno.
- `repeater` rechaza `children` y solo admite repetición a través de `props.template`.
- `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle` y `hidden` solo son válidos como descendientes de un `form`.
- `steps` también solo es válido como descendiente de un `form`, a pesar de ser un nodo estructural (con `props.items[i].children`) y no un nodo hoja de campo — a diferencia de `tabs` y `accordion`, que sí son válidos fuera de `form`.
- `button` sin `action` solo es válido como descendiente de un `form` (actúa como submit implícito).
- `hidden` no soporta `visibility`, `queryStateFeedback` ni `layout.span`; si declara `visibility` o `queryStateFeedback`, el config se rechaza.
- Cualquier nodo soportado (excepto `hidden`) puede declarar `node.layout.span`, `node.visibility` y `node.queryStateFeedback` siguiendo las reglas transversales documentadas en [`../references/`](../references/index.md).
- Cualquier nodo soportado puede combinar `queryStateFeedback` y `visibility`; si ambos existen, el runtime resuelve primero `queryStateFeedback` y solo evalúa `visibility` cuando la rama principal sigue visible.
- `props.required` deja de formar parte del contrato soportado; la obligatoriedad solo se declara desde `props.validations.required`.
