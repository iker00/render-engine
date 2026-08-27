# Design: Feature 2026-08-25-09-15 - autocomplete-node

## Contexto
`autocomplete` es un nodo de formulario nuevo, análogo a `select` en su contrato de `props.items` (mismos tres shapes cerrados: manual literal, manual escalar, dinámico unificado `{source, itemType, label?, value?}`), pero introduce dos capacidades que hoy no existen en el runtime:

1. **Disparo de ejecución de una operación por tecleo**, con debounce. Hoy los únicos disparadores de `executeQueryOperation` son: entrada a página (`preloads`), acción de botón (`button.props.action`) y submit de formulario (`form.submitAction`). No existe un disparador ligado a la interacción de un nodo de formulario individual.
2. **Persistencia de selección frente a una colección dinámica que cambia**, invirtiendo la regla vigente en `select`/`radioGroup`/`checkboxGroup` ("si el valor deja de estar en la colección resuelta, se limpia") solo para el shape dinámico de `autocomplete`.

Los shapes de `items` de `autocomplete` siguen exactamente la misma clasificación que `select`: "estático" (manual literal, manual escalar) y "dinámico" (`source: queries.*.data | queries.*.data.* | item.*`). Esa clasificación describe el origen del dato (literal vs. resuelto en runtime), no si hay una operación de backend detrás. Solo los dos `source` que apuntan a `queries.{queryName}` tienen una operación real (`queryName`) que se puede ejecutar; `item.*` es dato ya resuelto de la iteración del `repeater` (sin `queryName`, sin backend), típicamente usado para catálogos predefinidos embebidos por item.

## Objetivos / No objetivos

### Objetivos
- Definir dónde vive el nuevo disparador de ejecución por tecleo sin romper la frontera "la red vive en `src/queries/`" ni la responsabilidad de `runtime-actions/`.
- Definir cómo el texto escrito llega a la request de la operación sin ampliar el contrato cerrado de `props` ni de `props.items` que ya fijó `spec.md`.
- Definir la duración y ubicación del debounce.
- Definir el filtrado en shape estático y en `item.*` (cliente, sin red).
- Definir cómo conviven varias instancias de `autocomplete` cuando comparten `queryName` (caso típico: dentro de un `repeater`).
- Definir dónde vive el estado de persistencia de selección frente a colecciones dinámicas cambiantes, sin duplicar el mecanismo de limpieza ya usado por `select`/`radioGroup`/`checkboxGroup`.
- Reflejar puntos de extensión de catálogo, validación en bootstrap y accesibilidad, reutilizando lo ya establecido para `select`.

### No objetivos
- No se diseña el mecanismo exacto de tests ni el troceo en tareas (pertenece a `generate-implementation-plan`).
- No se resuelve de forma genérica el modelo de estado de queries por instancia; se acepta la limitación actual del slot global (ver Decisión 5).
- No se introduce ningún shape adicional en `props.items`; queda cerrado por `spec.md`. (`props.searchParamName` sí se añadió al contrato de `props` tras el cierre inicial de esta feature — ver enmienda en Decisión 3 — sin que eso reabra el contrato de `items`.)
- No se diseña un widget dedicado de edición en el panel de propiedades del dev editor (explícitamente fuera de alcance en `spec.md`).

## Decisiones

### Decisión 1 — Filtrado por `source` en shape dinámico
**Elegido**: solo `source: 'queries.{queryName}.data'` y `source: 'queries.{queryName}.data.*'` disparan ejecución de operación por tecleo (con debounce y gate de `minChars`). `source: 'item.*'` se filtra en cliente exactamente igual que el shape estático (substring case-insensitive sobre el `label` efectivo, respetando `minChars`), sin debounce ni red, porque no existe ningún `queryName`/operación asociada a `item.*`: es dato ya resuelto de la iteración del `repeater`, típicamente un catálogo predefinido embebido por item.

**Por qué frente a la alternativa**: la alternativa (disparar también una operación para `item.*`) exigiría inventar un vínculo entre `item.*` y un nombre de operación que hoy no existe en ningún contrato del proyecto, lo que ampliaría el contrato cerrado de `props.items` fuera de lo que fija `spec.md`. La lectura elegida es consistente con que "dinámico" en `props.items` describe el origen del dato (resuelto en runtime vs. literal), no la existencia de una operación de backend — igual que hoy `select` con `item.*` nunca dispara ejecución alguna, solo lee.

**Trade-off**: la redacción literal de `spec.md` agrupa los tres `source` bajo el mismo párrafo de "dispara ejecución"; esta decisión interpreta y acota esa redacción para el caso `item.*` sin backend. Se anota aquí en vez de en `spec.md` porque no cambia el comportamiento observable pactado (un catálogo predefinido por item se sigue filtrando y comportando igual que cualquier catálogo estático) — solo aclara un caso que la redacción agrupaba de forma imprecisa.

