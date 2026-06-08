# Tasks: tabs — barra de tabs responsiva (0070)

Contrato de ejecución para la implementación. La feature consta de una única tarea atómica con dos aspectos visuales acoplados al mismo elemento JSX (la barra de tabs y sus botones) y al mismo fichero de tests.

Notas globales (aplican a la tarea):
- La feature es exclusivamente visual de runtime. No se cambia el contrato JSON, ni `src/config/`, ni la lógica de selección/visibilidad/`defaultTab`/cambio de panel del nodo `tabs`.
- Los tests existentes de `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` deben seguir pasando sin tocar su código.
- Los estilos se implementan con utilidades Tailwind ya en uso en el proyecto. No introducir estilos inline, ni clases hexadecimales hardcodeadas, ni nuevas clases en `src/app/index.css`.
- No se introducen props nuevas (`props.maxBarWidth`, `props.scrollable`, etc.). El ancho máximo y el comportamiento de overflow son fijos.
- Ancho máximo elegido para la barra vertical: `w-48` (12rem ≈ 192px). Es coherente con el sizing de columnas auxiliares típico del proyecto y suficiente para etiquetas razonables; etiquetas más largas rompen en múltiples líneas dentro del botón.
- El sub-bloque de tests del fichero `layout-renderer-tabs.test.tsx` ya incluye un escenario amplio (orientación, defaultTab, visibility, qsf, repeater). La ampliación de esta tarea añade un nuevo `describe` específico de sizing/overflow sin tocar los previos.

---

## T1 — Sizing fijo de barra vertical y scroll horizontal de barra horizontal

### Estado
completada

### Objetivo
Aplicar dos ajustes visuales acoplados a la barra de tabs (elemento con `data-layout-node="tabs-bar"`) y a los botones que renderiza, ambos condicionados por `orientation`:

1. En orientación `vertical`:
   - La barra de tabs lleva las clases adicionales `w-48 shrink-0`, lo que fija su ancho a `12rem` (192px) y le impide encogerse cuando el contenedor padre aplica `flex` en otra dirección.
   - Cada botón de la barra lleva las clases adicionales `text-left whitespace-normal break-words`, lo que alinea el texto a la izquierda, permite que ocupe varias líneas y rompe palabras muy largas sin desbordar el ancho de la barra.

2. En orientación `horizontal`:
   - La barra de tabs lleva la clase adicional `overflow-x-auto`, lo que activa scroll horizontal interno cuando el conjunto de botones supera el ancho disponible del container padre.
   - Cada botón de la barra lleva las clases adicionales `shrink-0 whitespace-nowrap`, lo que evita que los botones se compriman o partan su etiqueta cuando el ancho total supera el contenedor (necesario para que `overflow-x-auto` funcione como scroll real y no como compresión).

Estrategia de implementación en `src/runtime/nodes/tabs-layout-node.tsx`:

- El `<div data-layout-node="tabs-bar">` ya recibe condicionalmente `flex flex-col` (vertical) o `flex flex-row` (horizontal). Extender esa expresión condicional para añadir, manteniendo las clases actuales:
  - vertical: `flex flex-col w-48 shrink-0`
  - horizontal: `flex flex-row overflow-x-auto`
- El `<button>` interno actualmente recibe condicionalmente `border-b-2 border-blue-600 font-semibold px-4 py-2` (activo) o `px-4 py-2 text-gray-600 hover:text-gray-900` (inactivo). Añadir un sufijo de clases dependiente de `isVertical` que se concatena a ambas variantes (activa e inactiva) en el mismo orden:
  - vertical: `text-left whitespace-normal break-words`
  - horizontal: `shrink-0 whitespace-nowrap`
- No alterar ningún otro aspecto del JSX, ni del root (`flex flex-row` vs `flex flex-col`), ni del panel (`flex-1`), ni el orden de la barra/panel en el DOM.
- No introducir refactors colaterales (extracción de helpers de clases, mapeos en `runtime-node-styling.ts`, theming, etc.). El cambio es local al fichero.

