# Onboarding local

## Estado actual
El runtime declarativo ya está implementado y estable: navegación, formularios, queries, validación `Zod` del contrato completo, autenticación y subida de archivos. El bootstrap técnico permite instalar dependencias, arrancar la app localmente y validarla sin depender de backend real. Para el detalle actualizado por área, ver [`ai-workflow/docs/current-state.md`](./current-state.md); para el catálogo funcional completo, ver [`ai-workflow/docs/app-features/index.md`](./app-features/index.md).

## Requisitos
- Node.js `22`
- `pnpm`
- no se requieren variables de entorno en esta fase
- no se requiere backend para el arranque local inicial

## Primer arranque
1. Ejecutar `pnpm install`.
2. Arrancar el entorno local con `pnpm dev`.
3. Abrir la URL que expone Vite.
4. Verificar que el shell muestra `src/dev/config.json` como fuente activa cuando el contenedor no aporta `data-config`.

## Resolución de configuración
- Si el elemento root expone `data-config`, esa configuración tiene prioridad.
- Si `data-config` no existe y la app corre en desarrollo, se usa `src/dev/config.json`.
- Si el JSON de `data-config` no se puede parsear, la app muestra un error de bootstrap comprensible.
- Si no existe ninguna fuente soportada fuera de desarrollo, la app muestra un error de bootstrap en lugar de fallar de forma opaca.

## Verificación rápida
- comprobar que `pnpm dev` levanta la aplicación sin errores de bootstrap
- comprobar que `pnpm build` genera el bundle de producción
- comprobar que `pnpm lint` pasa
- comprobar que `pnpm test` pasa y aplica el gate de coverage sobre `src/`
- comprobar que el shell refleja la fuente de configuración activa y la `initialPage`

## Estructura inicial esperada
- `src/app/`
- `src/config/`
- `src/dev/`
- `src/dev-runtime/`
- `src/queries/`
- `src/runtime/`
- `src/tests/`
