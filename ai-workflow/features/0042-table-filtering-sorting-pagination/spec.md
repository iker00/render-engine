# Spec: Table filtering, sorting and pagination

## Objetivo
Ampliar el nodo `table` para que pueda filtrar, ordenar y paginar en cliente sus filas manuales o dinamicas, reutilizando la semantica de paginacion local ya disponible en `repeater` y dejando una frontera clara para que mas adelante puedan existir filtrado, ordenacion y paginacion remotos sin cambiar el significado de la capacidad local.

## Alcance
- Anadir filtros locales declarativos por columna sobre el valor visible de las celdas.
- Renderizar los filtros encima de la tabla, alineados a la izquierda, fuera de la fila de cabeceras.
- Permitir que cada filtro use como placeholder el nombre visible de la columna por defecto, con opcion de sobrescribirlo desde la configuracion de esa columna.
- Mostrar una accion visible `Reiniciar filtros` solo cuando exista al menos un filtro activo.
- Anadir ordenacion local declarativa por columna, activada solo en columnas marcadas como ordenables.
- Permitir que `props.columns` declare solo las columnas con comportamiento especial, sin exigir una entrada por cada cabecera visible.
- Anadir paginacion local opt-in en `table` con el mismo modelo funcional que `repeater`: `pageSize` y variantes `previousNext`, `numbered` y `scroll`.
- Aplicar filtros, ordenacion y paginacion sobre la coleccion de filas ya resuelta por la tabla, sin ejecutar red ni modificar `queries.*`.
- Mantener el comportamiento actual de `table` cuando no declara filtros, ordenacion ni paginacion.
- Conservar la degradacion segura vigente de tablas manuales y dinamicas cuando faltan datos, una fuente no resuelve una coleccion o una celda no produce valor visible.
- Dejar preparado el contrato para distinguir en el futuro entre procesamiento local y procesamiento remoto, sin definir todavia el contrato remoto.
- Mantener `queryStateFeedback` como mecanismo recomendado para representar `idle`, `loading`, `error`, `empty` y `success` de la query que alimenta la tabla.

## Fuera de alcance
- Implementar filtrado, ordenacion o paginacion remotos en esta feature.
- Ejecutar peticiones nuevas al escribir un filtro, cambiar la ordenacion, cambiar de pagina o avanzar por scroll.
- Definir parametros remotos como `limit`, `offset`, `page`, `cursor`, `sort`, `order`, `filters`, `total`, `hasNext` o equivalentes.
- Anadir filtros globales de busqueda sobre toda la tabla.
- Anadir filtros avanzados por tipo, rangos, operadores configurables, multiseleccion de valores, fechas relativas o expresiones.
- Anadir ordenacion multiple, ordenacion por expresiones, ordenacion personalizada por tipo o comparadores configurables desde JSON.
- Anadir selector de tamano de pagina, salto directo por input, seleccion de filas, acciones por fila, edicion inline, agrupacion o virtualizacion.
- Cambiar el contrato de `repeater` o el significado vigente de sus variantes de paginacion.
- Cambiar la semantica de `queryStateFeedback`, `visibility`, `preloads`, navegacion o ejecucion de operaciones remotas.
- Abrir theming declarativo o una API visual libre para tablas avanzadas.

