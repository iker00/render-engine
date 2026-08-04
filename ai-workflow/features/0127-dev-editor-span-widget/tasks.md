# Plan — 0127 dev-editor-span-widget

Piloto de widget dedicado para `layout.span`, registrado en `WIDGET_REGISTRY` vía `x-widget` como
`choice-items`. La fuente única de verdad de la spec vive en [[spec.md]] (esta feature no requiere
`design.md`; ver [[status.yaml]]).

Todas las tareas comparten estos anclajes técnicos:
- **Registro**: `WIDGET_REGISTRY` en `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`.
- **Reutilización de la cascada mobile-first**: `normalizeResponsiveLayoutValue` de
  `src/runtime/runtime-node-styling-base.ts`; no reintroducir una segunda implementación de la
  cascada por breakpoint.
- **Resolución de ancestros**: `getNodeAtPath` sobre prefijos del `path` seleccionado, siguiendo el
  mismo enfoque de `LayoutCanvasBreadcrumb`.
- **Pipeline de commit**: `onCommitNodeUpdate` que ya expone `LayoutCanvasPropertiesPanel`; el
  widget no introduce un segundo canal, solo un helper del contexto que envuelve ese mismo
  callback para escribir en `layout.span` y devolver `CommitCanvasMutationResult | void`.
- **Contexto React**: el widget recibe los datos extra (`parentColumns`, helper de commit) por
  contexto porque `WIDGET_REGISTRY` fija la firma `{ label, value, onChange }`; no cambiar esa
  firma para no romper `choice-items`.

Los tests de la fase de implementación deben cumplir además las reglas globales de
`ai-workflow/standards/testing-rules.md`.

## Orden y dependencias

T1 → T2 → T3 → T4. Cada tarea deja el árbol de la app compilando y con tests en verde antes de la
siguiente; no dividir un T en dos pasadas.

---

## T1 — Resolver ancestor container con `columns` como función pura

**Objetivo**
Extraer una función pura `resolveAncestorContainerColumns(pageLayout, path)` que devuelve el
`columns` (`RuntimeResponsiveLayoutValue`) del `container` ancestro más cercano al nodo apuntado
por `path`, o `null` si no existe ninguno con `columns` declarado. La función es reutilizable por
el panel y por los tests, y es la única implementación de esta búsqueda en el proyecto.

**Fuera de alcance**
- Cualquier cambio en `LayoutCanvasPropertiesPanel`, `FloatingSelectionOverlay` o el widget.
- Cualquier cambio en el schema, en el runtime o en `getNodeAtPath` / `layout-node-path.ts`.
- Resolver también el `columns` efectivo por breakpoint (esa normalización vive ya en
  `normalizeResponsiveLayoutValue` y se aplica desde T3).
- Añadir el fichero al bundle público de nada distinto del propio widget.

**Dependencias**
- Ninguna previa dentro de esta feature.
- `getNodeAtPath` y `LayoutNodePath` en `src/runtime/layout-node-path.ts` (sin cambios).
- Tipos `LayoutNode` y `RuntimeResponsiveLayoutValue` en `src/config/runtime-config`.

**Impacto esperado en archivos**
- Código: `src/dev-runtime/layout-canvas/resolve-ancestor-container-columns.ts` (nuevo, exporta
  únicamente `resolveAncestorContainerColumns`).
- Tests: `src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts` (nuevo).
- Documentación: `ai-workflow/docs/test-index.md` (nueva línea bajo `dev-runtime/` para el
  fichero de test), sin cambios en fichas de `ai-workflow/docs/app-features/`.

**Tests**
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts` (nuevo).
- Comportamiento cubierto:
  - Devuelve `null` cuando `path` está vacío (raíz) sin ancestros.
  - Devuelve `null` cuando la cadena de ancestros existe pero ningún ancestro es `container` con
    `props.columns` declarado (por ejemplo `form > input`).
  - Devuelve el `columns` (entero) del ancestro `container` más cercano cuando ese ancestro lo
    declara como entero.
  - Devuelve el `columns` (mapa responsive) del ancestro `container` más cercano cuando el
    ancestro lo declara como mapa `{ base: 2, md: 4, ... }`.
  - Con varios `container` ancestros anidados, cada uno con `columns` distinto, devuelve el
    `columns` del `container` **más cercano ascendiendo**, no del ancestro más alto.
  - Con un ancestro `container` sin `columns` declarado y otro ancestro más arriba con `columns`,
    devuelve el del ancestro con `columns` (los `container` sin `columns` son transparentes a la
    búsqueda).
  - El nodo apuntado por `path` no cuenta como ancestro de sí mismo (aunque sea un `container`
    con `columns`).
  - Path que atraviesa `template` de `repeater` o `tabItem` de `tabs`: la búsqueda ascendente
    incluye correctamente el `container` cuando aparece en la cadena de prefijos.
  - No muta `pageLayout` ni el `path` recibidos.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-ancestor-container-columns.test.ts`
