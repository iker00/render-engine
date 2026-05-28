> Cuándo leer: `node.queryStateFeedback` transversal — qué estados soporta, modos `show`/`hide`/`fallback`, cómo interactúa con `visibility` y con formularios.
> Tamaño: corto.
> Relacionados: [[visibility.md]], [[../queries/feedback.md]], [[../forms/validation-rules.md]].

# `queryStateFeedback`

## Shape
Cualquier nodo soportado hoy puede declarar opcionalmente:
- `query`: nombre no vacío de la query observada
- `states`: mapa opcional con claves limitadas a `idle`, `loading`, `error`, `empty` y `success`

Cada regla de `states` admite exactamente uno de estos modos:
- `mode: show`
- `mode: hide`
- `mode: fallback`, que exige `fallback` como colección ordenada de `LayoutNode[]`

## Reglas funcionales
- `queryStateFeedback` es transversal a `container`, `heading`, `paragraph`, `list`, `image`, `table`, `button`, `form`, `input`, `textarea`, `select`, `radioGroup` y `checkboxGroup`.
- `fallback` reutiliza el mismo catálogo de nodos soportados por `layout`; no introduce un dialecto paralelo ni un wrapper sintético obligatorio.
- un fallback puede contener varios nodos hermanos y conserva su orden declarado.
- si un estado visible no tiene regla explícita, el runtime aplica `success -> show` y `idle/loading/error/empty -> hide`.
- `idle` es un estado visible soportado de primera clase para esta capacidad.
- una query ausente del store también se interpreta como `idle`.
- `loading` representa solo una ejecución real en curso; no cubre el estado previo a la primera ejecución.
- la misma semántica visible se reutiliza también dentro del submit de formularios para decidir qué campos `required` cuentan como visibles.
- si un nodo también declara `visibility`, `queryStateFeedback` mantiene prioridad y puede dejar resuelto `hide` o `fallback` antes de que `visibility` se evalúe.
- varios nodos pueden reaccionar de forma distinta a la misma query sin colisionar entre sí.

## Validación de shape
- Si `queryStateFeedback.states` contiene una clave fuera de `idle | loading | error | empty | success`, el config completo se rechaza con error de layout sobre esa ruta exacta.
- Si una regla usa `mode: fallback` sin `fallback`, el config completo se rechaza antes del render.
- Si cualquier nodo dentro de `queryStateFeedback.states.{estado}.fallback` es inválido o usa un `type` no soportado, el config completo se rechaza antes del render sobre la ruta afectada.
