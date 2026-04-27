# Estado actual

## Capacidades disponibles
- Flujo documental base de `ai-workflow` disponible.
- Contexto del producto ya orientado a la nueva app de UI configurable.
- Bootstrap frontend de paquete único ya creado en la raíz del repositorio.
- Scripts estables de `dev`, `build`, `lint` y `test` disponibles con `pnpm`.
- Frontera de bootstrap para resolver configuración desde `data-config` o `src/dev/config.json`.
- Validación estructural mínima del runtime config antes de renderizar, separada en tipos, fachada pública y validador dedicado dentro de `src/config/`.
- Contrato de página estable con `pages[].layout` como colección ordenada de bloques y rechazo explícito del shape raíz antiguo basado en objeto.
- Renderer estático inicial operativo para `container`, `heading`, `paragraph` y `list`, con soporte para varios hermanos en la raíz de página sin `container` sintético y con dispatcher central por `type` en `src/runtime/`.
- Resolución de `initialPage` con soporte para varias páginas declaradas y render exclusivo de la página seleccionada.
- Manejo explícito de errores de configuración con diagnóstico visible en desarrollo y degradación silenciosa en producción para errores marcados como `development-only`.
- Tests automatizados del bootstrap, del validador y del renderer, con gate global de coverage activo sobre `src/`.

## Límites actuales
- No existe todavía validación con `Zod`; el contrato actual se valida con lógica propia.
- No existe todavía panel de desarrollo local para editar configuración en vivo.
- No hay integración real con backend; solo existe la lectura de `data-config` como frontera de entrada.
- No existen todavía navegación interna, formularios ni queries funcionales.
- La sección `api` del JSON aún no se ejecuta.
- El catálogo visual sigue limitado a `container`, `heading`, `paragraph` y `list`.
- No se resuelven referencias dinámicas ni `routeParams`.

## Infraestructura vigente
- Repositorio preparado para trabajar con documentación guiada por specs.
- Stack frontend inicial versionado con `Vite`, `React`, `Tailwind`, `TypeScript` y `Vitest`.
- Contrato de entorno explicitado con `.nvmrc`, `engines.node` y `packageManager`.
- Estándares de testing, estilo, errores y seguridad definidos en `ai-workflow/standards/`.
- Base de runtime estático ya integrada en la app en sustitución del shell provisional.
- Tercera feature del workflow cerrada sobre esta base, simplificando la raíz de página antes de añadir navegación, formularios y datos remotos en iteraciones posteriores.
- Cuarta feature del workflow cerrada para reorganizar la estructura interna del runtime sin cambiar el contrato funcional observable.

## Referencias

- [`./context.md`](./context.md)
- [`./app-features/index.md`](./app-features/index.md)
- [`./architecture.md`](./architecture.md)
- [`./onboarding.md`](./onboarding.md)
- [`../features/index.md`](../features/index.md)
