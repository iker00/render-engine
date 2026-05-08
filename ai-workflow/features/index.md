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
