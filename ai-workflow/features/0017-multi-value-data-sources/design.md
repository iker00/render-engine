# Design: Multi-value data sources

## Contexto
La feature `0007` ya dejó estable la resolución centralizada de referencias del runtime y `0008` amplió `queries.{queryName}.data.*` para navegar colecciones y objetos anidados sin abrir un lenguaje general de expresiones. La feature `0015` añadió `select` con items manuales estáticos y una semántica de inicialización lazy de formularios que no rehidrata silenciosamente valores tardíos. Hoy el runtime ya puede:
- renderizar `list` con `props.items: string[]`
- renderizar `select` con `props.items: { label, value }[]`
- resolver `defaultValue` dinámicos contra `forms.*` y `queries.*`
- reutilizar `queryStateFeedback` para loading, error, empty, success e idle

Lo que todavía no existe es una capacidad compartida para que consumidores de colecciones usen un origen manual o un origen resuelto desde `queries.*` sin lógica React ad hoc por pantalla. Si se implementara sin diseño previo, quedarían abiertas varias divergencias:
- cómo ampliar el contrato sin romper compatibilidad con `props.items` ya existentes
- dónde vive la normalización común entre `list` y `select`
- cómo distinguir colecciones de escalares frente a colecciones de objetos con mapeos declarativos
- cómo mantener coherente la semántica de `select` entre render, inicialización lazy, validación `required` y submit

## Objetivos / No objetivos

### Objetivos
- Introducir una abstracción compartida de origen de colección reutilizable por varios consumidores.
- Aplicarla en esta iteración a `list` y `select`.
- Mantener compatibilidad total con configuraciones actuales que solo usan `items` manuales.
- Permitir colecciones manuales y colecciones dinámicas resueltas desde `queries.{queryName}.data` o desde `queries.{queryName}.data.*`.
- Soportar colecciones de escalares y de objetos con mapeo declarativo específico por consumidor.
- Centralizar la normalización para que validación, renderer y formularios usen la misma colección efectiva.

### No objetivos
- Añadir nuevos nodos o nuevos tipos de campo.
- Abrir filtros, ordenación, transformaciones arbitrarias o interpolación sobre colecciones.
- Añadir búsquedas remotas, autocompletado, paginación, multiselect o recarga incremental.
- Cambiar la semántica de `api`, `preloads`, caché o refetch.
- Introducir una fuente de datos declarativa distinta de manual o `queries.*`.

## Decisiones

### 1. Se mantiene `props.items` y se amplía para aceptar una fuente declarativa compartida
Para evitar romper configuraciones actuales, `list.props.items` y `select.props.items` seguirán existiendo, pero dejarán de ser exclusivamente arrays literales.

La capacidad compartida será un discriminado de dos familias:
- origen manual
- origen dinámico desde query

Forma objetivo a nivel conceptual:
- manual escalar: colección literal en el propio JSON
- manual objeto: colección literal de objetos con mapeo del consumidor
- query escalar: `source: "queries.searchUsers.data.results", itemType: "scalar"`
- query objeto: `source: "queries.searchUsers.data.results"` más mapeos por consumidor

Compatibilidad explícita:
- `list.props.items: string[]` sigue siendo válido y conserva su semántica observable actual
- `select.props.items: { label, value }[]` sigue siendo válido y conserva su semántica observable actual

Razonamiento:
- evita migraciones obligatorias
- mantiene el backend legacy operativo con shapes simples
- permite que la validación trate el caso histórico como azúcar sintáctico del origen manual

### 2. El contrato compartido se normaliza a una colección efectiva por consumidor, no a un AST genérico
La feature no debe crear un mini lenguaje de transformación. En su lugar, cada consumidor convertirá su definición declarativa a una colección efectiva mínima:
- `list` siempre normaliza a `string[]`
- `select` siempre normaliza a `{ label: string; value: string }[]`

La resolución común solo cubre:
- obtener la colección base
- degradar a vacía cuando el dato no es utilizable
- recorrer elementos sin romper el render

Cada consumidor resuelve después su propia proyección visible:
- `list` decide qué texto mostrar
- `select` decide qué texto usar como `label` y qué dato usar como `value`

Razonamiento:
- separa la resolución del origen de la semántica visual del consumidor
- evita una abstracción demasiado amplia para v1
- deja base reutilizable para futuros consumidores sin imponerles el shape interno de `select`

### 3. Las colecciones dinámicas solo aceptan referencias completas a `queries.{queryName}.data` o a ramas anidadas bajo `queries.{queryName}.data.*`
El origen dinámico reutilizará la convención central de referencias ya establecida:
- debe ser un string completo
- se admite apuntar directamente a `.data` cuando la colección vive en raíz
- cuando haga falta navegación adicional, esta solo se admite bajo `.data`
- no se admiten expresiones, filtros ni concatenaciones

