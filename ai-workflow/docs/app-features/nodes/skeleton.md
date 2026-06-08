> Cuándo leer: si la tarea toca el nodo `skeleton` — placeholders de carga con forma de silueta.
> Tamaño: corto.
> Relacionados: [[../references/visibility.md]], [[../references/query-state-feedback.md]], [[../config/validation.md]].

# Nodo `skeleton`

Nodo hoja declarativo que renderiza placeholders de carga en forma de silueta. Soporta tres variantes visuales (`rect`, `text`, `circle`) para replicar la estructura de la UI final mientras se carga. No acepta `children` y no es interactivo.

El caso de uso primario es colocarlo dentro de `queryStateFeedback.states.loading.fallback` para mostrar una silueta animada durante una carga.

## Props

| Prop | Tipo | Requerido | Default | Descripción |
|---|---|---|---|---|
| `props.variant` | `"rect" \| "text" \| "circle"` | no | `"rect"` | Forma del placeholder. |
| `props.lines` | entero ≥ 1 | no | `1` | Número de líneas. Solo aplica a `variant: "text"`; se ignora en otras variantes. |
| `props.width` | string (sufijo Tailwind) | no | — | Anchura como `w-{value}` (`"32"` → `w-32`, `"full"` → `w-full`, `"1/2"` → `w-1/2`). Aplica a `rect` y `text`. En `circle`, controla también la altura. |
| `props.height` | string (sufijo Tailwind) | no | — | Altura como `h-{value}`. Solo aplica a `rect`; se ignora en `circle` y `text`. |
| `props.rounded` | boolean | no | `false` | `true` añade `rounded`. En `circle` se ignora; el círculo usa siempre `rounded-full`. |
| `props.animate` | boolean | no | `true` | `true` añade `animate-pulse`. `false` desactiva la animación. |

## Campos transversales

- `visibility`: oculta o muestra el nodo. Si evalúa como oculto, el skeleton no ocupa espacio.
- `queryStateFeedback`: sustituye el nodo por el feedback correspondiente cuando el estado de la query no es la rama principal.
- `layout.span`: ocupa columnas dentro de un `container` con `columns` activo.

## Variantes visuales

El comportamiento de render depende de `props.variant`:

### `rect` (default)

Se renderiza como un único bloque rectangular:
- Clases base: `bg-gray-200 block`
- Anchura: `w-{props.width}` si se declara; ninguna si no.
- Altura: `h-{props.height}` si se declara; `h-4` por defecto.
- Redondeo: `rounded` si `props.rounded === true`.
- Animación: `animate-pulse` salvo que `props.animate === false`.

Ejemplo: `{ type: 'skeleton', props: { width: '32', height: '8', rounded: true } }` renderiza un rectángulo con `w-32 h-8 rounded animate-pulse`.

### `text`

Se renderiza como un wrapper que contiene `props.lines` bloques apilados:
- Wrapper: `flex flex-col gap-2` + `animate-pulse` salvo que `props.animate === false`.
- Cada línea: `bg-gray-200 h-3` + `w-{props.width}` si se declara o `w-full` si no + `rounded` si `props.rounded === true`.
- `props.height` se ignora (altura por línea es fija).

Ejemplo: `{ type: 'skeleton', props: { variant: 'text', lines: 3, width: '1/2' } }` renderiza 3 líneas de skeleton de media anchura.

### `circle`

Se renderiza como un único bloque circular:
- Clases base: `bg-gray-200 rounded-full`
- Dimensiones: `w-{props.width} h-{props.width}` si `props.width` se declara; `w-12 h-12` por defecto (círculo mediano).
- `props.rounded` y `props.height` se ignoran.
- Animación: `animate-pulse` salvo que `props.animate === false`.

Ejemplo: `{ type: 'skeleton', props: { variant: 'circle', width: '20', animate: false } }` renderiza un círculo estático de tamaño `w-20 h-20`.

## Comportamiento de render

- Se renderiza siempre con `data-layout-node="skeleton"`.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Implementado con utilidades de Tailwind CSS; sin estilos inline.
- El nodo es hoja: si recibe `children` en la configuración, esos datos son descartados silenciosamente por el normalizador sin error de runtime.

## Caso de uso: feedback de carga en queries

Cuando una query declarada en `queryStateFeedback` está en estado `loading`, es común renderizar un skeleton en lugar de mostrar la rama principal vacía. El runtime ejecuta el nodo skeleton como parte del fallback:

```json
{
  "type": "container",
  "children": [
    {
      "type": "heading",
      "props": { "text": "User Profile" }
    }
  ],
  "queryStateFeedback": {
    "query": "fetchUser",
    "states": {
      "loading": {
        "fallback": [
          { "type": "skeleton", "props": { "variant": "text", "lines": 2 } }
        ]
      }
    }
  }
}
```

## Casos límite

- **`props.variant` ausente**: se usa `"rect"` sin error.
- **`props.lines` ausente en `text`**: se renderiza 1 línea.
- **`props.lines` declarado en `rect` o `circle`**: se ignora sin error de validación.
- **`props.height` declarado en `circle` o `text`**: se ignora sin error de validación.
- **`props.rounded` en `circle`**: se ignora; `rounded-full` no cambia.
- **`props.animate` ausente**: se usa `true`; animación pulse activa por defecto.
- **`props.width` y `props.height` ausentes**: no se añade clase de dimensión; el elemento adopta el tamaño de su contenedor.
- **`children` declarados**: se descartan silenciosamente; el nodo `skeleton` no los renderiza.
- **`skeleton` dentro de `repeater.props.template`**: se repite una vez por item, igual que cualquier otro nodo hoja.
- **`skeleton` con `layout.span`**: se envuelve en el `div` con `col-span-*` cuando hay `parentGridColumns` activo en el renderer.

## Validación previa al render

- `props.variant` con valor fuera de `["rect", "text", "circle"]`: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.variant`.
- `props.lines` no es entero o es menor que 1: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.props.lines`.
- `props.width` o `props.height` no son string: el config se rechaza con `invalid-layout`.
- `props.rounded` o `props.animate` no son boolean: el config se rechaza con `invalid-layout`.
- `layout.span` fuera del rango 1–12: el config se rechaza con `invalid-layout` y diagnóstico de ruta `{path}.layout.span`.
- `visibility`, `queryStateFeedback` siguen el contrato transversal estándar.

## Lo que está fuera de alcance (v1)

- Generación automática de skeletons a partir de la estructura de la UI real.
- Variantes de animación distintas de pulse (shimmer, wave, gradiente animado).
- Paleta semántica de color o theming declarativo.
- Estrechamiento automático de la última línea en `variant: text`.
- Tamaños responsive por breakpoint en `width` o `height`.
