# Estado vigente

## Propósito
Snapshot corto del estado actual del proyecto. Sirve para confirmar rápidamente si una capacidad ya existe o sigue fuera de alcance, y para saber a qué ficha funcional ir desde aquí.

No es histórico acumulado ni sustituto de las fichas funcionales. El detalle estable vive en [`app-features/`](./app-features/) y el histórico cronológico de entregas vive en [`../features/index.md`](../features/index.md).

## Estado por área

| Área | Estado | Detalle | Última feature relevante |
|---|---|---|---|
| Runtime | estable | [runtime/](./app-features/runtime/index.md) | `0081` |
| Contrato JSON | estable | [config/](./app-features/config/index.md) | `2026-08-25-09-27-form-steps` |
| Referencias y strings dinámicas | estable | [references/](./app-features/references/index.md) | `0101` |
| Catálogo de nodos | estable | [nodes/](./app-features/nodes/index.md) | `2026-08-25-12-46-steps-editor-and-step-gate` |
| Formularios y validación | estable | [forms/](./app-features/forms/index.md) | `2026-08-25-09-27-form-steps` |
| Queries, preloads y feedback | estable | [queries/](./app-features/queries/index.md) | `0110` |
| Navegación y páginas | estable | [navigation/](./app-features/navigation/index.md) | `0137` |
| Shell de aplicación (cabecera y sidebar) | estable | [shell/](./app-features/shell/index.md) | `0124` |
| Accesibilidad | estable | [nodes/](./app-features/nodes/index.md), [queries/](./app-features/queries/index.md), [navigation/](./app-features/navigation/index.md) | `0046` |
| Desarrollo local | estable | [development/](./app-features/development/index.md) | `2026-08-25-12-46-steps-editor-and-step-gate` |
| Subida de archivos | estable | [nodes/file-manager.md](./app-features/nodes/file-manager.md), [nodes/file-input.md](./app-features/nodes/file-input.md), [forms/validation-rules.md](./app-features/forms/validation-rules.md), [forms/submit.md](./app-features/forms/submit.md) | `0109` |
| Theming declarativo | fuera de v1 | — | — |
| Tokens de autenticación | estable | [auth/tokens.md](./app-features/auth/tokens.md) | `0078` |
| Procesamiento remoto de tablas | fuera de v1 | — | — |
| Edición avanzada de tablas | fuera de v1 | — | — |
| Validaciones remotas y cruzadas | fuera de v1 | — | — |

## Stack
- `pnpm`, `Vite`, `React`, `Tailwind CSS v4`, `TypeScript`, `Vitest`, `Zod`.
- Umbral mínimo global de cobertura del 80% sobre `src/`.

## Mantenimiento
- Actualizar este snapshot solo cuando cambie el estado de un área o cuando un límite vigente cambie.
- No añadir histórico de features cerradas; eso vive en `../features/index.md`.
- No duplicar aquí el detalle de las fichas funcionales; este documento solo es un mapa de estado.
- La columna `Última feature relevante` apunta al ID de la feature cuyo cambio fija el estado actual del área (`NNNN` en features históricas, `YYYY-MM-DD-HH-MM` en features nuevas); cuando una feature nueva consolide otro estado, sustituirla en vez de añadir.