### Fuera de alcance
- Cualquier cambio del contrato JSON o de validación (`src/config/`, `runtime-config*.ts`).
- Hacer configurable el ancho máximo de la barra vertical o el comportamiento de overflow desde JSON.
- Cambio automático de orientación entre `horizontal` y `vertical` según el breakpoint (responsive switching).
- Truncado de etiquetas largas con `truncate` o equivalentes; el comportamiento elegido es wrapping.
- Scroll vertical en la barra de orientación `vertical`.
- Cambios en la lógica de selección, visibilidad por item, `defaultTab`, `queryStateFeedback`, ARIA, o cualquier otro comportamiento funcional del nodo `tabs`.
- Cambios en `containerGapClassMap` o en utilidades de `runtime-node-styling.ts`.
- Cambios documentales bajo `ai-workflow/docs/`; se actualizan después de cerrar la implementación vía `update-app-documentation`.

### Dependencias
Ninguna.

### Impacto esperado en archivos

- Código:
  - `src/runtime/nodes/tabs-layout-node.tsx` — modificar las expresiones de `className` de:
    - el `<div data-layout-node="tabs-bar">` (actualmente `isVertical ? 'flex flex-col' : 'flex flex-row'`), pasando a `isVertical ? 'flex flex-col w-48 shrink-0' : 'flex flex-row overflow-x-auto'`.
    - el `<button>` interno: añadir el sufijo condicional `isVertical ? ' text-left whitespace-normal break-words' : ' shrink-0 whitespace-nowrap'` concatenado al final de ambas variantes (activa e inactiva). No reordenar ni reescribir las clases existentes.
  - No modificar nada más del fichero (props, hooks, ramas de visibilidad, render del panel, contenedor raíz).

- Tests:
  - `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación) — añadir un nuevo bloque `describe('TabsNode — bar sizing and overflow', …)` al final del fichero con los casos descritos en la subsección de tests. No modificar ningún `describe` previo, ni los helpers (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`, `buildQueryState`, `ToggleQueryFixture`, `renderWithToggle`).

- Documentación:
  - `ai-workflow/docs/app-features/nodes/tabs.md` — se actualizará al final de la feature vía `update-app-documentation` para reflejar el ancho máximo fijo en vertical y el scroll horizontal en horizontal. No forma parte de esta tarea.

### Tests

#### Ficheros de test
- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación)

#### Comportamiento cubierto
- Con `orientation: 'vertical'` y al menos dos items, el elemento `[data-layout-node="tabs-bar"]` tiene además de las clases preexistentes (`flex`, `flex-col`) las clases `w-48` y `shrink-0`.
- Con `orientation: 'vertical'`, cada botón visible de la barra tiene las clases `text-left`, `whitespace-normal` y `break-words` (independientemente de si está activo o no).
- Con `orientation: 'vertical'` y un único item, las clases `w-48 shrink-0` siguen presentes en `[data-layout-node="tabs-bar"]` (la regla no depende del número de items).
- Con `orientation: 'vertical'` y una etiqueta muy larga (p.ej. una cadena de más de 50 caracteres sin espacios), el botón se renderiza y contiene las clases de wrapping (`whitespace-normal break-words`). No se verifica el ancho renderizado por píxel (jsdom no aplica layout); el contrato observado son las clases Tailwind que activan el wrapping.
- Con `orientation: 'horizontal'` (explícito o por defecto) y al menos dos items, el elemento `[data-layout-node="tabs-bar"]` tiene además de las clases preexistentes (`flex`, `flex-row`) la clase `overflow-x-auto`.
- Con `orientation: 'horizontal'`, cada botón visible de la barra tiene las clases `shrink-0` y `whitespace-nowrap` (independientemente de si está activo o no).
- Con `orientation: 'horizontal'` y un único item, la clase `overflow-x-auto` sigue presente en `[data-layout-node="tabs-bar"]`.
- Tabs ocultos por `visibility` no aparecen como botones: la verificación adicional es que entre los botones realmente renderizados todos cumplen las clases de su orientación (no debe colarse un botón sin las clases de sizing/overflow).
- Cuando `orientation` es `'horizontal'`, las clases exclusivas de la rama vertical (`w-48`, `shrink-0` en la barra, `text-left`, `whitespace-normal`, `break-words` en los botones) NO están presentes; y simétricamente, cuando `orientation` es `'vertical'`, las clases exclusivas de la rama horizontal (`overflow-x-auto` en la barra, `whitespace-nowrap` en los botones) NO están presentes. (Nota: `shrink-0` aparece en ambas ramas pero sobre elementos distintos — en la barra vertical y en los botones horizontales —, por lo que la comprobación de exclusión debe hacerse por elemento, no globalmente.)
- Sanity check funcional: con `orientation: 'horizontal'` y dos items, el click en el segundo botón sigue cambiando el panel activo (regresión sobre el comportamiento ya cubierto en otros `describe` del fichero, repetido localmente para garantizar que las clases nuevas no rompen la interacción).

