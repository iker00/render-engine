# Spec: Collection pagination variants

## Objetivo
Ampliar la paginación local de `repeater` con nuevas variantes declarativas de control: una variante numerada con primera, anterior, páginas, siguiente y última, y una variante de scroll incremental que muestre más items conforme el usuario avanza por la colección, manteniendo la paginación remota y la integración en `table` preparadas como evolución futura pero fuera de esta entrega.

## Alcance
- Extender la superficie actual de `repeater.props.pagination.controls.variant` más allá de `previousNext`.
- Añadir una variante numerada para paginación local en cliente, con controles visibles para ir a primera página, página anterior, páginas concretas, página siguiente y última página.
- Añadir una variante de scroll incremental sobre la colección completa ya resuelta, cargada en cliente, mostrando inicialmente un bloque de `pageSize` items y ampliando el número visible por bloques del mismo tamaño.
- Mantener `pageSize` como tamaño de bloque común para las variantes locales de `repeater`.
- Conservar la semántica vigente de `repeater`: resolución desde `queries.*`, filtrado por key válida y única, contexto `item.*`, estado local por instancia y reset ante cambios de colección o configuración efectiva.
- Mantener el cambio de página o de bloque visible como interacción puramente local, sin ejecutar red, sin modificar `queries.*`, sin alterar `pageEntry`, sin cambiar formularios y sin escribir en la URL.
- Dejar explícito que la futura paginación en servidor deberá poder convivir con estas variantes, pero no queda definida en esta feature.
- Dejar explícito que `table` podrá reutilizar estas variantes más adelante, pero el consumidor visible de esta entrega sigue siendo solo `repeater`.

## Fuera de alcance
- Implementar paginación en `table`.
- Implementar paginación remota, por servidor, por cursor o por metadatos de backend.
- Ejecutar peticiones nuevas al cambiar de página, al pulsar un control o al hacer scroll.
- Definir contrato para `total`, `page`, `limit`, `offset`, `cursor`, `hasNext`, `hasPrevious` o equivalentes remotos.
- Añadir selector de tamaño de página.
- Añadir salto directo mediante input libre de número de página.
- Añadir virtualización de listas largas.
- Añadir ordenación, filtros, búsqueda local o transformación arbitraria de la colección.
- Cambiar la semántica de `queryStateFeedback`, `visibility`, `preloads`, navegación o ejecución de operaciones remotas.
- Cambiar el comportamiento de `repeater` cuando no declara paginación.

## Requisitos funcionales
- Un `repeater` paginado debe poder declarar una variante de controles `previousNext`, `numbered` o `scroll`.
- La variante `previousNext` debe conservar el comportamiento vigente.
- Si `props.pagination.controls` se omite, el default efectivo debe seguir siendo compatible con el comportamiento actual.
- La variante `numbered` debe mostrar controles para primera página, página anterior, selección de páginas, página siguiente y última página cuando exista más de una página efectiva.
- En la variante `numbered`, la página activa debe estar identificada visual y semánticamente como la página actual.
- En la variante `numbered`, los controles de primera y anterior no deben ser accionables en la primera página.
- En la variante `numbered`, los controles de siguiente y última no deben ser accionables en la última página.
- En la variante `numbered`, seleccionar una página concreta debe renderizar los items correspondientes a esa página sin modificar la colección origen.
- La variante `numbered` debe conservar una indicación comprensible de posición mediante la página activa, sin renderizar texto auxiliar del tipo `Página X de Y`.
- La variante `scroll` debe renderizar inicialmente como máximo los primeros `pageSize` items renderizables.
- En la variante `scroll`, al avanzar por scroll hasta el umbral definido por el runtime, se debe ampliar la ventana visible con el siguiente bloque de hasta `pageSize` items.
- La variante `scroll` debe repetir esa ampliación incremental hasta que todos los items renderizables de la colección local estén visibles.
- En la variante `scroll`, cuando todos los items estén visibles no debe quedar una acción o indicador que sugiera que existen más resultados locales.
- La variante `scroll` no debe pedir datos nuevos al backend ni relanzar operaciones `api`.
- La variante `scroll` debe ser una capacidad de carga incremental local, no una definición de paginación remota anticipada.
- En todas las variantes, la paginación debe aplicarse después de resolver la colección completa y después de filtrar los items no renderizables por key ausente, no escalar o duplicada.
- En todas las variantes, `item` e `item.*` deben seguir apuntando al item original visible de la colección origen.
- En todas las variantes, varios `repeater` paginados en la misma pantalla deben mantener estado local independiente aunque lean la misma query.
- En todas las variantes, cambiar la colección origen o `pageSize` debe devolver el estado local a una posición inicial válida.
- En todas las variantes, una colección vacía, no disponible o no coleccionable debe degradar a cero iteraciones sin controles accionables.
- En todas las variantes, `queryStateFeedback` debe seguir siendo el mecanismo recomendado para loading, error, idle y empty de la query origen.
- La validación previa al render debe rechazar variantes de control no soportadas y configuraciones ambiguas que parezcan paginación remota o scroll remoto.
- El contrato debe preservar una vía clara para añadir paginación remota más adelante sin reutilizar en silencio campos locales con significado incompatible.

