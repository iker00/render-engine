# Índice de ficheros de test

Mapa de `src/tests/` por área funcional. Los ficheros están organizados en subcarpetas temáticas. Actualizar cuando se añada, divida, mueva o elimine un fichero de test.

## Estructura de carpetas

```
src/tests/
├── setup.ts                        — configuración global de Vitest
├── app/                            — bootstrap y shell
├── config-validation/              — validación de la config en tiempo de carga
├── layout-renderer/                — renderizado de nodos del layout
├── runtime-state/                  — store de estado compartido en runtime
├── runtime/                        — comportamiento runtime por área funcional
└── dev-runtime/                    — modo desarrollo (editor Monaco, drawer, bundle)
```

---

## app/

- `app-bootstrap.test.tsx` — lectura y parsing de la configuración en bootstrap
- `app-shell.test.tsx` — composición del shell de la aplicación
- `main.test.tsx` — punto de entrada principal

## config-validation/

- `helpers.ts` — helpers compartidos por todos los ficheros de validación (sin tests)
- `runtime-config-root-zod.test.ts` — esquema Zod raíz de la config
- `read-runtime-config.test.ts` — lectura y normalización de la config desde el DOM
- `runtime-config-validation-preloads.test.ts` — layout raíz básico, preloads: aceptación y rechazo (~450 líneas)
- `runtime-config-validation-buttons.test.ts` — botones y acciones: navigateTo, goBack, executeOperation, resetForm, leaf nodes, validación estructural y cruzada del nodo `link` (~700 líneas)
- `runtime-config-validation-qsf.test.ts` — queryStateFeedback: estados, fallback, rechazo (~430 líneas)
- `runtime-config-validation-forms-validations.test.ts` — formularios: aceptación, normalización de reglas de validación (~580 líneas)
- `runtime-config-validation-forms-semantics.test.ts` — formularios: restricciones de placement, IDs duplicados, submitAction, persistOnUnmount (~750 líneas)
- `runtime-config-validation-collections.test.ts` — contrato de fuentes de colección multi-valor (~860 líneas)
- `runtime-config-validation-form-fields.test.ts` — expansión de campos de formulario reutilizables + tests de estructura (~1129 líneas)
- `runtime-config-validation-api-operations.test.ts` — operaciones API: métodos, query/body/headers, extra keys, body trees (~490 líneas)
- `runtime-config-validation-visibility.test.ts` — reglas de visibility: operadores, referencias (incluido `params.{paramName}`), valores, extra keys (~807 líneas)
- `runtime-config-validation-navigate-params.test.ts` — navigateTo.params, validaciones de params y colecciones antes de render (~310 líneas)
- `runtime-config-validation-repeater.test.ts` — nodo repeater: fuente, key (incluido `$index`), template, paginación (~560 líneas)
- `runtime-config-validation-containers.test.ts` — contrato de layout de contenedores (~959 líneas)
- `runtime-config-validation-image-table.test.ts` — validación de nodos image y table (~635 líneas)
- `runtime-config-validation-modal.test.ts` — validación de nodo modal: shape, children permitidos, unicidad de id, referencias modalId, prohibición de defaultOpen en repeater (~700 líneas)
- `runtime-config-validation-alert.test.ts` — validación del nodo `alert`: aceptación con type/message/title/transversales, rechazo de message ausente o no string, type inválido, title no string (~nuevo)
- `runtime-config-validation-stat.test.ts` — validación del nodo `stat`: aceptación con label/value/variant/color/transversales/children ignorados, rechazo de label ausente o no string, value ausente o no string, variant inválido, color inválido, layout.span inválido (~nuevo)
- `runtime-config-validation-divider.test.ts` — validación del nodo `divider`: aceptación sin props, con todas las variantes, con transversales (visibility/queryStateFeedback/layout.span), con children silenciosamente descartados, dentro de container; rechazo de variant inválido y layout.span fuera de rango (~nuevo)
- `runtime-config-validation-file-manager.test.ts` — validación del nodo `fileManager`: operaciones (getOperation/uploadOperation/deleteOperation/viewOperation/downloadOperation) como string/false/omitida, fieldName requerido cuando omitida, validaciones (accept/maxFileSize/maxTotalSize/minFiles/maxFiles/validFileNames), pagination.pageSize, bootstrap checks (~nuevo)
- `runtime-config-validation-toggle.test.ts` — validación del nodo `toggle`: shape con props mínimos, labelPosition, defaultValue boolean/referencia, validations.required aceptado, reglas no aplicables rechazadas, form-only, transversales, repeater, fieldId duplicado (~nuevo)
- `runtime-config-validation-hidden.test.ts` — validación del nodo `hidden`: shape con fieldId y value (string/number/boolean/referencia), rechazo de props prohibidos (label/validations/defaultValue/placeholder/icon/iconPosition), rechazo de visibility y queryStateFeedback, form-only, repeater, fieldId duplicado (~nuevo)
- `runtime-config-validation-tooltip.test.ts` — validación de `props.tooltip` en los siete field nodes: aceptación como string (vacío, no vacío, interpolado), rechazo como número/boolean/array, aceptación sin tooltip sin regresión (~nuevo)
- `layout-placement-rules.test.ts` — predicados puros de colocación estructural (`nodeTypeAcceptsChildren`, `buttonRequiresFormAncestor`, `FORM_ONLY_LEAF_NODE_TYPES`, `FORM_ALLOWED_DESCENDANT_TYPES`, `MODAL_ALLOWED_CHILD_TYPES`, `LINK_ALLOWED_CHILD_TYPES`) reutilizados por la validación de config y por el motor de validez de drop del editor visual (~nuevo)

