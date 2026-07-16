# Tasks — 0099 — Consistencia de variantes y JSX en nodos del runtime

Contrato de ejecución. Ordenado por dependencia. La siguiente tarea que debe abordarse siempre es la primera cuyo estado no sea `done`.

Referencia común para todas las tareas:
- Precedente del patrón deseado en el propio código: `src/runtime/nodes/divider-layout-node.tsx` (lookup map `Record<Variant, string>`) y `src/runtime/nodes/button-layout-node.tsx` (delegación en un único helper de `runtime-node-styling.ts`).
- Ningún refactor de esta feature debe alterar el HTML renderizado, las clases Tailwind, los atributos ARIA ni el contrato JSON de los nodos afectados. La spec exige que las suites existentes sigan pasando sin modificar sus aserciones sobre el resultado observable.
- Los helpers de `src/runtime/runtime-node-styling.ts` no se renombran ni se refactorizan; se consumen tal cual. Se admite añadir un helper mínimo sólo cuando sea imprescindible para eliminar la duplicación y esté explícitamente autorizado por la tarea; en esta feature ninguna tarea lo autoriza.

---

## Task 1 — Documentar la convención de variantes y JSX en `conventions.md`

- **ID**: 0099-T1
- **Estado**: done
- **Objetivo**: Añadir a `ai-workflow/docs/conventions.md` la regla que gobierna cómo un nodo del runtime debe resolver sus variantes visuales y cuándo se admite `createElement` en vez de JSX. Esta regla es la referencia normativa para el resto de tareas de la feature y para futuros nodos.
- **Fuera de alcance**:
  - No modificar código de nodos en esta tarea.
  - No introducir reglas sobre theming, tokens o clases concretas: la regla es puramente estructural (lookup map vs. helper delegado; JSX vs. `createElement`).
  - No reescribir otras secciones de `conventions.md` más allá de insertar la nueva regla en la sección adecuada.
- **Dependencias**: ninguna. Habilita el resto de tareas al fijar la referencia normativa.
- **Impacto esperado en archivos**:
  - Código: ninguno.
  - Tests: ninguno.
  - Documentación: `ai-workflow/docs/conventions.md` (modificar; añadir sub-sección dentro del bloque de convenciones de código).
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por: n/a — cambio doctrinal en `conventions.md`, no verificable por tests automatizados.
  - **Comportamiento cubierto**:
    - La sub-sección nueva enuncia que un nodo con variantes visuales debe resolverlas mediante un lookup map `Record<Variant, string>` o delegando en un único helper de `runtime-node-styling.ts`, sin repetir el esqueleto JSX por rama `if/else`.
    - La sub-sección nueva enuncia que JSX es la forma por defecto para renderizar el elemento raíz de un nodo; el uso de `createElement` sólo se admite cuando exista una razón técnica real (por ejemplo, nombre de tag verdaderamente dinámico sin alternativa JSX limpia, como en `icon-node.tsx`).
    - La sub-sección cita como precedentes vigentes `divider-layout-node.tsx` y `button-layout-node.tsx`.
  - **Comandos durante la implementación**: ninguno (cambio doc-only).
  - **Restricciones**: la regla debe ubicarse dentro del bloque de convenciones de código de `conventions.md` (no en `standards/` ni en `architecture.md`) y debe ser coherente con el estilo y tono del resto del documento.
- **Documentación afectada**: `ai-workflow/docs/conventions.md`.
- **Criterios de finalización**:
  - Cierre de implementación: `conventions.md` contiene la nueva sub-sección con el enunciado descrito y las citas a los precedentes.

---

## Task 2 — Extraer un componente compartido de controles de paginación y adoptarlo en `RepeaterNode`

