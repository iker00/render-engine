# Features Index

## Template

## Workflow actual

Cada feature nueva debería usar, cuando aplique:
- `discovery.md` para exploración previa
- `spec.md` como contrato funcional
- `design.md` para cambios con complejidad o riesgo relevante
- `tasks.md` como contrato de ejecución
- `test-plan.md` como contrato de verificación
- `status.yaml` como estado estructurado del workflow

La política completa está en [`../docs/workflow.md`](../docs/workflow.md).

## Planificadas
- Ninguna ahora mismo.

## Completadas
- `0028-form-container-alignment`: los `container` dentro de `form` ya no se renderizan con sangrado lateral ni márgenes negativos implícitos; conservan la superficie visual de sección cuando actúan como bloques verticales o usan `columns`, y los `direction: row` sin `columns` quedan como layouts lineales `plain`.
- `0027-expanded-container-layout-controls`: `container` ya soporta `gap` con default `md` y aliases `sm | md | lg | xl | 2xl`, distribución declarativa de `1` a `12` columnas, `align`, `justify` y `wrap`, con precedencia de `columns` sobre `direction`, rechazo explícito de `columns + wrap` y compatibilidad mantenida con `gap` arbitrario como escape hatch acotado.
- `0026-sede-electronica-visual-alignment`: el runtime ya adopta un baseline visual institucional claro para shell, contenido y formularios, con tokens globales CSS-first en `Tailwind CSS v4`, secciones de formulario separadas por divisor superior y una configuración de desarrollo representativa alineada con la referencia de sede electrónica.
- `0025-preload-query-reset-on-page-entry`: cada nueva `pageEntry` con `preloads` ya limpia primero solo sus queries declaradas, las deja directamente en `loading` antes del primer render útil y evita que páginas o formularios hidraten consumidores visibles o `defaultValue` con datos de la entrada anterior, sin cambiar la semántica manual de recarga.
- `0024-query-driven-repeated-layout-node`: nuevo nodo declarativo `repeater` para repetir un subárbol completo una vez por cada item de una colección resuelta desde `queries.*`, con contexto local `item.*`, integración en navegación y requests declarativos, soporte en formularios y consumidores descendientes de colecciones.
- `0023-declarative-form-validation-rules`: ampliar la validación local de formularios con una superficie común y extensible por regla, incorporando `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections` sin abrir todavía validaciones remotas, cruzadas ni mensajes personalizados efectivos.
- `0022-form-runtime-state-reset-on-unmount`: `form` ya elimina por defecto su estado local al desmontarse, recalcula `defaultValue` al remontar tras una reentrada real y permite conservar la persistencia histórica solo con `persistOnUnmount`.
- `0021-reusable-form-field-expansion`: ampliar el catálogo reutilizable de formularios con más tipos útiles de `input`, añadir `radioGroup` y `checkboxGroup`, y extender `select` con multiselección compartiendo la misma semántica declarativa de extracción de opciones desde colecciones manuales o `queries.*`.
- `0020-navigate-to-page-params`: `navigateTo` ya puede transportar params declarativos escalares por entrada, el historial interno restaura esos params con `goBack`, `params.*` ya puede reutilizarse en texto, requests y `defaultValue`, y `preloads` se relanzan por reentradas observables de la misma página con params distintos.
- `0001-bootstrap-project-dependencies`: bootstrap técnico reproducible con frontend de paquete único, scripts base de desarrollo/validación y carga inicial de configuración desde `data-config` o `src/dev/config.json`.
- `0002-basic-static-renderer`: contrato mínimo de `pages` + `initialPage` + `layout`, renderer estático inicial para `container`, `heading`, `paragraph` y `list`, y sustitución del shell provisional por la primera página declarativa visible.
- `0003-layout-array-page-structure`: migración estricta de `pages[].layout` a colección ordenada, soporte de varios hermanos raíz sin `container` sintético y actualización del bootstrap/tests al nuevo contrato.
- `0004-runtime-structure-reorganization`: reorganización interna de `src/config/` y `src/runtime/` para separar contrato, validación y render por nodo sin cambiar el comportamiento funcional del runtime.
- `0005-tailwind-runtime-styling-baseline`: migración del styling visible de `container`, `heading`, `paragraph` y `list` a `Tailwind CSS`, con compatibilidad acotada para `gap` arbitrarios y sin introducir todavía theming ni una API visual declarativa.
- `0006-shared-runtime-state-core`: núcleo de estado compartido por instancia para navegación interna, formularios y queries, validado con aislamiento entre runtimes y preparado como base para las próximas features interactivas.
- `0007-centralized-runtime-reference-resolution`: convención funcional central para resolver referencias string del JSON como `forms.*` y `queries.*` desde una capa común y extensible del runtime, evitando lógica dispersa en nodos visuales.
- `0008-nested-query-data-reference-navigation`: ampliación de la convención de referencias para permitir subrutas anidadas dentro de `queries.{queryName}.data`, incluyendo navegación por objetos y colecciones sin abrir un lenguaje general de expresiones.
- `0009-declarative-api-boundary`: `api` ya actúa como catálogo declarativo tipado y validado, con construcción de requests, ejecución real por nombre y proyección del resultado en `queries.{operationName}` sin acoplar la UI a detalles HTTP.
- `0010-page-entry-query-preloads`: las páginas ya pueden declarar `preloads` para disparar operaciones `api` al entrar, con agregado `pageEntry` latest-only y compatibilidad hacia atrás para configuraciones sin precargas.
- `0012-zod-runtime-config-validation`: la validación del runtime config ya se apoya en esquemas `Zod`, conserva la frontera pública de bootstrap y mantiene las validaciones cruzadas estables con diagnósticos de ruta más trazables.
- `0013-declarative-query-state-feedback`: feedback visual declarativo por nodo ligado originalmente al estado `loading | error | empty | success` de una query concreta. Su semántica vigente quedó ampliada y corregida por `0016-query-state-feedback-idle-state`, que separa `idle` de `loading`.
- `0014-shared-runtime-ui-actions-foundation`: base común de acciones UI reutilizable desde `button.props.action`, con soporte estable para `navigateTo`, `goBack`, `executeOperation` y `resetForm` sin abrir todavía un sistema general de eventos.
- `0015-declarative-form-node-catalog`: catálogo declarativo mínimo de formularios con `form`, `input`, `textarea` y `select`, inicialización lazy en `forms.*`, validación `required` y submit vía `executeOperation`.
- `0016-query-state-feedback-idle-state`: `queryStateFeedback` ya distingue `idle` de `loading`, trata la query ausente como `idle`, permite reglas declarativas específicas antes de la primera ejecución y reutiliza la misma semántica visible en renderer y validación de formularios.
- `0017-multi-value-data-sources`: `list` y `select` ya pueden consumir colecciones manuales o datos de `queries.*`, con mapeos declarativos por consumidor, degradación a vacío para datos no coleccionables y coherencia entre render, formularios y validación.
- `0018-action-level-api-request-params`: `api` ya formaliza `headers` como canal estable y `button.props.action` y `form.submitAction` ya pueden aportar `query`, `body` y `headers` por ejecución para reutilizar una misma operación remota con parámetros variables.
- `0019-declarative-runtime-visibility-rules`: cualquier nodo soportado ya puede declarar `visibility` para mostrarse u ocultarse según `forms.*` o `queries.*`, con precedencia estable respecto a `queryStateFeedback` y coherencia entre renderer y validación de formularios.