## layout-renderer/

- `layout-renderer-basic-nodes.test.tsx` — root ordering, empty layout, list items estáticos/dinámicos/objeto, leaf behavior, clases Tailwind (~640 líneas)
- `layout-renderer-container.test.tsx` — container direction, gap, columns, variant, align/justify/wrap (~230 líneas)
- `layout-renderer-state-feedback.test.tsx` — queryStateFeedback (todos los estados) + visibility rules (~760 líneas)
- `layout-renderer-image-table.test.tsx` — image nodes + tables manual/dynamic/filterable/sortable (~580 líneas)
- `layout-renderer-table-pagination.test.tsx` — paginación de tabla (previousNext, numbered, scroll, IntersectionObserver) (~620 líneas)
- `layout-renderer-table-rich-cells.test.tsx` — celdas ricas en tabla: image/button/container/heading/paragraph, item.* en dinámico, visibility/qsf, filtros/ordenación con nodos (~400 líneas)
- `layout-renderer-buttons-text.test.tsx` — button nodes, nodo `link` (href, download, target, action navigateTo/goBack, referencias dinámicas, campos transversales), navegación declarativa, interpolación de texto y referencias (~500 líneas)
- `layout-renderer-forms.test.tsx` — forms declarativos, orden de campos, labels interpolados, semántica de secciones (~640 líneas)
- `layout-renderer-grid-spans.test.tsx` — layout.span, columnas responsive, span clamping, fallbacks móvil (~550 líneas)
- `layout-renderer-forms-fields.test.tsx` — tipos de campo expandidos, opciones dinámicas, labels/valores interpolados, defaults lazy (~1100 líneas)
- `layout-renderer-repeater-basic.test.tsx` — iteraciones, orden de colección, resolución item.*, key diagnostics, `$index` key e `item.$index` sintético (~1077 líneas)
- `layout-renderer-repeater-pagination.test.tsx` — controles previousNext, numbered, scroll, grid row (~530 líneas)
- `layout-renderer-repeater-state.test.tsx` — resets por colección/pageSize, repeaters independientes, scalar items, qsf+visibility (~400 líneas)
- `layout-renderer-modal.test.tsx` — render condicional del modal, apertura/cierre por botón/ESC/overlay, tamaños, defaultOpen, visibility, focus trap (~500 líneas)
- `layout-renderer-modal-repeater.test.tsx` — modal dentro de repeater.props.template, identidad por iteración, item.* en modal, cierre global uno a la vez (~400 líneas)
- `layout-renderer-alert.test.tsx` — render básico del nodo `alert`: colores por tipo, icono placeholder, title/message, interpolación, transversales, integración repeater y form (~nuevo)
- `layout-renderer-stat.test.tsx` — render del nodo `stat`: variantes accent/tinted, paleta de seis colores (borde y fondo/texto), label/value visibles, interpolación, transversales (visibility/queryStateFeedback/layout.span), integración repeater con item.* y form (~nuevo)
- `layout-renderer-divider.test.tsx` — render del nodo `divider`: data-layout-node, variantes solid/dashed/dotted/invisible (clases Tailwind), visibility (visible/oculto), layout.span dentro de container con columns, repetición en repeater, ausencia de children en el DOM (~nuevo)
- `layout-renderer-file-manager.test.tsx` — render del nodo `fileManager`: zona DnD, selector nativo, subida secuencial, barra de progreso, validaciones client-side (accept/maxFileSize/maxTotalSize/maxFiles/validFileNames/duplicados/0 bytes), lista paginada, botones Ver/Descargar/Eliminar, precarga con getOperation, independencia del formulario, transversales (visibility/queryStateFeedback/layout.span) (~nuevo)
- `layout-renderer-toggle.test.tsx` — render del nodo `toggle`: role="switch", aria-checked, defaultValue, labelPosition (top/inline), click toggling, required (exige true), submit bloqueado/permitido, aria-describedby, visibility, repeater con item.*, payload boolean, reevaluación, layout.span, queryStateFeedback (~nuevo)
- `layout-renderer-hidden.test.tsx` — render del nodo `hidden`: sin DOM visible, value literal (string/number/boolean), value referencia dinámica, inicialización no lazy al montar form, no bloquea submit, incluido en payload, repeater con item.*, dentro de container con visibility oculta sigue inicializado y en payload (~nuevo)
- `layout-renderer-tooltip.test.tsx` — render del componente `FieldTooltip` aislado (icono, accesibilidad, no-render con texto vacío/undefined) e integración del tooltip en los siete field nodes (input, textarea, select, radioGroup, checkboxGroup, toggle top/inline, fileInput), interpolación, string vacío, referencia no resuelta, coexistencia con icon, no interferencia con validación/submit (~nuevo)
- `layout-node-renderer-edit-mode.test.tsx` — modelo de `path` (`getNodeAtPath`, `serializeLayoutNodePath`), threading de `path`/`buildChildPath` en `LayoutRenderer`, wrapper de selección/hover condicionado a `LayoutEditModeContext`, regresión byte a byte sin proveedor (~nuevo)
- `layout-renderer-edit-mode-placeholders.test.tsx` — placeholder visible y seleccionable de `container`/`form` vacíos en modo edición, ausencia total del placeholder en producción (~nuevo)
- `layout-renderer-repeater-edit-mode.test.tsx` — `repeater` en modo edición: instancia única de `props.template` con y sin colección resuelta, sin controles de paginación, path con tramo `template` (~nuevo)
- `layout-renderer-accordion-edit-mode.test.tsx` — `accordion` en modo edición: cuerpo siempre presente con independencia de `defaultOpen`/toggle, path de los hijos, regresión de colapso en producción (~nuevo)
- `layout-renderer-tabs-edit-mode.test.tsx` — `tabs` en modo edición: path con tramo `tabItem` por pestaña activa, regresión de navegación entre pestañas en producción (~nuevo)
- `layout-renderer-modal-edit-mode.test.tsx` — `modal` en modo edición: panel siempre presente con independencia de `defaultOpen`/`openModal`, regresión de cierre en producción (~nuevo)