## Requisitos no funcionales
- La feature debe mantenerse dentro del alcance local en cliente ya existente para `repeater`.
- El contrato debe seguir siendo producible desde backend con JSON simple y catálogos cerrados.
- La UI de controles debe respetar la baseline institucional compacta vigente y la gramática visual compartida del runtime.
- La variante numerada debe ser usable con un número moderado de páginas sin introducir un componente visual complejo ni una API de personalización visual libre.
- La variante de scroll debe ser robusta en navegadores modernos y degradar sin romper el render cuando no pueda observar el final de la lista.
- La implementación futura debe evitar acoplar la semántica de variantes a detalles internos del `template` de `repeater`.
- La base funcional debe quedar preparada para que `table` pueda reutilizar variantes equivalentes en una feature posterior.
- La futura paginación en servidor debe poder introducirse como contrato separado, sin cambiar el significado local de estas variantes.

## Criterios de aceptación
- Dado un `repeater` con `controls.variant: 'previousNext'`, el comportamiento visible sigue siendo el ya existente.
- Dado un `repeater` con `controls.variant: 'numbered'`, una colección de 5 items y `pageSize: 2`, al entrar se muestran los 2 primeros items y la página 1 aparece como actual.
- Dado el mismo caso numerado, al seleccionar la página 2 se muestran los items 3 y 4.
- Dado el mismo caso numerado, al seleccionar la última página o pulsar el control de última se muestra el item 5.
- Dado un usuario en la primera página numerada, los controles de primera y anterior no permiten retroceder.
- Dado un usuario en la última página numerada, los controles de siguiente y última no permiten avanzar.
- Dado un `repeater` numerado con una sola página efectiva, no aparecen controles accionables innecesarios.
- Dado un `repeater` con `controls.variant: 'scroll'`, una colección de 5 items y `pageSize: 2`, al entrar se muestran los 2 primeros items.
- Dado el mismo caso de scroll, al alcanzar el umbral de avance se muestran los items 1 a 4.
- Dado el mismo caso de scroll, al alcanzar de nuevo el umbral se muestran los 5 items y la variante deja de indicar que hay más resultados locales.
- Dado un `repeater` con variante `scroll`, avanzar por la colección no dispara ninguna llamada remota ni modifica el estado de `queries.*`.
- Dado cualquier variante paginada, los descendientes que usan `item.*` siguen leyendo y enviando datos del item visible correcto.
- Dado un refetch que reemplaza la colección origen, la variante activa vuelve a una posición inicial válida y no conserva una página o ventana fuera de rango.
- Dado un cambio de `pageSize`, la variante activa vuelve a una posición inicial válida con el nuevo tamaño de bloque.
- Dado varios `repeater` paginados en una misma página, navegar o avanzar en uno no cambia la posición de los otros.
- Dada una colección con items omitidos por key inválida o duplicada, esos items no cuentan para páginas, números ni bloques de scroll.
- Dada una query en `loading`, `error`, `idle` o con datos no coleccionables, el `repeater` conserva la degradación actual a cero iteraciones y deja el feedback visible a `queryStateFeedback`.
- Dada una configuración con una variante no soportada, el config falla antes del render con diagnóstico trazable.
- Dada una configuración que intenta declarar metadatos o cursores remotos dentro de esta superficie local, el config se rechaza antes del render con diagnóstico trazable.

## Casos límite
- Colección con menos items que `pageSize`.
- Colección con exactamente un múltiplo de `pageSize`.
- Colección con muchas páginas numeradas que no deberían romper el layout compacto.
- Variante `scroll` dentro de un contenedor con grid efectivo.
- Variante `scroll` en una página con más de un `repeater` paginado.
- Variante `scroll` cuando la colección cambia mientras el usuario ya había cargado varios bloques.
- Refetch manual que deja temporalmente `status: loading` conservando el último `data` válido.
- Template de `repeater` con botones que navegan o ejecutan operaciones usando `item.*`.
- Items omitidos por key ausente, no escalar o duplicada.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes tras confirmar que `scroll` será incremental local por ahora y que `table` queda fuera de esta entrega.
- La futura paginación en servidor deberá definirse como una capacidad separada para no mezclar semántica local con contratos remotos.
- La futura integración de `table` deberá reutilizar el vocabulario funcional de variantes cuando encaje, pero puede requerir decisiones visuales propias de tabla.
- La variante numerada puede requerir una decisión de truncado visual si el número de páginas es alto; esa decisión debe cerrarse en diseño técnico sin abrir personalización libre desde JSON.

## Áreas de producto afectadas
- Runtime UI configurable.
- Contrato de configuración.
- Queries y feedback.

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
