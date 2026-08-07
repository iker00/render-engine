# Plan — 0129 dev-editor-icon-widget

Contrato de ejecución para la feature. Alcance: un widget reutilizable de búsqueda y selección de
iconos Lucide (grid con preview) que sustituye el input de texto libre del campo `icon` en las dos
superficies del editor visual: el panel de propiedades de `Layout` (seis nodos: `button`,
`heading`, `paragraph`, `link`, `stat`, `input`) y `ShellConfigPanel` (campo `icon` de `menuItem`
raíz y `children` en `shell.header.menu`, y de `sidebarItem` a cualquier profundidad en
`shell.sidebar.items`).

La fuente única de verdad de la spec vive en [[spec.md]]. Esta feature no requiere `design.md`
(ver [[status.yaml]]).

Todas las tareas comparten estos anclajes técnicos:

- **Registro de widgets dedicados por schema**: `WIDGET_REGISTRY` en
  `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`. Es el mismo hook
  `x-widget` que ya usan `choice-items` (feature `0108`), `layout-span` (feature `0127`) y
  `heading-level`/`tabs-orientation` (feature `0128`). No introducir un segundo mecanismo de
  registro. La nueva entrada es `x-widget: 'icon'`.
- **Adaptador de schema en el panel de `Layout`**: nuevo helper `resolveIconPropsSchema` en
  `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`, con el mismo shape que
  `resolveHeadingPropsSchema` (feature `0128`), pero **genérico por convención de campo**: si el
  `props` schema del nodo declara `properties.icon` (con `type: 'string'`), sustituye ese
  sub-schema por `{ 'x-widget': 'icon' }`. La convención cubre los seis nodos ya identificados en la
  spec y cualquier futuro nodo que declare `props.icon: z.string().optional()` sin necesidad de
  registrar nuevas ramas en el panel — resuelve la pregunta abierta 1 de la spec en favor de
  "detección por convención de nombre de campo".
- **Integración en `ShellConfigPanel`**: los campos `icon` de `MenuItemFieldsEditor`
  (`src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx`) y de
  `SidebarItemFieldsEditor` (`src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx`)
  hoy consumen `TextPropertyField` directamente. La integración sustituye esa importación por
  `IconPickerPropertyField` directamente (mismo criterio que ya siguen esos editores con
  `TextPropertyField`, `EnumPropertyField`, `DiscriminatedUnionPropertyField`, `PropertyFieldDispatcher`),
  **sin** pasar por `WIDGET_REGISTRY`: fuera del canvas no hay dispatcher genérico que necesite el
  sentinel. La pieza React reutilizable es la misma en ambas superficies (spec, requisito no
  funcional 1); el hook `x-widget` es la vía de conexión solo dentro del canvas.
- **Catálogo de iconos válidos**: `lucide-react` expone un registro propio deduplicado y
  canónico en su export `icons` (`LucideIcons.icons`, 1713 claves al momento de planificar T4),
  con una clave por icono real en formato PascalCase; cada clave coincide 1:1 con su export
  PascalCase directo del mismo paquete. El catálogo del widget se deriva de
  `Object.keys(LucideIcons.icons)` — **no** de enumerar el namespace completo de `lucide-react`
  (~5876 exports), que además de cada icono real incluye un alias con sufijo `Icon`
  (`Home`/`HomeIcon`) y alias de renombrado legado (`AlertCircle`/`CircleAlert` apuntan al mismo
  componente) que producirían entradas duplicadas del mismo icono visual en los resultados de
  búsqueda (corregido en T4; ver esa tarea). Resolver un nombre concreto a componente sigue
  usando exactamente el mismo criterio que `IconNode` (`src/runtime/nodes/icon-node.tsx`):
  `toPascalCase(name)` contra el export directo del paquete. La derivación del catálogo no
  duplica esa lógica de resolución por nombre; solo cambia de dónde saca la *lista* de nombres
  válidos.
- **Coincidencia de búsqueda**: substring case-insensitive sobre el nombre PascalCase del catálogo
  (`.toLowerCase().includes(query.toLowerCase())`). Sin normalización adicional (kebab-case,
  fonética, etc.).
- **Preview del icono**: cada celda renderiza `<IconNode name={pascalName} />` (el componente ya
  existente del runtime) más el nombre visible al lado o debajo. No introducir una segunda vía de
  render de icono.
- **Feedback por rechazo del commit**: sigue el patrón vigente del panel de `Layout` — el widget
  no gestiona `pendingRejections`; delega en el mecanismo estándar del panel
  (`recordCommitResult` + `CommitRejectionBanner`) igual que hace hoy el resto de la subsección
  `props`. En `ShellConfigPanel`, el editor de fila ya reenvía cada `onChange` al padre y este
  gestiona el aviso `role="alert"` con el mismo patrón que hoy usa para `label`/`href` — el widget
  no añade una gestión propia.
- **Sin cambios de contrato**: `icon` sigue siendo `string` opcional en todos los sitios
  (verificado en `src/config/runtime-config-zod.ts`, líneas 249, 288, 471, 512, 686, 749, 968,
  1040 al momento de la planificación). Ninguna tarea toca `src/config/`,
  `validateRuntimeConfig` ni el runtime de producción.
- **Sin coste en el bundle de producción**: el widget vive en
  `src/dev-runtime/layout-canvas/property-fields/`, ya excluido del bundle de producción salvo
  activación explícita con `data-enable-dev-mode` (spec, requisito no funcional).

Los tests de la fase de implementación deben cumplir además las reglas globales de
`ai-workflow/standards/testing-rules.md` (umbral mínimo global de cobertura del 80% sobre `src/`,
tests centrados en comportamiento observable, sin snapshots amplios ni mocks que oculten el
comportamiento real).

## Orden y dependencias

T1 → T2 → T3 → T4 → T5. Cada tarea deja el árbol de la app compilando y con `pnpm test` en verde
antes de la siguiente. T2 depende de T1 (componente presentacional compartido); T3 depende de T1
(no de T2: la conexión en Shell es independiente del `WIDGET_REGISTRY`, pero se ordena tras T2
para cerrar la superficie de canvas antes de tocar la de Shell y para dejar el fichero end-to-end
de Shell tocado una única vez por task).

T1, T2 y T3 ya están implementadas (`completed_task_ids` en `status.yaml`). T4 es una tarea
añadida después del cierre inicial de la feature, motivada por un hallazgo posterior: el
catálogo derivado en T1 enumeraba todo el namespace de `lucide-react` (~5876 exports, con
duplicados por alias) en vez del registro canónico deduplicado `LucideIcons.icons` (1713
entradas), y ninguna de las dos cardinalidades tenía paginación — la cuadrícula completa se
montaba de golpe en el DOM. T4 depende de T1 (modifica su componente y su fichero de test) y del
helper compartido `lucide-react-mock.ts` (también de T1, usado por T2/T3 sin cambios propios).
T4 no reabre T2 ni T3: el contrato público del widget (`{ label, value, onChange }`) no cambia,
así que ninguna integración necesita tocarse.

T5 es una segunda tarea añadida tras el cierre inicial, motivada por una petición de UX: la
cuadrícula debe dejar de estar siempre visible y mostrarse solo al enfocar/pinchar el input de
búsqueda, cerrándose al elegir un icono, con `Escape` o al hacer clic fuera. T5 depende de T1/T4
(modifica el mismo componente y su fichero de test) y, a diferencia de T4, sí reabre los ficheros
de test end-to-end de T2 y T3 (no su código): esas suites montan el widget real e interactúan con
celdas de la cuadrícula asumiendo que ya está visible, suposición que T5 rompe. El contrato
público `{ label, value, onChange }` tampoco cambia en T5, así que ningún fichero de código de
T2/T3 requiere edición.

## Siguiente tarea a escoger

`0129-T5` — única tarea pendiente; T1–T4 ya están implementadas.

---

## Task 0129-T1 — Componente presentacional `IconPickerPropertyField`

