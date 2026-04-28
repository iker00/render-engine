# Spec: Nested query data reference navigation

## Objetivo
Ampliar la convención centralizada de referencias del runtime para permitir navegación anidada dentro de `queries.{queryName}.data`, de forma que la configuración JSON pueda leer subcampos concretos de respuestas remotas complejas sin introducir una sintaxis nueva ni obligar al backend a duplicar datos.

## Alcance
- Extender el contrato de referencias existente para aceptar rutas anidadas bajo `queries.{queryName}.data`.
- Soportar navegación por claves de objetos y por índices de arrays cuando formen parte del dato de una query.
- Mantener la convención actual basada en rutas string completas, por ejemplo `queries.searchUsers.data.results.0.name`.
- Reutilizar la misma capa central de resolución del runtime para que la ampliación no dependa de un nodo visual concreto.
- Conservar el comportamiento vigente para `forms.*`, `queries.{queryName}`, `queries.{queryName}.status` y `queries.{queryName}.error`.
- Mantener el alcance visible actual: esta feature amplía la resolución central de referencias, pero no añade nuevas superficies del layout más allá de las que ya consumen referencias hoy.

## Fuera de alcance
- Abrir navegación anidada fuera de `queries.{queryName}.data`, por ejemplo bajo `queries.{queryName}.error`, `queries.{queryName}.status`, `forms.*`, `navigation.*`, `routeParams.*` o `params.*`.
- Introducir interpolación parcial dentro de strings o un lenguaje general de expresiones.
- Añadir transformaciones, filtros, operadores lógicos o acceso dinámico calculado dentro de las rutas.
- Cambiar el shape del store de queries o el contrato base de `status`, `data` y `error`.
- Añadir nuevas superficies visuales consumidoras de referencias como parte de esta misma feature.

## Requisitos funcionales
- El runtime debe reconocer como referencia soportada una ruta completa que empiece por `queries.{queryName}.data` y continúe con uno o más segmentos anidados válidos.
- La navegación anidada debe soportar tanto propiedades de objetos como índices posicionales de arrays dentro del valor actual de `data`.
- Una ruta como `queries.searchUsers.data.results.0.name` debe leerse de izquierda a derecha usando el contenido actual compartido de la query dentro de la misma instancia.
- La ampliación debe conservar la convención vigente para distinguir texto literal y referencia dinámica, incluido el escape literal con `\`.
- El runtime debe mantener una única semántica central para estas rutas anidadas, de modo que dos consumidores distintos de la misma referencia obtengan el mismo valor actual.
- Si `queries.{queryName}` no existe todavía en el estado compartido, cualquier referencia anidada bajo su `.data` debe tratarse como ruta ausente y no como ruta inválida.
- Si `queries.{queryName}.data` existe pero todavía es `null` o `undefined`, una subruta anidada bajo ese valor debe tratarse como ausente.
- Si un segmento intermedio no existe, un índice queda fuera de rango o la navegación intenta continuar dentro de un valor no navegable, el resultado debe ser uniforme y predecible dentro del contrato de referencias de queries.
- El runtime debe seguir distinguiendo entre una ruta sintácticamente inválida y una ruta válida cuyo dato no está disponible todavía.
- La ampliación no debe alterar el significado actual de `queries.{queryName}` como lectura del objeto completo de la query ni el de `queries.{queryName}.data` como lectura directa del valor raíz de `data`.
- Las referencias anidadas deben seguir siendo rutas completas simples; no se admite mezclar literales y referencias dentro del mismo string.
- En las superficies textuales ya soportadas por el runtime, una referencia anidada no resoluble debe mantener la misma política de degradación vigente para referencias no resueltas.

## Requisitos no funcionales
- La convención debe seguir siendo simple de generar desde un backend legacy que trabaja con strings.
- La ampliación debe preservar la idea de catálogo cerrado de rutas soportadas, evitando convertir `queries.*` en una puerta abierta a cualquier lectura arbitraria del runtime.
- El comportamiento debe ser consistente con la capa central de referencias ya introducida en `0007`, sin trasladar lógica de parsing o navegación a nodos visuales.
- La solución debe seguir siendo menor y más predecible que un motor genérico de expresiones declarativas.
- La terminología usada en la spec debe permanecer alineada con `queries`, `data`, `status`, `error` y el store compartido ya documentados en el proyecto.

## Criterios de aceptación
- Dada una query con `data` igual a un objeto anidado, una referencia como `queries.searchUsers.data.user.profile.name` devuelve el valor anidado correcto.
- Dada una query con `data` igual a una colección, una referencia como `queries.searchUsers.data.results.0.id` devuelve el valor del elemento indicado por índice.
- Dada una referencia a `queries.searchUsers.data`, el runtime mantiene el comportamiento actual y devuelve el valor raíz de `data` sin exigir segmentos adicionales.
- Dada una referencia a `queries.searchUsers`, el runtime mantiene el comportamiento actual y devuelve el objeto completo de la query.
- Dada una referencia a `queries.searchUsers.status` o `queries.searchUsers.error`, el runtime mantiene el comportamiento actual sin abrir navegación anidada adicional en esas ramas.
- Dada una ruta con sintaxis mal formada dentro de `queries.*`, el runtime la clasifica de forma uniforme como inválida.
- Dada una ruta bien formada bajo `queries.{queryName}.data` cuyo valor intermedio no existe, apunta a un índice fuera de rango o parte de `data` todavía no está disponible, el runtime la trata de forma uniforme como ausente.
- Dada una configuración sin referencias anidadas, el comportamiento estable actual del runtime no cambia.
- Dada una referencia anidada no resoluble usada en `heading.props.text` o `paragraph.props.text`, el valor visible mantiene la degradación vigente y el diagnóstico de desarrollo sigue siendo coherente con la referencia original.

## Casos límite
- `data` puede ser un valor primitivo y no un objeto o array; navegar más allá de ese punto no debe reinterpretarse como una ruta válida resuelta.
- Una colección puede existir pero no contener el índice pedido.
- Un objeto puede existir pero no contener una clave declarada en la referencia.
- Una ruta puede alternar objetos y arrays en varios niveles, por ejemplo `queries.searchUsers.data.sections.0.items.2.label`.
- Un segmento numérico puede aparecer como parte legítima de una clave de objeto enviada por backend; la convención debe dejar claro cuándo se interpreta como índice y cuándo como nombre de propiedad.
- Un string literal puede coincidir exactamente con una ruta anidada soportada; el escape literal debe seguir permitiendo mostrarlo tal cual.

## Riesgos o preguntas abiertas
- Hay que fijar de forma explícita la convención para segmentos numéricos ambiguos cuando el dato actual sea un objeto y no un array.
- Conviene decidir si una navegación que intenta profundizar dentro de un valor primitivo debe considerarse ausente o inválida dentro de la semántica central.
- Esta ampliación aumenta el valor de la resolución central de referencias, pero no sustituye la necesidad de que futuras superficies no textuales definan su propia política de degradación ante referencias no resueltas.

## Áreas de producto afectadas
- Runtime UI configurable
- Contrato de configuración
- Queries y feedback
- Resolución centralizada de referencias

## Documentación probablemente afectada
- `ai-workflow/docs/current-state.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
