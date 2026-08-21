# Plan — dev-editor-api-preloads-navigate-params

Contrato de ejecución para la feature. Alcance: cerrar los tres puntos del editor visual de
desarrollo que hoy solo se editan escribiendo JSON a mano — `navigateTo.params`, el bloque raíz
`api` y las entradas de `preloads` (shell y por página) — reutilizando el editor clave-valor y el
pipeline de commit/validación ya vigentes. La fuente única de verdad funcional vive en [[spec.md]];
las decisiones técnicas (D1–D8) viven en [[design.md]] y esta planificación las respeta
literalmente.

La feature se divide en dos subsistemas independientes entre sí (no comparten ficheros ni estado):

- **Grupo A — `navigateTo.params` (T1–T4)**: mismo patrón ya usado por `0132`
  (`ConditionGroupPropertyField`/`injectConditionGroupWidgetSentinel`) — un transform puro de
  schema, un widget presentacional, y su aplicación en los dos orígenes de schema cacheado
  (`Layout` y `Shell`).
- **Grupo B — panel "Api" (T5–T7)**: mismo patrón ya usado por `0130` (panel de Traducciones) —
  wiring mínimo (barra, layer, pipeline de commit, esqueleto de panel con las dos sub-vistas ya
  presentes), seguido de la edición manual completa de cada sub-vista.

T1/T2 y T5 no dependen entre sí ni de ningún otro grupo: pueden implementarse en cualquier orden
relativo. Dentro de cada grupo el orden es secuencial. La secuencia numerada de abajo (T1→T7) es el
orden por defecto recomendado; el campo "Dependencias" de cada tarea es la fuente de verdad real.

Anclajes técnicos compartidos por todo el plan:

- **Pipeline de commit**: toda mutación aplicada desde estos paneles sigue el mismo patrón ya
  vigente para `layout`/`shell`/`translations` — mutar en memoria, parchear solo la clave raíz (o
  la clave de página) afectada sobre `lastValidConfigText` con `patchRootKey`/
  `patchRawConfigTextWithLayout` (o su nueva función hermana para `preloads` de página, T7),
  `JSON.parse` + `validateRuntimeConfig`, y solo si es válido `migrateRuntimeStateAcrossConfig` +
  `flushSync` de los mismos setters que ya usa `commitShellMutation`/`commitTranslationsMutation`
  en `src/dev-runtime/dev-runtime.tsx`. Ninguna tarea de este plan modifica `src/config/` — la
  validación real sigue siendo exactamente `validateApiConfig`/`validatePagePreloads`/
  `validateGlobalPreloads`, ya enganchadas a `validateRuntimeConfig` (verificado en
  `src/config/validate-runtime-config.ts`), sin que el panel las invoque directamente.
- **Sin cambios en el schema de Monaco**: `src/dev-runtime/dev-runtime-json-schema.ts` no se toca
  en ningún task. Monaco sigue mostrando el contrato real.