- **ID**: 0129-T1
- **Estado**: pending
- **Objetivo**: Crear el único componente presentacional compartido por las dos superficies de
  integración: un buscador de iconos Lucide con input de texto, cuadrícula (grid) de celdas de
  resultado con preview de icono y nombre, resaltado de la celda actualmente seleccionada, botón
  explícito de limpieza y navegación por teclado bidireccional. No se registra en
  `WIDGET_REGISTRY` en esta tarea; es la pieza React reutilizable que T2 registrará como
  `x-widget: 'icon'` y que T3 importará directamente en los editores de Shell.

  Contrato del componente:
  - **Ubicación**: `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx`.
  - **Firma pública**: `{ label: string, value: unknown, onChange: (value: unknown) => void }` —
    mismo shape que la firma estándar de `WIDGET_REGISTRY` (`WidgetComponentProps` en
    `property-field-dispatcher.tsx`), para que T2 pueda montarlo por el hook `x-widget` sin
    adaptación. Internamente, el componente trata `value` como `string | undefined` (cualquier otro
    tipo se degrada a `undefined` a nivel visible pero conserva el valor bruto — ver "Valor actual
    no reconocido" abajo).
  - **Catálogo de nombres válidos**: derivado una única vez desde `LucideIcons` (import literal
    `import * as LucideIcons from 'lucide-react'`, mismo patrón que `icon-node.tsx`) recorriendo
    todas las claves del namespace y filtrando por `typeof candidate === 'function' || typeof
    candidate === 'object'`, exactamente la misma comprobación de validez de `IconNode`. El
    resultado es una lista estable de nombres PascalCase (`Array<string>`). Se calcula al importar
    el módulo del componente (constante de módulo), no por render.
  - **Filtrado**: input controlado con estado local `query`. La lista visible es
    `catalog.filter((name) => name.toLowerCase().includes(query.toLowerCase().trim()))`. Con
    `query === ''` la lista visible es el catálogo completo. Sin normalización adicional; sin
    fuzzy matching.
  - **Render de la cuadrícula**: contenedor con `role="grid"` (semántica de rejilla, no listbox
    lineal) más `role="row"` para agrupar celdas por fila y `role="gridcell"` por celda. Cada
    celda contiene el icono renderizado vía `<IconNode name={pascalName} />` y el nombre visible
    (texto). El número de columnas queda como detalle de implementación bajo el requisito no
    funcional de fluidez (spec, casos límite); se recomienda una cifra fija razonable para el
    tamaño típico del panel (por ejemplo 4 columnas) sin abrir configuración externa. Sin
    virtualización explícita en v1 salvo que el resultado sea perceptiblemente lento (ver
    "Restricciones" del sub-bloque de tests).
  - **Resaltado de la celda seleccionada**: la celda cuyo nombre coincide exactamente con `value`
    (comparación por igualdad estricta, respetando mayúsculas/minúsculas) se dibuja con un borde
    propio, análogo al segmento activo del `SegmentedTogglePropertyField` (feature `0128`). Su
    `aria-selected="true"`; el resto de celdas `aria-selected="false"`.
  - **Selección**: click sobre una celda (o `Enter`/`Space` con foco en ella) invoca
    `onChange(pascalName)` una única vez con el nombre PascalCase de la celda. Reelegir la celda
    ya seleccionada no dispara `onChange` (idempotencia, mismo criterio del resto de widgets).
  - **Botón de limpieza**: control explícito visible cuando `typeof value === 'string' && value
    !== ''`; oculto (no renderizado) cuando ya no hay valor. Al pulsarse invoca `onChange(undefined)`.
    Etiqueta accesible clara (por ejemplo "Quitar icono"), consistente con el resto del panel.
  - **Valor actual no reconocido**: si `value` es un string no presente en el catálogo, el
    componente **no** intenta resaltar ninguna celda de la cuadrícula, pero muestra el valor
    actual encima o al lado del input de búsqueda como texto plano (sin `<IconNode>`), para que el
    usuario vea qué está fijado hoy. El input de búsqueda arranca vacío para no bloquear la
    exploración. El botón de limpieza sigue disponible con ese valor no reconocido.
  - **Sin resultados**: cuando el filtrado devuelve `[]`, la cuadrícula renderiza sin celdas (o
    equivalentemente, un contenedor vacío). Sin mensaje de error, sin bloqueo del input; el
    usuario puede seguir editando `query`.
  - **Navegación por teclado**: con foco en una celda, `ArrowUp`/`ArrowDown` mueven el foco a la
    celda equivalente en la fila anterior/siguiente respectivamente; `ArrowLeft`/`ArrowRight`
    mueven el foco a la celda anterior/siguiente de la misma fila. `Enter`/`Space` invocan
    `onChange` con el nombre de la celda enfocada. En los bordes de la cuadrícula el foco no se
    mueve (comportamiento de "clamp", no de wraparound). `Tab` sale del grupo hacia el siguiente
    elemento focusable, sin recorrer todas las celdas. El input de búsqueda es un elemento focusable
    independiente; con foco en él, `ArrowDown` mueve el foco a la primera celda visible (patrón
    similar al desplegable de `shell.header.menu`).
  - **Estilo**: utilidades de `Tailwind` locales; no introducir tokens visuales nuevos ni una API
    de theming. Alineado con la línea visual del resto del panel y del widget de segmentos
    (feature `0128`).
  - **Etiqueta accesible del grupo**: el contenedor `role="grid"` expone `aria-label={label}` con
    el `label` recibido (nombre técnico del schema o legend humana según la superficie que lo
    monte). El input de búsqueda tiene su propio `aria-label` fijo (por ejemplo "Buscar icono")
    para no depender del `label` cuando este sea técnico.

- **Fuera de alcance**:
  - Cualquier integración con `WIDGET_REGISTRY`, con `LayoutCanvasPropertiesPanel` o con los
    editores de `ShellConfigPanel` — eso es T2 y T3.
  - Feedback de commit rechazado (`role="alert"`) dentro del componente: el widget no gestiona
    `pendingRejections`; el aviso lo dibuja el panel envolvente igual que el resto de subsecciones.
  - Deshacer/rehacer o persistencia de historial de búsquedas.
  - Favoritos, iconos recientes o catálogos alternativos.
  - Virtualización explícita de la cuadrícula (no se descarta si un test de fluidez la exige, pero
    no es requisito de la tarea).
  - Nueva dependencia (`lucide-react` ya está vendorizado).

- **Dependencias**: ninguna previa dentro de esta feature. Depende del paquete `lucide-react` ya
  vendorizado y del componente `IconNode` ya existente en `src/runtime/nodes/icon-node.tsx`.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx` (nuevo:
      exporta `IconPickerPropertyField` y el helper interno de derivación del catálogo si se
      considera útil extraerlo como export nombrado; si no, mantenerlo privado del módulo).
  - Tests:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (nuevo).
    - `src/tests/dev-runtime/lucide-react-mock.ts` (nuevo: helper compartido con el `vi.mock` de
      `lucide-react` y el `CATALOG` canónico reutilizado por T2 y T3; sin tests propios).
  - Documentación afectada (no se edita en esta tarea; ver campo `documentación afectada` de
    cierre): ninguna ficha funcional del producto — el componente no es visible por sí mismo hasta
    su primer uso en T2/T3.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (nuevo).
  - **Comportamiento cubierto**:
    - Sin `query` (input vacío) y sin `value`, la cuadrícula renderiza exactamente una celda con
      `role="gridcell"` por cada icono del catálogo mockeado (ver "Restricciones" para el listado
      exacto; verificable por `screen.getAllByRole('gridcell').length === CATALOG.length` y por la
      presencia de cada nombre esperado). Ninguna celda corresponde al export no-icono declarado
      en el mock (regresión del filtro de validez replicado desde `IconNode`).
    - Teclear `home` (case-insensitive) en el input reduce la lista visible a solo celdas cuyo
      nombre contiene la substring; exactamente una es `Home`, ninguna celda visible es
      `Settings`, `Bell` ni `Users`.
    - Cambiar `query` a un texto que no aparece en ningún nombre del catálogo mockeado (por
      ejemplo `xyz_definitely_none`) resulta en cero celdas visibles (`queryAllByRole('gridcell')`
      devuelve `[]`), sin ningún mensaje `role="alert"` en el DOM y con el input aún editable
      (comprobar que sigue enfocable y aceptando escritura adicional).
    - Con `value = 'Home'`, la celda `Home` renderiza `aria-selected="true"` y el resto de celdas
      visibles renderizan `aria-selected="false"` (verificable comparando el número total de
      celdas contra el número con `aria-selected="false"`, que debe ser `CATALOG.length - 1`).
    - Con `value = 'NombreQueNoExisteEnLucide'`, ninguna celda tiene `aria-selected="true"`, la
      cuadrícula sigue renderizando el catálogo mockeado completo (input vacío), y el texto
      `NombreQueNoExisteEnLucide` es visible en el DOM del componente (aserción por
      `screen.getByText`).
    - Click sobre la celda `Settings` con `value = 'Home'` llama a `onChange` una única vez con
      `'Settings'` (mock `vi.fn()` inspeccionado). Reclick sobre `Settings` con `value = 'Settings'`
      **no** llama a `onChange` (idempotencia).
    - `Enter` con foco sobre la celda `Home` (movido programáticamente vía `fireEvent.focus` o
      helper equivalente ya vigente en `src/tests/dev-runtime/`) llama a `onChange('Home')` una
      única vez cuando el valor previo era distinto.
    - Con `value = 'Home'`, el botón de limpieza es visible (accesible por
      `getByRole('button', { name: /Quitar icono/i })`); pulsarlo llama a `onChange(undefined)`
      una única vez.
    - Con `value = undefined` o `value = ''`, el botón de limpieza **no** está en el DOM
      (`queryByRole('button', { name: /Quitar icono/i })` devuelve `null`).
    - Navegación por teclado sobre la cuadrícula: partiendo con foco en la primera celda,
      `ArrowRight` mueve el foco a la segunda celda de la misma fila; `ArrowDown` mueve el foco a
      la celda equivalente de la fila siguiente. En la primera celda, `ArrowUp` y `ArrowLeft` no
      mueven el foco (clamp).
    - Con foco en el input de búsqueda, `ArrowDown` mueve el foco a la primera celda visible de la
      cuadrícula (verificable por `document.activeElement`).
    - Cada celda visible con nombre `<N>` contiene un `<svg>` (el `<IconNode>` real renderiza un
      SVG desde el mock de `lucide-react`, cuyo componente stub devuelve un `<svg />`); ninguna
      celda muestra `null` en su preview cuando el catálogo se ha filtrado correctamente
      (regresión del wiring con `IconNode`).
    - El contenedor de la cuadrícula expone `role="grid"` con `aria-label={label}` derivado del
      prop `label` (`getByRole('grid', { name: label })`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/icon-picker-property-field.test.tsx`
  - **Restricciones**:
    - **Mockear `lucide-react`** (`vi.mock('lucide-react', ...)`) con un catálogo controlado de
      exports que cubra los nombres usados por los tests de T1, T2 y T3 más al menos un export
      no-icono para verificar el filtro de validez. Motivo: el catálogo real de `lucide-react`
      (~3900 iconos) hace que cada render de la cuadrícula tarde varios segundos, lo que agota el
      timeout global de Vitest (5000ms) — cierra el bloqueo detectado en la primera ejecución de
      T1 (ver `status.yaml`). Catálogo canónico (`CATALOG`) para las tres tareas: `Home`,
      `Settings`, `Bell`, `ChevronRight`, `Users`, `LayoutDashboard`, `Search`, `X`; ocho
      componentes stub que devuelven `<svg data-testid={\`lucide-\${name}\`} />`. Añadir al mismo
      mock un export no-icono (por ejemplo `createLucideIcon: () => null` como función auxiliar, o
      `default: {}` como objeto no-componente) para que los tests verifiquen que el catálogo
      derivado por el componente no lo incluye. Extraer el mock (y `CATALOG`) a un helper
      reutilizable bajo `src/tests/dev-runtime/` (por ejemplo `lucide-react-mock.ts`) para que T2
      y T3 lo importen sin duplicarlo.
    - No mockear `IconNode`: los tests deben ejercer el render real del preview del icono. El
      `IconNode` real resuelve el nombre contra el namespace mockeado de `lucide-react`, por lo
      que su `<svg>` sigue apareciendo en cada celda sin duplicar lógica.
    - Usar `@testing-library/react` y las utilidades ya vigentes en `src/tests/dev-runtime/`; no
      introducir helpers nuevos ni un harness paralelo más allá del helper del mock arriba.
    - Los tests de navegación por teclado deben respetar el patrón de foco ya usado en
      `src/tests/dev-runtime/` (evitar depender de utilidades no vigentes).

- **Documentación afectada** (para una pasada posterior con `update-app-documentation`; no se
  edita aquí):
  - `ai-workflow/docs/test-index.md`: añadir la línea del nuevo fichero de test y una nota sobre
    el helper `lucide-react-mock.ts` (no test propio; reutilizado por T2 y T3).
  - Ninguna ficha de `ai-workflow/docs/app-features/` (el componente no es visible por sí mismo
    hasta T2/T3).

- **Criterios de finalización**:
  - El componente existe, está tipado y tiene su suite de test en verde.
  - Ningún consumidor del proyecto lo importa todavía (se hará desde T2 y T3).

- **Cierre de implementación**:
  - Fichero nuevo creado, importable desde `src/dev-runtime/layout-canvas/property-fields/`.
  - Suite `pnpm test --run src/tests/dev-runtime/icon-picker-property-field.test.tsx` en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0129-T2 — Registro del widget `icon` y adaptador de schema en el panel de `Layout`

- **ID**: 0129-T2
- **Estado**: pending
- **Objetivo**: Conectar `IconPickerPropertyField` al panel de propiedades del editor visual para
  los seis nodos de `Layout` identificados en la spec, mediante:
  1. Nueva entrada en `WIDGET_REGISTRY['icon'] = IconPickerPropertyField` en
     `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx`. Import añadido.
  2. Nuevo helper `resolveIconPropsSchema(propsSchema)` en
     `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx`, análogo a
     `resolveHeadingPropsSchema`, pero genérico por convención de campo: si
     `propsSchema.properties.icon` existe, devuelve una copia con esa clave reemplazada por
     `{ 'x-widget': 'icon' }`; en cualquier otro caso, devuelve `propsSchema` sin cambios.
  3. Wiring en el loop `SUBSECTIONS.map(...)` del panel: aplicar `resolveIconPropsSchema` sobre
     `effectiveSchema` cuando `key === 'props'`, **independientemente del `node.type`**. Es
     compatible con el resto de adaptadores (`resolveTabsPropsSchema`, `resolveHeadingPropsSchema`,
     `resolveContainerPropsSchema`, `resolveChoiceLikePropsSchema`): se puede componer en cadena,
     porque cada uno solo toca una clave distinta del schema.

  Con este cambio, los seis nodos identificados en la spec (`button`, `heading`, `paragraph`,
  `link`, `stat`, `input`, todos con `props.icon: z.string().optional()` en
  `src/config/runtime-config-zod.ts`) editan `icon` mediante el widget, sin listar sus tipos
  explícitamente. Cualquier futuro nodo que declare `props.icon` con el mismo shape hereda el
  widget de forma automática — la spec (riesgo 1) lo permite explícitamente.

  Nota sobre `label` visible: al pasar por el dispatcher, el `label` que llega al widget es el
  nombre técnico del campo (`icon`), tal y como pasa hoy con `text`, `level`, etc. El propio
  widget puede usar ese `label` como `aria-label` sin traducirlo; una traducción a legend humana
  (por ejemplo "Icono") no es objeto de esta tarea salvo que forme parte de la presentación
  interna del componente que T1 decida — en cuyo caso el `label` del dispatcher se pasa como
  `aria-label` del `role="grid"` para preservar la accesibilidad, y el legend visible es
  independiente. Coordinar con la implementación de T1; ambas opciones son compatibles.

- **Fuera de alcance**:
  - Integración en `ShellConfigPanel` (T3).
  - Cambios en el schema Zod ni en la validación previa al render.
  - Cambios en Monaco o en el pipeline `commitCanvasMutation`.
  - Introducir una detección más específica por tipo de nodo (`ICON_NODE_TYPES` explícito): la
    convención de campo cubre el alcance de la spec sin listado.
  - Cambios en `buildDefaultNodeInstance(...)` de cualquiera de los seis nodos.

- **Dependencias**: T1 (`IconPickerPropertyField`).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/property-field-dispatcher.tsx` (modificar:
      añadir import de `IconPickerPropertyField` y entrada `'icon'` en `WIDGET_REGISTRY`).
    - `src/dev-runtime/layout-canvas/layout-canvas-properties-panel.tsx` (modificar: nuevo
      `resolveIconPropsSchema`, wiring en el loop `SUBSECTIONS.map(...)` para `key === 'props'`).
  - Tests:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliar: caso
      nuevo que verifica el resolver del hook `x-widget` para la clave `'icon'`).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliar: los seis nodos
      identificados en la spec renderizan el widget de icono en `Props`, regresión negativa del
      input de texto genérico para `props.icon`, regresión positiva del resto de props no-icono).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (ampliar:
      cobertura end-to-end sobre el pipeline real de al menos un nodo representativo, `button`,
      cubriendo criterios de aceptación 1–3, 5, 6 y 9 en el pipeline real; y del criterio 4
      "valor no reconocido" con `button` con `props.icon = 'NombreQueNoExiste'` en el config
      real).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
      afectados bajo `dev-runtime/`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
      propiedades — el campo `props.icon` de los seis nodos deja de editarse con el input de
      texto genérico y pasa a un widget de búsqueda de iconos con preview.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
  - **Comportamiento cubierto** (dispatcher, ampliación):
    - Un schema `{ 'x-widget': 'icon' }` monta `IconPickerPropertyField` con el `value` y
      `onChange` proporcionados; la lógica del dispatcher no interpreta el schema como string
      genérico (regresión negativa: no aparece `TextPropertyField` — comprobable por la ausencia de
      un input de texto libre con ese `label`).
    - Regresión: un schema sin `x-widget` con `type: 'string'` sigue montando `TextPropertyField`
      (los casos ya cubiertos hoy en el fichero no se rompen; añadir aserción puntual solo si es
      necesaria para la no-regresión).
  - **Comportamiento cubierto** (panel de propiedades, ampliación):
    - Seleccionar un `button` con `props.icon = 'Home'` monta el widget de icono en `Props`
      (`getByRole('grid', { name: /icon/i })` o equivalente, verificable con la selección `Home`
      resaltada), y **no** monta un `TextPropertyField` para `props.icon` (regresión negativa
      explícita).
    - Mismo criterio para los otros cinco nodos: `heading`, `paragraph`, `link`, `stat`, `input`.
      Es aceptable estructurar los tests como una tabla parametrizada (`describe.each` o similar)
      para mantener el fichero manejable — cada iteración monta el nodo con `props.icon` declarado
      y verifica la aparición del widget.
    - Elegir una celda del widget para un `button` con `props.icon = 'Home'` llama a
      `onCommitNodeUpdate` con el `path` del nodo y un updater que fija `props.icon` al nombre
      PascalCase seleccionado, sin tocar el resto de `props` (`text`, `variant`, `action`, etc.).
    - Pulsar el botón de limpieza sobre un `button` con `props.icon = 'Home'` llama a
      `onCommitNodeUpdate` con un updater que fija `props.icon = undefined`, sin tocar el resto de
      `props`.
    - Regresión: el resto de `props` de cada uno de los seis nodos sigue editable con los
      controles genéricos (`text`, `variant`, `level`, `orientation`, etc. según aplique). En
      particular, `heading.props.level` sigue mostrando el widget de segmentos H1–H5 (feature
      `0128`, no interferencia con el nuevo adaptador de `icon`).
    - Regresión: para nodos sin `props.icon` (por ejemplo `container`, `divider`, `form`,
      `select`, un `container` con hijos, un nodo representativo del catálogo), el panel **no**
      monta el widget de icono en ninguna subsección; sus props siguen editándose exactamente
      igual que antes de esta feature.
    - Regresión: si un nodo tiene simultáneamente varios adaptadores aplicables (por ejemplo un
      `heading` con `props.level` y `props.icon`), ambos widgets se montan (uno por clave) sin
      pisarse; ninguna de las otras claves de `props` se pierde en el `properties` del schema
      resultante.
  - **Comportamiento cubierto** (end-to-end commit-feedback, ampliación):
    - Aceptación 1: seleccionar un `button` con `props.icon = 'Home'` en el config real → widget
      con la celda `Home` resaltada y el preview visible.
    - Aceptación 2: teclear una substring en el input del widget filtra la cuadrícula
      (comprobable por la desaparición de celdas cuyo nombre no contenga la substring, sin depender
      de una cardinalidad exacta) — reutilizando la instancia real montada por el pipeline.
    - Aceptación 3: pulsar una celda distinta (`Settings`) recorre el pipeline real
      (`validateRuntimeConfig` + `patchRootKey`) y el config resultante contiene
      `props.icon = 'Settings'`; el resto de `props` (`text`, `variant` si estaba, `action` si
      estaba) se preserva; el buffer de Monaco queda sincronizado.
    - Aceptación 4: seleccionar un `button` con `props.icon = 'NombreQueNoExiste'` en el config
      real muestra el widget sin ninguna celda resaltada; el texto `NombreQueNoExiste` es visible
      en el DOM; el input de búsqueda sigue operativo (verificable escribiendo una substring y
      viendo el filtrado de la cuadrícula).
    - Aceptación 5: pulsar el botón de limpieza sobre el mismo `button` recorre el pipeline real
      y el config resultante ya no contiene la clave `props.icon`; el resto de `props` se
      preserva.
    - Aceptación 6: simular un rechazo puntual del commit — mismo patrón exacto de simulación de
      rechazo ya presente en el fichero (por ejemplo mockeando `patchRootKey` o
      `validateRuntimeConfig` para devolver un rechazo con código/mensaje) — hace aparecer el
      aviso `role="alert"` debajo de la subsección `Props`, con `error.code`/`error.message`; el
      widget conserva visualmente el valor intentado (la celda intentada aparece resaltada, o el
      texto no reconocido intentado se muestra), y el buffer de Monaco queda sin cambios. Un
      commit válido posterior o un cambio de nodo seleccionado limpia el aviso. No hace falta
      inventar un mecanismo nuevo — el patrón de `pendingRejections['props']` ya cubre la
      subsección completa.
    - Aceptación 9: al usar el widget en un `button`, el resto del panel (`Props` no-icono,
      `Layout`, `Visibilidad`, `Estado de consulta`), la sincronización con Monaco tras un commit
      exitoso desde el widget y la exclusión mutua con el panel de Monaco siguen funcionando sin
      regresión — reutilizar las aserciones ya establecidas en el fichero.
    - Caso límite: cambiar de nodo seleccionado con un aviso de commit rechazado pendiente en el
      widget descarta el aviso, mismo comportamiento que el resto de subsecciones del panel
      (cubierto ya por el guard `prevSerializedPath` en el panel; añadir una aserción explícita
      solo si no está cubierta ya para la subsección `props`).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
  - **Restricciones**:
    - Importar y aplicar el mock compartido de `lucide-react` (`src/tests/dev-runtime/lucide-react-mock.ts`,
      creado en T1) en cada uno de los tres ficheros de test afectados. Motivo: los tests del
      panel montan indirectamente `IconPickerPropertyField` (vía dispatcher o pipeline real), que
      renderiza el catálogo completo — sin el mock, cada render satura el timeout global de
      Vitest, mismo bloqueo detectado y documentado en T1. Los nombres usados por los tests
      (`Home`, `Settings`, `Bell`, `NombreQueNoExiste`) están cubiertos por el `CATALOG` canónico
      del helper; `NombreQueNoExiste` queda fuera del catálogo mockeado por definición.
    - No mockear `IconPickerPropertyField`: los tests deben ejercer el componente real (T1) para
      probar el contrato observable end-to-end (grid, celda resaltada, `onChange`).
    - Reutilizar el harness y helpers ya vigentes en cada fichero (fixtures de nodo,
      `DevRuntimeReady` o equivalente, `vi.fn()` planos para `onCommitNodeUpdate` en los tests
      aislados del panel, pipeline real para el fichero de commit-feedback). No introducir un
      harness paralelo más allá de la importación del mock compartido arriba.
    - Cobertura end-to-end del criterio de aceptación 4 (valor no reconocido) hecha con un nombre
      literal fijo (`'NombreQueNoExiste'` o similar); no depender de un shape de error, ni de
      Monaco, ni de estado global.
    - Los tests aislados del panel pueden verificar la selección de celda con `fireEvent.click`
      sobre la celda buscada por su `role="gridcell"` y nombre accesible; no hace falta ejercer
      la navegación por teclado end-to-end en esos ficheros (queda cubierta en T1).

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
    propiedades — aparición del widget de icono para `props.icon` en los nodos que lo declaran,
    con búsqueda case-insensitive, preview de icono, resaltado del valor actual, botón explícito
    de limpieza y navegación por teclado bidireccional. Nota sobre la degradación silenciosa para
    valores no reconocidos (mismo criterio que producción).
  - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
    afectados bajo `dev-runtime/`.
  - Fichas de nodo (`button.md`, `heading-paragraph-list.md`, `link.md`, `stat.md`, `input.md`):
    nota breve — la propiedad `icon` se edita desde el editor visual mediante un widget de
    búsqueda con preview, sin cambios de contrato JSON. Solo si la ficha ya describe cómo se edita
    hoy `props.icon`; si no lo hace, no es obligatorio ampliarla.

- **Criterios de finalización**:
  - Los seis nodos identificados en la spec editan `props.icon` mediante el widget en el panel.
  - Los criterios de aceptación 1–6 y 9 quedan cubiertos por tests aislados y por el bloque
    end-to-end sobre el pipeline real para al menos un nodo representativo.

- **Cierre de implementación**:
  - Los tres ficheros de test afectados están en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0129-T3 — Integración del widget en `ShellConfigPanel` (menú del header y sidebar)

- **ID**: 0129-T3
- **Estado**: pending
- **Objetivo**: Sustituir el `TextPropertyField` que hoy edita el campo `icon` en
  `MenuItemFieldsEditor` (`src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx`, líneas
  82–86 al momento de la planificación) y en `SidebarItemFieldsEditor`
  (`src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx`, líneas 80–84 al momento
  de la planificación) por una llamada a `IconPickerPropertyField` con la misma firma
  `{ label, value, onChange }`, sin más adaptación.

  Concretamente:
  1. En `MenuItemFieldsEditor`, retirar el `TextPropertyField` del campo `icon` y sustituirlo por
     `<IconPickerPropertyField label={`${labelText} — Icono`} value={item.icon} onChange={(value) =>
     onChange({ ...item, icon: typeof value === 'string' && value.length > 0 ? value : undefined })}
     />` (preservando la normalización `undefined` para string vacío ya vigente).
  2. Mismo cambio en `SidebarItemFieldsEditor`.
  3. Import de `IconPickerPropertyField` en ambos módulos.

  Ninguno de los dos editores se registra en `WIDGET_REGISTRY`: la conexión es directa (mismo
  criterio que ya usan con `TextPropertyField`, `EnumPropertyField`,
  `DiscriminatedUnionPropertyField` y `PropertyFieldDispatcher`). El resto del contrato de la
  fila (`label`, mode selector, `href`/`action`/`children`, `visibility`) queda sin cambios.

  El pipeline de commit de `ShellConfigPanel` es el mismo que hoy (`patchRootKey` +
  `validateRuntimeConfig`); el aviso `role="alert"` en caso de rechazo se dibuja ya donde
  corresponde para el conjunto de la fila (no por campo). Sustituir el input por el widget no
  cambia ese comportamiento — el `onChange` sigue emitiendo el mismo shape (`icon` string o
  `undefined`), y el pipeline reacciona igual.

- **Fuera de alcance**:
  - Cambios en el schema Zod ni en la validación previa al render de `shell`.
  - Cambios en `ShellConfigPanel` fuera de los dos editores identificados (por ejemplo, en la
    fila de acciones `shell.header.actions[].icon` — que ya se edita desde el panel de canvas
    genérico para nodos `link`/`button`, cubierta por T2).
  - Cambios en la conexión de arrastre (`shell-config-panel-dnd.tsx`), en el colapso de filas o
    en la gestión de árbol.
  - Introducir un `x-widget` nuevo para las filas de `menuItem`/`sidebarItem`: la conexión es
    directa por import.

- **Dependencias**: T1 (`IconPickerPropertyField`). No depende de T2 (independiente, aunque se
  ordena después para cerrar la superficie de canvas antes de tocar la de Shell).

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/shell-config-panel/menu-item-fields-editor.tsx` (modificar: retirar
      `TextPropertyField` de `icon`, importar y usar `IconPickerPropertyField`).
    - `src/dev-runtime/shell-config-panel/sidebar-item-fields-editor.tsx` (modificar: análogo).
  - Tests:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliar: el campo `icon` de un
      `menuItem` raíz y de un `menuItemChild` se edita mediante el widget de icono; regresión
      negativa del input de texto genérico para `icon`).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliar: el campo `icon` de un
      `sidebarItem` raíz y de un `sidebarItem` anidado a profundidad ≥ 2 se edita mediante el
      widget; regresión negativa del input de texto genérico para `icon`).
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliar: al menos un caso end-to-end
      contra el pipeline real que confirma que elegir un icono en un `menuItem` y en un
      `sidebarItem` recorre `validateRuntimeConfig + patchRootKey` y persiste el nombre PascalCase
      en el config; y que un valor no reconocido preexistente se muestra sin preview y con la
      cuadrícula editable, sin bloquear el resto del panel).
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
      afectados bajo `dev-runtime/`.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Shell (dominio de
      configuración)" — los campos `icon` de `menuItem` y `sidebarItem` usan el mismo widget de
      búsqueda del panel de propiedades del canvas, con la misma UX (grid, preview, resaltado,
      limpieza, teclado).
    - `ai-workflow/docs/app-features/shell/header.md`: nota breve — el campo `icon` de
      `menuItem` (raíz y `children`) se edita mediante widget de búsqueda con preview en el
      editor visual, sin cambios de contrato.
    - `ai-workflow/docs/app-features/shell/sidebar.md`: análogo para `sidebarItem` a cualquier
      profundidad.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto** (menú del header, ampliación):
    - Expandir la fila de un `menuItem` raíz con `icon = 'Home'` muestra el widget de icono
      (`getByRole('grid')` con la celda `Home` resaltada), y **no** muestra un `TextPropertyField`
      para `icon` (regresión negativa: no hay un input de texto etiquetado como
      `/Elemento de menú 1 — Icono/i`).
    - Expandir la fila de un `menuItemChild` (dentro de un padre en modo "Con desplegable") con
      `icon = 'ChevronRight'` muestra el widget con la celda correspondiente resaltada, mismo
      criterio (`0122-T5` y `0125-T5` cubren la creación del hijo; aquí solo interesa que el
      widget aparezca en la fila abierta).
    - Elegir la celda `Settings` sobre un `menuItem` con `icon = 'Home'` invoca el `onChange` del
      editor con el nuevo `menuItem` que trae `icon = 'Settings'` y el resto de campos
      (`label`, mode, `href`/`action`/`children`, `visibility`) intacto.
    - Pulsar el botón de limpieza sobre un `menuItem` con `icon = 'Home'` invoca `onChange` con
      `icon: undefined` (mismo criterio de normalización que hoy sigue el editor para string
      vacío).
    - Regresión: el aviso `role="alert"` que aparece si el pipeline rechaza un commit sigue
      apareciendo por fila (comportamiento ya vigente); no se introduce un aviso adicional dentro
      del widget.
    - Regresión: el resto de la fila (`label`, mode selector, `href`, `action`, `visibility`) se
      sigue editando con los controles ya vigentes.
  - **Comportamiento cubierto** (sidebar, ampliación):
    - Expandir la fila de un `sidebarItem` raíz con `icon = 'LayoutDashboard'` muestra el widget
      con la celda correspondiente resaltada, y **no** muestra un `TextPropertyField` para
      `icon`.
    - Expandir la fila de un `sidebarItem` anidado a profundidad al menos 2 (dentro de
      `children` → `children`) con `icon = 'Users'` muestra el widget con la celda correspondiente
      resaltada — verifica que la sustitución aplica a cualquier profundidad, mismo alcance de
      recursión que la spec exige para el sidebar.
    - Mismo criterio de selección/limpieza que la variante del menú.
    - Regresión: el modo rail (`defaultCollapsed`), el fallback de glifo por inicial de `label`
      sin `icon` y el resto del comportamiento del sidebar en producción siguen funcionando sin
      cambios (no requiere test end-to-end aquí; queda cubierto por la suite existente del
      sidebar).
  - **Comportamiento cubierto** (`shell-config-panel.test.tsx`, ampliación):
    - Elegir la celda `Bell` sobre un `menuItem` con `icon = 'Home'` recorre el pipeline real
      (`validateRuntimeConfig + patchRootKey`) y el config resultante contiene
      `shell.header.menu[i].icon = 'Bell'`, sin tocar el resto de campos del menú ni el resto de
      claves de `shell` (analogía al patrón ya vigente en el fichero para `label`/`title`).
    - Mismo criterio para un `sidebarItem` con `icon = 'LayoutDashboard'` → `icon = 'Settings'`;
      el config resultante contiene `shell.sidebar.items[i].icon = 'Settings'`.
    - Un `menuItem` preexistente con `icon = 'NombreQueNoExiste'` muestra el widget sin ninguna
      celda resaltada; el texto no reconocido es visible en el DOM; el resto del panel sigue
      operativo (el editor de fila sigue mostrando el resto de campos y el pipeline sigue
      funcionando para otros cambios en la misma fila, por ejemplo `label`).
    - Regresión: el alcance del commit sigue tocando solo la clave `shell`, sin tocar `layout`,
      `api`, `initialPage` ni `tokens` (aserción análoga a las ya presentes en el fichero).
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
  - **Restricciones**:
    - Importar y aplicar el mock compartido de `lucide-react` (`src/tests/dev-runtime/lucide-react-mock.ts`,
      creado en T1) en cada uno de los tres ficheros de test afectados. Motivo: idéntico al de T2
      — sin el mock, cada render del widget en la fila de `menuItem`/`sidebarItem` satura el
      timeout global de Vitest. Los nombres usados en los tests (`Home`, `Settings`, `Bell`,
      `ChevronRight`, `LayoutDashboard`, `Users`, `NombreQueNoExiste`) están cubiertos por el
      `CATALOG` canónico del helper.
    - No mockear `IconPickerPropertyField`: los tests deben ejercer el componente real
      (integración observable end-to-end).
    - Reutilizar los harness ya vigentes en cada fichero (fixture aislado para las listas,
      pipeline real para `shell-config-panel.test.tsx`); no introducir un harness paralelo más
      allá de la importación del mock compartido arriba.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección "Shell (dominio de
    configuración)".
  - `ai-workflow/docs/app-features/shell/header.md`: nota breve sobre la edición de `icon` de
    `menuItem` en el editor visual.
  - `ai-workflow/docs/app-features/shell/sidebar.md`: nota breve análoga para `sidebarItem`.
  - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los tres ficheros de test
    afectados bajo `dev-runtime/`.

