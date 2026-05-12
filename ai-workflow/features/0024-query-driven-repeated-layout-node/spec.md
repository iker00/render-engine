# Spec: Query-driven repeated layout node

## Objetivo
Permitir que el runtime renderice un subárbol declarativo completo una vez por cada elemento de una colección devuelta por una query, para componer bloques repetidos como tarjetas de posts, resultados de búsqueda o listados ricos sin escribir React específico por pantalla.

## Alcance
- Añadir un nuevo nodo declarativo de repetición orientado a colecciones provenientes de `queries.*`, en lugar de sobrecargar `container` con dos modos estructurales distintos.
- Permitir que un nodo del layout consuma un array desde `queries.{queryName}.data` o desde una ruta anidada bajo `queries.{queryName}.data.*`.
- Renderizar por cada item una plantilla declarativa compuesta por varios nodos ya soportados por el runtime, conservando el orden de la colección resuelta.
- Exponer dentro de cada iteración un contexto local para leer el item actual y sus campos desde las mismas superficies dinámicas donde hoy ya existen referencias completas.
- Permitir que esa composición repetida se use para bloques de lectura y para acciones ligadas al item actual, como navegación con params o `executeOperation` con datos del item.
- Mantener la compatibilidad con `queryStateFeedback`, `visibility`, `preloads`, `navigateTo`, `goBack` y `executeOperation` tal como ya funcionan hoy fuera de este nuevo nodo.
- Permitir que el nodo declare explícitamente qué campo del item actúa como identificador estable por iteración.

## Fuera de alcance
- Añadir en esta iteración nuevos nodos visuales, incluido un nodo de imagen.
- Convertir el runtime en un motor general de plantillas, expresiones, filtros, ordenaciones cliente o transformaciones arbitrarias de datos.
- Introducir nuevas fuentes de colección fuera de `queries.*`, como `forms.*`, `params.*`, arrays literales complejos o combinaciones de varias queries.
- Resolver paginación, carga incremental, virtualización o refetch automático específico para este patrón.
- Permitir generación dinámica de `formId`, `fieldId` u otros identificadores estructurales a partir del item actual.
- Abrir en esta iteración repetición de catálogos dinámicos de campos de formulario dentro de un mismo `form`.

## Requisitos funcionales
- El contrato del runtime debe incorporar un nuevo nodo orientado a repetir contenido por item de una colección remota ya disponible en `queries.*`.
- Ese nodo debe declarar una fuente que apunte a `queries.{queryName}.data` o a una ruta anidada bajo `queries.{queryName}.data.*`, y el runtime debe tratar esa fuente como una colección ordenada.
- Si la query aún no se ha ejecutado, falla, la ruta no existe o el valor runtime actual no es un array, el nodo no debe romper el render ni inventar contenido; debe degradar a cero iteraciones visibles.
- El nodo debe permitir definir una plantilla repetida bajo un campo propio del nodo, compuesta por uno o varios nodos hermanos soportados por el runtime, sin imponer un wrapper visual extra cuando la composición no lo necesite.
- La plantilla repetida debe renderizarse una vez por cada elemento de la colección resuelta, respetando el orden recibido.
- Dentro de cada iteración debe existir una referencia local al item actual para que nodos descendientes puedan leer:
  - el item completo cuando sea escalar
  - campos del item cuando sea objeto
  - rutas anidadas dentro del item cuando el dato lo permita
- Ese contexto local por iteración debe seguir la misma lógica de acceso declarativo que el runtime ya usa en el resto de colecciones dinámicas, evitando introducir una convención distinta solo para este nodo.
- Ese contexto local por iteración debe poder consumirse, como mínimo, en las mismas superficies que hoy ya aceptan referencias completas dentro de un subárbol normal, incluyendo texto visible, params de navegación y payloads de `executeOperation`.
- Las referencias ya existentes a `queries.*`, `forms.*` y `params.*` deben seguir disponibles dentro del subárbol repetido; el nuevo contexto local no debe reemplazar silenciosamente la semántica actual del runtime fuera de la iteración.
- Si un nodo concreto dentro de una iteración no puede resolver el dato esperado del item actual, la degradación debe seguir la política del consumidor afectado y no romper toda la iteración ni el resto del listado.
- La feature debe permitir el caso de composición donde un mismo item produce varios bloques visibles coordinados, por ejemplo título, descripción y acción, sin obligar a convertirlo en un `list` textual.
- La plantilla repetida debe admitir el mismo catálogo de nodos soportados por el runtime en un subárbol normal, incluidos los formularios, aunque su utilidad inicial prevista esté más orientada a contenido de lectura y acciones por item.
- `queryStateFeedback` debe seguir siendo el mecanismo previsto para mostrar estados previos, carga, error o vacío alrededor de la query origen; el nuevo nodo no debe introducir una semántica paralela de feedback.
- El nodo debe exigir un identificador declarativo por item para dar estabilidad a cada iteración; si la colección no ofrece un campo utilizable para esa función, la configuración debe considerarse incompleta para este patrón.
- La validación previa al render debe rechazar configuraciones incoherentes, incluyendo como mínimo:
  - fuentes fuera del alcance `queries.{queryName}.data` o `queries.{queryName}.data.*`
  - ausencia de la plantilla repetida
  - ausencia del identificador declarativo por item
  - combinaciones ambiguas entre contenido repetido y otras ramas estructurales incompatibles del mismo nodo