- **Feedback de commit rechazado**: mismo componente `CommitRejectionBanner`
  (`src/dev-runtime/commit-rejection-banner.tsx`) y mismo criterio ya documentado en
  [[../../docs/app-features/development/dev-mode-editor.md#Feedback cuando un cambio del panel de propiedades no se puede guardar]] —
  el valor tecleado por el usuario nunca revierte en silencio.
- **Guardas locales (D7)**: alta de operación con clave duplicada/vacía se rechaza *antes* de
  invocar el commit, con el mismo patrón `localValidationError` + `CommitRejectionBanner` que ya
  usa `TranslationsConfigPanel.handleAddEntry` (`src/dev-runtime/translations-panel/translations-config-panel.tsx`).
  La restricción del desplegable de `operationName` a las claves de `api` (FR14) no necesita guarda
  local propia: el `<select>` simplemente no ofrece ninguna opción fuera del catálogo.
- Los tests de la fase de implementación deben cumplir además las reglas globales de
  `ai-workflow/standards/testing-rules.md` (umbral mínimo global de cobertura del 80 % sobre
  `src/`, tests centrados en comportamiento observable, sin snapshots amplios ni mocks que oculten
  el comportamiento real).

## Orden y dependencias

```
T1 (transform sentinel) ─┐
T2 (widget navigate-params) ─┴─> T3 (wiring Layout) ─> T4 (wiring Shell)

T5 (wiring skeleton Api) ─┬─> T6 (CRUD Operaciones)
                          └─> T7 (CRUD Preloads)
```

- T1 y T2 son independientes entre sí y de todo lo demás.
- T3 depende de T1 y T2.
- T4 depende de T3 (reutiliza la entrada ya registrada en `WIDGET_REGISTRY`).
- T5 es independiente de T1–T4.
- T6 y T7 dependen solo de T5 (no entre sí); T7 amplía el mismo componente `ApiConfigPanel` que T6,
  así que implementar T6 primero evita conflictos de fusión aunque no exista dependencia de código
  real entre ambas.

## Siguiente tarea a escoger

`T1` — ninguna tarea implementada aún. `T2` y `T5` pueden implementarse en paralelo si hay más de
un agente disponible.

---

## Task T1 — Transform de schema `injectNavigateParamsWidgetSentinel`

- **ID**: T1
- **Estado**: pending
- **Objetivo**: Crear una función pura, sin dependencias de React ni de `zod`, que dado un
  fragmento de JSON Schema (`Record<string, unknown>`) devuelva una copia profunda con toda
  propiedad cuya clave sea literalmente `params` sustituida por completo por el sentinel
  `{ 'x-widget': 'navigate-params' }`. Es el mismo patrón ya vigente en
  `src/dev-runtime/layout-canvas/property-fields/inject-condition-group-widget-sentinel.ts`
  (feature `0132`), pero como módulo independiente — no se generaliza ese transform existente para
  aceptar una clave/widget parametrizables; se duplica el recorrido con la nueva clave, mismo
  criterio ya asentado en el proyecto para transforms de schema casi idénticos pero distintos
  (precedente: `dropHrefActionWhereChildrenExist` vs.
  `dropHrefActionWhereChildrenExistFromSidebarItem` en `shell-config-panel.tsx`).

  Contrato exacto:
  - **Ubicación**: `src/dev-runtime/layout-canvas/property-fields/inject-navigate-params-widget-sentinel.ts`.
  - **Firma pública**:
    `export function injectNavigateParamsWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown>`.
    Recibe el schema completo (raíz), devuelve una copia con los sentinels aplicados. No muta el
    schema recibido.
  - **Regla de sustitución**: dentro de un objeto `properties`, cualquier entrada cuya clave sea
    exactamente `'params'` se sustituye por `{ 'x-widget': 'navigate-params' }` — sustitución
    total (no merge), decidida por nombre de clave, no por la forma del fragmento sustituido.
    `params` en el schema real (`navigateToButtonActionSchema.params: z.unknown().optional()`) no
    tiene `type`/`properties` propios que preservar de todos modos.
  - **Recorrido**: desciende recursivamente por `properties`, `items`, `oneOf`, `anyOf` y `$defs`,
    exactamente el mismo conjunto de claves que `injectConditionGroupWidgetSentinel` recorre (ver
    ese fichero como referencia de comportamiento, no como dependencia de código). Cualquier otra
    clave se copia sin recursar — en particular `$ref` se deja intacto.
  - **Idempotencia**: `transform(transform(s))` deep-equal `transform(s)`.
  - **Sin dependencias externas**: no importa `zod`, no importa nada de `src/config/`, no importa
    ningún componente React.

- **Fuera de alcance**:
  - Registro del widget en `WIDGET_REGISTRY` (T3).
  - Aplicación del transform en los getters cacheados (T3 para `Layout`, T4 para `Shell`).
  - Cualquier componente React (T2).
  - Tocar `inject-condition-group-widget-sentinel.ts` existente.

- **Dependencias**: ninguna.

- **Interfaces**:
  - **Consume**: ninguno.
  - **Produce**:
    `injectNavigateParamsWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown>`
    (en `src/dev-runtime/layout-canvas/property-fields/inject-navigate-params-widget-sentinel.ts`)
    — consumido por: T3.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/inject-navigate-params-widget-sentinel.ts`
      (nuevo).
  - Tests:
    - `src/tests/dev-runtime/inject-navigate-params-widget-sentinel.test.ts` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: entrada del nuevo fichero de test bajo `dev-runtime/`.
    - Ninguna ficha de `app-features/` (el transform no es visible hasta T3/T4).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/inject-navigate-params-widget-sentinel.test.ts` (nuevo).
  - **Comportamiento cubierto**:
    - Un schema plano `{ type: 'object', properties: { params: { } } }` produce, tras el
      transform, `properties.params` deep-equal a `{ 'x-widget': 'navigate-params' }`; el resto
      del schema se preserva por igualdad estructural.
    - Un schema con `properties.params` anidado dentro de `oneOf` (caso análogo a las 2/7 variantes
      de acción que declaran `params` — `navigateTo` dentro de `button.props.action`/
      `link.props.action`) queda sustituido en cada rama del `oneOf` que lo declare.
    - Un schema con `items: { properties: { params: {} } }` produce `items.properties.params`
      deep-equal al sentinel.
    - Un schema con `$defs: { '__schema0': { properties: { params: {}, other: {} } } }` produce la
      sustitución dentro de `$defs`.
    - Ninguna propiedad cuya clave sea distinta de `params` (por ejemplo `param`, `paramsList`,
      `pageId`) se toca — verificable con un schema de control con esas claves, que sobreviven al
      transform sin cambios.
    - Un fragmento sin `properties`/`items`/`oneOf`/`anyOf`/`$defs` se copia sin cambios.
    - Idempotencia: `transform(transform(s))` deep-equal `transform(s)`.
    - No-mutación del input: verificable clonando `s` con `structuredClone` antes de transformar y
      comparando con `s` después (deep-equal, sin cambios).
    - Aplicado sobre el schema real `toJSONSchema(buttonNodeSchema)` (importado de
      `src/config/runtime-config-zod.ts` solo en este caso de test), la rama
      `properties.props.oneOf[*].properties.action.oneOf[*].properties.params` correspondiente a
      la variante `navigateTo` queda sustituida por el sentinel; la rama `goBack` (sin `params`) no
      se ve afectada.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/inject-navigate-params-widget-sentinel.test.ts`
  - **Restricciones**:
    - No mockear `zod` ni `toJSONSchema`; el caso sobre schema real usa las funciones reales.

- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se
  edita aquí):
  - `ai-workflow/docs/test-index.md`.

- **Criterios de finalización**:
  - El transform existe, está tipado y su suite en verde.
  - Ningún consumidor del proyecto lo importa todavía.

- **Cierre de implementación**:
  - Fichero nuevo creado y exportable.
  - Suite `pnpm test --run src/tests/dev-runtime/inject-navigate-params-widget-sentinel.test.ts` en
    verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T2 — `KeyValuePropertyField.isValueEditable` + widget `NavigateParamsPropertyField`

- **ID**: T2
- **Estado**: pending
- **Objetivo**: Dos cambios acoplados por la misma necesidad funcional (FR3, D5):
  1. Añadir a `KeyValuePropertyField`
     (`src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx`) un prop
     opcional `isValueEditable?: (value: unknown) => boolean`. Cuando se omite, el comportamiento
     es exactamente el actual (una fila degrada a solo lectura solo si su valor es objeto/array,
     vía la función interna ya existente `isNestedValue`). Cuando se provee, sustituye por completo
     ese criterio: una fila se renderiza editable (input de texto) si y solo si
     `isValueEditable(entryValue)` es `true`; en caso contrario cae al mismo fallback
     `RawJsonPropertyField` de solo lectura que ya usa hoy la rama de valor anidado, sin cambiar
     ninguna otra pieza de la fila (clave, botón "Quitar", "Añadir" siguen igual).
  2. Crear `NavigateParamsPropertyField` — componente presentacional nuevo, contrato
     `{ label: string, value: unknown, onChange: (value: unknown) => void }` (mismo contrato
     mínimo que cualquier entrada de `WIDGET_REGISTRY`, sin `hideRootLegend` porque no lo necesita
     ninguno de sus dos puntos de montaje). Normaliza `value` a `{}` si no es ya un objeto plano no
     nulo ni array (mismo criterio defensivo que `resolveUnionBranch`/`ObjectPropertyField` en
     `property-field-dispatcher.tsx`), y renderiza `<KeyValuePropertyField label={label}
     value={normalizedValue} onChange={onChange} isValueEditable={(v) => typeof v === 'string'}
     />`. El predicado cumple FR3: cualquier valor no-string (number, boolean, null, objeto, array)
     de una fila ya existente se muestra en solo lectura; el resto de filas del mismo `params` no
     se ve afectado.

- **Fuera de alcance**:
  - Registro en `WIDGET_REGISTRY` ni aplicación del sentinel de T1 (T3).
  - Cualquier cambio de comportamiento en los llamadores actuales de `KeyValuePropertyField`
    (`headers`/`query`/`body` en el dispatcher genérico) — deben seguir exactamente igual sin pasar
    el nuevo prop.

- **Dependencias**: ninguna.

- **Interfaces**:
  - **Consume**: ninguno.
  - **Produce**:
    - `KeyValuePropertyField({ label, value, onChange, isValueEditable? }: KeyValuePropertyFieldProps): JSX.Element`
      con `isValueEditable?: (value: unknown) => boolean` añadido a `KeyValuePropertyFieldProps`
      (en `src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx`) —
      consumido por: T2 (este mismo componente, desde `NavigateParamsPropertyField`).
    - `NavigateParamsPropertyField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }): JSX.Element`
      (en `src/dev-runtime/layout-canvas/property-fields/navigate-params-property-field.tsx`) —
      consumido por: T3.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/key-value-property-field.tsx` (modificar:
      nuevo prop opcional).
    - `src/dev-runtime/layout-canvas/property-fields/navigate-params-property-field.tsx` (nuevo).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx` (ampliación).
    - `src/tests/dev-runtime/navigate-params-property-field.test.tsx` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx` (ampliación).
    - `src/tests/dev-runtime/navigate-params-property-field.test.tsx` (nuevo).
  - **Comportamiento cubierto** (`key-value-property-field.test.tsx`, ampliación):
    - Regresión explícita (D5, riesgo residual): sin `isValueEditable`, una fila con valor `42`
      (number) o `true` (boolean) sigue mostrándose como input de texto editable (comportamiento
      actual de `headers`/`query`), no como solo lectura — el nuevo prop no cambia el default.
    - Sin `isValueEditable`, una fila con valor objeto/array sigue cayendo a
      `RawJsonPropertyField` de solo lectura (regresión del comportamiento de `body`).
    - Con `isValueEditable={(v) => typeof v === 'string'}`, una fila con valor `'texto'` se
      renderiza editable; una fila con valor `42`, `true`, `null`, `{}` o `[]` se renderiza vía
      `RawJsonPropertyField` de solo lectura, sin afectar a las demás filas del mismo `value`.
    - Editar la clave o pulsar "Quitar"/"Añadir" en una fila degradada a solo lectura por
      `isValueEditable` sigue funcionando igual que hoy (el `onChange` global de
      `KeyValuePropertyField` no cambia su contrato).
  - **Comportamiento cubierto** (`navigate-params-property-field.test.tsx`, nuevo):
    - Con `value={{ userId: 'params.id' }}`, se renderiza una fila editable con clave `userId` y
      valor `params.id`; editar el valor invoca `onChange` con el objeto actualizado.
    - Con `value={{ page: 2, active: true, note: null }}`, las tres filas se muestran en solo
      lectura (verificable por ausencia de `<input>` de valor editable en esas filas y presencia
      del contenido en el fallback de solo lectura), sin bloquear la edición de una cuarta fila
      string añadida en el mismo objeto.
    - Con `value={undefined}`, `value={null}`, `value={[1,2]}` o `value={'texto'}` (formas no
      objeto-plano posibles si el config llega así desde Monaco), el widget no lanza y renderiza
      el editor sobre un mapa vacío (`Añadir` disponible, sin filas).
    - Pulsar "Añadir" crea una fila con clave y valor vacíos, editable (string vacío es editable
      por el predicado).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-key-value.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/navigate-params-property-field.test.tsx`
  - **Restricciones**:
    - No introducir un segundo componente de fila; `NavigateParamsPropertyField` es una
      composición fina sobre `KeyValuePropertyField`, no un fork.

- **Documentación afectada** (no se edita aquí):
  - `ai-workflow/docs/test-index.md`.

- **Criterios de finalización**:
  - Ambos componentes existen, están tipados y sus suites en verde.
  - Ningún llamador real (dispatcher, `WIDGET_REGISTRY`) los usa todavía.

- **Cierre de implementación**:
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T3 — Wiring de `navigateTo.params` en `Layout` (botones y links)

- **ID**: T3
- **Estado**: pending
- **Objetivo**: Conectar T1 y T2 al panel de propiedades de `Layout` para que `params` de
  `button.props.action`/`link.props.action` (variante `navigateTo`) se edite con el nuevo widget:
  1. Registrar `'navigate-params': NavigateParamsPropertyField` en `WIDGET_REGISTRY`
     (`src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`), mismo hook
     `x-widget` ya usado por `'condition-group'`/`'icon'`/etc.
  2. Aplicar `injectNavigateParamsWidgetSentinel` en `getNodeTypeJsonSchema`
     (`src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts`), encadenado después de
     `injectConditionGroupWidgetSentinel` sobre el mismo `rawSchema` (dos transforms puros
     componibles, cada uno sustituye una clave distinta — `visibility`/`when` uno,
     `params` el otro — sin pisarse).

  Con esto, seleccionar un `button`/`link` con `action.type === 'navigateTo'` en modo Editor
  muestra el campo `params` de su variante activa (ver
  [[../../docs/app-features/development/dev-mode-editor.md#Selector de variante para uniones discriminadas por type (acciones)]])
  como editor clave-valor con degradación por fila (FR1–FR3), sincronizado en vivo con Monaco por
  el mismo pipeline ya vigente (`LayoutCanvasPropertiesPanel` → `commitCanvasMutation`).

- **Fuera de alcance**:
  - `shell.header.menu`/`shell.sidebar.items` (T4).
  - Cualquier cambio en `DiscriminatedUnionPropertyField`, `ObjectPropertyField` o el resto del
    dispatcher genérico.

- **Dependencias**: T1, T2.

- **Interfaces**:
  - **Consume**:
    - `injectNavigateParamsWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown>` (de T1)
    - `NavigateParamsPropertyField({ label, value, onChange }: { label: string; value: unknown; onChange: (value: unknown) => void }): JSX.Element` (de T2)
  - **Produce**: ninguno (registro en un `Record` cerrado ya existente, no expone firma nueva).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (modificar:
      import de `NavigateParamsPropertyField` y entrada nueva en `WIDGET_REGISTRY`).
    - `src/dev-runtime/layout-canvas/layout-canvas-node-schema.ts` (modificar: encadenar
      `injectNavigateParamsWidgetSentinel` tras `injectConditionGroupWidgetSentinel`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: la sección
      "Editor clave-valor (`params`, `query`, `headers`, `body`)" ya menciona `navigateTo.params`
      en su enunciado (texto previamente aspiracional); añadir la nota de degradación por fila
      específica de FR3 (solo-lectura para cualquier no-string, no solo objeto/array) que hoy no
      recoge.
    - `ai-workflow/docs/app-features/navigation/navigate-actions.md`: nota de que `params` ya
      cuenta con editor visual.
    - `ai-workflow/docs/test-index.md`.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-node-schema.test.ts` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto** (`layout-canvas-node-schema.test.ts`, ampliación):
    - `getNodeTypeJsonSchema('button')` y `getNodeTypeJsonSchema('link')` devuelven un schema en el
      que, dentro de la rama `navigateTo` de `props.action`, `properties.params` es deep-equal a
      `{ 'x-widget': 'navigate-params' }`.
    - La rama `visibility`/`when` de ese mismo schema sigue con el sentinel `condition-group`
      (regresión: ambos transforms conviven sin pisarse).
  - **Comportamiento cubierto** (`layout-canvas-property-field-dispatcher.test.tsx`, ampliación):
    - Un schema `{ 'x-widget': 'navigate-params' }` pasado a `PropertyFieldDispatcher` renderiza
      `NavigateParamsPropertyField` (verificable por su comportamiento observable — fila editable
      para un valor string) antes que cualquier detector genérico.
  - **Comportamiento cubierto** (`layout-canvas-properties-panel.test.tsx`, ampliación):
    - Seleccionar un `button` con `props.action = { type: 'navigateTo', pageId: 'home', params: {
      id: 'params.userId' } }` muestra, en la pestaña `Props`, una fila clave-valor editable
      `id` → `params.userId`; editarla actualiza el config aplicado y el buffer de Monaco (mismo
      criterio de sincronización en vivo ya cubierto para `headers`/`query`).
    - Con `params: { id: 'x', active: true }`, la fila `active` se muestra en solo lectura sin
      impedir editar la fila `id`.
    - Añadir una fila nueva desde "Añadir" y luego cambiar la variante de acción a "Sin acción" y
      de vuelta a "Navegar a página" reconstruye `params` desde cero (regresión del comportamiento
      ya documentado del selector de variante — sin cambio de este task, solo verificación de que
      no se rompe).
    - Un `link` con `action.type === 'navigateTo'` muestra el mismo editor (cobertura del segundo
      punto de montaje, no solo `button`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-node-schema.test.ts`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - **Restricciones**:
    - Reutilizar los fixtures/harness ya vigentes en `layout-canvas-properties-panel.test.tsx`
      (mismo patrón de montaje que el resto de acciones ya cubiertas en ese fichero).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/app-features/navigation/navigate-actions.md`.
  - `ai-workflow/docs/test-index.md`.

- **Criterios de finalización**:
  - `params` de `navigateTo` es editable visualmente en el canvas de `Layout` para `button` y
    `link`, verificable manualmente en `pnpm dev`.

- **Cierre de implementación**:
  - Los tres ficheros de test afectados en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T4 — Wiring de `navigateTo.params` en `Shell` (menú y sidebar)

- **ID**: T4
- **Estado**: pending
- **Objetivo**: Cerrar FR1 para el tercer y último punto de montaje: aplicar
  `injectNavigateParamsWidgetSentinel` en los getters de
  `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` que exponen la acción
  `navigateTo` — `getMenuItemJsonSchema` y `getSidebarItemJsonSchema` — encadenado tras
  `injectConditionGroupWidgetSentinel`, mismo patrón que T3 aplicó en `layout-canvas-node-schema.ts`.
  `MenuItemFieldsEditor`/`SidebarItemFieldsEditor` no cambian: ya enrutan `action` a través de
  `DiscriminatedUnionPropertyField` + `PropertyFieldDispatcher` sobre el schema de estos getters
  (`src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx`,
  `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx`), así que con el sentinel ya
  inyectado en el schema que consumen, el dispatcher monta `NavigateParamsPropertyField`
  automáticamente — mismo criterio ya usado en `0129`/`0132` para `icon`/`condition-group` en
  `Shell`.

  Evaluar también `getShellHeaderJsonSchema`/`getShellSidebarJsonSchema`: si su schema generado
  anida `params` sin resolver a través de los getters ya cubiertos (mismo caso ya verificado para
  `visibility` en `0132`-T4), envolverlos con el mismo transform de forma defensiva aunque ningún
  consumidor actual lea `params` directamente de ellos.

- **Fuera de alcance**:
  - Cualquier cambio en `menu-item-fields-editor.tsx`/`sidebar-item-fields-editor.tsx` más allá de
    verificar que no hace falta ninguno.
  - `Layout` (T3, ya cerrado).

- **Dependencias**: T3.

- **Interfaces**:
  - **Consume**:
    `injectNavigateParamsWidgetSentinel(schema: Record<string, unknown>): Record<string, unknown>` (de T1)
  - **Produce**: ninguno.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/shell-config-panel-schema.ts` (modificar: encadenar
      `injectNavigateParamsWidgetSentinel` en `getMenuItemJsonSchema`, `getSidebarItemJsonSchema`
      y, si el schema generado lo requiere, `getShellHeaderJsonSchema`/`getShellSidebarJsonSchema`).
  - Tests:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Sección Shell
      (dominio de configuración)" — mencionar que `params` de una acción `navigateTo` en la lista
      de menú/sidebar reutiliza el mismo editor clave-valor.
    - `ai-workflow/docs/test-index.md`.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - Un `menuItem` en modo "action" con `action = { type: 'navigateTo', pageId: 'home', params: {
      id: 'x' } }` muestra el editor clave-valor de `params` en el formulario del item; editar una
      fila commitea vía `onCommitShellMutation` con el mismo pipeline ya vigente (parcheo de la
      clave raíz `shell`).
    - Un `sidebarItem` en modo "action" con `params` no-string en alguna clave muestra esa fila en
      solo lectura, igual que en `Layout` (T3), sin bloquear el resto de la fila.
    - Regresión: `visibility` de `menuItem`/`sidebarItem` sigue montando
      `ConditionGroupPropertyField` sin cambios (los dos transforms conviven en el mismo schema).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - Reutilizar el mock de `lucide-react` ya presente en el fichero (necesario para montar
      `IconPickerPropertyField` dentro del mismo formulario de acción).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/test-index.md`.
  - `EDITOR-VISUAL-ROADMAP.md`: no se marca aquí (el punto de roadmap "Editor visual de `api`" se
    cierra en T7); `navigateTo.params` no es un ítem propio del roadmap.

- **Criterios de finalización**:
  - `params` de `navigateTo` es editable visualmente en `Shell` (menú y sidebar), verificable
    manualmente en `pnpm dev`. FR1–FR3 quedan completos en los tres puntos de montaje que exige la
    spec.

- **Cierre de implementación**:
  - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx` en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T5 — Wiring del dominio `api`: toolbar, layer, pipeline y esqueleto de panel

- **ID**: T5
- **Estado**: pending
- **Objetivo**: Conectar la infraestructura mínima necesaria para que la pestaña "Api" exista y
  reciba mutaciones a nivel de config, sin funcionalidad de edición todavía (mismo alcance que
  `0130`-T2 para Traducciones):
  1. Activar el botón ya existente `data-testid="dev-editor-toolbar-domain-api"` en
     `DevEditorFloatingToolbar` (`src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx`,
     D4): quitar `disabled`/`aria-disabled`/`title="Próximamente"`, añadir `'api'` a `ToolbarDomain`,
     y cablear `onClick={() => onDomainSelected('api')}`/`aria-pressed={isApiActive}` con el mismo
     patrón `buttonClasses` ya usado por `Shell`/`Traducciones`.
  2. Ampliar `DevEditorLayer` (`src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`) para que,
     cuando `activeDomain === 'api'`, el área central renderice `<ApiConfigPanel />` en vez del
     canvas. Entrar en `api` limpia `selectedPath`/`hoveredPath` con la misma política ya aplicada
     a `shell`/`translations` (ampliar la condición de `handleDomainSelected`).
  3. Añadir `commitApiMutation` en `DevRuntimeReady` (`src/dev-runtime/dev-runtime.tsx`), simétrico
     a `commitShellMutation`: mutar `currentConfig.api`,
     `patchRootKey(lastValidConfigText, 'api', mutatedApi)`, `JSON.parse` +
     `validateRuntimeConfig`, `migrateRuntimeStateAcrossConfig` si aplica, `flushSync` de los
     mismos setters. `api` no tiene la divergencia raw/normalizado que sí tiene `shell.header.actions`
     (una operación `api` no contiene nodos de `layout`), así que no hace falta ningún paso de
     `denormalizeFormNodesForSerialization`. Cablearlo como `onCommitApiMutation` en
     `<DevEditorLayer />`.
  4. Crear `ApiConfigPanel` en su forma esqueleto:
     `src/dev-runtime/api-config-panel/api-config-panel.tsx`. Firma pública:
     `{ api: RuntimeApiConfig, onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult }`.
     En esta tarea el panel renderiza: contenedor con `data-testid="api-config-panel"`; las dos
     sub-vistas de D3 como `role="tablist"` de dos `role="tab"` ("Operaciones", "Preloads"), mismo
     patrón `aria-selected`/`aria-controls` + ambos `tabpanel` siempre montados en el DOM
     (ocultos con `hidden` de Tailwind, nunca desmontados) que ya usa `ShellConfigPanel` para
     Header/Sidebar; "Operaciones" activa por defecto. El `tabpanel` "Operaciones" en esta tarea
     solo lista las claves de `api` en modo solo lectura (o un mensaje de estado vacío si `api` es
     `{}`), sin ningún control de edición. El `tabpanel` "Preloads" en esta tarea solo muestra un
     mensaje de estado vacío fijo, sin leer `preloads` de ningún sitio todavía. Sin controles de
     alta/edición/borrado en ninguna de las dos — esos llegan en T6/T7.

  Con esto, cambiar a la pestaña "Api" ya sustituye el canvas por el panel; el contrato de commit
  de `api` ya está probado end-to-end aunque el panel todavía no lo invoque desde ningún control.

- **Fuera de alcance**:
  - Cualquier control de edición de operaciones (alta, borrado, método, endpoint, query, body,
    headers) — T6.
  - Cualquier control de edición de preloads (global o de página) — T7.
  - `commitGlobalPreloadsMutation`/`commitPagePreloadsMutation` — T7.
  - Cambios en `src/config/` o en el runtime de producción.

- **Dependencias**: ninguna.

- **Interfaces**:
  - **Consume**: ninguno.
  - **Produce**:
    - `ApiConfigPanel(props: ApiConfigPanelProps): JSX.Element` con
      `interface ApiConfigPanelProps { api: RuntimeApiConfig; onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult }`
      (en `src/dev-runtime/api-config-panel/api-config-panel.tsx`) — consumido por: T6, T7 (ambas
      amplían `ApiConfigPanelProps` y el cuerpo del componente).
    - `commitApiMutation(mutate: (api: RuntimeApiConfig) => RuntimeApiConfig): CommitCanvasMutationResult`
      (función interna de `DevRuntimeReady` en `src/dev-runtime/dev-runtime.tsx`) — sin
      consumidores directos fuera de esta tarea (se cablea a `<DevEditorLayer
      onCommitApiMutation={commitApiMutation} />` dentro de la misma tarea).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` (modificar: activar botón
      "Api", extender `ToolbarDomain`, `isApiActive`).
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar: extender la rama de
      dominio activo, importar `ApiConfigPanel`, aceptar y reenviar `onCommitApiMutation`, extender
      `handleDomainSelected` para limpiar selección al entrar en `api`).
    - `src/dev-runtime/dev-runtime.tsx` (modificar: `commitApiMutation` nueva, cablearla en la prop
      de `<DevEditorLayer />`).
    - `src/dev-runtime/api-config-panel/api-config-panel.tsx` (nuevo: esqueleto con las dos
      sub-vistas).
  - Tests:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (nuevo).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nueva pestaña "Api" activa en
      la barra flotante; sustitución del área central por un panel dedicado con dos sub-vistas.
    - `ai-workflow/docs/test-index.md`.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (nuevo).
  - **Comportamiento cubierto** (toolbar, ampliación):
    - El botón `data-testid="dev-editor-toolbar-domain-api"` existe, está habilitado (no
      `disabled`, no `aria-disabled`) y su texto sigue siendo "Api".
    - Con `activeDomain='api'`, `aria-pressed="true"` en el botón "Api" y `"false"` en el resto;
      con `activeDomain='layout'`, `"false"` en "Api".
    - Pulsar el botón invoca `onDomainSelected('api')`.
    - Regresión: "Páginas" y "Tokens" siguen `disabled` con `aria-disabled="true"` y
      `title="Próximamente"`.
  - **Comportamiento cubierto** (layer, ampliación):
    - Con `activeDomain` inicial `'layout'`, el canvas está presente y
      `data-testid="api-config-panel"` no; pulsar "Api" invierte ambos hechos.
    - Volver a "Layout" restaura el canvas y desmonta `ApiConfigPanel`.
    - Cambiar de "Layout" con un nodo seleccionado a "Api" limpia la selección (mismo criterio ya
      cubierto para `shell`/`translations`).
    - Con Monaco abierto, pulsar "Api" no interfiere con el panel de Monaco (misma regresión ya
      cubierta para `shell`/`translations`).
  - **Comportamiento cubierto** (`api-config-panel.test.tsx`, nuevo):
    - Con `api: {}`, se renderiza `data-testid="api-config-panel"`, el `tablist` con dos `tab`
      ("Operaciones" activo por defecto, `aria-selected="true"`; "Preloads",
      `aria-selected="false"`), y un mensaje de estado vacío en el `tabpanel` "Operaciones"; el
      `tabpanel` de "Preloads" está presente en el DOM (no desmontado) pero oculto (clase
      `hidden`).
    - Con `api: { search: { method: 'GET', endpoint: '/x' } }`, el `tabpanel` "Operaciones" muestra
      la clave `search` en modo solo lectura (sin ningún input editable).
    - Pulsar el `tab` "Preloads" activa ese `tabpanel` (`aria-selected` alternando) y muestra su
      mensaje de estado vacío; el `tabpanel` "Operaciones" pasa a `hidden` sin desmontarse
      (verificable con `getByTestId`/`queryByTestId` en vez de `getByText` desapareciendo del DOM).
    - `onCommitApiMutation` recibida como prop no se invoca en el render inicial ni al alternar de
      sub-vista (regresión: T5 no dispara mutaciones).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/api-config-panel.test.tsx`
  - **Restricciones**:
    - No mockear `ApiConfigPanel` en `dev-editor-layer.test.tsx`: el panel real es un esqueleto
      minúsculo, igual que se decidió para `ShellConfigPanel` (montarlo es más barato que
      mockearlo).
    - No introducir todavía ningún control de alta/edición/borrado en ninguna sub-vista — esos
      elementos son de T6/T7 y confundirían la lectura de esta tarea si aparecen antes.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/test-index.md`.

