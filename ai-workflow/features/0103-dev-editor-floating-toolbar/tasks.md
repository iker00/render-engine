# Tasks: 0103 — Editor visual in-place con barra flotante (modo desarrollo)

Contrato de ejecución para la implementación de la feature. Cada tarea es atómica, secuencial, y su cierre habilita
la siguiente. Las decisiones técnicas están cerradas en `design.md` (Decisiones 1–8); esta lista no las reabre.

Convenciones:
- Orden estricto: las tareas se ejecutan en el orden en que aparecen. Cada dependencia declarada apunta hacia arriba.
- "cierre de implementación": código y tests de la tarea completos, `pnpm test --run <ruta>` en verde para cada
  fichero declarado en el sub-bloque `tests` de la tarea.
- Cobertura global (`pnpm test`) se comprueba una única vez al final de la fase de implementación, no por tarea
  (regla global recogida en `ai-workflow/standards/testing-rules.md`).
- Todas las tareas que tocan `src/runtime/` (código compartido con producción) deben dejar el comportamiento de
  producción bit a bit idéntico cuando `LayoutEditModeContext` no está presente (mismo requisito que `0102`). Cada
  tarea que introduce un cambio en esos ficheros añade un test de regresión explícito.
- El único punto de entrada al editor tras esta feature es la barra flotante (spec FR1). `DevRuntimeToggleButton` y
  el atajo `Ctrl/Cmd+Shift+J` se retiran (design.md, Decisión 7); `Esc` para cerrar el panel de Monaco cuando está
  abierto se conserva porque no es punto de entrada, es solo cierre.

---

## T1 — Supresión centralizada de acciones declarativas en `useRuntimeStateActions()`

- **ID**: T1
- **Estado**: completada
- **Objetivo**: implementar la Decisión 3 de `design.md`. Modificar
  `src/runtime/runtime-state/runtime-state-provider.tsx` para que `useRuntimeStateActions()` lea
  `useLayoutEditModeContext()` (nuevo import desde `../layout-edit-mode-context`) y, cuando el contexto **no** sea
  `null`, sustituya exactamente las seis funciones que la spec (FR10) enumera como acciones declarativas por
  versiones no-op:
  - `navigateToPage`: no despacha `navigation/*` ni llama `pushBrowserHash`; retorna `undefined`.
  - `goBackPage`: no llama `window.history.back()`; retorna `undefined`.
  - `openModal`: no despacha `modal/open`; retorna `undefined`.
  - `closeModal`: no despacha `modal/close`; retorna `undefined`.
  - `resetForm`: no despacha `forms/reset`; retorna `undefined`.
  - `executeQueryOperation`: **async**, resuelve inmediatamente a un objeto neutro `{ status: 'skipped' as const }`
    sin despachar ningún `queries/*` ni ejecutar `fetch`. **Ampliación explícita del tipo de retorno**: hoy la
    firma inferida de `executeQueryOperation` es
    `(operationName, options?) => ReturnType<typeof executeQueryOperationWithSnapshot>`, cuyo `.status` es la
    unión `'success' | 'error'`. La versión no-op del modo Editor amplía esa unión a
    `'success' | 'error' | 'skipped'` — el subagente introduce el tercer variante añadiendo el objeto
    `{ status: 'skipped' as const }` directamente en la rama del `if (editModeContext !== null)`; TypeScript
    infiere la unión ampliada sin necesidad de `as` inseguros ni de tocar `executeQueryOperationWithSnapshot`. El
    consumidor `handleSubmit` de `form-layout-node.tsx` verifica hoy `result.status === 'success'` y
    `result.status === 'error'` con ramas explícitas; `'skipped'` no cae en ninguna de esas dos ramas, así que
    `runOnSuccessActions`/`runOnErrorActions` no se disparan — mismo requisito de la spec sin más cambios en
    consumidores.
- **Regla vinculante — el resto de funciones del hook no se tocan**: `setFormFieldValue`, `setFormFieldError`,
  `initializeForm`, `removeForm`, `initializeQuery`, `setQueryLoading`, `setQuerySuccess`, `setQueryError`,
  `resetQuery`, `executeInlineQueryOperation`, `readRuntimeState`, `resetRuntimeState` deben seguir siendo referencia
  y comportamiento idénticos con y sin contexto de edición (son mecanismo interno de formularios/queries que debe
  seguir funcionando: normalización automática de campos de elección en `form-layout-node.tsx`, inicialización de
  campos ocultos, opciones dinámicas de select, etc.). El objeto retornado por el hook debe conservar exactamente
  las mismas claves y en el mismo orden que hoy; solo cambia el cuerpo de las seis funciones enumeradas.
- **Regla vinculante — sin proveedor, byte-idéntico (comportamiento observable)**: cuando
  `useLayoutEditModeContext()` devuelve `null` (producción y cualquier consumo fuera de `DevRuntime`), las seis
  funciones producen exactamente los mismos side-effects observables que hoy (mismo despacho, mismos payloads,
  mismo retorno). La equivalencia es de **comportamiento observable**, no de identidad referencial estricta: al
  condicionar el cuerpo de las seis funciones al valor de `editModeContext`, éste pasa a formar parte de las
  dependencias efectivas de las `useCallback` que envuelven a esas funciones, así que su referencia cambia
  legítimamente cuando el contexto pasa de `null` a un objeto no nulo. Los tests de regresión deben fijar
  comportamiento observable (dispatch, side-effect, valor devuelto), no identidad referencial de las funciones a
  través de re-renders con distinto contexto.
