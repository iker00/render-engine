# Design: Feature 0103 - dev-editor-floating-toolbar

## Contexto

`DevRuntimeReady` (`src/dev-runtime/dev-runtime.tsx`) hoy monta **dos árboles de render separados**:

- El preview real: un único `<RuntimeStateProvider config={currentConfig}>` envolviendo `<RuntimePage />`
  (`src/runtime/runtime-page.tsx`), que lee la página activa vía `useRuntimeCurrentPage()` (derivada de
  `state.navigation.currentPageId`) y nunca monta `LayoutEditModeProvider`.
- El canvas de `0102`: `LayoutCanvas` (`src/dev-runtime/layout-canvas/layout-canvas.tsx`) monta su **propia** instancia
  aislada de `<RuntimeStateProvider config={config}>` envolviendo `<LayoutRenderer nodes={activePage.layout} />` dentro
  de `<LayoutEditModeProvider>`, con `activePage` resuelta contra un `activeCanvasPageId` de estado local
  desconectado de la navegación real. Solo es visible dentro de la pestaña "Visual" de `DevRuntimeDrawer`, que a su
  vez solo se abre con `DevRuntimeToggleButton` o `Ctrl/Cmd+Shift+J` (`dev-runtime-keyboard.ts`).

**Hecho clave que hace viable eliminar el árbol duplicado sin tocar `src/runtime/`**: todo el comportamiento de modo
edición ya construido en `0102` — wrapper de selección/hover/arrastre en `layout-node-renderer.tsx`, drop-zones y
placeholders vacíos en `layout-renderer.tsx`, instancia única de `repeater.props.template`, cuerpo siempre presente de
`accordion`/`modal` — está condicionado **exclusivamente** a `useLayoutEditModeContext() !== null`. Ningún fichero de
`src/runtime/` sabe que existe un "canvas"; solo sabe si el contexto está presente. El canvas de `0102` es, en la
práctica, solo un lugar distinto donde montar ese contexto sobre un árbol duplicado. Montarlo en su lugar sobre
`<RuntimePage />` (el árbol real) activa exactamente el mismo motor sin ningún cambio en `layout-node-renderer.tsx` ni
`layout-renderer.tsx`.

**Acciones declarativas: un único punto de disparo ya centralizado.** `executeRuntimeUiAction`
(`src/runtime/runtime-actions/runtime-ui-action-executor.ts`) solo se invoca desde tres sitios:
`button-layout-node.tsx`, `link-layout-node.tsx` y `form-layout-node.tsx` (click, `onSuccess`/`onError` y el propio
`handleSubmit`). Los tres obtienen sus handlers (`navigateToPage`, `goBackPage`, `executeQueryOperation`,
`openModal`, `closeModal`, `resetForm`) del mismo hook, `useRuntimeStateActions()`
(`src/runtime/runtime-state/runtime-state-provider.tsx`). `FormNode.handleSubmit` también llama
`executeQueryOperation` directamente para el `submitAction`, sin pasar por `executeRuntimeUiAction`, pero sigue
leyendo la misma referencia del mismo hook.

**Interactividad nativa de campos: no está centralizada de la misma forma.** Cada nodo de campo
(`input`/`textarea`/`select`/`radioGroup`/`checkboxGroup`/`toggle`/`fileInput`) renderiza su propio control HTML
nativo con su propio `onChange` que llama `setFormFieldValue`/`setFormFieldError` directamente. Esta función también
la usan mecanismos automáticos legítimos que deben seguir funcionando en modo Editor (el `useEffect` de normalización
de campos de elección en `form-layout-node.tsx`, la inicialización de campos ocultos en `hidden-layout-node.tsx`), así
que no puede suprimirse a nivel de hook como las acciones declarativas.