- **Criterios de finalización**:
  - Los campos `icon` de `menuItem` (raíz y `children`) y de `sidebarItem` (a cualquier
    profundidad) se editan mediante el widget en `ShellConfigPanel`.
  - Los criterios de aceptación 7 y 8 quedan cubiertos por tests aislados y por el bloque
    end-to-end sobre el pipeline real.
  - Cierra el conjunto de criterios de aceptación de la spec (1–10) considerando lo cubierto en
    T2 (1–6, 9) y en esta tarea (7, 8, 10 por regresión no introducida).

- **Cierre de implementación**:
  - Los tres ficheros de test afectados están en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0129-T4 — Catálogo deduplicado (`LucideIcons.icons`) y paginación de la cuadrícula

- **ID**: 0129-T4
- **Estado**: pending
- **Objetivo**: Corregir la derivación del catálogo de `IconPickerPropertyField` para usar el
  registro canónico y deduplicado que el propio `lucide-react` expone (`LucideIcons.icons`, 1713
  claves al momento de planificar esta tarea) en vez de enumerar todo su namespace (~5876
  exports), y añadir paginación sobre la cuadrícula de resultados para no montar de golpe en el
  DOM cientos o miles de celdas.

  Ambos cambios viven en el mismo componente y se implementan juntos porque comparten motivo
  (volumen de celdas renderizadas) y porque el catálogo correcto (1713, sin alias duplicados) es
  el que la paginación debe paginar — implementar la paginación primero sobre el catálogo viejo
  (con duplicados `Home`/`HomeIcon`) sería trabajo desechable.

  **Parte 1 — Catálogo deduplicado**:
  - En `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx`, sustituir
    la derivación actual:
    ```
    const ICON_CATALOG: readonly string[] = Object.keys(LucideIcons).filter((name) =>
      isIconCatalogEntry(name, (LucideIcons as Record<string, unknown>)[name]),
    )
    ```
    por `Object.keys((LucideIcons as { icons: Record<string, unknown> }).icons)` (o el cast
    equivalente que el tipado de `lucide-react` permita sin `any`).
  - Eliminar la función `isIconCatalogEntry` y su comentario: deja de usarse, porque cada clave de
    `LucideIcons.icons` ya es un nombre PascalCase válido y no-duplicado por construcción del
    propio paquete (verificado al planificar esta tarea: las 1713 claves de `icons` coinciden 1:1
    con un export PascalCase directo del paquete).
  - Actualizar el comentario que documenta `ICON_CATALOG` para explicar la nueva fuente
    (`LucideIcons.icons`) y por qué evita duplicados, en vez de la explicación previa sobre el
    filtro `isIconCatalogEntry`.
  - Sin cambios en cómo se resuelve un nombre concreto a componente: `IconNode` (usado para el
    preview de cada celda) sigue resolviendo contra el namespace completo del paquete, no contra
    `.icons` — solo cambia de dónde sale la *lista* de nombres que arma la cuadrícula.

  **Parte 2 — Paginación**:
  - Nueva constante interna exportada `export const ICON_PICKER_PAGE_SIZE = 60` (o el valor que
    el implementador considere razonable como cifra fija; el número exacto es detalle de
    implementación bajo el requisito de fluidez ya fijado en la spec — exportarla como constante
    con nombre estable es lo que importa, para que los tests puedan referenciarla en vez de
    hardcodear el número).
  - Nuevo estado local `page` (entero, empieza en `0`), reseteado a `0` cada vez que `query`
    cambia (un resultado de búsqueda distinto siempre empieza en su primera página).
  - `visibleCatalog` (ya existente, resultado del filtro por `query`) se pagina antes de
    construir `rows`: `pageCatalog = visibleCatalog.slice(page * ICON_PICKER_PAGE_SIZE, (page + 1)
    * ICON_PICKER_PAGE_SIZE)`. `rows`/la cuadrícula/la navegación por teclado/el cálculo de
    `tabbableIndex` pasan a operar sobre `pageCatalog`, no sobre `visibleCatalog` completo.
  - `totalPages = Math.max(1, Math.ceil(visibleCatalog.length / ICON_PICKER_PAGE_SIZE))`.
  - Controles "Anterior"/"Siguiente" (misma terminología literal que
    `src/runtime/nodes/collection-pagination-controls.tsx`, variante `previousNext`, precedente
    de estilo/rotulado ya vigente en el proyecto para paginación), deshabilitados en los bordes
    (`disabled`, no ocultos, mismo criterio que ese precedente) — "Anterior" deshabilitado en
    `page === 0`, "Siguiente" deshabilitado en `page === totalPages - 1`. Entre ambos botones, un
    texto plano "Página {page + 1} de {totalPages}" (sin rol `alert`/`status`, mismo nivel de
    tratamiento que el resto del panel).
  - Los controles de paginación **solo se renderizan cuando `totalPages > 1`** — mismo criterio
    que el precedente (`paginationPage.totalPages > 1` en `table-layout-node.tsx` y
    `repeater-layout-node.tsx`): con un único resultado de página, no aparece ningún control.
  - Cambiar de página no dispara `onChange`; es puramente navegación local del widget.
  - Navegación por teclado (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, T1): sigue operando
    únicamente dentro de `pageCatalog` (la página visible), con el mismo comportamiento de clamp
    en los bordes ya vigente — **no** avanza de página automáticamente al llegar al borde. Cambiar
    de página es una acción explícita del usuario sobre los botones "Anterior"/"Siguiente", fuera
    del contrato de teclado de la cuadrícula ya fijado en T1.
  - Selección: elegir una celda de la página visible sigue invocando `onChange` exactamente igual
    que hoy (T1), sin cambios de contrato. El widget **no** salta automáticamente a la página que
    contiene el valor actualmente seleccionado al montarse o al cambiar `value` desde fuera — la
    celda seleccionada solo se resalta cuando su página está siendo mostrada, mismo criterio de
    "el widget no reimplementa lo que el usuario no ha pedido" ya aplicado en T1 (que tampoco
    hacía scroll automático hasta la celda seleccionada).