#### Comandos durante la implementación
- `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx`

#### Restricciones
- Reusar los helpers ya definidos en el fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`, `buildQueryState`). No introducir helpers nuevos ni un nuevo fichero de tests.
- Las aserciones de clases Tailwind se hacen con `toHaveClass` o `classList.contains(...)`. No comparar `className` completo como cadena (las clases existentes pueden cambiar de orden en futuras refactorizaciones del fichero sin invalidar este test).
- No introducir snapshots de DOM, ni assert sobre estilos calculados (`getComputedStyle`), ni mediciones de píxeles: jsdom no aplica layout y no es un contrato observable estable.
- No introducir esperas asíncronas (`await waitFor`, fake timers); el render del nodo `tabs` es síncrono.
- No reordenar ni modificar los `describe` previos del fichero; añadir el bloque nuevo al final.

### Documentación afectada
- `ai-workflow/docs/app-features/nodes/tabs.md` — añadir una mención al ancho máximo fijo de la barra en orientación `vertical` y al scroll horizontal de la barra en orientación `horizontal`, sin tocar el contrato de props. La actualización se ejecuta al final de la feature vía `update-app-documentation`; no forma parte de esta tarea.

### Criterios de finalización
- El elemento `[data-layout-node="tabs-bar"]` se renderiza con `w-48 shrink-0` (además de `flex flex-col`) en orientación `vertical`, y con `overflow-x-auto` (además de `flex flex-row`) en orientación `horizontal`.
- Cada `<button>` de la barra se renderiza con `text-left whitespace-normal break-words` en orientación `vertical`, y con `shrink-0 whitespace-nowrap` en orientación `horizontal`, conservando las clases activa/inactiva preexistentes.
- Todos los tests del fichero `layout-renderer-tabs.test.tsx` pasan: los previos sin modificación y los nuevos del bloque añadido.
- `pnpm test` sigue pasando y cumpliendo el umbral global del 80 % de cobertura.

### Cierre de implementación
T1 está cerrada cuando el fichero `src/runtime/nodes/tabs-layout-node.tsx` aplica las clases descritas en la barra y los botones según `orientation`, el nuevo bloque de tests pasa en verde junto con el resto del fichero, `pnpm test` no rompe regresiones ni cobertura, y `status.yaml` refleja la tarea como completada. Al cerrar T1, la feature queda lista para invocar `update-app-documentation`, que se encarga de reflejar los nuevos comportamientos visuales en `ai-workflow/docs/app-features/nodes/tabs.md`.

---

## Próxima tarea
T1 — Sizing fijo de barra vertical y scroll horizontal de barra horizontal.

---

## Documentación afectada (resumen global)
- `ai-workflow/docs/app-features/nodes/tabs.md` — única ficha funcional afectada. La actualización se ejecuta al final de la feature vía `update-app-documentation`.