**Las piezas de UI del canvas de `0102` son reutilizables sin cambios**: `LayoutCanvasBreadcrumb`,
`LayoutCanvasPropertiesPanel`, `LayoutCanvasNodePalette`, `LayoutCanvasDndContext`, `layout-drop-validity.ts`,
`layout-canvas-commit.ts` (`buildCommitCandidateConfig`/`patchRawConfigTextWithLayout`, que ya reciben `activePageId`
como parámetro explícito, no hardcodeado) y `layout-tree-mutations.ts` son módulos dirigidos por props/callbacks, sin
acoplamiento a la instancia aislada de `RuntimeStateProvider` del canvas. Solo el contenedor (`LayoutCanvas` como
layout en flexbox dentro del drawer) queda obsoleto.

## Objetivos / No objetivos

### Objetivos
- Definir cómo se elimina el árbol de canvas duplicado montando el motor de `0102` sobre el árbol real, sin tocar
  `src/runtime/layout-node-renderer.tsx` ni `layout-renderer.tsx`.
- Definir el mecanismo de supresión centralizada de acciones declarativas y de interactividad nativa de campos en
  modo Editor, reutilizando puntos de extensión ya existentes en vez de tocar cada nodo.
- Definir cómo el selector de página de la barra pasa a pilotar la navegación real en vez de un estado de página local
  del canvas.
- Definir la composición visual: dónde vive el acceso a Monaco, la paleta y el overlay de breadcrumb+propiedades, y
  el mecanismo de posicionamiento de este último junto al nodo seleccionado.
- Resolver, usando el margen que deja la spec, la persistencia de selección al alternar Visual/Editor y qué ocurre
  con el botón flotante y el atajo de teclado actuales.

### No objetivos
- No se diseña la edición visual de `Api`, `Páginas` ni `Tokens` (features posteriores del roadmap).
- No se cambia ninguna regla del motor de `0102`: direccionamiento por `path`, reglas de destino de drop, tratamiento
  de `repeater`/`accordion`/`tabs`/`modal`, generación del formulario de propiedades, pipeline de commit/validación.
- No se diseña deshacer/rehacer, selección múltiple ni pickers contextuales de referencias — mismo alcance ya excluido
  en `0102` y reafirmado por esta spec.
- No se cambia el contrato observable del runtime en producción, su schema Zod, ni la frontera de activación de
  `DevRuntime`.

## Decisiones

### 1. Eliminar el árbol duplicado: montar `LayoutEditModeProvider` y `LayoutCanvasDndContext` siempre alrededor de `<RuntimePage />`, con `value`/handlers no-op en modo Visual
`LayoutCanvas` deja de montar su propia `RuntimeStateProvider` + `LayoutRenderer`. En su lugar, dentro del único
`<RuntimeStateProvider config={currentConfig}>` de `DevRuntimeReady`, `<RuntimePage />` queda envuelta
permanentemente por `<LayoutEditModeProvider value={...}>` y `<LayoutCanvasDndContext>`. La clave es que ambos
wrappers se montan **siempre** (no condicionalmente a si el modo es Editor); lo que cambia entre Visual y Editor es
el `value` que reciben:
- **Modo Visual**: `LayoutEditModeProvider value={null}`. Un `value` explícito `null` es indistinguible, para
  `useLayoutEditModeContext()`, de no tener ningún provider ancestro — es el mismo valor por defecto de
  `createContext(null)`. Todo el código de `0102` ya trata `editModeContext !== null` como el único gate, así que esto
  reproduce exactamente el comportamiento de producción.
- **Modo Editor**: `LayoutEditModeProvider value={{ selectedPath, hoveredPath, onSelectNode, onHoverNode }}` con el
  estado real de selección.

**Por qué montar siempre el wrapper en vez de condicionar su presencia** (`{editorMode && <LayoutEditModeProvider>…}`):
alternar la *presencia* de un componente wrapper cambia la posición del árbol de elementos en ese nivel y React
desmonta y vuelve a montar `<RuntimePage />` al cambiar de modo, perdiendo foco/scroll y contradiciendo el requisito
de la spec de que volver a Visual no necesita recargar la página (FR16). Alternar solo el `value` de un provider que
permanece montado no remonta nada por debajo.