- **Fuera de alcance**:
  - montaje del `LayoutEditModeProvider` alrededor de `<RuntimePage />` (T8).
  - la barra flotante y el resto de UI (T4–T8).
  - el `<fieldset disabled>` para campos de formulario (T2), que es un mecanismo distinto (spec RNF: los siete tipos
    de campo no pasan por `useRuntimeStateActions()`).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar: import de `useLayoutEditModeContext` y
      condicionar el cuerpo de las seis funciones al contexto)
  - tests:
    - `src/tests/runtime-state/runtime-state-edit-mode-suppression.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva sección "Modo Editor: supresión
    de comportamiento propio"; referencia para `update-app-documentation`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime-state/runtime-state-edit-mode-suppression.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Sin `LayoutEditModeProvider` (contexto `null`): `navigateToPage('page-b')` desde un componente montado dentro
      de `RuntimeStateProvider` cambia `state.navigation.currentPageId` a `'page-b'` — comportamiento actual, sin
      regresión.
    - Sin `LayoutEditModeProvider`: `openModal('m')` marca el modal `m` como abierto en `state.modal`; `closeModal('m')`
      lo cierra; `resetForm('f')` limpia los valores del formulario `f`; `goBackPage()` llama a `window.history.back()`
      (mockeado); `executeQueryOperation('op')` despacha `queries/set-loading` y `queries/set-success` (o `set-error`)
      contra un `fetch` mockeado — comportamiento actual, sin regresión.
    - Con `LayoutEditModeProvider value={{selectedPath: null, hoveredPath: null, onSelectNode: noop, onHoverNode: noop}}`
      envolviendo al consumidor: `navigateToPage('page-b')` no cambia `state.navigation.currentPageId`.
    - Con proveedor montado: `openModal('m')` no marca el modal como abierto (state.modal no cambia); `closeModal('m')`
      no lo cierra; `resetForm('f')` no cambia el estado del formulario; `goBackPage()` no llama a
      `window.history.back()` (el spy no se invoca).
    - Con proveedor montado: `await executeQueryOperation('op')` resuelve a un objeto con `status === 'skipped'`,
      no despacha ningún `queries/*` (verificable inspeccionando `state.queries`), y no invoca `fetch` (spy no
      llamado).
    - Con proveedor montado: `setFormFieldValue('f', 'name', 'x')` sí cambia `state.forms.f.name` a `'x'`;
      `initializeQuery('op')` sí despacha; `setQuerySuccess('op', {})` sí guarda datos; `readRuntimeState()` devuelve
      el estado actual sin lanzar (verifica que las funciones no suprimidas siguen operativas).
    - Con proveedor montado: el objeto devuelto por `useRuntimeStateActions()` mantiene las mismas claves (mismo
      conjunto, mismo tamaño) que sin proveedor — la forma pública del hook no cambia.
    - Integración con `button` real: montar un `button` con `props.action = { type: 'navigateTo', pageId: 'page-b' }`
      dentro de un `LayoutEditModeProvider` (con RuntimeStateProvider padre); un click sobre él no cambia
      `state.navigation.currentPageId` (regresión negativa del comportamiento actual sin proveedor, verificable con
      el mismo click sin proveedor cambia sí lo cambia).
    - Integración con `form` real: montar un `form` con `submitAction: { type: 'executeOperation', operationName: 'op' }`
      dentro de un `LayoutEditModeProvider`; un `submit` nativo no ejecuta el `fetch` mockeado ni dispara
      `runOnSuccessActions`/`runOnErrorActions` (verificable porque un handler de `onSuccess` con `navigateTo` no
      cambia la navegación, y `state.queries.op` no aparece con datos).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime-state/runtime-state-edit-mode-suppression.test.tsx`
    - `pnpm test --run src/tests/runtime/runtime-button-navigation.test.tsx` (regresión: sin proveedor, no cambia
      comportamiento)
    - `pnpm test --run src/tests/runtime/runtime-page-entry-preloads.test.tsx` (regresión: preloads y navegación
      sin proveedor)
    - `pnpm test --run src/tests/runtime-state/runtime-state-forms-queries.test.tsx` (regresión: setFormFieldValue,
      initializeQuery, etc. siguen operativos en la ruta habitual sin proveedor)
  - **Restricciones**:
    - No introducir un objeto de acciones diferente con y sin proveedor: reutilizar el `useMemo` existente y
      condicionar el cuerpo de cada función suprimida al contexto (por ejemplo, envolviendo el cuerpo actual en
      `if (editModeContext !== null) return ...neutro`). El resto del hook no cambia.
    - No añadir un tipo de estado adicional al `RuntimeState`; la supresión es puramente en el punto de disparo,
      igual que en `layout-node-renderer.tsx` de `0102`.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: documentar la supresión de acciones en modo
    Editor y la excepción explícita de `accordion`/`tabs` (que no pasan por este hook).
- **Criterios de finalización**:
  - Los seis puntos de disparo son no-op bajo `LayoutEditModeProvider`; el resto del hook intacto.
  - Regresión de suites de runtime en verde sin cambios.
  - Tests nuevos en verde.
- **Cierre de implementación**: los cuatro comandos listados en verde.

---

## T2 — Wrapper `<fieldset disabled>` para nodos de campo en `layout-node-renderer.tsx`

- **ID**: T2
- **Estado**: completada
- **Objetivo**: implementar la Decisión 4 de `design.md`. Modificar `src/runtime/layout-node-renderer.tsx` para que,
  cuando `editModeContext !== null` y `node.type` pertenece al conjunto cerrado
  `{'input', 'textarea', 'select', 'radioGroup', 'checkboxGroup', 'toggle', 'fileInput'}` (siete tipos de campo con
  su propio control nativo; **excluye `button`, `accordion`, `tabs`, `hidden` y `fileManager`** — ver "Fuera de
  alcance"), el `renderedNode` producido por el `switch` se envuelva en
  `<fieldset disabled className="contents">renderedNode</fieldset>` **antes** de que el wrapper de selección/hover
  ya existente (`if (editModeContext !== null) { renderedNode = <div ref data-node-path ...>{renderedNode}</div> }`,
  líneas 199-247 del archivo actual) lo envuelva a su vez. Es decir: el `fieldset` queda **dentro** del `<div>` de
  selección (más cerca del control), no fuera. Este orden es obligatorio para preservar la burbuja de click hasta
  el wrapper exterior — si el `fieldset` envolviera al `<div>` de selección, el click sobre el control seguiría sin
  activarlo (por su `disabled`), pero también dejaría de propagarse hasta el wrapper de selección exterior porque
  ya no habría wrapper afuera.
- **Regla vinculante — solo campos de formulario nativos**:
  - **`button` no entra en el conjunto**: `<button disabled>` nativo no dispara el evento de click siquiera hacia
    ancestros, lo que rompería la selección de botones. `button` queda cubierto por la supresión de acciones de T1
    (su `onClick` invoca handlers no-op) sin necesidad de `<fieldset disabled>`.
  - **`accordion`, `tabs` no entran**: su interactividad de cabecera es estado local del propio componente
    (`useState` interno), no pasa por `useRuntimeStateActions()`, y la spec (punto 11) exige explícitamente
    preservarla en modo Editor.
  - **`hidden` no entra**: no renderiza control visible; su lógica de inicialización (`setFormFieldValue` no-lazy)
    debe seguir ejecutándose en modo Editor porque forma parte del ciclo de vida del formulario, no del
    comportamiento propio del usuario.
  - **`fileManager` no entra**: es un nodo compuesto con su propio catálogo de operaciones (`getOperation`,
    `uploadOperation`, `deleteOperation`, etc.) que pasan por `executeQueryOperation` — ya cubiertos por la
    supresión centralizada de T1. Envolverlo en `<fieldset disabled>` deshabilitaría también su drop-zone y sus
    controles no cubiertos por T1 sin justificación en la spec.
- **Regla vinculante — sin proveedor, byte-idéntico**: cuando `editModeContext === null`, el fichero produce
  exactamente el mismo HTML que hoy; el `fieldset` no aparece. Test de regresión explícito.
- **`className="contents"`**: usar la utilidad `contents` (utilidad Tailwind estándar `display: contents`) para que
  el `<fieldset>` no aporte caja propia y no altere el layout — coherente con el requisito no funcional de la spec
  ("los paneles/wrappers de edición no reducen el ancho ni fuerzan reflow").
- **Fuera de alcance**:
  - montaje del `LayoutEditModeProvider` en `DevRuntimeReady` (T8).
  - añadir utilidades Tailwind `disabled:` para maquillar los estilos por defecto del navegador sobre controles
    dentro del `fieldset` — la spec no lo exige, es un trade-off asumido en `design.md`.
- **Dependencias**: ninguna (T1 no bloquea; ambos son independientes al nivel de código, aunque juntos completan
  la supresión de comportamiento propio).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-node-renderer.tsx` (modificar: envolver `renderedNode` en `<fieldset disabled className="contents">`
      cuando `editModeContext !== null` y `node.type` pertenece al conjunto)
  - tests:
    - `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (ampliación)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (misma sección de "Modo Editor:
    supresión de comportamiento propio" iniciada en T1, ampliar con la parte de campos).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (ampliación)
  - **Comportamiento cubierto**:
    - Con `LayoutEditModeProvider` montado y un `form > input`: el `input` renderizado es descendiente de un
      `<fieldset disabled>` (`fieldset.disabled === true`), y ese `fieldset` es descendiente del `<div>` con
      `data-node-path` del propio input (el `fieldset` está dentro del wrapper de selección, no fuera).
    - Con proveedor: escribir programáticamente en el `input` (por ejemplo simulando `change` con
      `fireEvent.change(input, { target: { value: 'x' } })`) no cambia `state.forms.f.name` — un control
      descendiente de `<fieldset disabled>` no dispara `onChange`.
    - Con proveedor: hacer click sobre el `input` (o sobre su `<label>` asociado) sí selecciona el nodo (invoca
      `onSelectNode(pathDelInput)`), verificable porque el evento burbujea al wrapper exterior con `data-node-path`.
    - Con proveedor y un `form > radioGroup`: clicar sobre el `<label>` de un radio no marca la opción (regresión
      del bug conocido de `pointer-events-none`, que sí permitía marcar vía `<label>`; con `fieldset disabled` no
      lo permite). El nodo `radioGroup` queda seleccionado.
    - Con proveedor y un `form > toggle`: clicar sobre el toggle no cambia `aria-checked`; el nodo `toggle` queda
      seleccionado.
    - Con proveedor y un `form > button` con `props.action.navigateTo`: verifica que **no** existe un `<fieldset>`
      envolviendo al `<button>` (el conjunto excluye `button`); la selección del botón sigue funcionando (T2 de
      `0102`) y la no-navegación viene de T1 (el handler `navigateTo` es no-op).
    - Con proveedor y un `accordion`: verifica que **no** existe un `<fieldset>` envolviendo su cabecera; hacer
      click sobre la cabecera alterna `aria-expanded` (interactividad local preservada por spec FR11) y también
      selecciona el nodo `accordion`.
    - Sin proveedor (`LayoutEditModeContext` ausente): renderizar el mismo árbol `form > input` no produce
      ningún `<fieldset>` en el DOM; el HTML es idéntico al esperado hoy. Escribir en el `input` cambia
      `state.forms.f.name` con normalidad.
    - Con proveedor, un `form > input`: la clase `contents` está presente en el `<fieldset>` (`fieldset.className`
      la contiene) — verifica el requisito de no aportar caja propia.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-forms-fields.test.tsx` (regresión: sin proveedor,
      todos los tipos de campo siguen funcionando exactamente igual)
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-toggle.test.tsx` (regresión toggle)
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-file-manager.test.tsx` (regresión fileManager,
      confirma que no queda envuelto en fieldset)
  - **Restricciones**:
    - No introducir ningún cambio en los ficheros de nodo individuales (`input-layout-node.tsx`, etc.). El
      wrapper vive exclusivamente en `layout-node-renderer.tsx`, coherente con el requisito no funcional de la
      spec ("no reimplementar por nodo") y con el patrón ya usado por `0102` (T2 de `0102`).
    - Reusar el harness de `layout-node-renderer-edit-mode.test.tsx` ya existente (`LayoutEditModeProvider` de
      prueba, helpers de montaje) — no introducir un mecanismo distinto.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: ampliar sección "Modo Editor: supresión de
    comportamiento propio" con el listado de tipos envueltos en `<fieldset disabled>` y las excepciones.
- **Criterios de finalización**:
  - Los siete tipos de campo son inertes en modo Editor sin tocar sus ficheros individuales.
  - Sin proveedor, el DOM es byte-idéntico.
  - Regresión en verde sin cambios.
- **Cierre de implementación**: los cuatro comandos listados en verde.

---

## T3 — Utilidad de posicionamiento del overlay anclado (`overlay-anchor-position.ts`)

- **ID**: T3
- **Estado**: completada
- **Objetivo**: implementar la Decisión 6 de `design.md`. Crear
  `src/dev-runtime/floating-toolbar/overlay-anchor-position.ts` (nuevo) con:
  - `export interface AnchorRect { top: number; left: number; right: number; bottom: number; width: number; height: number }`
    (subset de `DOMRect` que basta para el cálculo; permite construir rects sintéticos en tests sin recurrir a
    JSDOM).
  - `export interface Viewport { width: number; height: number }`.
  - `export interface OverlaySize { width: number; height: number }`.
  - `export interface OverlayPosition { top: number; left: number; placement: 'below' | 'above' }`.
  - `export function computeOverlayAnchorPosition(anchor: AnchorRect, overlay: OverlaySize, viewport: Viewport, gap?: number): OverlayPosition`
    — función pura que:
    1. Intenta colocar el overlay **debajo** del ancla: `top = anchor.bottom + gap`. Es válido si
       `anchor.bottom + gap + overlay.height <= viewport.height`.
    2. Si no cabe debajo, intenta **arriba**: `top = anchor.top - gap - overlay.height`. Es válido si
       `top >= 0`.
    3. Si ni debajo ni arriba caben, elige la posición (debajo o arriba) que deje más espacio disponible en su
       dirección; el overlay puede solapar parcialmente al ancla — esto es explícito por spec ("aceptar el solape
       antes que ocultarlo").
    4. `left` por defecto es `anchor.left`; se hace clamp horizontal:
       `left = clamp(left, 0, viewport.width - overlay.width)`. Si `overlay.width > viewport.width`, `left = 0`.
    5. `gap` por defecto: `8` (píxeles).
  - `export function useAnchoredPosition(anchorElement: HTMLElement | null, overlaySize: OverlaySize | null): OverlayPosition | null`
    (hook) — devuelve `null` si `anchorElement` o `overlaySize` son `null`; en caso contrario recalcula la posición
    combinando `getBoundingClientRect()` del ancla, `overlaySize` y `{ width: window.innerWidth, height: window.innerHeight }`.
    Se recalcula en `scroll` y `resize` (listeners globales en `window`) y cuando cambian sus dependencias. Usar
    `useLayoutEffect` para que la posición inicial se calcule antes de pintar.
- **Fuera de alcance**:
  - la medición de `overlaySize` — es responsabilidad del consumidor (T5) y se hace vía `ResizeObserver` sobre el
    `ref` del propio overlay (ver T5); esta utilidad recibe la medida ya calculada como argumento.
  - el hook que localiza el ancla por `data-node-path` (vive en T5, junto con el overlay).
  - librerías de posicionamiento tipo `@floating-ui` (descartadas explícitamente en `design.md`).
- **Dependencias**: ninguna.
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/floating-toolbar/overlay-anchor-position.ts` (nuevo)
  - tests:
    - `src/tests/dev-runtime/overlay-anchor-position.test.ts` (nuevo)
  - documentación: ninguna en esta tarea (utilidad interna sin superficie de usuario todavía).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/overlay-anchor-position.test.ts` (nuevo)
  - **Comportamiento cubierto**:
    - `computeOverlayAnchorPosition` con ancla cuya `bottom + gap + overlay.height <= viewport.height` devuelve
      `placement: 'below'` y `top = anchor.bottom + gap` (por ejemplo, ancla en (100, 100, 200x50), overlay 200x100,
      viewport 800x600, gap 8 → top=158, placement='below').
    - `computeOverlayAnchorPosition` con ancla cerca del borde inferior (por ejemplo bottom=580, overlay height=100,
      viewport height=600, gap=8 → no cabe debajo, sí cabe arriba) devuelve `placement: 'above'` y
      `top = anchor.top - gap - overlay.height`.
    - `computeOverlayAnchorPosition` sin espacio ni debajo ni arriba (por ejemplo anchor.top=200, anchor.bottom=400,
      overlay.height=500, viewport.height=600) elige la dirección con más espacio disponible y su `top` produce
      solape parcial con el ancla, sin ocultar el overlay bajo el borde.
    - `computeOverlayAnchorPosition` con `left` que se saldría por la derecha
      (`anchor.left + overlay.width > viewport.width`) devuelve `left = viewport.width - overlay.width` (clamp).
    - `computeOverlayAnchorPosition` con `overlay.width > viewport.width` devuelve `left = 0`.
    - `computeOverlayAnchorPosition` con `left = -50` (ancla parcialmente fuera del viewport a la izquierda)
      devuelve `left = 0` (clamp).
    - `useAnchoredPosition(null, size)` devuelve `null`.
    - `useAnchoredPosition(anchor, null)` devuelve `null`.
    - `useAnchoredPosition(anchor, size)` con un elemento montado real (JSDOM) devuelve una posición coherente
      con `computeOverlayAnchorPosition` para ese ancla y su viewport.
    - `useAnchoredPosition` recalcula al disparar `scroll` en `window` (verificar cambio de `top` tras mover el
      ancla y despachar el evento).
    - `useAnchoredPosition` recalcula al disparar `resize` en `window` (verificar cambio de `top`/`left` tras
      cambiar `window.innerWidth`/`window.innerHeight` y despachar el evento).
    - `useAnchoredPosition` desmonta los listeners al cambiar de elemento ancla y al desmontar el componente
      consumidor (verificar con spy sobre `window.removeEventListener`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/overlay-anchor-position.test.ts`
  - **Restricciones**:
    - No depender de `@floating-ui` ni de ninguna librería nueva. Todo cálculo con aritmética simple.
    - No introducir ficheros de estado global (Zustand, contexto, etc.) para esta utilidad — es puramente local al
      consumidor del hook.
- **Documentación afectada**: ninguna en esta tarea.
- **Criterios de finalización**:
  - La función pura y el hook cumplen la política de posicionamiento (debajo por defecto, voltea arriba, clamp
    horizontal, solape antes que ocultar).
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/overlay-anchor-position.test.ts` en verde.

---

## T4 — Componente `DevEditorFloatingToolbar` (UI pura, controlada)

- **ID**: T4
- **Estado**: completada
- **Objetivo**: implementar la barra flotante persistente (spec FR1, FR2, FR3, FR4, FR5, FR6). Crear
  `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` con un componente controlado, sin estado
  interno más allá de foco/hover local:
  - Props:
    - `mode: 'visual' | 'editor'`
    - `onModeChange: (mode: 'visual' | 'editor') => void`
    - `pages: ReadonlyArray<{ id: string }>`
    - `activePageId: string`
    - `onActivePageIdChange: (pageId: string) => void`
    - `activeDomain: 'layout'` (por ahora un literal; futuras features amplían el tipo)
    - `onOpenMonaco: () => void`
    - `isMonacoOpen: boolean` (para reflejar el estado del botón, aria-pressed)
    - `onOpenPalette: () => void`
    - `isPaletteOpen: boolean` (aria-pressed)
  - Render en `position: fixed` (bottom-center, con `z-index` alto compatible con drawers previos —
    `z-[9998]`/`z-[9999]` como convenciones ya usadas en el proyecto).
  - Contenido (orden de izquierda a derecha):
    1. Selector de página (`<select>` con `data-testid="dev-editor-toolbar-page-select"`); onChange dispara
       `onActivePageIdChange`.
    2. Grupo de pestañas de dominio (`Layout`, `Api`, `Páginas`, `Tokens`) con `data-testid` por pestaña
       (`dev-editor-toolbar-domain-layout`, etc.). Solo `Layout` es activable (aria-pressed refleja `activeDomain`);
       las otras tres se renderizan como `<button disabled>` con `aria-disabled="true"` y `title="Próximamente"`.
       Su click no hace nada (`onClick` ausente o no-op).
    3. Botón "Añadir elemento" (`data-testid="dev-editor-toolbar-palette-toggle"`); onClick dispara `onOpenPalette`;
       `aria-pressed` refleja `isPaletteOpen`.
    4. Botón acceso a Monaco (`data-testid="dev-editor-toolbar-monaco-toggle"`; label `{}`); onClick dispara
       `onOpenMonaco`; `aria-pressed` refleja `isMonacoOpen`.
    5. Toggle Visual/Editor (`data-testid="dev-editor-toolbar-mode-visual"` y
       `dev-editor-toolbar-mode-editor"`), cada uno un botón con `aria-pressed` según `mode`; onClick dispara
       `onModeChange`.
  - `data-testid` raíz: `dev-editor-toolbar`.
- **Fuera de alcance**:
  - conectar la barra con `DevRuntimeReady` y con `useRuntimeStateActions` (T8).
  - los paneles flotantes (T5, T6, T7).
- **Dependencias**: ninguna (es UI pura).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx` (nuevo)
  - tests:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (nueva sección "Barra flotante",
    para `update-app-documentation`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Renderiza el selector de página con una `<option>` por cada entrada de `pages`; `value` del `<select>` es
      `activePageId`. Cambiar la selección invoca `onActivePageIdChange` con el `pageId` correspondiente.
    - Renderiza las cuatro pestañas de dominio. `Layout` tiene `aria-pressed="true"` cuando `activeDomain: 'layout'`;
      las otras tres están `disabled` y `aria-disabled="true"`. Un click sobre `Api`/`Páginas`/`Tokens` no invoca
      ningún callback (verificable con spies pasados como no-op y confirmando que no hay cambio de estado).
    - Botón "Añadir elemento" invoca `onOpenPalette` al hacer click; refleja `isPaletteOpen` en `aria-pressed`.
    - Botón Monaco invoca `onOpenMonaco` al hacer click; refleja `isMonacoOpen` en `aria-pressed`.
    - Toggle Visual/Editor: con `mode: 'visual'`, el botón Visual tiene `aria-pressed="true"` y el de Editor
      `false`; con `mode: 'editor'`, viceversa. Click en Editor con `mode: 'visual'` invoca
      `onModeChange('editor')`; click en Visual con `mode: 'editor'` invoca `onModeChange('visual')`.
    - El componente se renderiza con `position: fixed` (verificable por la clase Tailwind `fixed` en el elemento
      raíz).
    - El `data-testid="dev-editor-toolbar"` es único y persiste con independencia del modo.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx`
  - **Restricciones**:
    - El componente es puramente controlado; ningún `useState` interno relacionado con el estado del editor. Su
      única responsabilidad es renderizar y disparar callbacks.
    - Reusar clases Tailwind del proyecto (`rounded`, `border`, `shadow`, etc.) coherentes con el drawer y el
      botón flotante actuales — sin introducir un sistema de tema paralelo.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nueva sección "Barra flotante" describiendo
    controles, modo por defecto y estado de dominios no funcionales.
- **Criterios de finalización**:
  - El componente responde a las cinco áreas de interacción con la semántica descrita.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` en
  verde.

---

## T5 — Componente `FloatingSelectionOverlay` (breadcrumb + properties + posicionamiento)

- **ID**: T5
- **Estado**: completada
- **Objetivo**: implementar la Decisión 6 y el requisito de spec FR9. Crear
  `src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx` que renderiza el overlay flotante propio junto
  al nodo seleccionado, superponiéndose sobre el contenido sin alterar su ancho ni layout. Reutiliza
  `LayoutCanvasBreadcrumb` (ya construido en `0102`) y `LayoutCanvasPropertiesPanel` (idem), sin cambios en su
  lógica interna.
  - Props:
    - `pageLayout: readonly LayoutNode[]` (para pasar a breadcrumb; ya lo consume así hoy)
    - `selectedPath: LayoutNodePath | null`
    - `onSelectNode: (path: LayoutNodePath | null) => void` (para el breadcrumb)
    - `onCommitNodeUpdate: (path: LayoutNodePath, updater: (node: LayoutNode) => LayoutNode) => void`
    - `onDeleteNode: () => void`
  - Se renderiza únicamente cuando `selectedPath !== null` y `getNodeAtPath(pageLayout, selectedPath) !== null`.
    En cualquier otro caso, retorna `null` (evita render con paths obsoletos por commits concurrentes; misma
    semántica que ya usa `LayoutCanvas` hoy con el `selectedNode` derivado).
  - Localiza el elemento ancla en el DOM mediante `document.querySelector('[data-node-path="' + serializeLayoutNodePath(selectedPath) + '"]')`.
    Si el ancla no existe (aún no montado, o desapareció), no renderiza contenido (retorna `null`) hasta el
    siguiente ciclo. Actualiza el ancla en un `useLayoutEffect` que depende del `selectedPath` serializado.
  - Mide su propio tamaño con un `ResizeObserver` conectado a un `ref` interno: al recibir cada callback del
    observer, guarda `{ width, height }` en un `useState<OverlaySize | null>`. Esto evita loops de rerender
    infinito que ocurrirían midiendo con `getBoundingClientRect()` dentro de un `useEffect` sin dependencias
    estables (el efecto vuelve a correr tras el rerender que dispara la propia medida). Al desmontar el overlay
    o al cambiar de nodo seleccionado, desconecta el observer. Usa `useAnchoredPosition` (T3) para calcular
    `top`/`left` con la `overlaySize` medida.
  - Contenedor:
    ```html
    <div
      data-testid="dev-editor-selection-overlay"
      className="fixed z-[9999] rounded-md border bg-white shadow-lg"
      style={{ top, left }}
    >
      <LayoutCanvasBreadcrumb pageLayout={pageLayout} selectedPath={selectedPath} onSelectNode={onSelectNode} />
      <LayoutCanvasPropertiesPanel
        node={selectedNode}
        path={selectedPath}
        onCommitNodeUpdate={onCommitNodeUpdate}
        onDeleteNode={onDeleteNode}
      />
    </div>
    ```
  - `position: fixed` garantiza no alterar el ancho del contenido (requisito no funcional de spec).
- **Fuera de alcance**:
  - la lógica de decidir cuándo un nodo se selecciona (T8 la delega a `LayoutEditModeProvider`).
  - el commit (`onCommitNodeUpdate`/`onDeleteNode` los provee `DevRuntimeReady` en T8).
- **Dependencias**: T3 (hook de posicionamiento).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/floating-toolbar/floating-selection-overlay.tsx` (nuevo)
  - tests:
    - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (ampliar sección "Barra flotante"
    con el overlay de selección).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/floating-selection-overlay.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Con `selectedPath: null`: no renderiza nada (`queryByTestId('dev-editor-selection-overlay')` es `null`).
    - Con `selectedPath` apuntando a un nodo existente en `pageLayout`, y ese nodo montado en el DOM con su
      `data-node-path`: renderiza `dev-editor-selection-overlay` con `position: fixed`, con estilo `top`/`left`
      calculado (no vacío).
    - Con `selectedPath` apuntando a un nodo que no existe en `pageLayout` (por ejemplo un path obsoleto tras un
      commit): retorna `null` (no renderiza el overlay).
    - Con `selectedPath` apuntando a un nodo existente pero cuyo `data-node-path` no está montado en el DOM
      (simulado no montando ese árbol): retorna `null` de forma segura.
    - El breadcrumb renderiza los ancestros del nodo seleccionado; hacer click en un segmento invoca
      `onSelectNode` con el path del ancestro.
    - El panel de propiedades renderiza las secciones `props`/`layout`/`visibility`/`queryStateFeedback` según el
      schema del nodo (mismo comportamiento heredado de `LayoutCanvasPropertiesPanel`). Editar un campo dispara
      `onCommitNodeUpdate` con el path y el updater esperados (test de humo — la cobertura profunda ya vive en
      `layout-canvas-properties-panel.test.tsx`).
    - Botón de borrar del panel dispara `onDeleteNode` al hacer click.
    - El overlay se reposiciona cuando cambia `selectedPath` (verificable montando dos anclas distintas en el
      DOM con `getBoundingClientRect` mockeado a valores distintos, cambiando `selectedPath`, y comprobando que
      `top`/`left` del overlay cambian).
    - `getBoundingClientRect` sobre un ancla en la esquina inferior derecha del viewport devuelve una posición
      del overlay que no lo saca del viewport (delegado a T3 pero verificado end-to-end aquí para un caso).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/overlay-anchor-position.test.ts` (regresión al integrar)
  - **Restricciones**:
    - No duplicar la lógica de `LayoutCanvasBreadcrumb` ni `LayoutCanvasPropertiesPanel`; se importan tal cual
      desde `src/dev-runtime/layout-canvas/`.
    - Reusar el harness de tests del breadcrumb/propiedades (fixtures de nodos) si existe uno reutilizable.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: describir el overlay flotante, breadcrumb y
    panel de propiedades como piezas del modo Editor tras 0103.
- **Criterios de finalización**:
  - El overlay se posiciona correctamente y degrada de forma segura ante paths obsoletos.
  - Tests en verde.
- **Cierre de implementación**: `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx` en
  verde.

---

## T6 — Panel flotante de paleta de nodos (`FloatingNodePalette`)

- **ID**: T6
- **Estado**: completada
- **Objetivo**: reempaquetar la paleta ya construida en `0102` (`LayoutCanvasNodePalette`) como panel flotante
  fijo, activable/ocultable desde la barra (spec FR4). Crear
  `src/dev-runtime/floating-toolbar/floating-node-palette.tsx`:
  - Props:
    - `open: boolean`
    - `onClose: () => void`
  - Cuando `open: false`, retorna `null`.
  - Cuando `open: true`, renderiza un contenedor `position: fixed` (lateral izquierdo o derecho, con
    `data-testid="dev-editor-floating-palette"`, `z-[9998]`) con:
    - cabecera con un botón "Cerrar" (`data-testid="dev-editor-floating-palette-close"`) que invoca `onClose`.
    - contenido: `<LayoutCanvasNodePalette />` reutilizado sin cambios en su lógica interna. La paleta funciona
      dentro del `LayoutCanvasDndContext` (T8 la monta dentro), heredando el mecanismo de arrastre existente.
  - No altera ancho ni layout del contenido (requisito de spec: `position: fixed`).
- **Fuera de alcance**:
  - modificar la lógica de la paleta o del catálogo de nodos (`layout-canvas-node-palette-defaults.ts`,
    `layout-canvas-node-palette.tsx`) — se reutilizan tal cual.
  - la conexión con `DevRuntimeReady` (T8).
- **Dependencias**: ninguna directa (solo importa código ya existente).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/floating-toolbar/floating-node-palette.tsx` (nuevo)
  - tests:
    - `src/tests/dev-runtime/floating-node-palette.test.tsx` (nuevo)
  - documentación: ninguna en esta tarea (queda cubierta en la sección "Barra flotante" de
    `dev-mode-editor.md`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/floating-node-palette.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Con `open: false`: no renderiza `dev-editor-floating-palette` en el DOM.
    - Con `open: true`: renderiza el panel `position: fixed` (verificable por la clase Tailwind `fixed` en el
      elemento raíz).
    - Con `open: true`: renderiza la paleta de nodos con al menos una entrada por cada tipo del catálogo (test
      de humo — verifica que `LayoutCanvasNodePalette` está montada).
    - Botón "Cerrar" invoca `onClose`.
    - Cambiar `open` de `true` a `false` desmonta el panel (verificable con re-render y `queryByTestId`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/floating-node-palette.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (regresión: la paleta sigue
      funcionando como fuente de arrastre)
  - **Restricciones**:
    - No introducir un mecanismo de arrastre paralelo al de `LayoutCanvasNodePalette`; se reutiliza tal cual.
    - No colocar la paleta como columna en flujo dentro de otro componente — debe ser `position: fixed` para
      cumplir el requisito no funcional de la spec.
- **Documentación afectada**: cubierta por la sección "Barra flotante" de `dev-mode-editor.md`.
- **Criterios de finalización**:
  - El panel flotante muestra/oculta la paleta bajo control de `open`.
  - Tests en verde.
- **Cierre de implementación**: los dos comandos listados en verde.

---

## T7 — Panel flotante de Monaco (`FloatingMonacoPanel`)

- **ID**: T7
- **Estado**: completada
- **Objetivo**: reubicar el editor Monaco fuera del drawer (Decisión 7 de `design.md`). Crear
  `src/dev-runtime/floating-toolbar/floating-monaco-panel.tsx`:
  - Props:
    - `open: boolean`
    - `onClose: () => void`
    - `editorBuffer: string | null`
    - `onEditorChange: (value: string) => void`
    - `onApply: () => void`
    - `onCopy: () => void`
    - `pendingChanges: boolean`
    - `errors: RuntimeConfigError | { code: string; message: string } | null`
  - Cuando `open: false`, retorna `null`.
  - Cuando `open: true`, renderiza un contenedor `position: fixed inset-y-0 right-0` (misma técnica que el drawer
    actual, con `data-testid="dev-editor-floating-monaco"`, `z-[9999]`, `max-w-2xl`, `w-full`) con:
    - cabecera con título y botón "Cerrar" (`data-testid="dev-editor-floating-monaco-close"`) que invoca
      `onClose`. Sin pestañas Visual/JSON — el drawer y sus pestañas se retiran (design.md, Decisión 7); el
      propio contenido real es la superficie visual.
    - área de Monaco: `<DevRuntimeMonacoEditor value={editorBuffer ?? ''} onChange={onEditorChange} onMount={()=>{}} />`
      (reutiliza el componente ya existente sin cambios).
    - panel de errores (mismo marcado que hoy en `DevRuntimeDrawer`) cuando `errors !== null`.
    - barra de acciones con botones "Copiar" y "Aplicar" (`data-testid="dev-editor-floating-monaco-copy"`,
      `dev-editor-floating-monaco-apply"`), con indicador visual de `pendingChanges` (misma pastilla amarilla que
      hoy).
  - Este componente no interactúa con `useDevRuntimeKeyboard`; la escucha de `Esc` para cerrar Monaco se resuelve
    en T8 al integrar la barra con `DevRuntimeReady` (hook mínimo o listener local en el propio panel; ver T8).
- **Fuera de alcance**:
  - modificar la lógica de Monaco, del autocompletado JSON Schema o del pipeline de "Aplicar" (se reutiliza el
    handler existente de `DevRuntimeReady`).
  - la conexión con `DevRuntimeReady` (T8).
- **Dependencias**: ninguna directa (importa `DevRuntimeMonacoEditor`, que ya existe).
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/floating-toolbar/floating-monaco-panel.tsx` (nuevo)
  - tests:
    - `src/tests/dev-runtime/floating-monaco-panel.test.tsx` (nuevo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (actualizar sección "Interfaz"
    para reflejar que Monaco ya no vive dentro del drawer con pestañas; queda para
    `update-app-documentation`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/floating-monaco-panel.test.tsx` (nuevo)
  - **Comportamiento cubierto**:
    - Con `open: false`: no renderiza `dev-editor-floating-monaco` en el DOM.
    - Con `open: true`: renderiza el panel con `position: fixed inset-y-0 right-0`.
    - Con `open: true` y `editorBuffer: 'texto'`: monta `DevRuntimeMonacoEditor` con `value: 'texto'`.
    - Cambiar el contenido del editor (a través del `onChange` mockeado de `DevRuntimeMonacoEditor`) invoca
      `onEditorChange` con el nuevo valor.
    - Botón "Aplicar" invoca `onApply`.
    - Botón "Copiar" invoca `onCopy`.
    - Con `pendingChanges: true`: el indicador de cambios pendientes es visible.
    - Con `pendingChanges: false`: el indicador no aparece.
    - Con `errors: { code: 'x', message: 'y' }`: renderiza el panel de errores con `code`/`message`.
    - Con `errors: null`: no renderiza el panel de errores.
    - Botón "Cerrar" invoca `onClose`.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/floating-monaco-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime-monaco-editor.test.tsx` (regresión: el editor sigue
      funcionando dentro de su propio contrato)
  - **Restricciones**:
    - No introducir pestañas Visual/JSON en este panel — se retiran explícitamente por diseño.
    - Reusar el marcado y clases Tailwind del `DevRuntimeDrawer` actual para la cabecera/panel de errores/barra
      de acciones sin duplicar lógica de Monaco.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: actualizar la descripción de la interfaz para
    reflejar que Monaco es un panel flotante propio activado desde la barra.
- **Criterios de finalización**:
  - El panel expone la misma superficie de Monaco+acciones+errores que hoy vive en el drawer, sin pestañas.
  - Tests en verde.
- **Cierre de implementación**: los dos comandos listados en verde.

---

## T8 — Reestructurar `DevRuntimeReady`: wrappers permanentes, integración de barra + paneles, navegación real

- **ID**: T8
- **Estado**: completada
- **Objetivo**: implementar las Decisiones 1, 2, 5 y 7 de `design.md`, integrando los componentes de T4–T7 con
  `DevRuntimeReady` y eliminando el árbol de canvas duplicado. Es la tarea que hace visible la feature al usuario.
  1. **Ampliar `LayoutEditModeProvider` para aceptar `value: LayoutEditModeContextValue | null`** en
     `src/runtime/layout-edit-mode-context.tsx`: cambiar la prop `value` a `LayoutEditModeContextValue | null` y
     pasar el mismo valor al `.Provider` (React acepta `null` como valor de contexto). `useLayoutEditModeContext()`
     ya devuelve `LayoutEditModeContextValue | null` (T2 de `0102`), así que su tipo público no cambia; con
     `value: null` desde el proveedor, todo el código que hace `context !== null` sigue funcionando exactamente
     igual que sin proveedor.
  2. **Crear `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`** (nuevo): componente montado **dentro** de
     `RuntimeStateProvider` (para poder consumir `useRuntimeCurrentPage()` y `useRuntimeStateActions()`), que:
     - Recibe props del padre: `mode`, `onModeChange`, `paletteOpen`, `onPaletteOpenChange`, `monacoOpen`,
       `onMonacoOpenChange`, `monaco` (todos los props del panel de Monaco enumerados en T7:
       `editorBuffer`/`onEditorChange`/`onApply`/`onCopy`/`pendingChanges`/`errors`),
       `onCommitCanvasMutation` y `onCommitNodeUpdate` (los mismos handlers ya construidos hoy en
       `DevRuntimeReady`), y `children` (`<RuntimePage />`).
     - Estado local: `selectedPath: LayoutNodePath | null`, `hoveredPath: LayoutNodePath | null`.
     - Consumidores internos:
       - `const activePage = useRuntimeCurrentPage()` — página real navegada por el runtime.
       - `const { navigateToPage } = useRuntimeStateActions()` — para el selector de página. **Este consumo se
         hace desde `DevEditorLayer` mismo, fuera de `LayoutEditModeProvider`**, así el `navigateToPage` obtenido
         es el real (no la versión no-op suprimida por T1); coherente con spec FR2, que exige que el selector
         navegue de verdad en cualquier modo.
       - `const config = useRuntimeConfig()` — para pasar `pages` a la barra.
     - Efecto: cuando `activePage.id` cambia, limpiar `selectedPath` y `hoveredPath` a `null` (spec FR15). El
       efecto tiene como dependencia `activePage.id`, no `state.navigation.currentPageId` directamente, para
       evitar lecturas duplicadas del selector.
     - Efecto: cuando `activePage.layout` cambia (por commit desde canvas o desde Monaco), si
       `getNodeAtPath(activePage.layout, selectedPath) === null`, limpiar `selectedPath` a `null` (mismo caso
       límite que ya cubre `LayoutCanvas` hoy).
     - Callback `handleModeChange(nextMode)`: invoca `onModeChange(nextMode)`. **No limpia `selectedPath`** —
       Decisión 5 de `design.md` (la selección persiste entre Visual y Editor sin cambio de página, sin código
       adicional).
     - Render:
       ```tsx
       <LayoutCanvasDndContext
         pageLayout={activePage.layout}
         onDropAttempt={handleDropAttempt}  // reutilizando la misma lógica de LayoutCanvas actual (T14/T15 de 0102)
       >
         <LayoutEditModeProvider
           value={mode === 'editor' ? { selectedPath, hoveredPath, onSelectNode: setSelectedPath, onHoverNode: setHoveredPath } : null}
         >
           {children /* = <RuntimePage /> */}
         </LayoutEditModeProvider>
         {paletteOpen && <FloatingNodePalette open={true} onClose={() => onPaletteOpenChange(false)} />}
       </LayoutCanvasDndContext>
       {mode === 'editor' && (
         <FloatingSelectionOverlay
           pageLayout={activePage.layout}
           selectedPath={selectedPath}
           onSelectNode={setSelectedPath}
           onCommitNodeUpdate={onCommitNodeUpdate}
           onDeleteNode={handleDeleteSelectedNode}
         />
       )}
       <DevEditorFloatingToolbar
         mode={mode}
         onModeChange={handleModeChange}
         pages={config.pages}
         activePageId={activePage.id}
         onActivePageIdChange={(pageId) => navigateToPage(pageId)}
         activeDomain="layout"
         onOpenMonaco={() => onMonacoOpenChange(true)}
         isMonacoOpen={monacoOpen}
         onOpenPalette={() => onPaletteOpenChange(!paletteOpen)}
         isPaletteOpen={paletteOpen}
       />
       ```
     - **Nota vinculante — DevEditorFloatingToolbar y FloatingSelectionOverlay quedan FUERA de
       `LayoutEditModeProvider`**: por eso pueden llamar al `navigateToPage` real (no suprimido) para el selector.
       Solo `<RuntimePage />` (el contenido del runtime real) va dentro del provider.
     - `handleDropAttempt` reutiliza literalmente la lógica actual de `LayoutCanvas.handleDropAttempt` (T14/T15
       de `0102`), incluyendo `isValidDropTarget`, `buildDefaultNodeInstance`, `movePathTo`/`insertNodeAt` y la
       actualización de `selectedPath` tras un movimiento del nodo seleccionado.
     - `handleDeleteSelectedNode` reutiliza literalmente la lógica actual de
       `LayoutCanvas.handleDeleteSelectedNode` (`removeNodeAt` + limpiar selección).
  3. **Modificar `src/dev-runtime/dev-runtime.tsx` (`DevRuntimeReady`)**:
     - Eliminar `activeCanvasPageId` y `setActiveCanvasPageId` — la página editada es ahora la navegada.
     - Eliminar `activeTab` y `setActiveTab` — ya no hay pestañas.
     - Añadir `mode` (`useState<'visual' | 'editor'>('visual')`), `paletteOpen` (`useState(false)`), `monacoOpen`
       (`useState(false)`).
     - Adaptar `commitCanvasMutation` para leer `activePageId` de
       `bridgeRef.current?.getLatestState().navigation.currentPageId` en el momento del commit (no del state
       eliminado). Si el bridge no está montado, usar `currentConfig.initialPage` como fallback seguro (mismo
       criterio de degradación que aplica el resto del código de bootstrap).
     - Adaptar `handleCanvasNodeUpdate` (que llama a `commitCanvasMutation`) sin cambios en su firma pública, ya
       que sigue delegando en la misma función.
     - Retirar el uso de `DevRuntimeToggleButton` (borrado en T10), `DevRuntimeDrawer` y `LayoutCanvas`.
     - Retirar la llamada `useDevRuntimeKeyboard(...)` con `Ctrl/Cmd+Shift+J`. Añadir en su lugar un `useEffect`
       local dentro de `DevRuntimeReady` (no un hook nuevo) que registre un listener global de `keydown`, y
       cuando `event.key === 'Escape'` y `monacoOpen` sea `true`, invoque `setMonacoOpen(false)`. Dependencia del
       efecto: `monacoOpen`. Cleanup: retirar el listener. Esta vía única es obligatoria — coherente con
       `design.md` (Decisión 7: "`Esc` para cerrar el panel de Monaco cuando está abierto se conserva") y evita
       ambigüedad en T10 sobre si debe conservarse un hook parcial de `dev-runtime-keyboard.ts`.
     - Nueva estructura de render:
       ```tsx
       <main className={getAppShellClassName()} data-testid="runtime-app">
         <section className={`${getAppShellContentClassName()} items-center`} data-testid="runtime-shell-content">
           <div className={getAppShellFrameClassName()} data-testid="runtime-shell-frame">
             <RuntimeStateProvider config={currentConfig} dataValues={dataValues}>
               <DevRuntimeStateBridge ref={bridgeRef} />
               <DevEditorLayer
                 mode={mode}
                 onModeChange={setMode}
                 paletteOpen={paletteOpen}
                 onPaletteOpenChange={setPaletteOpen}
                 monacoOpen={monacoOpen}
                 onMonacoOpenChange={setMonacoOpen}
                 monaco={{ editorBuffer, onEditorChange: handleEditorChange, onApply: handleApply, onCopy: handleCopy, pendingChanges: hasPendingChanges, errors: currentError }}
                 onCommitCanvasMutation={commitCanvasMutation}
                 onCommitNodeUpdate={handleCanvasNodeUpdate}
               >
                 <RuntimePage />
               </DevEditorLayer>
             </RuntimeStateProvider>
           </div>
         </section>
       </main>
       <FloatingMonacoPanel
         open={monacoOpen}
         onClose={() => setMonacoOpen(false)}
         editorBuffer={editorBuffer}
         onEditorChange={handleEditorChange}
         onApply={handleApply}
         onCopy={handleCopy}
         pendingChanges={hasPendingChanges}
         errors={currentError}
       />
       ```
       (El `FloatingMonacoPanel` vive fuera de `RuntimeStateProvider` porque no necesita consumir estado del
       runtime; sus datos vienen todos por prop.)
     - `handleToggle` (que hoy abre el drawer) se elimina; su equivalente para Monaco es el toggle desde la
       barra (`monacoOpen` state).
     - **Inicialización de `editorBuffer`**: como el drawer y su `handleToggle` desaparecen, el momento en que
       `editorBuffer` se inicializa a `initialConfigText` (hoy dentro de `handleToggle` al abrir por primera
       vez) se traslada al efecto correspondiente al abrir el panel de Monaco. Concretamente, en el callback que
       hoy es `handleToggle` (o en un efecto keyed a `monacoOpen`): cuando `monacoOpen` pasa de `false` a `true`
       y `editorBuffer === null`, inicializar `editorBuffer` a `initialConfigText`. Esto preserva el
       comportamiento actual "primera apertura del editor muestra el texto crudo original".
- **Nota sobre `input.onChange` y campos con validaciones automáticas**: la Decisión 3 (T1) suprime los seis
  puntos de disparo de acciones declarativas, pero **no** intercepta `setFormFieldValue`/`setFormFieldError`
  (ver Regla vinculante de T1). En modo Editor, con el `<fieldset disabled>` de T2 envolviendo los campos, el
  usuario no puede escribir directamente sobre ellos (el `onChange` nativo del control no dispara). Los
  mecanismos internos legítimos que también invocan `setFormFieldValue` (normalización de campos de elección en
  `form-layout-node.tsx`, inicialización de `hidden-layout-node.tsx`) siguen funcionando porque no son
  interacción de usuario. Esto satisface spec FR10 sin requerir código adicional aquí.
- **Fuera de alcance**:
  - la eliminación física de `LayoutCanvas`, `DevRuntimeDrawer`, `DevRuntimeToggleButton` y sus tests (T10).
  - cambios en el schema de configuración o en el pipeline de commit (`buildCommitCandidateConfig`,
    `patchRawConfigTextWithLayout`) — se reutilizan tal cual.
  - reescritura del hook `useDevRuntimeKeyboard`; se reemplaza aquí por un `useEffect` local dentro de
    `DevRuntimeReady` para `Esc → cerrar Monaco` (el fichero antiguo `dev-runtime-keyboard.ts` se elimina en T10,
    sin condicionales).
- **Dependencias**: T1, T2, T3, T4, T5, T6, T7.
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-edit-mode-context.tsx` (modificar: prop `value` acepta `LayoutEditModeContextValue | null`)
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (nuevo)
    - `src/dev-runtime/dev-runtime.tsx` (modificar: sustituir `activeCanvasPageId`/`activeTab`/`DevRuntimeDrawer`/
      `DevRuntimeToggleButton`/`useDevRuntimeKeyboard toggle` por `mode`/`paletteOpen`/`monacoOpen`/
      `DevEditorLayer`/`FloatingMonacoPanel`; adaptar `commitCanvasMutation` para leer `activePageId` del bridge;
      inicializar `editorBuffer` en el toggle de Monaco)
  - tests:
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (nuevo)
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación/reescritura parcial: eliminar expectativas del
      drawer/pestañas/atajo `Ctrl/Cmd+Shift+J`; añadir expectativas de la nueva superficie —
      `DevEditorFloatingToolbar` visible, `FloatingMonacoPanel` toggleable, selector de página navega de verdad,
      supresión de acciones se activa/desactiva por modo)
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (revisión completa de la sección
    "Interfaz" y "Editor visual del layout" para reflejar el modelo in-place; `update-app-documentation`).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (nuevo)
    - `src/tests/dev-runtime/dev-runtime.test.tsx` (ampliación)
  - **Comportamiento cubierto** (en `dev-editor-layer.test.tsx`):
    - Al montar `DevEditorLayer` con `mode: 'visual'`, el `LayoutEditModeProvider` interno recibe `value: null`
      (verificable porque un consumidor de `useLayoutEditModeContext()` colocado dentro de `<RuntimePage />`
      devuelve `null`; test de integración con un pequeño consumidor de prueba).
    - Al cambiar `mode` a `'editor'`, el mismo consumidor devuelve un objeto no nulo con `selectedPath`/`hoveredPath`/
      callbacks; sin remontar `<RuntimePage />` (verificable con un `ref` colocado en un descendiente de
      `<RuntimePage />` que mantenga la misma instancia entre modos — coherente con Decisión 1: montar
      permanentemente para no remontar).
    - Al cambiar `mode` de `'editor'` a `'visual'` con un `selectedPath` no nulo, `selectedPath` no se limpia
      (Decisión 5); al volver a `'editor'`, el consumidor recibe el mismo `selectedPath`.
    - Al cambiar de página desde el toolbar (`navigateToPage`), `selectedPath` se limpia a `null` (spec FR15) y
      `state.navigation.currentPageId` cambia (verifica navegación real, no local).
    - Al cambiar `activePage.layout` (simulado con un `onCommitNodeUpdate` que borra el nodo seleccionado),
      `selectedPath` degrada a `null` sin errores.
    - `FloatingSelectionOverlay` no aparece en modo `'visual'`; sí aparece en `'editor'` cuando hay
      `selectedPath` y su ancla existe en el DOM.
    - `FloatingNodePalette` aparece cuando `paletteOpen` es `true` en cualquier modo (spec no restringe
      apertura, aunque el uso normal sea en Editor); interactuar con "Añadir elemento" en la barra alterna
      `paletteOpen`.
    - `DevEditorFloatingToolbar` está siempre visible en la vista (independiente del modo y del `monacoOpen`/`paletteOpen`).
    - Verificar que el `<RuntimePage />` se renderiza con `LayoutEditModeProvider` como ancestro **siempre**, no
      condicionalmente (comprobable montando dos veces el árbol con modos distintos y verificando que la
      instancia de un componente cliente dentro de `<RuntimePage />` conserva su ref).
  - **Comportamiento cubierto** (en `dev-runtime.test.tsx`, ampliación):
    - Al arranque, el modo por defecto es `'visual'`; un `link` con `props.action.navigateTo` funciona con
      normalidad (cambia hash y `state.navigation.currentPageId`).
    - Cambiar a modo `'editor'` desde la barra y clicar un `button` con `props.action = { type: 'navigateTo', pageId: 'x' }`:
      la navegación no ocurre y el nodo queda seleccionado (verifica end-to-end T1 + T8).
    - En modo `'editor'`, escribir sobre un `input` no cambia `state.forms.f.name` (verifica end-to-end T2 + T8);
      cambiar `props.defaultValue` desde el panel del overlay sí lo cambia y se refleja en el `input`.
    - En modo `'editor'`, un `accordion` sigue alternando `aria-expanded` al clicar su cabecera; sus `children`
      siguen presentes en el DOM (verifica spec FR11).
    - Cambiar de página desde el toolbar navega el runtime a la nueva página (cambia `#hash` visible) y limpia
      cualquier selección previa (FR15).
    - Abrir el panel de Monaco desde el toolbar hace visible `FloatingMonacoPanel`; editar el JSON y pulsar
      "Aplicar" actualiza el contenido renderizado (verifica que el pipeline existente sigue funcionando).
    - Pulsar `Esc` mientras `monacoOpen: true` cierra el panel; sin `monacoOpen`, `Esc` no tiene efecto (no
      hay otro atajo global tras la retirada del `Ctrl/Cmd+Shift+J`).
    - Interactuar con la pestaña `Api` de la barra no produce ningún cambio de contenido ni navegación (verifica
      spec FR3 sobre dominios deshabilitados).
    - `DevRuntimeToggleButton` **no** existe en el DOM tras esta feature (regresión negativa; el usuario ya no
      lo verá aunque el fichero exista todavía, hasta T10). `queryByTestId('dev-runtime-toggle') === null`.
    - `DevRuntimeDrawer` **no** existe en el DOM tras esta feature; `queryByTestId('dev-runtime-drawer') === null`.
    - Pulsar `Ctrl+Shift+J` no abre ningún panel (regresión del atajo retirado).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-commit.test.tsx` (regresión del pipeline de commit)
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (regresión de drag/drop
      real end-to-end)
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (regresión de inserción
      desde paleta)
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (regresión de borrado)
    - `pnpm test --run src/tests/runtime/runtime-button-navigation.test.tsx` (regresión de navegación normal sin
      proveedor)
  - **Restricciones**:
    - No introducir un segundo mecanismo de commit ni de mutación; reutilizar `commitCanvasMutation`,
      `buildCommitCandidateConfig`, `patchRawConfigTextWithLayout`, `movePathTo`, `insertNodeAt`,
      `removeNodeAt`, `replaceNodeAt`, `isValidDropTarget`, `buildDefaultNodeInstance` tal cual.
    - No consumir `useRuntimeStateActions()` desde `<RuntimePage />` u otro consumidor dentro del
      `LayoutEditModeProvider` para navegación — solo `DevEditorLayer` (fuera del provider) lo hace, para
      obtener el `navigateToPage` real.
    - Los tests de `dev-runtime.test.tsx` deben eliminar (no ignorar) las expectativas que referenciaban al
      drawer, sus pestañas y el atajo — cualquier expectativa contradictoria con la nueva superficie debe
      quitarse en esta tarea, no aplazarse a T10.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: revisión completa de "Interfaz" y "Editor
    visual del layout" para reflejar el modelo in-place con barra flotante como único punto de entrada.
- **Criterios de finalización**:
  - Un único árbol de render (`<RuntimePage />`) participa tanto en la navegación real como en la edición
    visual; no queda ninguna instancia adicional de `RuntimeStateProvider` para el canvas.
  - La barra flotante controla modo, página, paleta y Monaco; el overlay de selección aparece únicamente en
    modo Editor y se ancla al nodo seleccionado.
  - Cambiar de modo no remonta `<RuntimePage />`; la selección persiste sin cambio de página.
  - Todas las suites listadas en verde.
- **Cierre de implementación**: los siete comandos listados en verde.

---

## T9 — Corrección: contexto de modo edición distingue "provider montado" de "modo Editor activo" (evita remount de estado local de nodo)

- **ID**: T9
- **Estado**: completada
- **Origen**: hallazgo de la auditoría de cierre de T8 (no estaba en el plan original), formalizado en `design.md`
  Decisión 9. Antes de esta tarea, alternar Visual ⇄ Editor remonta cada nodo del árbol real (confirmado con test:
  un `accordion` expandido se colapsa al cambiar de modo, con nodo DOM nuevo, no solo re-render), porque
  `layout-node-renderer.tsx` decide la **presencia** del wrapper de selección (y del `fieldset` en campos) mirando
  `editModeContext !== null`, que ahora alterna en caliente sobre el mismo árbol montado (consecuencia de T8).
- **Objetivo**: implementar la Decisión 9 de `design.md`. `LayoutEditModeContextValue` pasa de `{...} | null` a un
  discriminated union de dos formas, combinado con el `null` de "sin provider" que ya devuelve el contexto:
  ```ts
  export type LayoutEditModeContextValue =
    | { active: false }
    | {
        active: true
        selectedPath: LayoutNodePath | null
        hoveredPath: LayoutNodePath | null
        onSelectNode: (path: LayoutNodePath) => void
        onHoverNode: (path: LayoutNodePath | null) => void
      }
  ```
  Tres estados observables por `useLayoutEditModeContext()`:
  - `null` — sin provider (producción real). Sin cambios de comportamiento en ningún fichero.
  - `{ active: false }` — provider montado, modo Visual. Nuevo caso; antes colapsaba con `null` porque `DevEditorLayer`
    pasaba `value: null` en Visual.
  - `{ active: true, ... }` — modo Editor. Mismo comportamiento que hoy tiene "contexto no nulo" en todos los ficheros.
- **Regla vinculante — dos categorías de gate, no una**:
  1. **Presencia de elemento wrapper en el árbol** (nunca debe alternar entre Visual y Editor, solo entre "provider"/
     "sin provider"): el `<div data-node-path>` de `layout-node-renderer.tsx` y el `<fieldset>` de los siete tipos de
     campo siguen apareciendo exactamente cuando `editModeContext !== null` (sin cambios en esta condición). Lo que
     cambia son sus **atributos**, nunca su tipo ni su posición en el árbol:
     - `fieldset`: `disabled={editModeContext.active}` (antes: presencia entera condicionada, ahora: siempre presente
       cuando aplica el conjunto de tipos de campo, con `disabled` dinámico).
     - `div` de selección: `onClick`/`onMouseEnter`/`onMouseLeave` no-op cuando `!editModeContext.active`;
       `editModeClassName` (outline) solo se calcula cuando `editModeContext.active`; `data-node-path` sigue siempre
       presente (no aporta comportamiento por sí solo, solo lookup).
     - `useDraggable({ disabled: ... })`: pasa a `editModeContext === null || !editModeContext.active`.
  2. **Comportamiento condicionado a "modo Editor realmente activo"** (pasa de `editModeContext !== null` a
     `editModeContext !== null && editModeContext.active` en cada uno de estos puntos):
     - `src/runtime/runtime-state/runtime-state-provider.tsx` (T1): las seis funciones de acción declarativa se
       suprimen solo cuando `editModeContext.active`, no con cualquier provider presente — Visual dentro de
       `DevRuntime` debe navegar/enviar formularios de verdad, igual que producción.
     - `src/runtime/nodes/accordion-layout-node.tsx`: `isEditMode` (línea 28) pasa a leer `.active`.
     - `src/runtime/nodes/modal-layout-node.tsx`: `isEditMode` (línea 19) pasa a leer `.active`.
     - `src/runtime/nodes/repeater-layout-node.tsx`: `isEditMode` (línea 46) pasa a leer `.active`.
     - `src/runtime/layout-renderer.tsx`: los placeholders de contenedor vacío (líneas 46, 63, 73) pasan a
       renderizarse solo cuando `editModeContext !== null && editModeContext.active`; el tipo del prop
       `EmptyContainerPlaceholderProps.editModeContext` se estrecha a la rama `{ active: true, ... }` del union.
  - **`tabs-layout-node.tsx` no consume el contexto directamente** — no requiere cambio; su estado local de pestaña
    activa se preserva automáticamente en cuanto el wrapper de `layout-node-renderer.tsx` deja de alternar presencia
    (categoría 1 de esta misma tarea ya lo cubre, sin tocar el fichero).
- **`DevEditorLayer` (T8)**: el `value` pasado a `LayoutEditModeProvider` deja de ser
  `mode === 'editor' ? {...} : null`; pasa a ser siempre un objeto no nulo:
  `mode === 'editor' ? { active: true, selectedPath, hoveredPath, onSelectNode: setSelectedPath, onHoverNode: setHoveredPath } : { active: false }`.
- **Consecuencia asumida y ya documentada en `design.md`**: el DOM de modo Visual dentro de `DevRuntime` deja de ser
  byte-idéntico a producción real (gana wrappers inertes). El requisito de byte-identidad se mantiene intacto para el
  único caso al que siempre aplicó: `editModeContext === null` (sin provider). Ningún test existente que verifique
  "sin proveedor, byte-idéntico" debe romperse; sí es esperable que aparezcan nuevos tests que verifiquen "con
  proveedor, Visual, wrapper presente pero inerte".
- **Fuera de alcance**:
  - cualquier cambio de comportamiento del propio modo Editor (`active: true`); su superficie observable no cambia
    respecto a lo ya implementado en T1–T8, solo cambia la condición que lo activa.
  - la eliminación de `LayoutCanvas`/`DevRuntimeDrawer`/etc. (T10, antes T9).
  - añadir un test de "no remonta" para cada tipo de nodo del catálogo; basta con el caso `accordion` (representativo
    del bug) más regresión de toda la suite existente.
- **Dependencias**: T1, T2, T8 (modifica código introducido por las tres).
- **Impacto esperado en archivos**:
  - código:
    - `src/runtime/layout-edit-mode-context.tsx` (modificar: `LayoutEditModeContextValue` → discriminated union)
    - `src/runtime/layout-node-renderer.tsx` (modificar: wrapper/fieldset siempre presentes cuando hay provider;
      atributos dinámicos según `.active`)
    - `src/runtime/layout-renderer.tsx` (modificar: placeholders de contenedor vacío gateados por `.active`)
    - `src/runtime/nodes/accordion-layout-node.tsx` (modificar: `isEditMode` → `.active`)
    - `src/runtime/nodes/modal-layout-node.tsx` (modificar: `isEditMode` → `.active`)
    - `src/runtime/nodes/repeater-layout-node.tsx` (modificar: `isEditMode` → `.active`)
    - `src/runtime/runtime-state/runtime-state-provider.tsx` (modificar: gate de supresión de T1 → `.active`)
    - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx` (modificar: `value` siempre no nulo, `active: mode === 'editor'`)
  - tests: los doce ficheros que instancian `LayoutEditModeProvider`/`LayoutEditModeContextValue` directamente
    necesitan su fixture actualizada a la nueva forma (`{ active: true, ... }` en vez de un objeto plano) — ver lista
    completa en el sub-bloque de tests. Se añaden casos nuevos de "provider presente, Visual, sin remount / sin
    suprimir comportamiento" donde aplique.
  - documentación: `ai-workflow/docs/app-features/development/dev-mode-editor.md` (queda para `update-app-documentation`,
    nota sobre la persistencia de estado local de nodo al alternar modo).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/runtime-state/runtime-state-edit-mode-suppression.test.tsx` (ampliación: fixture a `{active:true,...}`;
      nuevo caso `{active:false}` no suprime ninguna acción)
    - `src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx` (ampliación: fixture a nueva forma)
    - `src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx` (ampliación: fixture a nueva forma)
    - `src/tests/layout-renderer/layout-renderer-modal-edit-mode.test.tsx` (ampliación: fixture a nueva forma; nuevo
      caso `{active:false}` el modal no se fuerza abierto)
    - `src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx` (ampliación: fixture a nueva forma;
      nuevo caso `{active:false}` resuelve iteraciones reales, no colapsa a plantilla)
    - `src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx` (ampliación: fixture a nueva forma; nuevo
      caso `{active:false}` el wrapper/fieldset existen en el DOM pero inertes — sin outline, sin selección al click,
      fieldset no disabled)
    - `src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx` (ampliación: fixture a nueva forma)
    - `src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx` (ampliación: fixture a nueva forma)
    - `src/tests/dev-runtime/layout-canvas-delete-node.test.tsx` (ampliación: fixture a nueva forma)
    - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación: **nuevo caso central de esta tarea** — montar
      con un `accordion` expandido en Visual, cambiar a Editor vía la barra, verificar que sigue expandido
      (`aria-expanded` sin cambiar) y que el nodo DOM del header es el mismo — `toBe` sobre una referencia capturada
      antes del toggle, no solo el atributo)
    - `src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx` (ampliación: fixture a nueva forma;
      nuevo caso `{active:false}` no renderiza placeholders de contenedor vacío)
    - `src/tests/layout-renderer/layout-renderer-accordion-edit-mode.test.tsx` (ampliación: fixture a nueva forma;
      nuevo caso `{active:false}` el accordion se comporta como producción, sin forzar contenido visible)
  - **Comportamiento cubierto** (adicional a la migración de fixtures de los ficheros de arriba):
    - Con `editModeContext === null` (sin provider): comportamiento y DOM byte-idénticos a antes de esta tarea, en
      cada uno de los ocho ficheros de código modificados — regresión explícita.
    - Con `{ active: false }` (Visual dentro de `DevRuntime`): el wrapper `<div data-node-path>` existe en el DOM,
      pero un click no dispara `onSelectNode`; no hay outline de selección/hover; `useDraggable` sigue inerte; en
      campos de formulario el `fieldset` existe pero `disabled` es `false` (el campo es editable); las seis acciones
      declarativas de `useRuntimeStateActions()` funcionan de verdad (no suprimidas); el `modal` solo está abierto si
      `isModalOpen` lo indica; el `accordion` no fuerza su contenido visible; el `repeater` resuelve las iteraciones
      reales, no una plantilla única; los contenedores vacíos no muestran placeholder de drop.
    - Con `{ active: true }` (Editor): comportamiento idéntico al que ya tenían todos estos ficheros con "contexto no
      nulo" antes de esta tarea — regresión explícita, ninguna suite existente debe cambiar sus aserciones de este
      caso.
    - **Caso central**: montar `DevEditorLayer` con un layout que incluya un `accordion`, expandirlo en modo Visual,
      cambiar a modo Editor desde la barra flotante — el accordion sigue expandido y su nodo DOM (capturado por
      referencia antes del toggle) es el mismo objeto después del toggle. Repetir en la dirección Editor → Visual.
    - `escribir sobre un input en modo Visual dentro de DevRuntime` cambia `state.forms.f.name` con normalidad
      (verifica que `{active:false}` no activa el `fieldset disabled`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/runtime-state/runtime-state-edit-mode-suppression.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-node-renderer-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-modal-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-repeater-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-tabs-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-accordion-edit-mode.test.tsx`
    - `pnpm test --run src/tests/layout-renderer/layout-renderer-edit-mode-placeholders.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-breadcrumb.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-palette-insert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-delete-node.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx` (regresión end-to-end completa de T8)
    - `pnpm exec tsc --noEmit` (el discriminated union es un cambio de tipo público; cualquier consumidor no migrado
      falla en compilación, no en runtime — úsalo como red de seguridad para encontrar fixtures olvidadas)
  - **Restricciones**:
    - No introducir un segundo contexto ni un segundo hook para distinguir "provider presente" de "modo activo"; el
      discriminated union en `LayoutEditModeContextValue` ya basta (Decisión 9, alternativa descartada).
    - No condicionar la presencia del `<div>`/`<fieldset>` de `layout-node-renderer.tsx` a `.active` en ningún caso —
      es precisamente el error que esta tarea corrige.
    - No dejar ningún fichero de test con la forma antigua del contexto (`{selectedPath, ...}` sin `active`) sin
      migrar; `tsc --noEmit` debe quedar en cero errores.