- **ID**: 0099-T2
- **Estado**: done
- **Objetivo**: Introducir un único componente React que renderice los controles de paginación (`variant: 'previousNext'` y `variant: 'numbered'`) usados por `repeater` y `table`, y sustituir la función local `renderPaginationControls` de `repeater-layout-node.tsx` por una invocación al nuevo componente. La estructura JSX y los textos ("Primera", "Anterior", números, "Siguiente", "Última"), las clases y los atributos (`type="button"`, `disabled`, `aria-current`, `data-layout-node`) resultantes en el DOM del repeater deben ser exactamente los mismos que hoy.
- **Fuera de alcance**:
  - No modificar `table-layout-node.tsx` en esta tarea (se aborda en T3).
  - No modificar `runtime-node-styling.ts` (los helpers `getRepeaterPaginationControlsClassName`, `getRepeaterPaginationButtonClassName`, `getRepeaterPaginationCurrentButtonClassName`, y sus equivalentes de tabla, se consumen tal cual desde fuera).
  - No modificar `RepeaterScrollControls` ni la lógica de scroll: la extracción cubre únicamente los controles de paginación (`previousNext` y `numbered`).
  - No cambiar la firma pública de `RepeaterNode`.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/collection-pagination-controls.tsx` (crear; expone un componente `CollectionPaginationControls`).
    - `src/runtime/nodes/repeater-layout-node.tsx` (modificar; eliminar la función local `renderPaginationControls` y consumir el nuevo componente).
  - Tests: ninguno nuevo (ver sub-bloque).
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Con `pagination.controls.variant: 'previousNext'` y varias páginas, el repeater sigue renderizando exactamente dos botones "Anterior" y "Siguiente" dentro de un contenedor con `data-layout-node="repeater-pagination"` y las mismas clases que hoy.
    - Con `pagination.controls.variant: 'numbered'` y varias páginas, el repeater sigue renderizando los botones "Primera", "Anterior", los números de página del window actual, "Siguiente" y "Última", con el botón de la página activa marcado con `aria-current="page"` y la clase `getRepeaterPaginationCurrentButtonClassName()`.
    - Los `disabled` de "Anterior"/"Primera" y "Siguiente"/"Última" siguen respondiendo a `canGoPrevious` y `canGoNext`.
    - Los clicks de cada botón siguen invocando `setActivePage` con el mismo valor que hoy (1, `page - 1`, número concreto, `page + 1`, `totalPages`).
    - La clase del contenedor sigue dependiendo de `parentGridColumns` a través de `getRepeaterPaginationControlsClassName(parentGridColumns)`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx`
  - **Restricciones**:
    - El componente compartido debe aceptar por props las funciones que resuelven las clases (`containerClassName`, `buttonClassName`, `currentButtonClassName`) y el valor del atributo `data-layout-node` que corresponde a cada nodo consumidor, para que T3 pueda reusarlo con los helpers de tabla sin colapsar semántica visual entre ambos nodos (spec, caso límite 1).
    - No introducir dependencias nuevas ni tocar `runtime-collection-pagination.ts` (los helpers de modelo `createCollectionPaginationModel`, `createNumberedPaginationWindow` se consumen tal cual).
    - El repeater debe seguir invocando `getRepeaterPaginationControlsClassName(parentGridColumns)` para calcular la clase del contenedor; el componente compartido no debe hardcodear ese cálculo.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `RepeaterNode` ya no contiene la función `renderPaginationControls` local; renderiza los controles a través de `CollectionPaginationControls`; `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx` pasa sin cambios en las aserciones del fichero.

---

## Task 3 — Adoptar el componente compartido de paginación en `TableNode`

- **ID**: 0099-T3
- **Estado**: done
- **Objetivo**: Sustituir la función local `renderPaginationControls` de `table-layout-node.tsx` por una invocación al componente `CollectionPaginationControls` introducido en T2, preservando exactamente el HTML, las clases (`getTablePaginationControlsClassName`, `getTablePaginationButtonClassName`, `getTablePaginationCurrentButtonClassName`), los atributos ARIA y `data-layout-node="table-pagination"` que se emiten hoy.
- **Fuera de alcance**:
  - No tocar `TableScrollControls` ni la lógica de scroll de la tabla.
  - No modificar `renderFilterControls`, `renderHeaderCell` ni ningún otro helper local no relacionado con paginación.
  - No colapsar los helpers de estilos de tabla y repeater en uno solo, aunque las clases actuales sean idénticas (spec, caso límite 1): la resolución debe seguir pasando por los helpers específicos de tabla.
  - No cambiar la firma pública de `TableNode`.
