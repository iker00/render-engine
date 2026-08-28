# Tasks: modo grid en `repeater`

## Orden de implementación
T1 → T2 → T3 → T4 → T5 → T6

T1 y T2 no tienen dependencias entre sí (podrían implementarse en cualquier orden), pero se listan en este orden por claridad narrativa. T3 depende de ambas. T4 depende de T2 y T3. T5 y T6 dependen solo de T2 y son independientes entre sí.

**Siguiente tarea a escoger: T1.**

---

## T1 — Extraer helper de estilo de grid compartido y refactorizar `container`

### Objetivo
Extraer a `src/runtime/runtime-node-styling-base.ts` la construcción de clases Tailwind de layout de grid (columnas fijas o responsive + gap con fallback de variable CSS + align + justify), hoy resuelta de forma inline y privada dentro de `getContainerNodeStyling` en `src/runtime/runtime-node-styling-container.ts`, exponiéndola como una nueva función exportada `getGridLayoutClassNames`. Para ello, mover a `runtime-node-styling-base.ts` los mapas module-scope hoy privados en `runtime-node-styling-container.ts`: `containerGapClassMap`, `containerColumnsClassMap`, `responsiveContainerColumnsClassMaps`, `containerAlignClassMap`, `containerJustifyClassMap`, y el helper `getResponsiveClassNames`. `runtime-node-styling-container.ts` importa estos mapas de vuelta desde `runtime-node-styling-base.ts` para su rama lineal (sin cambios de comportamiento).

Refactorizar `getContainerNodeStyling` para que, exclusivamente en su rama de modo grid (`columns !== undefined`), delegue en `getGridLayoutClassNames({ columns, gap, align, justify })` para obtener `classNames`/`style`, añadiendo después sus propios extras de esa rama (clases de `variant: card`). La rama lineal (`columns === undefined`: `direction`/`wrap`/`align`/`justify`/`gap`) permanece con su lógica actual sin cambios de comportamiento, solo reapuntando a los mapas ahora importados desde `runtime-node-styling-base.ts`.

La salida de `getContainerNodeStyling` debe ser byte-idéntica a la actual para cualquier combinación de props existente: cero regresión, verificada ejecutando los tests actuales de `container` sin modificarlos.

### Fuera de alcance
- No tocar la lógica de `variant: card` (permanece en `runtime-node-styling-container.ts`).
- No mover `containerWrapClassMap` a `runtime-node-styling-base.ts` (`wrap` es exclusivo de `container`, no forma parte de la superficie de grid compartida).
- No crear el módulo de estilo del `repeater` (eso es T3).
- No modificar `repeater-layout-node.tsx`, `layout-node-renderer.tsx` ni ningún fichero de `src/config/` o `src/dev-runtime/`.

### Dependencias
Ninguna. Primera tarea de la secuencia.

### Interfaces
**Consume:** ninguno

**Produce:**
- `getGridLayoutClassNames(options: { columns: RuntimeResponsiveLayoutValue; gap?: string; align?: string; justify?: string }): { classNames: string[]; style?: CSSProperties }` (en `src/runtime/runtime-node-styling-base.ts`) — consumido por: T3

### Impacto esperado en archivos
- Código: `src/runtime/runtime-node-styling-base.ts` (modificar: mover mapas + añadir `getGridLayoutClassNames`), `src/runtime/runtime-node-styling-container.ts` (modificar: delegar en la rama grid, importar mapas movidos), `src/runtime/runtime-node-styling.ts` (modificar: re-exportar `getGridLayoutClassNames` para mantener el barrel consistente).
- Tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación).
- Documentación: ninguna (refactor interno, sin cambio de contrato observable).

### Tests
**Ficheros de test:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)

