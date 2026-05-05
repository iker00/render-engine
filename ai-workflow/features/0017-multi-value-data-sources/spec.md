# Spec: Multi-value data sources

## Objetivo
Permitir que los nodos y campos del runtime que consumen colecciones de valores puedan obtenerlas tanto desde listas definidas manualmente en el JSON como desde datos devueltos por una query declarativa, sin exigir lógica imperativa específica por pantalla.

## Alcance
- Introducir una capacidad funcional compartida para consumidores del runtime que renderizan o validan múltiples valores.
- Aplicar esa capacidad, en esta iteración, a `list` y `select`, que son los consumidores de colecciones ya soportados hoy.
- Permitir que una colección se defina de forma manual dentro del JSON o se resuelva desde `queries.{queryName}.data` o desde cualquier rama anidada bajo `queries.{queryName}.data.*`.
- Soportar colecciones de escalares y colecciones de objetos cuando el consumidor necesite mapear qué dato mostrar y, en su caso, qué dato usar como valor estable.
- Mantener la compatibilidad funcional con configuraciones actuales que ya declaran listas u opciones manuales.
- Reutilizar `queryStateFeedback` como mecanismo para guiar loading, error, empty o mensajes previos a la carga, sin introducir un sistema nuevo de estados para colecciones.
- Dejar una base reutilizable para futuros campos o nodos que necesiten consumir múltiples valores, sin añadir todavía nuevos tipos de nodo en esta misma feature.

## Fuera de alcance
- Añadir nuevos nodos visuales o nuevos tipos de campo distintos de `list` y `select`.
- Introducir búsquedas remotas, autocompletado, paginación, multiselect o carga incremental de opciones.
- Añadir un motor general de transformaciones, filtros, ordenación cliente, interpolaciones o expresiones arbitrarias sobre colecciones.
- Introducir nuevas fuentes de datos declarativas fuera de colecciones manuales y datos ya presentes en `queries.*`.
- Cambiar la semántica de ejecución de `api`, `preloads`, refetch o caché.
- Resolver en esta iteración validaciones avanzadas de negocio sobre el contenido remoto más allá de lo necesario para renderizar o seleccionar valores de forma estable.

## Requisitos funcionales
- El runtime debe permitir que un consumidor de múltiples valores declare si su colección proviene de datos manuales o de una query ya existente en el store compartido.
- La capacidad debe aplicarse en esta iteración como mínimo a:
  - `list`, para renderizar una colección visible de items
  - `select`, para renderizar una colección de opciones seleccionables
- Una colección manual debe poder seguir definiéndose íntegramente en el JSON de configuración sin depender de `api`.
- Una colección dinámica debe poder apuntar a `queries.{queryName}.data` cuando la query devuelve la colección en raíz, o a una ruta declarativa anidada bajo `queries.{queryName}.data.*`, y resolverse contra el último dato disponible de esa query.
- Si la ruta declarada para una colección dinámica no existe todavía, la query aún no se ha ejecutado, la query falla o el dato resuelto no es una colección válida, el runtime no debe romper el render ni inventar elementos; el consumidor debe comportarse como colección vacía hasta que existan datos válidos.
- `queryStateFeedback` debe seguir siendo la herramienta prevista para mostrar placeholders, loaders, errores o mensajes de “sin resultados” alrededor de esos consumidores.
- `list` debe poder renderizar:
  - colecciones manuales de strings como hoy
  - colecciones dinámicas de escalares
  - colecciones manuales o dinámicas de objetos cuando se declare qué dato de cada elemento se muestra como texto visible
- `select` debe poder renderizar:
  - colecciones manuales de opciones como hoy
  - colecciones dinámicas de escalares usando el mismo dato como etiqueta visible y valor seleccionable
  - colecciones manuales o dinámicas de objetos cuando se declare qué dato de cada elemento se usa como etiqueta visible y qué dato se usa como valor seleccionable
- La semántica de mapeo para colecciones de objetos debe ser declarativa y específica del consumidor, evitando exigir transformaciones previas en React para adaptar la respuesta de la API.
- La configuración dinámica debe distinguir de forma inequívoca una colección de escalares de una colección de objetos: los casos de escalares deben declararse explícitamente como tales y los casos de objetos deben declarar los mapeos mínimos del consumidor.
- En `select`, los valores efectivos de las opciones deben seguir siendo homogéneos dentro del mismo campo para no introducir opciones ambiguas.
- En `select`, si el valor actualmente almacenado para el campo ya no existe dentro de la colección efectiva disponible, el control debe comportarse como vacío para render, validación y envío.
- En `select`, un `defaultValue` ya soportado debe seguir funcionando cuando coincida con una opción efectiva disponible de la colección resuelta.
- La feature no debe redefinir la semántica actual de inicialización lazy del formulario: si un campo ya quedó inicializado dentro de la instancia activa, la aparición posterior de nuevas opciones no debe rehidratar silenciosamente el campo como si fuera una primera carga.
- Si un `select` obligatorio queda sin una opción efectiva válida, debe seguir considerándose vacío para la validación `required`.
- Cuando una colección de objetos declare mapeos obligatorios y alguno de los elementos no pueda resolver los datos mínimos requeridos para el consumidor, el runtime debe degradar ese elemento de forma predecible y diagnóstica en desarrollo en vez de romper todo el árbol visible.
- La configuración debe rechazar combinaciones ambiguas o incoherentes, incluyendo como mínimo:
  - declarar a la vez dos orígenes incompatibles para la misma colección
  - omitir el mapeo necesario cuando el consumidor recibe objetos y no escalares
  - mezclar tipos de valor incompatibles dentro del mismo `select`
