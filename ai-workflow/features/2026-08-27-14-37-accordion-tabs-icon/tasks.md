# Tasks: icono decorativo en accordion y en items de tabs

Contrato de ejecución para `implement-task-test-first`. Cada tarea es atómica, se implementa con enfoque tests-first y no requiere reinterpretar la feature. Orden de ejecución: T1 → T2 → T3 → T4 → T5 (T3 puede empezar en paralelo a T1/T2 si el flujo de trabajo lo permite; T4 y T5 solo requieren T3 cerrada, no entre sí).

Precedente reutilizado en toda la feature: `props.icon` como nombre de icono Lucide React, resuelto por `IconNode` (`src/runtime/nodes/icon-node.tsx`) — ya usado sin cambios por `button`, `link`, `stat`, `heading`, `paragraph`, `input`. Ninguna tarea de este plan modifica `icon-node.tsx` ni `icon-name-case.ts`: se consumen tal cual.

---

## T1 — Contrato de configuración: `accordion.props.icon`

### Objetivo
Añadir `props.icon` (string opcional) al contrato de configuración del nodo `accordion`: schema Zod, tipo TypeScript y validador, con la misma laxitud que ya tiene `button.props.icon` (cualquier string se acepta en config; la resolución contra el catálogo Lucide y su fallo silencioso son responsabilidad del render, no de esta tarea).

Como consecuencia automática y sin código adicional, el panel de propiedades del editor visual (`layout-canvas-properties-panel.tsx`) mostrará el selector visual de icono (`IconPickerPropertyField`) para `accordion.props.icon`, porque `resolveIconPropsSchema` ya intercepta por convención de nombre de campo (`icon`) el `props` de **cualquier** tipo de nodo, sin lista explícita de tipos que mantener (ver comentario en `layout-canvas-properties-panel.tsx:226-234`). Esta tarea debe verificar ese comportamiento con un test, no implementarlo.

### Fuera de alcance
- Renderizar el icono en el DOM del header del accordion (T2).
- `props.iconPosition` en `accordion`: no existe, no se declara en ningún schema ni tipo.
- Cualquier cambio en `tabs` (T3/T4/T5).
- Cualquier cambio en `icon-node.tsx`, `icon-name-case.ts` o en el dispatcher del panel de propiedades (`property-field-dispatcher.tsx`, `resolveIconPropsSchema`).

### Dependencias
Ninguna. Puede implementarse primero.

### Interfaces
**Consume**: ninguno.