## runtime-state/

- `helpers.tsx` — fixtures React compartidos: FormRuntimeFixture, RepeaterFormFixture, DynamicSelectQueryFixture, VisibilityRuleQueryFixture (sin tests)
- `runtime-state-navigation.test.tsx` — inicialización del store, navegación, hash, goBack, history, preloads (~583 líneas)
- `runtime-state-forms-queries.test.tsx` — form store (crear/actualizar/reset/eliminar), query state básico, selectors, feedback defaults (~756 líneas)
- `runtime-state-operations.test.tsx` — ejecución de operaciones, errores, respuesta vacía, isolación entre instancias (~380 líneas)
- `runtime-state-form-lifecycle.test.tsx` — unmount/remount, persistOnUnmount, page-entry invalidation, query-driven defaults (~608 líneas)
- `runtime-state-declarative-forms.test.tsx` — select normalization, dynamic defaults, select.multiple, radioGroup, checkboxGroup (~459 líneas)
- `runtime-state-validations-visibility.test.tsx` — campos requeridos ocultos por visibility/qsf/container/repeater (~490 líneas)
- `runtime-state-validations-rules.test.tsx` — reglas avanzadas: length/number/multiselect, inicialización lazy, revalidación en edición (~520 líneas)
- `runtime-state-validations-dynamic-select.test.tsx` — select dinámico: limpieza de valor, submit con empty, formularios declarativos (~270 líneas)
- `runtime-state-modal.test.tsx` — estado del modal, acción open/close, regla uno a la vez, cierre por navegación/page-entry, identidad por iteración (~350 líneas)
- `runtime-state-validations-when.test.tsx` — validación condicional `when`: required/minLength/pattern con condición cumplida/no cumplida, varias reglas con when sin match, mezcla con/sin when, retrocompatibilidad sin when, reevaluación local, referencia queries.*, referencia ausente (~nuevo)