**Riesgo residual**: ninguno; el comportamiento de `item.*` coincide con el uso ya establecido para `select`.

### Decisión 2 — Ubicación del disparo por tecleo (nueva capa)
**Elegido**: nuevo módulo delgado en `src/runtime/` (p. ej. `runtime-search-trigger.ts`, junto al resto de módulos `runtime-*` de responsabilidad única) que expone una función de disparo con debounce y gate de `minChars`, y que internamente llama a la misma fachada pública ya existente `executeQueryOperation` de `src/queries/`. El nodo `autocomplete` consume este módulo igual que otros nodos consumen sus módulos `runtime-*` de responsabilidad única (p. ej. `runtime-form-validations`, `runtime-collection-sources`).

**Por qué frente a la alternativa**: `runtime-actions/` traduce **acciones declarativas** del config a handlers (`navigateTo`, `executeOperation` desde botón, `resetForm`, etc.). El disparo por tecleo no es una acción declarada en el JSON de ningún nodo: es una consecuencia de la interacción propia del nodo con su `props.items` dinámico. Forzarlo dentro de `runtime-actions/` mezclaría un disparador implícito con el catálogo de acciones explícitas del config, lo que complica ese módulo sin necesidad. Un módulo nuevo de responsabilidad única respeta mejor el patrón ya existente (cada capa del runtime tiene su propio `runtime-*` por dominio) y mantiene intacta la frontera "la red vive en `src/queries/`": el nuevo módulo no construye `fetch` ni requests, solo orquesta el debounce y delega la ejecución real en la fachada ya existente.

**Coste**: nuevo módulo en el punto de extensión de arquitectura ("nueva capacidad remota" → hoy solo cubre `preloads`, botón y submit; esta es la cuarta superficie de disparo). Se debe reflejar en `architecture.md` como nuevo punto de extensión estable una vez implementado.

**Riesgo residual**: ninguno relevante; el módulo es aditivo y no modifica los disparadores existentes.

### Decisión 3 — Inyección del texto escrito en la request
**Elegido**: dos mecanismos según el modo de selección, ambos reutilizando infraestructura ya existente en `execution.md`, sin ampliar el contrato de `props` ni de `props.items`:

- **Selección simple** (`multiple` ausente o `false`, ambos valores de `allowFreeText`): el store del campo (`forms.{formId}.{fieldId}`) mantiene siempre el texto tal cual se escribe mientras el usuario interactúa — esto ya es exactamente la semántica que `spec.md` define para `allowFreeText: true`; se extiende también a `allowFreeText: false` como representación *en curso* del campo, con una capa de normalización propia de `autocomplete` que, al perder foco o al construir el payload de submit, sustituye el valor a `''` si el texto no coincide con ningún `item.value` del catálogo actualmente resuelto, o al `value` exacto de la opción si el usuario selecciona una sugerencia. Como el texto en curso ya vive en `forms.{formId}.{fieldId}`, la operación declarada en `api` para la búsqueda dinámica puede referenciarlo directamente como una referencia completa normal en su `query`/`body` (p. ej. `{ body: { search: "forms.{formId}.{fieldId}" } }`), exactamente igual que cualquier operación ya referencia hoy un campo de formulario — sin mecanismo nuevo.
- **Selección múltiple** (`multiple: true`): el valor efectivo del campo (`forms.{formId}.{fieldId}`) sigue siendo la colección ordenada de chips (contrato ya cerrado en `spec.md`), por lo que no puede doblar también como texto en curso sin romper su contrato de tipo (`array`) frente a cualquier otra superficie que lo consuma (`visibility`, `defaultValue` de otro campo, submit). El texto del chip todavía no confirmado es, por tanto, estado local del propio nodo, fuera del dominio `forms.*`. Para este caso, el módulo de la Decisión 2 pasa el texto en curso a través del parámetro `requestParams` que **ya expone hoy** `executeQueryOperation(operationName, { requestParams? })` — no es una referencia declarativa nueva ni una clave añadida al contrato de `props.items`; es reutilizar un parámetro de invocación que la fachada pública ya admite.

**Por qué frente a las alternativas descartadas**: una clave reservada fija (p. ej. `q`) para todos los casos evitaría la distinción anterior, pero introduce una convención implícita no declarada en ningún lado del config, más difícil de auditar que una referencia explícita a `forms.{formId}.{fieldId}` en el propio `api`. Una nueva familia de referencia declarativa (tipo `search.*`) resolvería ambos modos de forma simétrica, pero amplía el sistema de referencias (`src/config/runtime-reference-syntax.ts`, `runtime-references/`) para un caso de uso único, lo que es un coste arquitectónico mayor que no está justificado solo por el modo múltiple.