- **Documentación afectada**:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nota sobre por qué el modo Visual dentro de
    `DevRuntime` no es byte-idéntico a producción a nivel de DOM (aunque sí lo es a nivel de comportamiento
    interactivo), y sobre la persistencia de estado local de nodo (accordion, tabs, foco) al alternar modo.
- **Criterios de finalización**:
  - Alternar Visual ⇄ Editor no remonta ningún nodo del árbol (verificado con el caso central del accordion).
  - Modo Visual dentro de `DevRuntime` sigue siendo interactivamente indistinguible de producción (navegación,
    formularios, campos editables, sin selección/outline).
  - Modo Editor conserva exactamente el comportamiento ya implementado por T1–T8 (regresión completa en verde).
  - Sin provider, comportamiento y DOM byte-idénticos a antes de esta tarea (regresión completa en verde).
  - `tsc --noEmit` en cero errores.
- **Cierre de implementación**: los catorce comandos listados en verde.

---

## T10 — Retirar componentes obsoletos: `LayoutCanvas`, `DevRuntimeDrawer`, `DevRuntimeToggleButton`, `useDevRuntimeKeyboard`

- **ID**: T10
- **Estado**: completada
- **Nota de cierre**: `pnpm test` (suite completa) no está en verde de forma literal porque tres ficheros de test
  preexistentes, no relacionados con esta feature (`src/tests/app/app-shell.test.tsx`,
  `src/tests/dev-runtime/dev-runtime-bundle.test.ts`, `src/tests/dev-runtime/runtime-nodes-bundle.test.ts`), fallan
  también en el commit base anterior a toda la implementación de 0103 (confirmado de forma independiente con
  `git stash` revirtiendo el trabajo de la feature y reproduciendo los mismos fallos). Causa: desajuste entre el
  regex de extracción de `dev-runtime-bundle.test.ts`/`runtime-nodes-bundle.test.ts` (espera `/assets/*.js` absoluto)
  y `vite.config.ts` (`base: './'`, genera `./assets/*.js`), más una aserción desactualizada en `app-shell.test.tsx`.
  Excluyendo esos tres ficheros: 146/146 ficheros de test, 3378/3378 tests en verde, cobertura 93.37%
  statements/93.37% lines/89.92% branches/96.19% functions — muy por encima del umbral del 80%. Ningún cambio de
  esta feature causa ni empeora estos tres fallos; corregirlos queda fuera del alcance de 0103 (issue preexistente
  de infraestructura de tests, no de esta feature).