- **Dependencias**: T2.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/table-layout-node.tsx` (modificar; eliminar la función local `renderPaginationControls` y consumir `CollectionPaginationControls`).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Con `pagination.controls.variant: 'previousNext'` en una tabla, siguen apareciendo dos botones "Anterior" y "Siguiente" dentro de un contenedor con `data-layout-node="table-pagination"` y las mismas clases que hoy.
    - Con `pagination.controls.variant: 'numbered'` en una tabla, siguen apareciendo los botones "Primera", "Anterior", los números del window, "Siguiente" y "Última", con `aria-current="page"` en la página activa y `getTablePaginationCurrentButtonClassName()` aplicado al botón activo.
    - Los `disabled` de "Anterior"/"Primera" y "Siguiente"/"Última" siguen respondiendo a `canGoPrevious` y `canGoNext`.
    - Los clicks siguen invocando `setActivePage` con los mismos valores (1, `page - 1`, número concreto, `page + 1`, `totalPages`).
    - El bloque de scroll (`TableScrollControls`) sigue funcionando sin regresión: sentinela con `data-layout-node="table-scroll-sentinel"` cuando `IntersectionObserver` está disponible; botón "Mostrar más" con `data-layout-node="table-pagination"` cuando no lo está.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-table-pagination.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx` (regresión: el componente compartido sigue sirviendo a ambos consumidores tras esta tarea).
  - **Restricciones**:
    - Pasar al componente compartido los helpers específicos de tabla (`getTablePaginationControlsClassName`, `getTablePaginationButtonClassName`, `getTablePaginationCurrentButtonClassName`) y el valor `"table-pagination"` para `data-layout-node`.
    - No modificar la función `setActivePage` ni su lógica de reset por `paginationStateKey`.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `TableNode` ya no contiene la función `renderPaginationControls` local; renderiza los controles a través de `CollectionPaginationControls`; ambas suites de paginación pasan sin cambios en sus aserciones.

---

## Task 4 — Refactorizar `StatNode` para eliminar duplicación de JSX por variante

- **ID**: 0099-T4
- **Estado**: done
- **Objetivo**: Sustituir las tres ramas `if (variant === 'tinted') { ... } if (variant === 'plain') { ... } // accent (default)` de `stat-layout-node.tsx` por una única estructura JSX cuya selección de clases se resuelva mediante un lookup por variante o mediante helpers delegados de `runtime-node-styling.ts`, sin repetir el esqueleto (`<div data-layout-node="stat">`, `<div className="flex items-center gap-3">`, `<IconNode>`, `<div>`, `<p>`, `<p>`). El HTML final, las clases Tailwind, la tolerancia de color (`accent` y `plain` ignoran `props.color` a nivel visual) y los atributos deben ser exactamente los mismos.
- **Fuera de alcance**:
  - No tocar los helpers de `runtime-node-styling.ts` (`getStatAccentRootClassName`, `getStatAccentIconClassName`, `getStatAccentLabelClassName`, `getStatAccentValueClassName` y los equivalentes `Tinted` y `Plain`).
  - No cambiar la firma pública de `StatNode` ni las props del nodo.
  - No añadir variantes nuevas.
  - No cambiar la resolución de referencias `label`/`value` (`resolveRuntimeTextReference` con la misma clave y opciones).
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/stat-layout-node.tsx` (modificar; una única expresión JSX en el return, sin bloques `if` que dupliquen JSX).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-stat.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Variante `accent` (default): raíz con `data-layout-node="stat"` y clase `getStatAccentRootClassName(color)`; icono con `getStatAccentIconClassName(color)`; label con `getStatAccentLabelClassName()`; value con `getStatAccentValueClassName()`.
    - Variante `tinted`: raíz con `getStatTintedRootClassName(color)`; icono con `getStatTintedIconClassName(color)`; label con `getStatTintedLabelClassName(color)`; value con `getStatTintedValueClassName(color)`.
    - Variante `plain`: raíz con `getStatPlainRootClassName()`; icono con `getStatPlainIconClassName()`; label con `getStatPlainLabelClassName()`; value con `getStatPlainValueClassName()`.
    - `props.color` sigue ignorada a nivel visual en `accent` y `plain` (los helpers de esas variantes no reciben color y no se debe reintroducir dependencia).
    - `label` y `value` siguen interpolándose vía `resolveRuntimeTextReference` con clave `'stat.props.label'` y `'stat.props.value'`.
    - Comportamiento transversal (visibility, queryStateFeedback, layout.span, integración en repeater y form) sigue igual.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-stat.test.tsx`
  - **Restricciones**:
    - La estructura interna (`<div className="flex items-center gap-3">` con icono y `<div>` interno con dos `<p>`) debe permanecer literalmente idéntica en el DOM resultante.
    - Se admite un objeto de lookup por variante que resuelva las cuatro clases (root/icon/label/value) a partir de la variante y el color, siempre que no reintroduzca dependencia de color en `accent`/`plain` (los helpers correspondientes no reciben color).
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `stat-layout-node.tsx` no contiene bloques `if` que devuelvan JSX; hay un único `return` con la estructura común y la resolución de clases por variante centralizada; la suite pasa sin cambios en aserciones.

