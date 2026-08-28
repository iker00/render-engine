# Tareas: Pestaña "Páginas" del editor de configuración en vivo

Contrato de ejecución para `spec.md` + `design.md` de esta feature. Cinco tareas, en el orden indicado. T1, T2 y T3 son piezas puras/aisladas sin dependencias entre sí (pueden implementarse en cualquier orden relativo, pero se listan en este orden por conveniencia); T4 depende de las tres; T5 depende de T4 y cierra la feature enganchándola a la barra flotante y al pipeline real de `dev-runtime.tsx`.

Siguiente tarea a escoger: **T1**.

---

## T1 — Escaneo puro de referencias `navigateTo` huérfanas

### Objetivo
Implementar una función pura que, dado el `RuntimeConfig` activo y el `id` de una página candidata a borrado, cuenta y localiza cualquier acción `{ type: 'navigateTo', pageId }` que apunte a esa página, en `layout` de cualquier página, en `shell.header` y en `shell.sidebar` — siguiendo la Decisión 3 de `design.md`: recorrido estructural genérico de cualquier valor JSON, sin enumerar campos concretos de acción.

### Fuera de alcance
- No valida si el objeto encontrado ocupa una posición sintácticamente válida como acción (riesgo residual aceptado explícitamente en `design.md`, Decisión 3).
- No repara, elimina ni modifica ninguna referencia encontrada.
- No cubre ninguna otra forma de apuntar a una página fuera de la acción declarativa `navigateTo` (ver "Casos límite" de `spec.md`).
- No incluye ningún componente de UI ni el diálogo de confirmación (T3) ni el panel (T4).

### Dependencias
Ninguna. Puede implementarse primero.

### Interfaces

**Consume**: ninguno.

**Produce**:
- `scanOrphanNavigateToReferences(config: RuntimeConfig, targetPageId: string): OrphanNavigateToReferenceScan` (de T1) — consumido por: T4
- tipo `OrphanNavigateToReferenceScan` (de T1) — consumido por: T3, T4

```ts
interface OrphanNavigateToReferenceSource {
  label: string
  count: number
}

interface OrphanNavigateToReferenceScan {
  totalCount: number
  sources: OrphanNavigateToReferenceSource[]
}
```

### Impacto esperado en archivos
- Código a crear: `src/dev-runtime/pages-config-panel/scan-orphan-navigate-to-references.ts`
- Tests a crear: `src/tests/dev-runtime/pages-config-panel-orphan-scan.test.ts`
- Documentación a revisar: `ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado; sin cambios funcionales de producto, ver T5).

### Detalle de comportamiento a implementar
- `scanOrphanNavigateToReferences` recorre genéricamente cualquier objeto/array anidado de tres raíces independientes, sin conocer nombres de campo concretos (`props.action`, `submitAction`, `onSuccess`, `onError`, `operations`, etc.), contando como coincidencia cualquier objeto con la forma exacta `{ type: 'navigateTo', pageId: targetPageId }`:
  1. `page.layout` de cada página de `config.pages`, en el orden de `config.pages` → etiqueta `` `en la página «${page.id}»` ``.
  2. `config.shell?.header` (si existe) → etiqueta `"en el menú del header"`.
  3. `config.shell?.sidebar` (si existe) → etiqueta `"en el sidebar"`.
- El resultado agrega: `totalCount` = suma de coincidencias de las tres raíces; `sources` = una entrada `{ label, count }` por cada raíz con `count > 0`, en el orden fijo arriba indicado (páginas primero, en su orden de `pages`, luego header, luego sidebar). Una raíz sin coincidencias no genera entrada en `sources`.
- Sin ninguna coincidencia en ninguna raíz, retorna `{ totalCount: 0, sources: [] }`.
- El recorrido no debe lanzar excepción ante `null`, `undefined`, primitivos, arrays vacíos o `config.shell` ausente.
- No vive en `src/config/` ni en `src/runtime/` (Decisión 3 de `design.md`): es una pieza propia del panel de Páginas.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/pages-config-panel-orphan-scan.test.ts` (nuevo)

