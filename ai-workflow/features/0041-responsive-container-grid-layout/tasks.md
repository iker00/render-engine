# Tasks: Responsive container grid layout

## Orden de ejecución
1. `T001` amplía el contrato validado y los tipos compartidos.
2. `T002` implementa la resolución responsive centralizada de clases y clamp.
3. `T003` conecta el contexto de layout y los renderers al nuevo shape efectivo.
4. `T004` cubre el comportamiento integrado del renderer y regresiones.
5. `T005` actualiza la documentación funcional estable después de cerrar código y tests.

No quedan tareas pendientes dentro del alcance de la feature.

## T001 - Contrato responsive de `columns` y `layout.span`

### Estado
Completada.

### Objetivo
Permitir en el contrato público que `container.props.columns` y `node.layout.span` acepten `number | responsive map`, donde el mapa solo admite `base | sm | md | lg | xl | 2xl` y valores enteros entre `1` y `12`, conservando la aceptación vigente de enteros fijos.

### Fuera de alcance
- No generar clases visuales ni resolver fallback o clamp responsive.
- No añadir responsive a otras props de `container`.
- No introducir validación contextual de si `layout.span` vive dentro de un grid.
- No cambiar la política vigente de descarte de claves extra no soportadas fuera de los mapas responsive.

### Dependencias
Ninguna. Es la primera tarea porque el resto depende de tipos y validación compatibles.

### Impacto esperado en archivos
- Código:
  - `src/config/runtime-config-types.ts`: añadir tipos compartidos para breakpoints y valores responsive acotados; cambiar `LayoutNodeLayoutConfig.span` y `ContainerLayoutNode.props.columns`.
  - `src/config/runtime-config-zod.ts`: sustituir los esquemas numéricos actuales por una unión `number | responsive map` cerrada.
  - `src/config/validate-runtime-config.ts`: conservar rutas diagnósticas explícitas para `props.columns` y `layout.span`, incluido valor inválido dentro de un mapa.
  - `src/config/runtime-config.ts`: revisar si debe reexportar los nuevos tipos desde la fachada pública.
- Tests:
  - `src/tests/runtime-config-validation.test.ts`: ampliar casos de aceptación y rechazo del contrato.
- Documentación:
  - Revisar en `T005` `ai-workflow/docs/app-features/config-contract.md`.

### Tests requeridos
- Tests de validación que acepten `columns` fijo y responsive.
- Tests de validación que acepten `layout.span` fijo y responsive en nodos hoja, `container`, `form` y `repeater`.
- Tests de rechazo para:
  - breakpoint desconocido en `columns` y en `layout.span`;
  - valores `0`, `13`, no enteros y no numéricos dentro del mapa;
  - `columns` responsive combinado con `wrap`.
- Mantener los tests actuales de enteros fijos sin cambiar sus expectativas.

### Documentación afectada
Pendiente para `T005`: `config-contract.md`, `config-driven-ui-runtime.md` y `current-state.md`.

### Criterios de finalización
- El parser acepta ambos shapes y devuelve datos tipados sin obligar a migrar configs existentes.
- Los mapas responsive rechazan claves fuera del catálogo cerrado y valores fuera de rango antes del render.
- La combinación `columns` responsive + `wrap` falla con un mensaje que apunta a `props.wrap`, igual que el caso fijo.
- Los errores de `columns` y `layout.span` conservan rutas diagnósticas trazables.

### Cierre de implementación
Código y tests de contrato completados. Ejecutar al menos `pnpm exec vitest run src/tests/runtime-config-validation.test.ts` y dejarlo en verde.

### Cierre documental
No cerrar en esta tarea. La actualización documental queda planificada en `T005`.

## T002 - Resolución centralizada de breakpoints, clases y clamp

### Estado
Completada.

### Objetivo
Extender `runtime-node-styling` para normalizar valores fijos y responsive, generar clases Tailwind enumeradas para columnas y spans por breakpoint, y calcular el clamp de `layout.span` contra las columnas efectivas del padre para cada breakpoint.