- Una configuración que no use este nuevo nodo debe conservar el mismo comportamiento observable que hoy.

## Requisitos no funcionales
- La solución debe mantenerse intencionadamente acotada a repetición declarativa por item, sin abrir todavía un lenguaje general de templates.
- La terminología debe alinearse con el runtime actual: `queries.*`, `layout`, `children`, `queryStateFeedback`, `visibility`, `navigateTo` y `executeOperation`.
- El contrato debe seguir siendo producible desde backend con JSON simple y sin requerir adaptadores React específicos por pantalla.
- La validación debe seguir siendo previa al render, con diagnóstico visible en desarrollo y rutas trazables del JSON cuando la configuración sea inválida.
- El comportamiento debe ser coherente con la política actual de degradación segura del runtime cuando faltan datos remotos o una referencia no puede resolverse.
- La feature debe dejar una base reutilizable para futuros consumidores declarativos de contexto por item, pero sin comprometer todavía extensiones como imágenes, grids avanzados o formularios dinámicos.
- El contrato debe priorizar una semántica explícita y revisable frente a heurísticas implícitas para derivar claves de React u otras identidades de iteración.

## Criterios de aceptación
- Dada una query que devuelve un array de objetos `posts`, el runtime puede renderizar un bloque repetido por cada post usando una plantilla con varios nodos ya soportados, por ejemplo `heading`, `paragraph` y `button`.
- Dada una plantilla repetida que usa campos del item actual para texto visible, cada iteración muestra los valores correspondientes al elemento de su posición y no los de otro item.
- Dado un `button` dentro de la plantilla repetida que navega con params o ejecuta una operación remota usando datos del item actual, cada iteración dispara la acción con los datos correctos de ese item.
- Dada una query que devuelve un array de escalares, el nodo puede renderizar una iteración por valor usando la referencia local al item actual.
- Dada una query aún no ejecutada, fallida o cuya ruta declarada no resuelve un array utilizable, el runtime no falla y el nodo se comporta como colección vacía.
- Dado un item parcial donde falta alguno de los campos usados por un nodo descendiente, solo ese consumidor degrada según su semántica actual y el resto de la iteración sigue renderizando.
- Dada una plantilla repetida que incluye cualquier nodo ya soportado en el runtime, el subárbol se valida y renderiza con las mismas reglas estructurales que fuera de la repetición.
- Dada una pantalla que ya usa `queryStateFeedback` sobre la query origen, la UI puede seguir mostrando loaders, error o vacío sin introducir un segundo mecanismo de estado específico para repetición.
- Dada una configuración que usa solo nodos actuales y no declara el nuevo nodo, el comportamiento del runtime permanece sin cambios.
- Dada una configuración cuyo origen sale del alcance `queries.{queryName}.data`, que omite la plantilla repetida o que no declara un identificador por item, el config completo se rechaza antes del render con diagnóstico trazable.

## Casos límite
- La query devuelve `[]` y la pantalla quiere mostrar un estado de vacío específico alrededor del bloque repetido.
- La query devuelve un objeto, `null` o un escalar en una ruta donde la configuración esperaba un array.
- La colección contiene mezcla de items completos e items parciales.
- El item actual es un escalar y la plantilla intenta leer una subruta propia de objeto.
- Varias iteraciones renderizan acciones distintas usando la misma query origen y cada una necesita transportar su propio identificador.
- Un refetch conserva temporalmente el último `data` válido mientras `status` vuelve a `loading`; la pantalla debe poder seguir decidiendo con `queryStateFeedback` qué mostrar alrededor del bloque repetido.
- La composición visual deseada necesita varios nodos hermanos por item y no un único wrapper.
- Una pantalla incluye un `form` dentro de la plantilla repetida; el contrato debe admitirlo aunque el caso de producto prioritario no sea ese.

## Riesgos o preguntas abiertas
- Debe cerrarse en diseño el nombre público definitivo y el shape exacto del nuevo nodo en el JSON, manteniéndolo separado de `container` para no mezclar dos responsabilidades estructurales en el mismo tipo.
- Debe cerrarse en diseño la sintaxis exacta del acceso al item actual para que siga la misma lógica que el resto de colecciones dinámicas sin abrir una mini DSL nueva.
- Debe cerrarse en diseño el nombre concreto del campo que contendrá la plantilla repetida y del campo que declarará el identificador estable por item.
- Debe cerrarse en diseño cómo se comporta el identificador obligatorio cuando la colección contiene duplicados, nulos o valores no escalares.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