- Restricciones:
  - Test puro (sin `@testing-library/react`, sin fixtures de DOM).
  - Construir los `LayoutNode` a mano tipados como `LayoutNode`, no reusar fixtures del panel.

**Documentación afectada**
- `ai-workflow/docs/test-index.md`: añadir la línea del nuevo fichero de test bajo `dev-runtime/`.
- Sin cambios en `ai-workflow/docs/app-features/development/dev-mode-editor.md` ni en
  `ai-workflow/docs/app-features/nodes/container.md` (esta tarea no cambia comportamiento
  observable de la app).

**Criterios de finalización**
- La función existe, está tipada y es la única implementación de la búsqueda de ancestro con
  `columns` en el proyecto (no se copia la cascada mobile-first aquí — esta función devuelve el
  valor crudo del contrato).

**Cierre de implementación**
- Fichero nuevo creado, importable desde `src/dev-runtime/layout-canvas/`.
- Suite de test del fichero en verde.
- `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## T2 — Threading de `pageLayout` y visibilidad de la subsección `Layout`

**Objetivo**
Pasar `pageLayout` a `LayoutCanvasPropertiesPanel`, resolver desde el panel el `columns` del
ancestro relevante usando la función de T1, e implementar la regla de visibilidad de la spec:
- si no hay ancestro `container` con `columns` declarado → la subsección `Layout` no se renderiza
  (ningún campo, ningún editor de respaldo);
- si hay ancestro → el sub-schema de `layout.span` se sustituye por el sentinel
  `{ 'x-widget': 'layout-span' }` (mismo patrón que `resolveChoiceLikePropsSchema` para
  `select.props.items`), y se registra un widget stub en `WIDGET_REGISTRY['layout-span']` cuyo
  único propósito en esta tarea es probar el wiring de visibilidad y contexto (no tiene aún la
  UI final).

**Fuera de alcance**
- Toda la UI final del widget (filas, denominadores, edición, "Quitar", conversión entero→mapa,
  feedback por fila): T3.
- Cambios en la sección `Props`, `Visibilidad` o `Estado de consulta` del panel.
- Cambios en la validación (`validateRuntimeConfig`) ni en el shape del config.
- Sincronización con Monaco: sigue siendo la ya existente por el mismo commit; no hay flujo
  nuevo que probar en esta tarea.

**Dependencias**
- T1 (`resolveAncestorContainerColumns`).

**Impacto esperado en archivos**
- Código:
  - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`: nueva prop opcional
    `pageLayout?: readonly LayoutNode[]`; adaptador `resolveLayoutSubsectionSchema` que injecta
    el sentinel `x-widget: 'layout-span'` en `properties.span`; regla de visibilidad que omite
    la subsección `Layout` completa si no hay ancestro con `columns` (o si no se pasa
    `pageLayout`); provider del nuevo contexto React con `{ parentColumns, spanValue, commitSpan }`.
    `spanValue` se lee de `node.layout?.span` en cada render; `commitSpan(nextSpan)` envuelve
    `onCommitNodeUpdate(path, currentNode => withSubsection(currentNode, 'layout', { ...(currentNode.layout ?? {}), span: nextSpan }))`
    y propaga tal cual el `CommitCanvasMutationResult | void` devuelto.
  - `src/dev-runtime/layout-canvas/property-fields/layout-span-widget-context.ts` (nuevo): el
    contexto React (`createContext`) con la forma
    `{ parentColumns: RuntimeResponsiveLayoutValue; spanValue: RuntimeResponsiveLayoutValue | undefined; commitSpan: (nextSpan: RuntimeResponsiveLayoutValue | undefined) => CommitCanvasMutationResult | void } | null`,
    y un hook `useLayoutSpanWidgetContext()` que lanza `Error` con mensaje explícito si el
    contexto es `null` (política única elegida deliberadamente frente a `return null` para que
    un montaje incorrecto falle de forma ruidosa en tests y en desarrollo).
  - `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx` (nuevo,
    versión stub de esta tarea): componente registrado en `WIDGET_REGISTRY['layout-span']` que
    lee el contexto y renderiza un marcador con `data-testid="layout-span-widget"` mostrando el
    `parentColumns` recibido; sin filas, sin edición.
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: añadir
    `layout-span: LayoutSpanPropertyField` al `WIDGET_REGISTRY` existente.
  - `src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx`: forwardear
    `pageLayout` a `LayoutCanvasPropertiesPanel`.
  - `src/dev-runtime/shell-config-panel/shell-actions-list-editor.tsx`: no pasar `pageLayout`
    (queda intencionadamente omitido; documentar en un comentario mínimo que las acciones del
    shell viven fuera del árbol `layout` y no necesitan editor de span).