La normalización responsive debe respetar la cascada de Tailwind: `base` es el fallback móvil, cada valor declarado sigue vigente en breakpoints superiores hasta que otro valor lo sustituye, y el clamp de `span` debe evaluarse sobre la línea temporal combinada del `span` hijo y de las columnas del padre.

### Fuera de alcance
- No tocar componentes React ni contexto de layout en esta tarea.
- No abrir clases Tailwind dinámicas construidas con interpolación no enumerable.
- No cambiar `gap`, `align`, `justify`, `wrap`, `variant` ni superficies visuales existentes.
- No asumir progresión monotónica de columnas entre breakpoints.

### Dependencias
Depende de `T001` para usar el tipo `number | responsive map`.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-node-styling.ts`: añadir catálogo cerrado de breakpoints, mapas enumerados `grid-cols-*` y `col-span-*` con prefijos responsive, normalización efectiva por breakpoint, detección de grid por valor fijo o mapa, y cálculo de span clamped.
  - `src/config/runtime-config-types.ts` o `src/config/runtime-config.ts`: importar tipos compartidos si `runtime-node-styling.ts` los consume desde la fachada pública.
- Tests:
  - `src/tests/runtime-node-styling.test.ts`: cubrir normalización, clases responsive, fallback móvil y clamp por breakpoint.
- Documentación:
  - Ninguna actualización directa en esta tarea.

### Tests requeridos
- Unit tests para `getContainerNodeStyling` con `columns: 4` y con `{ base: 1, md: 2, lg: 4 }`.
- Unit tests para `getContainerNodeStyling` con `{ md: 2, lg: 4 }`, verificando `grid-cols-1` como fallback base y clases responsive declaradas.
- Unit tests para `getGridChildSpanClassName` con span fijo frente a columnas fijas.
- Unit tests para span responsive frente a columnas responsive, incluyendo clamp `{ base: 2, lg: 4 }` contra `{ base: 1, lg: 3 }`.
- Unit test para span responsive con breakpoint omitido en el hijo pero cambio posterior del padre, por ejemplo `span: { md: 2 }` contra `columns: { base: 1, lg: 3 }`, verificando que desde `lg` el resultado efectivo vuelve a `col-span-2`.
- Unit tests que demuestren que un padre puede reducir columnas en un breakpoint mayor y el span se clampa contra ese valor.
- Unit test para controles de paginación de `repeater` ocupando todas las columnas efectivas por breakpoint.

### Documentación afectada
Pendiente para `T005`: la documentación debe describir que las clases responsive son una superficie cerrada, no estilos libres desde JSON.

### Criterios de finalización
- No hay generación opaca de clases Tailwind; todas las clases posibles quedan enumeradas en código.
- Los enteros fijos siguen produciendo las mismas clases base que antes.
- Los mapas sin `base` producen fallback base de una columna.
- El clamp de span se calcula por breakpoint contra las columnas efectivas del padre.
- Los cambios de columnas del padre fuerzan recalculo y emisión de clase responsive de `span` aunque el hijo no declare ese mismo breakpoint.
- La función de controles de paginación puede recibir columnas efectivas y generar span de fila completa por breakpoint.

### Cierre de implementación
Código y unit tests de styling completados. Ejecutar al menos `pnpm exec vitest run src/tests/runtime-node-styling.test.ts` y dejarlo en verde.

### Cierre documental
No cerrar en esta tarea. La actualización documental queda planificada en `T005`.

## T003 - Propagación del layout responsive en runtime

### Estado
Completada.

### Objetivo
Conectar el shape efectivo de columnas responsive desde `container` hacia sus hijos mediante el contexto de layout, aplicar `layout.span` responsive en el renderer central y conservar la excepción vigente de `repeater` sin wrapper propio.

### Fuera de alcance
- No modificar el contrato ni los esquemas de validación ya cerrados en `T001`.
- No cambiar la expansión estructural de `repeater`, su paginación local ni su resolución de keys.
- No añadir medición de viewport ni listeners de resize en JavaScript.
- No aplicar `layout.span` al nodo `repeater` como wrapper visible.

### Dependencias
Depende de `T001` y `T002`.

### Impacto esperado en archivos
- Código:
  - `src/runtime/runtime-layout-context.tsx`: cambiar `parentGridColumns` de número fijo a columnas efectivas responsive o `null`.
  - `src/runtime/nodes/container-layout-node.tsx`: detectar grid efectivo para `columns` fijo o responsive y propagar las columnas normalizadas al contexto.
  - `src/runtime/layout-node-renderer.tsx`: pasar el nuevo contexto a `getGridChildSpanClassName` y mantener `repeater` sin wrapper.
  - `src/runtime/nodes/repeater-layout-node.tsx`: adaptar props internas de paginación al nuevo tipo de columnas efectivas.
  - `src/runtime/runtime-node-styling.ts`: exponer helper de columnas efectivas si no quedó público en `T002`.
- Tests:
  - `src/tests/layout-renderer.test.tsx`: añadir casos integrados del renderer si alguno no se reserva para `T004`.
- Documentación:
  - Ninguna actualización directa en esta tarea.

### Tests requeridos
- Tests de integración mínimos o ajustes a tests existentes que confirmen que un `container` con `columns` responsive renderiza como grid y propaga contexto a hijos.
- Test de regresión que confirme que `layout.span` fuera de grid efectivo sigue sin wrapper de span.
- Test de regresión que confirme que `repeater` sigue sin aplicar su propio `layout.span`.

### Documentación afectada
Pendiente para `T005`: `config-driven-ui-runtime.md` debe reflejar que el contexto de grid ya transporta columnas efectivas responsive.

### Criterios de finalización
- Los hijos de un grid responsive reciben columnas efectivas por breakpoint.
- Los nodos visibles distintos de `repeater` pueden recibir wrapper con clases `col-span-*` responsive.
- Los fallbacks de `queryStateFeedback` reutilizan automáticamente el contexto del grid padre al renderizar su colección.
- Los controles de paginación de `repeater` siguen ocupando fila completa dentro de grids efectivos, también responsive.
- No aparece lógica de resize ni estado global nuevo para layout.

### Cierre de implementación
Código de runtime conectado y tests relevantes en verde. Ejecutar al menos `pnpm exec vitest run src/tests/layout-renderer.test.tsx src/tests/runtime-node-styling.test.ts`.

### Cierre documental
No cerrar en esta tarea. La actualización documental queda planificada en `T005`.

## T004 - Cobertura integrada de comportamiento responsive y regresiones

### Estado
Completada.

### Objetivo
Completar la cobertura de comportamiento observable de la feature con tests integrados del renderer y regresiones explícitas para enteros fijos, fallback móvil, clamp por breakpoint, `queryStateFeedback` y `repeater`.

### Fuera de alcance
- No añadir nuevo comportamiento funcional más allá de lo definido en la spec.
- No snapshotear pantallas completas.
- No probar media queries reales del navegador; se verifican clases Tailwind deterministas emitidas por el runtime.
- No actualizar documentación funcional todavía.

### Dependencias
Depende de `T001`, `T002` y `T003`.

### Impacto esperado en archivos
- Código:
  - Solo ajustes menores si los tests detectan una desviación del comportamiento planificado en tareas previas.
- Tests:
  - `src/tests/layout-renderer.test.tsx`: añadir tests de render integrado para los criterios de aceptación.
  - `src/tests/runtime-config-validation.test.ts`: añadir casos que falten si `T001` no cubrió todos los diagnósticos.
  - `src/tests/runtime-node-styling.test.ts`: añadir casos de clase/clamp que falten si `T002` no cubrió todos los bordes.
- Documentación:
  - Ninguna actualización directa en esta tarea.

### Tests requeridos
- `container` con `columns: 4` conserva `grid-cols-4`.
- `container` con `columns: { base: 1, md: 2, lg: 4 }` emite `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.
- Hijo con `layout.span: 2` dentro de grid fijo conserva `col-span-2`.
- Hijo con `layout.span: { base: 1, md: 2 }` emite `col-span-1 md:col-span-2`.
- Hijo con span responsive mayor que columnas efectivas se clampa por breakpoint.
- `columns` y `span` sin `base` degradan a `grid-cols-1` y `col-span-1` antes del primer breakpoint declarado.
- Hijo con `layout.span: { "md": 2 }` dentro de padre `columns: { "base": 1, "lg": 3 }` ocupa una columna antes de `lg` y dos desde `lg`, aunque el hijo no declare explícitamente `lg`.
- `layout.span` responsive fuera de grid no produce wrapper visible.
- Un `repeater` dentro de grid responsive no recibe wrapper propio, pero los nodos visibles de `template` sí aplican su `layout.span`.
- Un fallback de `queryStateFeedback` aplica su `layout.span` contra el grid responsive padre.

