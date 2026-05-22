# Spec: Client-side collection pagination

## Objetivo
Definir una capacidad reutilizable de paginación en cliente para consumidores de colecciones del runtime, estrenándola en `repeater` con páginas de tamaño configurable, controles básicos de anterior y siguiente, y una base compatible con futuros consumidores como `table`.

## Alcance
- Diseñar la paginación como una capacidad compartible por nodos que consumen colecciones, no como una lógica exclusiva de `repeater`.
- Ampliar el contrato del nodo `repeater` como primer consumidor de esa capacidad para que pueda declarar paginación local sobre la colección resuelta desde `queries.*`.
- Mantener como fuente de datos la colección completa ya disponible en el consumidor, empezando por `repeater.props.items.source`.
- Mostrar solo el subconjunto correspondiente a la página activa sin modificar la semántica propia del consumidor, incluida la semántica de `item.*` dentro de cada iteración de `repeater`.
- Permitir configurar el tamaño de página inicial mediante JSON.
- Añadir controles visibles mínimos para avanzar y retroceder entre páginas.
- Mostrar un estado textual básico de la página activa para que el usuario entienda su posición dentro del conjunto paginado.
- Cachear las páginas derivadas o el resultado de paginación equivalente para evitar recalcular el `slice` en cada cambio de página cuando la colección origen y la configuración de paginación no hayan cambiado.
- Resetear la página activa de forma predecible cuando cambie la colección origen o la configuración efectiva de paginación.
- Dejar una semántica funcional reutilizable por `table` en una iteración posterior, sin implementar todavía paginación en tablas.
- Dejar el contrato preparado para futuras variantes de controles, como números de página, infinite scroll o paginación remota, sin definir todavía esas variantes.

## Fuera de alcance
- Implementar paginación en `table` dentro de esta feature.
- Ejecutar peticiones nuevas al cambiar de página.
- Definir el contrato de paginación remota en backend.
- Consumir metadatos remotos de paginación como total, página actual, cursor, `hasNext` o `hasPrevious`.
- Añadir selector de tamaño de página.
- Añadir salto directo a página, números de página, infinite scroll, carga incremental o virtualización.
- Añadir ordenación, filtros, búsqueda local o transformación arbitraria de la colección.
- Cachear respuestas remotas o introducir una política general de caché para queries.
- Cambiar la semántica de `queryStateFeedback`, `visibility`, `preloads` o ejecución de operaciones remotas.

## Requisitos funcionales
- La paginación deberá existir como comportamiento reusable para colecciones ordenadas del runtime, aunque la primera integración visible sea `repeater`.
- Un `repeater` podrá declarar que su colección se pagina en cliente.
- La paginación solo se aplicará después de resolver la colección completa desde `props.items.source`.
- Si un `repeater` no declara paginación, conservará exactamente su comportamiento actual.
- La paginación deberá aceptar un tamaño de página positivo y finito.
- La página activa inicial será la primera página.
- El runtime renderizará únicamente los items de la página activa y conservará el orden original recibido desde la query.
- Dentro de cada item visible, `item` e `item.*` seguirán resolviendo contra el item real de la colección origen, no contra una estructura intermedia de paginación.
- La lógica reusable de paginación no deberá depender de detalles propios del `template` de `repeater`; deberá operar sobre colecciones ordenadas y devolver el subconjunto visible más el estado necesario para los controles.
- Los controles mínimos permitirán ir a la página anterior y a la siguiente.
- El control de anterior estará deshabilitado o no accionable en la primera página.
- El control de siguiente estará deshabilitado o no accionable en la última página.
- El estado visible de página deberá reflejar al menos la página activa y el número total de páginas cuando ese total pueda derivarse de la colección cargada.
- Si la colección origen está vacía, no existen páginas navegables y no se deben mostrar controles accionables que sugieran resultados disponibles.
- Si la query aún no ha cargado, falla o la ruta declarada no resuelve una colección utilizable, el `repeater` mantendrá su degradación actual a cero iteraciones.
- `queryStateFeedback` seguirá siendo el mecanismo recomendado para mostrar estados de carga, error o vacío alrededor de la query origen.
- Cuando cambie la colección origen, el runtime deberá volver a una página activa válida, preferentemente la primera página.
- Cuando cambie el tamaño de página efectivo, el runtime deberá volver a una página activa válida, preferentemente la primera página.
- La paginación deberá evitar recalcular el subconjunto visible mediante `slice` en cada cambio de página si la colección origen y el tamaño de página no han cambiado.
- La caché de paginación será local al runtime o al nodo paginado y no deberá exponer nuevos datos al contrato JSON.
- La caché no deberá impedir que cambios reales de datos, refetches o nuevas `pageEntry` se reflejen en el listado visible.
- La estrategia de estado y caché deberá permitir que más adelante `table` use la misma base sin compartir accidentalmente la página activa con un `repeater` u otra tabla.
- Una pantalla podrá tener varios `repeater` paginados independientes sin que sus páginas activas colisionen.
- La identidad de item mediante `props.items.key` seguirá aplicándose con las mismas reglas actuales.
- El contrato deberá rechazar configuraciones de paginación inválidas antes del render, incluyendo tamaños no positivos o valores fuera del shape soportado.

