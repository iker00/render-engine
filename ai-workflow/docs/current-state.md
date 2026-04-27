# Estado actual

## Capacidades disponibles
- Flujo documental base de `ai-workflow` disponible.
- Contexto del producto ya orientado a la nueva app de UI configurable.
- Bootstrap frontend de paquete único ya creado en la raíz del repositorio.
- Shell inicial de `React` operativo para validar arranque sin backend.
- Scripts estables de `dev`, `build`, `lint` y `test` disponibles con `pnpm`.
- Frontera de bootstrap para resolver configuración desde `data-config` o `src/dev/config.json`.
- Tests automatizados del bootstrap y gate global de coverage activos sobre `src/`.

## Límites actuales
- El renderer declarativo aún no está implementado.
- No existe todavía validación estructural completa del runtime config con `Zod`.
- No existe todavía panel de desarrollo local para editar configuración en vivo.
- No hay integración real con backend; solo existe la lectura de `data-config` como frontera de entrada.
- No existen todavía navegación interna, formularios ni queries funcionales.

## Infraestructura vigente
- Repositorio preparado para trabajar con documentación guiada por specs.
- Stack frontend inicial versionado con `Vite`, `React`, `Tailwind`, `TypeScript` y `Vitest`.
- Contrato de entorno explicitado con `.nvmrc`, `engines.node` y `packageManager`.
- Estándares de testing, estilo, errores y seguridad definidos en `ai-workflow/standards/`.
- Primera feature del workflow implementada y pendiente solo de futuras capacidades funcionales sobre esta base.

## Referencias

- [`./context.md`](./context.md)
- [`./app-features/index.md`](./app-features/index.md)
- [`./architecture.md`](./architecture.md)
- [`./onboarding.md`](./onboarding.md)
- [`../features/index.md`](../features/index.md)
