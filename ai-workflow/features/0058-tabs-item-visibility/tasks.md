# Plan de implementación: visibilidad por tab individual en el nodo `tabs` (0058)

## Resumen

Tres tareas secuenciales:

1. Esquema Zod y validación previa al render del campo `visibility` por item de `props.items` en el nodo `tabs`, reutilizando la lógica transversal de `visibility`.
2. Render dinámico del nodo `tabs`: filtrar items por `visibility` en cada render, selección segura del tab activo (default y fallback cuando el activo queda oculto, no renderizar si no hay visibles).
3. Actualizar `src/dev/config.json` con un ejemplo funcional que ejercite `visibility` por item, para permitir verificación visual en modo desarrollo.

La validación previa reutiliza `validateVisibility` ya existente. La evaluación en runtime reutiliza `matchesVisibilityRule` ya existente. Esta feature no introduce lógica de evaluación nueva, solo aplica las primitivas existentes en una nueva ubicación (por item) y resuelve el problema de selección de tab activo.

---

## Tarea 01 — Schema Zod y validación previa al render de `visibility` por item

**ID:** T01
**Estado:** completada
**Depende de:** ninguna (primera tarea)

### Objetivo

Permitir que cada item de `props.items` en el nodo `tabs` declare opcionalmente un campo `visibility` con el mismo shape transversal del runtime (`{ reference, operator, value? }`). El config debe rechazarse antes del render si el `visibility` de cualquier item incumple el shape (referencia fuera de alcance, operador no reconocido, combinación `value`/operador inválida).

### Fuera de alcance

- Filtrado en runtime ni selección automática de tab activo (T02).
- Modificación de `src/dev/config.json` (T03).
- Cambios en la lógica de `visibility` transversal del nodo `tabs` completo (sigue funcionando como hasta ahora sin modificación).
- Soporte de `visibility` en otros campos del nodo `tabs` (p. ej. `props.orientation`, `defaultTab`).

### Dependencias

Ninguna.

### Impacto esperado en archivos

**Código a modificar:**

- `src/config/runtime-config-types.ts`
  - Añadir el campo opcional `visibility?: RuntimeVisibilityConfig` a la interfaz `TabsItem`.
- `src/config/runtime-config-zod.ts`
  - Reescribir `tabsItemSchema` para incluir `visibility: visibilitySchema.optional()` (el schema interno ya existe en este fichero).
  - Mantener `.strip()` para descartar claves no soportadas.
- `src/config/validate-layout-nodes.ts`
  - En `validateTabsNode`, dentro del bucle por item de `rawItems`, invocar `validateVisibility(rawItem.visibility as LayoutNodeFeedbackFields['visibility'], '${path}.props.items[${index}].visibility', pageId)` antes de procesar `children`. Si devuelve `error`, propagar el error.
  - Si devuelve `ready`, asignar el `visibility` normalizado al item normalizado: `normalizedItems.push({ label, children, visibility })`.
  - En la rama de error de parseo Zod de `validateTabsNode` (bloque `if (!parseResult.success)`), añadir antes del bloque genérico `if (issuePath[0] === 'props' && issuePath[1] === 'items')` una rama explícita que detecte errores en el campo `visibility` por item:
    - Si `issuePath[0] === 'props' && issuePath[1] === 'items' && typeof issuePath[2] === 'number' && issuePath[3] === 'visibility'`, formatear los segmentos restantes (`reference`, `operator`, `value`) con el mismo helper `formatPathSegment` que usa `mapVisibilityIssue` (importable desde `validate-actions-visibility.ts`) y devolver `invalidLayout` con la ruta `${path}.props.items[${issuePath[2]}].visibility${segmentosFormateados}`.
  - Justificación: `mapVisibilityIssue` ya existe pero solo dispara cuando `issuePath[0] === 'visibility'` (es decir, `visibility` a nivel del nodo); para `visibility` por item, hace falta esta rama nueva específica en `validateTabsNode`.

**Tests a modificar:**

- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (ampliación)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/nodes/tabs.md`
- `ai-workflow/docs/app-features/references/visibility.md`
- `ai-workflow/features/index.md`

### Tests

**Ficheros de test:**

- `src/tests/config-validation/runtime-config-validation-tabs.test.ts` (ampliación)

**Comportamiento cubierto:**

- Un nodo `tabs` cuyos items declaran `visibility` válido con cada uno de los operadores (`equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`) sobre referencias `forms.*`, `queries.*`, `queries.*.data`, `queries.*.data.*`, `params.*` e `item.*` produce `status: 'ready'`.
- Un item sin `visibility` declarada produce `status: 'ready'` (regresión: comportamiento previo no cambia).
- Un nodo `tabs` con `visibility` a nivel del propio nodo y a nivel de algún item simultáneamente produce `status: 'ready'`.
- Un nodo `tabs` con `props.items[i].visibility.reference` que sale del alcance soportado (p. ej. `"foo.bar"`) produce `status: 'error'` con `message` conteniendo la ruta exacta `props.items[i].visibility.reference`. Origen: `validateVisibility` (chequeo semántico de referencia tras parseo exitoso del shape).
- Un nodo `tabs` con `props.items[i].visibility.operator` fuera del catálogo enum soportado (`equals|notEquals|isTruthy|isFalsy|greaterThan|lessThan`) produce `status: 'error'` con `message` conteniendo la ruta `props.items[i].visibility.operator`. Origen: parseo Zod del enum dentro de `tabsItemSchema`, mapeado a ruta por la nueva rama explícita en `validateTabsNode`.
- Un nodo `tabs` con `props.items[i].visibility.reference` ausente o vacío produce `status: 'error'` con `message` conteniendo la ruta `props.items[i].visibility.reference`. Origen: parseo Zod (`nonEmptyStringSchema`) mapeado por la nueva rama explícita en `validateTabsNode`.
- Un nodo `tabs` con operador `isTruthy` o `isFalsy` y `value` declarado en `props.items[i].visibility` produce `status: 'error'` con `message` conteniendo la ruta `props.items[i].visibility.value`. Origen: `validateVisibility`.
- Un nodo `tabs` con operador `equals`, `notEquals`, `greaterThan` o `lessThan` sin `value` en `props.items[i].visibility` produce `status: 'error'` con `message` conteniendo la ruta `props.items[i].visibility.value`. Origen: `validateVisibility`.
- Un nodo `tabs` con operador `equals` o `notEquals` y `value` no escalar (objeto o array) en `props.items[i].visibility` produce `status: 'error'`. Origen: `validateVisibility`.
- Un nodo `tabs` con operador `greaterThan` o `lessThan` y `value` no numérico en `props.items[i].visibility` produce `status: 'error'`. Origen: `validateVisibility`.
- Claves no soportadas dentro de `props.items[i].visibility` se descartan silenciosamente: el `visibilitySchema` declara `.strip()` y por tanto el nodo se acepta sin error.

**Comandos durante la implementación:**

```
pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts
```

**Restricciones:**

- Reutilizar el helper `createConfigWithLayout` y el factory `createTabsNode` ya presentes en el fichero de test.
- No duplicar lógica de validación del shape de `visibility`: debe usarse `validateVisibility` ya exportada en `validate-actions-visibility.ts`.
- El mensaje de error debe usar el mismo patrón que la validación transversal (`Page "..." has an invalid layout at "...".`).

### Criterios de finalización

- `TabsItem` exporta `visibility?: RuntimeVisibilityConfig`.
- `tabsItemSchema` admite `visibility` opcional con el shape transversal.
- `validateTabsNode` propaga errores de `validateVisibility` por item con la ruta exacta y normaliza el campo en `TabsItem.visibility`.
- `pnpm test --run src/tests/config-validation/runtime-config-validation-tabs.test.ts` pasa en verde.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T02) puede ejecutarse.

---

## Tarea 02 — Render dinámico: filtrar items por `visibility` y resolver tab activo

**ID:** T02
**Estado:** completada
**Depende de:** T01 (el tipo `TabsItem.visibility` debe existir antes del filtrado en runtime)

### Objetivo

Modificar el componente `TabsNode` (`src/runtime/nodes/tabs-layout-node.tsx`) para que evalúe `visibility` por item en cada render y aplique las reglas siguientes:

- La barra de pestañas solo renderiza los tabs visibles. Los tabs ocultos no aparecen ni como botón ni con su panel.
- Al montar, si `props.defaultTab` apunta a un tab oculto, se selecciona el primer tab visible por índice creciente del array original.
- Si el tab activo queda oculto (por cambio de referencias en runtime), el nodo selecciona automáticamente el primer tab visible por índice creciente del array original. El click manual del usuario sigue siendo posible sobre cualquier tab visible.
- Si no hay ningún tab visible, el componente devuelve `null` (mismo trato que `items` vacío).
- El estado interno del componente sigue siendo el índice del array original; el filtrado por visibilidad no reindexa los items.
- La evaluación reutiliza `matchesVisibilityRule` ya exportada en `runtime-layout-visibility.ts` con el `iterationContext` recibido por props.
- El `visibility` a nivel del nodo `tabs` completo sigue resolviéndose antes (en el dispatcher de `layout-node-renderer`), sin cambios.

### Fuera de alcance

- Cualquier cambio en la lógica de `visibility` transversal del nodo completo (la rama "nodo entero oculto" sigue resolviéndose en `layout-node-renderer.tsx` mediante `resolveLayoutNodeVisibility`, sin modificarse).
- Modificación de `src/dev/config.json` (T03).
- Cambios en la lógica de `matchesVisibilityRule` (se consume tal cual).
- Soporte de `disabled` o estados visuales adicionales por tab.

### Dependencias

T01.

### Impacto esperado en archivos

**Código a modificar:**

- `src/runtime/nodes/tabs-layout-node.tsx`
  - Importar `matchesVisibilityRule` desde `../runtime-layout-visibility`.
  - En `TabsNode` (o en `TabsNodeContent`), calcular en cada render la lista de índices visibles del array original: `visibleIndices = items.map((item, index) => ({ item, index })).filter(({ item }) => matchesVisibilityRule(item.visibility, state, iterationContext)).map(({ index }) => index)`.
  - Si `visibleIndices.length === 0`, devolver `null`.
  - Sustituir `useState(defaultTab)` por inicialización lazy: `useState(() => visibleIndices.includes(safeDefaultTab) ? safeDefaultTab : visibleIndices[0])`. Regla literal: si `safeDefaultTab` es uno de los índices visibles, ese valor se respeta tal cual aunque no sea el primer índice visible (p. ej. `defaultTab: 2` con tres tabs visibles monta con el índice 2 activo, no con el 0). Solo cuando `safeDefaultTab` apunta a un tab oculto se cae al primer visible por índice creciente.
  - Tras el cálculo de `visibleIndices`, aplicar el patrón **"adjusting state during render"** de React (sin `useEffect`). El patrón literal a usar es:
    ```
    let effectiveActiveTab = activeTab
    if (!visibleIndices.includes(activeTab)) {
      effectiveActiveTab = visibleIndices[0]
      setActiveTab(effectiveActiveTab)
    }
    ```
    Notas:
    - La llamada `setActiveTab(effectiveActiveTab)` durante el render es segura porque solo se invoca cuando `activeTab` no está en `visibleIndices` (la comparación previa garantiza convergencia: en el re-render inmediato, `activeTab === effectiveActiveTab`, la condición es falsa y no vuelve a llamarse).
    - El render del frame actual usa `effectiveActiveTab` (no `activeTab`) para resolver tanto los estilos de la barra (`isActive`) como el panel activo.
  - El bucle `items.map(...)` que produce los botones de la barra se filtra a `visibleIndices`. Cada botón sigue identificándose por su índice original (importante para `key` estable y para `setActiveTab(index)` con el índice original).
  - El panel activo se busca por el índice efectivo dentro del array original: `items[effectiveActiveTab]`.
  - `safeDefaultTab` se calcula como antes (clamp al rango `[0, items.length)`) pero el valor efectivo inicial del tab pasa por el filtrado de visibilidad como se describe arriba.

**Tests a modificar:**

- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación)

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/nodes/tabs.md`
- `ai-workflow/docs/app-features/references/visibility.md`