### Documentación afectada
Pendiente para `T005`: las fichas funcionales deberán reflejar los comportamientos cubiertos por estos tests.

### Criterios de finalización
- Los criterios de aceptación de `spec.md` quedan cubiertos por unit/integration tests.
- Las regresiones de enteros fijos siguen cubiertas.
- Los tests no dependen de viewport real ni de resize.
- `pnpm test` pasa con el umbral global de cobertura del 80% en `functions`, `lines` y `statements`.

### Cierre de implementación
Ejecutar `pnpm test` y confirmar tests en verde y coverage gate superado. Si el coste de ejecución obliga a iterar con tests parciales, el cierre final exige igualmente `pnpm test`.

### Cierre documental
No cerrar en esta tarea. La actualización documental queda planificada en `T005`.

## T005 - Documentación funcional y estado vigente

### Estado
Completada.

### Objetivo
Actualizar la documentación estable del producto para reflejar que `container.props.columns` y `node.layout.span` soportan enteros fijos o mapas responsive cerrados, incluyendo fallback móvil, clamp por breakpoint y límites de alcance.

### Fuera de alcance
- No modificar código ni tests.
- No convertir `README.md` en historial o changelog.
- No documentar capacidades fuera de alcance como breakpoints configurables, responsive para `gap` o widths en flex.