## Requisitos funcionales
- Una `table` sin nuevas props debe conservar exactamente su comportamiento observable actual.
- La tabla debe poder declarar que una o varias columnas son filtrables.
- `props.columns`, cuando exista, debe interpretarse como una lista parcial de columnas configuradas por `id`, no como metadata posicional completa.
- Cada `columns[].id` debe referenciar una cabecera existente en `props.headers`; las cabeceras no referenciadas no son filtrables ni ordenables.
- La validacion debe rechazar ids de columna que no existan en `headers`, ids duplicados dentro de `columns` y flags distintos de `true`.
- Cada filtro local debe actuar sobre una columna concreta y sobre el valor visible final de esa celda.
- Los controles de filtro deben aparecer en una zona superior a la tabla, alineados a la izquierda y en el mismo orden visual de las columnas filtrables.
- Los filtros no deben ocupar una fila dentro de `thead` ni mezclarse con las cabeceras de columna.
- Cada filtro debe tener un nombre accesible estable `Filtrar {header}` independiente del placeholder visible.
- Cada filtro debe usar como placeholder efectivo el nombre de su columna, salvo que `columns[].filterPlaceholder` declare un texto alternativo no vacio.
- `columns[].filterPlaceholder` solo debe aceptarse en columnas con `filterable: true`.
- Los filtros locales por columna deben ser de texto libre y aplicar coincidencia parcial no sensible a mayusculas, minusculas y tildes.
- Cuando haya varios filtros activos, una fila debe permanecer visible solo si cumple todos los filtros activos.
- Un filtro vacio no debe excluir filas.
- Cuando haya al menos un filtro activo, la tabla debe mostrar una accion `Reiniciar filtros` junto a los controles de filtro.
- Al activar `Reiniciar filtros`, todos los filtros de esa tabla deben volver a vacio y la paginacion local debe regresar a una posicion inicial valida.
- Si no hay filtros activos, la accion `Reiniciar filtros` no debe mostrarse.
- La tabla debe poder declarar que una o varias columnas son ordenables.
- Solo las columnas marcadas como ordenables deben ofrecer interaccion de ordenacion al usuario.
- La ordenacion local debe ciclar, sobre una unica columna activa, por los estados ascendente, descendente y sin ordenacion.
- Cambiar la columna ordenada debe sustituir la ordenacion anterior; la feature no introduce ordenacion multiple.
- La ordenacion debe aplicarse sobre el valor visible final de la celda de la columna activa.
- Los valores ausentes o no renderizables deben mantener un comportamiento estable y no romper la ordenacion.
- El orden inicial de una tabla sin ordenacion activa debe conservar el orden resuelto de sus filas.
- La tabla debe poder declarar paginacion local opt-in con `pageSize` y variantes `previousNext`, `numbered` y `scroll`.
- La paginacion local de `table` debe reutilizar el comportamiento funcional de `repeater`: primera pagina inicial, limites de anterior y siguiente, ventana numerada compacta, scroll incremental local y reset ante cambios de coleccion o configuracion efectiva.
- Si `controls` o `controls.variant` se omiten en una tabla paginada, el default efectivo debe ser compatible con `previousNext`.
- La paginacion debe operar sobre el resultado ya filtrado y ordenado.
- El orden de procesamiento local debe ser: resolver filas, aplicar filtros activos, aplicar ordenacion activa y finalmente paginar.
- Cambiar filtros u ordenacion debe devolver la paginacion a una posicion inicial valida.
- Una tabla paginada con cero filas tras filtrar no debe mostrar controles accionables que sugieran resultados disponibles.
- En la variante `scroll`, avanzar por la tabla debe aumentar la cantidad visible de filas ya cargadas; no debe pedir datos al backend.
- Los controles de paginacion de tabla deben comportarse como controles propios de tabla y no como filas adicionales.
- El estado de filtros, ordenacion y paginacion debe ser local a cada instancia de tabla.
- Varias tablas en la misma pagina, incluso si leen la misma query, no deben compartir filtros, ordenacion ni pagina activa por accidente.
- Una recarga de query que reemplace las filas debe dejar la tabla en un estado local valido y no mantener una pagina fuera de rango.
- La validacion previa al render debe rechazar configuraciones ambiguas o invalidas de filtros, ordenacion y paginacion local.
- La validacion debe rechazar intentos de declarar metadatos o parametros remotos dentro de la superficie local de esta feature.
- El contrato debe reservar una via de evolucion para un modo remoto futuro, diferenciable del modo local, sin reinterpretar silenciosamente campos locales.

## Requisitos no funcionales
- La feature debe seguir siendo producible desde backend con JSON simple, catalogos cerrados y validacion previa al render.
- La solucion debe mantenerse acotada al nodo `table`; no debe convertir el runtime en un motor general de transformaciones de coleccion.
- La paginacion debe reutilizar el vocabulario funcional ya estable de `repeater` para evitar dos modelos locales incompatibles.
- La interfaz visible debe respetar la baseline institucional compacta vigente y la gramatica visual actual del runtime.
- Los controles de filtro, ordenacion y paginacion deben ser accesibles mediante controles nativos o semantica equivalente.
- El placeholder de un filtro no debe ser la unica fuente de nombre accesible del control.
- El comportamiento local debe ser determinista para poder cubrirse con tests.
- La futura modalidad remota debe poder anadirse como capacidad explicita, sin cambiar el significado de filtros, ordenacion o paginacion locales ya configurados.

