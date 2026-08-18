# Tareas — 0135 — Editor por-estado en acordeón para `queryStateFeedback`

## Contexto técnico para quien implemente

- El campo afectado es `queryStateFeedback.states`, tab `Queries` del panel de propiedades del
  editor visual. Hoy esa pestaña usa el dispatcher genérico de propiedades
  (`src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`), que resuelve la
  subsección `queryStateFeedback` (`{ query, states }`) como un objeto genérico: `query` como campo
  de texto y `states` como un editor de objeto anidado genérico (una fila `PropertyFieldDispatcher`
  por clave presente). Esta feature sustituye solo la rama de `states` por un widget dedicado —
  `query` no cambia.
- El mecanismo de sustitución de schema ya tiene tres precedentes directos en el propio dispatcher:
  `resolveIconPropsSchema`, `resolveColorSwatchPropsSchema` y `resolveLayoutSubsectionSchema`
  (las tres en `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`). El patrón es
  siempre el mismo: sustituir `properties.<clave>` del fragmento de JSON Schema ya derivado por el
  sentinel `{ 'x-widget': '<key>' }`, que el hook `x-widget` del dispatcher
  (`property-field-dispatcher.tsx`, `WIDGET_REGISTRY`) resuelve al componente registrado. Esta
  feature sigue exactamente ese patrón de sustitución de schema para `queryStateFeedback.states`.
- Contrato de datos (`src/config/runtime-config-types.ts`, `src/config/runtime-config.ts`):
  - `QueryStateFeedbackVisibleState = 'idle' | 'loading' | 'error' | 'empty' | 'success'`
  - `QueryStateFeedbackRule = { mode: 'show' } | { mode: 'hide' } | { mode: 'fallback'; fallback: LayoutNode[] }`
  - `states?: Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>>`
  - Comportamiento implícito por ausencia de clave: `success → show`, resto → `hide`. Esta regla ya
    vive en `getDefaultQueryStateFeedbackRule` (función privada de
    `src/runtime/runtime-query-state-feedback.ts`) — no se reimplementa; se exporta y se reutiliza
    (única fuente de verdad para el comportamiento implícito, evita divergencia futura entre runtime
    y editor).
- **Punto crítico de diseño para FR6** (preservar `fallback` al ir y volver a ese modo sin pasar por
  Monaco, "dentro de la misma sesión de edición del nodo"): el pipeline de commit
  (`commitCanvasMutation` en `src/dev-runtime/dev-runtime.tsx`) hace
  `setCurrentConfig(validation.config)`, y `validation.config` es la salida ya parseada por Zod. Los
  tres schemas de regla (`queryStateFeedbackShowRuleSchema`/`HideRuleSchema`/`FallbackRuleSchema` en
  `src/config/runtime-config-zod.ts`) usan `.strip()`, así que un objeto `{ mode: 'hide', fallback:
  [...] }` commiteado con éxito pierde `fallback` en `currentConfig` — Zod lo descarta al parsear.
  Por tanto **no se puede confiar en el config commiteado para recordar `fallback` mientras el modo
  de una fila no es `Fallback`**: hace falta una caché en memoria, ajena al config, por fila.