**Comportamiento cubierto:**
- `getGridLayoutClassNames` con `columns` fijo entre 1 y 12 devuelve `grid`, `w-full` y `grid-cols-{n}`.
- `getGridLayoutClassNames` con `columns` como mapa responsive devuelve las clases por breakpoint, con `base` como fallback móvil cuando falta.
- `getGridLayoutClassNames` sin `gap` usa `md` como valor efectivo por defecto.
- `getGridLayoutClassNames` con un alias de gap soportado (`sm|md|lg|xl|2xl`) devuelve la clase estable correspondiente sin `style`.
- `getGridLayoutClassNames` con un valor de gap arbitrario devuelve la clase de variable CSS junto a `style['--runtime-container-gap']`.
- `getGridLayoutClassNames` con `align`/`justify` declarados añade las clases `items-*`/`justify-*` correspondientes; sin declarar, no añade ninguna.
- Los tests existentes de `getContainerNodeStyling` para modo grid (`switches to grid mode when columns are declared...`, `maps responsive container columns with a safe mobile fallback`, `preserves arbitrary gap values with a CSS variable escape hatch`, `maps align justify and wrap in linear mode with nowrap as the default`) siguen en verde sin modificarse, confirmando cero regresión.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
```

**Restricciones:**
No modificar los tests existentes de `getContainerNodeStyling` en este fichero. Si tras el refactor algún test existente falla, es una señal de regresión a corregir en el propio refactor, no en el test.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `getGridLayoutClassNames` existe en `runtime-node-styling-base.ts` con la firma indicada y cubre columnas fijas/responsive, gap con default `md` y fallback de variable CSS, y align/justify.
- `getContainerNodeStyling` delega en ella para su rama grid; su rama lineal permanece sin cambios de comportamiento.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper ningún test existente de `runtime-node-styling.test.ts` ni de `layout-renderer-container.test.tsx`.

---

## T2 — Contrato de validación: `columns`/`gap`/`align`/`justify` en `repeater`

### Objetivo
Extender `repeaterNodeSchema` (en `src/config/runtime-config-zod.ts`, definición actual en líneas 255-276) con cuatro campos opcionales dentro de `props`, reutilizando literalmente los mismos catálogos y shapes que `container` sin crear ninguno nuevo:
- `columns`: mismo `responsiveLayoutValueSchema` (const module-privada ya usada por `containerNodeSchema.props.columns` en la línea 203 del mismo fichero) `.optional()`.
- `gap`: `z.string().optional()`.
- `align`: `z.enum(supportedContainerAlignValues).optional()`.
- `justify`: `z.enum(supportedContainerJustifyValues).optional()`.

Extender el tipo hand-written `RepeaterLayoutNode` (en `src/config/runtime-config-types.ts`, definición actual en líneas 180-192) con los mismos cuatro campos opcionales dentro de `props`, reutilizando los tipos ya exportados `RuntimeResponsiveLayoutValue`, `ContainerAlign` y `ContainerJustify` (no crear tipos nuevos).

Extraer un mapper compartido `mapGridLayoutIssue` en `src/config/validate-layout-issue-mapping.ts`, siguiendo el mismo patrón que `mapLayoutNodeIssue` ya existente en ese fichero (firma `(pageId, path, issuePath, breadcrumb = [], rawNode = {})`, retorno `{ status: 'error'; error: RuntimeConfigError } | null`, usando `enrichedInvalidLayout` para construir el mensaje, devolviendo `null` cuando el issue no corresponde a ninguno de estos cuatro campos). Reconoce `issuePath[0] === 'props' && ['columns','gap','align','justify'].includes(issuePath[1] as string)` y genera el mensaje `Page "${pageId}" has an invalid layout at "${path}.props.${issuePath[1]}".`.

En `src/config/validate-container-node.ts`, sustituir los cuatro bloques `if` actuales que mapean `props.columns`/`props.gap`/`props.align`/`props.justify` (líneas ~42-56 vigentes) por una única llamada a `mapGridLayoutIssue(pageId, path, issue.path, breadcrumb, rawNode)`, preservando el mensaje de error exacto para cada campo. El bloque de `props.direction` y `props.variant` permanecen inline, sin cambios (no forman parte de la superficie compartida).

En `src/config/validate-repeater-node.ts`, añadir una llamada equivalente a `mapGridLayoutIssue`, inmediatamente después de la llamada existente a `mapLayoutNodeIssue` (línea ~48-52 vigente) y antes de los checks específicos de `props.template`/`props.items.*`/paginación. Extender la construcción final del nodo `ready` (líneas ~128-135 vigentes) para incluir `columns`, `gap`, `align` y `justify` en `props` cuando estén presentes en `parseResult.data.props`.

### Fuera de alcance
- No añadir `wrap` ni `direction` a `repeater` (fuera de `spec.md`).
- No añadir validación cruzada nueva análoga al conflicto `columns`+`wrap` de `container` (no aplica: `repeater` no tiene `wrap`).
- No modificar el orden relativo de `mapQueryStateFeedbackIssue`/`mapVisibilityIssue` en ninguno de los dos validadores.
- No renombrar `supportedContainerAlignValues`/`supportedContainerJustifyValues` (ver D2 de `design.md`: trade-off de nombres aceptado explícitamente).
- No tocar `src/runtime/` ni `src/dev-runtime/`.

### Dependencias
Ninguna.

### Interfaces
**Consume:** ninguno

**Produce:**
- Zod: `repeaterNodeSchema.props` (en `src/config/runtime-config-zod.ts`) ampliado con `columns?: responsiveLayoutValueSchema`, `gap?: z.string()`, `align?: z.enum(supportedContainerAlignValues)`, `justify?: z.enum(supportedContainerJustifyValues)` — consumido por: T3, T4, T5, T6
- Tipo `RepeaterLayoutNode.props` (en `src/config/runtime-config-types.ts`) ampliado con `columns?: RuntimeResponsiveLayoutValue`, `gap?: string`, `align?: ContainerAlign`, `justify?: ContainerJustify` — consumido por: T3, T4, T6
- `mapGridLayoutIssue(pageId: string, path: string, issuePath: PropertyKey[], breadcrumb: BreadcrumbSegment[] = [], rawNode: Record<string, unknown> = {}): { status: 'error'; error: RuntimeConfigError } | null` (en `src/config/validate-layout-issue-mapping.ts`) — sin consumidores directos fuera de esta tarea (usado internamente por `validate-container-node.ts` y `validate-repeater-node.ts`, ambos modificados dentro de esta misma tarea)

### Impacto esperado en archivos
- Código: `src/config/runtime-config-zod.ts`, `src/config/runtime-config-types.ts`, `src/config/validate-layout-issue-mapping.ts`, `src/config/validate-container-node.ts`, `src/config/validate-repeater-node.ts`.
- Tests: `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación), `src/tests/config-validation/runtime-config-validation-containers.test.ts` (ampliación, solo para confirmar regresión cero tras sustituir los mappers internos).
- Documentación: `ai-workflow/docs/app-features/nodes/repeater.md`.

