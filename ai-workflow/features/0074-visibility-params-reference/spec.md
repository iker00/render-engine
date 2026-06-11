# Spec: `params.*` como referencia admitida en `visibility`

## Objetivo

Permitir que las reglas de `visibility` y los predicados `when` que reutilizan el mismo shape puedan referenciar parámetros de navegación activos (`params.{paramName}`), de forma que nodos o acciones puedan condicionarse según el contexto de la URL sin necesitar una query intermedia.

## Alcance

- `params.{paramName}` pasa a ser una referencia admitida en `visibility.reference`.
- El mismo shape se reutiliza en `submitAction.onSuccess[*].when`, `pages[].preloads[*].when` y `button.props.action.operations[*].when`; la ampliación aplica de forma consistente a todos ellos.
- La restricción de un único segmento dinámico tras el namespace (`params.userId` válido; `params`, `params.user.id` inválidos) es la misma que en el resto de superficies que ya admiten `params.*`.
- Los operadores soportados son los mismos que para el resto de referencias: `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`.
- La validación previa al render acepta `params.{paramName}` como referencia válida; cualquier otra forma bajo `params` sigue rechazándose.

## Fuera de alcance

- Acceso a subrutas bajo `params` (forma `params.user.id` con más de un segmento dinámico).
- Conversión automática de strings a números para operadores numéricos: los valores de `params.*` llegan siempre como string; `greaterThan` y `lessThan` sobre un string degradan a no-match con la semántica ya existente.
- Condiciones múltiples o composición booleana en `visibility`.
- Adición de `params.*` a las fuentes de colección (`repeater.props.items.source`, `list.props.items.source`, `select.props.items.source`, `radioGroup.props.items.source`, `checkboxGroup.props.items.source`); esas superficies siguen fuera de alcance.

## Requisitos funcionales

1. `visibility.reference` acepta `params.{paramName}` con exactamente un segmento dinámico.
2. La evaluación de `params.{paramName}` usa el estado de `params` activo en el runtime en el momento de la evaluación; si el param no existe, se trata como valor ausente (`isFalsy` evalúa como verdadero, el resto de operadores no hacen match).
3. `isTruthy` e `isFalsy` operan sobre el valor string directamente: un string no vacío es truthy; un string vacío o ausencia de param es falsy.
4. `equals` y `notEquals` comparan el valor string del param contra el literal `value` declarado (que puede ser `string`, `number`, `boolean` o `null`); la comparación es estricta sin coerciones de tipo.
5. `greaterThan` y `lessThan` degradan a no-match si el valor del param no es numéricamente comparable, sin lanzar error.
6. La validación previa al render rechaza `params` (sin segmento), `params.user.id` (más de un segmento) y cualquier forma no reconocida bajo el namespace `params`.
7. Los predicados `when` que comparten el mismo shape de validación y resolución quedan actualizados de forma consistente sin configuración adicional.

## Requisitos no funcionales

- La resolución de `params.{paramName}` reutiliza el mecanismo ya existente en `runtime-references/`; no se introduce lógica de navegación de params en el validador ni en el evaluador de visibilidad.
- El cambio en validación no afecta a referencias fuera del namespace `params`; el resto de reglas de rechazo permanecen intactas.

## Criterios de aceptación

- Un nodo con `visibility: { reference: "params.userId", operator: "isTruthy" }` se oculta cuando `userId` no está en la URL activa y se muestra cuando sí lo está.
- Un nodo con `visibility: { reference: "params.mode", operator: "equals", value: "edit" }` se muestra solo cuando la URL lleva `mode=edit` como param de navegación.
- Un nodo con `visibility: { reference: "params.mode", operator: "notEquals", value: "readonly" }` se muestra siempre que `mode` no sea `"readonly"`, incluyendo cuando `mode` no existe (referencia ausente trata el no-match del operador según la política de valor ausente).
- `greaterThan` y `lessThan` sobre un param con valor string no numérico no lanzan error y el nodo se trata como no-match (oculto si el operador determina visibilidad, visible si lo contrario).
- La validación previa rechaza `visibility.reference: "params"` y `visibility.reference: "params.user.id"` con error sobre la ruta exacta.
- La validación previa rechaza `visibility.reference: "params.userId"` si `params.userId` tiene el prefijo correcto pero el valor de `operator` está fuera del catálogo, de forma idéntica al comportamiento con otras familias de referencias.
- Un predicado `when` en `onSuccess`, `preloads` u `operations` que usa `params.{paramName}` es aceptado por la validación y evaluado correctamente en runtime.
- El comportamiento de todos los demás `visibility.reference` soportados no cambia.

## Casos límite

- `params.userId` cuando el runtime está en una página sin ese param activo: se trata como valor ausente; `isFalsy` retorna verdadero, el resto degrada a no-match.
- `params.page` con valor `"3"` (string) y `operator: "greaterThan"`, `value: 2`: el valor string `"3"` no es numéricamente comparable con la política actual (strings degradan a no-match); el operador no hace match.
- `params.mode` con `operator: "equals"`, `value: true` (boolean): la comparación `"edit" === true` es falsa; si el valor del param es el string `"true"`, también es falsa según comparación estricta.
- Cambio de página a una que no incluye un param referenciado en `visibility`: el nodo evalúa la referencia como ausente y aplica la semántica de valor ausente.

## Áreas de producto afectadas

- `ai-workflow/docs/app-features/references/visibility.md` — ampliar la lista de referencias admitidas.
- `ai-workflow/docs/app-features/references/reference-resolution.md` — actualizar la frontera específica de `params.*` para reflejar que `visibility.reference` ya admite la familia.
- Validación previa al render (módulo `validate-actions-visibility` o equivalente).
- Tests de validación y de resolución de visibilidad.

## Riesgos o preguntas abiertas

Ninguno. El alcance queda cerrado con el contexto disponible.