- **Fuera de alcance**:
  - Búsqueda por categoría, tags o metadata adicional de Lucide (ya fuera de alcance en la spec;
    esta tarea no reabre esa pregunta ni introduce `lucide-static` ni ninguna dependencia nueva —
    la corrección usa exclusivamente lo que `lucide-react`, ya vendorizado, expone).
  - Salto automático a la página que contiene el valor seleccionado.
  - Paginación accesible por teclado dentro de la cuadrícula (flechas cambiando de página): la
    navegación de flechas queda acotada a la página visible, como se describe arriba.
  - Cambiar la firma pública `{ label, value, onChange }` del componente o su integración en T2/T3
    — ambas siguen intactas, sin tocar `property-field-dispatcher.tsx`,
    `layout-canvas-properties-panel.tsx`, `menu-item-fields-editor.tsx` ni
    `sidebar-item-fields-editor.tsx`.
  - Virtualización de filas (windowing): la paginación por sí sola basta para acotar el número de
    nodos DOM montados a la vez; no se combina con una librería de virtualización.
  - Cambiar el número de columnas (`GRID_COLUMNS`) o el criterio de resaltado/selección ya fijado
    en T1.

- **Dependencias**: T1 (modifica su componente, su fichero de test y el helper de mock
  compartido). No depende de T2 ni T3 ni las reabre — su contrato público no cambia.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx` (modificar:
      derivación de `ICON_CATALOG` desde `LucideIcons.icons`, eliminación de
      `isIconCatalogEntry`, estado `page`, `ICON_PICKER_PAGE_SIZE`, paginación de `visibleCatalog`
      antes de construir `rows`, controles "Anterior"/"Siguiente" condicionados a
      `totalPages > 1`).
  - Tests:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliar: casos nuevos de
      dedup y de paginación; ver sub-bloque `tests`).
    - `src/tests/dev-runtime/lucide-react-mock.ts` (modificar: `createLucideReactMock` gana un
      segundo parámetro opcional `iconNames: readonly string[] = CATALOG` que sustituye la base
      usada tanto para los exports PascalCase directos como para el nuevo export `icons` del
      mock; todo llamador existente que solo pasa `extraIconNames` como primer argumento posicional
      sigue funcionando sin cambios, con `icons` poblado por defecto desde `CATALOG` — ninguno de
      los once ficheros de test que invocan `createLucideReactMock(...)` en
      `src/tests/dev-runtime/` requiere edición propia; ver la lista completa en "Comandos
      durante la implementación").
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliar la línea de `icon-picker-property-field.test.tsx`
      y de `lucide-react-mock.ts` (helper, sin test propio) para reflejar la ampliación.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
      propiedades — nota sobre la paginación de la cuadrícula de resultados cuando el catálogo
      filtrado excede una página, con controles "Anterior"/"Siguiente".

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliación).
    - `src/tests/dev-runtime/lucide-react-mock.ts` (modificación del helper; sin tests propios,
      cubierto indirectamente por los tests que lo consumen).
  - **Comportamiento cubierto**:
    - **Dedup (regresión del bug real)**: con un mock de `lucide-react` cuyo namespace expone
      `Home` y `HomeIcon` como dos exports PascalCase distintos (ambos función/componente válido)
      pero cuyo `icons` solo contiene la clave `Home` (mismo criterio que el paquete real: `icons`
      es el registro canónico, sin el alias `Icon`-suffixed) — construible generalizando
      `createLucideReactMock` como se describe en "Impacto esperado en archivos" — el catálogo
      renderizado por el widget contiene una celda `Home` y **no** contiene ninguna celda
      `HomeIcon`, a pesar de que `HomeIcon` sería un export válido si el widget siguiera
      enumerando el namespace completo (prueba directa de que la derivación lee `icons`, no el
      namespace).
    - Con el mock por defecto (`CATALOG`, 8 nombres, sin cambios respecto a T1/T2/T3), el
      catálogo sin `query` sigue mostrando exactamente `CATALOG.length` celdas — regresión
      explícita de que la generalización de `createLucideReactMock` no altera el comportamiento
      ya cubierto por los tests existentes del propio fichero (T1) ni por T2/T3 (no reabiertos,
      pero su suposición de conteo depende de este comportamiento sin cambios).
    - **Paginación**: usando un catálogo mockeado sintético con más de una página — generado
      programáticamente con un tamaño exacto de `ICON_PICKER_PAGE_SIZE * 2 + 5` nombres únicos
      (por ejemplo `MockIcon000`, `MockIcon001`, ... — no nombres reales de Lucide, para no
      depender de ningún nombre real ni de su ortografía), pasado como el nuevo parámetro
      `iconNames` de `createLucideReactMock` — sin `query`:
      - La cuadrícula muestra exactamente `ICON_PICKER_PAGE_SIZE` celdas (la primera página), no
        el catálogo sintético completo.
      - Aparecen los controles "Anterior" (deshabilitado, `disabled`) y "Siguiente" (habilitado),
        y el texto "Página 1 de 3".
      - Pulsar "Siguiente" muestra la segunda página: exactamente `ICON_PICKER_PAGE_SIZE` celdas
        distintas de las de la primera página (verificable comparando el conjunto de nombres
        visibles antes/después), "Anterior" pasa a habilitado, texto "Página 2 de 3".
      - Pulsar "Siguiente" de nuevo muestra la tercera y última página con el resto (`5`) de
        celdas; "Siguiente" queda deshabilitado.
      - Pulsar "Anterior" desde la última página retrocede una página, mismo criterio simétrico.
    - **Reseteo de página al buscar**: partiendo de la segunda página del catálogo sintético
      (multi-página), teclear en el input de búsqueda un `query` que siga devolviendo más de una
      página de resultados hace que la cuadrícula muestre la **primera** página del nuevo
      resultado filtrado (no la segunda página del resultado anterior), y el texto vuelve a
      "Página 1 de N".
    - **Sin controles con una sola página**: con el catálogo por defecto de 8 nombres (o con un
      `query` que reduzca el catálogo sintético a menos de `ICON_PICKER_PAGE_SIZE` resultados),
      **no** aparece ningún botón "Anterior"/"Siguiente" ni el texto "Página X de Y" en el DOM
      (`queryByRole('button', { name: /Anterior|Siguiente/i })` devuelve `null`).
    - **Regresión de navegación por teclado**: con el catálogo sintético multi-página en su
      primera página, `ArrowRight`/`ArrowDown` repetidos hasta el borde de la página visible no
      cambian de página (el foco se clampa dentro de `pageCatalog`, mismo criterio de T1); pulsar
      "Siguiente" sigue siendo la única forma de avanzar de página.
    - **Regresión de selección**: seleccionar una celda de la página visible sigue invocando
      `onChange` con el nombre esperado, sin cambios respecto al contrato ya probado en T1.
    - Todos los casos de comportamiento ya cubiertos en el bloque `tests` de T1 (sin resultados,
      valor no reconocido, botón de limpieza, idempotencia, `role="grid"` con `aria-label`) siguen
      pasando sin modificación de sus aserciones — no se listan de nuevo aquí, solo se confirma
      que la suite completa del fichero (T1 + esta ampliación) queda en verde.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/icon-picker-property-field.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
    - (los últimos diez comandos son de regresión: ninguno de esos ficheros se modifica en esta
      tarea, pero los once —contando `icon-picker-property-field.test.tsx`— son la lista completa
      de ficheros bajo `src/tests/dev-runtime/` que invocan `createLucideReactMock(...)`; todos
      consumen el `CATALOG` por defecto y deben seguir en verde sin cambios propios tras
      generalizar el helper)
  - **Restricciones**:
    - No introducir `lucide-static` ni ninguna otra dependencia nueva: la corrección usa
      exclusivamente el export `icons` ya presente en `lucide-react`.
    - El catálogo sintético multi-página debe generarse programáticamente dentro del test (no
      pegar cientos de literales a mano) y sus nombres no deben coincidir con ningún nombre real
      de Lucide usado en `CATALOG` u `OTHER_MODULE_ICON_NAMES`, para evitar colisiones accidentales.
    - No modificar `CATALOG` ni `OTHER_MODULE_ICON_NAMES` en `lucide-react-mock.ts`: son la base
      compartida por T1/T2/T3 y por los diez ficheros de regresión listados en "Comandos durante
      la implementación"; el catálogo sintético multi-página vive solo como argumento local
      pasado al nuevo parámetro `iconNames` dentro del test de paginación, no como una nueva
      constante exportada del helper.
    - Reutilizar `@testing-library/react` y los helpers ya vigentes del fichero; no introducir un
      harness paralelo.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nota sobre la paginación de
    la cuadrícula del widget de icono cuando el resultado filtrado excede una página.
  - `ai-workflow/docs/test-index.md`: ampliación de la línea de
    `icon-picker-property-field.test.tsx` y nota sobre `lucide-react-mock.ts`.

- **Criterios de finalización**:
  - El catálogo del widget se deriva de `LucideIcons.icons` (sin duplicados por alias).
  - La cuadrícula pagina sus resultados en bloques de `ICON_PICKER_PAGE_SIZE`, con controles
    "Anterior"/"Siguiente" visibles solo cuando hay más de una página.
  - Ningún consumidor (T2, T3, ni los diez ficheros de regresión listados en "Comandos durante la
    implementación") requiere cambios propios para seguir en verde.

- **Cierre de implementación**:
  - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` en verde con los casos nuevos.
  - Los diez ficheros de regresión listados en "Comandos durante la implementación" en verde sin
    modificación propia.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).

