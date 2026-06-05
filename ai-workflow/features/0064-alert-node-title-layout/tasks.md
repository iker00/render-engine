# Tasks: alert node — layout con title en fila propia (0064)

Contrato de ejecución para la implementación. Las tareas están ordenadas; cada tarea debe completarse antes de iniciar la siguiente.

---

## T1 — Reestructurar el render del nodo `alert` para layout de dos filas cuando hay título

### Estado
completada

### Objetivo
Cambiar el JSX de `AlertNode` para que, cuando `props.title` esté presente y no sea string vacío tras la resolución de referencias, el bloque del alert se renderice como una columna con dos filas:

- **Fila 1**: contenedor horizontal (`flex`) con el `<span>` del icono y un `<strong>` con el título ocupando el ancho restante (`flex-1`).
- **Fila 2**: un `<span>` con el mensaje, a todo el ancho del bloque.

Cuando `props.title` esté ausente o sea string vacío, mantener el layout actual de una sola fila (`<span>` icono + `<span>` mensaje en horizontal), sin cambios respecto al estado vigente.

Las clases Tailwind sobre el elemento raíz `[data-layout-node="alert"]` deben seguir incluyendo `rounded-md`, `p-4` y la clase `bg-*` correspondiente al tipo en ambos modos, para no romper los tests existentes ni la apariencia base. El cambio se centra en la dirección del flex (`flex-row` actual vs. `flex-col` cuando hay título) y en la estructura interna de filas.

### Fuera de alcance
- Cambios en `colorMap`, en la lógica de resolución de `props.type` o en el contenido del icono placeholder.
- Cambios en `resolveRuntimeTextReference`, en la validación previa al render o en el contrato Zod del nodo.
- Cambios en la integración transversal (`visibility`, `queryStateFeedback`, `layout.span`).
- Cambios fuera de `src/runtime/nodes/alert-layout-node.tsx` y su fichero de test asociado.

### Dependencias
Ninguna.

### Impacto esperado en archivos
- Código:
  - `src/runtime/nodes/alert-layout-node.tsx` — modificar la estructura JSX retornada por `AlertNode` para soportar los dos modos de layout descritos.
- Tests:
  - `src/tests/layout-renderer/layout-renderer-alert.test.tsx` — ampliar con casos que validen el nuevo layout de dos filas cuando `props.title` está presente y la conservación del layout actual cuando está ausente o vacío.
- Documentación:
  - `ai-workflow/docs/app-features/nodes/alert.md` — revisar tras la implementación para actualizar la sección "Estructura visual" y "Comportamiento de render" reflejando el layout de dos filas.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-alert.test.tsx` (ampliación)

#### Comportamiento cubierto
- Cuando `props.title` está presente y no es string vacío, el elemento raíz `[data-layout-node="alert"]` se renderiza como columna (incluye la clase `flex-col`) y contiene dos hijos directos: la fila superior con el icono y el `<strong>` del título, y la fila inferior con el mensaje.
- Cuando `props.title` está presente, el `<span>` del icono y el `<strong>` del título comparten el mismo elemento contenedor (la fila superior), y ese contenedor no incluye al `<span>` del mensaje.
- Cuando `props.title` está presente, el `<strong>` del título tiene la clase `flex-1` (ocupa el ancho restante en su fila).
- Cuando `props.title` está presente, el `<span>` del mensaje vive en un nodo hermano del contenedor de la fila superior, no dentro de la misma fila que el icono.
- Cuando `props.title` está ausente, el elemento raíz `[data-layout-node="alert"]` mantiene el layout horizontal actual (incluye `flex` sin `flex-col`) y los descendientes directos relevantes (icono y mensaje) comparten una sola fila.
- Cuando `props.title` es string vacío (`""`), el layout es idéntico al caso de título ausente: una sola fila con icono y mensaje; no hay `<strong>` en el DOM.
- Cuando `props.title` interpolado resuelve a string vacío (por ejemplo, `{{queries.nonexistent.data}}` sin estado), el alert no se rompe en render y mantiene el layout de una sola fila (sin `<strong>`, sin `flex-col`).
- Cuando `props.message` es string vacío con `props.title` declarado y no vacío, el alert se renderiza con layout de dos filas y la fila del mensaje aparece vacía (sin error).
- Los tests existentes sobre paleta de colores por tipo, icono placeholder, presencia/ausencia de `<strong>`, visibilidad, `queryStateFeedback`, `layout.span`, repeater y formulario siguen pasando sin modificación funcional.

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-alert.test.tsx`

#### Restricciones
- Reusar los helpers locales ya definidos en el fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`); no crear builders adicionales.
- No introducir snapshots de DOM completos; los nuevos casos deben hacer aserciones sobre la estructura del DOM con `querySelector`, `closest` o `classList` para mantener la granularidad de los tests actuales.
- Probar las clases `flex-col` y `flex-1` con `toHaveClass`, no a través de estilos computados.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/alert.md` — secciones "Estructura visual" y "Comportamiento de render" deben reflejar el layout de dos filas con título en la primera fila y mensaje en la segunda. La invocación posterior de `update-app-documentation` se encarga de la actualización; no forma parte de esta tarea.

### Criterios de finalización
- El nodo `alert` renderiza el layout de dos filas cuando `props.title` resuelto no es string vacío y mantiene el layout de una sola fila en el resto de casos.
- Los tests del fichero `layout-renderer-alert.test.tsx`, incluyendo los nuevos casos del comportamiento cubierto, pasan en verde.
- La suite `pnpm test` sigue cumpliendo el umbral de cobertura del 80% sobre `src/`.

### Cierre de implementación
Código y tests de la tarea completos y validados. La feature queda lista para invocar `update-app-documentation` y propagar el cambio a `ai-workflow/docs/app-features/nodes/alert.md` y al índice de features.

---

## Próxima tarea
T1 es la única tarea de implementación de esta feature.
