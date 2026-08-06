# Plan — 0128 dev-editor-toggle-widget

Contrato de ejecución para la feature. Alcance: un componente reutilizable de alternancia (segmentos
tipo píldora) para el panel de propiedades del editor visual, y su integración en tres usos del
catálogo: `container` (Grid/Columnas), `heading` (H1–H5) y `tabs` (Horizontal/Vertical).

La fuente única de verdad de la spec vive en [[spec.md]]. Esta feature no requiere `design.md`
(ver [[status.yaml]]).

Todas las tareas comparten estos anclajes técnicos:

- **Registro de widgets dedicados por schema**: `WIDGET_REGISTRY` en
  `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`. Es el mismo hook
  `x-widget` que ya usan `choice-items` (feature `0108`) y `layout-span` (feature `0127`). No
  introducir un segundo mecanismo de registro.
- **Adaptadores de schema por nodo**: `resolveTabsPropsSchema`, `resolveChoiceLikePropsSchema` y
  `resolveLayoutSubsectionSchema` en `layout-canvas-properties-panel.tsx` son el precedente para
  inyectar el sentinel `{ 'x-widget': '<key>' }` en un sub-schema concreto antes de pasarlo al
  dispatcher. `heading.props.level` y `tabs.props.orientation` siguen ese patrón (T3 y T4).
- **Widget de nivel de nodo con escritura de nodo completo**: `LinkContentModePropertyField`
  (feature `0126`) es el precedente vigente para un widget que recibe el nodo entero, se dibuja
  fuera del loop `SUBSECTIONS.map(...)` en el panel, y hace commit vía
  `onCommitNodeUpdate(path, (currentNode) => nextNode)`. El widget de `container` (T5) sigue ese
  mismo patrón porque su edición cruza el borde de `props` (añadir/quitar la clave `columns`).
- **Componente presentacional único**: el requisito no funcional 1 de la spec pide un único
  componente que encapsule la lógica de segmentos/resaltado/commit, y tres integraciones finas
  encima. T1 crea ese componente; T2–T5 lo consumen sin duplicar su presentación.
- **Iconos Lucide**: `container` usa `LayoutGrid` (Grid) y `Columns2` (Columnas); `tabs` usa
  `LayoutPanelTop` (Horizontal) y `LayoutPanelLeft` (Vertical). Nombres verificados contra
  `lucide-react` en el proyecto; el widget de `heading` no lleva icono por segmento (spec
  requisito funcional del bloque "heading").
- **Feedback por rechazo del commit**: sigue el patrón vigente del panel — `CommitRejectionBanner`
  con `role="alert"` justo debajo del control, valor tecleado preservado, limpieza al cambiar de
  nodo o tras un commit válido. Ver
  `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` como referencia.

Los tests de la fase de implementación deben cumplir además las reglas globales de
`ai-workflow/standards/testing-rules.md` (umbral mínimo global de cobertura del 80% sobre `src/`,
tests centrados en comportamiento observable, sin snapshots amplios ni mocks que oculten el
comportamiento real).

## Orden y dependencias

T1 → T2 → T3 → T4 → T5. Cada tarea deja el árbol de la app compilando y con `pnpm test` en verde
antes de la siguiente. T2, T3 y T5 dependen de T1 (componente presentacional compartido); T4 es
sub-tarea integradora sobre `heading` y `tabs` en el panel real (los dos usos comparten adaptador de
schema y test de integración end-to-end). No dividir un T en dos pasadas.

## Siguiente tarea a escoger

`0128-T1` — habilita el resto del plan (T2, T3 y T5 consumen el componente presentacional que crea).

---

## Task 0128-T1 — Componente presentacional `SegmentedTogglePropertyField`

- **ID**: 0128-T1
- **Estado**: pending
- **Objetivo**: Crear el único componente presentacional compartido por las tres integraciones:
  un control tipo píldora con una fila de segmentos, uno por opción, con el segmento activo
  resaltado. No se registra en `WIDGET_REGISTRY`; es la pieza React reutilizable que T2, T3 y T5
  envolverán en widgets específicos.

  Contrato del componente:
  - **Props**: `label: string`, `segments: ReadonlyArray<{ value: string | number; label: string; icon?: LucideIcon }>`,
    `activeValue: string | number | null` (null cuando ningún segmento debe aparecer activo),
    `onSelect: (value: string | number) => void`.
  - **Presentación**: contenedor tipo píldora con borde y radio propios, un botón por segmento,
    icono opcional a la izquierda del texto de cada segmento; el segmento activo se distingue
    visualmente (fondo, borde o combinación) frente a los inactivos.
  - **Semántica y accesibilidad**: los segmentos se implementan como un grupo de radios accesible
    (`role="radiogroup"` sobre el contenedor y `role="radio"` con `aria-checked` en cada segmento,
    o equivalente `role="tablist"`/`role="tab"` con `aria-selected`; la implementación puede elegir
    entre esos dos patrones, pero el patrón elegido debe ser único y coherente para los tres usos).
    El `label` del componente identifica el grupo mediante `aria-label` o un elemento visible
    equivalente. Navegación por teclado (`ArrowLeft`/`ArrowRight` mueven la selección; `Enter` o
    `Space` la confirman si el patrón elegido lo requiere; `Tab` entra y sale del grupo).
  - **Comportamiento**: `onSelect(value)` se dispara solo cuando el usuario selecciona un segmento
    distinto del `activeValue` actual (idempotencia: reelegir el segmento ya activo no dispara
    `onSelect`, mismo criterio que `LinkContentModePropertyField`). El componente **no** decide qué
    segmento está activo por sí mismo; la fuente de verdad es siempre `activeValue`, que puede ser
    `null` para representar "sin activo" (usado por T3 cuando `heading.props.level` es 6 o fuera
    de `1..5`).
  - **Estilo**: utilidades de `Tailwind` locales; no introducir tokens visuales nuevos ni una API
    de theming. Alineado con la línea visual del resto del panel.
