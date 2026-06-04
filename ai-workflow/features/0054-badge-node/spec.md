# Spec: badge node (0054)

## Objetivo

Añadir un nodo hoja `badge` al catálogo del runtime para mostrar etiquetas visuales compactas con dos variantes de estilo (`pill` y `circle`) y una paleta semántica cerrada de colores.

## Alcance

- Nuevo nodo declarativo `badge` registrado en el catálogo y validado en `src/config/`.
- Dos variantes de estilo: `pill` y `circle`.
- Paleta semántica de seis colores: `neutral`, `primary`, `success`, `warning`, `danger`, `info`.
- Texto del badge como string con soporte de interpolación `{{...}}` (misma semántica que `heading`, `paragraph` y `list`).
- Integración en el dispatcher central de nodos del runtime.
- Soporte de las propiedades transversales estándar: `visibility`, `queryStateFeedback` y `layout.span`.

## Fuera de alcance

- Iconos, imágenes o contenido arbitrario dentro del badge.
- Colores libres fuera de la paleta semántica definida.
- Badge interactivo o con acción (no es un botón).
- Inclusión del badge como tipo permitido en celdas ricas de `table` (puede abrirse como extensión futura de `0049-rich-table-cells`).
- Tamaños configurables.
- Theming o tokens visuales configurables por JSON.

## Requisitos funcionales

### Variante `pill`

- Renderiza una etiqueta compacta con fondo de color suave y texto de color más marcado, ambos derivados del color semántico declarado.
- El texto ocupa el interior del badge con padding horizontal y vertical mínimos.
- La forma es redondeada (pill shape).

### Variante `circle`

- Renderiza un circulo de color sólido a la izquierda del texto.
- El texto aparece a la derecha del círculo en color neutro (heredado del tema base).
- Ambos elementos (círculo y texto) se alinean verticalmente en el centro.

### Propiedades del nodo

| Propiedad | Tipo | Obligatorio | Default | Descripción |
|---|---|---|---|---|
| `props.label` | string | sí | — | Texto visible. Soporta interpolación `{{...}}`. |
| `props.variant` | `"pill" \| "circle"` | no | `"pill"` | Estilo visual del badge. |
| `props.color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Color semántico aplicado. |

### Paleta de colores

Cada color semántico produce colores de fondo y texto para `pill`, y color de círculo para `circle`, usando utilidades de Tailwind. El mapeo debe ser predecible y visualmente coherente sin requerir tokens globales nuevos:

| Color | Variante pill (fondo / texto) | Variante circle (círculo) |
|---|---|---|
| `neutral` | gris claro / gris oscuro | gris medio |
| `primary` | azul claro / azul oscuro | azul |
| `success` | verde claro / verde oscuro | verde |
| `warning` | amarillo claro / amarillo oscuro | amarillo |
| `danger` | rojo claro / rojo oscuro | rojo |
| `info` | cian/celeste claro / cian oscuro | cian/celeste |

La elección exacta de shades de Tailwind queda para la fase de implementación, alineada con el baseline visual institucional ya establecido.

### Interpolación de `label`

- `props.label` acepta strings con placeholders `{{...}}` resolviendo `queries.*`, `forms.*`, `params.*` e `item.*` con la misma semántica que otros nodos textuales.
- Si el placeholder no resuelve, el comportamiento es el estándar del runtime: vacío en producción, clave visible en desarrollo.

### Validación previa al render

- `props.label` ausente o no string: error de validación con diagnóstico de ruta.
- `props.variant` con valor fuera del catálogo: error de validación.
- `props.color` con valor fuera de la paleta semántica: error de validación.

## Requisitos no funcionales

- Implementado con utilidades de Tailwind CSS; sin estilos inline.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Compatible con el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación

1. Un nodo `badge` con `variant: "pill"` y cada color de la paleta renderiza con fondo suave y texto de color marcado coherente.
2. Un nodo `badge` con `variant: "circle"` y cada color de la paleta renderiza un círculo de color a la izquierda del texto.
3. Un `badge` sin `variant` declarado renderiza como `pill`.
4. Un `badge` sin `color` declarado renderiza con color `neutral`.
5. `props.label` con interpolación `{{...}}` resuelve correctamente cuando la referencia está disponible.
6. Un `badge` con `visibility` se muestra u oculta según la condición, igual que cualquier otro nodo.
7. Un `badge` con `queryStateFeedback` aplica la semántica estándar de feedback por query.
8. Un `badge` con `layout.span` ocupa el número de columnas declarado dentro de un grid efectivo.
9. La validación previa al render rechaza `label` ausente, `variant` inválido y `color` inválido con diagnóstico de ruta exacta.
10. El nodo no acepta `children` (siguiendo la regla de nodos hoja del catálogo).

## Casos límite

- `label` con placeholder que no resuelve → string vacío en producción, clave en desarrollo.
- `badge` dentro de un `repeater` con `item.*` en `label` → resuelve el valor por iteración.
- `badge` dentro de un `form` → válido; no participa en validación ni submit (no es campo de formulario).
- `label` con string vacío → renderiza el badge sin texto visible (no es error).
- `badge` con `children` declarados → los hijos no se procesan (regla de nodo hoja).

## Riesgos o preguntas abiertas

Ninguno. Las decisiones de producto y paleta están cerradas.

## Áreas de producto afectadas

- Catálogo de nodos (`nodes/`) — nueva ficha `badge.md`.
- Validación de configuración (`config/`) — nuevo esquema para `badge`.
- Runtime dispatcher — nuevo caso `badge`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md` — entrada nueva en la tabla de nodos hoja visibles.
- Nueva ficha `ai-workflow/docs/app-features/nodes/badge.md`.
