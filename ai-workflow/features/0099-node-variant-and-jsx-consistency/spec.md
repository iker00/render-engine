# Spec — 0099 — Consistencia de variantes y JSX en nodos del runtime

## Objetivo
Eliminar la duplicación estructural de JSX que hoy existe en varios nodos del runtime cuando resuelven variantes visuales mediante ramas `if/else` repetidas, y fijar en `conventions.md` la norma que evita que el problema reaparezca. Es una feature puramente técnica: no cambia contrato JSON, validación ni salida visual de ningún nodo.

## Contexto
El catálogo de nodos no sigue un único patrón para resolver variantes visuales. Algunos nodos (`divider`, `button`) ya resuelven sus variantes con un lookup map (`Record<Variant, string>`) o delegando en un único helper de `runtime-node-styling.ts` sin ramas condicionales en el cuerpo del componente. Otros nodos (`stat`, `skeleton`, `badge`) repiten el esqueleto JSX completo una vez por variante dentro de bloques `if`, cuando solo cambia qué helper de estilo se invoca. El caso más amplio es `repeater-layout-node.tsx` y `table-layout-node.tsx`: cada uno define su propia función `renderPaginationControls` de ~80 líneas, casi idénticas entre sí (mismos botones "Primera/Anterior/.../Última", misma lógica `aria-current`), mientras que la capa de estilos ya delega expresamente de tabla a repeater para las mismas clases. Además, dos nodos (`container`, `heading`) usan `createElement` explícito donde el resto del catálogo usa JSX plano, sin que exista una razón técnica que lo justifique en esos dos casos.

No existe hoy en `conventions.md` ninguna regla sobre cómo debe resolverse una variante visual dentro de un componente, ni sobre cuándo es aceptable usar `createElement` en vez de JSX.

## Alcance
- Añadir a `conventions.md` una regla de convención de código: un nodo con variantes visuales debe resolverlas mediante un lookup map (`Record<Variant, string>`) o delegando en un único helper de `runtime-node-styling.ts`, sin repetir el esqueleto JSX por rama `if/else`. JSX es la forma por defecto para renderizar; `createElement` explícito solo se admite cuando exista una razón técnica real (por ejemplo, nombre de tag verdaderamente dinámico sin alternativa JSX limpia).
- Refactorizar los siguientes nodos para seguir esa convención, sin alterar su salida visual ni su comportamiento:
  - `stat-layout-node.tsx`: las 3 variantes (`accent`, `tinted`, `plain`) dejan de repetir el bloque JSX por variante.
  - `skeleton-layout-node.tsx`: las 3 variantes (`text`, `circle`, `rect`) dejan de repetir el bloque JSX por variante.
  - `badge-layout-node.tsx`: las 2 variantes (`pill`, `circle`) dejan de repetir el bloque JSX por variante.
  - `repeater-layout-node.tsx` y `table-layout-node.tsx`: la lógica de `renderPaginationControls` (variantes `previousNext` y `numbered`) se extrae a un único componente de paginación compartido entre ambos nodos, en vez de mantener dos implementaciones casi idénticas.
  - `container-layout-node.tsx` y `heading-layout-node.tsx`: sustituir el uso de `createElement` por JSX plano.
- El resultado de cada refactor debe ser indistinguible del comportamiento actual: mismo HTML/clases resultantes, mismos atributos de accesibilidad, mismos tests existentes en verde sin modificar sus aserciones sobre el resultado observable.

## Fuera de alcance
- Cualquier otro nodo del catálogo que no esté listado arriba, incluidos los que ya usan un patrón limpio (`divider`, `button`, `container` a nivel de estilos) o los que no tienen variantes.
- `icon-node.tsx`: mantiene su uso actual de `createElement`.
- Migración progresiva de otros componentes que no formen parte de esta lista; queda para futuras features que toquen esos nodos por otras razones (fase 2 ya identificada por el usuario, no forma parte de esta feature).
- Cualquier cambio de comportamiento, estilos visuales, catálogo de variantes o contrato JSON de los nodos afectados.
- Cambios en `runtime-node-styling.ts` más allá de los ajustes mínimos necesarios para que los nodos refactorizados consuman sus helpers sin duplicar lógica (la delegación de estilos tabla→repeater ya existente se conserva).

## Requisitos funcionales
1. `conventions.md` incluye la nueva regla de resolución de variantes y de uso de JSX frente a `createElement`, ubicada en la sección de convenciones de código.
2. `StatNode`, `SkeletonNode` y `BadgeNode` seleccionan su estructura visual por variante sin bloques `if/else` que dupliquen JSX; la selección de variante se resuelve mediante lookup map o un único helper delegado.
3. `RepeaterNode` y `TableNode` consumen un único componente de controles de paginación compartido para resolver las variantes `previousNext` y `numbered`, eliminando las dos implementaciones independientes de `renderPaginationControls`.
4. `ContainerNode` y `HeadingNode` renderizan su elemento raíz con JSX en vez de `createElement`.
5. Ningún test existente relacionado con estos nodos cambia su aserción sobre el resultado observable (HTML renderizado, clases, atributos ARIA, comportamiento de paginación).

## Requisitos no funcionales
- Cobertura de tests del proyecto se mantiene igual o superior al umbral mínimo global (80% sobre `src/`).
- No se introduce ninguna dependencia nueva.
- El componente de paginación compartido debe seguir viviendo dentro de `src/runtime/` y respetar las fronteras de capas descritas en `architecture.md` (sin lógica de red, sin acceso ad hoc a estado compartido).

## Criterios de aceptación
- `conventions.md` contiene la regla nueva y es coherente con el resto del documento.
- Los 4 casos de duplicación de variante (`stat`, `skeleton`, `badge`, `repeater`/`table`) y los 2 casos de `createElement` innecesario (`container`, `heading`) quedan resueltos según lo descrito en el alcance.
- La suite de tests existente para estos nodos pasa sin modificar sus aserciones de comportamiento observable; solo se permite ajustar imports o estructura interna del test si cambia la ubicación de un componente extraído.
- No hay ninguna diferencia visual ni de comportamiento perceptible en `stat`, `skeleton`, `badge`, `repeater`, `table`, `container` ni `heading` respecto al estado antes de esta feature.
- `divider` y `button` no se modifican (ya sirven como referencia del patrón deseado).

## Casos límite
- El componente de paginación compartido debe seguir soportando que `repeater` y `table` usen helpers de clases distintos aunque compartan la misma estructura JSX y lógica de interacción (la resolución de estilos por nodo, vía props o parámetro, no se colapsa en un solo helper si eso cambiara semántica visual entre ambos nodos).
- Las 3 variantes de `stat` deben seguir aceptando la tolerancia de color ya existente (`accent` y `plain` ignoran `props.color` a nivel visual); el refactor no debe alterar esa tolerancia.
- El refactor de `heading` debe preservar la resolución dinámica del tag (`h1`–`h6` según `props.level`), que es la única variabilidad real que motivaba el uso previo de `createElement` en ese nodo.

## Riesgos o preguntas abiertas
Ninguna pendiente de bloqueo. El patrón de convención a aplicar ya existe como precedente en el propio código (`divider`, `button`), por lo que no hay decisión arquitectónica nueva que tomar antes de planificar.