---

## Task 0129-T5 — La cuadrícula se abre al enfocar el buscador y se cierra al elegir/Escape/clic fuera

- **ID**: 0129-T5
- **Estado**: pending
- **Objetivo**: Convertir la cuadrícula de `IconPickerPropertyField` en un desplegable oculto por
  defecto (no montado en el DOM) que se abre al enfocar o pinchar el input de búsqueda, y se
  cierra al elegir una celda, al pulsar `Escape` o al hacer clic fuera del widget — reutilizando
  el mismo patrón de disclosure autocontenido ya vigente en el proyecto (`SidebarRailFlyout`,
  diseño `0123`, y `MenuItemDropdown`, diseño `0122`): estado local `open`, listener de
  `mousedown` en `document` para clic-fuera mientras `open` es `true`, `Escape` cierra y devuelve
  el foco al elemento disparador, y el foco se mueve al primer elemento visible al abrirse. A
  diferencia de esos dos precedentes, el panel de este widget **no** es `position: fixed` ni
  requiere medir `getBoundingClientRect()` — la cuadrícula vive en el flujo normal del documento
  (como ya hacía en T1/T4); solo cambia si se monta o no.

  Decisiones de diseño que esta tarea fija (no reabren T1/T4 en su contrato de selección,
  filtrado o paginación):

  1. **Apertura**: `onFocus` del input pone `open = true`. Un clic normal ya dispara `focus`
     nativo, así que no hace falta un `onClick` adicional en el input. La cuadrícula
     (`role="grid"` y todo su contenido) solo se renderiza cuando `open` es `true` — render
     condicional, no ocultación visual — mismo criterio que `{open && ... ? (...) : null}` de
     `SidebarRailFlyout`.
  2. **Cierre por selección**: elegir una celda (clic, o `Enter`/`Space` con foco en ella) cierra
     la cuadrícula y devuelve el foco al input de búsqueda, tanto si dispara `onChange` (valor
     distinto) como si no (reselección idempotente del valor ya fijado, T1) — la acción de elegir
     siempre cierra, independientemente de si cambia el valor.
  3. **Cierre por `Escape`**: manejado a nivel del contenedor raíz del widget (cubre foco en el
     input o en cualquier celda), cierra la cuadrícula y devuelve el foco al input. No invoca
     `onChange`.
  4. **Cierre por clic fuera**: listener de `mousedown` en `document` mientras `open` es `true`,
     igual que `SidebarRailFlyout`; si el `target` no está contenido en el nodo raíz del widget,
     `open` pasa a `false`. No se fuerza el foco a ningún elemento en este caso (a diferencia de
     los cierres por `Escape`/selección, que sí refocan el input).
  5. **Sin cierre por `blur`**: se descarta deliberadamente un `onBlur` del input como mecanismo
     de cierre — cerraría antes de que el `click` sobre una celda llegue a dispararse. El
     mecanismo de cierre para "el usuario se fue a otra parte" es el clic-fuera del punto 4, no el
     blur.
  6. **`ArrowDown` en el input**: si la cuadrícula está cerrada, `ArrowDown` la abre (`open =
     true`) y mueve el foco a la primera celda de la página visible una vez montada (mismo
     mecanismo que el efecto de `SidebarRailFlyout` que enfoca el primer elemento al abrirse,
     disparado por el cambio de `open`). Si ya está abierta, `ArrowDown` mueve el foco a la
     primera celda de inmediato — comportamiento sin cambios respecto a T1/T4.
  7. **Preview persistente del valor reconocido**: al ocultar la cuadrícula por defecto se pierde
     la única señal visual que T1 daba del valor actualmente seleccionado (la celda resaltada).
     Se añade un pequeño indicador junto al input, visible independientemente de `open`, cuando
     `isRecognizedValue` es `true`: renderiza `<IconNode name={currentValue} className="h-4 w-4"
     />` más el nombre, en línea con el resto de controles del widget (sin nuevos tokens
     visuales). La nota de "Valor actual: `<nombre>`" que T1 ya muestra para un valor no
     reconocido no cambia de comportamiento ni de posición — sigue siendo independiente de `open`.
  8. **`aria-expanded`/`aria-haspopup` en el input**: el input gana `aria-expanded={open}` y
     `aria-haspopup="grid"` (token válido de ARIA para un popup con semántica de rejilla), mismo
     criterio de accesibilidad del disclosure que expone `SidebarRailFlyout` en su trigger
     (`aria-haspopup="menu"`/`aria-expanded`).
  9. **Controles no afectados**: pulsar "Quitar icono" o los controles de paginación
     "Anterior"/"Siguiente" (T4) no fuerza ni cierra ni abre la cuadrícula — su estado `open`
     actual se mantiene sin cambios, porque ambos controles viven dentro del propio contenedor del
     widget (no cuentan como "clic fuera").
  10. **`query`/`page` no se resetean** al cerrar o reabrir el picker: el estado de búsqueda y de
      página se conserva igual que hoy entre una apertura y la siguiente (el reseteo de `page` al
      cambiar `query`, T4, sigue vigente sin cambios).