## Criterios de aceptacion
- Dada una tabla existente sin filtros, ordenacion ni paginacion, el runtime renderiza las mismas cabeceras y filas que antes.
- Dada una tabla con cuatro cabeceras y `columns` declarando solo una de ellas, el runtime acepta la configuracion y solo esa columna expone los controles opt-in declarados.
- Dada una columna declarada en `columns` cuyo `id` no coincide con ninguna cabecera, el config se rechaza antes del render con diagnostico trazable.
- Dada una tabla con una columna filtrable, al introducir texto que coincide parcialmente con algunas celdas de esa columna se muestran solo las filas coincidentes.
- Dada una tabla con columnas filtrables, los filtros aparecen encima de la tabla, alineados a la izquierda, y no como fila de cabeceras.
- Dada una columna filtrable sin placeholder configurado, el input usa el nombre de la columna como placeholder efectivo.
- Dada una columna filtrable con `filterPlaceholder`, el input usa ese texto como placeholder efectivo y mantiene el nombre accesible `Filtrar {header}`.
- Dada una columna no filtrable con `filterPlaceholder`, el config se rechaza antes del render con diagnostico trazable.
- Dado un filtro con distinta capitalizacion que el valor visible de una celda, la coincidencia sigue funcionando.
- Dados dos filtros activos en columnas distintas, solo se muestran las filas que cumplen ambos.
- Dado un filtro activo que no coincide con ninguna fila, la tabla queda sin filas visibles y no rompe la pantalla.
- Dado cualquier filtro activo, aparece la accion `Reiniciar filtros`; al activarla, todos los filtros quedan vacios y se restauran las filas que correspondan sin filtros.
- Dada una columna no marcada como ordenable, el usuario no puede activar ordenacion sobre ella.
- Dada una columna marcada como ordenable, el usuario puede ordenar sus filas en ascendente, descendente y volver al estado sin ordenacion usando el mismo control.
- Dada una tabla ordenada por una columna, al activar otra columna ordenable la ordenacion anterior deja de aplicar.
- Dada una tabla dinamica con celdas interpoladas, el filtrado y la ordenacion usan el valor visible final de cada celda.
- Dada una tabla paginada con 5 filas y `pageSize: 2`, al entrar se muestran las 2 primeras filas.
- Dado el mismo caso, al avanzar se muestran las filas 3 y 4, y al volver a avanzar se muestra la fila 5.
- Dado un usuario en la primera pagina, el control anterior no permite retroceder.
- Dado un usuario en la ultima pagina, el control siguiente no permite avanzar.
- Dada una tabla con variante `numbered`, la pagina activa queda identificada y se puede cambiar a una pagina concreta dentro de la ventana compacta.
- Dada una tabla con variante `scroll`, se muestran inicialmente hasta `pageSize` filas y la ventana visible crece localmente por bloques hasta mostrar todas las filas disponibles.
- Dado un cambio de filtro o de ordenacion en una tabla paginada, la tabla vuelve a una posicion inicial valida.
- Dado un refetch que reemplaza la coleccion origen, filtros, ordenacion y paginacion se mantienen en un estado local valido y no dejan visible una pagina fuera de rango.
- Dadas dos tablas paginadas en la misma pantalla, avanzar en una no modifica la pagina activa de la otra.
- Dada una query en `loading`, `error`, `idle` o con datos no coleccionables, la tabla conserva su degradacion actual y deja el feedback visible a `queryStateFeedback`.
- Dada una configuracion con `pageSize` invalido, una variante no soportada o campos remotos dentro de la superficie local, el config se rechaza antes del render con diagnostico trazable.

## Casos limite
- Tabla manual sin filas.
- Tabla dinamica cuya fuente resuelve cero filas.
- Tabla con menos filas que `pageSize`.
- Tabla con exactamente un multiplo de `pageSize`.
- Tabla filtrada que reduce el total a menos filas que la pagina activa anterior.
- Tabla ordenada con valores vacios, booleanos, numeros y strings visibles mezclados.
- Tabla dinamica con celdas parciales que se vacian por referencias no disponibles.
- Variante `numbered` con muchas paginas efectivas.
- Variante `scroll` cuando `IntersectionObserver` no esta disponible.
- Varias tablas en la misma pagina alimentadas por la misma query.
- Refetch manual que deja temporalmente `status: loading` conservando ultimo `data` valido.
- Tabla dentro de un `repeater` que depende de `item.*`.
- Tabla condicionada por `queryStateFeedback` o `visibility`.
- `columns` parcial con una sola columna configurada y varias cabeceras visibles.
- `columns` con id que no existe en `headers`.
- Placeholder configurado en una columna filtrable y placeholder omitido en otra.
- Intento de configurar placeholder en una columna que solo es ordenable.

## Riesgos o preguntas abiertas
- No quedan dudas funcionales bloqueantes tras confirmar que filtros y ordenacion seran locales en esta version y que se deja abierta una modalidad remota futura.
- La modalidad remota futura necesitara un contrato propio para request, respuesta y metadatos; no debe mezclarse con la superficie local de esta feature.
- El contrato de `columns` queda cerrado como lista parcial por `id` contra `headers`, para evitar configurar columnas sin comportamiento especial.
- La ordenacion sobre valor visible puede ser suficiente para v1, pero podria no cubrir necesidades futuras de tipos enriquecidos; esa extension queda fuera de alcance.

## Areas de producto afectadas
- Runtime UI configurable.
- Contrato de configuracion.
- Queries y feedback.

## Documentacion probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
