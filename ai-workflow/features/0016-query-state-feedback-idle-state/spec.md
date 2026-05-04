# Spec: Query state feedback idle state

## Objetivo
Permitir que `queryStateFeedback` distinga explícitamente el estado de una query que todavía no ha sido lanzada, para que la UI declarativa pueda reaccionar de forma diferente antes de la primera ejecución y durante una carga real.

## Alcance
- Añadir soporte funcional a un nuevo estado visible de `queryStateFeedback` alineado con el estado actual `queries.{queryName}.status: idle`.
- Permitir que cualquier nodo soportado hoy por `queryStateFeedback` pueda declarar reglas específicas para ese estado.
- Dejar de proyectar automáticamente `idle` como `loading` dentro de `queryStateFeedback`.
- Mantener intacta la semántica actual de `loading`, `error`, `empty` y `success` una vez la query ya ha sido lanzada.
- Hacer que `idle` funcione exactamente igual que el resto de estados visibles ya soportados, tanto en declaración como en evaluación.
- Mantener la misma semántica de visibilidad efectiva reutilizada por render y por validación de formularios.

## Fuera de alcance
- Añadir estados visibles nuevos fuera de `idle`.
- Rediseñar el dominio base de `queries` o cambiar su shape público.
- Introducir un motor general de condiciones, expresiones o branching declarativo en el layout.
- Resolver por esta feature diferencias entre “query ausente en el store” y “query declarada pero todavía no ejecutada” más allá de lo necesario para `queryStateFeedback`.
- Cambiar la semántica de `preloads`, refetch automático o reseteo de queries.

## Requisitos funcionales
- `queryStateFeedback.states` debe admitir una clave adicional para el estado visible inicial de query no lanzada.
- La spec adopta `idle` como nombre preferido para ese estado, porque ya existe en `queries.{queryName}.status` y en el agregado `pageEntry`, y evita introducir terminología paralela.
- Cuando `queries.{queryName}.status` sea `idle`, el runtime debe evaluar `queryStateFeedback.states.idle` si está declarado.
- `idle` debe comportarse como un estado visible de primera clase, con la misma capacidad que `loading`, `error`, `empty` y `success` para declarar `show`, `hide` o `fallback`.
- Si `queryStateFeedback.states.idle` no está declarada, el runtime debe aplicar a `idle` la misma política de defaults que aplica al resto de estados no declarados: no inventar una regla especial fuera del contrato común.
- Una query ausente del store debe tratarse de forma explícita y estable como `idle` para `queryStateFeedback`.
- Esa misma semántica debe aplicarse tanto en render normal como en la evaluación de visibilidad usada por formularios.
- `loading` debe representar exclusivamente una ejecución en curso, no el estado previo a la primera ejecución.
- Debe ser posible configurar casos como:
  - ocultar un bloque antes de la primera búsqueda
  - mostrar un mensaje tipo “haz una búsqueda” antes de la primera búsqueda
  - mostrar spinner solo cuando la búsqueda ya está efectivamente en marcha
- La feature no debe impedir seguir reutilizando `empty` para “sin resultados” una vez la query sí ha respondido pero sin datos útiles.
- El contrato debe seguir rechazando claves de estado no soportadas dentro de `queryStateFeedback.states`.

## Requisitos no funcionales
- La semántica del nuevo estado debe quedar alineada entre contrato JSON, validación, renderer y documentación funcional.
- La solución debe seguir siendo comprensible para backend y para autores de configuración sin exigir conocimiento interno de React o del store.
- Los criterios por defecto de `queryStateFeedback` deben seguir siendo uniformes entre estados visibles, sin introducir excepciones específicas para `idle`.
- La feature no debe convertir esta iteración en un sistema de reglas complejo.

## Criterios de aceptación
- Un nodo con `queryStateFeedback.states.idle.mode: hide` permanece oculto mientras la query todavía no ha sido lanzada.
- Un nodo con `queryStateFeedback.states.idle.mode: fallback` puede mostrar un mensaje de “haz una búsqueda” antes de la primera ejecución.
- Un nodo con `queryStateFeedback.states.loading.mode: fallback` muestra su spinner solo mientras la query está efectivamente en `loading`.
- Tras una primera ejecución exitosa con datos vacíos, el runtime evalúa `empty` y no vuelve a tratar ese caso como `idle`.
- Tras una primera ejecución fallida, el runtime evalúa `error` y no vuelve a tratar ese caso como `idle`.
- El contrato de validación acepta `idle` como clave soportada en `queryStateFeedback.states`.
- El contrato de validación sigue rechazando cualquier otra clave no soportada en `queryStateFeedback.states`.
- La misma semántica visible de `idle` se reutiliza al decidir si un campo `required` dentro de un formulario debe contar como visible o no.

## Casos límite
- Query declarada en `api` pero todavía ausente del store en el primer render.
- Query inicializada explícitamente en el store con `status: idle` pero sin haberse lanzado todavía.
- Query que pasa de `idle` a `loading` y luego a `success` o `error`.
- Query que ya tuvo `success` y luego vuelve a `loading` por una recarga; en ese caso debe seguir evaluándose `loading`, no `idle`.
- Nodo con `queryStateFeedback` que solo declara `idle` y `success`, dejando el resto de estados al comportamiento por defecto.
- Campo de formulario oculto por `queryStateFeedback.states.idle` que pasa a visible después de la primera ejecución de la query observada.

## Riesgos o preguntas abiertas
- Debe revisarse si la documentación de `empty` necesita reforzar que “sin ejecutar todavía” y “ejecutada sin resultados” son estados distintos y no intercambiables.

## Áreas de producto afectadas
- Contrato del JSON declarativo del runtime.
- Feedback visual ligado al estado de queries.
- Formularios declarativos cuando `queryStateFeedback` gobierna la visibilidad efectiva de campos requeridos.

## Documentación probablemente afectada
- `ai-workflow/docs/app-features/config-contract.md`
- `ai-workflow/docs/app-features/queries-and-feedback.md`
- `ai-workflow/docs/app-features/config-driven-ui-runtime.md`
- `ai-workflow/docs/current-state.md`
