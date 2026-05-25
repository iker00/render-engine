# Design: Dynamic strings

## Contexto
El runtime ya distingue entre strings literales, referencias completas soportadas y referencias completas escapadas con `\`. Esa semantica vive en la capa central de `runtime-references` y hoy alimenta textos, imagenes, tablas, requests, defaults de formulario, fuentes de coleccion, `repeater`, `navigateTo.params` y `visibility` con alcances distintos por consumidor.

La feature abre un caso mas acotado: interpolacion parcial en superficies visibles directas y en proyecciones visibles de colecciones mediante `{{...}}`. No debe convertirse en un motor general de plantillas ni alterar la semantica estricta de requests cuando faltan datos.

## Objetivos / No objetivos

### Objetivos
- Centralizar el parseo y resolucion de strings interpolados en la frontera de referencias del runtime.
- Reutilizar la gramatica y restricciones ya existentes para `queries.*`, `forms.*`, `params.*` e `item.*`.
- Exponer a los nodos visibles una utilidad simple que devuelva el texto efectivo ya normalizado.
- Mantener el catalogo inicial de superficies afectadas cerrado y revisable, incluyendo listas, opciones y celdas de tabla donde el usuario ve datos compuestos.
- Permitir que las proyecciones por item usen `item.*` contra el item local que se esta materializando.
- Preservar la compatibilidad de strings existentes que no usan delimitadores `{{...}}`.

### No objetivos
- Crear un lenguaje de expresiones, filtros o formateadores.
- Resolver plantillas en request params, navegacion, defaults, visibilidad, fuentes de coleccion o identidades de `repeater`.
- Anadir nuevas capacidades de coleccion como busqueda remota, paginacion de opciones, paginacion de tabla o carga incremental remota.
- Hacer validacion de existencia de datos runtime en bootstrap.
- Introducir una dependencia de templating externa.
- Anadir escape especifico para delimitadores de plantilla.

## Decisiones

### 1. La interpolacion vive en `runtime-references`
La deteccion de placeholders, el parseo de la referencia interna y la normalizacion visible deben vivir junto a la resolucion actual de referencias.

Esto evita que `heading`, `button`, `input`, `image` u otros nodos creen parsers locales y facilita conservar una unica semantica para `item.*`, `params.*` y rutas anidadas bajo `queries.*.data`.

### 2. La feature usa un catalogo cerrado de consumidores visibles y de proyeccion
La primera entrega debe conectar solo las superficies definidas en la spec. Aunque tecnicamente haya mas strings en el contrato, no deben reinterpretarse por defecto.

Motivo:
- requests tienen una semantica de error distinta cuando falta una referencia
- `visibility.value` debe seguir comparando literales
- fuentes de coleccion y keys de `repeater` no son texto visible libre
- ampliar todas las strings podria romper literales existentes con delimitadores accidentales

### 3. Los placeholders degradan a string vacio en superficies visibles
La politica visible sera la misma idea que ya aplican textos e imagenes ante datos no renderizables: valor ausente o no escalar produce string vacio.

Los valores escalares permitidos son:
- `string`
- `number`
- `boolean`

Objetos, arrays, `null`, `undefined`, rutas invalidas para la superficie o referencias sin dato disponible no deben romper el render.

### 4. Las referencias completas existentes no cambian
En superficies que hoy interpretan el string completo como referencia, ese comportamiento debe seguir disponible. La interpolacion parcial se activa por delimitadores `{{...}}`, no por puntos ni por una heuristica nueva sobre todo string.

El escape historico con `\` debe seguir aplicando a referencias completas donde ya existe. No se anade otro escape para delimitadores de plantilla en esta feature.

### 5. `item.*` se resuelve desde el contexto local correcto
Los nodos dentro de `repeater` ya reciben contexto para resolver `item.*`. La interpolacion debe consumir ese mismo contexto y no crear otro mecanismo de propagacion.

Fuera de un contexto de iteracion, `{{item.*}}` debe degradar a string vacio en las superficies visibles afectadas.

En proyecciones de coleccion, `item.*` debe apuntar al item que se esta materializando:
- item de `list`
- opcion de `select`, `radioGroup` o `checkboxGroup`
- fila dinamica de `table`

Ese contexto local no debe hacer que `item.*` pase a estar disponible globalmente en cualquier string de la pantalla.

### 6. Las opciones interpoladas mantienen la semantica de seleccion
`select`, `radioGroup` y `checkboxGroup` comparten normalizacion de opciones y valores. La interpolacion debe alimentar esa normalizacion, no sustituirla.

Decisiones:
- `label` interpolado es texto visible de opcion
- `value` interpolado es el valor efectivo final de la opcion como string
- valores literales numericos existentes siguen usando la normalizacion vigente
- si cambia el catalogo efectivo por datos runtime, la limpieza de selecciones invalidas conserva la politica actual del campo

La implementacion no debe crear un estado paralelo para "valor de plantilla" y "valor normalizado"; solo debe existir el valor efectivo que el campo ya entiende.

### 7. La normalizacion de imagenes se mantiene en el consumidor
La interpolacion debe devolver el string efectivo. La decision de renderizar o no un `image` sigue perteneciendo al nodo:
- `src` efectivo no vacio: render posible
- `src` efectivo vacio: no render, igual que hoy
- `alt` efectivo ausente o no renderizable: string vacio

Esto evita mezclar reglas de HTML o accesibilidad dentro del parser de plantillas.

### 8. Las tablas conservan degradacion por celda
La interpolacion en `table` debe mantener la politica actual de celdas: un dato ausente vacia la celda afectada o la parte afectada, pero no elimina la fila completa.

En modo dinamico, cada entrada de `rows.cells` se evalua contra la fila local como `item.*`. En modo manual, las celdas string pueden resolver referencias globales como cualquier superficie visible soportada.

### 9. No se rechaza el config solo por datos runtime ausentes
La validacion previa al render debe seguir validando shape y contratos estructurales. No puede exigir que una query ya tenga datos, que un formulario este inicializado o que existan params runtime.

Si se decide validar placeholders en bootstrap, esa validacion debe limitarse a errores estructurales claros de sintaxis o namespaces fuera del contrato, sin convertir ausencia de datos runtime en error fatal.

## Riesgos y trade-offs

### Riesgo: expansion silenciosa a todas las strings
Si se aplica la utilidad a cualquier prop string por comodidad, la feature puede cambiar significado de literales existentes y contaminar superficies no visibles.

Mitigacion:
- conectar consumidores explicitamente desde el catalogo de la spec
- cubrir con tests que requests y `navigateTo.params` no usan interpolacion parcial

### Riesgo: semantica distinta entre nodos
Si cada nodo decide como parsear `{{...}}`, apareceran diferencias en espacios, referencias invalidas o valores no escalares.

Mitigacion:
- una unica utilidad de interpolacion visible en `runtime-references`
- tests compartidos de resolucion y tests de integracion por consumidor representativo

### Riesgo: valores de opciones inestables
Si el `value` de una opcion depende de datos que cambian, una seleccion activa puede quedar obsoleta.

Mitigacion:
- tratar el resultado interpolado como el valor efectivo normalizado del catalogo
- reutilizar la limpieza vigente de selecciones que dejan de existir en el catalogo visible
- cubrir duplicados y valores vacios en tests de formularios

### Riesgo: ocultar errores de configuracion
Vaciar placeholders invalidos puede esconder typos en configuraciones reales.

Mitigacion:
- mantener la degradacion visible como comportamiento de usuario
- conservar o anadir diagnosticos de desarrollo cuando la referencia sea mal formada o este fuera de contrato
- no trasladar esta politica silenciosa a requests

### Riesgo: tension futura con formateo
Los usuarios pueden querer fechas, moneda, fallback textual o pluralizacion.

Mitigacion:
- dejar esos casos fuera de la sintaxis v1
- reservar futuras features de formateo como ampliacion explicita del lenguaje, no como comportamiento implicito de strings dinamicos

## Migracion o despliegue
No requiere migracion de configuraciones existentes. Las configuraciones actuales sin `{{...}}` deben conservar el mismo comportamiento.

La documentacion funcional debera actualizar el limite vigente "no hay interpolacion parcial dentro de strings" y reemplazarlo por el nuevo catalogo cerrado de superficies visibles.

## Preguntas abiertas
No hay preguntas abiertas bloqueantes para planificar la implementacion.