### Tests
**Ficheros de test:**
- `src/tests/config-validation/runtime-config-validation-repeater.test.ts` (ampliación)
- `src/tests/config-validation/runtime-config-validation-containers.test.ts` (ampliación)

**Comportamiento cubierto:**
- Un `repeater` con `props.columns` entero fijo entre 1 y 12 se acepta.
- Un `repeater` con `props.columns` como mapa responsive cerrado por breakpoint `base|sm|md|lg|xl|2xl` con valores enteros 1-12 se acepta.
- Un `repeater` con `props.gap` en la escala `sm|md|lg|xl|2xl` se acepta; un valor CSS arbitrario también se acepta como compatibilidad heredada.
- Un `repeater` con `props.align` en `start|center|end|stretch` se acepta.
- Un `repeater` con `props.justify` en `start|center|end|between|around|evenly` se acepta.
- Un `repeater` sin ninguno de estos cuatro campos se sigue aceptando exactamente como hoy (regresión).
- Un `repeater` con `props.columns` fuera de rango (`0`, `13`, decimal, string), con clave de breakpoint desconocida en el mapa responsive, o con `props.align`/`props.justify` fuera de catálogo, se rechaza antes del render con ruta diagnóstica explícita (`....props.columns`, `....props.align`, etc.), igual que en `container`.
- Los tests existentes de `runtime-config-validation-containers.test.ts` sobre `columns`/`gap`/`align`/`justify`/`variant`/`wrap`/`layout.span` de `container` siguen en verde sin modificarse tras sustituir sus mappers internos por `mapGridLayoutIssue`.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/config-validation/runtime-config-validation-repeater.test.ts
pnpm test --run src/tests/config-validation/runtime-config-validation-containers.test.ts
```

**Restricciones:**
Reutilizar literalmente los mismos catálogos `supportedContainerAlignValues`/`supportedContainerJustifyValues` ya exportados; no crear catálogos nuevos ni renombrarlos. No modificar los tests existentes de `runtime-config-validation-containers.test.ts` más allá de confirmarlos en verde.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/repeater.md` (nuevo contrato validable de `columns`/`gap`/`align`/`justify`, activación del modo grid).