- **Criterios de finalización**:
  - Pulsar "Api" en la barra sustituye el canvas por el panel esqueleto en el editor real
    (verificable manualmente en `pnpm dev` y por los tests del layer).
  - `commitApiMutation` está cableada extremo a extremo y lista para ser invocada desde T6.

- **Cierre de implementación**:
  - Los tres ficheros de test afectados en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T6 — Sub-vista "Operaciones": CRUD completo del bloque `api`

- **ID**: T6
- **Estado**: pending
- **Objetivo**: Convertir el `tabpanel` "Operaciones" (esqueleto de T5) en un editor manual
  completo del bloque `api` (FR4–FR10):
  - **Alta** (FR6, D7): formulario "Añadir operación" (sin caja, cabecera de texto simple, mismo
    lenguaje visual que el resto del editor) con campo "Clave" (texto), "Método" (segmented,
    5 opciones `GET`/`POST`/`PUT`/`PATCH`/`DELETE`, default `GET`) y "Endpoint" (texto), más botón
    "Añadir". Una clave vacía o ya existente en `api` se rechaza con `CommitRejectionBanner` local
    (mismo patrón `localValidationError` que `TranslationsConfigPanel.handleAddEntry`) **antes** de
    invocar `onCommitApiMutation` — no llega a intentar ningún commit. Una clave válida y no
    duplicada commitea `{ ...api, [key]: { method, endpoint } }`; si el commit real se rechaza
    (por ejemplo `endpoint` vacío, rechazado por `validateApiConfig` vía el pipeline), se muestra el
    mismo `CommitRejectionBanner` con el error real del validador, sin aplicar el cambio.
  - **Lista de operaciones** (FR5): una entrada por clave de `api`, siempre expandida (sin
    colapso — a diferencia de los items de `Shell`, no hay jerarquía que gestionar), con la clave
    como cabecera de texto simple no editable (FR8) y un botón "Borrar operación" (FR7) que
    commitea `api` sin esa clave.
  - **Campos por operación** (FR9): `SegmentedTogglePropertyField` para `method` (mismas 5
    opciones); `TextPropertyField` para `endpoint`; `KeyValuePropertyField` para `query` y
    `headers` (label "Query"/"Headers", valor `operation.query ?? {}` / `operation.headers ?? {}`,
    sin `isValueEditable` — comportamiento por defecto). Cada edición commitea de inmediato
    `{ ...api, [key]: { ...api[key], [campo]: nextValue } }` vía `onCommitApiMutation`, con
    `CommitRejectionBanner` propio por campo si se rechaza. Corrección de precedente (verificado
    contra el código real durante la revisión del plan): `ShellConfigPanel` sí aísla avisos por
    campo con un `pendingRejections` + `recordResult`, pero su clave (`ShellPendingKey`) es una
    unión cerrada de solo dos literales fijos (`'logo' | 'title'`), no una clave compuesta — no hay
    nada que "reutilizar tal cual" ahí para N campos por operación. El patrón de **clave compuesta**
    que sí hace falta aquí (`${operationKey}.${campo}`) sigue en cambio el criterio ya usado por
    `TranslationsConfigPanel` para aislar rechazos por celda (`${key}:${lang}` en
    `translations-config-panel.tsx`): generalizar `pendingRejections`/`recordResult` de
    `ApiConfigPanel` con ese mismo criterio de clave compuesta, sin asumir que ya existe una
    implementación de clave compuesta lista para copiar en `shell-config-panel.tsx`.
  - **`body`** (FR10, D8): oculto por completo mientras `method` activo es `GET` (ni el campo ni
    su fallback se renderizan); visible con cualquier otro método. Cuando es visible: si
    `operation.body` es un objeto plano o está `undefined` (tratado como `{}`), se edita con
    `KeyValuePropertyField` (label "Body", sin `isValueEditable` — degradación por clave ya
    existente para valores anidados); si `operation.body` ya tiene otra forma (string, number,
    boolean, `null`, array — un valor válido según el contrato pero no representable como mapa),
    se muestra con `RawJsonPropertyField` de solo lectura (mismo criterio que
    `PropertyFieldDispatcher.isBareRefSchema` aplica hoy para `body` en `Layout`).