**Comportamiento cubierto**:
- Sin ninguna referencia en todo el config, retorna `{ totalCount: 0, sources: [] }`.
- Detecta una referencia en `button.props.action` (`navigateTo`) dentro del `layout` de una página distinta a la buscada.
- Detecta una referencia anidada en `form.submitAction.onSuccess[]` y en `form.submitAction.onError[]`.
- Detecta múltiples referencias dentro de la misma página y las cuenta correctamente en el `count` de esa fuente.
- Detecta una referencia en un `menuItem`/`menuItemChild` de `shell.header.menu` (etiqueta "en el menú del header").
- Detecta una referencia en un nodo `link`/`button` de `shell.header.actions` (etiqueta "en el menú del header").
- Detecta una referencia en un `sidebarItem` anidado a varios niveles de profundidad dentro de `shell.sidebar.items` (etiqueta "en el sidebar").
- Una referencia `navigateTo` cuyo `pageId` no coincide con `targetPageId` no se cuenta.
- `config.shell` ausente no lanza error y no añade fuentes de header/sidebar.
- El orden de `sources` es siempre: páginas (en el orden de `config.pages`), luego header, luego sidebar — verificado con un caso que tiene coincidencias en las tres raíces a la vez.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/pages-config-panel-orphan-scan.test.ts
```

**Restricciones**:
- Función pura, sin JSX ni dependencia de React ni de ningún hook de estado.

### Documentación afectada
Ninguna.

### Criterios de finalización
- `scanOrphanNavigateToReferences` implementada con la firma exacta declarada en `Produce`.
- Todos los casos de "Comportamiento cubierto" tienen un test correspondiente y pasan.

### Cierre de implementación
Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/dev-runtime/pages-config-panel-orphan-scan.test.ts` en verde, sin afectar al resto de la suite.

---

## T2 — Reglas puras de alta/borrado de página

### Objetivo
Implementar un módulo de funciones puras que centralicen: la normalización de `id` para el formulario de creación, la comprobación de unicidad de `id`, y el motivo por el que una página no puede eliminarse (única página restante / `initialPage` vigente) — siguiendo la Decisión 6 de `design.md` (reglas de guarda de UI, no invariantes de `src/config/`).

### Fuera de alcance
- No implementa ninguna UI que consuma estas reglas (eso es T4).
- No valida el `id` más allá de "no vacío tras normalizar" y "no duplicado" (sin restricciones de formato o caracteres permitidos, que no pide la spec).
- No decide la lógica de borrado en sí (eso es T4, apoyándose en `getPageDeleteBlockedReason`).

### Dependencias
Ninguna. Puede implementarse en paralelo con T1 y T3.

### Interfaces

**Consume**: ninguno.

**Produce**:
- `normalizePageId(rawId: string): string` (de T2) — consumido por: T4
- `isDuplicatePageId(normalizedId: string, pages: RuntimePageConfig[]): boolean` (de T2) — consumido por: T4
- `getPageDeleteBlockedReason(pageId: string, pages: RuntimePageConfig[], initialPage: string): string | null` (de T2) — consumido por: T4

### Impacto esperado en archivos
- Código a crear: `src/dev-runtime/pages-config-panel/pages-config-panel-rules.ts`
- Tests a crear: `src/tests/dev-runtime/pages-config-panel-rules.test.ts`
- Documentación a revisar: ninguna.