**Produce**: `AccordionLayoutNode.props.icon?: string` (de T1) — consumido por: T2.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-zod.ts`: en `accordionNodeSchema` (línea ~684), añadir `icon: z.string().optional()` al objeto `props`, en el mismo estilo que `defaultOpen`/`groupId`.
  - `src/config/runtime-config-types.ts`: en `AccordionLayoutNode.props` (línea ~522), añadir `icon?: string`.
  - `src/config/validate-accordion-node.ts`: en el objeto `node` devuelto por `validateAccordionNode` (bloque `props: { label, defaultOpen, groupId }`, línea ~88), añadir `icon: parseResult.data.props.icon`. No añadir una rama de error específica para `icon` en el bloque de mapeo de issues (líneas 17-51): un `icon` con tipo inválido debe caer en la rama genérica ya existente `if (issuePath[0] === 'props')` (línea 46), igual que ocurre hoy con cualquier prop de `button` sin rama dedicada.
- Tests:
  - `src/tests/config-validation/runtime-config-validation-accordion.test.ts` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
- Documentación a revisar: `ai-workflow/docs/app-features/nodes/accordion.md` (tabla de `Props`: añadir fila `props.icon`; sección "Validación previa al render": no requiere entrada propia, se comporta como el resto de props sin rama dedicada).

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-accordion.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un `accordion` con `props.icon: "ChevronRight"` (string no vacío) se acepta y el nodo validado resultante expone `props.icon === "ChevronRight"`.
- Un `accordion` sin `props.icon` se acepta y el nodo validado resultante tiene `props.icon === undefined` (regresión: comportamiento idéntico al actual).
- Un `accordion` con `props.icon` de tipo no-string (por ejemplo `props.icon: 42`) se rechaza antes del render (config completo inválido).
- En `layout-canvas-properties-panel.test.tsx`, añadir `accordion` al mapa `ICON_NODE_BUILDERS` (o un test equivalente aislado si el mapa no es directamente extensible sin tocar otros tipos) con builder `(icon) => ({ type: 'accordion', props: { label: 'Sección', ...(icon !== undefined ? { icon } : {}) } })`, de forma que el `describe.each` existente en el bloque `LayoutCanvasPropertiesPanel icon widget (T2, 0129)` (línea ~2306) verifique también para `accordion` que se renderiza el grid `role="grid" name="icon"` con la celda del icono actual seleccionada, en vez de un `textbox` genérico.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-accordion.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones**:
- No introducir una entrada nueva en `WIDGET_REGISTRY` ni en `resolveIconPropsSchema`: el objetivo del test en `layout-canvas-properties-panel.test.tsx` es confirmar que el mecanismo genérico ya existente cubre `accordion` sin cambios en ese fichero.

### Criterios de finalización
- `accordionNodeSchema`, `AccordionLayoutNode` y `validateAccordionNode` aceptan y propagan `props.icon` como string opcional.
- Los tests listados están en verde y cubren aceptación, ausencia (regresión) y rechazo por tipo inválido, además de la exposición automática del widget de icono en el panel de propiedades.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T2 — Render: icono en la cabecera de `accordion`

### Objetivo
Renderizar `node.props.icon` en la cabecera del `accordion`, siempre a la izquierda de `props.label`, sin afectar la posición del chevron (que permanece fijo en el extremo derecho de la cabecera). Un icono ausente o que no resuelve a un icono Lucide conocido no debe alterar el render actual del header (sin salto de layout).

### Fuera de alcance
- El contrato de configuración de `props.icon` (T1, ya cerrada como prerequisito).
- Cualquier cambio en `tabs` (T3/T4/T5).
- Cambios en la lógica de coordinación de grupos, apertura/cierre o transición del cuerpo del accordion.
- Cambios en `runtime-node-styling-accordion.ts`: no se necesita ningún helper de estilo nuevo: el icono usa clases utilitarias inline en el propio JSX, igual que hace `button-layout-node.tsx` con `IconNode`.

### Dependencias
T1 (requiere `AccordionLayoutNode.props.icon?: string` ya expuesto en el tipo del nodo).

### Interfaces
**Consume**: `AccordionLayoutNode.props.icon?: string` (de T1).

**Produce**: ninguno.

### Impacto esperado en archivos
- Código: `src/runtime/nodes/accordion-layout-node.tsx`.
  - Importar `IconNode` desde `./icon-node` (mismo import que usa `button-layout-node.tsx`).
  - Reestructurar el contenido del `<button data-layout-node="accordion-header">` (líneas 106-121 actuales) de:
    ```
    <span>{resolvedLabel}</span>
    <svg data-layout-node="accordion-chevron" ...>...</svg>
    ```
    a:
    ```
    <span className="flex items-center gap-2">
      <IconNode name={node.props.icon} className="size-4 shrink-0" />
      <span>{resolvedLabel}</span>
    </span>
    <svg data-layout-node="accordion-chevron" ...>...</svg>
    ```
    El wrapper `<span className="flex items-center gap-2">` es el único cambio estructural: agrupa icono+label como un único hijo flex de la cabecera (que ya usa `flex items-center justify-between`), de modo que el chevron sigue siendo el segundo y último hijo flex, pinneado a la derecha por `justify-between`, exactamente igual que antes. Cuando `node.props.icon` es `undefined` o no resuelve a un icono Lucide, `IconNode` devuelve `null` (comportamiento ya existente, sin cambios) y el wrapper solo contiene el `<span>{resolvedLabel}</span>`, preservando el render actual.
- Tests: `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación).
- Documentación a revisar: `ai-workflow/docs/app-features/nodes/accordion.md` (sección "Comportamiento": documentar la posición fija del icono a la izquierda del label y su independencia del chevron).

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-accordion.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un accordion con `props.icon: "ChevronRight"` (nombre válido) renderiza un elemento icono dentro de `[data-layout-node="accordion-header"]`, antes del texto del label en el DOM, y `[data-layout-node="accordion-chevron"]` sigue presente y sin cambios de posición (último hijo flex del header).
- El icono renderizado tiene `aria-hidden="true"` (heredado de `IconNode`) y no forma parte del nombre accesible adicional del botón de cabecera.
- Un accordion con `props.icon` con nombre inválido (no Lucide, por ejemplo `"NoExiste"`) renderiza la cabecera exactamente igual que sin `props.icon`: ningún elemento icono en el DOM, label y chevron intactos, sin error.
- Un accordion sin `props.icon` renderiza la cabecera exactamente igual que antes de esta tarea (regresión): mismo `textContent` del header, mismo chevron.
- Un accordion con `groupId` y `props.icon` declarado: el icono se comporta igual en todas las instancias del grupo (test de humo combinando ambos, reutilizando el patrón ya existente de tests de `groupId` en este fichero).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-accordion.test.tsx
```

**Restricciones**:
- No usar `container.querySelector` sobre clases de Tailwind arbitrarias para localizar el icono; usar el tipo de elemento SVG que expone Lucide (por ejemplo, contar los `<svg>` dentro del header, o usar el propio testing-library sobre el `data-layout-node="accordion-header"]` como raíz de búsqueda) para no acoplar el test a una clase de utilidad concreta.

### Criterios de finalización
- El header de `accordion` renderiza el icono a la izquierda del label cuando `props.icon` resuelve a un icono Lucide válido, sin mover el chevron.
- Los tests listados están en verde, incluyendo el caso de icono inválido y el caso de ausencia de `props.icon` (regresión).

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T3 — Contrato de configuración: `tabs.props.items[].icon`

### Objetivo
Añadir `icon` (string opcional) a cada item de `tabs.props.items`: schema Zod (`tabsItemSchema`), tipo TypeScript (`TabsItem`) y el bucle manual de construcción de items en `validateTabsNode`, con la misma laxitud de aceptación que T1 (cualquier string se acepta en config; el fallo silencioso ante un nombre no resoluble es responsabilidad del render).

### Fuera de alcance
- Renderizar el icono en la barra de tabs (T4).
- Exponer el widget visual de selección de icono para `items[].icon` en el panel de propiedades del editor (T5): esta tarea solo cambia el contrato de datos, no el editor visual.
- `accordion` (T1/T2, independientes).
- Cualquier campo de posición de icono (`iconPosition`): no existe, no se declara.

### Dependencias
Ninguna. Puede implementarse en paralelo a T1/T2.

### Interfaces
**Consume**: ninguno.

**Produce**: `TabsItem.icon?: string` (de T3) — consumido por: T4, T5.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-zod.ts`: en `tabsItemSchema` (línea ~650), añadir `icon: z.string().optional()` junto a `label`/`children`/`visibility`.
  - `src/config/runtime-config-types.ts`: en `TabsItem` (línea ~505), añadir `icon?: string`.
  - `src/config/validate-tabs-node.ts`: dentro del bucle `for (let index = 0; index < rawItems.length; index += 1)` (líneas 84-116), leer `icon` del `rawItem` ya validado por Zod (`typeof rawItem.icon === 'string' ? rawItem.icon : undefined`, mismo patrón defensivo que ya usa la construcción manual del resto de campos de este bucle, que reconstruye desde `rawItem` en vez de desde `parseResult.data`) y añadirlo al objeto empujado en `normalizedItems.push({ label: rawItem.label, children, visibility: itemVisibilityResult.visibility, icon })` (línea 115). No añadir una rama de error dedicada a `items[].icon` en el bloque de mapeo de issues (líneas 18-57): un `icon` con tipo inválido en un item ya falla el `parseResult` de `tabsItemSchema` antes de llegar al bucle manual, y cae en la rama genérica existente `if (issuePath[0] === 'props' && issuePath[1] === 'items')` (línea 49).
