# Spec: celdas ricas en tabla (`0049-rich-table-cells`)

## Objetivo

Permitir que las celdas del nodo `table` contengan nodos declarativos (imagen, lista, botón, párrafo, encabezado, contenedor) además de valores primitivos, para soportar casos de uso como columnas de acciones, miniaturas, badges de texto enriquecido o composiciones visuales por fila.

## Alcance

- Ampliar el contrato de celdas de `table` para aceptar `string | NodeObject` tanto en modo dinámico (`props.rows.cells`) como en modo manual (`props.rows` como array de arrays).
- Nodos permitidos en celda: `image`, `list`, `button`, `container`, `heading`, `paragraph`.
- `container` puede anidar cualquier nodo del subconjunto permitido, incluido otro `container`.
- Las referencias dinámicas en los `props` de un nodo embebido se resuelven igual que en el resto del runtime (`item.*`, `queries.*`, `forms.*`, `params.*`, interpolación `{{...}}`).

## Fuera de alcance

- Nodo `modal` como contenido de celda.
- Nodos de formulario (`form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`) en celda.
- Nodos `repeater` y `table` anidados en celda.
- Filtrado o extracción de texto desde nodos embebidos para ordenacióninteligente: las celdas con nodo se tratan como string vacío en comparaciones de filtro y ordenación.
- Edición inline de celdas.
- Procesamiento remoto de tabla.

## Requisitos funcionales

### Contrato del nodo `table`

1. `props.rows` en modo manual acepta `Array<Array<string | number | boolean | NodeObject>>`.
2. `props.rows.cells` en modo dinámico acepta `(string | NodeObject)[]`.
3. Un `NodeObject` en celda es un objeto con al menos `type` (string no vacío) y `props` (objeto). Los campos `id`, `visibility`, `queryStateFeedback` y `layout` opcionales siguen siendo válidos sobre el nodo embebido.
4. El subconjunto de `type` permitido en celda es: `image`, `list`, `button`, `container`, `heading`, `paragraph`.
5. Un `container` en celda puede declarar `children` con nodos del mismo subconjunto permitido, incluido otro `container`.
6. Las reglas transversales de cada nodo embebido (validación de props, referencias, visibilidad, feedback por query) aplican sin excepción dentro de la celda.

### Render

7. Una celda con `NodeObject` renderiza el nodo dentro del `<td>` correspondiente usando el renderer central existente, con acceso al contexto `item.*` cuando la tabla opera en modo dinámico.
8. Una celda con valor primitivo sigue comportándose exactamente igual que antes.
9. Si un `NodeObject` embebido no puede renderizarse (por visibilidad, queryStateFeedback u ocultación), la celda renderiza vacía, sin romper la estructura de la tabla.

### Filtros y ordenación locales

10. Si una columna es `filterable` o `sortable` y alguna celda contiene un `NodeObject`, esas celdas se tratan como string vacío a efectos de filtro y ordenación. No se produce error de validación ni advertencia en render.

### Validación previa al render

11. Si el `type` de un `NodeObject` en celda no pertenece al subconjunto permitido, el config completo se rechaza antes del render con diagnóstico sobre la ruta exacta.
12. Si un `NodeObject` en celda incumple el contrato de props de su propio nodo (según las reglas ya definidas en cada nodo), el config completo se rechaza antes del render sobre la ruta exacta.
13. La correspondencia exacta entre `headers` y número de celdas por fila se mantiene. Un `NodeObject` ocupa una posición de celda igual que un primitivo.

## Requisitos no funcionales

- El render de nodos embebidos debe reutilizar el dispatcher central de nodos; no se implementará un renderer paralelo específico para celdas.
- La validación de `NodeObject` en celda debe reutilizar los esquemas Zod existentes de cada nodo, componiéndolos como unión discriminada por `type`.
- El umbral de cobertura del 80% sobre `src/` debe mantenerse tras la implementación.

## Criterios de aceptación

1. Una celda con `{ type: "image", props: { src: "item.avatar", alt: "item.name" } }` renderiza la imagen correcta para cada fila en modo dinámico.
2. Una celda con `{ type: "button", props: { label: "Ver", action: { type: "navigateTo", pageId: "detail", params: { id: "item.id" } } } }` renderiza un botón funcional por fila que navega a la página de detalle con el parámetro correcto.
3. Una celda con `{ type: "container", props: { children: [ { type: "image", ... }, { type: "paragraph", ... } ] } }` renderiza la composición sin errores.
4. Una celda con `{ type: "modal", ... }` hace que el config se rechace antes del render con diagnóstico sobre la ruta exacta.
5. Una celda con `{ type: "input", ... }` hace que el config se rechace antes del render con diagnóstico sobre la ruta exacta.
6. Una columna `sortable: true` con celdas que son `NodeObject` ordena correctamente las filas que tienen primitivos y trata las celdas-nodo como string vacío sin error.
7. Una columna `filterable: true` con celdas que son `NodeObject` filtra correctamente las filas que tienen primitivos y trata las celdas-nodo como string vacío sin error.
8. Una fila manual con un `NodeObject` como celda renderiza el nodo dentro del `<td>` correspondiente.
9. El config se rechaza si el número de celdas (primitivos + nodos) no coincide con el número de `headers`.
10. Los tests existentes de `table` siguen en verde sin modificación.

## Casos límite

- `NodeObject` con `visibility` que resuelve a oculto: celda renderiza vacía, sin romper la fila.
- `NodeObject` con `queryStateFeedback` que resuelve a estado de carga: celda muestra el feedback visual del nodo, sin afectar al resto de celdas de la fila.
- `container` vacío (sin `children`) en celda: celda renderiza vacía; no es un error si el contrato del nodo `container` lo permite.
- Tabla con paginación: los nodos embebidos solo existen en el DOM para las filas de la página visible; no hay `N` nodos para toda la colección.
- `NodeObject` en celda de columna con `filterable: true` y `sortable: true` simultáneos: ambas capacidades tratan la celda como string vacío.
- Celda con `NodeObject` en modo manual cuyo `type` es un string vacío o ausente: config rechazado antes del render.

## Áreas de producto afectadas

- Nodo `table`: contrato de celdas ampliado.
- Validación de config (`src/config/`): esquema Zod de celdas extendido con unión discriminada.
- Renderer central (`src/runtime/`): celdas delegan en el dispatcher de nodos existente.

## Documentación probablemente afectada

- `ai-workflow/docs/app-features/nodes/table.md`: contrato de celdas, validación específica, límites.
- `ai-workflow/docs/current-state.md`: columna "Última feature relevante" del área Catálogo de nodos.

## Riesgos o preguntas abiertas

Ninguno. El alcance está cerrado y todas las decisiones de producto están tomadas.
