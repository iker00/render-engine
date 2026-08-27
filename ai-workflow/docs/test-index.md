# Índice de ficheros de test

Una línea por fichero de `src/tests/`, agrupada por carpeta. Sirve para **situar** un fichero
—en qué carpeta va uno nuevo, qué área cubre cada uno— no para saber qué casos concretos están
cubiertos.

Para comprobar si un comportamiento ya tiene test, buscar en `src/tests/` directamente
(`grep`/`rg` sobre los `describe`/`it`). Este índice dice qué ficheros hay; no agota lo que
cada uno contiene.

Actualizar al añadir, dividir, mover o eliminar un fichero de test. El desfase se comprueba con
`ai-workflow/scripts/check-test-index.sh`.

## Estructura de carpetas

```
src/tests/
├── setup.ts                        — configuración global de Vitest
├── app/                            — bootstrap y shell
├── config-validation/              — validación de la config en tiempo de carga
├── layout-renderer/                — renderizado de nodos del layout
├── runtime-state/                  — store de estado compartido en runtime
├── runtime/                        — comportamiento runtime por área funcional
└── dev-runtime/                    — modo desarrollo (toolbar flotante, editor Monaco, bundle)
```

Ficheros de apoyo, no son tests: `config-validation/helpers.ts`, `dev-runtime/lucide-react-mock.ts`,
`runtime-state/helpers.tsx`, `runtime-state/read-runtime-state-snapshot.ts`.

---

## app/

- `app-bootstrap.test.tsx` — lectura y parsing de la configuración de runtime durante el bootstrap
- `app-shell-header-dropdown.test.tsx` — `MenuItemDropdown` del header: apertura/cierre, navegación por teclado, selección de hijos y visibilidad reactiva
- `app-shell-header.test.tsx` — `AppShellHeader` end-to-end: presencia/ausencia, logo/título, menú raíz, acciones, ancho completo, estado activo y persistencia
- `app-shell-scroll-behavior.test.tsx` — `shell.scrollBehavior` end-to-end en modos `page` y `fixed`, con header/sidebar `sticky` y cascada de `overflow`
- `app-shell-sidebar-rail.test.tsx` — modo rail del sidebar: colapso controlado, `SidebarRailFlyout`, fallback de glifo y persistencia entre navegaciones
- `app-shell-sidebar.test.tsx` — `AppShellSidebar` end-to-end: hojas, ramas expandibles, visibilidad, estado activo con auto-expansión y persistencia
- `app-shell.test.tsx` — composición general del shell de la aplicación
- `main.test.tsx` — punto de entrada principal de la aplicación
- `read-runtime-endpoints-config.test.ts` — resolución de `endpointsConfig` desde `dataset` con prioridad sobre el fallback de desarrollo
- `should-mount-dev-runtime.test.ts` — decisión de montar el dev runtime según `isDev` y el atributo `data-enable-dev-mode`

---

## config-validation/

