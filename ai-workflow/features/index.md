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

## Completadas
- `0001-bootstrap-project-dependencies`: bootstrap técnico reproducible con frontend de paquete único, scripts base de desarrollo/validación y carga inicial de configuración desde `data-config` o `src/dev/config.json`.
- `0002-basic-static-renderer`: contrato mínimo de `pages` + `initialPage` + `layout`, renderer estático inicial para `container`, `heading`, `paragraph` y `list`, y sustitución del shell provisional por la primera página declarativa visible.
- `0003-layout-array-page-structure`: migración estricta de `pages[].layout` a colección ordenada, soporte de varios hermanos raíz sin `container` sintético y actualización del bootstrap/tests al nuevo contrato.
- `0004-runtime-structure-reorganization`: reorganización interna de `src/config/` y `src/runtime/` para separar contrato, validación y render por nodo sin cambiar el comportamiento funcional del runtime.
- `0005-tailwind-runtime-styling-baseline`: migración del styling visible de `container`, `heading`, `paragraph` y `list` a `Tailwind CSS`, con compatibilidad acotada para `gap` arbitrarios y sin introducir todavía theming ni una API visual declarativa.
- `0006-shared-runtime-state-core`: núcleo de estado compartido por instancia para navegación interna, formularios y queries, validado con aislamiento entre runtimes y preparado como base para las próximas features interactivas.
- `0007-centralized-runtime-reference-resolution`: convención funcional central para resolver referencias string del JSON como `forms.*` y `queries.*` desde una capa común y extensible del runtime, evitando lógica dispersa en nodos visuales.
- `0008-nested-query-data-reference-navigation`: ampliación de la convención de referencias para permitir subrutas anidadas dentro de `queries.{queryName}.data`, incluyendo navegación por objetos y colecciones sin abrir un lenguaje general de expresiones.
- `0009-declarative-api-boundary`: `api` ya actúa como catálogo declarativo tipado y validado, con construcción de requests, ejecución real por nombre y proyección del resultado en `queries.{operationName}` sin acoplar la UI a detalles HTTP.