### Detalle de comportamiento a implementar
- `normalizePageId(rawId)`: recorta espacios en blanco al principio y al final (`.trim()`); no colapsa espacios internos ni cambia mayúsculas/minúsculas.
- `isDuplicatePageId(normalizedId, pages)`: `true` si algún `pages[i].id` coincide exactamente (comparación sensible a mayúsculas/minúsculas, sin normalizar los `id` ya existentes) con `normalizedId`; `false` en caso contrario, incluido `normalizedId === ''`.
- `getPageDeleteBlockedReason(pageId, pages, initialPage)`:
  - si `pages.length <= 1`, retorna un motivo explicativo no vacío (p. ej. `"No se puede eliminar la única página restante."`) — esta comprobación tiene prioridad sobre la siguiente cuando ambas aplican a la vez (una única página que además es la inicial).
  - si no, y `pageId === initialPage`, retorna un motivo explicativo no vacío (p. ej. `"No se puede eliminar la página inicial. Cambia primero la página inicial."`).
  - en cualquier otro caso, retorna `null` (la página es eliminable).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/pages-config-panel-rules.test.ts` (nuevo)

**Comportamiento cubierto**:
- `normalizePageId` recorta espacios al principio/final; conserva espacios internos; un valor solo de espacios normaliza a `''`.
- `isDuplicatePageId` retorna `true` para una coincidencia exacta y `false` para una variante que solo difiere en mayúsculas/minúsculas (`"Home"` vs `"home"`) y para cualquier `id` no presente en `pages`.
- `getPageDeleteBlockedReason` retorna un motivo no nulo cuando `pages` tiene longitud 1, con independencia de si esa página es la inicial.
- `getPageDeleteBlockedReason` retorna un motivo no nulo cuando `pageId === initialPage` y hay más de una página.
- `getPageDeleteBlockedReason` retorna `null` cuando hay más de una página y `pageId` no es la inicial.
- Con una única página que además es la inicial, el motivo devuelto es el de "única página restante" (verifica la prioridad de comprobación, no el de "página inicial").

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/pages-config-panel-rules.test.ts
```

**Restricciones**:
- Funciones puras, sin JSX ni dependencia de React.

### Documentación afectada
`ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado).

### Criterios de finalización
- Las tres funciones implementadas con las firmas exactas declaradas en `Produce`.
- Todos los casos de "Comportamiento cubierto" tienen un test correspondiente y pasan.

### Cierre de implementación
Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/dev-runtime/pages-config-panel-rules.test.ts` en verde, sin afectar al resto de la suite.

---

## T3 — Diálogo de confirmación de borrado

### Objetivo
Implementar el primer diálogo de confirmación con semántica de diálogo del editor (`role="alertdialog"`), local al módulo del panel de Páginas (Decisión 5 de `design.md`), con foco gestionado al abrir y devuelto al disparador al cerrar, cierre con `Esc` y con clic fuera, y presentación del resultado del escaneo de referencias huérfanas cuando lo haya.

### Fuera de alcance
- No decide cuándo montarse: el componente que lo use decide el montaje condicional (mismo patrón que `FloatingNodePalette`), este componente no acepta ni gestiona una prop `open`.
- No calcula el escaneo de referencias huérfanas: recibe el resultado ya calculado (`OrphanNavigateToReferenceScan` de T1) como prop.
- No ejecuta ningún commit ni mutación de `pages`: solo invoca `onConfirm`/`onCancel`, cuya implementación real vive en T4.
- No se generaliza como componente reutilizable fuera de `pages-config-panel/` (alternativa descartada explícitamente en `design.md`, Decisión 5).

### Dependencias
Consume el tipo `OrphanNavigateToReferenceScan` producido por T1 (solo el tipo, no la función). Puede implementarse en paralelo con T1/T2; solo necesita que el tipo exista.

### Interfaces

**Consume**:
- tipo `OrphanNavigateToReferenceScan` (de T1)

**Produce**:
- `PagesDeleteConfirmDialog(props: PagesDeleteConfirmDialogProps): JSX.Element` (de T3) — consumido por: T4

```ts
interface PagesDeleteConfirmDialogProps {
  pageId: string
  orphanScan: OrphanNavigateToReferenceScan
  onConfirm: () => void
  onCancel: () => void
}
```

### Impacto esperado en archivos
- Código a crear: `src/dev-runtime/pages-config-panel/pages-delete-confirm-dialog.tsx`
- Tests a crear: `src/tests/dev-runtime/pages-delete-confirm-dialog.test.tsx`
- Documentación a revisar: `ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado).

### Detalle de comportamiento a implementar
- Elemento raíz con `role="alertdialog"`, `aria-modal="true"` y un `aria-label` que incluye el `pageId` recibido (p. ej. `` `Eliminar página «${pageId}»` ``).
- Al montar: captura en un ref el `document.activeElement` previo, y mueve el foco a un control interno del diálogo (p. ej. el botón "Cancelar" o el primer control interactivo).
- Al desmontar (limpieza del efecto de foco): si el elemento capturado sigue existiendo en el DOM, le devuelve el foco.
- `Esc` (listener mientras el diálogo está montado) invoca `onCancel`.
- Clic en el overlay/fondo (fuera del cuadro del diálogo) invoca `onCancel`; clic dentro del cuadro no lo hace.
- Contenido: encabezado con el `pageId`; si `orphanScan.totalCount === 0`, sin bloque de aviso adicional; si `orphanScan.totalCount > 0`, un bloque de aviso que lista cada entrada de `orphanScan.sources` (`label` + `count`) y el total, con lenguaje explícitamente informativo (el aviso no bloquea el botón "Eliminar").
- Dos botones con nombre accesible propio: "Cancelar" (invoca `onCancel`) y "Eliminar" (invoca `onConfirm`).
- Mismo lenguaje visual plano ya vigente en el resto del editor (sin caja/fondo sobrecargados, cabeceras de texto simple).

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/pages-delete-confirm-dialog.test.tsx` (nuevo)