### Criterios de finalización
- `repeaterNodeSchema` acepta y rechaza los cuatro campos nuevos con el mismo criterio que `containerNodeSchema`.
- `validate-container-node.ts` y `validate-repeater-node.ts` comparten `mapGridLayoutIssue` para estos cuatro campos.
- `RepeaterLayoutNode` expone los cuatro campos nuevos con los tipos correctos.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper ningún test existente de `runtime-config-validation-containers.test.ts` ni de `runtime-config-validation-repeater.test.ts`.

---

## T3 — Render: wrapper de grid del `repeater` (producción y modo edición)

### Objetivo
Crear el módulo `src/runtime/runtime-node-styling-repeater-grid.ts`, siguiendo el patrón ya establecido de un fichero de estilo por nodo (junto a `runtime-node-styling-repeater-pagination.ts`), con la función `getRepeaterGridClassName`, que importa `getGridLayoutClassNames` directamente desde `./runtime-node-styling-base` (import directo entre módulos hermanos, mismo patrón que usa hoy `runtime-node-styling-repeater-pagination.ts` para importar `getGridChildSpanClassName`) y une el array `classNames` resultante en un único string.

Modificar `src/runtime/nodes/repeater-layout-node.tsx` introduciendo una bifurcación exclusiva por `node.props.columns !== undefined` (D4 de `design.md`):

- **Rama SIN `columns`** (comportamiento actual): tanto el bloque de modo edición de `RepeaterNode` (líneas ~75-91 vigentes) como `RepeaterNodeContent` (líneas ~137-171 vigentes) permanecen byte-idénticos al código actual, sin ningún cambio de estructura de salida.
- **Rama CON `columns`**:
  - En el bloque `if (isEditMode)` de `RepeaterNode`: envolver el `<LayoutRenderer>` de la única iteración de muestra en un `<div className={...} style={...}>` con la clase/estilo de `getRepeaterGridClassName({ columns: node.props.columns, gap: node.props.gap, align: node.props.align, justify: node.props.justify })`, y dentro de ese `<div>`, envolver el `<LayoutRenderer>` en `<RuntimeLayoutContextProvider value={{ parentGridColumns: node.props.columns }}>` (mismo componente que usa `ContainerNode` en `container-layout-node.tsx`).
  - En `RepeaterNodeContent`: envolver el `.map()` sobre `visibleIterations` (ya calculado tras aplicar la ventana de paginación vigente) en el mismo `<div>` + `RuntimeLayoutContextProvider` que en modo edición. Los controles de paginación/scroll (`CollectionPaginationControls`, `RepeaterScrollControls`) se renderizan como hermanos de ese `<div>`, fuera de él, sin cambiar la prop `parentGridColumns` que ya reciben hoy (la del ancestro, recibida como prop `parentGridColumns` de `RepeaterNodeContent`, no la del propio repeater).

Actualizar el barrel `src/runtime/runtime-node-styling.ts` para re-exportar `getRepeaterGridClassName`, siguiendo la convención existente por la que `repeater-layout-node.tsx` importa sus helpers de estilo desde `'../runtime-node-styling'`.

### Fuera de alcance
- No modificar `resolveRepeaterSourceItems`, `resolveRepeaterIterations`, `resolveRepeaterItemKey`, la lógica de keys/duplicados, ni las variantes de paginación (`previousNext`/`numbered`/`scroll`) más allá de mantener su posición como hermanos del wrapper.
- No modificar `layout-node-renderer.tsx` (eso es T4).
- No modificar el editor de propiedades (eso es T5/T6).

