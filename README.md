# React Form Builder

Aplicación web construida con `Vite`, `React` y `Tailwind` para renderizar interfaces declarativas a partir de una configuración JSON servida por backend.

## Objetivo

El proyecto actúa como runtime de UI configurable:
- recibe una configuración JSON en el elemento root mediante `data-config`
- renderiza páginas, layouts, formularios y listas
- ejecuta llamadas API declaradas en la configuración
- mantiene estado compartido de formularios, navegación y queries para que la UI pueda reaccionar con carga, error, vacío y éxito

## Documentación

- [`ai-workflow/docs/context.md`](ai-workflow/docs/context.md): contexto global del producto
- [`ai-workflow/docs/app-features/index.md`](ai-workflow/docs/app-features/index.md): índice funcional de la aplicación
- [`ai-workflow/docs/architecture.md`](ai-workflow/docs/architecture.md): arquitectura objetivo de la app
- [`ai-workflow/docs/conventions.md`](ai-workflow/docs/conventions.md): convenciones de implementación
- [`ai-workflow/docs/current-state.md`](ai-workflow/docs/current-state.md): estado vigente del proyecto
- [`ai-workflow/docs/onboarding.md`](ai-workflow/docs/onboarding.md): arranque local previsto
- [`ai-workflow/docs/workflow.md`](ai-workflow/docs/workflow.md): workflow guiado por specs
- [`ai-workflow/features/index.md`](ai-workflow/features/index.md): índice de features planificadas

## Estado actual

La base documental ya está orientada a la nueva app, pero todavía no se ha abierto ninguna feature concreta del workflow. El siguiente paso natural es usar este contexto para redactar la primera `spec.md` cuando cerremos la feature inicial.
