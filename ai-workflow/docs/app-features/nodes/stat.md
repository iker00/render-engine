> Cuándo leer: si la tarea toca el nodo `stat` — métrica o KPI con cabecera descriptiva y valor principal, variantes `accent` y `tinted`, paleta semántica cerrada.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `stat`

Nodo hoja de presentación pura que renderiza una métrica o KPI con una cabecera descriptiva (`label`) y un valor principal (`value`). Soporta dos variantes de estilo (`accent` y `tinted`) y una paleta semántica cerrada de seis colores. No es interactivo ni acepta acciones.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.label` | `string` | sí | — | Texto de cabecera descriptivo. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.value` | `string` | sí | — | Valor principal a mostrar. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |
| `props.icon` | `string` | no | — | Nombre del icono Lucide React (ej. `"TrendingUp"`). Se renderiza a la izquierda del bloque label/value. Si el nombre no resuelve, se ignora silenciosamente. |
| `props.variant` | `"accent" \| "tinted"` | no | `"accent"` | Estilo visual del stat. |
| `props.color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Color semántico aplicado. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el stat no se renderiza.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Variante `accent`

Renderiza un `<div data-layout-node="stat">` con un borde lateral izquierdo (`border-l-4`) de color sólido derivado del color semántico. El fondo es neutro (sin tinte de color). `label` aparece en texto muted; `value` en texto prominente y negrita en color neutro del tema:

| Color | Borde izquierdo |
|---|---|
| `neutral` | `border-neutral-500` |
| `primary` | `border-primary-500` |
| `success` | `border-success-500` |
| `warning` | `border-warning-500` |
| `danger` | `border-danger-500` |
| `info` | `border-info-500` |

Los shades del borde coinciden con la paleta sólida de la variante `circle` del nodo `badge`.

## Variante `tinted`

Renderiza un `<div data-layout-node="stat">` con fondo de color suave derivado del color semántico. `label` y `value` usan clases de texto del mismo tono semántico, con `value` en texto más marcado y negrita:

| Color | Fondo | Texto de `label` | Texto de `value` |
|---|---|---|---|
| `neutral` | `bg-neutral-100` | `text-neutral-600` | `text-neutral-800 font-bold` |
| `primary` | `bg-primary-100` | `text-primary-600` | `text-primary-800 font-bold` |
| `success` | `bg-success-100` | `text-success-600` | `text-success-800 font-bold` |
| `warning` | `bg-warning-100` | `text-warning-600` | `text-warning-800 font-bold` |
| `danger` | `bg-danger-100` | `text-danger-600` | `text-danger-800 font-bold` |
| `info` | `bg-info-100` | `text-info-600` | `text-info-800 font-bold` |

## Comportamiento de render

- Se renderiza siempre con `data-layout-node="stat"`.
- `props.variant` y `props.color` se aplican con sus valores por defecto (`accent` y `neutral`) si no se declaran.
- `props.label` y `props.value` se resuelven con `resolveRuntimeTextReference`, igual que en `heading`, `paragraph` y `badge`.
- El nodo es hoja: si recibe `children` en la configuración, esos datos no pasan al resultado normalizado.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Implementado con utilidades de Tailwind CSS; sin estilos inline.

## Casos límite

- **`props.label` con placeholder no resuelto**: el placeholder se vacía en producción; en desarrollo se muestra la clave. Comportamiento estándar del runtime.
- **`props.value` con placeholder no resuelto**: igual que `label`.
- **`props.label` vacío**: el stat se renderiza sin texto de cabecera visible. No es un error de render.
- **`props.value` vacío**: el stat se renderiza sin texto de valor visible. No es un error de render.
- **`stat` dentro de `repeater` con `item.*` en `value`**: resuelve el valor por iteración, igual que en cualquier otro nodo textual.
- **`stat` dentro de `form`**: válido. No participa en validación ni submit del formulario; es un nodo de presentación sin relación con los campos del form.
- **`stat` con `children` declarados**: los hijos no se procesan (regla de nodo hoja).

## Validación previa al render

- `props.label` ausente o no string: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.label`.
- `props.value` ausente o no string: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.value`.
- `props.variant` con valor fuera de `["accent", "tinted"]`: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `props.color` con valor fuera de la paleta semántica: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.color`.
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Indicador de tendencia (trend indicator) dentro del stat.
- Colores libres fuera de la paleta semántica definida.
- Tamaño o color del icono configurable por JSON (se heredan del color semántico del stat).
- Stat interactivo o con acción (no es un botón).
- Tamaños configurables del valor.
- Theming o tokens visuales configurables por JSON.
- Subtítulo, descripción adicional o cualquier elemento de texto más allá de `label` y `value`.