### Dependencias
T1, T2.

### Interfaces
**Consume:**
- `getGridLayoutClassNames(options: { columns: RuntimeResponsiveLayoutValue; gap?: string; align?: string; justify?: string }): { classNames: string[]; style?: CSSProperties }` (de T1)
- `RepeaterLayoutNode.props` ampliado con `columns?: RuntimeResponsiveLayoutValue; gap?: string; align?: ContainerAlign; justify?: ContainerJustify` (de T2)

**Produce:**
- `getRepeaterGridClassName(options: { columns: RuntimeResponsiveLayoutValue; gap?: string; align?: string; justify?: string }): { className: string; style?: CSSProperties }` (en `src/runtime/runtime-node-styling-repeater-grid.ts`) — sin consumidores directos fuera de esta tarea

### Impacto esperado en archivos
- Código: `src/runtime/runtime-node-styling-repeater-grid.ts` (nuevo), `src/runtime/nodes/repeater-layout-node.tsx` (modificar), `src/runtime/runtime-node-styling.ts` (modificar: re-exportar `getRepeaterGridClassName`).
- Tests: `src/tests/runtime/runtime-node-styling.test.ts` (ampliación), `src/tests/layout-renderer/layout-renderer-repeater-grid.test.tsx` (nuevo).
- Documentación: `ai-workflow/docs/app-features/nodes/repeater.md`.

### Tests
**Ficheros de test:**
- `src/tests/runtime/runtime-node-styling.test.ts` (ampliación)
- `src/tests/layout-renderer/layout-renderer-repeater-grid.test.tsx` (nuevo)

**Comportamiento cubierto:**
- `getRepeaterGridClassName` con `columns` fijo devuelve una clase que incluye `grid-cols-{n}`; con `columns` responsive, las clases por breakpoint con `base` como fallback.
- `getRepeaterGridClassName` sin `gap` usa `md` por defecto; con `gap` en la escala estable, la clase estable correspondiente; con `gap` arbitrario, la clase de variable CSS + `style`.
- `getRepeaterGridClassName` con `align`/`justify` añade las clases correspondientes.
- Un `repeater` sin `props.columns` sigue expandiendo su `template` como hermanos sin ningún wrapper DOM nuevo, en producción y en modo edición (regresión byte-idéntica frente al comportamiento ya fijado por `layout-renderer-repeater-basic.test.tsx` y `layout-renderer-repeater-edit-mode.test.tsx`, sin duplicar esos casos).
- Un `repeater` con `props.columns: 3` renderiza sus iteraciones visibles dentro de un único wrapper con clase `grid-cols-3`.
- Un `repeater` con `props.columns` como mapa responsive aplica las clases por breakpoint con `base` como fallback.
- Un `repeater` con `props.gap`/`align`/`justify` declarados traduce a las mismas clases que `container` en modo grid.
- Un `repeater` paginado (`previousNext`/`numbered`) con `columns` activo incluye en el wrapper de grid solo los items de la página activa; cambiar de página recalcula el conjunto de celdas del wrapper.
- Un `repeater` paginado (`scroll`) con `columns` activo incluye en el wrapper de grid el conjunto acumulado tras cada expansión de la ventana.
- Los controles de paginación/scroll se renderizan como hermanos del wrapper de grid, fuera de él, y siguen ocupando fila completa cuando el repeater está anidado dentro de un grid ancestro (regresión sobre el comportamiento ya cubierto en `layout-renderer-repeater-pagination.test.tsx`).
- Colección resuelta sin iteraciones renderizables (`0` items) con `columns` declarado: el wrapper de grid se renderiza sin celdas, sin error.
- En modo edición (`isEditMode`), un `repeater` con `columns` envuelve la única iteración de muestra en el mismo wrapper de grid, sin controles de paginación.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/runtime/runtime-node-styling.test.ts
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-grid.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-basic.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx
pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-pagination.test.tsx
```

**Restricciones:**
No modificar los tests existentes de `layout-renderer-repeater-basic.test.tsx`, `layout-renderer-repeater-edit-mode.test.tsx` ni `layout-renderer-repeater-pagination.test.tsx`; deben seguir en verde sin cambios, como prueba de que la rama sin `columns` es byte-idéntica. El nuevo fichero `layout-renderer-repeater-grid.test.tsx` reutiliza el patrón de fixtures/helpers ya existente en `layout-renderer-repeater-basic.test.tsx` en vez de crear uno propio desde cero.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/repeater.md`.