Lo mismo aplica a `LayoutCanvasDndContext`: permanece siempre montado; `useDraggable`/`useDroppable` en
`layout-node-renderer.tsx`/`layout-renderer.tsx` ya están gateados por `disabled: editModeContext === null` (comentario
existente en el código, T12 de `0102`), así que con `value: null` el drag nunca se activa aunque el `DndContext` de
`dnd-kit` esté presente.

**Alternativa descartada**: mantener el canvas aislado y sincronizarlo con la navegación real. Se descarta porque
contradice el objetivo explícito de la spec de editar "el mismo árbol real", no una copia sincronizada — mantener dos
fuentes de verdad renderizadas era precisamente el problema que esta feature existe para eliminar.

**Nota**: este mismo razonamiento (montar siempre, alternar solo `value`) no se aplicó, en la versión original de este
diseño, al wrapper de selección *por nodo* de `layout-node-renderer.tsx` — ver Decisión 9, que corrige esa
inconsistencia detectada durante la implementación de T8.

### 2. La página editada es la página realmente navegada, no un estado de página local
Se elimina `activeCanvasPageId`/`onActivePageIdChange` de `DevRuntimeReady`. El selector de página de la barra llama a
`navigateToPage(pageId)` (de `useRuntimeStateActions()`), el mismo mecanismo que cualquier navegación interna por hash
(FR2) — coherente con `architecture.md`, que fija la navegación por hash routing como el único mecanismo de
navegación del runtime.

`selectedPath`/`hoveredPath` y la resolución de `activePage.layout` para breadcrumb/paleta/panel de propiedades viven
en un nuevo componente controlador montado dentro del mismo `RuntimeStateProvider`, que lee la página activa con
`useRuntimeCurrentPage()` (el mismo hook que ya usa `RuntimePage`) en vez de resolverla contra un `activePageId` local.
El efecto que hoy limpia la selección al cambiar de página (`useEffect` en `LayoutCanvas` keyed a `activePageId`) se
conserva, solo re-keyed a `state.navigation.currentPageId`.

`commitCanvasMutation` (que vive en `DevRuntimeReady`, fuera del provider, porque necesita llamar a
`setCurrentConfig`) ya recibe `activePageId` como parámetro explícito — no hardcodeado — en
`buildCommitCandidateConfig`/`patchRawConfigTextWithLayout` (`layout-canvas-commit.ts`), así que no cambia. Solo
cambia de dónde saca ese id: en vez de leer el estado local eliminado, lo lee de `bridgeRef.current.getLatestState().navigation.currentPageId`
en el momento del commit — el mismo patrón que la función ya usa hoy para leer `prevState` antes de migrar.

**Alternativa descartada**: mantener una "página del editor" independiente de la navegación real y sincronizarla en
un sentido. Se descarta porque FR2 exige explícitamente que el selector navegue de verdad, no que mantenga una
selección paralela.

### 3. Supresión de acciones declarativas: no-op centralizado dentro de `useRuntimeStateActions()`, no en cada nodo consumidor
En vez de tocar `button-layout-node.tsx`, `link-layout-node.tsx` y `form-layout-node.tsx` (los tres puntos que llaman
`executeRuntimeUiAction` o `executeQueryOperation` directamente), `useRuntimeStateActions()` en
`runtime-state-provider.tsx` lee `useLayoutEditModeContext()`. Cuando el contexto no es `null` (modo Editor activo),
las seis funciones que la spec enumera explícitamente como acciones declarativas —`navigateToPage`, `goBackPage`,
`executeQueryOperation`, `openModal`, `closeModal`, `resetForm`— se sustituyen por versiones no-op (`executeQueryOperation`
resuelve a un resultado neutro que no dispara ni `onSuccess` ni `onError` en `handleSubmit`, en vez de lanzar). El
resto de funciones del hook (`setFormFieldValue`, `setFormFieldError`, `initializeForm`, `removeForm`,
`readRuntimeState`, `setQuerySuccess`, `executeInlineQueryOperation`) no se tocan, porque no son "comportamiento
propio disparado por el usuario" sino mecanismo interno de formularios que debe seguir funcionando (p. ej. la
normalización automática de campos de elección en `form-layout-node.tsx`).

