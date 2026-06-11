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
- `runtime-config-validation-repeater.test.ts` — nodo repeater: fuente, key, template, paginación (~390 líneas)
- `runtime-config-validation-containers.test.ts` — contrato de layout de contenedores (~959 líneas)
- `runtime-config-validation-image-table.test.ts` — validación de nodos image y table (~635 líneas)
- `runtime-config-validation-modal.test.ts` — validación de nodo modal: shape, children permitidos, unicidad de id, referencias modalId, prohibición de defaultOpen en repeater (~700 líneas)
- `runtime-config-validation-alert.test.ts` — validación del nodo `alert`: aceptación con type/message/title/transversales, rechazo de message ausente o no string, type inválido, title no string (~nuevo)
- `runtime-config-validation-stat.test.ts` — validación del nodo `stat`: aceptación con label/value/variant/color/transversales/children ignorados, rechazo de label ausente o no string, value ausente o no string, variant inválido, color inválido, layout.span inválido (~nuevo)
- `runtime-config-validation-divider.test.ts` — validación del nodo `divider`: aceptación sin props, con todas las variantes, con transversales (visibility/queryStateFeedback/layout.span), con children silenciosamente descartados, dentro de container; rechazo de variant inválido y layout.span fuera de rango (~nuevo)

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
- `layout-renderer-repeater-basic.test.tsx` — iteraciones, orden de colección, resolución item.*, key diagnostics (~230 líneas)
- `layout-renderer-repeater-pagination.test.tsx` — controles previousNext, numbered, scroll, grid row (~530 líneas)
- `layout-renderer-repeater-state.test.tsx` — resets por colección/pageSize, repeaters independientes, scalar items, qsf+visibility (~400 líneas)
- `layout-renderer-modal.test.tsx` — render condicional del modal, apertura/cierre por botón/ESC/overlay, tamaños, defaultOpen, visibility, focus trap (~500 líneas)
- `layout-renderer-modal-repeater.test.tsx` — modal dentro de repeater.props.template, identidad por iteración, item.* en modal, cierre global uno a la vez (~400 líneas)
- `layout-renderer-alert.test.tsx` — render básico del nodo `alert`: colores por tipo, icono placeholder, title/message, interpolación, transversales, integración repeater y form (~nuevo)
- `layout-renderer-stat.test.tsx` — render del nodo `stat`: variantes accent/tinted, paleta de seis colores (borde y fondo/texto), label/value visibles, interpolación, transversales (visibility/queryStateFeedback/layout.span), integración repeater con item.* y form (~nuevo)
- `layout-renderer-divider.test.tsx` — render del nodo `divider`: data-layout-node, variantes solid/dashed/dotted/invisible (clases Tailwind), visibility (visible/oculto), layout.span dentro de container con columns, repetición en repeater, ausencia de children en el DOM (~nuevo)

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

## runtime/

- `runtime-button-navigation.test.tsx` — navegación declarativa desde botones
- `runtime-page-entry-preloads.test.tsx` — precarga de operaciones al entrar en página
- `runtime-api-execution.test.ts` — ejecución de operaciones y ciclo de vida de queries
- `runtime-reference-resolution.test.tsx` — resolución de referencias declarativas (`forms.*`, `queries.*`, `item.*`, `params.*`)
- `runtime-layout-visibility.test.ts` — reglas de visibilidad por condición: operadores, referencias (incluido `params.{paramName}`) y semántica de ausencia (~889 líneas)
- `runtime-form-validations.test.ts` — validaciones locales de formulario en submit
- `runtime-collection-pagination.test.ts` — paginación local de colecciones
- `runtime-browser-hash-navigation.test.ts` — sincronización de navegación con hash del navegador
- `runtime-node-styling.test.ts` — utilidades de estilo y clases Tailwind de nodos
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