Semántica fijada:
- referencia inválida a nivel contractual: el config falla antes del render
- referencia válida cuya query aún no existe o cuyo valor actual no es coleccionable: la colección efectiva es vacía
- una ruta a objeto, `null`, escalar o dato ausente cuando se esperaba colección no rompe el render ni inventa elementos

Razonamiento:
- alinea la feature con `0007` y `0008`
- conserva una semántica diagnóstica clara entre config inválido y dato todavía no disponible
- mantiene a `queryStateFeedback` como mecanismo de feedback visible sin duplicar estados

### 4. `list` y `select` usarán mapeos específicos del consumidor para colecciones de objetos
La spec exige soportar objetos sin obligar a transformar la respuesta de la API fuera del JSON. Esa capacidad se cierra con mapeos explícitos por consumidor:
- `list` requiere un único campo visible, por ejemplo `itemLabel`
- `select` requiere `label` y `value`

Los mapeos deben ser rutas relativas al elemento actual, no referencias globales del runtime. Ejemplos conceptuales:
- `list`: mostrar `name`
- `select`: usar `name` como etiqueta y `id` como valor

No se abre en esta iteración:
- navegación arbitraria con sintaxis nueva
- fallback entre varias rutas
- funciones de transformación

Razonamiento:
- mantiene el contrato generable desde backend
- evita mezclar el espacio global `queries.*` con la navegación interna de cada item
- deja explícito cuándo una colección de objetos necesita configuración adicional

### 5. La validación previa al render debe distinguir shape compatible, shape ambiguo y degradación runtime
La validación en `src/config/` debe cerrar todo lo que dependa solo del contrato:
- no permitir dos orígenes incompatibles a la vez para la misma colección
- no permitir un origen dinámico fuera de `queries.*.data` o `queries.*.data.*`
- exigir mapeos cuando el shape declarado pueda producir objetos
- seguir rechazando `select` con valores heterogéneos dentro del resultado manual ya conocido

La validación no debe intentar cerrar en bootstrap datos que solo existen en runtime, por ejemplo:
- si una query devolverá realmente un array
- si la colección está todavía vacía o ausente
- si un refetch futuro eliminará la opción actualmente seleccionada

Razonamiento:
- preserva la frontera actual entre contrato y estado runtime
- evita falsas validaciones semánticas sobre datos remotos aún no presentes
- deja la degradación visible en manos de la colección efectiva vacía y `queryStateFeedback`

### 6. La resolución común vivirá en una capa reutilizable entre `runtime-references`, renderer y formularios
La colección efectiva no debe calcularse por separado dentro de `list`, `select` y `form`. La partición preferida es:
- `src/config/`: tipos y validaciones del nuevo contrato
- `src/runtime/`: helper central para resolver y normalizar fuentes de colección
- `src/runtime/nodes/list-layout-node.tsx`: solo renderiza la colección ya normalizada para `list`
- `src/runtime/nodes/select-layout-node.tsx`: solo renderiza la colección ya normalizada para `select`
- `src/runtime/nodes/form-layout-node.tsx`: reutiliza la misma normalización para default value, validación y submit

El helper compartido debe devolver resultados suficientemente concretos para evitar lógica duplicada:
- colección efectiva
- posible diagnóstico de elementos inválidos en desarrollo
- homogeneidad de valores efectiva en `select`

Razonamiento:
- hoy `select` reparte su semántica entre `form-layout-node.tsx` y `select-layout-node.tsx`
- si la nueva fuente dinámica se implementa localmente en cada nodo, aparecerán divergencias difíciles de testear
- una capa común reduce el riesgo sobre futuros consumidores

### 7. `select` mantiene su modelo interno string y trata como vacío cualquier valor ya no disponible
La feature no cambia la decisión actual de normalizar los valores de `select` a string en runtime. La semántica estable pasa a ser:
- la colección efectiva de `select` siempre expone `value` como string
- si el valor actual almacenado no existe en la colección efectiva, el control se renderiza vacío
- esa misma condición hace que `required` lo considere vacío
- el submit usa el valor normalizado actual, no una opción ya desaparecida
- la llegada tardía de opciones no cuenta como reinicialización si el campo ya tenía estado

Esto exige reutilizar la misma utilidad de normalización en:
- `resolveFieldDefaultValue`
- render del `<select>`
- validación `required`
- posible limpieza de errores al cambiar el valor

Razonamiento:
- conserva la semántica ya establecida por `0015`
- evita inconsistencias entre DOM, store y validación
- cierra explícitamente el caso límite más delicado de la spec