**Comportamiento cubierto**:
- Con `orphanScan.totalCount === 0`, el diálogo se renderiza con `role="alertdialog"` y sin ningún bloque de aviso de referencias.
- Con `orphanScan.totalCount > 0`, el bloque de aviso muestra cada `label`/`count` de `sources` y el total.
- Pulsar `Escape` invoca `onCancel`.
- Clic en el overlay (fuera del cuadro del diálogo) invoca `onCancel`; clic dentro del cuadro del diálogo no invoca `onCancel`.
- Clic en "Eliminar" invoca `onConfirm`; clic en "Cancelar" invoca `onCancel`.
- Al montar, el foco queda dentro del diálogo (el elemento con foco tras el montaje es descendiente del contenedor `role="alertdialog"`).
- Al desmontar el diálogo (simulando que el padre lo cierra), el foco vuelve al elemento que lo tenía justo antes de montarlo.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/pages-delete-confirm-dialog.test.tsx
```

**Restricciones**:
- No introducir ninguna dependencia externa de gestión de foco/diálogo; implementar la gestión de foco y el cierre por `Esc`/clic-fuera directamente en el componente, igual que el resto del editor no usa librerías de diálogo.

### Documentación afectada
`ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado).

### Criterios de finalización
- `PagesDeleteConfirmDialog` implementado con la firma exacta declarada en `Produce`.
- Todos los casos de "Comportamiento cubierto" tienen un test correspondiente y pasan.

### Cierre de implementación
Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/dev-runtime/pages-delete-confirm-dialog.test.tsx` en verde, sin afectar al resto de la suite.

---

## T4 — `PagesConfigPanel`: listado, alta, edición de título, página inicial y borrado

### Objetivo
Implementar el panel de formulario `PagesConfigPanel` que cubre el listado de páginas, la creación, la edición de `title`, la designación de `initialPage` y el flujo completo de borrado con confirmación — como componente aislado con sus propias props de commit, siguiendo el mismo patrón que `ShellConfigPanel`/`TranslationsConfigPanel` (sin engancharse todavía a la barra flotante ni a `dev-editor-layer.tsx`; eso es T5).

### Fuera de alcance
- No se engancha a `DevEditorFloatingToolbar` ni a `DevEditorLayer` ni a `dev-runtime.tsx` (T5).
- No reordena `pages`.
- No renombra el `id` de una página ya existente.
- No edita `layout` ni `preloads` de ninguna página.
- No toca `shell`, `translations`, `tokens` ni `api`.
- No corrige ni reescribe referencias `navigateTo` huérfanas tras un borrado (el escaneo de T1 es solo informativo).

### Dependencias
T1 (`scanOrphanNavigateToReferences`, tipo `OrphanNavigateToReferenceScan`), T2 (`normalizePageId`, `isDuplicatePageId`, `getPageDeleteBlockedReason`), T3 (`PagesDeleteConfirmDialog`).

### Interfaces

**Consume**:
- `scanOrphanNavigateToReferences(config: RuntimeConfig, targetPageId: string): OrphanNavigateToReferenceScan` (de T1)
- tipo `OrphanNavigateToReferenceScan` (de T1)
- `normalizePageId(rawId: string): string` (de T2)
- `isDuplicatePageId(normalizedId: string, pages: RuntimePageConfig[]): boolean` (de T2)
- `getPageDeleteBlockedReason(pageId: string, pages: RuntimePageConfig[], initialPage: string): string | null` (de T2)
- `PagesDeleteConfirmDialog(props: PagesDeleteConfirmDialogProps): JSX.Element` (de T3)

**Produce**:
- `PagesConfigPanel(props: PagesConfigPanelProps): JSX.Element` (de T4) — consumido por: T5

```ts
interface PagesConfigPanelProps {
  config: RuntimeConfig
  onCommitPagesMutation: (mutate: (pages: RuntimePageConfig[]) => RuntimePageConfig[]) => CommitCanvasMutationResult
  onCommitInitialPageMutation: (mutate: (initialPage: string) => string) => CommitCanvasMutationResult
}
```

`RuntimeConfig`, `RuntimePageConfig` y `CommitCanvasMutationResult` son tipos ya existentes (`src/config/runtime-config.ts` y `src/dev-runtime/layout-canvas/layout-canvas-commit.ts` respectivamente), no se redeclaran aquí.

### Impacto esperado en archivos
- Código a crear: `src/dev-runtime/pages-config-panel/pages-config-panel.tsx`
- Tests a crear: `src/tests/dev-runtime/pages-config-panel.test.tsx`
- Documentación a revisar: `ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado; sin cambios funcionales de producto todavía, ver T5).

