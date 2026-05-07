# Design: Reusable form field expansion

## Contexto
La feature `0015` dejó estable el catálogo inicial de formularios con `form`, `input`, `textarea` y `select`, además de la semántica de inicialización lazy sobre `forms.{formId}.{fieldId}`, validación `required` y submit reutilizando `queries.{operationName}`. La feature `0017` añadió una capa compartida de resolución de colecciones para `list` y `select`, permitiendo orígenes manuales y dinámicos desde `queries.*` con una semántica estable de degradación a vacío.

La nueva feature quiere ampliar esa base sin romperla:
- `input` debe abrir más tipos nativos útiles.
- `radioGroup` y `checkboxGroup` deben entrar en el catálogo declarativo.
- `select` debe soportar multiselección sin abrir un nodo nuevo.
- los campos basados en opciones deben compartir semántica de `items`, `defaultValue`, validación y submit.

Sin diseño previo quedarían abiertas varias divergencias peligrosas:
- si `checkboxGroup` y `select` multiselección almacenan formas distintas del mismo concepto
- si la resolución de opciones se duplica entre nodos y formularios
- si `defaultValue` múltiple rehidrata de forma distinta según el tipo de campo
- si el valor vacío y la limpieza de selecciones inválidas no siguen una misma regla

## Objetivos / No objetivos

### Objetivos
- Ampliar `input` con un set pequeño y cerrado de tipos nativos muy usados.
- Introducir `radioGroup` y `checkboxGroup` como nodos declarativos de formulario.
- Añadir multiselección a `select` mediante una prop explícita en el propio campo.
- Reutilizar una única semántica de resolución de opciones entre `select`, `radioGroup` y `checkboxGroup`.
- Reutilizar una única semántica de selección múltiple entre `checkboxGroup` y `select` multiselección.
- Mantener compatibilidad con las configuraciones actuales de `input`, `textarea` y `select`.

### No objetivos
- Abrir autocompletado, búsqueda remota, carga incremental o virtualización de opciones.
- Añadir validaciones avanzadas distintas de `required`.
- Introducir layout visual configurable para grupos de opciones.
- Abrir una capa general de transformaciones de datos o expresiones arbitrarias sobre colecciones.
- Rediseñar la política global de persistencia de formularios entre páginas.

## Decisiones

### 1. `input` se amplía con un catálogo corto y explícito
La ampliación de `inputType` debe ser cerrada y mantener el mismo modelo actual basado en tipos nativos HTML. La lista objetivo queda:
- existentes: `text`, `email`, `password`, `search`, `tel`, `url`
- nuevos: `number`, `date`, `datetime-local`

No se añaden todavía:
- `time`
- `month`
- `week`
- `range`
- `color`

Razonamiento:
- cubre el primer set útil para búsqueda, edición y captura básica
- evita abrir tipos con semánticas de parsing o UX más delicadas
- mantiene el contrato simple y validable con `Zod`

### 2. `radioGroup` y `checkboxGroup` entran como nodos propios; `multiselect` se resuelve como capacidad de `select`
La selección única y la selección múltiple se modelan así:
- `radioGroup`: nodo nuevo para varias opciones visibles con selección única
- `checkboxGroup`: nodo nuevo para varias opciones visibles con selección múltiple
- `select`: conserva su nodo actual y añade una prop booleana explícita de multiselección

La decisión de contrato queda cerrada a favor de una prop booleana simple en `select.props`, `multiple`, por coherencia con el elemento HTML nativo y con el shape actual del campo.

Razonamiento:
- `radioGroup` y `checkboxGroup` tienen semántica visual distinta de `select`
- `select` multiselección no necesita otro tipo de nodo porque sigue siendo el mismo control conceptual
- usar `multiple` evita inventar una API nueva para una capacidad nativa del control

### 3. Todos los campos de opciones comparten la misma capa de normalización de `items`
La resolución compartida introducida por `0017` debe ampliarse para que no esté acoplada solo a `list` y `select`. El modelo objetivo es:
- una colección base resuelta desde items manuales o `queries.*`
- una proyección final por consumidor

Consumidores tras esta feature:
- `select` selección única
- `select` multiselección
- `radioGroup`
- `checkboxGroup`

La resolución común debe seguir cerrando:
- colección vacía cuando el dato runtime no es coleccionable
- omisión por item cuando faltan datos mínimos en una colección de objetos
- homogeneidad del `value` efectivo dentro del mismo campo

