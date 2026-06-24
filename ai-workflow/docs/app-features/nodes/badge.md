> Cuándo leer: si la tarea toca el nodo `badge` — etiqueta visual compacta con variantes `pill` y `circle` y paleta semántica cerrada.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `badge`

Nodo hoja de presentación pura que renderiza una etiqueta visual compacta. Soporta dos variantes de estilo (`pill` y `circle`) y una paleta semántica cerrada de seis colores. No es interactivo ni acepta acciones.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.label` | `string` | sí | — | Texto visible del badge. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.variant` | `"pill" \| "circle"` | no | `"pill"` | Estilo visual del badge. |
| `props.color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Color semántico aplicado. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el badge no se renderiza.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Variante `pill`

Renderiza un `<span data-layout-node="badge">` con una etiqueta compacta de forma redondeada (`rounded-full`). El fondo y el texto usan colores suaves y marcados derivados del color semántico declarado en `@theme` de `src/app/index.css`:

| Color | Fondo | Texto |
|---|---|---|
| `neutral` | `bg-neutral-100` | `text-neutral-700` |
| `primary` | `bg-primary-100` | `text-primary-700` |
| `success` | `bg-success-100` | `text-success-700` |
| `warning` | `bg-warning-100` | `text-warning-700` |
| `danger` | `bg-danger-100` | `text-danger-700` |
| `info` | `bg-info-100` | `text-info-700` |

## Variante `circle`

Renderiza un `<span data-layout-node="badge">` con un círculo de color sólido a la izquierda del texto. El círculo usa `h-2 w-2 rounded-full`. El texto aparece a la derecha en color heredado del tema base:

| Color | Clase del círculo |
|---|---|
| `neutral` | `bg-neutral-500` |
| `primary` | `bg-primary-500` |
| `success` | `bg-success-500` |
| `warning` | `bg-warning-500` |
| `danger` | `bg-danger-500` |
| `info` | `bg-info-500` |

## Comportamiento de render

- Se renderiza siempre con `data-layout-node="badge"`.
- `props.variant` y `props.color` se aplican con sus valores por defecto (`pill` y `neutral`) si no se declaran.
- `props.label` se resuelve como referencia de texto dinámica con `resolveRuntimeTextReference`, igual que en `heading`, `paragraph` y `list`.
- El nodo es hoja: si recibe `children` en la configuración, esos datos no pasan al resultado normalizado.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.

## Casos límite

- **`props.label` con placeholder no resuelto**: el placeholder se vacía en producción; en desarrollo se muestra la clave. Comportamiento estándar del runtime.
- **`props.label` vacío**: el badge se renderiza sin texto visible. No es un error de render.
- **`badge` dentro de `repeater` con `item.*` en `label`**: resuelve el valor por iteración, igual que en cualquier otro nodo textual.
- **`badge` dentro de `form`**: válido. No participa en validación ni submit del formulario; es un nodo de presentación sin relación con los campos del form.
- **`badge` con `children` declarados**: los hijos no se procesan (regla de nodo hoja).

## Validación previa al render

- `props.label` ausente o no string: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.label`.
- `props.variant` con valor fuera de `["pill", "circle"]`: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `props.color` con valor fuera de la paleta semántica: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.color`.
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Iconos, imágenes o contenido arbitrario dentro del badge.
- Colores libres fuera de la paleta semántica definida.
- Badge interactivo o con acción (no es un botón).
- Uso de `badge` como tipo permitido en celdas ricas de `table`.
- Tamaños configurables.
- Theming o tokens visuales configurables por JSON.