### Detalle de comportamiento a implementar
- **Listado**: una fila por página de `config.pages`, mostrando `id`, `title` (o un placeholder atenuado si no lo declara) y una marca visual si `page.id === config.initialPage`.
- **Creación**: formulario con campos `id`/`title`. Botón "Crear" deshabilitado mientras `normalizePageId(id)` sea `''` o `isDuplicatePageId(normalizedId, config.pages)` sea `true`; el motivo se muestra como texto junto al formulario sin necesidad de intentar el commit. Al confirmar, llama a `onCommitPagesMutation(pages => [...pages, { id: normalizedId, layout: [], ...(title.trim() ? { title: title.trim() } : {}) }])`. La página nueva nunca se marca como `initialPage` automáticamente. Un commit rechazado (p. ej. condición de carrera con Monaco) conserva los valores tecleados en el formulario y muestra `CommitRejectionBanner` (`role="alert"`), sin limpiar el formulario; un alta exitosa sí limpia el formulario para la siguiente creación.
- **Edición de `title`**: input por fila, commit al perder el foco (`blur`) solo si el valor cambió respecto al ya persistido — mismo criterio que la tabla de `Traducciones`. Llama a `onCommitPagesMutation(pages => pages.map(p => p.id === page.id ? { ...p, title: title.trim() === '' ? undefined : title } : p))` (vaciar el campo retira la clave `title`). Un commit rechazado conserva el valor tecleado en esa fila y muestra `CommitRejectionBanner` para esa fila.
- **Designación de `initialPage`**: un control por fila (o un único selector, a discreción de implementación siempre que sea navegable por teclado) que, al elegir una página, llama a `onCommitInitialPageMutation(() => page.id)`. El cambio se refleja de inmediato en la marca visual de "inicial" de todas las filas. Un commit rechazado muestra `CommitRejectionBanner` junto al control.
- **Borrado**: botón "Eliminar" por fila, deshabilitado con `title` explicativo cuando `getPageDeleteBlockedReason(page.id, config.pages, config.initialPage)` no es `null`. Habilitado, al pulsarlo calcula `scanOrphanNavigateToReferences(config, page.id)` y monta condicionalmente `PagesDeleteConfirmDialog` con `pageId={page.id}` y ese resultado. `onConfirm` del diálogo desmonta el diálogo y llama a `onCommitPagesMutation(pages => pages.filter(p => p.id !== page.id))`; `onCancel` solo desmonta el diálogo, sin ningún commit. Un commit de borrado rechazado (caso residual) muestra `CommitRejectionBanner` a nivel de esa fila.
- Reutiliza `CommitRejectionBanner` (`src/dev-runtime/commit-rejection-banner.tsx`) para todo aviso de commit rechazado, con el mismo criterio de limpieza ya vigente en el resto del panel (desaparece al guardar correctamente ese mismo campo/fila).
- Sin caja con borde ni fondo en los bloques raíz del panel ("Páginas", "Crear página"), cabeceras de texto simple — mismo lenguaje visual que `ShellConfigPanel`/`TranslationsConfigPanel`.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/pages-config-panel.test.tsx` (nuevo)

**Comportamiento cubierto**:
- El listado muestra `id`, `title` (o placeholder) y la marca de "inicial" para cada página del config base.
- Crear una página con un `id` nuevo la añade a la lista con `layout: []` y sin marcarla como inicial.
- El botón "Crear" está deshabilitado con `id` vacío (incluido solo espacios) y con `id` duplicado (incluida una variante con espacios sobrantes que normaliza al mismo valor), mostrando el motivo sin intentar el commit.
- Editar el `title` de una fila (incluido vaciarlo) commitea al perder el foco y refleja el nuevo valor o el placeholder.
- Seleccionar otra página como inicial actualiza la marca visual de "inicial" en todas las filas tras el commit.
- El botón "Eliminar" está deshabilitado, con motivo explícito visible, para la única página restante.
- El botón "Eliminar" está deshabilitado, con motivo explícito visible, para la página marcada como inicial (con más de una página).
- Eliminar una página habilitada abre `PagesDeleteConfirmDialog`; confirmar la retira de la lista; cancelar la conserva sin cambios.
- El diálogo de confirmación muestra el aviso de referencias huérfanas cuando el config de prueba incluye un `button.props.action` de tipo `navigateTo` apuntando a la página a borrar, y no lo muestra cuando no hay ninguna referencia.
- Un commit de creación rechazado (simulado forzando que el `id` ya exista en el config en el momento de aplicar) conserva los valores tecleados del formulario y muestra un aviso `role="alert"`.
- Un commit de edición de `title` rechazado conserva el valor tecleado en esa fila y muestra un aviso `role="alert"` para esa fila.

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/pages-config-panel.test.tsx
```