- **Fuera de alcance**:
  - Cualquier integración con `WIDGET_REGISTRY` o con `LayoutCanvasPropertiesPanel`.
  - Contexto React nuevo: este componente es puramente presentacional; recibe todo por props.
  - Feedback de commit rechazado (`role="alert"`): el componente no gestiona el estado de rechazo;
    el widget envolvente (T2, T3 o T5) decide dónde y cómo mostrarlo, del mismo modo que el
    `LayoutSpanPropertyField` gestiona su propio `rejections`.
  - Selector de iconos libre; el icono por segmento se pasa como prop resuelta desde el widget
    envolvente.
- **Dependencias**: ninguna previa dentro de esta feature. Depende del paquete `lucide-react` ya
  vendorizado (`src/runtime/nodes/icon-node.tsx` es el precedente de importación por nombre).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/segmented-toggle-property-field.tsx` (nuevo:
      exporta `SegmentedTogglePropertyField` y el tipo `SegmentedToggleOption`).
  - Tests:
    - `src/tests/dev-runtime/segmented-toggle-property-field.test.tsx` (nuevo).
  - Documentación afectada (no se edita en esta tarea; ver campo `documentación afectada` de
    cierre): ninguna ficha funcional del producto — el componente no es visible por sí mismo hasta
    su primer uso (T3).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/segmented-toggle-property-field.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Con dos segmentos declarados en orden `[{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]`
      y `activeValue = 'a'`, el DOM renderiza dos botones en ese orden, el primero marcado como
      activo (`aria-checked="true"` o `aria-selected="true"` según el patrón elegido) y el segundo
      como no activo.
    - Con cinco segmentos numéricos (`1..5`) y `activeValue = 3`, el segmento con `value = 3` es
      el único marcado activo; el resto no lo está.
    - Con `activeValue = null`, ningún segmento aparece marcado activo (todos con `aria-checked` /
      `aria-selected` en `false`); los segmentos siguen siendo pulsables.
    - Pulsar un segmento distinto del activo llama a `onSelect` una única vez con el `value` de ese
      segmento.
    - Pulsar el segmento ya activo **no** llama a `onSelect` (idempotencia).
    - Un segmento con `icon` prop provisto renderiza el icono Lucide a la izquierda del texto (por
      ejemplo comprobando la presencia de un `<svg>` dentro del botón); un segmento sin `icon` no
      lo renderiza.
    - El componente expone un nombre accesible del grupo derivado del `label` recibido (verificable
      por `getByRole('radiogroup', { name })` o el equivalente para `tablist`, según el patrón
      elegido).
    - Navegación por teclado: con foco en el segmento activo, `ArrowRight` mueve el foco al
      siguiente segmento y (si el patrón elegido es radiogroup con auto-selección) llama a
      `onSelect` con su `value`; `ArrowLeft` retrocede. En el borde derecho el foco no se mueve o
      envuelve al primer segmento (elegir un comportamiento y probarlo consistentemente).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/segmented-toggle-property-field.test.tsx`
  - **Restricciones**:
    - No mockear `lucide-react`; los iconos usados en el test se importan tal cual del paquete.
    - Usar `@testing-library/react` y las utilidades ya vigentes en `src/tests/dev-runtime/`; no
      introducir helpers nuevos ni un harness paralelo.
- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se
  edita aquí):
  - `ai-workflow/docs/test-index.md`: añadir la línea del nuevo fichero de test bajo
    `dev-runtime/`.
  - Ninguna ficha de `ai-workflow/docs/app-features/` (el componente no es visible por sí mismo
    hasta T3).
- **Criterios de finalización**:
  - El componente existe, está tipado y tiene su suite de test en verde.
  - Ningún consumidor del proyecto lo importa todavía (se hará desde T2 en adelante).
