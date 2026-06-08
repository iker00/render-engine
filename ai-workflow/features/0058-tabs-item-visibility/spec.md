# Spec: visibilidad por tab individual en el nodo `tabs`

## Objetivo

Permitir que cada tab dentro de `props.items` del nodo `tabs` declare su propia regla `visibility`, de forma que un tab pueda ocultarse o mostrarse dinámicamente en función de referencias del runtime sin ocultar el nodo entero.

## Alcance

- Cada item de `props.items` puede declarar opcionalmente un campo `visibility` con el mismo shape que el `visibility` transversal del runtime: `{ reference, operator, value }`.
- Un tab oculto no aparece en la barra de pestañas y su panel nunca se renderiza.
- Si el tab activo queda oculto (por cambio de referencias en runtime), el nodo activa automáticamente el primer tab visible.
- Si `defaultTab` apunta a un tab oculto al montar, el nodo activa el primer tab visible en su lugar.
- Si no hay ningún tab visible, el nodo no renderiza nada (degradación silenciosa, mismo comportamiento que `props.items` vacío).
- El `visibility` a nivel del nodo `tabs` completo sigue funcionando como hasta ahora: si evalúa como oculto, el nodo entero desaparece.
- Las referencias admitidas en el `visibility` por item son las mismas que en el `visibility` transversal: `forms.*`, `queries.*`, `params.*`, `item.*`.

## Fuera de alcance

- Deshabilitar tabs individuales (visible pero no clickable).
- Control del tab activo mediante acciones UI (`activateTab` u otras).
- Tabs generados dinámicamente desde una colección de `queries.*`.
- Persistencia del tab activo.
- Condiciones múltiples o composición booleana en `visibility`.
- Carga lazy de paneles.

## Requisitos funcionales

1. El shape de `visibility` por item es idéntico al `visibility` transversal del runtime y admite los mismos operadores: `equals`, `notEquals`, `isTruthy`, `isFalsy`, `greaterThan`, `lessThan`.
2. Un item sin `visibility` declarada se comporta siempre como visible (sin cambio respecto al comportamiento actual).
3. La barra de pestañas solo renderiza los tabs visibles. Los tabs ocultos no aparecen en el DOM (ni la etiqueta ni su panel).
4. Cuando el tab activo pasa a estar oculto, el runtime selecciona automáticamente el primer tab visible (por índice de posición dentro del array original, ignorando ocultos).
5. Cuando `defaultTab` apunta a un tab oculto al montar, el runtime selecciona el primer tab visible en su lugar.
6. Si no hay ningún tab visible en un momento dado, el nodo no renderiza ni barra ni panel.
7. La validación previa al render rechaza el config si el `visibility` de cualquier item no cumple el shape válido (referencia fuera de alcance, operador no reconocido, combinación `value` / operador inválida).

## Requisitos no funcionales

- La evaluación de `visibility` por item reutiliza la misma lógica de resolución de referencias que el resto del runtime; no se implementa lógica de evaluación ad hoc en el nodo.
- El comportamiento de selección del primer tab visible no debe producir bucles de re-render ni efectos secundarios adicionales.

## Criterios de aceptación

- Un tab con `visibility: { reference: "forms.user.role", operator: "equals", value: "admin" }` no aparece en la barra ni renderiza su panel cuando la referencia no resuelve al valor declarado.
- Si el tab activo queda oculto, el nodo muestra automáticamente el primer tab visible sin intervención del usuario.
- Si `defaultTab: 1` y el item en posición 1 está oculto, el nodo monta con el primer tab visible activo.
- Si todos los tabs están ocultos, el nodo no renderiza nada.
- Un item sin `visibility` sigue comportándose como siempre (visible).
- La validación previa rechaza un `visibility.reference` inválido en cualquier item con diagnóstico de ruta exacta.
- El `visibility` del nodo `tabs` completo sigue funcionando independientemente del `visibility` por item.

## Casos límite

- Todos los tabs ocultos: el nodo no renderiza nada.
- El primer tab oculto, el segundo visible, `defaultTab: 0`: monta con el segundo tab activo.
- El tab activo se oculta durante el uso: el nodo activa el primer tab visible. Si no hay ninguno visible, el nodo no renderiza nada.
- Un tab con `children` vacío y visible: se renderiza la pestaña en la barra y el panel queda vacío (comportamiento ya existente, no afectado).
- `visibility` por item declarado con `reference: "item.*"`: válido solo si el nodo `tabs` está dentro de `repeater.props.template`; fuera de ese contexto la referencia `item.*` no resuelve, lo que se trata según la semántica estándar de referencia ausente.

## Áreas de producto afectadas

- Nodo `tabs` y su ficha en `ai-workflow/docs/app-features/nodes/tabs.md`.
- Validación previa al render (módulo de validación de nodos de layout).
- Índice de features.

## Riesgos o preguntas abiertas

Ninguno. El alcance queda cerrado con las decisiones tomadas en la exploración previa.
