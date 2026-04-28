# Spec: Centralized runtime reference resolution

## Objetivo
Introducir una convención explícita y estable para resolver referencias string dentro del JSON del runtime, como `forms.*`, `queries.*` y futuras rutas de estado, de forma centralizada y extensible, evitando que cada nodo visual o capacidad futura tenga que interpretar esas rutas por su cuenta.

## Alcance
- Fijar una única convención funcional para referencias dinámicas basadas en rutas string dentro del contrato JSON del runtime.
- Cubrir desde esta feature las referencias a estado compartido ya existente del runtime, en particular `forms.*` y `queries.*`.
- Limitar la primera iteración de consumo visible de referencias dinámicas a `heading.props.text` y `paragraph.props.text`.
- Dejar previsto el crecimiento hacia otras rutas del mismo modelo, como navegación u otras superficies de estado del runtime, sin redefinir la convención desde cero.
- Alinear que la resolución de referencias forme parte del comportamiento del runtime y no de decisiones ad hoc por nodo visual.
- Mantener el alcance acotado a resolución de rutas completas y explícitas, sin convertir esta feature en un motor genérico de expresiones o plantillas.
- Limitar la convención de esta fase a referencias completas simples como `forms.userSearch.name` o `queries.searchUsers.data`, dejando fuera por ahora cualquier interpolación dentro de strings.
- Permitir que futuras features de formularios, queries, visibilidad condicional o datos iniciales reutilicen la misma convención funcional.

## Fuera de alcance
- Diseñar una sintaxis completa de expresiones, operadores lógicos o plantillas interpoladas arbitrarias dentro de strings.
- Resolver todavía toda la UX visual final de formularios, feedback de queries o navegación declarativa.
- Convertir cualquier string del JSON en dinámico por defecto sin una regla explícita de aplicación.
- Abrir una capa de scripting embebido, funciones custom del backend o evaluación libre de código.
- Sustituir en esta feature la validación estructural existente por un sistema de validación semántica total de todas las referencias posibles.
- Cerrar aquí la lista completa de namespaces futuros más allá de dejar la convención preparada para crecer.

## Requisitos funcionales
- El runtime debe reconocer de forma explícita cuándo un valor string del JSON representa una referencia dinámica y cuándo representa texto literal.
- La referencia dinámica debe usar una convención basada en rutas legibles y estables, alineada con la terminología ya documentada para `forms.*` y `queries.*`.
- En esta fase, la referencia dinámica soportada debe ser una ruta completa simple y no una interpolación parcial dentro de un texto mayor.
- La resolución de referencias debe producir un único comportamiento coherente dentro de la misma instancia del runtime, independientemente del nodo o capacidad que consuma el valor.
- Dos consumidores distintos del runtime que apunten a la misma referencia, por ejemplo `forms.userSearch.name` o `queries.searchUsers.data`, deben obtener el mismo valor actual dentro de la misma instancia.
- La convención debe soportar oficialmente al menos:
  - lectura de valores de formulario bajo `forms.{formId}.{fieldId}`
  - lectura de estado de query bajo `queries.{queryName}`
  - lectura de subrutas estables dentro de una query, como `queries.{queryName}.data`, `queries.{queryName}.status` o `queries.{queryName}.error`
- En la primera iteración, el runtime solo debe aplicar esta resolución dinámica en `heading.props.text` y `paragraph.props.text`.
- La convención debe poder ampliarse a futuras rutas del runtime sin exigir a producto o backend redefinir el estilo de referencia para cada nuevo dominio.
- La resolución debe ocurrir en una capa común del runtime, de manera que un nodo visual no tenga que reimplementar el significado de `forms.*`, `queries.*` u otras rutas equivalentes.
- El runtime debe mantener separada la resolución de referencias del render visual, para que el catálogo de nodos futuro pueda reutilizar la misma fuente de verdad.
- Cuando una feature futura use referencias dinámicas en valores como `defaultValue`, `items`, reglas condicionales o bloques de feedback, la convención debe permitir que el resultado observado sea consistente con el resto del runtime.
- La ausencia de referencias dinámicas en una configuración debe seguir permitiendo que el runtime se comporte como hoy, sin exigir configuración adicional ni afectar al render estático existente.
- La feature debe preservar que el backend pueda seguir enviando referencias como strings simples, sin imponer estructuras JSON más complejas solo para leer estado compartido.
- En esta primera iteración de textos visibles, si una referencia no puede resolverse, el runtime debe degradar el valor renderizado a vacío.
- En desarrollo, una referencia no resoluble usada en un texto visible debe generar un error o aviso diagnóstico en consola suficientemente claro para identificar la ruta y la superficie afectada.
- En producción, la degradación de textos visibles no debe depender de mostrar errores técnicos al usuario final.
- El comportamiento ante una referencia mal formada o apuntando a una ruta no soportada debe ser uniforme dentro de las superficies cubiertas por esta iteración y no depender del nodo que la reciba.
- La convención debe distinguir entre una ruta actualmente vacía o pendiente y una ruta inválida, para que futuras features puedan mostrar feedback correcto.
- La convención debe reservar para futuras ampliaciones namespaces adicionales del runtime, incluidos `navigation.*`, `routeParams.*` y `params.*`, sin que eso implique soporte funcional inmediato en esta iteración.
- La incorporación de nuevas rutas oficiales del runtime debe poder hacerse como ampliación del catálogo de referencias soportadas, no como una ruptura del contrato base ya acordado.
- Cuando una futura implementación habilite referencias dinámicas en superficies no textuales, esa propia feature debe definir de forma explícita qué ocurre si la referencia no puede resolverse y dejarlo reflejado en su spec y documentación afectada.