## runtime/

- `runtime-button-navigation.test.tsx` — navegación declarativa desde botones
- `runtime-page-entry-preloads.test.tsx` — precarga de operaciones al entrar en página
- `runtime-api-execution.test.ts` — ejecución de operaciones y ciclo de vida de queries
- `runtime-reference-resolution.test.tsx` — resolución de referencias declarativas (`forms.*`, `queries.*`, `item.*`, `item.$index`, `params.*`) (~1638 líneas)
- `runtime-layout-visibility.test.ts` — reglas de visibilidad por condición: operadores, referencias (incluido `params.{paramName}`) y semántica de ausencia (~889 líneas)
- `runtime-form-validations.test.ts` — validaciones locales de formulario en submit
- `runtime-api-payload-omission.test.ts` — omisión de claves en payload cuando referencia un campo oculto del propio form (unit tests) (~320 líneas)
- `runtime-form-submit-hidden-fields.test.tsx` — end-to-end: submit de form con campos ocultos omite claves del wire format (~808 líneas)
- `runtime-collection-pagination.test.ts` — paginación local de colecciones
- `runtime-browser-hash-navigation.test.ts` — sincronización de navegación con hash del navegador
- `runtime-node-styling.test.ts` — utilidades de estilo y clases Tailwind de nodos
- `runtime-api-multipart.test.ts` — construcción de FormData en el builder de requests, manejo de files en multipart/form-data, flatness de body con escalares (~nuevo)
- `runtime-file-manager-normalize-name.test.ts` — normalización de nombre de fichero: caracteres inválidos Windows, espacios al final, nombres reservados, truncado a 255 caracteres, prefijo (~nuevo)
- `runtime-file-manager-hook.test.tsx` — comportamiento del nodo fileManager: subida secuencial, validaciones client-side, lista paginada, botones Ver/Descargar/Eliminar, precarga, integración con queries state (~nuevo)
- `runtime-node-components-map.test.tsx` — mapa central de componentes de nodo: cobertura de todas las 26 claves, valores truthy, rama eager activa en modo test (~nuevo)
- `runtime-lazy-node.test.tsx` — wrapper LazyNode con Suspense + error boundary: success, suspense (null), error (indicador con role="alert"), contención por instancia (~nuevo)
- `runtime-formatter-parser.test.ts` — parser de la cadena `referencia | formatter[:arg] | ...` dentro de placeholders: fast-path `hasFormatterSyntax`, `parseFormatterPlaceholder` (estados `no-formatters`/`ok`/`unresolvable-chain`), encadenamiento, strings con `|` internos, gramática de argumento único (string entre `"..."` o número con signo/decimales), casos inválidos (nombre no identificador, `:` sin argumento, string sin cerrar, carácter extraño, referencia vacía) (~nuevo)
- `runtime-formatter-registry.test.ts` — catálogo cerrado v1 de formatters (`number`, `currency`, `date`, `percent`, `uppercase`, `lowercase`, `capitalize`, `truncate`) con locale fijo `es-ES`, tokenización manual `dd/MM/yyyy HH:mm:ss` (getters UTC para date-only, locales para date-time con `T`), compatibilidad de valor de entrada por formatter, `applyFormatterChain` con corte al primer `unresolvable`, cache de instancias `Intl.NumberFormat` por combinación de opciones (~nuevo)
- `runtime-table-processing.test.ts` — filtrado, ordenación y procesamiento local de tablas
- `runtime-ui-actions.test.tsx` — ejecución de acciones UI (clicks, submit) y delegación al executor compartido