- **Fuera de alcance**:
  - Cambiar el criterio de paginación de T4, el número de columnas (`GRID_COLUMNS`) o el criterio
    de resaltado (`aria-selected`) de la celda seleccionada.
  - Cualquier animación o transición CSS de apertura/cierre.
  - Nueva dependencia (`@floating-ui`, `radix`, `downshift`, `cmdk`, etc.): el patrón de
    disclosure ya vigente en el proyecto no la necesita y esta tarea tampoco la introduce.
  - Posicionamiento flotante/`position: fixed` de la cuadrícula (a diferencia de
    `SidebarRailFlyout`): sigue en el flujo normal del documento, debajo del input, como hoy.
  - Cambios en la firma pública `{ label, value, onChange }` del componente o en su integración:
    ninguna toca `property-field-dispatcher.tsx`, `layout-canvas-properties-panel.tsx`,
    `menu-item-fields-editor.tsx` ni `sidebar-item-fields-editor.tsx` — T2 y T3 no se reabren en
    código, solo sus ficheros de test end-to-end (ver "Impacto esperado en archivos").
  - Saltar automáticamente a la página que contiene el valor seleccionado al abrir (ya fuera de
    alcance en T4; T5 no reabre esa decisión).

- **Dependencias**: T1 y T4 (modifica el mismo componente y su fichero de test). No depende de T2
  ni T3 en código (su contrato público no cambia), pero sí toca sus ficheros de test end-to-end
  (ver más abajo) porque esas suites interactúan con celdas de la cuadrícula asumiéndola ya
  visible sin abrir el picker primero.