- Tests:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación): añadir un
    describe "layout subsection visibility" con la nueva regla; **eliminar** el describe
    existente `layout.span edge case` (dos casos, líneas ~127-171 actuales) porque validan el
    comportamiento del dispatcher genérico sobre `layout.span` que este piloto sustituye para
    todos los casos con ancestro válido y elimina para los que no lo tienen — cubierto ahora por
    T3 y por la propia visibilidad de esta tarea.
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: la subsección Editor →
    "Panel de propiedades (modo Editor)" debe actualizarse porque `layout.span` deja de
    editarse con el editor genérico y su visibilidad depende del ancestro. Se marca aquí como
    afectada; la actualización literal la realiza `update-app-documentation` después.

**Tests**
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
- Comportamiento cubierto:
  - Con un nodo dentro de un `container` ancestro con `props.columns` declarado y `pageLayout`
    pasado, la subsección `Layout` renderiza el widget stub (por `data-testid`) y no renderiza
    el input numérico genérico de `span` que hoy existía.
  - Con el mismo nodo sin pasar `pageLayout` (o con `pageLayout` en el que no existe ningún
    `container` ancestro con `columns`), la subsección `Layout` no se renderiza en absoluto (no
    hay input `span`, no hay widget, no hay legend "Layout").
  - Con varios `container` ancestros anidados, cada uno con `columns` distinto, el widget stub
    recibe (verificable vía `data-testid` o texto renderizado) el `columns` del `container` más
    cercano, no del más alto — regresión directa del caso límite de la spec.
  - El contexto expuesto por el panel contiene además de `parentColumns` un `spanValue` igual a
    `node.layout?.span` en el render actual, verificable vía el widget stub (que puede
    serializarlo a `data-*` para el test).
  - El commit por el helper `commitSpan(nextSpan)` del contexto llama a `onCommitNodeUpdate` con
    el mismo `path` del nodo seleccionado y un updater que actualiza `node.layout.span` con
    `nextSpan`, sin tocar otras claves de `layout` (aunque en la práctica hoy `layout` solo
    declara `span`, se prueba con un objeto `layout: { span: { base: 2 } }` inicial más una
    clave extra sintética añadida al `layout` del `node` de prueba, y se verifica que el updater
    la preserva).
  - `commitSpan` propaga el `CommitCanvasMutationResult | void` devuelto por
    `onCommitNodeUpdate` tal cual (probado con un mock que devuelve `{ status: 'rejected', error }`
    y con otro que no devuelve nada), sin envolverlo ni transformarlo.
  - `shell-actions-list-editor.tsx` no regresiona: sus tests existentes en
    `shell-config-panel.test.tsx` y `shell-actions-list-editor` (si tienen aserciones sobre
    `layout`) siguen en verde. No añadir tests nuevos aquí — solo verificar que la ausencia de
    `pageLayout` en ese caller no rompe nada.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
- Restricciones:
  - No añadir tests del widget aquí (van en T3 y T4).
  - No mockear `onCommitNodeUpdate` con `mockReturnValue` en los nuevos casos salvo que sea
    necesario para probar el flujo de commit; el patrón vigente del panel es un `vi.fn()`
    plano (ver el resto del fichero).

**Documentación afectada**
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
  propiedades (comportamiento de `layout.span`).
- `ai-workflow/docs/test-index.md`: actualizar la entrada de
  `layout-canvas-properties-panel.test.tsx` reflejando los nuevos casos y la eliminación del
  describe `layout.span edge case`.

**Criterios de finalización**
- El widget stub aparece en el DOM solo cuando existe ancestro `container` con `columns`.
- El contexto expone `parentColumns` (crudo, sin normalizar) y `commitSpan`.
- La subsección `Layout` desaparece cuando no aplica, sin editor de respaldo.
- Los tests existentes del panel no relacionados con `layout` siguen en verde sin cambios.