- **Objetivo**: eliminar físicamente los ficheros que quedan desconectados tras T8, junto con sus tests, para
  cerrar la migración sin dejar código muerto:
  1. Borrar `src/dev-runtime/dev-runtime-toggle-button.tsx`.
  2. Borrar `src/dev-runtime/dev-runtime-drawer.tsx` (junto con el export de tipo `DevRuntimeDrawerTab`; si
     algún consumidor externo aún lo importa, tratar como red de seguridad: el compilador de TS falla si queda
     alguna referencia — es señal de que T8 no completó la limpieza y debe volverse a T8).
  3. Borrar `src/dev-runtime/dev-runtime-keyboard.ts`. T8 ya consolidó `Esc → cerrar Monaco` como `useEffect`
     local dentro de `DevRuntimeReady`, así que este fichero queda huérfano sin excepciones.
  4. Borrar `src/dev-runtime/layout-canvas/layout-canvas.tsx`. **No** borrar el resto de ficheros de
     `src/dev-runtime/layout-canvas/` (`layout-canvas-breadcrumb.tsx`, `layout-canvas-commit.ts`,
     `layout-canvas-dnd-context.tsx`, `layout-canvas-node-palette-defaults.ts`, `layout-canvas-node-palette.tsx`,
     `layout-canvas-node-schema.ts`, `layout-canvas-properties-panel.tsx`, `layout-drop-validity.ts`,
     `property-fields/`) — son piezas reutilizadas por T5/T6/T8 y siguen siendo el motor de edición visual.
  5. Borrar los siguientes ficheros de test cuya superficie ya no existe:
     - `src/tests/dev-runtime/dev-runtime-drawer.test.tsx`
     - `src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx`
     - `src/tests/dev-runtime/dev-runtime-keyboard.test.ts`. La cobertura equivalente vive ahora en
       `dev-runtime.test.tsx` (T8 añadió los casos `Esc → cerrar Monaco` y "ningún atajo global tras la
       retirada").
  6. Actualizar `ai-workflow/docs/test-index.md` para eliminar de la sección `dev-runtime/` las entradas de los
     ficheros de test borrados y añadir las nuevas (`dev-editor-floating-toolbar.test.tsx`,
     `floating-selection-overlay.test.tsx`, `floating-node-palette.test.tsx`, `floating-monaco-panel.test.tsx`,
     `overlay-anchor-position.test.ts`, `dev-editor-layer.test.tsx`, `runtime-state-edit-mode-suppression.test.tsx`).
- **Fuera de alcance**:
  - modificaciones de comportamiento; esta tarea es puramente eliminación + actualización del índice de tests.
  - actualización de `ai-workflow/docs/app-features/development/dev-mode-editor.md` (queda para
    `update-app-documentation` con base en las referencias que dejaron T1, T2, T4, T5, T7, T8, T9).
- **Dependencias**: T8, T9.
- **Impacto esperado en archivos**:
  - código:
    - `src/dev-runtime/dev-runtime-toggle-button.tsx` (borrar)
    - `src/dev-runtime/dev-runtime-drawer.tsx` (borrar)
    - `src/dev-runtime/dev-runtime-keyboard.ts` (borrar)
    - `src/dev-runtime/layout-canvas/layout-canvas.tsx` (borrar)
  - tests:
    - `src/tests/dev-runtime/dev-runtime-drawer.test.tsx` (borrar)
    - `src/tests/dev-runtime/dev-runtime-canvas-shell.test.tsx` (borrar)
    - `src/tests/dev-runtime/dev-runtime-keyboard.test.ts` (borrar)
  - documentación:
    - `ai-workflow/docs/test-index.md` (actualizar entradas de `dev-runtime/`)
- **Tests**:
  - **Ficheros de test**: ninguno; cubierto por otras suites.
  - **Comportamiento cubierto**: ninguna nueva superficie; la cobertura de "sin drawer/toggle/atajo" ya vive en
    `dev-runtime.test.tsx` (T8).
  - **Comandos durante la implementación**:
    - `pnpm test` (suite completa: garantiza que ningún import roto queda tras las eliminaciones y que la
      cobertura global sigue por encima del 80%)
    - `pnpm build` o equivalente `pnpm tsc --noEmit` (garantiza que el compilador de TS no reporta imports a
      los ficheros borrados)
  - **Restricciones**:
    - No realizar cambios de comportamiento en esta tarea; si aparece la necesidad, señala un fallo de
      integración en T8 y debe corregirse allí, no aquí.
    - No mantener ficheros con solo un `// removed` o un re-export vacío — coherente con las reglas globales de
      "Avoid backwards-compatibility hacks".
- **Documentación afectada**:
  - `ai-workflow/docs/test-index.md` (actualización obligatoria en esta tarea).
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md` (queda para `update-app-documentation`; ya
    referenciado por T1/T2/T4/T5/T7/T8).
- **Criterios de finalización**:
  - Los ficheros listados están borrados y ningún import los referencia.
  - `pnpm test` en verde con cobertura global ≥ 80%.
  - `test-index.md` refleja el estado real de `src/tests/dev-runtime/`.
- **Cierre de implementación**: `pnpm test` en verde con cobertura mínima cumplida; sin imports rotos ni
  ficheros huérfanos.

---

## Próxima tarea sugerida
Al abrir la implementación, empezar por **T1** (supresión centralizada de acciones declarativas). Es la base
que permite todas las verificaciones end-to-end posteriores.
