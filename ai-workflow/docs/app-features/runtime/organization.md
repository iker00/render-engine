> Cuándo leer: cuando la tarea requiere conocer dónde vive una responsabilidad concreta en `src/`, qué módulo expone qué API o cómo se conectan validación, render y estado.
> Tamaño: medio.
> Relacionados: [[overview.md]], [[../config/validation.md]].

# Organización estable del runtime

## Configuración y validación
- `src/config/runtime-config.ts` actúa como fachada pública mínima del contrato del runtime.
- `src/config/runtime-config-types.ts` concentra los tipos del contrato y los shapes de resultado/error de validación.
- `src/config/runtime-config-zod.ts` concentra los esquemas `Zod` internos del contrato estructural.
- `src/config/runtime-config-validation-errors.ts` adapta los fallos internos a la taxonomía pública estable de errores.
- `src/config/validate-runtime-config.ts` contiene la validación estructural previa al render y las validaciones cruzadas posteriores al parseo.

## Render y composición
- `src/runtime/layout-renderer.tsx` renderiza colecciones ordenadas, conserva el soporte de varios hermanos raíz y propaga opcionalmente un contexto de iteración por subárbol.
- `src/runtime/layout-node-renderer.tsx` centraliza la resolución `type -> pieza de render`, aplica el borde transversal de visibilidad efectiva antes de delegar al nodo concreto, mantiene `repeater` como expansión estructural sin wrapper visual, resuelve el wrapper genérico de `layout.span` solo cuando el padre efectivo es grid, y envuelve cada nodo en un borde de carga lazy + error por instancia.
- `src/runtime/nodes/node-components-map.ts` exporta el mapa `type -> ComponentType` que `layout-node-renderer` consume. En test, cada entrada es un import estático directo del nodo (eager, sin Suspense). En dev/prod, cada entrada es un `React.lazy()` que descarga el chunk del nodo bajo demanda la primera vez que se necesita renderizar ese tipo.
- `src/runtime/lazy-node.tsx` es un wrapper React que envuelve cada nodo cargado dinámicamente, combinando `<Suspense fallback={null}>` (posición no renderiza nada mientras se descarga el chunk) y una error boundary local (contiene fallos de carga de chunk en esa posición sin propagar al resto del runtime).
- `src/runtime/runtime-layout-context.tsx` propaga un contexto mínimo de layout con las columnas efectivas fijas o responsive del grid padre, separado del store global del runtime.
- `src/runtime/form-context.tsx` propaga el `formId` efectivo por descendencia sin acoplar los nodos de campo a props manuales repetidas.
- `src/runtime/nodes/` contiene una pieza concreta por nodo soportado hoy: `container`, `repeater`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup`, `checkboxGroup`, `tabs`, `accordion`, `badge`, `alert`, `stat`, `divider`, `skeleton` y `fileManager`.
- `src/runtime/nodes/form-layout-node.tsx` fija hoy la frontera visible entre rerender, ocultación y desmontaje real del formulario, y usa el store compartido para distinguir entre resetear un formulario existente y eliminarlo completo.

## Acciones, estado y feedback
- `src/runtime/runtime-actions/` concentra el ejecutor común `action.type -> handler del provider`, reutilizable por futuros triggers más allá de `button`.
- `src/runtime/runtime-state/` concentra el provider, reducer, tipos, selectors y acciones del estado compartido del runtime.
- `src/runtime/runtime-query-state-feedback.ts` concentra la derivación de estado visible de query, incluida la distinción explícita entre `idle` y `loading`, la heurística común de `empty` y la resolución de la respuesta efectiva `show | hide | fallback`.
- `src/runtime/runtime-layout-visibility.ts` compone `queryStateFeedback` y `visibility` en una única decisión reutilizable por renderer y formularios.

## Referencias y colecciones
- `src/runtime/runtime-references/` centraliza parsing, interpolación parcial, resolución y diagnóstico de referencias string del runtime, incluido el namespace `item` limitado al contexto de iteración y la normalización visible compartida de textos, labels, `image`, `table` y proyecciones de colección.
- `src/runtime/runtime-collection-sources.ts` concentra la resolución compartida de colecciones efectivas para `list`, `select`, `radioGroup`, `checkboxGroup` y las filas dinámicas de `table`, incluyendo degradación a vacío, proyección declarativa por item, soporte de `item.*` dentro de `repeater`, contexto `item` local para proyecciones interpoladas y normalización común de selección simple o múltiple.
- `src/runtime/runtime-collection-pagination.ts` concentra la derivación reusable de paginación local de colecciones para `repeater` y `table`, incluyendo total de items, total de páginas, límites de anterior/siguiente, página visible normalizada, ventana numerada compacta, ventana incremental de scroll y materialización de páginas por colección y `pageSize`.
- `src/runtime/runtime-table-processing.ts` concentra la resolución de columnas configuradas de `table`, la normalización de texto para filtros y ordenación, la combinación `AND` de filtros locales y la ordenación estable por una única columna activa.

## Capa remota
- `src/queries/` concentra la construcción de requests, la ejecución contra `fetch`, la composición final entre la operación `api` base y los request params por ejecución, la semántica estable de merge para `query`, `body` y `headers`, y la normalización de errores remotos.

## Styling
- `src/app/index.css` centraliza los tokens visuales globales del runtime con `@theme` de `Tailwind CSS v4`.
- `src/runtime/runtime-node-styling.ts` centraliza la convención visual base, la selección entre modos `flex` y `grid`, la heurística `plain | form-section` para `container` dentro de `form`, la variante cerrada `card`, el mapeo fijo y responsive de `columns` y `layout.span`, `align`, `justify` y `wrap`, la compatibilidad acotada de `gap` y el cálculo de `col-span-*` con clamp seguro al grid padre. Es un barrel: la implementación por dominio vive en los ficheros internos `src/runtime/runtime-node-styling-<dominio>.ts` (`base`, `app-shell`, `content`, `form-fields`, `container`, `table`, `repeater-pagination`, `button`, `modal`, `accordion`, `tabs`, `stat`, `badge`, `alert`, `skeleton`, `input-icon`, `file-manager`); ningún consumidor externo debe importar directamente de esos ficheros internos, todos consumen la ruta pública del barrel.
