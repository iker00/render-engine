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

## Completadas
- `0001-bootstrap-project-dependencies`: bootstrap técnico reproducible con frontend de paquete único, scripts base de desarrollo/validación y carga inicial de configuración desde `data-config` o `src/dev/config.json`.
- `0002-basic-static-renderer`: contrato mínimo de `pages` + `initialPage` + `layout`, renderer estático inicial para `container`, `heading`, `paragraph` y `list`, y sustitución del shell provisional por la primera página declarativa visible.
- `0003-layout-array-page-structure`: migración estricta de `pages[].layout` a colección ordenada, soporte de varios hermanos raíz sin `container` sintético y actualización del bootstrap/tests al nuevo contrato.
- `0004-runtime-structure-reorganization`: reorganización interna de `src/config/` y `src/runtime/` para separar contrato, validación y render por nodo sin cambiar el comportamiento funcional del runtime.
- `0005-tailwind-runtime-styling-baseline`: migración del styling visible de `container`, `heading`, `paragraph` y `list` a `Tailwind CSS`, con compatibilidad acotada para `gap` arbitrarios y sin introducir todavía theming ni una API visual declarativa.