### Dependencias
Depende de que `T001` a `T004` tengan cierre de implementación.

### Impacto esperado en archivos
- Código:
  - Ninguno.
- Tests:
  - Ninguno.
- Documentación:
  - `ai-workflow/docs/app-features/config-contract.md`: actualizar contrato de `columns`, `layout.span`, breakpoints y reglas estructurales.
  - `ai-workflow/docs/app-features/config-driven-ui-runtime.md`: actualizar comportamiento del runtime, organización estable y límites actuales.
  - `ai-workflow/docs/current-state.md`: actualizar capacidades/limitaciones vigentes.
  - `ai-workflow/features/index.md`: revisar si el índice histórico de features debe registrar la feature al cierre.
  - `ai-workflow/features/0041-responsive-container-grid-layout/status.yaml`: pasar a fase documental o cierre según la skill documental.

### Tests requeridos
No requiere tests nuevos. Antes de cerrar la documentación, comprobar que el estado heredado de implementación mantiene `validation.tests_green: true` y `validation.coverage_gate_passed: true`.

### Documentación afectada
Los documentos listados en impacto esperado.

### Criterios de finalización
- La documentación distingue valor fijo y mapa responsive.
- Quedan documentados los breakpoints cerrados `base | sm | md | lg | xl | 2xl`.
- Queda documentado que `base` es la clase sin prefijo y el fallback móvil recomendado.
- Queda documentado el clamp por breakpoint contra columnas efectivas.
- Queda documentado que `layout.span` sigue sin efecto fuera de grid y no se aplica como wrapper visible al propio `repeater`.
- `current-state.md` deja de presentar la falta de responsive en `layout.span` como límite vigente.

### Cierre de implementación
No aplica; esta tarea no cambia código.

### Cierre documental
Documentación funcional estable actualizada y `status.yaml` cerrado por la skill documental.
