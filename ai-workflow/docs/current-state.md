# Estado vigente

## Propósito
Snapshot corto del estado actual del proyecto. Sirve para confirmar rápidamente si una capacidad ya existe o sigue fuera de alcance, y para saber a qué ficha funcional ir desde aquí.

No es histórico acumulado ni sustituto de las fichas funcionales. El detalle estable vive en [`app-features/`](./app-features/) y el histórico cronológico de entregas vive en [`../features/index.md`](../features/index.md).

## Estado por área

| Área | Estado | Detalle | Última feature relevante |
|---|---|---|---|
| Runtime | estable | [runtime/](./app-features/runtime/index.md) | `0042` |
| Contrato JSON | estable | [config/](./app-features/config/index.md) | `0050` |
| Referencias y strings dinámicas | estable | [references/](./app-features/references/index.md) | `0050` |
| Catálogo de nodos | estable | [nodes/](./app-features/nodes/index.md) | `0054` |
| Formularios y validación | estable | [forms/](./app-features/forms/index.md) | `0046` |
| Queries, preloads y feedback | estable | [queries/](./app-features/queries/index.md) | `0047` |
| Navegación y páginas | estable | [navigation/](./app-features/navigation/index.md) | `0046` |
| Accesibilidad | estable | [nodes/](./app-features/nodes/index.md), [queries/](./app-features/queries/index.md), [navigation/](./app-features/navigation/index.md) | `0046` |
| Desarrollo local | estable | [development/](./app-features/development/index.md) | `0047` |
| Theming declarativo | fuera de v1 | — | — |
| Autenticación y permisos | fuera de v1 | — | — |
| Subida de archivos | fuera de v1 | — | — |
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
- La columna `Última feature relevante` apunta al `NNNN` cuyo cambio fija el estado actual del área; cuando una feature nueva consolide otro estado, sustituirla en vez de añadir.
