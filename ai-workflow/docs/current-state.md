# Estado vigente

## Proposito
Este documento es un snapshot corto del estado actual del proyecto. Sirve para confirmar rapidamente si una capacidad ya existe o si sigue fuera de alcance.

No debe funcionar como historico acumulado ni como sustituto de las fichas funcionales. El detalle estable vive en [`app-features/`](./app-features/) y el mapa historico de entregas vive en [`../features/index.md`](../features/index.md).

## Capacidades disponibles
- Proyecto frontend de paquete unico con `Vite`, `React`, `Tailwind CSS v4`, `TypeScript`, `Vitest` y `Zod`.
- Configuracion de runtime cargable desde `data-config` en produccion o `src/dev/config.json` en desarrollo.
- Validacion previa al render con diagnosticos estructurales y semanticos del contrato JSON.
- Runtime declarativo basado en `pages`, `initialPage`, `layout` como coleccion ordenada y hash routing canonico `#/` / `#/pageId`.
- Estado compartido aislado por instancia para navegacion, formularios, queries y `pageEntry`.
- Operaciones remotas declarativas en `config.api`, ejecutadas por nombre y visibles mediante `queries.{operationName}`.
- Composicion de requests por ejecucion con `query`, `body`, `headers` y `requestSignature` estable.
- `preloads` por entrada de pagina con reevaluacion selectiva por firma efectiva y proteccion latest-only del agregado `pageEntry`.
- Acciones UI declarativas para `navigateTo`, `goBack`, `executeOperation` y `resetForm`.
- Referencias declarativas soportadas para `forms.*`, `queries.*`, `queries.*.data.*`, `params.*` en superficies acotadas e `item.*` dentro de `repeater`.
- Interpolacion parcial `{{...}}` en strings visibles y proyecciones cerradas de colecciones, reutilizando esas mismas referencias y vaciando placeholders no renderizables.
- Nodos visibles soportados: `container`, `repeater`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- Formularios declarativos con estado por `formId.fieldId`, `defaultValue`, limpieza por desmontaje por defecto, persistencia opt-in, validaciones locales y submit via `executeOperation`.
- Paginacion local opt-in en `repeater` sobre colecciones `queries.*`, con `pageSize` declarativo, variantes de controles `previousNext`, `numbered` y `scroll`, estado local independiente por instancia y reset al cambiar coleccion o configuracion efectiva.
- Consumidores de colecciones manuales, `queries.*` e `item.*` en `list`, `select`, `radioGroup` y `checkboxGroup`.
- Feedback visual por estado de query y reglas simples de `visibility`, reutilizadas tambien para excluir campos ocultos de la validacion.
- Layout declarativo con `container` por direccion o grid, `gap`, `columns` fijo o responsive, `align`, `justify`, `wrap`, variante `card` y `layout.span` fijo o responsive dentro de grids efectivos.
- Baseline visual institucional compacta basada en tokens globales CSS-first y utilidades de `Tailwind`.
- Tests automatizados con gate de cobertura global sobre `src/`.

## Limites vigentes
- No existe panel de desarrollo local para editar configuracion en vivo.
- No existe integracion completa con backend mas alla de `data-config` y operaciones remotas declarativas via `fetch`.
- `pageEntry` no esta expuesto todavia como namespace de referencias declarativas.
- No existen `routeParams.*` ni `navigation.*` como referencias soportadas.
- `params.*` no aplica aun en `visibility` ni en fuentes dinamicas de coleccion.
- No hay interpolacion parcial en requests, `preloads`, `navigateTo.params`, `defaultValue`, `visibility`, fuentes de coleccion, keys de `repeater` ni cabeceras de `table`.
- No hay validaciones remotas, validaciones cruzadas, `pattern` ni mensajes personalizados efectivos por regla.
- No hay subida de archivos, busqueda remota de opciones, paginacion en `table`, paginacion remota ni carga incremental remota de colecciones.
- `visibility` sigue limitada a una unica condicion simple, sin composicion booleana ni fallback propio.
- No existe theming declarativo desde JSON; la personalizacion visual sigue cerrada al baseline actual, a las props soportadas y a los breakpoints responsive cerrados de `columns` y `layout.span`.

## Mantenimiento
- Actualizar este snapshot solo cuando cambie una capacidad vigente o un limite actual.
- No anadir historico de features cerradas.
- No duplicar aqui el detalle de las fichas funcionales.
