# Spec: Declarative query state feedback

## Objetivo
Permitir que un nodo del layout declare de forma explícita cómo debe comportarse mientras la query de la que depende está en `loading`, `error`, `empty` o `success`, para que la UI configurable pueda ocultar bloques, mostrarlos solo en estados concretos o renderizar un fallback propio sin lógica imperativa externa.

## Alcance
- Añadir una capacidad declarativa por nodo para ligar su render visible al estado de una query concreta del runtime.
- Reutilizar el dominio compartido `queries.{queryName}` ya existente como fuente única de verdad para decidir el feedback visual.
- Cubrir tanto queries disparadas de forma explícita como queries hidratadas automáticamente por `preloads`, ya que ambas acaban proyectando su estado en `queries.{queryName}`.
- Permitir que cada nodo configure, por estado visible, una de estas respuestas:
  - renderizar el nodo original
  - ocultarse
  - renderizar un fallback propio en su lugar
- Permitir que el fallback propio sea declarativo y local al nodo afectado, sin exigir un fallback global de página.
- Mantener esta primera iteración acotada a una sola dependencia por nodo y a un conjunto cerrado de estados visibles, sin abrir todavía un motor general de reglas o expresiones.

## Fuera de alcance
- Introducir un motor de condiciones arbitrarias con varias queries, operadores booleanos o expresiones sobre datos.
- Exponer en esta iteración el agregado `pageEntry` como nueva fuente declarativa de feedback visual.
- Añadir disparadores nuevos para ejecutar queries, refetch automáticos o mutaciones API.
- Crear un nodo `skeleton` dedicado, un sistema de theming o una librería visual específica para placeholders.
- Convertir esta feature en un sistema general de visibilidad, permisos o reglas de layout no ligadas al estado de datos.
- Abrir navegación declarativa adicional sobre `queries.{queryName}.error.*` u otras subrutas hoy fuera del contrato estable.

## Requisitos funcionales
- Cualquier nodo soportado del layout puede declarar opcionalmente una configuración de feedback ligada a una query concreta identificada por nombre.
- Si un nodo no declara esa configuración, mantiene el comportamiento actual del runtime sin cambios observables.
- La configuración de feedback de un nodo debe evaluar una única query como dependencia en esta v1.
- El runtime debe resolver para esa dependencia uno de estos estados visibles:
  - `loading`
  - `error`
  - `empty`
  - `success`
- El estado visible `loading` debe cubrir también el caso en que la query todavía esté en `idle`, para no introducir una quinta rama declarativa en esta primera versión.
- El estado visible `error` debe activarse cuando `queries.{queryName}.status` sea `error`.
- El estado visible `success` debe activarse cuando la query haya terminado correctamente y su resultado no se considere vacío según la semántica estable de esta feature.
- El estado visible `empty` debe activarse cuando la query haya terminado correctamente pero el dato resultante se considere vacío.
- En esta primera versión, un resultado de query se considera vacío cuando su `data` final es:
  - `null` o `undefined`
  - un string vacío
  - un array vacío
  - un objeto sin claves
- Los valores escalares distintos de string vacío, incluidos `0` y `false`, no deben tratarse como `empty`.
- Para cada uno de los estados visibles soportados, un nodo puede declarar una de estas respuestas:
  - mostrar el nodo original
  - ocultar el nodo
  - sustituir el nodo por un fallback declarativo propio
- Cuando un nodo declara feedback ligado a una query, el comportamiento por defecto debe ser:
  - `success`: mostrar el nodo original
  - `loading`, `error` y `empty`: ocultar el nodo si ese estado no tiene una respuesta explícita declarada
- El fallback propio debe poder definirse como una rama declarativa local reutilizando el catálogo de nodos soportado por el runtime en ese momento.
- Si el fallback declarado para un estado es estructuralmente inválido, la configuración completa debe rechazarse en la validación previa al render.
- Un mismo `queryName` puede condicionar varios nodos distintos del mismo layout o de layouts distintos sin colisionar entre sí.
- Varios nodos pueden reaccionar de forma distinta ante el mismo estado de una misma query.
- Cuando la query cambie de estado por una nueva ejecución o recarga, el runtime debe reevaluar el feedback de los nodos dependientes y actualizar su salida visible en consecuencia.
- Una recarga que entre en `loading` conservando un `data` previo debe seguir tratándose visualmente como `loading` para los nodos que hayan optado a esta capacidad, salvo que ese nodo haya configurado explícitamente otra respuesta para `loading`.