- **Esa caché (y el conjunto de filas expandidas) deben sobrevivir a un cambio de pestaña dentro del
  mismo nodo.** `LayoutCanvasPropertiesPanel.renderTabContent` solo monta el contenido de la pestaña
  activa (`{renderTabContent(activeTab.key, activeTab.label)}`) — salir de `Queries` y volver
  desmonta y remonta `QueryStateFeedbackAccordionPropertyField` aunque el nodo seleccionado no haya
  cambiado. Un `useState` interno del widget para la caché de `fallback` o para el conjunto de filas
  expandidas se perdería en cada cambio de pestaña, lo cual contradice tanto FR6 ("dentro de la
  misma sesión de edición del nodo", sin condicionarlo a qué pestaña está activa) como el criterio
  general ya documentado del panel (`dev-mode-editor.md`, "Barra de pestañas del panel de
  propiedades": "cambiar de pestaña no descarta un aviso de commit rechazado pendiente en otra
  pestaña... al volver a esa pestaña el aviso y el valor tecleado siguen visibles"). Este es
  exactamente el problema que ya resolvió `layout-span` (ver
  `src/dev-runtime/layout-canvas/property-fields/layout-span-widget-context.ts`, T6/0133): su
  `rowRejections` se sacó del widget al panel precisamente "so it survives a tab change within the
  same node". Esta feature sigue el mismo mecanismo, no el de `condition-group`/`choice-items`
  (estado íntegramente local al widget, sin necesidad de sobrevivir a nada): un Context propio
  (`QueryStateFeedbackAccordionWidgetContext`, T2) hospeda `fallbackCacheByState` y
  `expandedStates`, y es `LayoutCanvasPropertiesPanel` (T3) quien posee el estado real de ambos y
  lo resetea únicamente cuando cambia el nodo seleccionado (mismo guardia por `serializedPath` que
  ya resetea `pendingRejections`/`layoutSpanRowRejections`/`activeTabKey`).
  - El feedback de commit rechazado (FR7/criterio 8) es distinto y **no** necesita este mecanismo:
    reutiliza sin cambios el `pendingRejections['queryStateFeedback']` genérico que ya usa
    `renderTabContent` para toda la subsección — un widget más entre los que ya se benefician de
    ese canal (como `icon`/`color-swatch`/`condition-group` en `props`/`visibility`), no un canal
    nuevo por fila como el de `layout-span`.
- Las cinco filas siempre se listan, cuando están presentes, en el orden fijo
  `idle → loading → error → empty → success` — nunca el orden de declaración en el JSON
  (`Object.keys`).
- Cada fila presente empieza expandida la primera vez que aparece en la sesión de edición de un
  nodo (al montar el panel para ese nodo, o al añadirla con "Añadir estado"); colapsar es una acción
  local del usuario sobre esa fila, que persiste mientras se siga editando ese mismo nodo
  (incluido cambiar de pestaña y volver a `Queries`) y se pierde solo al seleccionar otro nodo.

## T1 — Helpers puros de estado del acordeón `queryStateFeedback.states`

**Objetivo**: extraer, en un módulo sin React y sin Zod, toda la lógica de reconstrucción del valor
`states` que el widget (T2) y el panel (T3) necesitan: orden fijo de filas, alta/baja de una clave
con el modo implícito correcto, cambio de modo de una fila preservando `fallback` a partir de una
caché dada, y la caché inicial de `fallback`/el conjunto inicial de filas expandidas derivados de un
valor `states` de entrada. También exporta la función de modo implícito por estado, hoy privada en
el runtime, para que el editor y el runtime compartan una única fuente de verdad.

**Fuera de alcance**: cualquier componente React, cualquier Context, cualquier integración con el
dispatcher o con el panel de propiedades (T2/T3), cualquier cambio de comportamiento del runtime de
producción.

**Dependencias**: ninguna. Es la primera tarea de la feature.

**Impacto esperado en archivos**:
- Código:
  - `src/runtime/runtime-query-state-feedback.ts`: cambiar `function getDefaultQueryStateFeedbackRule` por
    `export function getDefaultQueryStateFeedbackRule`. Ningún otro cambio en este archivo — su
    comportamiento actual no se toca.
  - `src/dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-state.ts`
    (nuevo): módulo puro (sin `react`, sin `zod`) que exporta:
    - `QUERY_STATE_FEEDBACK_STATE_ORDER: readonly QueryStateFeedbackVisibleState[]` con el orden
      fijo `['idle', 'loading', 'error', 'empty', 'success']`.
    - `getPresentQueryStateFeedbackStates(states)`: devuelve las claves de `states` presentes,
      filtradas y ordenadas según `QUERY_STATE_FEEDBACK_STATE_ORDER` (ignora cualquier clave que no
      pertenezca al catálogo cerrado, sin lanzar; tolera `states` no siendo un objeto plano).
    - `getAvailableQueryStateFeedbackStatesToAdd(states)`: devuelve, en el mismo orden fijo, los
      estados del catálogo que **no** están presentes en `states` (`states` puede ser `undefined`).
    - `addQueryStateFeedbackStateRow(states, state)`: devuelve un nuevo objeto `states` (no muta el
      recibido) con `state` añadido usando `getDefaultQueryStateFeedbackRule(state)` como regla
      inicial. `states` de entrada puede ser `undefined`.
    - `removeQueryStateFeedbackStateRow(states, state)`: devuelve un nuevo objeto `states` sin esa
      clave; si el resultado queda sin ninguna clave, devuelve `undefined` (nunca `{}`).
    - `setQueryStateFeedbackStateRuleMode(states, state, nextMode, cachedFallback)`: devuelve un
      nuevo objeto `states` con la regla de `state` reconstruida para `nextMode`
      (`'show' | 'hide' | 'fallback'`):
      - `'show'` → `{ mode: 'show' }` (ningún otro campo).
      - `'hide'` → `{ mode: 'hide' }` (ningún otro campo).
      - `'fallback'` → `{ mode: 'fallback', fallback }`, donde `fallback` es: el `fallback` de la
        regla actual de esa fila si su `mode` ya es `'fallback'`; si no, `cachedFallback` si se pasó
        un array; si no, `[]`.
      No lee ni escribe ninguna caché por sí mismo — recibe `cachedFallback` como parámetro puro y
      devuelve el nuevo `states`; la caché en sí vive fuera de este módulo (Context + panel, T2/T3).
    - `buildInitialQueryStateFeedbackFallbackCache(states)`: devuelve un
      `Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>` con una entrada por cada fila de
      `states` cuyo `mode` sea `'fallback'`, tomando su `fallback` tal cual (array, sin clonar
      profundo — mismo criterio que el resto de widgets del panel, que tratan los valores del config
      como datos opacos).
      Todas las funciones anteriores deben tolerar sin lanzar: `states` no siendo un objeto plano
      (p. ej. `null`, un array, un string), y una regla de fila cuyo `mode` no sea uno de los tres
      literales del contrato (tratarla, a efectos de lectura, como si no tuviera `fallback`
      utilizable).

**Documentación afectada**: ninguno (módulo interno sin comportamiento observable propio todavía).

**Tests**:

- **Ficheros de test**:
  - `src/tests/dev-runtime/query-state-feedback-accordion-state.test.ts` (nuevo)
- **Comportamiento cubierto**:
  - `getDefaultQueryStateFeedbackRule` (reexportado): `'success'` devuelve `{ mode: 'show' }`;
    `'idle'`/`'loading'`/`'error'`/`'empty'` devuelven cada uno `{ mode: 'hide' }`.
  - `getPresentQueryStateFeedbackStates`: `undefined` y `{}` devuelven `[]`; un `states` con claves
    en orden de declaración distinto al fijo (p. ej. `{ success: ..., idle: ... }`) devuelve
    `['idle', 'success']`; una clave fuera del catálogo cerrado presente en el objeto se ignora sin
    lanzar; un `states` que no es un objeto plano (`null`, un array) devuelve `[]` sin lanzar.
  - `getAvailableQueryStateFeedbackStatesToAdd`: `undefined` devuelve las 5 claves en el orden fijo;
    un `states` con las 5 claves devuelve `[]`; un `states` con un subconjunto devuelve el
    complemento en el orden fijo.
  - `addQueryStateFeedbackStateRow`: añadir `'error'` a `undefined` produce
    `{ error: { mode: 'hide' } }`; añadir `'success'` a un `states` existente produce
    `{ ...existing, success: { mode: 'show' } }` sin mutar el objeto recibido.
  - `removeQueryStateFeedbackStateRow`: quitar la única clave presente devuelve `undefined` (no
    `{}`); quitar una de varias claves devuelve el resto sin mutar el objeto recibido; quitar una
    clave no presente devuelve un objeto equivalente al de entrada sin lanzar.
  - `setQueryStateFeedbackStateRuleMode`:
    - a `'show'`/`'hide'` desde cualquier modo anterior (incluido `'fallback'` con un `fallback`
      previo) produce exactamente `{ mode: 'show' }`/`{ mode: 'hide' }`, sin ningún campo `fallback`
      residual.
    - a `'fallback'` sin regla previa en modo `fallback` y sin `cachedFallback`: produce
      `{ mode: 'fallback', fallback: [] }`.
    - a `'fallback'` sin regla previa en modo `fallback` pero con `cachedFallback` no vacío: produce
      `{ mode: 'fallback', fallback: cachedFallback }` (mismo array, no una copia — usar `toBe`
      sobre `result.states[state].fallback` y `cachedFallback`, no solo `toEqual`).
    - a `'fallback'` cuando la regla actual de esa fila ya es `{ mode: 'fallback', fallback: X }`:
      produce `{ mode: 'fallback', fallback: X }` conservando `X` (prioridad sobre `cachedFallback`
      aunque se pase uno distinto).
    - no toca ninguna otra clave de `states` al cambiar el modo de una fila.
  - `buildInitialQueryStateFeedbackFallbackCache`: `undefined` devuelve `{}`; un `states` sin
    ninguna fila en modo `fallback` devuelve `{}`; un `states` con una o varias filas en modo
    `fallback` devuelve una entrada por cada una con su array `fallback` tal cual; una fila en modo
    `'show'`/`'hide'` no genera entrada en la caché aunque el objeto tenga una propiedad `fallback`
    residual fuera de contrato.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/query-state-feedback-accordion-state.test.ts`
- **Restricciones**: módulo sin `react` ni `zod` como import — solo tipos de
  `../../../config/runtime-config` y la función reexportada de
  `../../../runtime/runtime-query-state-feedback`. No introducir aquí ningún componente ni JSX.

**Criterios de finalización**: los helpers anteriores existen, están exportados con esas firmas
exactas y pasan la batería de tests descrita.

**Cierre de implementación**: código y tests de T1 completos y en verde
(`pnpm test --run src/tests/dev-runtime/query-state-feedback-accordion-state.test.ts`).

---

## T2 — Context + componente `QueryStateFeedbackAccordionPropertyField` (aislado, sin panel real)

**Objetivo**: construir el Context que hospedará el estado que debe sobrevivir a un cambio de
pestaña (caché de `fallback` por fila, filas expandidas) y el componente React del acordeón que lo
consume, montados y probados en aislamiento con un harness propio que provee ese Context (mismo
criterio que `layout-canvas-property-field-layout-span.test.tsx`: "aislado con un harness que provee
LayoutSpanWidgetContext"), sin `PropertyFieldDispatcher`, sin panel real, sin pipeline de commit
real. Cubre FR2, FR3, FR4, FR5, FR6 y FR8 en aislamiento; la integración con el pipeline real, el
hospedaje real del Context en el panel y el feedback de commit rechazado (FR7) se cierran en T3.

**Fuera de alcance**: registro en `WIDGET_REGISTRY`, sustitución del schema en
`layout-canvas-properties-panel.tsx`, hospedar el estado real del Context en
`LayoutCanvasPropertiesPanel`, cualquier test contra el pipeline de commit real o contra
`validateRuntimeConfig`. Edición del contenido de `fallback` (fuera de alcance de toda la feature,
ver `spec.md`).

**Dependencias**: T1 (usa sus helpers puros).

**Impacto esperado en archivos**:
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-widget-context.ts`
    (nuevo), mismo patrón estructural que `layout-span-widget-context.ts`:
    - `QueryStateFeedbackAccordionWidgetContextValue`:
      - `fallbackCacheByState: Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>`
      - `onFallbackCacheCommit: (state: QueryStateFeedbackVisibleState, fallback: unknown[]) => void`
        — el widget lo llama cada vez que una fila conmuta a modo `Fallback`, con el array que
        acaba de commitear en esa transición (idempotente si ya era ese mismo array).
      - `expandedStates: ReadonlySet<QueryStateFeedbackVisibleState>`
      - `onSetExpanded: (state: QueryStateFeedbackVisibleState, expanded: boolean) => void` — no un
        simple toggle: el widget necesita fijar `true` explícitamente al añadir una fila nueva
        (independientemente de cualquier entrada residual previa para esa clave) y alternar el
        valor actual al pulsar la cabecera de una fila ya presente.
    - `QueryStateFeedbackAccordionWidgetContext = createContext<QueryStateFeedbackAccordionWidgetContextValue | null>(null)`
    - `useQueryStateFeedbackAccordionWidgetContext()`: lee el contexto y lanza si es `null` (mismo
      mensaje/criterio que `useLayoutSpanWidgetContext` — mount fuera de su Provider es un bug de
      wiring, no un estado válido a tolerar en silencio).
  - `src/dev-runtime/layout-canvas/property-fields/query-state-feedback-accordion-property-field.tsx`
    (nuevo). Exporta `QueryStateFeedbackAccordionPropertyField({ label, value, onChange })` con la
    misma forma de props que el resto de entradas de `WIDGET_REGISTRY`
    (`label: string; value: unknown; onChange: (value: unknown) => void`; el componente puede
    ignorar `hideRootLegend` si el dispatcher se lo pasa, igual que `layout-span`/`choice-items`/
    `icon`/`color-swatch`), y consume además
    `useQueryStateFeedbackAccordionWidgetContext()` para `fallbackCacheByState`/
    `onFallbackCacheCommit`/`expandedStates`/`onSetExpanded`. A diferencia de `layout-span`
    (que ignora por completo `value`/`onChange` y escribe solo a través de `commitSpan` del
    contexto), este widget sigue leyendo/escribiendo el valor real de `states` a través de
    `value`/`onChange` como cualquier otro widget de `WIDGET_REGISTRY` — el Context aquí es
    exclusivamente para el estado efímero de UI (caché de fallback, expansión), no para el dato del
    config.
  - Estructura y comportamiento exigidos:
    - `value` se lee como `Partial<Record<QueryStateFeedbackVisibleState, QueryStateFeedbackRule>> | undefined`
      (cualquier otra forma, p. ej. `null` o un array, se trata como `undefined`, sin lanzar).
    - Raíz: `<fieldset data-testid="query-state-feedback-accordion">` con un `<legend>` visible
      (contenido de texto libre a elegir en la implementación — no está fijado por ningún criterio
      de aceptación).
    - Control "Añadir estado": un `<select>` con
      `data-testid="query-state-feedback-accordion-add"` y `aria-label="Añadir estado"`. Su primera
      `option` es un placeholder no seleccionable con el valor vacío (`""`) y texto "Añadir
      estado…"; le siguen una `option` por cada estado devuelto por
      `getAvailableQueryStateFeedbackStatesToAdd(value)`, en ese orden, con `value`/texto igual al
      nombre literal del estado (`idle`/`loading`/`error`/`empty`/`success`, sin traducir). Elegir
      una opción real (no el placeholder) llama a
      `onChange(addQueryStateFeedbackStateRow(value, state))` y a
      `onSetExpanded(state, true)`. Con cero estados disponibles, el `<select>` está `disabled`
      (atributo nativo `disabled`, igual que el resto de controles del panel con capacidad agotada)
      y sigue montado con solo el placeholder.
    - Filas: una por cada estado de `getPresentQueryStateFeedbackStates(value)`, en ese orden fijo.
      Cada fila:
      - contenedor con `data-testid="query-state-feedback-accordion-row-{state}"` (p. ej.
        `query-state-feedback-accordion-row-error`).
      - un botón de cabecera (`<button type="button">`, no anidado dentro de otro elemento
        interactivo) cuyo nombre accesible es el nombre literal del estado, con
        `aria-expanded={expandedStates.has(state)}`, que llama a
        `onSetExpanded(state, !expandedStates.has(state))` al pulsarse (activación nativa de botón:
        `Enter`/`Espacio` funcionan sin manejo adicional).
      - un botón "Quitar" hermano del botón de cabecera (no anidado dentro de él), con
        `aria-label="Quitar estado {state}"` (p. ej. `"Quitar estado error"`), que llama a
        `onChange(removeQueryStateFeedbackStateRow(value, state))`. Siempre habilitado (no hay
        mínimo de filas). No necesita tocar `expandedStates` al quitar una fila (una entrada
        residual para una clave ausente de `value` es inofensiva: no se renderiza ninguna fila para
        ella).
      - cuerpo, montado solo si `expandedStates.has(state)`:
        - el selector de modo, usando el componente compartido
          `SegmentedTogglePropertyField` (`./segmented-toggle-property-field`) con los tres
          segmentos fijos, en este orden:
          `[{ value: 'show', label: 'Mostrar' }, { value: 'hide', label: 'Ocultar' }, { value: 'fallback', label: 'Fallback' }]`,
          `activeValue` igual al `mode` de la regla actual de esa fila tal cual viene en el config
          (si no coincide con ninguno de los tres literales, ningún segmento se marca activo — sin
          intentar normalizarlo). Elegir un segmento distinto llama a
          `onChange(setQueryStateFeedbackStateRuleMode(value, state, nextMode, fallbackCacheByState[state]))`
          y, si `nextMode === 'fallback'`, llama a `onFallbackCacheCommit(state, fallback)` con el
          array `fallback` resultante de esa misma llamada.
        - cuando el `mode` efectivo de la fila es `'fallback'`: un texto (no interactivo, sin
          ningún control de edición/inserción/borrado de nodos) indicando que el contenido de
          `fallback` no se edita todavía desde este panel y remite a Monaco —
          `data-testid="query-state-feedback-accordion-row-{state}-fallback-note"`. Ausente por
          completo del DOM en cualquier otro modo.
    - El componente no mantiene ningún `useState` propio para expansión ni para la caché de
      `fallback` — ambos viven exclusivamente en el Context (T3 los hospeda de verdad; este task
      solo los consume). El componente no lee ni escribe ningún otro estado fuera de sí mismo.

**Documentación afectada**: `ai-workflow/docs/app-features/development/dev-mode-editor.md`
(sección del editor visual del `layout`, subsección del panel de propiedades — la actualización real
se hace en `update-app-documentation`, no aquí).

**Tests**:

- **Ficheros de test**:
  - `src/tests/dev-runtime/query-state-feedback-accordion-property-field.test.tsx` (nuevo)
- **Comportamiento cubierto**:
  - Harness de test: un componente wrapper propio del fichero de test que monta
    `QueryStateFeedbackAccordionWidgetContext.Provider` con estado real controlado por `useState`
    dentro del propio harness (mismo patrón que el harness de
    `layout-canvas-property-field-layout-span.test.tsx` para `LayoutSpanWidgetContext`), de forma
    que los tests puedan verificar tanto lo que el widget commitea (`onChange` espía) como los
    efectos sobre `fallbackCacheByState`/`expandedStates` a través del propio Context.
  - `value` ausente o `{}`: cero filas renderizadas, control "Añadir estado" habilitado con las 5
    opciones (más el placeholder).
  - `value` con una única clave (`{ success: { mode: 'show' } }`) y `expandedStates` del harness
    sembrado con `success`: una única fila `success` presente y expandida, con el segmento
    "Mostrar" activo; "Añadir estado" ofrece las otras 4 claves.
  - Elegir una opción del control "Añadir estado" invoca `onChange` con el resultado exacto de
    `addQueryStateFeedbackStateRow` (mismo objeto que produciría llamando al helper directamente
    con el `value` de entrada) y `onSetExpanded(state, true)`.
  - Pulsar "Quitar estado {state}" invoca `onChange` con el resultado exacto de
    `removeQueryStateFeedbackStateRow`; quitar la única fila presente invoca `onChange(undefined)`.
  - Pulsar el botón de cabecera de una fila expandida invoca `onSetExpanded(state, false)` sin
    invocar `onChange`; el harness, al aplicar ese cambio a su propio estado, hace que el cuerpo de
    la fila se desmonte en el siguiente render (y el botón vuelve a pulsarse para invocar
    `onSetExpanded(state, true)`, remontando el cuerpo).
  - Elegir un segmento de modo distinto invoca `onChange` con el resultado exacto de
    `setQueryStateFeedbackStateRuleMode` para ese cambio concreto, usando el `fallbackCacheByState`
    que el harness tiene en ese momento.
  - Fila en modo `Fallback` sin `fallback` previo ni entrada en la caché: elegir "Fallback" desde
    "Mostrar"/"Ocultar" commitea `{ mode: 'fallback', fallback: [] }`, invoca
    `onFallbackCacheCommit(state, [])`, y la fila muestra la nota de "no editable todavía" sin
    ningún control de edición de nodos en el DOM.
  - Preservación de `fallback` a través del Context (FR6): con el harness manteniendo
    `fallbackCacheByState` entre renders (igual que lo haría el panel real, T3), una fila que
    arranca en modo `Fallback` con `fallback: [{ type: 'paragraph', props: { text: 'Sin datos' } }]`
    (y esa misma referencia ya presente en `fallbackCacheByState` del harness al montar, vía
    `buildInitialQueryStateFeedbackFallbackCache`), cambiada a "Ocultar" y de vuelta a "Fallback" —
    incluyendo un re-render intermedio con un `value` que ya no trae `fallback` en esa fila, tal
    como haría el panel real tras un commit — produce un segundo commit a "Fallback" con ese mismo
    array (`toBe`, no solo `toEqual`, tomado de `fallbackCacheByState`, no de `value`).
  - Un `mode` de fila fuera del catálogo (`'unknown-mode'`, simulando edición manual en Monaco) no
    lanza al montar y no deja ningún segmento del selector marcado activo; el resto del acordeón
    (otras filas, control "Añadir estado") sigue operativo.
  - Regresión: montar `QueryStateFeedbackAccordionPropertyField` sin el Provider lanza (verifica
    `useQueryStateFeedbackAccordionWidgetContext`).
  - Regresión de accesibilidad: el botón de cabecera y el botón "Quitar" de una fila son elementos
    hermanos, ninguno anidado dentro del otro.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/query-state-feedback-accordion-property-field.test.tsx`
- **Restricciones**: no montar `PropertyFieldDispatcher` en este fichero de test — construir el
  árbol contra `QueryStateFeedbackAccordionPropertyField` envuelto en el harness propio del Context,
  con un `vi.fn()` como `onChange` espía (además del estado real del harness para el resto del
  Context), mismo criterio de aislamiento que `layout-canvas-property-field-layout-span.test.tsx`.

**Criterios de finalización**: el Context y el componente existen con la forma anterior, cubren
FR2-FR6 y FR8 en aislamiento (incluida la persistencia de la caché de `fallback` a través del
Context, no de `value`), y pasan la batería de tests descrita.

**Cierre de implementación**: código y tests de T2 completos y en verde
(`pnpm test --run src/tests/dev-runtime/query-state-feedback-accordion-property-field.test.tsx`),
sin regresión en `pnpm test --run src/tests/dev-runtime/query-state-feedback-accordion-state.test.ts`.

---

## T3 — Integración en el dispatcher y en el panel de propiedades (pipeline real)

**Objetivo**: registrar el widget en `WIDGET_REGISTRY`, sustituir el sub-schema de
`queryStateFeedback.states` por el sentinel `x-widget` solo dentro de la pestaña `Queries`, hospedar
en `LayoutCanvasPropertiesPanel` el estado real de `QueryStateFeedbackAccordionWidgetContext`
(persistente entre cambios de pestaña, reseteado solo al cambiar de nodo seleccionado), y cerrar el
criterio de aceptación 8 (feedback de commit rechazado) end-to-end contra el pipeline real. Cierra
FR1 y FR7, y confirma end-to-end FR2-FR6/FR8 ya cubiertos en aislamiento por T2 — incluida la
persistencia real entre pestañas que T2 solo pudo simular con un harness.

**Fuera de alcance**: cualquier cambio a `resolveNodePanelTabs`/`node-panel-tabs.ts` (la pestaña
`Queries` ya existe y no cambia su condición de aparición). Cualquier cambio a `query` (campo de
texto, sin cambios). Cualquier cambio a `validate-runtime-config`/`validate-actions-visibility` o a
la semántica de `queryStateFeedback` en el runtime de producción.

**Dependencias**: T1, T2.

**Impacto esperado en archivos**:
- Código:
  - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`: añadir
    `'query-state-feedback-accordion': QueryStateFeedbackAccordionPropertyField` a
    `WIDGET_REGISTRY`, con el import correspondiente. Ningún otro cambio en este archivo.
  - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`:
    - nueva función `resolveQueryStateFeedbackSubsectionSchema(subsectionSchema)`, mismo patrón que
      `resolveLayoutSubsectionSchema`: si `subsectionSchema.properties.states` existe, devuelve una
      copia de `subsectionSchema` con `properties.states` sustituido por
      `{ 'x-widget': 'query-state-feedback-accordion' }`; si no, devuelve `subsectionSchema` sin
      cambios.
    - en `renderTabContent`, añadir una rama
      `if (key === 'queryStateFeedback' && effectiveSchema) { effectiveSchema = resolveQueryStateFeedbackSubsectionSchema(effectiveSchema) }`,
      en el mismo bloque secuencial donde ya viven las ramas equivalentes para `props`/`layout`
      (antes del bloque `if (key === 'layout')`).
    - dos nuevos `useState` en `LayoutCanvasPropertiesPanel`, junto a `layoutSpanRowRejections`:
      - `queryStateFeedbackFallbackCache: Partial<Record<QueryStateFeedbackVisibleState, unknown[]>>`,
        inicial `{}`.
      - `queryStateFeedbackExpandedStates: ReadonlySet<QueryStateFeedbackVisibleState>`, inicial
        `new Set()`.
    - en el guardia `if (serializedPath !== prevSerializedPath) { ... }` que ya resetea
      `pendingRejections`/`layoutSpanRowRejections`/`activeTabKey`, añadir el reseteo de ambos
      nuevos estados a partir del **nuevo** `node` (ya disponible en ese punto del render):
      leer `readSubsection(node, 'queryStateFeedback')`, extraer `states` si el valor es un objeto
      plano, y llamar a `buildInitialQueryStateFeedbackFallbackCache(states)` /
      `new Set(getPresentQueryStateFeedbackStates(states))` para sembrar los dos nuevos `useState`.
      Esto es lo único que resetea ambos — ni cambiar de pestaña ni ningún otro evento los toca.
    - en `renderTabContent`, envolver el `subsectionField` de `key === 'queryStateFeedback'` en
      `QueryStateFeedbackAccordionWidgetContext.Provider` (import desde
      `./property-fields/query-state-feedback-accordion-widget-context`), con
      `value={{ fallbackCacheByState: queryStateFeedbackFallbackCache, onFallbackCacheCommit: (state, fallback) => setQueryStateFeedbackFallbackCache((prev) => ({ ...prev, [state]: fallback })), expandedStates: queryStateFeedbackExpandedStates, onSetExpanded: (state, expanded) => setQueryStateFeedbackExpandedStates((prev) => { const next = new Set(prev); if (expanded) next.add(state); else next.delete(state); return next }) }}`.
      No darle `key` al Provider — a diferencia de `layout`, aquí el estado que importa vive en el
      panel (no en el widget), así que no hace falta forzar un remount del widget en cada cambio de
      nodo para evitar fugas de estado local: no hay ninguno.
  - Añadir `QueryStateFeedbackVisibleState` a los tipos ya importados desde
    `../../config/runtime-config` en `layout-canvas-properties-panel.tsx` si no está ya importado.

**Documentación afectada**: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (sección
del panel de propiedades / pestaña `Queries`, y referencia cruzada a
`ai-workflow/docs/app-features/references/query-state-feedback.md` si aplica — sin cambios al
contrato funcional de `query-state-feedback.md` en sí).

**Tests**:

- **Ficheros de test**:
  - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación)
  - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliación)
- **Comportamiento cubierto**:
  - En `layout-canvas-property-field-dispatcher.test.tsx`: un schema
    `{ 'x-widget': 'query-state-feedback-accordion' }` delega en
    `QueryStateFeedbackAccordionPropertyField` en vez de cualquier rama genérica (mismo patrón que
    el describe existente `PropertyFieldDispatcher x-widget hook: condition-group`). Este test debe
    montar su propio `QueryStateFeedbackAccordionWidgetContext.Provider` alrededor (el dispatcher no
    lo provee) para que el widget no lance.
  - En `layout-canvas-properties-panel.test.tsx`, contra el pipeline real
    (`onCommitNodeUpdate`/`validateRuntimeConfig` reales, node con `queryStateFeedback` declarado,
    pestaña `Queries` activa):
    - criterio 1: `states` ausente o `{}` muestra el acordeón sin filas, sin fallback al editor
      genérico de objeto anterior.
    - criterio 2: `states: { success: { mode: 'show' } }` muestra la fila `success` con "Mostrar"
      activo.
    - criterio 3: usar el control "Añadir estado" para añadir `error` refleja
      `states.error = { mode: 'hide' }` tanto en el `node` re-renderizado como en el buffer de
      Monaco.
    - criterio 4: cambiar `error` de "Ocultar" a "Mostrar" commitea `states.error = { mode: 'show' }`
      a través del pipeline real.
    - criterio 5: cambiar `error` a "Fallback" sin `fallback` previo commitea
      `states.error = { mode: 'fallback', fallback: [] }` y la fila muestra el texto de "no editable
      todavía" sin ningún control de edición de nodos.
    - criterio 6: un nodo con
      `states.empty = { mode: 'fallback', fallback: [{ type: 'paragraph', props: { text: 'Sin datos' } }] }`
      muestra la fila `empty` en "Fallback" con ese array intacto; cambiar a "Ocultar" y volver a
      "Fallback" conserva ese mismo array en el commit resultante — a través del pipeline real, sin
      simulación de caché.
    - criterio 7: quitar la última fila presente deja `queryStateFeedback` como `{ query: '...' }`
      sin la clave `states` en el config resultante.
    - `query` sigue siendo editable como campo de texto simple sin regresión (criterio 9).
    - **persistencia entre pestañas (cierra el hueco de FR6/expansión detectado en la revisión del
      plan)**: con un nodo cuyo `states.empty` está en modo `Fallback` con un array no vacío,
      cambiar `empty` a "Ocultar", cambiar de pestaña a `Props` y volver a `Queries`, y cambiar
      `empty` de vuelta a "Fallback" — el commit resultante conserva el mismo array de `fallback`
      que tenía antes de salir de ese modo, pese al desmontaje/remontaje del widget entre medias.
      Del mismo modo, colapsar una fila expandida, cambiar de pestaña y volver a `Queries` conserva
      esa fila colapsada (no vuelve a aparecer expandida solo por el cambio de pestaña).
    - aislamiento por nodo: con una fila colapsada manualmente y otra en modo `Fallback` con un
      array cacheado en un primer nodo, seleccionar un segundo nodo con su propio
      `queryStateFeedback`, y volver a seleccionar el primero — el acordeón del primer nodo vuelve a
      arrancar con sus filas presentes expandidas por defecto y sin la caché de `fallback` previa
      (el colapso manual y la caché de la sesión anterior no sobreviven a un cambio de nodo,
      a diferencia de un cambio de pestaña).
  - En `layout-canvas-properties-panel-commit-feedback.test.tsx`: criterio 8 — con
    `onCommitNodeUpdate` mockeado para devolver `{ status: 'rejected', error: ... }`, cambiar el modo
    de una fila conserva el modo elegido por el usuario en el acordeón (el `value` que sigue
    mostrando el widget) y muestra el aviso `role="alert"` bajo `Queries`
    (`layout-canvas-properties-panel-queryStateFeedback-error`, mismo `data-testid` que ya usa el
    resto de subsecciones), con limpieza del aviso al reintentar con éxito o al cambiar de nodo
    seleccionado — mismo criterio que el resto del panel, sin mecanismo nuevo.
- **Comandos durante la implementación**:
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
- **Restricciones**: los tests de este task son end-to-end contra el pipeline real (no vuelven a
  aislar el widget con un harness de Context propio — eso ya lo cubrió T2). No repetir aquí la
  matriz exhaustiva de FR2-FR5/FR8 ya cubierta en aislamiento por
  `query-state-feedback-accordion-property-field.test.tsx`; limitarse a confirmar que el pipeline
  real la respeta (criterios de aceptación 1-9), más los dos casos exclusivos de esta integración:
  persistencia real entre pestañas (FR6/expansión) y aislamiento real entre nodos, y el feedback de
  rechazo (criterio 8).

**Criterios de finalización**: el widget sustituye al editor genérico solo en `Queries` para
`states`, el Context real hospedado en el panel persiste entre pestañas y se resetea solo al cambiar
de nodo, y los 9 criterios de aceptación de `spec.md` (más los dos casos límite anteriores) pasan
contra el pipeline real.

**Cierre de implementación**: código y tests de T3 completos y en verde
(los tres comandos anteriores), sin regresión en la suite completa (`pnpm test`) ni en el umbral de
cobertura global del proyecto.

---

## Siguiente tarea

Empezar por **T1**. El resto sigue el orden secuencial T1 → T2 → T3; ninguna admite paralelizarse
con la anterior porque cada una consume artefactos de la previa (helpers → Context + componente
aislado → integración real en el panel).
