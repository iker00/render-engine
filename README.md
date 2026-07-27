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

## Bootstrap local

Requisitos mínimos:
- Node.js `22`
- `pnpm`

Comandos base:
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`

Comportamiento actual del arranque:
- en desarrollo, la app usa `src/dev/config.json` si el contenedor no aporta `data-config`
- si existe `data-config` en el elemento root, esa fuente tiene prioridad
- si falta una fuente soportada o el JSON es inválido, el shell muestra un error de bootstrap legible

## Estado actual

El repositorio ya dispone de bootstrap técnico reproducible:
- aplicación frontend de paquete único en la raíz
- shell inicial renderizado con `React`
- infraestructura de `lint`, `test` y `build`
- frontera explícita de arranque para resolver configuración desde `data-config` o `src/dev/config.json`

El runtime declarativo ya está implementado y estable (navegación, formularios, queries, validación estructural completa del contrato JSON). Para el estado vigente por área, ver [`ai-workflow/docs/current-state.md`](ai-workflow/docs/current-state.md).