- **Impacto esperado en archivos**:
  - Código:
    - `src/dev-runtime/layout-canvas/property-fields/icon-picker-property-field.tsx` (modificar:
      estado `open`, `ref` del contenedor raíz, listener de `mousedown` en `document` para
      clic-fuera, manejo de `Escape` a nivel de contenedor, apertura en `onFocus` del input,
      `aria-expanded`/`aria-haspopup` en el input, cierre + refoco al input tras seleccionar una
      celda o pulsar `Escape`, efecto que mueve el foco a la primera celda al abrirse vía
      `ArrowDown`, render condicional del `role="grid"` completo, nuevo chip de preview del valor
      reconocido).
  - Tests:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliar: casos nuevos de
      apertura/cierre; anteponer un paso de apertura — `fireEvent.focus` sobre el input de
      búsqueda — a los casos ya existentes de T1/T4 que interactúan con celdas).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (T2, ampliar: anteponer el
      mismo paso de apertura a los casos existentes que verifican la celda resaltada o la
      selección de una celda; sin cambiar sus aserciones).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx` (T2, ídem).
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (T3, ídem).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (T3, ídem).
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (T3, ídem).
    - Revisar (sin necesariamente modificar) los diez ficheros de regresión listados en el
      sub-bloque `tests` de T4: solo requieren el mismo paso de apertura si alguno de ellos
      interactúa con una celda de la cuadrícula (clic o teclado) asumiéndola ya visible; si solo
      montan el picker sin interactuar con celdas, no requieren cambio.
  - Documentación afectada (no se edita en esta tarea):
    - `ai-workflow/docs/test-index.md`: ampliar las líneas de los seis ficheros de test tocados.
    - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: sección del panel de
      propiedades — nota sobre que la cuadrícula se abre al enfocar el buscador y se cierra al
      elegir un icono, con `Escape` o al hacer clic fuera.

- **Tests**:
  - **Ficheros de test**:
    - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx` (ampliación).
    - `src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
      (ampliación).
    - `src/tests/dev-runtime/shell-menu-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx` (ampliación).
    - `src/tests/dev-runtime/shell-config-panel.test.tsx` (ampliación).
  - **Comportamiento cubierto** (`icon-picker-property-field.test.tsx`):
    - Al montar sin interacción, la cuadrícula no está en el DOM: `queryByRole('grid')` devuelve
      `null` y `queryAllByRole('gridcell')` devuelve `[]`, independientemente de `value`.
    - Enfocar el input (`fireEvent.focus`) abre la cuadrícula: aparecen las celdas de la página
      actual (`getAllByRole('gridcell')` no vacío) y el input pasa a `aria-expanded="true"`.
    - Con `value` reconocido (por ejemplo `'Home'`) y la cuadrícula cerrada (sin foco), un chip de
      preview junto al input muestra el `<svg>` del icono y el nombre `Home` — visible sin
      necesidad de abrir la cuadrícula (regresión de la visibilidad del valor actual, perdida al
      ocultar la cuadrícula por defecto).
    - Con `value` no reconocido, la nota "Valor actual: `<nombre>`" (T1) sigue apareciendo igual,
      visible sin abrir la cuadrícula.
    - Clic sobre una celda (`Settings`, con `value` previo `'Home'`) invoca `onChange('Settings')`
      (T1, sin cambios) **y además** cierra la cuadrícula (`queryAllByRole('gridcell')` vuelve a
      `[]` tras el clic) y devuelve el foco al input de búsqueda (`document.activeElement` es el
      input).
    - Reclic sobre la celda ya seleccionada (mismo `value`, idempotente, sin `onChange` por T1)
      también cierra la cuadrícula y refoca el input — el cierre no depende de que `onChange` se
      dispare.
    - `Enter` con foco en una celda cierra la cuadrícula, refoca el input, e invoca `onChange` con
      el nombre de esa celda (regresión de T1 + cierre nuevo).
    - `Escape` con foco en una celda cierra la cuadrícula, refoca el input, y **no** invoca
      `onChange`.
    - `Escape` con foco en el input (cuadrícula ya abierta por foco previo) cierra la cuadrícula;
      el foco permanece en el input.
    - Clic fuera del contenedor del widget (por ejemplo un elemento hermano renderizado junto al
      componente en el test) con la cuadrícula abierta la cierra.
    - Con la cuadrícula cerrada, `ArrowDown` sobre el input la abre y mueve el foco a la primera
      celda de la página visible en una sola interacción (verificable por `document.activeElement`
      tras el evento).
    - Con la cuadrícula ya abierta, `ArrowDown` sobre el input mueve el foco a la primera celda
      sin cambios de comportamiento respecto a T1/T4.
    - Pulsar "Quitar icono" con la cuadrícula cerrada no la abre; pulsarlo con la cuadrícula
      abierta no la cierra (regresión negativa explícita).
    - Cambiar de página con "Siguiente"/"Anterior" (T4) no cierra la cuadrícula (regresión
      negativa explícita).
    - El resto del comportamiento ya cubierto en T1/T4 (filtrado por `query`, sin resultados,
      paginación completa, navegación de flechas dentro de la página visible, `role="grid"` con
      `aria-label`) sigue pasando anteponiendo el paso de apertura (`fireEvent.focus` sobre el
      input) donde la aserción original asumía la cuadrícula ya visible — no se listan de nuevo
      aquí, solo se confirma que la suite completa del fichero (T1 + T4 + esta ampliación) queda
      en verde.
  - **Comportamiento cubierto** (T2/T3, ampliación en los cinco ficheros end-to-end/panel
    listados arriba):
    - Cada caso existente que hoy verifica una celda resaltada (`aria-selected="true"`) o invoca
      una selección de celda (`fireEvent.click` sobre un `gridcell`) antepone un
      `fireEvent.focus` sobre el input de búsqueda del widget (`getByRole('textbox', { name:
      /Buscar icono/i })` o el `aria-label` equivalente ya usado en esos ficheros) antes de buscar
      la celda — sin cambiar la aserción final sobre el resultado de la selección o el resaltado.
    - Ningún caso de esos ficheros queda sin adaptar: si una aserción falla por la cuadrícula
      cerrada, se corrige anteponiendo la apertura, no relajando la aserción.
  - **Comandos durante la implementación**:
    - `pnpm test --run src/tests/dev-runtime/icon-picker-property-field.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-property-field-dispatcher.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-properties-panel-commit-feedback.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-menu-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-sidebar-list-editor.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/shell-config-panel.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/layout-canvas-reorder-reinsert.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/dev-runtime.test.tsx`
    - `pnpm test --run src/tests/dev-runtime/floating-selection-overlay.test.tsx`
    - (los últimos cuatro son de regresión, mismo motivo que en T4: comprobar que ninguno
      interactúa con celdas del grid asumiéndolo ya abierto; si alguno lo hace, corregirlo con el
      mismo paso de apertura sin tocar sus aserciones)
  - **Restricciones**:
    - No introducir ninguna dependencia nueva. Reutilizar el patrón de disclosure ya vigente
      (`SidebarRailFlyout`, `MenuItemDropdown`: estado `open`, `mousedown` en `document` para
      clic-fuera, `Escape` con refoco al trigger, foco al primer elemento al abrirse) sin copiar
      su posicionamiento flotante — el grid de este widget no es `position: fixed` y no necesita
      medir `getBoundingClientRect()`.
    - Verificar los cuatro ficheros de regresión listados en "Comandos durante la implementación"
      y corregirlos solo si interactúan con celdas del grid asumiéndolo ya abierto; si solo
      montan el picker sin interactuar con celdas, no requieren cambio.
    - Reutilizar `@testing-library/react`/`fireEvent` ya vigentes en cada fichero; no introducir
      un harness paralelo ni un helper compartido nuevo más allá de repetir
      `fireEvent.focus(input)` donde haga falta (un solo `fireEvent`, no justifica extraer una
      utilidad).
    - No modificar `lucide-react-mock.ts`: T5 no cambia el catálogo ni la derivación de nombres,
      solo la visibilidad de la cuadrícula.

- **Documentación afectada** (para `update-app-documentation`):
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`: nota sobre que la cuadrícula
    de resultados se abre al enfocar/pinchar el buscador y se cierra al elegir un icono, con
    `Escape` o al hacer clic fuera; nota sobre el chip de preview del valor reconocido visible sin
    abrir la cuadrícula.
  - `ai-workflow/docs/test-index.md`: ampliación de las líneas de los seis ficheros de test
    tocados.

- **Criterios de finalización**:
  - La cuadrícula está oculta por defecto y se monta solo al enfocar/pinchar el input o al pulsar
    `ArrowDown` desde él.
  - Seleccionar una celda, pulsar `Escape` o hacer clic fuera cierran la cuadrícula; los dos
    primeros devuelven el foco al input.
  - El valor reconocido sigue siendo visible (chip de preview) con la cuadrícula cerrada.
  - Ningún fichero de código de T2/T3 requiere cambios; sus ficheros de test end-to-end quedan en
    verde tras anteponer el paso de apertura donde corresponda.

- **Cierre de implementación**:
  - `src/tests/dev-runtime/icon-picker-property-field.test.tsx` en verde con los casos nuevos.
  - Los cinco ficheros de test end-to-end de T2/T3 y los cuatro ficheros de regresión listados en
    "Comandos durante la implementación" en verde.
  - `pnpm test` completo en verde y cobertura ≥ 80 % (regla global).