### Tests

**Ficheros de test:**

- `src/tests/layout-renderer/layout-renderer-tabs.test.tsx` (ampliación)

**Comportamiento cubierto:**

- Un nodo `tabs` con un item con `visibility: { reference: 'queries.q.data.show', operator: 'isTruthy' }` y la referencia evaluando a `false`: la pestaña no aparece en la barra (no hay botón con su label) y su panel no está en el DOM.
- Un nodo `tabs` con tres items donde el item de índice 0 está oculto y `defaultTab` no se declara (default 0): al montar el componente activa el item de índice 1 (primer visible) y solo se ven dos botones en la barra.
- Un nodo `tabs` con `defaultTab: 1` y el item de índice 1 oculto: al montar el componente activa el primer visible por índice creciente del array original (p. ej. índice 0 si está visible).
- Regresión: un nodo `tabs` con tres items todos visibles y `defaultTab: 2` monta con el índice 2 activo (no con el 0). El filtrado por visibilidad no debe forzar al primer visible cuando `defaultTab` ya apunta a un tab visible.
- Un nodo `tabs` con dos items ambos visibles al montar, el usuario hace clic en el segundo, y luego una referencia cambia para ocultar el segundo: el nodo activa automáticamente el primer visible restante (el primero) sin acción del usuario.
- Un nodo `tabs` con todos los items ocultos por `visibility`: el componente no renderiza nada (ni `data-layout-node="tabs"` ni la barra ni el panel).
- Un nodo `tabs` con un item sin `visibility` y otros con `visibility` que evalúa visible: ambos aparecen en la barra (regresión: items sin `visibility` siguen visibles).
- Un nodo `tabs` con `visibility` a nivel del nodo entero que evalúa oculto, e `items[0].visibility` que evalúa visible: el nodo entero no se renderiza (la `visibility` transversal del nodo gana, los items no se evalúan porque el dispatcher de `layout-renderer` ya filtra el nodo).
- Un nodo `tabs` dentro de `repeater.props.template` con un item cuyo `visibility.reference` empieza por `item.*`: cada iteración del repeater evalúa la visibilidad con su propio `iterationContext` (un item se muestra en una iteración y se oculta en otra según la referencia local).
- Un cambio de referencias en runtime que oculta el tab activo y luego lo vuelve a mostrar (toggle): el componente activa el primer visible cuando se oculta y, una vez visible de nuevo, mantiene el tab activo que tenía el usuario en ese momento (no fuerza vuelta al tab originalmente oculto). Es decir, el comportamiento de selección automática solo dispara cuando el activo actual deja de estar en `visibleIndices`.
- No se producen warnings de React por bucles de set-state en render (validar que el test corre sin warnings de `Maximum update depth exceeded`).