- Una referencia dinámica válida bajo `queries.{queryName}.data` o `queries.{queryName}.data.*` no debe invalidar el config por el hecho de que el dato runtime actual todavía sea `null`, un escalar, un objeto no coleccionable o una ruta ausente; en esos casos el consumidor debe degradar a colección vacía.
- Una configuración que siga usando solo listas y opciones manuales actuales debe conservar el mismo comportamiento observable.

## Requisitos no funcionales
- La solución debe mantener el alcance acotado de v1 y resolver un caso de producto concreto: reutilizar datos de API o listas manuales en consumidores de colecciones sin convertirse en un lenguaje general de transformación de datos.
- La terminología debe mantenerse alineada con el proyecto actual: `queries.*`, `select`, `list`, `defaultValue`, `required` y `queryStateFeedback`.
- El contrato debe seguir siendo producible desde backend legacy con estructuras razonablemente simples y sin exigir código cliente ad hoc por cada catálogo remoto.
- La validación debe seguir siendo previa al render, con diagnóstico visible en desarrollo y rutas canónicas del JSON cuando la configuración sea inválida.
- El comportamiento debe seguir siendo coherente entre contrato JSON, renderer, store compartido, validación de formularios y documentación funcional.
- La capacidad compartida debe poder reutilizarse en futuras features sin obligar a redefinir desde cero la diferencia entre listas manuales y colecciones procedentes de query.

## Criterios de aceptación
- Dado un `list` configurado con una colección manual equivalente a la actual, el runtime sigue renderizando sus elementos sin cambios observables.
- Dado un `list` configurado contra una colección dinámica de escalares devuelta por una query, el runtime muestra un elemento visible por cada valor resuelto cuando la query tiene datos válidos.
- Dado un `list` configurado contra una colección de objetos con mapeo declarativo, el runtime muestra el texto indicado para cada elemento sin exigir adaptar la respuesta de la API fuera del JSON.
- Dado un `select` configurado con opciones manuales equivalentes a las actuales, el runtime sigue permitiendo seleccionar y enviar valores como hoy.
- Dado un `select` configurado contra una colección dinámica de escalares, el runtime construye opciones usando cada valor como etiqueta y valor efectivo.
- Dado un `select` configurado contra una colección de objetos con mapeo declarativo de etiqueta y valor, el runtime construye las opciones correctas a partir de los datos de query.
- Dada una colección dinámica cuya query aún no tiene datos válidos, el consumidor afectado se mantiene estable y se comporta como vacío hasta que la query resuelva una colección utilizable.
- Dado un `select` `required` cuyo valor actual ya no coincide con ninguna opción efectiva tras cambiar la colección disponible, el campo pasa a comportarse como vacío y vuelve a validarse como tal.
- Dada una configuración ambigua que mezcla dos orígenes incompatibles para la misma colección, el config completo falla en validación previa al render.
- Dada una configuración que apunta a una ruta dinámica no coleccionable o que omite mapeos obligatorios para elementos objeto, el config completo falla en validación previa al render con diagnóstico trazable.
- Dada una pantalla que combina `queryStateFeedback` con un `list` o `select` dinámico, la UI puede seguir mostrando sus estados de espera, error o vacío usando la semántica estable ya existente del runtime.

## Casos límite
- La query observada existe en `api` pero todavía no ha sido ejecutada y el consumidor se renderiza por primera vez.
- La query devuelve `null`, un objeto suelto o un escalar en una ruta que la configuración esperaba como colección.
- La colección dinámica queda vacía tras una búsqueda y el layout usa `queryStateFeedback.empty` para mostrar un fallback específico.
- Un `select` ya tenía un valor válido y un refetch posterior devuelve una colección donde ese valor ya no existe.
- Una colección de objetos contiene algunos elementos incompletos junto con otros válidos.
- Dos consumidores distintos reutilizan la misma colección dinámica pero con mapeos distintos, por ejemplo un `list` que muestra nombres y un `select` que usa `id` como valor.
- Un `select` visible se inicializa antes de que exista la colección dinámica y más tarde recibe opciones; la feature debe respetar la semántica actual de inicialización del campo y no tratar esa llegada tardía como una reinicialización implícita.

## Riesgos o preguntas abiertas
- Debe cerrarse en planificación la forma exacta del contrato declarativo compartido para distinguir origen manual y origen dinámico sin romper compatibilidad con `items` ya existentes.
- Debe cerrarse en planificación el nivel exacto de diagnóstico y degradación para elementos individuales inválidos dentro de una colección de objetos, equilibrando robustez visible y trazabilidad en desarrollo.
- El origen dinámico se declarará con `queries.{queryName}.data` cuando la API devuelva la colección en raíz, o con rutas bajo `queries.{queryName}.data.*` cuando la colección viva dentro de una rama anidada; por ejemplo, si la API devuelve `{ "results": [] }`, el path esperado será `queries.searchUsers.data.results`.
- Para colecciones de objetos se admiten rutas relativas simples o anidadas por item, por ejemplo `name` o `author.name`.
- Si un `select` pierde la opción correspondiente al valor persistido, el runtime debe limpiar el estado almacenado del campo a `''` para mantener alineados render, validación y submit.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback
- Formularios y validación

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