**Trade-off**: el mecanismo no es simétrico entre selección simple y múltiple (uno vía referencia declarativa, otro vía parámetro de invocación). Se acepta porque cada uno resuelve un problema de tipo real (simple: el store ya es texto; múltiple: el store ya es array) sin inventar una superficie declarativa nueva para un caso que la propia spec dejó fuera de alcance ampliar (`props.items` cerrado).

**Riesgo residual**: en selección múltiple, si `queryName` se comparte entre varias instancias, el `requestParams` de cada instancia solo determina el *cuerpo de su propia invocación*; el resultado sigue escribiéndose en el mismo slot global `queries.{queryName}` (ver Decisión 5).

**Enmienda post-implementación — `props.searchParamName`**: el análisis original de esta decisión rechazó "una clave reservada fija (p. ej. `q`) para todos los casos" por introducir "una convención implícita no declarada en ningún lado del config". La implementación cerró esa clave como `search`, fija y no configurable. En uso real (backends de búsqueda que no pueden aceptar literalmente `search` como nombre de parámetro), esa clave fija demostró ser el mismo problema señalado en el análisis original, solo que con un nombre distinto al rechazado. Se corrige añadiendo `props.searchParamName` (string opcional, default `'search'`, ver `spec.md`): la clave sigue siendo única y fija por instancia (no se convierte en una familia de referencia declarativa nueva, no toca `runtime-reference-syntax.ts`/`runtime-references/`), pero ahora es explícita en el config en vez de asumida. Solo aplica a selección múltiple — selección simple sigue sin necesitar ninguna clave reservada, por la razón ya dada arriba (el texto en curso ya vive en `forms.{formId}.{fieldId}`). No cambia el mecanismo de invocación: sigue pasando por `requestParams.query`/`requestParams.body`, solo con una clave configurable en vez de codificada (`autocomplete-layout-node.tsx`).

### Decisión 4 — Debounce
**Elegido**: duración fija de `300ms`, definida una única vez como constante en el módulo de la Decisión 2, no configurable por prop.

**Por qué frente a la alternativa**: `spec.md` no incluye ninguna prop de configuración de debounce en el contrato cerrado de `autocomplete`; añadirla ampliaría ese contrato sin respaldo de la spec. Un valor fijo y centralizado evita además duplicar el número mágico en cada nodo que lo use en el futuro.

**Riesgo residual**: ninguno; si en el futuro se necesita variar el debounce por caso de uso, es una ampliación de alcance explícita sobre `spec.md`, no un defecto de este diseño.

### Decisión 5 — Convivencia de varias instancias con el mismo `queryName`
**Elegido**: se acepta como limitación conocida del modelo de estado de queries actual (`queries.{queryName}` es un slot único y global por nombre, según `queries/state-model.md`), sin introducir un espacio de estado por instancia. Cada instancia de `autocomplete` guarda localmente la `requestSignature` de la última ejecución que ella misma disparó; al leer `queries.{queryName}.data` para pintar sugerencias, solo las pinta si la `requestSignature` global coincide con la última que ella disparó. Si otra instancia disparó una ejecución posterior sobre el mismo `queryName`, la instancia más antigua deja de pintar datos (los trata como no frescos) en vez de pintar por error el resultado de la búsqueda de otra instancia.

**Por qué frente a la alternativa**: introducir un espacio de estado de query por instancia (namespacing) exigiría modificar `runtime-state/` para soportar múltiples slots por `queryName`, lo que choca directamente con el límite ya fijado en `architecture.md`: "el estado compartido vive en `runtime-state/`... no duplicar dominios de estado paralelos". Es un cambio de arquitectura transversal que excede el alcance de un nodo nuevo y afectaría a cualquier otro consumidor de `queries.{queryName}` (botones, submit, `select`, `repeater`), no solo a `autocomplete`.

**Coste / riesgo residual — explícito, no oculto**: dos instancias de `autocomplete` que comparten el mismo `queryName` **no pueden buscar de forma verdaderamente independiente y simultánea**; la instancia cuya ejecución no fue la última en resolver deja de mostrar sugerencias hasta que ella misma dispare una nueva búsqueda. Este límite debe documentarse en la ficha `nodes/autocomplete.md`, con la recomendación de declarar un `queryName` (operación en `api`) distinto por instancia cuando se necesite búsqueda dinámica realmente independiente y concurrente (p. ej. una operación por fila dentro de un `repeater`, o resolver el catálogo por `item.*` cuando el dato ya está embebido y no requiere backend — ver Decisión 1).

