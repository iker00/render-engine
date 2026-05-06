# Spec: Declarative runtime visibility rules

## Objetivo
Permitir que cualquier nodo soportado del layout, incluidos los campos dentro de formularios, pueda mostrarse u ocultarse declarativamente según un valor concreto ya disponible en el runtime, sin introducir todavía un motor general de reglas, expresiones o branching complejo.

## Alcance
- Añadir un bloque declarativo `visibility` disponible para cualquier nodo soportado del layout actual.
- Permitir una sola condición de visibilidad por nodo en esta primera iteración.
- Evaluar la condición contra una única referencia completa ya soportada por el runtime.
- Soportar reglas simples de comparación y verdad para cubrir casos habituales de UI condicional.
- Hacer que los campos ocultos por `visibility` se comporten de forma coherente con la semántica actual de campos ocultos por `queryStateFeedback` durante la validación y el submit.
- Mantener convivencia explícita con `queryStateFeedback`, que sigue siendo el mecanismo específico para estados visibles de query y `fallback`.

## Fuera de alcance
- Composición booleana de condiciones (`and`, `or`, `not`) o listas de reglas por nodo.
- Expresiones arbitrarias, transformaciones de datos o plantillas condicionales.
- `fallback` dentro de `visibility`.
- Nuevos namespaces de referencias fuera de `forms.*` y `queries.*`.
- Comparaciones lexicográficas de strings, evaluación item a item sobre colecciones o reglas agregadas más complejas.
- Cambios en la política de persistencia del estado local de formularios al ocultar o volver a mostrar campos.

## Requisitos funcionales
- El contrato de configuración debe admitir un bloque opcional `visibility` en cualquier nodo soportado por el layout.
- `visibility` debe modelar exactamente una condición basada en:
  - una referencia completa del runtime ya soportada
  - un operador
  - un valor esperado solo cuando el operador lo necesite
- Los operadores soportados en v1 deben ser `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan` y `lessThan`.
- Las referencias admitidas en v1 deben limitarse a:
  - `forms.{formId}.{fieldId}`
  - `queries.{queryName}`
  - `queries.{queryName}.data`
  - `queries.{queryName}.data.*`
  - `queries.{queryName}.status`
  - `queries.{queryName}.error`
- Si el nodo no declara `visibility`, su comportamiento visible no debe cambiar.
- Si el nodo declara `visibility`, el runtime debe decidir si el nodo se muestra u oculta según el resultado de esa condición.
- `equals` y `notEquals` deben permitir comparar contra valores literales compatibles con los datos que ya circulan por el runtime en esta v1.
- `isTruthy` e `isFalsy` deben evaluar el valor resuelto con una semántica simple y consistente, incluyendo referencias válidas que todavía no resuelven dato.
- `greaterThan` y `lessThan` deben cubrir comparaciones numéricas y comparaciones por longitud cuando el valor observado sea una colección.
- Una referencia válida que todavía no resuelve dato debe tratarse como valor ausente:
  - `isFalsy` puede considerarla falsa
  - `equals`, `notEquals`, `greaterThan` y `lessThan` no deben considerarla match por defecto salvo que el contrato de ese operador quede satisfecho explícitamente
- Cuando un nodo declare a la vez `queryStateFeedback` y `visibility`, primero debe resolverse `queryStateFeedback` y después `visibility` sobre el resultado visible restante.
- Los campos de formulario ocultos por `visibility` deben conservar su estado local actual.
- Los campos de formulario ocultos por `visibility` no deben bloquear el submit mientras permanezcan ocultos.
- Cuando un campo oculto por `visibility` vuelva a ser visible, debe recuperar su estado local conservado y volver a participar en la validación normal del formulario.

## Requisitos no funcionales
- La feature debe mantener el alcance deliberadamente pequeño y explicable de la v1.
- La semántica de `visibility` debe ser coherente con la convención actual de referencias del runtime y con el comportamiento visible existente de formularios y queries.
- La configuración inválida debe rechazarse antes del render con diagnósticos trazables sobre la ruta del JSON afectada.
- La feature no debe sustituir ni volver ambiguo el propósito de `queryStateFeedback`.
- La redacción del contrato debe dejar claro que `visibility` es una regla de show/hide sobre valores del runtime, no un sistema general de lógica condicional.

## Áreas de producto afectadas
- Contrato declarativo del JSON del runtime.
- Render visible del catálogo de nodos soportados.
- Formularios declarativos y semántica de validación de campos visibles.
- Reutilización de datos de `forms.*` y `queries.*` para comportamiento condicional.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/forms-and-validation.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/current-state.md`

## Criterios de aceptación
- Un `heading`, `paragraph`, `list`, `button`, `container` o `form` puede declararse visible solo cuando `visibility` evalúa verdadero contra un valor de `forms.*` o `queries.*`.
- Un campo dentro de un `form` puede mostrarse u ocultarse según el valor actual de otro campo ya almacenado en `forms.{formId}.{fieldId}`.
- Un bloque puede mostrarse u ocultarse según `queries.{queryName}.status`, `queries.{queryName}.error` o una ruta anidada bajo `queries.{queryName}.data.*` sin requerir lógica imperativa por pantalla.
- Un campo `required` oculto por `visibility` conserva su valor local pero no bloquea el submit mientras permanezca oculto.
- Al volver a mostrarse un campo oculto por `visibility`, el runtime reutiliza el valor local ya conservado en lugar de rehidratarlo como si fuera un campo nuevo.
- Si una configuración usa un operador fuera del catálogo soportado o una referencia fuera del alcance permitido, el runtime rechaza el config antes del render con error trazable.
- Si un nodo combina `queryStateFeedback` y `visibility`, el resultado observable respeta primero la semántica de `queryStateFeedback` y después la de `visibility`.
- `visibility` no introduce `fallback`, condiciones múltiples ni expresiones compuestas en esta iteración.

## Casos límite
- Referencia válida pero todavía ausente porque la query no se ha ejecutado o el campo aún no tiene dato persistido.
- Recarga de una query que entra en `loading` conservando datos previos mientras `visibility` observa `status` o `data`.
- Comparaciones `greaterThan` y `lessThan` sobre arrays vacíos, arrays con elementos y valores no comparables.
- Campos que alternan repetidamente entre visible y oculto sin perder su valor, error o estado `dirty/touched` ya existente.
- Nodos que ya dependen de `queryStateFeedback` y además añaden `visibility` sobre la misma query o sobre otra fuente distinta.
- Reglas sobre `queries.*.error` o `queries.*` completos cuyo valor puede ser objeto, `null` o ausente.

## Riesgos o preguntas abiertas
- Riesgo medio por impacto transversal en contrato JSON, validación, renderer y validación efectiva de formularios visibles.
- Conviene `design.md` antes de implementar porque la precedencia entre `queryStateFeedback`, `visibility` y validación de formularios debe resolverse de forma única y reutilizable.
- La spec asume que `greaterThan` y `lessThan` compararán números y longitud de colecciones, pero no otros tipos; esa frontera debe mantenerse explícita en la planificación para evitar ampliaciones silenciosas.
