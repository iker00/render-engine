> Cuándo leer: confirmar si una capacidad global está intencionadamente fuera de v1 (acciones encadenadas, eventos generales, theming, router por pathname, etc.).
> Tamaño: corto.
> Relacionados: [[../../current-state.md]], [[../../../features/index.md]].

# Límites transversales actuales

Los límites específicos de un nodo viven en [`../nodes/<nodo>.md`](../nodes/index.md). Este documento recoge solo límites globales del runtime.

## Acciones y eventos
- El catálogo común de acciones UI sigue intencionadamente corto: no existen todavía secuencias, branching, callbacks por éxito o error, condiciones declarativas ni varias acciones por trigger.
- El trigger sigue siendo implícito por tipo de nodo; todavía no existe un sistema general de `events`, `onClick` u `onSubmit` compartido entre superficies interactivas.
- `action` sigue siendo una sola operación por trigger; no hay arrays, secuencias ni callbacks declarativos.

## Visibility y referencias
- `visibility` cubre solo una condición simple por nodo y no introduce `fallback`, composición booleana ni expresiones arbitrarias.
- El agregado `pageEntry` todavía no se expone como familia de referencias declarativas dentro del JSON.
- `routeParams.*` y `navigation.*` siguen sin resolverse como referencias soportadas.
- `params.*` sigue intencionadamente fuera de `visibility` y de las fuentes dinámicas de colección.

## Routing
- El runtime sigue intencionadamente acotado a hash routing simple y no abre un router general por `pathname`, subrutas ni segmentos dinámicos.

## Theming y estilo
- El runtime no expone todavía theming ni personalización visual declarativa desde JSON; la capa estable actual se limita a tokens globales en CSS y a la gramática compartida codificada en el propio runtime.

## Layout responsive
- `layout.span` sigue intencionadamente acotado a semántica de grid sobre `columns`; el soporte responsive por breakpoint solo existe para `columns` y `layout.span`, sin widths libres para layouts `flex` ni wrapper visible propio en `repeater`, salvo el bloque de controles de paginación que ocupa fila completa dentro de grids efectivos.

## Paginación
- La paginación disponible en `repeater` y `table` es solo local; no existe selector de tamaño, salto directo, virtualización, metadatos remotos, paginación por cursor, carga incremental remota, filtros remotos, filtros avanzados por tipo ni ordenación múltiple.

## Interpolación
- La interpolación parcial no abre expresiones, operadores, filtros, formateadores, condicionales, i18n, pluralización ni escape propio para mostrar delimitadores `{{` o `}}`.

## Formularios (transversal)
- El catálogo de formularios sigue intencionadamente acotado a `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`; no existen todavía subida de archivos, autocompletado, búsqueda remota, paginación ni carga incremental de opciones.
- La validación declarativa de formularios ya cubre `required`, `minLength`, `maxLength`, `min`, `max`, `minSelections` y `maxSelections`, pero siguen fuera de alcance validaciones remotas, cruzadas y mensajes personalizados efectivos.
- No hay todavía validaciones declarativas avanzadas (`pattern`, validaciones cruzadas).

## Catálogo y plugins
- No hay sistema de plugins para componentes externos.
- No hay soporte para nodos distintos de `container`, `repeater`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- No hay consumidores declarativos de referencias fuera de las superficies visibles interpolables, `queryStateFeedback`, `visibility`, `api.query`, `api.body`, `api.headers`, `defaultValue` de campos de formulario, `navigateTo.params`, `repeater.props.items.source` y `source` de colecciones para `list`, `select`, `radioGroup` y `checkboxGroup`.