- **Cierre de implementación**:
  - Fichero nuevo creado, importable desde `src/dev-runtime/layout-canvas/property-fields/`.
  - Suite `pnpm test --run src/tests/dev-runtime/segmented-toggle-property-field.test.tsx` en
    verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0128-T2 — Widgets envolventes `heading-level` y `tabs-orientation` (registro y test aislado)

- **ID**: 0128-T2
- **Estado**: pending
- **Objetivo**: Crear los dos widgets envolventes que consumen `SegmentedTogglePropertyField` y se
  registran en `WIDGET_REGISTRY` con la firma estándar `{ label, value, onChange }`. Sin cambios
  todavía en `LayoutCanvasPropertiesPanel` (esa integración vive en T4).

  1. **`heading-level`** en
     `src/dev-runtime/layout-canvas/property-fields/heading-level-property-field.tsx`:
     - Cinco segmentos fijos `{ value: 1..5, label: 'H1'..'H5' }` sin icono.
     - `activeValue` = `value` cuando `value` es un entero entre `1` y `5`; en cualquier otro caso
       (incluido `6`, `undefined`, no numérico) `activeValue = null` — se traduce a "ningún
       segmento activo", cubriendo directamente los casos límite de la spec.
     - `onSelect(nextLevel)` invoca `onChange(nextLevel)` con el entero correspondiente.
     - Se registra en `WIDGET_REGISTRY['heading-level']` en `property-field-dispatcher.tsx`.
  2. **`tabs-orientation`** en
     `src/dev-runtime/layout-canvas/property-fields/tabs-orientation-property-field.tsx`:
     - Dos segmentos fijos `{ value: 'horizontal', label: 'Horizontal', icon: LayoutPanelTop }` y
       `{ value: 'vertical', label: 'Vertical', icon: LayoutPanelLeft }`.
     - `activeValue` = `value` cuando `value` es `'horizontal'` o `'vertical'`; cuando `value` es
       `undefined` (equivalente al default `"horizontal"` del runtime), `activeValue = 'horizontal'`
       — el widget muestra "Horizontal" activo, tal y como pide el criterio de aceptación 10 de la
       spec. Para cualquier otro valor (no debería ocurrir con validación previa) `activeValue = null`
       como degradación silenciosa.
     - `onSelect(nextOrientation)` invoca `onChange(nextOrientation)` con el literal
       correspondiente.
     - Se registra en `WIDGET_REGISTRY['tabs-orientation']` en `property-field-dispatcher.tsx`.

  Ambos widgets aceptan `label` para propósito de accesibilidad (identidad del grupo de segmentos);
  cada uno elige un `label` humano concreto — usar `'Nivel'` para heading y `'Orientación'` para
  tabs, sin necesidad de leer un campo de schema (el `label` que el dispatcher pasa es el nombre
  técnico del schema, `'level'` o `'orientation'`, que no es idóneo como legend visible).
- **Fuera de alcance**:
  - Integración de estos widgets en `LayoutCanvasPropertiesPanel` (T4) ni sustitución del editor
    genérico de `props.level` / `props.orientation`.
  - Cambio en el schema Zod (`runtime-config-zod.ts`) o en la validación
    (`validateRuntimeConfig`). El widget solo cambia cómo se edita un valor ya válido.
  - Widget de `container` — se aborda en T5.
  - Feedback de rechazo del commit: los widgets no capturan estado local; delegan en el flujo
    estándar del panel, igual que hacen las opciones enum genéricas. La UX de rechazo se cubre
    end-to-end en T4.