## dev-runtime/

- `dev-runtime.test.tsx` — comportamiento del modo desarrollo
- `dev-runtime-drawer.test.tsx` — drawer del dev runtime
- `dev-runtime-state-bridge.test.tsx` — puente de estado entre editor y runtime
- `dev-runtime-state-migration.test.ts` — migración de estado del dev runtime
- `dev-runtime-json-schema.test.ts` — generación del JSON schema para el editor
- `dev-runtime-keyboard.test.ts` — atajos de teclado del dev runtime
- `dev-runtime-monaco-editor.test.tsx` — integración del editor Monaco
- `dev-runtime-bundle.test.ts` — bundle del dev runtime (gate de producción)
- `runtime-nodes-bundle.test.ts` — gate de code splitting de nodos: verifica que cada nodo produce su chunk independiente en build de producción (~nuevo)
- `dev-runtime-canvas-shell.test.tsx` — shell del canvas: pestañas Visual/JSON del drawer, selector de página, selección/hover, limpieza de selección al cambiar de página o de config (~nuevo)
- `layout-tree-mutations.test.ts` — funciones puras de mutación del árbol por `path` (`replaceNodeAt`, `insertNodeAt`, `removeNodeAt`, `movePathTo`), incluyendo el disambiguador `tabItemIndex` de `tabs` y el rechazo de ciclos (~nuevo)
- `layout-canvas-commit.test.tsx` — pipeline de commit del canvas: validación/migración igual que Aplicar, parcheo de solo la clave `layout` sobre el texto crudo, preservación de `preloads` y `form.onSuccess`/`onError` fuera del subárbol tocado (~nuevo)
- `layout-canvas-breadcrumb.test.tsx` — breadcrumb de ancestros: cadena de segmentos, etiqueta por `type`/`id`, navegación de selección por click en un segmento (~nuevo)
- `layout-canvas-node-schema.test.ts` — derivación de JSON Schema por tipo de nodo (`getNodeTypeJsonSchema`, cache) y catálogo completo de tipos soportados (`getSupportedNodeTypesCatalog`) (~nuevo)
- `layout-canvas-property-field-dispatcher.test.tsx` — dispatcher genérico de campos de propiedades: primitivas `string`/`number`/`boolean`/`enum`/`array`/`object` recursivas y vía de escape sin schema reconocible (~nuevo)
- `layout-canvas-properties-panel.test.tsx` — panel de propiedades del nodo seleccionado: secciones `props`/`layout`/`visibility`/`queryStateFeedback` según el schema, merge superficial de `layout.span` responsive, sincronización con `editorBuffer` (~nuevo)
- `layout-canvas-dnd-wiring.test.tsx` — integración de `@dnd-kit/core`: nodos arrastrables/droppable, intento de drop crudo (`draggedPath`/`targetParentPath`/`targetIndex`), cancelación sin destino (~nuevo)
- `layout-canvas-drop-validity.test.ts` — resolución de validez de destino de drop (`isValidDropTarget`): restricciones de `form`, `modal`/`link`, `repeater`, `tabs` con `targetTabItemIndex`, ciclos, origen paleta con `draggedNodeType` (~nuevo)
- `layout-canvas-reorder-reinsert.test.tsx` — reordenar y reanidar nodos existentes vía drag end-to-end: commit, invalidez sin cambio de estado, seguimiento de la selección tras mover el nodo seleccionado (~nuevo)
- `layout-canvas-palette-insert.test.tsx` — paleta de nodos e inserción vía drag: `buildDefaultNodeInstance` por tipo, inserción respetando las reglas de destino (~nuevo)
- `layout-canvas-delete-node.test.tsx` — borrado del nodo seleccionado (y su subárbol) end-to-end, limpieza de selección, sincronización con Monaco (~nuevo)
