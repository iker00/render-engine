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
- Presentación base del runtime migrada a `Tailwind CSS` para `container`, `heading`, `paragraph` y `list`, con convención centralizada en `src/runtime/runtime-node-styling.ts`.
- Resolución de `initialPage` con soporte para varias páginas declaradas y render exclusivo de la página seleccionada.
- Núcleo de estado compartido por instancia ya integrado en `src/runtime/runtime-state/` para navegación, formularios y queries.
- Navegación visible resuelta desde `navigation.currentPageId`, con historial interno mínimo y error recuperable al navegar a una página inexistente.
- Dominio base de formularios disponible con almacenamiento por `forms.{formId}.{fieldId}`, `defaultValue`, `error`, `touched`, `dirty` y reset por formulario.
- Dominio base de queries disponible con almacenamiento por nombre, `status/data/error`, conservación del último dato válido durante recargas y reset por query.
- Capa central de referencias del runtime ya operativa para `forms.*`, `queries.{queryName}`, `queries.{queryName}.data`, `queries.{queryName}.status` y `queries.{queryName}.error`.
- Navegación anidada de datos de query ya soportada bajo `queries.{queryName}.data.*`, con recorrido uniforme por objetos y arrays y consumo visible actual en `heading.props.text` y `paragraph.props.text`.
- `config.api` ya funciona como catálogo declarativo tipado y validado de operaciones remotas con `method`, `endpoint`, `query` y `body`.
- Capa `src/queries/` ya integrada para construir requests desde referencias del runtime, ejecutar operaciones por nombre y normalizar errores remotos con códigos estables orientados a UI.
- Fachada `executeQueryOperation(operationName)` ya expuesta desde el provider para hidratar `queries.{operationName}` con transiciones `loading | success | error`.
- Aislamiento validado entre varias instancias del runtime y limpieza completa del estado al desmontar y remontar.
- Manejo explícito de errores de configuración con diagnóstico visible en desarrollo y degradación silenciosa en producción para errores marcados como `development-only`.
- Tests automatizados del bootstrap, del validador y del renderer, con gate global de coverage activo sobre `src/`.

## Límites actuales
- No existe todavía validación con `Zod`; el contrato actual se valida con lógica propia.
- No existe todavía panel de desarrollo local para editar configuración en vivo.
- No existe todavía una integración completa de producto con backend más allá de `data-config` como frontera de entrada y de las operaciones remotas declarativas ejecutadas por `fetch`.
- No existe todavía una UI declarativa final para navegación, formularios o feedback de queries.
- No existen todavía `preloads` reales ni acciones API declarativas activas.
- El catálogo visual sigue limitado a `container`, `heading`, `paragraph` y `list`.
- No existen todavía consumidores de referencias fuera de `heading.props.text` y `paragraph.props.text`, ni interpolación parcial dentro de strings.
- `routeParams.*`, `params.*` y `navigation.*` siguen sin resolverse como referencias soportadas.
- No existe todavía theming, tokens de diseño ni personalización visual declarativa desde JSON.

## Infraestructura vigente
- Repositorio preparado para trabajar con documentación guiada por specs.
- Stack frontend inicial versionado con `Vite`, `React`, `Tailwind`, `TypeScript` y `Vitest`.
- Contrato de entorno explicitado con `.nvmrc`, `engines.node` y `packageManager`.
- Estándares de testing, estilo, errores y seguridad definidos en `ai-workflow/standards/`.
- Base de runtime estático ya integrada en la app en sustitución del shell provisional.
- Tercera feature del workflow cerrada sobre esta base, simplificando la raíz de página antes de añadir navegación, formularios y datos remotos en iteraciones posteriores.
- Cuarta feature del workflow cerrada para reorganizar la estructura interna del runtime sin cambiar el contrato funcional observable.
- Quinta feature del workflow cerrada para alinear el styling visible del runtime con `Tailwind CSS` sin introducir theming.
- Sexta feature del workflow cerrada para introducir el núcleo de estado compartido del runtime sin abrir todavía la capa declarativa de interacción y datos remotos.
- Séptima feature del workflow cerrada para centralizar la resolución de referencias string del runtime.
- Octava feature del workflow cerrada para ampliar `queries.{queryName}.data` con navegación anidada por objetos y colecciones.
- Novena feature del workflow cerrada para convertir `api` en una frontera declarativa operativa y conectar su ejecución con el dominio compartido `queries`.

## Referencias

- [`./context.md`](./context.md)
- [`./app-features/index.md`](./app-features/index.md)
- [`./architecture.md`](./architecture.md)
- [`./onboarding.md`](./onboarding.md)
- [`../features/index.md`](../features/index.md)