Razonamiento:
- evita que `radioGroup` y `checkboxGroup` reimplementen la semántica ya fijada por `select`
- mantiene un único lugar para degradación, diagnóstico y normalización
- prepara la base para futuros consumidores de opciones

### 4. El modelo interno de opción efectiva se unifica a `{ label: string; value: string }`
Igual que hoy ocurre con `select`, todos los campos basados en opciones deben trabajar en runtime con un modelo ya normalizado:
- `label`: string visible
- `value`: string estable

La validación de contrato sigue permitiendo `string | number` en origen declarativo, pero la normalización ocurre antes de render, validación del campo y submit.

Razonamiento:
- el DOM ya obliga a convivir con strings en `input[type=radio]`, `input[type=checkbox]` y `<select>`
- evita divergencias entre valor almacenado, comparación de `defaultValue`, validación y limpieza de selecciones inválidas

### 5. La selección múltiple tiene una única representación interna: `string[]`
Se cierra una regla común para cualquier campo de varias selecciones:
- `checkboxGroup` y `select` con `multiple` almacenan `string[]`
- el orden interno debe seguir el orden efectivo de las opciones visibles, no el orden arbitrario de interacción del usuario
- el valor vacío de cualquier selección múltiple se representa como `[]`

Para selección única:
- `select` simple y `radioGroup` almacenan `string`
- el valor vacío se representa como `''`

Razonamiento:
- alinear el orden con el catálogo efectivo facilita comparación, reset y tests
- `[]` como vacío evita ambigüedad con `null`, `''` o ausencia
- mantener `string` y `string[]` separa con claridad selección única y múltiple sin inventar coerciones

### 6. `defaultValue` múltiple sigue exactamente el mismo contrato que el estado múltiple
El diseño cierra la pregunta abierta de la spec así:
- `defaultValue` para `checkboxGroup` y `select.multiple` acepta solo una colección escalar en origen declarativo
- esa colección puede llegar como literal JSON o como referencia dinámica completa soportada por el runtime
- el runtime normaliza esa colección a `string[]`
- solo se conservan los valores que sigan existiendo en las opciones efectivas
- el orden final del valor inicial también se reordena según el catálogo efectivo de opciones
- si un `defaultValue` dinámico múltiple no resuelve una colección, el campo degrada a `[]`
- si un `defaultValue` dinámico múltiple resuelve una colección con miembros no escalares, esos miembros se ignoran y solo se conservan los `string | number` que además sigan existiendo en las opciones efectivas

Casos no válidos a nivel contractual o semántico:
- `defaultValue` escalar en un campo múltiple
- `defaultValue` objeto o array de objetos
- mezcla de tipos incompatibles dentro del array si el origen es literal

Razonamiento:
- hace que `defaultValue`, estado local, validación y submit hablen exactamente el mismo idioma
- reduce mucho el riesgo de edge cases distintos entre `checkboxGroup` y `select` multiselección

### 7. La limpieza de selecciones inválidas debe ser compartida y explícita
Cuando cambie la colección efectiva de opciones:
- `radioGroup` y `select` simple limpian a `''` si su valor ya no existe
- `checkboxGroup` y `select.multiple` filtran su `string[]` contra las opciones disponibles

Esta limpieza no es solo visual. Debe actualizar también el estado almacenado del campo para que queden alineados:
- render
- `required`
- submit
- reset posterior

Razonamiento:
- ya existe esa semántica en `select` simple y hay que extenderla, no duplicarla
- si el store conserva valores inexistentes, aparecerán inconsistencias difíciles de depurar

### 8. La validación `required` reutiliza el tipo de valor efectivo del campo
La validación visible de formularios no debe conocer detalles del renderer concreto. Debe trabajar contra el valor efectivo ya normalizado:
- `input` y `textarea`: inválidos con `''` o whitespace
- `select` simple y `radioGroup`: inválidos con `''`
- `checkboxGroup` y `select.multiple`: inválidos con `[]`
- si un `defaultValue` dinámico simple no resuelve un escalar soportado o ya no existe en las opciones efectivas, el valor inicial efectivo degrada a `''`

La exclusión de campos ocultos por `queryStateFeedback` o `visibility` sigue reutilizando la utilidad de visibilidad efectiva ya acordada por `0019`.

Razonamiento:
- evita lógica especial por nodo dentro del submit
- mantiene la validación alineada con el shape real guardado en `forms.*`