**Cierre de implementación**
- Wiring completo, con el widget stub montado y verificable.
- Suite del panel en verde.
- `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## T3 — Widget `LayoutSpanPropertyField` completo (UI, edición, quitar, conversión, feedback por fila)

**Objetivo**
Sustituir el stub de T2 por la implementación real del widget: seis filas fijas
(`base`, `sm`, `md`, `lg`, `xl`, `2xl`) que muestran etiqueta, input numérico editable, indicador
"/ N" con la resolución mobile-first de `parentColumns` para ese breakpoint, botón "Quitar" por
fila con valor explícito, valor heredado en estilo atenuado cuando la fila no tiene valor
explícito, conversión de entero plano a `{ base: N }` en la primera edición, y aviso `role="alert"`
por fila cuando el commit se rechaza.

**Fuera de alcance**
- Cualquier cambio en el schema, en la validación o en el runtime.
- Redacción exacta del título/subtítulo del widget: se resuelve como decisión menor durante la
  implementación (ver "Riesgos" en la spec); usar "Columnas" como título sin subtítulo tipo mock
  (que asume `/ 12` fijo).
- Pickers contextuales para referencias — el input numérico permanece como valor literal.
- Cualquier control para "simplificar" un mapa a entero.
- Estilos avanzados o animaciones más allá de las utilidades Tailwind ya usadas en el panel.

**Dependencias**
- T2 (wiring y contexto).
- T1 (resolución de ancestro, ya usada por el panel para poblar el contexto).
- `normalizeResponsiveLayoutValue` de `src/runtime/runtime-node-styling-base.ts` — el widget la
  importa y la usa como única fuente de la cascada mobile-first, tanto para resolver `/ N` del
  contenedor como para resolver el valor heredado del propio `layout.span`.

**Impacto esperado en archivos**
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/layout-span-property-field.tsx` (sustituye
    el stub de T2 por la implementación completa): seis filas, edición controlada por el
    contexto, conversión entero→mapa, "Quitar", aviso por fila. El widget usa exclusivamente
    `commitSpan` del contexto como canal de escritura y `parentColumns` del contexto como
    denominador; los `value`/`onChange` que le llegan del dispatcher se ignoran deliberadamente
    (no se usan ni para leer el valor mostrado ni para escribir) para que exista un único canal
    de commit y un único origen de datos, evitando que la lógica de rechazo/`role="alert"` se
    bifurque. El `value` mostrado en las filas se lee vía un `spanValue` adicional del contexto
    (`RuntimeResponsiveLayoutValue | undefined`) que el panel de T2 debe exponer.