## Requisitos no funcionales
- La sintaxis de esta capacidad debe seguir siendo simple de generar desde backend legacy: una dependencia por nodo y un mapa acotado de estados visibles.
- La feature debe reutilizar el dominio `queries` ya existente y no abrir un store paralelo de feedback visual.
- El comportamiento debe ser determinista aunque varias queries cambien de estado en rápida sucesión.
- La solución debe preservar el alcance acotado de la v1: resolver feedback visual ligado a datos sin convertirse todavía en un lenguaje general de reglas declarativas.
- La terminología debe mantenerse alineada con el vocabulario actual del proyecto: `queries`, `status`, `data`, `error`, `preloads`, `loading`, `success` y `empty`.
- La capacidad debe seguir siendo revisable y validable antes del render, sin depender de convenciones implícitas difíciles de diagnosticar.

## Criterios de aceptación
- Dado un nodo ligado a `queries.searchUsers`, cuando esa query esté en `loading`, el nodo puede ocultarse o renderizar un fallback propio según la configuración declarada.
- Dado un nodo ligado a una query ejecutada por `preloads`, el runtime aplica exactamente la misma semántica de feedback porque el estado observable sigue viviendo en `queries.{queryName}`.
- Dado un nodo con fallback declarado para `loading`, cuando la query pase a `success` con datos no vacíos, el fallback desaparece y se muestra el nodo original.
- Dado un nodo con fallback declarado para `error`, cuando la query falle, el nodo original no se muestra y el fallback de error ocupa su lugar.
- Dado un nodo configurado para mostrarse solo en `success`, cuando la query esté en `loading`, `error` o `empty`, ese nodo no se renderiza.
- Dado un resultado exitoso con `data: []`, el runtime lo trata como `empty`.
- Dado un resultado exitoso con `data: null`, el runtime lo trata como `empty`.
- Dado un resultado exitoso con `data: 0` o `data: false`, el runtime no lo trata como `empty` y aplica la rama de `success`.
- Dado un nodo con feedback ligado a una query inexistente en el contrato `api`, la configuración sigue siendo válida mientras el nombre de query sea una referencia coherente; el nodo reaccionará al estado runtime disponible de esa query si existe ejecución y, si nunca llega a ejecutarse, permanecerá bajo la semántica visible equivalente a `loading`.
- Dada una configuración previa sin feedback por estado en los nodos, el runtime mantiene el comportamiento actual sin introducir ocultaciones ni fallbacks nuevos.

## Casos límite
- Varios nodos pueden escuchar la misma query y renderizar respuestas distintas para `loading`, `error`, `empty` o `success`.
- Un nodo puede depender de una query que nunca llegue a ejecutarse durante la vida de una página; en ese caso, la rama efectiva sigue siendo la equivalente a `loading`.
- Una query puede pasar de `success` a una nueva recarga `loading` conservando datos anteriores; los nodos deben seguir la rama declarada para `loading`, no una mezcla implícita entre dato previo y éxito.
- Un fallback puede necesitar varios nodos visibles en lugar de uno solo; la capacidad declarativa debe permitir esa sustitución local sin exigir un wrapper artificial de página.
- Una query puede resolver un objeto vacío `{}` o un string vacío `""`; ambos casos deben tratarse como `empty`.
- Un nodo puede declarar solo una parte de los estados; los no declarados siguen la política por defecto de esta feature.

## Riesgos o preguntas abiertas
- Queda pendiente decidir en planificación cuál será el nombre final y el shape exacto del bloque de configuración dentro de cada nodo, procurando que siga siendo simple y coherente con el contrato JSON actual.
- Habrá que decidir si una iteración futura debe reutilizar exactamente este mismo modelo para el agregado `pageEntry` o si ese caso necesita otra abstracción separada para feedback de pantalla completa.
- La heurística común de `empty` cubre el caso base, pero futuras features podrían necesitar una forma adicional de redefinir vacío para datos de dominio más específicos sin romper la simplicidad de v1.
- La combinación de validación de contrato, render alternativo local y semántica de estados compartidos es transversal y justifica `design.md` antes de implementar.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