- Tests: `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (ampliación).
- Documentación a revisar:
  - `ai-workflow/docs/app-features/nodes/tabs.md` (tabla "Estructura de cada item de `props.items`": añadir fila `icon`).
  - `ai-workflow/docs/app-features/config/validation.md` (sección "Reglas del nodo `tabs`", línea ~120: reflejar que cada item admite `icon` opcional).

### Tests

**Ficheros de test**:
- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (ampliación)

**Comportamiento cubierto**:
- Un `tabs` con un item que declara `icon: "Star"` (string no vacío) se acepta y el item validado resultante expone `icon === "Star"`.
- Un `tabs` con un item sin `icon` se acepta y el item validado resultante tiene `icon === undefined` (regresión).
- Un `tabs` con dos items, uno con `icon` válido y otro sin `icon`, se acepta y cada item conserva su propio valor de `icon` de forma independiente (ninguno de los dos hereda o comparte el valor del otro).
- Un `tabs` con un item cuyo `icon` es de tipo no-string (por ejemplo `icon: true`) se rechaza antes del render (config completo inválido).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts
```

**Restricciones**: ninguna adicional a `ai-workflow/standards/testing-rules.md`.

### Criterios de finalización
- `tabsItemSchema`, `TabsItem` y `validateTabsNode` aceptan y propagan `icon` por item de forma independiente.
- Los tests listados están en verde, incluyendo aceptación por item, independencia entre items y rechazo por tipo inválido.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T4 — Render: icono en cada item de la barra de `tabs`