Este único cambio cubre automáticamente los tres puntos de disparo — el click de `button`/`link`, el submit nativo de
`form` (incluido un botón `type="submit"` implícito) y `runOnSuccessActions`/`runOnErrorActions` — sin tocar ninguno
de esos tres ficheros, porque todos consumen la misma referencia del mismo hook. Cumple directamente el requisito no
funcional de la spec de "interceptar sobre el mismo punto de disparo ya centralizado, sin reimplementar por nodo qué
acciones existen".

**Precedente que valida esta ubicación**: `layout-node-renderer.tsx`/`layout-renderer.tsx` (ficheros compartidos con
producción) ya condicionan comportamiento a `useLayoutEditModeContext()` desde `0102`, con la garantía de que el
contexto ausente reproduce el output de producción byte a byte. Esta decisión extiende exactamente el mismo patrón a
`runtime-state-provider.tsx`. La misma disciplina de test debe aplicarse aquí: un test que verifique que
`useRuntimeStateActions()` devuelve las funciones reales, sin ningún cambio de comportamiento, cuando
`editModeContext === null`.

**Alternativa descartada**: interceptar dentro de cada uno de los tres nodos (`button`/`link`/`form`) comprobando
`useLayoutEditModeContext()` antes de invocar la acción. Se descarta porque triplica la comprobación y es exactamente
el "reimplementar por nodo" que la spec prohíbe explícitamente.

