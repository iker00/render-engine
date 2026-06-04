# Spec: alert node (0055)

## Objetivo

Añadir un nodo hoja `alert` al catálogo del runtime para mostrar mensajes de aviso, confirmación o error con un icono semántico, una cabecera opcional y un texto de mensaje, usando la misma paleta de seis colores semánticos cerrada que `badge`.

## Alcance

- Nuevo nodo declarativo `alert` registrado en el catálogo y validado en `src/config/`.
- Seis tipos semánticos (`neutral`, `primary`, `success`, `warning`, `danger`, `info`), cada uno con color y icono placeholder asociados.
- Cabecera opcional con soporte de interpolación `{{...}}`.
- Texto de mensaje obligatorio con soporte de interpolación `{{...}}`.
- Icono placeholder por tipo (el icono definitivo se sustituirá en una iteración futura; la implementación actual usa un marcador visual simple que no requiere librería de iconos externa).
- Integración en el dispatcher central de nodos del runtime.
- Soporte de las propiedades transversales estándar: `visibility`, `queryStateFeedback` y `layout.span`.

## Fuera de alcance

- Icono configurable o intercambiable por JSON (el icono lo fija el tipo).
- Colores libres fuera de la paleta semántica de seis colores.
- Alert interactivo o con acción (no es un botón ni un banner con cierre).
- Variantes de estilo adicionales más allá de la apariencia estándar de bloque de aviso.
- Tamaños configurables.
- Theming o tokens visuales configurables por JSON.
- Contenido arbitrario (children, imágenes, formularios embebidos).
- Inclusión del `alert` como tipo permitido en celdas ricas de `table`.

## Requisitos funcionales

### Estructura visual

El nodo `alert` renderiza un bloque horizontal con tres zonas:

1. **Zona de icono** — a la izquierda, icono placeholder determinado por `props.type`.
2. **Zona de contenido** — a la derecha del icono:
   - Cabecera (`props.title`) cuando está declarada: texto en negrita en la parte superior.
   - Mensaje (`props.message`) debajo de la cabecera, o en la única línea si no hay cabecera.

El bloque adopta el color semántico del tipo mediante fondo suave y bordes o texto de acento correspondientes, usando la misma paleta que `badge`.

### Tipos y colores

| Tipo | Color de fondo / acento | Icono placeholder |
|---|---|---|
| `neutral` | gris claro / gris oscuro | `icon` |
| `primary` | azul claro / azul oscuro | `icon` |
| `success` | verde claro / verde oscuro | `icon` |
| `warning` | amarillo claro / amarillo oscuro | `icon` |
| `danger` | rojo claro / rojo oscuro | `icon` |
| `info` | cian claro / cian oscuro | `icon` |

La elección exacta de shades de Tailwind queda para la fase de implementación, alineada con el baseline visual institucional ya establecido y coherente con los shades usados en `badge`.

### Propiedades del nodo

| Propiedad | Tipo | Obligatorio | Default | Descripción |
|---|---|---|---|---|
| `props.type` | `"neutral" \| "primary" \| "success" \| "warning" \| "danger" \| "info"` | no | `"neutral"` | Tipo semántico que determina el color y el icono. |
| `props.title` | string | no | — | Cabecera del alert. Soporta interpolación `{{...}}`. |
| `props.message` | string | sí | — | Texto del mensaje. Soporta interpolación `{{...}}`. |

### Interpolación de `title` y `message`

- Ambos aceptan strings con placeholders `{{...}}` resolviendo `queries.*`, `forms.*`, `params.*` e `item.*` con la misma semántica que otros nodos textuales.
- Si el placeholder no resuelve, el comportamiento es el estándar del runtime: vacío en producción, clave visible en desarrollo.

### Validación previa al render

- `props.message` ausente o no string: error de validación con diagnóstico de ruta.
- `props.type` con valor fuera del catálogo: error de validación con diagnóstico de ruta.
- `props.title` presente pero no string: error de validación con diagnóstico de ruta.

## Requisitos no funcionales

- Implementado con utilidades de Tailwind CSS; sin estilos inline.
- Sin estado local ni efectos secundarios; es un nodo de presentación pura.
- Compatible con el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación

1. Un nodo `alert` con cada uno de los seis tipos renderiza el color semántico correspondiente (fondo suave + acento).
2. Un nodo `alert` con `props.title` declarado muestra la cabecera en negrita sobre el mensaje.
3. Un nodo `alert` sin `props.title` muestra únicamente el mensaje, sin espacio reservado para la cabecera.
4. Un `alert` sin `type` declarado renderiza con tipo `neutral`.
5. El icono placeholder aparece en todos los tipos.
6. `props.message` con interpolación `{{...}}` resuelve correctamente cuando la referencia está disponible.
7. `props.title` con interpolación `{{...}}` resuelve correctamente cuando la referencia está disponible.
8. Un `alert` con `visibility` se muestra u oculta según la condición, igual que cualquier otro nodo.
9. Un `alert` con `queryStateFeedback` aplica la semántica estándar de feedback por query.
10. Un `alert` con `layout.span` ocupa el número de columnas declarado dentro de un grid efectivo.
11. La validación previa al render rechaza `message` ausente, `type` inválido y `title` no string con diagnóstico de ruta exacta.
12. El nodo no acepta `children` (siguiendo la regla de nodos hoja del catálogo).

## Casos límite

- `message` con placeholder que no resuelve → string vacío en producción, clave en desarrollo.
- `title` con placeholder que no resuelve → string vacío en producción, clave en desarrollo; el espacio de cabecera se renderiza vacío.
- `alert` dentro de un `repeater` con `item.*` en `message` o `title` → resuelve el valor por iteración.
- `alert` dentro de un `form` → válido; no participa en validación ni submit.
- `message` con string vacío → renderiza el alert sin texto de mensaje visible (no es error).
- `title` con string vacío → se comporta como si no hubiera cabecera declarada a nivel visual.
- `alert` con `children` declarados → los hijos no se procesan (regla de nodo hoja).

## Riesgos o preguntas abiertas

Ninguno. El icono placeholder es una decisión explícita y el alcance está cerrado.

## Áreas de producto afectadas

- Catálogo de nodos (`nodes/`) — nueva ficha `alert.md`.
- Validación de configuración (`config/`) — nuevo esquema para `alert`.
- Runtime dispatcher — nuevo caso `alert`.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/index.md` — entrada nueva en la tabla de nodos hoja visibles.
- Nueva ficha `ai-workflow/docs/app-features/nodes/alert.md`.