- `layout-placement-rules.test.ts` — predicados puros de colocación estructural compartidos por la validación de config y el motor de drop visual
- `read-runtime-config.test.ts` — lectura y normalización de la config desde el DOM
- `read-runtime-data-values.test.ts` — lectura de `dataset.values` del root con fallback a `devDataValues` y validación de shape del JSON
- `runtime-config-root-zod.test.ts` — esquema Zod raíz de la config
- `runtime-config-validation-accordion.test.ts` — validación del nodo `accordion`: props (label, defaultOpen, groupId), children, placement y transversales
- `runtime-config-validation-alert.test.ts` — validación del nodo `alert`: aceptación con type/message/title/transversales y rechazo de shape inválido
- `runtime-config-validation-api-operations.test.ts` — operaciones API: métodos, query/body/headers, extra keys, body trees
- `runtime-config-validation-badge.test.ts` — validación del nodo `badge`: props label/variant/color, transversales y rechazo de shape inválido (leaf)
- `runtime-config-validation-button-styles.test.ts` — esquema y normalización de `button` en color, variant y fullWidth (constantes y validación cruzada)
- `runtime-config-validation-buttons.test.ts` — botones y acciones (navigateTo, goBack, executeOperation, resetForm), `onSuccess`/`onError` de `executeOperation`/`executeOperations` con validación de targets, y validación del nodo `link`
- `runtime-config-validation-collections.test.ts` — contrato de fuentes de colección multi-valor
- `runtime-config-validation-containers.test.ts` — contrato de layout de contenedores
- `runtime-config-validation-divider.test.ts` — validación del nodo `divider`: variantes, transversales, placement y rechazos de shape
- `runtime-config-validation-file-input.test.ts` — validación del nodo `fileInput`: props, validations, capture y restricciones de placement
- `runtime-config-validation-file-manager.test.ts` — validación del nodo `fileManager`: operaciones, fieldName, validations, pagination y bootstrap checks
- `runtime-config-validation-form-fields.test.ts` — expansión de campos de formulario reutilizables y validación de estructura (incluye `select.props.emptySubmitValue`)
- `runtime-config-validation-forms-semantics.test.ts` — formularios: restricciones de placement, IDs duplicados, submitAction y persistOnUnmount
- `runtime-config-validation-forms-tabs.test.ts` — semántica de `tabs` dentro de `form`: fieldId único cross-item, restricciones de placement y submitAction
- `runtime-config-validation-forms-validations.test.ts` — formularios: aceptación y normalización de reglas de validación
- `runtime-config-validation-gallery.test.ts` — validación del nodo `gallery`: aceptación (origen manual/dinámico, submodo src/fetch, idField, display paginado/carrusel, transversales) y rechazo (exclusiones mutuas, shapes inválidos)
- `runtime-config-validation-global-preloads.test.ts` — bloque raíz `preloads`: aceptación, cross-check contra el catálogo `api` y rechazo de shapes inválidos
- `runtime-config-validation-hidden.test.ts` — validación del nodo `hidden`: fieldId y value, props/rasgos prohibidos y unicidad en formulario
- `runtime-config-validation-image-fetch.test.ts` — validación de nodo `image` con bloque `fetch`: url/alt/method/headers/body y coexistencia con contrato clásico src+alt
- `runtime-config-validation-image-table.test.ts` — validación de nodos image y table (incluye subconjunto `link` permitido en celdas)
- `runtime-config-validation-map.test.ts` — validación del nodo `map`: center/zoom/height, markers estáticos, markerSources dinámicos (source/position/label/color), precedencia de markerSources sobre markers, children y transversales
- `runtime-config-validation-modal.test.ts` — validación de nodo modal: shape, children permitidos, unicidad de id y referencias a modalId
- `runtime-config-validation-navigate-params.test.ts` — validaciones de `navigateTo.params` y colecciones antes de render
- `runtime-config-validation-page-title.test.ts` — campo `title` opcional por página: aceptación, propagación al RuntimePageConfig y rechazo de tipos inválidos
- `runtime-config-validation-preloads.test.ts` — layout raíz básico y preloads por página: aceptación y rechazo
- `runtime-config-validation-qsf.test.ts` — queryStateFeedback: estados, fallback y rechazo
- `runtime-config-validation-repeater.test.ts` — nodo repeater: fuente, key (incluido `$index`), template y paginación
- `runtime-config-validation-shell-sidebar.test.ts` — bloque `shell.sidebar` y `sidebarItem` con href/action/children, unicidad y cross-check de pageId y visibility
- `runtime-config-validation-shell.test.ts` — bloque raíz `shell`: header, sidebar, scrollBehavior y validación cruzada de sus campos
- `runtime-config-validation-skeleton.test.ts` — validación del nodo `skeleton`: variantes, props opcionales, transversales, placement y rechazos de shape
- `runtime-config-validation-stat.test.ts` — validación del nodo `stat`: props label/value/variant/color/layout.span y rechazo de shape inválido
- `runtime-config-validation-tabs.test.ts` — nodo `tabs` fuera de formulario: shape de items, orientation, defaultTab, children y visibility por item
- `runtime-config-validation-toggle.test.ts` — validación del nodo `toggle`: props, defaultValue, validations aplicables, form-only y unicidad de fieldId
- `runtime-config-validation-tokens.test.ts` — bloque `tokens`: esquema de token con `value` y `refresh` y validación cruzada contra operaciones API
- `runtime-config-validation-tooltip.test.ts` — validación de `props.tooltip` en los siete field nodes: aceptación como string y rechazo de tipos inválidos
- `runtime-config-validation-translations.test.ts` — bloque `translations`: aceptación de mapas por clave/idioma, normalización y rechazo de shapes inválidos
- `runtime-config-validation-visibility.test.ts` — reglas de visibility: operadores, referencias (incluido `params.{paramName}`), valores y extra keys
- `validation-breadcrumb.test.ts` — construcción del breadcrumb legible y excerpts de nodo para enriquecer errores de validación