### Criterios de finalización
- Un repeater sin `columns` es byte-idéntico al comportamiento actual en producción y edición.
- Un repeater con `columns` renderiza un wrapper de grid con las clases correctas, conteniendo exactamente las iteraciones visibles tras paginación.
- Los controles de paginación permanecen fuera del wrapper, sin cambio de comportamiento.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin regresión en los ficheros de test existentes de `repeater` listados arriba.

---

## T4 — `layout.span` sobre el propio nodo `repeater` en modo grid

### Objetivo
En `src/runtime/layout-node-renderer.tsx`, cambiar la condición de exclusión de `layout.span` (actualmente `node.type === 'repeater' || node.type === 'modal' || node.type === 'hidden'`, líneas ~296-299 vigentes) para que `repeater` solo quede excluido cuando NO está en modo grid. La nueva condición pasa a ser equivalente a: `(node.type === 'repeater' && node.props.columns === undefined) || node.type === 'modal' || node.type === 'hidden'`. El resto del mecanismo (`getGridChildSpanClassName(node.layout?.span, parentGridColumns)`, envoltura en `<div className={gridChildSpanClassName}>{renderedNode}</div>`) no cambia.

### Fuera de alcance
- No tocar la exclusión de `modal`/`hidden`.
- No modificar `repeater-layout-node.tsx` (ya cerrado en T3).
- No modificar el clamp del `layout.span` del nodo raíz de `props.template` dentro del grid del repeater: es consecuencia automática de T3 vía `RuntimeLayoutContextProvider` con `parentGridColumns: node.props.columns`, y no requiere código adicional aquí ni en T3 (D6 de `design.md`).

### Dependencias
T2, T3.

### Interfaces
**Consume:** `RepeaterLayoutNode.props.columns?: RuntimeResponsiveLayoutValue` (de T2)

**Produce:** ninguno

### Impacto esperado en archivos
- Código: `src/runtime/layout-node-renderer.tsx`.
- Tests: `src/tests/layout-renderer/layout-renderer-grid-spans.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/nodes/repeater.md`, `ai-workflow/docs/app-features/nodes/container.md` (nota cruzada sobre `layout.span` cuando `repeater` tiene su propio grid activo, según "Documentación probablemente afectada" de `spec.md`).

### Tests
**Ficheros de test:**
- `src/tests/layout-renderer/layout-renderer-grid-spans.test.tsx` (ampliación)

**Comportamiento cubierto:**
- Un `repeater` sin `props.columns`, anidado dentro de un `container` en modo grid, con `layout.span` declarado sobre el propio nodo `repeater`, sigue sin recibir wrapper `col-span-*` (regresión exacta de los tests existentes `keeps repeater itself span-less and applies layout.span only to visible template roots inside grids` y `keeps repeater itself span-less while template roots use responsive spans inside responsive grids`, sin modificarlos).
- Un `repeater` CON `props.columns` (modo grid activo), anidado dentro de un `container` en modo grid, con `layout.span` declarado sobre el propio nodo `repeater`, recibe un wrapper `col-span-{n}` clampado contra las columnas del `container` ancestro.
- Lo mismo con `layout.span` responsive sobre el propio `repeater` en modo grid, clampado por breakpoint contra las columnas del ancestro.
- Un nodo raíz de `props.template` con `layout.span` dentro de un `repeater` en modo grid recibe `col-span-{n}` clampado contra las `columns` propias del repeater (no las del ancestro), confirmando D6 como consecuencia de T3 sin código adicional en esta tarea.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/layout-renderer/layout-renderer-grid-spans.test.tsx
```

**Restricciones:**
No modificar los dos tests existentes que fijan "repeater sin columns es span-less"; añadir los casos nuevos junto a ellos.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/repeater.md`, `ai-workflow/docs/app-features/nodes/container.md`.

