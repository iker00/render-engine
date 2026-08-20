---
name: review-implementation-plan
description: Revisa críticamente un plan de implementación antes de codificar. Úsala para validar que `tasks.md`, `status.yaml` y `design.md` cuando aplique formen un contrato de ejecución claro, secuencial y sin ambigüedad peligrosa, incluyendo el sub-bloque de tests de cada tarea.
model: sonnet
allowed-tools: Read, Edit
---

# Revisar plan de implementación

Usa esta skill cuando ya exista una spec y un plan preliminar, pero quieras comprobar si el contrato de ejecución está lo bastante cerrado como para implementar sin reinterpretaciones peligrosas.

## Modos de invocación
Esta skill puede ejecutarse de dos formas:

- **Automático al final de `generate-implementation-plan`**: esa skill lanza un sub-agente con contexto limpio que aplica este contrato sobre los artefactos recién generados. Es el modo por defecto.
- **Manual por el usuario**: cuando se quiera un segundo pase tras refinamientos, o cuando el plan se haya editado manualmente, o cuando se reabra una feature antigua.

En ambos casos el contrato de la revisión es el mismo. La única diferencia es que, en modo sub-agente, el contexto del agente está limpio y la salida debe ser un veredicto explícito (plan aprobado o refinamientos concretos) que el agente principal pueda aplicar.

## Leer siempre
- `ai-workflow/docs/workflow.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/spec.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/tasks.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/design.md` si existe o si `status.yaml` marca `requires_design: true`
- `ai-workflow/docs/context.md`
- `ai-workflow/docs/architecture.md`
- `ai-workflow/docs/conventions.md`
- `ai-workflow/docs/app-features/index.md`
- solo las fichas de `ai-workflow/docs/app-features/` que el índice marque como relevantes (típicamente 1-3, rara vez más de 5)

## Leer si aplica
- `ai-workflow/docs/current-state.md` si hace falta confirmar estado vigente o límites actuales.
- `ai-workflow/features/index.md` si hace falta contexto histórico o coordinación con otras features.

## Objetivo
Revisar si el plan está realmente listo para implementación y, si hace falta, refinar:
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/tasks.md` (incluye el sub-bloque `tests` de cada tarea)
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/design.md`
- `ai-workflow/features/YYYY-MM-DD-HH-MM-feature-name/status.yaml`

No implementar código.

## Qué debe revisar
- ambigüedad funcional restante entre `spec.md` y `tasks.md`
- tareas demasiado grandes o mezcladas
- dependencias mal ordenadas
- impacto en archivos poco claro
- sub-bloque `Interfaces` ausente o con firmas que no coinciden literalmente entre tareas
- sub-bloque `tests` ausente, incompleto o no literal en alguna tarea
- impacto documental no explicitado
- necesidad real de `design.md`
- gates de implementación en `status.yaml`

### Verificaciones específicas del sub-bloque `Interfaces` por tarea
- Cada tarea de `tasks.md` incluye su sub-bloque `Interfaces` con las subsecciones `Consume` y `Produce` (`ninguno` en cualquiera de las dos si no aplica).
- Cada firma listada en `Consume` por una tarea aparece literalmente idéntica (mismo nombre, misma firma de parámetros y tipo de retorno) en el `Produce` de la tarea de la que depende. Un nombre parecido pero no idéntico, o una firma con parámetros distintos, es un desajuste real, no una diferencia de estilo.
- Cada firma listada en `Produce` por una tarea que otra tarea declara usar en su `Consume` referencia el ID correcto de la tarea productora.
- Si una tarea posterior necesita claramente un artefacto de código que crea una tarea previa (según su `Impacto esperado en archivos` u objetivo) pero no aparece como `Consume`/`Produce` en ninguna de las dos, es un hueco de planificación: el subagente de esa tarea tendría que inventar o adivinar el contrato.

### Verificaciones específicas del sub-bloque `tests` por tarea
- Cada tarea de `tasks.md` incluye su sub-bloque `tests` con las cuatro subsecciones estables: `Ficheros de test`, `Comportamiento cubierto`, `Comandos durante la implementación`, `Restricciones` (esta última puede estar vacía).
- Cada fichero de test del sub-bloque está anotado con su rol explícito: `(nuevo)` o `(ampliación)`. Cuando un fichero aparece en varias tareas, cada tarea acota los casos que aporta y declara su rol.
- Los bullets de `Comportamiento cubierto` son lo bastante concretos como para que un subagente de implementación con contexto limpio pueda traducir cada bullet a un test sin reinterpretar el alcance.
- Los `Comandos durante la implementación` contienen comandos exactos `pnpm test --run <ruta>` por cada fichero de test de la tarea.
- Las `Restricciones` de la tarea no repiten reglas universales que ya viven en `ai-workflow/standards/testing-rules.md`.
- Tareas sin tests propios (refactor puro, doc-only) declaran su sub-bloque con `ficheros: ninguno; cubierto por: <ID o suite>` y no lo omiten.

## Reglas de trabajo
- Priorizar detectar riesgos y ambigüedad antes que "aprobar" el plan rápido.
- Si una tarea admite dos interpretaciones funcionalmente distintas, pedir refino.
- Si una tarea es demasiado grande para un cambio seguro, dividirla.
- Si el sub-bloque `Interfaces` de una tarea tiene una firma en `Consume` que no coincide literalmente con ningún `Produce` de una tarea previa (o coincide con una firma distinta), marcar refinamiento y devolver el control a `generate-implementation-plan`. No reescribir el sub-bloque desde esta skill.
- Si el sub-bloque `tests` de una tarea falta o no es lo bastante literal para que un subagente con contexto limpio pueda implementarlo sin reinterpretar, marcar refinamiento y devolver el control a `generate-implementation-plan`. No reescribir el sub-bloque desde esta skill.
- Si el riesgo o la complejidad justifican `design.md` y no existe, marcar `requires_design: true` y `artifacts.design: missing` en `status.yaml`, dejar `implementation.ready: false` y redirigir a `generate-feature-design`. No escribir `design.md` desde esta skill.
- Si el plan ya es suficientemente bueno, dejarlo explícito y marcar en `status.yaml` que la implementación está habilitada.
- Actualizar `status.yaml` al terminar para reflejar:
  - `phase: planning`
  - `blocked_by` si existen huecos reales
  - `implementation.ready: true | false`
  - `feature_status: planned` solo si el plan queda listo

## Salida esperada en modo sub-agente
Cuando esta skill se invoca desde `generate-implementation-plan` como sub-agente, la respuesta final debe estructurarse para que el agente principal pueda actuar sin reinterpretar:

- veredicto explícito: `aprobado` o `requiere refinamiento`
- lista numerada de refinamientos concretos cuando aplique, cada uno apuntando al artefacto y la sección afectada
- estado sugerido para `implementation.ready` y `blocked_by`
- sin prosa adicional fuera de lo anterior

## Terminado cuando
- queda claro si la feature está lista o no para implementación
- `tasks.md` queda refinado si hacía falta, incluyendo el sub-bloque `tests` de cada tarea afectada
- cada sub-bloque `Interfaces` es coherente: todo `Consume` tiene su `Produce` literal-idéntico en la tarea correspondiente
- `design.md` queda exigida o descartada con criterio explícito
- `status.yaml` refleja el resultado real de la revisión
