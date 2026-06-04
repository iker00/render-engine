# Spec: stat node (0056)

## Objetivo

Añadir un nodo hoja `stat` al catálogo del runtime para mostrar métricas o KPIs con una cabecera descriptiva y un valor principal, con dos variantes de estilo (`accent` y `tinted`) y la misma paleta semántica cerrada de seis colores que `badge`.

## Alcance

- Nuevo nodo declarativo `stat` registrado en el catálogo y validado en `src/config/`.
- Dos variantes de estilo: `accent` y `tinted`.
- Paleta semántica de seis colores: `neutral`, `primary`, `success`, `warning`, `danger`, `info`.
- Cabecera (`label`) y valor (`value`) como strings con soporte de interpolación `{{...}}` (misma semántica que `heading`, `paragraph` y `badge`).
- Integración en el dispatcher central de nodos del runtime.
- Soporte de las propiedades transversales estándar: `visibility`, `queryStateFeedback` y `layout.span`.

## Fuera de alcance

- Iconos, imágenes o tendencia (trend indicator) dentro del stat.
- Colores libres fuera de la paleta semántica definida.
- Stat interactivo o con acción (no es un botón).
- Tamaños configurables del valor.
- Theming o tokens visuales configurables por JSON.
- Subtítulo, descripción adicional o cualquier elemento de texto más allá de `label` y `value`.

## Requisitos funcionales

### Variante `accent`

- Renderiza una card compacta con un borde lateral izquierdo (`border-l-4`) de color sólido derivado del color semántico declarado.
- El fondo es neutro (hereda del tema base; sin tinte de color).
- La cabecera (`label`) se muestra en la parte superior en texto muted del tema.
- El valor (`value`) se muestra debajo de la cabecera en texto prominente (tamaño mayor y negrita) en color neutro del tema.

### Variante `tinted`

- Renderiza una card con fondo de color suave derivado del color semántico declarado, igual que la variante `pill` del badge.
- La cabecera (`label`) se muestra en la parte superior en texto del color marcado del mismo tono semántico.
- El valor (`value`) se muestra debajo de la cabecera en texto aún más prominente y marcado del mismo tono semántico.

### Propiedades del nodo

| Propiedad | Tipo | Obligatorio | Default | Descripción |
|---|---|---|---|---|
| `props.label` | string | sí | — | Texto de cabecera descriptivo. Soporta interpolación `{{...}}`. |
| `props.value` | string | sí | — | Valor principal a mostrar. Soporta interpolación `{{...}}`. |
| `props.variant` | `"accent" \| "tinted"` | no | `"accent"` | Estilo visual del stat. |
| `props.color` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Color semántico aplicado. |

### Paleta de colores

Cada color semántico produce clases de Tailwind para el borde de acento (`accent`) y para el fondo y texto (`tinted`). El mapeo debe ser predecible y visualmente coherente sin requerir tokens globales nuevos:

| Color | `accent` (borde izquierdo) | `tinted` (fondo / texto) |
|---|---|---|
| `neutral` | gris medio | gris claro / gris oscuro |
| `primary` | azul | azul claro / azul oscuro |
| `success` | verde | verde claro / verde oscuro |
| `warning` | amarillo | amarillo claro / amarillo oscuro |
| `danger` | rojo | rojo claro / rojo oscuro |
| `info` | cian/celeste | cian claro / cian oscuro |

La elección exacta de shades de Tailwind queda para la fase de implementación, alineada con el baseline visual institucional ya establecido y con la paleta usada por `badge`.

### Interpolación de `label` y `value`

- `props.label` y `props.value` aceptan strings con placeholders `{{...}}` resolviendo `queries.*`, `forms.*`, `params.*` e `item.*` con la misma semántica que otros nodos textuales.
- Si el placeholder no resuelve, el comportamiento es el estándar del runtime: vacío en producción, clave visible en desarrollo.

### Validación previa al render

- `props.label` ausente o no string: error de validación con diagnóstico de ruta.
- `props.value` ausente o no string: error de validación con diagnóstico de ruta.
- `props.variant` con valor fuera del catálogo: error de validación.
- `props.color` con valor fuera de la paleta semántica: error de validación.

## Requisitos no funcionales

- Implementado con utilidades de Tailwind CSS; sin estilos inline.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Compatible con el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación

1. Un nodo `stat` con `variant: "accent"` y cada color de la paleta renderiza con borde lateral izquierdo de color sólido y cabecera y valor en colores neutros.
2. Un nodo `stat` con `variant: "tinted"` y cada color de la paleta renderiza con fondo suave y cabecera y valor en texto del tono marcado del color semántico.
3. Un `stat` sin `variant` declarado renderiza como `accent`.
4. Un `stat` sin `color` declarado renderiza con color `neutral`.
5. `props.label` con interpolación `{{...}}` resuelve correctamente cuando la referencia está disponible.
6. `props.value` con interpolación `{{...}}` resuelve correctamente cuando la referencia está disponible.
7. Un `stat` con `visibility` se muestra u oculta según la condición, igual que cualquier otro nodo.
8. Un `stat` con `queryStateFeedback` aplica la semántica estándar de feedback por query.
9. Un `stat` con `layout.span` ocupa el número de columnas declarado dentro de un grid efectivo.
10. La validación previa al render rechaza `label` ausente, `value` ausente, `variant` inválido y `color` inválido con diagnóstico de ruta exacta.
11. El nodo no acepta `children` (siguiendo la regla de nodos hoja del catálogo).

## Casos límite

- `label` con placeholder que no resuelve → string vacío en producción, clave en desarrollo.
- `value` con placeholder que no resuelve → string vacío en producción, clave en desarrollo.
- `stat` dentro de un `repeater` con `item.*` en `value` → resuelve el valor por iteración.
- `stat` dentro de un `form` → válido; no participa en validación ni submit (no es campo de formulario).
- `label` con string vacío → renderiza el stat sin texto de cabecera visible (no es error).
- `value` con string vacío → renderiza el stat sin texto de valor visible (no es error).
- `stat` con `children` declarados → los hijos no se procesan (regla de nodo hoja).

## Riesgos o preguntas abiertas

Ninguno. Las decisiones de producto, variantes y paleta están cerradas.

## Áreas de producto afectadas

- Catálogo de nodos (`nodes/`) — nueva ficha `stat.md`.
- Validación de configuración (`config/`) — nuevo esquema para `stat`.
- Runtime dispatcher — nuevo caso `stat`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md` — entrada nueva en la tabla de nodos hoja visibles.
- Nueva ficha `ai-workflow/docs/app-features/nodes/stat.md`.