- Tests:
  - `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (nuevo): tests
    del widget en aislamiento con un harness que provee el contexto (`parentColumns`,
    `commitSpan`), análogo al patrón `ControlledChoiceItemsField` de
    `layout-canvas-property-field-choice-items.test.tsx`.
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: la ficha debe reflejar la
    aparición de un widget dedicado nuevo para `layout.span` con el mismo mecanismo `x-widget`
    del piloto de `choice-items`. La actualización literal la hace `update-app-documentation`.
  - `ai-workflow/docs/test-index.md`: añadir línea del nuevo fichero de test.

**Tests**
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx` (nuevo).
- Comportamiento cubierto:
  - Con `parentColumns = 6` (entero) y `value = undefined`, renderiza las seis filas en orden
    `base`, `sm`, `md`, `lg`, `xl`, `2xl`, cada una con denominador `/ 6` y valor heredado `1`
    en estilo atenuado; ninguna fila muestra "Quitar".
  - Con `parentColumns = { base: 2, md: 4, xl: 12 }` y `value = undefined`, cada fila muestra
    el denominador resultante de aplicar `normalizeResponsiveLayoutValue` a `parentColumns`:
    `base=2`, `sm=2` (heredado de `base`), `md=4`, `lg=4` (heredado), `xl=12`, `2xl=12`.
  - Con `value = { sm: 3, lg: 5 }` y un `parentColumns` cualquiera, cada fila muestra su valor
    explícito o el heredado: `base` heredado a `1` (o `sm` según cascada), `sm=3` explícito,
    `md=3` heredado, `lg=5` explícito, `xl=5` heredado, `2xl=5` heredado; solo `sm` y `lg`
    muestran el botón "Quitar", las demás no.
  - Editar el input de una fila sin valor explícito llama a `commitSpan` con el mapa resultante
    de `{ ...currentSpanMap, [breakpoint]: n }` (merge superficial).
  - Editar el input de una fila con valor explícito reemplaza ese valor en el mapa, sin borrar
    los demás breakpoints declarados.
  - Con `value = 4` (entero plano), la primera edición de cualquier fila (por ejemplo `md`)
    llama a `commitSpan` con `{ base: 4, md: <nuevo> }` — se siembra `base` con el entero
    previo antes del cambio del usuario. Verificar también con edición del propio `base`:
    `commitSpan({ base: <nuevo> })` sin residuos.
  - Con `value = 4` (entero plano), verificar además explícitamente que ninguna de las seis
    filas muestra el botón "Quitar" antes de la primera edición (el entero no tiene claves de
    breakpoint; el botón solo aparece cuando la clave está en el mapa).
  - "Quitar" en una fila con valor explícito llama a `commitSpan` con el mapa sin esa clave.
    Regresión: si al quitar la única clave el mapa queda vacío, `commitSpan` recibe
    `undefined` (equivalente a "sin span") para no dejar `layout: { span: {} }` en el config —
    esta decisión menor se aplica sin abrir alcance.
  - Cerrando el ciclo del bullet anterior: tras esa transición a "sin span", el widget
    (re-renderizado con `spanValue = undefined` inyectado por el harness) muestra las seis
    filas en modo heredado — `base = 1` en gris, y el resto siguiendo la cascada mobile-first
    sobre `undefined` (todo a `1`) — y ninguna fila muestra "Quitar".
  - Quitar el valor explícito de `base` en un mapa sin otros breakpoints anteriores hace que la
    fila `base` muestre `1` en gris (degrada como el runtime).
  - Cuando `commitSpan` devuelve `{ status: 'rejected', error }` para un input concreto (por
    ejemplo, valor fuera de rango simulado por el mock), el input conserva el valor tecleado por
    el usuario y aparece justo debajo un aviso `role="alert"` con `error.code` y
    `error.message`. El aviso vive solo en esa fila; otras filas no lo muestran.
  - Un commit correcto posterior en la misma fila (`{ status: 'applied' }` o `undefined` del
    mock) elimina el aviso de esa fila.
  - Un commit rechazado en una fila y luego un commit correcto en otra fila distinta deja el
    aviso de la primera fila intacto (independencia por fila).
  - Montar el widget fuera del provider del contexto (`LayoutSpanWidgetContext = null`)
    provoca que `useLayoutSpanWidgetContext()` lance `Error`; el test verifica el `throw` con
    el harness estándar de `@testing-library/react` (por ejemplo silenciando `console.error` y
    envolviendo el render en un boundary o usando `renderHook`), confirmando el mensaje del
    error. La política es única y fijada: `throw`, nunca `return null`.
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-layout-span.test.tsx`
- Restricciones:
  - El widget **no** debe reimplementar la cascada mobile-first: cualquier bullet que espere un
    valor heredado debe estar respaldado por `normalizeResponsiveLayoutValue` importada, no por
    un cálculo local. Los tests pueden inspeccionar el DOM, no la lógica interna, pero el
    reviewer verificará que la implementación no duplica la cascada.
  - Reutilizar `EnumPropertyField`, `NumberPropertyField`, `TextPropertyField` o los patrones
    de estilo Tailwind ya usados en el panel; no añadir librerías nuevas.
  - Accesibilidad mínima: cada input tiene su `<label>` asociado al breakpoint, cada botón
    "Quitar" tiene `aria-label` con el nombre del breakpoint, avisos con `role="alert"`.

**Documentación afectada**
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
- `ai-workflow/docs/test-index.md` (nuevo fichero de test).

**Criterios de finalización**
- El widget renderiza las seis filas exactamente como describe la spec, con los estilos
  suficientes para diferenciar explícito vs heredado y para señalar el "/ N".
- El widget no reimplementa la cascada mobile-first: usa `normalizeResponsiveLayoutValue`.
- El feedback por fila cumple el patrón `role="alert"` con código y mensaje del error.

**Cierre de implementación**
- Widget completo, sustituye al stub de T2.
- Suite específica del widget en verde.
- `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## T4 — Integración end-to-end del widget en el flujo real del editor