### Objetivo
Renderizar `item.icon` en el botón de cada tab de la barra, siempre a la izquierda del label de ese item, aplicado de forma independiente por item (un item puede tener icono y otro no). Un icono ausente o inválido no debe alterar el render actual del botón del tab.

### Fuera de alcance
- El contrato de configuración de `items[].icon` (T3, ya cerrada como prerequisito).
- El widget visual de selección de icono en el editor (T5).
- `accordion` (T1/T2, independiente).
- Cambios en `runtime-node-styling-tabs.ts`: no se necesita ningún helper de estilo nuevo; el icono usa clases utilitarias inline en el propio JSX, siguiendo el mismo patrón inline (sin wrapper flex) que usan `heading-layout-node.tsx` y `link-layout-node.tsx`.

### Dependencias
T3 (requiere `TabsItem.icon?: string` ya expuesto en el tipo del item).

### Interfaces
**Consume**: `TabsItem.icon?: string` (de T3).

**Produce**: ninguno.

### Impacto esperado en archivos
- Código: `src/runtime/nodes/tabs-layout-node.tsx`.
  - Importar `IconNode` desde `./icon-node`.
  - En `TabsNodeContent`, dentro del `.map` que construye cada `<button>` de la barra (líneas 85-105), insertar `IconNode` inmediatamente antes de `{resolvedLabel}`:
    ```
    <IconNode name={item.icon} className="size-4 shrink-0 inline-block align-middle mr-2" />
    {resolvedLabel}
    ```
    Este patrón (icono inline con `mr-2`, sin wrapper flex adicional) es el mismo que ya usa `heading-layout-node.tsx` para `props.icon` y no requiere tocar `getTabsButtonClassName` ni la estructura del `<button>` existente. Cuando `item.icon` es `undefined` o no resuelve, `IconNode` devuelve `null` y el botón renderiza igual que antes.
- Tests: `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación).
- Documentación a revisar: `ai-workflow/docs/app-features/nodes/tabs.md` (sección "Comportamiento visual de la barra de tabs y el panel", subsección "Barra de tabs": documentar la posición fija del icono a la izquierda del label del tab).

### Tests

**Ficheros de test**:
- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un `tabs` con dos items, el primero con `icon: "Star"` (válido) y el segundo sin `icon`, renderiza el icono solo dentro del botón del primer tab (antes de su label en el DOM); el botón del segundo tab se renderiza igual que antes de esta tarea.
- Un item de `tabs` con `icon` inválido (no Lucide) renderiza su botón exactamente igual que si no hubiera declarado la prop, sin error.
- El icono de un tab se renderiza igual en orientación `"vertical"` que en `"horizontal"` (test de humo reutilizando el setup ya existente de orientación en este fichero).
- Un item oculto por `visibility` no aparece en la barra, por lo que su `icon` tampoco se renderiza (se cubre por la ausencia total del botón; test de regresión mínimo, no requiere lógica nueva).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx
```

**Restricciones**:
- No usar `container.querySelector` sobre clases de Tailwind arbitrarias para localizar el icono; contar los `<svg>` dentro del botón del tab correspondiente o usar el propio testing-library sobre el `role="tablist"`/botón concreto.