### 4. Supresión de interactividad nativa de campos: `<fieldset disabled>` en el mismo punto de extensión post-switch de `layout-node-renderer.tsx`
Los siete tipos de campo (`input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `toggle`, `fileInput`) no
comparten un punto de disparo único como las acciones declarativas — cada uno pinta su propio control nativo. Tocar
los siete ficheros individualmente sería el "segundo mecanismo... reimplementado por nodo" que la spec quiere evitar
por analogía con el requisito ya explícito para acciones.

En vez de eso, se reutiliza el mismo punto de extensión post-switch que `0102` ya introdujo en
`layout-node-renderer.tsx` (Decisión 2 de `0102/design.md`, hoy usado para el wrapper de selección/hover/`data-node-path`).
Cuando `editModeContext !== null` y `node.type` pertenece al conjunto cerrado de los siete tipos de campo, el nodo
renderizado se envuelve en `<fieldset disabled className="contents">` antes del wrapper de selección existente (que
sigue estando un nivel más afuera).

- `disabled` en un `<fieldset>` nativo deshabilita en cascada todos los controles de formulario descendientes
  (`input`, `select`, `textarea`) sin tocar cada nodo, y a diferencia de `pointer-events-none`, también anula
  correctamente la activación implícita vía `<label>` (clicar la etiqueta de un checkbox/radio/toggle deshabilitado no
  lo activa) — `pointer-events-none` sobre el control nativo por sí solo no cubre ese caso, porque la activación
  disparada por `<label>` no pasa por el hit-testing normal del ratón.
- `className="contents"` (utilidad `display: contents` de Tailwind) hace que el `<fieldset>` no aporte caja propia,
  preservando el ancho/layout del contenido exactamente igual que en modo Visual — mismo requisito no funcional que ya
  satisface el wrapper de selección de `0102` al ser un elemento sin restricciones de tamaño propias.
- El wrapper de selección/hover ya existente queda **fuera** del `fieldset`, así que el click sobre la etiqueta o el
  propio control (aunque deshabilitado) sigue burbujeando hasta ese wrapper exterior y selecciona el nodo con
  normalidad — un control nativo deshabilitado no cancela el evento de click en sus ancestros, solo ignora su propia
  activación.
- `button` **no** entra en este conjunto: un `<button disabled>` nativo no dispara ningún evento de click, ni siquiera
  hacia sus ancestros, lo que rompería la selección de botones (FR: un botón con acción debe quedar seleccionado sin
  ejecutar su acción). Los botones ya quedan cubiertos por la Decisión 3 (su `onClick` llama a un handler no-op).
- `accordion`/`tabs` no entran en este conjunto tampoco: su interactividad de cabecera es estado local del propio
  componente, no pasa por `useRuntimeStateActions()` ni es un campo de formulario — queda intacta sin ningún caso
  especial, reproduciendo exactamente la excepción que la spec pide explícitamente (punto 11).

**Trade-off asumido**: los pseudo-selectores `:disabled` del navegador (atenuación, `cursor: not-allowed`) se aplican
automáticamente a los controles dentro del `fieldset` deshabilitado. Es un cambio visual menor y aceptado — no
compromete el requisito de "mismo ancho/layout", que es lo que la spec exige explícitamente; si se considera
indeseable, es una utilidad Tailwind `disabled:` local a añadir en el plan de implementación, no una decisión de
diseño distinta.

**Alternativa descartada**: `pointer-events-none` directamente sobre cada control nativo. Se descarta por el hueco de
activación vía `<label>` ya explicado, que dejaría togglear checkboxes/radios/toggles con normalidad pese a la
intención de la spec.

### 5. Persistencia de selección al alternar Visual ⇄ Editor: se conserva, aprovechando el margen que deja la spec
La spec fija como comportamiento por defecto que la selección no sobrevive a un ciclo Editor→Visual→Editor, salvo que
`design.md` proponga lo contrario por sencillez técnica y sin complicar la supresión de acciones (spec, Casos límite).
Con la Decisión 1 (el provider permanece montado, solo cambia su `value`), **no limpiar `selectedPath` al alternar de
modo es el camino de menor código** — limpiarlo exigiría un efecto adicional solo para descartar un estado que de
otro modo sigue siendo válido (la página no ha cambiado, el nodo sigue existiendo). Se decide conservar la selección:
alternar a Visual oculta el overlay (porque su render está condicionado a `mode === 'editor'`) sin descartar
`selectedPath`; volver a Editor sobre la misma página muestra de nuevo el mismo nodo seleccionado con su overlay. Esto
no afecta a la supresión de acciones (Decisión 3), que depende solo de si el contexto es `null`, no de qué contiene.

Cambiar de página (Decisión 2) sí limpia la selección, como ya exige la spec sin margen de interpretación (FR15).
Cambiar de pestaña de dominio fuera de `Layout` también limpia la selección — a diferencia del toggle Visual/Editor,
la spec no deja margen aquí (Casos límite: "la selección y su overlay se limpian, ya que esas pestañas no tienen
contenido de layout que editar").

### 6. Overlay de breadcrumb + propiedades: posicionamiento anclado al nodo seleccionado con una utilidad propia, sin librería nueva
El overlay se renderiza en `position: fixed` (igual que el drawer/botón actuales), lo que ya garantiza por sí solo el
requisito no funcional de no alterar el ancho/reflow del contenido — es la misma técnica que el drawer existente usa
hoy con éxito.

Su posición se calcula a partir de `getBoundingClientRect()` del elemento con `data-node-path` igual al `selectedPath`
serializado — el mismo atributo y mecanismo de lookup por selector que `layout-canvas-dnd-context.tsx` ya usa hoy
(`document.querySelector('[data-drop-zone="..."]"`) para otro propósito, así que no introduce una técnica nueva en el
proyecto. Se recalcula al cambiar la selección y en `scroll`/`resize`, con una utilidad propia y acotada (no un
fichero nuevo por caso, un único cálculo de "posición anclada"): coloca el overlay debajo del nodo por defecto,
voltea arriba si no cabe debajo, y clampa horizontalmente dentro del viewport. Si ni arriba ni abajo hay espacio
suficiente, se acepta solapar parcialmente al propio nodo antes que ocultar el overlay — el usuario ya ha visto qué
nodo seleccionó; ver sus propiedades tiene prioridad sobre verlo sin tapar.

**Alternativa descartada**: introducir una librería de posicionamiento tipo `@floating-ui`. Se descarta por el mismo
criterio que `0102/design.md` (Decisión 8) ya aplicó al formulario de propiedades: es peso añadido para un caso de uso
acotado (un ancla, un panel flotante, clamping simple de viewport) que una utilidad propia cubre sin dependencia
nueva, coherente con el sesgo del proyecto contra dependencias no justificadas.

### 7. Paleta de nodos y Monaco: paneles `fixed`, activados desde controles de la barra; se retira el punto de entrada anterior
La paleta ("Añadir elemento") pasa de columna en flujo dentro del drawer a panel `position: fixed`, montado dentro del
mismo `LayoutCanvasDndContext` que envuelve `<RuntimePage />` (necesario porque `dnd-kit` no soporta arrastrar entre
instancias de `DndContext` distintas — ya documentado en el propio `layout-canvas.tsx` actual), activado/ocultado por
el botón "Añadir elemento" de la barra.

Monaco reutiliza `DevRuntimeMonacoEditor` más la barra de acciones (Aplicar/Copiar) y el panel de errores ya
existentes en `DevRuntimeDrawer`, pero sin las pestañas Visual/JSON — ya no tiene sentido una pestaña "Visual" propia,
porque el propio contenido real *es* ahora la superficie visual. Se activa desde el control de la barra dedicado a
Monaco, con el mismo panel deslizante `fixed inset-y-0 right-0` que el drawer ya usa.

`DevRuntimeToggleButton` y el atajo `Ctrl/Cmd+Shift+J` de `useDevRuntimeKeyboard` se retiran: la spec dice
explícitamente que la barra "sustituye el botón flotante... y el atajo de teclado... como único punto de entrada al
editor" — mantener el atajo como vía alternativa contradiría ese "único". `Esc` para cerrar el panel de Monaco cuando
está abierto se conserva (no es un punto de entrada, es solo cierre).

### 8. Pestañas de dominio `Api`/`Páginas`/`Tokens`: solo marcado visual deshabilitado, sin estado ni lógica propia
Se renderizan como controles deshabilitados (o con indicación "próximamente") sin ningún estado de "editor de api/pages/tokens"
detrás — no hay nada que diseñar aquí más allá del marcado visual, confirmando el alcance ya fijado por la spec.

### 9. Corrección: el contexto de modo edición distingue "provider montado" de "modo Editor activo", para evitar remount de estado local de nodo al alternar Visual ⇄ Editor

**Detectado durante la implementación de T8** (auditoría de cierre, no en la fase de diseño original). La Decisión 1
justifica montar `LayoutEditModeProvider` siempre y alternar solo su `value` precisamente para que React no
desmonte/remonte `<RuntimePage />` al cambiar de modo, citando la pérdida de foco/scroll que eso causaría (FR16). Ese
mismo razonamiento no se aplicó, en el diseño original, un nivel más abajo: `layout-node-renderer.tsx` decide si
envuelve o no cada nodo individual en `<div data-node-path>` (y, para los siete tipos de campo, en
`<fieldset disabled>`) mirando `editModeContext !== null` — es decir, la *presencia* del wrapper, no solo sus
atributos, sigue atada al valor del contexto. Con la Decisión 1 ya implementada (`value: null` en Visual, objeto en
Editor), ese wrapper aparece y desaparece en cada toggle, y React desmonta/remonta cada nodo del árbol —
confirmado con un test de integración: un `accordion` expandido se colapsa (con nodo DOM nuevo, no solo re-render) al
pasar de Visual a Editor. Afecta a cualquier `useState` local de nodo (`accordion`, `tabs`), foco de campo y scroll
interno, en ambas direcciones del toggle, en toda página con esos patrones — comunes en cualquier layout real.

**No es una violación de un criterio de aceptación textual** (ni FR16 ni los casos límite de la spec mencionan
literalmente persistencia de estado interno de nodo), pero contradice el espíritu de la propia Decisión 1 y su cita a
FR16 ("sin necesidad de recargar la página"): la experiencia percibida es indistinguible de un reload parcial del
contenido en cada toggle.

**Fix**: `LayoutEditModeContextValue` deja de ser `{...} | null` y pasa a un discriminated union de tres estados
efectivos combinados con el propio `null` del contexto:

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

- `useLayoutEditModeContext() === null` — **sin provider en absoluto** (producción real, cualquier consumo fuera de
  `DevRuntime`). Sin cambios: sigue siendo el único caso con la garantía de "byte-a-byte idéntico" que exigen T1/T2 de
  esta feature y su equivalente en `0102`. Ningún wrapper, ningún fieldset, ningún efecto de supresión.
- `{ active: false }` — **provider montado, modo Visual**. Caso nuevo, no existía antes (antes esto colapsaba con
  "sin provider" porque `value` era literalmente `null`). El wrapper de selección y, donde aplique, el `fieldset`
  **sí existen en el DOM** (misma posición/tipo de elemento que en Editor, para no remontar al alternar), pero
  inertes: sin outline de selección/hover, `onClick`/`onMouseEnter`/`onMouseHover` son no-op, `fieldset disabled`
  es `false` (no hay `fieldset` en absoluto donde no lo hay, pero cuando lo hay para los 7 tipos de campo, no
  deshabilita), `useDraggable` sigue `disabled: true`, y `useRuntimeStateActions()` **no suprime** ninguna acción
  (Visual debe navegar/enviar formularios de verdad, igual que producción). Modal/accordion/repeater se comportan
  como producción (`isEditMode` dejaba de aplicar: modal solo abierto si el estado real lo indica, accordion sin
  forzar contenido visible, repeater resolviendo iteraciones reales en vez de colapsar a una instancia de plantilla).
- `{ active: true, ... }` — **modo Editor**, mismo comportamiento que hoy tiene "contexto no nulo": selección,
  hover, drag, fieldset deshabilitado en campos, supresión de acciones declarativas (Decisión 3), placeholders de
  contenedor vacío, modal siempre abierto para editar, accordion con contenido siempre visible, repeater colapsado a
  una instancia de plantilla.

**Regla de aplicación uniforme**: todo punto de extensión que hoy lee `editModeContext !== null` para decidir
*comportamiento* (outline, click-to-select, drag habilitado, `fieldset disabled`, supresión de acciones en
`runtime-state-provider.tsx`, `isEditMode` de `accordion-layout-node.tsx`/`modal-layout-node.tsx`/
`repeater-layout-node.tsx`, placeholders de contenedor vacío en `layout-renderer.tsx`) pasa a leer
`editModeContext !== null && editModeContext.active`. Todo punto que decide la *presencia* de un elemento wrapper en
el árbol (el `<div data-node-path>` y el `<fieldset>` de `layout-node-renderer.tsx`) sigue gateado únicamente por
`editModeContext !== null`, y solo cambia atributos (`disabled` del fieldset, `className`/handlers activos del div)
según `.active` — nunca su presencia, para no remontar. `DevEditorLayer` dejar de pasar `value: null` en Visual;
pasa siempre un objeto, con `active: mode === 'editor'`.

**Consecuencia asumida en el DOM de modo Visual**: a partir de este fix, el modo Visual (dentro de `DevRuntime`, con
`DevEditorLayer` montado) deja de ser byte-idéntico a producción real — cada nodo queda envuelto en un `<div>`
inerte (y, los siete tipos de campo, además en un `<fieldset>` no deshabilitado). Esto es aceptable porque el
requisito de "byte-a-byte idéntico" (`0102/design.md` línea 51, reafirmado por T1/T2 de esta feature) se definió y
se sigue cumpliendo exclusivamente para el caso "`LayoutEditModeContext` no está presente" — es decir, **sin
provider**, no "modo Visual con provider presente". Modo Visual con provider ya era, desde antes de este fix, un
entorno de desarrollo con chrome adicional (barra flotante, `DevRuntimeStateBridge`, etc.) nunca presentado como
indistinguible de producción a nivel de DOM; solo su *comportamiento interactivo* (navegación, envío de formularios,
edición de campos) debe ser indistinguible, y ese comportamiento se preserva exactamente por el gate `.active`.

**Alternativa descartada**: mantener `value: null` en Visual y en su lugar hacer que
`layout-node-renderer.tsx`/`layout-renderer.tsx` monten el wrapper siempre que exista *algún* ancestro `DevRuntime`
detectado por otra vía (por ejemplo, un segundo contexto "¿estoy dentro de DevRuntime?" separado del modo). Se
descarta por introducir un segundo mecanismo de contexto para una distinción que el propio
`LayoutEditModeContextValue` ya puede expresar con un campo adicional, sin nuevo contexto ni nuevo hook.

## Riesgos y trade-offs

- **`useRuntimeStateActions()` pasa a depender de `layout-edit-mode-context.tsx`**: es un hook usado por 14 ficheros de
  nodo, no solo los tres relacionados con acciones. Mitigación: el cambio solo toca las seis funciones de acción
  declarativa explícitas; un test debe fijar que el resto de funciones del hook (formularios, queries de solo
  lectura) son referencia-idénticas con o sin contexto, y que con contexto `null` el hook devuelve exactamente el
  mismo objeto que hoy.
- **`layout-node-renderer.tsx` gana una segunda razón de cambio** (el `fieldset` de la Decisión 4) además del wrapper
  de selección ya existente de `0102`. Mitigación: mismo test de "output byte-idéntico sin contexto" que `0102` ya
  exige para ese fichero, extendido para cubrir también el nuevo wrapper condicional.
- **`LayoutCanvasDndContext`/`useDraggable`/`useDroppable` quedan siempre montados sobre el árbol real**, incluso en
  modo Visual (antes solo se montaban dentro del canvas aislado, nunca sobre el árbol real). Riesgo residual bajo:
  `disabled: editModeContext === null` ya los deja inertes, y `DevRuntime` completo solo existe bajo las condiciones
  de activación ya vigentes (nunca en el bundle de producción), el mismo límite que ya acota el riesgo equivalente en
  `0102`.
- **El `repeater` en modo Editor colapsa a una instancia de `props.template`, ahora sobre el árbol real** (antes esto
  solo ocurría en el canvas aislado, con el runtime real de fondo mostrando la lista completa sin tocar). Es
  comportamiento ya fijado por `0102` y reafirmado sin cambios por esta spec, pero al eliminarse el árbol duplicado el
  usuario deja de poder ver la lista real completa "detrás" mientras edita — es la consecuencia directa, y deseada,
  de que ya no exista una segunda copia del render. No es un riesgo nuevo introducido por este diseño, es inherente a
  la decisión ya tomada por la spec de que exista un único árbol.
- **Estilo `:disabled` por defecto del navegador en campos inertizados** (Decisión 4): cosmético, no bloqueante; ver
  trade-off ya descrito ahí.
- **El modo Visual dentro de `DevRuntime` deja de ser byte-idéntico a producción a nivel de DOM** (Decisión 9): gana
  wrappers inertes (`<div>`, y en campos `<fieldset>` no deshabilitado) que no existían antes de esta corrección.
  Mitigación: el requisito de byte-identidad siempre se definió para "sin provider" (producción real), no para
  "Visual con provider presente"; el comportamiento interactivo (navegación, envío de formularios, campos editables)
  sigue siendo indistinguible de producción, verificado por test explícito.

## Migración o despliegue

No aplica migración de datos ni de contrato. Es una reestructuración interna de una herramienta de desarrollo ya
existente — sustituye su punto de entrada y elimina un árbol de render duplicado — sin usuarios de producción ni
configuraciones persistidas que migrar, igual que `0102`.

## Preguntas abiertas

- **Algoritmo exacto de clamping del overlay de breadcrumb+propiedades en viewports muy pequeños o contenido con
  scroll interno complejo**: la Decisión 6 fija el criterio general (debajo por defecto, voltea arriba, clampa
  horizontalmente, acepta solape antes que ocultar); afinar casos extremos concretos queda para el plan de
  implementación, mismo tratamiento que `0102/design.md` ya dio a la geometría de drop sobre grids con `span`
  responsive. No bloquea el resto del diseño.
