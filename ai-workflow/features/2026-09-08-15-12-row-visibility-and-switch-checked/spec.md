# Spec: soporte de `row.*` en `visibility.reference` y en `button.props.checked` (variante `switch`)

## Objetivo
Extender dos superficies ya existentes del sistema de referencias dinámicas para que admitan la familia `row.*` (namespace propio del contexto de fila de `table`), de forma que:
- cualquier nodo dentro de una celda de `table` pueda condicionar su visibilidad (`node.visibility`) a partir del dato de su propia fila.
- un `button` con `props.variant: 'switch'` usado como celda-nodo de una `table` pueda derivar su estado `checked`/`unchecked` directamente del dato de la fila, sin depender de que exista un `repeater` ancestro (`item.*`) envolviendo la tabla.

Esta feature no introduce ningún namespace de referencia nuevo: reutiliza `row.*` y `row.$index`, ya definidos y en uso dentro de celdas de `table` desde `2026-08-25-12-01-table-row-references`, y sigue el mismo patrón ya vigente para `item.*` en estas dos mismas superficies.

## Alcance
- Añadir `row`, `row.{segmentosAnidados}` y `row.$index` al catálogo de referencias admitidas por `visibility.reference` (condición simple y, por extensión, cada condición dentro de un grupo compuesto `and`/`or`), con la misma frontera que ya tiene `row.*` en el resto del sistema: solo válido cuando el nodo que declara `visibility` vive dentro del subárbol de una celda de `table` (celda-nodo en modo dinámico, incluyendo nodos descendientes anidados dentro de esa celda), igual que `item.*` ya es válido en todo el subárbol iterado de un `repeater`.
- Añadir `row.*` (incluyendo `row.$index`) a la frontera ya aceptada por `button.props.checked` cuando `props.variant: 'switch'` (hoy `item.*`, `queries.*`, `forms.*`, `params.*`), aplicable cuando el `button` switch es, o vive dentro de, una celda-nodo de `table`.
- En modo manual de `table`, `row.*` general sigue sin resolver dato (no hay fila subyacente que navegar); solo `row.$index` resuelve, exactamente igual que ya ocurre hoy en cualquier otra superficie que admite `row.*` en modo manual. Esto aplica igual a `visibility.reference` y a `checked`: el shape se acepta en ambos modos, pero la resolución en modo manual queda limitada a `row.$index`.
- Actualizar la documentación funcional afectada (`references/visibility.md`, `references/reference-resolution.md`, `nodes/button.md`) para reflejar el nuevo catálogo admitido.

## Fuera de alcance
- No se modifica el comportamiento, la frontera ni la resolución de `row.*` en ninguna otra superficie ya existente (celdas string/nodo de `table`, `table.props.rows.cells`).
- No se modifica `item.*` en ninguna de sus superficies ni su comportamiento dentro de `table`/`repeater` anidados.
- No se añade `row.*` a ninguna otra superficie de `visibility` (`submitAction.onSuccess[*].when`, `pages[].preloads[*].when`, `button.props.action.operations[*].when`) más allá de la condición simple/grupo de `node.visibility` propiamente dicha; esas superficies reutilizan el mismo shape pero no se tocan aquí.
- No se añade `row.*` a `button.props.action.query`/`body`/`headers` como parte de esta feature; esa resolución, si ya existe hoy para botones dentro de celdas de `table`, no cambia.
- No se introduce ninguna forma nueva de `row.*` (no hay `row.$key`, como ya establece la documentación vigente: `table` no itera un diccionario).
- No se cambia la política de degradación general ya vigente (referencia bien formada sin dato disponible → `visibility` la trata como ausente; `checked` degrada a `false`).
- No se resuelve la exclusividad "solo un switch principal a la vez" (ya fuera de alcance desde `button-switch-variant`, sigue delegada a backend).
- No hay cambios en `dev-editor` / soporte visual de edición para estas dos superficies más allá de lo que ya exista hoy.