---

## layout-renderer/

- `layout-node-renderer-edit-mode.test.tsx` — modelo de path, threading en LayoutRenderer, wrapper de selección/hover bajo LayoutEditModeContext y steps row/cells de tabla
- `layout-renderer-accordion-edit-mode.test.tsx` — accordion en modo edición con cuerpo siempre presente, path de hijos y regresión de colapso en producción
- `layout-renderer-accordion.test.tsx` — nodo accordion: estado inicial, toggle, ARIA, interpolación de label, coordinación por groupId, transversales e integración en repeater
- `layout-renderer-alert.test.tsx` — nodo alert: colores por tipo, icono, title/message, interpolación, transversales e integración con repeater y form
- `layout-renderer-badge.test.tsx` — nodo badge: variantes pill/circle, paleta semántica de colores, interpolación del label y transversales
- `layout-renderer-basic-nodes.test.tsx` — ordenación raíz, layout vacío, listas estáticas/dinámicas/objeto, comportamiento leaf y clases Tailwind
- `layout-renderer-button-styles.test.tsx` — nodo button: variantes solid/outline/ghost/link con tokens semánticos, fullWidth y submit implícito dentro de form
- `layout-renderer-buttons-text.test.tsx` — nodos button y link, navegación declarativa, interpolación de texto y referencias dinámicas
- `layout-renderer-container.test.tsx` — container: direction, gap, columns, variant y align/justify/wrap
- `layout-renderer-divider.test.tsx` — nodo divider: variantes solid/dashed/dotted/invisible, visibility, layout.span, repetición y ausencia de children
- `layout-renderer-edit-mode-placeholders.test.tsx` — placeholders seleccionables de container/form/link vacíos en modo edición y ausencia total en producción
- `layout-renderer-file-input.test.tsx` — nodo fileInput: atributos nativos, previsualización, límite maxFiles y transversales
- `layout-renderer-file-manager.test.tsx` — nodo fileManager: DnD, subida secuencial, validaciones client-side, paginación, acciones y precarga con getOperation
- `layout-renderer-forms-fields.test.tsx` — tipos de campo expandidos, opciones dinámicas, labels/valores interpolados y defaults lazy
- `layout-renderer-forms-multi-operation.test.tsx` — submitAction executeOperations: paralelismo, resetOnSuccess, errores por entrada, snapshot compartido e iteración en repeater
- `layout-renderer-forms.test.tsx` — forms declarativos, orden de campos, labels interpolados y semántica de secciones
- `layout-renderer-gallery.test.tsx` — nodo gallery: origen estático/dinámico (queries.*/item.* en repeater), exclusión mutua de origen, modo paginado, lightbox, degradación silenciosa por elemento en submodo src y fetch, transversales, colección vacía
- `layout-renderer-gallery-carousel.test.tsx` — nodo gallery en modo carrusel end-to-end (visibleCount, autoplay, loop, navegación manual)
- `layout-renderer-grid-spans.test.tsx` — layout.span, columnas responsive, clamping y fallbacks móvil
- `layout-renderer-hidden.test.tsx` — nodo hidden: sin DOM, value literal/dinámico, inicialización no lazy, inclusión en payload y uso en repeater
- `layout-renderer-image-fetch.test.tsx` — nodo image con fetch: ciclo del blob, errores, revocación al desmontar, aislamiento e integración con repeater
- `layout-renderer-map.test.tsx` — nodo map: centro/zoom/height por defecto y explícitos, marcadores estáticos y dinámicos (una y varias fuentes), color por ciclo vs explícito, degradación de coordenadas inválidas, popup sin acciones, transversales (layout.span/visibility/queryStateFeedback)
- `layout-renderer-image-table.test.tsx` — nodos image y tablas manual/dynamic/filterable/sortable
- `layout-renderer-modal-edit-mode.test.tsx` — modal en modo edición con panel siempre presente y regresión de cierre en producción
- `layout-renderer-modal-repeater.test.tsx` — modal dentro de repeater.props.template, identidad por iteración, item.* y cierre global uno a la vez
- `layout-renderer-modal.test.tsx` — render condicional del modal, apertura/cierre por botón/ESC/overlay, tamaños, defaultOpen, visibility y focus trap
- `layout-renderer-repeater-basic.test.tsx` — iteraciones, orden de colección, resolución item.*, diagnósticos de key e item.$index
- `layout-renderer-repeater-edit-mode.test.tsx` — repeater en modo edición: instancia única de props.template, sin controles de paginación y path con tramo template
- `layout-renderer-repeater-pagination.test.tsx` — controles previousNext, numbered, scroll y grid row del repeater
- `layout-renderer-repeater-state.test.tsx` — resets por colección/pageSize, repeaters independientes, scalar items y queryStateFeedback con visibility
- `layout-renderer-skeleton.test.tsx` — nodo skeleton: variantes rect/text/circle, animación, transversales y uso como fallback de queryStateFeedback
- `layout-renderer-stat.test.tsx` — nodo stat: variantes accent/tinted, paleta de colores, interpolación, transversales e integración en repeater y form
- `layout-renderer-state-feedback.test.tsx` — queryStateFeedback en todos los estados y reglas de visibility
- `layout-renderer-table-edit-mode.test.tsx` — selección/edición visual de celdas-nodo de tabla en modo Editor con paths propios y aislamiento por celda
- `layout-renderer-table-pagination.test.tsx` — paginación de tabla: previousNext, numbered, scroll e IntersectionObserver
- `layout-renderer-table-rich-cells.test.tsx` — celdas ricas de tabla con nodos anidados, item.* dinámico, visibility/qsf y filtros/ordenación
- `layout-renderer-tabs-edit-mode.test.tsx` — tabs en modo edición: path con tramo tabItem por pestaña activa y regresión de navegación en producción
- `layout-renderer-tabs.test.tsx` — nodo tabs: orientación, tab activa, interpolación de labels, transversales, integración en form y visibility por item
- `layout-renderer-toggle.test.tsx` — nodo toggle: switch accesible, defaultValue, labelPosition, required, payload boolean y transversales
- `layout-renderer-tooltip.test.tsx` — FieldTooltip aislado e integración del tooltip en los siete field nodes con interpolación y accesibilidad
- `layout-renderer-translations.test.tsx` — layout con translations.*: activeLanguage, fallback es, key ausente en dev/prod y degradación defensiva