**Comandos durante la implementación:**

```
pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx
```

**Restricciones:**

- Reutilizar las fixtures de render existentes en el fichero (`renderRuntimePage`, `renderRuntimePageWithState`, `createRuntimePageState`).
- No introducir efectos secundarios con `useEffect` que reaccionen a `visibleIndices`. La corrección del tab activo cuando queda oculto debe hacerse durante el render (con el patrón "set durante render" + comparación previa) para evitar bucles.
- No reindexar los items: el estado `activeTab` debe seguir siendo el índice del array original. `setActiveTab` recibe el índice original.
- No añadir snapshots.
- No tocar la lógica de `visibility` del nodo entero (resuelta en `layout-node-renderer.tsx`).

### Criterios de finalización

- `TabsNode` filtra correctamente la barra y el panel por `visibility` por item y resuelve el tab activo según las reglas declaradas.
- `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs.test.tsx` pasa en verde.
- No se producen warnings de React de re-render infinito en la ejecución de los tests.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La tarea siguiente (T03) puede ejecutarse.

---

## Tarea 03 — Ejemplo funcional en `src/dev/config.json`

**ID:** T03
**Estado:** completada
**Depende de:** T02 (la feature debe estar operativa para que el ejemplo sea válido)

### Objetivo

Añadir o adaptar un nodo `tabs` en `src/dev/config.json` para incluir al menos un item con `visibility` por tab que dependa de una referencia evaluable desde la propia config de desarrollo (p. ej. el valor de un campo de formulario o el resultado de una query existente en el config). El objetivo es permitir verificar visualmente en modo desarrollo el comportamiento de visibilidad por tab.

### Fuera de alcance

- Cualquier otro cambio en la lógica de runtime.
- Tests del renderer sobre `src/dev/config.json` (ya cubiertos por las suites existentes con fixtures propias).

### Dependencias

T02.

### Impacto esperado en archivos

**Código a modificar:**

- `src/dev/config.json`
  - Localizar (o añadir) un nodo `tabs` con al menos dos items. Declarar `visibility` en uno o más items contra una referencia que ya exista en el resto del config (p. ej. `forms.<formId>.<fieldId>` o `queries.<queryName>.data.*`). El config debe seguir validando como `ready` al arrancar el runtime.

**Tests:**

- No se crean tests nuevos. Las suites de integración existentes cubren el render del runtime con configuración válida y los tests de T01 y T02 cubren la feature.

**Documentación a revisar al cerrar la feature:**

- `ai-workflow/docs/app-features/development/local-config.md` (si documenta la estructura del config de desarrollo).

### Tests

**Ficheros de test:** ninguno; cubierto por: T01 (validación) y T02 (render) más las suites existentes que se ejecutan con `pnpm test`.

**Comportamiento cubierto:**

- `src/dev/config.json` pasa la validación del runtime (`validateRuntimeConfig`).
- El gate de cobertura global `pnpm test` valida que no hay regresión.

**Comandos durante la implementación:**

```
pnpm test
```

**Restricciones:**

- Solo modificar el JSON existente; no crear un fichero de config nuevo.
- La referencia usada en `visibility` por item debe existir realmente en el config (formId/fieldId o query declarada en `api` y `preloads` cuando aplique). No introducir referencias huérfanas.

### Criterios de finalización

- `src/dev/config.json` no tiene errores de validación al arrancar el runtime en modo desarrollo.
- `pnpm test` pasa en verde con cobertura ≥ 80%.

### Cierre de implementación

Código y tests de esta tarea completos y validados. La feature está implementada completamente.