### Criterios de finalización
- Cada botón de tab renderiza su propio icono a la izquierda del label cuando `item.icon` resuelve a un icono Lucide válido, de forma independiente por item.
- Los tests listados están en verde, incluyendo el caso mixto (un item con icono, otro sin) y el caso de icono inválido.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## T5 — Editor visual: widget de icono para `tabs.props.items[].icon`

### Objetivo
Exponer el mismo selector visual de icono (`IconPickerPropertyField`) que ya usan `button`/`heading`/`paragraph`/`link`/`stat`/`input`/`accordion` (esta última vía T1, automática) para el campo `icon` de cada item dentro del editor de `tabs.props.items` en el panel de propiedades, en vez de dejarlo caer en el control de texto genérico. `tabs.props.items` no pasa por `resolveIconPropsSchema` (que solo actúa sobre el nivel superior de `props`, no sobre el sub-schema de cada item de un array): requiere una extensión explícita de `resolveTabsPropsSchema`.

### Fuera de alcance
- El contrato de configuración de `items[].icon` (T3, ya cerrada como prerequisito).
- El render en runtime de la barra de tabs (T4, independiente de esta tarea).
- `accordion`: no requiere ninguna tarea equivalente, ya cubierta automáticamente por T1 sin cambios en este fichero.
- Cualquier cambio en `WIDGET_REGISTRY` o en el hook genérico `x-widget` del dispatcher (`property-field-dispatcher.tsx`): esta tarea solo modifica qué sub-schema recibe la etiqueta `x-widget: 'icon'`, no el mecanismo de resolución en sí.

### Dependencias
T3 (requiere `TabsItem.icon?: string` ya expuesto en el tipo del item; no depende de T4).

### Interfaces
**Consume**: `TabsItem.icon?: string` (de T3).

**Produce**: ninguno.

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`, función `resolveTabsPropsSchema` (línea ~436-466).
  - En el bucle que construye `visibleItemProperties` a partir de `itemProperties` (líneas 451-455, que ya excluye `children`), cuando la clave iterada sea `icon`, sustituir su sub-schema por `{ 'x-widget': 'icon' }` antes de incluirlo en `visibleItemProperties`, replicando el mismo patrón de sustitución puntual por clave que ya usan `resolveIconPropsSchema` (línea 236) y `resolveHeadingPropsSchema` (línea 213) para `props.icon` a nivel de nodo, pero aplicado aquí a nivel de propiedad de item dentro del array. El resto de la función (incluida la lógica de `label` con `NEW_TAB_DEFAULT_LABEL`, líneas 456-460) no cambia.
- Tests: `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- Documentación a revisar: ninguna (comportamiento interno del editor visual, no documentado a nivel de ficha funcional de `tabs.md`).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto**:
- Un nodo `tabs` con al menos un item que declara `icon: "Home"` renderiza, al editar ese item en el panel de propiedades, el mismo grid de selección (`role="grid"`, con la celda del icono actual marcada `aria-selected="true"`) que usa el widget de icono en el resto de nodos, en vez de un `textbox` genérico para ese campo.
- Seleccionar un icono distinto en el grid para el `icon` de un item concreto confirma (`onCommitNodeUpdate`) el nuevo valor únicamente en ese item, preservando `label`, `visibility`/`children` de ese item y de los demás items sin cambios.
- Un nodo `tabs` cuyos items no declaran `icon` sigue mostrando el resto de campos del editor de items (`label`) sin regresión.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones**:
- Reusar el helper de item-array existente en el fichero (`props.items` de `tabs`, bloque `describe('LayoutCanvasPropertiesPanel tabs node props.items (RF2, 0105)'`, línea ~740) como referencia de cómo se construyen y comprometen los nodos `tabs` de prueba en este fichero, en vez de introducir un mecanismo de fixture distinto.

### Criterios de finalización
- El panel de propiedades muestra el widget de selección visual de icono para `tabs.props.items[].icon`, con el mismo comportamiento de selección/limpieza que el resto de nodos con `icon`.
- Los tests listados están en verde.

### Cierre de implementación
Código y tests de la tarea completos y validados.

---

## Siguiente tarea a escoger
T1. Es la de menor riesgo (nodo sin estructura de items anidada), deja el patrón de contrato establecido para T3, y su tarea de render (T2) es la más simple de las dos tareas de render.