---

## runtime-state/

- `runtime-state-data-values.test.tsx` — pre-siembra de `queries` desde el prop `dataValues` del provider e integración con navegación, preloads y operaciones
- `runtime-state-declarative-forms.test.tsx` — inicialización declarativa de formularios: normalización de select, defaults dinámicos, `select.multiple`, `radioGroup` y `checkboxGroup`
- `runtime-state-edit-mode-suppression.test.tsx` — supresión centralizada de navegación, operaciones y submit por `useRuntimeStateActions` bajo `LayoutEditModeProvider`
- `runtime-state-form-lifecycle.test.tsx` — ciclo de vida del formulario: unmount/remount, `persistOnUnmount`, invalidación en page-entry y defaults dirigidos por query
- `runtime-state-forms-queries.test.tsx` — form store y query state básicos: creación, actualización, reset, eliminación, selectors y defaults de feedback
- `runtime-state-global-preloads-init.test.tsx` — siembra inicial de `queries.*` desde el bloque raíz `preloads` con firma estable y sin sobrescribir `dataValues`
- `runtime-state-i18n.test.tsx` — sub-estado `i18n` al crear el runtime state y su preservación frente a acciones del reducer
- `runtime-state-modal.test.tsx` — estado del modal: apertura/cierre, regla uno a la vez, cierre por navegación o page-entry, identidad por iteración
- `runtime-state-navigation.test.tsx` — inicialización del store, navegación entre páginas, hash, `goBack`, history y preloads
- `runtime-state-operations.test.tsx` — ejecución de operaciones del runtime: errores, respuesta vacía y aislamiento entre instancias
- `runtime-state-tokens.test.tsx` — dominio de tokens del reducer: hidratación, acciones de refresh/error/set-value/failed-attempt, reset y aislamiento por `tokenId`
- `runtime-state-validations-dynamic-select.test.tsx` — select dinámico en validaciones: limpieza de valor, submit con empty y formularios declarativos
- `runtime-state-validations-rules.test.tsx` — reglas avanzadas de validación (length, number, multiselect), inicialización perezosa y revalidación en edición
- `runtime-state-validations-visibility.test.tsx` — validación de campos requeridos ocultos por `visibility`, qsf, container o repeater
- `runtime-state-validations-when.test.tsx` — validación condicional `when` sobre `required`, `minLength` y `pattern`, con retrocompatibilidad y referencias a queries

---

## runtime/

