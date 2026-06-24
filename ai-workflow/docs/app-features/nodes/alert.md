> Cuándo leer: si la tarea toca el nodo `alert` — bloque de aviso semántico con icono Lucide por tipo, cabecera opcional y mensaje.
> Tamaño: medio.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `alert`

Nodo hoja de presentación pura que renderiza un bloque horizontal de aviso con icono Lucide semántico fijo por tipo, cabecera opcional y texto de mensaje. Soporta una paleta semántica cerrada de seis tipos. No es interactivo ni acepta acciones.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.type` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Tipo semántico que determina el color de fondo/acento y el icono placeholder. |
| `props.title` | `string` | no | — | Cabecera del alert. Se renderiza en negrita sobre el mensaje. Admite interpolación `{{...}}`. |
| `props.message` | `string` | sí | — | Texto del mensaje. Admite literal, referencia dinámica completa o interpolación `{{...}}`. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el alert no se renderiza.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Paleta de colores y icono placeholder

Renderiza un `<div data-layout-node="alert">` con layout horizontal `flex items-start`. Los colores usan el mismo sistema de shades que `badge` en variante `pill`, desde tokens semánticos declarados en `@theme`:

| Tipo | Fondo | Texto/acento |
|---|---|---|
| `neutral` | `bg-neutral-100` | `text-neutral-700` |
| `primary` | `bg-primary-100` | `text-primary-700` |
| `success` | `bg-success-100` | `text-success-700` |
| `warning` | `bg-warning-100` | `text-warning-700` |
| `danger` | `bg-danger-100` | `text-danger-700` |
| `info` | `bg-info-100` | `text-info-700` |

El icono se selecciona automáticamente según `props.type` y se renderiza con la librería `lucide-react`:

| Tipo | Icono Lucide |
|---|---|
| `neutral` | `MessageCircle` |
| `primary` | `Megaphone` |
| `success` | `CheckCircle` |
| `warning` | `AlertTriangle` |
| `danger` | `XCircle` |
| `info` | `Info` |

El icono se renderiza como `<svg>` con la clase de acento del tipo (`text-{color}-700`), tamaño `size-5` y atributo `aria-hidden="true"`.

## Estructura visual

El bloque se compone de un contenedor horizontal con dos zonas:

1. **Zona de icono** — `<span>` con la clase de acento del tipo y el texto `icon`.
2. **Zona de contenido** — `<div>` que adopta dos estructuras según `props.title`:

   **Con `props.title` presente y no vacío:**
   - La zona de contenido es una columna vertical (`flex-col`) que ocupa el ancho restante (`flex-1`):
     - Fila superior: `<strong>` con `props.title` resuelto, en el color de acento del tipo.
     - Fila inferior: `<span>` con `props.message` resuelto.

   **Sin `props.title` (ausente o string vacío):**
   - La zona de contenido es un `<span>` simple con `props.message` resuelto (layout clásico de una fila).

## Comportamiento de render

- Se renderiza siempre con `data-layout-node="alert"` en un contenedor horizontal (`flex items-start`).
- `props.type` usa `"neutral"` como default si no se declara.
- Cuando `props.title` está presente y no es string vacío tras la resolución:
  - La zona de contenido se renderiza como `<div className="flex flex-col flex-1">`.
  - Contiene un `<strong>` con el título resuelto (en el color de acento del tipo) y un `<span>` con el mensaje debajo.
- Cuando `props.title` está ausente o es string vacío:
  - La zona de contenido se renderiza como un `<span>` simple.
  - Contiene el mensaje resuelto (layout clásico de una fila).
- `props.message` y `props.title` se resuelven con `resolveRuntimeTextReference`, igual que en otros nodos textuales del catálogo.
- El nodo es hoja: si recibe `children` en la configuración, esos datos no pasan al resultado normalizado.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Implementado con utilidades de Tailwind CSS; sin estilos inline.

## Casos límite

- **`props.message` con placeholder no resuelto**: el placeholder se vacía en producción; en desarrollo se muestra la clave. Comportamiento estándar del runtime.
- **`props.message` vacío**: el alert se renderiza sin texto de mensaje visible. No es un error de render.
- **`props.title` con placeholder no resuelto**: en producción el `<strong>` se renderiza con texto vacío; en desarrollo muestra la clave. El alert en conjunto no falla en render.
- **`props.title` vacío (string `""`)**: se comporta visualmente como si no hubiera cabecera declarada; el `<strong>` no aparece en el DOM.
- **`alert` dentro de `repeater` con `item.*` en `message` o `title`**: resuelve el valor por iteración, igual que en cualquier otro nodo textual.
- **`alert` dentro de `form`**: válido. No participa en validación ni submit del formulario; no produce entradas en `state.forms[formId]`.
- **`alert` con `children` declarados**: los hijos no se procesan (regla de nodo hoja).

## Validación previa al render

- `props.message` ausente o no string: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.message`.
- `props.type` con valor fuera de `["neutral", "primary", "success", "warning", "danger", "info"]`: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.type`.
- `props.title` presente pero no string: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.title`.
- `visibility`, `queryStateFeedback` y `layout.span` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Icono configurable o intercambiable por JSON (el icono lo fija el tipo).
- Colores libres fuera de la paleta semántica definida.
- Alert interactivo o con acción (no es un botón ni un banner con cierre).
- Variantes de estilo adicionales más allá del bloque de aviso estándar.
- Tamaños configurables.
- Theming o tokens visuales configurables por JSON.
- Contenido arbitrario (children, imágenes, formularios embebidos).
- Uso de `alert` como tipo permitido en celdas ricas de `table`.