### Criterios de finalización
- Un repeater en modo grid es elegible para `layout.span` sobre su propio wrapper.
- Un repeater sin modo grid sigue excluido, sin regresión.
- El clamp del span del nodo raíz de `template` contra las columnas del propio repeater funciona sin código adicional.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper los tests existentes de `layout-renderer-grid-spans.test.tsx`.

---

## T5 — Editor: exposición de los campos nuevos en el panel de propiedades

### Objetivo
Confirmar y cubrir con test que los cuatro campos nuevos de `repeaterNodeSchema` (`columns`/`gap`/`align`/`justify`, ya añadidos en T2) se exponen automáticamente en el panel de propiedades del editor visual a través del dispatcher genérico dirigido por schema. `getNodeTypeJsonSchema('repeater')` (en `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`) ya mapea `repeater: repeaterNodeSchema` (línea 40 vigente) sin necesidad de cambios: al ampliarse `repeaterNodeSchema` en T2, los cuatro campos deben fluir automáticamente al JSON Schema derivado y de ahí al `property-field-dispatcher.tsx` genérico (`gap` como `TextPropertyField`, `align` como `SegmentedEnumPropertyField` de 4 opciones, `justify` como `EnumPropertyField` de 6 opciones vía `<select>`, `columns` editable a través de la resolución genérica de rama de unión).

Si al escribir los tests se detecta que algún campo NO se expone correctamente (por ejemplo por alguna interacción no prevista con `injectConditionGroupWidgetSentinel`/`injectNavigateParamsWidgetSentinel` dentro de `getNodeTypeJsonSchema`), corregir el punto de extensión mínimo necesario en `layout-canvas-node-schema.ts` para que se exponga, sin introducir ningún widget dedicado nuevo.

### Fuera de alcance
- No crear ningún widget de modo "Grid/Columnas" dedicado para `repeater.props.columns` (design.md, "No objetivos" de D5: no fija el widget exacto de cada campo nuevo, solo la estrategia de reutilizar el dispatcher genérico). El campo `columns` de `repeater` se edita mediante el dispatcher genérico, sin toggle dedicado, a diferencia de `container.props.columns`.
- No modificar `resolveAncestorContainerColumns` (eso es T6).
- No modificar `container-columns-mode-property-field.tsx` ni `property-field-dispatcher.tsx` (salvo el ajuste puntual descrito arriba si la verificación revela un hueco real).

### Dependencias
T2.

### Interfaces
**Consume:** `repeaterNodeSchema.props` ampliado con `columns`/`gap`/`align`/`justify` (de T2)

**Produce:** ninguno

### Impacto esperado en archivos
- Código: ninguno esperado (`layout-canvas-node-schema.ts` ya mapea `repeater`); si la verificación revela un hueco puntual, ajustar únicamente ese fichero.
- Tests: `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- Documentación: ninguna (no cambia contrato de producto; solo confirma la superficie ya declarada en T2).

### Tests
**Ficheros de test:**
- `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto:**
- `getNodeTypeJsonSchema('repeater')` refleja `props.columns`, `props.gap`, `props.align`, `props.justify` con el mismo shape que la versión ya testeada de `container` (mismo patrón que el test existente `reflects containerNodeSchema props (direction/gap/columns/variant/align/justify/wrap)`).
- El panel de propiedades de un nodo `repeater` (con `pageLayout` disponible) renderiza un campo editable para `props.gap` (texto), `props.align` (radiogroup segmentado de 4 opciones), `props.justify` (`<select>` de 6 opciones) y `props.columns` (editable vía el dispatcher genérico, sin widget dedicado), y un cambio en cada uno hace commit del patch correcto sobre el nodo.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones:**
Si la verificación confirma que todo se expone sin cambios de código, esta tarea se cierra solo con los tests nuevos; no forzar un cambio de código innecesario.