- `runtime-api-empty-submit-value.test.ts` — sustitución de `''` por `emptySubmitValue` en resolvers de payload, headers y body
- `runtime-api-execution.test.ts` — ejecución de operaciones y ciclo de vida de queries
- `runtime-api-file-encoding-preflight.test.tsx` — preflight de codificación de ficheros (`fileValueOverrides`) e integración en `executeQueryOperation`
- `runtime-api-header-interpolation.test.ts` — interpolación de placeholders `{{...}}` en `resolveHeaders` con tokens, params, forms y errores
- `runtime-api-multipart.test.ts` — construcción de FormData multipart en el builder de requests con ficheros y escalares
- `runtime-api-payload-file-overrides.test.ts` — canal `fileValueOverrides` del resolver de body sustituyendo referencias completas por arrays precomputados
- `runtime-api-payload-omission.test.ts` — omisión de claves en payload al referenciar campos ocultos del propio form
- `runtime-api-retry.test.ts` — primitiva pura `runRuntimeApiRequestWithRetries` y política de reintentos acotados
- `runtime-api-token-refresh-failed.test.ts` — propagación de `token-refresh-failed` desde resolvers hasta el builder cuando un token está en error
- `runtime-browser-hash-navigation.test.ts` — sincronización de navegación con el hash del navegador
- `runtime-button-lifecycle-actions.test.tsx` — `onSuccess`/`onError` de `button.props.action` tras `executeOperation`/`executeOperations`: encadenado, `when`, error de negocio, `item.*` en repeater y botón auxiliar dentro de form
- `runtime-button-navigation.test.tsx` — navegación declarativa desde botones
- `runtime-collection-pagination.test.ts` — paginación local de colecciones
- `runtime-file-base64-encoder.test.ts` — codificador puro de ficheros a base64 con shape `{name,size,mime,data}`
- `runtime-file-input-hook.test.tsx` — nodo `FileInputNode`: selección, validaciones cliente, revocación de object URLs y previews
- `runtime-file-manager-hook.test.tsx` — nodo `fileManager`: subida secuencial, validaciones, paginación, acciones Ver/Descargar/Eliminar y precarga
- `runtime-file-manager-normalize-name.test.ts` — normalización de nombre de fichero (Windows, reservados, truncado, prefijo)
- `runtime-file-manager-resolve-label.test.ts` — resolutor de labels del fileManager con interpolación de translations y placeholders locales
- `runtime-form-submit-empty-select-fallback.test.tsx` — submit end-to-end de select vacío con `emptySubmitValue` sin regresión sobre `required` ni `visibility`
- `runtime-form-submit-file-input.test.tsx` — submit end-to-end de `fileInput` con serialización JSON+base64 y coexistencia con otros campos
- `runtime-form-submit-hidden-fields.test.tsx` — submit end-to-end de form con campos ocultos omitiendo claves del wire format
- `runtime-form-tabs.test.tsx` — forms con tabs: recogida de campos, submit, validaciones y semántica de tabs inactivas
- `runtime-form-validation-message.test.ts` — formateo de mensaje de validación con `{{value}}`, `{{translations.*}}` y degradación segura
- `runtime-form-validations.test.ts` — validaciones locales de formulario en submit
- `runtime-formatter-parser.test.ts` — parser de placeholders `referencia | formatter[:arg] | ...` y su gramática
- `runtime-formatter-registry.test.ts` — catálogo cerrado v1 de formatters con locale fijo `es-ES` y cache de instancias `Intl`
- `runtime-gallery-carousel-view.test.tsx` — `GalleryCarouselView`: loop, autoplay, visibleCount, navegación manual y deshabilitado de flechas en extremos
- `runtime-gallery-lightbox.test.tsx` — `GalleryLightbox`: navegación anterior/siguiente acotada al conjunto completo, cierre por botón/clic fuera/Esc, reutilización de la unidad de fetch ya montada
- `runtime-gallery-paginated-view.test.tsx` — `GalleryPaginatedView`: variantes previousNext/numbered/scroll y reset de posición al cambiar la colección
- `runtime-gallery-photo-tile.test.tsx` — `GalleryPhotoTile`: split modo src/fetch, click de selección y degradación sin `<img>` mientras el fetch no resuelve
- `runtime-gallery-photos.test.ts` — `resolveGalleryPhotos`: origen estático y dinámico, key ($index/$key/ruta relativa, duplicados), submodo src/fetch, idField (FR7) y degradación silenciosa por elemento
- `runtime-global-preloads.test.tsx` — bloque raíz `preloads` end-to-end: fetch al montar, dedup, reintentos y regresión
- `runtime-grid-drop-zone-rects.test.ts` — geometría pura de zonas de inserción overlay en containers grid
- `runtime-icon-node.test.tsx` — `IconNode`: resolución Pascal/kebab, aplicación de `className` y degradación silenciosa
- `runtime-image-binary-fetch.test.ts` — `executeRuntimeBinaryFetch`: resolución de URL/headers/body y errores de red, HTTP y binario inválido
- `runtime-layout-visibility.test.ts` — reglas de visibilidad por condición: operadores, referencias y semántica de ausencia
- `runtime-lazy-node.test.tsx` — wrapper LazyNode con Suspense + error boundary y contención por instancia
- `runtime-link-action-href.test.ts` — resolutor puro de `href` para acciones `navigateTo`/`goBack` sobre el hash del navegador
- `runtime-map-marker-sources.test.ts` — `resolveMapMarkerSourceItems`: resolución de colección dinámica a marcadores, degradación silenciosa ante posición inválida, label por interpolación o ruta relativa
- `runtime-node-components-map.test.tsx` — mapa central de componentes de nodo: cobertura de claves y rama eager en tests
- `runtime-node-styling-gallery.test.ts` — helpers puros de estilo del nodo gallery: clases Tailwind de grid paginado, controles de paginación/carrusel/lightbox y placeholder vacío
- `runtime-node-styling-map.test.ts` — helpers puros de estilo del nodo map: clase Tailwind de altura por variante y `divIcon` de marcador por color semántico
- `runtime-node-styling.test.ts` — utilidades de estilo y clases Tailwind de nodos
- `runtime-page-document-title.test.tsx` — efecto de `document.title` por página: inicial, navegación, formato y renders adicionales
- `runtime-page-entry-preloads.test.tsx` — precarga de operaciones al entrar en página
- `runtime-plan-page-preloads.test.ts` — funciones puras de planificación de `pages[].preloads` (agregado, plan, snapshot, firmas)
- `runtime-reference-resolution.test.tsx` — resolución de referencias declarativas `forms.*`, `queries.*`, `item.*`, `params.*`
- `runtime-scroll-restoration.test.tsx` — `RuntimeScrollRestorationEffect`: scroll-to-top en push y restauración de posición en pop
- `runtime-shell-active-menu.test.ts` — función pura `computeActiveMenuItemIds` para marcar items activos del menú
- `runtime-shell-active-sidebar.test.ts` — función pura `computeActiveSidebarItemIds` para marcar items activos y ancestros
- `runtime-table-processing.test.ts` — filtrado, ordenación y procesamiento local de tablas
- `runtime-tokens-execute-refresh.test.ts` — `executeTokenRefresh`: éxito, extracción por `responsePath`, errores de red/HTTP y `errorCondition`
- `runtime-tokens-scheduler.test.tsx` — `useRuntimeTokenScheduler`: primer ciclo, reintento inmediato, cleanup y múltiples tokens independientes
- `runtime-ui-actions.test.tsx` — ejecución de acciones UI (clicks, submit) y delegación al executor compartido