## Requisitos funcionales
1. `visibility.reference` acepta `row`, `row.{segmentosAnidados}` y `row.$index` cuando el nodo que declara `visibility` está dentro del subárbol de una celda-nodo de `table` en modo dinámico.
2. Un `visibility.reference` con forma `row.*` fuera del contexto de una celda de `table` se rechaza en bootstrap, con el mismo criterio ya vigente para `item.*` fuera de un `repeater` (ruta exacta señalada en el error).
3. Los segmentos anidados de `row.{segmentosAnidados}` en `visibility` siguen la misma semántica ya documentada para `row.*` (índice numérico solo si el valor actual es array, clave literal si es objeto).
4. `row.$index` en `visibility.reference` resuelve el mismo entero 1-based ya definido (posición de la fila en la vista visible tras filtro/orden/paginación local) y es utilizable con cualquiera de los operadores ya soportados (`equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`, `arrayContains`) sin restricción adicional específica de esta familia.
5. `visibility.reference` con `row.*` funciona igual dentro de una condición simple y dentro de cada condición de un grupo compuesto (`and`/`or`).
6. Una `table` dinámica anidada dentro de un `repeater` puede combinar, en el mismo árbol de `visibility` de nodos distintos dentro de sus celdas, referencias `row.*` (fila propia de la tabla) e `item.*` (item del `repeater` ancestro) sin que una interfiera con la otra, igual que ya ocurre hoy para interpolación de texto.
7. `button.props.checked`, cuando `props.variant: 'switch'`, acepta además `row`, `row.{segmentosAnidados}` y `row.$index` como referencia dinámica completa, con la misma semántica de resolución ya vigente para `item.*`/`queries.*`/`forms.*`/`params.*` en ese mismo prop.
8. Un `button` switch cuyo `checked` referencia `row.*` y que vive dentro de una `table` dinámica anidada en un `repeater` resuelve `row.*` contra la fila propia de la tabla, sin que el `item.*` del `repeater` ancestro lo sombree (mismo criterio de composición ya vigente para el resto de superficies).
9. En modo manual de `table`, un `checked` con `row.$index` resuelve el índice 1-based de la fila; un `checked` con `row` o `row.{segmentosAnidados}` (sin `.$index`) no resuelve dato (no hay fila subyacente que navegar) y degrada a `false`, igual que degrada hoy cualquier referencia bien formada sin dato disponible.
10. `switch.next` sigue funcionando sin cambios cuando `checked` usa `row.*`: resuelve la negación del `checked` ya resuelto en el momento del click, con independencia de qué familia de referencia produjo ese valor.

## Requisitos no funcionales
- No debe romper compatibilidad hacia atrás: cualquier config existente que ya use `item.*`, `queries.*`, `forms.*` o `params.*` en `visibility.reference` o en `checked` sigue funcionando exactamente igual.
- La validación de shape debe seguir ocurriendo en bootstrap (antes del render), consistente con el resto de fronteras de referencias ya documentadas, no en runtime.
- La resolución de `row.*` en estas dos superficies debe reutilizar el mismo mecanismo de contexto de fila (`iterationContext`/`row`/`rowIndex`) ya introducido por `table-row-references`, sin un segundo mecanismo de resolución paralelo.