## Requisitos no funcionales
- La solución debe mantenerse acotada a paginación en cliente para la primera versión.
- El contrato debe seguir siendo producible desde backend con JSON simple.
- La ampliación inicial del `repeater` no debe convertirlo en un motor general de transformación de colecciones.
- La base de paginación debe evitar duplicar reglas entre consumidores de colecciones cuando se añada `table`.
- La UI de controles debe respetar la baseline institucional compacta vigente y usar la gramática visual existente del runtime.
- La paginación debe integrarse con la degradación segura actual del runtime cuando faltan datos o una referencia no resuelve.
- La feature debe conservar una vía clara para introducir paginación remota más adelante, pero sin bloquear la v1 con decisiones de backend todavía no definidas.

## Criterios de aceptación
- Dado un `repeater` paginado con una colección de 5 items y tamaño de página 2, al entrar se muestran los 2 primeros items.
- Dado el mismo caso, al pulsar siguiente se muestran los items 3 y 4, y al volver a pulsar siguiente se muestra el item 5.
- Dado un usuario en la última página, el control siguiente no permite avanzar más allá de los items disponibles.
- Dado un usuario en la primera página, el control anterior no permite retroceder.
- Dado un usuario que avanza y luego retrocede, los items visibles corresponden siempre a la página esperada y conservan el orden de la colección original.
- Dado un `repeater` paginado, los nodos descendientes que usan `item.*` siguen mostrando y enviando datos del item visible correcto.
- Dado un refetch que reemplaza la colección origen, el listado vuelve a una página válida y no mantiene una página fuera de rango.
- Dado un cambio de colección que reduce el número total de páginas, no queda visible una página vacía artificial si existen resultados en páginas anteriores.
- Dada una colección vacía, el `repeater` no renderiza items y no muestra controles accionables de anterior o siguiente.
- Dada una query en `loading`, `error` o con datos no coleccionables, el `repeater` conserva la degradación actual a cero iteraciones y deja el feedback visible a `queryStateFeedback`.
- Dada una configuración sin paginación en `repeater`, el render y las acciones por item permanecen sin cambios.
- Dada una configuración con tamaño de página inválido, el config se rechaza antes del render con diagnóstico trazable.
- Dada una navegación repetida entre páginas de una misma colección sin cambios de datos ni tamaño, el runtime reutiliza el resultado derivado de paginación en vez de recalcular todos los cortes en cada transición.
- Dado el diseño funcional de esta feature, una futura integración de `table` podrá reutilizar la misma semántica de tamaño de página, página activa, límites, controles y caché derivada sin redefinir otro modelo incompatible.

## Casos límite
- La colección tiene menos items que el tamaño de página.
- La colección tiene exactamente un múltiplo del tamaño de página.
- La colección cambia mientras el usuario está en una página intermedia.
- La colección cambia a una lista más corta que deja fuera de rango la página activa anterior.
- La query recarga conservando temporalmente el último `data` válido mientras `status` vuelve a `loading`.
- Hay varios `repeater` paginados en la misma página, alimentados por la misma query o por queries distintas.
- En una evolución futura, una página combina un `repeater` paginado y una `table` paginada sobre la misma query sin compartir estado de página por accidente.
- La plantilla del `repeater` contiene botones que navegan o ejecutan operaciones usando `item.*`.
- Algunos items de la colección son omitidos por key ausente, no escalar o duplicada según la semántica actual del `repeater`.

## Riesgos o preguntas abiertas
- La futura paginación remota queda deliberadamente abierta y sin contrato definido en esta feature.
- La forma exacta del JSON de paginación y los nombres públicos finales deberán cerrarse en diseño técnico antes de implementar, evitando nombres que aten la capacidad exclusivamente a `repeater`.
- La estrategia concreta de caché debe equilibrar simplicidad y corrección para no conservar páginas derivadas cuando cambie realmente la colección origen.
- La futura integración con `table` puede requerir decisiones visuales propias de tabla, pero no debería cambiar la semántica base de paginación definida aquí.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