### 8. Los elementos objeto inválidos se degradan por item cuando sea posible, no derriban toda la colección
Cuando una colección de objetos incluya elementos incompletos:
- `list` debe omitir o degradar solo esos elementos concretos
- `select` debe omitir solo las opciones que no puedan resolver sus mínimos (`label` o `value`)
- en desarrollo debe emitirse diagnóstico útil y trazable
- el render visible no debe romper el árbol ni convertir toda la colección en error

La degradación por item solo aplica cuando el origen ya es una colección válida. Si el valor resuelto no es coleccionable en absoluto, el resultado sigue siendo colección vacía.

Razonamiento:
- equilibra robustez visible y trazabilidad
- evita que un solo item corrupto inutilice un catálogo remoto entero
- se alinea con la idea de “degradación predecible” pedida por la spec

## Estructura objetivo

```txt
src/
  config/
    runtime-config-types.ts
    runtime-config-zod.ts
    validate-runtime-config.ts
  runtime/
    runtime-collection-sources.ts
    nodes/
      list-layout-node.tsx
      select-layout-node.tsx
      form-layout-node.tsx
  tests/
    runtime-config-validation.test.ts
    layout-renderer.test.tsx
    runtime-state.test.tsx
```

Notas:
- el nombre final del helper compartido puede variar, pero debe vivir fuera de nodos concretos
- no hace falta mover la semántica de referencias fuera de `runtime-references`; solo reutilizarla

## Estrategia de implementación
El orden recomendado es:

1. Cerrar tipos y validación del nuevo contrato preservando compatibilidad con `items` manuales actuales.
2. Introducir la utilidad compartida de resolución de colecciones y cubrirla con tests de normalización y degradación.
3. Adaptar `list` para consumir la colección efectiva y soportar escalares u objetos con mapeo visible.
4. Adaptar `select` y `form` para consumir la colección efectiva, mantener normalización string y respetar la inicialización lazy actual.
5. Ejecutar regresión final sobre validación, renderer y semántica de formularios.

## Riesgos y mitigaciones
- Riesgo: romper compatibilidad con `items` manuales actuales.
  Mitigación: tratarlos como una vía soportada explícitamente y cubrir regresión en validación y render.

- Riesgo: duplicar la lógica de resolución entre `list`, `select` y `form`.
  Mitigación: introducir una utilidad compartida para colección efectiva y normalización por consumidor.

- Riesgo: aceptar un contrato demasiado flexible y convertir la feature en un motor de transformaciones.
  Mitigación: limitar el origen dinámico a `queries.*.data` o `queries.*.data.*` y los mapeos a rutas relativas simples por item.

- Riesgo: dejar inconsistente el comportamiento de `select` cuando cambian las opciones remotas.
  Mitigación: centralizar la verificación de vigencia del valor actual y reutilizarla en render, validación y default value.

- Riesgo: bloquear catálogos enteros por un solo item defectuoso.
  Mitigación: degradación por elemento con diagnóstico de desarrollo.

## Migración o despliegue
No hay migración persistida.

Compatibilidad esperada:
- configuraciones históricas con `list.props.items: string[]` siguen funcionando sin cambios
- configuraciones históricas con `select.props.items: { label, value }[]` siguen funcionando sin cambios
- la feature amplía el contrato, pero no obliga a reescribir pantallas existentes

## Decisiones cerradas tras revisión
- Una referencia dinámica válida bajo `queries.{queryName}.data` o `queries.{queryName}.data.*` nunca invalida el config por el tipo del dato runtime actual. Si el valor disponible en ejecución no es coleccionable, el consumidor degrada a colección vacía.
- El path dinámico esperado puede apuntar directamente a `.data` cuando la respuesta ya es una colección raíz, o a la rama real devuelta por la API bajo `.data`, por ejemplo `queries.searchUsers.data.results` cuando la respuesta es `{ results: [] }`.
- El shape objetivo del origen dinámico queda cerrado a nivel funcional así:
- `list`: `items: { source: "queries.searchUsers.data.results", itemText: "name" }`
- `list` escalar: `items: { source: "queries.searchUsers.data", itemType: "scalar" }`
- `select`: `items: { source: "queries.searchUsers.data.results", label: "name", value: "id" }`
- `select` escalar: `items: { source: "queries.searchUsers.data", itemType: "scalar" }`
- se mantienen como compatibles los arrays históricos `string[]` y `{ label, value }[]`
- Los mapeos relativos por item admiten rutas simples o anidadas como `name` y `author.name`.
- Si un `select` pierde la opción correspondiente al valor persistido, el runtime limpia también el estado almacenado del campo a `''` para unificar render, validación, submit y reset.