## Criterios de aceptación
- Un nodo (de cualquier tipo transversal a `visibility`) dentro de una celda-nodo de `table` en modo dinámico, con `visibility: { reference: "row.status", operator: "equals", value: "active" }`, se muestra u oculta según el valor de `status` en el dato de cada fila.
- El mismo nodo fuera de cualquier celda de `table` con `visibility.reference: "row.status"` provoca que el config completo se rechace antes del render.
- Un `visibility` con `reference: "row.$index"`, `operator: "lessThan"`, `value: 4` oculta/muestra el nodo según la posición visible de la fila (1-based), recalculándose tras aplicar filtro/orden/paginación local.
- Un grupo compuesto (`operator: "and"`) con una condición `row.*` y otra `forms.*`/`queries.*` evalúa ambas correctamente y combina el resultado con la semántica ya vigente de `and`/`or`.
- Un `button` con `props.variant: 'switch'` dentro de una celda-nodo dinámica de `table`, con `props.checked: "row.isPrimary"`, refleja `aria-checked` según el valor de `isPrimary` en cada fila, y lo recalcula en cada render (sin estado local optimista), igual que ya ocurre con `item.*`.
- El mismo botón dentro de una `table` en modo manual, con `props.checked: "row.$index"`, refleja como `checked` el resultado de evaluar ese entero como boolean (mismo comportamiento ya vigente para cualquier valor no estrictamente `true`/`false` resuelto por una referencia en `checked`); con `props.checked: "row.isPrimary"` (sin `.$index`) en modo manual, degrada siempre a `false`.
- Una `table` dinámica dentro de un `repeater`, con una celda que contiene un `button` switch con `checked: "row.isPrimary"` y otra celda con un texto interpolado `{{item.ownerName}}`, resuelve ambas referencias correctamente en la misma fila sin interferencia mutua.
- Un click en un `button` switch con `checked: "row.isPrimary"` y `action.query/body/headers` usando `switch.next` sigue enviando la negación del valor de fila resuelto en el momento del click.
- Toda la batería de tests ya existente para `visibility`, `checked` con `item.*`/`queries.*`/`forms.*`/`params.*`, y para `row.*` en el resto de superficies, sigue en verde sin modificación de su comportamiento esperado.

## Casos límite
- `visibility.reference: "row"` (sin segmentos) dentro de una celda de `table`: referencia válida por shape (igual que `item` a secas ya es válido hoy), evaluada contra el dato completo de la fila.
- `visibility` con `row.*` dentro de una celda de `table` cuya fila todavía no tiene dato resuelto (colección en `loading`/vacía): la referencia se trata como ausente, con la misma semántica ya vigente (`isFalsy` verdadero, `isTruthy` sin match, resto de operadores sin match).
- `checked` con `row.*` cuyo valor de fila no es estrictamente boolean (por ejemplo un string o un número): se resuelve tal cual, sin coerción especial nueva, igual que ya ocurre hoy con `item.*`/`queries.*`.
- `row.*` en `visibility` o `checked` de un nodo que está en una celda de `table` pero cuya `table` a su vez vive fuera de cualquier `repeater`: `row.*` resuelve con normalidad (no depende de que exista un `repeater` ancestro, a diferencia de `item.*`).
- Un `checked` con `itemField`-like anidado profundo (`row.meta.author.name`) sigue la misma semántica de segmentos anidados ya vigente para `row.*` en otras superficies (índice numérico solo si el valor actual es array).
- Un grupo `visibility` con varias condiciones `row.*` distintas (por ejemplo `row.status equals "active"` y `row.priority greaterThan 3` combinadas con `and`): cada condición resuelve su propio segmento de forma independiente contra el mismo dato de fila.

## Riesgos o preguntas abiertas
Ninguna pendiente. El alcance quedó cerrado en la fase de exploración previa (`explore-feature-scope`): se confirmó incluir `row.$index` en ambas superficies para mantener consistencia con la regla general ya vigente ("toda superficie que admite `row.*` admite también `row.$index`").

## Áreas de producto afectadas
- Referencias y strings dinámicas (`visibility`, resolución de referencias).
- Catálogo de nodos (`button`, variante `switch`).

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/references/visibility.md` (catálogo de "Referencias admitidas").
- `ai-workflow/docs/app-features/references/reference-resolution.md` (superficies que admiten `row.*` en la sección "Frontera específica de `row.*`").
- `ai-workflow/docs/app-features/nodes/button.md` (frontera de `props.checked` en la variante `switch`).