## Requisitos no funcionales
- La convención debe reducir la lógica dispersa en componentes y nodos visuales futuros.
- El resultado debe ser suficientemente simple para un backend legacy que ya trabaja con referencias string.
- La solución debe mantenerse deliberadamente más pequeña que un lenguaje de expresiones declarativas completo.
- La terminología y los ejemplos deben permanecer consistentes con la documentación actual del runtime, formularios y queries.
- La spec debe dejar una base lo bastante clara como para planificar después la validación, el consumo en nodos y la ampliación a nuevas rutas sin reinterpretar el comportamiento.
- La documentación futura de navegación, formularios, acciones u otras superficies no textuales debe declarar explícitamente su política ante referencias no resolubles antes de dar por cerrada su implementación.

## Criterios de aceptación
- Dada una configuración que use `forms.userSearch.name` como referencia soportada, cualquier consumidor del runtime que lea esa referencia dentro de la misma instancia obtiene el mismo valor actual del formulario.
- Dada una configuración que use `queries.searchUsers.data` como referencia soportada, cualquier consumidor del runtime que lea esa referencia dentro de la misma instancia obtiene el mismo resultado compartido de la query.
- Dada una referencia a `queries.searchUsers.status`, el runtime expone el estado actual de esa query con el mismo significado para todos los consumidores.
- Dada una configuración sin referencias dinámicas, el runtime mantiene el comportamiento estable actual y sigue renderizando contenido estático sin cambios funcionales.
- Dado un texto visible cubierto por esta iteración, solo se consideran referencias dinámicas válidas rutas completas simples como `forms.userSearch.name` o `queries.searchUsers.data`; una interpolación parcial queda fuera del alcance actual.
- Dada una futura capacidad que necesite leer estado compartido desde JSON, esa capacidad puede apoyarse en la misma convención de referencias sin definir una sintaxis paralela propia.
- Dada una referencia usada en `heading.props.text` o `paragraph.props.text` que no puede resolverse, el texto visible se degrada a vacío y en desarrollo queda un diagnóstico en consola.
- Dada una referencia mal formada o que use un namespace no soportado dentro de un texto visible cubierto por esta iteración, el runtime responde de forma uniforme y predecible en lugar de dejar que cada nodo falle de manera distinta.
- Dada una referencia a una ruta soportada cuyo valor todavía no existe, el runtime mantiene una salida coherente dentro de los textos visibles cubiertos por esta iteración y no produce interpretaciones divergentes entre consumidores.
- Dado un namespace reservado como `navigation.*`, `routeParams.*` o `params.*`, la convención lo reconoce como espacio reservado para el runtime aunque esta iteración no lo resuelva todavía.
- No existe dentro del alcance una segunda convención equivalente para leer estado compartido distinta de la ruta string central acordada.

## Casos límite
- Un valor string puede parecer una ruta pero ser contenido literal que deba mostrarse tal cual; la convención debe hacer explícita esa diferencia.
- Una referencia puede apuntar a un formulario o query existente, pero a un campo o subruta todavía no inicializados; el comportamiento debe seguir siendo estable.
- Una referencia puede ser válida en estructura pero no en el contexto funcional actual porque el namespace todavía no está soportado oficialmente.
- Un texto visible puede contener contenido literal con puntos o formatos parecidos a una ruta; la convención debe distinguirlo de una referencia soportada sin recurrir a interpolaciones.
- Dos páginas distintas de la misma instancia pueden leer la misma referencia compartida; el cambio de página no debe alterar el significado de la ruta.
- Una misma feature futura puede necesitar leer tanto el objeto completo de una query como una subruta concreta de ese mismo objeto.
- El runtime puede crecer más adelante con rutas como navegación o parámetros derivados; esa ampliación no debería obligar a introducir otra sintaxis de referencia distinta y debe poder reutilizar los namespaces reservados.

## Riesgos o preguntas abiertas
- Queda pendiente decidir, en cada futura implementación no textual, qué estrategia usará cuando una referencia no sea resoluble, ya que la degradación a vacío solo se acuerda aquí para textos visibles y no debe extrapolarse por defecto.
- Si en el futuro se quisiera soportar interpolación dentro de strings, debe abrirse como alcance nuevo y no introducirse de forma implícita dentro de esta convención base.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Formularios y validación
- Queries y feedback
- Futuras reglas declarativas basadas en estado compartido

## Documentación probablemente afectada
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
