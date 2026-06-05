# Spec: alert node — layout con title en fila propia (0064)

## Objetivo

Modificar el layout visual del nodo `alert` para que, cuando se declara `props.title`, el icono quede en la columna izquierda y el título y el mensaje se apilen verticalmente en la columna derecha. Actualmente todos los elementos comparten una sola fila horizontal; con este cambio el título aparece en la parte superior de la zona de contenido y el mensaje queda debajo, ambos alineados con el mismo margen izquierdo (el del icono).

## Alcance

- Nuevo layout para el nodo `alert` cuando `props.title` está declarado y no es string vacío:
  - Columna izquierda: icono de tipo.
  - Columna derecha (ocupa el ancho restante): `props.title` en negrita arriba, `props.message` debajo, alineados entre sí.
- Sin cambios en el layout cuando `props.title` está ausente o es string vacío: se mantiene el layout actual de una sola fila (icono + message horizontales).
- Sin cambios en el contrato de props, validación previa al render, interpolación ni integración transversal.

## Fuera de alcance

- Cambios en el contrato de props del nodo `alert` (`type`, `title`, `message`).
- Cambios en la paleta semántica de colores o en el icono placeholder.
- Cambios en las reglas de validación previa al render.
- Cambios en la integración transversal (`visibility`, `queryStateFeedback`, `layout.span`).
- Nuevas variantes de layout configurables por JSON.
- Comportamiento interactivo o con acciones.

## Requisitos funcionales

### Layout con `props.title` declarado (cambio)

Cuando `props.title` está presente y no es string vacío tras resolución:

- **Columna izquierda** — icono de tipo.
- **Columna derecha** (`flex-1`) — columna vertical con dos entradas:
  - `props.title` en `<strong>`, en la parte superior.
  - `props.message` debajo del título, alineado con él (no debajo del icono).

El bloque exterior del alert mantiene un layout horizontal (`flex-row`); el cambio está en que la zona de contenido pasa a ser una columna con título encima y mensaje debajo.

### Layout sin `props.title` (sin cambio)

Cuando `props.title` está ausente, no es string o es string vacío tras resolución:

- Se mantiene el layout actual: icono de tipo + `props.message` en una sola fila horizontal, igual que en `0055`.

### Sin cambios en el resto del nodo

- Colores, paleta semántica, icono placeholder: sin cambios.
- `props.type`, valores posibles, default `"neutral"`: sin cambios.
- Resolución de `props.title` y `props.message` con `resolveRuntimeTextReference`: sin cambios.
- Validación previa al render, reglas Zod: sin cambios.
- Integración de `visibility`, `queryStateFeedback`, `layout.span`: sin cambios.

## Requisitos no funcionales

- Implementado con utilidades de Tailwind CSS; sin estilos inline.
- Sin estado local ni efectos secundarios; el nodo sigue siendo de presentación pura.
- Compatible con el umbral mínimo de cobertura del 80% sobre `src/`.

## Criterios de aceptación

1. Un `alert` con `props.title` declarado muestra el icono a la izquierda y el título en negrita a su derecha, en la parte superior de la columna de contenido.
2. Un `alert` con `props.title` declarado muestra el mensaje debajo del título, alineado con él, no debajo del icono.
3. Un `alert` sin `props.title` (ausente o string vacío) mantiene el layout horizontal actual: icono + mensaje en una sola fila.
4. El icono de tipo aparece siempre en la primera fila, tanto con título como sin él.
5. El cambio de layout no afecta el color semántico, los estilos de tipo ni el icono placeholder.
6. `visibility`, `queryStateFeedback` y `layout.span` siguen funcionando correctamente.

## Casos límite

- `props.title` con string vacío `""` → se comporta como si no hubiera título: layout de una fila (icono + message).
- `props.title` con placeholder `{{...}}` que resuelve a string vacío en producción → layout de una fila; si resuelve a no-vacío, layout de dos filas.
- `alert` dentro de `repeater` con `item.*` en `props.title` → layout determinado por el valor resuelto por iteración.
- `props.message` vacío con `props.title` declarado → layout de dos filas; la fila del mensaje se renderiza vacía (no es error, igual que en `0055`).

## Riesgos o preguntas abiertas

Ninguno. El cambio es estrictamente visual, el contrato de props no varía y el alcance está cerrado.

## Áreas de producto afectadas

- Nodo `alert` en runtime.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/alert.md` — actualizar la sección de estructura visual y comportamiento de render para reflejar el nuevo layout de dos filas.