- **Fuera de alcance**:
  - Sub-vista "Preloads" (T7).
  - `errorCondition`/`errorMessagePath`/`errorCodePath` de una operación — no los pide la spec
    (fuera del alcance de FR9, que solo lista método/endpoint/query/body/headers); esos campos, si
    ya existen en una operación editada desde este panel, se preservan tal cual en cada commit
    (spread del resto de la operación) pero no se exponen ningún control para editarlos.
  - Pickers contextuales de referencias.

- **Dependencias**: T5.

- **Interfaces**:
  - **Consume**:
    `ApiConfigPanel(props: ApiConfigPanelProps): JSX.Element` con
    `interface ApiConfigPanelProps { api: RuntimeApiConfig; onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult }`
    (de T5).
  - **Produce**: ninguno (el contenido nuevo vive dentro de `ApiConfigPanel` y de un componente
    interno `ApiOperationFieldsEditor` sin consumidores fuera de este mismo módulo).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/api-config-panel/api-config-panel.tsx` (modificar: sustituir el contenido
      solo-lectura del `tabpanel` "Operaciones" por el editor completo; estado local
      `pendingRejections`).
    - `src/dev-runtime/api-config-panel/api-operation-fields-editor.tsx` (nuevo: formulario de una
      operación — método/endpoint/query/body/headers — reutilizado por cada fila de la lista).
  - Tests:
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (ampliación).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sub-sección nueva "Sección
      Api — Operaciones" (mismo nivel que "Sección Shell"/"Sección Traducciones").
    - `ai-workflow/docs/app-features/config/api-catalog.md`: no aplica (documenta el contrato
      runtime, no el editor visual).
    - `ai-workflow/docs/test-index.md`.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - Alta con clave `search`, método `GET` (default), endpoint `/api/search` produce un commit
      `onCommitApiMutation` cuyo resultado mutado es `{ search: { method: 'GET', endpoint:
      '/api/search' } }` sobre un `api` inicial vacío.
    - Alta con clave ya existente en `api` no invoca `onCommitApiMutation` y muestra un aviso
      `role="alert"` local con la clave en el mensaje.
    - Alta con clave vacía (solo espacios) no invoca `onCommitApiMutation` y muestra aviso local.
    - Alta con endpoint vacío invoca `onCommitApiMutation`, cuyo mock simula rechazo
      (`{ status: 'rejected', error }`); se muestra `CommitRejectionBanner` con ese error exacto.
    - Borrar una operación existente commitea `api` sin esa clave (verificable con el argumento
      recibido por el mock de `onCommitApiMutation`).
    - Cambiar `method` de una operación de `GET` a `POST` commitea solo ese campo, preservando
      `endpoint`/`query`/`headers` ya declarados de esa operación; el campo `body` pasa de oculto a
      visible tras el cambio.
    - Cambiar `method` de `POST` a `GET` oculta el campo `body` sin borrarlo del valor en memoria
      (el siguiente commit de cualquier otro campo de esa operación sigue enviando el `body`
      previo intacto en el objeto mutado, aunque el panel ya no lo muestre).
    - Editar una fila de `query`/`headers`/`body` (objeto) de una operación existente commitea el
      mapa completo actualizado, preservando el resto de la operación (`method`, `endpoint`, y los
      otros dos mapas) intacto.
    - Con `operation.body` como `"texto"` (no objeto) y `method !== 'GET'`, el campo se muestra vía
      `RawJsonPropertyField` de solo lectura, sin lanzar y sin ofrecer edición por filas.
    - Un commit rechazado en `query`/`headers`/`body`/`endpoint` de una operación existente
      conserva el valor tecleado y muestra `CommitRejectionBanner` propio de ese campo, sin afectar
      al aviso de otro campo de la misma o de otra operación (aislamiento por clave compuesta).
    - Con `api: {}`, el estado vacío del `tabpanel` "Operaciones" (de T5) sigue mostrándose junto
      al formulario de alta (regresión del esqueleto).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/api-config-panel.test.tsx`
  - **Restricciones**:
    - Reutilizar `CommitRejectionBanner`/`localValidationError` (patrón, no import compartido —
      `localValidationError` es una función privada de `translations-config-panel.tsx`; replicar
      su forma mínima — un `RuntimeConfigError` sintético con `code: 'invalid-layout'` — dentro de
      `api-config-panel.tsx`, mismo criterio que ya siguió `TranslationsConfigPanel` sin exportar
      un helper compartido nuevo).
    - No introducir colapso/expansión por operación: cada fila del listado se muestra siempre
      expandida.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/test-index.md`.

- **Criterios de finalización**:
  - El bloque `api` es editable visualmente de principio a fin (alta, edición de los 5 campos,
    borrado), verificable manualmente en `pnpm dev`. FR4–FR10 quedan completos.

- **Cierre de implementación**:
  - `pnpm test --run src/tests/dev-runtime/api-config-panel.test.tsx` en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task T7 — Sub-vista "Preloads": precargas globales y de página activa

- **ID**: T7
- **Estado**: pending
- **Objetivo**: Convertir el `tabpanel` "Preloads" (esqueleto de T5) en el editor completo de D3
  (FR11–FR15):
  1. Añadir `patchRawConfigTextWithPagePreloads` en `src/dev-runtime/layout-canvas/layout-canvas-commit.ts`,
     función hermana de `patchRawConfigTextWithLayout` (D6): misma técnica (parsear
     `rawConfigText`, sustituir solo la clave `preloads` de la página `activePageId` dentro del
     array `pages` del texto crudo, delegar en `patchRootKey` para `pages`), pero para `preloads`
     en vez de `layout`. Cuando `mutatedPreloads` es `undefined` o un array vacío, la clave
     `preloads` de esa página se omite del objeto resultante (no se deja `preloads: []`) — mismo
     criterio de "no dejar un bloque vacío residual" ya aplicado por `commitShellSectionToggle` en
     `ShellConfigPanel` al desactivar una sección.
  2. Añadir `commitGlobalPreloadsMutation` y `commitPagePreloadsMutation` en `DevRuntimeReady`
     (`src/dev-runtime/dev-runtime.tsx`). `commitGlobalPreloadsMutation` sigue el patrón de
     `commitShellMutation` sobre la clave raíz `preloads` vía `patchRootKey` (mismo criterio de
     omitir la clave si el resultado es `undefined`/`[]`). `commitPagePreloadsMutation` resuelve
     `activePageId` igual que `commitCanvasMutation` (vía `bridgeRef.current?.getLatestState()...
     ?? currentConfig.initialPage`) y usa `patchRawConfigTextWithPagePreloads` sobre
     `lastValidConfigText`. Ambas cablean como nuevas props de `<DevEditorLayer />`.
  3. Ampliar `ApiConfigPanelProps`/`ApiConfigPanel`
     (`src/dev-runtime/api-config-panel/api-config-panel.tsx`) con
     `globalPreloads: RuntimePreloadConfig[] | undefined`, `activePageId: string`,
     `pagePreloads: RuntimePreloadConfig[] | undefined`,
     `onCommitGlobalPreloadsMutation`/`onCommitPagePreloadsMutation` (misma firma que
     `commitGlobalPreloadsMutation`/`commitPagePreloadsMutation`), reenviadas desde
     `DevEditorLayer` (que ya calcula `activePage`/`activePageId` — mismos valores que usa para el
     canvas).
  4. Reemplazar el estado vacío fijo del `tabpanel` "Preloads" por dos secciones apiladas sin caja
     ("Precargas globales" y "Precargas de la página activa"), cada una montando un componente
     compartido `PreloadsListEditor` — nuevo, `src/dev-runtime/api-config-panel/preloads-list-editor.tsx`
     — parametrizado por `{ preloads, operationCatalog: RuntimeApiConfig, onCommitPreloads }`.
     La sección de página se remonta (`key={activePageId}`) al cambiar de página activa, para no
     arrastrar un borrador de alta a medio rellenar de una página a otra.
  5. `PreloadsListEditor` cubre alta/borrado (FR12/FR13) y delega en un componente
     `PreloadEntryFieldsEditor` (nuevo, `preload-entry-fields-editor.tsx`) por entrada: un `<select>`
     de `operationName` cuyas opciones son exactamente `Object.keys(operationCatalog)` (FR14 — el
     `<select>` nunca ofrece una opción fuera de ese catálogo; si el `operationName` vigente de la
     entrada no está en el catálogo, el `<select>` simplemente no lo tiene como opción
     seleccionable, sin forzar ningún cambio de valor — D7/caso límite), y `requestParams`
     (`query`/`headers`/`body`) con el mismo editor `KeyValuePropertyField` y la misma regla de
     ocultar `body` cuando el `method` de la operación referenciada es `GET` que T6 (D8) — resuelto
     buscando `operationCatalog[entry.operationName]?.method`; si la operación referenciada no
     existe en el catálogo (referencia rota), `body` se muestra igual que con cualquier otro método
     (no se oculta, ya que no hay forma de resolver su método).

- **Fuera de alcance**:
  - Edición de `when` de una entrada de preload (fuera de alcance según spec.md).
  - Autocorrección de un `operationName` que apunte a una operación borrada (spec.md, caso
    límite).
  - `errorCondition` u otros campos de operación no cubiertos por `requestParams`.

- **Dependencias**: T5. (Se recomienda implementar después de T6 para evitar conflicto de fusión
  sobre `api-config-panel.tsx`, aunque no existe dependencia de código entre T6 y T7.)

- **Interfaces**:
  - **Consume**:
    `ApiConfigPanel(props: ApiConfigPanelProps): JSX.Element` con
    `interface ApiConfigPanelProps { api: RuntimeApiConfig; onCommitApiMutation: (mutate: (api: RuntimeApiConfig) => RuntimeApiConfig) => CommitCanvasMutationResult }`
    (de T5).
  - **Produce**:
    - `patchRawConfigTextWithPagePreloads(rawConfigText: string, activePageId: string, mutatedPreloads: readonly RuntimePreloadConfig[] | undefined): string`
      (en `src/dev-runtime/layout-canvas/layout-canvas-commit.ts`) — sin consumidores directos
      fuera de esta tarea (usado por `commitPagePreloadsMutation`, definida en la misma tarea).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/layout-canvas-commit.ts` (modificar: nueva función
      `patchRawConfigTextWithPagePreloads`).
    - `src/dev-runtime/dev-runtime.tsx` (modificar: `commitGlobalPreloadsMutation` y
      `commitPagePreloadsMutation` nuevas, cableadas como props de `<DevEditorLayer />`).
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar: aceptar y reenviar las
      dos nuevas props de commit más `globalPreloads`/`activePageId`/`pagePreloads` a
      `ApiConfigPanel`).
    - `src/dev-runtime/api-config-panel/api-config-panel.tsx` (modificar: ampliar
      `ApiConfigPanelProps`, sustituir el contenido del `tabpanel` "Preloads").
    - `src/dev-runtime/api-config-panel/preloads-list-editor.tsx` (nuevo).
    - `src/dev-runtime/api-config-panel/preload-entry-fields-editor.tsx` (nuevo).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (ampliación).
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sub-sección nueva "Sección
      Api — Preloads".
    - `ai-workflow/docs/app-features/queries/preloads.md`: no aplica (documenta el contrato
      runtime, no el editor visual).
    - `ai-workflow/docs/test-index.md`.
    - `EDITOR-VISUAL-ROADMAP.md`: marcar el punto "Editor visual de `api`" como abordado (T5–T7
      cierran el alcance completo del panel "Api", incluidos preloads).

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-commit.test.tsx` (ampliación).
    - `src/tests/dev-runtime/api-config-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación).
  - **Comportamiento cubierto** (`layout-canvas-commit.test.tsx`, ampliación):
    - `patchRawConfigTextWithPagePreloads` sobre un texto con dos páginas sustituye solo
      `preloads` de la página `activePageId` indicada, dejando `layout`/`title` de esa misma página
      y el resto del documento (`api`, `initialPage`, la otra página completa) exactamente igual
      (comparación por texto/objeto tras `JSON.parse`).
    - Con `mutatedPreloads: []` o `undefined`, la clave `preloads` desaparece del objeto de esa
      página en el texto resultante (no queda `"preloads": []`).
    - Con `mutatedPreloads` no vacío, la página resultante incluye exactamente ese array
      (serializado tal cual, sin normalizar `operationName`/`requestParams` — mismo criterio "raw"
      que ya sigue `patchRawConfigTextWithLayout` para `layout`).
  - **Comportamiento cubierto** (`api-config-panel.test.tsx`, ampliación):
    - Con `globalPreloads: undefined` y `pagePreloads: undefined`, ambas secciones del `tabpanel`
      "Preloads" muestran su estado vacío con opción de alta (FR criterios de aceptación).
    - Alta de una entrada global con `operationName` elegido de un `<select>` cuyas únicas opciones
      son las claves de `api` recibido; commitea vía `onCommitGlobalPreloadsMutation` con el nuevo
      array incluyendo esa entrada, preservando las ya existentes.
    - Alta de una entrada en "Precargas de la página activa" commitea vía
      `onCommitPagePreloadsMutation`, no vía `onCommitGlobalPreloadsMutation` (aislamiento entre
      ambas secciones).
    - Borrar una entrada (global o de página) commitea el array sin esa entrada por la vía
      correspondiente.
    - Con un `api` que incluye una operación `GET`, el `requestParams.body` de una entrada de
      preload que la referencia no se renderiza; cambiando el `operationName` de la entrada a una
      operación `POST` del catálogo, `body` pasa a visible.
    - Con una entrada cuyo `operationName` no existe en `api` (referencia rota), el `<select>` no
      la muestra seleccionada (ninguna `<option>` con ese valor) pero el resto de la fila
      (`requestParams`) sigue editable; `body` se muestra como si no fuera `GET` (sin ocultar).
    - Editar `query`/`headers`/`body` de una entrada existente commitea `requestParams` actualizado
      preservando `operationName`.
    - Cambiar la página activa (`pagePreloads`/`activePageId` cambian de prop) descarta cualquier
      borrador de alta a medio rellenar en la sección de página (verificable: el formulario de
      alta vuelve a su estado inicial), sin afectar a la sección global.
    - Un commit rechazado en cualquiera de las dos secciones muestra `CommitRejectionBanner` con
      el error real, sin aplicar el cambio.
  - **Comportamiento cubierto** (`dev-editor-layer.test.tsx`, ampliación):
    - `ApiConfigPanel` recibe `globalPreloads`/`activePageId`/`pagePreloads` iguales a
      `config.preloads`/`activePage.id`/`activePage.preloads` ya calculados por `DevEditorLayer`
      para el resto de usos (mismos valores que ya expone para el canvas).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-commit.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/api-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
  - **Restricciones**:
    - `PreloadsListEditor`/`PreloadEntryFieldsEditor` son los únicos puntos de edición de
      `RuntimePreloadConfig[]` en este panel — la sección global y la de página montan la misma
      pareja de componentes con distintos props, sin una segunda implementación paralela.
    - No introducir edición de `when` en `PreloadEntryFieldsEditor` (fuera de alcance).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/test-index.md`.
  - `EDITOR-VISUAL-ROADMAP.md`.

- **Criterios de finalización**:
  - `preloads` (global y por página) es editable visualmente de principio a fin (alta, edición,
    borrado, restricción de `operationName` al catálogo), verificable manualmente en `pnpm dev`.
    FR11–FR15 quedan completos y la feature completa (FR1–FR15) queda cerrada.

- **Cierre de implementación**:
  - Los tres ficheros de test afectados en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).
