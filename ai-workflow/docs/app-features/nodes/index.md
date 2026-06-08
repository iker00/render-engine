> Cuándo leer: si la tarea toca un nodo concreto del catálogo. Carga solo la ficha del nodo afectado, no este índice entero.
> Tamaño: corto.
> Relacionados: [[../config/structure.md]], [[../references/visibility.md]], [[../references/query-state-feedback.md]].

# Catálogo de nodos

Una ficha por nodo soportado. Cada ficha cubre contrato (props), reglas de render, validación específica y límites del nodo.

Los conceptos transversales (`visibility`, `queryStateFeedback`, referencias dinámicas, interpolación `{{...}}`) viven en [`../references/`](../references/index.md).

## Nodos estructurales

| Nodo | Cuándo leer la ficha |
|---|---|
| [container.md](./container.md) | Layouts con `direction`, `gap`, `columns` fijo o responsive, `variant: card`, `align`, `justify`, `wrap`, `layout.span`. |
| [repeater.md](./repeater.md) | Repetición de subárbol por item de colección, `props.items.source`, `props.items.key`, paginación local con variantes `previousNext`/`numbered`/`scroll`. |
| [tabs.md](./tabs.md) | Paneles navegables por pestañas, `props.items` (label + children + visibilidad por item), `props.orientation` (`horizontal\|vertical`), `props.defaultTab`, estado local del tab activo, selección automática de primer tab visible. |
| [accordion.md](./accordion.md) | Sección colapsable con cabecera interactiva, `props.label`, `props.defaultOpen`, `props.groupId` para coordinación de grupos, children libres, accesibilidad ARIA. |

## Nodos hoja visibles

| Nodo | Cuándo leer la ficha |
|---|---|
| [heading-paragraph-list.md](./heading-paragraph-list.md) | `heading`, `paragraph`, `list` — nodos visuales simples con texto e items. |
| [image.md](./image.md) | `<img>` declarativo, degradación cuando `src` o `alt` no resuelven. |
| [table.md](./table.md) | Tablas semánticas de lectura, `headers`/`rows`/`columns`, filtros locales por columna, ordenación local, paginación local. |
| [button.md](./button.md) | `button` y catálogo de acciones (`navigateTo`, `goBack`, `executeOperation`, `resetForm`, `openModal`, `closeModal`). |
| [link.md](./link.md) | `link` — enlace declarativo como `<a>`, con `props.href` para URLs externas/descargas o `props.action` (`navigateTo`/`goBack`) para navegación interna. |
| [badge.md](./badge.md) | `badge` — etiqueta visual compacta con variante `pill` o `circle` y paleta semántica cerrada de seis colores. |
| [alert.md](./alert.md) | `alert` — bloque de aviso semántico con icono placeholder, cabecera opcional (`props.title`) y mensaje obligatorio (`props.message`), paleta semántica de seis tipos. |
| [stat.md](./stat.md) | `stat` — métrica o KPI con cabecera descriptiva (`props.label`) y valor principal (`props.value`), variantes `accent` (borde lateral de color) y `tinted` (fondo suave), paleta semántica de seis colores. |
| [divider.md](./divider.md) | `divider` — separador visual horizontal con cuatro variantes: `solid` (línea continua), `dashed` (línea discontinua), `dotted` (línea punteada), `invisible` (espaciador sin línea). No acepta `children` ni etiqueta. |
| [skeleton.md](./skeleton.md) | `skeleton` — placeholder de carga con forma de silueta, tres variantes: `rect` (rectángulo), `text` (líneas apiladas), `circle` (círculo). Soporta animación pulse y uso primario en `queryStateFeedback.states.loading.fallback`. |

## Nodos modales

| Nodo | Cuándo leer la ficha |
|---|---|
| [modal.md](./modal.md) | `modal` como ventana flotante, `props.size`, `props.defaultOpen`, acciones `openModal`/`closeModal`, comportamiento en `repeater.props.template`. |

## Nodos de formulario

| Nodo | Cuándo leer la ficha |
|---|---|
| [form.md](./form.md) | `form` como contenedor, `submitAction`, `persistOnUnmount`, `resetOnSuccess`, niños permitidos. |
| [input.md](./input.md) | `input` con catálogo de `inputType`, validaciones aplicables, `defaultValue`. |
| [textarea.md](./textarea.md) | Entrada multilínea. |
| [select.md](./select.md) | Selección simple o múltiple, shapes de `items` manuales o dinámicos. |
| [choice-groups.md](./choice-groups.md) | `radioGroup` y `checkboxGroup`, `optionLayout: vertical | inline`. |

## Reglas estructurales transversales del catálogo
- `heading`, `paragraph`, `list`, `image`, `table`, `button`, `link`, `badge`, `alert`, `stat` y `divider` son nodos hoja; si reciben `children`, esos datos no pasan al resultado normalizado.
- `repeater` rechaza `children` y solo admite repetición a través de `props.template`.
- `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup` solo son válidos como descendientes de un `form`.
- `button` sin `action` solo es válido como descendiente de un `form` (actúa como submit implícito).
- Cualquier nodo soportado puede declarar `node.layout.span`, `node.visibility` y `node.queryStateFeedback` siguiendo las reglas transversales documentadas en [`../references/`](../references/index.md).
- Cualquier nodo soportado puede combinar `queryStateFeedback` y `visibility`; si ambos existen, el runtime resuelve primero `queryStateFeedback` y solo evalúa `visibility` cuando la rama principal sigue visible.
- `props.required` deja de formar parte del contrato soportado; la obligatoriedad solo se declara desde `props.validations.required`.