- **Dependencias**: T1 (`SegmentedTogglePropertyField`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/heading-level-property-field.tsx` (nuevo).
    - `src/dev-runtime/layout-canvas/property-fields/tabs-orientation-property-field.tsx` (nuevo).
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (modificar:
      añadir las dos entradas al `WIDGET_REGISTRY`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-heading-level.test.tsx` (nuevo).
    - `src/tests/dev-runtime/layout-canvas-property-field-tabs-orientation.test.tsx` (nuevo).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliar: dos
      casos que verifican el resolver del hook `x-widget` para las nuevas claves).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: dos líneas nuevas bajo `dev-runtime/`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-heading-level.test.tsx` (nuevo).
    - `src/tests/dev-runtime/layout-canvas-property-field-tabs-orientation.test.tsx` (nuevo).
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
  - **Comportamiento cubierto** (`heading-level`, fichero nuevo):
    - Con `value = 2`, el segmento "H2" es el único activo.
    - Con `value = 1`, `3`, `4`, `5`: cada uno activa exactamente su segmento correspondiente.
    - Con `value = 6`, ningún segmento aparece activo (`activeValue = null`), verificable por la
      ausencia de `aria-checked="true"` / `aria-selected="true"` en cualquier botón del grupo.
    - Con `value = undefined` o no numérico, ningún segmento aparece activo.
    - Pulsar un segmento distinto (`H4`) con `value = 2` llama a `onChange(4)` una única vez.
    - Pulsar el segmento ya activo no llama a `onChange` (idempotencia heredada del componente
      compartido, verificada explícitamente aquí porque forma parte del contrato observable del
      widget).
    - Ningún segmento renderiza `<svg>` (sin iconos, spec).
  - **Comportamiento cubierto** (`tabs-orientation`, fichero nuevo):
    - Con `value = 'horizontal'`, el segmento "Horizontal" es el único activo.
    - Con `value = 'vertical'`, el segmento "Vertical" es el único activo.
    - Con `value = undefined`, `activeValue = 'horizontal'` y el segmento "Horizontal" aparece
      activo.
    - Pulsar "Vertical" con `value = 'horizontal'` (o `undefined`) llama a `onChange('vertical')`.
    - Pulsar "Horizontal" con `value = 'vertical'` llama a `onChange('horizontal')`.
    - Pulsar el segmento ya activo no llama a `onChange`.
    - Cada segmento renderiza un `<svg>` (icono Lucide) a la izquierda del texto.
  - **Comportamiento cubierto** (dispatcher, ampliación):
    - Un schema `{ 'x-widget': 'heading-level' }` monta `HeadingLevelPropertyField` con el `value`
      y `onChange` proporcionados; la lógica del dispatcher no interpreta el schema como número
      genérico.
    - Un schema `{ 'x-widget': 'tabs-orientation' }` monta `TabsOrientationPropertyField` con el
      `value` y `onChange`; no cae al `EnumPropertyField` genérico.
    - Regresión: un schema sin `x-widget` con `type: 'string'` sigue montando `TextPropertyField`,
      y con `type: 'integer'` sigue montando `NumberPropertyField` (los casos ya cubiertos hoy en
      el fichero no se rompen; añadir aserciones puntuales solo si es necesario para la
      no-regresión).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-heading-level.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-tabs-orientation.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
  - **Restricciones**:
    - No mockear `SegmentedTogglePropertyField`: los tests aislados del widget deben ejercer el
      componente compartido para probar el contrato observable end-to-end (activo / no activo /
      onChange). Se acepta reutilizar helpers de render del propio T1 si se han extraído a un
      módulo de test.
    - No introducir `LayoutCanvasPropertiesPanel` en estos tests aislados; su integración con el
      panel real se cubre en T4.
- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se
  edita aquí):
  - `ai-workflow/docs/test-index.md`: dos líneas nuevas bajo `dev-runtime/`.
  - Ninguna ficha de `app-features/` en esta tarea; la nota funcional se añade en T4 cuando el
    widget ya es observable end-to-end en el panel real.
- **Criterios de finalización**:
  - Los dos widgets están registrados en `WIDGET_REGISTRY` y son montables por el dispatcher a
    través del hook `x-widget`, con tests aislados en verde.
- **Cierre de implementación**:
  - `pnpm test --run <cada uno de los tres ficheros>` en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0128-T3 — Adaptadores de schema en el panel para `heading.props.level` y `tabs.props.orientation`

- **ID**: 0128-T3
- **Estado**: pending
- **Objetivo**: En `LayoutCanvasPropertiesPanel` sustituir el sub-schema generado de
  `heading.props.level` y de `tabs.props.orientation` por el sentinel
  `{ 'x-widget': 'heading-level' }` y `{ 'x-widget': 'tabs-orientation' }` respectivamente, antes
  de pasar el sub-schema al `PropertyFieldDispatcher`. Es el mismo patrón que ya existe para
  `select.props.items` (`resolveChoiceLikePropsSchema`) y `layout.span`
  (`resolveLayoutSubsectionSchema`). Sin este paso, T2 queda inerte: los widgets están registrados
  pero el panel no los invoca todavía.

  Concretamente:
  - Nuevo helper `resolveHeadingPropsSchema(propsSchema)` que devuelve una copia del schema con
    `properties.level` reemplazado por `{ 'x-widget': 'heading-level' }` cuando esa clave existe.
    Localizado junto al resto de resolvers ya presentes en el mismo fichero.
  - Ampliar `resolveTabsPropsSchema(propsSchema)` (ya existente para `items`) para además
    reemplazar `properties.orientation` por `{ 'x-widget': 'tabs-orientation' }` cuando esa clave
    existe. Preservar el resto de la lógica actual del resolver (exclusión de `children`, siembra
    de `default` en `label`, `minItems`).
  - En el loop de subsecciones del panel, añadir la rama para `node.type === 'heading'` en la
    subsección `props`, análoga a las ramas ya existentes para `tabs` y para
    `CHOICE_LIKE_NODE_TYPES`.
- **Fuera de alcance**:
  - Cambios en el schema Zod ni en la validación.
  - Widget de `container` (T5).
  - Ninguna modificación al widget presentacional ni a los envolventes de T2.
  - Cualquier cambio en Monaco o en el pipeline `commitCanvasMutation`.
- **Dependencias**: T2 (widgets registrados). T1 (indirecta, ya cubierta por T2).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar: nuevo
      `resolveHeadingPropsSchema`, ampliación de `resolveTabsPropsSchema` para `orientation`,
      wiring en el loop de subsecciones para `heading`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliar).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md` — sección "Panel de
      propiedades (modo Editor)": `heading.props.level` y `tabs.props.orientation` dejan de
      editarse con controles genéricos; se marca aquí como afectada, se actualiza literalmente en
      `update-app-documentation`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto**:
    - Seleccionar un `heading` con `props: { text: 'x', level: 2 }` renderiza el widget de
      segmentos H1–H5 (verificable por `getByRole('radiogroup', { name: /Nivel/ })` o equivalente
      del patrón elegido en T1), y **no** renderiza el input numérico genérico de `level` que hoy
      existe (regresión negativa explícita).
    - Con `level = 5`, el segmento "H5" es el único activo.
    - Con `level = 6`, ningún segmento aparece activo (verificable por la ausencia de
      `aria-checked="true"` en cualquier segmento).
    - Pulsar "H4" con `level = 2` llama a `onCommitNodeUpdate` con el `path` del heading y un
      updater que fija `props.level = 4` sin tocar `props.text` ni otras claves.
    - Seleccionar un `tabs` con `props: { items: [...], orientation: 'vertical' }` renderiza el
      widget con "Vertical" activo, y **no** renderiza el selector genérico `orientation`
      (regresión negativa explícita).
    - Seleccionar un `tabs` sin `orientation` declarado renderiza el widget con "Horizontal"
      activo.
    - Pulsar "Horizontal" con `orientation = 'vertical'` llama a `onCommitNodeUpdate` con un
      updater que fija `props.orientation = 'horizontal'` sin tocar `props.items`.
    - Regresión: el resto del schema de `heading.props` (`text`, `icon`) sigue editable con los
      controles genéricos; el resto del schema de `tabs.props` (`items`, `defaultTab`) sigue
      editable con los controles ya vigentes (widget de `items` intacto).
    - Regresión: para otros nodos (`container`, `paragraph`, `button`, `list`, `form`, un nodo
      representativo del catálogo) el panel no monta ninguno de los dos widgets nuevos — sus props
      se siguen editando con los controles genéricos.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
  - **Restricciones**:
    - Reutilizar el harness `vi.fn()` plano ya vigente en el fichero para `onCommitNodeUpdate`.
    - No añadir aquí un caso end-to-end con `validateRuntimeConfig` real; ese flujo se cubre en
      T4 con el fichero
      `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` para no
      duplicar montaje.
- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
    propiedades (aparición del widget de segmentos para `heading.props.level` y
    `tabs.props.orientation`).
- **Criterios de finalización**:
  - Con el panel montado, `heading.props.level` y `tabs.props.orientation` se editan mediante los
    widgets de segmentos correspondientes, y los tests nuevos y de regresión pasan.
- **Cierre de implementación**:
  - Suite del panel en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0128-T4 — Cobertura end-to-end de `heading` y `tabs` en el pipeline real del panel

- **ID**: 0128-T4
- **Estado**: pending
- **Objetivo**: Cerrar los criterios de aceptación 5–7 y 10–12 de la spec probando los dos widgets
  dentro del panel real (`LayoutCanvasPropertiesPanel` montado con `pageLayout` real y
  `onCommitNodeUpdate` conectado al pipeline `validateRuntimeConfig + patchRootKey` vigente),
  usando el mismo fichero y harness end-to-end que ya usa el widget de span
  (`layout-canvas-properties-panel-commit-feedback.test.tsx`).

  Cubre además el criterio de aceptación 8 y 9 aplicados a estos dos usos: preservación del valor
  visual y aviso `role="alert"` cuando el commit se rechaza por validación, sin regresión de
  Monaco ni de la exclusión mutua con el panel de Monaco.
- **Fuera de alcance**:
  - Widget de `container` — se cubre en T5 con su propio bloque end-to-end.
  - Cualquier cambio en el pipeline de commit o en la validación.
  - Nuevos criterios funcionales fuera de la spec.