---

## Task 5 — Refactorizar `SkeletonNode` para eliminar duplicación de JSX por variante

- **ID**: 0099-T5
- **Estado**: done
- **Objetivo**: Sustituir las tres ramas `if (variant === 'text') { ... } if (variant === 'circle') { ... } // rect (default)` de `skeleton-layout-node.tsx` por una estructura que resuelva la composición de clases (y, en el caso de `text`, la iteración de líneas) mediante un lookup por variante, sin repetir el esqueleto `<div data-layout-node="skeleton">` ni la lógica de composición de utilidades Tailwind (`filter(Boolean).join(' ')`).
- **Fuera de alcance**:
  - No tocar los helpers `getSkeletonBaseClassName` ni `getSkeletonAnimateClassName`.
  - No introducir un componente hijo separado para `text` (la variante `text` renderiza N líneas y su implementación puede quedar dentro del mismo módulo; el objetivo es eliminar la duplicación del esqueleto y de la construcción de clases, no partir el módulo).
  - No cambiar defaults (`variant='rect'`, `animate=true`, `rounded=false`, `lines=1`).
  - No cambiar la firma pública de `SkeletonNode` ni las props del nodo.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/skeleton-layout-node.tsx` (modificar; resolución por variante centralizada sin ramas `if` que dupliquen la construcción de clases o el elemento raíz).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-skeleton.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Variante `rect` (default): un único `<div data-layout-node="skeleton">` con clases `[base, block, heightClass, widthClass, roundedClass, animateClass]` (filtradas por `Boolean`, unidas por espacio); `heightClass` es `h-{height}` si `height` está definido, `h-4` en caso contrario; `widthClass` es `w-{width}` si `width` está definido, cadena vacía en caso contrario; `roundedClass` es `rounded` si `rounded`, cadena vacía en caso contrario.
    - Variante `circle`: un único `<div data-layout-node="skeleton">` con clases `[base, rounded-full, sizeClass, animateClass]`; `sizeClass` es `w-{width} h-{width}` si `width` está definido, `w-12 h-12` en caso contrario.
    - Variante `text`: un `<div data-layout-node="skeleton" className="flex flex-col gap-2 {animateClass}">` que contiene N `<div key={i}>` (N = `lines`) con clases `[base, h-3, lineWidthClass, lineRoundedClass]`; `lineWidthClass` es `w-{width}` si `width` está definido, `w-full` en caso contrario.
    - `animate=false` sigue omitiendo la clase de animación (helper devuelve cadena vacía).
    - Uso como fallback de `queryStateFeedback` sigue funcionando sin regresión.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-skeleton.test.tsx`
  - **Restricciones**:
    - Mantener el uso de `filter(Boolean).join(' ')` (u otra composición equivalente) para no emitir clases vacías; no reintroducir espacios múltiples en `className`.
    - No sustituir el `Array.from({ length: lines }, (_, i) => …)` por otra estructura si eso cambiara la key React (`i`) o el número de nodos renderizados.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `skeleton-layout-node.tsx` no contiene bloques `if` que devuelvan JSX distinto por variante; la resolución de clases por variante está centralizada en un lookup o función delegada; la suite pasa sin cambios en aserciones.