**Restricciones**:
- El harness de test reproduce el pipeline real de commit (`patchRootKey` + `validateRuntimeConfig` + `useState<RuntimeConfig>`) igual que `src/tests/dev-runtime/shell-config-panel.test.tsx` y `src/tests/dev-runtime/translations-config-panel.test.tsx`, sin montar `DevRuntimeReady` real — dos funciones de commit locales al test, una para `pages` y otra para `initialPage`.
- Reutilizar `CommitRejectionBanner` ya existente; no reimplementar un componente de aviso propio.
- No reimplementar la validación de unicidad/normalización de `id` fuera de las funciones de `pages-config-panel-rules.ts` (T2).

### Documentación afectada
`ai-workflow/docs/test-index.md` (nueva entrada bajo `dev-runtime/` para el fichero de test creado). El resto de documentación de producto se actualiza en T5, cuando la feature es alcanzable end-to-end (componente todavía no accesible desde la barra flotante real del editor).

### Criterios de finalización
- `PagesConfigPanel` implementado con la firma exacta declarada en `Produce`, consumiendo T1/T2/T3 tal cual fueron declaradas.
- Todos los casos de "Comportamiento cubierto" tienen un test correspondiente y pasan.

### Cierre de implementación
Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/dev-runtime/pages-config-panel.test.tsx` en verde, sin afectar al resto de la suite.

---

## T5 — Enganche del dominio `pages` en la barra flotante, `DevEditorLayer` y `dev-runtime.tsx`

### Objetivo
Habilitar el botón "Páginas" de la barra flotante, añadir `'pages'` a `ToolbarDomain`, renderizar `PagesConfigPanel` desde `DevEditorLayer` cuando ese dominio está activo, y añadir el pipeline de commit real (`commitPagesMutation`/`commitInitialPageMutation`) en `dev-runtime.tsx` siguiendo exactamente el mismo patrón que `commitShellMutation`/`commitTranslationsMutation` — cerrando la feature de punta a punta.

### Fuera de alcance
- No añade ninguna regla de negocio nueva: reutiliza T1, T2, T3 y T4 tal cual.
- No modifica `migrateRuntimeStateAcrossConfig` ni `dev-runtime-state-migration.ts` (Decisión 4 de `design.md`): el requisito 11 de la spec (migración de navegación al borrar la página activa) ya queda cubierto sin cambios porque `commitPagesMutation` sigue exactamente el mismo pipeline commit→validar→migrar→`flushSync` que `commitShellMutation`.
- No habilita los dominios `Api` ni `Tokens`, que siguen deshabilitados con `aria-disabled`.
- No cambia el comportamiento de `Layout`, `Shell` ni `Traducciones`.

### Dependencias
T4 (`PagesConfigPanel`, `PagesConfigPanelProps`).

### Interfaces

**Consume**:
- `PagesConfigPanel(props: PagesConfigPanelProps): JSX.Element` (de T4)
- tipo `PagesConfigPanelProps` (de T4)

**Produce**:
- `commitPagesMutation(mutate: (pages: RuntimePageConfig[]) => RuntimePageConfig[]): CommitCanvasMutationResult` (de T5) — sin consumidores directos (se pasa como prop `onCommitPagesMutation` de `DevEditorLayer`, no se importa por nombre desde ningún otro módulo)
- `commitInitialPageMutation(mutate: (initialPage: string) => string): CommitCanvasMutationResult` (de T5) — sin consumidores directos (mismo criterio, pasada como `onCommitInitialPageMutation`)

### Impacto esperado en archivos
- Código a modificar:
  - `src/dev-runtime/floating-toolbar/dev-editor-floating-toolbar.tsx`: `ToolbarDomain` gana `'pages'`; el botón `data-testid="dev-editor-toolbar-domain-pages"` quita `disabled`/`aria-disabled`/`title="Próximamente"` y gana `aria-pressed`/`onClick={() => onDomainSelected('pages')}`, mismo patrón que los botones `shell`/`translations`.
  - `src/dev-runtime/floating-toolbar/dev-editor-layer.tsx`: `DevEditorLayerProps` gana `onCommitPagesMutation`/`onCommitInitialPageMutation` con las firmas declaradas en `Produce`; el condicional de renderizado central gana una rama para `activeDomain === 'pages'` que monta `<PagesConfigPanel config={config} onCommitPagesMutation={onCommitPagesMutation} onCommitInitialPageMutation={onCommitInitialPageMutation} />`; la condición que limpia la selección de canvas al cambiar de dominio (hoy `domain === 'shell' || domain === 'translations'`) se amplía para incluir `'pages'`.
  - `src/dev-runtime/dev-runtime.tsx`: se añaden las funciones locales `commitPagesMutation`/`commitInitialPageMutation` (mismo cuerpo que `commitShellMutation`/`commitTranslationsMutation`, usando `patchRootKey(lastValidConfigText, 'pages', mutatedPages)` y `patchRootKey(lastValidConfigText, 'initialPage', mutatedInitialPage)` respectivamente) y se pasan como `onCommitPagesMutation`/`onCommitInitialPageMutation` al `<DevEditorLayer>` ya renderizado.
- Tests a modificar:
  - `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación)
  - `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación)
- Documentación a revisar:
  - `ai-workflow/docs/app-features/development/dev-mode-editor.md`
  - `ai-workflow/docs/app-features/development/index.md`

### Detalle de comportamiento a implementar
- `commitPagesMutation`/`commitInitialPageMutation` siguen exactamente el mismo pipeline que `commitShellMutation` (ver `src/dev-runtime/dev-runtime.tsx` líneas ~488-536): mutar el valor en memoria, `patchRootKey` sobre `lastValidConfigText`, `JSON.parse` + `validateRuntimeConfig`, si es válido `migrateRuntimeStateAcrossConfig` + `flushSync` (`currentConfig`/`editorBuffer`/`lastValidConfigText`/`hasPendingChanges`/`hasAppliedChanges`), si no, `{ status: 'rejected', error }` sin tocar `currentConfig`.
- El botón "Páginas" de la barra deja de estar deshabilitado y su `aria-pressed` refleja `activeDomain === 'pages'`, igual que `shell`/`translations`.
- Seleccionar el dominio `pages` sustituye el área central por `PagesConfigPanel` (canvas, overlay de selección y paleta de `Layout` desaparecen, mismo comportamiento ya descrito para `Shell`/`Traducciones` en `dev-mode-editor.md`) y limpia cualquier nodo seleccionado del canvas.
- Volver al dominio `layout` restaura el canvas normalmente, sin remontar `<RuntimePage />`.

### Tests

**Ficheros de test**:
- `src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` (ampliación)
- `src/tests/dev-runtime/dev-editor-layer.test.tsx` (ampliación)

**Comportamiento cubierto**:
- El botón "Páginas" ya no tiene `disabled`/`aria-disabled`; clicarlo invoca `onDomainSelected('pages')`.
- `aria-pressed` del botón "Páginas" es `true` cuando `activeDomain === 'pages'` y `false` en cualquier otro dominio.
- Seleccionar el dominio `pages` en `DevEditorLayer` sustituye el canvas por `PagesConfigPanel` y limpia la selección de nodo previa, si había alguna.
- Volver de `pages` a `layout` restaura el canvas de `Layout` con normalidad.
- Crear/editar/eliminar una página desde `PagesConfigPanel` integrado en `DevEditorLayer` se refleja en `pages`/`initialPage` del config real, reproduciendo el mismo tipo de harness real de commit que ya usa `dev-editor-layer.test.tsx` para verificar `shell`/`translations` (o uno local equivalente si el fichero no tiene ya ese patrón para otros dominios).

**Comandos durante la implementación**:
```
pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx
pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx
```

**Restricciones**:
- El requisito 11 de la spec (migración de navegación al borrar la página activa) no requiere ningún test dedicado nuevo en esta tarea: reutiliza sin cambios `migrateRuntimeStateAcrossConfig`, ya cubierto genéricamente por `src/tests/dev-runtime/dev-runtime-state-migration.test.ts`.
- `commitPagesMutation`/`commitInitialPageMutation` no llevan test unitario propio aislado — mismo criterio ya vigente para `commitShellMutation`/`commitTranslationsMutation` (tampoco lo tienen); quedan cubiertas indirectamente por los tests de esta tarea sobre `dev-editor-layer.test.tsx` y por el harness local de `pages-config-panel.test.tsx` (T4), que reproduce el mismo pipeline.

### Documentación afectada
- `ai-workflow/docs/app-features/development/dev-mode-editor.md`: añadir una sección "Sección Páginas (dominio de configuración)" análoga a "Sección Shell"/"Sección Traducciones", y actualizar el punto 2 de "Barra flotante de herramientas" para mover `Páginas` de la lista de pestañas deshabilitadas a la de funcionales.
- `ai-workflow/docs/app-features/development/index.md`: actualizar la descripción de `dev-mode-editor.md` en la tabla de sub-documentos para mencionar la nueva sección Páginas.
- `ai-workflow/docs/test-index.md`: esta tarea amplía sustancialmente la cobertura descrita de `dev-editor-floating-toolbar.test.tsx` (nuevo dominio `pages` habilitado) y `dev-editor-layer.test.tsx` (nueva rama de renderizado end-to-end); actualizar ambas líneas existentes para reflejar el nuevo alcance cubierto.

(Esta actualización documental se ejecuta manualmente después, invocando `update-app-documentation`; no forma parte del cierre de implementación de esta tarea.)

### Criterios de finalización
- `ToolbarDomain` incluye `'pages'`; el botón "Páginas" de la barra está habilitado y funcional.
- `DevEditorLayer` renderiza `PagesConfigPanel` para `activeDomain === 'pages'` y limpia la selección de canvas al entrar en ese dominio.
- `dev-runtime.tsx` expone `commitPagesMutation`/`commitInitialPageMutation` con las firmas declaradas y los pasa correctamente a `DevEditorLayer`.
- Todos los casos de "Comportamiento cubierto" tienen un test correspondiente y pasan.
- La feature es alcanzable de punta a punta: activar "Páginas" desde la barra, crear/editar/designar inicial/eliminar una página, con reflejo inmediato en Monaco y en el selector de página de la barra.

### Cierre de implementación
Código y tests de esta tarea completos y validados: `pnpm test --run src/tests/dev-runtime/dev-editor-floating-toolbar.test.tsx` y `pnpm test --run src/tests/dev-runtime/dev-editor-layer.test.tsx` en verde, y `pnpm test` completo sin romper el umbral mínimo de cobertura del 80% sobre `src/`.