- **Dependencias**: T3 (adaptadores de schema en el panel).
- **Impacto esperado en archivos**:
  - Código: sin cambios previstos. Si el test end-to-end revela un hueco en el wiring de T3,
    cerrarlo en el módulo original y no crear uno nuevo.
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
    - `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md` (nota sobre la edición de
      `level` desde el editor visual).
    - `ai-workflow/docs/app-features/nodes/tabs.md` (nota sobre la edición de `orientation` desde
      el editor visual).
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
  - **Comportamiento cubierto**:
    - Aceptación 5: seleccionar un `heading` con `props.level` en `1..5` muestra el widget con el
      segmento correspondiente activo; el input numérico genérico de `level` no está en el DOM.
    - Aceptación 6: seleccionar un `heading` con `props.level = 6` muestra el widget sin ningún
      segmento activo.
    - Aceptación 7: pulsar `H3` en un `heading` con `level = 1` recorre el pipeline real y el
      config resultante contiene `props.level = 3` (verificable por el `editorBuffer` sincronizado
      con Monaco o el estado del store); el resto de props (`text`) se preserva.
    - Aceptación 10: seleccionar un `tabs` sin `orientation` declarado muestra el widget con
      "Horizontal" activo.
    - Aceptación 11: seleccionar un `tabs` con `props.orientation = 'vertical'` muestra el widget
      con "Vertical" activo.
    - Aceptación 12: pulsar el segmento contrario recorre el pipeline real y fija
      `props.orientation` al literal correspondiente; el resto de props (`items`) se preserva.
    - Aceptación 8 (aplicada a estos usos): simular un rechazo del commit — por ejemplo, mockear
      puntualmente `patchRootKey` o `validateRuntimeConfig` para devolver un rechazo con
      código/mensaje — hace aparecer el aviso `role="alert"` debajo del widget con
      `error.code`/`error.message`, sin modificar el buffer de Monaco. Un commit válido posterior
      limpia el aviso. Reutilizar el patrón exacto de simulación de rechazo ya presente en el
      fichero (que hoy cubre otras subsecciones), sin inventar uno nuevo.
    - Aceptación 9: al usar los widgets, el resto del panel (Props, Layout, Visibilidad, Estado
      de consulta), la sincronización con Monaco tras un commit exitoso desde el widget y la
      exclusión mutua con el panel de Monaco siguen funcionando sin regresión — reutilizar las
      aserciones ya establecidas en el fichero.
    - Caso límite: cambiar de nodo seleccionado con un aviso pendiente descarta el aviso, mismo
      comportamiento que el resto de subsecciones del panel.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - **Restricciones**:
    - Usar el pipeline de commit real (`validateRuntimeConfig` + `patchRootKey`) montado como en
      los tests existentes del fichero; no mockear la validación salvo puntualmente para forzar
      un rechazo (aceptación 8), y solo con el patrón exacto ya presente en el fichero.
    - Reusar el harness/helpers del fichero (p. ej. `DevRuntimeReady`) para no duplicar montaje.
- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
  - `ai-workflow/docs/app-features/nodes/heading-paragraph-list.md`.
  - `ai-workflow/docs/app-features/nodes/tabs.md`.
- **Criterios de finalización**:
  - Los criterios de aceptación 5–7 y 10–12 (más 8 y 9 aplicados a estos dos usos) están cubiertos
    por tests que atraviesan el pipeline real, no solo el widget en aislamiento.
- **Cierre de implementación**:
  - Suite del fichero en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0128-T5 — Widget `ContainerColumnsModePropertyField` (Grid/Columnas) y su integración end-to-end