### Decisión 6 — Persistencia de selección frente a colección dinámica cambiante
**Elegido**: `autocomplete` no reutiliza el mecanismo de "limpiar valor si ya no existe en la colección resuelta" que hoy aplican `select`/`radioGroup`/`checkboxGroup`. Implementa su propia lógica de retención de valor: una vez fijado un valor simple o añadido un chip, permanece aunque `queries.{queryName}.data` deje de incluirlo en una búsqueda posterior. Esta lógica vive junto al propio nodo `autocomplete` (no en un módulo compartido), porque es un comportamiento deliberadamente distinto al del resto de campos de selección, no una variante configurable de la misma regla.

**Por qué frente a la alternativa**: parametrizar el helper compartido de "limpieza por colección" con un flag de persistencia mezclaría dos semánticas opuestas (catálogo completo y estable vs. sugerencias de búsqueda parciales) en un único helper, dificultando su lectura para `select`/`radioGroup`/`checkboxGroup`. Mantenerlos separados es más simple y no introduce una rama condicional en un contrato ya estable.

**Aclaración de alcance**: esta regla de no-limpieza aplica solo al shape dinámico (`queries.*` e `item.*`). El shape estático (manual literal/escalar) sigue el comportamiento ya vigente en `select`: si la colección cambia y el valor deja de existir, se limpia (ya así fijado en `spec.md`).

**Riesgo residual**: ninguno; comportamiento explícitamente cerrado por `spec.md`.

### Decisión 7 — Reutilización del contrato de `items` y su validación
**Elegido**: la validación de los tres shapes cerrados de `props.items` (manual literal, manual escalar, dinámico unificado) se extrae a un helper compartido reutilizado por `select` y `autocomplete` dentro de `validate-form-nodes.ts`, en vez de duplicar la lógica de rechazo (`code: invalid-layout`, ruta exacta) para el nuevo nodo.

**Por qué**: el contrato es literalmente idéntico (mismos tres shapes, mismos mensajes de error) y `conventions.md` pide centralizar validaciones repetibles que formen parte del contrato del producto.

**Coste**: si en el futuro `select` y `autocomplete` divergen en algún shape de `items`, habrá que separar el helper de nuevo; no se anticipa como riesgo real dado que ambos derivan del mismo modelo de catálogo.

### Decisión 8 — Registro del nodo y estado local de interacción
**Elegido**: nuevo fichero `src/runtime/nodes/autocomplete-layout-node.tsx`, registrado en el dispatcher central de nodos y en la validación de "solo dentro de `form`" de `validate-form-nodes.ts`, siguiendo el mismo punto de extensión ya documentado en `architecture.md` para nodos declarativos nuevos. Todo el estado de interacción (texto en curso en modo múltiple, temporizador de debounce, apertura/cierre de la lista de sugerencias, índice resaltado para navegación por teclado) es estado local del componente, no del store compartido — mismo patrón ya usado por la paginación local de `repeater` ("estado local del consumidor").

**Accesibilidad**: se sigue el patrón ARIA de combobox con sugerencias (`role="combobox"`, `aria-expanded`, `aria-controls` hacia la lista, `role="listbox"`/`role="option"`, `aria-activedescendant` para el resaltado por teclado), manteniendo la asociación label↔control y el `aria-describedby` hacia el error ya establecidos por `select`.

## Riesgos y trade-offs
- **Colisión de `queryName` compartido entre instancias** (Decisión 5): riesgo de producto aceptado explícitamente; debe quedar documentado en la ficha del nodo, no es un defecto de implementación.
- **Asimetría del mecanismo de inyección de texto entre modo simple y múltiple** (Decisión 3): dos caminos técnicos distintos para un mismo problema conceptual; aceptado por evitar ampliar contratos cerrados de `spec.md`.
- **Nueva superficie de disparo de red fuera de `preloads`/botón/submit** (Decisión 2): es la primera vez que un nodo de formulario individual dispara ejecución de operación por su cuenta; una vez implementado, debe añadirse como punto de extensión estable en `architecture.md` para que futuras features lo encuentren documentado en vez de reinventarlo.
- **Interpretación de `item.*` como filtrado local** (Decisión 1): difiere de una lectura literal aislada de un párrafo de `spec.md`; se documenta explícitamente aquí y en la ficha del nodo para que no se reinterprete de nuevo en planificación.

## Migración o despliegue
No aplica: nodo nuevo, puramente aditivo. No hay datos existentes que migrar ni contratos previos que romper.

## Preguntas abiertas
Ninguna bloqueante. Todas las decisiones técnicas delegadas por `spec.md` (mecanismo de disparo por tecleo, convivencia de instancias) quedan cerradas en este documento.