---

## dev-runtime/

- `api-config-panel.test.tsx` — panel "Api" end-to-end: CRUD de operaciones, visibilidad de body por método y sub-vista de preloads globales/de página
- `boolean-property-field.test.tsx` — switch booleano compartido: toggle habilitado y estado `disabled`/`disabledReason`
- `color-swatch-palette.test.ts` — catálogo puro de nombres semánticos y clases de las muestras de color
- `condition-group-property-field.test.tsx` — widget aislado de condición/grupo de visibilidad con conmutación de forma y operadores
- `dev-editor-floating-toolbar.test.tsx` — barra flotante del editor: selector de página, pestañas de dominio y toggles paleta/Monaco
- `dev-editor-layer.test.tsx` — capa del editor: modos visual/editor, selección persistente y montaje de paneles flotantes
- `dev-runtime-bundle.test.ts` — gate de producción que aísla el bundle del runtime de desarrollo
- `dev-runtime-json-schema.test.ts` — generación del JSON Schema que alimenta al editor Monaco
- `dev-runtime-monaco-editor.test.tsx` — integración del editor Monaco dentro del runtime de desarrollo
- `dev-runtime-state-bridge.test.tsx` — puente de estado entre editor y runtime
- `dev-runtime-state-migration.test.ts` — migración de estado persistido del runtime de desarrollo
- `dev-runtime.test.tsx` — modo desarrollo end-to-end: pipelines de commit y panel de traducciones
- `endpoints-config-schema.test.ts` — parseo tolerante del bloque de endpoints con validación por operación
- `floating-monaco-panel.test.tsx` — panel flotante que aloja Monaco con aplicar/copiar y errores de commit
- `floating-node-palette.test.tsx` — panel flotante que aloja la paleta de nodos del canvas
- `floating-selection-overlay.test.tsx` — overlay flotante con breadcrumb, propiedades y borrado del nodo seleccionado
- `icon-picker-property-field.test.tsx` — cuadrícula paginada de selección de icono con filtro y teclado
- `inject-condition-group-widget-sentinel.test.ts` — inyector del sentinel del widget de condición dentro del JSON Schema
- `inject-navigate-params-widget-sentinel.test.ts` — inyector del sentinel del widget de `navigateTo.params` dentro del JSON Schema
- `layout-canvas-ancestor-container-columns.test.ts` — resolución de columnas del container ancestro más cercano por path
- `layout-canvas-breadcrumb.test.tsx` — breadcrumb de ancestros del canvas con navegación de selección por segmento
- `layout-canvas-commit.test.tsx` — pipeline de commit del canvas: validación, migración y parcheo aislado de layout y de preloads (globales y por página)
- `layout-canvas-delete-node.test.tsx` — borrado del nodo seleccionado end-to-end con excepción para celdas de tabla
- `layout-canvas-dnd-wiring.test.tsx` — cableado de arrastre y soltado del canvas con exclusión de celdas de tabla
- `layout-canvas-drop-validity.test.ts` — reglas puras de validez de destino de arrastre y ciclos
- `layout-canvas-grid-drop-zones.test.tsx` — overlay de zonas de inserción para containers en modo grid
- `layout-canvas-node-schema.test.ts` — derivación cacheada de JSON Schema por tipo y catálogo de tipos soportados
- `layout-canvas-palette-insert.test.tsx` — paleta e inserción por arrastre respetando reglas de destino
- `layout-canvas-properties-panel-commit-feedback.test.tsx` — feedback de commit rechazado del panel de propiedades y persistencia del valor introducido
- `layout-canvas-properties-panel.test.tsx` — panel de propiedades del nodo seleccionado con sus widgets y subsecciones
- `layout-canvas-properties-panel-gallery.test.tsx` — panel de propiedades end-to-end para `gallery`: selector Origen (Estático/Dinámico) y widget de `props.source` en modo dinámico, con visibilidad condicional de los campos generados por el dispatcher
- `layout-canvas-property-field-choice-items.test.tsx` — editor de items de elección con modos manual literal, escalar y dinámico
- `layout-canvas-property-field-color-swatch.test.tsx` — widget aislado de muestras de color con roving tabindex y flechas
- `layout-canvas-property-field-container-columns-mode.test.tsx` — widget del modo del container que alterna Grid/Columnas preservando el resto de props
- `layout-canvas-property-field-dispatcher.test.tsx` — dispatcher genérico de campos de propiedades y hook de widgets registrados
- `layout-canvas-property-field-gallery-dynamic-source.test.tsx` — widget aislado `GalleryDynamicSourcePropertyField`: modos src/fetch, cambio de modo, `idField` (FR7) y degradación ante valor no reconocible
- `layout-canvas-property-field-gallery-origin-mode.test.tsx` — widget aislado `GalleryOriginModePropertyField`: detección de modo, alternancia Estático/Dinámico (sin restaurar el valor descartado) e idempotencia
- `layout-canvas-property-field-heading-level.test.tsx` — widget aislado del nivel de heading como radiogroup H1..H5
- `layout-canvas-property-field-key-value.test.tsx` — editor clave-valor para mapas string a string con excepción de body y predicado de editabilidad por fila configurable
- `layout-canvas-property-field-layout-span-occupancy-preview.test.tsx` — barra de vista previa de ocupación del span con clamp y leyenda
- `layout-canvas-property-field-layout-span.test.tsx` — widget aislado del span responsive con seis filas y focus-driven preview
- `layout-canvas-property-field-link-content-mode.test.tsx` — widget del modo de contenido del enlace entre texto y elementos anidados
- `layout-canvas-property-field-table-cell-type.test.tsx` — widget aislado del tipo de celda de tabla con reconstrucción por tipo elegido
- `layout-canvas-property-field-table-column-flags.test.tsx` — widget aislado de "Ordenable"/"Filtrable"/placeholder de una columna de tabla y su lógica pura de alta/actualización/baja en `columns[]`
- `layout-canvas-property-field-table-rows.test.tsx` — widget aislado de filas y columnas de tabla en modo manual y dinámico
- `layout-canvas-property-field-tabs-orientation.test.tsx` — widget aislado de la orientación de tabs como radiogroup horizontal/vertical
- `layout-canvas-reorder-reinsert.test.tsx` — reordenar y reanidar nodos por arrastre end-to-end con seguimiento de selección
- `layout-tree-mutations.test.ts` — funciones puras de mutación del árbol por path, incluyendo tablas y tabs
- `navigate-params-property-field.test.tsx` — widget aislado de `navigateTo.params` con degradación a solo lectura para valores no-string
- `node-panel-tab-bar.test.tsx` — barra de pestañas accesible del panel de nodo con roving tabindex y flechas circulares
- `node-panel-tabs.test.ts` — resolución pura del catálogo de pestañas del panel según el schema y el contexto
- `pages-config-panel-orphan-scan.test.ts` — escaneo estructural de referencias `navigateTo` huérfanas hacia una página en layouts, header y sidebar
- `pages-config-panel-rules.test.ts` — reglas puras de alta/borrado de página: normalización de id, unicidad y motivo de bloqueo de borrado
- `pages-config-panel.test.tsx` — `PagesConfigPanel` aislado: listado, alta, edición de título, designación de página inicial, borrado con confirmación y feedback de commit rechazado
- `pages-delete-confirm-dialog.test.tsx` — diálogo `alertdialog` de confirmación de borrado de página: aviso de referencias huérfanas, cierre por Esc/clic fuera, botones y gestión de foco al montar/desmontar
- `platages-http-client.test.ts` — cliente HTTP compartido a Platages: forma de la petición y mapeo de errores
- `query-state-feedback-accordion-property-field.test.tsx` — acordeón de reglas de feedback por estado de query con preservación de fallback
- `query-state-feedback-accordion-state.test.ts` — funciones puras del estado del acordeón de feedback de query
- `resolve-endpoint-operation.test.ts` — resolución de una operación de endpoint frente a config y tokens
- `runtime-nodes-bundle.test.ts` — gate de code splitting que verifica un chunk independiente por nodo
- `save-config-provider.test.ts` — proveedor de guardado de configuración a Platages con mapeo de resultado y errores
- `segmented-toggle-property-field.test.tsx` — toggle segmentado compartido con teclado y renderizado accesible
- `shell-collapse-state.test.ts` — funciones puras y hook de estado de colapso del árbol del shell por path
- `shell-config-panel-dnd.test.tsx` — módulo de arrastre unificado del árbol del shell con parseo de zonas y validez
- `shell-config-panel.test.tsx` — panel de configuración del shell end-to-end sobre el pipeline real de commit
- `shell-menu-list-editor.test.tsx` — editor de la lista del menú del header con desplegable y arrastre entre niveles
- `shell-sidebar-list-editor.test.tsx` — editor de la lista del sidebar con anidamiento sin tope y arrastre entre niveles
- `shell-tree-mutations.test.ts` — funciones puras de mutación del árbol del shell por path posicional
- `token-delete-confirm-dialog.test.tsx` — diálogo `alertdialog` de confirmación de borrado de token: aviso de referencias huérfanas en cabeceras, cierre por Esc/clic fuera, botones y gestión de foco al montar/desmontar
- `token-refresh-fields-editor.test.tsx` — sub-formulario aislado del bloque `refresh` de un token: activación, campos condicionales, referencia rota y feedback de commit rechazado por campo
- `tokens-config-panel-orphan-scan.test.ts` — escaneo estructural de referencias `tokens.{id}.value` huérfanas en `headers` de operaciones, layouts y precargas
- `tokens-config-panel.test.tsx` — `TokensConfigPanel` aislado: listado, alta, edición de `value`, integración del sub-formulario `refresh` y borrado con confirmación y feedback de commit rechazado
- `translations-config-panel.test.tsx` — panel aislado de traducciones con edición manual, búsqueda, refresco y feedback
- `translations-provider.test.ts` — proveedor de traducciones Platages: resolución de baseUrl, peticiones y mapeo de errores
