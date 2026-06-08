# Spec — 0066 Nodo `skeleton`

## Objetivo

Añadir un nodo hoja `skeleton` al catálogo del runtime para que el autor del JSON pueda declarar explícitamente placeholders de carga con forma de silueta. El caso de uso primario es colocarlo dentro de `queryStateFeedback.states.loading.fallback`, replicando la silueta de la UI real mientras la query está en curso.

## Alcance

- Nuevo nodo hoja `skeleton` con props `variant`, `lines`, `width`, `height`, `rounded` y `animate`.
- Tres variantes de forma: `text` (líneas de texto apiladas), `rect` (rectángulo), `circle` (círculo).
- Animación pulse configurable mediante la clase `animate-pulse` de Tailwind.
- No introduce cambios en el motor del runtime ni en el mecanismo `queryStateFeedback`.
- Integración transversal estándar: `visibility`, `queryStateFeedback` y `layout.span`.
- Alta en el schema del editor Monaco (`dev-runtime-json-schema`) para autocompletado en desarrollo.
- Tests de validación y render.

## Fuera de alcance

- Generación automática de skeletons a partir de la estructura de la UI real.
- Variantes de animación distintas de pulse (shimmer, wave, gradiente animado).
- Paleta semántica de color o theming declarativo.
- Estrechamiento automático de la última línea en `variant: text`.
- Tamaños responsive por breakpoint en `width` o `height`.
- `children` declarados — el nodo es hoja; los ignora silenciosamente si se declaran.

## Props

| Prop | Tipo | Requerido | Default | Notas |
|---|---|---|---|---|
| `props.variant` | `"text" \| "rect" \| "circle"` | no | `"rect"` | Controla la forma del placeholder. |
| `props.lines` | entero ≥ 1 | no | `1` | Número de líneas. Solo aplica a `text`; se ignora en `rect` y `circle`. |
| `props.width` | string (sufijo de escala Tailwind) | no | — | Se aplica como `w-{value}` (`"32"` → `w-32`, `"full"` → `w-full`, `"1/2"` → `w-1/2`). Aplica a `rect` y `text`; en `circle` controla también la altura. |
| `props.height` | string (sufijo de escala Tailwind) | no | — | Se aplica como `h-{value}`. Solo aplica a `rect`; se ignora en `circle` (usa `width`) y en `text` (altura por línea fija). |
| `props.rounded` | boolean | no | `false` | `true` añade `rounded` en `rect` y `text`. En `circle` se ignora; el círculo siempre usa `rounded-full`. |
| `props.animate` | boolean | no | `true` | `true` añade `animate-pulse` al bloque skeleton. `false` desactiva la animación. |

## Comportamiento de render por variante

### `variant: rect` (default)

- Renderiza un único bloque con fondo neutro apagado.
- Anchura: `w-{props.width}` si se declara; si no, el elemento ocupa el ancho de su contenedor.
- Altura: `h-{props.height}` si se declara; si no, se aplica una altura por defecto predefinida equivalente a un elemento de bloque estándar.
- Redondeo: `rounded` si `props.rounded: true`, ninguno si `false`.

### `variant: text`

- Renderiza `props.lines` bloques horizontales apilados, con un gap uniforme entre ellos.
- Cada línea tiene una altura fija reducida, representativa de una línea de texto.
- Anchura por línea: `w-{props.width}` si se declara; si no, `w-full`.
- `props.height` se ignora; la altura por línea es fija.
- Redondeo: `rounded` aplicado a cada línea si `props.rounded: true`.

### `variant: circle`

- Renderiza un único bloque circular con `rounded-full`.
- Tanto la anchura como la altura se derivan de `props.width`: `w-{props.width} h-{props.width}`.
- Si `props.width` no se declara, se aplica un tamaño por defecto predefinido (círculo mediano).
- `props.height` se ignora.
- `props.rounded` se ignora; el círculo siempre usa `rounded-full`.

## Criterios de aceptación

1. Un nodo `skeleton` sin props renderiza un rectángulo con fondo neutro, tamaño por defecto y animación pulse activa.
2. `variant: "text"` con `lines: 3` renderiza 3 bloques de línea apilados verticalmente con gap.
3. `variant: "circle"` con `width: "12"` renderiza un círculo de 12 unidades de ancho y alto (`w-12 h-12 rounded-full`).
4. `props.animate: false` suprime `animate-pulse` del elemento renderizado.
5. `props.width: "32"` añade `w-32` al skeleton `rect` o `text`.
6. `props.height: "8"` añade `h-8` al skeleton `rect`.
7. `props.rounded: true` añade `rounded` a `rect` y a cada línea de `text`.
8. `circle` usa siempre `rounded-full` independientemente de `props.rounded`.
9. `props.height` no tiene efecto en `circle` ni en `text`.
10. `props.lines` no tiene efecto en `rect` ni en `circle`.
11. Un `skeleton` con `variant` fuera del catálogo cerrado es rechazado por la validación antes del render, con diagnóstico de ruta.
12. Un `skeleton` con `lines: 0` o valor negativo es rechazado por la validación antes del render.
13. `skeleton` colocado dentro de `queryStateFeedback.states.loading.fallback` renderiza correctamente y el motor no lo trata de forma diferente a cualquier otro nodo en fallback.
14. `skeleton` puede colocarse en cualquier posición del layout fuera de un contexto de fallback y renderiza igual.
15. `skeleton` soporta `visibility`, `queryStateFeedback` y `layout.span` con las mismas reglas transversales que el resto del catálogo.
16. El editor Monaco en modo desarrollo ofrece autocompletado para el tipo `skeleton` y sus props.

## Casos límite

- **`variant` ausente** → se usa `"rect"` sin error.
- **`lines` ausente en `text`** → se renderiza 1 línea.
- **`lines` declarado en `rect` o `circle`** → se ignora sin error de validación.
- **`height` declarado en `circle` o `text`** → se ignora sin error de validación.
- **`rounded: true` en `circle`** → se ignora; el comportamiento visual no cambia.
- **`animate` ausente** → se usa `true`; la animación pulse está activa por defecto.
- **`width` y `height` ausentes** → no se añade clase de dimensión; el elemento ocupa el espacio que le da su contenedor y su variante determina el tamaño por defecto cuando no hay contenedor que lo acote.
- **`children` declarados** → se descartan silenciosamente sin error de runtime.
- **`lines: 1` con `variant: text`** → renderiza un único bloque horizontal, visualmente similar a `variant: rect`.
- **`skeleton` dentro de `repeater.props.template`** → se repite una vez por ítem, igual que cualquier otro nodo hoja.
- **`skeleton` con `layout.span`** → se envuelve en el `div` col-span cuando hay `parentGridColumns` activo.

## Áreas de producto afectadas

- Catálogo de nodos del runtime.
- Capa de validación de configuración (`src/config/`).
- Schema del editor Monaco para desarrollo (`dev-runtime-json-schema`).

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md` — nueva entrada en el catálogo de nodos hoja.
- `ai-workflow/docs/app-features/nodes/skeleton.md` — ficha nueva del nodo.

## Riesgos o preguntas abiertas

Ninguno. Todas las decisiones bloqueantes están resueltas.