---

## Task 6 — Refactorizar `BadgeNode` para eliminar duplicación de JSX por variante

- **ID**: 0099-T6
- **Estado**: done
- **Objetivo**: Sustituir las dos ramas `if (variant === 'circle') { ... } // pill (default)` de `badge-layout-node.tsx` por una resolución por variante centralizada (lookup map o helper delegado), manteniendo idéntico el HTML resultante en cada variante y sin repetir la resolución de `label` y `color`.
- **Fuera de alcance**:
  - No tocar los helpers `getBadgePillClassName`, `getBadgeCircleDotClassName`, `getBadgeCircleLabelClassName`.
  - No añadir variantes nuevas ni cambiar los defaults (`variant='pill'`, `color='neutral'`).
  - No cambiar la firma pública de `BadgeNode` ni las props del nodo.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/badge-layout-node.tsx` (modificar; resolución por variante centralizada, sin bloques `if` que devuelvan JSX distinto).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-badge.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Variante `pill` (default): raíz `<span data-layout-node="badge">` que contiene un `<span className={getBadgePillClassName(color)}>{label}</span>`.
    - Variante `circle`: raíz `<span data-layout-node="badge" className="inline-flex items-center gap-1.5">` que contiene `<span className={getBadgeCircleDotClassName(color)} />` y `<span className={getBadgeCircleLabelClassName()}>{label}</span>`.
    - `label` se resuelve una única vez con `resolveRuntimeTextReference` (clave `'badge.props.label'`, iterationContext).
    - Comportamiento transversal (visibility, queryStateFeedback, integración en repeater y form) sigue igual.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-badge.test.tsx`
  - **Restricciones**:
    - Nótese que el `<span>` raíz emite `className="inline-flex items-center gap-1.5"` sólo en la variante `circle`, y no lleva `className` en la variante `pill`. Cualquier lookup o helper que resuelva la clase del raíz debe respetar esta asimetría: no introducir una clase vacía en `pill` ni omitir la clase en `circle`.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `badge-layout-node.tsx` no contiene bloques `if` que devuelvan JSX distinto por variante; la selección de estructura por variante se resuelve mediante un lookup o helper delegado; la suite pasa sin cambios en aserciones.

---

## Task 7 — Sustituir `createElement` por JSX en `ContainerNode`