**Objetivo**
Cerrar los criterios de aceptación 1-9 de la spec probando el widget dentro del panel real de
`LayoutCanvasPropertiesPanel` montado con `pageLayout` real, con `onCommitNodeUpdate` conectado
al pipeline vigente (mismo patrón que `layout-canvas-properties-panel-commit-feedback.test.tsx`),
para verificar:
- que el commit rechazado por `validateRuntimeConfig` (por valor fuera de rango `1..N` para un
  breakpoint) hace aparecer el aviso `role="alert"` sin modificar `currentConfig`;
- que la sincronización con Monaco y el resto del panel de propiedades siguen funcionando sin
  regresión;
- que la exclusión mutua con el panel de Monaco y la guardia de cambios aplicados existentes no
  se ven afectadas.

**Fuera de alcance**
- Nuevos criterios funcionales fuera de la spec.
- Cambios en el pipeline de commit del canvas (`layout-canvas-commit.ts`) o en la validación.
- Reescritura de tests no relacionados con `layout.span`.

**Dependencias**
- T3 (widget completo).

**Impacto esperado en archivos**
- Código: sin cambios previstos. Si un test end-to-end revela un hueco en el wiring de T2/T3,
  cerrarlo en el propio módulo original y no crear un módulo nuevo.
- Tests:
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
    (ampliación): nuevo describe end-to-end para el widget con pipeline real, cubriendo el
    criterio de aceptación 8 (rechazo por rango) y el 9 (no regresión del resto del panel).
- Documentación:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: bloque de `layout.span`
    (afectado ya en T2/T3).
  - `ai-workflow/docs/test-index.md`: actualizar la entrada existente de
    `layout-canvas-properties-panel-commit-feedback.test.tsx` con los casos nuevos.

**Tests**
- Ficheros de test:
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
    (ampliación).
- Comportamiento cubierto:
  - Aceptación 1: seleccionar un nodo sin ancestro `container` con `columns` no muestra ningún
    campo `layout.span` (ni widget, ni editor genérico) y no muestra tampoco el legend `Layout`.
  - Aceptación 2: seleccionar un nodo con ancestro `container` con `columns` muestra el widget
    con las seis filas.
  - Aceptación 3: el denominador `/ N` de cada fila coincide con la resolución mobile-first
    real del `columns` del contenedor (probar con un `columns` responsive).
  - Aceptación 4-6: valores heredados atenuados, edición explícita hace aparecer "Quitar",
    pulsar "Quitar" quita la clave — end-to-end sobre el panel real (no unit del widget).
  - Aceptación 7: conversión entero→mapa preservada al pasar por el pipeline real.
  - Aceptación 8: introducir un valor fuera de rango (por ejemplo `13` con `columns = 6`, o
    `0`) provoca que `validateRuntimeConfig` rechace el commit; el aviso `role="alert"`
    aparece justo debajo de la fila con el código/mensaje del error, `currentConfig` (buffer de
    Monaco) no cambia, y editar la misma fila con un valor válido posterior limpia el aviso.
  - Aceptación 9: al usar el widget, el resto del panel (Props, Visibilidad, Estado de
    consulta), la sincronización con Monaco tras un commit exitoso desde el widget y la
    exclusión mutua con el panel de Monaco siguen funcionando sin regresión — reutilizar los
    patrones de aserción ya establecidos en el fichero.
  - Caso límite: cambiar de nodo seleccionado con un aviso pendiente en una fila descarta el
    aviso (igual comportamiento que el resto de subsecciones del panel).
- Comandos durante la implementación:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
- Restricciones:
  - Usar el pipeline de commit real (`validateRuntimeConfig` + `patchRootKey`) montado como en
    los tests existentes del fichero; no mockear la validación.
  - Reusar el harness / helpers ya presentes en el fichero (`DevRuntimeReady` u otros) para no
    duplicar montaje.

**Documentación afectada**
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: comportamiento estable del
  widget de `layout.span` (final).
- `ai-workflow/docs/test-index.md`: entrada de
  `layout-canvas-properties-panel-commit-feedback.test.tsx` (casos añadidos).

**Criterios de finalización**
- Los nueve criterios de aceptación de la spec están cubiertos por tests que atraviesan el
  pipeline real, no solo el widget en aislamiento.
- No hay regresión en los tests existentes del panel ni de la sincronización con Monaco.

**Cierre de implementación**
- Cobertura end-to-end de la spec en el fichero de tests indicado.
- `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Siguiente tarea a escoger tras cerrar T4

`update-app-documentation` (invocación manual del usuario) sobre las fichas afectadas
identificadas en cada tarea, para reflejar el widget dedicado y el nuevo comportamiento de
visibilidad de `layout.span` en la documentación funcional.