### 9. El submit no adapta tipos por consumidor; envía el valor efectivo del store
La capa de submit del formulario debe seguir leyendo `forms.{formId}.{fieldId}` como única fuente de verdad:
- `radioGroup` y `select` simple aportan `string`
- `checkboxGroup` y `select.multiple` aportan `string[]`

No se introduce un adaptador nuevo por tipo de campo. Si el backend quiere otra forma, esa transformación queda fuera de esta feature y se resolvería en una futura capacidad declarativa o en la API receptora.

Razonamiento:
- mantiene simple el contrato del runtime
- evita introducir heurísticas de serialización que no están en la spec

### 10. La validación previa al render debe cerrarse con contexto de formulario y de multiplicidad
`Zod` debe ampliarse para reconocer:
- nuevos `inputType`
- `radioGroup`
- `checkboxGroup`
- `select.props.multiple`

Después del parseo siguen haciendo falta validaciones semánticas:
- `radioGroup` y `checkboxGroup` solo dentro de `form`
- `fieldId` único dentro del formulario
- `items` con shape compatible con la semántica compartida
- homogeneidad de tipos de valor en campos de opciones manuales
- `defaultValue` literal coherente con la multiplicidad del campo cuando pueda cerrarse en bootstrap

La validación no debe intentar cerrar datos runtime que solo existirán al resolver `queries.*`.

Razonamiento:
- el contrato no se puede cerrar solo por nodo aislado
- la multiplicidad del campo afecta a la forma válida de `defaultValue`

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
      form-layout-node.tsx
      input-layout-node.tsx
      select-layout-node.tsx
      radio-group-layout-node.tsx
      checkbox-group-layout-node.tsx
  tests/
    runtime-config-validation.test.ts
    layout-renderer.test.tsx
    runtime-state.test.tsx
```

Notas:
- los nombres finales de archivo para `radioGroup` y `checkboxGroup` deben seguir `kebab-case`
- no hace falta crear un subsistema nuevo de formularios fuera de `runtime/nodes/` y de la capa compartida de colecciones

## Estrategia de implementación
Orden recomendado:

1. Extender contrato, tipos y validaciones semánticas para `inputType`, `radioGroup`, `checkboxGroup` y `select.multiple`.
2. Ampliar la capa compartida de resolución de colecciones para producir opciones efectivas reutilizables por todos los campos basados en opciones.
3. Extraer helpers compartidos para:
   - normalizar selección única
   - normalizar selección múltiple
   - limpiar valores ya inválidos al cambiar opciones
4. Adaptar `select` y `form` para soportar multiplicidad sin romper la semántica actual de selección única.
5. Añadir `radioGroup` y `checkboxGroup` reutilizando la misma capa de opciones y de validación.
6. Cerrar regresión de visibilidad, `required`, reset y submit sobre campos simples y múltiples.

## Riesgos y mitigaciones
- Riesgo: duplicar semántica de opciones entre `select`, `radioGroup` y `checkboxGroup`.
  Mitigación: mover toda la resolución a la capa compartida y consumir solo opciones efectivas normalizadas.

- Riesgo: almacenar arrays con orden inestable según la interacción del usuario.
  Mitigación: reordenar siempre la selección múltiple según el orden efectivo del catálogo visible.

- Riesgo: permitir `defaultValue` ambiguos entre simple y múltiple.
  Mitigación: validar por multiplicidad y fijar `''` para simple frente a `[]` para múltiple.

- Riesgo: romper compatibilidad con `select` simple actual.
  Mitigación: mantener `multiple` opcional y dejar intacta la semántica previa cuando no esté presente.

- Riesgo: mezclar demasiado pronto concerns visuales y de estado en grupos de opciones.
  Mitigación: limitar esta feature al contrato, semántica de valor y renderer base accesible, sin abrir layout configurable.

## Migración o despliegue
No hay migración persistida.

Compatibilidad esperada:
- `input`, `textarea` y `select` actuales siguen funcionando sin cambios si no usan capacidades nuevas
- `select` solo entra en modo multiselección cuando declara explícitamente `multiple`
- el contrato de `items` no se rompe; se reutiliza y se extiende a nuevos consumidores

## Decisiones cerradas tras diseño
- La prop de multiselección de `select` se cierra como booleana simple y alineada con HTML nativo.
- El valor vacío de selección única es `''`; el de selección múltiple es `[]`.
- El valor interno de selección múltiple se cierra a `string[]`.
- `defaultValue` de `checkboxGroup` y `select.multiple` se cierra como colección escalar, con la misma semántica para ambos.
- El orden estable de una selección múltiple sigue el orden de las opciones efectivas disponibles.