- **ID**: 0099-T7
- **Estado**: done
- **Objetivo**: Reescribir el `return` de `container-layout-node.tsx` para renderizar el `<section>` raíz mediante JSX plano en vez de `createElement('section', …, …)`, preservando exactamente los atributos actuales (`data-layout-node="container"`, `className={styling.className}`, `style={styling.style}`) y anidando dentro el `RuntimeLayoutContextProvider` tal y como está hoy.
- **Fuera de alcance**:
  - No modificar `getContainerNodeStyling`, `getContainerNodeSurface` ni ningún otro helper.
  - No cambiar la firma pública de `ContainerNode` ni el uso de `useOptionalFormContext`, `RuntimeLayoutContextProvider` o el objeto `styling.style`.
  - No introducir cambios en la resolución de `parentGridColumns`.
  - No añadir memoización ni cambios estructurales que alteren la identidad de children.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/container-layout-node.tsx` (modificar; eliminar `import { createElement } from 'react'` y sustituir `createElement('section', …, …)` por JSX equivalente).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-container.test.tsx` (suite existente, sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - El nodo raíz sigue siendo `<section data-layout-node="container">` con `className` y `style` provenientes de `getContainerNodeStyling(...)`.
    - `direction`, `gap`, `columns`, `variant`, `align`, `justify` y `wrap` siguen resolviéndose exactamente igual (los helpers no cambian).
    - `RuntimeLayoutContextProvider` sigue recibiendo `parentGridColumns` según `node.props?.columns ?? null` y envolviendo a los children.
    - `getContainerNodeSurface({ withinForm: formContext !== null, direction, columns })` sigue alimentando `styling.surface`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-container.test.tsx`
  - **Restricciones**:
    - Debe seguir siendo posible pasar `style={styling.style}` como prop directa; no convertir `style` en `className` ni fusionarlo con otras utilidades.
    - `import { createElement } from 'react'` debe eliminarse si deja de usarse; no dejar imports muertos.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `container-layout-node.tsx` no invoca `createElement`; la suite pasa sin cambios en aserciones.

---

## Task 8 — Sustituir `createElement` por JSX en `HeadingNode` preservando el tag dinámico

- **ID**: 0099-T8
- **Estado**: done
- **Objetivo**: Reescribir el `return` de `heading-layout-node.tsx` para renderizar el elemento raíz mediante JSX plano en vez de `createElement(getHeadingTag(...), …, …)`, preservando (a) la resolución dinámica del tag `h1`–`h6` a partir de `props.level` mediante `getHeadingTag`, (b) los atributos actuales (`data-layout-node="heading"`, `className={getHeadingNodeClassName(node.props.level)}`), y (c) el orden de hijos (icono antes del texto).
- **Fuera de alcance**:
  - No modificar `getHeadingTag`, `getHeadingNodeClassName` ni ningún otro helper de estilos.
  - No cambiar la firma pública de `HeadingNode` ni la interpolación de `text` (`resolveRuntimeTextReference` con clave `'heading.props.text'` sigue igual).
  - No cambiar el marcado del icono (`<IconNode name={node.props.icon} className="size-[1em] shrink-0 inline-block align-middle mr-2" />`).
  - No delegar el tag dinámico en un mapa de componentes ni en un switch: la resolución debe seguir pasando por `getHeadingTag`.
- **Dependencias**: T1.
- **Impacto esperado en archivos**:
  - Código:
    - `src/runtime/nodes/heading-layout-node.tsx` (modificar; eliminar `import { createElement } from 'react'` si deja de usarse y sustituir por JSX con tag dinámico vía variable en PascalCase, p. ej. `const Tag = getHeadingTag(node.props.level); return <Tag …>…</Tag>`).
  - Tests: ninguno nuevo.
  - Documentación: ninguno.
- **Tests**:
  - **Ficheros de test**: ninguno nuevo; cubierto por: `src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx` (suite existente, cubre entradas `type: 'heading'` con distintos `level`; sin modificar aserciones sobre el DOM).
  - **Comportamiento cubierto**:
    - Para cada `level` de 1 a 6, el nodo raíz sigue siendo el tag `hN` correspondiente devuelto por `getHeadingTag`, con `data-layout-node="heading"` y `className` proveniente de `getHeadingNodeClassName(level)`.
    - El primer hijo sigue siendo el `IconNode` con las clases actuales; el segundo hijo sigue siendo el texto resuelto por `resolveRuntimeTextReference`.
    - La interpolación de referencias en `text` sigue funcionando (referencias resueltas y no resueltas devuelven exactamente el mismo string que hoy).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-basic-nodes.test.tsx`
  - **Restricciones**:
    - La variable que sostiene el tag dinámico en JSX debe empezar por mayúscula (requisito de JSX) para que React la interprete como componente/tag válido.
    - Tipar la variable como `keyof JSX.IntrinsicElements` (o equivalente compatible con el tipado del proyecto) si el tipado exige una anotación explícita para admitir el tag dinámico; no usar `any`.
    - No colar `dangerouslySetInnerHTML` ni cambios en el escapado del texto.
- **Documentación afectada**: ninguno.
- **Criterios de finalización**:
  - Cierre de implementación: `heading-layout-node.tsx` no invoca `createElement`; el tag sigue siendo dinámico `h1`–`h6` según `props.level`; la suite pasa sin cambios en aserciones.

---

## Cierre de la feature

Cuando las ocho tareas queden en `done`, el conjunto `stat`, `skeleton`, `badge`, `repeater`, `table`, `container` y `heading` debe estar libre de duplicación de JSX por variante y de `createElement` innecesario, sin diferencias observables respecto al estado previo. `divider`, `button` e `icon-node` permanecen intactos. La actualización documental amplia (fichas de `docs/app-features/`) queda fuera de este plan y no es necesaria: el refactor no altera comportamiento observable. La única documentación afectada dentro del alcance de la feature es la sub-sección nueva de `conventions.md` producida en T1.