- **ID**: 0128-T5
- **Estado**: pending
- **Objetivo**: Añadir al panel de propiedades del nodo `container` un widget dedicado
  "Modo" (o etiqueta equivalente) con dos segmentos "Grid" y "Columnas", con alcance de escritura
  ampliado al nodo completo (siguiendo el precedente de `LinkContentModePropertyField`, feature
  `0126`). Cierra los criterios de aceptación 1–4, 8 y 9 de la spec para el uso de `container`.

  Contrato del widget:
  - Fichero nuevo
    `src/dev-runtime/layout-canvas/property-fields/container-columns-mode-property-field.tsx`.
  - Firma: `{ label: string, node: ContainerLayoutNode, onChange: (node: ContainerLayoutNode) => void }`
    — mismo shape que `LinkContentModePropertyField`, no la firma estándar del `WIDGET_REGISTRY`.
    No se registra en `WIDGET_REGISTRY`; se monta directamente desde el panel condicionado a
    `node.type === 'container'`.
  - Iconos por segmento: `LayoutGrid` para "Grid", `Columns2` para "Columnas" (nombres verificados
    contra `lucide-react` del proyecto). Se pasan al `SegmentedTogglePropertyField` compartido.
  - Detección del segmento activo:
    - `props.columns !== undefined` (entero fijo o mapa responsive) → "Grid" activo.
    - `props.columns === undefined` → "Columnas" activo.
    - Nunca `activeValue = null` para este uso; la spec no contempla estado "sin activo" para
      container.
  - Reconstrucción del nodo al cambiar de segmento:
    - "Columnas" → "Grid" (el usuario pulsa "Grid" y `columns` estaba ausente): devuelve el nodo
      con `props.columns = 2` (entero fijo por defecto). El resto de `props` (incluido `direction`
      si estaba declarado) se preserva sin tocar.
    - "Grid" → "Columnas" (el usuario pulsa "Columnas" y `columns` estaba presente): devuelve el
      nodo con la clave `columns` **quitada** de `props`. `direction` (si existía) se preserva sin
      tocar; el resto de `props` también.
    - Pulsar el segmento ya activo no dispara `onChange` (idempotencia, heredada del componente
      compartido).
    - Caso límite de la spec: cuando `columns` es un mapa responsive, "Grid → Columnas → Grid"
      **no** restaura el mapa anterior — la vuelta a "Grid" siembra `columns = 2` desde cero. Es el
      comportamiento natural de esta reconstrucción; se prueba explícitamente.
  - Integración en `LayoutCanvasPropertiesPanel`: nuevo bloque condicionado a
    `node.type === 'container'`, análogo al bloque ya presente para `node.type === 'link'`, con
    `onCommitNodeUpdate(path, () => nextNode)` como canal de commit. Se renderiza inmediatamente
    antes de `SUBSECTIONS.map(...)`, en la misma posición relativa que hoy ocupa el widget de
    `link`. El campo `columns` sigue apareciendo dentro de la subsección `Props` cuando el nodo
    tiene `columns` (comportamiento actual del dispatcher genérico); no requiere código adicional
    en el panel.
  - Feedback de rechazo: el widget no gestiona su propio `pendingRejections`; una vez el commit
    pasa por `onCommitNodeUpdate`, el panel gestiona el aviso vía el mecanismo actual de
    `recordCommitResult`. Para que el aviso aparezca **junto al widget** en el caso de un rechazo,
    hace falta introducir una clave `PendingRejectionKey` adicional (`'containerColumnsMode'`) en
    el panel — mismo patrón que la clave `'submitAction'` ya presente para el widget del `form`.
    El banner se renderiza con `CommitRejectionBanner` justo debajo del widget.

  Tras la tarea, los criterios 1–4 de la spec quedan cubiertos por el widget aislado (tests de T5
  con `onCommitNodeUpdate` mockeado) y por la integración end-to-end del pipeline real; el 8 y 9
  quedan cubiertos por su bloque end-to-end análogo al de T4 para `heading`/`tabs`.
- **Fuera de alcance**:
  - Cambios en el schema Zod ni en la validación (`props.columns` sigue admitiendo entero fijo o
    mapa responsive, como hoy; el widget solo añade/quita la clave).
  - Cualquier control para "simplificar" un mapa a entero o preservar el mapa previo al alternar
    modos.
  - Widget de nivel de `heading` o de orientación de `tabs` — cubiertos en T2/T3/T4.
  - Modificar `buildDefaultNodeInstance('container')` — sigue creando el `container` sin `columns`
    (modo "Columnas" por defecto), mismo comportamiento actual.
  - Introducir un `x-widget` nuevo para `container`: el widget se monta fuera del schema porque
    escribe el nodo completo, mismo criterio que `LinkContentModePropertyField`.
- **Dependencias**: T1 (componente presentacional compartido). No depende directamente de T2/T3/T4
  (las tres tareas son independientes), pero se ordena tras T4 para cerrar los tres usos de la
  spec en el orden natural del plan y para dejar el fichero end-to-end de commit-feedback tocado
  una única vez por task (T4 lo amplía primero para `heading`/`tabs`; T5 lo amplía después para
  `container`).
- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/container-columns-mode-property-field.tsx`
      (nuevo).
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar: bloque
      condicionado a `node.type === 'container'`, clave `'containerColumnsMode'` en
      `PendingRejectionKey` y en `recordCommitResult`, wiring del banner de rechazo).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-container-columns-mode.test.tsx`
      (nuevo): tests del widget aislado con un `onCommitNodeUpdate` mockeado que captura la
      mutación completa emitida.
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliar): integración del
      widget en el panel (se monta solo para `node.type === 'container'`, su commit va por el
      mismo `onCommitNodeUpdate` que el resto de subsecciones).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliar):
      bloque end-to-end sobre el pipeline real para los criterios 1–4, 8 y 9 aplicados a
      `container`.
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`.
    - `ai-workflow/docs/app-features/nodes/container.md`.
- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-container-columns-mode.test.tsx`
      (nuevo).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
  - **Comportamiento cubierto** (widget aislado, fichero nuevo):
    - Un `container` sin `props.columns` activa "Columnas" (verificable por `aria-checked` /
      `aria-selected` sobre el segmento correspondiente).
    - Un `container` con `props.columns = 3` (entero) activa "Grid".
    - Un `container` con `props.columns = { base: 2, md: 4 }` (mapa responsive) activa "Grid".
    - Pulsar "Grid" sobre un `container` sin `columns` emite `onChange(node')` con
      `node'.props.columns = 2` y el resto de props (incluido `direction: 'row'` si estaba)
      intacto. Ningún otro campo del nodo cambia (`children`, `id`, `visibility`, `layout`, etc.).
    - Pulsar "Columnas" sobre un `container` con `columns = 4` emite `onChange(node')` sin la
      clave `columns` en `props`; `direction`, `gap`, `variant` y demás claves del `props` original
      se preservan.
    - Pulsar "Columnas" sobre un `container` con `columns = { base: 2, md: 4 }` emite
      `onChange(node')` sin la clave `columns`; el resto de `props` intacto.
    - Caso límite spec: partiendo de `columns = { base: 2, md: 4 }`, aplicar "Grid → Columnas →
      Grid" secuencialmente resulta en un nodo final con `columns = 2` (entero), no con el mapa
      original — verificable comparando el nodo emitido en el segundo `onChange`.
    - Pulsar el segmento ya activo no dispara `onChange` (idempotencia).
    - Cada segmento renderiza un `<svg>` (icono Lucide).
    - Regresión: un `container` que declare `direction: 'row'` y sin `columns` sigue mostrando
      "Columnas" activo (el widget no considera `direction` en absoluto).
  - **Comportamiento cubierto** (integración panel, ampliación):
    - El widget "Modo" solo se renderiza cuando el nodo seleccionado es un `container`; para
      `form`, `heading`, `tabs`, `link`, `button` (y una selección representativa del resto del
      catálogo) el panel no monta la subsección.
    - Cuando el widget está montado, aparece por encima del loop `SUBSECTIONS.map(...)` (en la
      misma posición relativa que el bloque de `link`).
    - Un cambio de modo viaja por el mismo `onCommitNodeUpdate(path, patchFn)` que el resto del
      panel: el mock captura una llamada con `path` correcto y `patchFn` que, aplicado al nodo,
      devuelve la reconstrucción esperada.
    - Cuando el modo es "Grid", el campo `columns` sigue apareciendo dentro de la subsección
      `Props` y sigue editable con los controles genéricos (regresión de comportamiento del
      dispatcher).
    - Cuando el modo es "Columnas", el campo `columns` **no** aparece en la subsección `Props`
      (porque la clave no está en `props`, el dispatcher no lo dibuja).
    - Regresión: la matriz existente de subsecciones y `pendingRejections` para el resto de nodos
      sigue funcionando sin cambios.
  - **Comportamiento cubierto** (end-to-end commit-feedback, ampliación):
    - Aceptación 1: seleccionar un `container` sin `columns` en el config real → widget con
      "Columnas" activo.
    - Aceptación 2: seleccionar un `container` con `columns` en el config real (entero o
      responsive) → widget con "Grid" activo.
    - Aceptación 3: pulsar "Grid" recorre el pipeline real y el config resultante contiene
      `props.columns = 2`; el campo `columns` aparece en la subsección `Props`.
    - Aceptación 4: pulsar "Columnas" recorre el pipeline real y el config resultante no contiene
      la clave `columns`; `direction`, si existía, sigue igual. El campo `columns` desaparece de la
      subsección `Props`.
    - Aceptación 8 (aplicada a `container`): simular un rechazo puntual del commit desde el
      pipeline (mismo patrón que T4) hace aparecer el aviso `role="alert"` debajo del widget con
      `error.code`/`error.message`; el segmento visualmente activo se mantiene en el estado
      intentado (verificable por `aria-checked`); un commit válido posterior o el cambio de nodo
      seleccionado limpia el aviso.
    - Aceptación 9: no regresión de Monaco ni del resto del panel al usar el widget de
      `container`; reutilizar las aserciones ya establecidas en el fichero.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-container-columns-mode.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - **Restricciones**:
    - Reusar el mismo shape de mock de `onCommitNodeUpdate` y los helpers de fixture de nodo ya
      usados por `layout-canvas-properties-panel.test.tsx` y por
      `layout-canvas-property-field-choice-items.test.tsx`; no crear un harness paralelo.
    - No mockear `SegmentedTogglePropertyField`: la integración debe ejercer el componente
      compartido para probar el contrato observable (activo, `onChange`) end-to-end.
    - Usar el pipeline de commit real en el bloque end-to-end, como en T4.
- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nueva subsección o extensión
    para documentar el widget "Modo" del `container`, su detección por presencia de `columns` y su
    reconstrucción (Grid/Columnas).
  - `ai-workflow/docs/app-features/nodes/container.md`: nota sobre el mecanismo de activación del
    modo Grid vs Columnas desde el editor visual (junto al resto de comportamiento ya documentado
    de `props.columns`).
- **Criterios de finalización**:
  - Los criterios de aceptación 1–4 (más 8 y 9 aplicados a `container`) están cubiertos por tests
    aislados y por el bloque end-to-end sobre el pipeline real.
- **Cierre de implementación**:
  - Nuevo componente vive en
    `src/dev-runtime/layout-canvas/property-fields/container-columns-mode-property-field.tsx`.
  - Integración en `layout-canvas-properties-panel.tsx` monta el bloque solo para
    `node.type === 'container'`.
  - Los tres ficheros de test (nuevo + dos ampliaciones) están en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).