### Documentación afectada
Ninguna.

### Criterios de finalización
- Los cuatro campos nuevos de `repeater` se exponen correctamente en el panel de propiedades.
- Todos los tests listados están en verde.

### Cierre de implementación
Tests de esta tarea completos y en verde; cambio de código solo si la verificación reveló un hueco real en `layout-canvas-node-schema.ts`.

---

## T6 — Editor: resolver de columnas de ancestro reconoce `repeater` en modo grid

### Objetivo
En `src/dev-runtime/layout-canvas/resolve-ancestor-container-columns.ts`, extender la condición de reconocimiento de ancestro-con-grid-activo dentro de `resolveAncestorContainerColumns` (línea ~23 vigente: `ancestor !== null && ancestor.type === 'container' && ancestor.props?.columns !== undefined`) para que también reconozca `ancestor.type === 'repeater' && ancestor.props?.columns !== undefined` como ancestro válido de grid, devolviendo `ancestor.props.columns` de la misma forma que hoy hace para `container`.

No renombrar la función (`resolveAncestorContainerColumns`) ni el fichero (`resolve-ancestor-container-columns.ts`) pese a que ahora también reconoce `repeater`, siguiendo el mismo criterio de no ampliar el blast radius ya aceptado en D2 de `design.md` para las constantes compartidas de align/justify.

### Fuera de alcance
- No modificar `getNodeAtPath` (`src/runtime/layout-node-path.ts`), que ya sabe descender por `template` de un repeater.
- No modificar los llamadores (`layout-canvas-properties-panel.tsx` línea ~693, `node-panel-tabs.ts` línea ~54): ambos reciben el nuevo comportamiento sin cambios propios.

### Dependencias
T2.

### Interfaces
**Consume:** `RepeaterLayoutNode.props.columns?: RuntimeResponsiveLayoutValue` (de T2)

**Produce:** ninguno (la firma pública de `resolveAncestorContainerColumns` no cambia)

### Impacto esperado en archivos
- Código: `src/dev-runtime/layout-canvas/resolve-ancestor-container-columns.ts`.
- Tests: `src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts` (ampliación), `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- Documentación: `ai-workflow/docs/app-features/nodes/container.md` (nota cruzada), `ai-workflow/docs/app-features/nodes/repeater.md`.

### Tests
**Ficheros de test:**
- `src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts` (ampliación)
- `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)

**Comportamiento cubierto:**
- `resolveAncestorContainerColumns` devuelve las `columns` (fijas o responsive) de un `repeater` ancestro cuando ese `repeater` declara `props.columns`.
- Un `repeater` ancestro SIN `props.columns` sigue sin contar como ancestro de grid (se mantiene el comportamiento del test existente `resolves the container through a repeater template prefix`, sin modificarlo, reforzando que sigue siendo un simple paso transparente cuando no está en modo grid).
- Cuando tanto un `container` con columns como un `repeater` con columns están en la cadena de ancestros, se devuelve el más cercano al nodo consultado (mismo criterio ya existente para dos `container` anidados).
- El panel de propiedades muestra la subsección "Diseño" (widget `layout-span`) para el nodo raíz de `props.template` cuando su ancestro inmediato es un `repeater` en modo grid, igual que ya ocurre hoy con un `container` en modo grid.

**Comandos durante la implementación:**
```
pnpm test --run src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts
pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx
```

**Restricciones:**
No modificar el test existente `resolves the container through a repeater template prefix`; añadir los casos nuevos junto a él.

### Documentación afectada
`ai-workflow/docs/app-features/nodes/container.md`, `ai-workflow/docs/app-features/nodes/repeater.md`.

### Criterios de finalización
- El resolver reconoce a `repeater` en modo grid como ancestro válido de grid.
- El panel de propiedades ofrece opciones de `layout.span` correctas para el nodo raíz de `template` dentro de un `repeater` en modo grid.
- Todos los tests listados están en verde.

### Cierre de implementación
Código y tests de esta tarea completos, en verde, sin romper el test existente de paso transparente por un repeater sin `columns`.
